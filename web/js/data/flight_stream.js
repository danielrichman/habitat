/*
 * Change pushing:
 *   - streamDataTo: synchronise or send data to another array
 *     e.g., keep a gmaps points array up to date by pushing new points into it
 *   - onDataChange: call a function when something's changed,
 *     passing the complete (new) array
 *     e.g., every time something changes delete the contents of a div and
 *     repopulate with the new contents
 *   - If change push targets are setup before init() is called then they
 *     receive data when it is ready. Otherwise, the new target will be
 *     initialised immediately.
 *
 * HabitatDB(db_name) - Downloads and maintains the array of flights.
 *   .init() - connect, download, begin watching for changes.
 *   .onDataChange(fn)
 *   .streamDataTo(target)
 *   .reset() - clears all push targets, stops downloading data, frees.
 *
 * Flight
 *   Object (i.e., {}) from couch (so, .start, .end, .payloads, etc.)
 *   .init() - downloads flight data. Uses changes stream from parent HabitatDB
 *             to watch for changes.
 *   .telem.onDataChange(fn)
 *   .telem.streamDataTo(target)
 *   .reset() - same as in HabitatDB
 * 
 * StreamTarget()
 *   GMaps-Array-like, with addition of init
 *   .init(array) (clear, then push all in array)
 *   .push(elem)
 *   .insert(i, elem)
 *   .remove(i)
 *   .set(i, elem)
 *   .clear()
 */

States = {
    UNINIT: 0,
    SETUP: 1,
    READY: 2
}

/*
 * function types:
 *  - id_map: take an object, return its unique id
 *  - map: function(elem, oldelem): modify elem before storing.
 *          If elem is being updated, oldelem is supplied, else null
 *  - filter: funtion(elem): return true if elem is relevant/should be
 *            included. If false is returned, elem is treated as if it
 *            doesn't exist.
 *  - sort: as in Array.sort(f):  function (a, b) returning -1, 0 or 1
 *
 * settings object: all are optional except update_sort
 *  - init_map
 *  - init_filtered
 *  - init_sort
 *  - update_map
 *  - update_filter
 *  - update_sort
 */

function couch_doc_id_map(obj) {
    return obj._id;
}

function couch_view_doc_map(obj) {
    return obj.doc;
}

function couch_view_id_map(obj) {
    return obj.id;
}

function SortedArraySync(settings) {
    var state = States.UNINIT;
    var data, data_ids;
    var changeCallbacks = [], streamTargets = [];

    this.dataInitialise = function (newdata) {
        if (state !== States.UNINIT)
            throw "Already initialised";

        state = States.READY;

        /* Ensure that if newdata is never cloned, we copy it first */
        if (!settings.init_map && !settings.init_filter)
            data = newdata.splice(0);
        else
            data = newdata;

        if (settings.init_map)
            data = data.map(settings.init_map);

        if (settings.init_filter)
            data = data.filter(settings.init_filter);

        if (settings.init_sort)
            data.sort(settings.init_sort);

        data_ids = data.map(couch_doc_id_map);

        changeCallbacks.forEach(function (elem) {
            elem(data);
        });

        streamTargets.forEach(function (elem) {
            elem.init(data);
        });
    };

    this.processChanges = function (changes) {
        if (state !== States.READY)
            throw "Not ready";

        /* Miscellaneous functions */
        function data_remove(pos)
        {
            data.splice(pos, 1);
            data_ids.splice(pos, 1);
            streamTargets.forEach(function (elem) {
                elem.remove(pos);
            });
        }

        function data_ids_insert(pos, id) {
            data_ids.splice(pos, 0, id);
        }

        function modified_data_will_move(doc, pos) {
            if (pos === 0) {
                var next = data[pos + 1];
                return (settings.update_sort(doc, next) !== -1);
            } else if (old_pos === (data.length - 1)) {
                var prev = data[pos - 1];
                return (settings.update_sort(prev, doc) !== -1);
            } else {
                var next = data[pos + 1];
                var prev = data[pos - 1];
                return ((settings.update_sort(doc, next) !== -1) ||
                        (settings.update_sort(prev, doc) !== -1));
            }
        }

        var new_data = [];

        changes.forEach(function (change) {
            var doc = couch_view_doc_map(change);
            var id = couch_view_id_map(change);
            var deleted = false;
            var old_pos = data_ids.indexOf(id);

            /*
             * Treat filtered docs like a deletion change. Therefore if
             * a doc was 'relevant' before, but isn't any more, it will
             * be removed
             */

            if (elem.deleted || (settings.update_filter &&
                                 !settings.update_filter(doc)))
                 deleted = true;

            if (!deleted) {
                if (old_pos === -1) {
                    /* insertion */
                    if (settings.update_map)
                        doc = settings.update_map(doc, null);

                    new_data.push(doc);
                } else {
                    if (settings.update_map)
                        doc = settings.update_map(doc, data[old_pos]);

                    /* modification: try to avoid having to move. */
                    if (modified_data_will_move(doc, old_pos)) {
                        /* delete, re-insert */
                        data_remove(old_pos);
                        new_data.push(doc);
                    } else {
                        /* modify in place */
                        data[old_pos] = doc;
                        streamTargets.forEach(function (elem) {
                            elem.set(pos, doc);
                        });
                    }
                }
            } else if (old_pos !== -1) {
                /* deletion */
                data_remove(old_pos);
            }
        });

        var new_data_ids = [];

        new_data.forEach(function (elem) {
            new_data_ids.push(couch_doc_id_map(elem));
            data.push(elem);
        });

        data.sort(settings.update_sort);

        data.forEach(function (elem, i) {
            if (new_data_ids.indexOf(couch_doc_id_map(elem)) !== -1) {
                streamTargets.forEach(function (elem) {
                    elem.insert(i, elem);
                });
                data_ids_insert(i, elem);
            }
        });

        changeCallbacks.forEach(function (elem) {
            elem(data);
        });
    };

    this.addChangeCallback = function (cb) {
        changeCallbacks.push(cb);

        if (state === States.READY)
            cb(data);
    };

    this.addStreamTarget = function (cb) {
        streamTargets.push(cb)

        if (state === States.READY)
            cb.init(data);
    };
}

