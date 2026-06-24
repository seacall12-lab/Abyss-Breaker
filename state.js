"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;

  if (!Data) {
    throw new Error("AbyssBreaker.Data must be loaded before state.js");
  }

  var currentState = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return !!value && Object.prototype.toString.call(value) === "[object Object]";
  }

  function finiteNumber(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function nonNegativeInt(value, fallback) {
    return Math.max(0, Math.floor(finiteNumber(value, fallback)));
  }

  function nonNegativeNumber(value, fallback) {
    return Math.max(0, finiteNumber(value, fallback));
  }

  function positiveInt(value, fallback) {
    return Math.max(1, Math.floor(finiteNumber(value, fallback)));
  }

  function clampInt(value, min, max, fallback) {
    return Math.max(min, Math.min(max, nonNegativeInt(value, fallback)));
  }

  function getStorage() {
    try {
      return global.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function createDefaultSave() {
    return clone(Data.STORAGE_DEFAULTS);
  }

  function sanitizeUnlockedClasses(value, defaults) {
    var result = clone(defaults.unlockedClasses);

    Object.keys(Data.CLASSES).forEach(function (classId) {
      result[classId] = isObject(value) && typeof value[classId] === "boolean" ? value[classId] : !!result[classId];
    });

    result.balanced = true;
    return result;
  }

  function sanitizeUnlockedModes(value, defaults, legacyRunClearCount) {
    var result = clone(defaults.unlockedModes);
    var legacyUnlocked = nonNegativeInt(legacyRunClearCount, 0) > 0;

    Data.GAME_MODE_ORDER.forEach(function (modeId) {
      result[modeId] = isObject(value) && typeof value[modeId] === "boolean" ? value[modeId] : !!result[modeId];
      if (modeId !== "standard" && legacyUnlocked) {
        result[modeId] = true;
      }
    });

    result.standard = true;
    return result;
  }

  function createUnlockDefaults(defaults) {
    var unlocks = clone(defaults.unlocks || {});
    unlocks.classes = unlocks.classes || {};
    unlocks.items = unlocks.items || {};
    unlocks.relics = unlocks.relics || {};
    unlocks.evolutions = unlocks.evolutions || {};
    unlocks.modes = unlocks.modes || {};
    return unlocks;
  }

  function sanitizeUnlockGroup(value, defaults, ids, forceUnlockedIds) {
    var result = clone(defaults || {});
    var forced = forceUnlockedIds || [];

    ids.forEach(function (id) {
      result[id] = isObject(value) && typeof value[id] === "boolean" ? value[id] : !!result[id];
    });

    forced.forEach(function (id) {
      result[id] = true;
    });

    return result;
  }

  function sanitizeUnlocks(value, defaults, unlockedClasses, unlockedModes, legacyRunClearCount) {
    var base = createUnlockDefaults(defaults);
    var result = createUnlockDefaults(defaults);
    var legacyCleared = nonNegativeInt(legacyRunClearCount, 0) > 0;
    var itemIds = Data.ITEMS.definitions.map(function (item) { return item.id; });
    var relicIds = Data.RELICS.map(function (relic) { return relic.id; });
    var evolutionIds = (Data.EVOLUTIONS || []).map(function (evolution) { return evolution.id; });

    result.classes = sanitizeUnlockGroup(isObject(value) ? value.classes : null, base.classes, Object.keys(Data.CLASSES), ["balanced"]);
    result.modes = sanitizeUnlockGroup(isObject(value) ? value.modes : null, base.modes, Data.GAME_MODE_ORDER, ["standard"]);
    result.items = sanitizeUnlockGroup(isObject(value) ? value.items : null, base.items, itemIds, ["paddle_expand", "multi_ball", "slow_ball", "magnetic_paddle", "laser_paddle", "bottom_barrier"]);
    result.relics = sanitizeUnlockGroup(isObject(value) ? value.relics : null, base.relics, relicIds, ["twin_core", "blast_insignia", "piercing_crystal", "collector_mark", "guardian_field", "boss_breaker", "acceleration_core", "focused_lens"]);
    result.evolutions = sanitizeUnlockGroup(isObject(value) ? value.evolutions : null, base.evolutions, evolutionIds, ["split_storm", "blast_chain", "piercing_nature", "last_focus", "aegis_guard", "item_bloom"]);

    Object.keys(unlockedClasses || {}).forEach(function (classId) {
      if (unlockedClasses[classId]) {
        result.classes[classId] = true;
      }
    });
    Object.keys(unlockedModes || {}).forEach(function (modeId) {
      if (unlockedModes[modeId]) {
        result.modes[modeId] = true;
      }
    });

    if (result.classes.alchemist) {
      result.relics.alchemist_star = true;
      result.evolutions.alchemy_bloom = true;
    }
    if (result.classes.tuner) {
      result.relics.mirror_shard = true;
      result.relics.precision_tuner = true;
      result.evolutions.perfect_tuning = true;
    }
    if (legacyCleared || result.modes.endless) {
      ["portal_resonator", "bumper_core", "giant_grip"].forEach(function (id) { result.relics[id] = true; });
      result.evolutions.dimensional_refraction = true;
      result.modes.daily = true;
    }
    if (result.items.bottom_barrier) {
      result.relics.void_safety_net = true;
      result.evolutions.abyss_rebirth = true;
    }
    if (result.items.laser_paddle) {
      result.relics.laser_amplifier = true;
    }

    result.classes.balanced = true;
    result.modes.standard = true;
    return result;
  }

  function syncClassUnlocks(save) {
    var target = isObject(save) ? save : {};
    var defaults = Data.STORAGE_DEFAULTS;
    var sourceUnlockedClasses = isObject(target.unlockedClasses) ? target.unlockedClasses : {};
    var unlockedClasses = {};
    var unlocks = isObject(target.unlocks) ? target.unlocks : createUnlockDefaults(defaults);
    var sourceUnlockClasses = isObject(unlocks.classes) ? unlocks.classes : {};

    unlocks.classes = {};

    Object.keys(Data.CLASSES).forEach(function (classId) {
      var unlocked = classId === "balanced" || !!sourceUnlockedClasses[classId] || !!sourceUnlockClasses[classId];
      unlockedClasses[classId] = unlocked;
      unlocks.classes[classId] = unlocked;
    });

    target.unlockedClasses = unlockedClasses;
    target.unlocks = unlocks;

    if (!Data.CLASSES[target.selectedClassId] || !unlockedClasses[target.selectedClassId]) {
      target.selectedClassId = "balanced";
    }

    return target;
  }

  function sanitizeTutorial(value, defaults) {
    return {
      completed: isObject(value) && typeof value.completed === "boolean" ? value.completed : !!defaults.tutorial.completed,
      skipped: isObject(value) && typeof value.skipped === "boolean" ? value.skipped : !!defaults.tutorial.skipped
    };
  }

  function sanitizeDailyChallenge(value) {
    var result = { lastDate: "", records: {}, rewards: {} };

    if (!isObject(value)) {
      return result;
    }

    result.lastDate = typeof value.lastDate === "string" ? value.lastDate : "";
    result.records = isObject(value.records) ? clone(value.records) : {};
    result.rewards = isObject(value.rewards) ? clone(value.rewards) : {};
    return result;
  }

  function sanitizeMetaUpgrades(value, defaults) {
    var result = clone(defaults.metaUpgrades);

    Data.META_UPGRADE_ORDER.forEach(function (upgradeId) {
      var upgrade = Data.META_UPGRADES[upgradeId];
      result[upgradeId] = clampInt(isObject(value) ? value[upgradeId] : undefined, 0, upgrade.maxLevel, defaults.metaUpgrades[upgradeId]);
    });

    return result;
  }

  function sanitizeAchievements(value) {
    var result = {};

    if (!isObject(value)) {
      return result;
    }

    Data.ACHIEVEMENTS.forEach(function (achievement) {
      var entry = value[achievement.id];
      if (isObject(entry) && entry.unlocked) {
        result[achievement.id] = {
          unlocked: true,
          rewardGranted: !!entry.rewardGranted || !!entry.claimed,
          unlockedAt: nonNegativeInt(entry.unlockedAt, Date.now())
        };
      }
    });

    return result;
  }

  function sanitizeModeRecord(value, defaults) {
    var result = clone(defaults);

    Object.keys(result).forEach(function (key) {
      if (typeof result[key] === "boolean") {
        result[key] = isObject(value) && typeof value[key] === "boolean" ? value[key] : result[key];
      } else {
        result[key] = nonNegativeNumber(isObject(value) ? value[key] : undefined, result[key]);
      }
    });

    return result;
  }

  function sanitizeRecords(value, defaults, legacy) {
    var result = clone(defaults);

    if (isObject(value)) {
      result.totalBricksDestroyed = nonNegativeInt(value.totalBricksDestroyed, result.totalBricksDestroyed);
      result.totalItemsCollected = nonNegativeInt(value.totalItemsCollected, result.totalItemsCollected);
      result.totalBossesDefeated = nonNegativeInt(value.totalBossesDefeated, result.totalBossesDefeated);
      result.maxActiveBalls = Math.max(1, nonNegativeInt(value.maxActiveBalls, result.maxActiveBalls));
      result.standard = sanitizeModeRecord(value.standard, defaults.standard);
      result.endless = sanitizeModeRecord(value.endless, defaults.endless);
      result.challenges = {};
      Object.keys(defaults.challenges).forEach(function (modeId) {
        result.challenges[modeId] = sanitizeModeRecord(isObject(value.challenges) ? value.challenges[modeId] : null, defaults.challenges[modeId]);
      });
      result.classes = {};
      Object.keys(defaults.classes).forEach(function (classId) {
        result.classes[classId] = sanitizeModeRecord(isObject(value.classes) ? value.classes[classId] : null, defaults.classes[classId]);
      });
      result.endgame = sanitizeModeRecord(value.endgame, defaults.endgame || {});
      result.builds = {};
      Object.keys(defaults.builds || {}).forEach(function (buildId) {
        result.builds[buildId] = sanitizeModeRecord(isObject(value.builds) ? value.builds[buildId] : null, defaults.builds[buildId]);
      });
    }

    result.standard.bestScore = Math.max(result.standard.bestScore, nonNegativeInt(legacy.bestScore, 0));
    result.standard.bestStage = Math.max(result.standard.bestStage, nonNegativeInt(legacy.highestStage, 1));
    result.standard.clearCount = Math.max(result.standard.clearCount, nonNegativeInt(legacy.runClearCount, 0));
    return result;
  }

  function sanitizeSettings(value, defaults) {
    var sound = isObject(value) && typeof value.sound === "boolean" ? value.sound : defaults.settings.sound;
    var vibration = isObject(value) && typeof value.vibration === "boolean" ? value.vibration : defaults.settings.vibration;
    if (isObject(value) && typeof value.soundEnabled === "boolean") {
      sound = value.soundEnabled;
    }
    if (isObject(value) && typeof value.vibrationEnabled === "boolean") {
      vibration = value.vibrationEnabled;
    }

    return {
      sound: sound,
      vibration: vibration,
      soundEnabled: sound,
      vibrationEnabled: vibration,
      reducedEffects: isObject(value) && typeof value.reducedEffects === "boolean" ? value.reducedEffects : defaults.settings.reducedEffects
    };
  }

  function sanitizeBooleanMap(value, ids, forceIds) {
    var result = {};
    var forced = forceIds || [];

    ids.forEach(function (id) {
      result[id] = isObject(value) && typeof value[id] === "boolean" ? value[id] : false;
    });
    forced.forEach(function (id) {
      result[id] = true;
    });
    return result;
  }

  function sanitizeMissions(value, defaults) {
    var completed = {};
    var total = 0;

    Object.keys(Data.STAGE_MISSIONS || {}).forEach(function (id) {
      completed[id] = !!(isObject(value) && isObject(value.completedMissionIds) && value.completedMissionIds[id]);
      if (completed[id]) {
        total++;
      }
    });

    return {
      completedMissionIds: completed,
      totalCompleted: Math.max(total, nonNegativeInt(isObject(value) ? value.totalCompleted : undefined, defaults.missions.totalCompleted)),
      bestMissionCountInRun: nonNegativeInt(isObject(value) ? value.bestMissionCountInRun : undefined, defaults.missions.bestMissionCountInRun)
    };
  }

  function sanitizeDiscovered(value, defaults) {
    var discovered = clone(defaults.discovered || {});

    Object.keys(discovered).forEach(function (group) {
      discovered[group] = isObject(value) && isObject(value[group]) ? clone(value[group]) : clone(discovered[group]);
    });

    discovered.upgrades = discovered.upgrades || {};
    discovered.relics = discovered.relics || {};
    discovered.evolutions = discovered.evolutions || {};
    discovered.items = discovered.items || {};
    discovered.bosses = discovered.bosses || {};
    discovered.zones = discovered.zones || {};
    discovered.cores = discovered.cores || {};
    discovered.boards = discovered.boards || {};
    discovered.chips = discovered.chips || {};

    Data.UPGRADES.forEach(function (upgrade) { discovered.upgrades[upgrade.id] = !!discovered.upgrades[upgrade.id]; });
    Data.RELICS.forEach(function (relic) { discovered.relics[relic.id] = !!discovered.relics[relic.id]; });
    Data.EVOLUTIONS.forEach(function (evolution) { discovered.evolutions[evolution.id] = !!discovered.evolutions[evolution.id]; });
    Data.ITEMS.definitions.forEach(function (item) { discovered.items[item.id] = !!discovered.items[item.id]; });
    Object.keys(Data.BOSSES).forEach(function (id) { discovered.bosses[id] = !!discovered.bosses[id]; });
    Object.keys(Data.ZONES).forEach(function (id) { discovered.zones[id] = !!discovered.zones[id]; });
    Object.keys(Data.BALL_CORES || {}).forEach(function (id) { discovered.cores[id] = !!discovered.cores[id]; });
    Object.keys(Data.BOARD_FRAMES || {}).forEach(function (id) { discovered.boards[id] = !!discovered.boards[id]; });
    Object.keys(Data.SKILL_CHIPS || {}).forEach(function (id) { discovered.chips[id] = !!discovered.chips[id]; });

    Data.UPGRADES.slice(0, 3).forEach(function (upgrade) { discovered.upgrades[upgrade.id] = true; });
    Data.ITEMS.definitions.forEach(function (item) { discovered.items[item.id] = true; });
    discovered.zones.gate = true;
    discovered.cores.default_ball_core = true;
    discovered.boards.default_board_frame = true;
    return discovered;
  }

  function sanitizeCosmetics(value, defaults) {
    var ballIds = Object.keys(Data.COSMETICS.ballSkins || {});
    var paddleIds = Object.keys(Data.COSMETICS.paddleSkins || {});
    var ballSkins = sanitizeBooleanMap(isObject(value) ? value.unlockedBallSkins : null, ballIds, ["default_ball"]);
    var paddleSkins = sanitizeBooleanMap(isObject(value) ? value.unlockedPaddleSkins : null, paddleIds, ["default_paddle"]);
    var selectedBall = isObject(value) && Data.COSMETICS.ballSkins[value.selectedBallSkinId] ? value.selectedBallSkinId : defaults.cosmetics.selectedBallSkinId;
    var selectedPaddle = isObject(value) && Data.COSMETICS.paddleSkins[value.selectedPaddleSkinId] ? value.selectedPaddleSkinId : defaults.cosmetics.selectedPaddleSkinId;

    if (!ballSkins[selectedBall]) {
      selectedBall = "default_ball";
    }
    if (!paddleSkins[selectedPaddle]) {
      selectedPaddle = "default_paddle";
    }

    return {
      unlockedBallSkins: ballSkins,
      unlockedPaddleSkins: paddleSkins,
      selectedBallSkinId: selectedBall,
      selectedPaddleSkinId: selectedPaddle
    };
  }

  function sanitizeEndgame(value, defaults, legacyRunClearCount) {
    var cleared = nonNegativeInt(legacyRunClearCount, 0) > 0;
    return {
      abyssTowerUnlocked: isObject(value) && typeof value.abyssTowerUnlocked === "boolean" ? value.abyssTowerUnlocked : cleared,
      bossRushUnlocked: isObject(value) && typeof value.bossRushUnlocked === "boolean" ? value.bossRushUnlocked : cleared,
      towerBestFloor: nonNegativeInt(isObject(value) ? value.towerBestFloor : undefined, defaults.endgame.towerBestFloor),
      bossRushBestStage: nonNegativeInt(isObject(value) ? value.bossRushBestStage : undefined, defaults.endgame.bossRushBestStage),
      bossRushBestTime: isObject(value) && typeof value.bossRushBestTime === "number" && isFinite(value.bossRushBestTime) ? Math.max(0, value.bossRushBestTime) : defaults.endgame.bossRushBestTime
    };
  }

  function sanitizeClassMastery(value, defaults) {
    var result = clone(defaults.classMastery || {});

    Object.keys(Data.CLASSES).forEach(function (classId) {
      var source = isObject(value) && isObject(value[classId]) ? value[classId] : {};
      result[classId] = {
        level: clampInt(source.level, 1, 10, result[classId] ? result[classId].level : 1),
        exp: nonNegativeInt(source.exp, result[classId] ? result[classId].exp : 0)
      };
    });

    return result;
  }

  function sanitizeMutations(value, defaults) {
    var result = { clearedCounts: {}, totalClears: 0 };

    Object.keys(Data.MUTATIONS || {}).forEach(function (id) {
      result.clearedCounts[id] = nonNegativeInt(isObject(value) && isObject(value.clearedCounts) ? value.clearedCounts[id] : undefined, defaults.mutations && defaults.mutations.clearedCounts ? defaults.mutations.clearedCounts[id] : 0);
      result.totalClears += result.clearedCounts[id];
    });
    result.totalClears = Math.max(result.totalClears, nonNegativeInt(isObject(value) ? value.totalClears : undefined, defaults.mutations ? defaults.mutations.totalClears : 0));
    return result;
  }

  function sanitizeBuildStats(value, defaults) {
    var result = clone(defaults.buildStats || { bestScores: {}, discoveredArchetypes: {} });

    Object.keys(Data.BUILD_ARCHETYPES || {}).forEach(function (id) {
      result.bestScores[id] = nonNegativeInt(isObject(value) && isObject(value.bestScores) ? value.bestScores[id] : undefined, result.bestScores[id] || 0);
      result.discoveredArchetypes[id] = !!(isObject(value) && isObject(value.discoveredArchetypes) && value.discoveredArchetypes[id]) || !!result.discoveredArchetypes[id];
    });

    return result;
  }

  function sanitizeEmblems(value, defaults) {
    var ids = Object.keys(Data.EMBLEMS || {});
    var unlocked = sanitizeBooleanMap(isObject(value) ? value.unlocked : null, ids, ["default_emblem"]);
    var selected = isObject(value) && Data.EMBLEMS[value.selectedEmblemId] ? value.selectedEmblemId : defaults.emblems.selectedEmblemId;

    if (!unlocked[selected]) {
      selected = "default_emblem";
    }

    return {
      unlocked: unlocked,
      selectedEmblemId: selected
    };
  }

  function getEquipmentMap(kind) {
    if (kind === "core") {
      return Data.BALL_CORES || {};
    }
    if (kind === "board") {
      return Data.BOARD_FRAMES || {};
    }
    return Data.SKILL_CHIPS || {};
  }

  function getEquipmentOrder(kind) {
    if (kind === "core") {
      return Data.BALL_CORE_ORDER || Object.keys(Data.BALL_CORES || {});
    }
    if (kind === "board") {
      return Data.BOARD_FRAME_ORDER || Object.keys(Data.BOARD_FRAMES || {});
    }
    return Data.SKILL_CHIP_ORDER || Object.keys(Data.SKILL_CHIPS || {});
  }

  function getEquipmentById(kind, id) {
    var map = getEquipmentMap(kind);
    return id && map[id] ? map[id] : null;
  }

  function sanitizeOwnedEquipment(value, kind, defaults) {
    var result = clone(defaults || {});
    var ids = getEquipmentOrder(kind);

    ids.forEach(function (id) {
      result[id] = nonNegativeInt(isObject(value) ? value[id] : undefined, result[id] || 0);
    });
    if (kind === "core") {
      result.default_ball_core = Math.max(1, result.default_ball_core || 0);
    } else if (kind === "board") {
      result.default_board_frame = Math.max(1, result.default_board_frame || 0);
    }
    return result;
  }

  function countOwned(owned, id) {
    return Math.max(0, Math.floor(owned && owned[id] || 0));
  }

  function sanitizeChipList(value, owned, allowedTypes, slotCount) {
    var result = [];
    var used = {};
    var max = Math.max(0, Math.floor(slotCount || 0));

    if (!Array.isArray(value) || max <= 0) {
      return result;
    }

    value.forEach(function (id) {
      var chip = getEquipmentById("chip", id);
      if (!chip || used[id] || result.length >= max || countOwned(owned, id) <= 0) {
        return;
      }
      if (allowedTypes && allowedTypes.indexOf(chip.chipType) === -1) {
        return;
      }
      used[id] = true;
      result.push(id);
    });
    return result;
  }

  function sanitizePreset(value, defaults, ownedCores, ownedBoards, ownedChips) {
    var source = isObject(value) ? value : {};
    var coreId = getEquipmentById("core", source.coreId) && countOwned(ownedCores, source.coreId) > 0 ? source.coreId : defaults.coreId;
    var boardId = getEquipmentById("board", source.boardId) && countOwned(ownedBoards, source.boardId) > 0 ? source.boardId : defaults.boardId;
    var core = getEquipmentById("core", coreId) || getEquipmentById("core", defaults.coreId);
    var board = getEquipmentById("board", boardId) || getEquipmentById("board", defaults.boardId);

    return {
      id: defaults.id,
      name: typeof source.name === "string" && source.name ? source.name : defaults.name,
      coreId: coreId,
      boardId: boardId,
      coreChipIds: sanitizeChipList(source.coreChipIds, ownedChips, Data.CORE_CHIP_TYPES || [], core ? core.slotCount : 0),
      boardChipIds: sanitizeChipList(source.boardChipIds, ownedChips, Data.BOARD_CHIP_TYPES || [], board ? board.slotCount : 0)
    };
  }

  function sanitizeEquipment(value, defaults) {
    var ownedCores = sanitizeOwnedEquipment(isObject(value) ? value.ownedCores : null, "core", defaults.equipment.ownedCores);
    var ownedBoards = sanitizeOwnedEquipment(isObject(value) ? value.ownedBoards : null, "board", defaults.equipment.ownedBoards);
    var ownedChips = sanitizeOwnedEquipment(isObject(value) ? value.ownedChips : null, "chip", defaults.equipment.ownedChips);
    var presets = {};
    var sourcePresets = isObject(value) && isObject(value.presets) ? value.presets : {};

    Object.keys(defaults.equipment.presets).forEach(function (id) {
      presets[id] = sanitizePreset(sourcePresets[id], defaults.equipment.presets[id], ownedCores, ownedBoards, ownedChips);
    });

    var selected = isObject(value) && presets[value.selectedPresetId] ? value.selectedPresetId : defaults.equipment.selectedPresetId;

    return {
      ownedCores: ownedCores,
      ownedBoards: ownedBoards,
      ownedChips: ownedChips,
      selectedPresetId: selected,
      presets: presets
    };
  }

  function sanitizePityGroup(value) {
    return {
      rare: nonNegativeInt(isObject(value) ? value.rare : undefined, 0),
      epic: nonNegativeInt(isObject(value) ? value.epic : undefined, 0),
      legendary: nonNegativeInt(isObject(value) ? value.legendary : undefined, 0)
    };
  }

  function sanitizeResearch(value, defaults) {
    var result = clone(defaults.research);
    var source = isObject(value) ? value : {};

    result.abyssFragments = nonNegativeInt(source.abyssFragments, result.abyssFragments);
    result.pity = {
      core: sanitizePityGroup(isObject(source.pity) ? source.pity.core : null),
      board: sanitizePityGroup(isObject(source.pity) ? source.pity.board : null),
      chip: sanitizePityGroup(isObject(source.pity) ? source.pity.chip : null)
    };
    result.totalPulls = {
      core: nonNegativeInt(isObject(source.totalPulls) ? source.totalPulls.core : undefined, 0),
      board: nonNegativeInt(isObject(source.totalPulls) ? source.totalPulls.board : undefined, 0),
      chip: nonNegativeInt(isObject(source.totalPulls) ? source.totalPulls.chip : undefined, 0)
    };
    result.lastResults = Array.isArray(source.lastResults) ? source.lastResults.filter(function (entry) {
      return isObject(entry) && getEquipmentById(entry.kind, entry.id);
    }).slice(0, 10) : [];
    return result;
  }

  function sanitizeAccessibility(value, defaults) {
    var source = isObject(value) ? value : {};
    var settingsSource = isObject(source) ? source : {};

    function oneOf(v, list, fallback) {
      return list.indexOf(v) !== -1 ? v : fallback;
    }

    return {
      ballSize: oneOf(settingsSource.ballSize, ["small", "default", "large"], defaults.accessibility.ballSize),
      paddleSize: oneOf(settingsSource.paddleSize, ["default", "wide", "extra_wide"], defaults.accessibility.paddleSize),
      touchSensitivity: oneOf(settingsSource.touchSensitivity, ["low", "default", "high"], defaults.accessibility.touchSensitivity),
      highContrast: typeof settingsSource.highContrast === "boolean" ? settingsSource.highContrast : defaults.accessibility.highContrast,
      reducedEffects: typeof settingsSource.reducedEffects === "boolean" ? settingsSource.reducedEffects : defaults.accessibility.reducedEffects,
      screenShake: typeof settingsSource.screenShake === "boolean" ? settingsSource.screenShake : defaults.accessibility.screenShake
    };
  }

  function sanitizeUpgradeLevels(value) {
    var result = createUpgradeLevels();

    if (!isObject(value)) {
      return result;
    }

    Data.UPGRADES.forEach(function (upgrade) {
      result[upgrade.id] = clampInt(value[upgrade.id], 0, upgrade.maxLevel, 0);
    });

    return result;
  }

  function sanitizeIdList(value, exists, unique) {
    var result = [];

    if (!Array.isArray(value)) {
      return result;
    }

    value.forEach(function (id) {
      if (typeof id !== "string" || !exists(id)) {
        return;
      }
      if (unique && result.indexOf(id) !== -1) {
        return;
      }
      result.push(id);
    });

    return result;
  }

  function upgradeExists(id) {
    return Data.UPGRADES.some(function (upgrade) {
      return upgrade.id === id;
    });
  }

  function relicExists(id) {
    return Data.RELICS.some(function (relic) {
      return relic.id === id;
    });
  }

  function sanitizeRunStats(value) {
    var defaults = {
      bricksDestroyed: 0,
      itemsCollected: 0,
      bossesDefeated: 0,
      maxActiveBalls: 1,
      livesLost: 0,
      upgradesSelected: 0,
      relicsSelected: 0,
      buildScores: {}
    };
    var result = clone(defaults);

    if (!isObject(value)) {
      return result;
    }

    Object.keys(defaults).forEach(function (key) {
      if (key === "buildScores") {
        result.buildScores = {};
        Object.keys(Data.BUILD_ARCHETYPES || {}).forEach(function (buildId) {
          result.buildScores[buildId] = nonNegativeInt(isObject(value.buildScores) ? value.buildScores[buildId] : undefined, 0);
        });
      } else {
        result[key] = key === "maxActiveBalls" ? Math.max(1, nonNegativeInt(value[key], defaults[key])) : nonNegativeInt(value[key], defaults[key]);
      }
    });

    return result;
  }

  function sanitizeRelicCounters(value) {
    return {
      bricksDestroyed: nonNegativeInt(isObject(value) ? value.bricksDestroyed : undefined, 0)
    };
  }

  function sanitizeEvolutionMap(value) {
    var result = {};

    if (!isObject(value)) {
      return result;
    }

    (Data.EVOLUTIONS || []).forEach(function (evolution) {
      if (value[evolution.id]) {
        result[evolution.id] = true;
      }
    });

    return result;
  }

  function sanitizeEvolutionCounters(value) {
    return {
      itemsCollected: nonNegativeInt(isObject(value) ? value.itemsCollected : undefined, 0),
      chainedExplosionsThisFrame: 0,
      precisionPrimed: nonNegativeInt(isObject(value) ? value.precisionPrimed : undefined, 0),
      precisionScore: nonNegativeNumber(isObject(value) ? value.precisionScore : undefined, 1),
      portalPrimed: nonNegativeInt(isObject(value) ? value.portalPrimed : undefined, 0),
      portalScore: nonNegativeNumber(isObject(value) ? value.portalScore : undefined, 1),
      bumperDamageStacks: clampInt(isObject(value) ? value.bumperDamageStacks : undefined, 0, 3, 0),
      dailyRewardStage5: !!(isObject(value) && value.dailyRewardStage5),
      dailyRewardClear: !!(isObject(value) && value.dailyRewardClear)
    };
  }

  function sanitizeActiveRun(value, save) {
    if (!isObject(value)) {
      return null;
    }

    var phase = typeof value.phase === "string" ? value.phase : "";
    var validPhases = [Data.MODES.READY, Data.MODES.UPGRADE, Data.MODES.RELIC];

    if (validPhases.indexOf(phase) === -1) {
      return null;
    }

    var selectedClassId = typeof value.selectedClassId === "string" && Data.CLASSES[value.selectedClassId] ? value.selectedClassId : null;
    var gameModeId = typeof value.gameModeId === "string" && Data.GAME_MODES[value.gameModeId] ? value.gameModeId : null;

    if (!selectedClassId || !gameModeId) {
      return null;
    }

    var stage = positiveInt(value.stage, 1);
    var rules = Data.GAME_MODES[gameModeId].rules || {};
    var finalStage = rules.finalStage || Data.GAME.finalStage;

    if (!rules.endless && stage > finalStage) {
      return null;
    }

    var maxLives = positiveInt(value.maxLives, Data.GAME.maxLives);
    var lives = clampInt(value.lives, 0, maxLives, Data.GAME.startingLives);
    var score = nonNegativeInt(value.score, 0);
    var upgradeLevels = sanitizeUpgradeLevels(value.upgradeLevels);
    var chosenUpgrades = Array.isArray(value.chosenUpgrades) ? value.chosenUpgrades.filter(function (entry) {
      return typeof entry === "string";
    }).slice(0, 64) : [];
    var pendingUpgradeIds = sanitizeIdList(value.pendingUpgradeIds, upgradeExists, true);
    var selectedRelicIds = sanitizeIdList(value.selectedRelicIds, relicExists, true);
    var pendingRelicIds = sanitizeIdList(value.pendingRelicIds, relicExists, true);
    var relicLimit = rules.relicLimit || 1;

    if (selectedRelicIds.length > relicLimit) {
      return null;
    }

    if (phase === Data.MODES.UPGRADE && !pendingUpgradeIds.length) {
      return null;
    }

    if (phase === Data.MODES.RELIC && !pendingRelicIds.length) {
      return null;
    }

    return {
      checkpointVersion: 1,
      phase: phase,
      stage: stage,
      score: score,
      lives: lives,
      maxLives: maxLives,
      selectedClassId: selectedClassId,
      gameModeId: gameModeId,
      upgradeLevels: upgradeLevels,
      chosenUpgrades: chosenUpgrades,
      pendingUpgradeIds: pendingUpgradeIds,
      selectedRelicIds: selectedRelicIds,
      pendingRelicIds: pendingRelicIds,
      activeEvolutions: sanitizeEvolutionMap(value.activeEvolutions),
      evolutionCounters: sanitizeEvolutionCounters(value.evolutionCounters),
      runModifiers: isObject(value.runModifiers) ? clone(value.runModifiers) : {},
      rng: isObject(value.rng) ? { seed: nonNegativeInt(value.rng.seed, 0), state: nonNegativeInt(value.rng.state, 0), dailyDate: typeof value.rng.dailyDate === "string" ? value.rng.dailyDate : "" } : null,
      zoneId: typeof value.zoneId === "string" && Data.ZONES && Data.ZONES[value.zoneId] ? value.zoneId : null,
      relicCounters: sanitizeRelicCounters(value.relicCounters),
      runStats: sanitizeRunStats(value.runStats),
      currentStageMission: isObject(value.currentStageMission) ? clone(value.currentStageMission) : null,
      stageMissionProgress: isObject(value.stageMissionProgress) ? clone(value.stageMissionProgress) : {},
      completedStageMissions: isObject(value.completedStageMissions) ? clone(value.completedStageMissions) : {},
      failedStageMissions: isObject(value.failedStageMissions) ? clone(value.failedStageMissions) : {},
      runSummary: isObject(value.runSummary) ? clone(value.runSummary) : null,
      endgameMode: typeof value.endgameMode === "string" ? value.endgameMode : "",
      activeMutationIds: Array.isArray(value.activeMutationIds) ? value.activeMutationIds.filter(function (id) { return Data.MUTATIONS && Data.MUTATIONS[id]; }).slice(0, 2) : [],
      buildScores: isObject(value.buildScores) ? clone(value.buildScores) : {},
      appliedCoreId: getEquipmentById("core", value.appliedCoreId) ? value.appliedCoreId : null,
      appliedBoardId: getEquipmentById("board", value.appliedBoardId) ? value.appliedBoardId : null,
      appliedCoreChipIds: sanitizeChipList(value.appliedCoreChipIds, save.equipment && save.equipment.ownedChips, Data.CORE_CHIP_TYPES || [], 3),
      appliedBoardChipIds: sanitizeChipList(value.appliedBoardChipIds, save.equipment && save.equipment.ownedChips, Data.BOARD_CHIP_TYPES || [], 3),
      accessibilitySnapshot: sanitizeAccessibility(value.accessibilitySnapshot, Data.STORAGE_DEFAULTS),
      selectedBallSkinId: save.cosmetics ? save.cosmetics.selectedBallSkinId : "default_ball",
      selectedPaddleSkinId: save.cosmetics ? save.cosmetics.selectedPaddleSkinId : "default_paddle",
      highestStageReached: Math.max(stage, positiveInt(value.highestStageReached, stage)),
      bossesDefeated: nonNegativeInt(value.bossesDefeated, 0),
      runElapsedTime: nonNegativeNumber(value.runElapsedTime, 0)
    };
  }

  function sanitizeSave(value) {
    var defaults = createDefaultSave();

    if (!isObject(value)) {
      return defaults;
    }

    var legacy = {
      bestScore: nonNegativeInt(value.bestScore, defaults.bestScore),
      highestStage: Math.max(1, nonNegativeInt(value.highestStage, defaults.highestStage)),
      runClearCount: nonNegativeInt(value.runClearCount, defaults.runClearCount)
    };
    var unlockedClasses = sanitizeUnlockedClasses(value.unlockedClasses, defaults);
    var unlockedModes = sanitizeUnlockedModes(value.unlockedModes, defaults, legacy.runClearCount);
    var unlocks = sanitizeUnlocks(value.unlocks, defaults, unlockedClasses, unlockedModes, legacy.runClearCount);

    Object.keys(unlocks.classes).forEach(function (classId) {
      if (unlocks.classes[classId]) {
        unlockedClasses[classId] = true;
      }
    });
    Object.keys(unlocks.modes).forEach(function (modeId) {
      if (unlocks.modes[modeId]) {
        unlockedModes[modeId] = true;
      }
    });

    var classSync = syncClassUnlocks({ unlockedClasses: unlockedClasses, unlocks: unlocks, selectedClassId: value.selectedClassId });
    unlockedClasses = classSync.unlockedClasses;
    unlocks = classSync.unlocks;

    var selectedClassId = typeof value.selectedClassId === "string" && Data.CLASSES[value.selectedClassId] ? value.selectedClassId : defaults.selectedClassId;
    var selectedGameModeId = typeof value.selectedGameModeId === "string" && Data.GAME_MODES[value.selectedGameModeId] ? value.selectedGameModeId : defaults.selectedGameModeId;

    if (!unlockedClasses[selectedClassId]) {
      selectedClassId = "balanced";
    }

    if (!unlockedModes[selectedGameModeId]) {
      selectedGameModeId = "standard";
    }

    var clean = {
      schemaVersion: Data.SAVE_SCHEMA_VERSION,
      bestScore: legacy.bestScore,
      highestStage: legacy.highestStage,
      runClearCount: legacy.runClearCount,
      totalRuns: nonNegativeInt(value.totalRuns, defaults.totalRuns),
      abyssStones: nonNegativeInt(value.abyssStones, defaults.abyssStones),
      totalAbyssStonesEarned: nonNegativeInt(value.totalAbyssStonesEarned, defaults.totalAbyssStonesEarned),
      selectedClassId: selectedClassId,
      selectedGameModeId: selectedGameModeId,
      unlockedClasses: unlockedClasses,
      unlockedModes: unlockedModes,
      unlocks: unlocks,
      metaUpgrades: sanitizeMetaUpgrades(value.metaUpgrades, defaults),
      achievements: sanitizeAchievements(value.achievements),
      records: sanitizeRecords(value.records, defaults.records, legacy),
      missions: sanitizeMissions(value.missions, defaults),
      discovered: sanitizeDiscovered(value.discovered, defaults),
      cosmetics: sanitizeCosmetics(value.cosmetics, defaults),
      endgame: sanitizeEndgame(value.endgame, defaults, legacy.runClearCount),
      classMastery: sanitizeClassMastery(value.classMastery, defaults),
      mutations: sanitizeMutations(value.mutations, defaults),
      buildStats: sanitizeBuildStats(value.buildStats, defaults),
      emblems: sanitizeEmblems(value.emblems, defaults),
      equipment: sanitizeEquipment(value.equipment, defaults),
      research: sanitizeResearch(value.research, defaults),
      accessibility: sanitizeAccessibility(isObject(value.accessibility) ? value.accessibility : value.settings, defaults),
      settings: sanitizeSettings(value.settings, defaults),
      tutorial: sanitizeTutorial(value.tutorial, defaults),
      dailyChallenge: sanitizeDailyChallenge(value.dailyChallenge),
      uiPreferences: isObject(value.uiPreferences) ? { pictograms: value.uiPreferences.pictograms !== false } : clone(defaults.uiPreferences),
      activeRun: null
    };

    clean.activeRun = sanitizeActiveRun(value.activeRun, clean);
    return clean;
  }

  function loadSave() {
    var storage = getStorage();
    var defaults = createDefaultSave();

    if (!storage) {
      return defaults;
    }

    try {
      var raw = storage.getItem(Data.SAVE_KEY);
      var fromCurrentKey = !!raw;

      raw = raw ||
        storage.getItem("abyssBreaker.save.v7") ||
        storage.getItem("abyssBreaker.save.v6") ||
        storage.getItem("abyssBreaker.save.v5") ||
        storage.getItem("abyssBreaker.save.v4") ||
        storage.getItem("abyssBreaker.save.v3") ||
        storage.getItem("abyssBreaker.save.v2") ||
        storage.getItem("abyssBreaker.save.v1");

      if (!raw) {
        return defaults;
      }

      var clean = sanitizeSave(JSON.parse(raw));
      if (!fromCurrentKey) {
        storage.setItem(Data.SAVE_KEY, JSON.stringify(clean));
      }
      return clean;
    } catch (error) {
      return defaults;
    }
  }

  function savePersistent(saveData) {
    var clean = sanitizeSave(saveData);
    var storage = getStorage();

    if (storage) {
      try {
        storage.setItem(Data.SAVE_KEY, JSON.stringify(clean));
      } catch (error) {
        return clean;
      }
    }

    return clean;
  }

  function createUpgradeLevels() {
    var levels = {};

    Data.UPGRADES.forEach(function (upgrade) {
      levels[upgrade.id] = 0;
    });

    return levels;
  }

  function createPaddle(width, height) {
    var baseWidth = Math.min(Data.PADDLE.width, width * 0.42);
    var bottomOffset = Math.max(
      Data.PADDLE.minBottomOffset || Data.PADDLE.yOffset,
      Math.min(Data.PADDLE.maxBottomOffset || Data.PADDLE.yOffset, height * (Data.PADDLE.bottomOffsetRatio || 0))
    );

    return {
      x: (width - baseWidth) / 2,
      y: height - bottomOffset,
      width: baseWidth,
      baseWidth: baseWidth,
      baseWidthBeforeUpgrades: baseWidth,
      height: Data.PADDLE.height,
      targetX: width / 2,
      speed: 0,
      expandTimeRemaining: 0
    };
  }

  function createBall(id, x, y, attached, pierceRemaining) {
    return {
      id: id,
      x: x,
      y: y,
      prevX: x,
      prevY: y,
      vx: 0,
      vy: 0,
      radius: Data.BALL.radius,
      active: true,
      attached: !!attached,
      pierceRemaining: Math.max(0, pierceRemaining || 0),
      speedMultiplier: 1,
      collisionCooldowns: {}
    };
  }

  function createAttachedBall(id, paddle, pierceRemaining, offsetX) {
    var x = paddle.x + paddle.width / 2 + (offsetX || 0);
    var y = paddle.y - Data.BALL.radius - 1;
    return createBall(id, x, y, true, pierceRemaining || 0);
  }

  function createRunState(saveData) {
    var persistent = sanitizeSave(saveData || loadSave());
    var width = Data.CANVAS.designWidth;
    var height = Data.CANVAS.designHeight;
    var paddle = createPaddle(width, height);

    return {
      version: Data.VERSION,
      mode: Data.MODES.BOOT,
      previousMode: null,
      stage: Data.GAME.startingStage,
      score: 0,
      bestScore: persistent.bestScore,
      lives: Data.GAME.startingLives,
      maxLives: Data.GAME.maxLives,
      persistent: persistent,
      selectedClassId: persistent.selectedClassId,
      gameModeId: persistent.selectedGameModeId,
      gameModeRules: clone(Data.GAME_MODES[persistent.selectedGameModeId].rules),
      runStartedAt: 0,
      runElapsedTime: 0,
      runStats: {
        bricksDestroyed: 0,
        itemsCollected: 0,
        bossesDefeated: 0,
        maxActiveBalls: 1,
        livesLost: 0,
        upgradesSelected: 0,
        relicsSelected: 0,
        missionCompleted: 0,
        bestCombo: 0,
        laserBreaks: 0,
        weakHits: 0,
        precisionHits: 0,
        explosionChains: 0,
        bottomBarrierSaves: 0
      },
      highestStageReached: Data.GAME.startingStage,
      bossesDefeated: 0,
      earnedAbyssStones: 0,
      selectedRelicId: null,
      selectedRelicIds: [],
      relicChoices: [],
      zoneId: null,
      gimmicks: [],
      gimmickEffects: [],
      gimmickTimers: {},
      activeEvolutions: {},
      evolutionCounters: {
        itemsCollected: 0,
        chainedExplosionsThisFrame: 0,
        precisionPrimed: 0,
        precisionScore: 1,
        portalPrimed: 0,
        portalScore: 1,
        bumperDamageStacks: 0,
        dailyRewardStage5: false,
        dailyRewardClear: false
      },
      evolutionStageFlags: {},
      runModifiers: {},
      endgameMode: "",
      activeMutationIds: [],
      buildScores: {},
      currentStageMission: null,
      stageMissionProgress: {},
      completedStageMissions: {},
      failedStageMissions: {},
      runSummary: null,
      appliedEquipment: null,
      equipmentStageFlags: {},
      accessibilitySnapshot: clone(persistent.accessibility || Data.STORAGE_DEFAULTS.accessibility),
      selectedBallSkinId: persistent.cosmetics ? persistent.cosmetics.selectedBallSkinId : "default_ball",
      selectedPaddleSkinId: persistent.cosmetics ? persistent.cosmetics.selectedPaddleSkinId : "default_paddle",
      selectedEmblemId: persistent.emblems ? persistent.emblems.selectedEmblemId : "default_emblem",
      rng: null,
      tutorial: {
        active: false,
        step: 0
      },
      relicCounters: {
        bricksDestroyed: 0
      },
      stageRelicFlags: {
        guardianSaved: false
      },
      unlockedAchievementIds: [],
      viewport: {
        cssWidth: width,
        cssHeight: height,
        pixelWidth: width,
        pixelHeight: height,
        devicePixelRatio: 1
      },
      time: {
        elapsed: 0,
        delta: 0,
        frame: 0
      },
      paddle: paddle,
      balls: [createAttachedBall(1, paddle, 0, 0)],
      bricks: [],
      items: [],
      particles: [],
      effects: [],
      floatingTexts: [],
      timers: {},
      activeEffects: {
        slowBallTimeRemaining: 0,
        magneticPaddleTimeRemaining: 0,
        laserPaddleTimeRemaining: 0,
        laserCooldown: 0,
        bottomBarrierTimeRemaining: 0,
        bottomBarrierDurability: 0
      },
      upgrades: {
        levels: createUpgradeLevels(),
        pending: [],
        selectionLocked: false,
        chosen: []
      },
      boss: null,
      bossTimers: {
        spawn: 0,
        shield: 0
      },
      bossPhase: 0,
      input: {
        pointerActive: false,
        pointerId: null,
        pointerStartX: 0,
        pointerStartY: 0,
        pointerMoved: false
      },
      counters: {
        nextBallId: 2,
        nextBrickId: 1,
        nextItemId: 1
      },
      flags: {
        initialized: false,
        loopStarted: false,
        stageClearHandled: false,
        lifeLostHandled: false,
        gameoverHandled: false,
        runClearHandled: false,
        bossRewardGranted: false,
        runRewardGranted: false,
        runStarted: false,
        needsResize: true,
        needsHudUpdate: true
      }
    };
  }

  function setCurrentState(state) {
    currentState = state;
    State.current = state;
    return state;
  }

  function initRun() {
    var state = createRunState(loadSave());
    state.mode = Data.MODES.LOBBY;
    return setCurrentState(state);
  }

  function restartRun() {
    var persistent = currentState ? currentState.persistent : loadSave();
    var state = createRunState(persistent);
    state.mode = Data.MODES.LOBBY;
    return setCurrentState(state);
  }

  function getRunState() {
    return currentState || initRun();
  }

  function isValidMode(mode) {
    return Object.keys(Data.MODES).some(function (key) {
      return Data.MODES[key] === mode;
    });
  }

  function setMode(mode) {
    var state = getRunState();

    if (!isValidMode(mode)) {
      throw new Error("Unknown game mode: " + mode);
    }

    state.previousMode = state.mode;
    state.mode = mode;
    state.flags.needsHudUpdate = true;
    return mode;
  }

  function replacePersistent(nextPersistent) {
    var state = getRunState();
    state.persistent = savePersistent(nextPersistent);
    state.bestScore = state.persistent.bestScore;
    state.selectedClassId = state.persistent.selectedClassId;
    state.gameModeId = state.persistent.selectedGameModeId;
    state.gameModeRules = clone(Data.GAME_MODES[state.gameModeId].rules);
    state.flags.needsHudUpdate = true;
    return state.persistent;
  }

  function saveActiveRun(runState, phase) {
    var state = runState || getRunState();
    var save = state.persistent || loadSave();
    var selectedRelicIds = Array.isArray(state.selectedRelicIds) ? state.selectedRelicIds.slice() : [];
    var pendingUpgradeIds = state.upgrades && Array.isArray(state.upgrades.pending) ? state.upgrades.pending.map(function (upgrade) {
      return upgrade.id;
    }) : [];
    var pendingRelicIds = Array.isArray(state.relicChoices) ? state.relicChoices.map(function (relic) {
      return relic.id;
    }) : [];

    save.activeRun = {
      checkpointVersion: 1,
      phase: phase || state.mode,
      stage: state.stage,
      score: state.score,
      lives: state.lives,
      maxLives: state.maxLives,
      selectedClassId: state.selectedClassId,
      gameModeId: state.gameModeId,
      upgradeLevels: clone(state.upgrades && state.upgrades.levels ? state.upgrades.levels : {}),
      chosenUpgrades: clone(state.upgrades && state.upgrades.chosen ? state.upgrades.chosen : []),
      pendingUpgradeIds: pendingUpgradeIds,
      selectedRelicIds: selectedRelicIds,
      pendingRelicIds: pendingRelicIds,
      activeEvolutions: clone(state.activeEvolutions || {}),
      evolutionCounters: clone(state.evolutionCounters || {}),
      runModifiers: clone(state.runModifiers || {}),
      rng: state.rng ? clone(state.rng) : null,
      zoneId: state.zoneId || null,
      relicCounters: clone(state.relicCounters || {}),
      runStats: clone(state.runStats || {}),
      currentStageMission: clone(state.currentStageMission || null),
      stageMissionProgress: clone(state.stageMissionProgress || {}),
      completedStageMissions: clone(state.completedStageMissions || {}),
      failedStageMissions: clone(state.failedStageMissions || {}),
      runSummary: clone(state.runSummary || null),
      endgameMode: state.endgameMode || "",
      activeMutationIds: Array.isArray(state.activeMutationIds) ? state.activeMutationIds.slice(0, 2) : [],
      buildScores: clone(state.buildScores || {}),
      appliedCoreId: state.appliedEquipment ? state.appliedEquipment.coreId : null,
      appliedBoardId: state.appliedEquipment ? state.appliedEquipment.boardId : null,
      appliedCoreChipIds: state.appliedEquipment && Array.isArray(state.appliedEquipment.coreChipIds) ? state.appliedEquipment.coreChipIds.slice() : [],
      appliedBoardChipIds: state.appliedEquipment && Array.isArray(state.appliedEquipment.boardChipIds) ? state.appliedEquipment.boardChipIds.slice() : [],
      accessibilitySnapshot: clone(state.accessibilitySnapshot || (save.accessibility || Data.STORAGE_DEFAULTS.accessibility)),
      selectedBallSkinId: state.selectedBallSkinId || (save.cosmetics && save.cosmetics.selectedBallSkinId) || "default_ball",
      selectedPaddleSkinId: state.selectedPaddleSkinId || (save.cosmetics && save.cosmetics.selectedPaddleSkinId) || "default_paddle",
      highestStageReached: state.highestStageReached,
      bossesDefeated: state.bossesDefeated,
      runElapsedTime: state.runElapsedTime
    };

    state.persistent = savePersistent(save);
    return state.persistent.activeRun;
  }

  function clearActiveRun() {
    var state = getRunState();

    if (!state.persistent || !state.persistent.activeRun) {
      return false;
    }

    state.persistent.activeRun = null;
    state.persistent = savePersistent(state.persistent);
    return true;
  }

  function updateBestScore(score) {
    var state = getRunState();
    var nextBest = nonNegativeInt(score, state.persistent.bestScore);

    if (nextBest > state.persistent.bestScore) {
      state.persistent.bestScore = nextBest;
      state.bestScore = nextBest;
      replacePersistent(state.persistent);
    }

    return state.persistent.bestScore;
  }

  function updateHighestStage(stage) {
    var state = getRunState();
    var nextStage = Math.max(1, nonNegativeInt(stage, state.persistent.highestStage));

    if (nextStage > state.persistent.highestStage) {
      state.persistent.highestStage = nextStage;
      replacePersistent(state.persistent);
    }

    return state.persistent.highestStage;
  }

  function addAbyssStones(amount) {
    var state = getRunState();
    var gained = nonNegativeInt(amount, 0);

    if (gained <= 0) {
      return state.persistent.abyssStones;
    }

    state.persistent.abyssStones = nonNegativeInt(state.persistent.abyssStones, 0) + gained;
    state.persistent.totalAbyssStonesEarned = nonNegativeInt(state.persistent.totalAbyssStonesEarned, 0) + gained;
    replacePersistent(state.persistent);
    return state.persistent.abyssStones;
  }

  function isClassUnlocked(classId, save) {
    var target = syncClassUnlocks(save || getRunState().persistent);
    return !!(Data.CLASSES[classId] && target.unlockedClasses[classId]);
  }

  function canUnlockClass(classId, save) {
    var target = syncClassUnlocks(save || getRunState().persistent);
    var classData = Data.CLASSES[classId];
    var cost = classData ? Math.max(0, Math.floor(classData.unlockCost || 0)) : 0;

    return !!(classData && !target.unlockedClasses[classId] && nonNegativeInt(target.abyssStones, 0) >= cost);
  }

  function purchaseMetaUpgrade(upgradeId) {
    var state = getRunState();
    var upgrade = Data.META_UPGRADES[upgradeId];

    if (!upgrade) {
      return false;
    }

    var level = clampInt(state.persistent.metaUpgrades[upgradeId], 0, upgrade.maxLevel, 0);
    var cost = upgrade.costs[level];

    if (level >= upgrade.maxLevel || !isFinite(cost) || state.persistent.abyssStones < cost) {
      return false;
    }

    state.persistent.abyssStones -= cost;
    state.persistent.metaUpgrades[upgradeId] = level + 1;
    replacePersistent(state.persistent);
    return true;
  }

  function unlockClass(classId) {
    var state = getRunState();
    var classData = Data.CLASSES[classId];

    syncClassUnlocks(state.persistent);

    if (!classData) {
      return false;
    }

    if (isClassUnlocked(classId, state.persistent)) {
      state.persistent.selectedClassId = classId;
      replacePersistent(state.persistent);
      return true;
    }

    if (!canUnlockClass(classId, state.persistent)) {
      replacePersistent(state.persistent);
      return false;
    }

    state.persistent.abyssStones -= classData.unlockCost;
    state.persistent.unlockedClasses[classId] = true;
    state.persistent.unlocks = state.persistent.unlocks || createUnlockDefaults(Data.STORAGE_DEFAULTS);
    state.persistent.unlocks.classes = state.persistent.unlocks.classes || {};
    state.persistent.unlocks.relics = state.persistent.unlocks.relics || {};
    state.persistent.unlocks.evolutions = state.persistent.unlocks.evolutions || {};
    state.persistent.unlocks.classes[classId] = true;
    if (classId === "alchemist") {
      state.persistent.unlocks.relics.alchemist_star = true;
      state.persistent.unlocks.evolutions.alchemy_bloom = true;
    } else if (classId === "tuner") {
      state.persistent.unlocks.relics.mirror_shard = true;
      state.persistent.unlocks.relics.precision_tuner = true;
      state.persistent.unlocks.evolutions.perfect_tuning = true;
    }
    state.persistent.selectedClassId = classId;
    syncClassUnlocks(state.persistent);
    replacePersistent(state.persistent);
    return true;
  }

  function selectClass(classId) {
    var state = getRunState();

    syncClassUnlocks(state.persistent);

    if (!Data.CLASSES[classId] || !isClassUnlocked(classId, state.persistent)) {
      return false;
    }

    state.persistent.selectedClassId = classId;
    replacePersistent(state.persistent);
    return true;
  }

  function selectGameMode(modeId) {
    var state = getRunState();

    if (!Data.GAME_MODES[modeId] || !state.persistent.unlockedModes[modeId]) {
      return false;
    }

    state.persistent.selectedGameModeId = modeId;
    replacePersistent(state.persistent);
    return true;
  }

  function unlockAllModes() {
    var state = getRunState();
    var changed = false;

    Data.GAME_MODE_ORDER.forEach(function (modeId) {
      if (!state.persistent.unlockedModes[modeId]) {
        state.persistent.unlockedModes[modeId] = true;
        state.persistent.unlocks = state.persistent.unlocks || createUnlockDefaults(Data.STORAGE_DEFAULTS);
        state.persistent.unlocks.modes[modeId] = true;
        changed = true;
      }
    });

    if (changed) {
      state.persistent.unlocks = state.persistent.unlocks || createUnlockDefaults(Data.STORAGE_DEFAULTS);
      state.persistent.unlocks.relics.portal_resonator = true;
      state.persistent.unlocks.relics.bumper_core = true;
      state.persistent.unlocks.relics.giant_grip = true;
      state.persistent.unlocks.evolutions.dimensional_refraction = true;
    }

    if (changed) {
      replacePersistent(state.persistent);
    }

    return changed;
  }

  function getAchievementData(id) {
    for (var index = 0; index < Data.ACHIEVEMENTS.length; index++) {
      if (Data.ACHIEVEMENTS[index].id === id) {
        return Data.ACHIEVEMENTS[index];
      }
    }

    return null;
  }

  function unlockAchievement(id) {
    var state = getRunState();
    var achievement = getAchievementData(id);

    if (!achievement || state.persistent.achievements[id]) {
      return false;
    }

    state.persistent.achievements[id] = {
      unlocked: true,
      rewardGranted: true,
      unlockedAt: Date.now()
    };
    state.persistent.abyssStones += achievement.reward;
    state.persistent.totalAbyssStonesEarned += achievement.reward;
    state.unlockedAchievementIds.push(id);
    replacePersistent(state.persistent);
    return true;
  }

  function discover(group, id) {
    var state = getRunState();

    if (!state.persistent.discovered || !state.persistent.discovered[group] || !id) {
      return false;
    }
    if (state.persistent.discovered[group][id]) {
      return false;
    }

    state.persistent.discovered[group][id] = true;
    replacePersistent(state.persistent);
    return true;
  }

  function unlockCosmetic(kind, id) {
    var state = getRunState();
    var cosmetics = state.persistent.cosmetics;
    var group = kind === "paddle" ? "unlockedPaddleSkins" : "unlockedBallSkins";
    var definitions = kind === "paddle" ? Data.COSMETICS.paddleSkins : Data.COSMETICS.ballSkins;

    if (!cosmetics || !definitions[id]) {
      return false;
    }
    if (cosmetics[group][id]) {
      return false;
    }

    cosmetics[group][id] = true;
    replacePersistent(state.persistent);
    return true;
  }

  function selectCosmetic(kind, id) {
    var state = getRunState();
    var cosmetics = state.persistent.cosmetics;

    if (!cosmetics) {
      return false;
    }

    if (kind === "paddle") {
      if (!Data.COSMETICS.paddleSkins[id] || !cosmetics.unlockedPaddleSkins[id]) {
        return false;
      }
      cosmetics.selectedPaddleSkinId = id;
      state.selectedPaddleSkinId = id;
    } else {
      if (!Data.COSMETICS.ballSkins[id] || !cosmetics.unlockedBallSkins[id]) {
        return false;
      }
      cosmetics.selectedBallSkinId = id;
      state.selectedBallSkinId = id;
    }

    replacePersistent(state.persistent);
    return true;
  }

  function unlockEmblem(id) {
    var state = getRunState();

    if (!Data.EMBLEMS || !Data.EMBLEMS[id]) {
      return false;
    }
    state.persistent.emblems = state.persistent.emblems || clone(Data.STORAGE_DEFAULTS.emblems);
    state.persistent.emblems.unlocked = state.persistent.emblems.unlocked || {};
    if (state.persistent.emblems.unlocked[id]) {
      return false;
    }
    state.persistent.emblems.unlocked[id] = true;
    replacePersistent(state.persistent);
    return true;
  }

  function selectEmblem(id) {
    var state = getRunState();

    if (!Data.EMBLEMS || !Data.EMBLEMS[id] || !state.persistent.emblems || !state.persistent.emblems.unlocked[id]) {
      return false;
    }
    state.persistent.emblems.selectedEmblemId = id;
    state.selectedEmblemId = id;
    replacePersistent(state.persistent);
    return true;
  }

  function getSelectedPreset(save) {
    var equipment = save && save.equipment;
    var selected = equipment && equipment.selectedPresetId || "preset_1";
    return equipment && equipment.presets && equipment.presets[selected] ? equipment.presets[selected] : Data.STORAGE_DEFAULTS.equipment.presets.preset_1;
  }

  function getAppliedEquipment(save) {
    var clean = sanitizeSave(save || getRunState().persistent);
    var preset = getSelectedPreset(clean);
    return {
      presetId: clean.equipment.selectedPresetId,
      coreId: preset.coreId || "default_ball_core",
      boardId: preset.boardId || "default_board_frame",
      coreChipIds: Array.isArray(preset.coreChipIds) ? preset.coreChipIds.slice(0, 3) : [],
      boardChipIds: Array.isArray(preset.boardChipIds) ? preset.boardChipIds.slice(0, 3) : []
    };
  }

  function getOwnedMap(save, kind) {
    var equipment = save && save.equipment || {};
    if (kind === "core") {
      return equipment.ownedCores || {};
    }
    if (kind === "board") {
      return equipment.ownedBoards || {};
    }
    return equipment.ownedChips || {};
  }

  function setOwnedCount(save, kind, id, count) {
    var equipment = save.equipment;
    if (kind === "core") {
      equipment.ownedCores[id] = count;
    } else if (kind === "board") {
      equipment.ownedBoards[id] = count;
    } else {
      equipment.ownedChips[id] = count;
    }
  }

  function getChipAllowedTypes(slot) {
    return slot === "board" ? (Data.BOARD_CHIP_TYPES || []) : (Data.CORE_CHIP_TYPES || []);
  }

  function selectEquipmentPreset(presetId) {
    var state = getRunState();

    if (!state.persistent.equipment || !state.persistent.equipment.presets[presetId]) {
      return false;
    }
    state.persistent.equipment.selectedPresetId = presetId;
    replacePersistent(state.persistent);
    return true;
  }

  function equipCore(coreId) {
    var state = getRunState();
    var save = state.persistent;
    var preset = getSelectedPreset(save);

    if (!getEquipmentById("core", coreId) || countOwned(save.equipment.ownedCores, coreId) <= 0) {
      return false;
    }
    preset.coreId = coreId;
    preset.coreChipIds = sanitizeChipList(preset.coreChipIds, save.equipment.ownedChips, Data.CORE_CHIP_TYPES || [], getEquipmentById("core", coreId).slotCount);
    replacePersistent(save);
    return true;
  }

  function equipBoard(boardId) {
    var state = getRunState();
    var save = state.persistent;
    var preset = getSelectedPreset(save);

    if (!getEquipmentById("board", boardId) || countOwned(save.equipment.ownedBoards, boardId) <= 0) {
      return false;
    }
    preset.boardId = boardId;
    preset.boardChipIds = sanitizeChipList(preset.boardChipIds, save.equipment.ownedChips, Data.BOARD_CHIP_TYPES || [], getEquipmentById("board", boardId).slotCount);
    replacePersistent(save);
    return true;
  }

  function equipChip(slot, chipId) {
    var state = getRunState();
    var save = state.persistent;
    var preset = getSelectedPreset(save);
    var chip = getEquipmentById("chip", chipId);
    var listName = slot === "board" ? "boardChipIds" : "coreChipIds";
    var host = slot === "board" ? getEquipmentById("board", preset.boardId) : getEquipmentById("core", preset.coreId);
    var allowed = getChipAllowedTypes(slot);
    var list = preset[listName] || [];

    if (!chip || countOwned(save.equipment.ownedChips, chipId) <= 0 || allowed.indexOf(chip.chipType) === -1 || list.indexOf(chipId) !== -1) {
      return false;
    }
    if (list.length >= Math.max(0, host && host.slotCount || 0)) {
      return false;
    }
    list.push(chipId);
    preset[listName] = list;
    replacePersistent(save);
    return true;
  }

  function unequipChip(slot, chipId) {
    var state = getRunState();
    var preset = getSelectedPreset(state.persistent);
    var listName = slot === "board" ? "boardChipIds" : "coreChipIds";
    var list = Array.isArray(preset[listName]) ? preset[listName] : [];
    var next = list.filter(function (id) { return id !== chipId; });

    if (next.length === list.length) {
      return false;
    }
    preset[listName] = next;
    replacePersistent(state.persistent);
    return true;
  }

  function gradeAtLeast(grade, target) {
    var order = Data.EQUIPMENT_GRADE_ORDER || [];
    return order.indexOf(grade) >= order.indexOf(target);
  }

  function choosePullGrade(kind, research) {
    var pity = research.pity[kind] || { rare: 0, epic: 0, legendary: 0 };
    var limits = Data.EQUIPMENT_PITY_LIMITS || {};

    if (pity.legendary + 1 >= (limits.legendary || 80)) {
      return "legendary";
    }
    if (pity.epic + 1 >= (limits.epic || 30)) {
      return "epic";
    }
    if (pity.rare + 1 >= (limits.rare || 10)) {
      return "rare";
    }

    var grades = Data.EQUIPMENT_GRADE_ORDER || ["common", "rare", "epic", "legendary"];
    var total = grades.reduce(function (sum, grade) {
      return sum + Math.max(0, Data.EQUIPMENT_GRADES[grade] ? Data.EQUIPMENT_GRADES[grade].weight : 0);
    }, 0);
    var roll = Math.random() * Math.max(1, total);
    for (var index = 0; index < grades.length; index++) {
      var gradeId = grades[index];
      roll -= Math.max(0, Data.EQUIPMENT_GRADES[gradeId] ? Data.EQUIPMENT_GRADES[gradeId].weight : 0);
      if (roll <= 0) {
        return gradeId;
      }
    }
    return "common";
  }

  function pickEquipmentId(kind, grade) {
    var ids = getEquipmentOrder(kind).filter(function (id) {
      var item = getEquipmentById(kind, id);
      return item && item.grade === grade;
    });
    if (!ids.length) {
      ids = getEquipmentOrder(kind).filter(function (id) { return !!getEquipmentById(kind, id); });
    }
    return ids[Math.floor(Math.random() * ids.length)] || null;
  }

  function recordEquipmentGain(save, kind, id) {
    var item = getEquipmentById(kind, id);
    var owned = getOwnedMap(save, kind);
    var duplicate = countOwned(owned, id) > 0;
    var fragments = 0;

    if (!item) {
      return null;
    }
    if (duplicate) {
      fragments = Data.EQUIPMENT_GRADES[item.grade] ? Data.EQUIPMENT_GRADES[item.grade].fragments : 2;
      save.research.abyssFragments += fragments;
    } else {
      setOwnedCount(save, kind, id, 1);
      save.discovered = save.discovered || {};
      if (kind === "core") {
        save.discovered.cores = save.discovered.cores || {};
        save.discovered.cores[id] = true;
      } else if (kind === "board") {
        save.discovered.boards = save.discovered.boards || {};
        save.discovered.boards[id] = true;
      } else {
        save.discovered.chips = save.discovered.chips || {};
        save.discovered.chips[id] = true;
      }
    }
    return { kind: kind, id: id, name: item.name, grade: item.grade, duplicate: duplicate, fragments: fragments };
  }

  function updatePityAfterPull(research, kind, grade) {
    var pity = research.pity[kind];
    pity.rare += 1;
    pity.epic += 1;
    pity.legendary += 1;
    if (gradeAtLeast(grade, "rare")) {
      pity.rare = 0;
    }
    if (gradeAtLeast(grade, "epic")) {
      pity.epic = 0;
    }
    if (gradeAtLeast(grade, "legendary")) {
      pity.legendary = 0;
    }
  }

  function extractEquipment(kind, count) {
    var state = getRunState();
    var save = state.persistent;
    var pulls = count === 10 ? 10 : 1;
    var costTable = Data.EQUIPMENT_PULL_COSTS[kind];
    var cost = costTable ? (pulls === 10 ? costTable.ten : costTable.one) : 999999999;
    var results = [];

    if (!costTable || save.abyssStones < cost) {
      return { ok: false, message: "자연석이 부족합니다.", results: [] };
    }
    save.abyssStones -= cost;
    for (var index = 0; index < pulls; index++) {
      var grade = choosePullGrade(kind, save.research);
      var id = pickEquipmentId(kind, grade);
      var result = recordEquipmentGain(save, kind, id);
      if (result) {
        results.push(result);
        updatePityAfterPull(save.research, kind, result.grade);
      }
      save.research.totalPulls[kind] += 1;
    }
    save.research.lastResults = results.slice(-10);
    replacePersistent(save);
    return { ok: true, message: pulls + "회 추출 완료", results: results };
  }

  function craftEquipment(kind, id) {
    var state = getRunState();
    var save = state.persistent;
    var item = getEquipmentById(kind, id);
    var cost = item && Data.EQUIPMENT_CRAFT_COSTS ? Data.EQUIPMENT_CRAFT_COSTS[item.grade] : null;

    if (!item || !cost || save.research.abyssFragments < cost || countOwned(getOwnedMap(save, kind), id) > 0) {
      return false;
    }
    save.research.abyssFragments -= cost;
    recordEquipmentGain(save, kind, id);
    replacePersistent(save);
    return true;
  }

  function scoreEquipmentForTags(item, tags) {
    var score = 0;
    (item.tags || []).forEach(function (tag) {
      if (tags.indexOf(tag) !== -1) {
        score += 3;
      }
    });
    score += Math.max(0, (Data.EQUIPMENT_GRADE_ORDER || []).indexOf(item.grade));
    return score;
  }

  function recommendEquipment(typeId) {
    var state = getRunState();
    var save = state.persistent;
    var target = Data.RECOMMENDATION_TYPES[typeId] || Data.RECOMMENDATION_TYPES.attack;
    var tags = target.tags || [];

    function best(kind) {
      var owned = getOwnedMap(save, kind);
      var bestId = null;
      var bestScore = -1;
      Object.keys(owned).forEach(function (id) {
        var item = getEquipmentById(kind, id);
        var score = item && countOwned(owned, id) > 0 ? scoreEquipmentForTags(item, tags) : -1;
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
        }
      });
      return bestId;
    }

    var coreId = best("core") || "default_ball_core";
    var boardId = best("board") || "default_board_frame";
    var chips = Object.keys(save.equipment.ownedChips || {}).filter(function (id) {
      return countOwned(save.equipment.ownedChips, id) > 0 && getEquipmentById("chip", id);
    }).sort(function (a, b) {
      return scoreEquipmentForTags(getEquipmentById("chip", b), tags) - scoreEquipmentForTags(getEquipmentById("chip", a), tags);
    });
    var preset = getSelectedPreset(save);

    preset.coreId = coreId;
    preset.boardId = boardId;
    preset.coreChipIds = sanitizeChipList(chips, save.equipment.ownedChips, Data.CORE_CHIP_TYPES || [], getEquipmentById("core", coreId).slotCount);
    preset.boardChipIds = sanitizeChipList(chips, save.equipment.ownedChips, Data.BOARD_CHIP_TYPES || [], getEquipmentById("board", boardId).slotCount);
    replacePersistent(save);
    return true;
  }

  function applyImportedSave(text) {
    var parsed;

    try {
      parsed = JSON.parse(String(text || ""));
    } catch (error) {
      return { ok: false, message: "JSON 형식이 올바르지 않습니다." };
    }

    var clean = sanitizeSave(parsed);
    clean.activeRun = null;
    var state = createRunState(savePersistent(clean));
    state.mode = Data.MODES.LOBBY;
    setCurrentState(state);
    return { ok: true, message: "저장 데이터를 불러왔습니다." };
  }

  function exportSaveText() {
    return JSON.stringify(getRunState().persistent, null, 2);
  }

  function resetAllProgress() {
    var defaults = createDefaultSave();
    var state = createRunState(savePersistent(defaults));
    state.mode = Data.MODES.LOBBY;
    setCurrentState(state);
    return state;
  }

  function updateSettings(nextSettings) {
    var state = getRunState();
    var settings = state.persistent.settings;

    if (isObject(nextSettings)) {
      if (typeof nextSettings.sound === "boolean") {
        settings.sound = nextSettings.sound;
        settings.soundEnabled = nextSettings.sound;
      }
      if (typeof nextSettings.soundEnabled === "boolean") {
        settings.sound = nextSettings.soundEnabled;
        settings.soundEnabled = nextSettings.soundEnabled;
      }
      if (typeof nextSettings.vibration === "boolean") {
        settings.vibration = nextSettings.vibration;
        settings.vibrationEnabled = nextSettings.vibration;
      }
      if (typeof nextSettings.vibrationEnabled === "boolean") {
        settings.vibration = nextSettings.vibrationEnabled;
        settings.vibrationEnabled = nextSettings.vibrationEnabled;
      }
      if (typeof nextSettings.reducedEffects === "boolean") {
        settings.reducedEffects = nextSettings.reducedEffects;
      }
      state.persistent.accessibility = state.persistent.accessibility || clone(Data.STORAGE_DEFAULTS.accessibility);
      if (["small", "default", "large"].indexOf(nextSettings.ballSize) !== -1) {
        state.persistent.accessibility.ballSize = nextSettings.ballSize;
      }
      if (["default", "wide", "extra_wide"].indexOf(nextSettings.paddleSize) !== -1) {
        state.persistent.accessibility.paddleSize = nextSettings.paddleSize;
      }
      if (["low", "default", "high"].indexOf(nextSettings.touchSensitivity) !== -1) {
        state.persistent.accessibility.touchSensitivity = nextSettings.touchSensitivity;
      }
      if (typeof nextSettings.highContrast === "boolean") {
        state.persistent.accessibility.highContrast = nextSettings.highContrast;
      }
      if (typeof nextSettings.accessibilityReducedEffects === "boolean") {
        state.persistent.accessibility.reducedEffects = nextSettings.accessibilityReducedEffects;
        settings.reducedEffects = nextSettings.accessibilityReducedEffects;
      }
      if (typeof nextSettings.screenShake === "boolean") {
        state.persistent.accessibility.screenShake = nextSettings.screenShake;
      }
    }

    replacePersistent(state.persistent);
    return state.persistent.settings;
  }

  function completeTutorial(skipped) {
    var state = getRunState();
    state.persistent.tutorial = state.persistent.tutorial || { completed: false, skipped: false };
    state.persistent.tutorial.completed = !skipped;
    state.persistent.tutorial.skipped = !!skipped;
    if (state.tutorial) {
      state.tutorial.active = false;
    }
    replacePersistent(state.persistent);
    return state.persistent.tutorial;
  }

  var State = {
    current: null,
    createDefaultSave: createDefaultSave,
    sanitizeSave: sanitizeSave,
    loadSave: loadSave,
    savePersistent: savePersistent,
    saveActiveRun: saveActiveRun,
    clearActiveRun: clearActiveRun,
    createRunState: createRunState,
    createPaddle: createPaddle,
    createBall: createBall,
    createAttachedBall: createAttachedBall,
    initRun: initRun,
    restartRun: restartRun,
    getRunState: getRunState,
    setMode: setMode,
    updateBestScore: updateBestScore,
    updateHighestStage: updateHighestStage,
    addAbyssStones: addAbyssStones,
    purchaseMetaUpgrade: purchaseMetaUpgrade,
    unlockClass: unlockClass,
    isClassUnlocked: isClassUnlocked,
    canUnlockClass: canUnlockClass,
    syncClassUnlocks: syncClassUnlocks,
    selectClass: selectClass,
    selectGameMode: selectGameMode,
    unlockAllModes: unlockAllModes,
    unlockAchievement: unlockAchievement,
    discover: discover,
    unlockCosmetic: unlockCosmetic,
    selectCosmetic: selectCosmetic,
    unlockEmblem: unlockEmblem,
    selectEmblem: selectEmblem,
    getEquipmentById: getEquipmentById,
    getAppliedEquipment: getAppliedEquipment,
    selectEquipmentPreset: selectEquipmentPreset,
    equipCore: equipCore,
    equipBoard: equipBoard,
    equipChip: equipChip,
    unequipChip: unequipChip,
    extractEquipment: extractEquipment,
    craftEquipment: craftEquipment,
    recommendEquipment: recommendEquipment,
    applyImportedSave: applyImportedSave,
    exportSaveText: exportSaveText,
    resetAllProgress: resetAllProgress,
    updateSettings: updateSettings,
    completeTutorial: completeTutorial
  };

  AbyssBreaker.State = State;
})(typeof window !== "undefined" ? window : globalThis);
