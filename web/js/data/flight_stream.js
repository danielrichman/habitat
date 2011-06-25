/*
 * Copyright 2011 (C) Daniel Richman
 *
 * This file is part of habitat.
 *
 * habitat is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * habitat is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with habitat.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Change pushing:
 *  - streamDataTo: synchronise or send data to another array.
 *    e.g., keep a gmaps points array up to date by pushing new points into it
 *    See StreamTarget
 *  - onDataChange: call a function when something's changed,
 *    passing the complete (new) array
 *    e.g., every time something changes delete the contents of a div and
 *    repopulate with the new contents
 *  - streamSetTo: given an object [think dict] of K-V pairs
 *    See SetTarget
 *  - onSetChange: like onDataChange but for K-V pairs. Passes
 *    an object, e.g., {"ASDF": 123, "DFGH": 456}
 *  - If change push targets are setup before init() is called then they
 *    receive data when it is ready. Otherwise, the new target will be
 *    initialised immediately.
 *
 * HabitatDB(db_name) - Downloads and maintains the array of flights.
 *   .init() - connect, download, begin watching for changes.
 *   .onDataChange(fn)
 *   .streamDataTo(target)
 *   .reset() - clears all push targets, stops downloading data, frees.
 *
 * Flight
 *   Object (i.e., {}) from couch (so, .start, .end, .payloads, etc.)
 *   .dm.init() - downloads flight data. Uses changes stream from parent
 *                HabitatDB to watch for changes.
 *   .dm.onSetChange(fn) - for K-V object of Tracks. Each track has its own
 *                         onDataChange and streamDataTo
 *   .dm.streamSetTo(fn) - uses init() push(name) and remove(name)
 *                         only; e.g., push("M0ZDR") remove("M0ZDR")
 *   .dm.getListenerDoc(id) - get listener_info or listener_telem doc
 *   .dm.reset() - same as in HabitatDB
 * 
 * Track
 *   .onDataChange(fn)
 *   .streamDataTo(fn)
 *
 * StreamTarget()
 *   GMaps-Array-like, with addition of init
 *   .init(array) (clear, then push all in array)
 *   .push(elem)
 *   .insert(i, elem)
 *   .remove(i)
 *   .set(i, elem)
 *   .clear()
 *
 * SetTarget()
 *   .init(obj)  e.g., {"ASDF": 123, "DFGH": 456}
 *   .set(key, value)
 *   .remove(key)
 *   .clear()
 *
 * NB: Modifying or deleting listener docs could make strange things happen.
 * NB: FlightDataManager assumes that callsigns of objects to be tracked will
 * appear in the flight doc before any payload_telem items are present;
 * i.e., don't modify it.
 *
 * TODO: Tidy up and be consistent with CamelCase [or abandon it entirely].
 * TODO: Test that this werks.
 * TODO: unit tests
 * WISHLIST: Actually abort ajax requests (views, change watch) when we
 * reset().
 */

/*
 * function types:
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

States = {
    UNINIT: 0,
    RESET: 1,
    SETUP: 2,
    READY: 3
}

function UnsortedDocStore(settings) {
    var state = States.UNINIT;
    var data;

    this.dataInitialise = function (newdata) {
        if (state !== States.RESET)
            throw "Already initialised";

        state = States.READY;

        if (settings.init_filter)
            newdata = newdata.filter(settings.init_filter);

        if (settings.init_map)
            newdata = newdata.map(settings.init_map);

        newdata.forEach(function (elem) {
            data[elem.id] = elem.doc;
        });
    };

    this.processChanges = function (changes) {
        if (state !== States.READY)
            throw "Not ready";

        changes.forEach(function (change) {
            var doc = change.doc;
            var id = change.id;
            var deleted = false;

            if (change.deleted || (settings.update_filter &&
                                   !settings.update_filter(doc)))
                 deleted = true;

            if (!deleted) {
                var old_doc = data[id];
                if (!old_doc)
                    old_doc = null;

                if (settings.update_map)
                    doc = settings.update_map(doc, old_doc);

                data[id] = doc;
            } else {
                /* Javascript doesn't seem to mind doing this */
                delete data[id];
            }
        });
    };

    this.reset = function () {
        state = States.RESET;
        data = {};
        this.data = data;
    };
}

