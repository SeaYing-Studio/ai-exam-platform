/* AI 考试刷题平台 — 题库读取 / 筛选 / 判分核心逻辑 */
(function () {
  "use strict";

  var bankCache = {};

  function getBank(nodeId) {
    var v = window["EXAM_BANK_" + nodeId];
    if (!v) return null;
    if (!bankCache[nodeId]) bankCache[nodeId] = v.questions || [];
    return bankCache[nodeId];
  }

  // 题库已在页面中静态引入，保留同步回调接口方便调用方统一处理
  function loadBank(nodeId, cb) {
    cb(getBank(nodeId));
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hasAnswer(q) {
    return !!(q.answer && (Array.isArray(q.answer) ? q.answer.length : true));
  }

  function filterQuestions(questions, diffFilter) {
    if (!questions) return [];
    return questions.filter(function (q) {
      if (diffFilter && diffFilter !== "all" && q.difficulty && q.difficulty !== diffFilter) return false;
      return hasAnswer(q);
    });
  }

  // 判分：多选全对才得分；返回 { correct: bool }
  function grade(q, userAnswer) {
    if (q.type === "multi") {
      var ans = (q.answer || []).slice().sort().join("");
      var usr = (userAnswer || []).slice().sort().join("");
      return { correct: ans === usr && ans.length > 0 };
    }
    return { correct: userAnswer === q.answer };
  }

  function optionKeys(q) {
    return Object.keys(q.options || {}).sort();
  }

  function validateQuestion(q) {
    var errs = [];
    if (!q.id) errs.push("缺少 id");
    if (!q.node) errs.push("缺少 node");
    if (!q.stem) errs.push("缺少 stem");
    if (!q.options) errs.push("缺少 options");
    if (!q.answer) errs.push("缺少 answer");
    if (!q.explain) errs.push("缺少 explain");
    if (q.type === "multi") {
      if (!Array.isArray(q.answer)) errs.push("多选 answer 应为数组");
      else q.answer.forEach(function (k) { if (!q.options[k]) errs.push("answer 引用不存在的选项 " + k); });
    } else if (q.options && !q.options[q.answer]) {
      errs.push("answer 引用不存在的选项");
    }
    return errs;
  }

  window.EXAM_QUIZ = {
    getBank: getBank,
    loadBank: loadBank,
    shuffle: shuffle,
    filterQuestions: filterQuestions,
    hasAnswer: hasAnswer,
    grade: grade,
    optionKeys: optionKeys,
    validateQuestion: validateQuestion
  };
})();
