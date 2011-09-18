/* Animation */
function flash(elem) {
    flashreset(elem);
    elem.animate({'background-color': 'yellow'}, 500);
    elem.animate({'background-color': 'transparent'}, 2000);
}

function flashreset(elem) {
    elem.stop(true, true);
}

/* Can be called on an element that isn't yet inserted in the DOM but
 * is about to be. Bit of an ugly hack. */
function flashlater(elem) {
/*    setTimeout(function () {
        flash(elem);
    }, 100); XXX: perhaps not. */
}

/* Who doesn't love globals? */
DemoModes = {
    STREAM: 0,
    REFRESH: 1,
    GMAPS: 2
};

var demo_mode;
var gmap;

/* Utilities */
function DemoStreamDataTarget(container, map) {
    this.init = function (items) {
        /* this.clear(); */
        items.forEach(function (item) {
            container.append(map(item));
        });
    }

    this.insert = function (i, item) {
        var contents = container.children();
        var newelem = map(item);

        if (i == contents.length)
            container.append(newelem);
        else
            $(contents[i]).before(newelem);
    }

    this.remove = function (i) {
        $(container.children()[i]).remove();
    }

    this.set = function (i, item) {
        $(container.children()[i]).replaceWith(map(item));
    }

    this.clear = function () {
        container.empty();
    }
}

function DemoStreamSetTarget(container, map) {
    var keys;

    this.init = function (obj) {
        keys = [];
        for (var key in obj) {
            this.set(key, obj[key]);
        }
    };

    this.set = function (key, val) {
        var newelem = map(key, val);
        container.append(map(key, val));
        keys.push(key);
    };

    this.remove = function (key) {
        var i = keys.indexOf(key);
        $(container.children()[i]).remove();
        keys.splice(i, 1);
    };

    this.clear = function () {
        container.empty();
        keys = [];
    };
}

function DemoMapsTrack() {
    var polyline, path;

    function item_to_latlng(item) {
        return new google.maps.LatLng(item.data.latitude, item.data.longitude);
    }

    this.init = function (items) {
        polyline = new google.maps.Polyline({
            path: items.map(item_to_latlng),
            map: gmap,
            strokeColor: '#000000',
            strokeWeight: 3,
            strokeOpacity: 0.75
        });
        path = polyline.getPath();

        if (items.length > 0) {
            gmap.panTo(item_to_latlng(items[0]));
            gmap.setZoom(8);
        }
    };
    this.insert = function (i, item) {
        path.insertAt(i, item_to_latlng(item));
    };
    this.remove = function (i) {
        path.removeAt(i);
    };
    this.set = function (i, item) {
        path.setAt(i, item_to_latlng(item));
    };
    this.clear = function () {
        polyline.setMap(null);
        path.clear();
    };
}

function DemoMapsTrackSetTarget(flight_id, overlay) {
    this.init = function (obj) {
        for (var key in obj) {
            this.set(key, obj[key]);
        }
    };

    this.set = function (callsign, track) {
        track.streamDataTo(new DemoMapsTrack());

        var d = $("<div id='overlay_" + flight_id + "_" + callsign + "' />");
        overlay.append(d);

        track.onDataChange(function (data) {
            refresh_flightoverlay(d, data[data.length - 1]);
        });
    };

    this.remove = function (callsign) {
        /* DemoMapsTrack can clean itself up */

        $("#overlay_" + flight_id + "_" + callsign).remove();
    };

    this.clear = function () {
    };
}

/* Demo globals */
var tracking_flights = [];

/* Specific maps */
function flight_map(flight) {
    var elem = $("<li/>");
    var namespan = $("<span class='flightname' />");
    var tracklink = $("<a href='#' />");

    function setlinktext() {
        if (flight_track_i(flight) === -1)
            tracklink.text("Track!");
        else
            tracklink.text("Stop Tracking");
    }

    namespan.text(flight.name);
    setlinktext();
    elem.append(namespan);
    elem.append(" ");
    elem.append(tracklink);

    tracklink.click(function (ev) {
        flight_track_toggle(flight);
        setlinktext();
        ev.preventDefault();
    });

    /* This isn't strictly the correct place for this, but it works */
    if (flight_track_i(flight) !== -1) {
        var c = $("#flight_" + flight._id);
        var n = $(c.children()[0]);
        n.text("Flight: " + flight.name);
    }

    flashlater(elem);
    return elem;
}

