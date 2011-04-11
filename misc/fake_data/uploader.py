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

"""
Uploader utility
"""

import time
import httplib
import json
import base64

__all__ = ["Listener"]

class Uploader:
    def __init__(self, server="habitat.habhub.org:80", path="testing"):
        self.path = path
        self.conn = httplib.HTTPConnection(server)

    def _upload(self, callsign, mtype, realtime, data):
        payload = {
            "callsign": callsign,
            "type": mtype,
            "data": data,
            "time_created": realtime,
            "time_uploaded": time.time()
        }

        payloadj = json.dumps(payload)
        self.conn.request("POST", self.path + "/message", payloadj)

    def push_received_telem(self, callsign, realtime, string)
        self._upload(callsign, "RECEIVED_TELEM", realtime,
                     {"string": base64.b64encode(string)})
