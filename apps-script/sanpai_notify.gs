/**
 * 会合マトリックス【キズナ地区】— 参詣状況の自動通知
 *
 * 赤（先生のご縁）の行事がある日の 12:05 に、その行事の
 * 「参詣予定」「参詣」の入力状況をメール／LINE で通知します。
 *
 * matrix_from_calendar.gs と同じ Apps Script プロジェクトに置く前提のため、
 * 識別子はすべて sanpai / SANPAI_ で始めて名前の衝突を避けています。
 *
 * 使い方は同フォルダの README.md を参照。
 */

// ===== 設定 =====================================================
const SANPAI_SPREADSHEET_ID = '1Uz7c7MKqXxK3AscPqILd4Hgf5QMmBTPfEUuDeSOVz9Y';
const SANPAI_TIME_ZONE = 'Asia/Tokyo';

// 通知する時刻
const SANPAI_NOTIFY_HOUR = 12;
const SANPAI_NOTIFY_MINUTE = 5;

// 前夜〜早朝に走らせる「その日の通知を仕込む」トリガーの時間帯
const SANPAI_PLANNER_HOUR = 1;

// 状況を集計する列の見出し。無い行事は、その行事の全列（参加者など）を集計します。
const SANPAI_STATUS_HEADERS = ['参詣予定', '参詣'];

// 未入力者の氏名を並べる上限（超えた分は「ほか N 名」にまとめます）
const SANPAI_MAX_NAMES = 40;

// 関数名（トリガーの登録・掃除に使うので直書きしません）
const SANPAI_HANDLER_FN = 'sanpaiSendTodayNotice';
const SANPAI_PLANNER_FN = 'sanpaiScheduleToday';

// スクリプトプロパティのキー
//   SANPAI_CHANNEL                  … 'email' / 'line' / 'both'（既定: email）
//   SANPAI_EMAIL_TO                 … 宛先。カンマ区切り。未設定なら自分あて
//   SANPAI_LINE_TOKEN               … LINE Messaging API のチャネルアクセストークン
//   SANPAI_LINE_TO                  … LINE の送信先 ID（userId / groupId / roomId）
//   SANPAI_REQUIRE_SANPAI_COLUMNS   … 'true' にすると「参詣予定／参詣」列を
//                                     持つ行事だけを通知対象にします
// ===============================================================


/* ==============================================================
 *  セットアップ
 * ============================================================== */

/**
 * 通知を有効にします。Apps Script エディタから一度だけ実行してください。
 */
function sanpaiSetup() {
  sanpaiRemoveTriggers();

  ScriptApp.newTrigger(SANPAI_PLANNER_FN)
    .timeBased()
    .everyDays(1)
    .atHour(SANPAI_PLANNER_HOUR)
    .create();

  // 今日ぶんは、まだ通知時刻前ならその場で仕込みます
  const scheduled = sanpaiScheduleToday();

  const msg = '毎日の巡回トリガーを登録しました。\n'
    + (scheduled
        ? `本日は対象の行事があるため、${sanpaiPadZero_(SANPAI_NOTIFY_HOUR)}:${sanpaiPadZero_(SANPAI_NOTIFY_MINUTE)} に通知します。`
        : '本日は通知の予定はありません。');
  sanpaiAlert_(msg);
  console.log(msg);
}


/**
 * 通知を止めます。このスクリプトが作ったトリガーをすべて消します。
 */
