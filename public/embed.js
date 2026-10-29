/*
 * Pinpoint embed script.
 *
 * Inline (renders where the script tag is, or into a target element):
 *   <div id="store-locator"></div>
 *   <script src="https://YOUR-APP/embed.js" data-locator="LOCATOR_ID" data-target="#store-locator" async></script>
 *
 * Overlay (opens full-screen from any link/button):
 *   <script src="https://YOUR-APP/embed.js" data-locator="LOCATOR_ID" data-mode="overlay" async></script>
 *   <a href="#store-locator">Find a store</a>   or   <button data-pinpoint-open>Find a store</button>
 *   Or open from JS: window.Pinpoint.open()
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var id = script.getAttribute("data-locator");
  if (!id) { console.warn("[Pinpoint] data-locator attribute is missing"); return; }
  var origin = new URL(script.src).origin;
  var mode = script.getAttribute("data-mode") || "inline";
  var height = script.getAttribute("data-height") || "640px";
  var src = origin + "/locator/" + encodeURIComponent(id);

  function makeFrame() {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = script.getAttribute("data-title") || "Store locator";
    f.setAttribute("allow", "geolocation");
    f.setAttribute("loading", "lazy");
    f.style.cssText = "width:100%;border:0;display:block;";
    return f;
  }

  // Forward widget analytics to Google Analytics / GTM on the host page.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== "pinpoint:event") return;
    var name = e.data.name, params = e.data.params || {};
    if (typeof window.gtag === "function") window.gtag("event", name, params);
    else if (Array.isArray(window.dataLayer)) {
      var o = { event: name };
      for (var k in params) o[k] = params[k];
      window.dataLayer.push(o);
    }
  });

  if (mode === "overlay") {
    var overlay, frame;
    function open() {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Store locator");
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:min(4vw,32px);";
        var box = document.createElement("div");
        box.style.cssText = "position:relative;width:100%;max-width:1200px;height:100%;max-height:820px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);";
        var close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Close store locator");
        close.innerHTML = "&times;";
        close.style.cssText = "position:absolute;top:8px;right:52px;z-index:2;width:36px;height:36px;border-radius:50%;border:0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:22px;line-height:1;cursor:pointer;";
        close.onclick = hide;
        frame = makeFrame();
        frame.removeAttribute("loading");
        frame.style.height = "100%";
        box.appendChild(frame);
        box.appendChild(close);
        overlay.appendChild(box);
        overlay.addEventListener("click", function (e) { if (e.target === overlay) hide(); });
        document.body.appendChild(overlay);
      }
      overlay.style.display = "flex";
      document.documentElement.style.overflow = "hidden";
    }
    function hide() {
      if (overlay) overlay.style.display = "none";
      document.documentElement.style.overflow = "";
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest('[data-pinpoint-open], a[href$="#store-locator"]');
      if (t) { e.preventDefault(); open(); }
    });
    window.Pinpoint = { open: open, close: hide };
    if (location.hash === "#store-locator") open();
    return;
  }

  var targetSel = script.getAttribute("data-target");
  var target = targetSel ? document.querySelector(targetSel) : null;
  var frame = makeFrame();
  frame.style.height = height;
  if (target) target.appendChild(frame);
  else script.parentNode.insertBefore(frame, script);
})();
