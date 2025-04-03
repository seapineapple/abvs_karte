function levelName(level) {
    return `${Number(level) + 1}. stāvs`;
}

function prepareMap() {
    let map = new L.Map("map").setView([57.076142, 24.326563], 20);

    let osm = new L.TileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 20,
            attribution: "Map data &copy; OpenStreetMap contributors",
        },
    );
    osm.addTo(map);        

    L.easyButton("fa-home", function (btn, map) {
        map.setView([57.076142, 24.326563], 19);
    }).addTo(map);

    L.easyButton("fa-crosshairs", function (btn, map) {
        map.locate({ setView: true, maxZoom: 18 });
    }).addTo(map);

    return { osm, map };
}


let styles = {
    room: {
        color: "black",
        fillColor: "#d195e5",
        fillOpacity: 0.7,
        strokeWidth: 1
    },
    roomSelected: {
        color: "red",
        fillColor: "#b439dd",
        fillOpacity: 0.7,
        strokeWidth: 1
    },
    level: {
        color: "grey",
        fillColor: "#b3efd8",
        fillOpacity: 0.2,
        strokeWidth: 1
    },
};
// restaurant
// kitchen
// storage
// dressing
// stairs
// class
// toilet
// toilets
// hall
// office
// lecture
// technical
// corridor
// amphitheatr
// ["hall", "corridor"].forEach( 
//     (key) => {
//         styles["room__" + key] = {
//             // fillColor: "#b3efd8",
//             fillOpacity: 0.4,
//         }
//     }
// );

var customIcon = L.icon({
    iconUrl:"img/room_class.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

function mapData(data, mapCtx) {
    console.log("Data:", data);

    let layerMap = data["features"]
        .filter((feature) =>
            // take only 'room' and 'level' features
            Object.keys(styles).includes(feature.properties.indoor)
        )
        .sort((a, b) => a.properties.indoor.localeCompare(b.properties.indoor)) // sort for proper layering on map
        .reduce((acc, feature) => {
  
            let key = levelName(feature.properties.level);

            // let style = { ...styles[feature.properties.indoor], ...styles[feature.properties.indoor + "__" + feature.properties.room] };
            let style = styles[feature.properties.indoor];

            let value = L.geoJSON(feature, {
                style,
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng, {icon: customIcon});
                },
            });

            let name = feature.properties.name ??
                feature.properties.description ??
                feature.properties.indoor ?? "No name";

            if (feature.properties.indoor === "room") {
                var opt = new Option(name, feature.id, false, false);
                opt.dataset.description = feature.properties?.description || "Apraksts nav norādīts!";
                opt.dataset.level = feature.properties.level;

                var optgroup = $("#node-select optgroup[label='" + key + "']");
                if (!optgroup.length) {
                    optgroup = $("<optgroup>").attr("label", key).appendTo("#node-select");
                }
                optgroup.append(opt);

                value.on("click", function (evt) {
                    // Access the feature's properties
                    var featureId = feature.id;
                    // console.log($("#node-select").val());
                    $("#node-select")
                        .val(featureId)
                        .trigger("change")
                        .trigger("select2:select");
                });
                value.setZIndex(1000);
            }

            if (!acc[key]) {
                acc[key] = L.layerGroup();
                //   acc[key].addTo(mapCtx.map);
                if (key === "1. stāvs") {
                    acc[key].addTo(mapCtx.map);
                }
            }
            acc[key].addLayer(value);
            value.bindTooltip(name);

            return acc;
        }, {});

    mapCtx.layerMap = layerMap;    
    L.control.layers(layerMap, {}, { collapsed: false }).addTo(mapCtx.map);
}


function handleGeoJSONSelect(e, mapCtx) {
    let selection =
        ($(e.target).select2("data") || []).shift();

    if (selection) {
        let level = levelName(selection?.element?.dataset?.level);
        Object.entries(mapCtx.layerMap).forEach(([l, layerGroup]) => {
            if (l === level) {
                mapCtx.map.addLayer(layerGroup);
            } else if (mapCtx.map.hasLayer(layerGroup)) {
                mapCtx.map.removeLayer(layerGroup);
            }
        })
    } 

    $("#json").text(selection?.element?.dataset?.description || "");
    let roomId = selection?.id || null;

    mapCtx.map.eachLayer(function (layer) {
        if (layer?.feature?.properties?.indoor === "room") {
            if (roomId === layer.feature.id) {
                layer.setStyle(styles.roomSelected);
                layer.bringToFront();
            } else {
                layer.setStyle(styles.room);
            }
        }
    })
}

function initMap() {
    // Initialize the spinner
    var spinner = new Spinner({color: '#d1a9dd', length: 40, width: 15}).spin($("#content")[0]);

    // Create the map, set the view and add the tile layer. Add nav buttons.
    let mapCtx = prepareMap();

    // Initialize the select2 plugin
    $("#node-select").select2({
        allowClear: true,
        placeholder: "Izvēlieties telpu",
    });
    $("#node-select").on(
        "select2:select",
        (e) => handleGeoJSONSelect(e, mapCtx),
    );

    // load the data
    let bbox =
        "(57.075390947519935,24.324722848528037,57.076860455954716,24.328135102582106)";

    fetch(
        "https://overpass-api.de/api/interpreter",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body: "data=" + encodeURIComponent(
                `[out:json][timeout:25];
      (
        way["indoor"]${bbox};
        way["building"="school"]${bbox};
      );
      out geom;`,
            ),
        },
    )
        .then((response) => response.json())
        .then((responseAsJson) => osmtogeojson(responseAsJson))
        .then((geoJson) => mapData(geoJson, mapCtx))
        .catch((error) => console.error("Error:", error))
        .finally(() => spinner.stop());
}

$("document").ready( initMap );