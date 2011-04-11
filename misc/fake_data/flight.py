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
Generates some dummy flight data.
"""

import math

__all__ = ["Flight"]

class Flight:
    def __init__(self, output, duration=60*60*2, messageper=15, rph=1,
                 maxalt=30000, loc=(0.0,52.0,0), adj=(1.0,1.0)):
        self.duration = duration
        self.messageper = messageper
        self.launchloc = loc
        self.location = loc
        self.rph = rph
        self.adj = adj
        self.output = output

        self.altdiff = maxalt - loc[2]

        self.utime = 0
        self.finished = False
        self.burst = int(self.duration * 0.80)

    def _pointdiff(self, time, x_axis):
        a = ((time * math.pi * self.rph) / (30.0 * 60.0))

        if x_axis:
            func = math.sin
            adj = self.adj[0]
        else:
            func = math.cos
            adj = self.adj[1]

        return (adj * a * func(a))

    def _alt(self, time):
        if time > self.burst:
            time -= self.burst
            duration = self.duration - self.burst
            return int(self.altdiff * (1 - ((float(time) / duration) ** 2)))
        else:
            duration = self.burst
            return int(float(self.altdiff * time) / duration)

    def update(self, time):
        while True:
            if self.utime > self.duration:
                self.finished = True
                return

            if self.utime > time:
                return

            self.location = (
                self.launchloc[0] + self._pointdiff(self.utime, True),
                self.launchloc[1] + self._pointdiff(self.utime, False),
                self.launchloc[2] + self._alt(self.utime)
            )

            self.output.push(self.utime, self.location)

            self.utime += self.messageper

    def __iter__(self):
        assert self.time == 0
        yield (self.time, self.location)
        while self.update():
            yield (self.time, self.location)
