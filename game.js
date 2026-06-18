"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;
  var State = AbyssBreaker.State;

  if (!Data || !State) {
    throw new Error("AbyssBreaker.Data and AbyssBreaker.State must be loaded before game.js");
  }

  var EPSILON = 0.0001;

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getState(state) {
    return state || State.getRunState();
  }

  function getWidth(state) {
    return Math.max(1, state.viewport.cssWidth || Data.CANVAS.designWidth);
  }

  function getHeight(state) {
    return Math.max(1, state.viewport.cssHeight || Data.CANVAS.designHeight);
  }

  function getStageData(stageOrState) {
    var stageNumber = typeof stageOrState === "number" ? stageOrState : stageOrState.stage;
    var state = typeof stageOrState === "number" ? null : stageOrState;
    var number = Math.max(1, Math.floor(stageNumber || 1));
    var index = (number - 1) % Data.STAGES.length;
    var base = Data.STAGES[index];
    var stage = JSON.parse(JSON.stringify(base));
    var rules = state ? getGameModeRules(state) : {};

    stage.id = number;

    if (rules.endless && number > Data.GAME.finalStage) {
      var scale = Math.floor((number - Data.GAME.finalStage) / Math.max(1, rules.scalingEvery || 5)) + 1;
      stage.name = "무한 " + number;
      stage.brickHpMultiplier = clamp(base.brickHpMultiplier + scale * 0.12, 1, 3.2);
      stage.ballSpeedMultiplier = clamp(base.ballSpeedMultiplier + scale * 0.015, 1, 1.22);
      stage.itemDropMultiplier = clamp(base.itemDropMultiplier + scale * 0.015, 0.8, 1.35);
      stage.backgroundVariant = number % 10;

      if (number % Math.max(1, rules.bossEvery || 5) === 0) {
        stage.type = "boss";
        stage.bossId = number % 10 === 0 ? "core" : "sentinel";
      } else {
        stage.type = "normal";
        stage.bossId = null;
      }
    }

    return stage;
  }

  function getBossData(id) {
    return id ? Data.BOSSES[id] : null;
  }

  function getUpgradeLevel(state, id) {
    return state.upgrades && state.upgrades.levels ? (state.upgrades.levels[id] || 0) : 0;
  }

  function getUpgradeById(id) {
    for (var index = 0; index < Data.UPGRADES.length; index++) {
      if (Data.UPGRADES[index].id === id) {
        return Data.UPGRADES[index];
      }
    }

    return null;
  }

  function getMetaLevel(state, id) {
    return state.persistent && state.persistent.metaUpgrades ? (state.persistent.metaUpgrades[id] || 0) : 0;
  }

  function getClassData(state) {
    var id = state.selectedClassId || (state.persistent && state.persistent.selectedClassId) || "balanced";
    return Data.CLASSES[id] || Data.CLASSES.balanced;
  }

  function getGameModeData(state) {
    var id = state.gameModeId || (state.persistent && state.persistent.selectedGameModeId) || "standard";
    return Data.GAME_MODES[id] || Data.GAME_MODES.standard;
  }

  function getGameModeRules(state) {
    return getGameModeData(state).rules || {};
  }

  function modeRuleListHas(state, key, id) {
    var list = getGameModeRules(state)[key];
    return Array.isArray(list) && list.indexOf(id) !== -1;
  }

  function emitFeedback(kind, vibration) {
    if (!AbyssBreaker.Feedback) {
      return;
    }

    if (typeof AbyssBreaker.Feedback.playSound === "function") {
      AbyssBreaker.Feedback.playSound(kind);
    }

    if (typeof AbyssBreaker.Feedback.vibrate === "function") {
      AbyssBreaker.Feedback.vibrate(vibration);
    }
  }

  function hasRelic(state, id) {
    return state.selectedRelicId === id || (Array.isArray(state.selectedRelicIds) && state.selectedRelicIds.indexOf(id) !== -1);
  }

  function isFocusedLensActive(state) {
    return hasRelic(state, "focused_lens") && activeBallCount(state) === 1;
  }

  function getRelicById(id) {
    for (var index = 0; index < Data.RELICS.length; index++) {
      if (Data.RELICS[index].id === id) {
        return Data.RELICS[index];
      }
    }

    return null;
  }

  function getPaddleWidthMultiplier(state) {
    return getClassData(state).paddleWidthMultiplier *
      (1 + getMetaLevel(state, "paddleWidth") * 0.03) *
      (1 + getUpgradeLevel(state, "paddle_guard") * 0.12);
  }

  function getMaxBalls(state) {
    return Data.GAME.maxBalls + getUpgradeLevel(state, "multi_capacity") * 2;
  }

  function getStartBallCount(state) {
    var relicBonus = hasRelic(state, "twin_core") ? 1 : 0;
    return clamp(1 + getUpgradeLevel(state, "split_start") + relicBonus, 1, getMaxBalls(state));
  }

  function getBrickDamage(state) {
    return 1 + getClassData(state).brickDamageAdd + getUpgradeLevel(state, "break_power") + (isFocusedLensActive(state) ? 1 : 0);
  }

  function getPierceCount(state) {
    return getUpgradeLevel(state, "piercing_orb") + (hasRelic(state, "piercing_crystal") ? 1 : 0);
  }

  function getScoreMultiplier(state) {
    return getClassData(state).scoreMultiplier *
      getGameModeData(state).scoreMultiplier *
      (1 + getMetaLevel(state, "scoreBonus") * 0.05) *
      (1 + getUpgradeLevel(state, "score_amp") * 0.25) *
      (isFocusedLensActive(state) ? 1.3 : 1);
  }

  function getDropMultiplier(state) {
    return 1 + getUpgradeLevel(state, "nature_drop") * 0.2;
  }

  function getDurationMultiplier(state) {
    return 1 + getUpgradeLevel(state, "duration_boost") * 0.25;
  }

  function getDestroyExplosionChance(state) {
    var level = getUpgradeLevel(state, "blast_echo");
    var relicBonus = hasRelic(state, "blast_insignia") ? 0.25 : 0;

    if (level <= 0) {
      return clamp(relicBonus, 0, 0.8);
    }

    return clamp(0.2 + (level - 1) * 0.15 + relicBonus, 0, 0.8);
  }

  function getCurrentBallSpeed(state) {
    var stage = getStageData(state);
    var rules = getGameModeRules(state);
    var speedMultiplier = modeRuleListHas(state, "disabledUpgrades", "slow_time") ? 1 : 1 - getUpgradeLevel(state, "slow_time") * 0.07;
    var itemMultiplier = modeRuleListHas(state, "disabledItems", "slow_ball") ? 1 : (state.activeEffects.slowBallTimeRemaining > 0 ? getItemDefinition("slow_ball").value : 1);

    return clamp(
      Data.BALL.speed * stage.ballSpeedMultiplier * speedMultiplier * itemMultiplier * getClassData(state).ballSpeedMultiplier * (rules.ballSpeedMultiplier || 1),
      Data.BALL.minSpeed,
      Data.BALL.maxSpeed * (rules.ballMaxMultiplier || 1)
    );
  }

  function getBallSpeed(state, ball) {
    var rules = getGameModeRules(state);
    return clamp(getCurrentBallSpeed(state) * (ball && ball.speedMultiplier ? ball.speedMultiplier : 1), Data.BALL.minSpeed, Data.BALL.maxSpeed * 1.2 * (rules.ballMaxMultiplier || 1));
  }

  function addLimited(list, item, limit) {
    list.push(item);

    while (list.length > limit) {
      list.shift();
    }
  }

  function addParticles(state, x, y, color, count) {
    for (var index = 0; index < count; index++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 40 + Math.random() * 130;

      addLimited(state.particles, {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2.5,
        color: color,
        age: 0,
        life: 0.28 + Math.random() * 0.28
      }, Data.EFFECT_LIMITS.particles);
    }
  }

  function addFloatingText(state, x, y, text, color) {
    addLimited(state.floatingTexts, {
      x: x,
      y: y,
      text: String(text),
      color: color || "#ffffff",
      age: 0,
      life: 0.75,
      vy: -34
    }, Data.EFFECT_LIMITS.floatingTexts);
  }

  function addLineEffect(state, x1, y1, x2, y2, color) {
    addLimited(state.effects, {
      type: "line",
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      color: color,
      age: 0,
      life: 0.18
    }, 30);
  }

  function addRingEffect(state, x, y, radius, color) {
    addLimited(state.effects, {
      type: "ring",
      x: x,
      y: y,
      radius: radius,
      color: color,
      age: 0,
      life: 0.28
    }, 30);
  }

  function triggerScreenShake(state, magnitude, duration) {
    state.effects.screenShake = {
      time: duration,
      duration: duration,
      magnitude: magnitude
    };
  }

  function getBrickLayout(state) {
    var width = getWidth(state);
    var cfg = Data.BRICKS;
    var stage = getStageData(state);
    var gap = cfg.gap;
    var side = cfg.sidePadding;
    var brickWidth = (width - side * 2 - gap * (cfg.columns - 1)) / cfg.columns;

    return {
      columns: cfg.columns,
      gap: gap,
      side: side,
      top: stage.type === "boss" ? cfg.bossStageTop : cfg.top,
      brickWidth: Math.max(20, brickWidth),
      brickHeight: cfg.height
    };
  }

  function relayoutBricks(state) {
    var layout = getBrickLayout(state);

    state.bricks.forEach(function (brick) {
      brick.x = layout.side + brick.col * (layout.brickWidth + layout.gap);
      brick.y = layout.top + brick.row * (layout.brickHeight + layout.gap);
      brick.width = layout.brickWidth;
      brick.height = layout.brickHeight;
    });
  }

  function relayoutBoss(state) {
    if (!state.boss) {
      return;
    }

    state.boss.x = clamp(state.boss.x, 12, getWidth(state) - state.boss.width - 12);
    state.boss.y = Math.max(30, state.boss.y);
  }

  function clampPaddle(state) {
    var width = getWidth(state);
    var maxWidth = width * Data.PADDLE.maxWidthRatio;
    var itemExpanded = state.paddle.expandTimeRemaining > 0;
    var base = state.paddle.baseWidthBeforeUpgrades * getPaddleWidthMultiplier(state);

    state.paddle.baseWidth = clamp(base, 36, maxWidth);
    state.paddle.width = itemExpanded ?
      clamp(state.paddle.baseWidth * Data.PADDLE.expandMultiplier, 36, maxWidth) :
      state.paddle.baseWidth;
    state.paddle.x = clamp(state.paddle.x, 0, width - state.paddle.width);
    state.paddle.targetX = clamp(state.paddle.targetX, state.paddle.width / 2, width - state.paddle.width / 2);
    state.paddle.y = getHeight(state) - Data.PADDLE.yOffset;
  }

  function setWorldSize(width, height, devicePixelRatio, state) {
    var runState = getState(state);

    if (isFiniteNumber(width) && width > 0) {
      runState.viewport.cssWidth = width;
    }

    if (isFiniteNumber(height) && height > 0) {
      runState.viewport.cssHeight = height;
    }

    runState.viewport.devicePixelRatio = clamp(devicePixelRatio || 1, 1, Data.CANVAS.maxDevicePixelRatio);
    runState.viewport.pixelWidth = Math.round(runState.viewport.cssWidth * runState.viewport.devicePixelRatio);
    runState.viewport.pixelHeight = Math.round(runState.viewport.cssHeight * runState.viewport.devicePixelRatio);

    clampPaddle(runState);
    relayoutBricks(runState);
    relayoutBoss(runState);
    syncAttachedBalls(runState);
    runState.flags.needsResize = false;

    return runState.viewport;
  }

  function createBrick(state, row, col, symbol, spawnedByBoss) {
    var stage = getStageData(state);
    var rules = getGameModeRules(state);
    var typeId = Data.BRICK_SYMBOLS[symbol] || "normal";

    if (rules.noItems && typeId === "item") {
      typeId = "strong";
    }

    var type = Data.BRICK_TYPES[typeId] || Data.BRICK_TYPES.normal;
    var hp = type.destructible ? Math.max(1, Math.round(type.hp * stage.brickHpMultiplier)) : type.hp;

    if (state.stage >= 6 && typeId === "strong") {
      hp += 1;
    }

    return {
      id: state.counters.nextBrickId++,
      type: type.id,
      row: row,
      col: col,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      hp: hp,
      maxHp: hp,
      score: Math.round(type.score * stage.brickHpMultiplier * (stage.scoreMultiplier || 1)),
      dropChance: type.dropChance * stage.itemDropMultiplier,
      guaranteedDrop: !!type.guaranteedDrop,
      explosive: !!type.explosive,
      destructible: !!type.destructible,
      alive: true,
      rewardGranted: false,
      dropGranted: false,
      spawnedByBoss: !!spawnedByBoss
    };
  }

  function buildStage(state) {
    var stage = getStageData(state);
    var bricks = [];

    stage.pattern.forEach(function (rowText, row) {
      String(rowText).split("").forEach(function (symbol, col) {
        if (symbol !== "0") {
          bricks.push(createBrick(state, row, col, symbol, false));
        }
      });
    });

    state.bricks = bricks;
    relayoutBricks(state);
  }

  function createBoss(state) {
    var stage = getStageData(state);
    var bossData = getBossData(stage.bossId);
    var endlessScale = getGameModeRules(state).endless ? Math.max(0, Math.floor((state.stage - Data.GAME.finalStage) / 5)) : 0;

    if (!bossData) {
      state.boss = null;
      return null;
    }

    state.boss = {
      id: bossData.id,
      name: bossData.name,
      x: (getWidth(state) - bossData.width) / 2,
      y: 42,
      width: bossData.width,
      height: bossData.height,
      vx: bossData.moveSpeed * (1 + endlessScale * 0.06),
      hp: Math.round(bossData.maxHp * (1 + endlessScale * 0.18)),
      maxHp: Math.round(bossData.maxHp * (1 + endlessScale * 0.18)),
      alive: true,
      rewardGranted: false,
      shieldActive: false,
      speedMultiplier: 1 + endlessScale * 0.06,
      spawnInterval: Math.max(2.4, bossData.spawnInterval * (1 - endlessScale * 0.04))
    };
    state.bossTimers.spawn = state.boss.spawnInterval;
    state.bossTimers.shield = 0;
    state.bossPhase = 0;
    return state.boss;
  }

  function createAttachedBall(state, offsetX) {
    return State.createAttachedBall(state.counters.nextBallId++, state.paddle, getPierceCount(state), offsetX || 0);
  }

  function resetBallToPaddle(state) {
    var count = getStartBallCount(state);
    var spacing = Math.min(18, state.paddle.width / Math.max(2, count + 1));
    state.balls = [];
    state.items = [];
    state.activeEffects.slowBallTimeRemaining = 0;
    state.paddle.expandTimeRemaining = 0;
    clampPaddle(state);

    for (var index = 0; index < count; index++) {
      var offset = (index - (count - 1) / 2) * spacing;
      state.balls.push(createAttachedBall(state, offset));
    }

    syncAttachedBalls(state);
  }

  function startStage(state) {
    var runState = getState(state);

    runState.flags.stageClearHandled = false;
    runState.flags.lifeLostHandled = false;
    runState.flags.gameoverHandled = false;
    runState.flags.runClearHandled = false;
    runState.flags.bossRewardGranted = false;
    runState.stageRelicFlags.guardianSaved = false;
    runState.particles = [];
    runState.effects = [];
    runState.floatingTexts = [];
    runState.items = [];
    runState.upgrades.pending = [];
    runState.upgrades.selectionLocked = false;
    buildStage(runState);
    createBoss(runState);
    resetBallToPaddle(runState);
    runState.highestStageReached = Math.max(runState.highestStageReached || 1, runState.stage);
    State.updateHighestStage(runState.stage);
    State.setMode(Data.MODES.READY);
    runState.flags.needsHudUpdate = true;
    return runState;
  }

  function startRun(state) {
    var runState = getState(state);
    var classData = getClassData(runState);
    var modeData = Data.GAME_MODES[runState.persistent.selectedGameModeId] || Data.GAME_MODES.standard;
    var rules = modeData.rules || {};
    var extraLives = rules.ignoreExtraLife ? 0 : getMetaLevel(runState, "extraLife") + classData.maxLifeAdd;

    runState.stage = Data.GAME.startingStage;
    runState.score = 0;
    runState.selectedClassId = runState.persistent.selectedClassId;
    runState.gameModeId = modeData.id;
    runState.gameModeRules = JSON.parse(JSON.stringify(rules));
    runState.maxLives = typeof rules.maxLives === "number" ? rules.maxLives : Data.GAME.maxLives + extraLives;
    runState.lives = typeof rules.startingLives === "number" ? rules.startingLives : Data.GAME.startingLives + extraLives;
    runState.runStartedAt = Date.now();
    runState.runElapsedTime = 0;
    runState.runStats = {
      bricksDestroyed: 0,
      itemsCollected: 0,
      bossesDefeated: 0,
      maxActiveBalls: 1,
      livesLost: 0,
      upgradesSelected: 0,
      relicsSelected: 0
    };
    runState.highestStageReached = Data.GAME.startingStage;
    runState.bossesDefeated = 0;
    runState.earnedAbyssStones = 0;
    runState.selectedRelicId = null;
    runState.selectedRelicIds = [];
    runState.relicChoices = [];
    runState.relicCounters = {
      bricksDestroyed: 0
    };
    runState.stageRelicFlags = {
      guardianSaved: false
    };
    runState.flags.runRewardGranted = false;
    runState.flags.runStarted = true;
    runState.paddle = State.createPaddle(getWidth(runState), getHeight(runState));
    runState.upgrades.levels = {};
    Data.UPGRADES.forEach(function (upgrade) {
      runState.upgrades.levels[upgrade.id] = 0;
    });
    runState.upgrades.chosen = [];
    runState.counters.nextBallId = 1;
    runState.counters.nextBrickId = 1;
    runState.counters.nextItemId = 1;
    return startStage(runState);
  }

  function movePaddleTo(x, state) {
    var runState = getState(state);

    if (!isFiniteNumber(x)) {
      return;
    }

    runState.paddle.targetX = clamp(x, runState.paddle.width / 2, getWidth(runState) - runState.paddle.width / 2);

    if (runState.mode === Data.MODES.READY || runState.mode === Data.MODES.PLAYING) {
      syncAttachedBalls(runState);
    }
  }

  function syncAttachedBalls(state) {
    var attached = state.balls.filter(function (ball) {
      return ball.attached;
    });
    var spacing = attached.length > 1 ? Math.min(18, state.paddle.width / (attached.length + 1)) : 0;

    attached.forEach(function (ball, index) {
      var offset = (index - (attached.length - 1) / 2) * spacing;
      ball.x = state.paddle.x + state.paddle.width / 2 + offset;
      ball.y = state.paddle.y - ball.radius - 1;
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.vx = 0;
      ball.vy = 0;
    });
  }

  function normalizeBallVelocity(state, ball, speed) {
    var targetSpeed = clamp(speed || getBallSpeed(state, ball), Data.BALL.minSpeed, Data.BALL.maxSpeed * 1.2);
    var length = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

    if (!isFiniteNumber(length) || length < EPSILON) {
      ball.vx = 0;
      ball.vy = -targetSpeed;
      return;
    }

    ball.vx = ball.vx / length * targetSpeed;
    ball.vy = ball.vy / length * targetSpeed;

    var minVertical = targetSpeed * Data.BALL.minVerticalRatio;

    if (Math.abs(ball.vy) < minVertical) {
      ball.vy = ball.vy < 0 ? -minVertical : minVertical;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, targetSpeed * targetSpeed - ball.vy * ball.vy));
    }
  }

  function launchBall(state) {
    var runState = getState(state);

    if (runState.mode !== Data.MODES.READY) {
      return false;
    }

    var attached = runState.balls.filter(function (ball) {
      return ball.attached;
    });
    var speed = getCurrentBallSpeed(runState);

    attached.forEach(function (ball, index) {
      var spreadIndex = index - (attached.length - 1) / 2;
      var angle = (Data.BALL.launchAngleDegrees + spreadIndex * Data.BALL.launchSpreadDegrees) * Math.PI / 180;

      ball.attached = false;
      ball.active = true;
      ball.x = runState.paddle.x + runState.paddle.width / 2 + spreadIndex * 10;
      ball.y = runState.paddle.y - ball.radius - 2;
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      ball.pierceRemaining = getPierceCount(runState);
      ball.speedMultiplier = 1;
      ball.collisionCooldowns = {};
      normalizeBallVelocity(runState, ball, speed);
    });

    State.setMode(Data.MODES.PLAYING);
    updateRunMaxBalls(runState);
    return true;
  }

  function circleRectOverlap(cx, cy, radius, rect) {
    var nearestX = clamp(cx, rect.x, rect.x + rect.width);
    var nearestY = clamp(cy, rect.y, rect.y + rect.height);
    var dx = cx - nearestX;
    var dy = cy - nearestY;

    return dx * dx + dy * dy <= radius * radius;
  }

  function circleRectCollision(ball, rect) {
    var nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
    var nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
    var dx = ball.x - nearestX;
    var dy = ball.y - nearestY;
    var distanceSq = dx * dx + dy * dy;

    if (distanceSq > ball.radius * ball.radius) {
      return null;
    }

    if (distanceSq > EPSILON) {
      var distance = Math.sqrt(distanceSq);
      return { nx: dx / distance, ny: dy / distance };
    }

    var left = Math.abs(ball.x - rect.x);
    var right = Math.abs((rect.x + rect.width) - ball.x);
    var top = Math.abs(ball.y - rect.y);
    var bottom = Math.abs((rect.y + rect.height) - ball.y);
    var min = Math.min(left, right, top, bottom);

    if (min === left) {
      return { nx: -1, ny: 0 };
    }

    if (min === right) {
      return { nx: 1, ny: 0 };
    }

    if (min === top) {
      return { nx: 0, ny: -1 };
    }

    return { nx: 0, ny: 1 };
  }

  function reflect(ball, nx, ny) {
    var dot = ball.vx * nx + ball.vy * ny;

    if (dot > 0) {
      return;
    }

    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
  }

  function separateBall(ball, rect, collision) {
    if (collision.nx < 0) {
      ball.x = Math.min(ball.x, rect.x - ball.radius - 0.2);
    } else if (collision.nx > 0) {
      ball.x = Math.max(ball.x, rect.x + rect.width + ball.radius + 0.2);
    }

    if (collision.ny < 0) {
      ball.y = Math.min(ball.y, rect.y - ball.radius - 0.2);
    } else if (collision.ny > 0) {
      ball.y = Math.max(ball.y, rect.y + rect.height + ball.radius + 0.2);
    }
  }

  function handleWallCollisions(state, ball) {
    var width = getWidth(state);

    if (!isFiniteNumber(ball.x) || !isFiniteNumber(ball.y) || !isFiniteNumber(ball.vx) || !isFiniteNumber(ball.vy)) {
      ball.active = false;
      return;
    }

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.radius > width) {
      ball.x = width - ball.radius;
      ball.vx = -Math.abs(ball.vx);
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    if (ball.y - ball.radius > getHeight(state)) {
      ball.active = false;
      ball.attached = false;
    }
  }

  function handlePaddleCollision(state, ball) {
    var paddle = state.paddle;

    if (ball.vy <= 0 || !circleRectOverlap(ball.x, ball.y, ball.radius, paddle)) {
      return;
    }

    var relativeHit = clamp((ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
    var maxAngle = 68 * Math.PI / 180;
    var angle = relativeHit * maxAngle;
    var speed = getCurrentBallSpeed(state);

    ball.y = paddle.y - ball.radius - 0.2;
    if (hasRelic(state, "acceleration_core")) {
      ball.speedMultiplier = clamp((ball.speedMultiplier || 1) * 1.02, 1, 1.2);
      speed = getBallSpeed(state, ball);
    } else {
      ball.speedMultiplier = 1;
    }
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    normalizeBallVelocity(state, ball, speed);
    addParticles(state, ball.x, ball.y + ball.radius, "#f3f7ff", 5);
  }

  function getItemDefinition(id) {
    for (var index = 0; index < Data.ITEMS.definitions.length; index++) {
      if (Data.ITEMS.definitions[index].id === id) {
        return Data.ITEMS.definitions[index];
      }
    }

    return Data.ITEMS.definitions[0];
  }

  function weightedItem(state) {
    var items = Data.ITEMS.definitions.filter(function (item) {
      return !modeRuleListHas(state, "disabledItems", item.id);
    });

    if (!items.length) {
      return Data.ITEMS.definitions[0];
    }

    var total = items.reduce(function (sum, item) {
      return sum + item.weight;
    }, 0);
    var roll = Math.random() * total;

    for (var index = 0; index < items.length; index++) {
      roll -= items[index].weight;

      if (roll <= 0) {
        return items[index];
      }
    }

    return items[0];
  }

  function spawnItem(state, brick, force) {
    if (getGameModeRules(state).noItems) {
      return;
    }

    var chance = clamp(brick.dropChance * getDropMultiplier(state) + getMetaLevel(state, "itemDrop") * 0.015, 0, 1);

    if (state.items.length >= Data.ITEMS.maxActive || (!force && Math.random() > chance)) {
      return;
    }

    var definition = weightedItem(state);

    state.items.push({
      id: state.counters.nextItemId++,
      type: definition.id,
      symbol: definition.symbol,
      color: definition.color,
      x: brick.x + brick.width / 2 - Data.ITEMS.width / 2,
      y: brick.y + brick.height / 2 - Data.ITEMS.height / 2,
      width: Data.ITEMS.width,
      height: Data.ITEMS.height,
      vy: Data.ITEMS.fallSpeed,
      active: true
    });
  }

  function awardScore(state, amount, x, y, extraMultiplier) {
    var score = Math.max(0, Math.round(amount * getScoreMultiplier(state) * (extraMultiplier || 1)));

    if (score <= 0) {
      return;
    }

    state.score += score;
    State.updateBestScore(state.score);
    addFloatingText(state, x, y, "+" + score, "#f2c94c");
    state.flags.needsHudUpdate = true;
  }

  function getAdjacentBricks(state, sourceBrick, radius) {
    return state.bricks.filter(function (brick) {
      if (!brick.alive || brick === sourceBrick) {
        return false;
      }

      return Math.abs(brick.row - sourceBrick.row) + Math.abs(brick.col - sourceBrick.col) <= radius;
    });
  }

  function applyDamageToBrick(state, brick, amount, source, depth) {
    if (!brick || !brick.alive || !brick.destructible) {
      return false;
    }

    var damage = Math.max(1, Math.floor(amount));
    brick.hp = Math.max(0, brick.hp - damage);
    addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, "#ffffff", 4);

    if (brick.hp > 0) {
      return false;
    }

    brick.alive = false;

    if (!brick.rewardGranted) {
      brick.rewardGranted = true;
      state.runStats.bricksDestroyed = (state.runStats.bricksDestroyed || 0) + 1;
      triggerAchievement(state, "first_brick");
      awardScore(state, brick.score, brick.x + brick.width / 2, brick.y + brick.height / 2);
    }

    if (!brick.dropGranted) {
      brick.dropGranted = true;
      spawnItem(state, brick, brick.guaranteedDrop);
    }

    if (hasRelic(state, "collector_mark")) {
      state.relicCounters.bricksDestroyed = (state.relicCounters.bricksDestroyed || 0) + 1;
      if (state.relicCounters.bricksDestroyed % 10 === 0) {
        spawnItem(state, brick, true);
      }
    }

    var type = Data.BRICK_TYPES[brick.type] || Data.BRICK_TYPES.normal;
    addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, type.fill, 14);
    triggerScreenShake(state, 2.5, 0.08);

    if (depth < 3 && (brick.explosive || (source === "direct" && Math.random() < getDestroyExplosionChance(state)))) {
      triggerExplosionDamage(state, brick, depth + 1);
    }

    return true;
  }

  function triggerExplosionDamage(state, sourceBrick, depth) {
    var cx = sourceBrick.x + sourceBrick.width / 2;
    var cy = sourceBrick.y + sourceBrick.height / 2;
    addRingEffect(state, cx, cy, Math.max(sourceBrick.width, sourceBrick.height) * 1.4, "#ffb15d");

    getAdjacentBricks(state, sourceBrick, 1).forEach(function (brick) {
      applyDamageToBrick(state, brick, 1, "explosion", depth);
    });
  }

  function handleBrickCollisions(state, ball) {
    for (var index = 0; index < state.bricks.length; index++) {
      var brick = state.bricks[index];

      if (!brick.alive) {
        continue;
      }

      var collision = circleRectCollision(ball, brick);

      if (!collision) {
        continue;
      }

      var lastHitFrame = ball.collisionCooldowns[brick.id] || -99;

      if (state.time.frame - lastHitFrame < 3) {
        return;
      }

      ball.collisionCooldowns[brick.id] = state.time.frame;

      var canPierce = brick.destructible && ball.pierceRemaining > 0;

      if (canPierce) {
        ball.pierceRemaining -= 1;
        addLineEffect(state, ball.prevX, ball.prevY, ball.x, ball.y, "rgba(160, 255, 240, 0.95)");
      } else {
        reflect(ball, collision.nx, collision.ny);
        separateBall(ball, brick, collision);
      }

      normalizeBallVelocity(state, ball);
      applyDamageToBrick(state, brick, getBrickDamage(state), "direct", 0);
      return;
    }
  }

  function handleBossCollision(state, ball) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      return;
    }

    var collision = circleRectCollision(ball, boss);

    if (!collision) {
      return;
    }

    var key = "boss:" + boss.id;
    var lastHitFrame = ball.collisionCooldowns[key] || -99;

    if (state.time.frame - lastHitFrame < 3) {
      return;
    }

    ball.collisionCooldowns[key] = state.time.frame;
    reflect(ball, collision.nx, collision.ny);
    separateBall(ball, boss, collision);
    normalizeBallVelocity(state, ball);
    applyDamageToBoss(state, getBrickDamage(state), ball.x, ball.y);
  }

  function applyDamageToBoss(state, amount, x, y) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      return false;
    }

    var bossData = getBossData(boss.id);
    var reduction = boss.shieldActive ? bossData.damageReduction : 0;
    var damageMultiplier = (1 + getMetaLevel(state, "bossDamage") * 0.05) * (hasRelic(state, "boss_breaker") ? 1.5 : 1);
    var damage = Math.max(1, Math.floor(amount * damageMultiplier * (1 - reduction)));

    boss.hp = Math.max(0, boss.hp - damage);
    addFloatingText(state, x, y, "-" + damage, boss.shieldActive ? "#65c8ff" : "#ffffff");
    addParticles(state, x, y, boss.shieldActive ? "#65c8ff" : "#e65f4b", 8);

    if (boss.hp > 0) {
      return false;
    }

    boss.alive = false;

    if (!boss.rewardGranted) {
      boss.rewardGranted = true;
      state.bossesDefeated = (state.bossesDefeated || 0) + 1;
      state.runStats.bossesDefeated = (state.runStats.bossesDefeated || 0) + 1;
      triggerAchievement(state, "sentinel_break");
      if ((state.runStats.livesLost || 0) === 0) {
        triggerAchievement(state, "flawless_boss");
      }
      awardScore(state, bossData.score, boss.x + boss.width / 2, boss.y + boss.height / 2, hasRelic(state, "boss_breaker") ? 1.25 : 1);
    }

    triggerScreenShake(state, 8, Data.EFFECT_LIMITS.screenShakeSeconds);
    return true;
  }

  function moveBall(state, ball, dt) {
    if (!ball.active || ball.attached) {
      return;
    }

    var distance = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * dt;
    var steps = clamp(Math.ceil(distance / Math.max(1, ball.radius * 0.75)), 1, 8);
    var stepDt = dt / steps;

    for (var step = 0; step < steps && ball.active; step++) {
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;

      handleWallCollisions(state, ball);

      if (ball.active) {
        handlePaddleCollision(state, ball);
        handleBossCollision(state, ball);
        handleBrickCollisions(state, ball);
      }
    }
  }

  function activeBallCount(state) {
    return state.balls.filter(function (ball) {
      return ball.active && !ball.attached;
    }).length;
  }

  function splitBalls(state) {
    var source = state.balls.filter(function (ball) {
      return ball.active && !ball.attached;
    })[0] || state.balls[0];

    if (!source) {
      return;
    }

    var additions = Math.min(2, getMaxBalls(state) - state.balls.length);
    var baseAngle = Math.atan2(source.vy || -1, source.vx || 0);

    for (var index = 0; index < additions; index++) {
      var spread = (index === 0 ? -1 : 1) * Data.BALL.launchSpreadDegrees * Math.PI / 180;
      var speed = getCurrentBallSpeed(state);
      var ball = State.createBall(state.counters.nextBallId++, source.x, source.y, false, getPierceCount(state));

      ball.speedMultiplier = 1;
      ball.vx = Math.cos(baseAngle + spread) * speed;
      ball.vy = Math.sin(baseAngle + spread) * speed;
      normalizeBallVelocity(state, ball, speed);
      state.balls.push(ball);
    }

    updateRunMaxBalls(state);
  }

  function applyItem(state, item) {
    if (getGameModeRules(state).noItems) {
      return;
    }

    if (item.type === "paddle_expand") {
      state.paddle.expandTimeRemaining = Data.PADDLE.expandDuration * getDurationMultiplier(state);
      clampPaddle(state);
      addFloatingText(state, item.x + item.width / 2, item.y, "패들 확장", "#35c98f");
    } else if (item.type === "multi_ball") {
      splitBalls(state);
      addFloatingText(state, item.x + item.width / 2, item.y, "멀티볼", "#f2c94c");
    } else if (item.type === "slow_ball") {
      state.activeEffects.slowBallTimeRemaining = getItemDefinition("slow_ball").duration * getDurationMultiplier(state);
      state.balls.forEach(function (ball) {
        if (ball.active && !ball.attached) {
          normalizeBallVelocity(state, ball, getBallSpeed(state, ball));
        }
      });
      addFloatingText(state, item.x + item.width / 2, item.y, "감속", "#65c8ff");
    }

    state.runStats.itemsCollected = (state.runStats.itemsCollected || 0) + 1;
    if (state.runStats.itemsCollected >= 20) {
      triggerAchievement(state, "collector");
    }
    addParticles(state, item.x + item.width / 2, item.y + item.height / 2, item.color, 12);
  }

  function updateItems(state, dt) {
    var paddle = state.paddle;

    state.items.forEach(function (item) {
      item.y += item.vy * dt;

      if (item.active &&
          item.x < paddle.x + paddle.width &&
          item.x + item.width > paddle.x &&
          item.y < paddle.y + paddle.height &&
          item.y + item.height > paddle.y) {
        item.active = false;
        applyItem(state, item);
      }

      if (item.y > getHeight(state) + item.height) {
        item.active = false;
      }
    });

    state.items = state.items.filter(function (item) {
      return item.active;
    });
  }

  function updatePaddle(state, dt) {
    var paddle = state.paddle;
    var desiredX = paddle.targetX - paddle.width / 2;
    var distance = desiredX - paddle.x;
    var maxStep = Data.PADDLE.speed * dt;

    if (Math.abs(distance) <= maxStep) {
      paddle.x = desiredX;
    } else {
      paddle.x += Math.sign(distance) * maxStep;
    }

    clampPaddle(state);
    syncAttachedBalls(state);
  }

  function updateTimers(state, dt) {
    if (state.paddle.expandTimeRemaining > 0) {
      state.paddle.expandTimeRemaining = Math.max(0, state.paddle.expandTimeRemaining - dt);

      if (state.paddle.expandTimeRemaining === 0) {
        var center = state.paddle.x + state.paddle.width / 2;
        clampPaddle(state);
        state.paddle.x = center - state.paddle.width / 2;
        clampPaddle(state);
      }
    }

    if (state.activeEffects.slowBallTimeRemaining > 0) {
      state.activeEffects.slowBallTimeRemaining = Math.max(0, state.activeEffects.slowBallTimeRemaining - dt);

      if (state.activeEffects.slowBallTimeRemaining === 0) {
        state.balls.forEach(function (ball) {
          if (ball.active && !ball.attached) {
            normalizeBallVelocity(state, ball, getBallSpeed(state, ball));
          }
        });
      }
    }
  }

  function updateVisualEffects(state, dt) {
    state.particles.forEach(function (particle) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.08, dt);
      particle.vy *= Math.pow(0.08, dt);
    });

    state.floatingTexts.forEach(function (text) {
      text.age += dt;
      text.y += text.vy * dt;
    });

    state.effects.forEach(function (effect) {
      if (effect && typeof effect.age === "number") {
        effect.age += dt;
      }
    });

    state.particles = state.particles.filter(function (particle) {
      return particle.age < particle.life;
    });
    state.floatingTexts = state.floatingTexts.filter(function (text) {
      return text.age < text.life;
    });
    var screenShake = state.effects.screenShake;
    state.effects = state.effects.filter(function (effect) {
      return !effect || typeof effect.life !== "number" || effect.age < effect.life;
    });
    state.effects.screenShake = screenShake;

    if (state.effects.screenShake && state.effects.screenShake.time > 0) {
      state.effects.screenShake.time = Math.max(0, state.effects.screenShake.time - dt);
    }
  }

  function countBossSpawnedBricks(state) {
    return state.bricks.filter(function (brick) {
      return brick.alive && brick.spawnedByBoss;
    }).length;
  }

  function spawnBossBricks(state, count) {
    var boss = state.boss;
    var bossData = boss ? getBossData(boss.id) : null;

    if (!bossData) {
      return;
    }

    var layout = getBrickLayout(state);
    var existing = {};

    state.bricks.forEach(function (brick) {
      if (brick.alive) {
        existing[brick.row + ":" + brick.col] = true;
      }
    });

    for (var i = 0; i < count && countBossSpawnedBricks(state) < bossData.maxSpawnedBricks; i++) {
      var row = 0;
      var col = Math.floor(Math.random() * layout.columns);
      var attempts = 0;

      while (existing[row + ":" + col] && attempts < layout.columns * 3) {
        col = (col + 1) % layout.columns;
        attempts++;
      }

      if (existing[row + ":" + col]) {
        continue;
      }

      var symbol = boss.id === "core" ? (Math.random() < 0.45 ? "3" : "2") : (Math.random() < 0.3 ? "2" : "1");
      var brick = createBrick(state, row, col, symbol, true);
      existing[row + ":" + col] = true;
      state.bricks.push(brick);
    }

    relayoutBricks(state);
  }

  function updateBoss(state, dt) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      return;
    }

    var bossData = getBossData(boss.id);
    var hpRatio = boss.hp / Math.max(1, boss.maxHp);
    var speed = (hpRatio <= 0.5 ? bossData.enragedMoveSpeed : bossData.moveSpeed) * (boss.speedMultiplier || 1);

    boss.vx = Math.sign(boss.vx || 1) * speed;
    boss.x += boss.vx * dt;

    if (boss.x < 12) {
      boss.x = 12;
      boss.vx = Math.abs(boss.vx);
    } else if (boss.x + boss.width > getWidth(state) - 12) {
      boss.x = getWidth(state) - 12 - boss.width;
      boss.vx = -Math.abs(boss.vx);
    }

    state.bossTimers.spawn -= dt;

    if (state.bossTimers.spawn <= 0) {
      var spawnCount = bossData.spawnCountMin + Math.floor(Math.random() * (bossData.spawnCountMax - bossData.spawnCountMin + 1));
      spawnBossBricks(state, spawnCount);
      state.bossTimers.spawn = boss.spawnInterval || bossData.spawnInterval;
    }

    if (boss.id === "core") {
      state.bossTimers.shield = (state.bossTimers.shield + dt) % bossData.shieldCycle;
      boss.shieldActive = state.bossTimers.shield <= bossData.shieldDuration;
    }
  }

  function hasLivingDestructibleBrick(state) {
    return state.bricks.some(function (brick) {
      return brick.alive && brick.destructible;
    });
  }

  function shouldStageClear(state) {
    var bossAlive = state.boss && state.boss.alive;
    return !bossAlive && !hasLivingDestructibleBrick(state);
  }

  function triggerAchievement(state, id) {
    if (State.unlockAchievement(id)) {
      addFloatingText(state, getWidth(state) / 2, 112, "업적 달성", "#f2c94c");
    }
  }

  function updateRunMaxBalls(state) {
    var count = activeBallCount(state);
    state.runStats.maxActiveBalls = Math.max(state.runStats.maxActiveBalls || 1, count);

    if (state.runStats.maxActiveBalls >= 5) {
      triggerAchievement(state, "five_balls");
    }
  }

  function getChallengeRecord(save, modeId) {
    return save.records.challenges[modeId];
  }

  function updateRecords(state, runClear) {
    var save = state.persistent;
    var modeId = state.gameModeId || "standard";
    var classId = state.selectedClassId || "balanced";
    var elapsed = Math.max(0, state.runElapsedTime || 0);

    save.records.totalBricksDestroyed += state.runStats.bricksDestroyed || 0;
    save.records.totalItemsCollected += state.runStats.itemsCollected || 0;
    save.records.totalBossesDefeated += state.runStats.bossesDefeated || 0;
    save.records.maxActiveBalls = Math.max(save.records.maxActiveBalls || 1, state.runStats.maxActiveBalls || 1);

    if (save.records.classes[classId]) {
      save.records.classes[classId].bestScore = Math.max(save.records.classes[classId].bestScore || 0, state.score);
    }

    if (modeId === "standard") {
      save.records.standard.bestScore = Math.max(save.records.standard.bestScore || 0, state.score);
      save.records.standard.bestStage = Math.max(save.records.standard.bestStage || 1, state.highestStageReached || 1);
      if (runClear) {
        save.records.standard.clearCount += 1;
        if (!save.records.standard.fastestClearTime || elapsed < save.records.standard.fastestClearTime) {
          save.records.standard.fastestClearTime = elapsed;
        }
      }
    } else if (modeId === "endless") {
      save.records.endless.bestScore = Math.max(save.records.endless.bestScore || 0, state.score);
      save.records.endless.bestStage = Math.max(save.records.endless.bestStage || 1, state.highestStageReached || 1);
      save.records.endless.bestBossesDefeated = Math.max(save.records.endless.bestBossesDefeated || 0, state.runStats.bossesDefeated || 0);
    } else if (save.records.challenges[modeId]) {
      var challenge = getChallengeRecord(save, modeId);
      challenge.bestScore = Math.max(challenge.bestScore || 0, state.score);
      challenge.bestStage = Math.max(challenge.bestStage || 1, state.highestStageReached || 1);
      if (runClear) {
        challenge.cleared = true;
        challenge.clearCount += 1;
        if (!challenge.fastestClearTime || elapsed < challenge.fastestClearTime) {
          challenge.fastestClearTime = elapsed;
        }
      }
    }

    state.persistent = State.savePersistent(save);
  }

  function checkRunAchievements(state, runClear) {
    if ((state.runStats.bricksDestroyed || 0) > 0) {
      triggerAchievement(state, "first_brick");
    }
    if ((state.runStats.bossesDefeated || 0) > 0) {
      triggerAchievement(state, "sentinel_break");
    }
    if (state.score >= 10000) {
      triggerAchievement(state, "score_10000");
    }
    if (state.score >= 50000) {
      triggerAchievement(state, "score_50000");
    }
    if ((state.runStats.itemsCollected || 0) >= 20) {
      triggerAchievement(state, "collector");
    }
    if (state.gameModeId === "endless" && (state.highestStageReached || 1) >= 20) {
      triggerAchievement(state, "endless_20");
    }
    if (runClear && state.gameModeId === "standard") {
      triggerAchievement(state, "standard_clear");
      if ((state.persistent.runClearCount || 0) >= 3) {
        triggerAchievement(state, "standard_clear_3");
      }
      if (state.selectedClassId === "balanced") {
        triggerAchievement(state, "balanced_clear");
      } else if (state.selectedClassId === "guardian") {
        triggerAchievement(state, "guardian_clear");
      } else if (state.selectedClassId === "destroyer") {
        triggerAchievement(state, "destroyer_clear");
      }
    }
    if (runClear && state.gameModeId !== "standard" && state.gameModeId !== "endless") {
      triggerAchievement(state, "challenge_clear");
    }
  }

  function calculateAbyssReward(state, runClear) {
    var reachedStage = Math.max(1, state.highestStageReached || state.stage || 1);
    var reward = reachedStage * Data.ABYSS_REWARD.stageMultiplier;

    reward += Math.floor(Math.max(0, state.score) / Data.ABYSS_REWARD.scoreDivisor);
    reward += Math.max(0, state.bossesDefeated || 0) * Data.ABYSS_REWARD.bossMultiplier;

    if (runClear) {
      reward += Data.ABYSS_REWARD.runClearBonus;
    }

    if (!state.flags.runStarted && state.score <= 0 && (state.bossesDefeated || 0) <= 0) {
      return 0;
    }

    if (reachedStage <= 1 && state.score <= 0 && (state.bossesDefeated || 0) <= 0 && !runClear) {
      return 0;
    }

    return Math.max(1, Math.floor(reward * getGameModeData(state).stoneMultiplier));
  }

  function grantRunReward(state, runClear) {
    if (state.flags.runRewardGranted) {
      return state.earnedAbyssStones || 0;
    }

    var reward = calculateAbyssReward(state, !!runClear);

    state.flags.runRewardGranted = true;
    state.earnedAbyssStones = reward;
    state.persistent.totalRuns = Math.max(0, Math.floor(state.persistent.totalRuns || 0)) + 1;

    if (runClear) {
      state.persistent.runClearCount = Math.max(0, Math.floor(state.persistent.runClearCount || 0)) + 1;
    }

    if (reward > 0) {
      state.persistent.abyssStones = Math.max(0, Math.floor(state.persistent.abyssStones || 0)) + reward;
      state.persistent.totalAbyssStonesEarned = Math.max(0, Math.floor(state.persistent.totalAbyssStonesEarned || 0)) + reward;
    }

    state.persistent = State.savePersistent(state.persistent);
    updateRecords(state, !!runClear);
    checkRunAchievements(state, !!runClear);

    if (runClear && state.gameModeId === "standard") {
      State.unlockAllModes();
    }

    emitFeedback(runClear ? "confirm" : "tap", runClear ? [24, 40, 24] : 18);

    return reward;
  }

  function createRelicChoices() {
    var state = State.getRunState();
    var pool = Data.RELICS.filter(function (relic) {
      return !hasRelic(state, relic.id) && !modeRuleListHas(state, "disabledRelics", relic.id);
    });
    var choices = [];

    while (choices.length < 3 && pool.length) {
      var index = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }

    return choices;
  }

  function enterRelicState(state) {
    state.relicChoices = createRelicChoices();

    if (!state.relicChoices.length) {
      State.setMode(Data.MODES.STAGE_CLEAR);
      return;
    }

    state.upgrades.pending = [];
    state.upgrades.selectionLocked = false;
    State.setMode(Data.MODES.RELIC);
    state.flags.needsHudUpdate = true;
  }

  function enterStageClear(state) {
    if (state.flags.stageClearHandled) {
      return;
    }

    state.flags.stageClearHandled = true;
    state.items = [];
    state.balls.forEach(function (ball) {
      ball.active = false;
      ball.attached = false;
    });
    awardScore(state, Data.SCORE.stageClear, getWidth(state) / 2, 80);
    State.updateHighestStage(state.stage);

    if (!getGameModeRules(state).endless && state.stage >= (getGameModeRules(state).finalStage || Data.GAME.finalStage)) {
      enterRunClear(state);
      return;
    }

    if (state.stage === 1) {
      triggerAchievement(state, "first_gate");
    }

    var rules = getGameModeRules(state);
    var relicLimit = rules.relicLimit || 1;
    var shouldOfferRelic = (state.stage === 5 || (rules.endless && state.stage % Math.max(1, rules.bossEvery || 5) === 0)) &&
      (state.selectedRelicIds || []).length < relicLimit;

    if (shouldOfferRelic) {
      enterRelicState(state);
      return;
    }

    State.setMode(Data.MODES.STAGE_CLEAR);
    state.flags.needsHudUpdate = true;
  }

  function enterRunClear(state) {
    if (state.flags.runClearHandled) {
      return;
    }

    state.flags.runClearHandled = true;
    state.items = [];
    state.balls.forEach(function (ball) {
      ball.active = false;
      ball.attached = false;
    });
    awardScore(state, Data.SCORE.runClear, getWidth(state) / 2, 92);
    State.updateBestScore(state.score);
    State.updateHighestStage(Data.GAME.finalStage);
    grantRunReward(state, true);
    State.setMode(Data.MODES.RUN_CLEAR);
    state.flags.needsHudUpdate = true;
  }

  function checkStageClear(state) {
    if (!state.flags.stageClearHandled && shouldStageClear(state)) {
      enterStageClear(state);
    }
  }

  function loseLife(state) {
    if (state.flags.lifeLostHandled || state.flags.stageClearHandled || state.mode !== Data.MODES.PLAYING) {
      return;
    }

    if (hasRelic(state, "guardian_field") && !state.stageRelicFlags.guardianSaved) {
      state.stageRelicFlags.guardianSaved = true;
      state.flags.lifeLostHandled = false;
      resetBallToPaddle(state);
      addFloatingText(state, getWidth(state) / 2, getHeight(state) * 0.58, "수호 역장", "#65c8ff");
      State.setMode(Data.MODES.READY);
      state.flags.needsHudUpdate = true;
      return;
    }

    state.flags.lifeLostHandled = true;
    state.lives = Math.max(0, state.lives - 1);
    state.runStats.livesLost = (state.runStats.livesLost || 0) + 1;
    triggerScreenShake(state, 7, Data.EFFECT_LIMITS.screenShakeSeconds);
    emitFeedback("error", [30, 30, 30]);

    if (state.lives <= 0) {
      state.flags.gameoverHandled = true;
      State.updateBestScore(state.score);
      grantRunReward(state, false);
      State.setMode(Data.MODES.GAMEOVER);
    } else {
      State.setMode(Data.MODES.LIFE_LOST);
    }

    state.flags.needsHudUpdate = true;
  }

  function removeInactiveBalls(state) {
    state.balls = state.balls.filter(function (ball) {
      return ball.active || ball.attached;
    });

    if (state.mode === Data.MODES.PLAYING && activeBallCount(state) === 0) {
      loseLife(state);
    }
  }

  function continueAfterLifeLost(state) {
    var runState = getState(state);

    if (runState.mode !== Data.MODES.LIFE_LOST) {
      return false;
    }

    runState.flags.lifeLostHandled = false;
    resetBallToPaddle(runState);
    State.setMode(Data.MODES.READY);
    return true;
  }

  function forfeitRun(state) {
    var runState = getState(state);

    if (!runState.flags.runStarted || runState.flags.runRewardGranted) {
      State.setMode(Data.MODES.LOBBY);
      return false;
    }

    runState.items = [];
    runState.balls.forEach(function (ball) {
      ball.active = false;
      ball.attached = false;
    });
    grantRunReward(runState, false);
    State.setMode(Data.MODES.GAMEOVER);
    return true;
  }

  function restartStage(state) {
    return startStage(getState(state));
  }

  function startNextStage(state) {
    var runState = getState(state);
    var rules = getGameModeRules(runState);

    if (!rules.endless && runState.stage >= (rules.finalStage || Data.GAME.finalStage)) {
      enterRunClear(runState);
      return runState;
    }

    runState.stage += 1;
    return startStage(runState);
  }

  function getAvailableUpgrades(state) {
    return Data.UPGRADES.filter(function (upgrade) {
      if (modeRuleListHas(state, "disabledUpgrades", upgrade.id)) {
        return false;
      }

      if (getUpgradeLevel(state, upgrade.id) >= upgrade.maxLevel) {
        return false;
      }

      if (upgrade.id === "life_repair" && state.lives >= state.maxLives) {
        return false;
      }

      return true;
    });
  }

  function pickWeightedUpgrade(candidates) {
    var total = candidates.reduce(function (sum, upgrade) {
      return sum + Math.max(0, upgrade.weight);
    }, 0);
    var roll = Math.random() * total;

    for (var index = 0; index < candidates.length; index++) {
      roll -= Math.max(0, candidates[index].weight);

      if (roll <= 0) {
        return candidates[index];
      }
    }

    return candidates[0] || null;
  }

  function createUpgradeChoices(state) {
    var candidates = getAvailableUpgrades(state).slice();
    var choices = [];

    while (choices.length < 3 && candidates.length) {
      var selected = pickWeightedUpgrade(candidates);

      if (!selected) {
        break;
      }

      choices.push({
        id: selected.id,
        name: selected.name,
        description: selected.description,
        category: selected.category,
        level: getUpgradeLevel(state, selected.id),
        nextLevel: getUpgradeLevel(state, selected.id) + 1,
        maxLevel: selected.maxLevel
      });

      candidates = candidates.filter(function (upgrade) {
        return upgrade.id !== selected.id;
      });
    }

    return choices;
  }

  function enterUpgradeState(state) {
    var runState = getState(state);

    if (runState.mode !== Data.MODES.STAGE_CLEAR) {
      return false;
    }

    var choices = createUpgradeChoices(runState);

    if (!choices.length) {
      startNextStage(runState);
      return true;
    }

    runState.upgrades.pending = choices;
    runState.upgrades.selectionLocked = false;
    State.setMode(Data.MODES.UPGRADE);
    return true;
  }

  function chooseRelic(relicId, state) {
    var runState = getState(state);
    var found = false;
    var rules = getGameModeRules(runState);
    var relicLimit = rules.relicLimit || 1;

    if (runState.mode !== Data.MODES.RELIC || (runState.selectedRelicIds || []).length >= relicLimit) {
      return false;
    }

    runState.relicChoices.forEach(function (relic) {
      if (relic.id === relicId) {
        found = true;
      }
    });

    if (!found || !getRelicById(relicId)) {
      return false;
    }

    runState.selectedRelicIds = runState.selectedRelicIds || [];
    runState.selectedRelicIds.push(relicId);
    runState.selectedRelicId = runState.selectedRelicIds[0] || relicId;
    runState.runStats.relicsSelected = (runState.runStats.relicsSelected || 0) + 1;
    runState.relicChoices = [];
    runState.stage += 1;
    startStage(runState);
    return true;
  }

  function applyUpgradeEffect(state, upgrade) {
    if (upgrade.effect === "healLife") {
      state.lives = Math.min(state.maxLives, state.lives + upgrade.value);
    } else if (upgrade.effect === "maxLifeAdd") {
      state.maxLives += upgrade.value;
      state.lives = Math.min(state.maxLives, state.lives + upgrade.value);
    } else if (upgrade.effect === "paddleWidthMultiplier") {
      clampPaddle(state);
      syncAttachedBalls(state);
    }

    state.balls.forEach(function (ball) {
      if (ball.active && !ball.attached) {
        normalizeBallVelocity(state, ball, getBallSpeed(state, ball));
      }
    });

    state.flags.needsHudUpdate = true;
  }

  function chooseUpgrade(upgradeId, state) {
    var runState = getState(state);

    if (runState.mode !== Data.MODES.UPGRADE || runState.upgrades.selectionLocked) {
      return false;
    }

    var pending = runState.upgrades.pending.some(function (upgrade) {
      return upgrade.id === upgradeId;
    });
    var upgrade = getUpgradeById(upgradeId);

    if (!pending || !upgrade || getUpgradeLevel(runState, upgradeId) >= upgrade.maxLevel) {
      return false;
    }

    runState.upgrades.selectionLocked = true;
    runState.upgrades.levels[upgradeId] = getUpgradeLevel(runState, upgradeId) + 1;
    runState.upgrades.chosen.push(upgrade.name + " Lv." + runState.upgrades.levels[upgradeId]);
    runState.upgrades.pending = [];
    runState.runStats.upgradesSelected = (runState.runStats.upgradesSelected || 0) + 1;
    applyUpgradeEffect(runState, upgrade);
    startNextStage(runState);
    return true;
  }

  function update(dt, state) {
    var runState = getState(state);
    var delta = isFiniteNumber(dt) ? clamp(dt, 0, Data.GAME.maxDeltaTime) : 0;

    runState.time.delta = delta;
    runState.time.elapsed += delta;
    runState.time.frame++;
    updateVisualEffects(runState, delta);

    if (runState.flags.runStarted && (runState.mode === Data.MODES.READY || runState.mode === Data.MODES.PLAYING)) {
      runState.runElapsedTime = Math.max(0, (runState.runElapsedTime || 0) + delta);
    }

    if (runState.mode === Data.MODES.PAUSED ||
        runState.mode === Data.MODES.GAMEOVER ||
        runState.mode === Data.MODES.RUN_CLEAR ||
        runState.mode === Data.MODES.UPGRADE ||
        runState.mode === Data.MODES.RELIC ||
        runState.mode === Data.MODES.META ||
        runState.mode === Data.MODES.CLASS_SELECT ||
        runState.mode === Data.MODES.LOBBY ||
        runState.mode === Data.MODES.STAGE_CLEAR ||
        runState.mode === Data.MODES.LIFE_LOST ||
        delta <= 0) {
      return runState;
    }

    if (runState.mode === Data.MODES.READY || runState.mode === Data.MODES.PLAYING) {
      updatePaddle(runState, delta);
    }

    if (runState.mode === Data.MODES.PLAYING) {
      updateTimers(runState, delta);
      updateItems(runState, delta);
      updateBoss(runState, delta);
      updateRunMaxBalls(runState);

      runState.balls.forEach(function (ball) {
        moveBall(runState, ball, delta);
      });

      checkStageClear(runState);

      if (runState.mode === Data.MODES.PLAYING) {
        removeInactiveBalls(runState);
      }
    }

    return runState;
  }

  AbyssBreaker.Game = {
    setWorldSize: setWorldSize,
    getBrickLayout: getBrickLayout,
    getStageData: getStageData,
    getUpgradeLevel: getUpgradeLevel,
    getAvailableUpgrades: getAvailableUpgrades,
    createUpgradeChoices: createUpgradeChoices,
    relayoutBricks: relayoutBricks,
    startRun: startRun,
    startStage: startStage,
    restartStage: restartStage,
    startNextStage: startNextStage,
    enterUpgradeState: enterUpgradeState,
    chooseUpgrade: chooseUpgrade,
    chooseRelic: chooseRelic,
    grantRunReward: grantRunReward,
    calculateAbyssReward: calculateAbyssReward,
    movePaddleTo: movePaddleTo,
    launchBall: launchBall,
    continueAfterLifeLost: continueAfterLifeLost,
    forfeitRun: forfeitRun,
    update: update,
    clamp: clamp,
    getCurrentBallSpeed: getCurrentBallSpeed,
    applyDamageToBrick: applyDamageToBrick,
    applyDamageToBoss: applyDamageToBoss
  };
})(typeof window !== "undefined" ? window : globalThis);
