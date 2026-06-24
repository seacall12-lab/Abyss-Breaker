"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;
  var State = AbyssBreaker.State;
  var Game = AbyssBreaker.Game;

  if (!Data || !State || !Game) {
    throw new Error("AbyssBreaker.Data, State, and Game must be loaded before render.js");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function getState(state) {
    return state || State.getRunState();
  }

  function getCanvas(target) {
    return target && target.canvas ? target.canvas : target;
  }

  function getContext(target) {
    if (!target) {
      return null;
    }

    return typeof target.getContext === "function" ? target.getContext("2d") : target;
  }

  function resizeCanvas(canvas, state) {
    var runState = getState(state);
    var rect = canvas.getBoundingClientRect();
    var cssWidth = rect.width || canvas.clientWidth || Data.CANVAS.designWidth;
    var cssHeight = rect.height || canvas.clientHeight || Data.CANVAS.designHeight;
    var dpr = clamp(global.devicePixelRatio || 1, 1, Data.CANVAS.maxDevicePixelRatio);
    if (Data.CANVAS.maxPixelCount) {
      dpr = Math.min(dpr, Math.sqrt(Data.CANVAS.maxPixelCount / Math.max(1, cssWidth * cssHeight)));
    }
    var pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    var pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }

    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }

    return Game.setWorldSize(cssWidth, cssHeight, dpr, runState);
  }

  function clear(ctx, state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.viewport.pixelWidth, state.viewport.pixelHeight);
    ctx.setTransform(state.viewport.devicePixelRatio, 0, 0, state.viewport.devicePixelRatio, 0, 0);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);

    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, width, height, r);
      return;
    }

    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawBackground(ctx, state) {
    var width = state.viewport.cssWidth;
    var height = state.viewport.cssHeight;
    var stage = Game.getStageData ? Game.getStageData(state) : null;
    var variant = stage ? stage.backgroundVariant : 0;
    var zoneId = state.zoneId || (stage && stage.zoneId);
    var highContrast = state.persistent && state.persistent.accessibility && state.persistent.accessibility.highContrast;
    var gradient = ctx.createLinearGradient(0, 0, 0, height);

    gradient.addColorStop(0, highContrast ? "#000000" : zoneId === "core" ? "#1b1026" : zoneId === "rift" ? "#241417" : zoneId === "corridor" ? "#101b2b" : (variant % 3 === 0 ? "#071e25" : "#101b2b"));
    gradient.addColorStop(0.42, highContrast ? "#061014" : "#0b1218");
    gradient.addColorStop(1, "#07090d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.055)";
    ctx.lineWidth = 1;

    for (var y = 40; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(61, 196, 151, 0.17)";
    ctx.beginPath();
    ctx.moveTo(10, state.paddle.y - 18);
    ctx.lineTo(width - 10, state.paddle.y - 18);
    ctx.stroke();
  }

  function drawBrick(ctx, brick) {
    var type = Data.BRICK_TYPES[brick.type] || Data.BRICK_TYPES.normal;
    var hpRatio = brick.destructible ? clamp(brick.hp / Math.max(1, brick.maxHp), 0, 1) : 1;

    ctx.save();
    ctx.globalAlpha = brick.alive ? 1 : 0.25;
    ctx.beginPath();
    roundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 5);
    ctx.fillStyle = type.fill;
    ctx.fill();
    ctx.strokeStyle = type.stroke;
    ctx.lineWidth = brick.shieldActive ? 3 : 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
    ctx.fillRect(brick.x, brick.y + brick.height - 5, brick.width, 5);
    ctx.fillStyle = hpRatio > 0.5 ? "#e9fff5" : "#ffe27a";
    ctx.fillRect(brick.x, brick.y + brick.height - 5, brick.width * hpRatio, 5);

    ctx.fillStyle = brick.type === "wall" ? "#f3f7ff" : "#071016";
    ctx.font = "900 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brick.shieldActive ? "◎" : (type.label || String(Math.max(0, brick.hp))), brick.x + brick.width / 2, brick.y + brick.height / 2 - 1);
    ctx.restore();
  }

  function drawBricks(ctx, state) {
    state.bricks.forEach(function (brick) {
      if (brick.alive) {
        drawBrick(ctx, brick);
      }
    });
  }

  function drawPaddle(ctx, state) {
    var paddle = state.paddle;
    var gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
    var skinId = state.selectedPaddleSkinId || (state.persistent && state.persistent.cosmetics && state.persistent.cosmetics.selectedPaddleSkinId) || "default_paddle";

    if (skinId === "guardian_paddle") {
      gradient.addColorStop(0, "#f7fbff");
      gradient.addColorStop(1, "#9ee6a8");
    } else if (skinId === "destroyer_paddle") {
      gradient.addColorStop(0, "#ffd5cb");
      gradient.addColorStop(1, "#e65f4b");
    } else if (skinId === "alchemy_paddle") {
      gradient.addColorStop(0, "#fff1b8");
      gradient.addColorStop(1, "#31c487");
    } else if (skinId === "tuner_paddle") {
      gradient.addColorStop(0, "#f7fbff");
      gradient.addColorStop(1, "#b06cff");
    } else if (skinId === "tower_paddle") {
      gradient.addColorStop(0, "#f3f7ff");
      gradient.addColorStop(1, "#7b7ff0");
    } else if (skinId === "sentinel_paddle" || skinId === "gatekeeper_paddle") {
      gradient.addColorStop(0, "#fff1b8");
      gradient.addColorStop(1, "#f2c94c");
    } else if (skinId === "mirror_paddle") {
      gradient.addColorStop(0, "#f7fbff");
      gradient.addColorStop(1, "#65c8ff");
    } else if (skinId === "core_paddle") {
      gradient.addColorStop(0, "#ffd5cb");
      gradient.addColorStop(1, "#b06cff");
    } else if (skinId === "abyss_paddle") {
      gradient.addColorStop(0, "#d8e7ff");
      gradient.addColorStop(1, "#f2c94c");
    } else {
      gradient.addColorStop(0, "#f7fbff");
      gradient.addColorStop(1, "#65c8ff");
    }

    ctx.save();
    ctx.shadowColor = "rgba(101, 200, 255, 0.42)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    roundedRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 7);
    ctx.fillStyle = gradient;
    ctx.fill();
    if (state.persistent && state.persistent.emblems && state.persistent.emblems.selectedEmblemId !== "default_emblem") {
      ctx.fillStyle = "rgba(7, 16, 22, 0.55)";
      ctx.beginPath();
      ctx.arc(paddle.x + paddle.width / 2, paddle.y + paddle.height / 2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f2c94c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGimmicks(ctx, state) {
    (state.gimmicks || []).forEach(function (gimmick) {
      if (!gimmick.active) {
        return;
      }

      ctx.save();
      if (gimmick.type === "bumper") {
        ctx.strokeStyle = "#65c8ff";
        ctx.fillStyle = "rgba(101, 200, 255, 0.18)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gimmick.x, gimmick.y, gimmick.radius || 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (gimmick.type === "portal") {
        ctx.strokeStyle = "#b06cff";
        ctx.lineWidth = 3;
        [0, 1].forEach(function (index) {
          var x = index ? gimmick.exitX : gimmick.entryX;
          var y = index ? gimmick.exitY : gimmick.entryY;
          ctx.beginPath();
          ctx.arc(x, y, gimmick.radius || 15, 0, Math.PI * 2);
          ctx.stroke();
        });
      } else if (gimmick.type === "movingMirror") {
        ctx.fillStyle = "rgba(216, 231, 255, 0.72)";
        roundedRect(ctx, gimmick.x - gimmick.width / 2, gimmick.y - gimmick.height / 2, gimmick.width, gimmick.height, 4);
        ctx.fill();
      } else if (gimmick.type === "spinner") {
        ctx.translate(gimmick.x, gimmick.y);
        ctx.rotate(gimmick.angle || 0);
        ctx.strokeStyle = "#f2c94c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-(gimmick.radius || 16), 0);
        ctx.lineTo(gimmick.radius || 16, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#f2c94c";
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawBottomBarrier(ctx, state) {
    if (!state.activeEffects || state.activeEffects.bottomBarrierDurability <= 0) {
      return;
    }

    var y = state.viewport.cssHeight - 8;
    ctx.save();
    ctx.strokeStyle = "#9ee6a8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(state.viewport.cssWidth - 14, y);
    ctx.stroke();
    ctx.fillStyle = "#9ee6a8";
    ctx.font = "900 11px system-ui, sans-serif";
    ctx.fillText(String(state.activeEffects.bottomBarrierDurability), state.viewport.cssWidth - 24, y - 8);
    ctx.restore();
  }

  function drawBall(ctx, ball) {
    if (!ball.active) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    var state = State.getRunState();
    var skinId = state.selectedBallSkinId || (state.persistent && state.persistent.cosmetics && state.persistent.cosmetics.selectedBallSkinId) || "default_ball";
    ctx.fillStyle = skinId === "tower_orb" ? "#7b7ff0" : skinId === "boss_fragment" ? "#e65f4b" : skinId === "core_orb" ? "#b06cff" : skinId === "fracture_orb" ? "#31c487" : skinId === "split_orb" ? "#f2c94c" : skinId === "precision_orb" ? "#b06cff" : skinId === "abyss_ball" ? "#9ee6a8" : (ball.attached ? "#dcefff" : "#ffffff");
    ctx.fill();
    ctx.strokeStyle = skinId === "default_ball" ? "#65c8ff" : "#ffffff";
    ctx.lineWidth = Data.BALL.strokeWidth || 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawBalls(ctx, state) {
    state.balls.forEach(function (ball) {
      drawBall(ctx, ball);
    });
  }

  function drawBoss(ctx, state) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      return;
    }

    var hpRatio = clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1);
    var gradient = ctx.createLinearGradient(boss.x, boss.y, boss.x + boss.width, boss.y + boss.height);

    gradient.addColorStop(0, boss.shieldActive ? "#65c8ff" : "#e65f4b");
    gradient.addColorStop(1, boss.shieldActive ? "#d7f2ff" : "#f2c94c");

    ctx.save();
    ctx.beginPath();
    roundedRect(ctx, boss.x, boss.y, boss.width, boss.height, 8);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = boss.shieldActive ? "#d7f2ff" : "#ffe2a1";
    ctx.lineWidth = boss.shieldActive ? 3 : 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(boss.x + 8, boss.y + boss.height - 8, boss.width - 16, 4);
    ctx.fillStyle = "#f3f7ff";
    ctx.fillRect(boss.x + 8, boss.y + boss.height - 8, (boss.width - 16) * hpRatio, 4);

    ctx.fillStyle = "#071016";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(boss.shieldActive ? "방어" : boss.name, boss.x + boss.width / 2, boss.y + boss.height / 2 - 2);
    ctx.fillStyle = (boss.weakTimer || boss.forcedWeakTimer) > 0 ? "#ffffff" : "#f2c94c";
    ctx.beginPath();
    ctx.arc(boss.weakPointSide === "right" ? boss.x + boss.width - 16 : boss.x + 16, boss.y + 9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawItemPictogram(ctx, item) {
    var cx = item.x + item.width / 2;
    var cy = item.y + item.height / 2;
    var type = item.type || "";

    ctx.save();
    ctx.strokeStyle = "#061014";
    ctx.fillStyle = "#061014";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (type === "multi_ball") {
      [[cx - 5, cy - 3], [cx + 5, cy - 3], [cx, cy + 5]].forEach(function (point) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
        ctx.stroke();
      });
    } else if (type === "paddle_expand") {
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx + 8, cy + 4);
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx - 4, cy);
      ctx.moveTo(cx - 8, cy + 4);
      ctx.lineTo(cx - 4, cy + 8);
      ctx.moveTo(cx + 8, cy + 4);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx + 8, cy + 4);
      ctx.lineTo(cx + 4, cy + 8);
      ctx.stroke();
    } else if (type === "magnetic_paddle") {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI);
      ctx.moveTo(cx - 6, cy);
      ctx.lineTo(cx - 6, cy - 5);
      ctx.moveTo(cx + 6, cy);
      ctx.lineTo(cx + 6, cy - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "laser_paddle") {
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 7);
      ctx.lineTo(cx + 8, cy + 7);
      ctx.moveTo(cx, cy + 5);
      ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx - 2, cy - 8);
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + 2, cy - 8);
      ctx.stroke();
    } else if (type === "bottom_barrier") {
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 7);
      ctx.lineTo(cx + 8, cy + 7);
      ctx.moveTo(cx - 6, cy + 3);
      ctx.quadraticCurveTo(cx, cy + 1, cx + 6, cy + 3);
      ctx.stroke();
    } else if (type === "slow_ball") {
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 4, cy + 3);
      ctx.stroke();
    } else {
      ctx.font = "900 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.symbol || "?", cx, cy);
    }

    ctx.restore();
  }

  function drawItems(ctx, state) {
    state.items.forEach(function (item) {
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, item.x, item.y, item.width, item.height, 6);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 1;
      ctx.stroke();
      drawItemPictogram(ctx, item);
      ctx.restore();
    });
  }

  function drawParticles(ctx, state) {
    state.particles.forEach(function (particle) {
      var progress = clamp(particle.age / Math.max(0.01, particle.life), 0, 1);

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * (1 - progress * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawFloatingTexts(ctx, state) {
    state.floatingTexts.forEach(function (text) {
      var progress = clamp(text.age / Math.max(0.01, text.life), 0, 1);

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = text.color;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
      ctx.lineWidth = 3;
      ctx.font = "900 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(text.text, text.x, text.y);
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });
  }

  function drawEffects(ctx, state) {
    state.effects.forEach(function (effect) {
      var progress = clamp(effect.age / Math.max(0.01, effect.life), 0, 1);

      ctx.save();
      ctx.globalAlpha = 1 - progress;

      if (effect.type === "line") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(effect.x1, effect.y1);
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
      } else if (effect.type === "laser") {
        ctx.strokeStyle = effect.color || "#ff8da1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(effect.x1, effect.y1);
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
      } else if (effect.type === "ring") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (0.5 + progress), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  function drawReadyCue(ctx, state) {
    if (state.mode !== Data.MODES.READY) {
      return;
    }

    var ball = state.balls[0];

    if (!ball) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y - 8);
    ctx.lineTo(ball.x - 22, ball.y - 94);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function getShake(state) {
    if ((state.persistent && state.persistent.settings && state.persistent.settings.reducedEffects) ||
        (state.persistent && state.persistent.accessibility && (state.persistent.accessibility.reducedEffects || state.persistent.accessibility.screenShake === false))) {
      return { x: 0, y: 0 };
    }

    var shake = state.effects.screenShake;

    if (!shake || shake.time <= 0 || shake.duration <= 0 || shake.magnitude <= 0) {
      return { x: 0, y: 0 };
    }

    var progress = clamp(shake.time / shake.duration, 0, 1);
    var amount = shake.magnitude * progress;
    var seed = state.time.frame * 1.77;

    return {
      x: Math.sin(seed) * amount,
      y: Math.cos(seed * 1.31) * amount
    };
  }

  function render(target, state) {
    var runState = getState(state);
    var ctx = getContext(target);
    var canvas = getCanvas(target);

    if (!ctx) {
      return false;
    }

    if (canvas && (!runState.viewport.pixelWidth || !runState.viewport.pixelHeight)) {
      resizeCanvas(canvas, runState);
    }

    if (!isFiniteNumber(runState.viewport.devicePixelRatio) || runState.viewport.devicePixelRatio <= 0) {
      runState.viewport.devicePixelRatio = 1;
    }

    clear(ctx, runState);
    drawBackground(ctx, runState);

    var shake = getShake(runState);

    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawBoss(ctx, runState);
    drawBricks(ctx, runState);
    drawGimmicks(ctx, runState);
    drawReadyCue(ctx, runState);
    drawItems(ctx, runState);
    drawPaddle(ctx, runState);
    drawBottomBarrier(ctx, runState);
    drawBalls(ctx, runState);
    if (!runState.persistent || !runState.persistent.settings || (!runState.persistent.settings.reducedEffects && !(runState.persistent.accessibility && runState.persistent.accessibility.reducedEffects))) {
      drawEffects(ctx, runState);
      drawParticles(ctx, runState);
    }
    drawFloatingTexts(ctx, runState);
    ctx.restore();

    return true;
  }

  AbyssBreaker.Render = {
    resizeCanvas: resizeCanvas,
    render: render
  };
})(typeof window !== "undefined" ? window : globalThis);
