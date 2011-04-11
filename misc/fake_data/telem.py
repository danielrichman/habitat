# Copyright 2011 (C) Daniel Richman, Adam Greig
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
Generates telemetry strings from a flight
"""

import time
import crcmod

__all__ = ["Telemetry"]

default_data_fmt = "{callsign},{count},{time},{lat:f},{lon:f},{alt}"
default_fmt = "$${data}*{csum}"

# From habitat.utils.checksums
def crc16_ccitt(data):
    crc16 = crcmod.predefined.mkCrcFun('crc-ccitt-false')
    return hex(crc16(data))[2:].upper().zfill(4)

class Telemetry:
    def __init__(self, output, dfmt=default_data_fmt, fmt=default_fmt,
                 realtime=None, callsign="HBTTST1"):
        if realtime == None:
            realtime = time.time()

        self.output = output
        self.dfmt = dfmt
        self.fmt = fmt
        self.realtime = realtime
        self.callsign = callsign

        self.count = 0

    def push(self, timediff, location):
        rtm = self.realtime + timediff
        tstr = time.strftime("%H:%M:%S", time.gmtime(rtm))

        data = {
            "callsign": self.callsign,
            "count": self.count,
            "time": tstr,
            "lat": location[0],
            "lon": location[1],
            "alt": location[2]
        }

        data = self.dfmt.format(**data)
        csum = crc16_ccitt(data)
        string = self.fmt.format(data=data, csum=csum)

        self.output.push(string, location, rtm)

        self.count += 1
