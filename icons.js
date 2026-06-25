"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var paths = {
    class_balanced: '<path d="M12 3l7 4v5c0 4.4-2.8 7.2-7 9-4.2-1.8-7-4.6-7-9V7l7-4z"/><path d="M12 7v10M8 12h8"/>',
    class_guardian: '<path d="M12 3l7 4v5c0 4.4-2.8 7.2-7 9-4.2-1.8-7-4.6-7-9V7l7-4z"/><path d="M8 13h8M9 9h6"/>',
    class_destroyer: '<path d="M12 3l7 7-7 11-7-11 7-7z"/><path d="M12 3l-2 7 4 2-3 9"/><path d="M7 10h4M13 14h4"/>',
    class_alchemist: '<path d="M9 3h6"/><path d="M10 3v5l-4 8a4 4 0 0 0 3.6 5h4.8A4 4 0 0 0 18 16l-4-8V3"/><path d="M8 15h8"/><path d="M10 18h4"/>',
    class_tuner: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><path d="M8 8l-2-2M16 8l2-2M8 16l-2 2M16 16l2 2"/>',

    item_paddle_expand: '<path d="M4 15h16"/><path d="M8 11l-4 4 4 4"/><path d="M16 11l4 4-4 4"/><path d="M9 8h6"/>',
    item_multiball: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><circle cx="12" cy="16" r="3"/>',
    item_slow_ball: '<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/><path d="M5 4l2 2M19 4l-2 2"/>',
    item_magnetic_paddle: '<path d="M5 18h14"/><path d="M8 15c2.5-2.8 5.5-2.8 8 0"/><circle cx="12" cy="7" r="3"/><path d="M12 10v4"/><path d="M8 11l-2 2M16 11l2 2"/>',
    item_laser_paddle: '<path d="M5 19h14"/><path d="M8 15l2-10"/><path d="M16 15L14 5"/><path d="M12 4v11"/>',
    item_bottom_barrier: '<path d="M4 18h16"/><path d="M6 15c3-2 9-2 12 0"/><circle cx="12" cy="9" r="3"/><path d="M9 6l-2-2M15 6l2-2"/>',

    mode_standard: '<path d="M5 5h14v14H5z"/><path d="M8 12h8M12 8v8"/>',
    mode_endless: '<path d="M7 9c2-3 5-3 7 0l3 4c2 3-1 6-4 3l-4-4c-3-3-6 0-4 3 2 3 5 3 7 0"/>',
    mode_one_life: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
    mode_no_items: '<path d="M12 3l8 5-8 5-8-5 8-5z"/><path d="M4 8v8l8 5 8-5V8"/><path d="M4 4l16 16"/>',
    mode_high_speed: '<path d="M4 14h7"/><path d="M4 10h10"/><path d="M13 5l6 7-6 7"/><path d="M10 12h9"/>',
    mode_daily: '<path d="M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M9 13h6M12 10v6"/>',
    mode_mirror: '<path d="M12 3v18"/><path d="M5 8l4 4-4 4"/><path d="M19 8l-4 4 4 4"/><path d="M8 5h8M8 19h8"/>',
    mode_overdrive: '<path d="M4 14h7"/><path d="M4 10h10"/><path d="M13 4l7 8-7 8"/><path d="M11 12h9"/><path d="M7 18l2-3"/>',
    mode_fracture: '<path d="M5 5h14v14H5z"/><path d="M9 5l-2 6 4 2-2 6"/><path d="M15 5l-2 5 4 3-3 6"/>',
    mode_tower: '<path d="M7 20h10"/><path d="M8 20V7l4-4 4 4v13"/><path d="M10 10h4M10 14h4"/><path d="M12 3v17"/>',
    mode_boss_rush: '<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z"/><path d="M8 11h8"/><path d="M9 15c2 2 4 2 6 0"/><path d="M9 8h.01M15 8h.01"/>',
    mutation_mist: '<path d="M4 9c3-4 13-4 16 0"/><path d="M3 14c4-3 14-3 18 0"/><path d="M6 18c3-2 9-2 12 0"/>',
    mutation_corridor: '<path d="M5 5h14v14H5z"/><path d="M8 8h8v8H8z"/><path d="M12 5v3M12 16v3"/>',
    mutation_rift: '<path d="M12 3l3 6 6 1-4.5 4 1.5 7-6-3.5L6 21l1.5-7L3 10l6-1 3-6z"/><path d="M12 8v8"/>',
    mutation_hollow: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M4 12h4M16 12h4"/>',
    mutation_fracture: '<path d="M5 5h14v14H5z"/><path d="M10 5l-2 5 4 3-3 6"/><path d="M16 5l-3 6 4 2-2 6"/>',
    emblem_default: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/>',
    mission_no_miss: '<path d="M12 3l7 4v5c0 4.4-2.8 7.2-7 9-4.2-1.8-7-4.6-7-9V7l7-4z"/><path d="M8 12l3 3 5-6"/>',
    weak_point: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    zone_corridor: '<path d="M5 5h14v14H5z"/><path d="M8 8h8v8H8z"/><path d="M5 12h3M16 12h3"/>',
    compendium: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M8 8h6M8 12h7M8 16h4"/>',
    cosmetic: '<path d="M5 17c2-5 4-8 7-8s5 3 7 8"/><circle cx="12" cy="8" r="3"/><path d="M7 19h10"/>',
    equipment: '<path d="M12 3l7 4v5c0 4.4-2.8 7.2-7 9-4.2-1.8-7-4.6-7-9V7l7-4z"/><path d="M8 13h8"/><circle cx="12" cy="10" r="2"/>',
    research: '<path d="M9 3h6"/><path d="M10 3v5l-4 8a4 4 0 0 0 3.6 5h4.8A4 4 0 0 0 18 16l-4-8V3"/><path d="M8 15h8"/><circle cx="12" cy="16" r="2"/>',
    core_default: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/>',
    core_split: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><circle cx="12" cy="16" r="3"/>',
    core_pierce: '<circle cx="12" cy="12" r="7"/><path d="M5 12h14"/><path d="M15 9l4 3-4 3"/>',
    core_blast: '<circle cx="12" cy="12" r="4"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M6 6l3 3M18 6l-3 3M6 18l3-3M18 18l-3-3"/>',
    core_precision: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    core_nature: '<path d="M12 3l6 7-6 11-6-11 6-7z"/><path d="M9 12h6"/><path d="M12 8v8"/>',
    board_default: '<path d="M4 16h16"/><path d="M7 12h10"/><path d="M9 8h6"/>',
    board_guardian: '<path d="M5 17h14"/><path d="M7 13h10"/><path d="M12 4l5 4v4H7V8l5-4z"/>',
    board_magnet: '<path d="M7 5v7a5 5 0 0 0 10 0V5"/><path d="M7 5h4M13 5h4"/><path d="M5 19h14"/>',
    board_laser: '<path d="M5 19h14"/><path d="M8 15l2-10"/><path d="M16 15L14 5"/><path d="M12 4v11"/>',
    board_tuning: '<circle cx="12" cy="10" r="5"/><path d="M5 19h14"/><path d="M12 15v4"/><path d="M9 10h6"/>',
    board_barrier: '<path d="M4 18h16"/><path d="M6 15c3-2 9-2 12 0"/><path d="M12 4l5 4v4H7V8l5-4z"/>',
    chip_attack: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"/><path d="M8 12h8M13 8l3 4-3 4"/>',
    chip_boss: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5"/>',
    chip_defense: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"/><path d="M12 8l4 2v3c0 2.4-1.6 4-4 5-2.4-1-4-2.6-4-5v-3l4-2z"/>',
    chip_item: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"/><path d="M8 10h8v8H8z"/><path d="M10 10V8h4v2"/>',
    chip_precision: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"/><path d="M12 7v10M7 12h10"/>',
    chip_gimmick: '<path d="M7 4h10l3 3v10l-3 3H7l-3-3V7l3-3z"/><path d="M8 12c2-4 6-4 8 0-2 4-6 4-8 0z"/>',

    currency_abyss_stone: '<path d="M12 3l6 7-6 11-6-11 6-7z"/><path d="M8 10h8"/><path d="M12 3v18"/>',
    achievement: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M12 12v5M8 20h8M6 6H4c0 3 1.5 5 4 5M18 6h2c0 3-1.5 5-4 5"/>',
    record: '<path d="M5 19V5M5 19h14M9 16v-5M13 16V8M17 16v-8"/>',
    settings: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M4.9 4.9L7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    locked: '<path d="M7 10V8a5 5 0 0 1 10 0v2"/><path d="M6 10h12v10H6z"/><path d="M12 14v2"/>',
    upgrade: '<path d="M12 4v16"/><path d="M6 10l6-6 6 6"/><path d="M7 20h10"/>',
    relic: '<path d="M12 3l6 7-6 11-6-11 6-7z"/><path d="M6 10h12"/><path d="M9 14h6"/>',
    life: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
    score: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 10c0-1.4 1.2-2 3-2s3 .6 3 2-1.2 2-3 2-3 .6-3 2 1.2 2 3 2 3-.6 3-2"/>',
    stage: '<path d="M5 20V4"/><path d="M5 5h11l-2 4 2 4H5"/><path d="M8 17h9"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    restart: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 5v5h5"/>',
    continue: '<path d="M8 5l11 7-11 7V5z"/>'
  };

  var aliases = {
    class: "class_balanced",
    mode: "mode_standard",
    item: "item_multiball",
    daily: "mode_daily"
  };

  function svg(id) {
    var key = paths[id] ? id : aliases[id] || "upgrade";
    return '<svg class="pictogram" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths[key] + "</svg>";
  }

  AbyssBreaker.Icons = { svg: svg };
})(typeof window !== "undefined" ? window : globalThis);