function sort_compare(a, b) {
    return ((a > b) ? 1 : ((a < b) ? -1 : 0));
}

function flight_sort(a, b) {
    return sort_compare(a.launch.time, b.launch.time);
}

function HabitatDB(db_name) {
    var db = $.couch.db(db_name);
    var state = States.UNINIT;
    var changelistener;

    function flight_add_methods(elem, oldelem) {
        /* TODO */
    }

    var flights = SortedArraySync({
        init_map: function (elem) {
            return flight_add_methods(couch_view_doc_map(elem), null);
        },
        update_sort: flight_sort,
        update_map: flight_add_methods
    }

    this.onDataChange = flights.addChangeCallback;
    this.streamDataTo = flights.addStreamTarget;

    this.init = function () {
        if (state !== States.UNINIT)
            throw "Already initialised";

        state = States.SETUP;

        /*
         * Download the list of flights. To avoid a race condition, we 
         * find the current update seq and then grab the flights view.
         * Having done that, we know that the data is at least as old as
         * the update_seq, or more recent. We then start looking for changes
         * since that update_seq. Changes overwrite, so it's OK if we get
         * a change we already know about. This ensures no data is missed.
         */

        db.info({ success: function (info) {
            if (state !== States.SETUP)
                return; /* Aborted */

            db.view("habitat/flights", { success: function (data) {
                if (state !== States.SETUP)
                    return;

                this.setup_complete(info.update_seq, data)
            }});
        }});
    };

    this.setup_complete = function (seq, data) {
        state = States.READY

        flights = data;
        
        /* Listen for all changes since seq */
        changelistener = db.changes(seq, { include_docs: true });
        changelistener.onChange(this.process_changes);
    };

    this.process_changes = function (data) {
        /* TODO */
    };

}










/* db_name: couch name; "habitat"
 * output: object with push, insertAt, removeAt, setAt, clear methods 
 * (modeled on gmaps' MVCArray style) */

// TODO: have flightlist_output & watch for flight doc changes (?)
// TODO: Permanant changes listening ?
// TODO: Include flight doc itself in all_flight_info or flights.
// TODO: multiple payloads per flight (!)
// TODO: go super leet event style.

function FlightStream(db_name, output) {
    var db = $.couch.db(db_name);
    var flight, dataloader, changelistener;
    var payload_telemetry, payload_telemetry_ids;
    var listener_info, listener_telem;

    function flights(cb) {
        db.view("habitat/flights", { success: function (data) {
            var fldocs = [];
            data.rows.forEach(function (row) {
                fldocs.push(row.value);
            });
            cb(fldocs);
        } });
    }

    function reset() {
        flight = null;
        payload_telemetry = null;
        payload_telemetry_ids = null;
        listener_info = null;
        listener_telem = null;

        changelistener = null;
        dataloader = null;
    }

    function abort() {
        if (dataloader !== null)
            dataloader.abort();

        /* TODO: Actually abort the ajax request! */
        if (changelistener !== null)
            changelistener.stop();

        reset();
    }

    function select_flight(f) {
        abort();
        output.clear();

        flight = f;

        dataloader = (function () {
            var cancelled = false;

            // Race condition avoidance! Get the last seq, download, then
            // look for changes.
            db.info({ success: function (info) {
                db.view("habitat/all_flight_info", { success: function (data) {
                    if (!cancelled)
                        got_initial_data(data, info.update_seq);
                }, key: flight });
            }});

            function abort() {
                /* TODO: Actually abort the ajax request! */
                cancelled = true;
            }

            return { abort: abort };
        })();
    }

    function ptlm_sort_func(a, b) {
        var av = a.estimated_time_created;
        var bv = b.estimated_time_created;
        return ((av > bv) ? 1 : ((av < bv) ? -1 : 0));
    }

    function got_initial_data(data, last_seq) {
        payload_telemetry = [];
        listener_info = {};
        listener_telem = {};

        data.rows.forEach(function (elem) {
            var doc = elem.value;
            var type = doc.type;

            if (type === "listener_info") {
                listener_info[id] = doc;
            } else if (type === "listener_telem") {
                listener_telem[id] = doc;
            } else if (type === "payload_telemetry") {
                payload_telemetry.push(doc);
            }
        });

        payload_telemetry.sort(ptlm_sort_func);

        payload_telemetry_ids = [];
        payload_telemetry.forEach(function (elem) {
            output.push(elem);
            payload_telemetry_ids.push(elem._id);
        });

        // Begin (permanently) listening for changes.
        changelistener = db.changes(last_seq, { include_docs: true });
        changelistener.onChange(got_changes);
    }

    function got_changes(data)
    {
        function is_relevant_to_flight(doc, fl) {
            // See couchdb/habitat/views/all_flight_info.
            // We have to check ourselves if a certain change is relevant
            // to the flight since 
            return ((doc.type === "payload_telemetry" && doc.data._flight &&
                     doc.data._flight === fl) ||
                    ((doc.type === "listener_telem" ||
                      doc.type === "listener_info") &&
                     doc.relevant_flights &&
                     doc.relevant_flights.indexOf(fl) !== -1))
        }

        function modified_ptlm_will_move(old_pos, new_doc) {
            if (old_pos === 0) {
                var next = payload_telemetry[old_pos + 1];
                return (ptlm_sort_func(new_doc, next) !== -1);
            } else if (old_pos === (payload_telemetry.length - 1)) {
                var prev = payload_telemetry[old_pos - 1];
                return (ptlm_sort_func(prev, new_doc) !== -1);
            } else {
                var next = payload_telemetry[old_pos + 1];
                var prev = payload_telemetry[old_pos - 1];
                return ((ptlm_sort_func(new_doc, next) !== -1) ||
                        (ptlm_sort_func(prev, new_doc) !== -1))
            }
        }

        function ptlm_del(pos) {
            payload_telemetry.splice(pos, 1);
            payload_telemetry_ids.splice(pos, 1);
            output.removeAt(pos);
        }

        var new_ptlm = [];

        // Unpack changes.
        data.results.forEach(function (elem) {
            var id = elem.id;

            // Treat all irrelevant docs like they don't exist.
            if (!is_relevant_to_flight(elem.doc, flight))
                elem.deleted = true;

            var ptlm_old_pos = payload_telemetry_ids.indexOf(id);

            if (elem.deleted) {
                // A deleted doc doesn't have a type. Gotta delete based on id

                if (ptlm_old_pos !== -1) {
                    // deletion
                    ptlm_del(ptlm_old_pos);
                } else {
                    // Javascript doesn't care if we do this.
                    // XXX: This is not accounted for. They would only be
                    // deleted by an administrator.
                    delete listener_telem[id];
                    delete listener_info[id];
                }
            } else {
                // modification or insertion
                var type = elem.doc.type;

                // XXX: listener_info and listener_telem would only be
                // modified by an administrator. This is not yet accounted
                // for.

                if (type === "listener_info") {
                    listener_info[id] = elem.doc;
                } else if (type === "listener_telem") {
                    listener_telem[id] = elem.doc;
                } else if (type === "payload_telemetry") {
                    if (ptlm_old_pos !== -1) {
                        // If possible, avoid moving the item in the output
                        // list because that's probably quite expensive.

                        if (modified_ptlm_will_move(ptlm_old_pos, elem.doc)) {
                            // delete & re insert.
                            ptlm_del(ptlm_old_pos);
                            new_ptlm.push(elem.doc);
                        } else {
                            payload_telemetry[ptlm_old_pos] = elem.doc;
                            output.setAt(ptlm_old_pos, elem.doc);
                        }
                    } else {
                        // insertion.
                        new_ptlm.push(elem.doc);
                    }
                }
            }
        });

        function ptlm_ids_insertAt(pos, elem) {
            payload_telemetry_ids.splice(pos, 0, elem);
        }

        var new_ptlm_ids = [];

        new_ptlm.forEach(function (elem) {
            payload_telemetry.push(elem);
            new_ptlm_ids.push(elem._id);
        });

        payload_telemetry.sort(ptlm_sort_func);

        for (var i = 0; i < payload_telemetry.length; i++) {
            var elem = payload_telemetry[i];

            if (new_ptlm_ids.indexOf(elem._id) !== -1) {
                output.insertAt(i, elem);
                ptlm_ids_insertAt(i, elem._id);
            }
        }
    }

    reset();

    return { flights: flights, select_flight: select_flight };
}
