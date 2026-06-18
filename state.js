"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;

  if (!Data) {
    throw new Error("AbyssBreaker.Data must be loaded before state.js");
  }

  var currentState = null;

  function clonePlainObject(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function toNonNegativeInteger(value, fallback) {
    if (!isFiniteNumber(value)) {
      return fallback;
    }

    return Math.max(0, Math.floor(value));
  }

  function isPlainObject(value) {
    return !!value && Object.prototype.toString.call(value) === "[object Object]";
  }

  function getStorage() {
    try {
      if (!global.localStorage) {
        return null;
      }

      return global.localStorage;
    } catch (error) {
      return null;
    }
  }

  function createDefaultSave() {
    return clonePlainObject(Data.STORAGE_DEFAULTS);
  }

  function sanitizeSettings(value) {
    var defaults = Data.STORAGE_DEFAULTS.settings;
    var settings = isPlainObject(value) ? value : {};

    return {
      sound: typeof settings.sound === "boolean" ? settings.sound : defaults.sound,
      vibration: typeof settings.vibration === "boolean" ? settings.vibration : defaults.vibration
    };
  }

  function sanitizeSave(value) {
    var defaults = createDefaultSave();

    if (!isPlainObject(value) || value.schemaVersion !== Data.SAVE_SCHEMA_VERSION) {
      return defaults;
    }

    return {
      schemaVersion: Data.SAVE_SCHEMA_VERSION,
      bestWave: toNonNegativeInteger(value.bestWave, defaults.bestWave),
      bestScore: toNonNegativeInteger(value.bestScore, defaults.bestScore),
      metaCurrency: toNonNegativeInteger(value.metaCurrency, defaults.metaCurrency),
      upgrades: isPlainObject(value.upgrades) ? clonePlainObject(value.upgrades) : {},
      settings: sanitizeSettings(value.settings)
    };
  }

  function savesAreEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function savePersistent(saveData) {
    var storage = getStorage();
    var cleanSave = sanitizeSave(saveData);

    if (!storage) {
      return cleanSave;
    }

    try {
      storage.setItem(Data.SAVE_KEY, JSON.stringify(cleanSave));
    } catch (error) {
      return cleanSave;
    }

    return cleanSave;
  }

  function loadSave() {
    var storage = getStorage();
    var defaults = createDefaultSave();

    if (!storage) {
      return defaults;
    }

    try {
      var raw = storage.getItem(Data.SAVE_KEY);

      if (!raw) {
        return defaults;
      }

      var parsed = JSON.parse(raw);
      var cleanSave = sanitizeSave(parsed);

      if (!savesAreEqual(parsed, cleanSave)) {
        savePersistent(cleanSave);
      }

      return cleanSave;
    } catch (error) {
      savePersistent(defaults);
      return defaults;
    }
  }

  function createBallState(id, player) {
    return {
      id: id,
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
      radius: Data.BALL_BASE.radius,
      damage: player.ballDamage,
      active: false,
      returned: true,
      pierce: Data.BALL_BASE.pierce,
      collisionCooldowns: {}
    };
  }

  function createRunState(saveData) {
    var persistent = sanitizeSave(saveData || loadSave());
    var player = clonePlainObject(Data.PLAYER_BASE);
    var initialLaunchX = Data.CANVAS.designWidth * Data.LAYOUT.launchXRatio;
    var initialLaunchY = Data.CANVAS.designHeight * Data.LAYOUT.launchLineRatio;

    return {
      version: Data.VERSION,
      mode: Data.MODES.BOOT,
      previousMode: null,
      persistent: persistent,
      time: {
        elapsed: 0,
        delta: 0,
        accumulator: 0,
        frame: 0,
        lastTimestamp: 0
      },
      viewport: {
        cssWidth: Data.CANVAS.designWidth,
        cssHeight: Data.CANVAS.designHeight,
        pixelWidth: Data.CANVAS.designWidth,
        pixelHeight: Data.CANVAS.designHeight,
        devicePixelRatio: 1
      },
      player: player,
      run: {
        wave: Data.GAME.startingWave,
        gold: Data.GAME.startingGold,
        score: Data.GAME.startingScore,
        bestWave: persistent.bestWave,
        bestScore: persistent.bestScore,
        turn: 0,
        nextBallId: 1,
        nextBrickId: 1,
        waveClearPending: false,
        gameoverHandled: false
      },
      wave: {
        index: Data.GAME.startingWave,
        type: Data.WAVE_BALANCE.normalWaveType,
        spawned: false,
        cleared: false,
        resolving: false
      },
      aim: {
        active: false,
        startX: initialLaunchX,
        startY: initialLaunchY,
        currentX: initialLaunchX,
        currentY: initialLaunchY,
        directionX: 0,
        directionY: -1,
        angleRadians: -Math.PI / 2,
        valid: false
      },
      launch: {
        originX: initialLaunchX,
        originY: initialLaunchY,
        nextX: initialLaunchX,
        directionX: 0,
        directionY: -1,
        queuedBallIds: [],
        launchedCount: 0,
        returnedCount: 0,
        timer: 0,
        interval: Data.BALL_BASE.launchInterval
      },
      balls: [
        createBallState(0, player)
      ],
      bricks: [],
      effects: {
        particles: [],
        damageTexts: [],
        screenShake: {
          time: 0,
          duration: 0,
          magnitude: 0
        }
      },
      flags: {
        needsResize: true,
        needsHudUpdate: true,
        inputLocked: false
      }
    };
  }

  function setCurrentState(nextState) {
    currentState = nextState;
    State.current = currentState;
    return currentState;
  }

  function initRun() {
    var state = createRunState(loadSave());
    state.mode = Data.MODES.READY;
    return setCurrentState(state);
  }

  function restartRun() {
    var persistent = currentState ? currentState.persistent : loadSave();
    var state = createRunState(persistent);
    state.mode = Data.MODES.READY;
    return setCurrentState(state);
  }

  function getRunState() {
    if (!currentState) {
      return initRun();
    }

    return currentState;
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
    return state.mode;
  }

  function updateBestWave(wave) {
    var state = getRunState();
    var nextBest = toNonNegativeInteger(wave, state.persistent.bestWave);

    if (nextBest <= state.persistent.bestWave) {
      return state.persistent.bestWave;
    }

    state.persistent.bestWave = nextBest;
    state.run.bestWave = nextBest;
    state.persistent = savePersistent(state.persistent);
    return state.persistent.bestWave;
  }

  function updateBestScore(score) {
    var state = getRunState();
    var nextBest = toNonNegativeInteger(score, state.persistent.bestScore);

    if (nextBest <= state.persistent.bestScore) {
      return state.persistent.bestScore;
    }

    state.persistent.bestScore = nextBest;
    state.run.bestScore = nextBest;
    state.persistent = savePersistent(state.persistent);
    return state.persistent.bestScore;
  }

  function commitRunRecords() {
    var state = getRunState();

    updateBestWave(state.run.wave);
    updateBestScore(state.run.score);

    return state.persistent;
  }

  var State = {
    current: null,
    createDefaultSave: createDefaultSave,
    sanitizeSave: sanitizeSave,
    loadSave: loadSave,
    savePersistent: savePersistent,
    createRunState: createRunState,
    initRun: initRun,
    restartRun: restartRun,
    getRunState: getRunState,
    setMode: setMode,
    updateBestWave: updateBestWave,
    updateBestScore: updateBestScore,
    commitRunRecords: commitRunRecords
  };

  AbyssBreaker.State = State;
})(typeof window !== "undefined" ? window : globalThis);
