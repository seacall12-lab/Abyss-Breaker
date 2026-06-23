"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;
  var State = AbyssBreaker.State;
  var Game = AbyssBreaker.Game;
  var Render = AbyssBreaker.Render;
  var UI = AbyssBreaker.UI;

  if (!Data || !State || !Game || !Render || !UI) {
    throw new Error("AbyssBreaker modules must be loaded before main.js");
  }

  var initialized = false;
  var loopRunning = false;
  var rafId = 0;
  var lastTimestamp = 0;
  var canvas = null;
  var audioContext = null;

  function now() {
    return global.performance && typeof global.performance.now === "function" ? global.performance.now() : Date.now();
  }

  function resetFrameClock() {
    lastTimestamp = 0;
  }

  function resizeCanvas() {
    if (!canvas) {
      return null;
    }

    var state = State.getRunState();
    var viewport = Render.resizeCanvas(canvas, state);
    state.flags.needsResize = false;
    return viewport;
  }

  function renderFrame() {
    if (!canvas) {
      return false;
    }

    return Render.render(canvas, State.getRunState());
  }

  function tick(timestamp) {
    if (!loopRunning) {
      return;
    }

    var current = typeof timestamp === "number" ? timestamp : now();
    var state = State.getRunState();

    if (!lastTimestamp) {
      lastTimestamp = current;
    }

    var delta = Math.min((current - lastTimestamp) / 1000, Data.GAME.maxDeltaTime);
    lastTimestamp = current;

    if (state.flags.needsResize) {
      resizeCanvas();
    }

    Game.update(delta, state);
    UI.sync(state);
    renderFrame();

    rafId = global.requestAnimationFrame(tick);
  }

  function startLoop() {
    if (loopRunning) {
      return false;
    }

    loopRunning = true;
    resetFrameClock();
    rafId = global.requestAnimationFrame(tick);
    return true;
  }

  function stopLoop() {
    if (!loopRunning) {
      return false;
    }

    loopRunning = false;

    if (rafId) {
      global.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    return true;
  }

  function restartGame() {
    var state = State.restartRun();

    Game.startRun(state);
    resizeCanvas();
    UI.hideAllOverlays();
    UI.sync(state);
    renderFrame();
    resetFrameClock();

    return state;
  }

  function goLobby() {
    var state = State.restartRun();

    resizeCanvas();
    UI.hideAllOverlays();
    UI.sync(state);
    renderFrame();
    resetFrameClock();

    return state;
  }

  function handleResize() {
    var state = State.getRunState();

    state.flags.needsResize = true;
    resizeCanvas();
    UI.sync(state);
    renderFrame();
    resetFrameClock();
  }

  function handleVisibilityChange() {
    resetFrameClock();

    if (!global.document.hidden) {
      renderFrame();
    }
  }

  function registerServiceWorker() {
    if (!global.navigator || !global.navigator.serviceWorker || !global.isSecureContext) {
      return;
    }

    global.navigator.serviceWorker.register("./service-worker.js").catch(function () {
      return null;
    });
  }

  function getSettings() {
    var state = State.getRunState();
    return state && state.persistent && state.persistent.settings ? state.persistent.settings : {};
  }

  function ensureAudio() {
    var AudioCtor = global.AudioContext || global.webkitAudioContext;

    if (!AudioCtor) {
      return null;
    }
    if (!audioContext) {
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended" && typeof audioContext.resume === "function") {
      audioContext.resume().catch(function () {});
    }
    return audioContext;
  }

  function playSound(kind) {
    var settings = getSettings();

    if (settings.sound === false || settings.soundEnabled === false) {
      return;
    }

    var context = ensureAudio();
    var map = {
      tap: [220, 0.045],
      confirm: [440, 0.08],
      error: [120, 0.12],
      item: [660, 0.06],
      mission: [520, 0.09],
      evolution: [330, 0.14]
    };
    var entry = map[kind] || map.tap;

    if (!context) {
      return;
    }

    try {
      var osc = context.createOscillator();
      var gain = context.createGain();
      var nowTime = context.currentTime;
      osc.type = kind === "error" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(entry[0], nowTime);
      gain.gain.setValueAtTime(0.0001, nowTime);
      gain.gain.exponentialRampToValueAtTime(0.055, nowTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, nowTime + entry[1]);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(nowTime);
      osc.stop(nowTime + entry[1] + 0.02);
    } catch (error) {}
  }

  function vibrate(pattern) {
    var settings = getSettings();

    if (settings.vibration === false || settings.vibrationEnabled === false || !global.navigator || typeof global.navigator.vibrate !== "function") {
      return;
    }

    try {
      global.navigator.vibrate(pattern || 12);
    } catch (error) {}
  }

  function init() {
    if (initialized) {
      return State.getRunState();
    }

    var state = State.initRun();

    UI.init();
    canvas = UI.getCanvas();
    resizeCanvas();
    UI.showStartOverlay();
    UI.sync(state);
    renderFrame();

    global.addEventListener("resize", handleResize);
    global.addEventListener("orientationchange", handleResize);
    global.document.addEventListener("visibilitychange", handleVisibilityChange);
    registerServiceWorker();

    startLoop();
    initialized = true;

    return state;
  }

  AbyssBreaker.Main = {
    init: init,
    restartGame: restartGame,
    goLobby: goLobby,
    resizeCanvas: resizeCanvas,
    renderFrame: renderFrame,
    startLoop: startLoop,
    stopLoop: stopLoop,
    resetFrameClock: resetFrameClock,
    isLoopRunning: function () {
      return loopRunning;
    }
  };

  AbyssBreaker.Feedback = {
    playSound: playSound,
    vibrate: vibrate
  };

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
