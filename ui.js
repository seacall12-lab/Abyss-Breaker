"use strict";

(function (global) {
  var AbyssBreaker = global.AbyssBreaker = global.AbyssBreaker || {};
  var Data = AbyssBreaker.Data;
  var State = AbyssBreaker.State;
  var Game = AbyssBreaker.Game;

  if (!Data || !State || !Game) {
    throw new Error("AbyssBreaker.Data, State, and Game must be loaded before ui.js");
  }

  var dom = {};
  var initialized = false;
  var activePointerId = null;
  var upgradeSignature = "";
  var relicSignature = "";
  var classSignature = "";
  var metaSignature = "";
  var modeSignature = "";
  var achievementSignature = "";
  var recordsSignature = "";
  var hudSignature = "";
  var bossSignature = "";
  var guideSignature = "";
  var buttonSignature = "";
  var resetArmed = false;
  var audioContext = null;

  function requireElement(id) {
    var element = global.document.getElementById(id);

    if (!element) {
      throw new Error("Missing DOM element: #" + id);
    }

    return element;
  }

  function collectDom() {
    [
      "app", "game-shell", "lives-value", "score-value", "stage-value", "mode-value",
      "canvas-wrap", "game-canvas", "boss-hud", "boss-name", "boss-hp-fill", "boss-hp-value",
      "control-guide", "launch-button", "pause-button", "restart-button", "start-overlay",
      "start-button", "mode-button", "class-button", "meta-button", "achievement-button",
      "records-button", "settings-button", "lobby-stones", "lobby-class", "lobby-mode",
      "lobby-best", "lobby-stage", "lobby-meta-summary", "lobby-continue-info",
      "new-run-button", "pause-overlay", "pause-run-info",
      "resume-button", "pause-settings-button", "pause-quit-button", "pause-restart-button",
      "life-lost-overlay", "continue-button", "stage-clear-overlay", "stage-clear-score",
      "next-stage-button", "stage-restart-button", "upgrade-overlay", "upgrade-title",
      "upgrade-subtitle", "upgrade-options", "relic-overlay", "relic-title", "relic-subtitle",
      "relic-options", "mode-overlay", "mode-options", "mode-close-button", "class-overlay",
      "class-options", "class-close-button", "meta-overlay", "meta-stones-value",
      "meta-upgrade-options", "meta-close-button", "achievement-overlay",
      "achievement-summary", "achievement-list", "achievement-close-button", "records-overlay",
      "records-content", "records-close-button", "settings-overlay", "sound-toggle",
      "vibration-toggle", "reduced-effects-toggle", "save-data-input", "settings-message",
      "save-export-button", "save-import-button", "save-reset-button", "settings-close-button",
      "gameover-overlay", "gameover-mode", "gameover-score", "gameover-stage", "gameover-time",
      "gameover-bricks", "gameover-items", "gameover-bosses", "gameover-stones",
      "gameover-owned-stones", "gameover-build", "gameover-achievements",
      "gameover-restart-button", "gameover-lobby-button", "gameover-meta-button",
      "gameover-records-button", "run-clear-overlay", "run-clear-mode", "run-clear-score",
      "run-clear-stage", "run-clear-time", "run-clear-bricks", "run-clear-bosses",
      "run-clear-stones", "run-clear-owned-stones", "run-clear-count", "run-clear-build",
      "run-clear-achievements", "run-clear-upgrades", "run-clear-restart-button",
      "run-clear-lobby-button", "run-clear-meta-button", "run-clear-records-button"
    ].forEach(function (id) {
      var key = id.replace(/-([a-z])/g, function (_, letter) {
        return letter.toUpperCase();
      });
      dom[key] = requireElement(id);
    });
  }

  function setHidden(element, hidden) {
    var shouldHide = !!hidden;
    if (element.classList.contains("is-hidden") !== shouldHide) {
      element.classList.toggle("is-hidden", shouldHide);
    }
  }

  function setText(element, value) {
    var text = String(value);
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  function formatInteger(value) {
    return String(Math.max(0, Math.floor(typeof value === "number" && isFinite(value) ? value : 0)));
  }

  function formatTime(value) {
    var seconds = Math.max(0, Math.floor(typeof value === "number" && isFinite(value) ? value : 0));
    var minutes = Math.floor(seconds / 60);
    var remain = seconds % 60;

    if (minutes <= 0) {
      return remain + "초";
    }

    return minutes + "분 " + remain + "초";
  }

  function clearChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function getModeData(stateOrSave) {
    var save = stateOrSave && stateOrSave.persistent ? stateOrSave.persistent : stateOrSave;
    var modeId = save && save.selectedGameModeId ? save.selectedGameModeId : "standard";
    return Data.GAME_MODES[modeId] || Data.GAME_MODES.standard;
  }

  function getRunModeData(state) {
    return Data.GAME_MODES[state.gameModeId || (state.persistent && state.persistent.selectedGameModeId) || "standard"] || Data.GAME_MODES.standard;
  }

  function getClassName(classId) {
    return (Data.CLASSES[classId] || Data.CLASSES.balanced).name;
  }

  function getModeName(modeId) {
    return (Data.GAME_MODES[modeId] || Data.GAME_MODES.standard).name;
  }

  function getClassData(state) {
    return Data.CLASSES[state.persistent.selectedClassId] || Data.CLASSES.balanced;
  }

  function getActiveRunText(activeRun) {
    if (!activeRun) {
      return "";
    }

    return "이어하기 - 스테이지 " + formatInteger(activeRun.stage) +
      " / " + getModeName(activeRun.gameModeId) +
      " / " + getClassName(activeRun.selectedClassId) +
      " / 점수 " + formatInteger(activeRun.score) +
      " / 생명 " + formatInteger(activeRun.lives) + "/" + formatInteger(activeRun.maxLives);
  }

  function getRelicName(id) {
    for (var index = 0; index < Data.RELICS.length; index++) {
      if (Data.RELICS[index].id === id) {
        return Data.RELICS[index].name;
      }
    }

    return "유물 없음";
  }

  function getRelicNames(state) {
    var ids = Array.isArray(state.selectedRelicIds) && state.selectedRelicIds.length ? state.selectedRelicIds : (state.selectedRelicId ? [state.selectedRelicId] : []);

    if (!ids.length) {
      return "유물 없음";
    }

    return ids.map(getRelicName).join(", ");
  }

  function getMetaSummary(save) {
    var total = Data.META_UPGRADE_ORDER.reduce(function (sum, id) {
      return sum + (save.metaUpgrades[id] || 0);
    }, 0);
    var max = Data.META_UPGRADE_ORDER.reduce(function (sum, id) {
      return sum + Data.META_UPGRADES[id].maxLevel;
    }, 0);

    return total + "/" + max;
  }

  function getPointerPosition(event) {
    var rect = dom.gameCanvas.getBoundingClientRect();
    var state = State.getRunState();
    var scaleX = rect.width > 0 ? state.viewport.cssWidth / rect.width : 1;
    var scaleY = rect.height > 0 ? state.viewport.cssHeight / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function getSettings() {
    return State.getRunState().persistent.settings || Data.STORAGE_DEFAULTS.settings;
  }

  function playSound(kind) {
    var settings = getSettings();

    if (!settings.sound || !global.AudioContext && !global.webkitAudioContext) {
      return;
    }

    try {
      if (!audioContext) {
        audioContext = new (global.AudioContext || global.webkitAudioContext)();
      }

      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      var frequency = kind === "confirm" ? 620 : kind === "error" ? 150 : 320;

      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.08);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.09);
    } catch (error) {
      audioContext = null;
    }
  }

  function vibrate(pattern) {
    var settings = getSettings();

    if (settings.vibration && global.navigator && typeof global.navigator.vibrate === "function") {
      global.navigator.vibrate(pattern || 18);
    }
  }

  function updateHud(state) {
    var mode = getRunModeData(state);
    var stageLabel = state.gameModeRules && state.gameModeRules.endless ? formatInteger(state.stage) : formatInteger(state.stage) + "/" + (state.gameModeRules && state.gameModeRules.finalStage || Data.GAME.finalStage);
    var zone = Data.ZONES && state.zoneId && Data.ZONES[state.zoneId] ? Data.ZONES[state.zoneId] : null;
    var evolutionCount = state.activeEvolutions ? Object.keys(state.activeEvolutions).length : 0;
    var signature = state.lives + ":" + state.maxLives + ":" + state.score + ":" + stageLabel + ":" + mode.id + ":" + (zone ? zone.id : "") + ":" + evolutionCount;

    if (signature === hudSignature && !state.flags.needsHudUpdate) {
      return;
    }

    setText(dom.livesValue, formatInteger(state.lives) + "/" + formatInteger(state.maxLives));
    setText(dom.scoreValue, formatInteger(state.score));
    setText(dom.stageValue, stageLabel);
    setText(dom.modeValue, (zone ? zone.name + " " : "") + mode.name.replace(" 모드", ""));
    hudSignature = signature;
    state.flags.needsHudUpdate = false;
  }

  function updateBossHud(state) {
    var boss = state.boss;

    if (!boss || !boss.alive) {
      if (bossSignature === "hidden") {
        return;
      }
      bossSignature = "hidden";
      setHidden(dom.bossHud, true);
      return;
    }

    var hpRatio = Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp)));
    var signature = boss.id + ":" + boss.hp + ":" + boss.maxHp + ":" + !!boss.shieldActive + ":" + hpRatio.toFixed(4);

    if (signature === bossSignature) {
      return;
    }

    setHidden(dom.bossHud, false);
    setText(dom.bossName, boss.name + (boss.shieldActive ? " 방어" : ""));
    setText(dom.bossHpValue, formatInteger(boss.hp) + "/" + formatInteger(boss.maxHp));
    dom.bossHpFill.style.transform = "scaleX(" + hpRatio + ")";
    bossSignature = signature;
  }

  function updateGuide(state) {
    var text = "로비에서 출정을 준비하세요.";

    if (state.mode === Data.MODES.READY) {
      text = "패들을 움직이고 발사하세요.";
    } else if (state.mode === Data.MODES.PLAYING) {
      text = "공을 반사해 벽돌과 보스를 파괴하세요.";
    } else if (state.mode === Data.MODES.PAUSED) {
      text = "일시정지 중입니다.";
    } else if (state.mode === Data.MODES.LIFE_LOST) {
      text = "계속하면 공이 다시 배치됩니다.";
    } else if (state.mode === Data.MODES.STAGE_CLEAR) {
      text = "능력을 선택하고 다음 스테이지로 진행하세요.";
    } else if (state.mode === Data.MODES.UPGRADE) {
      text = "이번 런의 능력을 하나 선택하세요.";
    } else if (state.mode === Data.MODES.RELIC) {
      text = "이번 런에 적용할 유물을 선택하세요.";
    } else if (state.mode === Data.MODES.GAMEOVER || state.mode === Data.MODES.RUN_CLEAR) {
      text = "정산이 완료되었습니다. 기록과 성장을 확인하세요.";
    }

    if (text === guideSignature) {
      return;
    }

    guideSignature = text;
    setText(dom.controlGuide, text);
  }

  function hideAllOverlays() {
    [
      dom.startOverlay, dom.pauseOverlay, dom.lifeLostOverlay, dom.stageClearOverlay,
      dom.upgradeOverlay, dom.relicOverlay, dom.modeOverlay, dom.classOverlay, dom.metaOverlay,
      dom.achievementOverlay, dom.recordsOverlay, dom.settingsOverlay, dom.gameoverOverlay,
      dom.runClearOverlay
    ].forEach(function (overlay) {
      setHidden(overlay, true);
    });
  }

  function createInfoButton(className, title, description, metaText, actionText, disabled, onClick, iconId) {
    var button = global.document.createElement("button");
    var header = global.document.createElement("span");
    var name = global.document.createElement("strong");
    var meta = global.document.createElement("span");
    var copy = global.document.createElement("span");
    var action = global.document.createElement("span");
    var icon = global.document.createElement("span");

    button.type = "button";
    button.className = className || "upgrade-card";
    button.disabled = !!disabled;
    if (!iconId && button.className.indexOf("relic-card") !== -1) {
      iconId = "relic";
    } else if (!iconId && button.className.indexOf("mode-card") !== -1) {
      iconId = title === "Daily Seed" ? "daily" : "mode";
    } else if (!iconId && button.className.indexOf("class-card") !== -1) {
      iconId = disabled && actionText && String(actionText).indexOf("0") === -1 ? "locked" : "class";
    } else if (!iconId && button.className.indexOf("achievement-card") !== -1) {
      iconId = "achievement";
    } else if (!iconId && button.className.indexOf("meta-card") !== -1) {
      iconId = "upgrade";
    } else if (!iconId) {
      iconId = "upgrade";
    }
    icon.className = "card-icon";
    header.className = "upgrade-card-name";
    meta.className = "upgrade-card-category";
    copy.className = "upgrade-card-description";
    action.className = "upgrade-card-level";

    if (AbyssBreaker.Icons && iconId) {
      icon.innerHTML = AbyssBreaker.Icons.svg(iconId);
      button.appendChild(icon);
    }

    setText(name, title);
    setText(meta, metaText || "");
    setText(copy, description || "");
    setText(action, actionText || "");

    header.appendChild(name);
    header.appendChild(meta);
    button.appendChild(header);
    button.appendChild(copy);
    button.appendChild(action);

    if (onClick) {
      button.addEventListener("click", function () {
        onClick();
      });
    }

    return button;
  }

  function createRecordLine(label, value) {
    var row = global.document.createElement("div");
    var dt = global.document.createElement("dt");
    var dd = global.document.createElement("dd");

    row.className = "record-line";
    setText(dt, label);
    setText(dd, value);
    row.appendChild(dt);
    row.appendChild(dd);

    return row;
  }

  function createUpgradeCard(upgrade) {
    return createInfoButton(
      "upgrade-card",
      upgrade.name,
      upgrade.description,
      upgrade.category,
      "Lv." + upgrade.level + " → " + upgrade.nextLevel + " / " + (upgrade.maxLevel >= 90 ? "반복" : upgrade.maxLevel),
      false,
      function () {
        var state = State.getRunState();

        if (state.mode !== Data.MODES.UPGRADE || state.upgrades.selectionLocked) {
          return;
        }

        Array.prototype.forEach.call(dom.upgradeOptions.querySelectorAll("button"), function (option) {
          option.disabled = true;
        });

        if (Game.chooseUpgrade(upgrade.id, state)) {
          playSound("confirm");
          hideAllOverlays();
          sync(State.getRunState());
        }
      }
    );
  }

  function renderUpgradeOptions(state) {
    var signature = state.upgrades.pending.map(function (upgrade) {
      return upgrade.id + ":" + upgrade.nextLevel;
    }).join("|");

    if (signature === upgradeSignature) {
      return;
    }

    upgradeSignature = signature;
    clearChildren(dom.upgradeOptions);

    state.upgrades.pending.forEach(function (upgrade) {
      dom.upgradeOptions.appendChild(createUpgradeCard(upgrade));
    });
  }

  function renderRelicOptions(state) {
    var signature = state.relicChoices.map(function (relic) {
      return relic.id;
    }).join("|");

    if (signature === relicSignature) {
      return;
    }

    relicSignature = signature;
    clearChildren(dom.relicOptions);

    state.relicChoices.forEach(function (relic) {
      dom.relicOptions.appendChild(createInfoButton("upgrade-card relic-card", relic.name, relic.description, "이번 런", "선택", false, function () {
        if (Game.chooseRelic(relic.id, State.getRunState())) {
          playSound("confirm");
          hideAllOverlays();
          sync(State.getRunState());
        }
      }));
    });
  }

  function renderModeOptions(state) {
    var save = state.persistent;
    var signature = Data.GAME_MODE_ORDER.map(function (id) {
      return id + ":" + !!save.unlockedModes[id] + ":" + save.selectedGameModeId;
    }).join("|");

    if (signature === modeSignature) {
      return;
    }

    modeSignature = signature;
    clearChildren(dom.modeOptions);

    Data.GAME_MODE_ORDER.forEach(function (id) {
      var mode = Data.GAME_MODES[id];
      var unlocked = !!save.unlockedModes[id];
      var selected = save.selectedGameModeId === id;
      var action = selected ? "선택됨" : unlocked ? "선택" : mode.unlockText || "잠김";
      var meta = mode.rules && mode.rules.endless ? "무한" : id === "standard" ? "기본" : "도전";

      dom.modeOptions.appendChild(createInfoButton("upgrade-card mode-card" + (selected ? " is-selected" : ""), mode.name, mode.description, meta, action, !unlocked || selected, function () {
        if (State.selectGameMode(id)) {
          playSound("confirm");
          modeSignature = "";
          sync(State.getRunState());
        }
      }));
    });
  }

  function renderClassOptions(state) {
    var save = state.persistent;
    var signature = Data.CLASS_ORDER.map(function (id) {
      return id + ":" + !!save.unlockedClasses[id] + ":" + save.selectedClassId + ":" + save.abyssStones;
    }).join("|");

    if (signature === classSignature) {
      return;
    }

    classSignature = signature;
    clearChildren(dom.classOptions);

    Data.CLASS_ORDER.forEach(function (id) {
      var classData = Data.CLASSES[id];
      var unlocked = !!save.unlockedClasses[id];
      var selected = save.selectedClassId === id;
      var action = selected ? "선택됨" : (unlocked ? "선택" : "해금 " + classData.unlockCost);
      var disabled = selected || (!unlocked && save.abyssStones < classData.unlockCost);

      dom.classOptions.appendChild(createInfoButton("upgrade-card class-card" + (selected ? " is-selected" : ""), classData.name, classData.description, unlocked ? "해금됨" : "잠김", action, disabled, function () {
        if (unlocked) {
          State.selectClass(id);
        } else {
          State.unlockClass(id);
        }
        playSound("confirm");
        classSignature = "";
        sync(State.getRunState());
      }));
    });
  }

  function renderMetaOptions(state) {
    var save = state.persistent;
    var signature = Data.META_UPGRADE_ORDER.map(function (id) {
      return id + ":" + save.metaUpgrades[id] + ":" + save.abyssStones;
    }).join("|");

    setText(dom.metaStonesValue, formatInteger(save.abyssStones));

    if (signature === metaSignature) {
      return;
    }

    metaSignature = signature;
    clearChildren(dom.metaUpgradeOptions);

    Data.META_UPGRADE_ORDER.forEach(function (id) {
      var upgrade = Data.META_UPGRADES[id];
      var level = save.metaUpgrades[id] || 0;
      var maxed = level >= upgrade.maxLevel;
      var cost = upgrade.costs[level] || 0;
      var action = maxed ? "최대" : "구매 " + cost;
      var disabled = maxed || save.abyssStones < cost;

      dom.metaUpgradeOptions.appendChild(createInfoButton("upgrade-card meta-card", upgrade.name, upgrade.description, "Lv." + level + "/" + upgrade.maxLevel, action, disabled, function () {
        if (State.purchaseMetaUpgrade(id)) {
          playSound("confirm");
        }
        metaSignature = "";
        sync(State.getRunState());
      }));
    });
  }

  function renderAchievements(state) {
    var save = state.persistent;
    var achieved = Object.keys(save.achievements || {}).length;
    var signature = achieved + ":" + save.abyssStones;

    setText(dom.achievementSummary, achieved + " / " + Data.ACHIEVEMENTS.length + " 달성");

    if (signature === achievementSignature) {
      return;
    }

    achievementSignature = signature;
    clearChildren(dom.achievementList);

    Data.ACHIEVEMENTS.forEach(function (achievement) {
      var unlocked = !!save.achievements[achievement.id];
      dom.achievementList.appendChild(createInfoButton("upgrade-card achievement-card" + (unlocked ? " is-selected" : ""), achievement.name, achievement.description, unlocked ? "달성" : "미달성", "보상 " + achievement.reward, true, null));
    });
  }

  function renderRecords(state) {
    var save = state.persistent;
    var records = save.records;
    var signature = JSON.stringify(records) + ":" + save.totalRuns + ":" + save.runClearCount;

    if (signature === recordsSignature) {
      return;
    }

    recordsSignature = signature;
    clearChildren(dom.recordsContent);

    dom.recordsContent.appendChild(createRecordLine("총 런", formatInteger(save.totalRuns)));
    dom.recordsContent.appendChild(createRecordLine("총 클리어", formatInteger(save.runClearCount)));
    dom.recordsContent.appendChild(createRecordLine("총 벽돌 파괴", formatInteger(records.totalBricksDestroyed)));
    dom.recordsContent.appendChild(createRecordLine("총 아이템 획득", formatInteger(records.totalItemsCollected)));
    dom.recordsContent.appendChild(createRecordLine("총 보스 처치", formatInteger(records.totalBossesDefeated)));
    dom.recordsContent.appendChild(createRecordLine("최대 동시 공", formatInteger(records.maxActiveBalls)));
    dom.recordsContent.appendChild(createRecordLine("표준 최고 점수", formatInteger(records.standard.bestScore)));
    dom.recordsContent.appendChild(createRecordLine("표준 최고 스테이지", formatInteger(records.standard.bestStage)));
    dom.recordsContent.appendChild(createRecordLine("표준 최단 클리어", records.standard.fastestClearTime ? formatTime(records.standard.fastestClearTime) : "-"));
    dom.recordsContent.appendChild(createRecordLine("무한 최고 점수", formatInteger(records.endless.bestScore)));
    dom.recordsContent.appendChild(createRecordLine("무한 최고 스테이지", formatInteger(records.endless.bestStage)));
    dom.recordsContent.appendChild(createRecordLine("무한 보스 처치", formatInteger(records.endless.bestBossesDefeated)));

    ["one_life", "no_items", "high_speed"].forEach(function (id) {
      var mode = Data.GAME_MODES[id];
      var record = records.challenges[id];
      dom.recordsContent.appendChild(createRecordLine(mode.name, (record.cleared ? "클리어 " + formatInteger(record.clearCount) + "회" : "미클리어") + " / 최고 " + formatInteger(record.bestScore)));
    });
  }

  function renderSettings(state) {
    var settings = state.persistent.settings;

    dom.soundToggle.checked = !!settings.sound;
    dom.vibrationToggle.checked = !!settings.vibration;
    dom.reducedEffectsToggle.checked = !!settings.reducedEffects;
  }

  function renderLobby(state) {
    var save = state.persistent;
    var classData = getClassData(state);
    var modeData = getModeData(save);
    var activeRun = save.activeRun || null;

    setText(dom.lobbyStones, formatInteger(save.abyssStones));
    setText(dom.lobbyClass, classData.name);
    setText(dom.lobbyMode, modeData.name);
    setText(dom.lobbyBest, formatInteger(save.bestScore));
    setText(dom.lobbyStage, formatInteger(save.highestStage));
    setText(dom.lobbyMetaSummary, getMetaSummary(save));
    setText(dom.startButton, activeRun ? "이어하기" : "새 시작");
    setText(dom.lobbyContinueInfo, getActiveRunText(activeRun));
    setHidden(dom.lobbyContinueInfo, !activeRun);
    setHidden(dom.newRunButton, !activeRun);
  }

  function getNewAchievementText(state) {
    if (!state.unlockedAchievementIds || !state.unlockedAchievementIds.length) {
      return "";
    }

    return "새 업적: " + state.unlockedAchievementIds.map(function (id) {
      for (var index = 0; index < Data.ACHIEVEMENTS.length; index++) {
        if (Data.ACHIEVEMENTS[index].id === id) {
          return Data.ACHIEVEMENTS[index].name;
        }
      }
      return id;
    }).join(", ");
  }

  function renderGameover(state) {
    var classData = getClassData(state);

    setText(dom.gameoverMode, getRunModeData(state).name);
    setText(dom.gameoverScore, formatInteger(state.score));
    setText(dom.gameoverStage, formatInteger(state.highestStageReached));
    setText(dom.gameoverTime, formatTime(state.runElapsedTime));
    setText(dom.gameoverBricks, formatInteger(state.runStats.bricksDestroyed));
    setText(dom.gameoverItems, formatInteger(state.runStats.itemsCollected));
    setText(dom.gameoverBosses, formatInteger(state.runStats.bossesDefeated));
    setText(dom.gameoverStones, formatInteger(state.earnedAbyssStones));
    setText(dom.gameoverOwnedStones, formatInteger(state.persistent.abyssStones));
    setText(dom.gameoverBuild, classData.name + " / " + getRelicNames(state));
    setText(dom.gameoverAchievements, getNewAchievementText(state));
  }

  function renderRunClear(state) {
    var classData = getClassData(state);
    var text = state.upgrades.chosen.length ? state.upgrades.chosen.join(", ") : "선택한 능력 없음";

    setText(dom.runClearMode, getRunModeData(state).name);
    setText(dom.runClearScore, formatInteger(state.score));
    setText(dom.runClearStage, formatInteger(state.lives) + "/" + formatInteger(state.maxLives));
    setText(dom.runClearTime, formatTime(state.runElapsedTime));
    setText(dom.runClearBricks, formatInteger(state.runStats.bricksDestroyed));
    setText(dom.runClearBosses, formatInteger(state.runStats.bossesDefeated));
    setText(dom.runClearStones, formatInteger(state.earnedAbyssStones));
    setText(dom.runClearOwnedStones, formatInteger(state.persistent.abyssStones));
    setText(dom.runClearCount, formatInteger(state.persistent.runClearCount));
    setText(dom.runClearBuild, classData.name + " / " + getRelicNames(state));
    setText(dom.runClearAchievements, getNewAchievementText(state));
    setText(dom.runClearUpgrades, text);
  }

  function renderPause(state) {
    setText(dom.pauseRunInfo, getRunModeData(state).name + " / 스테이지 " + formatInteger(state.stage) + " / 점수 " + formatInteger(state.score));
  }

  function syncOverlays(state) {
    setHidden(dom.startOverlay, state.mode !== Data.MODES.LOBBY);
    setHidden(dom.pauseOverlay, state.mode !== Data.MODES.PAUSED);
    setHidden(dom.lifeLostOverlay, state.mode !== Data.MODES.LIFE_LOST);
    setHidden(dom.stageClearOverlay, state.mode !== Data.MODES.STAGE_CLEAR);
    setHidden(dom.upgradeOverlay, state.mode !== Data.MODES.UPGRADE);
    setHidden(dom.relicOverlay, state.mode !== Data.MODES.RELIC);
    setHidden(dom.modeOverlay, state.mode !== Data.MODES.GAME_MODE);
    setHidden(dom.classOverlay, state.mode !== Data.MODES.CLASS_SELECT);
    setHidden(dom.metaOverlay, state.mode !== Data.MODES.META);
    setHidden(dom.achievementOverlay, state.mode !== Data.MODES.ACHIEVEMENTS);
    setHidden(dom.recordsOverlay, state.mode !== Data.MODES.RECORDS);
    setHidden(dom.settingsOverlay, state.mode !== Data.MODES.SETTINGS);
    setHidden(dom.gameoverOverlay, state.mode !== Data.MODES.GAMEOVER);
    setHidden(dom.runClearOverlay, state.mode !== Data.MODES.RUN_CLEAR);

    if (state.mode === Data.MODES.LOBBY) {
      renderLobby(state);
    }
    if (state.mode === Data.MODES.PAUSED) {
      renderPause(state);
    }
    if (state.mode === Data.MODES.STAGE_CLEAR) {
      setText(dom.stageClearScore, formatInteger(state.score));
    }
    if (state.mode === Data.MODES.UPGRADE) {
      setText(dom.upgradeTitle, "스테이지 " + formatInteger(state.stage) + " 클리어");
      setText(dom.upgradeSubtitle, "능력 하나를 선택하면 다음 스테이지가 시작됩니다.");
      renderUpgradeOptions(state);
    } else {
      upgradeSignature = "";
    }
    if (state.mode === Data.MODES.RELIC) {
      setText(dom.relicTitle, "유물 선택");
      setText(dom.relicSubtitle, "보스 처치 보상입니다. 이번 런에 적용할 유물을 선택하세요.");
      renderRelicOptions(state);
    } else {
      relicSignature = "";
    }
    if (state.mode === Data.MODES.GAME_MODE) {
      renderModeOptions(state);
    } else {
      modeSignature = "";
    }
    if (state.mode === Data.MODES.CLASS_SELECT) {
      renderClassOptions(state);
    } else {
      classSignature = "";
    }
    if (state.mode === Data.MODES.META) {
      renderMetaOptions(state);
    } else {
      metaSignature = "";
    }
    if (state.mode === Data.MODES.ACHIEVEMENTS) {
      renderAchievements(state);
    } else {
      achievementSignature = "";
    }
    if (state.mode === Data.MODES.RECORDS) {
      renderRecords(state);
    } else {
      recordsSignature = "";
    }
    if (state.mode === Data.MODES.SETTINGS) {
      renderSettings(state);
    }
    if (state.mode === Data.MODES.GAMEOVER) {
      renderGameover(state);
    }
    if (state.mode === Data.MODES.RUN_CLEAR) {
      renderRunClear(state);
    }
  }

  function syncButtons(state) {
    var signature = state.mode + ":" + !!(state.persistent && state.persistent.activeRun);

    if (signature === buttonSignature) {
      return;
    }

    dom.launchButton.disabled = state.mode !== Data.MODES.READY;
    dom.pauseButton.disabled = state.mode !== Data.MODES.READY && state.mode !== Data.MODES.PLAYING;
    dom.restartButton.disabled = false;
    dom.resumeButton.disabled = state.mode !== Data.MODES.PAUSED;
    buttonSignature = signature;
  }

  function sync(state) {
    var runState = state || State.getRunState();

    updateHud(runState);
    updateBossHud(runState);
    updateGuide(runState);
    syncOverlays(runState);
    syncButtons(runState);

    return runState;
  }

  function startGame() {
    activePointerId = null;

    if (State.getRunState().persistent.activeRun) {
      if (!Game.restoreActiveRun()) {
        State.clearActiveRun();
        sync(State.getRunState());
        return;
      }
      if (AbyssBreaker.Main && typeof AbyssBreaker.Main.resizeCanvas === "function") {
        AbyssBreaker.Main.resizeCanvas();
      }
      if (AbyssBreaker.Main && typeof AbyssBreaker.Main.renderFrame === "function") {
        AbyssBreaker.Main.renderFrame();
      }
      if (AbyssBreaker.Main && typeof AbyssBreaker.Main.resetFrameClock === "function") {
        AbyssBreaker.Main.resetFrameClock();
      }
    } else if (AbyssBreaker.Main && typeof AbyssBreaker.Main.restartGame === "function") {
      AbyssBreaker.Main.restartGame();
    } else {
      Game.startRun(State.restartRun());
    }

    playSound("confirm");
    hideAllOverlays();
    sync(State.getRunState());
  }

  function startNewRun() {
    if (State.getRunState().persistent.activeRun && global.confirm && !global.confirm("기존 이어하기 기록을 삭제하고 새로 시작할까요?")) {
      return;
    }

    State.clearActiveRun();
    activePointerId = null;

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.restartGame === "function") {
      AbyssBreaker.Main.restartGame();
    } else {
      Game.startRun(State.restartRun());
    }

    playSound("confirm");
    hideAllOverlays();
    sync(State.getRunState());
  }

  function goLobby() {
    activePointerId = null;

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.goLobby === "function") {
      AbyssBreaker.Main.goLobby();
    } else {
      State.restartRun();
    }

    hideAllOverlays();
    sync(State.getRunState());
  }

  function restartGame() {
    startGame();
  }

  function launch() {
    if (Game.launchBall(State.getRunState())) {
      playSound("tap");
      vibrate(12);
      hideAllOverlays();
      sync(State.getRunState());
    }
  }

  function pauseGame() {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.READY && state.mode !== Data.MODES.PLAYING) {
      return;
    }

    activePointerId = null;
    State.setMode(Data.MODES.PAUSED);
    sync(state);
  }

  function resumeGame() {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.PAUSED) {
      return;
    }

    var nextMode = state.previousMode === Data.MODES.PLAYING ? Data.MODES.PLAYING : Data.MODES.READY;
    State.setMode(nextMode);

    if (AbyssBreaker.Main && typeof AbyssBreaker.Main.resetFrameClock === "function") {
      AbyssBreaker.Main.resetFrameClock();
    }

    sync(state);
  }

  function continueAfterLifeLost() {
    if (Game.continueAfterLifeLost(State.getRunState())) {
      playSound("confirm");
      hideAllOverlays();
      sync(State.getRunState());
    }
  }

  function proceedAfterStageClear() {
    if (Game.enterUpgradeState(State.getRunState())) {
      sync(State.getRunState());
    }
  }

  function restartStage() {
    Game.restartStage(State.getRunState());
    hideAllOverlays();
    sync(State.getRunState());
  }

  function menuReturnMode(state) {
    if (state.previousMode === Data.MODES.PAUSED || state.previousMode === Data.MODES.GAMEOVER || state.previousMode === Data.MODES.RUN_CLEAR || state.previousMode === Data.MODES.LOBBY) {
      return state.previousMode;
    }

    return Data.MODES.LOBBY;
  }

  function openMenu(mode) {
    resetArmed = false;
    State.setMode(mode);
    sync(State.getRunState());
  }

  function closeMenu() {
    var state = State.getRunState();
    resetArmed = false;
    setText(dom.settingsMessage, "");
    State.setMode(menuReturnMode(state));
    sync(State.getRunState());
  }

  function quitRun() {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.PAUSED) {
      return;
    }

    if (global.confirm && !global.confirm("현재 런을 포기하고 정산하시겠습니까?")) {
      return;
    }

    if (Game.forfeitRun(state)) {
      vibrate([20, 30, 20]);
      sync(State.getRunState());
    }
  }

  function applySettings() {
    State.updateSettings({
      sound: !!dom.soundToggle.checked,
      vibration: !!dom.vibrationToggle.checked,
      reducedEffects: !!dom.reducedEffectsToggle.checked
    });
    setText(dom.settingsMessage, "설정을 저장했습니다.");
    sync(State.getRunState());
  }

  function exportSave() {
    var text = State.exportSaveText();
    dom.saveDataInput.value = text;
    setText(dom.settingsMessage, "저장 데이터를 내보냈습니다.");

    if (global.navigator && global.navigator.clipboard && typeof global.navigator.clipboard.writeText === "function") {
      global.navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  function importSave() {
    var result = State.applyImportedSave(dom.saveDataInput.value);

    resetArmed = false;
    setText(dom.settingsMessage, result.ok ? "저장 데이터를 불러왔습니다." : "저장 JSON 형식이 올바르지 않습니다.");
    if (result.ok) {
      playSound("confirm");
      sync(State.getRunState());
    } else {
      playSound("error");
    }
  }

  function resetSave() {
    if (!resetArmed) {
      resetArmed = true;
      setText(dom.settingsMessage, "초기화를 다시 누르면 모든 진행도가 삭제됩니다.");
      return;
    }

    State.resetAllProgress();
    resetArmed = false;
    dom.saveDataInput.value = "";
    setText(dom.settingsMessage, "진행도를 초기화했습니다.");
    sync(State.getRunState());
  }

  function handlePointerDown(event) {
    var state = State.getRunState();

    if (state.mode !== Data.MODES.READY && state.mode !== Data.MODES.PLAYING) {
      return;
    }

    var position = getPointerPosition(event);

    activePointerId = event.pointerId;
    state.input.pointerActive = true;
    state.input.pointerId = event.pointerId;
    state.input.pointerStartX = position.x;
    state.input.pointerStartY = position.y;
    state.input.pointerMoved = false;
    Game.movePaddleTo(position.x, state);

    if (typeof dom.gameCanvas.setPointerCapture === "function") {
      try {
        dom.gameCanvas.setPointerCapture(event.pointerId);
      } catch (error) {
        activePointerId = event.pointerId;
      }
    }

    event.preventDefault();
  }

  function handlePointerMove(event) {
    var state = State.getRunState();

    if (event.pointerType === "mouse" && activePointerId === null && (state.mode === Data.MODES.READY || state.mode === Data.MODES.PLAYING)) {
      Game.movePaddleTo(getPointerPosition(event).x, state);
      return;
    }

    if (activePointerId !== event.pointerId) {
      return;
    }

    var position = getPointerPosition(event);
    var dx = position.x - state.input.pointerStartX;
    var dy = position.y - state.input.pointerStartY;

    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      state.input.pointerMoved = true;
    }

    Game.movePaddleTo(position.x, state);
    event.preventDefault();
  }

  function finishPointer(event) {
    var state = State.getRunState();

    if (activePointerId !== event.pointerId) {
      return;
    }

    if (typeof dom.gameCanvas.releasePointerCapture === "function") {
      try {
        dom.gameCanvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        activePointerId = null;
      }
    }

    if (state.mode === Data.MODES.READY && !state.input.pointerMoved) {
      launch();
    }

    state.input.pointerActive = false;
    state.input.pointerId = null;
    activePointerId = null;
    event.preventDefault();
  }

  function handlePointerCancel(event) {
    if (activePointerId !== event.pointerId) {
      return;
    }

    var state = State.getRunState();
    state.input.pointerActive = false;
    state.input.pointerId = null;
    activePointerId = null;
    event.preventDefault();
  }

  function bindEvents() {
    dom.startButton.addEventListener("click", startGame);
    dom.newRunButton.addEventListener("click", startNewRun);
    dom.modeButton.addEventListener("click", function () { openMenu(Data.MODES.GAME_MODE); });
    dom.classButton.addEventListener("click", function () { openMenu(Data.MODES.CLASS_SELECT); });
    dom.metaButton.addEventListener("click", function () { openMenu(Data.MODES.META); });
    dom.achievementButton.addEventListener("click", function () { openMenu(Data.MODES.ACHIEVEMENTS); });
    dom.recordsButton.addEventListener("click", function () { openMenu(Data.MODES.RECORDS); });
    dom.settingsButton.addEventListener("click", function () { openMenu(Data.MODES.SETTINGS); });
    dom.launchButton.addEventListener("click", launch);
    dom.pauseButton.addEventListener("click", pauseGame);
    dom.restartButton.addEventListener("click", restartGame);
    dom.resumeButton.addEventListener("click", resumeGame);
    dom.pauseSettingsButton.addEventListener("click", function () { openMenu(Data.MODES.SETTINGS); });
    dom.pauseQuitButton.addEventListener("click", quitRun);
    dom.pauseRestartButton.addEventListener("click", restartGame);
    dom.continueButton.addEventListener("click", continueAfterLifeLost);
    dom.nextStageButton.addEventListener("click", proceedAfterStageClear);
    dom.stageRestartButton.addEventListener("click", restartStage);
    dom.modeCloseButton.addEventListener("click", closeMenu);
    dom.classCloseButton.addEventListener("click", closeMenu);
    dom.metaCloseButton.addEventListener("click", closeMenu);
    dom.achievementCloseButton.addEventListener("click", closeMenu);
    dom.recordsCloseButton.addEventListener("click", closeMenu);
    dom.settingsCloseButton.addEventListener("click", closeMenu);
    dom.soundToggle.addEventListener("change", applySettings);
    dom.vibrationToggle.addEventListener("change", applySettings);
    dom.reducedEffectsToggle.addEventListener("change", applySettings);
    dom.saveExportButton.addEventListener("click", exportSave);
    dom.saveImportButton.addEventListener("click", importSave);
    dom.saveResetButton.addEventListener("click", resetSave);
    dom.gameoverRestartButton.addEventListener("click", restartGame);
    dom.gameoverLobbyButton.addEventListener("click", goLobby);
    dom.gameoverMetaButton.addEventListener("click", function () { openMenu(Data.MODES.META); });
    dom.gameoverRecordsButton.addEventListener("click", function () { openMenu(Data.MODES.RECORDS); });
    dom.runClearRestartButton.addEventListener("click", restartGame);
    dom.runClearLobbyButton.addEventListener("click", goLobby);
    dom.runClearMetaButton.addEventListener("click", function () { openMenu(Data.MODES.META); });
    dom.runClearRecordsButton.addEventListener("click", function () { openMenu(Data.MODES.RECORDS); });

    dom.gameCanvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
    dom.gameCanvas.addEventListener("pointermove", handlePointerMove, { passive: false });
    global.addEventListener("pointerup", finishPointer, { passive: false });
    global.addEventListener("pointercancel", handlePointerCancel, { passive: false });
    global.addEventListener("blur", function () {
      activePointerId = null;
      State.getRunState().input.pointerActive = false;
    });
  }

  function init() {
    if (initialized) {
      return dom;
    }

    collectDom();
    bindEvents();
    initialized = true;
    sync(State.getRunState());

    return dom;
  }

  AbyssBreaker.Feedback = {
    playSound: playSound,
    vibrate: vibrate
  };

  AbyssBreaker.UI = {
    init: init,
    dom: dom,
    sync: sync,
    updateHud: updateHud,
    showStartOverlay: function () {
      setHidden(dom.startOverlay, false);
    },
    hideAllOverlays: hideAllOverlays,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    restartGame: restartGame,
    goLobby: goLobby,
    getCanvas: function () {
      return dom.gameCanvas;
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
