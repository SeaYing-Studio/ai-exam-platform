/* AI 考试刷题平台 — 路由与渲染 */
(function () {
  "use strict";

  var S = window.EXAM_STORAGE;
  var Q = window.EXAM_QUIZ;
  var app = document.getElementById("app");

  var VOLUMES = [
    { id: "C27", name: "AI通识300题", desc: "基础概念 · 技术体系 · 治理安全 · AI 与项目管理", diffs: ["基础", "进阶", "冲刺"] },
    { id: "C29", name: "AI咨询测试题", desc: "课程讲义配套 · 含单选与多选 · 讲次全覆盖", diffs: ["基础", "进阶", "冲刺"] }
  ];
  var MARK_REASONS = ["重点复习", "易错题", "好题"];
  var LIKE_API = "https://countapi.mileshilliard.com/api/v1";
  var LIKE_KEY = "seaying-ai-exam-likes";
  var LIKE_LOCAL_KEY = "aiexam_like_local_v1";
  var ALL_DIFFS = ["基础", "进阶", "冲刺"];
  var AUTO_SECONDS = 3;

  var session = null;
  var autoTimer = null;

  /* ---------- 工具 ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0");
  }

  function fmtDuration(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    return m + " 分 " + String(s % 60).padStart(2, "0") + " 秒";
  }

  function volMeta(id) {
    for (var i = 0; i < VOLUMES.length; i++) if (VOLUMES[i].id === id) return VOLUMES[i];
    return null;
  }

  function tierBadge(tier) {
    var b = el("span", "tier-badge", tier || "");
    return b;
  }

  function diffBadge(diff) {
    if (!diff) return null;
    var map = { "基础": "diff-basic", "进阶": "diff-mid", "冲刺": "diff-hard" };
    var b = el("span", "diff-badge " + (map[diff] || ""), diff);
    return b;
  }

  function filterByDiff(qs, diff) {
    return Q.filterQuestions(qs, diff);
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) {
      t = el("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "toast show";
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.className = "toast"; }, 2200);
  }

  /* ---------- 首页点赞（在线累计，失败降级为本地） ---------- */
  function readLocalLikes() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(LIKE_LOCAL_KEY) || "0", 10) || 0; } catch (e) { /* ignore */ }
    return n;
  }
  function writeLocalLikes(n) {
    try { localStorage.setItem(LIKE_LOCAL_KEY, String(n)); } catch (e) { /* ignore */ }
  }

  // 撒花动画：彩色纸屑从按钮位置向上喷发，纯前端实现，无第三方依赖
  function burstConfetti(anchor) {
    if (!anchor || typeof anchor.animate !== "function") return;
    var rect = anchor.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var colors = ["#ffd43b", "#ff6b6b", "#4dabf7", "#51cf66", "#b197fc", "#ff922b", "#f783ac", "#22b8cf"];
    for (var i = 0; i < 90; i++) {
      var p = document.createElement("i");
      p.className = "confetti-piece";
      var w = 5 + Math.random() * 7;
      p.style.width = w + "px";
      p.style.height = (Math.random() > 0.45 ? w : w * 2.4) + "px";
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      if (Math.random() > 0.6) p.style.borderRadius = "50%";
      // 起点轻微抖动，避免所有纸屑从同一像素射出
      p.style.left = (cx + (Math.random() - 0.5) * 26).toFixed(1) + "px";
      p.style.top = (cy + (Math.random() - 0.5) * 18).toFixed(1) + "px";
      document.body.appendChild(p);
      // 扇形角度与抛射距离约翻倍，落点带重力下坠
      var angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      var power = 160 + Math.random() * 260;
      var dx = Math.cos(angle) * power;
      var dy = Math.sin(angle) * power;
      var fall = 170 + Math.random() * 130;
      var spin = (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 720);
      var lift = 0.6 + Math.random() * 0.2;
      var peak = 0.3 + Math.random() * 0.12;
      var anim = p.animate([
        { transform: "translate(-50%, -50%) translate(0px, 0px) scale(0.3) rotate(0deg)", opacity: 0, offset: 0, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)" },
        { transform: "translate(-50%, -50%) translate(" + (dx * 0.18).toFixed(1) + "px," + (dy * 0.18).toFixed(1) + "px) scale(1) rotate(" + Math.round(spin * 0.1) + "deg)", opacity: 1, offset: 0.06 },
        { transform: "translate(-50%, -50%) translate(" + (dx * lift).toFixed(1) + "px," + (dy * lift).toFixed(1) + "px) rotate(" + Math.round(spin * 0.45) + "deg)", opacity: 1, offset: peak, easing: "cubic-bezier(0.35, 0, 0.7, 0.95)" },
        { transform: "translate(-50%, -50%) translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) rotate(" + Math.round(spin * 0.8) + "deg)", opacity: 1, offset: 0.66, easing: "cubic-bezier(0.45, 0, 0.85, 0.8)" },
        { transform: "translate(-50%, -50%) translate(" + (dx * 1.12).toFixed(1) + "px," + (dy + fall).toFixed(1) + "px) rotate(" + Math.round(spin) + "deg)", opacity: 0, offset: 1 }
      ], { duration: 1500 + Math.random() * 700, delay: Math.random() * 160, fill: "both" });
      anim.onfinish = (function (node) { return function () { node.remove(); }; })(p);
    }
  }

  function renderLikeBar(parent) {
    var zone = el("div", "like-zone");
    var btn = el("button", "like-btn");
    btn.type = "button";
    btn.setAttribute("aria-label", "点赞");
    btn.innerHTML = '<svg class="like-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
    var caption = el("div", "like-caption");
    var num = el("span", "like-num", "…");
    caption.appendChild(document.createTextNode("点赞 "));
    caption.appendChild(num);
    zone.appendChild(btn);
    zone.appendChild(caption);

    var localBase = readLocalLikes();
    var onlineOK = false;

    function show(n) { num.textContent = String(n); }

    function fetchCount(inc) {
      var url = LIKE_API + "/" + (inc ? "hit" : "get") + "/" + LIKE_KEY + "?_=" + Date.now();
      return new Promise(function (resolve, reject) {
        var done = false;
        var timer = setTimeout(function () {
          if (!done) { done = true; reject(new Error("timeout")); }
        }, 6000);
        fetch(url, { cache: "no-store", mode: "cors" })
          .then(function (r) {
            if (!r.ok) throw new Error("http " + r.status);
            return r.json();
          })
          .then(function (data) {
            if (done) return;
            done = true; clearTimeout(timer);
            resolve(parseInt(data.value, 10) || 0);
          })
          .catch(function (e) {
            if (done) return;
            done = true; clearTimeout(timer);
            reject(e);
          });
      });
    }

    fetchCount(false).then(function (n) {
      onlineOK = true;
      show(n);
    }).catch(function () {
      show(localBase);
    });

    btn.addEventListener("click", function () {
      burstConfetti(btn);
      btn.classList.remove("like-pop");
      void btn.offsetWidth;
      btn.classList.add("like-pop");
      btn.disabled = true;
      if (onlineOK) {
        fetchCount(true).then(function (n) {
          show(n);
          toast("感谢点赞！");
          btn.disabled = false;
        }).catch(function () {
          var n = readLocalLikes() + 1;
          writeLocalLikes(n);
          show(n + "（本地）");
          toast("网络不可用，点赞已记在本机");
          btn.disabled = false;
        });
      } else {
        var n2 = readLocalLikes() + 1;
        writeLocalLikes(n2);
        show(n2 + "（本地）");
        toast("网络不可用，点赞已记在本机");
        btn.disabled = false;
      }
    });

    parent.appendChild(zone);
  }

  /* ---------- 倒计时管理 ---------- */
  function clearAutoTimer() {
    if (autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  // 仅答对时调用：显示 3 秒可见倒计时，归零自动进入下一题
  function startAutoAdvance(onDone) {
    clearAutoTimer();
    var remain = AUTO_SECONDS;
    var row = el("div", "auto-row");
    var txt = el("p", "auto-text", "回答正确，" + remain + " 秒后自动进入下一题");
    var bar = el("div", "auto-bar");
    var fill = el("div", "auto-fill");
    fill.style.width = "100%";
    bar.appendChild(fill);
    var nowBtn = el("button", "secondary small", "立即下一题");
    row.appendChild(txt);
    row.appendChild(bar);
    row.appendChild(nowBtn);
    var card = app.querySelector(".card");
    if (card) card.insertBefore(row, card.querySelector(".nav-row"));

    function finish() {
      clearAutoTimer();
      onDone();
    }
    nowBtn.addEventListener("click", finish);
    autoTimer = setInterval(function () {
      remain--;
      if (remain <= 0) {
        finish();
        return;
      }
      txt.textContent = "回答正确，" + remain + " 秒后自动进入下一题";
      fill.style.width = Math.round(remain / AUTO_SECONDS * 100) + "%";
    }, 1000);
  }

  /* ---------- 路由 ---------- */
  function route() {
    clearAutoTimer();
    var h = location.hash || "#/";
    var m;
    if (h === "#/" || h === "") return renderHome();
    if (h === "#/wrong") return renderWrong();
    if (h === "#/marked") return renderMarked();
    if (h === "#/data") return renderData();
    if (h === "#/mix") return renderMix();
    if ((m = h.match(/^#\/vol\/([ABC]\d{2})$/))) return renderVol(m[1]);
    if ((m = h.match(/^#\/quiz\/([ABC]\d{2})$/))) return startQuiz(m[1], {});
    if ((m = h.match(/^#\/wrongquiz\/([ABC]\d{2})$/))) return startQuiz(m[1], { fromWrong: true });
    if (h === "#/wrongquiz") return startWrongAll();
    renderHome();
  }
  window.addEventListener("hashchange", route);

  /* ---------- 首页 ---------- */
  function renderHome() {
    app.innerHTML = "";
    var head = el("div", "home-head");
    head.appendChild(el("h1", null, "AI 考试刷题平台"));
    head.appendChild(el("p", "sub", "AI通识300题 · AI咨询测试题 · 答对自动进入下一题 · 学习数据只存本机浏览器"));
    app.appendChild(head);

    if (!S.storageOK) {
      app.appendChild(el("div", "warn-bar", "⚠ 当前页面无法使用本地存储，进度与错题刷新后会丢失。请勿以无痕模式打开。"));
    }

    var visits = S.getVisits();
    var lastVol = null;
    for (var i = 0; i < visits.length; i++) {
      if (visits[i].action === "enter-vol") { lastVol = visits[i].detail; break; }
    }
    if (lastVol && volMeta(lastVol)) {
      var resume = el("a", "resume-card");
      resume.href = "#/vol/" + lastVol;
      resume.appendChild(el("span", "resume-label", "继续上次"));
      resume.appendChild(el("strong", null, volMeta(lastVol).name));
      app.appendChild(resume);
    }

    var wrongN = S.wrongCount();
    var wrongCard = el("a", "resume-card wrong-card");
    wrongCard.href = "#/wrong";
    wrongCard.appendChild(el("span", "resume-label", "错题清单"));
    wrongCard.appendChild(el("strong", null, wrongN === 0 ? "暂无错题" : wrongN + " 道错题待消灭"));
    app.appendChild(wrongCard);

    var markedN = S.markedCount();
    var markedCard = el("a", "resume-card marked-card");
    markedCard.href = "#/marked";
    markedCard.appendChild(el("span", "resume-label", "标记清单"));
    markedCard.appendChild(el("strong", null, markedN === 0 ? "暂无标记" : markedN + " 道已标记 · 需手动取消"));
    app.appendChild(markedCard);

    var mixCard = el("a", "resume-card mix-card");
    mixCard.href = "#/mix";
    mixCard.appendChild(el("span", "resume-label", "混合练习"));
    mixCard.appendChild(el("strong", null, "两卷随机抽题 · 20 / 30 / 50 题"));
    app.appendChild(mixCard);

    app.appendChild(el("h2", null, "刷题入口"));
    var grid = el("div", "vol-grid");
    VOLUMES.forEach(function (v) {
      var card = el("a", "vol-card");
      card.href = "#/vol/" + v.id;
      var title = el("div", "vol-title");
      title.appendChild(el("strong", null, v.name));
      card.appendChild(title);
      card.appendChild(el("div", "vol-desc", v.desc));
      var stat = el("div", "vol-stat");
      stat.appendChild(el("em", "bank-count", "…"));
      card.appendChild(stat);
      grid.appendChild(card);
      Q.loadBank(v.id, function (qs) {
        if (!qs || !qs.length) {
          stat.innerHTML = "";
          stat.appendChild(el("em", "bank-missing", "题库未生成"));
          return;
        }
        var st = S.nodeStats(v.id, qs.length);
        stat.innerHTML = "";
        var pct = Math.round(st.done / qs.length * 100);
        var bar = el("div", "progress-bar");
        var fill = el("div", "progress-fill");
        fill.style.width = pct + "%";
        bar.appendChild(fill);
        stat.appendChild(bar);
        stat.appendChild(el("span", "stat-text", st.done + "/" + qs.length + " 题 · " + pct + "% · 答对 " + st.right));
      });
    });
    app.appendChild(grid);

    var foot = el("p", "muted small-text footer-links");
    var a2 = el("a", null, "本地数据"); a2.href = "#/data";
    foot.appendChild(a2);
    app.appendChild(foot);
    renderLikeBar(app);
    S.logVisit("home", "");
  }

  /* ---------- 难度筛选行（复用） ---------- */
  function renderDiffRow(onChange) {
    var row = el("div", "diff-row");
    row.appendChild(el("span", "diff-label", "难度："));
    var settings = S.getSettings();
    ALL_DIFFS.concat(["all"]).forEach(function (d) {
      var chip = el("button", "diff-chip" + (settings.diffFilter === d ? " active" : ""),
        d === "all" ? "全部" : d);
      chip.addEventListener("click", function () {
        settings.diffFilter = d;
        S.saveSettings();
        row.querySelectorAll(".diff-chip").forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        onChange(d);
      });
      row.appendChild(chip);
    });
    return row;
  }

  /* ---------- 卷介绍页 ---------- */
  function renderVol(nodeId) {
    var meta = volMeta(nodeId);
    if (!meta) { location.hash = "#/"; return; }
    S.logVisit("enter-vol", nodeId);
    app.innerHTML = "";
    var back = el("a", "back-link", "← 返回首页"); back.href = "#/";
    app.appendChild(back);

    var card = el("div", "card");
    card.appendChild(el("h1", null, meta.name));
    card.appendChild(el("p", "sub", meta.desc));
    var info = el("div", "node-info");
    card.appendChild(info);

    var diffRow = renderDiffRow(function () { refresh(); });
    card.appendChild(diffRow);

    var actions = el("div", "mode-actions");
    var startBtn = el("button", "primary", "加载中…");
    startBtn.disabled = true;
    actions.appendChild(startBtn);
    var pos = S.getPos(nodeId);
    if (pos > 0) {
      var resetBtn = el("button", "secondary", "从头开始");
      resetBtn.addEventListener("click", function () {
        S.resetNodePos(nodeId);
        location.reload();
      });
      actions.appendChild(resetBtn);
    }
    card.appendChild(actions);
    app.appendChild(card);

    function refresh() {
      Q.loadBank(nodeId, function (qs) {
        var diff = S.getSettings().diffFilter;
        var list = filterByDiff(qs, diff);
        var st = S.nodeStats(nodeId, list.length);
        var startPos = Math.min(S.getPos(nodeId), list.length);
        info.innerHTML = "";
        info.appendChild(el("p", null, "题量：" + list.length + " 题" +
          (diff !== "all" ? "（" + diff + "难度）" : "")));
        info.appendChild(el("p", null, "已做：" + st.done + " 题 · 答对 " + st.right + " 题"));
        var wrongN = (S.wrongByNode()[nodeId] || []).length;
        if (wrongN) info.appendChild(el("p", "wrong-hint", "本卷错题：" + wrongN + " 道"));
        var markN = (S.markedByNode()[nodeId] || []).length;
        if (markN) info.appendChild(el("p", "mark-hint", "本卷标记：" + markN + " 道"));
        startBtn.disabled = !list.length;
        startBtn.textContent = !list.length ? "暂无题目"
          : (startPos > 0 && startPos < list.length) ? "从第 " + (startPos + 1) + " 题继续"
          : (startPos >= list.length ? "重新刷一遍" : "开始答题");
      });
    }
    refresh();
    startBtn.addEventListener("click", function () { location.hash = "#/quiz/" + nodeId; });
  }

  /* ---------- 混合练习 ---------- */
  function renderMix() {
    app.innerHTML = "";
    var back = el("a", "back-link", "← 返回首页"); back.href = "#/";
    app.appendChild(back);
    app.appendChild(el("h1", null, "混合练习"));
    app.appendChild(el("p", "sub", "从两卷随机抽题组卷，答对 3 秒后自动进入下一题；不计入单卷进度。"));

    var card = el("div", "card");
    var info = el("div", "node-info");
    info.appendChild(el("p", "muted", "题库加载中…"));
    card.appendChild(info);
    card.appendChild(renderDiffRow(function () { refresh(); }));
    var actions = el("div", "mode-actions");
    card.appendChild(actions);
    app.appendChild(card);

    function refresh() {
      var diff = S.getSettings().diffFilter;
      var pools = VOLUMES.map(function (v) {
        return filterByDiff(Q.getBank(v.id), diff);
      });
      var total = pools.reduce(function (a, b) { return a + b.length; }, 0);
      var a = pools[0].length, b = pools[1].length;
      info.innerHTML = "";
      info.appendChild(el("p", null, "AI 通识卷 " + a + " 题 · 咨询顾问 AI " + b + " 题 · 合计 " + total + " 题" +
        (diff !== "all" ? "（" + diff + "难度）" : "")));
      actions.innerHTML = "";
      if (!total) {
        info.appendChild(el("p", "bank-missing", "当前筛选条件下暂无题目。"));
        return;
      }
      [20, 30, 50].forEach(function (n) {
        var btn = el("button", "primary", "抽 " + Math.min(n, total) + " 题");
        btn.addEventListener("click", function () {
          startMix(n);
        });
        actions.appendChild(btn);
      });
    }

    function startMix(n) {
      var diff = S.getSettings().diffFilter;
      var p1 = filterByDiff(Q.getBank("C27"), diff);
      var p2 = filterByDiff(Q.getBank("C29"), diff);
      var total = p1.length + p2.length;
      n = Math.min(n, total);
      var n1 = Math.min(p1.length, Math.round(n * p1.length / total));
      var list = Q.shuffle(Q.shuffle(p1).slice(0, n1).concat(Q.shuffle(p2).slice(0, n - n1)));
      session = {
        nodeId: null, list: list, index: 0, fromWrong: false,
        correctCount: 0, answeredCount: 0, mixed: true,
        startedAt: Date.now(), title: "混合练习"
      };
      S.logVisit("start-mix", String(n));
      renderQuestion();
    }
    refresh();
  }

  /* ---------- 答题会话 ---------- */
  function startQuiz(nodeId, opts) {
    clearAutoTimer();
    Q.loadBank(nodeId, function (qs) {
      if (!qs || !qs.length) { location.hash = "#/vol/" + nodeId; return; }
      var diff = S.getSettings().diffFilter;
      var list = filterByDiff(qs, diff);
      var startPos = opts.fromWrong ? 0 : Math.min(S.getPos(nodeId), list.length);
      session = {
        nodeId: nodeId,
        list: list,
        index: startPos,
        fromWrong: !!opts.fromWrong,
        correctCount: 0,
        answeredCount: 0,
        startedAt: Date.now(),
        title: volMeta(nodeId).name
      };
      S.logVisit(opts.fromWrong ? "start-wrong-quiz" : "start-quiz", nodeId);
      renderQuestion();
    });
  }

  function startWrongAll() {
    clearAutoTimer();
    var ids = S.wrongIds();
    var byNode = {};
    ids.forEach(function (qid) {
      var w = S.getWrong(qid);
      if (w) (byNode[w.node] = byNode[w.node] || []).push(qid);
    });
    var nodeIds = Object.keys(byNode);
    if (!nodeIds.length) { location.hash = "#/wrong"; return; }
    var collected = [];
    var pending = nodeIds.length;
    nodeIds.forEach(function (nid) {
      Q.loadBank(nid, function (qs) {
        var byId = {};
        (qs || []).forEach(function (q) { byId[q.id] = q; });
        byNode[nid].forEach(function (qid) { if (byId[qid]) collected.push(byId[qid]); });
        if (--pending === 0) {
          session = {
            nodeId: null, list: Q.shuffle(collected), index: 0, fromWrong: true,
            correctCount: 0, answeredCount: 0, startedAt: Date.now(), title: "全部错题重做"
          };
          S.logVisit("start-wrong-quiz", "all");
          renderQuestion();
        }
      });
    });
  }

  function nextQuestion() {
    clearAutoTimer();
    if (!session) return;
    session.index++;
    renderQuestion();
  }

  function renderQuestion() {
    clearAutoTimer();
    if (!session) { location.hash = "#/"; return; }
    if (session.index >= session.list.length) return renderSessionDone();

    app.innerHTML = "";
    var q = session.list[session.index];

    if (!session.fromWrong && session.nodeId) S.recordPos(session.nodeId, session.index);

    var back = el("a", "back-link", "← 退出本次答题");
    back.href = session.nodeId ? "#/vol/" + session.nodeId : "#/wrong";
    app.appendChild(back);
    app.appendChild(el("p", "progress-line", "第 " + (session.index + 1) + " / " + session.list.length + " 题" +
      (session.fromWrong ? "（错题重做）" : "") + (session.mixed ? "（混合练习）" : "")));

    var card = el("div", "card");
    var tagRow = el("div", "tag-row");
    var meta = volMeta(q.node);
    tagRow.appendChild(el("span", "tag", meta ? meta.name : q.node));
    tagRow.appendChild(tierBadge(q.tier));
    var db = diffBadge(q.difficulty);
    if (db) tagRow.appendChild(db);
    if (q.type === "multi") tagRow.appendChild(el("span", "tag multi-tag", "多选"));
    card.appendChild(tagRow);
    card.appendChild(el("h3", "stem", q.stem));

    var optionsBox = el("div", "options");
    var userAnswer = q.type === "multi" ? [] : null;
    var answered = false;
    var isMulti = q.type === "multi";

    Q.optionKeys(q).forEach(function (key) {
      var btn = el("button", "option");
      btn.dataset.key = key;
      btn.appendChild(el("span", "opt-key", key));
      btn.appendChild(el("span", "opt-text", q.options[key]));
      btn.addEventListener("click", function () {
        if (answered) return;
        if (isMulti) {
          var idx = userAnswer.indexOf(key);
          if (idx >= 0) { userAnswer.splice(idx, 1); btn.classList.remove("picked"); }
          else { userAnswer.push(key); btn.classList.add("picked"); }
          submitBtn.disabled = userAnswer.length === 0;
        } else {
          userAnswer = key;
          submitQuestion();
        }
      });
      optionsBox.appendChild(btn);
    });
    card.appendChild(optionsBox);

    /* 标记区：答前答后都可标记，只有手动取消才移除 */
    var markRow = el("div", "mark-row");
    var markBtn = el("button", "secondary small mark-btn");
    var markChips = el("div", "mark-chips hidden");
    var customWrap = el("div", "mark-custom hidden");
    var customInput = el("input");
    customInput.type = "text";
    customInput.placeholder = "自定义标记原因（20 字内）";
    customInput.maxLength = 20;
    var customOk = el("button", "primary small", "确定");
    customWrap.appendChild(customInput);
    customWrap.appendChild(customOk);

    function refreshMark() {
      var m = S.getMark(q.id);
      if (m) {
        markBtn.textContent = "⚑ 已标记：" + m.reason + "（点击修改）";
        markBtn.className = "secondary small mark-btn marked";
      } else {
        markBtn.textContent = "⚑ 标记本题";
        markBtn.className = "secondary small mark-btn";
      }
    }
    function showChips() {
      markChips.innerHTML = "";
      MARK_REASONS.forEach(function (r) {
        var c = el("button", "diff-chip", r);
        c.addEventListener("click", function () {
          S.addMark(q.id, q.node, r);
          refreshMark();
          markChips.classList.add("hidden");
          customWrap.classList.add("hidden");
          toast("已标记：" + r);
        });
        markChips.appendChild(c);
      });
      var cc = el("button", "diff-chip", "自定义…");
      cc.addEventListener("click", function () {
        customWrap.classList.remove("hidden");
        customInput.focus();
      });
      markChips.appendChild(cc);
      var cur = S.getMark(q.id);
      if (cur) {
        var rm = el("button", "diff-chip mark-remove", "取消标记");
        rm.addEventListener("click", function () {
          S.removeMark(q.id);
          refreshMark();
          markChips.classList.add("hidden");
          customWrap.classList.add("hidden");
          toast("已取消标记");
        });
        markChips.appendChild(rm);
      }
      markChips.classList.remove("hidden");
    }
    markBtn.addEventListener("click", function () {
      if (markChips.classList.contains("hidden")) showChips();
      else { markChips.classList.add("hidden"); customWrap.classList.add("hidden"); }
    });
    customOk.addEventListener("click", function () {
      var v = customInput.value.trim();
      if (!v) { toast("请输入标记原因"); return; }
      S.addMark(q.id, q.node, v);
      refreshMark();
      markChips.classList.add("hidden");
      customWrap.classList.add("hidden");
      toast("已标记：" + v);
    });
    refreshMark();
    markRow.appendChild(markBtn);
    markRow.appendChild(markChips);
    markRow.appendChild(customWrap);
    card.appendChild(markRow);

    var submitBtn = null;
    if (isMulti) {
      submitBtn = el("button", "primary", "提交答案");
      submitBtn.disabled = true;
      submitBtn.addEventListener("click", submitQuestion);
      card.appendChild(submitBtn);
    }

    var nav = el("div", "nav-row");
    var nextBtn = el("button", "primary", session.index === session.list.length - 1 ? "完成" : "下一题");
    nextBtn.disabled = true;
    nextBtn.addEventListener("click", nextQuestion);
    nav.appendChild(nextBtn);
    card.appendChild(nav);
    app.appendChild(card);

    function submitQuestion() {
      if (answered) return;
      answered = true;
      var correct = Q.grade(q, userAnswer).correct === true;

      var btns = optionsBox.querySelectorAll(".option");
      for (var i = 0; i < btns.length; i++) {
        var k = btns[i].dataset.key;
        var isAns = isMulti ? q.answer.indexOf(k) >= 0 : k === q.answer;
        if (isAns) btns[i].classList.add("right");
        else if (isMulti ? userAnswer.indexOf(k) >= 0 : k === userAnswer) btns[i].classList.add("wrong");
        btns[i].disabled = true;
      }

      if (session.nodeId) S.recordAnswer(q.id, q.node, correct, userAnswer);
      if (correct) {
        var removed = S.recordRight(q.id);
        session.correctCount++;
        if (removed) toast("连对 2 次，已移出错题本");
      } else {
        S.addWrong(q.id, q.node, userAnswer);
      }
      session.answeredCount++;

      renderExplain(correct);
      if (submitBtn) submitBtn.disabled = true;

      if (correct) {
        // 改进点：答对后 3 秒倒计时，自动进入下一题
        startAutoAdvance(nextQuestion);
      } else {
        // 答错停留，手动点击进入下一题
        nextBtn.disabled = false;
        nextBtn.focus();
      }
    }

    function renderExplain(correct) {
      var box = el("div", "explain-box");
      var head = el("h4", correct ? "✓ 回答正确" : "✗ 回答错误");
      head.className = correct ? "explain-head ok" : "explain-head bad";
      box.appendChild(head);
      if (!correct) {
        var ansLine = isMulti ? "正确答案：" + q.answer.join("") : "正确答案：" + q.answer;
        box.appendChild(el("p", "answer-line", ansLine));
      }
      box.appendChild(el("p", "explain-p", q.explain));
      if (!correct) {
        if (q.whyWrong && Object.keys(q.whyWrong).length) {
          box.appendChild(el("h4", null, "为什么错了"));
          Object.keys(q.whyWrong).forEach(function (k) {
            var line = el("p", "why-wrong-p");
            line.appendChild(el("strong", "why-key", k + ". "));
            line.appendChild(document.createTextNode(q.whyWrong[k]));
            box.appendChild(line);
          });
        } else {
          box.appendChild(el("p", "why-wrong-p", "请对照上方解析，辨析各选项与正确知识点的差异。"));
        }
      }
      if (q.source) box.appendChild(el("p", "source-line", "出处：" + q.source));
      card.insertBefore(box, nav);
    }
  }

  /* ---------- 完成页 ---------- */
  function renderSessionDone() {
    clearAutoTimer();
    app.innerHTML = "";
    var card = el("div", "card done-card");
    card.appendChild(el("h2", null, "本轮完成"));
    var acc = session.answeredCount ? Math.round(session.correctCount / session.answeredCount * 100) : 0;

    var stats = el("div", "done-stats");
    [["作答", session.answeredCount], ["答对", session.correctCount], ["正确率", acc + "%"],
     ["用时", fmtDuration(Date.now() - session.startedAt)]].forEach(function (p) {
      var d = el("div");
      d.appendChild(el("strong", null, p[1]));
      d.appendChild(el("span", null, p[0]));
      stats.appendChild(d);
    });
    card.appendChild(stats);

    if (!session.fromWrong && session.nodeId) {
      S.recordPos(session.nodeId, session.list.length);
      var again = el("button", "primary", "重刷本卷");
      again.addEventListener("click", function () {
        S.resetNodePos(session.nodeId);
        location.hash = "#/quiz/" + session.nodeId;
      });
      card.appendChild(again);
    } else if (session.mixed) {
      var again2 = el("button", "primary", "再来一组");
      again2.addEventListener("click", function () { location.hash = "#/mix"; });
      card.appendChild(again2);
    }
    var home = el("button", "secondary", "返回首页");
    home.addEventListener("click", function () { location.hash = "#/"; });
    card.appendChild(home);
    app.appendChild(card);
    session = null;
  }

  /* ---------- 错题清单 ---------- */
  function renderWrong() {
    app.innerHTML = "";
    var back = el("a", "back-link", "← 返回首页"); back.href = "#/";
    app.appendChild(back);
    app.appendChild(el("h1", null, "错题清单"));
    var byNode = S.wrongByNode();
    var total = S.wrongCount();
    app.appendChild(el("p", "sub", total === 0 ? "暂无错题。答错的题会自动进入这里，连续答对 2 次自动移出。" :
      "共 " + total + " 道错题 · 连续答对 2 次自动移出。答对时同样会在 3 秒后自动进入下一题。"));

    if (total > 0) {
      var redoAll = el("button", "primary", "错题重做（全部 " + total + " 题）");
      redoAll.addEventListener("click", function () { location.hash = "#/wrongquiz"; });
      app.appendChild(redoAll);
    }

    Object.keys(byNode).sort().forEach(function (nid) {
      var meta = volMeta(nid);
      var sec = el("div", "card");
      var head = el("div", "wrong-node-head");
      head.appendChild(el("h3", null, meta ? meta.name : nid));
      var redoBtn = el("button", "secondary small", "重做本卷错题");
      redoBtn.addEventListener("click", function () { location.hash = "#/wrongquiz/" + nid; });
      head.appendChild(redoBtn);
      sec.appendChild(head);
      byNode[nid].forEach(function (qid) {
        var w = S.getWrong(qid);
        var row = el("div", "wrong-row");
        row.appendChild(el("span", "wrong-qid", qid));
        row.appendChild(el("span", "wrong-info", "错 " + w.count + " 次 · 最近 " + fmtTime(w.lastWrongAt) +
          (w.streak ? " · 已连对 " + w.streak + "/2" : "")));
        var rm = el("button", "danger small", "移除");
        rm.addEventListener("click", function () {
          S.removeWrong(qid);
          renderWrong();
        });
        row.appendChild(rm);
        sec.appendChild(row);
      });
      app.appendChild(sec);
    });
  }

  /* ---------- 标记清单 ---------- */
  function findQuestion(qid) {
    var parts = (qid || "").split("-");
    var bank = Q.getBank(parts[0]);
    if (!bank) return null;
    for (var i = 0; i < bank.length; i++) if (bank[i].id === qid) return bank[i];
    return null;
  }

  function renderMarked() {
    app.innerHTML = "";
    var back = el("a", "back-link", "← 返回首页"); back.href = "#/";
    app.appendChild(back);
    app.appendChild(el("h1", null, "标记清单"));
    var byNode = S.markedByNode();
    var total = S.markedCount();
    app.appendChild(el("p", "sub", total === 0
      ? "暂无标记。答题时点「标记本题」可加入这里，只有手动取消标记才会移除。"
      : "共 " + total + " 道标记题 · 答对答错都不会自动移除，需手动取消标记。点题目可展开查看详情。"));

    Object.keys(byNode).sort().forEach(function (nid) {
      var meta = volMeta(nid);
      var sec = el("div", "card");
      var head = el("div", "wrong-node-head");
      head.appendChild(el("h3", null, meta ? meta.name : nid));
      sec.appendChild(head);
      byNode[nid].forEach(function (qid) {
        var m = S.getMark(qid);
        var q = findQuestion(qid);
        var row = el("div", "marked-row");
        var main = el("div", "marked-main");

        var toggle = el("button", "marked-toggle");
        toggle.appendChild(el("strong", "marked-qid", qid));
        var reason = el("span", "mark-reason", m.reason);
        toggle.appendChild(reason);
        toggle.appendChild(el("span", "marked-time", fmtTime(m.at)));
        main.appendChild(toggle);

        var preview = el("p", "marked-stem", q ? q.stem : "（未在题库中找到该题）");
        main.appendChild(preview);

        var detail = el("div", "marked-detail hidden");
        if (q) {
          detail.appendChild(el("p", "explain-p", q.stem));
          Q.optionKeys(q).forEach(function (k) {
            var ans = q.type === "multi" ? (q.answer || []).indexOf(k) >= 0 : k === q.answer;
            detail.appendChild(el("p", ans ? "marked-opt right" : "marked-opt",
              (ans ? "✓ " : "") + k + ". " + q.options[k]));
          });
          var aline = q.type === "multi" ? "正确答案：" + q.answer.join("") : "正确答案：" + q.answer;
          detail.appendChild(el("p", "answer-line", aline));
          if (q.explain) detail.appendChild(el("p", "explain-p", q.explain));
          if (q.source) detail.appendChild(el("p", "source-line", "出处：" + q.source));
        }
        main.appendChild(detail);

        toggle.addEventListener("click", function () {
          detail.classList.toggle("hidden");
        });

        row.appendChild(main);
        var rm = el("button", "danger small", "取消标记");
        rm.addEventListener("click", function () {
          S.removeMark(qid);
          renderMarked();
        });
        row.appendChild(rm);
        sec.appendChild(row);
      });
      app.appendChild(sec);
    });
  }

  /* ---------- 数据页 ---------- */
  function renderData() {
    app.innerHTML = "";
    var back = el("a", "back-link", "← 返回首页"); back.href = "#/";
    app.appendChild(back);
    app.appendChild(el("h1", null, "本地数据"));

    var answeredN = 0;
    try {
      var p = S.exportAll().progress;
      answeredN = Object.keys(p.answered || {}).length;
    } catch (e) { /* ignore */ }

    var card = el("div", "card");
    card.appendChild(el("p", null, "作答记录：" + answeredN + " 条"));
    card.appendChild(el("p", null, "错题本：" + S.wrongCount() + " 道"));
    card.appendChild(el("p", null, "标记题：" + S.markedCount() + " 道"));
    card.appendChild(el("p", null, "访问记录：" + S.getVisits().length + " 条"));
    card.appendChild(el("p", null, "存储占用：约 " + Math.round(S.usageBytes() / 1024) + " KB（限额约 5MB）"));
    card.appendChild(el("p", "muted small-text", "以上数据仅保存在本机浏览器 localStorage 中，不会上传。换浏览器或清除缓存前请先导出备份。"));
    app.appendChild(card);

    var act = el("div", "card");
    var exportBtn = el("button", "secondary", "导出备份（JSON）");
    exportBtn.addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(S.exportAll(), null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "aiexam-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
    });
    act.appendChild(exportBtn);

    var importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".json";
    importInput.style.display = "none";
    importInput.addEventListener("change", function () {
      var f = importInput.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          S.importAll(JSON.parse(r.result));
          toast("导入成功");
          renderData();
        } catch (e) { toast("导入失败：文件格式不正确"); }
      };
      r.readAsText(f);
    });
    var importBtn = el("button", "secondary", "导入备份");
    importBtn.addEventListener("click", function () { importInput.click(); });
    act.appendChild(importBtn);
    act.appendChild(importInput);

    var clearBtn = el("button", "danger", "清除本地数据");
    var armed = false, armTimer = null;
    clearBtn.addEventListener("click", function () {
      if (!armed) {
        armed = true;
        clearBtn.textContent = "⚠ 再点一次确认清除（全部进度/错题/记录）";
        armTimer = setTimeout(function () {
          armed = false;
          clearBtn.textContent = "清除本地数据";
        }, 4000);
      } else {
        clearTimeout(armTimer);
        S.clearAll();
        toast("已清除全部本地数据");
        renderData();
      }
    });
    act.appendChild(clearBtn);
    app.appendChild(act);

    var vc = el("div", "card");
    vc.appendChild(el("h3", null, "最近学习轨迹"));
    var visits = S.getVisits();
    if (!visits.length) vc.appendChild(el("p", "muted", "暂无记录"));
    visits.slice(0, 30).forEach(function (v) {
      var label = {
        "home": "打开首页", "enter-vol": "进入试卷", "start-quiz": "开始答题",
        "start-wrong-quiz": "错题重做", "start-mix": "混合练习"
      }[v.action] || v.action;
      var meta = v.detail ? volMeta(v.detail) : null;
      vc.appendChild(el("p", "visit-row", fmtTime(v.at) + " · " + label + (meta ? "：" + meta.name : "")));
    });
    app.appendChild(vc);
  }

  route();
})();
