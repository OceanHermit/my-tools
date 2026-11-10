// NEKO-ZUKAI 品種ごとのネコ（追加コンテンツ用の素材）
// cat.js と同じ線画スタイルの「ふつう」のおすわり。品種の特徴は設定（BREEDS）で切り替える:
//   long 長毛 / earType 耳の形 / tail しっぽ / pattern 模様 / eye 目の色 / flat つぶれた鼻 / sx,scale 体型 / squat 短足
// nekoBreed(id, svgId) で SVG 文字列を返す。nekoBreeds は一覧（id・名前・分類）。
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
function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/* 輪郭。長毛はほお毛のあるふわふわ、短毛はなめらか */
const LH = [[112, 42], [136, 44], [154, 54], [162, 74], [166, 98], [172, 112], [170, 124], [178, 146], [184, 176], [176, 200], [152, 210], [112, 212], [72, 210], [48, 200], [40, 176], [46, 146], [56, 124], [52, 112], [58, 98], [62, 74], [70, 54], [90, 44]];
const SH = [[112, 44], [134, 46], [152, 56], [161, 74], [163, 94], [158, 110], [160, 124], [168, 146], [172, 176], [166, 200], [146, 210], [112, 212], [78, 210], [58, 200], [52, 176], [56, 146], [64, 124], [66, 110], [61, 94], [63, 74], [72, 56], [90, 46]];
const TAIL = [[172, 168], [194, 160], [212, 170], [220, 192], [210, 208], [186, 214], [150, 214], [132, 210], [140, 196], [158, 188]];
const squatPts = (pts, k) => pts.map(([x, y]) => y <= 112 ? [x, y + 102 * (1 - k)] : [x, 212 - (212 - y) * k]);
const mir = x => 224 - x;

