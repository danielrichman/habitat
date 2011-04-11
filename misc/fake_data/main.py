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

"""
Main program
"""

import time

from flight import Flight
from telem import Telemetry
from band import Band
from listener import Listener, ChaseCar
from uploader import Uploader

def main():
    uploader = Uploader()
    listener_1 = Listener(uploader)
    listener_2 = Listener(uploader, callsign="TSTLSTNR2")
    listener_3 = ChaseCar(uploader)
    band = Band()
    for i in [listener_1, listener_2, listener_3]:
        band.add(i)
    telem = Telemetry(band, realtime=int(time.time() - 7200))
    flight = Flight(telem)

    simtime = 0
    while not flight.finished:
        for i in [listener_1, listener_2, listener_3, flight]:
            i.update(simtime)

        simtime += 1
        time.sleep((1.0/60))

if __name__ == "__main__":
    main()