function sanpaiRemoveTriggers() {
  let removed = 0;
  for (const t of ScriptApp.getProjectTriggers()) {
    const fn = t.getHandlerFunction();
    if (fn === SANPAI_PLANNER_FN || fn === SANPAI_HANDLER_FN) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  console.log(`トリガーを ${removed} 件削除しました。`);
  return removed;
}


/**
 * 毎日 1 回走り、その日に対象の行事があれば 12:05 の単発トリガーを作ります。
 *
 * 単発トリガーにするのは、Apps Script の「毎日◯時」トリガーが
 * 1 時間の幅を持つためです。単発の at() なら指定時刻ちょうどに近い形で動きます。
 */
function sanpaiScheduleToday() {
  // 前日までに残った単発トリガーを掃除します
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === SANPAI_HANDLER_FN) ScriptApp.deleteTrigger(t);
  }

  const now = new Date();
  const fireAt = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    SANPAI_NOTIFY_HOUR, SANPAI_NOTIFY_MINUTE, 0
  );
  if (fireAt.getTime() <= now.getTime()) {
    console.log('本日の通知時刻を過ぎているため、予約しません。');
    return false;
  }

  const report = sanpaiBuildReport_(now);
  if (!report.events.length) {
    console.log('本日は対象の行事がないため、予約しません。');
    return false;
  }

  ScriptApp.newTrigger(SANPAI_HANDLER_FN).timeBased().at(fireAt).create();
  console.log(`${sanpaiFormat_(fireAt, 'yyyy/MM/dd HH:mm')} に通知を予約しました（${report.events.length} 件）。`);
  return true;
}


/**
 * 単発トリガーから呼ばれる本体。通知を送り、自分のトリガーを片づけます。
 */
function sanpaiSendTodayNotice() {
  try {
    const report = sanpaiBuildReport_(new Date());
    if (!report.events.length) {
      console.log('対象の行事がないため、送信しません。');
      return;
    }
    sanpaiDeliver_(report);
  } finally {
    for (const t of ScriptApp.getProjectTriggers()) {
      if (t.getHandlerFunction() === SANPAI_HANDLER_FN) ScriptApp.deleteTrigger(t);
    }
  }
}


/* ==============================================================
 *  メニュー（任意）
 * ============================================================== */

/**
 * 既存の onOpen から呼んでください。
 *
 *   function onOpen() {
 *     const ui = SpreadsheetApp.getUi();
 *     ui.createMenu('マトリックス作成')
 *       .addItem('カレンダーから表を生成', 'generateMatrixFromCalendar')
 *       .addItem('CSVをダウンロード', 'downloadCalendarCsv')
 *       .addToUi();
 *     sanpaiBuildMenu(ui);          // ← この 1 行を足す
 *   }
 */
function sanpaiBuildMenu(ui) {
  try {
    (ui || SpreadsheetApp.getUi())
      .createMenu('参詣通知')
      .addItem('今日の通知内容を見る', 'sanpaiPreviewToday')
      .addItem('日付を指定して見る', 'sanpaiPreviewForDate')
      .addSeparator()
      .addItem('今すぐ送ってみる（テスト）', 'sanpaiSendTestNow')
      .addSeparator()
      .addItem('通知を有効にする', 'sanpaiSetup')
      .addItem('通知を止める', 'sanpaiRemoveTriggers')
      .addToUi();
  } catch (e) {
    // UI が使えない実行環境では無視します
  }
}


function sanpaiPreviewToday() {
  sanpaiShowPreview_(new Date());
}


