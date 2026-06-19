"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var paths = {
    class: '<path d="M12 3l7 4v5c0 4.4-2.8 7.2-7 9-4.2-1.8-7-4.6-7-9V7l7-4z"/>',
    mode: '<path d="M5 5h14v14H5z"/><path d="M8 12h8M12 8v8"/>',
    relic: '<path d="M12 3l6 7-6 11-6-11 6-7z"/><path d="M6 10h12"/>',
    upgrade: '<path d="M12 4v16M6 10l6-6 6 6"/>',
    achievement: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M12 12v5M8 20h8M6 6H4c0 3 1.5 5 4 5M18 6h2c0 3-1.5 5-4 5"/>',
    record: '<path d="M5 19V5M5 19h14M9 16v-5M13 16V8M17 16v-8"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M12 2v3M12 19v3M4.9 4.9L7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    daily: '<path d="M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M9 13h6M12 10v6"/>',
    item: '<path d="M12 3l8 5-8 5-8-5 8-5z"/><path d="M4 8v8l8 5 8-5V8"/>',
    locked: '<path d="M7 10V8a5 5 0 0 1 10 0v2"/><path d="M6 10h12v10H6z"/>'
  };

  function svg(id) {
    var body = paths[id] || paths.item;
    return '<svg class="pictogram" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + "</svg>";
  }

  AbyssBreaker.Icons = { svg: svg };
})(typeof window !== "undefined" ? window : globalThis);
