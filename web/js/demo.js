function DemoOutput(n) {
    var container = $(n);
    var elems = [];

    function prepare(elem) {

/*
        var columns = [];

        for (var x in elem.data) {
            if (x[0] !== "_") {
                columns.push(x);
            }
        }

        columns.sort();
*/

        // Hack. For Science. [TODO]
        var columns = ["count", "latitude", "longitude", "altitude"];

        var r = $(document.createElement('div'));
        var d = $(document.createElement('div'));
        d.append(elem.data._sentence || elem.data._raw);
        d.css("width", "600px");
        r.append(d);

        columns.forEach(function (k) {
            var c = $(document.createElement('div'));
            c.append(elem.data[k]);
            c.css("width", "100px");
            r.append(c);
        });

        return r;
    }

    function at(i) {
        return $(n + ":nth-child(" + i + ")");
    }

    function animate_change(d) {
        d.animate({'background-color': 'yellow'}, 500);
        d.animate({'background-color': 'transparent'}, 2000);
    }

    function animate_add(d) {
        d.hide();
        d.css("color", "transparent");
        d.slideDown(500);
        d.animate({'background-color': 'yellow', 'color': 'black'}, 500);
        d.animate({'background-color': 'transparent'}, 500);
    }

    function animate_remove(d, cb) {
        d.animate({'background-color': 'yellow'}, 500);
        d.animate({'background-color': 'transparent',
                   'color': 'transparent'}, 500);
        d.slideUp(500, cb);
    } 

    // NB: prepend instead of append; after instead of before: items are
    // displayed in reverse order on the page

    function push(elem) {
        console.log("Push " + elem._id);

        var d = prepare(elem);
        elems.push(d);
        container.prepend(d);

        animate_add(d);
    }

    function insertAt(i, elem) {
        if (i == elems.length) {
            push(elem);
        } else {
            console.log("Insert " + i + " " + elem._id);

            var next = elems[i];
            var d = prepare(elem);
            elems.splice(i, 0, d);
            next.after(d);

            animate_add(d);
        }
    }

    function removeAt(i) {
        console.log("Remove " + i);

        var d = elems[i];
        elems.splice(i, 1);

        animate_remove(d, function () {
            d.remove();
        });
    }

    function setAt(i, elem) {
        console.log("Set " + i + " " + elem._id);

        var d = prepare(elem);
        var old = elems[i];
        elems[i] = d;
        old.replaceWith(d);

        animate_change(d);
    }

    function clear() {
        console.log("Clear");

        elems.forEach(function (elem) {
            animate_remove(elem, function () {
                elem.remove();
            });
        });
        elems.splice(0, elems.length);
    }

    return { push: push, insertAt: insertAt, removeAt: removeAt,
             setAt: setAt, clear: clear };
}

$(document).ready(function() {
    var stream = FlightStream("habitat", DemoOutput("#telems"));

    function got_flights(flights) {
        var ul = $("#flights");

        flights.forEach(function (flight) {
            var li = $(document.createElement('li'));
            var a = $(document.createElement('a'));
            li.append(a);
            a.append(flight.name);
            a.attr("href", "#");
            ul.append(li);

            a.click(function (e) {
                stream.select_flight(flight._id);
                e.preventDefault();
            });
        });
    }

    stream.flights(got_flights);
});