function SortedArraySync(settings) {
    var state = States.UNINIT;
    var data, data_ids, changeCallbacks, streamTargets;

    this.dataInitialise = function (newdata) {
        if (state !== States.RESET)
            throw "Already initialised";

        state = States.READY;

        /* Ensure that if newdata is never cloned, we copy it first */
        if (!settings.init_map && !settings.init_filter)
            data = newdata.splice(0);
        else
            data = newdata;

        if (settings.init_filter)
            data = data.filter(settings.init_filter);

        if (settings.init_map)
            data = data.map(settings.init_map);

        if (settings.init_sort)
            data.sort(settings.init_sort);

        data_ids = data.map(function (doc) {
            return doc._id;
        });

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
            var doc = change.doc;
            var id = change.id;
            var deleted = false;
            var old_pos = data_ids.indexOf(id);

            /*
             * Treat filtered docs like a deletion change. Therefore if
             * a doc was 'relevant' before, but isn't any more, it will
             * be removed
             */

            if (change.deleted || (settings.update_filter &&
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
            new_data_ids.push(elem._id);
            data.push(elem);
        });

        data.sort(settings.update_sort);

        data.forEach(function (doc, i) {
            if (new_data_ids.indexOf(doc._id) !== -1) {
                streamTargets.forEach(function (elem) {
                    elem.insert(i, doc);
                });
                data_ids_insert(i, doc._id);
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

    this.reset = function () {
        if (state === States.READY) {
            changeCallbacks.forEach(function (cb) {
                cb([]);
            });
            streamTargets.forEach(function (cb) {
                cb.clear();
            });
        }

        state = States.RESET;
        data = null;
        data_ids = null;
        changeCallbacks = [];
        streamTargets = [];
    };

    this.reset();
}

function sort_compare(a, b) {
    return ((a > b) ? 1 : ((a < b) ? -1 : 0));
}

/*
 * From couchdb/habitat/views/flights/map.js. Keep this updated.
 */
function flights_view_sort(a, b) {
    return sort_compare(a.launch.time, b.launch.time);
}

function flights_view_filter(doc) {
    return doc.type === "flight" || doc.type === "sandbox";
}

/*
 * Related to couchdb/habitat/views/all_flight_info
 */
function flight_telem_view_sort(a, b) {
    return sort_compare(a.estimated_time_created, b.estimated_time_created);
}

function flight_telem_view_filter_typeonly(doc, callsign) {
    return doc.type === "payload_telemetry" && doc.data.payload == callsign;
}

function flight_telem_view_filter(doc, callsign, flight_id) {
    return doc.type === "payload_telemetry" && doc.data.payload == callsign &&
           doc._flight && doc. _flight= flight_id;
}

function flight_listener_docs_filter_typeonly(doc) {
    return doc.type === "listener_telem" || doc.type === "listener_info";
}

function flight_listener_docs_filter(doc, flight_id) {
    return (doc.type === "listener_telem" || doc.type === "listener_info") &&
            doc.relevant_flights && doc.relevant_flights.indexOf(fl) !== -1;
}

function flight_listener_telem_view_sort(a, b) {
    return sort_compare(a.time_created, b.time_created);
}

function flight_listener_telem_view_filter_typeonly(doc, callsign) {
    return doc.type === "listener_telemetry" && doc.data.callsign == callsign;
}

function flight_listener_telem_view_filter(doc, callsign, flight_id) {
    return doc.type === "listener_telemetry" &&
           doc.data.callsign == callsign &&
           doc.relevant_flights && doc.relevant_flights.indexOf(fl) !== -1;
}


function HabitatDB(db_name) {
    var habitat = this;
    var db = $.couch.db(db_name);
    var load_id = 0;
    var state = States.UNINIT;
    var changelistener, mgrs, mgr_ids, flights;

    this.init = function () {
        if (state !== States.RESET)
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

        load_id++;
        var my_load_id = load_id;

        db.info({ success: function (info) {
            if (state !== States.SETUP || load_id !== my_load_id)
                return; /* Aborted */

            db.view("habitat/flights", { success: function (data) {
                if (state !== States.SETUP || load_id !== my_load_id)
                    return;

                /* this */ habitat.setupComplete(info.update_seq, data.rows);
            }});
        }});
    };

    this.setupComplete = function (seq, data) {
        state = States.READY

        flights.dataInitialise(data);
        
        /* Listen for all changes since seq */
        changelistener = db.changes(seq, { include_docs: true });
        changelistener.onChange(this.processChanges);
    };

    this.processChanges = function (data) {
        var changes = data.results;

        mgrs.forEach(function (mgr) {
            mgr.processChanges(changes);
        });
        flights.processChanges(changes);
    };

    this.addMgr = function (mgr) {
        mgr_ids.push(mgr.flight_id);
        mgrs.push(mgr);
    };

    this.removeMgr = function (mgr) {
        var pos = mgr_ids.indexOf(mgr.flight_id);
        mgr_ids.splice(pos, 1);
        mgrs.splice(pos, 1)
    };

    function flight_gen_tracklist(elem) {
        var tl = [];
        for (var payload in elem.payloads) {
            tl.push(payload);

            var item = elem.payloads[payload];
            if (item.chasers)
                item.chasers.forEach(tl.push);
        }
        return tl;
    }

    function flight_add_methods(elem, oldelem) {
        var dm;
        var tl = flight_gen_tracklist(elem);

        if (oldelem) {
            dm = oldelem.dm;
            dm.setTrackList(tl);
        } else {
            dm = new FlightDataManager(db, /* this */ habitat, elem._id, tl);
        }

        elem.dm = dm;
        return elem;
    }

    this.reset = function () {
        if (state !== States.UNINIT) {
            mgrs.forEach(function (mgr) {
                mgr.reset();
            });

            flights.reset();

            if (changelistener !== null)
                changelistener.stop();
        }

        state = States.RESET;
        changelistener = null;
        mgrs = [];
        mgr_ids = [];

        load_id++;

        flights = new SortedArraySync({
            init_map: function (elem) {
                return flight_add_methods(elem.value, null);
            },
            update_sort: flights_view_sort,
            update_filter: flights_view_filter,
            update_map: flight_add_methods
        });
    };

    this.onDataChange = function (cb) {
        flights.addChangeCallback(cb);
    }

    this.streamDataTo = function (cb) {
        flights.addStreamTarget(cb);
    }

    this.reset();
}

function FlightDataManager(db, habitat, flight_id, initial_tracklist) {
    var datamanager = this;
    var state = States.UNINIT;
    var track_syncs, listener_docs, held_changes;
    var tracklistChangeCallbacks, tracklistStreamTargets, tracklistInit;
    var tracklist = {}, load_id = 0;

    this.flight_id = flight_id;

    this.setTrackList = function (newtracklist) {
        var newcalls = [], added = [], removed = [];

        newtracklist.forEach(function (tli) {
            newcalls.push(tli.callsign);

            if (tracklist[tli.callsign] === undefined)
                added.push(tli);
        });

        for (var call in tracklist) {
            if (newcalls.indexOf(call) === -1)
                removed.push(call);
        }

        added.forEach(this.addTrackListItem);
        removed.forEach(this.destroyTrackListItem);

        added.forEach(function (call) {
            tracklistStreamTargets.forEach(function (elem) {
                elem.set(call, tracklist[call]);
            });
        });

        removed.forEach(function (call) {
            tracklistStreamTargets.forEach(function (elem) {
                elem.remove(call);
            });
        });

        tracklistChangeCallbacks.forEach(function (elem) {
            elem(tracklist);
        });
    };

    this.init = function () {
        if (state !== States.RESET)
            throw "Already initialised";

        state = States.SETUP;

        habitat.addMgr(this);

        load_id++;
        var my_load_id = load_id;

        db.info({ success: function (info) {
            if (state !== States.SETUP || load_id !== my_load_id)
                return;

            db.view("habitat/all_flight_info", { success: function (data) {
                if (state !== States.SETUP || load_id !== my_load_id)
                    return;

                /* this */ datamanager.setupComplete(data.rows);
            }, key: flight_id });
        }});
    };

    this.setupComplete = function (data) {
        state = States.READY;

        track_syncs.forEach(function (t) {
            t.dataInitialise(data);
        });

        held_changes.forEach(function (changes) {
            this.processChanges(changes);
        });
    };

    this.processChanges = function (changes) {
        if (state === States.SETUP) {
            held_changes.push(changes);
        } else {
            track_syncs.forEach(function (t) {
                t.processChanges(changes);
            });
        }
    };

    this.addTrackListItem = function (trackitem) {
        var callsign = trackitem.callsign, chaser = trackitem.chaser;

        if (chaser) {
            track_syncs[callsign] = new SortedArraySync({
                // XXX: Create it
                init_filter: function (elem) {
                    return flight_listener_telem_view_filter_typeonly(
                               elem.value, callsign);
                },
                init_map: function (elem) {
                    return elem.value;
                },
                init_sort: flight_listener_telem_view_sort,
                update_sort: flight_listener_telem_view_sort,
                update_filter: function (doc) {
                    return flight_listener_telem_view_filter(
                               doc, callsign, flight_id);
                }
            });
        } else {
            track_syncs[callsign] = new SortedArraySync({
                init_filter: function (elem) {
                    return flight_telem_view_filter_typeonly(
                               elem.value, callsign);
                },
                init_map: function (elem) {
                    return elem.value;
                },
                init_sort: flight_telem_view_sort,
                update_sort: flight_telem_view_sort,
                update_filter: function (doc) {
                    return flight_telem_view_filter(doc, callsign, flight_id);
                }
           });
        }

        if (state === States.READY) {
           track_syncs[callsign].dataInitialise([]);
        }

        tracklist[callsign] = {
            info: trackitem,
            onDataChange: track_syncs[callsign].addChangeCallback,
            streamDataTo: track_syncs[callsign].addStreamTarget
        };
    };

    this.destroyTrackListItem = function (callsign) {
        track_syncs[callsign].reset();
        delete tracklist[callsign];
        delete track_syncs[callsign];
    };

    this.reset = function () {
        if (state !== States.UNINIT) {
            if (state !== States.RESET)
                habitat.removeMgr(this);

            track_syncs.forEach(function (t) {
                t.reset();
            });
            listener_docs.reset();
            tracklistChangeCallbacks.forEach(function (cb) {
                cb([]);
            });
            tracklistStreamTargets.forEach(function (cb) {
                cb.clear();
            });
        }

        /* Keep tracklist */
        var tracklist_temp = [];
        for (var call in tracklist) {
            tracklist_temp.push(tracklist[call].info);
        }

        state = States.RESET;
        track_syncs = [];
        tracklist = [];
        tracklistInit = false;
        held_changes = [];
        tracklistChangeCallbacks = [];
        tracklistStreamTargets = [];

        load_id++;

        /* Rebuild track_syncs... */
        tracklist_temp.forEach(this.addTrackListItem);
        /* We just cleared tracklist callbacks so there's noone to tell */

        listener_docs = new UnsortedDocStore({
            init_filter: function (elem) {
                return flight_listener_docs_filter_typeonly(elem.value)
            },
            init_map: function (elem) {
                return { id: elem.id, doc: elem.value };
            },
            update_filter: function (doc) {
                return flight_listener_docs_filter(doc, flight_id);
            }
        });
    };

    this.onSetChange = function (cb) {
        tracklistChangeCallbacks.push(cb);
        cb(tracklist);
    };

    this.streamSetTo = function (cb) {
        tracklistStreamTargets.push(cb);
        cb.init(tracklist);
    };

    this.getListenerDoc = function (id) {
        return listener_docs.data[id];
    };

    this.reset();
    this.setTrackList(initial_tracklist);
}