function sanpaiPreviewForDate() {
  const ui = SpreadsheetApp.getUi();
  const today = sanpaiFormat_(new Date(), 'yyyy/MM/dd');
  const res = ui.prompt('日付を指定', `yyyy/MM/dd の形で入力してください（例: ${today}）`, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const m = String(res.getResponseText()).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) {
    sanpaiAlert_('日付の形式が正しくありません。例: 2026/09/13');
    return;
  }
  sanpaiShowPreview_(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}


function sanpaiSendTestNow() {
  const report = sanpaiBuildReport_(new Date());
  if (!report.events.length) {
    sanpaiAlert_('本日は赤（先生のご縁）の行事がありません。');
    return;
  }
  sanpaiDeliver_(report);
  sanpaiAlert_('送信しました。');
}


function sanpaiShowPreview_(date) {
  const report = sanpaiBuildReport_(date);
  const body = report.events.length
    ? sanpaiRenderText_(report)
    : `${sanpaiFormat_(date, 'M/d')} に赤（先生のご縁）の行事はありません。`
      + (report.sheetName ? '' : '\n\n※ 対象月のシートが見つかりませんでした。');

  const html = HtmlService
    .createHtmlOutput('<pre style="font-family:sans-serif;font-size:13px;line-height:1.7;white-space:pre-wrap">'
      + sanpaiEscapeHtml_(body) + '</pre>')
    .setWidth(520).setHeight(460);
  try {
    SpreadsheetApp.getUi().showModalDialog(html, '参詣状況');
  } catch (e) {
    console.log(body);
  }
}


/* ==============================================================
 *  集計
 * ============================================================== */

/**
 * 指定日の赤い行事と、その入力状況をまとめます。
 */
function sanpaiBuildReport_(date) {
  const ss = sanpaiSpreadsheet_();
  const sheet = sanpaiFindMonthSheet_(ss, date);
  const empty = { date: date, sheetName: '', url: ss.getUrl(), events: [] };
  if (!sheet) return empty;

  const layout = sanpaiReadLayout_(sheet);
  if (!layout) return { date: date, sheetName: sheet.getName(), url: ss.getUrl(), events: [] };

  const onlySanpai = sanpaiProp_('SANPAI_REQUIRE_SANPAI_COLUMNS', '') === 'true';
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const events = [];
  for (const block of layout.blocks) {
    if (!block.isRed) continue;
    if (block.month !== month || block.day !== day) continue;

    const statusCols = block.columns.filter(c => SANPAI_STATUS_HEADERS.indexOf(c.header) !== -1);
    if (onlySanpai && !statusCols.length) continue;

    const columns = (statusCols.length ? statusCols : block.columns)
      .map(c => sanpaiTallyColumn_(layout, c));

    events.push({
      dateText: block.dateText,
      title: block.title,
      teacher: block.teacher,
      leader: block.leader,
      columns: columns
    });
  }

  return { date: date, sheetName: sheet.getName(), url: ss.getUrl(), events: events };
}


/**
 * シートを読み、行事のかたまり（列ブロック）と名簿を取り出します。
 */
function sanpaiReadLayout_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 2) return null;

  const scanRows = Math.min(20, lastRow);
  const head = sheet.getRange(1, 1, scanRows, lastCol).getDisplayValues();

  // 見出し行（参加者 / 参詣予定 …）を探します
  let labelRow = 0;
  for (let r = 0; r < scanRows && !labelRow; r++) {
    for (const v of head[r]) {
      const s = String(v).trim();
      if (s === '参加者' || s === '参詣予定' || s === '参詣' || s.indexOf('参加/ご縁なし') === 0) {
        labelRow = r + 1;
        break;
      }
    }
  }
  if (labelRow < 5) return null;

  const labels = head[labelRow - 1].map(v => String(v).replace(/\s+/g, ' ').trim());

  // 氏名列・対象列・行事の開始列
  let nameCol = labels.indexOf('氏名') + 1;
  let targetCol = labels.indexOf('対象') + 1;
  if (!nameCol) nameCol = 3;
  if (!targetCol) targetCol = 5;
  const firstCol = targetCol + 1;
  if (firstCol > lastCol) return null;

  const width = lastCol - firstCol + 1;
  const dateRow = labelRow - 4;
  const titleRow = labelRow - 3;
  const teacherRow = labelRow - 2;
  const leaderRow = labelRow - 1;

  const dates = head[dateRow - 1];
  const titles = head[titleRow - 1];
  const teachers = head[teacherRow - 1];
  const leaders = head[leaderRow - 1];
  const backgrounds = sheet.getRange(titleRow, firstCol, 1, width).getBackgrounds()[0];

  // 名簿と入力値
  const dataRow = labelRow + 1;
  const numRows = lastRow - labelRow;
  const layout = {
    sheet: sheet,
    dataRow: dataRow,
    names: numRows > 0 ? sheet.getRange(dataRow, nameCol, numRows, 1).getDisplayValues() : [],
    targets: numRows > 0 ? sheet.getRange(dataRow, targetCol, numRows, 1).getDisplayValues() : [],
    values: numRows > 0 ? sheet.getRange(dataRow, firstCol, numRows, width).getDisplayValues() : [],
    rules: numRows > 0 ? sheet.getRange(dataRow, firstCol, numRows, width).getDataValidations() : [],
    firstCol: firstCol,
    blocks: []
  };

  // 行事ごとの列ブロックを作ります（結合セルは左上だけに値が入ります）
  let block = null;
  for (let i = 0; i < width; i++) {
    const dateText = String(dates[firstCol - 1 + i] || '').trim();
    if (dateText) {
      const md = dateText.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
      block = {
        dateText: dateText,
        title: String(titles[firstCol - 1 + i] || '').replace(/\s*\n\s*/g, ' ').trim(),
        teacher: String(teachers[firstCol - 1 + i] || '').trim(),
        leader: String(leaders[firstCol - 1 + i] || '').trim(),
        month: md ? Number(md[1]) : 0,
        day: md ? Number(md[2]) : 0,
        isRed: sanpaiIsReddish_(backgrounds[i]),
        columns: []
      };
      layout.blocks.push(block);
    }
    if (!block) continue;

    const header = String(labels[firstCol - 1 + i] || '').trim();
    if (SANPAI_STATUS_HEADERS.indexOf(header) !== -1) block.isRed = true;
    block.columns.push({ index: i, header: header || '参加者' });
  }

  return layout;
}


