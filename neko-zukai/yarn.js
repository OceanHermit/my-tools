/* 毛糸玉。lv: 0〜4（ネコのレベル）。レベルが上がるほど玉が大きくなり、糸の色とふわふわ感が豪華になる（同じレベルの中では変わらない） */
const YARN = [
  { a: '#B9AA9A', b: '#8E7F70', fluff: 0,   lines: 2 },                         // 0 ほつれた灰色の糸
  { a: '#E8A25C', b: '#B86A26', fluff: 0,   lines: 3 },                         // 1 ふつうの毛糸
  { a: '#F3B4A2', b: '#FFF3E4', fluff: 1.6, lines: 3 },                         // 2 2色のやわらかい糸
  { a: '#B9A5E0', b: '#FFD9EC', c: '#9FD8D0', fluff: 2.6, lines: 4 },           // 3 3色のモヘア
  { a: '#F6C445', b: '#FFF6C9', c: '#F29CB7', d: '#8ED1E8', fluff: 3.6, lines: 5, shine: true }, // 4 金のふわふわ
];
const YARN_R = [14, 20, 26, 31, 36];   // レベルごとの玉の大きさ
function nekoYarn(lv, w){
  const Y = YARN[lv], INK = '#4A3223';
  const r = YARN_R[lv], cx = 56, cy = 90 - r - Y.fluff;
  // ふわふわの輪郭（レベルが高いほど、もこもこが深い）
  let ball;
  if(Y.fluff){
    const n = Math.round(r * .85), R = r + Y.fluff; let d = '';
    for(let i = 0; i <= n; i++){
      const t0 = (i - .5) / n * Math.PI * 2, t1 = i / n * Math.PI * 2;
      const mx = cx + (R + Y.fluff * 1.5) * Math.cos(t0), my = cy + (R + Y.fluff * 1.5) * Math.sin(t0);
      const x = cx + (R - Y.fluff * .4) * Math.cos(t1), y = cy + (R - Y.fluff * .4) * Math.sin(t1);
      d += i ? `Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    ball = `<path d="${d}Z" fill="${Y.a}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>`;
  } else ball = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${Y.a}" stroke="${INK}" stroke-width="3.6"/>`;
  // 巻いた糸のすじ。色はレベルごとの差し色を順に使う
  const cols = [Y.b, Y.c || Y.b, Y.d || Y.b, Y.b, Y.c || Y.b];
  let wraps = '';
  for(let i = 0; i < Y.lines; i++){
    const t = (i + 1) / (Y.lines + 1) * 1.7 - .85;
    wraps += `<path d="M${cx - r * Math.sqrt(1 - t * t * .9) * .92} ${cy + t * r * .9} Q${cx} ${cy + t * r * .9 - r * .55} ${cx + r * Math.sqrt(1 - t * t * .6) * .9} ${cy + t * r * .55}" fill="none" stroke="${cols[i]}" stroke-width="${Y.fluff ? 3.4 : 2.6}" stroke-linecap="round"/>`;
  }
  wraps += `<path d="M${cx - r * .28} ${cy - r * .86} Q${cx + r * .62} ${cy} ${cx - r * .1} ${cy + r * .88}" fill="none" stroke="${Y.b}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>`;
  // 玉からのびた糸
  const len = 30, x0 = cx + r * .75, y0 = 88;
  const thread = `<path d="M${x0} ${y0 - 3} q${len * .2} 8 ${len * .4} 1 t${len * .35} 1 t${len * .25} -2" fill="none" stroke="${lv ? Y.a : Y.b}" stroke-width="${Y.fluff ? 4.6 : 3.4}" stroke-linecap="round" ${lv === 0 ? 'stroke-dasharray="7 5"' : ''}/>`;
  const fray = lv === 0 ? `<path d="M${cx - r * .7} ${cy - r * .8} l-5 -6 M${cx + r * .8} ${cy - r * .7} l6 -4 M${cx + r} ${cy + 2} l7 1" stroke="${Y.b}" stroke-width="2.4" stroke-linecap="round"/>` : '';
  const star = (x, y, s) => `<path transform="translate(${x},${y}) scale(${s})" d="M0 -8 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4z" fill="#F2C14E"/>`;
  const shine = Y.shine ? star(cx + r + 8, cy - r * .7, 1) + star(cx - r - 6, cy - r * .2, .6) + star(cx + r * .2, cy - r - 10, .8) : '';
  const top = Math.max(0, Math.floor(cy - r - Y.fluff * 2.5 - (Y.shine ? 20 : 6)));   // 玉の上のあきを切りつめる
  return `<svg viewBox="0 ${top} 140 ${96 - top}" width="${w || 150}" aria-hidden="true">${thread}${ball}${wraps}${fray}${shine}</svg>`;
}
if(typeof window !== 'undefined'){ window.nekoYarn = nekoYarn; }
