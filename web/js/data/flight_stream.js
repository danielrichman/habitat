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
