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

    return { osm, map };
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

function mapData(data, mapCtx) {
    const layerMap = data["features"]
        .filter((feature) =>
            Object.keys(styles).includes(feature.properties.indoor) ||
            console.log("Excluded:", feature)
        )
        .sort((a, b) => a.properties.indoor.localeCompare(b.properties.indoor))
        .reduce((acc, feature) => {
            const key = feature.properties.level;
            const value = L.geoJSON(feature, {
                style: styles[feature.properties.indoor],
            });

            const name = feature.properties.name ??
                feature.properties.description ??
                feature.properties.indoor ?? "No name";

            if (feature.properties.indoor === "room") {
                var opt = new Option(name, feature.id, false, false);
                opt.dataset.description = feature.properties?.description || "Apraksts nav norādīts!";
                opt.dataset.level = feature.properties.level;

                let optLabel = feature.properties.level + " līmenis";
                var optgroup = $("#node-select optgroup[label='" + optLabel + "']");
                if (!optgroup.length) {
                    optgroup = $("<optgroup>").attr("label", optLabel).appendTo("#node-select");
                }
                optgroup.append(opt);

                // $("#node-select").append(opt);

                value.on("click", function (evt) {
                    // Access the feature's properties
                    var featureId = feature.id;
                    console.log($("#node-select").val());
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
                if (key === "0") {
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
        let level = selection?.element?.dataset?.level;
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

    // geoNodes.clearLayers();
    // geoNodes.eachLayer(function (layer) {
    //     //   console.log("Layer:", layer.feature.id, layer);
    //     if (
    //         ids.includes(layer.feature.id)
    //     ) {
    //         layer.setStyle({
    //             color: "#ff0000",
    //         });
    //     } else {
    //         layer.setStyle({
    //             color: "#00ff00",
    //         });
    //     }
    // });
    // console.log("Selected options:", ids);
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
        "(57.07580000000000,24.32300080000000,57.076623600000000,24.32779130000000)";
    // "(57.07581081301215,24.32309746742249,57.07609655208826,24.32910561561585)";
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
            //                         body: "data=" + encodeURIComponent(
            //                             `[out:json][timeout:25];
            // (
            // 	way["indoor"](57.07581081301215,24.32309746742249,57.07609655208826,24.32910561561585);
            //     way["building"="school"](57.07581081301215,24.32309746742249,57.07609655208826,24.32910561561585);
            // );
            // out geom;`),
        },
    )
        .then((response) => response.json())
        .then((data) => osmtogeojson(data))
        .then((data) => mapData(data, mapCtx))
        .catch((error) => console.error("Error:", error));

    // $.get(url, function (jsonData) {
    //     console.log("jsonData", jsonData);
    //     let geoJSON = osmtogeojson(jsonData);
    //     console.log("geoJSON", geoJSON);

    //     let geoNodes = L.geoJSON(geoJSON, {
    //         filter: (feature) => {
    //             return feature.geometry.type ===
    //                     "Polygon" &&
    //                 feature.properties.indoor ==
    //                     "room";
    //         },
    //         style: function (feature) {
    //             switch (
    //                 feature.properties.building
    //             ) {
    //                 case "school":
    //                     return { color: "#ff0000" };
    //                 default:
    //                     return { color: "#0000ff" };
    //             }
    //         },
    //         onEachFeature: function (
    //             feature,
    //             layer,
    //         ) {
    //             layer.on("click", function (evt) {
    //                 // Access the feature's properties
    //                 var featureId = feature.id;
    //                 console.log(
    //                     $("#node-select").val(),
    //                 );
    //                 $("#node-select")
    //                     .val(featureId)
    //                     .trigger("change")
    //                     .trigger("select2:select");
    //             });
    //         },
    //     }).addTo(map);

    //     $("#node-select").select2({
    //         allowClear: true,
    //         placeholder: "Izvēlieties telpu",
    //         data: geoJSON.features.map((item) => {
    //             return {
    //                 id: item.id,
    //                 text: // ${item.id}
    //                     `${
    //                         item.properties.name ??
    //                             item.properties
    //                                 .description ??
    //                             item.properties
    //                                 .indoor ??
    //                             "?"
    //                     }`,
    //                 info: item,
    //             };
    //         }),
    //     }).val(null).trigger("change");

    //     function handleGeoJSONSelect(e) {
    //         let selections =
    //             $(e.target).select2("data") || [];

    //         let ids = selections.map((s) => s.id);
    //         let displayData = selections.map((s) =>
    //             s.info
    //         );
    //         $("#json").text(
    //             JSON.stringify(
    //                 displayData,
    //                 null,
    //                 4,
    //             ),
    //         );
    //         // geoNodes.clearLayers();
    //         geoNodes.eachLayer(function (layer) {
    //             //   console.log("Layer:", layer.feature.id, layer);
    //             if (
    //                 ids.includes(layer.feature.id)
    //             ) {
    //                 layer.setStyle({
    //                     color: "#ff0000",
    //                 });
    //             } else {
    //                 layer.setStyle({
    //                     color: "#00ff00",
    //                 });
    //             }
    //         });
    //         // L.geoJSON(geojsonFeature).addTo(geoNodes)
    //         console.log("Selected options:", ids);
    //     }

    //     $("#node-select").on(
    //         "select2:select",
    //         // "change",
    //         // handleSelect,
    //         handleGeoJSONSelect,
    //     );

    //     console.log("Document ready");
    // });
}