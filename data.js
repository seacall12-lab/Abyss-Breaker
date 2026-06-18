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
      PLAYING: "playing",
      LIFE_LOST: "lifeLost",
      STAGE_CLEAR: "stageClear",
      PAUSED: "paused",
      GAMEOVER: "gameover"
    },

    CANVAS: {
      designWidth: 360,
      designHeight: 640,
      maxDevicePixelRatio: 2
    },

    GAME: {
      maxDeltaTime: 0.05,
      startingStage: 1,
      startingLives: 3,
      maxBalls: 8
    },

    PADDLE: {
      width: 90,
      height: 14,
      yOffset: 38,
      speed: 1800,
      expandMultiplier: 1.5,
      maxWidthRatio: 0.55,
      expandDuration: 10
    },

    BALL: {
      radius: 6,
      speed: 310,
      minSpeed: 230,
      maxSpeed: 430,
      minVerticalRatio: 0.28,
      launchAngleDegrees: -78,
      launchSpreadDegrees: 18
    },

    BRICKS: {
      columns: 7,
      gap: 6,
      top: 34,
      height: 26,
      sidePadding: 10
    },

    BRICK_TYPES: {
      normal: {
        id: "normal",
        hp: 1,
        score: 100,
        dropChance: 0.13,
        destructible: true,
        fill: "#31c487",
        stroke: "#b7f6d9"
      },
      strong: {
        id: "strong",
        hp: 2,
        score: 220,
        dropChance: 0.18,
        destructible: true,
        fill: "#7b7ff0",
        stroke: "#d5d7ff"
      }
    },

    STAGES: [
      {
        pattern: [
          "0111110",
          "1122211",
          "0111110",
          "0011100"
        ]
      }
    ],

    ITEMS: {
      dropChance: 0.15,
      maxActive: 12,
      width: 24,
      height: 24,
      fallSpeed: 128,
      definitions: [
        {
          id: "paddle_expand",
          name: "패들 확장",
          symbol: "W",
          weight: 40,
          duration: 10,
          value: 1.5,
          color: "#35c98f"
        },
        {
          id: "multi_ball",
          name: "멀티볼",
          symbol: "+",
          weight: 34,
          value: 2,
          color: "#f2c94c"
        },
        {
          id: "slow_ball",
          name: "감속",
          symbol: "S",
          weight: 26,
          duration: 8,
          value: 0.75,
          color: "#65c8ff"
        }
      ]
    },

    SCORE: {
      stageClear: 500
    },

    EFFECT_LIMITS: {
      particles: 100,
      floatingTexts: 30,
      screenShakeSeconds: 0.18
    },

    STORAGE_DEFAULTS: {
      schemaVersion: 1,
      bestScore: 0,
      highestStage: 1,
      settings: {
        vibration: true
      }
    }
  };

  AbyssBreaker.Data = deepFreeze(Data);
})(typeof window !== "undefined" ? window : globalThis);