/**
 * 1 列ぶんの入力状況を数えます。
 *
 * 入力対象の行は「入力規則（プルダウン）が入っている行」で判定します。
 * その列にプルダウンが 1 つも無い場合だけ、対象列が空でない行を対象とみなします。
 */
function sanpaiTallyColumn_(layout, column) {
  const i = column.index;
  const rows = layout.values.length;

  let hasRule = false;
  for (let r = 0; r < rows && !hasRule; r++) {
    if (layout.rules[r] && layout.rules[r][i]) hasRule = true;
  }

  const counts = {};
  const order = [];
  const blanks = [];
  let total = 0;

  for (let r = 0; r < rows; r++) {
    const name = String(layout.names[r][0] || '').trim();
    if (!name) continue;

    const isTarget = hasRule
      ? Boolean(layout.rules[r] && layout.rules[r][i])
      : String(layout.targets[r][0] || '').trim() !== '';
    if (!isTarget) continue;

    total++;
    const value = String(layout.values[r][i] || '').trim();
    if (!value) {
      blanks.push(name);
      continue;
    }
    if (counts[value] === undefined) {
      counts[value] = 0;
      order.push(value);
    }
    counts[value]++;
  }

  // 参加 → ご縁なし → ○伝 → その他 の順に並べます
  const preferred = ['参加', 'ご縁なし', '○伝'];
  const sorted = preferred.filter(v => counts[v] !== undefined)
    .concat(order.filter(v => preferred.indexOf(v) === -1));

  return {
    header: column.header,
    total: total,
    filled: total - blanks.length,
    blanks: blanks,
    breakdown: sorted.map(v => ({ value: v, count: counts[v] }))
  };
}


/* ==============================================================
 *  通知の文面と送信
 * ============================================================== */

function sanpaiRenderText_(report) {
  const lines = [];
  lines.push(`【参詣状況】${sanpaiDateLabel_(report.date)} ${sanpaiFormat_(new Date(), 'HH:mm')} 時点`);

  for (const ev of report.events) {
    lines.push('');
    lines.push(`■ ${ev.title || '(行事名なし)'}`);
    lines.push(`　${ev.dateText}`);
    if (ev.teacher) lines.push(`　講師: ${ev.teacher}`);
    if (ev.leader) lines.push(`　任責: ${ev.leader}`);

    for (const col of ev.columns) {
      lines.push('');
      lines.push(`〈${col.header}〉 入力 ${col.filled}/${col.total}`);
      if (col.breakdown.length) {
        lines.push('　' + col.breakdown.map(b => `${b.value} ${b.count}`).join(' / '));
      }
      if (col.blanks.length) {
        lines.push(`　未入力 ${col.blanks.length}名`);
        lines.push('　' + sanpaiJoinNames_(col.blanks));
      } else if (col.total) {
        lines.push('　未入力なし');
      }
    }
  }

  lines.push('');
  lines.push(report.url);
  return lines.join('\n');
}


