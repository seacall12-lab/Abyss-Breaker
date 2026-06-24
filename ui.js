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
  var compendiumSignature = "";
  var cosmeticsSignature = "";
  var equipmentSignature = "";
  var researchSignature = "";
  var compendiumTab = "upgrades";
  var cosmeticsTab = "ball";
  var hudSignature = "";
  var bossSignature = "";
  var guideSignature = "";
  var buttonSignature = "";
  var classUnlockMessage = "";
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
      "start-button", "mode-button", "class-button", "meta-button", "equipment-button", "research-button", "achievement-button",
      "records-button", "compendium-button", "cosmetics-button", "settings-button", "lobby-stones", "lobby-class", "lobby-mode",
      "lobby-best", "lobby-stage", "lobby-meta-summary", "lobby-continue-info",
      "new-run-button", "pause-overlay", "pause-run-info",
      "resume-button", "pause-settings-button", "pause-quit-button", "pause-restart-button",
      "life-lost-overlay", "continue-button", "stage-clear-overlay", "stage-clear-score", "stage-mission-result",
      "next-stage-button", "stage-restart-button", "upgrade-overlay", "upgrade-title",
      "upgrade-subtitle", "upgrade-options", "relic-overlay", "relic-title", "relic-subtitle",
      "relic-options", "mode-overlay", "mode-options", "mode-close-button", "class-overlay",
      "class-options", "class-close-button", "meta-overlay", "meta-stones-value",
      "meta-upgrade-options", "meta-close-button", "achievement-overlay",
      "achievement-summary", "achievement-list", "achievement-close-button", "records-overlay",
      "equipment-overlay", "equipment-tabs", "equipment-summary", "equipment-recommendations", "equipment-content", "equipment-close-button",
      "research-overlay", "research-summary", "core-pull-button", "board-pull-button", "chip-pull-button",
      "core-pull10-button", "board-pull10-button", "chip-pull10-button", "research-results", "research-close-button",
      "records-content", "records-close-button", "compendium-overlay", "compendium-tabs",
      "compendium-content", "compendium-close-button", "cosmetics-overlay", "cosmetics-tabs",
      "cosmetics-content", "cosmetics-close-button", "settings-overlay", "sound-toggle",
      "vibration-toggle", "reduced-effects-toggle", "ball-size-select", "paddle-size-select",
      "touch-sensitivity-select", "high-contrast-toggle", "screen-shake-toggle", "save-data-input", "settings-message",
      "save-export-button", "save-import-button", "save-reset-button", "settings-close-button",
      "gameover-overlay", "gameover-mode", "gameover-score", "gameover-stage", "gameover-time",
      "gameover-bricks", "gameover-items", "gameover-bosses", "gameover-missions", "gameover-stones",
      "gameover-owned-stones", "gameover-summary", "gameover-build", "gameover-achievements",
      "gameover-restart-button", "gameover-lobby-button", "gameover-meta-button",
      "gameover-records-button", "run-clear-overlay", "run-clear-mode", "run-clear-score",
      "run-clear-stage", "run-clear-time", "run-clear-bricks", "run-clear-bosses",
      "run-clear-missions", "run-clear-stones", "run-clear-owned-stones", "run-clear-count",
      "run-clear-summary", "run-clear-build", "run-clear-achievements", "run-clear-upgrades", "run-clear-restart-button",
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

  function getMissionText(state) {
    var progress = state.currentStageMission;
    var mission = progress && Data.STAGE_MISSIONS ? Data.STAGE_MISSIONS[progress.id] : null;

    if (!progress || !mission) {
      return "";
    }
    if (progress.failed) {
      return "미션: " + mission.name + " 실패";
    }
    if (progress.completed) {
      return "미션: " + mission.name + " 완료";
    }
    if (mission.type === "time_limit") {
      var left = Math.max(0, Math.ceil((mission.target || 90) - ((state.time.elapsed || 0) - (progress.startedAt || 0))));
      return "미션: " + mission.name + " " + left + "초";
    }
    if (mission.type === "fail_on_life_lost") {
      return "미션: " + mission.name;
    }
    return "미션: " + mission.name + " " + formatInteger(progress.progress || 0) + "/" + formatInteger(progress.target || 1);
  }

  function clearChildren(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function getIconMarkup(iconId) {
    return AbyssBreaker.Icons && iconId ? AbyssBreaker.Icons.svg(iconId) : "";
  }

  function addButtonIcon(button, iconId) {
    if (!button || !iconId || button.querySelector(".button-icon")) {
      return;
    }

    var icon = global.document.createElement("span");
    icon.className = "button-icon";
    icon.innerHTML = getIconMarkup(iconId);
    button.insertBefore(icon, button.firstChild);
  }

  function getClassIconId(classId) {
    return "class_" + classId;
  }

  function getModeIconId(modeId) {
    var mode = Data.GAME_MODES[modeId];
    return mode && mode.iconId ? mode.iconId : "mode_" + modeId;
  }

  function getItemIconId(itemId) {
    return "item_" + itemId;
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

  function getTouchSensitivityMultiplier(state) {
    var value = state && state.persistent && state.persistent.accessibility ? state.persistent.accessibility.touchSensitivity : "default";
    return value === "high" ? 1.25 : value === "low" ? 0.8 : 1;
  }

  function playSound(kind) {
    var settings = getSettings();

    if (!(settings.soundEnabled !== undefined ? settings.soundEnabled : settings.sound) || !global.AudioContext && !global.webkitAudioContext) {
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

    if ((settings.vibrationEnabled !== undefined ? settings.vibrationEnabled : settings.vibration) && global.navigator && typeof global.navigator.vibrate === "function") {
      global.navigator.vibrate(pattern || 18);
    }
  }

  function updateHud(state) {
    var mode = getRunModeData(state);
    var stageLabel = state.gameModeRules && state.gameModeRules.endless ? formatInteger(state.stage) : formatInteger(state.stage) + "/" + (state.gameModeRules && state.gameModeRules.finalStage || Data.GAME.finalStage);
    var zone = Data.ZONES && state.zoneId && Data.ZONES[state.zoneId] ? Data.ZONES[state.zoneId] : null;
    var evolutionCount = state.activeEvolutions ? Object.keys(state.activeEvolutions).length : 0;
    var missionText = getMissionText(state);
    var signature = state.lives + ":" + state.maxLives + ":" + state.score + ":" + stageLabel + ":" + mode.id + ":" + (zone ? zone.id : "") + ":" + evolutionCount + ":" + missionText;

    if (signature === hudSignature && !state.flags.needsHudUpdate) {
      return;
    }

    setText(dom.livesValue, formatInteger(state.lives) + "/" + formatInteger(state.maxLives));
    setText(dom.scoreValue, formatInteger(state.score));
    setText(dom.stageValue, stageLabel);
    setText(dom.modeValue, (zone ? zone.name + " " : "") + mode.name.replace(" 모드", ""));
    if (missionText && (state.mode === Data.MODES.READY || state.mode === Data.MODES.PLAYING)) {
      setText(dom.controlGuide, missionText);
      guideSignature = missionText;
    }
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
    var weak = (boss.weakTimer || boss.forcedWeakTimer) > 0 ? " 약점 개방" : (boss.weakPointSide === "right" ? " 우측 약점" : " 좌측 약점");
    setText(dom.bossName, boss.name + (boss.shieldActive ? " 방어" : "") + weak);
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
      dom.achievementOverlay, dom.equipmentOverlay, dom.researchOverlay, dom.recordsOverlay, dom.settingsOverlay, dom.gameoverOverlay,
      dom.compendiumOverlay, dom.cosmeticsOverlay, dom.runClearOverlay
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
      iconId = "mode";
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

  function createRecordLine(label, value, iconId) {
    var row = global.document.createElement("div");
    var dt = global.document.createElement("dt");
    var dd = global.document.createElement("dd");

    row.className = "record-line";
    if (iconId && AbyssBreaker.Icons) {
      var icon = global.document.createElement("span");
      icon.className = "record-icon";
      icon.innerHTML = getIconMarkup(iconId);
      row.appendChild(icon);
    }
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
      "레벨 " + upgrade.level + " → " + upgrade.nextLevel + " / " + (upgrade.maxLevel >= 90 ? "반복" : upgrade.maxLevel),
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
      },
      upgrade.iconId || "upgrade"
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
      }, "relic"));
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
      var meta = mode.rules && mode.rules.tower ? "엔드게임" : mode.rules && mode.rules.bossRush ? "보스전" : mode.rules && mode.rules.endless ? "무한" : id === "standard" ? "기본" : "도전";
      if ((id === "standard" || id === "endless" || id === "abyss_tower") && Data.MUTATION_ORDER && Data.MUTATION_ORDER.length) {
        var mutation = Data.MUTATIONS[Data.MUTATION_ORDER[(save.totalRuns || 0) % Data.MUTATION_ORDER.length]];
        if (mutation) {
          meta += " / 변이: " + mutation.name;
        }
      }

      dom.modeOptions.appendChild(createInfoButton("upgrade-card mode-card" + (selected ? " is-selected" : ""), mode.name, mode.description, meta, action, !unlocked || selected, function () {
        if (State.selectGameMode(id)) {
          playSound("confirm");
          modeSignature = "";
          sync(State.getRunState());
        }
      }, unlocked ? getModeIconId(id) : "locked"));
    });
  }

  function renderClassOptions(state) {
    var save = state.persistent;
    var synced = State.syncClassUnlocks ? State.syncClassUnlocks(save) : save;
    var signature = Data.CLASS_ORDER.map(function (id) {
      return id + ":" + !!synced.unlockedClasses[id] + ":" + synced.selectedClassId + ":" + synced.abyssStones;
    }).join("|") + ":" + JSON.stringify(synced.classMastery || {}) + ":" + classUnlockMessage;

    if (signature === classSignature) {
      return;
    }

    classSignature = signature;
    clearChildren(dom.classOptions);

    if (classUnlockMessage) {
      var message = global.document.createElement("p");
      message.className = "class-unlock-message";
      message.setAttribute("aria-live", "polite");
      setText(message, classUnlockMessage);
      dom.classOptions.appendChild(message);
    }

    Data.CLASS_ORDER.forEach(function (id) {
      var classData = Data.CLASSES[id];
      var mastery = synced.classMastery && synced.classMastery[id] || { level: 1, exp: 0 };
      var cost = Math.max(0, Math.floor(classData.unlockCost || 0));
      var stones = Math.max(0, Math.floor(synced.abyssStones || 0));
      var unlocked = State.isClassUnlocked ? State.isClassUnlocked(id, synced) : !!synced.unlockedClasses[id];
      var selected = synced.selectedClassId === id;
      var canUnlock = State.canUnlockClass ? State.canUnlockClass(id, synced) : stones >= cost;
      var action = selected ? "선택됨" : unlocked ? "선택" : canUnlock ? "해금 " + cost : "심연석 부족 " + stones + " / " + cost;
      var meta = (unlocked ? "해금됨" : "심연석 " + stones + " / " + cost) + " / 숙련도 Lv." + formatInteger(mastery.level) + " " + formatInteger(mastery.exp) + "/" + formatInteger(mastery.level * 100);
      var disabled = selected || (!unlocked && !canUnlock);

      dom.classOptions.appendChild(createInfoButton("upgrade-card class-card" + (selected ? " is-selected" : ""), classData.name, classData.description, meta, action, disabled, function () {
        var before = State.getRunState().persistent.abyssStones || 0;
        if (unlocked) {
          if (State.selectClass(id)) {
            classUnlockMessage = classData.name + "가 선택되었습니다.";
            playSound("confirm");
          }
        } else {
          if (State.unlockClass(id)) {
            classUnlockMessage = classData.name + " 해금 완료 · " + classData.name + "가 선택되었습니다.";
            playSound("confirm");
          } else {
            classUnlockMessage = "심연석 부족 " + before + " / " + cost;
            playSound("error");
          }
        }
        classSignature = "";
        sync(State.getRunState());
      }, unlocked ? (classData.iconId || getClassIconId(id)) : "locked"));
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

      dom.metaUpgradeOptions.appendChild(createInfoButton("upgrade-card meta-card", upgrade.name, upgrade.description, "레벨 " + level + "/" + upgrade.maxLevel, action, disabled, function () {
        if (State.purchaseMetaUpgrade(id)) {
          playSound("confirm");
        }
        metaSignature = "";
        sync(State.getRunState());
      }, "currency_abyss_stone"));
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
      dom.achievementList.appendChild(createInfoButton("upgrade-card achievement-card" + (unlocked ? " is-selected" : ""), achievement.name, achievement.description, unlocked ? "달성" : "미달성", "보상 " + achievement.reward, true, null, "achievement"));
    });
  }

  function renderRecords(state) {
    var save = state.persistent;
    var records = save.records;
    var signature = JSON.stringify(records) + ":" + save.totalRuns + ":" + save.runClearCount + ":" + (save.missions && save.missions.totalCompleted || 0);

    if (signature === recordsSignature) {
      return;
    }

    recordsSignature = signature;
    clearChildren(dom.recordsContent);

    dom.recordsContent.appendChild(createRecordLine("총 런", formatInteger(save.totalRuns), "record"));
    dom.recordsContent.appendChild(createRecordLine("총 클리어", formatInteger(save.runClearCount), "achievement"));
    dom.recordsContent.appendChild(createRecordLine("총 벽돌 파괴", formatInteger(records.totalBricksDestroyed), "score"));
    dom.recordsContent.appendChild(createRecordLine("총 아이템 획득", formatInteger(records.totalItemsCollected), "item"));
    dom.recordsContent.appendChild(createRecordLine("총 보스 처치", formatInteger(records.totalBossesDefeated), "stage"));
    dom.recordsContent.appendChild(createRecordLine("최대 동시 공", formatInteger(records.maxActiveBalls), "item_multiball"));
    dom.recordsContent.appendChild(createRecordLine("표준 최고 점수", formatInteger(records.standard.bestScore), "score"));
    dom.recordsContent.appendChild(createRecordLine("표준 최고 스테이지", formatInteger(records.standard.bestStage), "stage"));
    dom.recordsContent.appendChild(createRecordLine("표준 최단 클리어", records.standard.fastestClearTime ? formatTime(records.standard.fastestClearTime) : "-", "record"));
    dom.recordsContent.appendChild(createRecordLine("무한 최고 점수", formatInteger(records.endless.bestScore), "mode_endless"));
    dom.recordsContent.appendChild(createRecordLine("무한 최고 스테이지", formatInteger(records.endless.bestStage), "stage"));
    dom.recordsContent.appendChild(createRecordLine("무한 보스 처치", formatInteger(records.endless.bestBossesDefeated), "stage"));
    dom.recordsContent.appendChild(createRecordLine("미션 완료", formatInteger(save.missions && save.missions.totalCompleted), "mission_no_miss"));
    if (records.endgame) {
      dom.recordsContent.appendChild(createRecordLine("심연탑 최고층", formatInteger(records.endgame.towerBestFloor), "mode_tower"));
      dom.recordsContent.appendChild(createRecordLine("보스 러시 최고 진행", formatInteger(records.endgame.bossRushBestStage), "mode_boss_rush"));
      dom.recordsContent.appendChild(createRecordLine("보스 러시 최단 시간", records.endgame.bossRushBestTime ? formatTime(records.endgame.bossRushBestTime) : "-", "record"));
      dom.recordsContent.appendChild(createRecordLine("구역 변이 클리어", formatInteger(records.endgame.mutationClears), "mutation_fracture"));
    }

    Data.GAME_MODE_ORDER.forEach(function (id) {
      var mode = Data.GAME_MODES[id];
      if (!mode || !mode.rules || !mode.rules.challenge) {
        return;
      }
      var record = records.challenges[id];
      if (!record) {
        return;
      }
      dom.recordsContent.appendChild(createRecordLine(mode.name, (record.cleared ? "클리어 " + formatInteger(record.clearCount) + "회" : "미클리어") + " / 최고 " + formatInteger(record.bestScore), getModeIconId(id)));
    });
    Object.keys(records.builds || {}).forEach(function (id) {
      var archetype = Data.BUILD_ARCHETYPES && Data.BUILD_ARCHETYPES[id];
      var record = records.builds[id];
      if (archetype && record && record.bestScore > 0) {
        dom.recordsContent.appendChild(createRecordLine(archetype.name, "최고 점수 " + formatInteger(record.bestScore), archetype.iconId));
      }
    });
  }

  function renderTabs(container, tabs, active, onSelect) {
    clearChildren(container);
    tabs.forEach(function (tab) {
      var button = global.document.createElement("button");
      button.type = "button";
      button.className = "button-secondary" + (tab.id === active ? " is-selected" : "");
      button.textContent = tab.label;
      button.addEventListener("click", function () {
        onSelect(tab.id);
      });
      container.appendChild(button);
    });
  }

  function appendDiscoveryCard(container, group, item, discovered) {
    var hidden = !discovered;
    var name = hidden ? "???" : item.name;
    var description = hidden ? "아직 발견하지 못했습니다." : (item.description || "");
    var category = hidden ? "미발견" : (item.category || (item.tags && item.tags[0]) || "발견");
    var iconId = hidden ? "locked" : (item.iconId || "compendium");

    container.appendChild(createInfoButton("upgrade-card", name, description, category, hidden ? "미발견" : "발견", true, null, iconId));
  }

  function renderCompendium(state) {
    var save = state.persistent;
    var discovered = save.discovered || {};
    var signature = compendiumTab + ":" + JSON.stringify(discovered);
    var tabs = [
      { id: "upgrades", label: "능력" },
      { id: "relics", label: "유물" },
      { id: "evolutions", label: "진화" },
      { id: "items", label: "아이템" },
      { id: "bosses", label: "보스" },
      { id: "zones", label: "구역" },
      { id: "builds", label: "빌드" },
      { id: "cores", label: "공 코어" },
      { id: "boards", label: "보드" },
      { id: "chips", label: "칩" }
    ];

    renderTabs(dom.compendiumTabs, tabs, compendiumTab, function (id) {
      compendiumTab = id;
      compendiumSignature = "";
      renderCompendium(State.getRunState());
    });

    if (signature === compendiumSignature) {
      return;
    }

    clearChildren(dom.compendiumContent);
    if (compendiumTab === "upgrades") {
      Data.UPGRADES.forEach(function (item) { appendDiscoveryCard(dom.compendiumContent, "upgrades", item, discovered.upgrades && discovered.upgrades[item.id]); });
    } else if (compendiumTab === "relics") {
      Data.RELICS.forEach(function (item) { appendDiscoveryCard(dom.compendiumContent, "relics", item, discovered.relics && discovered.relics[item.id]); });
    } else if (compendiumTab === "evolutions") {
      Data.EVOLUTIONS.forEach(function (item) { appendDiscoveryCard(dom.compendiumContent, "evolutions", item, discovered.evolutions && discovered.evolutions[item.id]); });
    } else if (compendiumTab === "items") {
      Data.ITEMS.definitions.forEach(function (item) { appendDiscoveryCard(dom.compendiumContent, "items", item, discovered.items && discovered.items[item.id]); });
    } else if (compendiumTab === "bosses") {
      Object.keys(Data.BOSSES).forEach(function (id) { appendDiscoveryCard(dom.compendiumContent, "bosses", Data.BOSSES[id], discovered.bosses && discovered.bosses[id]); });
    } else if (compendiumTab === "builds") {
      Object.keys(Data.BUILD_ARCHETYPES || {}).forEach(function (id) {
        appendDiscoveryCard(dom.compendiumContent, "builds", Data.BUILD_ARCHETYPES[id], save.buildStats && save.buildStats.discoveredArchetypes && save.buildStats.discoveredArchetypes[id]);
      });
    } else if (compendiumTab === "cores") {
      (Data.BALL_CORE_ORDER || []).forEach(function (id) { appendDiscoveryCard(dom.compendiumContent, "cores", Data.BALL_CORES[id], discovered.cores && discovered.cores[id]); });
    } else if (compendiumTab === "boards") {
      (Data.BOARD_FRAME_ORDER || []).forEach(function (id) { appendDiscoveryCard(dom.compendiumContent, "boards", Data.BOARD_FRAMES[id], discovered.boards && discovered.boards[id]); });
    } else if (compendiumTab === "chips") {
      (Data.SKILL_CHIP_ORDER || []).forEach(function (id) { appendDiscoveryCard(dom.compendiumContent, "chips", Data.SKILL_CHIPS[id], discovered.chips && discovered.chips[id]); });
    } else {
      Object.keys(Data.ZONES).forEach(function (id) { appendDiscoveryCard(dom.compendiumContent, "zones", Data.ZONES[id], discovered.zones && discovered.zones[id]); });
    }
    compendiumSignature = signature;
  }

  function appendCosmeticCard(container, kind, item, unlocked, selected) {
    var action = selected ? "선택됨" : unlocked ? "선택" : "잠김";
    var description = unlocked ? item.description : (item.unlockCondition || "조건을 만족하면 해금됩니다.");
    var iconId = unlocked ? item.iconId : "locked";

    container.appendChild(createInfoButton("upgrade-card cosmetic-card" + (selected ? " is-selected" : ""), item.name, description, unlocked ? "해금" : "잠김", action, !unlocked || selected, function () {
      if (State.selectCosmetic(kind, item.id)) {
        playSound("confirm");
        cosmeticsSignature = "";
        sync(State.getRunState());
      }
    }, iconId));
  }

  function renderCosmetics(state) {
    var cosmetics = state.persistent.cosmetics || {};
    var emblems = state.persistent.emblems || {};
    var signature = cosmeticsTab + ":" + JSON.stringify(cosmetics) + ":" + JSON.stringify(emblems);
    var tabs = [{ id: "ball", label: "공" }, { id: "paddle", label: "패들" }, { id: "emblem", label: "엠블럼" }];

    renderTabs(dom.cosmeticsTabs, tabs, cosmeticsTab, function (id) {
      cosmeticsTab = id;
      cosmeticsSignature = "";
      renderCosmetics(State.getRunState());
    });

    if (signature === cosmeticsSignature) {
      return;
    }

    clearChildren(dom.cosmeticsContent);
    if (cosmeticsTab === "ball") {
      Object.keys(Data.COSMETICS.ballSkins).forEach(function (id) {
        appendCosmeticCard(dom.cosmeticsContent, "ball", Data.COSMETICS.ballSkins[id], cosmetics.unlockedBallSkins && cosmetics.unlockedBallSkins[id], cosmetics.selectedBallSkinId === id);
      });
    } else if (cosmeticsTab === "paddle") {
      Object.keys(Data.COSMETICS.paddleSkins).forEach(function (id) {
        appendCosmeticCard(dom.cosmeticsContent, "paddle", Data.COSMETICS.paddleSkins[id], cosmetics.unlockedPaddleSkins && cosmetics.unlockedPaddleSkins[id], cosmetics.selectedPaddleSkinId === id);
      });
    } else {
      Object.keys(Data.EMBLEMS || {}).forEach(function (id) {
        var item = Data.EMBLEMS[id];
        var unlocked = emblems.unlocked && emblems.unlocked[id];
        var selected = emblems.selectedEmblemId === id;
        dom.cosmeticsContent.appendChild(createInfoButton("upgrade-card cosmetic-card" + (selected ? " is-selected" : ""), item.name, unlocked ? item.description : (item.unlockCondition || "조건을 만족하면 해금됩니다."), unlocked ? "해금됨" : "잠김", selected ? "선택됨" : unlocked ? "선택" : "잠김", !unlocked || selected, function () {
          if (State.selectEmblem && State.selectEmblem(item.id)) {
            playSound("confirm");
            cosmeticsSignature = "";
            sync(State.getRunState());
          }
        }, unlocked ? item.iconId : "locked"));
      });
    }
    cosmeticsSignature = signature;
  }

  function getEquipmentItem(kind, id) {
    return State.getEquipmentById ? State.getEquipmentById(kind, id) : null;
  }

  function getOwnedCount(save, kind, id) {
    var equipment = save.equipment || {};
    var map = kind === "core" ? equipment.ownedCores : kind === "board" ? equipment.ownedBoards : equipment.ownedChips;
    return Math.max(0, Math.floor(map && map[id] || 0));
  }

  function gradeName(grade) {
    return Data.EQUIPMENT_GRADES && Data.EQUIPMENT_GRADES[grade] ? Data.EQUIPMENT_GRADES[grade].name : grade;
  }

  function appendEquipmentCard(container, kind, item, owned, selected, equippedSlot) {
    var action = !owned ? "미보유" : selected && kind === "chip" ? "해제" : selected ? "장착 중" : "장착";
    var disabled = !owned || (selected && kind !== "chip");
    container.appendChild(createInfoButton("upgrade-card cosmetic-card" + (selected ? " is-selected" : ""), item.name, item.description, gradeName(item.grade), action, disabled, function () {
      var ok = false;
      if (kind === "core") {
        ok = State.equipCore(item.id);
      } else if (kind === "board") {
        ok = State.equipBoard(item.id);
      } else if (equippedSlot) {
        ok = State.unequipChip(equippedSlot, item.id);
      } else {
        ok = State.equipChip("core", item.id) || State.equipChip("board", item.id);
      }
      if (ok) {
        playSound("confirm");
        equipmentSignature = "";
        sync(State.getRunState());
      }
    }, owned ? item.iconId : "locked"));
  }

  function renderEquipment(state) {
    var save = state.persistent;
    var equipment = save.equipment || {};
    var preset = equipment.presets && equipment.presets[equipment.selectedPresetId] || {};
    var signature = JSON.stringify(equipment);

    renderTabs(dom.equipmentTabs, Object.keys(equipment.presets || {}).map(function (id) {
      return { id: id, label: (equipment.presets[id] && equipment.presets[id].name) || id };
    }), equipment.selectedPresetId, function (id) {
      if (State.selectEquipmentPreset(id)) {
        equipmentSignature = "";
        renderEquipment(State.getRunState());
      }
    });

    renderTabs(dom.equipmentRecommendations, (Data.RECOMMENDATION_ORDER || []).map(function (id) {
      var rec = Data.RECOMMENDATION_TYPES[id];
      return { id: id, label: rec ? rec.name.replace(" 추천", "") : id };
    }), "", function (id) {
      if (State.recommendEquipment(id)) {
        playSound("confirm");
        equipmentSignature = "";
        renderEquipment(State.getRunState());
      }
    });

    if (signature === equipmentSignature) {
      return;
    }

    clearChildren(dom.equipmentContent);
    var core = getEquipmentItem("core", preset.coreId);
    var board = getEquipmentItem("board", preset.boardId);
    setText(dom.equipmentSummary, "현재 " + (core ? core.name : "-") + " / " + (board ? board.name : "-") + " / 조각 " + formatInteger(save.research && save.research.abyssFragments));

    (Data.BALL_CORE_ORDER || []).forEach(function (id) {
      var item = getEquipmentItem("core", id);
      if (item) {
        appendEquipmentCard(dom.equipmentContent, "core", item, getOwnedCount(save, "core", id) > 0, preset.coreId === id);
      }
    });
    (Data.BOARD_FRAME_ORDER || []).forEach(function (id) {
      var item = getEquipmentItem("board", id);
      if (item) {
        appendEquipmentCard(dom.equipmentContent, "board", item, getOwnedCount(save, "board", id) > 0, preset.boardId === id);
      }
    });
    (Data.SKILL_CHIP_ORDER || []).forEach(function (id) {
      var item = getEquipmentItem("chip", id);
      var coreEquipped = preset.coreChipIds && preset.coreChipIds.indexOf(id) !== -1;
      var boardEquipped = preset.boardChipIds && preset.boardChipIds.indexOf(id) !== -1;
      if (item) {
        appendEquipmentCard(dom.equipmentContent, "chip", item, getOwnedCount(save, "chip", id) > 0, coreEquipped || boardEquipped, coreEquipped ? "core" : boardEquipped ? "board" : "");
      }
    });
    equipmentSignature = signature;
  }

  function appendResearchResult(result) {
    var item = getEquipmentItem(result.kind, result.id);
    dom.researchResults.appendChild(createInfoButton("upgrade-card", result.name, item ? item.description : "", gradeName(result.grade), result.duplicate ? "중복 +" + formatInteger(result.fragments) + " 조각" : "신규", true, null, item ? item.iconId : "relic"));
  }

  function renderResearch(state) {
    var save = state.persistent;
    var research = save.research || {};
    var signature = save.abyssStones + ":" + JSON.stringify(research);
    var corePity = research.pity && research.pity.core || {};
    var boardPity = research.pity && research.pity.board || {};
    var chipPity = research.pity && research.pity.chip || {};

    if (signature === researchSignature) {
      return;
    }
    setText(dom.researchSummary, "심연석 " + formatInteger(save.abyssStones) + " / 조각 " + formatInteger(research.abyssFragments) +
      " / 전설 천장 공 " + formatInteger(corePity.legendary) + "/80 보드 " + formatInteger(boardPity.legendary) + "/80 칩 " + formatInteger(chipPity.legendary) + "/80");
    clearChildren(dom.researchResults);
    (research.lastResults || []).forEach(appendResearchResult);
    ["core", "board", "chip"].forEach(function (kind) {
      var order = kind === "core" ? Data.BALL_CORE_ORDER : kind === "board" ? Data.BOARD_FRAME_ORDER : Data.SKILL_CHIP_ORDER;
      (order || []).forEach(function (id) {
        var item = getEquipmentItem(kind, id);
        var cost = item && Data.EQUIPMENT_CRAFT_COSTS ? Data.EQUIPMENT_CRAFT_COSTS[item.grade] : 0;
        var owned = getOwnedCount(save, kind, id) > 0;
        if (!item || !cost || owned) {
          return;
        }
        dom.researchResults.appendChild(createInfoButton("upgrade-card", item.name, item.description, "선택 제작 / " + gradeName(item.grade), "조각 " + formatInteger(cost), research.abyssFragments < cost, function () {
          if (State.craftEquipment(kind, item.id)) {
            playSound("confirm");
            researchSignature = "";
            sync(State.getRunState());
          }
        }, item.iconId));
      });
    });
    researchSignature = signature;
  }

  function renderSettings(state) {
    var settings = state.persistent.settings;

    dom.soundToggle.checked = settings.soundEnabled !== undefined ? !!settings.soundEnabled : !!settings.sound;
    dom.vibrationToggle.checked = settings.vibrationEnabled !== undefined ? !!settings.vibrationEnabled : !!settings.vibration;
    dom.reducedEffectsToggle.checked = !!settings.reducedEffects;
    var accessibility = state.persistent.accessibility || Data.STORAGE_DEFAULTS.accessibility;
    dom.ballSizeSelect.value = accessibility.ballSize || "default";
    dom.paddleSizeSelect.value = accessibility.paddleSize || "default";
    dom.touchSensitivitySelect.value = accessibility.touchSensitivity || "default";
    dom.highContrastToggle.checked = !!accessibility.highContrast;
    dom.screenShakeToggle.checked = accessibility.screenShake !== false;
  }

  function decorateStaticIcons() {
    addButtonIcon(dom.startButton, "continue");
    addButtonIcon(dom.newRunButton, "restart");
    addButtonIcon(dom.modeButton, "mode_standard");
    addButtonIcon(dom.classButton, "class_balanced");
    addButtonIcon(dom.metaButton, "currency_abyss_stone");
    addButtonIcon(dom.equipmentButton, "equipment");
    addButtonIcon(dom.researchButton, "research");
    addButtonIcon(dom.achievementButton, "achievement");
    addButtonIcon(dom.recordsButton, "record");
    addButtonIcon(dom.compendiumButton, "compendium");
    addButtonIcon(dom.cosmeticsButton, "cosmetic");
    addButtonIcon(dom.settingsButton, "settings");
    addButtonIcon(dom.launchButton, "continue");
    addButtonIcon(dom.pauseButton, "pause");
    addButtonIcon(dom.restartButton, "restart");
    addButtonIcon(dom.resumeButton, "continue");
    addButtonIcon(dom.pauseSettingsButton, "settings");
    addButtonIcon(dom.pauseRestartButton, "restart");
    addButtonIcon(dom.continueButton, "continue");
    addButtonIcon(dom.nextStageButton, "upgrade");
    addButtonIcon(dom.stageRestartButton, "restart");
    addButtonIcon(dom.saveExportButton, "record");
    addButtonIcon(dom.saveImportButton, "continue");
    addButtonIcon(dom.saveResetButton, "restart");
    addButtonIcon(dom.equipmentCloseButton, "continue");
    addButtonIcon(dom.researchCloseButton, "continue");
    addButtonIcon(dom.gameoverRestartButton, "restart");
    addButtonIcon(dom.gameoverMetaButton, "currency_abyss_stone");
    addButtonIcon(dom.gameoverRecordsButton, "record");
    addButtonIcon(dom.runClearRestartButton, "restart");
    addButtonIcon(dom.runClearMetaButton, "currency_abyss_stone");
    addButtonIcon(dom.runClearRecordsButton, "record");
    addButtonIcon(dom.compendiumCloseButton, "continue");
    addButtonIcon(dom.cosmeticsCloseButton, "continue");

    var hudIcons = ["life", "score", "stage", "mode_standard"];
    Array.prototype.forEach.call(global.document.querySelectorAll("#hud .hud-stat span"), function (label, index) {
      if (label.querySelector(".label-icon")) {
        return;
      }
      var icon = global.document.createElement("span");
      icon.className = "label-icon";
      icon.innerHTML = getIconMarkup(hudIcons[index] || "record");
      label.insertBefore(icon, label.firstChild);
    });

    var settingIcons = ["settings", "life", "stage"];
    Array.prototype.forEach.call(global.document.querySelectorAll(".setting-row > span"), function (label, index) {
      if (label.querySelector(".label-icon")) {
        return;
      }
      var icon = global.document.createElement("span");
      icon.className = "label-icon";
      icon.innerHTML = getIconMarkup(settingIcons[index] || "settings");
      label.insertBefore(icon, label.firstChild);
    });
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

  function getMissionResultText(state) {
    var completed = state.completedStageMissions ? Object.keys(state.completedStageMissions).length : 0;
    var failed = state.failedStageMissions ? Object.keys(state.failedStageMissions).length : 0;

    return "미션 완료 " + formatInteger(completed) + "개 / 실패 " + formatInteger(failed) + "개";
  }

  function getRunSummaryText(state) {
    var summary = state.runSummary || {};
    var stats = summary.stats || state.runStats || {};
    var parts = [
      "최대 콤보 " + formatInteger(summary.bestCombo || stats.bestCombo),
      "약점 타격 " + formatInteger(stats.weakHits),
      "정밀 반사 " + formatInteger(stats.precisionHits),
      "레이저 파괴 " + formatInteger(stats.laserBreaks)
    ];

    if (summary.rewardStones !== undefined) {
      parts.push("획득 심연석 " + formatInteger(summary.rewardStones));
    }
    if (Array.isArray(summary.topBuilds) && summary.topBuilds.length) {
      parts.push("대표 빌드 " + summary.topBuilds.map(function (entry) {
        var data = Data.BUILD_ARCHETYPES && Data.BUILD_ARCHETYPES[entry.id];
        return data ? data.name : entry.id;
      }).join(", "));
    }

    return parts.join(" / ");
  }

  function getBuildText(state) {
    var summary = state.runSummary || {};

    if (Array.isArray(summary.topBuilds) && summary.topBuilds.length) {
      return summary.topBuilds.map(function (entry, index) {
        var data = Data.BUILD_ARCHETYPES && Data.BUILD_ARCHETYPES[entry.id];
        return (index === 0 ? "대표 " : "보조 ") + (data ? data.name : entry.id) + " " + formatInteger(entry.score);
      }).join(" / ");
    }
    return getRelicNames(state);
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
    setText(dom.gameoverMissions, getMissionResultText(state));
    setText(dom.gameoverStones, formatInteger(state.earnedAbyssStones));
    setText(dom.gameoverOwnedStones, formatInteger(state.persistent.abyssStones));
    setText(dom.gameoverSummary, getRunSummaryText(state));
    setText(dom.gameoverBuild, classData.name + " / " + getBuildText(state));
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
    setText(dom.runClearMissions, getMissionResultText(state));
    setText(dom.runClearStones, formatInteger(state.earnedAbyssStones));
    setText(dom.runClearOwnedStones, formatInteger(state.persistent.abyssStones));
    setText(dom.runClearCount, formatInteger(state.persistent.runClearCount));
    setText(dom.runClearSummary, getRunSummaryText(state));
    setText(dom.runClearBuild, classData.name + " / " + getBuildText(state));
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
    setHidden(dom.equipmentOverlay, state.mode !== Data.MODES.EQUIPMENT);
    setHidden(dom.researchOverlay, state.mode !== Data.MODES.RESEARCH);
    setHidden(dom.recordsOverlay, state.mode !== Data.MODES.RECORDS);
    setHidden(dom.compendiumOverlay, state.mode !== Data.MODES.COMPENDIUM);
    setHidden(dom.cosmeticsOverlay, state.mode !== Data.MODES.COSMETICS);
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
      setText(dom.stageMissionResult, getMissionText(state) || getMissionResultText(state));
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
    if (state.mode === Data.MODES.EQUIPMENT) {
      renderEquipment(state);
    } else {
      equipmentSignature = "";
    }
    if (state.mode === Data.MODES.RESEARCH) {
      renderResearch(state);
    } else {
      researchSignature = "";
    }
    if (state.mode === Data.MODES.RECORDS) {
      renderRecords(state);
    } else {
      recordsSignature = "";
    }
    if (state.mode === Data.MODES.COMPENDIUM) {
      renderCompendium(state);
    } else {
      compendiumSignature = "";
    }
    if (state.mode === Data.MODES.COSMETICS) {
      renderCosmetics(state);
    } else {
      cosmeticsSignature = "";
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
    var sound = !!dom.soundToggle.checked;
    var vibration = !!dom.vibrationToggle.checked;

    State.updateSettings({
      sound: sound,
      soundEnabled: sound,
      vibration: vibration,
      vibrationEnabled: vibration,
      reducedEffects: !!dom.reducedEffectsToggle.checked,
      ballSize: dom.ballSizeSelect.value,
      paddleSize: dom.paddleSizeSelect.value,
      touchSensitivity: dom.touchSensitivitySelect.value,
      highContrast: !!dom.highContrastToggle.checked,
      accessibilityReducedEffects: !!dom.reducedEffectsToggle.checked,
      screenShake: !!dom.screenShakeToggle.checked
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

  function pullResearch(kind, count) {
    var result = State.extractEquipment(kind, count);
    setText(dom.researchSummary, result.message || "");
    if (result.ok) {
      playSound("confirm");
    } else {
      playSound("error");
    }
    researchSignature = "";
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
    var targetX = position.x;

    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      state.input.pointerMoved = true;
    }

    if (event.pointerType === "touch") {
      targetX = state.input.pointerStartX + dx * getTouchSensitivityMultiplier(state);
    }
    Game.movePaddleTo(targetX, state);
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
    dom.equipmentButton.addEventListener("click", function () { openMenu(Data.MODES.EQUIPMENT); });
    dom.researchButton.addEventListener("click", function () { openMenu(Data.MODES.RESEARCH); });
    dom.achievementButton.addEventListener("click", function () { openMenu(Data.MODES.ACHIEVEMENTS); });
    dom.recordsButton.addEventListener("click", function () { openMenu(Data.MODES.RECORDS); });
    dom.compendiumButton.addEventListener("click", function () { openMenu(Data.MODES.COMPENDIUM); });
    dom.cosmeticsButton.addEventListener("click", function () { openMenu(Data.MODES.COSMETICS); });
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
    dom.equipmentCloseButton.addEventListener("click", closeMenu);
    dom.researchCloseButton.addEventListener("click", closeMenu);
    dom.recordsCloseButton.addEventListener("click", closeMenu);
    dom.compendiumCloseButton.addEventListener("click", closeMenu);
    dom.cosmeticsCloseButton.addEventListener("click", closeMenu);
    dom.settingsCloseButton.addEventListener("click", closeMenu);
    dom.soundToggle.addEventListener("change", applySettings);
    dom.vibrationToggle.addEventListener("change", applySettings);
    dom.reducedEffectsToggle.addEventListener("change", applySettings);
    dom.ballSizeSelect.addEventListener("change", applySettings);
    dom.paddleSizeSelect.addEventListener("change", applySettings);
    dom.touchSensitivitySelect.addEventListener("change", applySettings);
    dom.highContrastToggle.addEventListener("change", applySettings);
    dom.screenShakeToggle.addEventListener("change", applySettings);
    dom.corePullButton.addEventListener("click", function () { pullResearch("core", 1); });
    dom.boardPullButton.addEventListener("click", function () { pullResearch("board", 1); });
    dom.chipPullButton.addEventListener("click", function () { pullResearch("chip", 1); });
    dom.corePull10Button.addEventListener("click", function () { pullResearch("core", 10); });
    dom.boardPull10Button.addEventListener("click", function () { pullResearch("board", 10); });
    dom.chipPull10Button.addEventListener("click", function () { pullResearch("chip", 10); });
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
    decorateStaticIcons();
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
