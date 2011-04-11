#!/usr/bin/env python
# Copyright 2011 (C) Daniel Richman
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

from couchdbkit import Server
s = Server("http://user:pass@localhost:5984/")

db = s["habitat_temp"]
d = []

for i in db.documents(include_docs=True):
    if "type" in i["doc"] and i["doc"]["type"] in ["listener_telem", "listener_info", "payload_telemetry"]:
        d.append(i["id"])

for i in d:
    db.delete_doc(i)