function sanpaiJoinNames_(names) {
  if (names.length <= SANPAI_MAX_NAMES) return names.join('、');
  return names.slice(0, SANPAI_MAX_NAMES).join('、') + ` ほか${names.length - SANPAI_MAX_NAMES}名`;
}


function sanpaiDeliver_(report) {
  const channel = (sanpaiProp_('SANPAI_CHANNEL', 'email') || 'email').toLowerCase();
  const text = sanpaiRenderText_(report);
  const subject = `【参詣状況】${sanpaiFormat_(report.date, 'M/d')} `
    + report.events.map(e => e.title).join(' / ');

  if (channel === 'email' || channel === 'both') sanpaiSendMail_(subject, text);
  if (channel === 'line' || channel === 'both') sanpaiSendLine_(text);
}


function sanpaiSendMail_(subject, text) {
  const to = sanpaiProp_('SANPAI_EMAIL_TO', '') || Session.getEffectiveUser().getEmail();
  if (!to) {
    console.log('メールの宛先が決まらないため送信しませんでした。');
    return;
  }
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: text,
    htmlBody: '<pre style="font-family:sans-serif;font-size:14px;line-height:1.7;white-space:pre-wrap">'
      + sanpaiEscapeHtml_(text) + '</pre>'
  });
  console.log(`メールを送信しました: ${to}`);
}


function sanpaiSendLine_(text) {
  const token = sanpaiProp_('SANPAI_LINE_TOKEN', '');
  const to = sanpaiProp_('SANPAI_LINE_TO', '');
  if (!token || !to) {
    console.log('LINE のトークンか送信先が未設定のため送信しませんでした。');
    return;
  }
  // LINE の 1 メッセージは 5000 文字までです
  const body = text.length > 4900 ? text.slice(0, 4900) + '\n…（以下省略）' : text;

  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: body }] }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    console.log('LINE に送信しました。');
  } else {
    console.log(`LINE の送信に失敗しました (${code}): ${res.getContentText()}`);
  }
}


/* ==============================================================
 *  小さな部品
 * ============================================================== */

function sanpaiSpreadsheet_() {
  if (SANPAI_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SANPAI_SPREADSHEET_ID);
    } catch (e) {
      // ID が変わっている場合はアクティブなシートに落とします
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}


/**
 * 「令和8年.9月」形式のシートを、指定日の年月から探します。
 * 見つからなければ、月の表記だけが一致するシートを探します。
 */
function sanpaiFindMonthSheet_(ss, date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const reiwa = year - 2018;
  const era = reiwa <= 0 ? `${year}年` : (reiwa === 1 ? '令和元年' : `令和${reiwa}年`);

  const exact = ss.getSheetByName(`${era}.${month}月`);
  if (exact) return exact;

  const prefix = `${era}.${month}月`;
  for (const s of ss.getSheets()) {
    if (s.getName().indexOf(prefix) === 0) return s;
  }
  return null;
}


/**
 * 背景色が「赤系」かどうかを判定します。
 * 生成スクリプトの赤は #F8CECC。黄・紫・青・緑とは確実に区別できます。
 */
function sanpaiIsReddish_(hex) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r - g) >= 25 && (r - b) >= 25;
}


/**
 * 「9/13(日)」の形にします。曜日は実行環境の言語に左右されないよう自前で付けます。
 */
function sanpaiDateLabel_(date) {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}(${dow})`;
}


function sanpaiFormat_(date, pattern) {
  return Utilities.formatDate(date, SANPAI_TIME_ZONE, pattern);
}


function sanpaiProp_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === '') ? fallback : String(v).trim();
}


function sanpaiPadZero_(n) {
  return (n < 10 ? '0' : '') + n;
}


function sanpaiEscapeHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function sanpaiAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    console.log(message);
  }
}
