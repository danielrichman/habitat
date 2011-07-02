# Copyright 2010 (C) Adam Greig
#
# This file is part of habitat.
#
# habitat is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# habitat is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with habitat.  If not, see <http://www.gnu.org/licenses/>.

"""
Tests habitat.archive.ArchiveSink
"""

from nose.tools import assert_raises
from copy import deepcopy
from test_habitat.lib import fake_couchdb
from couchdbkit.exceptions import ResourceConflict

from habitat.message_server import Message
from habitat.archive import ArchiveSink

class FakeServer(object):
    def __init__(self):
        self.db = fake_couchdb.Database()
    def push_message(self, message):
        pass

class FakeListener(object):
    def __init__(self, callsign="habitat", ip="123.123.123.123"):
        self.callsign = callsign
        self.ip = ip

class FakeMessage(object):
    def __init__(self, mtype, data, source=None, time_created=12345,
            time_uploaded=54321):
        if source:
            self.source = source
        else:
            self.source = FakeListener()
        self.type = mtype
        self.data = data
        self.time_created = time_created
        self.time_uploaded = time_uploaded

class ConflictingDatabase(fake_couchdb.Database):
    def __init__(self, docs=None):
        self.conflict_count = 0
        fake_couchdb.Database.__init__(self, docs)
    def __setitem__(self, key, item):
        if self.conflict_count > 0:
            self.conflict_count -= 1
            raise ResourceConflict("Document update conflict.")
        else:
            fake_couchdb.Database.__setitem__(self, key, item)

###########################################################
# Listener Telem docs

listener_telem_data = {
    "time": {
        "hour": 12,
        "minute": 40,
        "second": 12
    },
    "latitude": -35.5,
    "longitude": 137.5,
    "altitude": 12
}

listener_telem_doc = {"type": "listener_telem"}
listener_telem_doc["data"] = deepcopy(listener_telem_data)
listener_telem_doc["data"]["callsign"] = "habitat"
listener_telem_doc["time_created"] = 12345
listener_telem_doc["time_uploaded"] = 54321

listener_telem_doc_with_relevant = deepcopy(listener_telem_doc)
listener_telem_doc_with_relevant["relevant_flights"] = ["flight-2-dfgh"]

###########################################################
# Listener Info docs

listener_info_data = {
    "name": "habitat project",
    "rating": "awesome"
}

listener_info_doc = {"type": "listener_info"}
listener_info_doc["data"] = deepcopy(listener_info_data)
listener_info_doc["data"]["callsign"] = "habitat"
listener_info_doc["time_created"] = 12345
listener_info_doc["time_uploaded"] = 54321

listener_info_doc_wrong = deepcopy(listener_info_doc)
listener_info_doc_wrong["data"]["callsign"] = "wrong"

listener_info_data_two = deepcopy(listener_info_data)
listener_info_data_two["rating"] = "xtreme"

listener_info_doc_two = {"type": "listener_info"}
listener_info_doc_two["data"] = deepcopy(listener_info_data_two)
listener_info_doc_two["data"]["callsign"] = "habitat"
listener_info_doc_two["time_created"] = 12345
listener_info_doc_two["time_uploaded"] = 54321

listener_info_doc_with_relevant = deepcopy(listener_info_doc)
listener_info_doc_with_relevant["relevant_flights"] = ["flight-1-asdf"]

view_results_none = fake_couchdb.ViewResults()

view_results_old = fake_couchdb.ViewResults({
    "value": None,
    "key": ["habitat", "123456789"],
    "doc": listener_info_doc})

view_results_wrong = fake_couchdb.ViewResults({
    "value": None,
    "key": ["wrong", "2345"],
    "doc": listener_info_doc_wrong})

