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
 * Overall tests
 *  - init downloads seq
 *  - init sets up changes watch
 *  - reset works
 *  - can add flight list stream targets
 *  - init called when download done
 *  - can add flight list refresh targets
 *  - called when download done
 *  - refresh, init called instantly if download already done
 *  - flight already present show up
 *  - added flight shows up
 *  - reoordering works
 *  - other random crap filtered
 *  - adds dm object
 *  - set initialises correctly [stream, refresh]
 *  - set updates correctly [add remove, stream refresh]
 *  - set includes payloads and chasecars
 *  - reset works, keeps set.
 *  - track [stream, refresh] works [init, update, reorder, remove, filter]
 *  - chasecar track works
 *  - listener docs is populated correctly
 * 
 * UnsortedDocStore
 *  - dataInitialise filters, maps, adds data
 *  - processChanges updates, removes, sets data
 *  - states work correctly
 *  - reset works
 * 
 * SortedArraySync
 *  - all from UnsortedDocStore
 *  - reoordering works
 *  - add stream works
 *  - add refresh works
 *  - stream pushing works [tests from processChanges again]
 *  - refresh called correctly
 * 
 * Sorts, Filters
 *  - work correctly
 */

var flight_stream = require("data/flight_stream.js");

/* Test data */
var flight_1 = { name: "asdf", launch: { time: 123456 }, payloads: {}, 
                 type: "flight", "_id": "f123" }
var flight_2 = { name: "djhj", launch: { time: 223456 }, payloads: {}, 
                 type: "flight", "_id": "a346" }
var flight_3 = { name: "a436", launch: { time: 323456 }, payloads: {}, 
                 type: "flight", "_id": "zdfgi" }
var flight_view = { rows: [
    { id: flight_1._id, value: flight_1 },
    { id: flight_2._id, value: flight_2 }
] };

function deep_copy(source) {
    if (typeof(source) == "object") {
        if (source.constructor == Array) {
            return source.map(deep_copy);
        } else {
            var copy = {};
            for (var key in source)
                copy[key] = deep_copy(source[key]);
            return copy;
        }
    } else {
        return source;
    }
}

function strip_dms(arr) {
    for (var i = 0; i < arr.length; i++)
        delete arr[i].dm;
}

/* Fake couch */
function FakeCouchDB() {
    this.changes_cbspy = jasmine.createSpy('onChange');
}
FakeCouchDB.prototype.info = function (settings) {
    settings.success({ update_seq: 1295 });
}
FakeCouchDB.prototype.view = function (name, settings) {
    if (name === "habitat/flights") {
        settings.success(deep_copy(flight_view));
    }
}
FakeCouchDB.prototype.changes = function (seq, settings) {
    return { onChange: this.changes_cbspy };
}

describe("Flight Stream", function() {
    var habitatdb;
    var fakecouch;

    beforeEach(function () {
        fakecouch = new FakeCouchDB();
        spyOn(flight_stream.jQuery.couch, 'db').andReturn(fakecouch);

        habitatdb = new flight_stream.HabitatDB("habdb123");
    });

    describe("HabitatDB", function () {
        it("connects to Couch", function () {
            expect(flight_stream.jQuery.couch.db).
                toHaveBeenCalledWith("habdb123");
        });

        describe("init", function () {
            it("downloads seq and initial flights", function () {
                spyOn(habitatdb, "setupComplete");
                habitatdb.init();
                expect(habitatdb.setupComplete).toHaveBeenCalledWith(
                    1295, flight_view.rows
                );
            });

            it("watches for changes", function () {
                spyOn(fakecouch, "changes").andCallThrough();

                habitatdb.setupComplete(1295, []);
                expect(fakecouch.changes).toHaveBeenCalledWith(
                    1295, { include_docs: true }
                );
                expect(fakecouch.changes_cbspy).toHaveBeenCalledWith(
                    habitatdb.processChanges
                );
            });
        });

        describe("reset", function () {
            it("aborts habitat info", function () {
                spyOn(fakecouch, "info");
                spyOn(fakecouch, "view");

                habitatdb.init();
                habitatdb.reset();

                fakecouch.info.mostRecentCall.args[0].success(null);
                expect(fakecouch.view).wasNotCalled();
            });

            it("aborts flights view", function () {
                spyOn(fakecouch, "view");
                spyOn(habitatdb, "setupComplete");

                habitatdb.init();
                habitatdb.reset();

                fakecouch.view.mostRecentCall.args[1].success(null);
                expect(habitatdb.setupComplete).wasNotCalled();
            });

            it("resets everything else", function () {
                // TODO
            });
        });

        describe("streamDataTo", function () {
            it("pushes data after download", function () {
                spyOn(fakecouch, "view");

                var spy_init_1 = jasmine.createSpy("init");
                var spy_init_2 = jasmine.createSpy("init");

                habitatdb.streamDataTo({ init: spy_init_1 });
                habitatdb.init();
                habitatdb.streamDataTo({ init: spy_init_2 });
                fakecouch.view.mostRecentCall.args[1].success(
                    deep_copy(flight_view)
                );

                [spy_init_1, spy_init_2].forEach(function (s) {
                    expect(s.argsForCall.length).toBe(1);
                    strip_dms(s.mostRecentCall.args[0]);
                    expect(s).toHaveBeenCalledWith([flight_1, flight_2]);
                });
            });

            it("pushes changes", function () {
                var spy_strtgt = {
                    init: jasmine.createSpy("init"),
                    insert: jasmine.createSpy("insert"),
                    remove: jasmine.createSpy("remove"),
                    set: jasmine.createSpy("set"),
                    clear: jasmine.createSpy("clear")
                };
                habitatdb.streamDataTo(spy_strtgt);
                habitatdb.init();

//                habitatdb.processChanges([]);
            });

            it("handles reoordering changes correctly", function () {
            });

            it("pushes data immediately if ready", function () {
                habitatdb.init();

                var spy_init = jasmine.createSpy("init");
                habitatdb.streamDataTo({ init: spy_init });

                strip_dms(spy_init.mostRecentCall.args[0]);
                expect(spy_init).toHaveBeenCalledWith([flight_1, flight_2]);
            });
        });

        describe("onDataChange", function () {
            it("calls after initial download", function () {
            });

            it("calls back changes", function () {
            });

            it("calls immediately if data is ready", function () {
            });
        });

        describe("data", function () {
            it("only pushes flight objects", function () {
            });

            it("adds DM object", function () {
            });
        });
    });

    describe("FlightDataManager", function () {

    });
});
