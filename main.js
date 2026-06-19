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

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
