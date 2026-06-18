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

  function getNow() {
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

    Render.render(canvas, State.getRunState());
    return true;
  }

  function tick(timestamp) {
    if (!loopRunning) {
      return;
    }

    var now = typeof timestamp === "number" ? timestamp : getNow();
    var state = State.getRunState();

    if (!lastTimestamp) {
      lastTimestamp = now;
    }

    var delta = Math.min((now - lastTimestamp) / 1000, Data.GAME.maxDeltaTime);
    lastTimestamp = now;

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

  function startGame() {
    var state = State.restartRun();

    Game.startRun(state);
    resizeCanvas();
    UI.hideAllOverlays();
    UI.sync(state);
    renderFrame();
    resetFrameClock();

    return state;
  }

  function restartGame() {
    return startGame();
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

    if (global.document.hidden) {
      return;
    }

    renderFrame();
  }

  function init() {
    if (initialized) {
      return State.getRunState();
    }

    var state = State.initRun();

    UI.init();
    canvas = UI.getCanvas();
    Game.startRun(state);
    resizeCanvas();
    UI.showStartOverlay();
    UI.sync(state);
    renderFrame();

    global.addEventListener("resize", handleResize);
    global.addEventListener("orientationchange", handleResize);
    global.document.addEventListener("visibilitychange", handleVisibilityChange);

    startLoop();
    initialized = true;

    return state;
  }

  AbyssBreaker.Main = {
    init: init,
    startGame: startGame,
    restartGame: restartGame,
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
