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
    dom.livesValue = requireElement("lives-value");
    dom.scoreValue = requireElement("score-value");
    dom.bestScoreValue = requireElement("best-score-value");
    dom.stageValue = requireElement("stage-value");
    dom.canvasWrap = requireElement("canvas-wrap");
    dom.canvas = requireElement("game-canvas");
    dom.controlGuide = requireElement("control-guide");
    dom.launchButton = requireElement("launch-button");
    dom.pauseButton = requireElement("pause-button");
    dom.restartButton = requireElement("restart-button");
    dom.startOverlay = requireElement("start-overlay");
    dom.startButton = requireElement("start-button");
    dom.pauseOverlay = requireElement("pause-overlay");
    dom.resumeButton = requireElement("resume-button");
    dom.pauseRestartButton = requireElement("pause-restart-button");
    dom.lifeLostOverlay = requireElement("life-lost-overlay");
    dom.continueButton = requireElement("continue-button");
    dom.stageClearOverlay = requireElement("stage-clear-overlay");
    dom.stageClearScore = requireElement("stage-clear-score");
    dom.nextStageButton = requireElement("next-stage-button");
    dom.stageRestartButton = requireElement("stage-restart-button");
    dom.gameoverOverlay = requireElement("gameover-overlay");
    dom.gameoverScore = requireElement("gameover-score");
    dom.gameoverBest = requireElement("gameover-best");
    dom.gameoverRestartButton = requireElement("gameover-restart-button");
  }

  function setHidden(element, hidden) {
    element.classList.toggle("is-hidden", !!hidden);
  }

  function setText(element, value) {
    element.textContent = String(value);
  }

  function formatInteger(value) {
    return String(Math.max(0, Math.floor(typeof value === "number" && isFinite(value) ? value : 0)));
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

  function updateHud(state) {
    setText(dom.livesValue, formatInteger(state.lives));
    setText(dom.scoreValue, formatInteger(state.score));
    setText(dom.bestScoreValue, formatInteger(state.bestScore));
    setText(dom.stageValue, formatInteger(state.stage));
    state.flags.needsHudUpdate = false;
  }

  function updateGuide(state) {
    var text = "좌우로 움직이고 발사하세요.";

    if (state.mode === Data.MODES.PLAYING) {
      text = "공을 받아 벽돌을 깨세요.";
    } else if (state.mode === Data.MODES.PAUSED) {
      text = "일시정지 중입니다.";
    } else if (state.mode === Data.MODES.LIFE_LOST) {
      text = "계속을 누르면 공이 다시 배치됩니다.";
    } else if (state.mode === Data.MODES.STAGE_CLEAR) {
      text = "스테이지를 클리어했습니다.";
    } else if (state.mode === Data.MODES.GAMEOVER) {
      text = "게임오버입니다.";
    }

    setText(dom.controlGuide, text);
  }

  function hideAllOverlays() {
    setHidden(dom.startOverlay, true);
    setHidden(dom.pauseOverlay, true);
    setHidden(dom.lifeLostOverlay, true);
    setHidden(dom.stageClearOverlay, true);
    setHidden(dom.gameoverOverlay, true);
  }

  function syncOverlays(state) {
    setHidden(dom.startOverlay, true);
    setHidden(dom.pauseOverlay, state.mode !== Data.MODES.PAUSED);
    setHidden(dom.lifeLostOverlay, state.mode !== Data.MODES.LIFE_LOST);
    setHidden(dom.stageClearOverlay, state.mode !== Data.MODES.STAGE_CLEAR);
    setHidden(dom.gameoverOverlay, state.mode !== Data.MODES.GAMEOVER);

    if (state.mode === Data.MODES.STAGE_CLEAR) {
      setText(dom.stageClearScore, formatInteger(state.score));
    }

    if (state.mode === Data.MODES.GAMEOVER) {
      setText(dom.gameoverScore, formatInteger(state.score));
      setText(dom.gameoverBest, formatInteger(state.bestScore));
    }
  }

  function syncButtons(state) {
    dom.launchButton.disabled = state.mode !== Data.MODES.READY;
    dom.pauseButton.disabled = state.mode !== Data.MODES.READY && state.mode !== Data.MODES.PLAYING;
    dom.restartButton.disabled = false;
    dom.resumeButton.disabled = state.mode !== Data.MODES.PAUSED;
  }

  function sync(state) {
    var runState = state || State.getRunState();

    updateHud(runState);
    updateGuide(runState);
    syncOverlays(runState);
    syncButtons(runState);

    return runState;
  }

  function startGame() {
    activePointerId = null;

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.restartGame === "function") {
      AbyssBreaker.Main.restartGame();
    } else {
      Game.startRun(State.restartRun());
    }

    hideAllOverlays();
    sync(State.getRunState());
  }

  function restartGame() {
    startGame();
  }

  function launch() {
    if (Game.launchBall(State.getRunState())) {
      hideAllOverlays();
      sync(State.getRunState());
    }
  }

  function pauseGame() {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.READY && state.mode !== Data.MODES.PLAYING) {
      return;
    }

    activePointerId = null;
    State.setMode(Data.MODES.PAUSED);
    sync(state);
  }

  function resumeGame() {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.PAUSED) {
      return;
    }

    var nextMode = state.previousMode === Data.MODES.PLAYING ? Data.MODES.PLAYING : Data.MODES.READY;
    State.setMode(nextMode);

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.resetFrameClock === "function") {
      AbyssBreaker.Main.resetFrameClock();
    }

    sync(state);
  }

  function continueAfterLifeLost() {
    if (Game.continueAfterLifeLost(State.getRunState())) {
      hideAllOverlays();
      sync(State.getRunState());
    }
  }

  function nextStage() {
    Game.nextStage(State.getRunState());
    hideAllOverlays();
    sync(State.getRunState());
  }

  function restartStage() {
    Game.restartStage(State.getRunState());
    hideAllOverlays();
    sync(State.getRunState());
  }

  function handlePointerDown(event) {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.READY && state.mode !== Data.MODES.PLAYING) {
      return;
    }

    var position = getPointerPosition(event);

    activePointerId = event.pointerId;
    state.input.pointerActive = true;
    state.input.pointerId = event.pointerId;
    state.input.pointerStartX = position.x;
    state.input.pointerStartY = position.y;
    state.input.pointerMoved = false;
    Game.movePaddleTo(position.x, state);

    if (typeof dom.canvas.setPointerCapture === "function") {
      try {
        dom.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        activePointerId = event.pointerId;
      }
    }

    event.preventDefault();
  }

  function handlePointerMove(event) {
    var state = State.getRunState();

    if (event.pointerType === "mouse" && activePointerId === null && (state.mode === Data.MODES.READY || state.mode === Data.MODES.PLAYING)) {
      Game.movePaddleTo(getPointerPosition(event).x, state);
      return;
    }

    if (activePointerId !== event.pointerId) {
      return;
    }

    var position = getPointerPosition(event);
    var dx = position.x - state.input.pointerStartX;
    var dy = position.y - state.input.pointerStartY;

    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      state.input.pointerMoved = true;
    }

    Game.movePaddleTo(position.x, state);
    event.preventDefault();
  }

  function finishPointer(event) {
    var state = State.getRunState();

    if (activePointerId !== event.pointerId) {
      return;
    }

    if (typeof dom.canvas.releasePointerCapture === "function") {
      try {
        dom.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        activePointerId = null;
      }
    }

    if (state.mode === Data.MODES.READY && !state.input.pointerMoved) {
      launch();
    }

    state.input.pointerActive = false;
    state.input.pointerId = null;
    activePointerId = null;
    event.preventDefault();
  }

  function handlePointerCancel(event) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    var state = State.getRunState();
    state.input.pointerActive = false;
    state.input.pointerId = null;
    activePointerId = null;
    event.preventDefault();
  }

  function bindEvents() {
    dom.startButton.addEventListener("click", startGame);
    dom.launchButton.addEventListener("click", launch);
    dom.pauseButton.addEventListener("click", pauseGame);
    dom.restartButton.addEventListener("click", restartGame);
    dom.resumeButton.addEventListener("click", resumeGame);
    dom.pauseRestartButton.addEventListener("click", restartGame);
    dom.continueButton.addEventListener("click", continueAfterLifeLost);
    dom.nextStageButton.addEventListener("click", nextStage);
    dom.stageRestartButton.addEventListener("click", restartStage);
    dom.gameoverRestartButton.addEventListener("click", restartGame);

    dom.canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
    dom.canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
    global.addEventListener("pointerup", finishPointer, { passive: false });
    global.addEventListener("pointercancel", handlePointerCancel, { passive: false });
    global.addEventListener("blur", function () {
      activePointerId = null;
      State.getRunState().input.pointerActive = false;
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
