/* Claudeツール開発台帳 + 返答待ちダッシュボード — 静的ホスティング版
 *
 * データの正本はリポジトリの tools.json / pending.json。
 * ページ上での編集は localStorage に保存され、その端末でのみ有効。
 * 正本に反映するには「JSONをコピー」で書き出したものをリポジトリへ戻す。
 */
(function () {
  "use strict";

  var TOOLS_URL = "./tools.json";
  var PENDING_URL = "./pending.json";
  var LS_KEY = "tool-ledger-v2";
  var LS_KEY_OLD = "tool-ledger-v1";

  var STATUSES = [
    { key: "idea",  label: "構想中",   varName: "--s-idea" },
    { key: "build", label: "開発中",   varName: "--s-build" },
    { key: "test",  label: "テスト中", varName: "--s-test" },
    { key: "live",  label: "運用中",   varName: "--s-live" },
    { key: "hold",  label: "保留",     varName: "--s-hold" }
  ];
  var ORDER = { build: 0, test: 1, idea: 2, live: 3, hold: 4 };

  function statusOf(k) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].key === k) return STATUSES[i];
    return STATUSES[0];
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  /* 保管場所リンク: 絶対 http(s) のみ許可 */
  function safeUrl(u) {
    return /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "";
  }
  /* 公開URL: http(s) に加えて同一サイト内の相対パスも許可（javascript: 等は弾く） */
  function safeToolUrl(u) {
    var v = String(u || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\.{0,2}[/#]/.test(v) && !/^\/\//.test(v)) return v;
    return "";
  }

  var state = { tools: [], pending: [] };
  var baseline = { tools: [], pending: [] };
  var isDraft = false;
  var filter = "all";
  var view = "ledger";      /* "ledger" | "pending" */
  var pendFilter = null;    /* toolId で絞り込み中なら その id */

  /* ---------- shell ---------- */
  var root = document.createElement("div");
  root.className = "wrap";
  root.innerHTML =
    '<header class="masthead">' +
      '<div class="eyebrow">開発台帳 / Tool Ledger</div>' +
      '<div class="title-row">' +
        '<div>' +
          '<h1 id="page-title">Claudeツール開発台帳</h1>' +
          '<p class="lede" id="page-lede"></p>' +
        '</div>' +
        '<button class="btn btn-primary" id="add-btn">＋ 追加</button>' +
      '</div>' +
      '<div class="tabs" role="tablist">' +
        '<button class="tab" role="tab" data-v="ledger">開発台帳<span class="badge" id="badge-tools">0</span></button>' +
        '<button class="tab" role="tab" data-v="pending">返答待ち<span class="badge" id="badge-pend">0</span></button>' +
      '</div>' +
      '<div class="tally" id="tally"></div>' +
    '</header>' +
    '<div class="draft" id="draft">' +
      '<span class="grow" id="draft-msg">この端末だけのローカル編集を表示しています。</span>' +
      '<button class="btn" id="copy-btn">JSONをコピー</button>' +
      '<button class="btn btn-danger" id="reset-btn">リポジトリ版に戻す</button>' +
    '</div>' +
    '<main id="body"></main>' +
    '<p class="meta" id="foot"></p>';
  document.body.appendChild(root);

  var savebar = document.createElement("div");
  savebar.className = "savebar";
  document.body.appendChild(savebar);

  /* ---------- ツール編集ダイアログ ---------- */
  var dlg = document.createElement("dialog");
  dlg.innerHTML =
    '<form method="dialog" class="dlg" id="edit-form">' +
      '<div class="dlg-head"><h3 id="dlg-title">ツールを編集</h3></div>' +
      '<div class="dlg-body">' +
        '<div class="field"><label for="f-name">ツール名</label>' +
          '<input type="text" id="f-name" required maxlength="80"></div>' +
        '<div class="field"><label for="f-summary">概要・目的</label>' +
          '<textarea id="f-summary" maxlength="400" style="min-height:64px"></textarea></div>' +
        '<div class="row2">' +
          '<div class="field"><label for="f-status">ステータス</label>' +
            '<select id="f-status"></select></div>' +
          '<div class="field"><label for="f-progress">進捗</label>' +
            '<div class="range-row"><input type="range" id="f-progress" min="0" max="100" step="5">' +
            '<span class="range-val" id="f-progress-val">0%</span></div></div>' +
        '</div>' +
        '<div class="field"><label for="f-url">公開URL</label>' +
          '<input type="text" id="f-url" placeholder="./ツール名/ または https://...">' +
          '<span class="hint">入力するとカードに「開く」ボタンが出ます。このサイト内なら ./ツール名/ の形で。</span></div>' +
        '<div class="field"><label for="f-next">次にやること・課題</label>' +
          '<textarea id="f-next" placeholder="1行に1つ"></textarea>' +
          '<span class="hint">1行につき1項目。</span></div>' +
        '<div class="field"><label for="f-links">リンク・保管場所</label>' +
          '<textarea id="f-links" placeholder="ラベル | https://..."></textarea>' +
          '<span class="hint">1行に1つ。「ラベル | URL」の形で書くとリンクになります。URLがなければラベルだけでも構いません。</span></div>' +
      '</div>' +
      '<div class="dlg-foot">' +
        '<button type="button" class="btn btn-danger spacer" id="f-delete">削除</button>' +
        '<button type="button" class="btn" id="f-cancel">キャンセル</button>' +
        '<button type="submit" class="btn btn-primary">保存</button>' +
      '</div>' +
    '</form>';
  document.body.appendChild(dlg);

  var selEl = dlg.querySelector("#f-status");
  STATUSES.forEach(function (s) {
    var o = document.createElement("option");
    o.value = s.key; o.textContent = s.label;
    selEl.appendChild(o);
  });

  /* ---------- 返答待ち編集ダイアログ ---------- */
  var pdlg = document.createElement("dialog");
  pdlg.innerHTML =
    '<form method="dialog" class="dlg" id="pend-form">' +
      '<div class="dlg-head"><h3 id="pdlg-title">返答待ちを編集</h3></div>' +
      '<div class="dlg-body">' +
        '<div class="field"><label for="p-task">タスク名</label>' +
          '<input type="text" id="p-task" required maxlength="120"></div>' +
        '<div class="field"><label for="p-situation">状況</label>' +
          '<textarea id="p-situation" maxlength="600"></textarea>' +
          '<span class="hint">なぜ止まっているか、どこまで進んでいるか。</span></div>' +
        '<div class="field"><label for="p-question">答えるべきこと</label>' +
          '<textarea id="p-question" maxlength="600"></textarea>' +
          '<span class="hint">これに答えれば先に進む、という一点を書く。</span></div>' +
        '<div class="field"><label for="p-tool">関連ツール</label>' +
          '<select id="p-tool"></select>' +
          '<span class="hint">選ぶと台帳のカードに「返答待ち」が出ます。</span></div>' +
      '</div>' +
      '<div class="dlg-foot">' +
        '<button type="button" class="btn btn-danger spacer" id="p-delete">削除</button>' +
        '<button type="button" class="btn" id="p-cancel">キャンセル</button>' +
        '<button type="submit" class="btn btn-primary">保存</button>' +
      '</div>' +
    '</form>';
  document.body.appendChild(pdlg);

  /* ---------- toast ---------- */
  var barTimer = null;
  function say(msg, tone) {
    savebar.textContent = msg;
    savebar.dataset.tone = tone || "";
    savebar.dataset.show = "1";
    if (barTimer) clearTimeout(barTimer);
    barTimer = setTimeout(function () { savebar.dataset.show = "0"; }, tone === "err" ? 6000 : 2600);
  }

  function toolById(id) {
    for (var i = 0; i < state.tools.length; i++) if (state.tools[i].id === id) return state.tools[i];
    return null;
  }
  function pendingFor(toolId) {
    return state.pending.filter(function (p) { return p.toolId === toolId; });
  }

  /* ---------- 台帳 ---------- */
  function counts() {
    var c = { all: state.tools.length };
    STATUSES.forEach(function (s) { c[s.key] = 0; });
    state.tools.forEach(function (t) { if (c[t.status] != null) c[t.status]++; });
    return c;
  }

  function renderTally() {
    var el = document.getElementById("tally");
    if (view !== "ledger") { el.innerHTML = ""; return; }
    var c = counts();
    var html = '<button class="chip" data-f="all" aria-pressed="' + (filter === "all") + '">' +
      '<span class="dot" style="--d:var(--accent)"></span>すべて<span class="n">' + c.all + '</span></button>';
    STATUSES.forEach(function (s) {
      html += '<button class="chip" data-f="' + s.key + '" aria-pressed="' + (filter === s.key) + '">' +
        '<span class="dot" style="--d:var(' + s.varName + ')"></span>' + s.label +
        '<span class="n">' + c[s.key] + '</span></button>';
    });
    el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll(".chip"), function (b) {
      b.addEventListener("click", function () { filter = b.dataset.f; render(); });
    });
  }

  function cardHtml(t) {
    var s = statusOf(t.status);
    var pct = Math.max(0, Math.min(100, Number(t.progress) || 0));
    var next = (t.next || []).filter(function (x) { return String(x).trim(); });
    var links = (t.links || []).filter(function (l) { return l && String(l.label).trim(); });
    var tu = safeToolUrl(t.url);
    var waiting = pendingFor(t.id).length;

    var h = '<article class="card' + (tu ? " has-url" : "") + '" style="--c:var(' + s.varName + ')">' +
      '<div class="card-head"><h2>' + esc(t.name) + '</h2>' +
      '<span class="pill">' + esc(s.label) + '</span></div>';
    if (String(t.summary || "").trim()) h += '<p class="summary">' + esc(t.summary) + '</p>';
    if (waiting) {
      h += '<button class="await" data-await="' + esc(t.id) + '">返答待ち ' + waiting + ' 件 &rarr;</button>';
    }
    if (tu) {
      h += '<a class="open" href="' + esc(tu) + '">' +
        '<span>' + esc(t.name) + ' を開く</span><span class="arw">&rarr;</span></a>';
    }
    h += '<div class="bar"><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="bar-num">' + pct + '%</span></div>';
    if (next.length) {
      h += '<div><p class="block-label">次にやること</p><ul class="next">';
      next.forEach(function (n) { h += '<li>' + esc(n) + '</li>'; });
      h += '</ul></div>';
    }
    if (links.length) {
      h += '<div><p class="block-label">保管場所</p><div class="links">';
      links.forEach(function (l) {
        var u = safeUrl(l.url);
        h += u
          ? '<a class="tag" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + '</a>'
          : '<span class="tag">' + esc(l.label) + '</span>';
      });
      h += '</div></div>';
    }
    h += '<div class="card-foot"><span class="stamp">更新 ' + esc(t.updated || "—") + '</span>' +
      '<button class="btn" data-edit="' + esc(t.id) + '">編集</button></div></article>';
    return h;
  }

  function renderLedger(body) {
    var list = state.tools.slice().sort(function (a, b) {
      var d = (ORDER[a.status] == null ? 9 : ORDER[a.status]) - (ORDER[b.status] == null ? 9 : ORDER[b.status]);
      if (d) return d;
      return String(b.updated || "").localeCompare(String(a.updated || ""));
    });
    if (filter !== "all") list = list.filter(function (t) { return t.status === filter; });

    if (!list.length) {
      body.className = "";
      body.innerHTML = '<p class="empty">' +
        (state.tools.length ? "このステータスのツールはまだありません。" : "まだ何も登録されていません。「＋ 追加」から始めてください。") +
        "</p>";
    } else {
      body.className = "grid";
      body.innerHTML = list.map(cardHtml).join("");
      Array.prototype.forEach.call(body.querySelectorAll("[data-edit]"), function (b) {
        b.addEventListener("click", function () { openEditor(b.dataset.edit); });
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-await]"), function (b) {
        b.addEventListener("click", function () { setView("pending", b.dataset.await); });
      });
    }

    var latest = state.tools.reduce(function (m, t) {
      return String(t.updated || "") > m ? String(t.updated) : m;
    }, "");
    document.getElementById("foot").textContent =
      state.tools.length + " 件 / 最終更新 " + (latest || "—");
  }

  /* ---------- 返答待ち ---------- */
  function pendHtml(p) {
    var t = p.toolId ? toolById(p.toolId) : null;
    var h = '<article class="pitem">' +
      '<div class="pitem-head"><h2>' + esc(p.task) + '</h2>' +
      (t ? '<span class="who">' + esc(t.name) + "</span>" : "") + "</div>";
    if (String(p.situation || "").trim()) {
      h += '<div class="pfield"><p class="block-label">状況</p>' +
        '<p class="body">' + esc(p.situation) + "</p></div>";
    }
    if (String(p.question || "").trim()) {
      h += '<div class="pfield ask"><p class="block-label">答えるべきこと</p>' +
        '<p class="body">' + esc(p.question) + "</p></div>";
    }
    h += '<div class="pitem-foot"><span class="stamp">登録 ' + esc(p.created || "—") + "</span>" +
      '<button class="btn" data-pedit="' + esc(p.id) + '">編集</button></div></article>';
    return h;
  }

  function renderPending(body) {
    var list = state.pending.slice();
    if (pendFilter) list = list.filter(function (p) { return p.toolId === pendFilter; });

    if (!list.length) {
      body.className = "";
      body.innerHTML = '<p class="empty">' +
        (state.pending.length
          ? "このツールの返答待ちはありません。"
          : "返答待ちはありません。答えるべきことが出てきたら「＋ 追加」で書き留めてください。") +
        "</p>";
    } else {
      body.className = "pend";
      body.innerHTML = list.map(pendHtml).join("");
      Array.prototype.forEach.call(body.querySelectorAll("[data-pedit]"), function (b) {
        b.addEventListener("click", function () { openPendEditor(b.dataset.pedit); });
      });
    }

    var t = pendFilter ? toolById(pendFilter) : null;
    document.getElementById("foot").textContent = t
      ? list.length + " 件（" + t.name + "で絞り込み中）"
      : state.pending.length + " 件";
  }

  /* ---------- 共通描画 ---------- */
  function setView(v, toolId) {
    view = v === "pending" ? "pending" : "ledger";
    pendFilter = view === "pending" ? (toolId || null) : null;
    try {
      var h = view === "pending" ? "#pending" : "";
      if (location.hash !== h) history.replaceState(null, "", location.pathname + location.search + h);
    } catch (e) { /* history が使えない環境では URL を変えないだけ */ }
    render();
  }

  function render() {
    var isPend = view === "pending";

    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.v === view));
    });
    var bt = document.getElementById("badge-tools");
    bt.textContent = state.tools.length;
    bt.dataset.zero = "1";
    var bp = document.getElementById("badge-pend");
    bp.textContent = state.pending.length;
    bp.dataset.zero = state.pending.length ? "0" : "1";

    document.getElementById("page-title").textContent =
      isPend ? "返答待ちダッシュボード" : "Claudeツール開発台帳";
    document.getElementById("page-lede").textContent = isPend
      ? "Claude側が答えを待っている未決の項目。答えが出たものはその都度消してください。"
      : "Claudeと一緒に作っているツールの現在地。公開済みのものはカードからそのまま開けます。";
    document.getElementById("add-btn").textContent = isPend ? "＋ 返答待ちを追加" : "＋ ツールを追加";

    document.getElementById("draft").dataset.show = isDraft ? "1" : "0";
    renderTally();

    var body = document.getElementById("body");
    if (isPend) renderPending(body); else renderLedger(body);
  }

  /* ---------- ツール編集 ---------- */
  var editingId = null;

  function openEditor(id) {
    var t = toolById(id);
    editingId = t ? id : null;
    document.getElementById("dlg-title").textContent = t ? "ツールを編集" : "ツールを追加";
    dlg.querySelector("#f-name").value = t ? t.name || "" : "";
    dlg.querySelector("#f-summary").value = t ? t.summary || "" : "";
    dlg.querySelector("#f-status").value = t ? t.status || "idea" : "idea";
    dlg.querySelector("#f-url").value = t ? t.url || "" : "";
    var pr = dlg.querySelector("#f-progress");
    pr.value = t ? (Number(t.progress) || 0) : 0;
    dlg.querySelector("#f-progress-val").textContent = pr.value + "%";
    dlg.querySelector("#f-next").value = t ? (t.next || []).join("\n") : "";
    dlg.querySelector("#f-links").value = t
      ? (t.links || []).map(function (l) { return l.url ? l.label + " | " + l.url : l.label; }).join("\n")
      : "";
    dlg.querySelector("#f-delete").style.display = t ? "" : "none";
    dlg.showModal();
    dlg.querySelector("#f-name").focus();
  }

  dlg.querySelector("#f-progress").addEventListener("input", function (e) {
    dlg.querySelector("#f-progress-val").textContent = e.target.value + "%";
  });
  dlg.querySelector("#f-cancel").addEventListener("click", function () { dlg.close(); });

  dlg.querySelector("#f-delete").addEventListener("click", function () {
    if (!editingId) return;
    var n = pendingFor(editingId).length;
    var msg = "このツールを台帳から削除します。よろしいですか？";
    if (n) msg += "\n\n（返答待ち " + n + " 件の関連付けも外れます）";
    if (!window.confirm(msg)) return;
    state.tools = state.tools.filter(function (t) { return t.id !== editingId; });
    state.pending.forEach(function (p) { if (p.toolId === editingId) p.toolId = ""; });
    dlg.close();
    persist();
  });

  function lines(v) {
    return v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
  }

  dlg.querySelector("#edit-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = dlg.querySelector("#f-name").value.trim();
    if (!name) return;
    var payload = {
      name: name,
      summary: dlg.querySelector("#f-summary").value.trim(),
      status: dlg.querySelector("#f-status").value,
      progress: Number(dlg.querySelector("#f-progress").value) || 0,
      url: dlg.querySelector("#f-url").value.trim(),
      next: lines(dlg.querySelector("#f-next").value),
      links: lines(dlg.querySelector("#f-links").value).map(function (l) {
        var i = l.indexOf("|");
        return i === -1
          ? { label: l, url: "" }
          : { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
      }).filter(function (l) { return l.label; }),
      updated: today()
    };
    var found = false;
    state.tools = state.tools.map(function (t) {
      if (t.id !== editingId) return t;
      found = true;
      payload.id = t.id;
      return payload;
    });
    if (!found) {
      payload.id = "t" + Date.now().toString(36);
      state.tools.push(payload);
    }
    dlg.close();
    persist();
  });

  /* ---------- 返答待ち編集 ---------- */
  var pEditingId = null;

  function fillToolSelect(selected) {
    var sel = pdlg.querySelector("#p-tool");
    sel.innerHTML = "";
    var none = document.createElement("option");
    none.value = ""; none.textContent = "（なし）";
    sel.appendChild(none);
    state.tools.slice().sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), "ja");
    }).forEach(function (t) {
      var o = document.createElement("option");
      o.value = t.id; o.textContent = t.name;
      sel.appendChild(o);
    });
    sel.value = selected || "";
  }

  function openPendEditor(id) {
    var p = null;
    for (var i = 0; i < state.pending.length; i++) if (state.pending[i].id === id) p = state.pending[i];
    pEditingId = p ? id : null;
    document.getElementById("pdlg-title").textContent = p ? "返答待ちを編集" : "返答待ちを追加";
    pdlg.querySelector("#p-task").value = p ? p.task || "" : "";
    pdlg.querySelector("#p-situation").value = p ? p.situation || "" : "";
    pdlg.querySelector("#p-question").value = p ? p.question || "" : "";
    fillToolSelect(p ? p.toolId : pendFilter);
    pdlg.querySelector("#p-delete").style.display = p ? "" : "none";
    pdlg.showModal();
    pdlg.querySelector("#p-task").focus();
  }

  pdlg.querySelector("#p-cancel").addEventListener("click", function () { pdlg.close(); });

  pdlg.querySelector("#p-delete").addEventListener("click", function () {
    if (!pEditingId) return;
    if (!window.confirm("この項目を返答待ちから消します。よろしいですか？")) return;
    state.pending = state.pending.filter(function (p) { return p.id !== pEditingId; });
    pdlg.close();
    persist();
  });

  pdlg.querySelector("#pend-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var task = pdlg.querySelector("#p-task").value.trim();
    if (!task) return;
    var payload = {
      task: task,
      situation: pdlg.querySelector("#p-situation").value.trim(),
      question: pdlg.querySelector("#p-question").value.trim(),
      toolId: pdlg.querySelector("#p-tool").value,
      created: today()
    };
    var found = false;
    state.pending = state.pending.map(function (p) {
      if (p.id !== pEditingId) return p;
      found = true;
      payload.id = p.id;
      payload.created = p.created || today();
      return payload;
    });
    if (!found) {
      payload.id = "p" + Date.now().toString(36);
      state.pending.push(payload);
    }
    pdlg.close();
    persist();
  });

  /* ---------- 保存: localStorage ---------- */
  function serializeTools() {
    return JSON.stringify({ updated: today(), tools: state.tools }, null, 2);
  }
  function serializePending() {
    return JSON.stringify({ updated: today(), pending: state.pending }, null, 2);
  }

  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ tools: state.tools, pending: state.pending }));
      isDraft = true;
      render();
      say("この端末に保存しました");
    } catch (e) {
      render();
      say("保存できませんでした（ブラウザの保存領域が使えません）", "err");
    }
  }

  /* ---------- ヘッダ操作 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (b) {
    b.addEventListener("click", function () { setView(b.dataset.v, null); });
  });

  document.getElementById("add-btn").addEventListener("click", function () {
    if (view === "pending") openPendEditor(null); else openEditor(null);
  });

  document.getElementById("copy-btn").addEventListener("click", function () {
    var isPend = view === "pending";
    var text = isPend ? serializePending() : serializeTools();
    var fileName = isPend ? "pending.json" : "tools.json";
    var done = function () { say(fileName + " の内容をコピーしました"); };
    var fail = function () {
      window.prompt("下の内容をコピーして " + fileName + " に貼り付けてください", text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      fail();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    if (!window.confirm("この端末のローカル編集を破棄して、リポジトリの内容に戻します。よろしいですか？")) return;
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_KEY_OLD);
    } catch (e) { /* 保存領域が使えない場合は何もしない */ }
    state = { tools: baseline.tools.slice(), pending: baseline.pending.slice() };
    isDraft = false;
    render();
    say("リポジトリ版に戻しました");
  });

  /* ---------- 起動 ---------- */
  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () { return null; });
  }

  Promise.all([fetchJson(TOOLS_URL), fetchJson(PENDING_URL)]).then(function (res) {
    baseline = {
      tools: res[0] && Array.isArray(res[0].tools) ? res[0].tools : [],
      pending: res[1] && Array.isArray(res[1].pending) ? res[1].pending : []
    };

    var local = null;
    try { local = localStorage.getItem(LS_KEY) || localStorage.getItem(LS_KEY_OLD); } catch (e) { /* プライベートモード等 */ }
    if (local) {
      try {
        var parsed = JSON.parse(local);
        state = {
          tools: Array.isArray(parsed.tools) ? parsed.tools : baseline.tools.slice(),
          /* v1 には pending が無いので、その場合はリポジトリ版を使う */
          pending: Array.isArray(parsed.pending) ? parsed.pending : baseline.pending.slice()
        };
        isDraft = true;
      } catch (e) {
        state = { tools: baseline.tools.slice(), pending: baseline.pending.slice() };
      }
    } else {
      state = { tools: baseline.tools.slice(), pending: baseline.pending.slice() };
    }

    if (!baseline.tools.length && !state.tools.length) {
      say("台帳データを読み込めませんでした", "err");
    }

    view = /(^|#)pending$/.test(location.hash) ? "pending" : "ledger";
    render();
  });

  window.addEventListener("hashchange", function () {
    setView(/(^|#)pending$/.test(location.hash) ? "pending" : "ledger", null);
  });
})();
