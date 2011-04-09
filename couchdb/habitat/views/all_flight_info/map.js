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

function(doc, req) {
    // Select all listener_telem, listener_info and payload_telemetry documents
    // that are involved or associated in any way with a certain flight.

    if (doc.type == "payload_telemetry" && doc.data._flight)
    {
        emit(doc.data._flight, doc);
    }
    /* TODO: https://www.pivotaltracker.com/story/show/12110979 */
    else if (doc.type == "listener_telem" || doc.type == "listener_info" &&
             doc.relevant_flights)
    {
        var flight;
        for (flight in doc.relevant_flights)
        {
            emit(flight, doc);
        }
    }
}
