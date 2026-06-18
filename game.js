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

  function getCurrentBallSpeed(state) {
    var multiplier = state.activeEffects.slowBallTimeRemaining > 0 ?
      Data.ITEMS.definitions.filter(function (item) { return item.id === "slow_ball"; })[0].value :
      1;

    return clamp(Data.BALL.speed * multiplier, Data.BALL.minSpeed, Data.BALL.maxSpeed);
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
    var gap = cfg.gap;
    var side = cfg.sidePadding;
    var brickWidth = (width - side * 2 - gap * (cfg.columns - 1)) / cfg.columns;

    return {
      columns: cfg.columns,
      gap: gap,
      side: side,
      top: cfg.top,
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

  function clampPaddle(state) {
    var width = getWidth(state);
    var maxWidth = width * Data.PADDLE.maxWidthRatio;

    state.paddle.width = clamp(state.paddle.width, 36, maxWidth);
    state.paddle.baseWidth = clamp(state.paddle.baseWidth, 36, maxWidth);
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
    syncAttachedBalls(runState);
    runState.flags.needsResize = false;

    return runState.viewport;
  }

  function getStagePattern(stage) {
    var stages = Data.STAGES;
    return stages[(Math.max(1, stage) - 1) % stages.length].pattern;
  }

  function createBrick(state, row, col, symbol) {
    var type = symbol === "2" ? Data.BRICK_TYPES.strong : Data.BRICK_TYPES.normal;

    return {
      id: state.counters.nextBrickId++,
      type: type.id,
      row: row,
      col: col,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      hp: type.hp,
      maxHp: type.hp,
      score: type.score,
      dropChance: type.dropChance,
      destructible: type.destructible,
      alive: true,
      rewardGranted: false
    };
  }

  function buildStage(state) {
    var pattern = getStagePattern(state.stage);
    var bricks = [];

    pattern.forEach(function (rowText, row) {
      String(rowText).split("").forEach(function (symbol, col) {
        if (symbol !== "0") {
          bricks.push(createBrick(state, row, col, symbol));
        }
      });
    });

    state.bricks = bricks;
    relayoutBricks(state);
  }

  function createAttachedBall(state) {
    return State.createAttachedBall(state.counters.nextBallId++, state.paddle);
  }

  function resetBallToPaddle(state) {
    state.balls = [createAttachedBall(state)];
    state.items = [];
    state.activeEffects.slowBallTimeRemaining = 0;
    state.paddle.width = state.paddle.baseWidth;
    state.paddle.expandTimeRemaining = 0;
    syncAttachedBalls(state);
  }

  function startStage(state) {
    var runState = getState(state);

    runState.flags.stageClearHandled = false;
    runState.flags.lifeLostHandled = false;
    runState.flags.gameoverHandled = false;
    runState.particles = [];
    runState.effects = [];
    runState.floatingTexts = [];
    runState.items = [];
    buildStage(runState);
    resetBallToPaddle(runState);
    State.setMode(Data.MODES.READY);
    runState.flags.needsHudUpdate = true;
    return runState;
  }

  function startRun(state) {
    var runState = getState(state);

    runState.stage = Data.GAME.startingStage;
    runState.score = 0;
    runState.lives = Data.GAME.startingLives;
    runState.paddle = State.createPaddle(getWidth(runState), getHeight(runState));
    runState.counters.nextBallId = 1;
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
    state.balls.forEach(function (ball) {
      if (!ball.attached) {
        return;
      }

      ball.x = state.paddle.x + state.paddle.width / 2;
      ball.y = state.paddle.y - ball.radius - 1;
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.vx = 0;
      ball.vy = 0;
    });
  }

  function normalizeBallVelocity(state, ball, speed) {
    var targetSpeed = clamp(speed || getCurrentBallSpeed(state), Data.BALL.minSpeed, Data.BALL.maxSpeed);
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

    var ball = runState.balls[0] || createAttachedBall(runState);
    var angle = Data.BALL.launchAngleDegrees * Math.PI / 180;
    var speed = getCurrentBallSpeed(runState);

    ball.attached = false;
    ball.active = true;
    ball.x = runState.paddle.x + runState.paddle.width / 2;
    ball.y = runState.paddle.y - ball.radius - 2;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.collisionCooldowns = {};
    normalizeBallVelocity(runState, ball, speed);

    State.setMode(Data.MODES.PLAYING);
    return true;
  }

  function circleRectOverlap(cx, cy, radius, rect) {
    var nearestX = clamp(cx, rect.x, rect.x + rect.width);
    var nearestY = clamp(cy, rect.y, rect.y + rect.height);
    var dx = cx - nearestX;
    var dy = cy - nearestY;

    return dx * dx + dy * dy <= radius * radius;
  }

  function circleBrickCollision(ball, brick) {
    var nearestX = clamp(ball.x, brick.x, brick.x + brick.width);
    var nearestY = clamp(ball.y, brick.y, brick.y + brick.height);
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

    var left = Math.abs(ball.x - brick.x);
    var right = Math.abs((brick.x + brick.width) - ball.x);
    var top = Math.abs(ball.y - brick.y);
    var bottom = Math.abs((brick.y + brick.height) - ball.y);
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
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    normalizeBallVelocity(state, ball, speed);
    addParticles(state, ball.x, ball.y + ball.radius, "#f3f7ff", 5);
  }

  function weightedItem() {
    var items = Data.ITEMS.definitions;
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

  function spawnItem(state, brick) {
    if (state.items.length >= Data.ITEMS.maxActive || Math.random() > brick.dropChance) {
      return;
    }

    var definition = weightedItem();

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

  function damageBrick(state, brick) {
    if (!brick.alive || brick.rewardGranted) {
      brick.hp = Math.max(0, brick.hp - 1);
    } else {
      brick.hp -= 1;
    }

    addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, "#ffffff", 4);

    if (brick.hp > 0 || !brick.alive) {
      return;
    }

    brick.alive = false;

    if (!brick.rewardGranted) {
      brick.rewardGranted = true;
      state.score += brick.score;
      State.updateBestScore(state.score);
      addFloatingText(state, brick.x + brick.width / 2, brick.y + brick.height / 2, "+" + brick.score, "#f2c94c");
      spawnItem(state, brick);
    }

    var type = Data.BRICK_TYPES[brick.type] || Data.BRICK_TYPES.normal;
    addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, type.fill, 14);
    triggerScreenShake(state, 2.5, 0.08);
    state.flags.needsHudUpdate = true;
  }

  function handleBrickCollisions(state, ball) {
    for (var index = 0; index < state.bricks.length; index++) {
      var brick = state.bricks[index];

      if (!brick.alive) {
        continue;
      }

      var collision = circleBrickCollision(ball, brick);

      if (!collision) {
        continue;
      }

      var lastHitFrame = ball.collisionCooldowns[brick.id] || -99;

      if (state.time.frame - lastHitFrame < 3) {
        return;
      }

      ball.collisionCooldowns[brick.id] = state.time.frame;
      reflect(ball, collision.nx, collision.ny);
      normalizeBallVelocity(state, ball);

      if (collision.nx < 0) {
        ball.x = Math.min(ball.x, brick.x - ball.radius - 0.2);
      } else if (collision.nx > 0) {
        ball.x = Math.max(ball.x, brick.x + brick.width + ball.radius + 0.2);
      }

      if (collision.ny < 0) {
        ball.y = Math.min(ball.y, brick.y - ball.radius - 0.2);
      } else if (collision.ny > 0) {
        ball.y = Math.max(ball.y, brick.y + brick.height + ball.radius + 0.2);
      }

      damageBrick(state, brick);
      return;
    }
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

    var additions = Math.min(2, Data.GAME.maxBalls - state.balls.length);
    var baseAngle = Math.atan2(source.vy || -1, source.vx || 0);

    for (var index = 0; index < additions; index++) {
      var spread = (index === 0 ? -1 : 1) * Data.BALL.launchSpreadDegrees * Math.PI / 180;
      var speed = getCurrentBallSpeed(state);
      var ball = {
        id: state.counters.nextBallId++,
        x: source.x,
        y: source.y,
        prevX: source.x,
        prevY: source.y,
        vx: Math.cos(baseAngle + spread) * speed,
        vy: Math.sin(baseAngle + spread) * speed,
        radius: Data.BALL.radius,
        active: true,
        attached: false,
        collisionCooldowns: {}
      };

      normalizeBallVelocity(state, ball, speed);
      state.balls.push(ball);
    }
  }

  function applyItem(state, item) {
    if (item.type === "paddle_expand") {
      state.paddle.expandTimeRemaining = Data.PADDLE.expandDuration;
      state.paddle.width = Math.min(state.paddle.baseWidth * Data.PADDLE.expandMultiplier, getWidth(state) * Data.PADDLE.maxWidthRatio);
      clampPaddle(state);
      addFloatingText(state, item.x + item.width / 2, item.y, "패들 확장", "#35c98f");
    } else if (item.type === "multi_ball") {
      splitBalls(state);
      addFloatingText(state, item.x + item.width / 2, item.y, "멀티볼", "#f2c94c");
    } else if (item.type === "slow_ball") {
      state.activeEffects.slowBallTimeRemaining = 8;
      state.balls.forEach(function (ball) {
        if (ball.active && !ball.attached) {
          normalizeBallVelocity(state, ball, getCurrentBallSpeed(state));
        }
      });
      addFloatingText(state, item.x + item.width / 2, item.y, "감속", "#65c8ff");
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
        state.paddle.width = state.paddle.baseWidth;
        state.paddle.x = center - state.paddle.width / 2;
        clampPaddle(state);
      }
    }

    if (state.activeEffects.slowBallTimeRemaining > 0) {
      state.activeEffects.slowBallTimeRemaining = Math.max(0, state.activeEffects.slowBallTimeRemaining - dt);

      if (state.activeEffects.slowBallTimeRemaining === 0) {
        state.balls.forEach(function (ball) {
          if (ball.active && !ball.attached) {
            normalizeBallVelocity(state, ball, Data.BALL.speed);
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

    state.particles = state.particles.filter(function (particle) {
      return particle.age < particle.life;
    });
    state.floatingTexts = state.floatingTexts.filter(function (text) {
      return text.age < text.life;
    });

    if (state.effects.screenShake && state.effects.screenShake.time > 0) {
      state.effects.screenShake.time = Math.max(0, state.effects.screenShake.time - dt);
    }
  }

  function checkStageClear(state) {
    if (state.flags.stageClearHandled) {
      return;
    }

    var hasLivingDestructible = state.bricks.some(function (brick) {
      return brick.alive && brick.destructible;
    });

    if (hasLivingDestructible) {
      return;
    }

    state.flags.stageClearHandled = true;
    state.score += Data.SCORE.stageClear;
    State.updateBestScore(state.score);
    State.updateHighestStage(state.stage);
    state.balls.forEach(function (ball) {
      ball.active = false;
      ball.attached = false;
    });
    state.items = [];
    State.setMode(Data.MODES.STAGE_CLEAR);
    state.flags.needsHudUpdate = true;
  }

  function loseLife(state) {
    if (state.flags.lifeLostHandled || state.flags.stageClearHandled || state.mode !== Data.MODES.PLAYING) {
      return;
    }

    state.flags.lifeLostHandled = true;
    state.lives = Math.max(0, state.lives - 1);
    triggerScreenShake(state, 7, Data.EFFECT_LIMITS.screenShakeSeconds);

    if (state.lives <= 0) {
      state.flags.gameoverHandled = true;
      State.updateBestScore(state.score);
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

  function restartStage(state) {
    var runState = getState(state);

    return startStage(runState);
  }

  function nextStage(state) {
    var runState = getState(state);

    runState.stage += 1;
    return startStage(runState);
  }

  function update(dt, state) {
    var runState = getState(state);
    var delta = isFiniteNumber(dt) ? clamp(dt, 0, Data.GAME.maxDeltaTime) : 0;

    runState.time.delta = delta;
    runState.time.elapsed += delta;
    runState.time.frame++;
    updateVisualEffects(runState, delta);

    if (runState.mode === Data.MODES.PAUSED || runState.mode === Data.MODES.GAMEOVER || delta <= 0) {
      return runState;
    }

    if (runState.mode === Data.MODES.READY || runState.mode === Data.MODES.PLAYING) {
      updatePaddle(runState, delta);
    }

    if (runState.mode === Data.MODES.PLAYING) {
      updateTimers(runState, delta);
      updateItems(runState, delta);

      runState.balls.forEach(function (ball) {
        moveBall(runState, ball, delta);
      });

      removeInactiveBalls(runState);
      checkStageClear(runState);
    }

    return runState;
  }

  AbyssBreaker.Game = {
    setWorldSize: setWorldSize,
    getBrickLayout: getBrickLayout,
    relayoutBricks: relayoutBricks,
    startRun: startRun,
    startStage: startStage,
    restartStage: restartStage,
    nextStage: nextStage,
    movePaddleTo: movePaddleTo,
    launchBall: launchBall,
    continueAfterLifeLost: continueAfterLifeLost,
    update: update,
    clamp: clamp,
    getCurrentBallSpeed: getCurrentBallSpeed
  };
})(typeof window !== "undefined" ? window : globalThis);
