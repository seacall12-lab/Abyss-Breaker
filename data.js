"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }

    Object.keys(value).forEach(function (key) {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  var Data = {
    VERSION: "0.1.0",
    SAVE_SCHEMA_VERSION: 1,
    SAVE_KEY: "abyssBreaker.save.v1",

    MODES: {
      BOOT: "boot",
      READY: "ready",
      AIMING: "aiming",
      LAUNCHING: "launching",
      PLAYING: "playing",
      RESOLVING: "resolving",
      WAVE_CLEAR: "waveClear",
      UPGRADE: "upgrade",
      PAUSED: "paused",
      GAMEOVER: "gameover"
    },

    GAME: {
      maxDeltaTime: 0.05,
      fixedStep: 1 / 60,
      startingWave: 1,
      startingGold: 0,
      startingScore: 0
    },

    CANVAS: {
      designWidth: 360,
      designHeight: 600,
      maxDevicePixelRatio: 2
    },

    LAYOUT: {
      columns: 7,
      spawnRows: 2,
      maxRows: 10,
      topPaddingRatio: 0.08,
      brickGapRatio: 0.012,
      brickHeightRatio: 0.065,
      dangerLineRatio: 0.84,
      launchLineRatio: 0.92,
      launchXRatio: 0.5,
      minLaunchAngleDegrees: 12
    },

    PLAYER_BASE: {
      maxHp: 100,
      hp: 100,
      ballCount: 1,
      ballDamage: 10,
      critChance: 0.05,
      critDamage: 1.5,
      healAmount: 0,
      bossDamage: 1
    },

    BALL_BASE: {
      radius: 6,
      speed: 560,
      launchInterval: 0.08,
      pierce: 0,
      collisionCooldown: 0.08,
      maxSubSteps: 8
    },

    BRICK_TYPES: {
      normal: {
        id: "normal",
        hpMultiplier: 1,
        attackMultiplier: 1,
        rewardMultiplier: 1,
        scoreMultiplier: 1,
        color: "#f06b4f"
      }
    },

    WAVE_BALANCE: {
      baseBrickHp: 10,
      brickHpPerWave: 4,
      brickHpGrowth: 1.08,
      baseBrickAttack: 5,
      brickAttackPerWave: 1,
      baseBrickReward: 1,
      rewardEveryWaves: 4,
      baseBrickCount: 3,
      brickCountEveryWaves: 2,
      maxBrickCount: 7,
      minEmptyColumns: 1,
      normalWaveType: "normal",
      eliteWaveInterval: 0,
      bossWaveInterval: 0,
      upgradeInterval: 0
    },

    SCORE: {
      brickDestroyed: 10,
      waveCleared: 100,
      goldToScore: 5
    },

    EFFECT_LIMITS: {
      particles: 80,
      damageTexts: 30,
      screenShakeSeconds: 0.28
    },

    STORAGE_DEFAULTS: {
      schemaVersion: 1,
      bestWave: 0,
      bestScore: 0,
      metaCurrency: 0,
      upgrades: {},
      settings: {
        sound: true,
        vibration: true
      }
    }
  };

  AbyssBreaker.Data = deepFreeze(Data);
})(typeof window !== "undefined" ? window : globalThis);