function refresh_flightlist(container, data) {
    container.empty();
    data.forEach(function (item) {
        container.append(flight_map(item));
    });
}

function track_map(callsign, track, flight) {
    var elem = $("<div class='track' />");

    var label = $("<p class='trackname' />");
    label.text("Track: " + callsign + (track.info.chaser ? " [chaser]" : ""));
    elem.append(label);

    /*
     * var trackid = "#track_" + flight_id + "_" + callsign;
     * var find = $(trackid);
     * var d;
     * if (find.length === 1)
     *     d = find[0];
     * else
     *     d = $("<div id='" + trackid + "'/>");
     */

    var d = $("<div />");
    elem.append(d);

    if (demo_mode == DemoModes.STREAM)
        track.streamDataTo(new DemoStreamDataTarget(d, function (doc) {
            return telem_map(doc, callsign, track, flight);
        }));
    else if (demo_mode == DemoModes.REFRESH)
        track.onDataChange(function (data) {
            refresh_telemlist(d, data, callsign, track, flight);
        });

    flashlater(label);
    return elem;
}

function refresh_tracklist(container, data, flight) {
    container.empty();
    for (var callsign in data) {
        container.append(track_map(callsign, data[callsign], flight));
    }
}

function receivers_map(doc, callsign, track, flight) {
    var elem = $("<div class='receivers' />");

    var receivers = [];
    for (var callsign in doc.receivers) {
        receivers.push(callsign);
    }
    receivers.sort();

    receivers.forEach(function (callsign) {
        var receiver = doc.receivers[callsign];
        var r_elem = $("<div class='receiver' />");
        r_elem.append($("<span />").text(callsign));
        r_elem.append(" ");

        [["latest_info", "I"], ["latest_telem", "T"]].forEach(function (n) {
            if (!receiver[n[0]])
                return;

            var i = $("<span />").text(n[1]);
            if (flight.dm.getListenerDoc(receiver[n[0]]))
                i.addClass("listener_doc_present");
            else
                i.addClass("listener_doc_missing");
            r_elem.append(i);
        });
        elem.append(r_elem);
        elem.append(" ");
    });

    return elem;
}

var numeric_telem_columns = ["count", "latitude", "longitude", "altitude"];
var other_telem_columns = [receivers_map];

function telem_map(doc, callsign, track, flight) {
    var elem = $("<div class='telem' />");
    numeric_telem_columns.forEach(function (k) {
        var s = doc.data[k];
        if (s === undefined)
            s = "n/a";
        else if (Math.round(s) != s)
            s = s.toFixed(4);
        elem.append($("<div />").text(s));
    });
    other_telem_columns.forEach(function (fn) {
        elem.append(fn(doc, callsign, track, flight));
    });

    flashlater(elem);
    return elem;
}

var flightoverlay_names = {
    "count": "Count",
    "latitude": "Latitude",
    "longitude": "Longitude",
    "altitude": "Altitude"
}

function refresh_flightoverlay(container, last_doc) {
    container.empty();

    if (!last_doc || !last_doc.data || !last_doc.receivers)
    {
        container.append("Loading...");
        return;
    }

    container.append($("<div class='callsign' />").text(last_doc.data.payload));

    function twodgts(part) {
        var n = part.toString();
        if (n.length == 1)
            n = "0" + n;
        return n;
    }

    var time_parts = last_doc.data.time;
    var time = twodgts(time_parts.hour) + ":" +
               twodgts(time_parts.minute) + ":" + 
               twodgts(time_parts.second);

    var r = $("<div />");
    r.append($("<span class='telem_key' />").text("Time: "));
    r.append($("<span />").text(time));
    container.append(r);

    numeric_telem_columns.forEach(function (k) {
        var s = last_doc.data[k];
        if (s === undefined)
            s = "n/a";
        else if (Math.round(s) != s)
            s = s.toFixed(4);
        var r = $("<div />");
        r.append($("<span class='telem_key' />").text(flightoverlay_names[k] + ": "))
        r.append($("<span />").text(s));
        container.append(r);
    });

    var r = $("<div />");
    r.append($("<span class='telem_key' />").text("Receivers: "));

    var receivers = [];
    for (var callsign in last_doc.receivers) {
        receivers.push(callsign);
    }
    receivers.sort();

    var rl = $("<div class='receiver_list' />");

    receivers.forEach(function (callsign) {
        rl.append($("<span />").text(callsign));
        rl.append(" ");
    });

    r.append(rl);
    container.append(r);
}