###########################################################
# Telem and Received Telem docs
listener_one = FakeListener("habitat_one")
listener_two = FakeListener("habitat_two")
listener_three = FakeListener("habitat_three")
listener_four = FakeListener("habitat_four")
raw_data = {"string": "dGVzdCBtZXNzYWdl"}
raw_data_two = {"string": "dGVzdCBtZXNzYWdl", "foo": 2}
parsed_data = {"_raw": "dGVzdCBtZXNzYWdl", "parsed_data": True,
               "_listener_metadata": {}}
parsed_data_two = {"_raw": "dGVzdCBtZXNzYWdl", "parsed_data": "two",
                   "_listener_metadata": {}}
parsed_data_three = {"_raw": "dGVzdCBtZXNzYWdl", "newly_parsed": True,
                     "_listener_metadata": {}}
parsed_data_four = {"_raw": "dGVzdCBtZXNzYWdl", "infor": "mation",
                    "_listener_metadata": {"foo": "bar"}}
parsed_data_with_flight = {"_raw": "dGVzdCBtZXNzYWdl",
                           "_listener_metadata": {},
                           "_flight": "flight-1-asdf"}

doc_id = "03bde3390e8a8e803c4cebdc24c73ea6e1fed09d5bb3ab15f3dc364d82cfccc0"

raw_type = Message.RECEIVED_TELEM
parsed_type = Message.TELEM

message_raw_from_one = FakeMessage(raw_type, raw_data, listener_one)
message_raw_from_two = FakeMessage(raw_type, raw_data, listener_two)
message_parsed_from_one = FakeMessage(parsed_type, parsed_data, listener_one)
message_parsed_from_two = FakeMessage(parsed_type, parsed_data, listener_two)
message_different_parsed_from_one = FakeMessage(parsed_type, parsed_data_two,
        listener_one)
message_different_parsed_from_two = FakeMessage(parsed_type, parsed_data_two,
        listener_two)
message_new_parsed_from_one = FakeMessage(parsed_type, parsed_data_three,
        listener_one)
message_new_parsed_from_two = FakeMessage(parsed_type, parsed_data_three,
        listener_two)
message_parsed_with_flight = FakeMessage(parsed_type, parsed_data_with_flight,
        listener_one)

message_parsed_metadata = FakeMessage(parsed_type, parsed_data_four,
        listener_one)
message_raw_metadata = FakeMessage(raw_type, raw_data_two, listener_one)

message_raw_from_one.time_created = 1
message_raw_from_one.time_uploaded = 2
message_parsed_from_one.time_created = 1
message_parsed_from_one.time_uploaded = 4
message_different_parsed_from_one.time_created = 1
message_different_parsed_from_one.time_uploaded = 6
message_new_parsed_from_one.time_created = 1
message_new_parsed_from_one.time_uploaded = 8
message_raw_from_two.time_created = 1
message_raw_from_two.time_uploaded = 10
message_parsed_from_two.time_created = 1
message_parsed_from_two.time_uploaded = 12
message_different_parsed_from_two.time_created = 1
message_different_parsed_from_two.time_uploaded = 14
message_new_parsed_from_two.time_created = 1
message_new_parsed_from_two.time_uploaded = 16

listener_vr = fake_couchdb.ViewResults({"key": ["habitat_one", 123],
    "id": "abcdef"})
listener_vr2 = fake_couchdb.ViewResults({"key": ["habitat_one", 123],
    "id": "dfghji"})
bad_vr = fake_couchdb.ViewResults({"key": ["wrong", 123], "id": "bad"})

