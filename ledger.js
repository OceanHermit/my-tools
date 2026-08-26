/* Claudeツール開発台帳 — 静的ホスティング版
 *
 * データの正本はリポジトリの tools.json。
 * ページ上での編集は localStorage に保存され、その端末でのみ有効。
 * 正本に反映するには「JSONをコピー」で書き出したものをリポジトリへ戻す。
 */
(function () {
  "use strict";

  var DATA_URL = "./tools.json";
  var LS_KEY = "tool-ledger-v1";

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
    if (/^\.{0,2}\//.test(v) && !/^\/\//.test(v)) return v;
    return "";
  }

  var state = { tools: [] };
  var baseline = { tools: [] };
  var isDraft = false;
  var filter = "all";

  /* ---------- shell ---------- */
  var root = document.createElement("div");
  root.className = "wrap";
  root.innerHTML =
    '<header class="masthead">' +
      '<div class="eyebrow">開発台帳 / Tool Ledger</div>' +
      '<div class="title-row">' +
        '<div>' +
          '<h1>Claudeツール開発台帳</h1>' +
          '<p class="lede">Claudeと一緒に作っているツールの現在地。公開済みのものはカードからそのまま開けます。</p>' +
        '</div>' +
        '<button class="btn btn-primary" id="add-btn">＋ ツールを追加</button>' +
      '</div>' +
      '<div class="tally" id="tally"></div>' +
    '</header>' +
    '<div class="draft" id="draft">' +
      '<span class="grow" id="draft-msg">この端末だけのローカル編集を表示しています。</span>' +
      '<button class="btn" id="copy-btn">JSONをコピー</button>' +
      '<button class="btn btn-danger" id="reset-btn">リポジトリ版に戻す</button>' +
    '</div>' +
    '<main class="grid" id="grid"></main>' +
    '<p class="meta" id="foot"></p>';
  document.body.appendChild(root);

  var savebar = document.createElement("div");
  savebar.className = "savebar";
  document.body.appendChild(savebar);

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
          '<span class="hint">入力するとカードに「開く」ボタンが出ます。このサイト内なら <code>./ツール名/</code> の形で。</span></div>' +
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

  /* ---------- toast ---------- */
  var barTimer = null;
  function say(msg, tone) {
    savebar.textContent = msg;
    savebar.dataset.tone = tone || "";
    savebar.dataset.show = "1";
    if (barTimer) clearTimeout(barTimer);
    barTimer = setTimeout(function () { savebar.dataset.show = "0"; }, tone === "err" ? 6000 : 2600);
  }

  /* ---------- render ---------- */
  function counts() {
    var c = { all: state.tools.length };
    STATUSES.forEach(function (s) { c[s.key] = 0; });
    state.tools.forEach(function (t) { if (c[t.status] != null) c[t.status]++; });
    return c;
  }

  function renderTally() {
    var c = counts();
    var html = '<button class="chip" data-f="all" aria-pressed="' + (filter === "all") + '">' +
      '<span class="dot" style="--d:var(--accent)"></span>すべて<span class="n">' + c.all + '</span></button>';
    STATUSES.forEach(function (s) {
      html += '<button class="chip" data-f="' + s.key + '" aria-pressed="' + (filter === s.key) + '">' +
        '<span class="dot" style="--d:var(' + s.varName + ')"></span>' + s.label +
        '<span class="n">' + c[s.key] + '</span></button>';
    });
    var el = document.getElementById("tally");
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

    var h = '<article class="card' + (tu ? " has-url" : "") + '" style="--c:var(' + s.varName + ')">' +
      '<div class="card-head"><h2>' + esc(t.name) + '</h2>' +
      '<span class="pill">' + esc(s.label) + '</span></div>';
    if (String(t.summary || "").trim()) h += '<p class="summary">' + esc(t.summary) + '</p>';
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

  function render() {
    renderTally();
    document.getElementById("draft").dataset.show = isDraft ? "1" : "0";

    var list = state.tools.slice().sort(function (a, b) {
      var d = (ORDER[a.status] == null ? 9 : ORDER[a.status]) - (ORDER[b.status] == null ? 9 : ORDER[b.status]);
      if (d) return d;
      return String(b.updated || "").localeCompare(String(a.updated || ""));
    });
    if (filter !== "all") list = list.filter(function (t) { return t.status === filter; });

    var grid = document.getElementById("grid");
    if (!list.length) {
      grid.className = "";
      grid.innerHTML = '<p class="empty">' +
        (state.tools.length ? "このステータスのツールはまだありません。" : "まだ何も登録されていません。「＋ ツールを追加」から始めてください。") +
        "</p>";
    } else {
      grid.className = "grid";
      grid.innerHTML = list.map(cardHtml).join("");
      Array.prototype.forEach.call(grid.querySelectorAll("[data-edit]"), function (b) {
        b.addEventListener("click", function () { openEditor(b.dataset.edit); });
      });
    }

    var latest = state.tools.reduce(function (m, t) {
      return String(t.updated || "") > m ? String(t.updated) : m;
    }, "");
    document.getElementById("foot").textContent =
      state.tools.length + " 件 / 最終更新 " + (latest || "—");
  }

  /* ---------- editor ---------- */
  var editingId = null;

  function openEditor(id) {
    var t = null;
    for (var i = 0; i < state.tools.length; i++) if (state.tools[i].id === id) t = state.tools[i];
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
    if (!window.confirm("このツールを台帳から削除します。よろしいですか？")) return;
    state.tools = state.tools.filter(function (t) { return t.id !== editingId; });
    dlg.close();
    persist();
  });

  dlg.querySelector("#edit-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = dlg.querySelector("#f-name").value.trim();
    if (!name) return;
    var lines = function (v) {
      return v.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
    };
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

  /* ---------- persistence: localStorage ---------- */
  function serialize() {
    return JSON.stringify({ updated: today(), tools: state.tools }, null, 2);
  }

  function persist() {
    try {
      localStorage.setItem(LS_KEY, serialize());
      isDraft = true;
      render();
      say("この端末に保存しました");
    } catch (e) {
      render();
      say("保存できませんでした（ブラウザの保存領域が使えません）", "err");
    }
  }

  document.getElementById("add-btn").addEventListener("click", function () { openEditor(null); });

  document.getElementById("copy-btn").addEventListener("click", function () {
    var text = serialize();
    var done = function () { say("JSONをコピーしました"); };
    var fail = function () {
      window.prompt("下の内容をコピーして tools.json に貼り付けてください", text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      fail();
    }
  });

  document.getElementById("reset-btn").addEventListener("click", function () {
    if (!window.confirm("この端末のローカル編集を破棄して、リポジトリの内容に戻します。よろしいですか？")) return;
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* 保存領域が使えない場合は何もしない */ }
    state = { tools: baseline.tools.slice() };
    isDraft = false;
    render();
    say("リポジトリ版に戻しました");
  });

  /* ---------- boot ---------- */
  function adopt(data) {
    if (data && Array.isArray(data.tools)) return { tools: data.tools };
    return { tools: [] };
  }

  fetch(DATA_URL, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) { baseline = adopt(data); })
    .catch(function () { baseline = { tools: [] }; })
    .then(function () {
      var local = null;
      try { local = localStorage.getItem(LS_KEY); } catch (e) { /* プライベートモード等 */ }
      if (local) {
        try {
          state = adopt(JSON.parse(local));
          isDraft = true;
        } catch (e) {
          state = { tools: baseline.tools.slice() };
        }
      } else {
        state = { tools: baseline.tools.slice() };
      }
      if (!baseline.tools.length && !state.tools.length) {
        say("台帳データを読み込めませんでした", "err");
      }
      render();
    });
})();
