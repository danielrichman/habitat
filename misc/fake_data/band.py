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
Pushes telemetry strings from a Telemetry object to several listeners,
applying noise.
"""

import random

__all__ = ["Band"]

class Band:
    def __init__(self):
        self.listeners = []

    def add(self, listener):
        self.listeners.append(listener)

    def push(self, string, location, realtime):
        for listener in self.listeners:
            # This is as crude as the earth is round
            ldiff = ((location[0] - listener.location[0])**2 +
                     (location[1] - listener.location[1])**2)**0.5
            if location[2] > 10000:
                ldiff *= 0.8
            if location[2] > 20000:
                ldiff *= 0.8

            prob = 0.9

            if ldiff > 50:
                prob = 0.5
            if ldiff > 100:
                prob = 0.2

            print prob,

            while random.random() > prob:
                blip = random.randrange(0, len(string))
                r = chr(random.randrange(0, 0x100))
                string = string[:blip] + r + string[(blip + 1):]

            listener.push(string, realtime)

if __name__ == "__main__":
    from flight import Flight
    from telem import Telemetry

    class SimpleListener:
        def __init__(self, name, loc):
            self.name = name
            self.location = loc
        def push(self, s):
            print self.name, s

        location = (52.0, 0.0)

    b = Band()
    b.add(SimpleListener("launchsite", (52.0, 0.0)))
    b.add(SimpleListener("side      ", (62.0, 10.0)))
    b.add(SimpleListener("milesaway ", (102.0, 100.0)))
    t = Telemetry(b)
    f = Flight(t)

    ftime = 0
    while not f.finished:
        f.update(ftime)
        ftime += 1
