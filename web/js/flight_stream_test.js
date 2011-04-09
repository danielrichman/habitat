var db = $.couch.db("habitat");
var flight = null;
var flight_data;
var flight_data_ids;
var swapping = false;
var changelistener = null;
var active = 0;
var requests = [];

$(document).ready(function() {
    db.view("habitat/flights", { success: got_flights });

    $(document).ajaxSend(function (e, xhr, settings) {
        requests.push(xhr);
    });

    $(document).ajaxComplete(function (e, xhr, settings) {
        requests.splice(requests.indexOf(xhr), 1);
    });
});

function abort_all_requests() {
    requests.forEach(function (elem) {
        try { elem.abort(); } catch (err) { }
    });

    requests = [];
}

function got_flights(data) {
    var ul = $("#flights");
    for (var i = 0; i < data.rows.length; i++) {
        var id = data.rows[i].id;
        var name = data.rows[i].value;

        var li = $(document.createElement('li'));
        var a = $(document.createElement('a'));
        li.append(a);
        a.append(name);
        a.attr("href", "javascript: select_flight('" + id + "')");
        ul.append(li);
    }
}

function select_flight(f) {
    if (swapping)
        return;

    if (flight == null)
    {
        flight = f;
        $("#data").fadeIn('slow');
    }
    else
    {
        swapping = true;

        $("#data").fadeOut('slow', function () {
            clear_items();

            // Increment active. This ensures that any results from the initial load,
            // if it was running, are ignored (see below).
            active = active + 1;

            if (changelistener)
            {
                changelistener.stop();
                changelistener = null;
            }

            abort_all_requests();

            flight = null;
            swapping = false;

            select_flight(f);
        });
    }

    // Avoid a race condition: Ask the server what the last update seq was,
    // then download lots of data, then begin watching for changes.
    // A slight overlap would mean that we get a document twice - no big deal.

    var this_active = active;

    db.info({ success: function (info) {
        db.view("habitat/all_flight_info", { success: function (data) {
            // Ignore results if we've moved on to something more interesting
            // in the meantime
            if (active == this_active)
                got_initial_data(data, info.update_seq);
        }, key: flight });
    }});
}

function got_initial_data(data, last_seq) {
    flight_data = data.rows;  // Overwrite intentional
    sort_flight_data();

    // TODO: in the next three steps flight_data is iterated over thrice
    // for clarity. This could be reduced to once.

    flight_data_ids = [];
    flight_data.forEach(function (elem) {
        flight_data_ids.push(elem.id);
    });

    update_page();

    flight_data.forEach(function (elem) {
        hilight_item(elem.id);
    });

    var options = {};
    options.filter = "habitat/relevant_to_flight";
    options.flight = flight;
    options.include_docs = true;

    // Begin (permanantly) listening for changes.
    changelistener = db.changes(last_seq, options);
    changelistener.onChange(got_changes);
}

function got_changes(data)
{
    var inserted_ids = [];
    var deleted_ids = [];
    var modified = {};
    var modified_ids = [];

    // Unpack changes and add new items
    data.results.forEach(function (elem) {
        var id = elem.id;

        if (elem.deleted)
        {
            if (flight_data_ids.indexOf(id) !== -1)
            {
                deleted_ids.push(id);
                flight_data_ids.splice(flight_data_ids.indexOf(id), 1);
            }
        }
        else
        {
            var fake_view_item = { id: id, value: elem.doc };

            if (flight_data_ids.indexOf(id) !== -1)
            {
                modified[id] = fake_view_item;
                modified_ids.push(id);
            }
            else
            {
                flight_data.push(fake_view_item);
                flight_data_ids.push(id);
                inserted_ids.push(id);
            }
        }
    });

    flight_data = flight_data.map(function (elem) {
        return modified[elem.id] || elem;
    });

    sort_flight_data();
    update_page();

    flight_data = flight_data.filter(function (elem) {
        return deleted_ids.indexOf(elem.id) === -1;
    });

    inserted_ids.forEach(hilight_item);
    modified_ids.forEach(hilight_item);
    deleted_ids.forEach(fadeout_item);
}

function sort_flight_data()
{
    flight_data.sort(function (a, b) {
        var av = a.value.estimated_time_created;
        var bv = b.value.estimated_time_created;
        return ((av > bv) ? 1 : ((av < bv) ? -1 : 0));
    });
}

function update_page()
{
    clear_items();
    flight_data.forEach(function (elem) {
        var id = elem.id;
        var rd = elem.value.data;
        var text = rd._sentence || rd._raw;
        add_item(id, text);
    });
}

function clear_items()
{
    $("#telems").empty();
}

function add_item(id, text)
{
    var d = $(document.createElement('div'));
    d.attr("id", "telem_" + id);
    d.append(text)
    $("#telems").append(d);
}

function hilight_item(id, complete)
{
    var d = $("#telem_" + id);
    d.animate({'background-color': 'yellow'}, 500);
    d.animate({"background-color": 'transparent'}, 2000);
}

function fadeout_item(id, complete)
{
    var d = $("#telem_" + id);
    d.animate({'background-color': 'yellow'}, 500);
    d.fadeOut(2000, function () {
        d.remove();
    });
}