/* ---------- 模様（輪郭で切り抜いて使う）。head と body に分けて返す ---------- */
const PATTERNS = {
  tabby(c){
    const w = c.bold ? 6 : 4.2, st = d => `<path d="${d}" stroke="${c.stripe}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
    const side = [[56, 140], [53, 158], [53, 176]].map(([x, y]) => `M${x} ${y} q10 3 14 10 M${mir(x)} ${y} q-10 3 -14 10`).join(' ');
    return { head: st('M103 45 v12 M112 43 v15 M121 45 v12') + st('M62 88 h11 M63 97 h9 M162 88 h-11 M161 97 h-9'), body: st(side) };
  },
  spots(c){
    const pts = [[64, 140], [77, 152], [61, 164], [74, 177], [62, 191], [82, 198], [90, 140]];
    const dot = ([x, y]) => c.rosette
      ? `<circle cx="${x}" cy="${y}" r="4.6" fill="${c.spotFill || c.fur}" stroke="${c.stripe}" stroke-width="2.6"/>`
      : `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="3.1" fill="${c.stripe}"/>`;
    return { head: `<path d="M104 46 v10 M112 44 v12 M120 46 v10 M63 90 h9 M161 90 h-9" stroke="${c.stripe}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`,
      body: pts.map(p => dot(p) + dot([mir(p[0]), p[1]])).join('') };
  },
  ticked(c){
    const r = rng(c.seed || 7); let d = '';
    for(let i = 0; i < 150; i++){ const x = 40 + r() * 146, y = 46 + r() * 164; d += `M${f1(x)} ${f1(y)}l${f1((r() - .5) * 2)} 4.5`; }
    return { head: `<path d="M106 46 v9 M112 44 v11 M118 46 v9" stroke="${c.stripe}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
      body: `<path d="${d}" stroke="${c.stripe}" stroke-width="1.7" stroke-linecap="round" opacity=".55" fill="none"/>` };
  },
  points(c, id){
    let head = `<ellipse cx="112" cy="98" rx="27" ry="22" fill="${c.point}" filter="url(#${id}-soft)"/>`;
    if(c.blaze) head += `<path d="M112 74 L97 112 Q112 122 127 112 Z" fill="${c.blaze}"/>`;
    return { head, body: '' };
  },
  bicolor(c){
    const L = c.patchL || c.patch, R = c.patchR || c.patch;
    const hp = (col, m) => col ? `<path d="M${m(20)} 10 L${m(112)} 10 L${m(112)} 62 L${m(92)} 118 L${m(30)} 122 Z" fill="${col}"/>` : '';
    const bp = (col, m) => col ? `<path d="M${m(10)} 118 L${m(92)} 118 Q${m(78)} 150 ${m(72)} 216 L${m(10)} 216 Z" fill="${col}"/>` : '';
    const id = x => x;
    return { head: hp(L, id) + hp(R, mir), body: c.van ? '' : bp(c.bodyL === undefined ? L : c.bodyL, id) + bp(c.bodyR === undefined ? R : c.bodyR, mir) };
  },
  calico(c){
    const o = c.orange, b = c.black;
    return { head: `<path d="M20 10 L112 10 L112 62 L92 118 L30 122 Z" fill="${o}"/><path d="M204 10 L112 10 L112 62 L132 118 L194 122 Z" fill="${b}"/>`,
      body: `<ellipse cx="156" cy="172" rx="32" ry="40" fill="${o}"/><ellipse cx="60" cy="184" rx="26" ry="30" fill="${b}"/><ellipse cx="72" cy="136" rx="13" ry="10" fill="${o}"/>` };
  },
  tortie(c){
    const r = rng(c.seed || 11); let s = '';
    for(let i = 0; i < 26; i++){ const x = 44 + r() * 138, y = 48 + r() * 160; s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(6 + r() * 9)}" ry="${f1(5 + r() * 8)}" transform="rotate(${f1(r() * 180)} ${f1(x)} ${f1(y)})" fill="${c.orange}"/>`; }
    return { head: '', body: s };
  },
  wavy(c){
    const r = rng(c.seed || 5); let d = '';
    for(let y = 122; y < 206; y += c.long ? 11 : 14) for(let x = 52 + (y % 3) * 5; x < 176; x += c.long ? 17 : 22){ const X = x + (r() - .5) * 6, Y = y + (r() - .5) * 5; d += `M${f1(X)} ${f1(Y)}q3 -4 6 0t6 0`; }
    return { head: `<path d="M98 50 q3 -4 6 0t6 0 M116 50 q3 -4 6 0t6 0" stroke="${c.chest}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      body: `<path d="${d}" stroke="${c.chest}" stroke-width="2" fill="none" stroke-linecap="round"/>` };
  },
  wrinkle(c){
    const st = d => `<path d="${d}" stroke="${c.chest}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    return { head: st('M100 55 q12 5 24 0 M103 62 q9 4 18 0 M70 100 q5 6 4 12 M154 100 q-5 6 -4 12'),
      body: st('M90 124 q22 9 44 0 M94 132 q18 7 36 0 M62 150 q8 4 10 12 M162 150 q-8 4 -10 12 M60 176 q9 3 12 11 M164 176 q-9 3 -12 11') };
  },
};

