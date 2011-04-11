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
Listener that will upload strings.
"""

import time

__all__ = ["Listener", "ChaseCar"]

class Listener:
    def __init__(self, uploader, callsign="TSTLSTNR1", 
                 infoper=300, telemper=300, location=(52.0, 0.0),
                 info={"name": "Test habitat listener 1",
                       "location": "Launch site",
                       "radio": "Python virtual radio",
                       "antenna": "Python virtual antenna"}):
        self.uploader = uploader
        self.callsign = callsign
        self.infoper = infoper
        self.telemper = telemper
        self.location = location
        self.info = info

        self.uinfotime = 0
        self.utelemtime = 0

    def push(self, string, realtime):
        self.uploader.push_received_telem(self.callsign, realtime, string)

    def update(self, realtime):
        while self.uinfotime < realtime:
            self.uploader.push_listener_info(self.callsign, realtime,
                                             self.info)
            self.uinfotime += self.infoper

        while self.utelemtime < realtime:
            ttpl = time.gmtime(realtime)
            self.uploader.push_listener_telem(self.callsign, realtime, {
                "latitude": self.location[0],
                "longitude": self.location[1],
                "altitude": 0,
                "time": {
                    "hour": ttpl.tm_hour,
                    "minute": ttpl.tm_min,
                    "second": ttpl.tm_sec
                }
            })
            self.utelemtime += self.telemper

class ChaseCar(Listener):
    def __init__(self, uploader, callsign="TSTCHSCR1", infoper=300,
                 telemper=60, startloc=(72.0, 15.0),
                 info={"name": "Test habitat chasecar",
                       "radio": "Car radio",
                       "antenna": "60m dipole"},
                 locd=(-10.0, -10.0), locdp=60*60):
        self.startloc = startloc
        self.locd = locd
        self.locdp = locdp

        Listener.__init__(self, uploader, callsign, infoper, telemper,
                          startloc, info)

    def update(self, realtime):
        self.location = (
            self.startloc[0] + (float(realtime * self.locd[0]) / self.locdp),
            self.startloc[1] + (float(realtime * self.locd[1]) / self.locdp)
        )

        Listener.update(self, realtime)
