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

/* Utilities */
function DemoStreamDataTarget(container, map) {
    this.init = function (items) {
        /* this.clear(); */
        items.forEach(this.push);
    }

    this.push = function (item) {
        container.append(map(item));
    }

    this.insert = function (i, item) {
        var contents = container.children();
        var newelem = map(item);

        if (i == contents.length)
            container.append(newelem);
        else
            contents[i].before(newelem);
    }

    this.remove = function (i) {
        $(container.children()[i]).remove();
    }

    this.set = function (i, item) {
        container.children()[i].replaceWith(map(item));
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

    flashlater(elem);
    return elem;
}

function track_map(callsign, track) {
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

    track.streamDataTo(new DemoStreamDataTarget(d, telem_map));

    flashlater(label);
    return elem;
}

var telem_columns = ["count", "latitude", "longitude", "altitude"];

function telem_map(doc) {
    var elem = $("<div class='telem' />");
    telem_columns.forEach(function (k) {
        var s = doc.data[k];
        if (s === undefined)
            s = "n/a";
        else
            s = s.toString();
        if (s.length > 9)
            s = s.substr(0, 9);
        elem.append($("<div />").text(s));
    });

    flashlater(elem);
    return elem;
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
        $("#demo").append(c);
        c.append($("<h2 />").text("Flight: " + flight.name));

        var d = $("<div />");
        c.append(d);

        flight.dm.streamSetTo(new DemoStreamSetTarget(d, track_map));
    }
}

/* Initialisation stuff */
function demo_stream() {
    var c = $("<div id='flightlist' class='section' />");
    $("#demo").append(c);
    c.append("<h2>Flight list and tracking enable</h2>");
    c.append("<ul />");
    var container = $(c.children()[1]);

    var data = new HabitatDB("habitat");
    data.init();
    data.streamDataTo(new DemoStreamDataTarget(container, flight_map));
}

function demo_refresh(elem) {
    // TODO
}

function ask_mode() {
    $("#demo").append(
        "<div>" + 
            "JS update mode: " +
            "<input id='modestream' type='button' value='Stream' />" +
            " or " +
            "<input id='moderefresh' type='button' value='Refresh' />" + 
        "</div>");

    $("#modestream").click(function () {
        $("#demo").empty();
        demo_stream();
    });

    $("#moderefresh").click(function () {
        $("#demo").empty();
        demo_refresh();
    });
}

demo = ask_mode;
$(document).ready(demo);
// TODO: some sort of stats.
