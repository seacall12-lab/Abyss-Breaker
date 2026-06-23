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
    VERSION: "3.0.0",
    SAVE_SCHEMA_VERSION: 6,
    SAVE_KEY: "abyssBreaker.save.v6",

    MODES: {
      BOOT: "boot",
      READY: "ready",
      PLAYING: "playing",
      LIFE_LOST: "lifeLost",
      STAGE_CLEAR: "stageClear",
      UPGRADE: "upgrade",
      RELIC: "relic",
      PAUSED: "paused",
      GAMEOVER: "gameover",
      RUN_CLEAR: "runClear",
      LOBBY: "lobby",
      META: "meta",
      CLASS_SELECT: "classSelect",
      GAME_MODE: "gameMode",
      ACHIEVEMENTS: "achievements",
      RECORDS: "records",
      SETTINGS: "settings",
      COMPENDIUM: "compendium",
      COSMETICS: "cosmetics"
    },

    CANVAS: {
      designWidth: 360,
      designHeight: 640,
      maxDevicePixelRatio: 3,
      maxPixelCount: 4500000
    },

    GAME: {
      maxDeltaTime: 0.05,
      startingStage: 1,
      finalStage: 20,
      startingLives: 3,
      maxLives: 3,
      maxBalls: 8,
      endlessRelicLimit: 3
    },

    GIMMICK_LIMITS: {
      bumpers: 4,
      portals: 2,
      movingMirrors: 3,
      spinners: 2,
      lasers: 12,
      bottomBarriers: 1,
      explosionChainPerFrame: 12
    },

    PADDLE: {
      width: 90,
      height: 14,
      yOffset: 38,
      minBottomOffset: 54,
      maxBottomOffset: 72,
      bottomOffsetRatio: 0.09,
      speed: 1800,
      expandMultiplier: 1.5,
      maxWidthRatio: 0.62,
      expandDuration: 10
    },

    BALL: {
      radius: 5,
      strokeWidth: 1.5,
      speed: 310,
      minSpeed: 220,
      maxSpeed: 440,
      minVerticalRatio: 0.28,
      launchAngleDegrees: -78,
      launchSpreadDegrees: 16
    },

    BRICKS: {
      columns: 7,
      gap: 6,
      top: 34,
      bossStageTop: 138,
      height: 26,
      sidePadding: 10
    },

    BRICK_TYPES: {
      normal: {
        id: "normal",
        hp: 1,
        score: 100,
        dropChance: 0.12,
        destructible: true,
        explosive: false,
        guaranteedDrop: false,
        fill: "#31c487",
        stroke: "#b7f6d9",
        label: ""
      },
      strong: {
        id: "strong",
        hp: 2,
        score: 220,
        dropChance: 0.16,
        destructible: true,
        explosive: false,
        guaranteedDrop: false,
        fill: "#7b7ff0",
        stroke: "#d5d7ff",
        label: ""
      },
      wall: {
        id: "wall",
        hp: 999,
        score: 0,
        dropChance: 0,
        destructible: false,
        explosive: false,
        guaranteedDrop: false,
        fill: "#56616a",
        stroke: "#b9c4ca",
        label: "벽"
      },
      explosive: {
        id: "explosive",
        hp: 1,
        score: 180,
        dropChance: 0.1,
        destructible: true,
        explosive: true,
        explosiveRadius: 1,
        guaranteedDrop: false,
        fill: "#e65f4b",
        stroke: "#ffd5cb",
        label: "폭"
      },
      item: {
        id: "item",
        hp: 1,
        score: 140,
        dropChance: 1,
        destructible: true,
        explosive: false,
        guaranteedDrop: true,
        fill: "#f2c94c",
        stroke: "#fff1b8",
        label: "상"
      },
      shielded: {
        id: "shielded",
        hp: 2,
        score: 260,
        dropChance: 0.12,
        destructible: true,
        explosive: false,
        guaranteedDrop: false,
        fill: "#4f6f9f",
        stroke: "#d8e7ff",
        label: "보",
        shieldCycle: 4.8,
        shieldDuration: 2.2
      }
    },

    BRICK_SYMBOLS: {
      "1": "normal",
      "2": "strong",
      "3": "wall",
      "4": "explosive",
      "5": "item",
      "6": "shielded"
    },

    ZONES: {
      gate: {
        id: "gate",
        name: "침잠한 관문",
        description: "기본 반사와 벽돌 파괴에 적응하는 구역",
        backgroundVariant: 0,
        gimmickPool: ["bumper"],
        itemWeightModifiers: {},
        bossId: null
      },
      corridor: {
        id: "corridor",
        name: "뒤틀린 회랑",
        description: "포털과 반사 거울로 진입 각도가 변하는 구역",
        backgroundVariant: 3,
        gimmickPool: ["portal", "movingMirror"],
        itemWeightModifiers: { magnetic_paddle: 1.1 },
        bossId: "sentinel"
      },
      rift: {
        id: "rift",
        name: "심연의 균열로",
        description: "폭발과 회전 반사로 빠른 전개가 생기는 구역",
        backgroundVariant: 6,
        gimmickPool: ["spinner", "movingMirror"],
        itemWeightModifiers: { laser_paddle: 1.1 },
        bossId: null
      },
      core: {
        id: "core",
        name: "공허의 심장",
        description: "보호막 벽돌과 복합 기믹이 등장하는 최종 구역",
        backgroundVariant: 9,
        gimmickPool: ["bumper", "portal", "spinner"],
        itemWeightModifiers: { bottom_barrier: 1.15 },
        bossId: "core"
      }
    },

    STAGES: [
      { id: 1, name: "균열 입구", type: "normal", pattern: ["0111110", "1122211", "0111110", "0011100"], brickHpMultiplier: 1, ballSpeedMultiplier: 1, itemDropMultiplier: 1, bossId: null, backgroundVariant: 0 },
      { id: 2, name: "피라미드", type: "normal", pattern: ["0001000", "0011100", "0111110", "1122211", "1111111"], brickHpMultiplier: 1, ballSpeedMultiplier: 1.01, itemDropMultiplier: 1, bossId: null, backgroundVariant: 1 },
      { id: 3, name: "중앙 회랑", type: "normal", pattern: ["2222222", "1000001", "1122211", "1000001", "1111111"], brickHpMultiplier: 1.1, ballSpeedMultiplier: 1.02, itemDropMultiplier: 1.05, bossId: null, backgroundVariant: 2 },
      { id: 4, name: "좌우 분리", type: "normal", pattern: ["1100011", "2200022", "1110111", "0201020", "1111111"], brickHpMultiplier: 1.15, ballSpeedMultiplier: 1.03, itemDropMultiplier: 1.05, bossId: null, backgroundVariant: 3 },
      { id: 5, name: "심연 감시자", type: "boss", pattern: ["0011100", "0100010", "1111111"], brickHpMultiplier: 1.18, ballSpeedMultiplier: 1.03, itemDropMultiplier: 1.1, bossId: "sentinel", backgroundVariant: 4 },
      { id: 6, name: "대가의 석벽", type: "normal", pattern: ["3000003", "1300031", "1130311", "1113111", "2222222"], brickHpMultiplier: 1.2, ballSpeedMultiplier: 1.04, itemDropMultiplier: 1.08, bossId: null, backgroundVariant: 5 },
      { id: 7, name: "폭발 격자", type: "normal", pattern: ["1414141", "2222222", "0101010", "1141411", "2222222"], brickHpMultiplier: 1.28, ballSpeedMultiplier: 1.05, itemDropMultiplier: 1.1, bossId: null, backgroundVariant: 6 },
      { id: 8, name: "보급 균열", type: "normal", pattern: ["1515151", "2222222", "3000003", "1144411", "0222220"], brickHpMultiplier: 1.32, ballSpeedMultiplier: 1.06, itemDropMultiplier: 1.16, bossId: null, backgroundVariant: 7 },
      { id: 9, name: "최종 관문", type: "normal", pattern: ["3222223", "2415142", "1222221", "3040403", "2222222"], brickHpMultiplier: 1.38, ballSpeedMultiplier: 1.07, itemDropMultiplier: 1.12, bossId: null, backgroundVariant: 8 },
      { id: 10, name: "공허의 문지기", type: "boss", pattern: ["0101010", "0262620", "0222220"], brickHpMultiplier: 1.32, ballSpeedMultiplier: 1.06, itemDropMultiplier: 1.14, bossId: "gatekeeper", backgroundVariant: 9 },
      { id: 11, name: "반전 회랑", type: "normal", zoneId: "corridor", pattern: ["1202021", "0060600", "2211122", "0404040", "1111111"], brickHpMultiplier: 1.35, ballSpeedMultiplier: 1.06, itemDropMultiplier: 1.12, bossId: null, gimmicks: [{ type: "portal", pairId: "c", entry: { xRatio: 0.2, yRatio: 0.5 }, exit: { xRatio: 0.8, yRatio: 0.34 } }, { type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.58, widthRatio: 0.22, height: 8, minRatio: 0.22, maxRatio: 0.78, moveSpeed: 50 }], backgroundVariant: 10 },
      { id: 12, name: "연쇄 균열", type: "normal", zoneId: "rift", pattern: ["1414141", "2121212", "0406040", "2222222", "1115111"], brickHpMultiplier: 1.4, ballSpeedMultiplier: 1.07, itemDropMultiplier: 1.13, bossId: null, gimmicks: [{ type: "spinner", xRatio: 0.34, yRatio: 0.48, radius: 16, angleSpeed: 1.15 }, { type: "spinner", xRatio: 0.66, yRatio: 0.48, radius: 16, angleSpeed: -1.05 }], backgroundVariant: 11 },
      { id: 13, name: "보호막 정원", type: "normal", zoneId: "core", pattern: ["0612160", "2222222", "1060601", "0444440", "1111111"], brickHpMultiplier: 1.42, ballSpeedMultiplier: 1.07, itemDropMultiplier: 1.15, bossId: null, gimmicks: [{ type: "bumper", xRatio: 0.5, yRatio: 0.46, radius: 15, speedBoost: 1.06 }, { type: "movingMirror", axis: "y", xRatio: 0.5, yRatio: 0.6, widthRatio: 0.24, height: 8, minRatio: 0.44, maxRatio: 0.7, moveSpeed: 36 }], backgroundVariant: 12 },
      { id: 14, name: "공명 관문", type: "normal", zoneId: "corridor", pattern: ["2202022", "1515151", "0222220", "6040406", "1111111"], brickHpMultiplier: 1.45, ballSpeedMultiplier: 1.08, itemDropMultiplier: 1.16, bossId: null, gimmicks: [{ type: "portal", pairId: "d", entry: { xRatio: 0.16, yRatio: 0.52 }, exit: { xRatio: 0.84, yRatio: 0.38 } }, { type: "bumper", xRatio: 0.5, yRatio: 0.56, radius: 14, speedBoost: 1.06 }], backgroundVariant: 13 },
      { id: 15, name: "거울 군주", type: "boss", zoneId: "corridor", pattern: ["0110110", "0262620", "0222220"], brickHpMultiplier: 1.45, ballSpeedMultiplier: 1.08, itemDropMultiplier: 1.17, bossId: "mirror_lord", gimmicks: [{ type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.58, widthRatio: 0.28, height: 8, minRatio: 0.18, maxRatio: 0.82, moveSpeed: 60 }], backgroundVariant: 14 },
      { id: 16, name: "심장 외곽", type: "normal", zoneId: "core", pattern: ["1626261", "2404042", "0225220", "6040406", "1111111"], brickHpMultiplier: 1.48, ballSpeedMultiplier: 1.08, itemDropMultiplier: 1.16, bossId: null, gimmicks: [{ type: "bumper", xRatio: 0.23, yRatio: 0.5, radius: 14, speedBoost: 1.06 }, { type: "bumper", xRatio: 0.77, yRatio: 0.5, radius: 14, speedBoost: 1.06 }], backgroundVariant: 15 },
      { id: 17, name: "공허 편류", type: "normal", zoneId: "rift", pattern: ["2415142", "0602060", "2222222", "1044401", "1111111"], brickHpMultiplier: 1.5, ballSpeedMultiplier: 1.09, itemDropMultiplier: 1.17, bossId: null, gimmicks: [{ type: "spinner", xRatio: 0.5, yRatio: 0.5, radius: 18, angleSpeed: 1.35 }, { type: "portal", pairId: "e", entry: { xRatio: 0.22, yRatio: 0.58 }, exit: { xRatio: 0.78, yRatio: 0.36 } }], backgroundVariant: 16 },
      { id: 18, name: "파열 중추", type: "normal", zoneId: "core", pattern: ["0444440", "2626262", "1155511", "2404042", "1111111"], brickHpMultiplier: 1.52, ballSpeedMultiplier: 1.09, itemDropMultiplier: 1.18, bossId: null, gimmicks: [{ type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.48, widthRatio: 0.24, height: 8, minRatio: 0.2, maxRatio: 0.8, moveSpeed: 56 }, { type: "spinner", xRatio: 0.5, yRatio: 0.62, radius: 16, angleSpeed: -1.2 }], backgroundVariant: 17 },
      { id: 19, name: "최종 심문", type: "normal", zoneId: "core", pattern: ["1626261", "2415142", "0262620", "4040404", "2222222"], brickHpMultiplier: 1.55, ballSpeedMultiplier: 1.1, itemDropMultiplier: 1.18, bossId: null, gimmicks: [{ type: "portal", pairId: "f", entry: { xRatio: 0.18, yRatio: 0.52 }, exit: { xRatio: 0.82, yRatio: 0.38 } }, { type: "bumper", xRatio: 0.5, yRatio: 0.58, radius: 15, speedBoost: 1.06 }], backgroundVariant: 18 },
      { id: 20, name: "심연 핵", type: "boss", zoneId: "core", pattern: ["0101010", "0262620", "0222220"], brickHpMultiplier: 1.58, ballSpeedMultiplier: 1.1, itemDropMultiplier: 1.2, bossId: "core", gimmicks: [{ type: "bumper", xRatio: 0.25, yRatio: 0.54, radius: 15, speedBoost: 1.05 }, { type: "bumper", xRatio: 0.75, yRatio: 0.54, radius: 15, speedBoost: 1.05 }, { type: "portal", pairId: "core20", entry: { xRatio: 0.18, yRatio: 0.5 }, exit: { xRatio: 0.82, yRatio: 0.36 } }], backgroundVariant: 19 }
    ],

    STAGE_EXTRAS: {
      1: { zoneId: "gate", gimmicks: [] },
      2: { zoneId: "gate", gimmicks: [{ type: "bumper", xRatio: 0.5, yRatio: 0.46, radius: 16, speedBoost: 1.05 }] },
      3: { zoneId: "corridor", gimmicks: [{ type: "portal", pairId: "a", entry: { xRatio: 0.18, yRatio: 0.48 }, exit: { xRatio: 0.82, yRatio: 0.32 } }] },
      4: { zoneId: "corridor", gimmicks: [{ type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.48, widthRatio: 0.23, height: 8, minRatio: 0.24, maxRatio: 0.76, moveSpeed: 58 }] },
      5: { zoneId: "corridor", bossId: "sentinel", gimmicks: [{ type: "movingMirror", axis: "x", xRatio: 0.5, yRatio: 0.56, widthRatio: 0.22, height: 8, minRatio: 0.2, maxRatio: 0.8, moveSpeed: 48 }] },
      6: { zoneId: "rift", gimmicks: [{ type: "spinner", xRatio: 0.5, yRatio: 0.5, radius: 18, angleSpeed: 1.4 }] },
      7: { zoneId: "rift", gimmicks: [{ type: "spinner", xRatio: 0.32, yRatio: 0.48, radius: 16, angleSpeed: 1.2 }, { type: "spinner", xRatio: 0.68, yRatio: 0.42, radius: 16, angleSpeed: -1.1 }] },
      8: { zoneId: "rift", gimmicks: [{ type: "movingMirror", axis: "y", xRatio: 0.5, yRatio: 0.52, widthRatio: 0.24, height: 8, minRatio: 0.38, maxRatio: 0.7, moveSpeed: 42 }] },
      9: { zoneId: "core", pattern: ["3222223", "2415142", "1262621", "3040403", "2222222"], gimmicks: [{ type: "bumper", xRatio: 0.25, yRatio: 0.5, radius: 14, speedBoost: 1.05 }, { type: "portal", pairId: "b", entry: { xRatio: 0.78, yRatio: 0.5 }, exit: { xRatio: 0.22, yRatio: 0.34 } }] },
      10: { zoneId: "core", bossId: "gatekeeper", pattern: ["0101010", "0262620", "0222220"], gimmicks: [{ type: "bumper", xRatio: 0.25, yRatio: 0.54, radius: 15, speedBoost: 1.05 }, { type: "bumper", xRatio: 0.75, yRatio: 0.54, radius: 15, speedBoost: 1.05 }] }
    },

    UPGRADES: [
      { id: "paddle_guard", name: "방벽 보호막", description: "기본 패들 폭이 12% 증가합니다.", category: "안정", iconId: "class_guardian", tags: ["방어", "패들"], maxLevel: 4, weight: 90, effect: "paddleWidthMultiplier", value: 0.12 },
      { id: "life_repair", name: "생명 보급", description: "생명 1개를 회복합니다. 최대 생명은 넘지 않습니다.", category: "안정", iconId: "life", tags: ["생명", "회복"], maxLevel: 99, weight: 70, effect: "healLife", value: 1 },
      { id: "max_life", name: "최대 생명 증가", description: "최대 생명과 현재 생명이 1 증가합니다.", category: "안정", iconId: "life", tags: ["생명", "성장"], maxLevel: 2, weight: 58, effect: "maxLifeAdd", value: 1 },
      { id: "slow_time", name: "느린 시간", description: "기본 공 속도가 7% 감소합니다.", category: "안정", iconId: "item_slow_ball", tags: ["감속", "제어"], maxLevel: 3, weight: 72, effect: "ballSpeedMultiplier", value: -0.07 },
      { id: "split_start", name: "분열 시작", description: "스테이지 시작 때 추가 공 1개를 배치합니다.", category: "메타", iconId: "item_multiball", tags: ["공", "분열"], maxLevel: 2, weight: 62, effect: "startBallAdd", value: 1 },
      { id: "multi_capacity", name: "다중 공 확장", description: "최대 공 개수가 2 증가합니다.", category: "메타", iconId: "item_multiball", tags: ["공", "용량"], maxLevel: 3, weight: 66, effect: "maxBallAdd", value: 2 },
      { id: "nature_drop", name: "심연의 유물", description: "아이템 드롭 확률이 20% 증가합니다.", category: "아이템", iconId: "relic", tags: ["아이템", "드롭"], maxLevel: 4, weight: 64, effect: "dropChanceMultiplier", value: 0.2 },
      { id: "duration_boost", name: "지속 강화", description: "시간형 아이템 지속 시간이 25% 증가합니다.", category: "아이템", iconId: "item_paddle_expand", tags: ["아이템", "지속"], maxLevel: 3, weight: 60, effect: "itemDurationMultiplier", value: 0.25 },
      { id: "break_power", name: "파괴력 강화", description: "벽돌에 주는 피해가 1 증가합니다.", category: "공격", iconId: "class_destroyer", tags: ["피해", "벽돌"], maxLevel: 3, weight: 78, effect: "brickDamageAdd", value: 1 },
      { id: "blast_echo", name: "폭발 충격", description: "벽돌 파괴 시 일정 확률로 인접 벽돌에 1 피해를 줍니다.", category: "공격", iconId: "class_destroyer", tags: ["폭발", "연쇄"], maxLevel: 3, weight: 54, effect: "destroyExplosionChance", value: 0.2, perLevel: 0.15 },
      { id: "piercing_orb", name: "관통의 구슬", description: "새 공이 한 번 벽돌을 관통합니다.", category: "공격", iconId: "score", tags: ["관통", "공"], maxLevel: 2, weight: 50, effect: "pierceAdd", value: 1 },
      { id: "score_amp", name: "점수 증폭", description: "획득 점수가 25% 증가합니다.", category: "점수", iconId: "score", tags: ["점수"], maxLevel: 4, weight: 46, effect: "scoreMultiplier", value: 0.25 }
    ],

    BOSSES: {
      sentinel: { id: "sentinel", name: "심연 감시자", category: "초급 보스", iconId: "stage", stage: 5, maxHp: 42, width: 118, height: 34, moveSpeed: 62, enragedMoveSpeed: 92, score: 1200, spawnInterval: 5.4, maxSpawnedBricks: 4, maxDefenseBlocks: 4, defenseBlockLifetime: 9, spawnCountMin: 1, spawnCountMax: 2, phaseThresholds: [0.5], damageReduction: 0.2, shieldCycle: 4.8, shieldDuration: 1.4, forcedWeakTime: 3.2, noDamageLimit: 8, phaseDefenseRelaxAtHpRatio: 0.3 },
      gatekeeper: { id: "gatekeeper", name: "공허의 문지기", category: "중간 보스", iconId: "locked", stage: 10, maxHp: 58, width: 126, height: 38, moveSpeed: 68, enragedMoveSpeed: 96, score: 1900, spawnInterval: 4.8, maxSpawnedBricks: 5, maxDefenseBlocks: 5, defenseBlockLifetime: 8, spawnCountMin: 1, spawnCountMax: 2, phaseThresholds: [0.66, 0.33], damageReduction: 0.28, shieldCycle: 5.4, shieldDuration: 1.5, forcedWeakTime: 3.5, noDamageLimit: 7, phaseDefenseRelaxAtHpRatio: 0.3 },
      mirror_lord: { id: "mirror_lord", name: "거울 군주", category: "상급 보스", iconId: "class_tuner", stage: 15, maxHp: 76, width: 134, height: 40, moveSpeed: 76, enragedMoveSpeed: 112, score: 2700, spawnInterval: 4.5, maxSpawnedBricks: 5, maxDefenseBlocks: 5, defenseBlockLifetime: 7.5, spawnCountMin: 1, spawnCountMax: 2, phaseThresholds: [0.66, 0.33], damageReduction: 0.32, shieldCycle: 5.8, shieldDuration: 1.6, forcedWeakTime: 3.6, noDamageLimit: 7, phaseDefenseRelaxAtHpRatio: 0.3 },
      core: { id: "core", name: "심연 핵", category: "최종 보스", iconId: "currency_abyss_stone", stage: 20, maxHp: 96, width: 140, height: 44, moveSpeed: 78, enragedMoveSpeed: 116, score: 3800, spawnInterval: 4.4, maxSpawnedBricks: 6, maxDefenseBlocks: 6, defenseBlockLifetime: 7, spawnCountMin: 1, spawnCountMax: 2, phaseThresholds: [0.66, 0.33], damageReduction: 0.35, shieldCycle: 6, shieldDuration: 1.6, forcedWeakTime: 4, noDamageLimit: 7, phaseDefenseRelaxAtHpRatio: 0.3 }
    },

    ITEMS: {
      dropChance: 0.15,
      maxActive: 12,
      width: 24,
      height: 24,
      fallSpeed: 128,
      definitions: [
        { id: "paddle_expand", name: "패들 확장", symbol: "확", iconId: "item_paddle_expand", tags: ["패들", "확장"], weight: 32, duration: 10, value: 1.5, color: "#35c98f" },
        { id: "multi_ball", name: "다중 공", symbol: "+", iconId: "item_multiball", tags: ["공", "분열"], weight: 28, value: 2, color: "#f2c94c" },
        { id: "slow_ball", name: "감속", symbol: "느", iconId: "item_slow_ball", tags: ["감속"], weight: 22, duration: 8, value: 0.75, color: "#65c8ff" },
        { id: "magnetic_paddle", name: "자석 막대", symbol: "자", iconId: "item_magnetic_paddle", tags: ["자석", "패들"], weight: 16, duration: 10, value: 1.5, color: "#c7f0ff" },
        { id: "laser_paddle", name: "레이저 막대", symbol: "광", iconId: "item_laser_paddle", tags: ["레이저", "패들"], weight: 14, duration: 7, value: 0.4, color: "#ff8da1" },
        { id: "bottom_barrier", name: "하단 보호막", symbol: "막", iconId: "item_bottom_barrier", tags: ["보호막", "방어"], weight: 12, duration: 12, value: 3, color: "#9ee6a8" }
      ]
    },

    EVOLUTIONS: [
      { id: "split_storm", name: "분열 폭풍", requiredUpgrades: { split_start: 2, multi_capacity: 2 }, requiredRelics: ["twin_core"], effect: "splitStorm" },
      { id: "blast_chain", name: "연쇄 폭심", requiredUpgrades: { blast_echo: 3 }, requiredRelics: ["blast_insignia"], effect: "blastChain" },
      { id: "piercing_nature", name: "심연 관통자", requiredUpgrades: { piercing_orb: 2 }, requiredRelics: ["piercing_crystal"], effect: "piercingNature" },
      { id: "last_focus", name: "최후의 초점", requiredUpgrades: { break_power: 3 }, requiredRelics: ["focused_lens"], effect: "lastFocus" },
      { id: "aegis_guard", name: "불굴의 방벽", requiredUpgrades: { paddle_guard: 3 }, requiredRelics: ["guardian_field"], effect: "aegisGuard" },
      { id: "item_bloom", name: "아이템 개화", requiredUpgrades: { nature_drop: 3, duration_boost: 2 }, requiredRelics: ["collector_mark"], effect: "itemBloom" },
      { id: "alchemy_bloom", name: "연금 폭주", requiredClass: "alchemist", requiredUpgrades: { nature_drop: 3, duration_boost: 3 }, requiredRelics: ["alchemist_star"], effect: "alchemyBloom" },
      { id: "perfect_tuning", name: "완벽한 조율", requiredClass: "tuner", requiredUpgrades: { break_power: 3 }, requiredRelics: ["precision_tuner"], effect: "perfectTuning" },
      { id: "dimensional_refraction", name: "차원 굴절", requiredUpgrades: { piercing_orb: 2 }, requiredRelics: ["portal_resonator"], requiredZone: "corridor", effect: "dimensionalRefraction" },
      { id: "abyss_rebirth", name: "심연 재생", requiredItems: ["bottom_barrier"], requiredEvolutions: ["aegis_guard"], requiredRelics: ["void_safety_net"], effect: "abyssRebirth" }
    ],

    SCORE: {
      stageClear: 500,
      runClear: 3000
    },

    ABYSS_REWARD: {
      stageMultiplier: 2,
      scoreDivisor: 2000,
      bossMultiplier: 5,
      runClearBonus: 20
    },

    GAME_MODES: {
      standard: {
        id: "standard",
        name: "표준 모드",
        description: "20스테이지의 기본 심연을 돌파합니다.",
        unlockedByDefault: true,
        scoreMultiplier: 1,
        stoneMultiplier: 1,
        rules: { finalStage: 20, endless: false, relicLimit: 3 }
      },
      endless: {
        id: "endless",
        name: "무한 모드",
        description: "20스테이지 이후에도 보스와 난이도 스케일링이 계속됩니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 1,
        stoneMultiplier: 1.1,
        rules: { endless: true, bossEvery: 5, relicLimit: 3, scalingEvery: 5 }
      },
      one_life: {
        id: "one_life",
        name: "단일 생명 도전",
        description: "한 번의 실수도 허용하지 않습니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 2,
        stoneMultiplier: 1.3,
        rules: { finalStage: 20, relicLimit: 3, startingLives: 1, maxLives: 1, ignoreExtraLife: true, disabledUpgrades: ["life_repair", "max_life"] }
      },
      no_items: {
        id: "no_items",
        name: "아이템 봉인 도전",
        description: "떨어지는 아이템 없이 능력과 조작만으로 돌파합니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 1.5,
        stoneMultiplier: 1.2,
        rules: { finalStage: 20, relicLimit: 3, noItems: true, disabledUpgrades: ["nature_drop", "duration_boost"], disabledRelics: ["collector_mark"] }
      },
      high_speed: {
        id: "high_speed",
        name: "고속 심연 도전",
        description: "더 빠른 공을 제어해야 합니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 1.5,
        stoneMultiplier: 1.2,
        rules: { finalStage: 20, relicLimit: 3, ballSpeedMultiplier: 1.16, ballMaxMultiplier: 1.22, disabledUpgrades: ["slow_time"], disabledItems: ["slow_ball"] }
      },
      daily: {
        id: "daily",
        name: "일일 시드",
        description: "매일 바뀌는 고정 시드 도전과 1일 1회 보상을 제공합니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 1.25,
        stoneMultiplier: 1,
        rules: { finalStage: 20, relicLimit: 3, daily: true }
      }
    },

    GAME_MODE_ORDER: ["standard", "endless", "one_life", "no_items", "high_speed", "daily"],

    ACHIEVEMENTS: [
      { id: "first_brick", name: "첫 파괴", description: "벽돌 1개 파괴", reward: 3 },
      { id: "first_gate", name: "첫 관문", description: "스테이지 1 클리어", reward: 5 },
      { id: "sentinel_break", name: "감시자 격파", description: "5스테이지 보스 첫 처치", reward: 10 },
      { id: "standard_clear", name: "심연 돌파", description: "표준 모드 첫 클리어", reward: 25 },
      { id: "standard_clear_3", name: "순환의 반복", description: "표준 모드 3회 클리어", reward: 30 },
      { id: "score_10000", name: "1만 점", description: "한 런에서 10,000점 달성", reward: 5 },
      { id: "score_50000", name: "5만 점", description: "한 런에서 50,000점 달성", reward: 15 },
      { id: "five_balls", name: "군집 제어", description: "동시 활성 공 5개 이상", reward: 8 },
      { id: "collector", name: "수집가", description: "한 런에서 아이템 20개 획득", reward: 10 },
      { id: "flawless_boss", name: "무결한 보스전", description: "생명 손실 없이 보스 처치", reward: 12 },
      { id: "balanced_clear", name: "균형의 길", description: "균형자로 표준 모드 클리어", reward: 10 },
      { id: "guardian_clear", name: "수호의 길", description: "수호자로 표준 모드 클리어", reward: 15 },
      { id: "destroyer_clear", name: "파괴의 길", description: "파괴자로 표준 모드 클리어", reward: 15 },
      { id: "challenge_clear", name: "도전자", description: "도전 모드 하나 클리어", reward: 20 },
      { id: "endless_20", name: "끝없는 추락", description: "무한 모드 20스테이지 도달", reward: 25 }
    ],

    META_UPGRADES: {
      paddleWidth: { id: "paddleWidth", name: "심연의 기초", description: "시작 패들 폭 +3%", maxLevel: 5, costs: [10, 18, 28, 40, 55] },
      itemDrop: { id: "itemDrop", name: "탐색자의 감각", description: "기본 아이템 드롭 +1.5%", maxLevel: 5, costs: [12, 22, 34, 48, 65] },
      bossDamage: { id: "bossDamage", name: "심연 파쇄권", description: "보스 피해 +5%", maxLevel: 5, costs: [15, 28, 42, 60, 80] },
      scoreBonus: { id: "scoreBonus", name: "기록의 문장", description: "점수 +5%", maxLevel: 5, costs: [8, 15, 24, 35, 48] },
      extraLife: { id: "extraLife", name: "생명의 파편", description: "시작 최대 생명 +1", maxLevel: 1, costs: [100] }
    },

    META_UPGRADE_ORDER: ["paddleWidth", "itemDrop", "bossDamage", "scoreBonus", "extraLife"],

    CLASSES: {
      balanced: { id: "balanced", name: "균형자", description: "표준 패들, 생명, 속도, 점수로 시작합니다.", unlockCost: 0, iconId: "class_balanced", category: "기본", paddleWidthMultiplier: 1, maxLifeAdd: 0, ballSpeedMultiplier: 1, brickDamageAdd: 0, scoreMultiplier: 1 },
      guardian: { id: "guardian", name: "수호자", description: "패들 +20%, 최대 생명 +1, 공 속도 -8%, 점수 -10%.", unlockCost: 60, iconId: "class_guardian", category: "방어", paddleWidthMultiplier: 1.2, maxLifeAdd: 1, ballSpeedMultiplier: 0.92, brickDamageAdd: 0, scoreMultiplier: 0.9 },
      destroyer: { id: "destroyer", name: "파괴자", description: "패들 -15%, 공 속도 +8%, 벽돌 피해 +1, 점수 +20%.", unlockCost: 60, iconId: "class_destroyer", category: "공격", paddleWidthMultiplier: 0.85, maxLifeAdd: 0, ballSpeedMultiplier: 1.08, brickDamageAdd: 1, scoreMultiplier: 1.2 },
      alchemist: { id: "alchemist", name: "연금술사", description: "아이템이 더 자주 떨어지고 오래 지속되지만 시작 벽돌 피해가 낮습니다.", unlockCost: 100, iconId: "class_alchemist", category: "아이템", paddleWidthMultiplier: 1, maxLifeAdd: 0, ballSpeedMultiplier: 1, brickDamageAdd: -1, scoreMultiplier: 1, itemDropMultiplier: 1.2, itemDurationMultiplier: 1.25, itemBrickWeightMultiplier: 1.35 },
      tuner: { id: "tuner", name: "조율자", description: "패들이 작지만 중앙 반사로 다음 타격을 강화합니다.", unlockCost: 120, iconId: "class_tuner", category: "정밀", paddleWidthMultiplier: 0.9, maxLifeAdd: 0, ballSpeedMultiplier: 1, brickDamageAdd: 0, scoreMultiplier: 1, precisionZone: 0.3, precisionDamageAdd: 1, precisionScoreMultiplier: 1.4 }
    },

    CLASS_ORDER: ["balanced", "guardian", "destroyer", "alchemist", "tuner"],

    RELICS: [
      { id: "twin_core", name: "쌍심핵", description: "모든 스테이지를 추가 공 1개와 함께 시작합니다." },
      { id: "blast_insignia", name: "폭열 휘장", description: "벽돌 파괴 시 폭발 반향 확률이 25%p 증가합니다." },
      { id: "piercing_crystal", name: "관통 수정", description: "새로 생성되는 모든 공의 관통 횟수가 1 증가합니다." },
      { id: "collector_mark", name: "수집가의 표식", description: "벽돌 10개를 파괴할 때마다 아이템 1개를 확정 생성합니다." },
      { id: "guardian_field", name: "수호 역장", description: "스테이지마다 마지막 공을 한 번 생명 소모 없이 복구합니다." },
      { id: "boss_breaker", name: "보스 브레이커", description: "보스 피해 +50%, 보스 처치 점수 +25%." },
      { id: "acceleration_core", name: "가속 코어", description: "패들 반사마다 해당 공 속도 +2%, 최대 +20%." },
      { id: "focused_lens", name: "집중 렌즈", description: "활성 공이 1개일 때 벽돌 피해 +1, 점수 +30%." },
      { id: "alchemist_star", name: "연금성", description: "시간형 아이템 효과가 더 오래 지속되고 다른 시간형 아이템으로 반향될 수 있습니다.", unlock: "alchemist" },
      { id: "mirror_shard", name: "거울 파편", description: "정밀 패들 반사가 추가 공을 분열시킬 수 있습니다.", unlock: "tuner" },
      { id: "precision_tuner", name: "정밀 조율기", description: "정밀 반사가 더 강한 벽돌 피해와 점수를 준비합니다.", unlock: "tuner" },
      { id: "portal_resonator", name: "포털 공명기", description: "포털이 다음 타격에 추가 피해와 점수를 충전합니다.", unlock: "standard_clear" },
      { id: "bumper_core", name: "범퍼 코어", description: "범퍼 가속이 임시 벽돌 피해를 최대 3회까지 중첩합니다.", unlock: "standard_clear" },
      { id: "giant_grip", name: "거대 손잡이", description: "패들이 더 넓어지고 확장 아이템이 강해지지만 속도가 조금 줄어듭니다.", unlock: "standard_clear" },
      { id: "void_safety_net", name: "공허 안전망", description: "하단 보호막 내구도가 증가하고 놓친 공을 한 번 구할 수 있습니다.", unlock: "bottom_barrier" },
      { id: "laser_amplifier", name: "레이저 증폭기", description: "레이저가 가끔 인접 벽돌에 확산 피해를 줍니다.", unlock: "laser_paddle" }
    ],

    EFFECT_LIMITS: {
      particles: 100,
      floatingTexts: 30,
      screenShakeSeconds: 0.18
    },

    STORAGE_DEFAULTS: {
      schemaVersion: 5,
      activeRun: null,
      bestScore: 0,
      highestStage: 1,
      runClearCount: 0,
      totalRuns: 0,
      abyssStones: 0,
      totalAbyssStonesEarned: 0,
      selectedClassId: "balanced",
      selectedGameModeId: "standard",
      unlockedClasses: { balanced: true, guardian: false, destroyer: false, alchemist: false, tuner: false },
      unlockedModes: { standard: true, endless: false, one_life: false, no_items: false, high_speed: false, daily: false },
      unlocks: {
        classes: { balanced: true, guardian: false, destroyer: false, alchemist: false, tuner: false },
        items: { paddle_expand: true, multi_ball: true, slow_ball: true, magnetic_paddle: true, laser_paddle: true, bottom_barrier: true },
        relics: { twin_core: true, blast_insignia: true, piercing_crystal: true, collector_mark: true, guardian_field: true, boss_breaker: true, acceleration_core: true, focused_lens: true, alchemist_star: false, mirror_shard: false, precision_tuner: false, portal_resonator: false, bumper_core: false, giant_grip: false, void_safety_net: false, laser_amplifier: false },
        evolutions: { split_storm: true, blast_chain: true, piercing_nature: true, last_focus: true, aegis_guard: true, item_bloom: true, alchemy_bloom: false, perfect_tuning: false, dimensional_refraction: false, abyss_rebirth: false },
        modes: { standard: true, endless: false, one_life: false, no_items: false, high_speed: false, daily: false }
      },
      tutorial: { completed: false, skipped: false },
      dailyChallenge: { lastDate: "", records: {}, rewards: {} },
      uiPreferences: { pictograms: true },
      metaUpgrades: { paddleWidth: 0, itemDrop: 0, bossDamage: 0, scoreBonus: 0, extraLife: 0 },
      achievements: {},
      records: {
        totalBricksDestroyed: 0,
        totalItemsCollected: 0,
        totalBossesDefeated: 0,
        maxActiveBalls: 1,
        standard: { bestScore: 0, bestStage: 1, clearCount: 0, fastestClearTime: 0 },
        endless: { bestScore: 0, bestStage: 1, bestBossesDefeated: 0 },
        challenges: {
          one_life: { bestScore: 0, bestStage: 1, cleared: false, clearCount: 0, fastestClearTime: 0 },
          no_items: { bestScore: 0, bestStage: 1, cleared: false, clearCount: 0, fastestClearTime: 0 },
          high_speed: { bestScore: 0, bestStage: 1, cleared: false, clearCount: 0, fastestClearTime: 0 }
        },
        classes: {
          balanced: { bestScore: 0 },
          guardian: { bestScore: 0 },
          destroyer: { bestScore: 0 },
          alchemist: { bestScore: 0 },
          tuner: { bestScore: 0 }
        }
      },
      settings: { sound: true, vibration: true, reducedEffects: false }
    }
  };

  function applyV3Data(Data) {
    function set(target, id, patch) {
      if (target && target[id]) {
        Object.keys(patch).forEach(function (key) {
          target[id][key] = patch[key];
        });
      }
    }

    Data.BRICK_TYPES.wall.label = "벽";
    Data.BRICK_TYPES.explosive.label = "폭";
    Data.BRICK_TYPES.item.label = "상";
    Data.BRICK_TYPES.shielded.label = "보";

    set(Data.ZONES, "gate", {
      name: "침잠한 관문",
      description: "기본 반사와 벽돌 파괴에 적응하는 입문 구역입니다.",
      modifiers: { normalBrickWeight: 1.18 },
      missionPool: ["no_miss_clear", "collect_items", "quick_clear"],
      itemWeightModifiers: { multi_ball: 1.15, paddle_expand: 1.15 }
    });
    set(Data.ZONES, "corridor", {
      name: "뒤틀린 회랑",
      description: "포탈과 이동 거울을 활용하면 추가 보너스를 얻는 구역입니다.",
      modifiers: { portalDamageBonus: 1, mirrorScoreBonus: 150 },
      missionPool: ["bumper_hits", "portal_break", "precision_bounce"],
      itemWeightModifiers: { magnetic_paddle: 1.2 }
    });
    set(Data.ZONES, "rift", {
      name: "심연의 균열로",
      description: "폭발 벽돌과 회전 기믹으로 빠른 연쇄를 노리는 구역입니다.",
      modifiers: { explosionScoreBonus: 180, spinnerWeight: 1.2 },
      missionPool: ["explosion_chain", "laser_break", "collect_items"],
      itemWeightModifiers: { laser_paddle: 1.25 }
    });
    set(Data.ZONES, "core", {
      name: "공허의 심장",
      description: "보호막 벽돌과 보스 약점 공략이 중요해지는 최종 구역입니다.",
      modifiers: { shieldMissionBonus: 1, bossWeakBonus: 1 },
      missionPool: ["boss_weak_hits", "laser_break", "bottom_barrier_save"],
      itemWeightModifiers: { bottom_barrier: 1.25, laser_paddle: 1.12 }
    });

    [
      ["standard", "표준 모드", "20스테이지의 기본 심연을 돌파합니다."],
      ["endless", "무한 모드", "20스테이지 이후에도 보스와 스케일링이 반복됩니다."],
      ["one_life", "단일 생명 도전", "한 번의 실수만 허용되는 고난도 도전입니다."],
      ["no_items", "아이템 봉인 도전", "떨어지는 아이템 없이 능력과 조작만으로 돌파합니다."],
      ["high_speed", "고속 심연 도전", "더 빠른 공을 제어해야 합니다."],
      ["daily", "일일 시드", "매일 바뀌는 고정 시드 도전과 1일 1회 보상을 제공합니다."]
    ].forEach(function (entry) {
      set(Data.GAME_MODES, entry[0], {
        name: entry[1],
        description: entry[2],
        unlockText: entry[0] === "standard" ? "" : "표준 모드 첫 클리어 후 해금"
      });
    });

    Data.GAME_MODES.mirror_abyss = {
      id: "mirror_abyss",
      name: "거울 심연",
      description: "패들 좌우 조작이 반전됩니다. 점수 +20%, 심연석 +10%.",
      unlockedByDefault: false,
      unlockText: "표준 모드 첫 클리어 후 해금",
      scoreMultiplier: 1.2,
      stoneMultiplier: 1.1,
      iconId: "mode_mirror",
      rules: { finalStage: 20, relicLimit: 3, challenge: true, reverseControls: true }
    };
    Data.GAME_MODES.overdrive_abyss = {
      id: "overdrive_abyss",
      name: "과부하 심연",
      description: "아이템 드롭과 공 속도가 증가하지만 아이템 지속 시간이 짧아집니다.",
      unlockedByDefault: false,
      unlockText: "표준 모드 첫 클리어 후 해금",
      scoreMultiplier: 1.15,
      stoneMultiplier: 1.1,
      iconId: "mode_overdrive",
      rules: { finalStage: 20, relicLimit: 3, challenge: true, itemDropMultiplier: 1.4, ballSpeedMultiplier: 1.15, itemDurationMultiplier: 0.85 }
    };
    Data.GAME_MODES.fracture_abyss = {
      id: "fracture_abyss",
      name: "균열 심연",
      description: "일부 벽돌이 좌우로 움직입니다. 심연석 +15%.",
      unlockedByDefault: false,
      unlockText: "표준 모드 첫 클리어 후 해금",
      scoreMultiplier: 1.1,
      stoneMultiplier: 1.15,
      iconId: "mode_fracture",
      rules: { finalStage: 20, relicLimit: 3, challenge: true, driftingBricks: true, driftingBrickLimit: 8 }
    };
    Data.GAME_MODE_ORDER = ["standard", "endless", "one_life", "no_items", "high_speed", "daily", "mirror_abyss", "overdrive_abyss", "fracture_abyss"];

    Data.STAGE_MISSIONS = {
      no_miss_clear: { id: "no_miss_clear", name: "무실수 클리어", description: "공을 놓치지 않고 스테이지를 클리어하세요.", type: "fail_on_life_lost", target: 1, reward: { abyssStones: 2, scoreBonus: 500 }, iconId: "mission_no_miss", tags: ["생존"] },
      collect_items: { id: "collect_items", name: "아이템 수집", description: "아이템 2개를 획득하세요.", type: "count", event: "item_collected", target: 2, reward: { abyssStones: 2, scoreBonus: 350 }, iconId: "item_multiball", tags: ["아이템"] },
      bumper_hits: { id: "bumper_hits", name: "범퍼 충돌", description: "범퍼 또는 회전 기믹에 5회 이상 충돌하세요.", type: "count", event: "bumper_hit", target: 5, reward: { abyssStones: 2, scoreBonus: 400 }, iconId: "mode_high_speed", tags: ["기믹"] },
      portal_break: { id: "portal_break", name: "포탈 돌파", description: "포탈 통과 후 벽돌 3개를 파괴하세요.", type: "count", event: "portal_break", target: 3, reward: { abyssStones: 3, scoreBonus: 450 }, iconId: "zone_corridor", tags: ["포탈"] },
      quick_clear: { id: "quick_clear", name: "90초 돌파", description: "스테이지를 90초 안에 클리어하세요.", type: "time_limit", target: 90, reward: { abyssStones: 2, scoreBonus: 600 }, iconId: "record", tags: ["속도"] },
      laser_break: { id: "laser_break", name: "레이저 파괴", description: "레이저로 벽돌 8개를 파괴하세요.", type: "count", event: "laser_break", target: 8, reward: { abyssStones: 3, scoreBonus: 500 }, iconId: "item_laser_paddle", tags: ["레이저"] },
      precision_bounce: { id: "precision_bounce", name: "정밀 반사", description: "정밀 반사 피해를 3회 성공하세요.", type: "count", event: "precision_hit", target: 3, reward: { abyssStones: 2, scoreBonus: 450 }, iconId: "class_tuner", tags: ["정밀"] },
      boss_weak_hits: { id: "boss_weak_hits", name: "보스 약점 타격", description: "보스 약점에 5회 피해를 주세요.", type: "count", event: "boss_weak_hit", target: 5, reward: { abyssStones: 3, scoreBonus: 700 }, iconId: "weak_point", tags: ["보스"] },
      explosion_chain: { id: "explosion_chain", name: "폭발 연쇄", description: "폭발 연쇄를 2회 이상 발생시키세요.", type: "count", event: "explosion_chain", target: 2, reward: { abyssStones: 2, scoreBonus: 500 }, iconId: "class_destroyer", tags: ["폭발"] },
      bottom_barrier_save: { id: "bottom_barrier_save", name: "하단 보호막 구조", description: "하단 보호막으로 공 1개를 구조하세요.", type: "count", event: "bottom_barrier_save", target: 1, reward: { abyssStones: 3, scoreBonus: 650 }, iconId: "item_bottom_barrier", tags: ["방어"] }
    };
    Data.STAGE_MISSION_BY_STAGE = {
      1: "no_miss_clear", 2: "collect_items", 3: "bumper_hits", 4: "quick_clear", 5: "boss_weak_hits",
      6: "portal_break", 7: "explosion_chain", 8: "collect_items", 9: "laser_break", 10: "boss_weak_hits",
      11: "portal_break", 12: "explosion_chain", 13: "bottom_barrier_save", 14: "precision_bounce", 15: "boss_weak_hits",
      16: "laser_break", 17: "explosion_chain", 18: "bottom_barrier_save", 19: "precision_bounce", 20: "boss_weak_hits"
    };

    Object.keys(Data.STAGE_MISSION_BY_STAGE).forEach(function (stageId) {
      if (Data.STAGES[stageId - 1]) {
        Data.STAGES[stageId - 1].stageMissionId = Data.STAGE_MISSION_BY_STAGE[stageId];
      }
      Data.STAGE_EXTRAS[stageId] = Data.STAGE_EXTRAS[stageId] || {};
      Data.STAGE_EXTRAS[stageId].stageMissionId = Data.STAGE_MISSION_BY_STAGE[stageId];
    });

    set(Data.BOSSES, "sentinel", { name: "심연 감시자", category: "초급 보스", weakHint: "좌우 약점이 번갈아 열립니다.", weakPointRule: "side" });
    set(Data.BOSSES, "gatekeeper", { name: "공허의 문지기", category: "중간 보스", weakHint: "포탈 통과 후 보호막에 추가 피해를 줍니다.", weakPointRule: "portal" });
    set(Data.BOSSES, "mirror_lord", { name: "거울 군주", category: "상급 보스", weakHint: "패들 중앙 정밀 반사가 추가 피해를 줍니다.", weakPointRule: "precision" });
    set(Data.BOSSES, "core", { name: "심연 핵", category: "최종 보스", weakHint: "방어 블록 제거와 강제 약점 시간에 큰 피해를 줍니다.", weakPointRule: "core" });

    Data.COSMETICS = {
      ballSkins: {
        default_ball: { id: "default_ball", name: "기본 공", description: "기본 흰색 공입니다.", iconId: "item_multiball", unlockedByDefault: true },
        abyss_ball: { id: "abyss_ball", name: "심연 공", description: "표준 모드 1회 클리어 보상입니다.", iconId: "currency_abyss_stone", unlockCondition: "표준 모드 클리어" },
        split_orb: { id: "split_orb", name: "분열 구슬", description: "분열 폭풍 진화 1회 발동 보상입니다.", iconId: "item_multiball", unlockCondition: "분열 폭풍 발동" },
        precision_orb: { id: "precision_orb", name: "정밀 구슬", description: "정밀 반사 피해 30회 누적 보상입니다.", iconId: "class_tuner", unlockCondition: "정밀 반사 피해 30회" }
      },
      paddleSkins: {
        default_paddle: { id: "default_paddle", name: "기본 패들", description: "기본 푸른 패들입니다.", iconId: "item_paddle_expand", unlockedByDefault: true },
        abyss_paddle: { id: "abyss_paddle", name: "심연 패들", description: "표준 모드 1회 클리어 보상입니다.", iconId: "currency_abyss_stone", unlockCondition: "표준 모드 클리어" },
        guardian_paddle: { id: "guardian_paddle", name: "수호 방패", description: "수호자로 20스테이지 클리어 보상입니다.", iconId: "class_guardian", unlockCondition: "수호자 표준 클리어" },
        destroyer_paddle: { id: "destroyer_paddle", name: "파괴자 막대", description: "파괴자로 20스테이지 클리어 보상입니다.", iconId: "class_destroyer", unlockCondition: "파괴자 표준 클리어" },
        alchemy_paddle: { id: "alchemy_paddle", name: "연금 막대", description: "연금술사로 20스테이지 클리어 보상입니다.", iconId: "class_alchemist", unlockCondition: "연금술사 표준 클리어" },
        tuner_paddle: { id: "tuner_paddle", name: "조율 막대", description: "조율자로 20스테이지 클리어 보상입니다.", iconId: "class_tuner", unlockCondition: "조율자 표준 클리어" }
      }
    };

    set(Data.CLASSES, "balanced", { name: "균형자", description: "표준 패들, 생명, 속도, 점수로 시작합니다.", category: "기본" });
    set(Data.CLASSES, "guardian", { name: "수호자", description: "패들 +20%, 최대 생명 +1, 공 속도 -8%, 점수 -10%.", category: "방어" });
    set(Data.CLASSES, "destroyer", { name: "파괴자", description: "패들 -15%, 공 속도 +8%, 벽돌 피해 +1, 점수 +20%.", category: "공격" });
    set(Data.CLASSES, "alchemist", { name: "연금술사", description: "아이템이 더 자주 떨어지고 오래 지속되지만 시작 벽돌 피해가 낮습니다.", category: "아이템" });
    set(Data.CLASSES, "tuner", { name: "조율자", description: "패들이 작지만 중앙 반사로 다음 타격을 강화합니다.", category: "정밀" });

    [
      ["paddle_expand", "패들 확장", "▶", ["패들", "확장"]],
      ["multi_ball", "멀티볼", "+", ["공", "분열"]],
      ["slow_ball", "감속", "◷", ["감속"]],
      ["magnetic_paddle", "자석 패들", "U", ["자석", "패들"]],
      ["laser_paddle", "레이저 패들", "↟", ["레이저", "패들"]],
      ["bottom_barrier", "하단 보호막", "━", ["보호막", "방어"]]
    ].forEach(function (entry) {
      var item = Data.ITEMS.definitions.filter(function (definition) { return definition.id === entry[0]; })[0];
      if (item) {
        item.name = entry[1];
        item.symbol = entry[2];
        item.tags = entry[3];
      }
    });

    var evolutionNames = {
      split_storm: "분열 폭풍",
      blast_chain: "연쇄 폭심",
      piercing_nature: "심연 관통자",
      last_focus: "최후의 초점",
      aegis_guard: "불굴의 방벽",
      item_bloom: "아이템 개화",
      alchemy_bloom: "연금 폭주",
      perfect_tuning: "완벽한 조율",
      dimensional_refraction: "차원 굴절",
      abyss_rebirth: "심연 재생"
    };
    Data.EVOLUTIONS.forEach(function (evolution) {
      evolution.name = evolutionNames[evolution.id] || evolution.name;
      evolution.iconId = evolution.iconId || "relic";
      evolution.tags = evolution.tags || ["진화"];
    });

    Data.STORAGE_DEFAULTS.schemaVersion = 6;
    Data.STORAGE_DEFAULTS.unlockedModes.mirror_abyss = false;
    Data.STORAGE_DEFAULTS.unlockedModes.overdrive_abyss = false;
    Data.STORAGE_DEFAULTS.unlockedModes.fracture_abyss = false;
    Data.STORAGE_DEFAULTS.unlocks.modes.mirror_abyss = false;
    Data.STORAGE_DEFAULTS.unlocks.modes.overdrive_abyss = false;
    Data.STORAGE_DEFAULTS.unlocks.modes.fracture_abyss = false;
    Data.STORAGE_DEFAULTS.records.challenges.mirror_abyss = { bestScore: 0, bestStage: 1, cleared: false, clearCount: 0, fastestClearTime: 0 };
    Data.STORAGE_DEFAULTS.records.challenges.overdrive_abyss = { bestScore: 0, bestStage: 1, cleared: false, clearCount: 0, fastestClearTime: 0 };
    Data.STORAGE_DEFAULTS.records.challenges.fracture_abyss = { bestScore: 0, bestStage: 1, cleared: false, clearCount: 0, fastestClearTime: 0 };
    Data.STORAGE_DEFAULTS.missions = { completedMissionIds: {}, totalCompleted: 0, bestMissionCountInRun: 0 };
    Data.STORAGE_DEFAULTS.discovered = { upgrades: {}, relics: {}, evolutions: {}, items: {}, bosses: {}, zones: {} };
    Data.STORAGE_DEFAULTS.cosmetics = {
      unlockedBallSkins: { default_ball: true, abyss_ball: false, split_orb: false, precision_orb: false },
      unlockedPaddleSkins: { default_paddle: true, abyss_paddle: false, guardian_paddle: false, destroyer_paddle: false, alchemy_paddle: false, tuner_paddle: false },
      selectedBallSkinId: "default_ball",
      selectedPaddleSkinId: "default_paddle"
    };
    Data.STORAGE_DEFAULTS.settings.soundEnabled = Data.STORAGE_DEFAULTS.settings.sound;
    Data.STORAGE_DEFAULTS.settings.vibrationEnabled = Data.STORAGE_DEFAULTS.settings.vibration;
  }

  applyV3Data(Data);
  AbyssBreaker.Data = deepFreeze(Data);
})(typeof window !== "undefined" ? window : globalThis);
