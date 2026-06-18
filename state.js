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

  function sanitizeSave(value) {
    var defaults = createDefaultSave();

    if (!isObject(value) || value.schemaVersion !== Data.SAVE_SCHEMA_VERSION) {
      return defaults;
    }

    return {
      schemaVersion: Data.SAVE_SCHEMA_VERSION,
      bestScore: nonNegativeInt(value.bestScore, defaults.bestScore),
      highestStage: Math.max(1, nonNegativeInt(value.highestStage, defaults.highestStage)),
      settings: {
        vibration: isObject(value.settings) && typeof value.settings.vibration === "boolean" ?
          value.settings.vibration :
          defaults.settings.vibration
      }
    };
  }

  function loadSave() {
    var storage = getStorage();
    var defaults = createDefaultSave();

    if (!storage) {
      return defaults;
    }

    try {
      var raw = storage.getItem(Data.SAVE_KEY);
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

  function createPaddle(width, height) {
    var baseWidth = Data.PADDLE.width;
    var paddleWidth = Math.min(baseWidth, width * 0.42);

    return {
      x: (width - paddleWidth) / 2,
      y: height - Data.PADDLE.yOffset,
      width: paddleWidth,
      baseWidth: paddleWidth,
      height: Data.PADDLE.height,
      targetX: width / 2,
      speed: 0,
      expandTimeRemaining: 0
    };
  }

  function createAttachedBall(id, paddle) {
    return {
      id: id,
      x: paddle.x + paddle.width / 2,
      y: paddle.y - Data.BALL.radius - 1,
      prevX: paddle.x + paddle.width / 2,
      prevY: paddle.y - Data.BALL.radius - 1,
      vx: 0,
      vy: 0,
      radius: Data.BALL.radius,
      active: true,
      attached: true,
      collisionCooldowns: {}
    };
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
      persistent: persistent,
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
      balls: [createAttachedBall(1, paddle)],
      bricks: [],
      items: [],
      particles: [],
      effects: [],
      floatingTexts: [],
      timers: {},
      activeEffects: {
        slowBallTimeRemaining: 0
      },
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

  function updateBestScore(score) {
    var state = getRunState();
    var nextBest = nonNegativeInt(score, state.persistent.bestScore);

    if (nextBest > state.persistent.bestScore) {
      state.persistent.bestScore = nextBest;
      state.bestScore = nextBest;
      state.persistent = savePersistent(state.persistent);
    }

    return state.persistent.bestScore;
  }

  function updateHighestStage(stage) {
    var state = getRunState();
    var nextStage = Math.max(1, nonNegativeInt(stage, state.persistent.highestStage));

    if (nextStage > state.persistent.highestStage) {
      state.persistent.highestStage = nextStage;
      state.persistent = savePersistent(state.persistent);
    }

    return state.persistent.highestStage;
  }

  var State = {
    current: null,
    createDefaultSave: createDefaultSave,
    sanitizeSave: sanitizeSave,
    loadSave: loadSave,
    savePersistent: savePersistent,
    createRunState: createRunState,
    createPaddle: createPaddle,
    createAttachedBall: createAttachedBall,
    initRun: initRun,
    restartRun: restartRun,
    getRunState: getRunState,
    setMode: setMode,
    updateBestScore: updateBestScore,
    updateHighestStage: updateHighestStage
  };

  AbyssBreaker.State = State;
})(typeof window !== "undefined" ? window : globalThis);
