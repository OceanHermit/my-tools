// NEKO-ZUKAI のネコ（ふわふわ長毛・線画スタイル）
// 途切れる太い線・点の目・胸の毛の線。正面を向いておすわりし、
// うしろ足を前へ投げ出して肉球を見せ、前足の先が真ん中に2つ並ぶ。
// 毛色は白とアプリコットの2種類。段階（lv）でポーズと表情が変わる。
(function(root){
'use strict';
const f1 = n => (Math.round(n * 10) / 10).toString();
function catmull(ctrl, closed, per = 12){
  const n = ctrl.length, out = [];
  const P = i => closed ? ctrl[(i + n) % n] : ctrl[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for(let i = 0; i < segs; i++){
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for(let k = 0; k < per; k++){
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if(!closed) out.push(ctrl[n - 1]);
  return out;
}
const cPath = c => 'M' + catmull(c, true).map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
const oPath = c => 'M' + catmull(c, false).map(p => f1(p[0]) + ' ' + f1(p[1])).join('L');

/* 毛色。dull はぼさぼさの段階で使う、くすんだ色 */
const COLORS = {
  white:   { fur: '#FAF8F5', fur2: '#F1EDE7', chest: '#8C90A4', line: '#3E2A28', ear: '#F7C2BE', earLine: '#B86E6A', sole: '#FFFFFF',
             dull: { fur: '#E9E5DF', sole: '#F3F0EB', ear: '#E9C3BF' } },
  apricot: { fur: '#F8CE9C', fur2: '#FFF5E8', chest: '#D99A5E', line: '#4A3226', ear: '#F7BDB5', earLine: '#C27A6E', sole: '#FFF5E8',
             dull: { fur: '#E2C6A6', fur2: '#F1E6D8', sole: '#F1E6D8', ear: '#E5BFB6' } },
};
const PAD = '#F3A6A0';

const BODY = [[112, 42], [136, 44], [154, 54], [162, 74], [166, 98], [172, 112], [170, 124], [178, 146], [184, 176], [176, 200], [152, 210], [112, 212], [72, 210], [48, 200], [40, 176], [46, 146], [56, 124], [52, 112], [58, 98], [62, 74], [70, 54], [90, 44]];
const TAIL = [[172, 168], [194, 160], [212, 170], [220, 192], [210, 208], [186, 214], [150, 214], [132, 210], [140, 196], [158, 188]];

/* ネコ本体（svg の中身）。o: { eye, mouth, groom, messy, droop } */
function body(c, id, o){
  const L = (d, extra = '') => `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  const G = (d, w = 3) => `<path d="${d}" fill="none" stroke="${c.chest}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let s = '';
  let h = '';   // 頭のパーツ（毛づくろいでは傾ける）
  // 耳（ぼさぼさのときは少し外へ倒す）
  [1, -1].forEach(d => {
    const X = x => 112 + (x - 112) * d;
    h += `<g${o.droop ? ` transform="rotate(${-12 * d} ${X(80)} 52)"` : ''}>`;
    h += `<path d="M${X(64)} 70 L${X(60)} 30 Q${X(62)} 25 ${X(70)} 26 Q${X(86)} 30 ${X(96)} 44 Z" fill="${c.fur}"/>`;
    h += `<path d="M${X(68)} 64 L${X(66)} 36 Q${X(68)} 33 ${X(73)} 34 Q${X(84)} 40 ${X(88)} 50 Z" fill="${c.ear}"/>`;
    h += L(`M${X(62)} 66 L${X(59)} 32 Q${X(61)} 25 ${X(70)} 26 Q${X(86)} 29 ${X(97)} 42`);
    h += `<path d="M${X(70)} 38 Q${X(78)} 41 ${X(84)} 50 M${X(70)} 48 l${X(76) - X(70)} -2 l${X(71) - X(76)} 5 l${X(77) - X(71)} 3 M${X(71)} 60 l${X(74) - X(71)} -5" fill="none" stroke="${c.earLine}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    h += `</g>`;
  });
  // しっぽ・からだ
  s += `<path d="${cPath(TAIL)}" fill="${c.fur}"/>`;
  // 毛づくろいでは頭を傾けるので、からだの塗りは首から下だけにして、頭の塗りに任せる
  s += `<path d="${cPath(o.groom ? [[112, 112], [150, 114], [170, 124], [178, 146], [184, 176], [176, 200], [152, 210], [112, 212], [72, 210], [48, 200], [40, 176], [46, 146], [56, 124], [74, 114]] : BODY)}" fill="${c.fur}"/>`;
  // 頭の塗り（傾けたときに、からだの塗りとずれないよう頭だけでも塗る）
  h += `<path d="${cPath([[112, 42], [136, 44], [154, 54], [162, 74], [166, 98], [170, 116], [150, 126], [112, 130], [74, 126], [54, 116], [58, 98], [62, 74], [70, 54], [90, 44]])}" fill="${c.fur}"/>`;
  if(c.fur2 && c.name === 'apricot') s += `<path d="M84 120 Q112 140 140 120 Q148 160 112 176 Q76 160 84 120 Z" fill="${c.fur2}"/>`;
  // 輪郭（途切れ途切れ）
  h += L(oPath([[70, 54], [90, 44], [112, 42]])) + L(oPath([[118, 42], [136, 44], [154, 54]])) + `<circle cx="114.5" cy="42.2" r="1.8" fill="${c.line}"/>`;
  h += L(oPath([[62, 76], [58, 98], [52, 110]])) + L('M52 110 l6 -2') + L(oPath([[57, 114], [55, 124], [48, 132]]));
  h += L(oPath([[162, 76], [166, 98], [172, 110]])) + L('M172 110 l-6 -2') + L(oPath([[167, 114], [169, 124], [176, 132]]));
  s += L(oPath([[58, 128], [48, 150], [42, 172]])) + L(oPath([[166, 128], [176, 148], [180, 162]]));
  if(!o.liquid) s += L(oPath([[76, 210], [112, 212], [150, 210]]));
  if(!o.liquid && !o.hindPaws) s += L(oPath([[42, 180], [47, 197], [62, 207]]));
  const tailLines = L(oPath([[176, 166], [194, 158], [212, 168]])) + L(oPath([[216, 176], [220, 192], [210, 206]])) + L(oPath([[200, 211], [184, 214], [166, 214]]))
    + L(oPath([[156, 214], [140, 212], [134, 206], [142, 198]])) + L('M150 196 q8 -6 14 -6') + L('M190 208 q6 -6 6 -12 M172 210 q6 -4 8 -10');
  if(o.liquid) s += tailLines;
  // ぼさぼさ: 毛のはね
  if(o.messy){
    s += L('M47 134 l-10 2 M44 160 l-9 4 M177 136 l10 2 M181 160 l9 4 M214 172 l8 -5 M196 158 l3 -8', ' stroke-width="2.8"');
  }
  // うしろ足の裏（肉球が前を向く）
  if(o.hindPaws) [[52, 190, -24], [172, 190, 24]].forEach(([x, y, r]) => {
    s += `<g class="part-hindpaw" transform="rotate(${r} ${x} ${y})">
      <ellipse cx="${x}" cy="${y}" rx="14" ry="17" fill="${c.sole}" stroke="${c.line}" stroke-width="3.2"/>
      <path d="M${x - 6.5} ${y + 4}Q${x} ${y - 1} ${x + 6.5} ${y + 4}Q${x + 6} ${y + 10.5} ${x} ${y + 10.5}Q${x - 6} ${y + 10.5} ${x - 6.5} ${y + 4}Z" fill="${PAD}"/>
      ${[[-7.5, -4], [-2.6, -9], [2.6, -9], [7.5, -4]].map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="2.6" ry="3.2" fill="${PAD}"/>`).join('')}</g>`;
  });
  // しっぽを右うしろ足の上に重ねて、足をしっぽで隠す
  if(!o.liquid) s += `<path d="${cPath(TAIL)}" fill="${c.fur}"/>` + tailLines;
  // 前足の先（毛づくろいでは片方を持ち上げる）
  const ground = o.liquid ? [] : o.groom ? [[104, 204]] : [[99, 204], [125, 204]];
  ground.forEach(([x, y]) => {
    s += `<g class="part-paw"><ellipse cx="${x}" cy="${y}" rx="11.5" ry="8" fill="${c.sole}" stroke="${c.line}" stroke-width="3.2"/>
      <path d="M${x - 3.8} ${y - 2}v5M${x + 3.8} ${y - 2}v5" stroke="${c.chest}" stroke-width="2.2" stroke-linecap="round"/></g>`;
  });
  // 胸の毛
  s += G(oPath([[80, 134], [88, 150], [102, 158]]) + 'l-3 -5 l12 5') + G(oPath([[144, 134], [136, 150], [122, 158]]) + 'l3 -5 l-12 5');
  if(o.messy) h += L('M96 44 l-3 -8 M104 42 l1 -9 M128 43 l4 -8 M52 108 l-10 -4 M172 108 l10 -4', ' stroke-width="2.8"');
  h += face(c, o);
  s += o.groom ? `<g class="head-tilt" transform="translate(3 4) rotate(6 112 128)">${h}</g>` : h;
  if(o.groom){
    // 片方の前足を口もとへ。胸の毛の下から前腕が上がり、肉球がこちらを向く
    // 写真のように: 右の前足を肩からまっすぐ上げ、顔の横（ほおの高さ）へ。肉球がこちらを向く
    const P = [152, 88];
    s += `<g class="lick-paw">
      <path d="M136 158 C137 140 135 120 135.5 96 C136 78 144 70 152 70 C162 70 169 78 169 92 C172 108 178 130 178 158 Z" fill="${c.fur}"/>
      ${L(oPath([[135.6, 124], [135.5, 104], [137, 84], [144, 73], [152, 70.5], [161, 72], [167, 80], [169, 92], [173, 108], [177, 128], [178, 152]]))}
      ${L('M177 120 l6 -3 M179 138 l6 0', ' stroke-width="2.6"')}
      <path d="M${P[0] - 7.5} ${P[1] + 4.5}Q${P[0]} ${P[1] - 1.5} ${P[0] + 7.5} ${P[1] + 4.5}Q${P[0] + 7} ${P[1] + 12} ${P[0]} ${P[1] + 12}Q${P[0] - 7} ${P[1] + 12} ${P[0] - 7.5} ${P[1] + 4.5}Z" fill="${PAD}"/>
      ${[[-8.5, -4], [-3, -10], [3, -10], [8.5, -4]].map(([dx, dy]) => `<ellipse cx="${P[0] + dx}" cy="${P[1] + dy}" rx="2.9" ry="3.6" fill="${PAD}"/>`).join('')}
    </g>`;
  }
  return s;
}

/* 顔（真ん中の高さ）。eye: open / tired / closed / happy、mouth: normal / frown / open / lick */
function face(c, o){
  const L = (d, w = 2.6) => `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let s = '';
  [97, 127].forEach(x => {
    if(o.eye === 'closed') s += L(`M${x - 5.5} 92.5 Q${x} 95.5 ${x + 5.5} 92.5`, 3);
    else if(o.eye === 'happy') s += L(`M${x - 5.5} 93.5 Q${x} 89.5 ${x + 5.5} 93.5`, 3);
    else if(o.eye === 'tired') s += `<path d="M${x - 4.8} 92 A4.8 5.2 0 0 0 ${x + 4.8} 92 Z" fill="${c.line}"/>` + L(`M${x - 6.5} 91.4 L${x + 6.5} 91.4`, 2.8);
    else s += `<ellipse cx="${x}" cy="92" rx="4.6" ry="5.4" fill="${c.line}"/>`;
  });
  s += `<path d="M107 94 Q112 92 117 94 Q116 98 112 99 Q108 98 107 94 Z" fill="#F7B6B2"/>`;
  if(o.mouth === 'frown') s += L('M112 99 v2.4 M106 106 Q112 101.6 118 106');
  else if(o.mouth === 'open') s += L('M112 99 v1.6') + `<path d="M106.5 101.6 Q112 103.4 117.5 101.6 Q116.4 109 112 109.6 Q107.6 109 106.5 101.6 Z" fill="#C4646A" stroke="${c.line}" stroke-width="2.2" stroke-linejoin="round"/><path d="M109 106.4 Q112 104.8 115 106.4 Q114.4 108.6 112 108.8 Q109.6 108.6 109 106.4 Z" fill="#EE8C8C"/>`;
  else if(o.mouth === 'lick') s += L('M112 99 v2.6 M104.5 103 Q108 104 112 101.6') + `<path d="M112.4 102 q4 .2 5.4 3.6 q-3.4 2.2 -5.6 -1.2 z" fill="#EE8C8C" stroke="${c.line}" stroke-width="1.6" stroke-linejoin="round"/>`;
  else s += L('M112 99 v2.6 M104.5 103 Q108 104 112 101.6 Q116 104 119.5 103');
  s += L('M90 98 q-8 -1 -20 -1 M88 104 q-8 0 -14 3 M134 98 q8 -1 20 -1 M136 104 q8 0 14 3');
  return s;
}

function sparkles(){
  const star = (x, y, r, d) => `<path class="twinkle" style="animation-delay:${d}s" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#F4C452"/>`;
  return `<g class="part-sparkle">${star(28, 40, 8, 0)}${star(214, 34, 7, .5)}${star(24, 120, 5, 1)}${star(220, 110, 5, 1.4)}</g>`;
}

/* 液体ネコ: 金魚鉢にすっぽり。鉢のふちから上は顔、下はからだが鉢の形いっぱいに収まる */
function liquid(c, id, o){
  const bx = 116, by = 146, R = 76, rimY = 118, rimRX = 66, rimRY = 10;
  const top = Math.asin((by - rimY) / R);
  let bowl = ''; for(let i = 0; i <= 80; i++){ const a = Math.PI - top + (Math.PI + 2 * top) * i / 80; bowl += (i ? 'L' : 'M') + f1(bx + R * Math.cos(a)) + ' ' + f1(by - R * Math.sin(a)); }
  const rim = half => { let d = ''; const a0 = half === 'back' ? Math.PI : 0; for(let i = 0; i <= 40; i++){ const a = a0 + Math.PI * i / 40; d += (i ? 'L' : 'M') + f1(bx + rimRX * Math.cos(a)) + ' ' + f1(rimY + rimRY * Math.sin(a)); } return d; };
  return `<ellipse cx="${bx}" cy="222" rx="74" ry="5" fill="#E5D3BD" opacity=".7"/>
    <path d="${rim('back')}" stroke="#A9C3CE" stroke-width="2.2" fill="none"/>
    <clipPath id="${id}-top"><rect x="0" y="0" width="240" height="${rimY + 6}"/></clipPath>
    <clipPath id="${id}-in"><rect x="0" y="${rimY - 2}" width="240" height="120"/></clipPath>
    <clipPath id="${id}-glass"><ellipse cx="${bx}" cy="${by}" rx="${R - 1.5}" ry="${R - 1.5}"/></clipPath>
    <g clip-path="url(#${id}-glass)"><g clip-path="url(#${id}-in)">
      <rect x="0" y="0" width="240" height="240" fill="${c.fur}"/>
      ${c.name === 'apricot' ? `<ellipse cx="${bx + 4}" cy="${by + 8}" rx="40" ry="52" fill="${c.fur2}"/>` : ''}
      <path d="M${bx - 30} ${by - 18} Q${bx - 24} ${by + 4} ${bx - 4} ${by + 10} l-3 -5 l12 5 M${bx + 38} ${by - 18} Q${bx + 32} ${by + 4} ${bx + 12} ${by + 10} l3 -5 l-12 5" fill="none" stroke="${c.chest}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- ガラスに押しつけられたからだのふくらみ -->
      <path d="M${bx - 62} ${by - 4} q4 20 18 34 M${bx + 64} ${by - 6} q-2 22 -16 36 M${bx - 40} ${by + 52} q18 14 40 14 M${bx + 30} ${by + 56} q12 -4 22 -12" fill="none" stroke="${c.line}" stroke-width="3" stroke-linecap="round"/>
      <!-- しっぽ: 鉢の底にそってくるり -->
      <path d="M${bx + 52} ${by + 50} Q${bx + 20} ${by + 74} ${bx - 18} ${by + 70} Q${bx - 34} ${by + 66} ${bx - 30} ${by + 58} Q${bx - 4} ${by + 60} ${bx + 22} ${by + 52} Q${bx + 40} ${by + 44} ${bx + 52} ${by + 50} Z" fill="${c.fur}" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/>
    </g></g>
    <g clip-path="url(#${id}-top)"><g transform="translate(4 6)">${body(c, id, { ...o, liquid: true })}</g></g>
    <g class="part-glass">
      <path d="${bowl}" fill="#EAF4F8" fill-opacity=".28" stroke="#9FBBC7" stroke-width="2.4"/>
      <path d="M${bx - 58} ${by - 20}Q${bx - 66} ${by + 16} ${bx - 46} ${by + 48}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M${bx + 48} ${by - 38}q12 10 16 26" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".6"/>
      <path d="${rim('front')}" stroke="#9FBBC7" stroke-width="2.6" fill="none"/>
    </g>`;
}

/* lv: 0 ぼさぼさ / 1 ふつう / 2 毛づくろい / 3 にっこり / 4 液体ネコ
   opt.color: 'white' | 'apricot'、opt.eye / opt.mouth でその日の表情に差し替え（毛づくろいは除く） */
function cat(lv, id = 'neko', opt = {}){
  const base = COLORS[opt.color] || COLORS.white;
  const c = { ...base, ...(lv === 0 ? base.dull : {}), name: opt.color === 'apricot' ? 'apricot' : 'white' };
  const o = {
    eye: lv === 0 ? 'tired' : lv === 2 ? 'closed' : lv === 3 ? 'happy' : 'open',
    mouth: lv === 0 ? 'frown' : lv === 3 ? 'open' : 'normal',
    groom: lv === 2, messy: lv === 0, droop: lv === 0,
  };
  if(lv !== 2){ if(opt.eye) o.eye = opt.eye; if(opt.mouth) o.mouth = opt.mouth; }
  let s = `<svg class="cat" viewBox="0 0 240 230" role="img" aria-label="ネコ">`;
  if(lv === 4) s += liquid(c, id, o);
  else s += `<ellipse cx="118" cy="216" rx="84" ry="5" fill="#E5D3BD" opacity=".7"/>` + body(c, id, o);
  if(lv >= 3) s += sparkles();
  return s + `</svg>`;
}
root.nekoCat = cat;
root.nekoColors = Object.keys(COLORS);
})(typeof window !== 'undefined' ? window : globalThis);