class TestArchiveSink(object):
    def setup(self):
        self.server = FakeServer()
        self.sink = ArchiveSink(self.server)

    def test_receives_RECEIVED_TELEM_messages(self):
        assert Message.RECEIVED_TELEM in self.sink.types

    def test_receives_LISTENER_INFO_messages(self):
        assert Message.LISTENER_INFO in self.sink.types

    def test_receives_LISTENER_TELEM_messages(self):
        assert Message.LISTENER_INFO in self.sink.types

    def test_receives_TELEM_messages(self):
        assert Message.TELEM in self.sink.types

    def test_stores_new_LISTENER_TELEM_documents(self):
        self.sink.push_message(
            FakeMessage(Message.LISTENER_TELEM, listener_telem_data))
        assert len(self.server.db.docs) == 1
        assert self.server.db.saved_docs[0] == listener_telem_doc

    def test_stores_new_LISTENER_INFO_documents(self):
        for view_results in [view_results_none, view_results_wrong]:
            self.server.db = fake_couchdb.Database()
            self.server.db.default_view_results = view_results
            self.sink.push_message(
                FakeMessage(Message.LISTENER_INFO, listener_info_data))
            assert len(self.server.db.docs) == 1
            assert self.server.db.saved_docs[0] == listener_info_doc

    def test_doesnt_store_duplicate_LISTENER_INFO_document(self):
        self.sink.push_message(
            FakeMessage(Message.LISTENER_INFO, listener_info_data))
        self.server.db.default_view_results = view_results_old
        self.sink.push_message(
            FakeMessage(Message.LISTENER_INFO, listener_info_data))
        assert len(self.server.db.docs) == 1
        assert self.server.db.saved_docs[0] == listener_info_doc

    def test_does_store_updated_LISTENER_INFO_document(self):
        self.sink.push_message(
            FakeMessage(Message.LISTENER_INFO, listener_info_data))
        self.server.db.default_view_results = view_results_old
        self.sink.push_message(
            FakeMessage(Message.LISTENER_INFO, listener_info_data_two))
        assert len(self.server.db.docs) == 2
        assert self.server.db.saved_docs[0] == listener_info_doc
        assert self.server.db.saved_docs[1] == listener_info_doc_two

    def test_raw__no_existing__no_receiver(self):
        """handles RECEIVED_TELEM with no existing data"""
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 1,
                "time_uploaded": 2,
                "latest_telem": None,
                "latest_info": None
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_raw__raw_existing__same_receiver(self):
        """handles RECEIVED_TELEM w. existing raw data from the same rxer"""
        self.sink.push_message(message_raw_from_one)
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 1,
                "time_uploaded": 2,
                "latest_telem": None,
                "latest_info": None
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_raw__raw_existing__new_receiver(self):
        """handles RECEIVED_TELEM w. existing raw data from another rxer"""
        self.sink.push_message(message_raw_from_one)
        self.sink.push_message(message_raw_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 2,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 10,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_raw__parsed_existing__same_receiver(self):
        """handles RECEIVED_TELEM w. existing parsed data from the same rxer"""
        self.sink.push_message(message_parsed_from_one)
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 2,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_raw__parsed_existing__new_receiver(self):
        """handles RECEIVED_TELEM w. existing parsed data from another rxer"""
        self.sink.push_message(message_parsed_from_one)
        self.sink.push_message(message_raw_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 10,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__no_existing__no_receiver(self):
        """handles TELEM with no existing data"""
        self.sink.push_message(message_parsed_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__raw_existing__same_receiver(self):
        """handles TELEM with existing raw data from the same receiver"""
        self.sink.push_message(message_raw_from_one)
        self.sink.push_message(message_parsed_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__raw_existing__new_receiver(self):
        """handles TELEM with existing raw data from another receiver"""
        self.sink.push_message(message_raw_from_one)
        self.sink.push_message(message_parsed_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 2,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 12,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__parsed_existing__same_receiver(self):
        """handles TELEM with existing parsed data from the same receiver"""
        self.sink.push_message(message_parsed_from_one)
        self.sink.push_message(message_parsed_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__parsed_existing__new_receiver(self):
        """handles TELEM with existing parsed data from another receiver"""
        self.sink.push_message(message_parsed_from_one)
        self.sink.push_message(message_parsed_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 12,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__old_parsed_existing__same_receiver(self):
        """handles TELEM where data != current data (from the same rxer)"""
        self.sink.push_message(message_different_parsed_from_one)
        self.sink.push_message(message_parsed_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_parsed__old_parsed_existing__new_receiver(self):
        """handles TELEM where data != current data (from another rxer)"""
        self.sink.push_message(message_different_parsed_from_one)
        self.sink.push_message(message_parsed_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 6,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 12,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_new_parsed__old_parsed_existing__same_receiver(self):
        """handles TELEM where data has new keys (old data from same rxer)"""
        self.sink.push_message(message_parsed_from_one)
        self.sink.push_message(message_new_parsed_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True,
                "newly_parsed": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 8,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_new_parsed__old_parsed_existing__new_receiver(self):
        """handles TELEM where data has new keys (old data frm another rxer)"""
        self.sink.push_message(message_parsed_from_one)
        self.sink.push_message(message_new_parsed_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True,
                "newly_parsed": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 16,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_locates_latest_listener_info(self):
        self.server.db.view_results["habitat/listener_telem"] = listener_vr
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 1,
                "time_uploaded": 2,
                "latest_telem": "abcdef",
                "latest_info": None
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_locates_latest_listener_telem(self):
        self.server.db.view_results["habitat/listener_info"] = listener_vr
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 1,
                "time_uploaded": 2,
                "latest_telem": None,
                "latest_info": "abcdef"
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_doesnt_use_bad_listener_telem(self):
        self.server.db.view_results["habitat/listener_telem"] = bad_vr
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 1,
                "time_uploaded": 2,
                "latest_telem": None,
                "latest_info": None
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_adds_relevant_flight(self):
        self.server.db.protect_docs = True
        self.server.db.view_results["habitat/listener_info"] = listener_vr
        self.server.db.view_results["habitat/listener_telem"] = listener_vr2
        self.server.db["abcdef"] = deepcopy(listener_info_doc)
        self.server.db["dfghji"] = deepcopy(listener_telem_doc)
        self.sink.push_message(message_parsed_with_flight)

        expected_info = deepcopy(listener_info_doc)
        expected_info["relevant_flights"] = ["flight-1-asdf"]
        expected_telem = deepcopy(listener_telem_doc)
        expected_telem["relevant_flights"] = ["flight-1-asdf"]

        assert self.server.db["abcdef"] == expected_info
        assert self.server.db["dfghji"] == expected_telem

    def test_adds_relevant_flight_to_existing_without_duplicating(self):
        self.server.db.protect_docs = True
        self.server.db.view_results["habitat/listener_info"] = listener_vr
        self.server.db.view_results["habitat/listener_telem"] = listener_vr2
        self.server.db["abcdef"] = deepcopy(listener_info_doc_with_relevant)
        self.server.db["dfghji"] = deepcopy(listener_telem_doc_with_relevant)
        self.sink.push_message(message_parsed_with_flight)

        expected_info = deepcopy(listener_info_doc)
        expected_info["relevant_flights"] = ["flight-1-asdf"]
        expected_telem = deepcopy(listener_telem_doc)
        expected_telem["relevant_flights"] = ["flight-2-dfgh", "flight-1-asdf"]

        assert self.server.db["abcdef"] == expected_info
        assert self.server.db["dfghji"] == expected_telem

    def test_doesnt_use_bad_listener_info(self):
        self.server.db.view_results["habitat/listener_info"] = bad_vr
        self.sink.push_message(message_raw_from_one)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 1,
                "time_uploaded": 2,
                "latest_telem": None,
                "latest_info": None
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_ignore_outliers_when_estimating_time(self):
        m1 = FakeMessage(raw_type, raw_data, listener_one)
        m1.time_created = 3
        m2 = FakeMessage(raw_type, raw_data, listener_two)
        m2.time_created = 3
        m3 = FakeMessage(raw_type, raw_data, listener_three)
        m3.time_created = 3
        m4 = FakeMessage(raw_type, raw_data, listener_four)
        m4.time_created = 10
        self.sink.push_message(m1)
        self.sink.push_message(m2)
        self.sink.push_message(m3)
        self.sink.push_message(m4)
        assert doc_id in self.server.db
        assert self.server.db[doc_id]["estimated_time_created"] == 3

    def test_finds_time_mean(self):
        m1 = FakeMessage(raw_type, raw_data, listener_one)
        m1.time_created = 3
        m2 = FakeMessage(raw_type, raw_data, listener_two)
        m2.time_created = 4
        m3 = FakeMessage(raw_type, raw_data, listener_three)
        m3.time_created = 5
        self.sink.push_message(m1)
        self.sink.push_message(m2)
        self.sink.push_message(m3)
        assert doc_id in self.server.db
        assert self.server.db[doc_id]["estimated_time_created"] == 4

    def test_merges_telem_after_resource_conflict(self):
        # The database will raise `n` ResourceConflict exceptions
        # before allowing __setitem__ to proceed, when
        # db.conflict is set to `n`, simulating a write conflict.
        db = ConflictingDatabase()
        self.server.db = db
        self.sink.push_message(message_raw_from_one)
        self.sink.push_message(message_parsed_from_one)
        db.conflict_count = 1
        self.sink.push_message(message_raw_from_two)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 1,
            "data": {"_raw": raw_data["string"], "parsed_data": True},
            "receivers": {
                "habitat_one": {
                    "time_created": 1,
                    "time_uploaded": 4,
                    "latest_telem": None,
                    "latest_info": None
                }, "habitat_two": {
                    "time_created": 1,
                    "time_uploaded": 10,
                    "latest_telem": None,
                    "latest_info": None
                }
            }
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_merges_relflight_after_resource_conflict(self):
        self.server.db.protect_docs = True
        db = ConflictingDatabase()
        self.server.db = db
        self.server.db.view_results["habitat/listener_telem"] = listener_vr2
        self.server.db["dfghji"] = deepcopy(listener_telem_doc_with_relevant)
        db.conflict_count = 1
        self.sink.push_message(message_parsed_with_flight)
        expected_telem = deepcopy(listener_telem_doc)
        expected_telem["relevant_flights"] = ["flight-2-dfgh", "flight-1-asdf"]
        assert self.server.db["dfghji"] == expected_telem

    def test_stores_raw_metadata(self):
        self.sink.push_message(message_raw_metadata)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 12345,
            "data": {"_raw": raw_data["string"]},
            "receivers": {"habitat_one": {
                "time_created": 12345,
                "time_uploaded": 54321,
                "latest_telem": None,
                "latest_info": None,
                "foo": 2
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_stores_parsed_metadata(self):
        self.sink.push_message(message_parsed_metadata)
        expected_doc = {
            "type": "payload_telemetry",
            "estimated_time_created": 12345,
            "data": {"_raw": raw_data["string"], "infor": "mation"},
            "receivers": {"habitat_one": {
                "time_created": 12345,
                "time_uploaded": 54321,
                "latest_telem": None,
                "latest_info": None,
                "foo": "bar"
            }}
        }
        assert doc_id in self.server.db
        assert self.server.db[doc_id] == expected_doc

    def test_gives_up_after_30_merge_conflicts__telem(self):
        db = ConflictingDatabase()
        self.server.db = db
        db.conflict_count = 30
        assert_raises(RuntimeError,
                      self.sink.push_message, message_raw_from_one)
        assert doc_id not in db
        db.conflict_count = 29
        self.sink.push_message(message_raw_from_one)
        assert doc_id in db

    def test_gives_up_after_30_merge_conflicts__relflight(self):
        db = ConflictingDatabase()
        db.protect_docs = True
        self.server.db = db
        self.server.db.view_results["habitat/listener_telem"] = listener_vr2
        self.server.db["dfghji"] = deepcopy(listener_telem_doc_with_relevant)
        db.conflict_count = 30
        assert_raises(RuntimeError,
                      self.sink.push_message, message_parsed_with_flight)
        assert doc_id not in db
        db.conflict_count = 29
        self.sink.push_message(message_parsed_with_flight)
        assert doc_id in db
