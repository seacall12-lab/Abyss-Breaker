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

    Data.UPGRADES.forEach(function (upgrade) { discovered.upgrades[upgrade.id] = !!discovered.upgrades[upgrade.id]; });
    Data.RELICS.forEach(function (relic) { discovered.relics[relic.id] = !!discovered.relics[relic.id]; });
    Data.EVOLUTIONS.forEach(function (evolution) { discovered.evolutions[evolution.id] = !!discovered.evolutions[evolution.id]; });
    Data.ITEMS.definitions.forEach(function (item) { discovered.items[item.id] = !!discovered.items[item.id]; });
    Object.keys(Data.BOSSES).forEach(function (id) { discovered.bosses[id] = !!discovered.bosses[id]; });
    Object.keys(Data.ZONES).forEach(function (id) { discovered.zones[id] = !!discovered.zones[id]; });

    Data.UPGRADES.slice(0, 3).forEach(function (upgrade) { discovered.upgrades[upgrade.id] = true; });
    Data.ITEMS.definitions.forEach(function (item) { discovered.items[item.id] = true; });
    discovered.zones.gate = true;
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
      relicsSelected: 0
    };
    var result = clone(defaults);

    if (!isObject(value)) {
      return result;
    }

    Object.keys(defaults).forEach(function (key) {
      result[key] = key === "maxActiveBalls" ? Math.max(1, nonNegativeInt(value[key], defaults[key])) : nonNegativeInt(value[key], defaults[key]);
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
      currentStageMission: null,
      stageMissionProgress: {},
      completedStageMissions: {},
      failedStageMissions: {},
      runSummary: null,
      selectedBallSkinId: persistent.cosmetics ? persistent.cosmetics.selectedBallSkinId : "default_ball",
      selectedPaddleSkinId: persistent.cosmetics ? persistent.cosmetics.selectedPaddleSkinId : "default_paddle",
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
    applyImportedSave: applyImportedSave,
    exportSaveText: exportSaveText,
    resetAllProgress: resetAllProgress,
    updateSettings: updateSettings,
    completeTutorial: completeTutorial
  };

  AbyssBreaker.State = State;
})(typeof window !== "undefined" ? window : globalThis);
