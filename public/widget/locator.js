/* Findly store locator widget. Runs inside an iframe served by /locator/:id. */
(function () {
  "use strict";

  var D = window.__FINDLY__;
  if (!D) return;
  var S = D.settings;
  var API = D.apiBase;
  var DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  var DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  var GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

  var state = {
    origin: null, // {lat,lng,label}
    listArea: null, // map bounds the list is filtered to
    category: "",
    product: "",
    service: "",
    selectedId: null,
    view: "list", // mobile only
    suggestions: [],
    activeSuggestion: -1,
  };
  var byId = {};
  D.locations.forEach(function (l) { byId[l.id] = l; });

  // ------------------------------------------------------------ utils
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }
  function $(sel) { return document.querySelector(sel); }
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }
  function haversineKm(a, b) {
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDist(km) {
    var v = S.units === "mi" ? km * 0.621371 : km;
    var u = S.units === "mi" ? "mi" : "km";
    return (v < 10 ? v.toFixed(1) : Math.round(v)) + " " + u;
  }
  function addressLines(l) {
    var line2 = [l.city, l.region, l.postalCode].filter(Boolean).join(", ");
    return [l.address1, l.address2, line2, l.country].filter(Boolean);
  }
  function directionsUrl(l) {
    return "https://www.google.com/maps/dir/?api=1&destination=" + l.lat + "," + l.lng;
  }

  // ------------------------------------------------------------ analytics
  function track(type, extra) {
    extra = extra || {};
    if (!D.preview) {
      try {
        var body = JSON.stringify({ id: D.id, type: type, locationId: extra.locationId, query: extra.query, resultCount: extra.resultCount });
        var url = API + "/api/event";
        if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
        else fetch(url, { method: "POST", body: body, keepalive: true });
      } catch (e) { /* ignore */ }
    }
    if (S.googleAnalytics && window.parent !== window) {
      var loc = extra.locationId && byId[extra.locationId];
      window.parent.postMessage({
        type: "findly:event",
        name: "store_locator_" + type,
        params: { location_name: loc ? loc.name : undefined, search_term: extra.query },
      }, "*");
    }
  }

  // ------------------------------------------------------------ theme
  function applyTheme() {
    var r = document.documentElement.style;
    r.setProperty("--pp-primary", S.primaryColor);
    r.setProperty("--pp-text", S.textColor);
    r.setProperty("--pp-bg", S.backgroundColor);
    r.setProperty("--pp-radius", S.borderRadius + "px");
    r.setProperty("--pp-font", S.fontFamily === "system-ui"
      ? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      : "'" + S.fontFamily + "', system-ui, sans-serif");
    var theme = themeFor(S.theme);
    r.setProperty("--pp-map-filter", theme.filter || "none");
    var root = $(".pp");
    if (root) root.setAttribute("data-list", S.listPosition);
    var title = $(".pp-title");
    if (title) title.textContent = S.title;
    var input = $(".pp-input");
    if (input) input.placeholder = S.searchPlaceholder;
    var cats = $(".pp-cats");
    if (cats) cats.hidden = !S.showCategoryFilter || !allCategories().length;
  }
  function themeFor(id) {
    for (var i = 0; i < D.themes.length; i++) if (D.themes[i].id === id) return D.themes[i];
    return D.themes[0];
  }
  function styleFor(id) {
    var t = themeFor(id);
    if (t.style !== "satellite") return t.style;
    return {
      version: 8,
      glyphs: GLYPHS,
      sources: {
        sat: {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
        },
      },
      layers: [{ id: "sat", type: "raster", source: "sat" }],
    };
  }

  // ------------------------------------------------------------ layout
  var ICON_LOCATE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21v-2zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>';
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/></svg>';

  document.getElementById("pp-root").innerHTML =
    '<div class="pp" data-list="' + esc(S.listPosition) + '" data-view="list">' +
      '<aside class="pp-panel">' +
        '<header class="pp-head">' +
          '<h1 class="pp-title">' + esc(S.title) + '</h1>' +
          '<form class="pp-search" role="search" autocomplete="off">' +
            '<span class="pp-search-icon">' + ICON_SEARCH + '</span>' +
            '<input class="pp-input" type="search" aria-label="Search locations" ' +
              'aria-autocomplete="list" aria-controls="pp-suggest" placeholder="' + esc(S.searchPlaceholder) + '">' +
            '<button type="button" class="pp-locate" title="Use my location" aria-label="Use my location">' + ICON_LOCATE + '</button>' +
          '</form>' +
          '<ul class="pp-suggest" id="pp-suggest" role="listbox" hidden></ul>' +
          '<div class="pp-offerings"><label>Product<select class="pp-product"><option value="">All products</option></select></label><label>Service<select class="pp-service"><option value="">All services</option></select></label></div>' +
          '<div class="pp-cats" role="group" aria-label="Filter by category"></div>' +
        '</header>' +
        '<div class="pp-status" aria-live="polite"></div>' +
        '<ol class="pp-list"></ol>' +
      '</aside>' +
      '<div class="pp-map-wrap"><div class="pp-map" id="pp-map"></div></div>' +
      '<nav class="pp-tabs">' +
        '<button type="button" data-view="list" aria-pressed="true">List</button>' +
        '<button type="button" data-view="map" aria-pressed="false">Map</button>' +
      '</nav>' +
    '</div>';

  applyTheme();

  // ------------------------------------------------------------ categories
  function allCategories() {
    var set = Object.create(null);
    D.locations.forEach(function (l) { l.categories.forEach(function (c) { set[c] = 1; }); });
    return Object.keys(set).sort();
  }
  function renderCategories() {
    var el = $(".pp-cats");
    var cats = allCategories();
    el.hidden = !S.showCategoryFilter || !cats.length;
    el.innerHTML = ['<button type="button" data-cat="" aria-pressed="' + (state.category === "") + '">All</button>']
      .concat(cats.map(function (c) {
        return '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (state.category === c) + '">' + esc(c) + "</button>";
      })).join("");
  }
  $(".pp-cats").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-cat]");
    if (!b) return;
    state.category = b.getAttribute("data-cat");
    renderCategories();
    updateMapData();
    render();
  });

  // ------------------------------------------------------------ results
  function filtered() {
    return D.locations.filter(function (l) {
      return (!state.category || l.categories.indexOf(state.category) !== -1) && (!state.product || (l.products || []).indexOf(state.product) !== -1) && (!state.service || (l.services || []).indexOf(state.service) !== -1);
    });
  }

  function computeResults() {
    var list = filtered();
    // The list follows the map area the visitor chose (by dragging, zooming or searching),
    // not the zoom we do when they click a store - otherwise the other stores would vanish.
    var bounds = state.listArea;
    var center = bounds ? bounds.getCenter() : null;
    var ref = state.origin || (center ? { lat: center.lat, lng: center.lng } : null);
    list.forEach(function (l) { l._d = ref ? haversineKm(ref, l) : null; });
    var inView = bounds ? list.filter(function (l) { return bounds.contains([l.lng, l.lat]); }) : list.slice();
    // A selected store always stays in the list, even if it's outside that area.
    var sel = state.selectedId && byId[state.selectedId];
    if (sel && inView.indexOf(sel) === -1 && list.indexOf(sel) !== -1) inView.push(sel);
    var sorter = function (a, b) {
      if (state.origin) return a._d - b._d;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a._d != null ? a._d - b._d : a.name.localeCompare(b.name);
    };
    inView.sort(sorter);
    if (inView.length) return { items: inView.slice(0, S.resultLimit), nearestFallback: false };
    var nearest = list.slice().sort(function (a, b) { return a._d - b._d; }).slice(0, 3);
    return { items: nearest, nearestFallback: true };
  }

  function hoursHtml(l) {
    var has = DAYS.some(function (d) { return l.hours[d]; });
    if (!has && !Object.keys(l.specialHours || {}).length) return "";
    var today;
    try { today = new Intl.DateTimeFormat("en-US", { timeZone: l.timezone, weekday: "short" }).format(new Date()).toLowerCase(); } catch (e) { today = DAYS[(new Date().getDay() + 6) % 7]; }
    var storeDate;
    try { storeDate = new Intl.DateTimeFormat("en-CA", { timeZone: l.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); } catch (e) { storeDate = new Date().toISOString().slice(0, 10); }
    var specials = l.specialHours || {};
    var override = Object.prototype.hasOwnProperty.call(specials, storeDate) ? '<p class="pp-promo">Today (' + esc(storeDate) + '): ' + esc(specials[storeDate]) + '</p>' : '';
    var upcoming = Object.keys(specials).filter(function (date) { return date >= storeDate; }).sort().slice(0, 10).map(function (date) { return '<tr><th scope="row">' + esc(date) + '</th><td>' + esc(specials[date]) + '</td></tr>'; }).join("");
    return override + '<table class="pp-hours"><caption>Opening hours</caption>' + DAYS.map(function (d) {
      return '<tr class="' + (d === today ? "is-today" : "") + '"><th scope="row">' + DAY_NAMES[d] +
        "</th><td>" + esc(l.hours[d] || "Closed") + "</td></tr>";
    }).join("") + upcoming + "</table>";
  }

  function detailHtml(l) {
    var parts = [];
    parts.push('<p><a href="' + esc(API + "/stores/" + D.id + "/" + l.id) + '" target="_blank" rel="noopener">View store page</a></p>');
    if ((l.products || []).length) parts.push("<p><strong>Products:</strong> " + l.products.map(esc).join(", ") + "</p>");
    if ((l.services || []).length) parts.push("<p><strong>Services:</strong> " + l.services.map(esc).join(", ") + "</p>");
    if (l.imageUrl) parts.push('<img class="pp-photo" src="' + esc(l.imageUrl) + '" alt="" loading="lazy">');
    if (l.promo) parts.push('<p class="pp-promo">' + esc(l.promo) + "</p>");
    if (l.description) parts.push('<p class="pp-desc">' + esc(l.description) + "</p>");
    parts.push(hoursHtml(l));
    var contact = [];
    if (l.phone) contact.push('<a href="tel:' + esc(l.phone.replace(/[^\d+]/g, "")) + '">' + esc(l.phone) + "</a>");
    if (l.email) contact.push('<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + "</a>");
    if (l.website) contact.push('<a href="' + esc(l.website) + '" target="_blank" rel="noopener" data-track="link_click">Website</a>');
    if (contact.length) parts.push('<p class="pp-contact">' + contact.join("") + "</p>");
    var actions = [];
    if (S.showDirections) {
      actions.push('<a class="pp-btn pp-btn-primary" href="' + directionsUrl(l) + '" target="_blank" rel="noopener" data-track="directions">Directions</a>');
    }
    l.links.forEach(function (k) {
      actions.push('<a class="pp-btn" href="' + esc(k.url) + '" target="_blank" rel="noopener" data-track="link_click">' + esc(k.label) + "</a>");
    });
    if (actions.length) parts.push('<div class="pp-actions">' + actions.join("") + "</div>");
    return '<div class="pp-detail">' + parts.join("") + "</div>";
  }

  function render() {
    var r = computeResults();
    var realStatus = $(".pp-status");
    // While a notice (e.g. a location error) is showing, don't overwrite it.
    var status = realStatus.classList.contains("is-notice") ? { textContent: "" } : realStatus;
    if (!D.locations.length) {
      status.textContent = "No locations yet.";
      $(".pp-list").innerHTML = "";
      return;
    }
    if (r.nearestFallback) {
      status.textContent = r.items.length ? "No locations in this area. Nearest locations:" : "No locations match this filter.";
    } else {
      status.textContent = r.items.length + (r.items.length === 1 ? " location" : " locations") +
        (state.origin && state.origin.label ? " near " + state.origin.label : "");
    }
    $(".pp-list").innerHTML = r.items.map(function (l) {
      var sel = l.id === state.selectedId;
      return '<li class="pp-card' + (sel ? " is-selected" : "") + '" data-id="' + esc(l.id) + '">' +
        '<button type="button" class="pp-card-main" aria-expanded="' + sel + '">' +
          '<span class="pp-card-top"><span class="pp-card-name">' + esc(l.name) + "</span>" +
            (l._d != null ? '<span class="pp-card-dist">' + fmtDist(l._d) + "</span>" : "") + "</span>" +
          (l.featured ? '<span class="pp-badge">Featured</span>' : "") +
          '<span class="pp-card-addr">' + addressLines(l).map(esc).join("<br>") + "</span>" +
          (l.categories.length ? '<span class="pp-card-cats">' + l.categories.map(esc).join(" · ") + "</span>" : "") +
        "</button>" +
        (sel ? detailHtml(l) : "") +
      "</li>";
    }).join("");
  }

  $(".pp-list").addEventListener("click", function (e) {
    var link = e.target.closest("a[data-track]");
    var card = e.target.closest(".pp-card");
    if (link && card) {
      track(link.getAttribute("data-track"), { locationId: card.getAttribute("data-id") });
      return;
    }
    if (e.target.closest(".pp-card-main") && card) {
      var id = card.getAttribute("data-id");
      select(state.selectedId === id ? null : id, { fly: true });
    }
  });

  function select(id, opts) {
    state.selectedId = id;
    render();
    if (map && mapReady) {
      map.getSource("pp-selected").setData(fc(id && byId[id] ? [byId[id]] : []));
    }
    if (!id) return;
    var l = byId[id];
    track("location_view", { locationId: id });
    if (opts && opts.fly && map) {
      map.flyTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 13), speed: 1.4 });
    }
    var el = document.querySelector('.pp-card[data-id="' + id + '"]');
    if (el && opts && opts.scroll) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ------------------------------------------------------------ map
  var map = null;
  var mapReady = false;
  var popup = null;
  var loadedIcons = {};
  var iconSeq = 0;
  var pendingIcons = {};
  var styleGeneration = 0;

  function fc(locs) {
    return {
      type: "FeatureCollection",
      features: locs.map(function (l) {
        var properties = { id: l.id, name: l.name, color: l.pinColor || S.primaryColor };
        var icon = loadedIcons[l.pinIconUrl || S.pinIconUrl];
        if (icon && map && map.hasImage(icon)) properties.icon = icon;
        return { type: "Feature", properties: properties, geometry: { type: "Point", coordinates: [l.lng, l.lat] } };
      }),
    };
  }

  function localizeLabels() {
    if (!S.language) return;
    map.getStyle().layers.forEach(function (layer) {
      if (layer.type !== "symbol" || layer.id.indexOf("pp-") === 0) return;
      var tf = map.getLayoutProperty(layer.id, "text-field");
      if (!tf) return;
      map.setLayoutProperty(layer.id, "text-field", [
        "coalesce", ["get", "name:" + S.language], ["get", "name:latin"], ["get", "name"],
      ]);
    });
  }

  function addLayers() {
    mapReady = true;
    styleGeneration++;
    pendingIcons = {};
    localizeLabels();
    if (map.getSource("pp")) return;
    map.addSource("pp", { type: "geojson", data: fc(filtered()), cluster: true, clusterRadius: 48, clusterMaxZoom: 12 });
    map.addSource("pp-selected", { type: "geojson", data: fc(state.selectedId && byId[state.selectedId] ? [byId[state.selectedId]] : []) });
    map.addLayer({
      id: "pp-clusters", type: "circle", source: "pp", filter: ["has", "point_count"],
      paint: {
        "circle-color": S.primaryColor,
        "circle-opacity": 0.9,
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26, 200, 32],
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });
    map.addLayer({
      id: "pp-cluster-count", type: "symbol", source: "pp", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 13, "text-allow-overlap": true },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "pp-points", type: "circle", source: "pp", filter: ["all", ["!", ["has", "point_count"]], ["!", ["has", "icon"]]],
      paint: { "circle-color": ["get", "color"], "circle-radius": 8, "circle-stroke-width": 2.5, "circle-stroke-color": "#ffffff" },
    });
    map.addLayer({ id: "pp-icons", type: "symbol", source: "pp", filter: ["all", ["!", ["has", "point_count"]], ["has", "icon"]], layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-anchor": "bottom" } });
    loadPinIcons();
    map.addLayer({
      id: "pp-selected", type: "circle", source: "pp-selected",
      paint: { "circle-color": S.primaryColor, "circle-radius": 12, "circle-stroke-width": 4, "circle-stroke-color": "#ffffff" },
    });
    map.addSource("pp-origin", { type: "geojson", data: fc([]) });
    map.addLayer({
      id: "pp-origin", type: "circle", source: "pp-origin",
      paint: { "circle-color": "#2b7fff", "circle-radius": 7, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" },
    });
    updateOrigin();
    render();
  }

  function loadPinIcons() {
    if (!map || !mapReady) return;
    var urls = {};
    D.locations.forEach(function (l) { var url = l.pinIconUrl || S.pinIconUrl; if (url) urls[url] = true; });
    Object.keys(urls).forEach(function (url) {
      if (loadedIcons[url] && map.hasImage(loadedIcons[url])) return;
      if (pendingIcons[url]) return;
      var generation = styleGeneration;
      pendingIcons[url] = true;
      map.loadImage(url).then(function (image) {
        if (!mapReady || generation !== styleGeneration || !map.getSource("pp")) return;
        var canvas = document.createElement("canvas"); canvas.width = 36; canvas.height = 36;
        var ctx = canvas.getContext("2d"); ctx.drawImage(image.data, 0, 0, 36, 36);
        var key = "pp-icon-" + (++iconSeq);
        map.addImage(key, ctx.getImageData(0, 0, 36, 36)); loadedIcons[url] = key; updateMapData();
      }).catch(function () { /* Keep the default circle if an icon cannot load. */ }).finally(function () { if (generation === styleGeneration) delete pendingIcons[url]; });
    });
  }
  function updateMapData() {
    if (map && mapReady && map.getSource("pp")) {
      var locations = filtered();
      map.getSource("pp").setData(fc(locations));
      var selected = locations.filter(function (l) { return l.id === state.selectedId; });
      if (map.getSource("pp-selected")) map.getSource("pp-selected").setData(fc(selected));
    }
  }
  function updateOrigin() {
    if (map && mapReady && map.getSource("pp-origin")) {
      map.getSource("pp-origin").setData(fc(state.origin ? [{ id: "origin", name: "", lat: state.origin.lat, lng: state.origin.lng }] : []));
    }
  }
  function recolor() {
    if (!mapReady) return;
    ["pp-clusters", "pp-selected"].forEach(function (id) {
      if (map.getLayer(id)) map.setPaintProperty(id, "circle-color", S.primaryColor);
    });
    updateMapData();
    loadPinIcons();
  }

  function fitTo(points, maxZoom) {
    if (!points.length) return;
    if (points.length === 1) {
      map.jumpTo({ center: [points[0].lng, points[0].lat], zoom: Math.min(maxZoom || 13, 13) }, TRACK);
      return;
    }
    var b = new maplibregl.LngLatBounds();
    points.forEach(function (p) { b.extend([p.lng, p.lat]); });
    map.fitBounds(b, { padding: 60, maxZoom: maxZoom || 14, duration: 600 }, TRACK);
  }

  // Moves tagged with this (or done by the visitor) update which stores the list shows.
  var TRACK = { ppTrack: true };
  var renderSoon = debounce(render, 80);
  function onMoveEnd(e) {
    if (e.originalEvent || e.ppTrack) {
      state.listArea = map.getBounds();
      renderSoon();
    }
  }

  function focusOrigin() {
    var list = filtered().map(function (l) { return { l: l, d: haversineKm(state.origin, l) }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 3).map(function (x) { return x.l; });
    // Show the searched place plus the nearest stores, but don't zoom out to another continent.
    var near = list.filter(function (l) { return haversineKm(state.origin, l) < 150; });
    fitTo([state.origin].concat(near), 13);
  }

  function initMap() {
    if (typeof maplibregl === "undefined") {
      $(".pp-map").innerHTML = '<p class="pp-map-error">The map failed to load.</p>';
      render();
      return;
    }
    // Right-to-left scripts (Urdu, Arabic, Persian, Hebrew) need this plugin, otherwise
    // their letters show up disconnected. "true" = only downloaded when such labels appear.
    try {
      if (maplibregl.getRTLTextPluginStatus && maplibregl.getRTLTextPluginStatus() === "unavailable") {
        var p = maplibregl.setRTLTextPlugin(
          "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js",
          true
        );
        if (p && p.catch) p.catch(function () { /* labels still render, just unjoined */ });
      }
    } catch (e) { /* already set */ }

    var fixed = S.initialView === "fixed" || !D.locations.length;
    map = new maplibregl.Map({
      container: "pp-map",
      style: styleFor(S.theme),
      center: [S.defaultLng, S.defaultLat],
      zoom: S.defaultZoom,
      attributionControl: { compact: true },
      cooperativeGestures: window.parent !== window && window.innerWidth < 700,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("style.load", addLayers);
    map.on("moveend", onMoveEnd);
    if (!fixed) fitTo(D.locations, 14);
    else map.once("load", function () { state.listArea = map.getBounds(); render(); });

    map.on("click", "pp-clusters", function (e) {
      var f = e.features[0];
      var src = map.getSource("pp");
      var p = src.getClusterExpansionZoom(f.properties.cluster_id);
      var go = function (z) { map.easeTo({ center: f.geometry.coordinates, zoom: z }, TRACK); };
      if (p && p.then) p.then(go);
      else src.getClusterExpansionZoom(f.properties.cluster_id, function (err, z) { if (!err) go(z); });
    });
    ["pp-points", "pp-icons"].forEach(function (layer) { map.on("click", layer, function (e) {
      var id = e.features[0].properties.id;
      var l = byId[id];
      if (popup) popup.remove();
      popup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: "260px" })
        .setLngLat([l.lng, l.lat])
        .setHTML('<strong class="pp-pop-name">' + esc(l.name) + '</strong><span class="pp-pop-addr">' +
          addressLines(l).map(esc).join("<br>") + "</span>" +
          (S.showDirections ? '<a class="pp-pop-dir" href="' + directionsUrl(l) + '" target="_blank" rel="noopener">Directions</a>' : ""))
        .addTo(map);
      popup.getElement().addEventListener("click", function (ev) {
        if (ev.target.closest(".pp-pop-dir")) track("directions", { locationId: id });
      });
      select(id, { scroll: true });
    }); });
    ["pp-clusters", "pp-points", "pp-icons"].forEach(function (layer) {
      map.on("mouseenter", layer, function () { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, function () { map.getCanvas().style.cursor = ""; });
    });
  }

  // ------------------------------------------------------------ search
  var input = $(".pp-input");
  var suggestEl = $(".pp-suggest");

  function renderSuggestions() {
    var items = state.suggestions;
    suggestEl.hidden = !items.length;
    input.setAttribute("aria-expanded", String(!!items.length));
    suggestEl.innerHTML = items.map(function (s, i) {
      return '<li role="option" id="pp-opt-' + i + '" aria-selected="' + (i === state.activeSuggestion) + '" data-i="' + i + '">' +
        '<span class="pp-sg-kind">' + (s.kind === "store" ? "Store" : "Place") + "</span>" + esc(s.label) + "</li>";
    }).join("");
  }

  function localMatches(q) {
    q = q.toLowerCase();
    return D.locations.filter(function (l) {
      return [l.name].concat(l.products || [], l.services || []).join(" ").toLowerCase().indexOf(q) !== -1;
    }).slice(0, 3).map(function (l) {
      return { kind: "store", id: l.id, label: l.name + (l.city ? ", " + l.city : "") };
    });
  }

  var searchSeq = 0;
  var fetchSuggestions = debounce(function (q) {
    var seq = ++searchSeq;
    var local = localMatches(q);
    if (q.length < 3) {
      state.suggestions = local;
      state.activeSuggestion = -1;
      renderSuggestions();
      return;
    }
    fetch(API + "/api/geocode?q=" + encodeURIComponent(q) + (S.language ? "&lang=" + S.language : ""))
      .then(function (r) { return r.ok ? r.json() : { results: [] }; })
      .then(function (data) {
        if (seq !== searchSeq) return;
        state.suggestions = local.concat((data.results || []).map(function (p) {
          return { kind: "place", label: p.label, lat: p.lat, lng: p.lng };
        }));
        state.activeSuggestion = -1;
        renderSuggestions();
      })
      .catch(function () { /* offline */ });
  }, 220);

  function choose(s) {
    state.suggestions = [];
    renderSuggestions();
    input.value = s.label;
    if (s.kind === "store") {
      track("search", { query: s.label, resultCount: 1 });
      setView("map");
      select(s.id, { fly: true, scroll: true });
      return;
    }
    track("search", { query: s.label + (state.product ? " / " + state.product : "") + (state.service ? " / " + state.service : ""), resultCount: filtered().filter(function (l) { return haversineKm(s, l) <= S.searchRadiusKm; }).length });
    state.origin = { lat: s.lat, lng: s.lng, label: s.label.split(",")[0] };
    state.selectedId = null;
    updateOrigin();
    if (map) focusOrigin();
    render();
  }

  input.addEventListener("input", function () {
    var q = input.value.trim();
    if (!q) {
      state.suggestions = [];
      renderSuggestions();
      if (state.origin) { state.origin = null; updateOrigin(); render(); }
      return;
    }
    fetchSuggestions(q);
  });
  input.addEventListener("keydown", function (e) {
    var n = state.suggestions.length;
    if (e.key === "ArrowDown" && n) { state.activeSuggestion = (state.activeSuggestion + 1) % n; renderSuggestions(); e.preventDefault(); }
    else if (e.key === "ArrowUp" && n) { state.activeSuggestion = (state.activeSuggestion - 1 + n) % n; renderSuggestions(); e.preventDefault(); }
    else if (e.key === "Escape") { state.suggestions = []; renderSuggestions(); }
    if (state.activeSuggestion >= 0) input.setAttribute("aria-activedescendant", "pp-opt-" + state.activeSuggestion);
    else input.removeAttribute("aria-activedescendant");
  });
  $(".pp-search").addEventListener("submit", function (e) {
    e.preventDefault();
    var s = state.suggestions[Math.max(0, state.activeSuggestion)];
    if (s) choose(s);
  });
  suggestEl.addEventListener("mousedown", function (e) {
    var li = e.target.closest("li[data-i]");
    if (li) { e.preventDefault(); choose(state.suggestions[+li.getAttribute("data-i")]); }
  });
  input.addEventListener("blur", function () {
    setTimeout(function () { state.suggestions = []; renderSuggestions(); }, 150);
  });

  // Is the page allowed to ask for location? Embedding pages must pass allow="geolocation"
  // down through every iframe level; the Shopify admin preview doesn't, for example.
  function geolocationAllowed() {
    if (!navigator.geolocation || !window.isSecureContext) return false;
    var policy = document.permissionsPolicy || document.featurePolicy;
    try {
      if (policy && policy.allowsFeature) return policy.allowsFeature("geolocation");
    } catch (e) { /* unknown: assume allowed */ }
    return true;
  }

  // Shows a message for a few seconds, then puts the normal "N locations" text back.
  var noticeTimer;
  function notice(msg) {
    var el = $(".pp-status");
    el.textContent = msg;
    el.classList.add("is-notice");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { el.classList.remove("is-notice"); render(); }, 6000);
  }

  function locateMe(silent) {
    if (!geolocationAllowed()) {
      if (!silent) {
        notice(D.preview
          ? "\"Use my location\" can't run inside this preview. It works on your live site."
          : "Location isn't available on this page. Search for your city or postcode instead.");
      }
      return;
    }
    var btn = $(".pp-locate");
    btn.classList.add("is-busy");
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.classList.remove("is-busy");
      state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "you" };
      input.value = "";
      updateOrigin();
      if (map) focusOrigin();
      render();
    }, function (err) {
      btn.classList.remove("is-busy");
      if (silent) return;
      if (err && err.code === 1) {
        notice("Location access is blocked. Allow it in your browser settings, or search instead.");
      } else if (err && err.code === 3) {
        notice("Finding your location took too long. Try again, or search instead.");
      } else {
        notice("Your device couldn't find your location. Check that location is turned on, or search instead.");
      }
    }, { timeout: 10000, maximumAge: 600000 });
  }
  $(".pp-locate").addEventListener("click", function () { locateMe(false); });

  // ------------------------------------------------------------ mobile tabs
  function setView(v) {
    state.view = v;
    $(".pp").setAttribute("data-view", v);
    document.querySelectorAll(".pp-tabs button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === v));
    });
    if (v === "map" && map) setTimeout(function () { map.resize(); }, 0);
  }
  $(".pp-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-view]");
    if (b) setView(b.getAttribute("data-view"));
  });

  // ------------------------------------------------------------ live preview (admin)
  window.addEventListener("message", function (e) {
    if (e.source !== window.parent || !e.data || e.data.type !== "findly:settings") return;
    var prev = S;
    S = Object.assign({}, S, e.data.settings);
    applyTheme();
    renderCategories();
    recolor();
    if (map && (prev.theme !== S.theme || prev.language !== S.language)) {
      if (themeFor(prev.theme).style !== themeFor(S.theme).style || prev.language !== S.language) {
        mapReady = false;
        map.setStyle(styleFor(S.theme), { diff: false });
      }
    }
    if (map && S.initialView === "fixed" &&
      (prev.defaultLat !== S.defaultLat || prev.defaultLng !== S.defaultLng || prev.defaultZoom !== S.defaultZoom)) {
      map.jumpTo({ center: [S.defaultLng, S.defaultLat], zoom: S.defaultZoom });
    }
    render();
  });

  ["product", "service"].forEach(function (kind) {
    var values = Object.create(null);
    D.locations.forEach(function (l) { (l[kind + "s"] || []).forEach(function (value) { values[value] = true; }); });
    var selectEl = $(".pp-" + kind);
    selectEl.parentElement.hidden = !Object.keys(values).length;
    selectEl.innerHTML += Object.keys(values).sort().map(function (value) { return '<option value="' + esc(value) + '">' + esc(value) + '</option>'; }).join("");
    selectEl.addEventListener("change", function () { state[kind] = selectEl.value; state.selectedId = null; updateMapData(); render(); });
  });
  // ------------------------------------------------------------ boot
  renderCategories();
  initMap();
  render();
  track("view");
  if (S.useVisitorLocation && !D.preview && navigator.permissions && navigator.permissions.query) {
    // Only auto-locate when permission was already granted, to avoid a prompt on page load.
    navigator.permissions.query({ name: "geolocation" }).then(function (p) {
      if (p.state === "granted") locateMe(true);
    }).catch(function () {});
  }
})();
