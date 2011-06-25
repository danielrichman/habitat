/* Animation */
function flash(elem) {
    elem.animate({'background-color': 'yellow'}, 500);
    elem.animate({'background-color': 'transparent'}, 2000);
}

function flashreset(elem) {
    elem.stop(true, true);
}

/* Utilities */
function DemoStreamTarget(container, map) {
    this.init = function (items) {
        /* this.clear(); */
        // Doesn't work: container.append(items.map(map));
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
        container.children()[i].remove();
    }

    this.set = function (i, item) {
        container.children()[i].replaceWith(map(item));
    }

    this.clear = function () {
        container.empty();
    }
}

/* Demo globals */
var tracking_flights = [];

/* Specific maps */
function flight_map(flight) {
    var elem = $("<li/>");
    elem.append("<span class='flightname' />");
    elem.append(" ");
    elem.append("<a href='#' />");
    $(elem.children()[0]).text(flight.name);
    var tracklink = $(elem.children()[1]);

    function setlinktext() {
        if (flight_track_id(flight) === -1)
            tracklink.text("Start Tracking");
        else
            tracklink.text("Stop Tracking");
    }

    setlinktext();

    elem.click(function (ev) {
        flight_track_toggle(flight);
        setlinktext();
        ev.preventDefault();
    });

    //flash(elem);

    return elem;
}

/* Controlling stuff. */
function flight_track_id(flight) {
    return tracking_flights.indexOf(flight._id);
}

function flight_track_toggle(flight) {
    var i = flight_track_id(flight);
    if (i !== -1) {
        tracking_flights.splice(i, 1);
        flight.dm.reset();
    } else {
        flight.dm.init();
        tracking_flights.push(flight._id);
        // TODO: grab datas and stuff
    }
}

/* Initialisation stuff */
function demo_stream() {
    var c = $("#demo").append("<div />")
    c.append("<p class='heading'>").text("Flight list and control");
    c.append("<ul />");
    var container = $(c.children()[0]);

    var data = new HabitatDB("habitat");
    data.init();
    data.streamDataTo(new DemoStreamTarget(container, flight_map));
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
