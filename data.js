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
    VERSION: "1.0.0",
    SAVE_SCHEMA_VERSION: 3,
    SAVE_KEY: "abyssBreaker.save.v3",

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
      SETTINGS: "settings"
    },

    CANVAS: {
      designWidth: 360,
      designHeight: 640,
      maxDevicePixelRatio: 2
    },

    GAME: {
      maxDeltaTime: 0.05,
      startingStage: 1,
      finalStage: 10,
      startingLives: 3,
      maxLives: 3,
      maxBalls: 8,
      endlessRelicLimit: 3
    },

    PADDLE: {
      width: 90,
      height: 14,
      yOffset: 38,
      speed: 1800,
      expandMultiplier: 1.5,
      maxWidthRatio: 0.62,
      expandDuration: 10
    },

    BALL: {
      radius: 6,
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
        label: "W"
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
        label: "X"
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
        label: "I"
      }
    },

    BRICK_SYMBOLS: {
      "1": "normal",
      "2": "strong",
      "3": "wall",
      "4": "explosive",
      "5": "item"
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
      { id: 10, name: "심연 핵", type: "boss", pattern: ["3000003", "0244420", "2222222"], brickHpMultiplier: 1.45, ballSpeedMultiplier: 1.07, itemDropMultiplier: 1.18, bossId: "core", backgroundVariant: 9 }
    ],

    UPGRADES: [
      { id: "paddle_guard", name: "방벽 보호막", description: "기본 패들 폭이 12% 증가합니다.", category: "안정", maxLevel: 4, weight: 90, effect: "paddleWidthMultiplier", value: 0.12 },
      { id: "life_repair", name: "생명 보급", description: "생명 1개를 회복합니다. 최대 생명은 넘지 않습니다.", category: "안정", maxLevel: 99, weight: 70, effect: "healLife", value: 1 },
      { id: "max_life", name: "최대 생명 증가", description: "최대 생명과 현재 생명이 1 증가합니다.", category: "안정", maxLevel: 2, weight: 58, effect: "maxLifeAdd", value: 1 },
      { id: "slow_time", name: "느린 시간", description: "기본 공 속도가 7% 감소합니다.", category: "안정", maxLevel: 3, weight: 72, effect: "ballSpeedMultiplier", value: -0.07 },
      { id: "split_start", name: "분열 시작", description: "스테이지 시작 때 추가 공 1개를 배치합니다.", category: "메타", maxLevel: 2, weight: 62, effect: "startBallAdd", value: 1 },
      { id: "multi_capacity", name: "다중 공 확장", description: "최대 공 개수가 2 증가합니다.", category: "메타", maxLevel: 3, weight: 66, effect: "maxBallAdd", value: 2 },
      { id: "nature_drop", name: "심연의 유물", description: "아이템 드롭 확률이 20% 증가합니다.", category: "아이템", maxLevel: 4, weight: 64, effect: "dropChanceMultiplier", value: 0.2 },
      { id: "duration_boost", name: "지속 강화", description: "시간형 아이템 지속 시간이 25% 증가합니다.", category: "아이템", maxLevel: 3, weight: 60, effect: "itemDurationMultiplier", value: 0.25 },
      { id: "break_power", name: "파괴력 강화", description: "벽돌에 주는 피해가 1 증가합니다.", category: "공격", maxLevel: 3, weight: 78, effect: "brickDamageAdd", value: 1 },
      { id: "blast_echo", name: "폭발 충격", description: "벽돌 파괴 시 일정 확률로 인접 벽돌에 1 피해를 줍니다.", category: "공격", maxLevel: 3, weight: 54, effect: "destroyExplosionChance", value: 0.2, perLevel: 0.15 },
      { id: "piercing_orb", name: "관통의 구슬", description: "새 공이 한 번 벽돌을 관통합니다.", category: "공격", maxLevel: 2, weight: 50, effect: "pierceAdd", value: 1 },
      { id: "score_amp", name: "점수 증폭", description: "획득 점수가 25% 증가합니다.", category: "점수", maxLevel: 4, weight: 46, effect: "scoreMultiplier", value: 0.25 }
    ],

    BOSSES: {
      sentinel: { id: "sentinel", name: "심연 감시자", stage: 5, maxHp: 38, width: 118, height: 34, moveSpeed: 62, enragedMoveSpeed: 92, score: 1200, spawnInterval: 5.2, maxSpawnedBricks: 5, spawnCountMin: 1, spawnCountMax: 2, phaseThresholds: [0.5], damageReduction: 0 },
      core: { id: "core", name: "심연 핵", stage: 10, maxHp: 64, width: 132, height: 42, moveSpeed: 72, enragedMoveSpeed: 102, score: 2400, spawnInterval: 4.2, maxSpawnedBricks: 7, spawnCountMin: 2, spawnCountMax: 3, phaseThresholds: [0.66, 0.33], damageReduction: 0.45, shieldCycle: 6, shieldDuration: 2 }
    },

    ITEMS: {
      dropChance: 0.15,
      maxActive: 12,
      width: 24,
      height: 24,
      fallSpeed: 128,
      definitions: [
        { id: "paddle_expand", name: "패들 확장", symbol: "W", weight: 40, duration: 10, value: 1.5, color: "#35c98f" },
        { id: "multi_ball", name: "다중 공", symbol: "+", weight: 34, value: 2, color: "#f2c94c" },
        { id: "slow_ball", name: "감속", symbol: "S", weight: 26, duration: 8, value: 0.75, color: "#65c8ff" }
      ]
    },

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
        description: "10스테이지의 기본 심연을 돌파합니다.",
        unlockedByDefault: true,
        scoreMultiplier: 1,
        stoneMultiplier: 1,
        rules: { finalStage: 10, endless: false, relicLimit: 1 }
      },
      endless: {
        id: "endless",
        name: "무한 모드",
        description: "10스테이지 이후에도 보스와 난이도 스케일링이 계속됩니다.",
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
        rules: { finalStage: 10, relicLimit: 1, startingLives: 1, maxLives: 1, ignoreExtraLife: true, disabledUpgrades: ["life_repair", "max_life"] }
      },
      no_items: {
        id: "no_items",
        name: "아이템 봉인 도전",
        description: "떨어지는 아이템 없이 능력과 조작만으로 돌파합니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 1.5,
        stoneMultiplier: 1.2,
        rules: { finalStage: 10, relicLimit: 1, noItems: true, disabledUpgrades: ["nature_drop", "duration_boost"], disabledRelics: ["collector_mark"] }
      },
      high_speed: {
        id: "high_speed",
        name: "고속 심연 도전",
        description: "더 빠른 공을 제어해야 합니다.",
        unlockedByDefault: false,
        unlockText: "표준 모드 첫 클리어 후 해금",
        scoreMultiplier: 1.5,
        stoneMultiplier: 1.2,
        rules: { finalStage: 10, relicLimit: 1, ballSpeedMultiplier: 1.2, ballMaxMultiplier: 1.25, disabledUpgrades: ["slow_time"], disabledItems: ["slow_ball"] }
      }
    },

    GAME_MODE_ORDER: ["standard", "endless", "one_life", "no_items", "high_speed"],

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
      balanced: { id: "balanced", name: "균형자", description: "표준 패들, 생명, 속도, 점수로 시작합니다.", unlockCost: 0, paddleWidthMultiplier: 1, maxLifeAdd: 0, ballSpeedMultiplier: 1, brickDamageAdd: 0, scoreMultiplier: 1 },
      guardian: { id: "guardian", name: "수호자", description: "패들 +20%, 최대 생명 +1, 공 속도 -8%, 점수 -10%.", unlockCost: 60, paddleWidthMultiplier: 1.2, maxLifeAdd: 1, ballSpeedMultiplier: 0.92, brickDamageAdd: 0, scoreMultiplier: 0.9 },
      destroyer: { id: "destroyer", name: "파괴자", description: "패들 -15%, 공 속도 +8%, 벽돌 피해 +1, 점수 +20%.", unlockCost: 80, paddleWidthMultiplier: 0.85, maxLifeAdd: 0, ballSpeedMultiplier: 1.08, brickDamageAdd: 1, scoreMultiplier: 1.2 }
    },

    CLASS_ORDER: ["balanced", "guardian", "destroyer"],

    RELICS: [
      { id: "twin_core", name: "쌍심핵", description: "모든 스테이지를 추가 공 1개와 함께 시작합니다." },
      { id: "blast_insignia", name: "폭열 휘장", description: "벽돌 파괴 시 폭발 반향 확률이 25%p 증가합니다." },
      { id: "piercing_crystal", name: "관통 수정", description: "새로 생성되는 모든 공의 관통 횟수가 1 증가합니다." },
      { id: "collector_mark", name: "수집가의 표식", description: "벽돌 10개를 파괴할 때마다 아이템 1개를 확정 생성합니다." },
      { id: "guardian_field", name: "수호 역장", description: "스테이지마다 마지막 공을 한 번 생명 소모 없이 복구합니다." },
      { id: "boss_breaker", name: "보스 브레이커", description: "보스 피해 +50%, 보스 처치 점수 +25%." },
      { id: "acceleration_core", name: "가속 코어", description: "패들 반사마다 해당 공 속도 +2%, 최대 +20%." },
      { id: "focused_lens", name: "집중 렌즈", description: "활성 공이 1개일 때 벽돌 피해 +1, 점수 +30%." }
    ],

    EFFECT_LIMITS: {
      particles: 100,
      floatingTexts: 30,
      screenShakeSeconds: 0.18
    },

    STORAGE_DEFAULTS: {
      schemaVersion: 3,
      bestScore: 0,
      highestStage: 1,
      runClearCount: 0,
      totalRuns: 0,
      abyssStones: 0,
      totalAbyssStonesEarned: 0,
      selectedClassId: "balanced",
      selectedGameModeId: "standard",
      unlockedClasses: { balanced: true, guardian: false, destroyer: false },
      unlockedModes: { standard: true, endless: false, one_life: false, no_items: false, high_speed: false },
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
          destroyer: { bestScore: 0 }
        }
      },
      settings: { sound: true, vibration: true, reducedEffects: false }
    }
  };

  AbyssBreaker.Data = deepFreeze(Data);
})(typeof window !== "undefined" ? window : globalThis);
