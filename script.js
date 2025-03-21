function levelName(level) {
    return `${Number(level) + 1}. stāvs`;
}

function prepareMap() {
    let osm = new L.TileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 22,
            attribution: "Map data &copy; OpenStreetMap contributors",
        },
    );
    let map = new L.Map("map", {
        //   layers: [osm],
        //   center: new L.LatLng(57.076142, 24.326563),
        //   zoom: 18,
    }).setView([57.076142, 24.326563], 22);
        
    var opts = {
        lines: 13, // The number of lines to draw
        length: 38, // The length of each line
        width: 17, // The line thickness
        radius: 45, // The radius of the inner circle
        scale: 1, // Scales overall size of the spinner
        corners: 1, // Corner roundness (0..1)
        speed: 2, // Rounds per second
        rotate: 0, // The rotation offset
        animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
        direction: 1, // 1: clockwise, -1: counterclockwise
        color: '#d1a9dd', // CSS color or array of colors
        fadeColor: 'transparent', // CSS color or array of colors
        top: '50%', // Top position relative to parent
        left: '50%', // Left position relative to parent
        shadow: '0 0 1px transparent', // Box-shadow for the lines
        zIndex: 2000000000, // The z-index (defaults to 2e9)
        className: 'spinner', // The CSS class to assign to the spinner
        position: 'absolute', // Element positioning
      };
    
    //   var target = document.getElementById('content');
        var spinner = new Spinner(opts).spin($("#content")[0]);

    // let spinner = new Spin.Spinner(opts).spin($("#content")[0]);

    L.easyButton("fa-home", function (btn, map) {
        map.setView([57.076142, 24.326563], 22);
    }).addTo(map);

    L.easyButton("fa-crosshairs", function (btn, map) {
        map.locate({ setView: true, maxZoom: 18 });
    }).addTo(map);

    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
    ).addTo(map);

    return { osm, map, spinner };
}

const styles = {
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

var customIcon = L.icon({
    iconUrl:"img/room_class.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

function mapData(data, mapCtx) {
    const layerMap = data["features"]
        .filter((feature) =>
            Object.keys(styles).includes(feature.properties.indoor)
            // console.log("Excluded:", feature)
        )
        .sort((a, b) => a.properties.indoor.localeCompare(b.properties.indoor))
        .reduce((acc, feature) => {
            const key = levelName(feature.properties.level);
            const value = L.geoJSON(feature, {
                style: styles[feature.properties.indoor],
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng, {icon: customIcon});
                },
            });

            const name = feature.properties.name ??
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

                // $("#node-select").append(opt);

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
    mapCtx.spinner.stop();
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
    // Create the map

    let mapCtx = prepareMap();

    $("#node-select").select2({
        allowClear: true,
        placeholder: "Izvēlieties telpu",
    });

    $("#node-select").on(
        "select2:select",
        (e) => handleGeoJSONSelect(e, mapCtx),
    );

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
        .then((data) => osmtogeojson(data))
        .then((data) => mapData(data, mapCtx))
        .catch((error) => console.error("Error:", error));
}