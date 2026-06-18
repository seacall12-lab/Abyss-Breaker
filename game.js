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

  function getWorldWidth(state) {
    return Math.max(1, state.viewport.cssWidth || Data.CANVAS.designWidth);
  }

  function getWorldHeight(state) {
    return Math.max(1, state.viewport.cssHeight || Data.CANVAS.designHeight);
  }

  function getLayout(state) {
    var width = getWorldWidth(state);
    var height = getWorldHeight(state);
    var columns = Data.LAYOUT.columns;
    var gap = Math.max(3, width * Data.LAYOUT.brickGapRatio);
    var brickWidth = Math.max(12, (width - gap * (columns + 1)) / columns);
    var brickHeight = clamp(height * Data.LAYOUT.brickHeightRatio, 24, 42);
    var top = height * Data.LAYOUT.topPaddingRatio;
    var rowStep = brickHeight + gap;

    state.layout = {
      columns: columns,
      gap: gap,
      brickWidth: brickWidth,
      brickHeight: brickHeight,
      top: top,
      rowStep: rowStep,
      dangerY: height * Data.LAYOUT.dangerLineRatio,
      launchY: height * Data.LAYOUT.launchLineRatio
    };

    return state.layout;
  }

  function syncLaunchPosition(state) {
    var width = getWorldWidth(state);
    var layout = getLayout(state);
    var x = clamp(state.launch.nextX || width * Data.LAYOUT.launchXRatio, Data.BALL_BASE.radius, width - Data.BALL_BASE.radius);
    var y = layout.launchY;

    state.launch.originX = x;
    state.launch.originY = y;
    state.aim.startX = x;
    state.aim.startY = y;

    state.balls.forEach(function (ball) {
      if (!ball.active) {
        ball.x = x;
        ball.y = y;
        ball.prevX = x;
        ball.prevY = y;
      }
    });
  }

  function setWorldSize(width, height, devicePixelRatio, state) {
    var runState = getState(state);

    if (isFiniteNumber(width) && width > 0) {
      runState.viewport.cssWidth = width;
    }

    if (isFiniteNumber(height) && height > 0) {
      runState.viewport.cssHeight = height;
    }

    if (isFiniteNumber(devicePixelRatio) && devicePixelRatio > 0) {
      runState.viewport.devicePixelRatio = clamp(devicePixelRatio, 1, Data.CANVAS.maxDevicePixelRatio);
      runState.viewport.pixelWidth = Math.round(runState.viewport.cssWidth * runState.viewport.devicePixelRatio);
      runState.viewport.pixelHeight = Math.round(runState.viewport.cssHeight * runState.viewport.devicePixelRatio);
    }

    getLayout(runState);
    syncLaunchPosition(runState);
    relayoutBricks(runState);
    runState.flags.needsResize = false;

    return runState.viewport;
  }

  function calculateBrickHp(wave, typeData) {
    var balance = Data.WAVE_BALANCE;
    var raw = (balance.baseBrickHp + (wave - 1) * balance.brickHpPerWave) * Math.pow(balance.brickHpGrowth, wave - 1);
    return Math.max(1, Math.round(raw * typeData.hpMultiplier));
  }

  function calculateBrickAttack(wave, typeData) {
    var balance = Data.WAVE_BALANCE;
    return Math.max(1, Math.round((balance.baseBrickAttack + (wave - 1) * balance.brickAttackPerWave) * typeData.attackMultiplier));
  }

  function calculateBrickReward(wave, typeData) {
    var balance = Data.WAVE_BALANCE;
    var reward = balance.baseBrickReward + Math.floor((wave - 1) / Math.max(1, balance.rewardEveryWaves));
    return Math.max(1, Math.round(reward * typeData.rewardMultiplier));
  }

  function calculateBrickCount(wave) {
    var balance = Data.WAVE_BALANCE;
    var count = balance.baseBrickCount + Math.floor((wave - 1) / Math.max(1, balance.brickCountEveryWaves));
    return clamp(count, 1, balance.maxBrickCount);
  }

  function getWaveColumns(wave, count, columns) {
    var selected = {};
    var result = [];
    var step = 3;
    var cursor = (wave * 2 + 1) % columns;

    while (result.length < count) {
      if (!selected[cursor]) {
        selected[cursor] = true;
        result.push(cursor);
      }

      cursor = (cursor + step) % columns;

      if (result.length < count && selected[cursor]) {
        cursor = (cursor + 1) % columns;
      }
    }

    return result.sort(function (a, b) {
      return a - b;
    });
  }

  function createBrick(state, row, col, typeId) {
    var layout = getLayout(state);
    var typeData = Data.BRICK_TYPES[typeId] || Data.BRICK_TYPES.normal;
    var wave = Math.max(1, state.run.wave);
    var hp = calculateBrickHp(wave, typeData);

    return {
      id: state.run.nextBrickId++,
      type: typeData.id,
      row: row,
      col: col,
      x: layout.gap + col * (layout.brickWidth + layout.gap),
      y: layout.top + row * layout.rowStep,
      width: layout.brickWidth,
      height: layout.brickHeight,
      hp: hp,
      maxHp: hp,
      attack: calculateBrickAttack(wave, typeData),
      reward: calculateBrickReward(wave, typeData),
      statusEffects: [],
      alive: true,
      rewardGranted: false
    };
  }

  function relayoutBricks(state) {
    if (!state.bricks.length) {
      return;
    }

    var layout = getLayout(state);

    state.bricks.forEach(function (brick) {
      brick.x = layout.gap + brick.col * (layout.brickWidth + layout.gap);
      brick.y = layout.top + brick.row * layout.rowStep;
      brick.width = layout.brickWidth;
      brick.height = layout.brickHeight;
    });
  }

  function prepareWave(state) {
    var runState = getState(state);
    var layout = getLayout(runState);
    var typeId = Data.WAVE_BALANCE.normalWaveType;
    var count = calculateBrickCount(runState.run.wave);
    var columns = getWaveColumns(runState.run.wave, count, layout.columns);

    runState.bricks = columns.map(function (col) {
      return createBrick(runState, 0, col, typeId);
    });

    runState.wave.index = runState.run.wave;
    runState.wave.type = typeId;
    runState.wave.spawned = true;
    runState.wave.cleared = false;
    runState.wave.resolving = false;
    runState.run.waveClearPending = false;
    runState.flags.needsHudUpdate = true;

    State.updateBestWave(runState.run.wave);
    return runState.bricks;
  }

  function ensureWave(state) {
    var runState = getState(state);
    var hasLivingBrick = runState.bricks.some(function (brick) {
      return brick.alive;
    });

    if (!runState.wave.spawned || (!hasLivingBrick && runState.mode === Data.MODES.READY)) {
      prepareWave(runState);
    }

    return runState;
  }

  function createBallState(state, id) {
    return {
      id: id,
      x: state.launch.originX,
      y: state.launch.originY,
      prevX: state.launch.originX,
      prevY: state.launch.originY,
      vx: 0,
      vy: 0,
      radius: Data.BALL_BASE.radius,
      damage: state.player.ballDamage,
      active: false,
      returned: true,
      pierce: Data.BALL_BASE.pierce,
      collisionCooldowns: {}
    };
  }

  function ensureBallPool(state) {
    while (state.balls.length < state.player.ballCount) {
      state.balls.push(createBallState(state, state.run.nextBallId++));
    }

    if (state.balls.length > state.player.ballCount) {
      state.balls.length = state.player.ballCount;
    }

    state.balls.forEach(function (ball, index) {
      if (!isFiniteNumber(ball.id)) {
        ball.id = index;
      }

      if (!ball.active) {
        ball.damage = state.player.ballDamage;
        ball.radius = Data.BALL_BASE.radius;
        ball.pierce = Data.BALL_BASE.pierce;
      }
    });

    return state.balls;
  }

  function calculateAim(state, pointerX, pointerY) {
    var originX = state.launch.originX;
    var originY = state.launch.originY;
    var x = isFiniteNumber(pointerX) ? pointerX : originX;
    var y = isFiniteNumber(pointerY) ? pointerY : originY - 1;
    var dx = x - originX;
    var dy = y - originY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 8) {
      return {
        currentX: x,
        currentY: y,
        directionX: 0,
        directionY: -1,
        angleRadians: -Math.PI / 2,
        valid: false
      };
    }

    var dirX = dx / distance;
    var dirY = dy / distance;
    var minUp = Math.sin(Data.LAYOUT.minLaunchAngleDegrees * Math.PI / 180);

    if (dirY > -minUp) {
      dirY = -minUp;
      dirX = (dirX < 0 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - dirY * dirY));
    }

    if (!isFiniteNumber(dirX) || !isFiniteNumber(dirY)) {
      dirX = 0;
      dirY = -1;
    }

    return {
      currentX: x,
      currentY: y,
      directionX: dirX,
      directionY: dirY,
      angleRadians: Math.atan2(dirY, dirX),
      valid: true
    };
  }

  function beginAim(pointerX, pointerY, state) {
    var runState = ensureWave(getState(state));

    if (runState.mode !== Data.MODES.READY && runState.mode !== Data.MODES.AIMING) {
      return false;
    }

    syncLaunchPosition(runState);
    runState.aim.active = true;
    updateAim(pointerX, pointerY, runState);
    State.setMode(Data.MODES.AIMING);
    return true;
  }

  function updateAim(pointerX, pointerY, state) {
    var runState = getState(state);
    var aim = calculateAim(runState, pointerX, pointerY);

    runState.aim.currentX = aim.currentX;
    runState.aim.currentY = aim.currentY;
    runState.aim.directionX = aim.directionX;
    runState.aim.directionY = aim.directionY;
    runState.aim.angleRadians = aim.angleRadians;
    runState.aim.valid = aim.valid;

    return runState.aim;
  }

  function cancelAim(state) {
    var runState = getState(state);

    runState.aim.active = false;
    runState.aim.valid = false;

    if (runState.mode === Data.MODES.AIMING) {
      State.setMode(Data.MODES.READY);
    }
  }

  function resetBallForLaunch(ball, state) {
    ball.x = state.launch.originX;
    ball.y = state.launch.originY;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    ball.vx = 0;
    ball.vy = 0;
    ball.damage = state.player.ballDamage;
    ball.active = false;
    ball.returned = false;
    ball.collisionCooldowns = {};
  }

  function launchBalls(state) {
    var runState = ensureWave(getState(state));

    if (runState.mode !== Data.MODES.AIMING && runState.mode !== Data.MODES.READY) {
      return false;
    }

    if (!runState.aim.valid) {
      cancelAim(runState);
      return false;
    }

    ensureBallPool(runState);
    syncLaunchPosition(runState);

    runState.balls.forEach(function (ball) {
      resetBallForLaunch(ball, runState);
    });

    runState.launch.directionX = runState.aim.directionX;
    runState.launch.directionY = runState.aim.directionY;
    runState.launch.queuedBallIds = runState.balls.map(function (ball) {
      return ball.id;
    });
    runState.launch.launchedCount = 0;
    runState.launch.returnedCount = 0;
    runState.launch.timer = 0;
    runState.launch.interval = Data.BALL_BASE.launchInterval;
    runState.aim.active = false;
    runState.flags.inputLocked = true;

    State.setMode(Data.MODES.LAUNCHING);
    return true;
  }

  function commitAim(state) {
    return launchBalls(state);
  }

  function findBallById(state, id) {
    for (var index = 0; index < state.balls.length; index++) {
      if (state.balls[index].id === id) {
        return state.balls[index];
      }
    }

    return null;
  }

  function launchNextQueuedBall(state) {
    var id = state.launch.queuedBallIds.shift();
    var ball = findBallById(state, id);

    if (!ball) {
      return;
    }

    ball.active = true;
    ball.returned = false;
    ball.x = state.launch.originX;
    ball.y = state.launch.originY;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    ball.vx = state.launch.directionX * Data.BALL_BASE.speed;
    ball.vy = state.launch.directionY * Data.BALL_BASE.speed;
    state.launch.launchedCount++;
  }

  function updateLaunchQueue(state, dt) {
    if (state.mode !== Data.MODES.LAUNCHING) {
      return;
    }

    state.launch.timer -= dt;

    while (state.launch.queuedBallIds.length && state.launch.timer <= 0) {
      launchNextQueuedBall(state);
      state.launch.timer += state.launch.interval;
    }

    if (!state.launch.queuedBallIds.length) {
      State.setMode(Data.MODES.PLAYING);
    }
  }

  function nearestPointOnBrick(x, y, brick) {
    return {
      x: clamp(x, brick.x, brick.x + brick.width),
      y: clamp(y, brick.y, brick.y + brick.height)
    };
  }

  function getInsideCollisionNormal(ball, brick) {
    var left = Math.abs(ball.x - brick.x);
    var right = Math.abs((brick.x + brick.width) - ball.x);
    var top = Math.abs(ball.y - brick.y);
    var bottom = Math.abs((brick.y + brick.height) - ball.y);
    var min = Math.min(left, right, top, bottom);

    if (min === left) {
      return { x: -1, y: 0 };
    }

    if (min === right) {
      return { x: 1, y: 0 };
    }

    if (min === top) {
      return { x: 0, y: -1 };
    }

    return { x: 0, y: 1 };
  }

  function detectCircleBrickCollision(ball, brick) {
    var point = nearestPointOnBrick(ball.x, ball.y, brick);
    var dx = ball.x - point.x;
    var dy = ball.y - point.y;
    var distanceSq = dx * dx + dy * dy;
    var radius = ball.radius;

    if (distanceSq > radius * radius) {
      return null;
    }

    if (distanceSq > EPSILON) {
      var distance = Math.sqrt(distanceSq);
      return {
        normalX: dx / distance,
        normalY: dy / distance,
        pointX: point.x,
        pointY: point.y
      };
    }

    var normal = getInsideCollisionNormal(ball, brick);
    return {
      normalX: normal.x,
      normalY: normal.y,
      pointX: ball.x,
      pointY: ball.y
    };
  }

  function addLimited(list, item, limit) {
    list.push(item);

    while (list.length > limit) {
      list.shift();
    }
  }

  function addDamageText(state, x, y, amount, critical) {
    addLimited(state.effects.damageTexts, {
      x: x,
      y: y,
      value: amount,
      critical: critical,
      age: 0,
      life: critical ? 0.75 : 0.55,
      vy: critical ? -42 : -30
    }, Data.EFFECT_LIMITS.damageTexts);
  }

  function addParticles(state, x, y, color, count) {
    var amount = Math.max(1, count);

    for (var index = 0; index < amount; index++) {
      var angle = (Math.PI * 2 * index) / amount + Math.random() * 0.4;
      var speed = 40 + Math.random() * 80;

      addLimited(state.effects.particles, {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2.5,
        color: color,
        age: 0,
        life: 0.35 + Math.random() * 0.3
      }, Data.EFFECT_LIMITS.particles);
    }
  }

  function triggerScreenShake(state, magnitude, duration) {
    state.effects.screenShake.time = Math.max(state.effects.screenShake.time, duration);
    state.effects.screenShake.duration = Math.max(state.effects.screenShake.duration, duration);
    state.effects.screenShake.magnitude = Math.max(state.effects.screenShake.magnitude, magnitude);
  }

  function calculateDamage(state, ball) {
    var critical = Math.random() < state.player.critChance;
    var damage = ball.damage;

    if (critical) {
      damage *= state.player.critDamage;
    }

    return {
      amount: Math.max(1, Math.floor(damage)),
      critical: critical
    };
  }

  function damageBrick(state, ball, brick) {
    var typeData = Data.BRICK_TYPES[brick.type] || Data.BRICK_TYPES.normal;
    var damage = calculateDamage(state, ball);

    brick.hp = Math.max(0, brick.hp - damage.amount);
    addDamageText(state, ball.x, ball.y - ball.radius, damage.amount, damage.critical);
    addParticles(state, ball.x, ball.y, typeData.color, damage.critical ? 8 : 4);

    if (brick.hp <= 0 && brick.alive) {
      brick.alive = false;

      if (!brick.rewardGranted) {
        brick.rewardGranted = true;
        state.run.gold += brick.reward;
        state.run.score += Math.round(Data.SCORE.brickDestroyed * typeData.scoreMultiplier);
        state.flags.needsHudUpdate = true;
      }

      addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, typeData.color, 10);
      triggerScreenShake(state, 2, 0.08);
    }
  }

  function reflectBall(ball, normalX, normalY) {
    var dot = ball.vx * normalX + ball.vy * normalY;

    if (dot > 0) {
      return;
    }

    ball.vx -= 2 * dot * normalX;
    ball.vy -= 2 * dot * normalY;
  }

  function separateBallFromBrick(ball, brick, collision) {
    if (collision.normalX < 0) {
      ball.x = Math.min(ball.x, brick.x - ball.radius - 0.1);
    } else if (collision.normalX > 0) {
      ball.x = Math.max(ball.x, brick.x + brick.width + ball.radius + 0.1);
    }

    if (collision.normalY < 0) {
      ball.y = Math.min(ball.y, brick.y - ball.radius - 0.1);
    } else if (collision.normalY > 0) {
      ball.y = Math.max(ball.y, brick.y + brick.height + ball.radius + 0.1);
    }
  }

  function handleBrickCollisions(state, ball, frameHits) {
    for (var index = 0; index < state.bricks.length; index++) {
      var brick = state.bricks[index];

      if (!brick.alive) {
        continue;
      }

      var collision = detectCircleBrickCollision(ball, brick);

      if (!collision) {
        continue;
      }

      var hitKey = ball.id + ":" + brick.id;

      separateBallFromBrick(ball, brick, collision);
      reflectBall(ball, collision.normalX, collision.normalY);

      if (!frameHits[hitKey]) {
        frameHits[hitKey] = true;
        damageBrick(state, ball, brick);
      }

      return true;
    }

    return false;
  }

  function returnBall(state, ball) {
    if (ball.returned) {
      return;
    }

    ball.active = false;
    ball.returned = true;
    ball.vx = 0;
    ball.vy = 0;
    ball.collisionCooldowns = {};

    if (state.launch.returnedCount === 0) {
      state.launch.nextX = clamp(ball.x, ball.radius, getWorldWidth(state) - ball.radius);
    }

    state.launch.returnedCount++;
    ball.x = state.launch.nextX;
    ball.y = state.launch.originY;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
  }

  function handleWallCollisions(state, ball) {
    var width = getWorldWidth(state);
    var height = getWorldHeight(state);

    if (!isFiniteNumber(ball.x) || !isFiniteNumber(ball.y) || !isFiniteNumber(ball.vx) || !isFiniteNumber(ball.vy)) {
      returnBall(state, ball);
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

    if (ball.y - ball.radius > height || ball.x < -width || ball.x > width * 2 || ball.y < -height || ball.y > height * 2) {
      returnBall(state, ball);
    }
  }

  function moveBall(state, ball, dt, frameHits) {
    if (!ball.active || ball.returned) {
      return;
    }

    var distance = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * dt;
    var steps = clamp(Math.ceil(distance / Math.max(1, ball.radius * 0.75)), 1, Data.BALL_BASE.maxSubSteps);
    var stepDt = dt / steps;

    for (var step = 0; step < steps; step++) {
      if (!ball.active) {
        return;
      }

      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;

      handleWallCollisions(state, ball);

      if (ball.active) {
        handleBrickCollisions(state, ball, frameHits);
      }
    }
  }

  function livingBricks(state) {
    return state.bricks.filter(function (brick) {
      return brick.alive;
    });
  }

  function allBallsReturned(state) {
    if (state.launch.queuedBallIds.length) {
      return false;
    }

    return state.balls.every(function (ball) {
      return ball.returned || !ball.active;
    });
  }

  function removeDeadBricks(state) {
    state.bricks = state.bricks.filter(function (brick) {
      return brick.alive;
    });
  }

  function damagePlayer(state, amount, x, y) {
    state.player.hp = Math.max(0, state.player.hp - Math.max(0, amount));
    state.flags.needsHudUpdate = true;
    addDamageText(state, x, y, amount, false);
    triggerScreenShake(state, 8, Data.EFFECT_LIMITS.screenShakeSeconds);
  }

  function lowerLivingBricks(state) {
    var layout = getLayout(state);

    livingBricks(state).forEach(function (brick) {
      brick.row++;
      brick.y += layout.rowStep;
    });
  }

  function resolveDangerLine(state) {
    var layout = getLayout(state);

    state.bricks.forEach(function (brick) {
      if (!brick.alive) {
        return;
      }

      if (brick.y + brick.height >= layout.dangerY) {
        brick.alive = false;
        damagePlayer(state, brick.attack, brick.x + brick.width / 2, layout.dangerY);
      }
    });
  }

  function clearWave(state) {
    state.wave.cleared = true;
    state.run.score += Data.SCORE.waveCleared + state.run.gold * Data.SCORE.goldToScore;
    state.run.wave++;
    state.wave.index = state.run.wave;
    state.flags.needsHudUpdate = true;

    State.updateBestWave(state.run.wave);
    State.updateBestScore(state.run.score);

    prepareWave(state);
    syncLaunchPosition(state);
    State.setMode(Data.MODES.READY);
  }

  function finishTurn(state) {
    if (state.wave.resolving || state.run.gameoverHandled) {
      return;
    }

    state.wave.resolving = true;
    State.setMode(Data.MODES.RESOLVING);
    removeDeadBricks(state);

    if (!livingBricks(state).length) {
      clearWave(state);
      state.wave.resolving = false;
      return;
    }

    lowerLivingBricks(state);
    resolveDangerLine(state);
    removeDeadBricks(state);

    if (state.player.hp <= 0) {
      state.run.gameoverHandled = true;
      State.commitRunRecords();
      State.setMode(Data.MODES.GAMEOVER);
      state.flags.inputLocked = true;
      state.wave.resolving = false;
      return;
    }

    if (!livingBricks(state).length) {
      clearWave(state);
      state.wave.resolving = false;
      return;
    }

    state.run.turn++;
    state.flags.inputLocked = false;
    state.flags.needsHudUpdate = true;
    syncLaunchPosition(state);
    State.setMode(Data.MODES.READY);
    state.wave.resolving = false;
  }

  function updateEffects(state, dt) {
    state.effects.particles.forEach(function (particle) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.08, dt);
      particle.vy *= Math.pow(0.08, dt);
    });

    state.effects.damageTexts.forEach(function (text) {
      text.age += dt;
      text.y += text.vy * dt;
    });

    state.effects.particles = state.effects.particles.filter(function (particle) {
      return particle.age < particle.life;
    });

    state.effects.damageTexts = state.effects.damageTexts.filter(function (text) {
      return text.age < text.life;
    });

    if (state.effects.screenShake.time > 0) {
      state.effects.screenShake.time = Math.max(0, state.effects.screenShake.time - dt);
    } else {
      state.effects.screenShake.duration = 0;
      state.effects.screenShake.magnitude = 0;
    }
  }

  function update(dt, state) {
    var runState = getState(state);
    var delta = isFiniteNumber(dt) ? clamp(dt, 0, Data.GAME.maxDeltaTime) : 0;

    runState.time.delta = delta;
    runState.time.elapsed += delta;
    runState.time.frame++;

    updateEffects(runState, delta);

    if (runState.mode === Data.MODES.PAUSED || runState.mode === Data.MODES.GAMEOVER || delta <= 0) {
      return runState;
    }

    if (runState.mode === Data.MODES.LAUNCHING) {
      updateLaunchQueue(runState, delta);
    }

    if (runState.mode === Data.MODES.LAUNCHING || runState.mode === Data.MODES.PLAYING) {
      var frameHits = {};

      runState.balls.forEach(function (ball) {
        moveBall(runState, ball, delta, frameHits);
      });

      if (allBallsReturned(runState)) {
        finishTurn(runState);
      }
    }

    return runState;
  }

  function resetTurn(state) {
    var runState = getState(state);

    runState.launch.queuedBallIds = [];
    runState.launch.launchedCount = 0;
    runState.launch.returnedCount = 0;
    runState.launch.timer = 0;
    runState.aim.active = false;
    runState.aim.valid = false;
    runState.flags.inputLocked = false;
    ensureBallPool(runState);
    syncLaunchPosition(runState);

    runState.balls.forEach(function (ball) {
      ball.active = false;
      ball.returned = true;
      ball.vx = 0;
      ball.vy = 0;
      ball.x = runState.launch.originX;
      ball.y = runState.launch.originY;
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.collisionCooldowns = {};
    });

    State.setMode(Data.MODES.READY);
    return runState;
  }

  function startRun(state) {
    var runState = state || State.initRun();

    setWorldSize(runState.viewport.cssWidth, runState.viewport.cssHeight, runState.viewport.devicePixelRatio, runState);
    ensureBallPool(runState);
    prepareWave(runState);
    State.setMode(Data.MODES.READY);
    return runState;
  }

  AbyssBreaker.Game = {
    setWorldSize: setWorldSize,
    getLayout: getLayout,
    prepareWave: prepareWave,
    ensureWave: ensureWave,
    startRun: startRun,
    resetTurn: resetTurn,
    beginAim: beginAim,
    updateAim: updateAim,
    cancelAim: cancelAim,
    commitAim: commitAim,
    launchBalls: launchBalls,
    update: update,
    finishTurn: finishTurn,
    calculateAim: calculateAim,
    relayoutBricks: relayoutBricks
  };
})(typeof window !== "undefined" ? window : globalThis);
