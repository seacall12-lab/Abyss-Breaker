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

  function getPaddleBottomOffset(state) {
    var height = getHeight(state);
    return clamp(
      height * (Data.PADDLE.bottomOffsetRatio || 0),
      Data.PADDLE.minBottomOffset || Data.PADDLE.yOffset,
      Data.PADDLE.maxBottomOffset || Data.PADDLE.yOffset
    );
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

    if (Data.STAGE_EXTRAS && Data.STAGE_EXTRAS[number]) {
      var extra = Data.STAGE_EXTRAS[number];
      Object.keys(extra).forEach(function (key) {
        stage[key] = JSON.parse(JSON.stringify(extra[key]));
      });
    }

    if (rules.endless && number > Data.GAME.finalStage) {
      var scale = Math.floor((number - Data.GAME.finalStage) / Math.max(1, rules.scalingEvery || 5)) + 1;
      var cycle = Math.floor((number - 11) / 5) % 3;
      var endlessZone = cycle === 0 ? "corridor" : cycle === 1 ? "rift" : "core";
      var templateIndex = cycle === 0 ? 4 : cycle === 1 ? 7 : 9;
      var template = Data.STAGE_EXTRAS && Data.STAGE_EXTRAS[templateIndex] ? Data.STAGE_EXTRAS[templateIndex] : {};
      stage.zoneId = endlessZone;
      stage.gimmicks = JSON.parse(JSON.stringify(template.gimmicks || []));
      stage.name = "무한 " + number;
      stage.brickHpMultiplier = clamp(base.brickHpMultiplier + scale * 0.12, 1, 3.2);
      stage.ballSpeedMultiplier = clamp(base.ballSpeedMultiplier + scale * 0.015, 1, 1.22);
      stage.itemDropMultiplier = clamp(base.itemDropMultiplier + scale * 0.015, 0.8, 1.35);
      stage.backgroundVariant = number % 10;

      if (number % Math.max(1, rules.bossEvery || 5) === 0) {
        var endlessBosses = ["sentinel", "gatekeeper", "mirror_lord", "core"];
        var bossIndex = Math.floor(number / Math.max(1, rules.bossEvery || 5) - 1) % endlessBosses.length;
        stage.type = "boss";
        stage.bossId = endlessBosses[bossIndex];
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

  function getZoneData(id) {
    return Data.ZONES && Data.ZONES[id] ? Data.ZONES[id] : (Data.ZONES ? Data.ZONES.gate : null);
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

  function isUnlocked(state, group, id) {
    var save = state && state.persistent;
    var unlocks = save && save.unlocks && save.unlocks[group];

    if (!id) {
      return false;
    }

    if (unlocks && typeof unlocks[id] === "boolean") {
      return unlocks[id];
    }

    return true;
  }

  function hashSeed(text) {
    var hash = 2166136261;
    var input = String(text || "");

    for (var index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function getLocalDateKey() {
    var date = new Date();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function random(state) {
    if (!state || !state.rng) {
      return Math.random();
    }

    var next = (Math.imul(1664525, state.rng.state >>> 0) + 1013904223) >>> 0;
    state.rng.state = next;
    return next / 4294967296;
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

  function hasEvolution(state, id) {
    return !!(state.activeEvolutions && state.activeEvolutions[id]);
  }

  function discover(group, id) {
    if (State.discover) {
      State.discover(group, id);
      stateSyncPersistent(State.getRunState());
    }
  }

  function stateSyncPersistent(state) {
    if (state && State.getRunState && state === State.getRunState()) {
      state.persistent = State.getRunState().persistent;
    }
  }

  function getStageMissionData(state) {
    var stage = getStageData(state);
    var id = stage.stageMissionId || (Data.STAGE_MISSION_BY_STAGE && Data.STAGE_MISSION_BY_STAGE[state.stage]);
    return id && Data.STAGE_MISSIONS ? Data.STAGE_MISSIONS[id] : null;
  }

  function startStageMission(state) {
    var mission = getStageMissionData(state);

    state.currentStageMission = mission ? {
      id: mission.id,
      stage: state.stage,
      progress: mission.type === "fail_on_life_lost" ? 0 : 0,
      target: mission.target || 1,
      completed: false,
      failed: false,
      rewarded: false,
      startedAt: state.time.elapsed || 0
    } : null;
    state.stageMissionProgress = {};
    if (mission) {
      state.stageMissionProgress[mission.id] = state.currentStageMission;
    }
  }

  function failStageMission(state, reason) {
    var progress = state.currentStageMission;

    if (!progress || progress.completed || progress.failed) {
      return false;
    }

    progress.failed = true;
    progress.failReason = reason || "조건 실패";
    state.failedStageMissions[state.stage] = progress.id;
    addFloatingText(state, getWidth(state) / 2, 128, "미션 실패", "#ff6b6b");
    state.flags.needsHudUpdate = true;
    return true;
  }

  function completeStageMission(state) {
    var progress = state.currentStageMission;
    var mission = progress && Data.STAGE_MISSIONS ? Data.STAGE_MISSIONS[progress.id] : null;

    if (!progress || !mission || progress.completed || progress.failed) {
      return false;
    }

    progress.completed = true;
    progress.progress = progress.target;
    addFloatingText(state, getWidth(state) / 2, 128, "미션 완료", "#f2c94c");
    emitFeedback("mission", [18, 30, 18]);
    state.flags.needsHudUpdate = true;
    return true;
  }

  function recordMissionEvent(state, event, amount) {
    var progress = state.currentStageMission;
    var mission = progress && Data.STAGE_MISSIONS ? Data.STAGE_MISSIONS[progress.id] : null;

    if (!progress || !mission || progress.completed || progress.failed || mission.event !== event) {
      return false;
    }

    progress.progress = Math.min(progress.target, (progress.progress || 0) + Math.max(1, amount || 1));
    if (progress.progress >= progress.target) {
      completeStageMission(state);
    }
    state.flags.needsHudUpdate = true;
    return true;
  }

  function finishStageMission(state) {
    var progress = state.currentStageMission;
    var mission = progress && Data.STAGE_MISSIONS ? Data.STAGE_MISSIONS[progress.id] : null;

    if (!progress || !mission || progress.rewarded) {
      return null;
    }

    if (!progress.failed && mission.type === "fail_on_life_lost") {
      completeStageMission(state);
    }
    if (!progress.failed && mission.type === "time_limit") {
      var elapsed = Math.max(0, (state.time.elapsed || 0) - (progress.startedAt || 0));
      if (elapsed <= (mission.target || 90)) {
        completeStageMission(state);
      } else {
        failStageMission(state, "시간 초과");
      }
    }

    if (!progress.completed || progress.failed) {
      state.failedStageMissions[state.stage] = progress.id;
      return { id: progress.id, completed: false, text: "미션 실패" };
    }

    progress.rewarded = true;
    state.completedStageMissions[state.stage] = progress.id;
    state.runStats.missionCompleted = (state.runStats.missionCompleted || 0) + 1;
    state.persistent.missions = state.persistent.missions || { completedMissionIds: {}, totalCompleted: 0, bestMissionCountInRun: 0 };
    if (!state.persistent.missions.completedMissionIds[progress.id]) {
      state.persistent.missions.completedMissionIds[progress.id] = true;
    }
    state.persistent.missions.totalCompleted = Math.max(0, state.persistent.missions.totalCompleted || 0) + 1;
    state.persistent.missions.bestMissionCountInRun = Math.max(state.persistent.missions.bestMissionCountInRun || 0, state.runStats.missionCompleted || 0);

    if (mission.reward && mission.reward.abyssStones) {
      state.persistent.abyssStones = Math.max(0, state.persistent.abyssStones || 0) + mission.reward.abyssStones;
      state.persistent.totalAbyssStonesEarned = Math.max(0, state.persistent.totalAbyssStonesEarned || 0) + mission.reward.abyssStones;
    }
    if (mission.reward && mission.reward.scoreBonus) {
      awardScore(state, mission.reward.scoreBonus, getWidth(state) / 2, 106, 1);
    }

    state.persistent = State.savePersistent(state.persistent);
    return { id: progress.id, completed: true, text: "미션 완료 + 심연석 " + (mission.reward.abyssStones || 0) };
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
      (hasRelic(state, "giant_grip") ? 1.15 : 1) *
      (1 + getMetaLevel(state, "paddleWidth") * 0.03) *
      (1 + getUpgradeLevel(state, "paddle_guard") * 0.12);
  }

  function getMaxBalls(state) {
    return Data.GAME.maxBalls + getUpgradeLevel(state, "multi_capacity") * 2 + (hasEvolution(state, "split_storm") ? 1 : 0);
  }

  function getStartBallCount(state) {
    var relicBonus = hasRelic(state, "twin_core") ? 1 : 0;
    var evolutionBonus = hasEvolution(state, "split_storm") ? 1 : 0;
    return clamp(1 + getUpgradeLevel(state, "split_start") + relicBonus + evolutionBonus, 1, getMaxBalls(state));
  }

  function getBrickDamage(state) {
    var counters = state.evolutionCounters || {};
    return 1 + getClassData(state).brickDamageAdd + getUpgradeLevel(state, "break_power") +
      Math.max(0, counters.precisionPrimed || 0) +
      Math.max(0, counters.portalPrimed || 0) +
      Math.max(0, counters.bumperDamageStacks || 0) +
      (isFocusedLensActive(state) ? 1 : 0) +
      (hasEvolution(state, "piercing_nature") ? 1 : 0) +
      (hasEvolution(state, "last_focus") && activeBallCount(state) === 1 ? 2 : 0);
  }

  function getPierceCount(state) {
    return getUpgradeLevel(state, "piercing_orb") + (hasRelic(state, "piercing_crystal") ? 1 : 0) + (hasEvolution(state, "piercing_nature") ? 1 : 0);
  }

  function getScoreMultiplier(state) {
    var counters = state.evolutionCounters || {};
    return getClassData(state).scoreMultiplier *
      getGameModeData(state).scoreMultiplier *
      (1 + getMetaLevel(state, "scoreBonus") * 0.05) *
      (1 + getUpgradeLevel(state, "score_amp") * 0.25) *
      (counters.precisionScore || 1) *
      (counters.portalScore || 1) *
      (hasRelic(state, "precision_tuner") && getClassData(state).id === "tuner" ? 1.2 : 1) *
      (isFocusedLensActive(state) ? 1.3 : 1) *
      (hasEvolution(state, "split_storm") && activeBallCount(state) >= 3 ? 1.2 : 1) *
      (hasEvolution(state, "last_focus") && activeBallCount(state) === 1 ? 1.5 : 1);
  }

  function getDropMultiplier(state) {
    var rules = getGameModeRules(state);
    return (1 + getUpgradeLevel(state, "nature_drop") * 0.2) * (getClassData(state).itemDropMultiplier || 1) * (rules.itemDropMultiplier || 1);
  }

  function getDurationMultiplier(state) {
    var rules = getGameModeRules(state);
    return (1 + getUpgradeLevel(state, "duration_boost") * 0.25) *
      (getClassData(state).itemDurationMultiplier || 1) *
      (hasRelic(state, "alchemist_star") ? 1.15 : 1) *
      (rules.itemDurationMultiplier || 1);
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
      if (brick.drift && !brick.drift.baseX) {
        brick.drift.baseX = brick.x;
      }
    });
  }

  function relayoutBoss(state) {
    if (!state.boss) {
      return;
    }

    state.boss.x = clamp(state.boss.x, 12, getWidth(state) - state.boss.width - 12);
    state.boss.y = Math.max(30, state.boss.y);
  }

  function relayoutGimmicks(state) {
    var width = getWidth(state);
    var height = getHeight(state);

    (state.gimmicks || []).forEach(function (gimmick) {
      if (gimmick.type === "portal") {
        gimmick.entryX = (gimmick.entry && gimmick.entry.xRatio || 0.5) * width;
        gimmick.entryY = (gimmick.entry && gimmick.entry.yRatio || 0.5) * height;
        gimmick.exitX = (gimmick.exit && gimmick.exit.xRatio || 0.5) * width;
        gimmick.exitY = (gimmick.exit && gimmick.exit.yRatio || 0.5) * height;
      } else {
        gimmick.x = (gimmick.xRatio || 0.5) * width;
        gimmick.y = (gimmick.yRatio || 0.5) * height;
      }

      if (gimmick.type === "movingMirror") {
        gimmick.width = Math.max(34, (gimmick.widthRatio || 0.22) * width);
        gimmick.height = gimmick.height || 8;
        gimmick.minPosition = (gimmick.minRatio || 0.2) * (gimmick.axis === "y" ? height : width);
        gimmick.maxPosition = (gimmick.maxRatio || 0.8) * (gimmick.axis === "y" ? height : width);
      }
    });
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
    state.paddle.y = getHeight(state) - getPaddleBottomOffset(state);
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
    if (Data.CANVAS.maxPixelCount) {
      var cssPixels = Math.max(1, runState.viewport.cssWidth * runState.viewport.cssHeight);
      runState.viewport.devicePixelRatio = Math.min(runState.viewport.devicePixelRatio, Math.sqrt(Data.CANVAS.maxPixelCount / cssPixels));
    }
    runState.viewport.pixelWidth = Math.round(runState.viewport.cssWidth * runState.viewport.devicePixelRatio);
    runState.viewport.pixelHeight = Math.round(runState.viewport.cssHeight * runState.viewport.devicePixelRatio);

    clampPaddle(runState);
    relayoutBricks(runState);
    relayoutBoss(runState);
    relayoutGimmicks(runState);
    syncAttachedBalls(runState);
    runState.flags.needsResize = false;

    return runState.viewport;
  }

  function createBrick(state, row, col, symbol, spawnedByBoss) {
    var stage = getStageData(state);
    var rules = getGameModeRules(state);
    var typeId = Data.BRICK_SYMBOLS[symbol] || "normal";
    var drifting = false;

    if (spawnedByBoss && typeId === "wall") {
      typeId = "strong";
    }
    if (!spawnedByBoss && rules.driftingBricks && typeId !== "wall") {
      var driftLimit = rules.driftingBrickLimit || 8;
      state.runModifiers.driftingCreated = state.runModifiers.driftingCreated || 0;
      if (state.runModifiers.driftingCreated < driftLimit && (row + col) % 3 === 0) {
        state.runModifiers.driftingCreated++;
        drifting = true;
      }
    }

    if (rules.noItems && typeId === "item") {
      typeId = "strong";
    }

    var type = Data.BRICK_TYPES[typeId] || Data.BRICK_TYPES.normal;
    var hp = type.destructible ? Math.max(1, Math.round(type.hp * stage.brickHpMultiplier)) : type.hp;

    if (state.stage >= 6 && typeId === "strong") {
      hp += 1;
    }

    if (spawnedByBoss && type.destructible) {
      hp = Math.min(hp, typeId === "shielded" ? 2 : 3);
    }

    if (stage.pattern && String(stage.pattern[row] || "").charAt(col) === "6") {
      typeId = "shielded";
      type = Data.BRICK_TYPES[typeId] || type;
      hp = Math.max(2, Math.round(type.hp * stage.brickHpMultiplier));
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
      shieldActive: typeId === "shielded",
      shieldTimer: 0,
      rewardGranted: false,
      dropGranted: false,
      spawnedByBoss: !!spawnedByBoss,
      defenseTimeRemaining: spawnedByBoss ? 0 : null,
      drift: drifting ? {
        baseX: 0,
        range: 10 + (col % 3) * 3,
        speed: 0.8 + (row % 2) * 0.25,
        phase: row + col
      } : null
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
      phase: 0,
      rewardGranted: false,
      shieldActive: false,
      weakTimer: 0,
      weakPointSide: "left",
      weakPointTimer: 0,
      forcedWeakTimer: 0,
      lastWeakHitTime: 0,
      weakHitCount: 0,
      bossMechanicProgress: 0,
      lastBossDamageTime: state.time.elapsed || 0,
      defenseBlocks: [],
      speedMultiplier: 1 + endlessScale * 0.06,
      spawnInterval: Math.max(2.4, bossData.spawnInterval * (1 - endlessScale * 0.04))
    };
    state.bossTimers.spawn = state.boss.spawnInterval;
    state.bossTimers.shield = 0;
    state.bossPhase = 0;
    return state.boss;
  }

  function createStageGimmicks(state) {
    var stage = getStageData(state);
    var limits = Data.GIMMICK_LIMITS || {};
    var counts = {};

    state.zoneId = stage.zoneId || "gate";
    state.gimmicks = [];
    (stage.gimmicks || []).forEach(function (source, index) {
      var type = source.type || "bumper";
      counts[type] = (counts[type] || 0) + 1;
      if ((type === "bumper" && counts[type] > (limits.bumpers || 4)) ||
          (type === "portal" && counts[type] > (limits.portals || 2)) ||
          (type === "movingMirror" && counts[type] > (limits.movingMirrors || 3)) ||
          (type === "spinner" && counts[type] > (limits.spinners || 2))) {
        return;
      }

      var gimmick = JSON.parse(JSON.stringify(source));
      gimmick.id = type + ":" + state.stage + ":" + index;
      gimmick.active = true;
      gimmick.cooldowns = {};
      gimmick.angle = gimmick.angle || 0;
      gimmick.direction = gimmick.direction || 1;
      gimmick.radius = gimmick.radius || 15;
      gimmick.speedBoost = gimmick.speedBoost || 1.05;
      gimmick.collisionCooldown = gimmick.collisionCooldown || 10;
      state.gimmicks.push(gimmick);
    });
    relayoutGimmicks(state);
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
    state.activeEffects.magneticPaddleTimeRemaining = 0;
    state.activeEffects.laserPaddleTimeRemaining = 0;
    state.activeEffects.laserCooldown = 0;
    state.activeEffects.bottomBarrierTimeRemaining = 0;
    state.activeEffects.bottomBarrierDurability = 0;
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
    runState.stageRelicFlags.voidSaved = false;
    runState.particles = [];
    runState.effects = [];
    runState.floatingTexts = [];
    runState.items = [];
    runState.gimmicks = [];
    runState.gimmickEffects = [];
    runState.gimmickTimers = {};
    runState.evolutionStageFlags = {};
    if (runState.evolutionCounters) {
      runState.evolutionCounters.precisionPrimed = 0;
      runState.evolutionCounters.precisionScore = 1;
      runState.evolutionCounters.portalPrimed = 0;
      runState.evolutionCounters.portalScore = 1;
      runState.evolutionCounters.bumperDamageStacks = 0;
    }
    runState.upgrades.pending = [];
    runState.upgrades.selectionLocked = false;
    runState.stageStartedAt = runState.time.elapsed || 0;
    runState.runModifiers.driftingCreated = 0;
    buildStage(runState);
    createBoss(runState);
    createStageGimmicks(runState);
    startStageMission(runState);
    discover("zones", runState.zoneId || "gate");
    if (runState.boss) {
      discover("bosses", runState.boss.id);
    }
    resetBallToPaddle(runState);
    if (hasEvolution(runState, "abyss_rebirth")) {
      runState.activeEffects.bottomBarrierTimeRemaining = Math.max(runState.activeEffects.bottomBarrierTimeRemaining || 0, 8);
      runState.activeEffects.bottomBarrierDurability = Math.max(runState.activeEffects.bottomBarrierDurability || 0, 1);
      runState.evolutionStageFlags.abyssRebirth = true;
    }
    runState.highestStageReached = Math.max(runState.highestStageReached || 1, runState.stage);
    State.updateHighestStage(runState.stage);
    State.setMode(Data.MODES.READY);
    runState.flags.needsHudUpdate = true;
    State.saveActiveRun(runState, Data.MODES.READY);
    return runState;
  }

  function startRun(state) {
    var runState = getState(state);
    var classData = getClassData(runState);
    var modeData = Data.GAME_MODES[runState.persistent.selectedGameModeId] || Data.GAME_MODES.standard;
    var rules = modeData.rules || {};
    var extraLives = rules.ignoreExtraLife ? 0 : getMetaLevel(runState, "extraLife") + classData.maxLifeAdd;

    State.clearActiveRun();
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
    runState.runStats.missionCompleted = 0;
    runState.runStats.bestCombo = 0;
    runState.runStats.laserBreaks = 0;
    runState.runStats.weakHits = 0;
    runState.runStats.precisionHits = 0;
    runState.runStats.explosionChains = 0;
    runState.runStats.bottomBarrierSaves = 0;
    runState.highestStageReached = Data.GAME.startingStage;
    runState.bossesDefeated = 0;
    runState.earnedAbyssStones = 0;
    runState.selectedRelicId = null;
    runState.selectedRelicIds = [];
    runState.relicChoices = [];
    runState.activeEvolutions = {};
    runState.evolutionCounters = {
      itemsCollected: 0,
      chainedExplosionsThisFrame: 0,
      precisionPrimed: 0,
      precisionScore: 1,
      portalPrimed: 0,
      portalScore: 1,
      bumperDamageStacks: 0,
      dailyRewardStage5: false,
      dailyRewardClear: false
    };
    runState.evolutionStageFlags = {};
    runState.runModifiers = {};
    runState.currentStageMission = null;
    runState.stageMissionProgress = {};
    runState.completedStageMissions = {};
    runState.failedStageMissions = {};
    runState.runSummary = null;
    runState.selectedBallSkinId = runState.persistent.cosmetics ? runState.persistent.cosmetics.selectedBallSkinId : "default_ball";
    runState.selectedPaddleSkinId = runState.persistent.cosmetics ? runState.persistent.cosmetics.selectedPaddleSkinId : "default_paddle";
    if (rules.daily) {
      var dateKey = getLocalDateKey();
      var seed = hashSeed(dateKey + ":" + runState.selectedClassId);
      runState.rng = { seed: seed, state: seed || 1, dailyDate: dateKey };
    } else {
      runState.rng = null;
    }
    runState.tutorial = {
      active: !!(runState.persistent.tutorial && !runState.persistent.tutorial.completed && !runState.persistent.tutorial.skipped),
      step: 0
    };
    runState.relicCounters = {
      bricksDestroyed: 0
    };
    runState.stageRelicFlags = {
      guardianSaved: false,
      voidSaved: false
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

    if (getGameModeRules(runState).reverseControls) {
      x = getWidth(runState) - x;
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

    if (runState.mode !== Data.MODES.READY && runState.mode !== Data.MODES.PLAYING) {
      return false;
    }

    var attached = runState.balls.filter(function (ball) {
      return ball.attached;
    });
    var speed = getCurrentBallSpeed(runState);

    if (!attached.length) {
      return false;
    }

    attached.forEach(function (ball, index) {
      var spreadIndex = index - (attached.length - 1) / 2;
      var angle = (Data.BALL.launchAngleDegrees + spreadIndex * Data.BALL.launchSpreadDegrees) * Math.PI / 180;

      ball.attached = false;
      ball.magneticHold = 0;
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

    if (runState.mode !== Data.MODES.PLAYING) {
      State.setMode(Data.MODES.PLAYING);
    }
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

    if (ball.y + ball.radius > getHeight(state) - 8 && state.activeEffects.bottomBarrierDurability > 0) {
      ball.y = getHeight(state) - 8 - ball.radius;
      ball.vy = -Math.abs(ball.vy);
      normalizeBallVelocity(state, ball);
      state.activeEffects.bottomBarrierDurability = Math.max(0, state.activeEffects.bottomBarrierDurability - 1);
      if (state.activeEffects.bottomBarrierDurability <= 0) {
        state.activeEffects.bottomBarrierTimeRemaining = 0;
      }
      state.runStats.bottomBarrierSaves = (state.runStats.bottomBarrierSaves || 0) + 1;
      recordMissionEvent(state, "bottom_barrier_save", 1);
      addLineEffect(state, 12, getHeight(state) - 8, getWidth(state) - 12, getHeight(state) - 8, "#9ee6a8");
    }

    if (ball.y - ball.radius > getHeight(state) && hasRelic(state, "void_safety_net") && !state.stageRelicFlags.voidSaved && random(state) < 0.5) {
      state.stageRelicFlags.voidSaved = true;
      ball.y = state.paddle.y - ball.radius - 2;
      ball.vy = -Math.abs(ball.vy || getCurrentBallSpeed(state));
      normalizeBallVelocity(state, ball);
      addFloatingText(state, getWidth(state) / 2, state.paddle.y - 22, "Safety Net", "#9ee6a8");
      return;
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

    if (state.activeEffects.magneticPaddleTimeRemaining > 0 && !ball.magneticHold) {
      ball.attached = true;
      ball.active = true;
      ball.magneticHold = 1.5;
      ball.vx = 0;
      ball.vy = 0;
      syncAttachedBalls(state);
      addFloatingText(state, ball.x, paddle.y - 12, "자석", "#c7f0ff");
      return;
    }

    var relativeHit = clamp((ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
    var maxAngle = 68 * Math.PI / 180;
    var angle = relativeHit * maxAngle;
    var speed = getCurrentBallSpeed(state);
    var classData = getClassData(state);

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
    if (classData.id === "tuner" && Math.abs(relativeHit) <= (classData.precisionZone || 0.3)) {
      state.evolutionCounters = state.evolutionCounters || {};
      state.evolutionCounters.precisionPrimed = Math.max(state.evolutionCounters.precisionPrimed || 0, classData.precisionDamageAdd || 1);
      state.evolutionCounters.precisionScore = Math.max(state.evolutionCounters.precisionScore || 1, classData.precisionScoreMultiplier || 1.4);
      if (hasEvolution(state, "perfect_tuning")) {
        state.evolutionCounters.precisionPrimed = Math.max(state.evolutionCounters.precisionPrimed, 2);
      }
      if (hasRelic(state, "mirror_shard") && state.balls.length < getMaxBalls(state) && random(state) < 0.35) {
        splitBalls(state, 1);
      }
      state.runStats.precisionHits = (state.runStats.precisionHits || 0) + 1;
      recordMissionEvent(state, "precision_hit", 1);
      addFloatingText(state, ball.x, paddle.y - 18, "정밀", "#f2c94c");
    }
    addParticles(state, ball.x, ball.y + ball.radius, "#f3f7ff", 5);
  }

  function canHitCooldown(state, ball, key, frames) {
    var lastHitFrame = ball.collisionCooldowns[key] || -99;
    if (state.time.frame - lastHitFrame < frames) {
      return false;
    }
    ball.collisionCooldowns[key] = state.time.frame;
    return true;
  }

  function handleCircleGimmick(state, ball, gimmick, cx, cy, radius) {
    var dx = ball.x - cx;
    var dy = ball.y - cy;
    var limit = ball.radius + radius;
    var distanceSq = dx * dx + dy * dy;

    if (distanceSq > limit * limit || !canHitCooldown(state, ball, "gimmick:" + gimmick.id, gimmick.collisionCooldown || 10)) {
      return false;
    }

    var distance = Math.sqrt(distanceSq) || 1;
    var nx = dx / distance;
    var ny = dy / distance;
    reflect(ball, nx, ny);
    ball.x = cx + nx * (limit + 0.5);
    ball.y = cy + ny * (limit + 0.5);
    ball.speedMultiplier = clamp((ball.speedMultiplier || 1) * (gimmick.speedBoost || 1.03), 1, 1.2);
    normalizeBallVelocity(state, ball, getBallSpeed(state, ball));
    if (gimmick.type === "bumper" && hasRelic(state, "bumper_core")) {
      state.evolutionCounters = state.evolutionCounters || {};
      state.evolutionCounters.bumperDamageStacks = clamp((state.evolutionCounters.bumperDamageStacks || 0) + 1, 0, 3);
      addFloatingText(state, cx, cy - radius, "Bumper +" + state.evolutionCounters.bumperDamageStacks, "#65c8ff");
    }
    if (gimmick.type === "bumper" || gimmick.type === "spinner") {
      recordMissionEvent(state, "bumper_hit", 1);
    }
    addRingEffect(state, cx, cy, radius + 6, gimmick.type === "spinner" ? "#f2c94c" : "#65c8ff");
    return true;
  }

  function handlePortalGimmick(state, ball, gimmick) {
    var radius = gimmick.radius || 15;

    if (!handleCircleGimmick(state, ball, gimmick, gimmick.entryX, gimmick.entryY, radius)) {
      return false;
    }

    ball.x = gimmick.exitX;
    ball.y = gimmick.exitY;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    state.runModifiers.portalPrimedForMission = 3;
    if (hasRelic(state, "portal_resonator")) {
      state.evolutionCounters = state.evolutionCounters || {};
      state.evolutionCounters.portalPrimed = Math.max(state.evolutionCounters.portalPrimed || 0, hasEvolution(state, "dimensional_refraction") ? 2 : 1);
      state.evolutionCounters.portalScore = Math.max(state.evolutionCounters.portalScore || 1, 1.35);
      if (hasEvolution(state, "dimensional_refraction")) {
        ball.pierceRemaining = Math.max(ball.pierceRemaining || 0, 1);
      }
    }
    addRingEffect(state, gimmick.exitX, gimmick.exitY, radius + 8, "#b06cff");
    return true;
  }

  function handleMirrorGimmick(state, ball, gimmick) {
    var rect = {
      x: gimmick.x - gimmick.width / 2,
      y: gimmick.y - gimmick.height / 2,
      width: gimmick.width,
      height: gimmick.height
    };
    var collision = circleRectCollision(ball, rect);

    if (!collision || !canHitCooldown(state, ball, "gimmick:" + gimmick.id, gimmick.collisionCooldown || 8)) {
      return false;
    }

    reflect(ball, collision.nx, collision.ny);
    separateBall(ball, rect, collision);
    normalizeBallVelocity(state, ball);
    recordMissionEvent(state, "precision_hit", 1);
    addLineEffect(state, rect.x, rect.y + rect.height / 2, rect.x + rect.width, rect.y + rect.height / 2, "#d8e7ff");
    return true;
  }

  function handleGimmickCollisions(state, ball) {
    for (var index = 0; index < (state.gimmicks || []).length; index++) {
      var gimmick = state.gimmicks[index];

      if (!gimmick.active) {
        continue;
      }

      if (gimmick.type === "bumper" && handleCircleGimmick(state, ball, gimmick, gimmick.x, gimmick.y, gimmick.radius || 15)) {
        return true;
      }
      if (gimmick.type === "spinner" && handleCircleGimmick(state, ball, gimmick, gimmick.x, gimmick.y, gimmick.radius || 16)) {
        return true;
      }
      if (gimmick.type === "portal" && handlePortalGimmick(state, ball, gimmick)) {
        return true;
      }
      if (gimmick.type === "movingMirror" && handleMirrorGimmick(state, ball, gimmick)) {
        return true;
      }
    }

    return false;
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
      return !modeRuleListHas(state, "disabledItems", item.id) && isUnlocked(state, "items", item.id);
    });

    if (!items.length) {
      return Data.ITEMS.definitions[0];
    }

    var zone = getZoneData(state.zoneId || getStageData(state).zoneId);
    var modifiers = zone && zone.itemWeightModifiers || {};
    var classData = getClassData(state);
    var total = items.reduce(function (sum, item) {
      var classWeight = item.id === "multi_ball" ? 1 : (classData.itemBrickWeightMultiplier || 1);
      return sum + item.weight * (modifiers[item.id] || 1) * classWeight;
    }, 0);
    var roll = random(state) * total;

    for (var index = 0; index < items.length; index++) {
      var itemWeight = items[index].weight * (modifiers[items[index].id] || 1) * (items[index].id === "multi_ball" ? 1 : (classData.itemBrickWeightMultiplier || 1));
      roll -= itemWeight;

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

    if (state.items.length >= Data.ITEMS.maxActive || (!force && random(state) > chance)) {
      return;
    }

    var definition = weightedItem(state);
    discover("items", definition.id);

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

    if (brick.type === "shielded" && brick.shieldActive) {
      if (source === "explosion") {
        damage = Math.max(1, Math.floor(damage * 0.5));
      } else {
        addFloatingText(state, brick.x + brick.width / 2, brick.y, "보호막", "#d8e7ff");
        return false;
      }
    }

    brick.hp = Math.max(0, brick.hp - damage);
    addParticles(state, brick.x + brick.width / 2, brick.y + brick.height / 2, "#ffffff", 4);

    if (source === "direct" || source === "laser") {
      if (state.evolutionCounters) {
        if ((state.evolutionCounters.precisionPrimed || 0) > 0 && hasEvolution(state, "perfect_tuning")) {
          triggerExplosionDamage(state, brick, 1);
        }
        if ((state.evolutionCounters.portalPrimed || 0) > 0 && hasEvolution(state, "dimensional_refraction")) {
          triggerExplosionDamage(state, brick, 1);
        }
        state.evolutionCounters.precisionPrimed = 0;
        state.evolutionCounters.precisionScore = 1;
        state.evolutionCounters.portalPrimed = 0;
        state.evolutionCounters.portalScore = 1;
        state.evolutionCounters.bumperDamageStacks = 0;
      }

      if (source === "laser" && hasRelic(state, "laser_amplifier") && depth < 2 && random(state) < 0.25) {
        getAdjacentBricks(state, brick, 1).forEach(function (nearby) {
          applyDamageToBrick(state, nearby, 1, "laserSplash", depth + 1);
        });
      }
    }

    if (brick.hp > 0) {
      return false;
    }

    brick.alive = false;

    if (!brick.rewardGranted) {
      brick.rewardGranted = true;
      state.runStats.bricksDestroyed = (state.runStats.bricksDestroyed || 0) + 1;
      if (source === "laser") {
        state.runStats.laserBreaks = (state.runStats.laserBreaks || 0) + 1;
        recordMissionEvent(state, "laser_break", 1);
      }
      if (source === "explosion" || source === "laserSplash") {
        state.runStats.explosionChains = (state.runStats.explosionChains || 0) + 1;
        recordMissionEvent(state, "explosion_chain", 1);
      }
      if ((state.runModifiers.portalPrimedForMission || 0) > 0) {
        state.runModifiers.portalPrimedForMission -= 1;
        recordMissionEvent(state, "portal_break", 1);
      }
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

    if (depth < (hasEvolution(state, "blast_chain") ? 4 : 3) && (brick.explosive || (source === "direct" && random(state) < getDestroyExplosionChance(state)))) {
      triggerExplosionDamage(state, brick, depth + 1);
    }

    return true;
  }

  function triggerExplosionDamage(state, sourceBrick, depth) {
    var cx = sourceBrick.x + sourceBrick.width / 2;
    var cy = sourceBrick.y + sourceBrick.height / 2;
    addRingEffect(state, cx, cy, Math.max(sourceBrick.width, sourceBrick.height) * 1.4, "#ffb15d");

    if (state.evolutionCounters && state.evolutionCounters.chainedExplosionsThisFrame >= (Data.GIMMICK_LIMITS && Data.GIMMICK_LIMITS.explosionChainPerFrame || 12)) {
      return;
    }

    getAdjacentBricks(state, sourceBrick, hasEvolution(state, "blast_chain") ? 2 : 1).forEach(function (brick) {
      if (state.evolutionCounters) {
        state.evolutionCounters.chainedExplosionsThisFrame++;
      }
      applyDamageToBrick(state, brick, hasEvolution(state, "blast_chain") ? 2 : 1, "explosion", depth);
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
        continue;
      }

      ball.collisionCooldowns[brick.id] = state.time.frame;

      var canPierce = brick.destructible && ball.pierceRemaining > 0;

      if (canPierce) {
        ball.pierceRemaining -= 1;
        addLineEffect(state, ball.prevX, ball.prevY, ball.x, ball.y, "rgba(160, 255, 240, 0.95)");
        if (hasEvolution(state, "piercing_nature") && ball.pierceRemaining === 0) {
          triggerExplosionDamage(state, brick, 1);
        }
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

  function isBossWeakHit(state, x) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      return false;
    }

    if ((boss.weakTimer || 0) > 0 || (boss.forcedWeakTimer || 0) > 0) {
      return true;
    }
    if (boss.id === "sentinel") {
      var center = boss.x + boss.width / 2;
      return boss.weakPointSide === "left" ? x <= center : x >= center;
    }
    if (boss.id === "gatekeeper") {
      return (state.runModifiers.portalPrimedForMission || 0) > 0;
    }
    if (boss.id === "mirror_lord") {
      return (state.evolutionCounters && (state.evolutionCounters.precisionPrimed || 0) > 0);
    }
    if (boss.id === "core") {
      return countBossSpawnedBricks(state) === 0 || (boss.weakTimer || 0) > 0;
    }

    return false;
  }

  function applyDamageToBoss(state, amount, x, y, extraMultiplier) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      return false;
    }

    var bossData = getBossData(boss.id);
    var reduction = boss.shieldActive ? bossData.damageReduction : 0;
    var damageMultiplier = (1 + getMetaLevel(state, "bossDamage") * 0.05) * (hasRelic(state, "boss_breaker") ? 1.5 : 1);
    var weakHit = isBossWeakHit(state, x);
    var sourceMultiplier = typeof extraMultiplier === "number" && isFinite(extraMultiplier) ? extraMultiplier : 1;
    var damage = Math.max(1, Math.floor(amount * damageMultiplier * (weakHit ? 1.75 : 1) * (1 - reduction) * sourceMultiplier));

    boss.hp = Math.max(0, boss.hp - damage);
    boss.lastBossDamageTime = state.time.elapsed || 0;
    if (weakHit) {
      boss.weakHitCount = (boss.weakHitCount || 0) + 1;
      boss.lastWeakHitTime = state.time.elapsed || 0;
      state.runStats.weakHits = (state.runStats.weakHits || 0) + 1;
      recordMissionEvent(state, "boss_weak_hit", 1);
    }
    addFloatingText(state, x, y, (weakHit ? "약점 -" : "-") + damage, weakHit ? "#f2c94c" : (boss.shieldActive ? "#65c8ff" : "#ffffff"));
    addParticles(state, x, y, weakHit ? "#f2c94c" : (boss.shieldActive ? "#65c8ff" : "#e65f4b"), weakHit ? 12 : 8);

    if (boss.hp > 0) {
      return false;
    }

    boss.alive = false;
    state.bricks.forEach(function (brick) {
      if (brick.spawnedByBoss) {
        brick.alive = false;
      }
    });

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
        handleGimmickCollisions(state, ball);
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

  function splitBalls(state, forcedCount) {
    var source = state.balls.filter(function (ball) {
      return ball.active && !ball.attached;
    })[0] || state.balls[0];

    if (!source) {
      return;
    }

    var additions = Math.min(forcedCount || 2, getMaxBalls(state) - state.balls.length);
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

    var durationScale = item.echoDurationScale || 1;

    if (item.type === "paddle_expand") {
      state.paddle.expandTimeRemaining = Data.PADDLE.expandDuration * getDurationMultiplier(state) * durationScale * (hasRelic(state, "giant_grip") ? 1.2 : 1);
      clampPaddle(state);
      addFloatingText(state, item.x + item.width / 2, item.y, "패들 확장", "#35c98f");
    } else if (item.type === "multi_ball") {
      splitBalls(state);
      addFloatingText(state, item.x + item.width / 2, item.y, "멀티볼", "#f2c94c");
    } else if (item.type === "slow_ball") {
      state.activeEffects.slowBallTimeRemaining = getItemDefinition("slow_ball").duration * getDurationMultiplier(state) * durationScale;
      state.balls.forEach(function (ball) {
        if (ball.active && !ball.attached) {
          normalizeBallVelocity(state, ball, getBallSpeed(state, ball));
        }
      });
      addFloatingText(state, item.x + item.width / 2, item.y, "감속", "#65c8ff");
    }

    if (item.type === "magnetic_paddle") {
      state.activeEffects.magneticPaddleTimeRemaining = getItemDefinition("magnetic_paddle").duration * getDurationMultiplier(state) * durationScale;
      addFloatingText(state, item.x + item.width / 2, item.y, "자석", "#c7f0ff");
    } else if (item.type === "laser_paddle") {
      state.activeEffects.laserPaddleTimeRemaining = getItemDefinition("laser_paddle").duration * getDurationMultiplier(state) * durationScale;
      state.activeEffects.laserCooldown = 0;
      addFloatingText(state, item.x + item.width / 2, item.y, "레이저", "#ff8da1");
    } else if (item.type === "bottom_barrier") {
      state.activeEffects.bottomBarrierTimeRemaining = getItemDefinition("bottom_barrier").duration * getDurationMultiplier(state) * durationScale;
      state.activeEffects.bottomBarrierDurability = Math.max(state.activeEffects.bottomBarrierDurability || 0, (getItemDefinition("bottom_barrier").value || 3) + (hasRelic(state, "void_safety_net") ? 2 : 0));
      addFloatingText(state, item.x + item.width / 2, item.y, "보호막", "#9ee6a8");
    }

    if (!item.virtual) {
      state.runStats.itemsCollected = (state.runStats.itemsCollected || 0) + 1;
      state.runStats.itemCounts = state.runStats.itemCounts || {};
      state.runStats.itemCounts[item.type] = (state.runStats.itemCounts[item.type] || 0) + 1;
      discover("items", item.type);
      recordMissionEvent(state, "item_collected", 1);
      emitFeedback("item", 10);
    }
    if (state.evolutionCounters && !item.virtual) {
      state.evolutionCounters.itemsCollected = (state.evolutionCounters.itemsCollected || 0) + 1;
      if (hasEvolution(state, "item_bloom") && state.evolutionCounters.itemsCollected % 3 === 0) {
        applyItem(state, { type: weightedItem(state).id, x: item.x, y: item.y, width: item.width, height: item.height, color: item.color, virtual: true });
      }
      if (hasEvolution(state, "alchemy_bloom") && getItemDefinition(item.type).duration && random(state) < 0.4) {
        var timedItems = Data.ITEMS.definitions.filter(function (definition) {
          return definition.id !== item.type && definition.duration && isUnlocked(state, "items", definition.id) && !modeRuleListHas(state, "disabledItems", definition.id);
        });
        if (timedItems.length) {
          var echoed = timedItems[Math.floor(random(state) * timedItems.length)];
          applyItem(state, { type: echoed.id, x: item.x, y: item.y, width: item.width, height: item.height, color: echoed.color, virtual: true, echoDurationScale: 0.4 });
        }
      }
    }
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

  function releaseAttachedBall(state, ball) {
    var speed = getCurrentBallSpeed(state);
    ball.attached = false;
    ball.active = true;
    ball.magneticHold = 0;
    ball.x = state.paddle.x + state.paddle.width / 2;
    ball.y = state.paddle.y - ball.radius - 2;
    ball.vx = Math.sin(0.18) * speed;
    ball.vy = -Math.cos(0.18) * speed;
    normalizeBallVelocity(state, ball, speed);
  }

  function firePaddleLaser(state) {
    var x = state.paddle.x + state.paddle.width / 2;
    var target = null;

    state.bricks.some(function (brick) {
      if (!brick.alive || !brick.destructible || brick.type === "wall") {
        return false;
      }
      if (x >= brick.x && x <= brick.x + brick.width) {
        target = brick;
        return true;
      }
      return false;
    });

    addLimited(state.effects, {
      type: "laser",
      x1: x,
      y1: state.paddle.y,
      x2: x,
      y2: target ? target.y + target.height : 18,
      color: "#ff8da1",
      age: 0,
      life: 0.12
    }, Data.GIMMICK_LIMITS && Data.GIMMICK_LIMITS.lasers || 12);

    if (target && !(target.type === "shielded" && target.shieldActive)) {
      applyDamageToBrick(state, target, 1, "laser", 0);
    }

    if (state.boss && state.boss.alive && x >= state.boss.x && x <= state.boss.x + state.boss.width) {
      applyDamageToBoss(state, 1, x, state.boss.y + state.boss.height / 2, 0.45);
    }
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

    if (state.activeEffects.magneticPaddleTimeRemaining > 0) {
      state.activeEffects.magneticPaddleTimeRemaining = Math.max(0, state.activeEffects.magneticPaddleTimeRemaining - dt);
    }

    if (state.activeEffects.bottomBarrierTimeRemaining > 0) {
      state.activeEffects.bottomBarrierTimeRemaining = Math.max(0, state.activeEffects.bottomBarrierTimeRemaining - dt);
      if (state.activeEffects.bottomBarrierTimeRemaining === 0) {
        state.activeEffects.bottomBarrierDurability = 0;
      }
    }

    if (state.activeEffects.laserPaddleTimeRemaining > 0) {
      state.activeEffects.laserPaddleTimeRemaining = Math.max(0, state.activeEffects.laserPaddleTimeRemaining - dt);
      state.activeEffects.laserCooldown = Math.max(0, (state.activeEffects.laserCooldown || 0) - dt);
      if (state.activeEffects.laserCooldown === 0) {
        firePaddleLaser(state);
        state.activeEffects.laserCooldown = getItemDefinition("laser_paddle").value || 0.4;
      }
    }

    state.balls.forEach(function (ball) {
      if (ball.attached && ball.magneticHold > 0) {
        ball.magneticHold = Math.max(0, ball.magneticHold - dt);
        if (ball.magneticHold === 0) {
          releaseAttachedBall(state, ball);
        }
      }
    });
  }

  function updateGimmicks(state, dt) {
    (state.gimmicks || []).forEach(function (gimmick) {
      if (!gimmick.active) {
        return;
      }

      if (gimmick.type === "movingMirror") {
        var value = gimmick.axis === "y" ? gimmick.y : gimmick.x;
        value += (gimmick.moveSpeed || 40) * (gimmick.direction || 1) * dt;
        if (value < gimmick.minPosition) {
          value = gimmick.minPosition;
          gimmick.direction = 1;
        } else if (value > gimmick.maxPosition) {
          value = gimmick.maxPosition;
          gimmick.direction = -1;
        }
        if (gimmick.axis === "y") {
          gimmick.y = value;
        } else {
          gimmick.x = value;
        }
      } else if (gimmick.type === "spinner") {
        gimmick.angle += (gimmick.angleSpeed || 1) * dt;
      }
    });

    state.bricks.forEach(function (brick) {
      if (brick.spawnedByBoss && brick.defenseTimeRemaining > 0) {
        brick.defenseTimeRemaining = Math.max(0, brick.defenseTimeRemaining - dt);
        if (brick.defenseTimeRemaining === 0) {
          brick.alive = false;
          return;
        }
      }

      var type = Data.BRICK_TYPES[brick.type];
      if (!brick.alive || brick.type !== "shielded" || !type) {
        return;
      }
      brick.shieldTimer = (brick.shieldTimer + dt) % (type.shieldCycle || 4.8);
      brick.shieldActive = brick.shieldTimer <= (type.shieldDuration || 2.2);
    });

    if (state.evolutionCounters) {
      state.evolutionCounters.chainedExplosionsThisFrame = 0;
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

  function getBossDefenseLimit(bossData, hpRatio) {
    var base = bossData.maxDefenseBlocks || bossData.maxSpawnedBricks || 4;

    if (hpRatio <= (bossData.phaseDefenseRelaxAtHpRatio || 0.3)) {
      return Math.max(2, Math.floor(base * 0.5));
    }

    return base;
  }

  function spawnBossBricks(state, count) {
    var boss = state.boss;
    var bossData = boss ? getBossData(boss.id) : null;

    if (!bossData) {
      return;
    }

    var hpRatio = boss.hp / Math.max(1, boss.maxHp);
    var defenseLimit = getBossDefenseLimit(bossData, hpRatio);
    var layout = getBrickLayout(state);
    var existing = {};

    state.bricks.forEach(function (brick) {
      if (brick.alive) {
        existing[brick.row + ":" + brick.col] = true;
      }
    });

    for (var i = 0; i < count && countBossSpawnedBricks(state) < defenseLimit; i++) {
      var row = random(state) < 0.72 ? 0 : 1;
      var centerCol = Math.floor(layout.columns / 2);
      var col = Math.floor(random(state) * layout.columns);
      var attempts = 0;

      while ((existing[row + ":" + col] || col === centerCol) && attempts < layout.columns * 4) {
        col = (col + 1) % layout.columns;
        attempts++;
      }

      if (existing[row + ":" + col] || col === centerCol) {
        continue;
      }

      var roll = random(state);
      var symbol = roll < 0.18 && hpRatio > (bossData.phaseDefenseRelaxAtHpRatio || 0.3) ? "6" : roll < 0.62 ? "2" : "1";
      var brick = createBrick(state, row, col, symbol, true);
      brick.defenseTimeRemaining = bossData.defenseBlockLifetime || 8;
      if (brick.type === "shielded") {
        brick.shieldActive = false;
        brick.shieldTimer = (Data.BRICK_TYPES.shielded.shieldDuration || 2.2) + 0.1;
      }
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
    var nextPhase = hpRatio <= 0.33 ? 2 : hpRatio <= 0.66 ? 1 : 0;
    var speed = (hpRatio <= 0.5 ? bossData.enragedMoveSpeed : bossData.moveSpeed) * (boss.speedMultiplier || 1);
    var defenseLimit = getBossDefenseLimit(bossData, hpRatio);

    boss.weakPointTimer = Math.max(0, (boss.weakPointTimer || 0) - dt);
    boss.forcedWeakTimer = Math.max(0, (boss.forcedWeakTimer || 0) - dt);
    if (boss.weakPointTimer === 0) {
      boss.weakPointSide = boss.weakPointSide === "left" ? "right" : "left";
      boss.weakPointTimer = boss.id === "sentinel" ? 3.2 : 4.2;
    }

    if (countBossSpawnedBricks(state) > defenseLimit) {
      state.bricks
        .filter(function (brick) { return brick.alive && brick.spawnedByBoss; })
        .sort(function (a, b) { return (a.defenseTimeRemaining || 0) - (b.defenseTimeRemaining || 0); })
        .slice(0, countBossSpawnedBricks(state) - defenseLimit)
        .forEach(function (brick) { brick.alive = false; });
    }

    if (nextPhase > (boss.phase || 0)) {
      boss.phase = nextPhase;
      enterBossPhase(state, boss, nextPhase);
    }

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
      var spawnCount = bossData.spawnCountMin + Math.floor(random(state) * (bossData.spawnCountMax - bossData.spawnCountMin + 1));
      spawnBossBricks(state, spawnCount);
      state.bossTimers.spawn = boss.spawnInterval || bossData.spawnInterval;
    }

    if ((state.time.elapsed || 0) - (boss.lastBossDamageTime || 0) >= (bossData.noDamageLimit || 8)) {
      boss.weakTimer = Math.max(boss.weakTimer || 0, bossData.forcedWeakTime || 3);
      boss.forcedWeakTimer = Math.max(boss.forcedWeakTimer || 0, bossData.forcedWeakTime || 3);
      boss.lastBossDamageTime = state.time.elapsed || 0;
      addFloatingText(state, boss.x + boss.width / 2, boss.y + boss.height + 18, "약점 노출", "#f2c94c");
    }

    if (boss.weakTimer > 0) {
      boss.weakTimer = Math.max(0, boss.weakTimer - dt);
    }

    if (bossData.shieldCycle) {
      state.bossTimers.shield = (state.bossTimers.shield + dt) % bossData.shieldCycle;
      boss.shieldActive = boss.weakTimer > 0 ? false : state.bossTimers.shield <= bossData.shieldDuration;
    }
  }

  function addBossGimmick(state, source) {
    if (!source) {
      return;
    }
    var gimmick = JSON.parse(JSON.stringify(source));
    gimmick.id = "boss:" + state.stage + ":" + (state.gimmicks.length + 1);
    gimmick.active = true;
    gimmick.cooldowns = {};
    gimmick.direction = gimmick.direction || 1;
    gimmick.collisionCooldown = gimmick.collisionCooldown || 10;
    state.gimmicks.push(gimmick);
    relayoutGimmicks(state);
  }

  function enterBossPhase(state, boss, phase) {
    if (boss.id === "sentinel") {
      if (phase >= 1) {
        addBossGimmick(state, { type: "portal", pairId: "sentinel", entry: { xRatio: 0.2, yRatio: 0.48 }, exit: { xRatio: 0.8, yRatio: 0.34 }, radius: 14 });
      }
      boss.shieldActive = true;
      state.bossTimers.shield = 0;
    } else if (boss.id === "gatekeeper") {
      if (phase === 1) {
        spawnBossBricks(state, 1);
        addBossGimmick(state, { type: "portal", pairId: "core", entry: { xRatio: 0.16, yRatio: 0.52 }, exit: { xRatio: 0.84, yRatio: 0.36 }, radius: 14 });
      } else if (phase === 2) {
        addBossGimmick(state, { type: "spinner", xRatio: 0.5, yRatio: 0.5, radius: 18, angleSpeed: 1.5 });
      }
    } else if (boss.id === "mirror_lord") {
      if (phase === 1) {
        addBossGimmick(state, { type: "portal", pairId: "mirror", entry: { xRatio: 0.18, yRatio: 0.5 }, exit: { xRatio: 0.82, yRatio: 0.36 }, radius: 14 });
      } else if (phase === 2) {
        addBossGimmick(state, { type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.62, widthRatio: 0.28, height: 8, minRatio: 0.18, maxRatio: 0.82, moveSpeed: 70 });
      }
    } else if (boss.id === "core") {
      if (phase === 1) {
        spawnBossBricks(state, 1);
        addBossGimmick(state, { type: "portal", pairId: "core", entry: { xRatio: 0.16, yRatio: 0.52 }, exit: { xRatio: 0.84, yRatio: 0.36 }, radius: 14 });
      } else if (phase === 2) {
        addBossGimmick(state, { type: "spinner", xRatio: 0.5, yRatio: 0.5, radius: 18, angleSpeed: 1.5 });
        addBossGimmick(state, { type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.62, widthRatio: 0.26, height: 8, minRatio: 0.18, maxRatio: 0.82, moveSpeed: 64 });
      }
    }
    addFloatingText(state, getWidth(state) / 2, 88, "보스 페이즈 " + (phase + 1), "#f2c94c");
  }

  function hasLivingDestructibleBrick(state) {
    return state.bricks.some(function (brick) {
      return brick.alive && brick.destructible;
    });
  }

  function updateDriftingBricks(state) {
    if (!getGameModeRules(state).driftingBricks) {
      return;
    }

    state.bricks.forEach(function (brick) {
      if (!brick.alive || !brick.drift) {
        return;
      }
      brick.x = clamp(
        brick.drift.baseX + Math.sin((state.time.elapsed || 0) * brick.drift.speed + brick.drift.phase) * brick.drift.range,
        6,
        getWidth(state) - brick.width - 6
      );
    });
  }

  function shouldStageClear(state) {
    var bossAlive = state.boss && state.boss.alive;
    if (state.boss) {
      return !bossAlive;
    }
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
    if (save.missions) {
      save.missions.bestMissionCountInRun = Math.max(save.missions.bestMissionCountInRun || 0, state.runStats.missionCompleted || 0);
    }

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

  function grantDailyRewards(state, runClear) {
    if (!state.rng || !state.rng.dailyDate || !state.persistent.dailyChallenge) {
      return 0;
    }

    var dateKey = state.rng.dailyDate;
    var daily = state.persistent.dailyChallenge;
    var rewards = daily.rewards[dateKey] || {};
    var gained = 0;

    if (!rewards.participate) {
      rewards.participate = true;
      gained += 3;
    }
    if (!rewards.stage5 && (state.highestStageReached || state.stage || 1) >= 5) {
      rewards.stage5 = true;
      gained += 5;
    }
    if (!rewards.clear && runClear) {
      rewards.clear = true;
      gained += 10;
    }

    daily.lastDate = dateKey;
    daily.rewards[dateKey] = rewards;
    daily.records[dateKey] = daily.records[dateKey] || { bestScore: 0, bestStage: 1, clearCount: 0 };
    daily.records[dateKey].bestScore = Math.max(daily.records[dateKey].bestScore || 0, state.score || 0);
    daily.records[dateKey].bestStage = Math.max(daily.records[dateKey].bestStage || 1, state.highestStageReached || state.stage || 1);
    if (runClear) {
      daily.records[dateKey].clearCount = Math.max(0, daily.records[dateKey].clearCount || 0) + 1;
    }

    return gained;
  }

  function buildRunSummary(state, runClear, reward) {
    var mostItem = "-";
    var itemCounts = state.runStats.itemCounts || {};

    Object.keys(itemCounts).forEach(function (id) {
      if (mostItem === "-" || itemCounts[id] > itemCounts[mostItem]) {
        mostItem = id;
      }
    });

    return {
      modeId: state.gameModeId,
      modeName: getGameModeData(state).name,
      classId: state.selectedClassId,
      className: getClassData(state).name,
      reachedStage: state.highestStageReached || state.stage || 1,
      score: state.score || 0,
      earnedAbyssStones: reward || 0,
      completedMissions: state.runStats.missionCompleted || 0,
      selectedRelics: (state.selectedRelicIds || []).slice(),
      activeEvolutions: Object.keys(state.activeEvolutions || {}),
      mostCollectedItem: mostItem,
      bricksDestroyed: state.runStats.bricksDestroyed || 0,
      bossesDefeated: state.runStats.bossesDefeated || 0,
      livesLost: state.runStats.livesLost || 0,
      maxActiveBalls: state.runStats.maxActiveBalls || 1,
      runElapsedTime: state.runElapsedTime || 0,
      runClear: !!runClear,
      bestScoreUpdated: state.score >= (state.persistent.bestScore || 0),
      bestStageUpdated: (state.highestStageReached || 1) >= (state.persistent.highestStage || 1)
    };
  }

  function unlockCosmeticRewards(state, runClear) {
    if (!runClear || !State.unlockCosmetic) {
      return;
    }

    if (state.gameModeId === "standard") {
      State.unlockCosmetic("ball", "abyss_ball");
      State.unlockCosmetic("paddle", "abyss_paddle");
      if (state.selectedClassId === "guardian") {
        State.unlockCosmetic("paddle", "guardian_paddle");
      } else if (state.selectedClassId === "destroyer") {
        State.unlockCosmetic("paddle", "destroyer_paddle");
      } else if (state.selectedClassId === "alchemist") {
        State.unlockCosmetic("paddle", "alchemy_paddle");
      } else if (state.selectedClassId === "tuner") {
        State.unlockCosmetic("paddle", "tuner_paddle");
      }
    }
    if (state.activeEvolutions && state.activeEvolutions.split_storm) {
      State.unlockCosmetic("ball", "split_orb");
    }
    if ((state.runStats.precisionHits || 0) >= 30) {
      State.unlockCosmetic("ball", "precision_orb");
    }
    state.persistent = State.getRunState().persistent;
  }

  function grantRunReward(state, runClear) {
    if (state.flags.runRewardGranted) {
      return state.earnedAbyssStones || 0;
    }

    var reward = calculateAbyssReward(state, !!runClear);
    var dailyReward = grantDailyRewards(state, !!runClear);
    reward += dailyReward;
    state.runSummary = buildRunSummary(state, !!runClear, reward);

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

    unlockCosmeticRewards(state, !!runClear);
    state.persistent = State.savePersistent(state.persistent);
    updateRecords(state, !!runClear);
    checkRunAchievements(state, !!runClear);

    if (runClear && state.gameModeId === "standard") {
      State.unlockAllModes();
    }

    State.clearActiveRun();
    emitFeedback(runClear ? "confirm" : "tap", runClear ? [24, 40, 24] : 18);

    return reward;
  }

  function createRelicChoices() {
    var state = State.getRunState();
    var pool = Data.RELICS.filter(function (relic) {
      return !hasRelic(state, relic.id) && !modeRuleListHas(state, "disabledRelics", relic.id) && isUnlocked(state, "relics", relic.id);
    });
    var choices = [];

    while (choices.length < 3 && pool.length) {
      var index = Math.floor(random(state) * pool.length);
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
    State.saveActiveRun(state, Data.MODES.RELIC);
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
    state.lastMissionResult = finishStageMission(state);
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
    var stageData = getStageData(state);
    var shouldOfferRelic = (stageData.type === "boss" || (rules.endless && state.stage % Math.max(1, rules.bossEvery || 5) === 0)) &&
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
    State.updateHighestStage(getGameModeRules(state).finalStage || Data.GAME.finalStage);
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

    failStageMission(state, "생명 손실");

    if ((hasRelic(state, "guardian_field") || hasEvolution(state, "aegis_guard")) && !state.stageRelicFlags.guardianSaved) {
      state.stageRelicFlags.guardianSaved = true;
      state.flags.lifeLostHandled = false;
      resetBallToPaddle(state);
      if (hasEvolution(state, "aegis_guard")) {
        state.paddle.expandTimeRemaining = Math.max(state.paddle.expandTimeRemaining || 0, 6);
        clampPaddle(state);
        syncAttachedBalls(state);
      }
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

    if (state.mode === Data.MODES.PLAYING && activeBallCount(state) === 0 && !state.balls.some(function (ball) { return ball.attached && ball.active; })) {
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

  function pickWeightedUpgrade(state, candidates) {
    var total = candidates.reduce(function (sum, upgrade) {
      return sum + Math.max(0, upgrade.weight);
    }, 0);
    var roll = random(state) * total;

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
      var selected = pickWeightedUpgrade(state, candidates);

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

  function checkEvolutions(state) {
    var activated = [];

    (Data.EVOLUTIONS || []).forEach(function (evolution) {
      var ok = true;

      if (state.activeEvolutions && state.activeEvolutions[evolution.id]) {
        return;
      }

      if (!isUnlocked(state, "evolutions", evolution.id)) {
        return;
      }

      if (evolution.requiredClass && getClassData(state).id !== evolution.requiredClass) {
        ok = false;
      }

      if (evolution.requiredZone && state.zoneId !== evolution.requiredZone) {
        ok = false;
      }

      Object.keys(evolution.requiredUpgrades || {}).forEach(function (upgradeId) {
        if (getUpgradeLevel(state, upgradeId) < evolution.requiredUpgrades[upgradeId]) {
          ok = false;
        }
      });

      (evolution.requiredEvolutions || []).forEach(function (evolutionId) {
        if (!hasEvolution(state, evolutionId)) {
          ok = false;
        }
      });

      (evolution.requiredItems || []).forEach(function (itemId) {
        if (!isUnlocked(state, "items", itemId)) {
          ok = false;
        }
      });

      (evolution.requiredRelics || []).forEach(function (relicId) {
        if (!hasRelic(state, relicId)) {
          ok = false;
        }
      });

      if (!ok) {
        return;
      }

      state.activeEvolutions = state.activeEvolutions || {};
      state.activeEvolutions[evolution.id] = true;
      discover("evolutions", evolution.id);
      emitFeedback("evolution", [16, 28, 16, 28]);
      activated.push(evolution.name);
      addFloatingText(state, getWidth(state) / 2, 132 + activated.length * 18, "능력 진화: " + evolution.name, "#f2c94c");
    });

    if (activated.length) {
      state.flags.needsHudUpdate = true;
    }

    return activated;
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
    State.saveActiveRun(runState, Data.MODES.UPGRADE);
    return true;
  }

  function buildUpgradeChoicesFromIds(state, ids) {
    return ids.map(function (id) {
      var upgrade = getUpgradeById(id);

      if (!upgrade) {
        return null;
      }

      var level = getUpgradeLevel(state, upgrade.id);
      return {
        id: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        category: upgrade.category,
        level: level,
        nextLevel: level + 1,
        maxLevel: upgrade.maxLevel
      };
    }).filter(Boolean);
  }

  function buildRelicChoicesFromIds(ids) {
    return ids.map(function (id) {
      return getRelicById(id);
    }).filter(Boolean);
  }

  function restoreActiveRun() {
    var state = State.getRunState();
    var checkpoint = state.persistent && state.persistent.activeRun;

    if (!checkpoint) {
      return false;
    }

    var runState = State.restartRun();

    runState.stage = checkpoint.stage;
    runState.score = checkpoint.score;
    runState.lives = checkpoint.lives;
    runState.maxLives = checkpoint.maxLives;
    runState.selectedClassId = checkpoint.selectedClassId;
    runState.gameModeId = checkpoint.gameModeId;
    runState.gameModeRules = JSON.parse(JSON.stringify((Data.GAME_MODES[checkpoint.gameModeId] || Data.GAME_MODES.standard).rules || {}));
    runState.runStartedAt = Date.now() - Math.floor((checkpoint.runElapsedTime || 0) * 1000);
    runState.runElapsedTime = checkpoint.runElapsedTime || 0;
    runState.runStats = JSON.parse(JSON.stringify(checkpoint.runStats || runState.runStats));
    runState.highestStageReached = checkpoint.highestStageReached || checkpoint.stage;
    runState.bossesDefeated = checkpoint.bossesDefeated || 0;
    runState.earnedAbyssStones = 0;
    runState.selectedRelicIds = Array.isArray(checkpoint.selectedRelicIds) ? checkpoint.selectedRelicIds.slice() : [];
    runState.selectedRelicId = runState.selectedRelicIds[0] || null;
    runState.activeEvolutions = JSON.parse(JSON.stringify(checkpoint.activeEvolutions || {}));
    runState.evolutionCounters = JSON.parse(JSON.stringify(checkpoint.evolutionCounters || { itemsCollected: 0, chainedExplosionsThisFrame: 0 }));
    runState.evolutionCounters.precisionScore = runState.evolutionCounters.precisionScore || 1;
    runState.evolutionCounters.portalScore = runState.evolutionCounters.portalScore || 1;
    runState.runModifiers = JSON.parse(JSON.stringify(checkpoint.runModifiers || {}));
    runState.currentStageMission = JSON.parse(JSON.stringify(checkpoint.currentStageMission || null));
    runState.stageMissionProgress = JSON.parse(JSON.stringify(checkpoint.stageMissionProgress || {}));
    runState.completedStageMissions = JSON.parse(JSON.stringify(checkpoint.completedStageMissions || {}));
    runState.failedStageMissions = JSON.parse(JSON.stringify(checkpoint.failedStageMissions || {}));
    runState.runSummary = JSON.parse(JSON.stringify(checkpoint.runSummary || null));
    runState.selectedBallSkinId = checkpoint.selectedBallSkinId || (runState.persistent.cosmetics && runState.persistent.cosmetics.selectedBallSkinId) || "default_ball";
    runState.selectedPaddleSkinId = checkpoint.selectedPaddleSkinId || (runState.persistent.cosmetics && runState.persistent.cosmetics.selectedPaddleSkinId) || "default_paddle";
    runState.rng = checkpoint.rng ? JSON.parse(JSON.stringify(checkpoint.rng)) : null;
    runState.zoneId = checkpoint.zoneId || null;
    runState.relicCounters = JSON.parse(JSON.stringify(checkpoint.relicCounters || { bricksDestroyed: 0 }));
    runState.stageRelicFlags = { guardianSaved: false, voidSaved: false };
    runState.flags.runRewardGranted = false;
    runState.flags.runStarted = true;
    runState.upgrades.levels = JSON.parse(JSON.stringify(checkpoint.upgradeLevels || runState.upgrades.levels));
    runState.upgrades.chosen = Array.isArray(checkpoint.chosenUpgrades) ? checkpoint.chosenUpgrades.slice() : [];
    runState.counters.nextBallId = 1;
    runState.counters.nextBrickId = 1;
    runState.counters.nextItemId = 1;

    if (checkpoint.phase === Data.MODES.READY) {
      startStage(runState);
    } else if (checkpoint.phase === Data.MODES.UPGRADE) {
      runState.upgrades.pending = buildUpgradeChoicesFromIds(runState, checkpoint.pendingUpgradeIds || []);
      runState.upgrades.selectionLocked = false;
      State.setMode(Data.MODES.UPGRADE);
      State.saveActiveRun(runState, Data.MODES.UPGRADE);
    } else if (checkpoint.phase === Data.MODES.RELIC) {
      runState.upgrades.pending = [];
      runState.upgrades.selectionLocked = false;
      runState.relicChoices = buildRelicChoicesFromIds(checkpoint.pendingRelicIds || []);
      State.setMode(Data.MODES.RELIC);
      State.saveActiveRun(runState, Data.MODES.RELIC);
    }

    runState.flags.needsHudUpdate = true;
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
    discover("relics", relicId);
    runState.selectedRelicId = runState.selectedRelicIds[0] || relicId;
    runState.runStats.relicsSelected = (runState.runStats.relicsSelected || 0) + 1;
    runState.relicChoices = [];
    checkEvolutions(runState);
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
    discover("upgrades", upgradeId);
    runState.upgrades.chosen.push(upgrade.name + " 레벨 " + runState.upgrades.levels[upgradeId]);
    runState.upgrades.pending = [];
    runState.runStats.upgradesSelected = (runState.runStats.upgradesSelected || 0) + 1;
    applyUpgradeEffect(runState, upgrade);
    checkEvolutions(runState);
    startNextStage(runState);
    return true;
  }

  function update(dt, state) {
    var runState = getState(state);
    var delta = isFiniteNumber(dt) ? clamp(dt, 0, Data.GAME.maxDeltaTime) : 0;

    runState.time.delta = delta;
    runState.time.elapsed += delta;
    runState.time.frame++;
    if (runState.tutorial && runState.tutorial.active) {
      if (runState.mode === Data.MODES.PLAYING && runState.tutorial.step < 1) {
        runState.tutorial.step = 1;
      }
      if ((runState.runStats.bricksDestroyed || 0) > 0 && runState.tutorial.step < 2) {
        runState.tutorial.step = 2;
      }
      if ((runState.runStats.itemsCollected || 0) > 0 && runState.tutorial.step < 3) {
        runState.tutorial.step = 3;
      }
      if (runState.mode === Data.MODES.UPGRADE && runState.tutorial.step < 4) {
        runState.tutorial.step = 4;
        State.completeTutorial(false);
      }
    }
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
      updateGimmicks(runState, delta);
      updateDriftingBricks(runState);
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
    restoreActiveRun: restoreActiveRun,
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
