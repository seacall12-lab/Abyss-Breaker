"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;
  var State = AbyssBreaker.State;
  var Game = AbyssBreaker.Game;

  if (!Data || !State || !Game) {
    throw new Error("AbyssBreaker.Data, State, and Game must be loaded before render.js");
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getState(state) {
    return state || State.getRunState();
  }

  function getCanvasFromTarget(target) {
    if (!target) {
      return null;
    }

    if (target.canvas) {
      return target.canvas;
    }

    return target;
  }

  function getContext(target) {
    if (!target) {
      return null;
    }

    if (typeof target.getContext === "function") {
      return target.getContext("2d");
    }

    return target;
  }

  function resizeCanvas(canvas, state) {
    var runState = getState(state);

    if (!canvas) {
      return runState.viewport;
    }

    var rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
    var cssWidth = rect && rect.width ? rect.width : (canvas.clientWidth || Data.CANVAS.designWidth);
    var cssHeight = rect && rect.height ? rect.height : (canvas.clientHeight || Data.CANVAS.designHeight);
    var devicePixelRatio = clamp(global.devicePixelRatio || 1, 1, Data.CANVAS.maxDevicePixelRatio);
    var pixelWidth = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    var pixelHeight = Math.max(1, Math.round(cssHeight * devicePixelRatio));

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }

    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }

    Game.setWorldSize(cssWidth, cssHeight, devicePixelRatio, runState);

    return runState.viewport;
  }

  function clear(ctx, state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.viewport.pixelWidth, state.viewport.pixelHeight);
    ctx.setTransform(state.viewport.devicePixelRatio, 0, 0, state.viewport.devicePixelRatio, 0, 0);
  }

  function drawBackground(ctx, state) {
    var width = state.viewport.cssWidth;
    var height = state.viewport.cssHeight;
    var gradient = ctx.createLinearGradient(0, 0, 0, height);

    gradient.addColorStop(0, "#10232d");
    gradient.addColorStop(0.58, "#071016");
    gradient.addColorStop(1, "#030608");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(109, 230, 220, 0.07)";
    ctx.lineWidth = 1;

    for (var x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (var y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawDangerLine(ctx, state) {
    var layout = Game.getLayout(state);
    var width = state.viewport.cssWidth;

    ctx.save();
    ctx.strokeStyle = "rgba(255, 107, 107, 0.78)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(10, layout.dangerY);
    ctx.lineTo(width - 10, layout.dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 107, 107, 0.8)";
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("DANGER", width - 14, layout.dangerY - 6);
    ctx.restore();
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

  function drawBrick(ctx, brick) {
    var typeData = Data.BRICK_TYPES[brick.type] || Data.BRICK_TYPES.normal;
    var hpRatio = clamp(brick.hp / Math.max(1, brick.maxHp), 0, 1);

    ctx.save();
    ctx.beginPath();
    roundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 6);
    ctx.fillStyle = typeData.color;
    ctx.globalAlpha = brick.alive ? 1 : 0.35;
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(brick.x, brick.y + brick.height - 5, brick.width, 5);
    ctx.fillStyle = hpRatio > 0.35 ? "#72e08f" : "#ffdd66";
    ctx.fillRect(brick.x, brick.y + brick.height - 5, brick.width * hpRatio, 5);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#fff8ea";
    ctx.font = "900 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.ceil(brick.hp)), brick.x + brick.width / 2, brick.y + brick.height / 2);
    ctx.restore();
  }

  function drawBricks(ctx, state) {
    state.bricks.forEach(function (brick) {
      if (brick.alive) {
        drawBrick(ctx, brick);
      }
    });
  }

  function drawBall(ctx, ball) {
    if (!ball.active && !ball.returned) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.active ? "#eafcff" : "rgba(234, 252, 255, 0.5)";
    ctx.fill();
    ctx.strokeStyle = "#5ee2d6";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawBalls(ctx, state) {
    state.balls.forEach(function (ball) {
      drawBall(ctx, ball);
    });
  }

  function drawLauncher(ctx, state) {
    var x = state.launch.originX;
    var y = state.launch.originY;

    ctx.save();
    ctx.fillStyle = "rgba(94, 226, 214, 0.2)";
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5ee2d6";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAimLine(ctx, state) {
    if (!state.aim.active || !state.aim.valid) {
      return;
    }

    var x = state.launch.originX;
    var y = state.launch.originY;
    var length = Math.min(state.viewport.cssHeight * 0.45, 260);
    var endX = x + state.aim.directionX * length;
    var endY = y + state.aim.directionY * length;

    ctx.save();
    ctx.strokeStyle = "rgba(94, 226, 214, 0.82)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#5ee2d6";
    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDamageTexts(ctx, state) {
    state.effects.damageTexts.forEach(function (text) {
      var progress = clamp(text.age / Math.max(0.01, text.life), 0, 1);

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = text.critical ? "#ffef70" : "#edf8f9";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 3;
      ctx.font = text.critical ? "900 18px system-ui, sans-serif" : "900 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(String(text.value), text.x, text.y);
      ctx.fillText(String(text.value), text.x, text.y);
      ctx.restore();
    });
  }

  function drawParticles(ctx, state) {
    state.effects.particles.forEach(function (particle) {
      var progress = clamp(particle.age / Math.max(0.01, particle.life), 0, 1);

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function getShakeOffset(state) {
    var shake = state.effects.screenShake;

    if (!shake || shake.time <= 0 || shake.duration <= 0 || shake.magnitude <= 0) {
      return { x: 0, y: 0 };
    }

    var progress = clamp(shake.time / shake.duration, 0, 1);
    var amount = shake.magnitude * progress;
    var seed = state.time.frame * 12.9898;

    return {
      x: Math.sin(seed) * amount,
      y: Math.cos(seed * 1.37) * amount
    };
  }

  function render(target, state) {
    var runState = getState(state);
    var ctx = getContext(target);
    var canvas = getCanvasFromTarget(target);

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

    var shake = getShakeOffset(runState);

    ctx.save();
    ctx.translate(shake.x, shake.y);
    drawDangerLine(ctx, runState);
    drawBricks(ctx, runState);
    drawLauncher(ctx, runState);
    drawAimLine(ctx, runState);
    drawBalls(ctx, runState);
    drawParticles(ctx, runState);
    drawDamageTexts(ctx, runState);
    ctx.restore();

    return true;
  }

  AbyssBreaker.Render = {
    resizeCanvas: resizeCanvas,
    render: render,
    drawBackground: drawBackground,
    drawDangerLine: drawDangerLine,
    drawBricks: drawBricks,
    drawBalls: drawBalls,
    drawLauncher: drawLauncher,
    drawAimLine: drawAimLine,
    drawParticles: drawParticles,
    drawDamageTexts: drawDamageTexts
  };
})(typeof window !== "undefined" ? window : globalThis);