function refresh_telemlist(container, data, callsign, track, flight) {
    container.empty();
    data.forEach(function (item) {
        container.append(telem_map(item, callsign, track, flight));
    });
}

/* Controlling stuff. */
function flight_track_i(flight) {
    return tracking_flights.indexOf(flight._id);
}

function flight_track_toggle(flight) {
    var i = flight_track_i(flight);
    if (i !== -1) {
        tracking_flights.splice(i, 1);
        flight.dm.reset();
        $("#flight_" + flight._id).remove();
    } else {
        tracking_flights.push(flight._id);
        flight.dm.init();

        var c = $("<div id='flight_" + flight._id + "' class='section' />");
        c.append($("<h2 />").text("Flight: " + flight.name));

        if (demo_mode == DemoModes.GMAPS) {
            flight.dm.streamSetTo(new DemoMapsTrackSetTarget(flight._id, c));
            $("#overlay").append(c);
        } else {
            $("#demo").append(c);

            if (demo_mode == DemoModes.STREAM) {
                function ftm(callsign, track) {
                    return track_map(callsign, track, flight);
                }
                flight.dm.streamSetTo(new DemoStreamSetTarget(d, ftm));
            }
            else if (demo_mode == DemoModes.REFRESH) {
                flight.dm.onSetChange(function (data) {
                    refresh_tracklist(d, data, flight);
                });
            }
        }
    }
}

/* Initialisation stuff */
function run_demo() {
    if (demo_mode == DemoModes.GMAPS) {
        var demo_temp = $("#demo");
        demo_temp.detach();
        $("body").empty();
        $("html").addClass("gmapsmode");

        var mapcontainer = $("<div id='mapcontainer'>");
        mapcontainer.addClass("fullscreen");
        $("body").append(mapcontainer);

        var centre = new google.maps.LatLng(52, 0);
        gmap = new google.maps.Map(document.getElementById("mapcontainer"), {
            zoom: 8,
            center: centre,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        $("body").append(demo_temp);
    }

    var o;

    if (demo_mode == DemoModes.GMAPS) {
        o = $("<div id='overlay'>");
        $("#demo").append(o);
    } else {
        o = $("#demo");
    }

    var c = $("<div id='flightlist' class='section' />");
    o.append(c);
    c.append("<h2>Flight list and tracking enable</h2>");
    c.append("<ul />");
    var container = $(c.children()[1]);

    var data = new HabitatDB("habitat");
    data.init();

    if (demo_mode == DemoModes.STREAM || demo_mode == DemoModes.GMAPS)
        data.streamDataTo(new DemoStreamDataTarget(container, flight_map));
    else if (demo_mode == DemoModes.REFRESH)
        data.onDataChange(function (data) {
            refresh_flightlist(container, data);
        });
}

function ask_mode() {
    $("#demo").append(
        "<div>" + 
            "JS update mode: " +
            "<input id='modestream' type='button' value='Stream' />" +
            " or " +
            "<input id='moderefresh' type='button' value='Refresh' />" + 
            " or " +
            "<input id='modemaps' type='button' value='GMaps' />" + 
        "</div>");

    function go(mode) {
        $("#demo").empty();
        demo_mode = mode;
        run_demo();
    }

    $("#modestream").click(function () {
        go(DemoModes.STREAM);
    });

    $("#moderefresh").click(function () {
        go(DemoModes.REFRESH);
    });

    $("#modemaps").click(function () {
        go(DemoModes.GMAPS);
    });
}

demo = ask_mode;
$(document).ready(demo);
// TODO: some sort of stats.
