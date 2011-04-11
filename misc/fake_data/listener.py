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

__all__ = ["Listener"]

class Listener:
    def __init__(self, uploader, callsign="TSTLSTNR1", 
                 infoper=300, telemper=300, location=(52.0, 0.0)):
        self.uploader = uploader
        self.infoper = infoper
        self.telemper = telemper
        self.location = location

        self.uinfotime = 0
        self.utelemtime = 0

    def push(self, string, realtime):
        uploader.push_received_telem(self.callsign, realtime, string)

    def update(self, time):
        while self.uinfotime < time:
            # TODO: push info
            self.uinfotime += self.infoper

        while self.utelemtime < time:
            # TODO: push telem
            self.utelemtime += self.telemper

class ChaseCar(Listener):
    def __init__(self, uploader, callsign="TSTCHSCR1", infoper=300,
                 telemper=60, startloc=(72.0, 15.0), locd=(-10.0, -10.0),
                 locdp=60*60):
        self.startloc = startloc
        self.locd = locd
        self.locdp = locdp

        Listener.__init__(self, uploader, infoper, telemper, startloc)

    def update(self, time):
        self.location = self.startloc
        self.location[0] += float(time * self.locd[0]) / self.locdp
        self.location[1] += float(time * self.locd[1]) / self.locdp
        Listener.update(self, time)