/* ---------- 耳 ---------- */
function ears(c, id){
  let s = '';
  [1, -1].forEach(d => {
    const X = x => 112 + (x - 112) * d;
    const fur = (d === 1 ? c.earL : c.earR) || c.earFur || c.fur;
    const es = c.earScale || 1, rot = c.earRot || 0;
    const tf = (es !== 1 || rot) ? ` transform="translate(${X(82)} 62) rotate(${-rot * d}) scale(${es}) translate(${-X(82)} -62)"` : '';
    const ln = dd => `<path d="${dd}" fill="none" stroke="${c.line}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<g class="part-ear"${tf}>`;
    if(c.earType === 'fold'){
      s += `<path d="M${X(66)} 66 Q${X(59)} 47 ${X(74)} 43 Q${X(92)} 42 ${X(99)} 52 Q${X(87)} 54 ${X(80)} 67 Z" fill="${fur}" stroke="${c.line}" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M${X(69)} 53 Q${X(79)} 49 ${X(89)} 53" fill="none" stroke="${c.earLine}" stroke-width="2.2" stroke-linecap="round"/>`;
    } else if(c.earType === 'curl'){
      s += `<path d="M${X(64)} 70 Q${X(56)} 46 ${X(60)} 34 Q${X(54)} 26 ${X(47)} 31 Q${X(57)} 20 ${X(68)} 27 Q${X(86)} 32 ${X(96)} 44 Z" fill="${fur}"/>
        <path d="M${X(68)} 62 Q${X(63)} 45 ${X(66)} 37 Q${X(77)} 37 ${X(88)} 50 Z" fill="${c.ear}"/>` +
        ln(`M${X(62)} 66 Q${X(56)} 46 ${X(60)} 34 Q${X(54)} 26 ${X(47)} 31 Q${X(57)} 20 ${X(68)} 27 Q${X(86)} 30 ${X(97)} 42`);
    } else {
      s += `<path d="M${X(64)} 70 L${X(60)} 30 Q${X(62)} 25 ${X(70)} 26 Q${X(86)} 30 ${X(96)} 44 Z" fill="${fur}"/>
        <path d="M${X(68)} 64 L${X(66)} 36 Q${X(68)} 33 ${X(73)} 34 Q${X(84)} 40 ${X(88)} 50 Z" fill="${c.ear}"/>` +
        ln(`M${X(62)} 66 L${X(59)} 32 Q${X(61)} 25 ${X(70)} 26 Q${X(86)} 29 ${X(97)} 42`) +
        `<path d="M${X(70)} 38 Q${X(78)} 41 ${X(84)} 50 M${X(71)} 48 L${X(76)} 46 L${X(72)} 51 L${X(77)} 54" fill="none" stroke="${c.earLine}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
      if(c.earType === 'tuft') s += ln(`M${X(62)} 27 L${X(58)} 17 M${X(66)} 26 L${X(66)} 15`);
    }
    s += `</g>`;
  });
  return s;
}

/* ---------- しっぽ ---------- */
function tail(c, id){
  const fur = c.tailFur || c.fur;
  const L = d => `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(c.tail === 'none') return '';
  if(c.tail === 'bob'){
    return `<g class="part-tail"><circle cx="170" cy="197" r="12.5" fill="${fur}"/>` +
      L('M158 189 q9 -10 19 -4 M181 189 q6 9 0 17 M177 209 q-7 4 -15 1') + L('M172 183 l2 -6 M183 196 l6 -1') + `</g>`;
  }
  if(c.tail === 'thin'){
    const p = 'M148 205 C186 214 216 200 211 172 Q209 160 200 157', w = c.tailW || 13;
    return `<g class="part-tail"><path d="${p}" fill="none" stroke="${c.line}" stroke-width="${w + 6.6}" stroke-linecap="round"/>
      <path d="${p}" fill="none" stroke="${fur}" stroke-width="${w}" stroke-linecap="round"/>
      ${c.tailRings ? `<path d="${p}" fill="none" stroke="${c.stripe}" stroke-width="${w}" stroke-dasharray="5 13"/>` : ''}
      ${c.tailTip ? `<path d="M212 186 Q213 164 200 157" fill="none" stroke="${c.tailTip}" stroke-width="${w}" stroke-linecap="round"/>` : ''}</g>`;
  }
  const tp = cPath(TAIL);
  return `<g class="part-tail"><clipPath id="${id}-t"><path d="${tp}"/></clipPath><path d="${tp}" fill="${fur}"/>
    <g clip-path="url(#${id}-t)">${c.tailTip ? `<ellipse cx="206" cy="170" rx="24" ry="22" fill="${c.tailTip}"/>` : ''}
      ${c.tailRings ? `<path d="M190 158 l6 14 M214 172 l-12 8 M222 194 l-14 -4" stroke="${c.stripe}" stroke-width="4.5" stroke-linecap="round"/>` : ''}</g>` +
    L(oPath([[176, 166], [194, 158], [212, 168]])) + L(oPath([[216, 176], [220, 192], [210, 206]])) + L(oPath([[200, 211], [184, 214], [166, 214]])) +
    L(oPath([[156, 214], [140, 212], [134, 206], [142, 198]])) + L('M150 196 q8 -6 14 -6') + L('M190 208 q6 -6 6 -12 M172 210 q6 -4 8 -10') + `</g>`;
}

/* ---------- 顔 ---------- */
function face(c){
  const L = (d, w = 2.6, col = c.mouth || c.line) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ex = c.flat ? 17 : 15, ny = c.flat ? -6 : 0;
  let s = '';
  [112 - ex, 112 + ex].forEach((x, i) => {
    const col = Array.isArray(c.eye) ? c.eye[i] : c.eye;
    if(col) s += `<ellipse cx="${x}" cy="92" rx="5.6" ry="6.2" fill="${col}" stroke="${c.eyeLine || c.line}" stroke-width="2.2"/><ellipse cx="${x}" cy="92.4" rx="2.1" ry="4.4" fill="#1E1512"/><circle cx="${x - 1.8}" cy="89.6" r="1.3" fill="#fff"/>`;
    else s += `<ellipse cx="${x}" cy="92" rx="4.6" ry="5.4" fill="${c.line}"/>`;
  });
  s += `<path d="M107 ${94 + ny} Q112 ${92 + ny} 117 ${94 + ny} Q116 ${98 + ny} 112 ${99 + ny} Q108 ${98 + ny} 107 ${94 + ny} Z" fill="${c.nose}"/>`;
  s += L(`M112 ${99 + ny} v2.6 M104.5 ${103 + ny} Q108 ${104 + ny} 112 ${101.6 + ny} Q116 ${104 + ny} 119.5 ${103 + ny}`);
  if(c.whisker !== 'none') s += L('M90 98 q-8 -1 -20 -1 M88 104 q-8 0 -14 3 M134 98 q8 -1 20 -1 M136 104 q8 0 14 3', 2.6, c.whisker || c.line);
  return s;
}

/* ---------- 組み立て ---------- */
const BASE = { line: '#3E2A28', fur: '#FAF8F5', chest: '#8C90A4', ear: '#F7C2BE', earLine: '#B86E6A', paw: '#FFFFFF', nose: '#F7B6B2', stripe: '#6B4A3A' };

function draw(cfg, id = 'b'){
  const c = { ...BASE, ...cfg };
  const k = c.squat || 1, shift = 102 * (1 - k);
  const hg = shift ? ` transform="translate(0 ${f1(shift)})"` : '';
  const bg = shift ? ` transform="translate(0 ${f1(212 * (1 - k))}) scale(1 ${k})"` : '';
  const pts = c.long ? LH : SH;
  const sil = cPath(k < 1 ? squatPts(pts, k) : pts);
  const L = d => `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const G = d => `<path d="${d}" fill="none" stroke="${c.chest}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sx = (c.sx || 1) * (c.scale || 1), sy = c.scale || 1;
  const pat = c.pattern ? PATTERNS[c.pattern](c, id) : { head: '', body: '' };

  let s = `<svg class="cat" viewBox="0 0 240 230" role="img" aria-label="${c.name || 'ネコ'}">`;
  s += `<defs><filter id="${id}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter><clipPath id="${id}-c"><path d="${sil}"/></clipPath></defs>`;
  s += `<ellipse cx="118" cy="216" rx="${f1(84 * sx)}" ry="5" fill="#E5D3BD" opacity=".7"/>`;
  s += `<g transform="translate(${f1(112 * (1 - sx))} ${f1(212 * (1 - sy))}) scale(${sx} ${sy})">`;
  if(c.earType !== 'fold') s += `<g${hg}>${ears(c, id)}</g>`;
  // 細いしっぽ・丸しっぽは体の後ろに置く（ふさふさのしっぽだけ体の前に沿わせる）
  const tailBehind = c.tail === 'thin' || c.tail === 'bob';
  if(tailBehind) s += tail(c, id);
  s += `<path d="${sil}" fill="${c.fur}"/>`;
  // 模様・白い胸とマズル
  s += `<g clip-path="url(#${id}-c)"><g${hg}>${pat.head}${c.muzzle ? `<ellipse cx="112" cy="105" rx="17" ry="12" fill="${c.muzzle}"/>` : ''}</g><g${bg}>${pat.body}` +
    (c.bib ? `<path d="M84 120 Q112 140 140 120 Q148 160 112 176 Q76 160 84 120 Z" fill="${c.bib}"/>` : '') +
    (c.belly ? `<ellipse cx="112" cy="168" rx="30" ry="46" fill="${c.belly}"/>` : '') + `</g></g>`;
  // 輪郭
  if(c.long){
    s += `<g${hg}>` + L(oPath([[70, 54], [90, 44], [112, 42]])) + L(oPath([[118, 42], [136, 44], [154, 54]])) + `<circle cx="114.5" cy="42.2" r="1.8" fill="${c.line}"/>` +
      L(oPath([[62, 76], [58, 98], [52, 110]])) + L('M52 110 l6 -2') + L(oPath([[57, 114], [55, 124], [48, 132]])) +
      L(oPath([[162, 76], [166, 98], [172, 110]])) + L('M172 110 l-6 -2') + L(oPath([[167, 114], [169, 124], [176, 132]])) + `</g>`;
    s += L(oPath([[58, 128], [48, 150], [42, 172]])) + L(oPath([[166, 128], [176, 148], [180, 162]])) + L(oPath([[42, 180], [47, 197], [62, 207]])) + L(oPath([[76, 210], [112, 212], [150, 210]]));
    s += G(oPath([[80, 134], [88, 150], [102, 158]]) + 'l-3 -5 l12 5') + G(oPath([[144, 134], [136, 150], [122, 158]]) + 'l3 -5 l-12 5');
  } else {
    s += `<path d="${sil}" fill="none" stroke="${c.line}" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="72 8 58 8 96 8 46 8 88 8 64 8"/>`;
  }
  if(c.earType === 'fold') s += `<g${hg}>${ears(c, id)}</g>`;
  if(!tailBehind) s += tail(c, id);
  [[99, 204], [125, 204]].forEach(([x, y]) => {
    s += `<g class="part-paw"><ellipse cx="${x}" cy="${y}" rx="11.5" ry="8" fill="${c.paw}" stroke="${c.line}" stroke-width="3.2"/>
      <path d="M${x - 3.8} ${y - 2}v5M${x + 3.8} ${y - 2}v5" stroke="${c.pawLine || c.chest}" stroke-width="2.2" stroke-linecap="round"/></g>`;
  });
  s += `<g${hg}>${face(c)}</g>`;
  return s + `</g></svg>`;
}

/* ---------- 品種の設定 ---------- */
const BLUE = '#4A8FD8', GREEN = '#5FAE6E', GOLD = '#E0A93B', COPPER = '#D9852E', DARK = '#3B3533';
const BREEDS = [
  // 短毛種
  { id: 'american-shorthair', name: 'アメリカンショートヘア', group: '短毛種', fur: '#D8D9D6', stripe: '#5C5F62', pattern: 'tabby', bold: true, tail: 'thin', tailRings: true, eye: GOLD, paw: '#F4F4F2', chest: '#8A8D90' },
  { id: 'british-shorthair', name: 'ブリティッシュショートヘア', group: '短毛種', fur: '#9BA5B0', tail: 'thin', tailW: 15, eye: COPPER, sx: 1.08, paw: '#AEB7C0', chest: '#6F7882', pawLine: '#6F7882' },
  { id: 'munchkin', name: 'マンチカン', group: '短毛種', fur: '#FBF7F0', pattern: 'bicolor', patch: '#F0B56E', earFur: '#F0B56E', tail: 'thin', tailFur: '#F0B56E', squat: .7, eye: GOLD, chest: '#C98A4A' },
  { id: 'siamese', name: 'シャム（サイアミーズ）', group: '短毛種', fur: '#F3E9DA', pattern: 'points', point: '#5E4336', earFur: '#5E4336', tail: 'thin', tailFur: '#5E4336', paw: '#5E4336', pawLine: '#3E2A28', eye: BLUE, whisker: '#FFFFFF', mouth: '#F3E9DA', sx: .93, earScale: 1.2, chest: '#B9A58C' },
  { id: 'russian-blue', name: 'ロシアンブルー', group: '短毛種', fur: '#8D99A6', tail: 'thin', eye: GREEN, sx: .95, earScale: 1.12, paw: '#A0ABB7', chest: '#66717C', pawLine: '#66717C' },
  { id: 'bengal', name: 'ベンガル', group: '短毛種', fur: '#E6AC62', stripe: '#5A3A1E', pattern: 'spots', rosette: true, spotFill: '#C98A42', tail: 'thin', tailRings: true, eye: GREEN, paw: '#F0C68C', muzzle: '#FBEBD3', chest: '#B5803F' },
  { id: 'abyssinian', name: 'アビシニアン', group: '短毛種', fur: '#DB9250', stripe: '#8A4E22', pattern: 'ticked', tail: 'thin', tailTip: '#8A4E22', eye: GOLD, sx: .95, earScale: 1.22, paw: '#E6A766', muzzle: '#F6DDBE', chest: '#A8642E' },
  { id: 'exotic-shorthair', name: 'エキゾチックショートヘア', group: '短毛種', fur: '#EDBE85', stripe: '#D49A56', pattern: 'tabby', flat: true, tail: 'thin', tailW: 15, eye: COPPER, sx: 1.08, earScale: .88, paw: '#F5D3A6', chest: '#C28A4A' },
  { id: 'scottish-fold', name: 'スコティッシュフォールド', group: '短毛種', fur: '#C4C9CF', stripe: '#8E959D', pattern: 'tabby', earType: 'fold', tail: 'thin', tailW: 15, eye: GOLD, sx: 1.07, paw: '#FFFFFF', muzzle: '#FFFFFF', belly: '#FFFFFF', chest: '#8E959D' },
  { id: 'singapura', name: 'シンガプーラ', group: '短毛種', fur: '#E2CDAA', stripe: '#8A6B45', pattern: 'ticked', seed: 23, tail: 'thin', tailW: 11, tailTip: '#6E5234', eye: '#A9BD5C', scale: .86, earScale: 1.2, paw: '#EFE0C5', muzzle: '#F7ECD9', chest: '#A88A60' },
  { id: 'egyptian-mau', name: 'エジプシャンマウ', group: '短毛種', fur: '#D2D3CF', stripe: '#45474A', pattern: 'spots', tail: 'thin', tailRings: true, eye: '#A5C957', paw: '#E3E4E0', chest: '#7F8286' },
  // 長毛種・中長毛種
  { id: 'persian', name: 'ペルシャ', group: '長毛種', long: true, fur: '#FBF7F1', flat: true, eye: COPPER, sx: 1.05, earScale: .82, chest: '#B9AFA2' },
  { id: 'maine-coon', name: 'メインクーン', group: '長毛種', long: true, fur: '#B98C60', stripe: '#5C3F2A', pattern: 'tabby', bold: true, earType: 'tuft', tailRings: true, eye: GOLD, scale: 1.05, bib: '#F1DFC6', paw: '#F1DFC6', muzzle: '#F1DFC6', chest: '#7A5638' },
  { id: 'ragdoll', name: 'ラグドール', group: '長毛種', long: true, fur: '#F6EDE0', pattern: 'points', point: '#6E4E3E', earFur: '#6E4E3E', tailFur: '#6E4E3E', paw: '#FFFFFF', bib: '#FFFFFF', eye: BLUE, whisker: '#FFFFFF', mouth: '#F6EDE0', scale: 1.03, chest: '#B9A58C' },
  { id: 'norwegian-forest-cat', name: 'ノルウェージャンフォレストキャット', group: '長毛種', long: true, fur: '#A8957C', stripe: '#54402E', pattern: 'tabby', earType: 'tuft', tailRings: true, eye: GREEN, bib: '#FFFFFF', paw: '#FFFFFF', muzzle: '#FFFFFF', scale: 1.03, chest: '#6F5B45' },
  { id: 'siberian', name: 'サイベリアン', group: '長毛種', long: true, fur: '#A3A7AA', stripe: '#4E5357', pattern: 'tabby', tailRings: true, eye: GREEN, sx: 1.05, bib: '#D9DBDC', paw: '#D9DBDC', chest: '#6A6F73' },
  { id: 'somali', name: 'ソマリ', group: '長毛種', long: true, fur: '#D88B4C', stripe: '#8A4A20', pattern: 'ticked', seed: 31, tailTip: '#7A3F1A', eye: GOLD, earScale: 1.2, bib: '#F3D5B0', paw: '#E8A86C', muzzle: '#F6DDBE', chest: '#A5602B' },
  { id: 'himalayan', name: 'ヒマラヤン', group: '長毛種', long: true, fur: '#F7EFE3', pattern: 'points', point: '#6B4B3C', earFur: '#6B4B3C', tailFur: '#6B4B3C', paw: '#6B4B3C', pawLine: '#3E2A28', flat: true, eye: BLUE, whisker: '#FFFFFF', mouth: '#F7EFE3', sx: 1.05, earScale: .82, chest: '#B9A58C' },
  { id: 'ragamuffin', name: 'ラガマフィン', group: '長毛種', long: true, fur: '#FBF8F3', pattern: 'bicolor', patch: '#A9825C', earFur: '#A9825C', tailFur: '#A9825C', eye: GOLD, scale: 1.04, chest: '#B9A58C' },
  { id: 'turkish-angora', name: 'ターキッシュアンゴラ', group: '長毛種', long: true, fur: '#FDFCFA', eye: [BLUE, GOLD], sx: .93, earScale: 1.15, chest: '#A9AEC0' },
  // 無毛・無尾・特徴的な形態
  { id: 'sphynx', name: 'スフィンクス', group: '特徴的な形態', fur: '#EBC7B4', chest: '#C99A86', pattern: 'wrinkle', tail: 'thin', tailW: 8, eye: '#9CC56A', whisker: 'none', earScale: 1.38, earRot: 8, sx: .94, paw: '#F2D5C5', nose: '#E8A49A', line: '#5A3A32' },
  { id: 'snowshoe', name: 'スノーシュー', group: '特徴的な形態', fur: '#EFE3D2', pattern: 'points', point: '#6A4A3A', blaze: '#FFFFFF', earFur: '#6A4A3A', tail: 'thin', tailFur: '#6A4A3A', paw: '#FFFFFF', eye: BLUE, whisker: '#FFFFFF', chest: '#B9A58C' },
  { id: 'japanese-bobtail', name: 'ジャパニーズボブテイル', group: '特徴的な形態', fur: '#FDFBF7', pattern: 'bicolor', patchL: '#EFA85A', patchR: DARK, bodyL: null, bodyR: null, earL: '#EFA85A', earR: DARK, tail: 'bob', tailFur: '#EFA85A', eye: GOLD, chest: '#B9AFA2' },
  { id: 'manx', name: 'マンクス', group: '特徴的な形態', fur: '#F0B878', stripe: '#D48E48', pattern: 'tabby', tail: 'none', eye: GOLD, sx: 1.08, paw: '#F8DDB8', muzzle: '#FBEBD3', chest: '#C28A4A' },
  { id: 'american-curl', name: 'アメリカンカール', group: '特徴的な形態', long: true, fur: '#A77B5C', stripe: '#5E3F2C', pattern: 'tabby', earType: 'curl', eye: GOLD, bib: '#F1DFC6', paw: '#F1DFC6', muzzle: '#F1DFC6', chest: '#74523A' },
  { id: 'cornish-rex', name: 'コーニッシュレックス', group: '特徴的な形態', fur: '#F1E8DC', chest: '#C3B19A', pattern: 'wavy', tail: 'thin', tailW: 9, eye: GOLD, sx: .9, earScale: 1.35 },
  { id: 'devon-rex', name: 'デボンレックス', group: '特徴的な形態', fur: '#B78F70', chest: '#8A6448', pattern: 'wavy', seed: 9, tail: 'thin', tailW: 10, eye: GREEN, sx: .96, earScale: 1.45, earRot: 16, paw: '#C9A487', pawLine: '#8A6448' },
  { id: 'selkirk-rex', name: 'セルカークレックス', group: '特徴的な形態', long: true, fur: '#EBDcc4'.toUpperCase(), chest: '#BFA57E', pattern: 'wavy', seed: 13, eye: GOLD, sx: 1.04 },
  // 非血統種（毛柄）
  { id: 'kijitora', name: 'キジトラ', group: '雑種（毛柄）', fur: '#A6835D', stripe: '#4A3626', pattern: 'tabby', tail: 'thin', tailRings: true, eye: GREEN, paw: '#B8966F', muzzle: '#E9D5B8', chest: '#6E5238', pawLine: '#6E5238' },
  { id: 'sabatora', name: 'サバトラ', group: '雑種（毛柄）', fur: '#C6CACE', stripe: '#4F555B', pattern: 'tabby', tail: 'thin', tailRings: true, eye: GREEN, paw: '#FFFFFF', muzzle: '#FFFFFF', belly: '#FFFFFF', chest: '#7C838A' },
  { id: 'chatora', name: '茶トラ', group: '雑種（毛柄）', fur: '#F3B76C', stripe: '#D98A3A', pattern: 'tabby', tail: 'thin', tailRings: true, eye: GOLD, paw: '#FBE3BD', muzzle: '#FDEFD9', chest: '#C98A4A' },
  { id: 'hachiware', name: '白黒（ハチワレ）', group: '雑種（毛柄）', fur: '#FDFBF7', pattern: 'bicolor', patch: DARK, earFur: DARK, tail: 'thin', tailFur: DARK, eye: GOLD, eyeLine: '#1E1512', chest: '#B9AFA2' },
  { id: 'mike', name: '三毛（ミケ）', group: '雑種（毛柄）', fur: '#FDFBF7', pattern: 'calico', orange: '#EFA85A', black: DARK, earL: '#EFA85A', earR: DARK, tail: 'thin', tailFur: DARK, tailTip: '#EFA85A', eye: GOLD, eyeLine: '#1E1512', chest: '#B9AFA2' },
  { id: 'sabi', name: 'サビ', group: '雑種（毛柄）', fur: '#4A3B34', pattern: 'tortie', orange: '#D9924E', tail: 'thin', eye: GOLD, eyeLine: '#1E1512', whisker: '#F3E7DC', mouth: '#F3E7DC', paw: '#5A4840', pawLine: '#2B211F', chest: '#2B211F', line: '#2B211F', earLine: '#9A5A52' },
];

root.nekoBreeds = BREEDS.map(b => ({ id: b.id, name: b.name, group: b.group }));
root.nekoBreed = (id, svgId) => { const b = BREEDS.find(x => x.id === id); return b ? draw(b, svgId || id) : ''; };
})(typeof window !== 'undefined' ? window : globalThis);
