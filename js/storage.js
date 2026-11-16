/* AI 考试刷题平台 — 本地存储封装（localStorage，数据只存本机） */
(function () {
  "use strict";

  var PREFIX = "aiexam_";
  var KEYS = {
    progress: PREFIX + "progress_v1",
    wrong: PREFIX + "wrong_v1",
    marked: PREFIX + "marked_v1",
    visit: PREFIX + "visit_v1",
    settings: PREFIX + "settings_v1"
  };

  var storageOK = (function () {
    try {
      localStorage.setItem("__aiexam_test__", "1");
      localStorage.removeItem("__aiexam_test__");
      return true;
    } catch (e) {
      return false;
    }
  })();

  function read(key, fallback) {
    if (!storageOK) return fallback;
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    if (!storageOK) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* 进度：作答历史 + 每卷断点 */
  var progress = read(KEYS.progress, { answered: {}, pos: {} });

  function saveProgress() { write(KEYS.progress, progress); }

  function recordAnswer(qid, node, correct, userAnswer) {
    progress.answered[qid] = {
      node: node,
      result: correct ? "right" : "wrong",
      at: Date.now(),
      lastAnswer: userAnswer || null
    };
    saveProgress();
  }

  function getAnswered(qid) { return progress.answered[qid] || null; }

  function recordPos(nodeId, index) {
    progress.pos[nodeId] = { index: index, at: Date.now() };
    saveProgress();
  }

  function getPos(nodeId) {
    var p = progress.pos[nodeId];
    return p ? p.index : 0;
  }

  function resetNodePos(nodeId) {
    delete progress.pos[nodeId];
    saveProgress();
  }

  function nodeStats(nodeId, totalQuestions) {
    var done = 0, right = 0;
    for (var qid in progress.answered) {
      if (progress.answered[qid].node === nodeId) {
        done++;
        if (progress.answered[qid].result === "right") right++;
      }
    }
    return { done: Math.min(done, totalQuestions), right: right };
  }

  /* 错题本：连续答对 2 次才移出 */
  var wrongBook = read(KEYS.wrong, {});

  function saveWrong() { write(KEYS.wrong, wrongBook); }

  function addWrong(qid, node, userAnswer) {
    var e = wrongBook[qid];
    if (e) {
      e.count++;
      e.streak = 0;
      e.lastWrongAt = Date.now();
      e.lastUserAnswer = userAnswer || null;
    } else {
      wrongBook[qid] = {
        node: node,
        count: 1,
        streak: 0,
        firstWrongAt: Date.now(),
        lastWrongAt: Date.now(),
        lastUserAnswer: userAnswer || null
      };
    }
    saveWrong();
  }

  function recordRight(qid) {
    var e = wrongBook[qid];
    if (!e) return false;
    e.streak = (e.streak || 0) + 1;
    if (e.streak >= 2) {
      delete wrongBook[qid];
      saveWrong();
      return true;
    }
    saveWrong();
    return false;
  }

  function getWrong(qid) { return wrongBook[qid] || null; }
  function wrongCount() { return Object.keys(wrongBook).length; }
  function wrongIds() { return Object.keys(wrongBook); }
  function wrongByNode() {
    var g = {};
    for (var qid in wrongBook) {
      var n = wrongBook[qid].node;
      (g[n] = g[n] || []).push(qid);
    }
    return g;
  }
  function removeWrong(qid) {
    delete wrongBook[qid];
    saveWrong();
  }

  /* 标记本：仅手工取消才移除，与对错无关 */
  var markBook = read(KEYS.marked, {});

  function saveMarked() { write(KEYS.marked, markBook); }

  // reason: "重点复习" | "易错题" | "好题" | 其他自定义文本
  function addMark(qid, node, reason) {
    var e = markBook[qid];
    if (e) {
      e.reason = reason || "重点复习";
      e.at = Date.now();
    } else {
      markBook[qid] = {
        node: node,
        reason: reason || "重点复习",
        at: Date.now()
      };
    }
    saveMarked();
  }

  function removeMark(qid) {
    if (!markBook[qid]) return false;
    delete markBook[qid];
    saveMarked();
    return true;
  }

  function getMark(qid) { return markBook[qid] || null; }
  function markedCount() { return Object.keys(markBook).length; }
  function markedIds() { return Object.keys(markBook); }
  function markedByNode() {
    var g = {};
    for (var qid in markBook) {
      var n = markBook[qid].node;
      (g[n] = g[n] || []).push(qid);
    }
    return g;
  }

  /* 访问记录：最近 200 条 */
  var visits = read(KEYS.visit, []);

  function logVisit(action, detail) {
    visits.unshift({ at: Date.now(), action: action, detail: detail || "" });
    if (visits.length > 200) visits.length = 200;
    write(KEYS.visit, visits);
  }
  function getVisits() { return visits; }

  /* 偏好设置 */
  var settings = read(KEYS.settings, { diffFilter: "all" });

  function saveSettings() { write(KEYS.settings, settings); }
  function getSettings() { return settings; }

  /* 导出 / 导入 / 清除 */
  function exportAll() {
    return {
      exportedAt: new Date().toISOString(),
      progress: progress,
      wrong: wrongBook,
      marked: markBook,
      visits: visits,
      settings: settings
    };
  }

  function importAll(data) {
    if (!data || typeof data !== "object") return false;
    if (data.progress) { progress = data.progress; write(KEYS.progress, progress); }
    if (data.wrong) { wrongBook = data.wrong; write(KEYS.wrong, wrongBook); }
    if (data.marked) { markBook = data.marked; write(KEYS.marked, markBook); }
    if (data.visits) { visits = data.visits; write(KEYS.visit, visits); }
    if (data.settings) { settings = data.settings; write(KEYS.settings, settings); }
    return true;
  }

  function clearAll() {
    progress = { answered: {}, pos: {} };
    wrongBook = {};
    markBook = {};
    visits = [];
    settings = { diffFilter: "all" };
    for (var k in KEYS) {
      try { localStorage.removeItem(KEYS[k]); } catch (e) { /* ignore */ }
    }
    write(KEYS.progress, progress);
    write(KEYS.wrong, wrongBook);
    write(KEYS.marked, markBook);
    write(KEYS.visit, visits);
    write(KEYS.settings, settings);
  }

  function usageBytes() {
    var total = 0;
    for (var k in KEYS) {
      var raw = storageOK ? localStorage.getItem(KEYS[k]) : null;
      if (raw) total += raw.length * 2;
    }
    return total;
  }

  window.EXAM_STORAGE = {
    storageOK: storageOK,
    recordAnswer: recordAnswer,
    getAnswered: getAnswered,
    recordPos: recordPos,
    getPos: getPos,
    resetNodePos: resetNodePos,
    nodeStats: nodeStats,
    addWrong: addWrong,
    recordRight: recordRight,
    getWrong: getWrong,
    wrongCount: wrongCount,
    wrongIds: wrongIds,
    wrongByNode: wrongByNode,
    removeWrong: removeWrong,
    addMark: addMark,
    removeMark: removeMark,
    getMark: getMark,
    markedCount: markedCount,
    markedIds: markedIds,
    markedByNode: markedByNode,
    logVisit: logVisit,
    getVisits: getVisits,
    getSettings: getSettings,
    saveSettings: saveSettings,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    usageBytes: usageBytes
  };
})();
