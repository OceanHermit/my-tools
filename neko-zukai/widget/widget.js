// NEKO-ZUKAI ウィジェット（小）の中身。Scriptable に貼った短いスクリプトが、毎回ここを読みこんで動かす。
// ここを直せば、貼り直さなくてもウィジェットが新しくなる。
module.exports = async function(TOKEN){
  const KEY = "AIzaSyCxsW8vcezsybApzAd73Pazgsi0zPGDqOE";
  const BASE = "https://oceanhermit.github.io/my-tools/neko-zukai/";
  const DOC = "https://firestore.googleapis.com/v1/projects/neko-zukai/databases/(default)/documents/widgets/" + TOKEN + "?key=" + KEY;

  const C = { bg: new Color("#FFF6E9"), ink: new Color("#5A3E2B"), soft: new Color("#9A7B62"), minus: new Color("#C8553D"), accent: new Color("#E08A3C") };
  const yen = n => (n < 0 ? "−" : "") + "¥" + Math.abs(Math.round(n)).toLocaleString("ja-JP");
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const day = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

  async function load(){
    try{
      const j = await new Request(DOC).loadJSON();
      if(!j.fields) return null;
      const o = {};
      for(const [k, v] of Object.entries(j.fields)) o[k] = v.stringValue ?? Number(v.integerValue ?? v.doubleValue);
      return o;
    }catch(e){ return null; }
  }
  // 絵は一度読んだら端末にとっておく（電波がないときも出せるように）
  async function image(name){
    const fm = FileManager.local(), path = fm.joinPath(fm.cacheDirectory(), "neko-" + name);
    try{ const img = await new Request(BASE + "widget/" + name).loadImage(); fm.writeImage(path, img); return img; }
    catch(e){ return fm.fileExists(path) ? fm.readImage(path) : null; }
  }
  // ネコのレベル。アプリと同じ決まり：今日つかえるお金が、1日ぶんの何日ぶんあるか
  const MIN = [null, null, 2, 7, 10], LOW = -3;
  function levelOf(x, unit){
    if(!(unit > 0)) return 1;
    if(x < LOW * unit) return 0;
    let lv = 1;
    for(let i = 2; i < 5; i++) if(x >= MIN[i] * unit) lv = i;
    return lv;
  }
  function toNext(x, unit, lv){
    if(lv === 0) return Math.ceil(LOW * unit - x);
    if(lv < 4) return Math.ceil(MIN[lv + 1] * unit - x);
    return 0;
  }

  const d = await load();
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(12, 12, 10, 12);
  w.url = BASE + "#add";
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  if(!d){
    const t = w.addText("NEKO-ZUKAI"); t.font = Font.boldRoundedSystemFont(14); t.textColor = C.ink;
    w.addSpacer(6);
    const m = w.addText("読みこめなかったにゃ。電波を確かめてね"); m.font = Font.systemFont(11); m.textColor = C.soft;
  }else{
    const today = ymd(new Date()), over = today > d.end;
    const through = s => s < d.start ? 0 : Math.floor(d.budget * Math.min(d.total, Math.round((day(s) - day(d.start)) / 864e5) + 1) / d.total);
    const share = s => through(s) - through(ymd(new Date(day(s).getTime() - 864e5)));
    // アプリを開いた日はその日の数字で。開いていない日（記録なし）は数えないので、最後の数字に今日の分を足す
    const fl = today === d.updated ? (d.floatBefore ?? 0) : (d.floatNow ?? 0);
    const left = share(today) + fl - (today === d.updated ? (d.spentToday ?? 0) : 0);
    const unit = d.budget / d.total, lv = over ? d.level : levelOf(left, unit);

    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    const lbl = top.addText("今日つかえる"); lbl.font = Font.mediumRoundedSystemFont(11); lbl.textColor = C.soft;
    top.addSpacer();
    const cat = await image("cat-" + d.color + "-" + lv + ".png");
    if(cat){ const im = top.addImage(cat); im.imageSize = new Size(58, 56); }
    w.addSpacer(2);
    if(over){
      const a = w.addText("加算日だにゃ"); a.font = Font.boldRoundedSystemFont(18); a.textColor = C.ink;
      const b = w.addText("アプリを開いてね"); b.font = Font.systemFont(11); b.textColor = C.soft;
    }else{
      const a = w.addText(yen(left)); a.font = Font.boldRoundedSystemFont(26); a.textColor = left < 0 ? C.minus : C.ink; a.minimumScaleFactor = .6; a.lineLimit = 1;
      const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 3;
      const yarn = await image("yarn-" + lv + ".png");
      if(yarn){ const yi = row.addImage(yarn); yi.imageSize = new Size(16, 16); }
      const n = toNext(left, unit, lv);
      const b = row.addText(lv === 0 ? "もとに戻るまで " + yen(n) : lv < 4 ? "次のレベルまで " + yen(n) : "いちばん上のレベルだにゃ");
      b.font = Font.systemFont(10.5); b.textColor = C.soft; b.lineLimit = 1; b.minimumScaleFactor = .8;
    }
    w.addSpacer();
    const btn = w.addStack(); btn.backgroundColor = C.accent; btn.cornerRadius = 12; btn.setPadding(6, 10, 6, 10); btn.centerAlignContent();
    btn.addSpacer();
    const bt = btn.addText("＋ 記録する"); bt.font = Font.boldRoundedSystemFont(13); bt.textColor = Color.white();
    btn.addSpacer();
  }
  if(config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
};
