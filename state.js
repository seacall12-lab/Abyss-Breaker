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
    return {
      sound: isObject(value) && typeof value.sound === "boolean" ? value.sound : defaults.settings.sound,
      vibration: isObject(value) && typeof value.vibration === "boolean" ? value.vibration : defaults.settings.vibration,
      reducedEffects: isObject(value) && typeof value.reducedEffects === "boolean" ? value.reducedEffects : defaults.settings.reducedEffects
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
    var selectedClassId = typeof value.selectedClassId === "string" && Data.CLASSES[value.selectedClassId] ? value.selectedClassId : defaults.selectedClassId;
    var selectedGameModeId = typeof value.selectedGameModeId === "string" && Data.GAME_MODES[value.selectedGameModeId] ? value.selectedGameModeId : defaults.selectedGameModeId;

    if (!unlockedClasses[selectedClassId]) {
      selectedClassId = "balanced";
    }

    if (!unlockedModes[selectedGameModeId]) {
      selectedGameModeId = "standard";
    }

    return {
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
      metaUpgrades: sanitizeMetaUpgrades(value.metaUpgrades, defaults),
      achievements: sanitizeAchievements(value.achievements),
      records: sanitizeRecords(value.records, defaults.records, legacy),
      settings: sanitizeSettings(value.settings, defaults)
    };
  }

  function loadSave() {
    var storage = getStorage();
    var defaults = createDefaultSave();

    if (!storage) {
      return defaults;
    }

    try {
      var raw = storage.getItem(Data.SAVE_KEY) ||
        storage.getItem("abyssBreaker.save.v2") ||
        storage.getItem("abyssBreaker.save.v1");
      return raw ? sanitizeSave(JSON.parse(raw)) : defaults;
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

    return {
      x: (width - baseWidth) / 2,
      y: height - Data.PADDLE.yOffset,
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
        relicsSelected: 0
      },
      highestStageReached: Data.GAME.startingStage,
      bossesDefeated: 0,
      earnedAbyssStones: 0,
      selectedRelicId: null,
      selectedRelicIds: [],
      relicChoices: [],
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
        slowBallTimeRemaining: 0
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

    if (!classData || state.persistent.unlockedClasses[classId]) {
      return false;
    }

    if (state.persistent.abyssStones < classData.unlockCost) {
      return false;
    }

    state.persistent.abyssStones -= classData.unlockCost;
    state.persistent.unlockedClasses[classId] = true;
    state.persistent.selectedClassId = classId;
    replacePersistent(state.persistent);
    return true;
  }

  function selectClass(classId) {
    var state = getRunState();

    if (!Data.CLASSES[classId] || !state.persistent.unlockedClasses[classId]) {
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
        changed = true;
      }
    });

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

  function applyImportedSave(text) {
    var parsed;

    try {
      parsed = JSON.parse(String(text || ""));
    } catch (error) {
      return { ok: false, message: "JSON 형식이 올바르지 않습니다." };
    }

    var clean = sanitizeSave(parsed);
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
      }
      if (typeof nextSettings.vibration === "boolean") {
        settings.vibration = nextSettings.vibration;
      }
      if (typeof nextSettings.reducedEffects === "boolean") {
        settings.reducedEffects = nextSettings.reducedEffects;
      }
    }

    replacePersistent(state.persistent);
    return state.persistent.settings;
  }

  var State = {
    current: null,
    createDefaultSave: createDefaultSave,
    sanitizeSave: sanitizeSave,
    loadSave: loadSave,
    savePersistent: savePersistent,
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
    selectClass: selectClass,
    selectGameMode: selectGameMode,
    unlockAllModes: unlockAllModes,
    unlockAchievement: unlockAchievement,
    applyImportedSave: applyImportedSave,
    exportSaveText: exportSaveText,
    resetAllProgress: resetAllProgress,
    updateSettings: updateSettings
  };

  AbyssBreaker.State = State;
})(typeof window !== "undefined" ? window : globalThis);
