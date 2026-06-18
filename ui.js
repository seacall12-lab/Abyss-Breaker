"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;
  var State = AbyssBreaker.State;
  var Game = AbyssBreaker.Game;

  if (!Data || !State || !Game) {
    throw new Error("AbyssBreaker.Data, State, and Game must be loaded before ui.js");
  }

  var dom = {};
  var initialized = false;
  var activePointerId = null;

  function requireElement(id) {
    var element = global.document.getElementById(id);

    if (!element) {
      throw new Error("Missing DOM element: #" + id);
    }

    return element;
  }

  function collectDom() {
    dom.app = requireElement("app");
    dom.gameShell = requireElement("game-shell");
    dom.hpValue = requireElement("hp-value");
    dom.hpMax = requireElement("hp-max");
    dom.hpFill = requireElement("hp-fill");
    dom.waveValue = requireElement("wave-value");
    dom.goldValue = requireElement("gold-value");
    dom.scoreValue = requireElement("score-value");
    dom.bestWaveValue = requireElement("best-wave-value");
    dom.canvasWrap = requireElement("canvas-wrap");
    dom.canvas = requireElement("game-canvas");
    dom.aimGuide = requireElement("aim-guide");
    dom.pauseButton = requireElement("pause-button");
    dom.restartButton = requireElement("restart-button");
    dom.startOverlay = requireElement("start-overlay");
    dom.startButton = requireElement("start-button");
    dom.pauseOverlay = requireElement("pause-overlay");
    dom.resumeButton = requireElement("resume-button");
    dom.pauseRestartButton = requireElement("pause-restart-button");
    dom.gameoverOverlay = requireElement("gameover-overlay");
    dom.gameoverWave = requireElement("gameover-wave");
    dom.gameoverScore = requireElement("gameover-score");
    dom.gameoverBest = requireElement("gameover-best");
    dom.gameoverRestartButton = requireElement("gameover-restart-button");
    dom.upgradeOverlay = requireElement("upgrade-overlay");
    dom.upgradeTitle = requireElement("upgrade-title");
    dom.upgradeOptions = requireElement("upgrade-options");
  }

  function setHidden(element, hidden) {
    element.classList.toggle("is-hidden", !!hidden);
  }

  function setText(element, value) {
    element.textContent = String(value);
  }

  function formatInteger(value) {
    if (typeof value !== "number" || !isFinite(value)) {
      return "0";
    }

    return String(Math.max(0, Math.floor(value)));
  }

  function getPointerPosition(event) {
    var rect = dom.canvas.getBoundingClientRect();
    var state = State.getRunState();
    var scaleX = rect.width > 0 ? state.viewport.cssWidth / rect.width : 1;
    var scaleY = rect.height > 0 ? state.viewport.cssHeight / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function isActivePlayMode(mode) {
    return mode === Data.MODES.READY || mode === Data.MODES.AIMING;
  }

  function canStartAim() {
    var state = State.getRunState();

    return activePointerId === null &&
      isActivePlayMode(state.mode) &&
      !state.flags.inputLocked &&
      state.mode !== Data.MODES.PAUSED &&
      state.mode !== Data.MODES.GAMEOVER;
  }

  function updateAimGuide(state) {
    var text = "아래에서 드래그해 조준";

    if (state.mode === Data.MODES.AIMING) {
      text = state.aim.valid ? "놓으면 발사" : "더 멀리 드래그";
    } else if (state.mode === Data.MODES.LAUNCHING || state.mode === Data.MODES.PLAYING) {
      text = "공이 모두 돌아오기를 기다리는 중";
    } else if (state.mode === Data.MODES.RESOLVING) {
      text = "턴 정산 중";
    } else if (state.mode === Data.MODES.PAUSED) {
      text = "일시정지";
    } else if (state.mode === Data.MODES.GAMEOVER) {
      text = "게임 오버";
    }

    setText(dom.aimGuide, text);
  }

  function updateHud(state) {
    var hp = Math.max(0, Math.ceil(state.player.hp));
    var maxHp = Math.max(1, Math.ceil(state.player.maxHp));
    var hpRatio = Math.max(0, Math.min(1, hp / maxHp));

    setText(dom.hpValue, hp);
    setText(dom.hpMax, maxHp);
    dom.hpFill.style.transform = "scaleX(" + hpRatio + ")";
    setText(dom.waveValue, formatInteger(state.run.wave));
    setText(dom.goldValue, formatInteger(state.run.gold));
    setText(dom.scoreValue, formatInteger(state.run.score));
    setText(dom.bestWaveValue, formatInteger(state.persistent.bestWave));
    state.flags.needsHudUpdate = false;
  }

  function updateGameoverPanel(state) {
    setText(dom.gameoverWave, formatInteger(state.run.wave));
    setText(dom.gameoverScore, formatInteger(state.run.score));
    setText(dom.gameoverBest, formatInteger(state.persistent.bestWave));
  }

  function hideAllOverlays() {
    setHidden(dom.startOverlay, true);
    setHidden(dom.pauseOverlay, true);
    setHidden(dom.gameoverOverlay, true);
    setHidden(dom.upgradeOverlay, true);
  }

  function syncOverlays(state) {
    setHidden(dom.upgradeOverlay, true);

    if (state.mode === Data.MODES.PAUSED) {
      setHidden(dom.startOverlay, true);
      setHidden(dom.pauseOverlay, false);
      setHidden(dom.gameoverOverlay, true);
      return;
    }

    if (state.mode === Data.MODES.GAMEOVER) {
      updateGameoverPanel(state);
      setHidden(dom.startOverlay, true);
      setHidden(dom.pauseOverlay, true);
      setHidden(dom.gameoverOverlay, false);
      return;
    }

    setHidden(dom.pauseOverlay, true);
    setHidden(dom.gameoverOverlay, true);
  }

  function syncButtons(state) {
    var canPause = state.mode !== Data.MODES.PAUSED &&
      state.mode !== Data.MODES.GAMEOVER &&
      state.mode !== Data.MODES.BOOT;

    dom.pauseButton.disabled = !canPause;
    dom.restartButton.disabled = false;
    dom.startButton.disabled = false;
    dom.resumeButton.disabled = state.mode !== Data.MODES.PAUSED;
  }

  function sync(state) {
    var runState = state || State.getRunState();

    updateHud(runState);
    updateAimGuide(runState);
    syncOverlays(runState);
    syncButtons(runState);

    return runState;
  }

  function startGame() {
    hideAllOverlays();

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.restartGame === "function") {
      AbyssBreaker.Main.restartGame();
      return;
    }

    var state = State.restartRun();
    Game.startRun(state);
    sync(state);
  }

  function restartGame() {
    activePointerId = null;

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.restartGame === "function") {
      AbyssBreaker.Main.restartGame();
      return;
    }

    var state = State.restartRun();
    Game.startRun(state);
    hideAllOverlays();
    sync(state);
  }

  function pauseGame() {
    var state = State.getRunState();

    if (state.mode === Data.MODES.PAUSED || state.mode === Data.MODES.GAMEOVER) {
      return;
    }

    if (state.mode === Data.MODES.AIMING) {
      Game.cancelAim(state);
    }

    activePointerId = null;
    State.setMode(Data.MODES.PAUSED);
    sync(State.getRunState());
  }

  function resumeGame() {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.PAUSED) {
      return;
    }

    var nextMode = state.previousMode;

    if (!nextMode || nextMode === Data.MODES.PAUSED || nextMode === Data.MODES.GAMEOVER || nextMode === Data.MODES.AIMING) {
      nextMode = Data.MODES.READY;
    }

    State.setMode(nextMode);

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.resetFrameClock === "function") {
      AbyssBreaker.Main.resetFrameClock();
    }

    sync(State.getRunState());
  }

  function handlePointerDown(event) {
    if (!canStartAim()) {
      return;
    }

    var position = getPointerPosition(event);

    if (!Game.beginAim(position.x, position.y, State.getRunState())) {
      return;
    }

    activePointerId = event.pointerId;

    if (typeof dom.canvas.setPointerCapture === "function") {
      try {
        dom.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        activePointerId = event.pointerId;
      }
    }

    event.preventDefault();
    sync(State.getRunState());
  }

  function handlePointerMove(event) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    var state = State.getRunState();

    if (state.mode !== Data.MODES.AIMING) {
      activePointerId = null;
      return;
    }

    var position = getPointerPosition(event);
    Game.updateAim(position.x, position.y, state);
    event.preventDefault();
    sync(state);
  }

  function finishPointer(event, shouldCommit) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    var state = State.getRunState();

    if (state.mode === Data.MODES.AIMING) {
      if (shouldCommit && state.aim.valid) {
        Game.commitAim(state);
      } else {
        Game.cancelAim(state);
      }
    }

    if (typeof dom.canvas.releasePointerCapture === "function") {
      try {
        dom.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        activePointerId = null;
      }
    }

    activePointerId = null;
    event.preventDefault();
    sync(State.getRunState());
  }

  function handlePointerUp(event) {
    finishPointer(event, true);
  }

  function handlePointerCancel(event) {
    finishPointer(event, false);
  }

  function bindEvents() {
    dom.startButton.addEventListener("click", startGame);
    dom.pauseButton.addEventListener("click", pauseGame);
    dom.restartButton.addEventListener("click", restartGame);
    dom.resumeButton.addEventListener("click", resumeGame);
    dom.pauseRestartButton.addEventListener("click", restartGame);
    dom.gameoverRestartButton.addEventListener("click", restartGame);

    dom.canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
    dom.canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
    global.addEventListener("pointerup", handlePointerUp, { passive: false });
    global.addEventListener("pointercancel", handlePointerCancel, { passive: false });
    global.addEventListener("blur", function () {
      var state = State.getRunState();

      if (state.mode === Data.MODES.AIMING) {
        Game.cancelAim(state);
        activePointerId = null;
        sync(state);
      }
    });
  }

  function init() {
    if (initialized) {
      return dom;
    }

    collectDom();
    bindEvents();
    initialized = true;
    sync(State.getRunState());

    return dom;
  }

  AbyssBreaker.UI = {
    init: init,
    dom: dom,
    sync: sync,
    updateHud: updateHud,
    updateGameoverPanel: updateGameoverPanel,
    showStartOverlay: function () {
      setHidden(dom.startOverlay, false);
    },
    hideAllOverlays: hideAllOverlays,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    restartGame: restartGame,
    getCanvas: function () {
      return dom.canvas;
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
