// NEKO-ZUKAI のネコ（骨格から組み立てる版）
// 1) ポーズごとに骨格（関節の位置）を決める
// 2) 骨格に沿って、からだ・足・しっぽの輪郭を作る（関節ごとの太さを持つ）
// 3) 輪郭のふちに細い毛を描く。表面はなめらかなグラデーションとしま模様だけ
(function(root){
'use strict';

/* ---------- 色 ---------- */
const PAL = [
  { base:'#D2B08E', mid:'#C49C76', dark:'#A98260', light:'#E6D2BA', cream:'#F3E9DC', creamShade:'#DCCDBA' },
  { base:'#E7B27A', mid:'#D99C62', dark:'#BF7F45', light:'#F5D3A8', cream:'#FFF4E4', creamShade:'#EBD5B8' },
  { base:'#EBB47A', mid:'#DE9F62', dark:'#C38144', light:'#F7D7AC', cream:'#FFF6E8', creamShade:'#EDD8BB' },
  { base:'#EFB679', mid:'#E2A161', dark:'#C68243', light:'#F9DAAE', cream:'#FFF7EA', creamShade:'#EFDABD' },
  { base:'#F1B877', mid:'#E4A35F', dark:'#C88442', light:'#FADCB0', cream:'#FFF8EC', creamShade:'#F0DCBF' },
];
const INK = '#4A3226', NOSE = '#E3988B', NOSE_D = '#C97A70', TONGUE = '#EE8C8C';

/* ---------- 道具 ---------- */
let CUR_ID = 'neko';   // いま描いている SVG の id（ぼかしフィルタを指すため）
function rng(seed){ let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const f1 = n => (Math.round(n * 10) / 10).toString();
const lerp = (a, b, t) => a + (b - a) * t;

/* Catmull-Rom で制御点をなめらかな点列に */
function catmull(ctrl, closed, per = 10){
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
/* 点列を一定の間隔に並べ直す */
function resample(pts, step, closed){
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = [src[0]]; let carry = 0;
  for(let i = 1; i < src.length; i++){
    const a = src[i - 1], b = src[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while(d <= L){ const t = d / L; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); d += step; }
    carry = L - (d - step);
  }
  if(closed && out.length > 1){ const z = out[out.length - 1]; if(Math.hypot(z[0] - out[0][0], z[1] - out[0][1]) < step * .5) out.pop(); }
  return out;
}
const blob = (ctrl) => resample(catmull(ctrl, true, 12), 1.4, true);
function ellipsePts(cx, cy, rx, ry, rot = 0){
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for(let i = 0; i < 120; i++){ const a = i / 120 * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a); out.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return resample(out, 1.4, true);
}
/* 骨（関節の並び）に沿った筒。radii は関節ごとの太さ（半径） */
function limb(joints, radii){
  const per = 14, c = catmull(joints, false, per);
  const R = c.map((_, i) => { const t = Math.min(i / per, joints.length - 1.0001), k = Math.floor(t); return lerp(radii[k], radii[k + 1], t - k); });
  const L = [], Rt = [];
  for(let i = 0; i < c.length; i++){
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    L.push([c[i][0] + nx * R[i], c[i][1] + ny * R[i]]); Rt.push([c[i][0] - nx * R[i], c[i][1] - ny * R[i]]);
  }
  const cap = (ctr, r, from, to) => { const o = []; for(let k = 1; k < 12; k++){ const a = lerp(from, to, k / 12); o.push([ctr[0] + Math.cos(a) * r, ctr[1] + Math.sin(a) * r]); } return o; };
  const e = c[c.length - 1], e0 = c[c.length - 2], s = c[0], s1 = c[1];
  const ae = Math.atan2(e[1] - e0[1], e[0] - e0[0]), as = Math.atan2(s[1] - s1[1], s[0] - s1[0]);
  const pts = L.concat(cap(e, R[R.length - 1], ae + Math.PI / 2, ae - Math.PI / 2), Rt.reverse(), cap(s, R[0], as + Math.PI / 2, as - Math.PI / 2));
  return resample(pts, 1.4, true);
}
const pathOf = pts => 'M' + pts.map(p => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
function area(pts){ let a = 0; for(let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }

/* 輪郭のふちの細い毛。
   o.len: 毛の長さ / o.lenAt(nx,ny,x,y): 場所ごとの長さの倍率 / o.fall: 下へ流れる度合い(0〜1)
   o.skip(x,y): true の場所には生やさない（ほかのパーツに隠れる側など） */
function edgeHair(pts, o){
  const { col, col2, len = 2.6, fall = .25, op = .85, w = .36, seed = 1, lenAt = null, skip = null, every = 1, jit = .3 } = o;
  const r = rng(seed), sgn = area(pts) > 0 ? 1 : -1, n = pts.length;
  let d1 = '', d2 = '';
  for(let j = 0; j < n * 2; j += every){
    const i = j >> 1, half = j & 1;
    const p0 = pts[i], p1 = pts[(i + 1) % n];
    const p = half ? [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2] : p0, a = pts[(i - 2 + n) % n], b = pts[(i + 2) % n];
    if(skip && skip(p[0], p[1])) continue;
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty * sgn, ny = -tx * sgn;            // 外向き
    let ang = Math.atan2(ny, nx);
    let diff = Math.PI / 2 - ang; while(diff > Math.PI) diff -= 2 * Math.PI; while(diff < -Math.PI) diff += 2 * Math.PI;
    ang += diff * fall + (r() - .5) * jit;
    const L = len * (.45 + r() * .9) * (lenAt ? lenAt(nx, ny, p[0], p[1]) : 1);
    if(L < .3) continue;
    const x0 = p[0] - nx * 1.8, y0 = p[1] - ny * 1.8;
    const x2 = x0 + Math.cos(ang) * L, y2 = y0 + Math.sin(ang) * L;
    const bend = (r() - .5) * L * .4;
    const mx = (x0 + x2) / 2 - Math.sin(ang) * bend, my = (y0 + y2) / 2 + Math.cos(ang) * bend;
    const seg = `M${f1(x0)} ${f1(y0)}Q${f1(mx)} ${f1(my)} ${f1(x2)} ${f1(y2)}`;
    if(col2 && r() < .35) d2 += seg; else d1 += seg;
  }
  return `<path d="${d1}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${op}"/>` +
    (d2 ? `<path d="${d2}" stroke="${col2}" stroke-width="${w * .9}" fill="none" stroke-linecap="round" opacity="${op}"/>` : '');
}
/* 毛のある形 = 毛（後ろ） + 塗り + 毛（前、短め） */
function furry(pts, fill, o){
  return `<path d="${pathOf(pts)}" fill="none" stroke="${o.col}" stroke-width="2" opacity=".35" filter="url(#${CUR_ID}-b1)"/>` + edgeHair(pts, o) + `<path d="${pathOf(pts)}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width=".5" stroke-opacity=".5"` : ''}/>` +
    edgeHair(pts, { ...o, len: (o.len || 3.2) * .55, seed: (o.seed || 1) + 7, op: (o.op || .9) * .8 });
}
const clip = (id, pts) => `<clipPath id="${id}"><path d="${pathOf(pts)}"/></clipPath>`;
const soft = (d, col, w, op, id, blur = 'b2') => `<path d="${d}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${op}" filter="url(#${id}-${blur})"/>`;

/* ---------- defs ---------- */
function defs(id, p){
  return `<defs>
  <radialGradient id="${id}-fur" cx="50%" cy="25%" r="85%"><stop offset="0" stop-color="${p.light}"/><stop offset=".5" stop-color="${p.base}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
  <radialGradient id="${id}-head" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${p.light}"/><stop offset=".6" stop-color="${p.base}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
  <linearGradient id="${id}-leg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.base}"/><stop offset=".55" stop-color="${p.light}"/><stop offset="1" stop-color="${p.cream}"/></linearGradient>
  <linearGradient id="${id}-legUp" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${p.base}"/><stop offset=".6" stop-color="${p.light}"/><stop offset="1" stop-color="${p.cream}"/></linearGradient>
  <radialGradient id="${id}-cream" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="${p.cream}"/><stop offset="1" stop-color="${p.creamShade}"/></radialGradient>
  <radialGradient id="${id}-earin" cx="50%" cy="85%" r="85%"><stop offset="0" stop-color="#F8D4C6"/><stop offset="1" stop-color="#EDB2A0"/></radialGradient>
  <radialGradient id="${id}-muz" cx="50%" cy="42%" r="50%"><stop offset="0" stop-color="${p.cream}"/><stop offset=".5" stop-color="${p.cream}" stop-opacity=".85"/><stop offset=".85" stop-color="${p.light}" stop-opacity=".35"/><stop offset="1" stop-color="${p.light}" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}-lite" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${p.light}" stop-opacity=".9"/><stop offset="1" stop-color="${p.light}" stop-opacity="0"/></radialGradient>
  <linearGradient id="${id}-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E3A44"/><stop offset=".5" stop-color="#4E6474"/><stop offset="1" stop-color="#93ABB8"/></linearGradient>
  <linearGradient id="${id}-nose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0B0A4"/><stop offset="1" stop-color="${NOSE}"/></linearGradient>
  <radialGradient id="${id}-glass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".25"/><stop offset=".7" stop-color="#E8F2F6" stop-opacity=".12"/><stop offset="1" stop-color="#C9DCE4" stop-opacity=".35"/></radialGradient>
  <filter id="${id}-b1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1"/></filter>
  <filter id="${id}-b2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="${id}-b4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="${id}-b8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
</defs>`;
}

/* =========================================================
   頭（原点 0,0 を中心に描き、置き場所は transform で決める）
   ========================================================= */
const HEAD = [[0,-40],[22,-37],[36,-27],[43,-9],[47,8],[42,24],[27,34],[0,38],[-27,34],[-42,24],[-47,8],[-43,-9],[-36,-27],[-22,-37]];

function headEars(id, p, k){
  const one = s => {
    const X = x => x * s;
    const outer = blob([[X(-44), -10], [X(-42), -38], [X(-36), -58], [X(-31), -60], [X(-24), -50], [X(-10), -34], [X(-24), -20]]);
    const inner = blob([[X(-37), -22], [X(-37), -40], [X(-33), -52], [X(-29), -52], [X(-22), -44], [X(-14), -34], [X(-24), -28]]);
    let tuft = '';
    const r = rng(40 + s);
    for(let i = 0; i < 16; i++){
      const bx = X(-34 + i * 1.1), by = -26 - i * .6, L = 7 + r() * 9;
      tuft += `M${f1(bx)} ${f1(by)}q${f1(X(-2 + r() * 2))} ${f1(-L * .5)} ${f1(X(-3 + i * .35))} ${f1(-L)}`;
    }
    return `<g class="part-ear"${k.droop ? ` transform="rotate(${-16 * s} ${X(-28)} -30)"` : ''}>
      ${furry(outer, `url(#${id}-head)`, { col: p.mid, col2: p.light, len: 2, fall: 0, seed: 50 + s, jit: .3, stroke: p.dark })}
      <path d="${pathOf(inner)}" fill="url(#${id}-earin)"/>
      <path d="${tuft}" stroke="#FFF9F2" stroke-width=".45" fill="none" stroke-linecap="round" opacity=".9"/></g>`;
  };
  return one(1) + one(-1);
}

function headFace(id, p, k){
  const pts = blob(HEAD);
  // ほお毛は長く、下・外へ流す。頭の上は短く
  const lenAt = (nx, ny) => ny > 0 ? 1 + 2.2 * ny * (1 - Math.abs(ny) * .35) * (1 + Math.abs(nx)) : .55;
  return `<g class="part-head">
    ${edgeHair(pts, { col: p.mid, col2: p.light, len: 4 * k.hairLen, fall: .4, seed: 31, lenAt, jit: .45 * k.messy, op: .95 })}
    <path d="${pathOf(pts)}" fill="url(#${id}-head)"/>
    ${clip(id + '-ch', pts)}
    <g clip-path="url(#${id}-ch)">
      <ellipse cx="0" cy="40" rx="40" ry="9" fill="${p.dark}" opacity=".2" filter="url(#${id}-b4)"/>
      <ellipse cx="0" cy="4" rx="8" ry="16" fill="url(#${id}-lite)"/>
      <ellipse cx="0" cy="24" rx="24" ry="17" fill="url(#${id}-muz)"/>
      ${soft('M-12 -38 q2 10 5 17', p.dark, 2.8, .42, id)}${soft('M-4 -41 q1 11 2 19', p.dark, 2.8, .42, id)}${soft('M4 -41 q-1 11 -2 19', p.dark, 2.8, .42, id)}${soft('M12 -38 q-2 10 -5 17', p.dark, 2.8, .42, id)}
      ${soft('M-33 4 q-8 2 -14 0', p.dark, 2.2, .38, id)}${soft('M-32 11 q-8 3 -13 4', p.dark, 2, .32, id)}${soft('M33 4 q8 2 14 0', p.dark, 2.2, .38, id)}${soft('M32 11 q8 3 13 4', p.dark, 2, .32, id)}
      ${[[-11, 21], [-7, 24], [-12, 26], [11, 21], [7, 24], [12, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="${p.dark}" opacity=".5"/>`).join('')}
    </g>
    ${edgeHair(pts, { col: p.light, len: 1.8 * k.hairLen, fall: .4, seed: 33, lenAt, jit: .4 * k.messy, op: .7, every: 2, w: .35 })}
  </g>`;
}

/* 猫目（アーモンド形で目じりが上がる）。kind: open / tired / closed / happy */
function headEyes(id, p, kind){
  const one = (x, s) => {
    const y = 3;
    const I = [x - 8.5 * s, y + 2], O = [x + 9.5 * s, y - 2.4], up = [x - .5 * s, y - 9.5], lo = [x + 1.5 * s, y + 8];
    const pt = a => `${f1(a[0])} ${f1(a[1])}`;
    const almond = `M${pt(I)}Q${pt(up)} ${pt(O)}Q${pt(lo)} ${pt(I)}Z`;
    const ink = (d, w) => `<path d="${d}" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(kind === 'closed') return ink(`M${pt(I)}Q${x + 1 * s} ${y + 5} ${pt(O)}`, 1.9) + ink(`M${pt(O)}l${2 * s} -1.2`, 1.2);
    if(kind === 'happy') return ink(`M${f1(I[0])} ${f1(I[1] + 1.5)}Q${x} ${y - 7} ${f1(O[0])} ${f1(O[1] + 1.5)}`, 2.1);
    const cid = `${id}-e${s > 0 ? 'r' : 'l'}`;
    const tired = kind === 'tired';
    return `<g class="part-eye">
      ${tired ? '' : `<ellipse cx="${x}" cy="${y}" rx="13" ry="10" fill="url(#${id}-lite)"/>`}
      <clipPath id="${cid}"><path d="${almond}"/></clipPath>
      <path d="${almond}" fill="url(#${id}-iris)"/>
      <g clip-path="url(#${cid})">
        <circle cx="${x + .4 * s}" cy="${y}" r="7.5" fill="none" stroke="#2A3138" stroke-width="1.5" opacity=".55"/>
        <path d="M${x + .4 * s} ${y - 7}C${x + 4 * s} ${y - 3} ${x + 4 * s} ${y + 3} ${x + .4 * s} ${y + 7}C${x - 3.2 * s} ${y + 3} ${x - 3.2 * s} ${y - 3} ${x + .4 * s} ${y - 7}Z" fill="#0E1013"/>
        ${soft(`M${pt(I)}Q${pt(up)} ${pt(O)}`, '#1B1410', 4, .5, id)}
        <ellipse cx="${x - 2.8}" cy="${y - (tired ? -1.5 : 3.5)}" rx="2.2" ry="1.7" fill="#fff"/>
        <circle cx="${x + 3}" cy="${y + 3}" r=".8" fill="#fff" opacity=".85"/>
        ${tired ? `<path d="M${f1(I[0] - 3 * s)} ${y - 14}L${f1(O[0] + 3 * s)} ${y - 14}L${f1(O[0] + 3 * s)} ${f1(O[1] + 2.4)}Q${x} ${y + 1} ${f1(I[0] - 3 * s)} ${f1(I[1])}Z" fill="${p.base}"/>` : ''}
      </g>
      ${tired ? ink(`M${pt(I)}Q${x} ${y + 1} ${f1(O[0])} ${f1(O[1] + 2.4)}`, 1.7) : ink(`M${pt(I)}Q${pt(up)} ${pt(O)}`, 1.7)}
      ${ink(`M${pt(O)}Q${pt(lo)} ${pt(I)}`, .9)}${ink(`M${pt(I)}l${-2 * s} 2`, 1.2)}${ink(`M${pt(O)}l${1.8 * s} -.6`, 1.1)}
    </g>`;
  };
  return one(-17, -1) + one(17, 1);
}

function headNoseMouth(id, kind){
  const nose = `<path d="M-4.2 11Q0 9.4 4.2 11Q3 15 0 16.3Q-3 15 -4.2 11Z" fill="url(#${id}-nose)" stroke="${NOSE_D}" stroke-width=".5"/><ellipse cx="-1.2" cy="11.4" rx="1.3" ry=".6" fill="#fff" opacity=".7"/>`;
  const y = 16.3;
  const line = (d, w = 1.2) => `<path d="${d}" stroke="${INK}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  let m;
  if(kind === 'frown') m = line(`M0 ${y}v2.4`) + line(`M-5 ${y + 6.5}q5 -4 10 0`);
  else if(kind === 'open') m = line(`M0 ${y}v2`) + `<path d="M-8 ${y + 2.4}Q0 ${y + 1.6} 8 ${y + 2.4}Q6.5 ${y + 13} 0 ${y + 13.8}Q-6.5 ${y + 13} -8 ${y + 2.4}Z" fill="#B65A5E" stroke="${INK}" stroke-width="1"/>
      <path d="M-5 ${y + 9}Q0 ${y + 6} 5 ${y + 9}Q4 ${y + 13} 0 ${y + 13}Q-4 ${y + 13} -5 ${y + 9}Z" fill="${TONGUE}"/>
      <path d="M-6.4 ${y + 2.8}l1.1 2.9l1.1 -2.9M4.2 ${y + 2.8}l1.1 2.9l1.1 -2.9" fill="#fff"/>`;
  else if(kind === 'lick') m = line(`M0 ${y}v2`) + line(`M0 ${y + 2}q-3.4 3.4 -6.8 1.2`) + `<path d="M.8 ${y + 2.4}q3.4 .8 5 4q-3.4 2.4 -5.8 -.8z" fill="${TONGUE}" stroke="${INK}" stroke-width=".6"/>`;
  else m = line(`M0 ${y}v2`) + line(`M0 ${y + 2}q-3.4 3.6 -6.8 1.2`) + line(`M0 ${y + 2}q3.4 3.6 6.8 1.2`);
  return `<g class="part-nose">${nose}</g><g class="part-mouth">${m}</g>`;
}

function headWhiskers(k){
  let s = '';
  [-1, 1].forEach(d => {
    [[-6, 38], [0, 40], [7, 36], [12, 30]].forEach(([dy, L], i) => {
      s += `<path d="M${11 * d} ${19 + i * 2}q${L * .5 * d} ${dy - 3} ${L * d} ${dy}" stroke="#fff" stroke-width=".6" fill="none" stroke-linecap="round" opacity="${.9 * k.wop}"/>`;
    });
    s += `<path d="M${14 * d} -10q${7 * d} -7 ${12 * d} -9" stroke="#fff" stroke-width=".5" fill="none" opacity="${.7 * k.wop}"/>`;
  });
  return `<g class="part-whisker">${s}</g>`;
}

function headKit(id, p, k, eye, mouth){
  return headEars(id, p, k) + headFace(id, p, k) + headEyes(id, p, eye) + headNoseMouth(id, mouth) + headWhiskers(k);
}

/* =========================================================
   骨格（ポーズごと）。座標は viewBox 0 0 240 230、地面は y=212
   ========================================================= */
const SK = {
  sit: {
    skull: [120, 80], neck: [120, 118],
    shL: [100, 128], elL: [101, 160], wrL: [104, 194], pawL: [104, 204],
    shR: [140, 128], elR: [139, 160], wrR: [136, 194], pawR: [136, 204],
    pelvis: [120, 182], kneeL: [81, 188], hockL: [70, 205], toeL: [86, 209],
    kneeR: [159, 188], hockR: [170, 205], toeR: [154, 209],
    tail: [[148, 208], [176, 212], [200, 207], [213, 192], [214, 172], [207, 158]],
    spine: [[120, 118], [120, 140], [120, 165], [120, 182]],
  },
  groom: {
    skull: [117, 82], neck: [120, 118], headRot: 9,
    shL: [100, 128], elL: [101, 160], wrL: [104, 194], pawL: [104, 204],
    shR: [140, 128], elR: [146, 158], wrR: [134, 118], pawR: [126, 106],
    pelvis: [120, 182], kneeL: [81, 188], hockL: [70, 205], toeL: [86, 209],
    kneeR: [159, 188], hockR: [170, 205], toeR: [154, 209],
    tail: [[148, 208], [176, 212], [200, 207], [213, 192], [214, 172], [207, 158]],
    spine: [[120, 118], [120, 140], [120, 165], [120, 182]],
  },
  liquid: {
    bowl: [120, 140], bowlR: 74, rimY: 92, rimRX: 56, rimRY: 9,
    skull: [114, 82], headRot: -14, headScale: .84, neck: [122, 112],
    shL: [106, 124], elL: [96, 148], wrL: [94, 160], pawL: [96, 168],
    spine: [[122, 112], [156, 126], [176, 152], [166, 186], [130, 204], [92, 200]],
    pelvis: [92, 200],
    tail: [[88, 202], [66, 190], [60, 166], [70, 146]],
  },
};

/* 骨格だけを描く（確認用） */
function bones(name){
  const s = SK[name], L = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`, J = a => `<circle cx="${a[0]}" cy="${a[1]}" r="2.4"/>`;
  let d = '';
  const chain = arr => arr.slice(1).map((q, i) => L(arr[i], q)).join('') + arr.map(J).join('');
  d += chain([s.skull, s.neck]) + chain(s.spine);
  if(s.shL) d += chain([s.neck, s.shL, s.elL, s.wrL, s.pawL]);
  if(s.shR) d += chain([s.neck, s.shR, s.elR, s.wrR, s.pawR]);
  if(s.kneeL) d += chain([s.pelvis, s.kneeL, s.hockL, s.toeL]) + chain([s.pelvis, s.kneeR, s.hockR, s.toeR]);
  d += chain([s.pelvis, ...s.tail]);
  const skull = `<ellipse cx="${s.skull[0]}" cy="${s.skull[1] - 4}" rx="30" ry="28" fill="none"/>`;
  const rib = name === 'liquid' ? `<ellipse cx="150" cy="148" rx="26" ry="30" transform="rotate(-30 150 148)" fill="none"/>` : `<ellipse cx="120" cy="148" rx="26" ry="30" fill="none"/>`;
  const bowl = name === 'liquid' ? `<circle cx="${s.bowl[0]}" cy="${s.bowl[1]}" r="${s.bowlR}" fill="none" stroke-dasharray="3 3" stroke="#9BB7C4"/>` : '';
  return `<g class="skeleton" stroke="#B5523B" stroke-width="2" fill="#B5523B" stroke-linecap="round">${bowl}<g opacity=".9">${d}</g><g stroke-width="1.2" stroke-dasharray="2 2" opacity=".8">${skull}${rib}</g></g>`;
}

/* =========================================================
   すわり（ぼさぼさ・ふつう・にっこり・毛づくろい）
   ========================================================= */
function sitTorso(id, p, k, s){
  const pts = blob([[104, 114], [90, 126], [84, 148], [80, 174], [82, 204], [100, 212], [140, 212], [158, 204], [160, 174], [156, 148], [150, 126], [136, 114]]);
  return `<g class="part-body">${furry(pts, `url(#${id}-fur)`, { col: p.mid, col2: p.light, len: 3.4 * k.hairLen, fall: .5, seed: 11, jit: .45 * k.messy, skip: (x, y) => y > 206 })}
    ${clip(id + '-cb', pts)}<g clip-path="url(#${id}-cb)">
      <ellipse cx="80" cy="165" rx="12" ry="40" fill="${p.dark}" opacity=".28" filter="url(#${id}-b8)"/><ellipse cx="160" cy="165" rx="12" ry="40" fill="${p.dark}" opacity=".28" filter="url(#${id}-b8)"/>
      ${[0, 1, 2].map(i => soft(`M${84 + i * 2} ${134 + i * 17}q10 3 15 11`, p.dark, 4, .38, id) + soft(`M${156 - i * 2} ${134 + i * 17}q-10 3 -15 11`, p.dark, 4, .38, id)).join('')}
    </g></g>`;
}
function sitHaunch(id, p, k, s, side){
  const kn = side < 0 ? s.kneeL : s.kneeR;
  const pts = ellipsePts(kn[0], kn[1] + 2, 27, 22, side * -.15);
  const foot = limb([side < 0 ? s.hockL : s.hockR, side < 0 ? s.toeL : s.toeR], [6.5, 6]);
  return `<g class="part-haunch">${furry(pts, `url(#${id}-fur)`, { col: p.mid, col2: p.light, len: 3.4 * k.hairLen, fall: .6, seed: 20 + side, jit: .45 * k.messy, skip: (x, y) => y > 205 || (side < 0 ? x > kn[0] + 4 : x < kn[0] - 4) || y < kn[1] - 12 && (side < 0 ? x > kn[0] - 6 : x < kn[0] + 6) })}
    ${clip(id + '-chn' + side, pts)}<g clip-path="url(#${id}-chn${side})">${soft(`M${kn[0] - 14 * side} ${kn[1] - 12}q${10 * side} -7 ${24 * side} 0`, p.dark, 3.5, .3, id)}
      <ellipse cx="${kn[0] + 10 * side}" cy="${kn[1] + 6}" rx="10" ry="14" fill="${p.mid}" opacity=".35" filter="url(#${id}-b4)"/></g></g>
    <g class="part-hindfoot">${furry(foot, `url(#${id}-cream)`, { col: p.cream, len: 1.6, fall: .2, seed: 24 + side, stroke: p.creamShade })}
      <path d="M${(side < 0 ? s.toeL : s.toeR)[0] - 2} ${(side < 0 ? s.toeL : s.toeR)[1] - 3}v5M${(side < 0 ? s.toeL : s.toeR)[0] + 2 * side * -1 - 4 * side} ${(side < 0 ? s.toeL : s.toeR)[1] - 3}v5" stroke="${p.creamShade}" stroke-width=".9" stroke-linecap="round"/></g>`;
}
function sitTail(id, p, k, s){
  const pts = limb(s.tail, [8, 8.5, 8, 7.5, 7, 6.2]);
  return `<g class="part-tail tail">${furry(pts, `url(#${id}-fur)`, { col: p.mid, col2: p.light, len: 3 * k.hairLen, fall: .1, seed: 61, jit: .5 * k.messy, skip: (x, y) => x < 156 && y > 200 })}
    ${clip(id + '-ct', pts)}<g clip-path="url(#${id}-ct)">${[[182, 212], [204, 204], [214, 186], [212, 168]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="9" transform="rotate(${[-80, -45, -10, 15][i]} ${x} ${y})" fill="${p.dark}" opacity=".35" filter="url(#${id}-b1)"/>`).join('')}</g></g>`;
}
function foreleg(id, p, k, J, side, up = false){
  const pts = limb(J, up ? [12, 9.5, 7] : [12, 9.5, 6.6, 7]);
  return `<g class="part-leg">${furry(pts, `url(#${id}-${up ? 'legUp' : 'leg'})`, { col: up ? p.light : p.mid, col2: p.cream, len: 2 * k.hairLen, fall: .3, seed: 70 + side, jit: .4 * k.messy, stroke: up ? p.dark : null, skip: (x, y) => !up && y < J[0][1] + 18 })}
    ${clip(id + '-cl' + side, pts)}<g clip-path="url(#${id}-cl${side})">${soft(`M${J[1][0] - 8 * side} ${J[1][1] - 10}L${J[2][0] - 7 * side} ${J[2][1]}`, p.mid, 3, .45, id)}</g></g>`;
}
function frontPaw(id, p, x, y, rot = 0, beans = false){
  const pts = ellipsePts(x, y, 11, 6.6, rot * Math.PI / 180);
  return `<g class="part-paw">${furry(pts, `url(#${id}-cream)`, { col: p.cream, len: 1.6, fall: .1, seed: x, stroke: p.creamShade })}
    <g transform="rotate(${rot} ${x} ${y})"><path d="M${x - 3.6} ${y - 3}v5M${x + 3.6} ${y - 3}v5" stroke="${p.creamShade}" stroke-width=".9" stroke-linecap="round"/>
    ${beans ? `<ellipse cx="${x}" cy="${y + 2}" rx="3" ry="2" fill="#F2B3A6"/><circle cx="${x - 5}" cy="${y - 1}" r="1.4" fill="#F2B3A6"/><circle cx="${x - 1.8}" cy="${y - 3.4}" r="1.4" fill="#F2B3A6"/><circle cx="${x + 1.8}" cy="${y - 3.4}" r="1.4" fill="#F2B3A6"/><circle cx="${x + 5}" cy="${y - 1}" r="1.4" fill="#F2B3A6"/>` : ''}</g></g>`;
}
function chestBib(id, p, k){
  const pts = blob([[120, 106], [101, 114], [94, 130], [100, 148], [111, 164], [120, 171], [129, 164], [140, 148], [146, 130], [139, 114]]);
  return `<g class="part-chest">${furry(pts, `url(#${id}-cream)`, { col: p.cream, col2: '#fff', len: 3.6 * k.hairLen, fall: .55, seed: 81, jit: .5 * k.messy, skip: (x, y) => y < 116 })}</g>`;
}
function placeHead(id, p, k, s, eye, mouth){
  const [x, y] = s.skull, r = s.headRot || 0, sc = s.headScale || 1;
  return `<g class="head-group" transform="translate(${x} ${y}) rotate(${r}) scale(${sc})">${headKit(id, p, k, eye, mouth)}</g>`;
}

function poseSit(id, p, k, lv, opt = {}){
  const s = SK.sit;
  const eye = opt.eye || (lv === 0 ? 'tired' : lv === 3 ? 'happy' : 'open'), mouth = opt.mouth || (lv === 0 ? 'frown' : lv === 3 ? 'open' : 'normal');
  return `<ellipse cx="120" cy="213" rx="80" ry="6" fill="#E5D3BD"/>` +
    sitTorso(id, p, k, s) + sitHaunch(id, p, k, s, -1) + sitHaunch(id, p, k, s, 1) + sitTail(id, p, k, s) +
    foreleg(id, p, k, [s.shL, s.elL, s.wrL, s.pawL], -1) + foreleg(id, p, k, [s.shR, s.elR, s.wrR, s.pawR], 1) +
    frontPaw(id, p, s.pawL[0], s.pawL[1] + 1) + frontPaw(id, p, s.pawR[0], s.pawR[1] + 1) +
    chestBib(id, p, k) + placeHead(id, p, k, s, eye, mouth);
}

function poseGroom(id, p, k){
  const s = SK.groom;
  return `<ellipse cx="120" cy="213" rx="80" ry="6" fill="#E5D3BD"/>` +
    sitTorso(id, p, k, s) + sitHaunch(id, p, k, s, -1) + sitHaunch(id, p, k, s, 1) + sitTail(id, p, k, s) +
    foreleg(id, p, k, [s.shL, s.elL, s.wrL, s.pawL], -1) + frontPaw(id, p, s.pawL[0], s.pawL[1] + 1) +
    chestBib(id, p, k) + placeHead(id, p, k, s, 'closed', 'lick') +
    `<g class="lick-paw">${foreleg(id, p, k, [s.elR, s.wrR, s.pawR], 1, true)}${frontPaw(id, p, s.pawR[0] + 1, s.pawR[1] - 1, -40, true)}</g>`;
}

/* =========================================================
   液体ネコ（ガラスの金魚鉢にすっぽり）
   ========================================================= */
function poseLiquid(id, p, k, opt = {}){
  const s = SK.liquid, [bx, by] = s.bowl, R = s.bowlR;
  const inner = ellipsePts(bx, by + 2, R - 4, R - 6);
  // 鉢の中いっぱいに広がったからだ（鉢の形に沿う）
  const body = blob([[74, 104], [108, 96], [150, 98], [178, 116], [192, 148], [186, 184], [158, 206], [120, 214], [82, 206], [56, 184], [48, 148], [58, 118]]);
  const belly = blob([[94, 112], [126, 108], [144, 124], [142, 160], [128, 192], [102, 200], [78, 186], [72, 150], [80, 124]]);
  const tail = limb(s.tail, [7.5, 7.5, 7, 6.2]);
  const arm = limb([s.shL, s.elL, s.wrL], [11, 9, 7]);
  const rim = (half) => { const a0 = half === 'back' ? Math.PI : 0, a1 = half === 'back' ? 2 * Math.PI : Math.PI;
    let d = ''; for(let i = 0; i <= 40; i++){ const a = lerp(a0, a1, i / 40); d += (i ? 'L' : 'M') + f1(bx + s.rimRX * Math.cos(a)) + ' ' + f1(s.rimY + s.rimRY * Math.sin(a)); } return d; };
  const bowlD = (() => { const top = Math.asin((by - s.rimY) / R); let d = ''; const a0 = Math.PI - top, a1 = 2 * Math.PI + top;
    for(let i = 0; i <= 80; i++){ const a = lerp(a0, a1, i / 80); d += (i ? 'L' : 'M') + f1(bx + R * Math.cos(a)) + ' ' + f1(by - R * Math.sin(a)); } return d; })();
  return `<ellipse cx="${bx}" cy="214" rx="70" ry="6" fill="#E5D3BD"/>
    <path d="${rim('back')}" stroke="#B9CDD6" stroke-width="2" fill="none" opacity=".8"/>
    ${clip(id + '-bowl', inner)}
    <g clip-path="url(#${id}-bowl)">
      <g class="part-lbody">${furry(body, `url(#${id}-fur)`, { col: p.mid, col2: p.light, len: 3.4, fall: .3, seed: 91 })}
        ${clip(id + '-clb', body)}<g clip-path="url(#${id}-clb)">
          <ellipse cx="170" cy="160" rx="18" ry="46" fill="${p.dark}" opacity=".3" filter="url(#${id}-b8)"/>
          ${[0, 1, 2].map(i => soft(`M${150 + i * 9} ${112 + i * 22}q12 6 18 16`, p.dark, 4.5, .35, id)).join('')}
        </g></g>
      <g class="part-lbelly">${furry(belly, `url(#${id}-cream)`, { col: p.cream, col2: '#fff', len: 3.2, fall: .3, seed: 93 })}</g>
      <g class="part-ltail">${furry(tail, `url(#${id}-fur)`, { col: p.mid, col2: p.light, len: 2.8, fall: .1, seed: 95 })}
        ${clip(id + '-clt', tail)}<g clip-path="url(#${id}-clt)">${[[78, 190], [70, 172]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="8" transform="rotate(50 ${x} ${y})" fill="${p.dark}" opacity=".35" filter="url(#${id}-b1)"/>`).join('')}</g></g>
      <g class="part-larm">${furry(arm, `url(#${id}-leg)`, { col: p.light, col2: p.cream, len: 2, fall: .3, seed: 97, stroke: p.dark })}</g>
      ${frontPaw(id, p, s.pawL[0], s.pawL[1], 10, true)}
    </g>
    <g class="part-glass">
      <path d="${bowlD}" fill="url(#${id}-glass)" stroke="#A9C3CE" stroke-width="1.6" stroke-opacity=".75"/>
      <path d="M${bx - 52} ${by - 20}Q${bx - 58} ${by + 14} ${bx - 40} ${by + 44}" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/>
      <path d="M${bx - 44} ${by + 52}q6 6 12 9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>
      <path d="M${bx + 40} ${by - 34}q12 10 16 26" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".45"/>
      <path d="${rim('front')}" stroke="#A9C3CE" stroke-width="2.2" fill="none"/>
      <path d="${rim('front')}" stroke="#fff" stroke-width=".8" fill="none" opacity=".8" transform="translate(0 -1.2)"/>
    </g>
    ${placeHead(id, p, k, s, opt.eye || 'open', opt.mouth || 'normal')}`;
}

function sparkles(){
  const star = (x, y, r, d) => `<path class="twinkle" style="animation-delay:${d}s" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#F4C452"/>`;
  return `<g class="part-sparkle">${star(30, 40, 8, 0)}${star(210, 34, 7, .5)}${star(26, 124, 5, 1)}${star(216, 112, 5, 1.4)}</g>`;
}

/* 段階ごとの毛の具合 */
const KNOB = [
  { hairLen: 1.9, messy: 2.4, wop: .5, droop: true },
  { hairLen: 1, messy: 1, wop: 1 },
  { hairLen: .95, messy: .9, wop: 1 },
  { hairLen: .95, messy: .85, wop: 1 },
  { hairLen: .95, messy: .85, wop: 1 },
];

/* lv: 0 ぼさぼさ / 1 ふつう / 2 毛づくろい / 3 にっこり / 4 液体ネコ。
   opt.eye / opt.mouth でその日の表情に差し替えられる（毛づくろいは除く）。opt.bones で骨格を重ねる */
function cat(lv, id = 'neko', opt = {}){
  const p = PAL[lv], k = KNOB[lv]; CUR_ID = id;
  let s = `<svg class="cat" viewBox="0 0 240 230" role="img" aria-label="ネコ">` + defs(id, p);
  s += lv === 4 ? poseLiquid(id, p, k, opt) : lv === 2 ? poseGroom(id, p, k) : poseSit(id, p, k, lv, opt);
  if(lv >= 3) s += sparkles();
  if(opt.bones) s += `<g opacity=".75">${bones(lv === 4 ? 'liquid' : lv === 2 ? 'groom' : 'sit')}</g>`;
  return s + `</svg>`;
}

/* パーツ確認用 */
const PARTS = {
  '頭（全ポーズ共通）': {
    '耳': (id, p, k) => `<g transform="translate(120 100)">${headEars(id, p, k)}</g>`,
    '顔の形＋口まわり＋しま': (id, p, k) => `<g transform="translate(120 100)">${headFace(id, p, k)}</g>`,
    '目（ひらく）': (id, p) => `<g transform="translate(120 100)"><rect x="-32" y="-12" width="64" height="26" fill="${p.base}"/>${headEyes(id, p, 'open')}</g>`,
    '目（ねむい）': (id, p) => `<g transform="translate(120 100)"><rect x="-32" y="-12" width="64" height="26" fill="${p.base}"/>${headEyes(id, p, 'tired')}</g>`,
    '目（とじる・にっこり）': (id, p) => `<g transform="translate(120 90)"><rect x="-32" y="-10" width="64" height="20" fill="${p.base}"/>${headEyes(id, p, 'closed')}</g><g transform="translate(120 120)"><rect x="-32" y="-10" width="64" height="20" fill="${p.base}"/>${headEyes(id, p, 'happy')}</g>`,
    '鼻と口（ふつう・ひらく・なめる）': (id, p) => ['normal', 'open', 'lick'].map((m, i) => `<g transform="translate(${80 + i * 40} 100)"><rect x="-14" y="6" width="28" height="30" fill="${p.cream}"/>${headNoseMouth(id, m)}</g>`).join(''),
  },
  'すわり': {
    '骨格': () => bones('sit'),
    'からだ': (id, p, k) => sitTorso(id, p, k, SK.sit),
    'うしろ足（もも＋足先）': (id, p, k) => sitHaunch(id, p, k, SK.sit, -1) + sitHaunch(id, p, k, SK.sit, 1),
    'しっぽ': (id, p, k) => sitTail(id, p, k, SK.sit),
    '前足': (id, p, k) => { const s = SK.sit; return foreleg(id, p, k, [s.shL, s.elL, s.wrL, s.pawL], -1) + foreleg(id, p, k, [s.shR, s.elR, s.wrR, s.pawR], 1) + frontPaw(id, p, s.pawL[0], s.pawL[1] + 1) + frontPaw(id, p, s.pawR[0], s.pawR[1] + 1); },
    'むね毛': (id, p, k) => chestBib(id, p, k),
  },
  '毛づくろい': {
    '骨格': () => bones('groom'),
    'あげた前足（ひじから先）': (id, p, k) => { const s = SK.groom; return foreleg(id, p, k, [s.elR, s.wrR, s.pawR], 1, true) + frontPaw(id, p, s.pawR[0] + 1, s.pawR[1] - 1, -40, true); },
    '頭（かたむけ）': (id, p, k) => placeHead(id, p, k, SK.groom, 'closed', 'lick'),
  },
  '液体ネコ': {
    '骨格': () => bones('liquid'),
    '鉢の中のからだ・おなか・しっぽ・前足': (id, p, k) => poseLiquid(id, p, k).split('<g class="part-glass">')[0].replace(/<path d="M[^"]*" stroke="#B9CDD6"[^>]*>/, '') + '</g>',
    'ガラスの鉢': (id, p, k) => '<g class="part-glass">' + poseLiquid(id, p, k).split('<g class="part-glass">')[1].split('<g class="head-group"')[0],
  },
};
function part(group, name, id = 'pt', lv = 1){
  const p = PAL[lv], k = KNOB[lv]; CUR_ID = id;
  return `<svg viewBox="0 0 240 230">` + defs(id, p) + '<g>' + PARTS[group][name](id, p, k) + '</g></svg>';
}

/* 頭だけ（アイコンなどに使う）。原点が頭の中心。defs も一緒に返す */
function headOnly(lv = 1, id = 'hd', eye = 'open', mouth = 'normal'){
  const p = PAL[lv], k = KNOB[lv]; CUR_ID = id;
  return defs(id, p) + headKit(id, p, k, eye, mouth);
}

root.nekoCat = cat;
root.nekoHead = headOnly;
root.nekoPart = part;
root.nekoParts = Object.fromEntries(Object.entries(PARTS).map(([g, o]) => [g, Object.keys(o)]));
})(typeof window !== 'undefined' ? window : globalThis);
