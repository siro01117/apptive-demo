// APPTIVE 체험판 (file://) — 원본 app.js 를 pack.py 가 변환한 것.
(function () {
'use strict';
const DATA = window.APPTIVE_DATA || { index: { constellations: [] }, lessons: {} };
const LS = 'apptive:';
function getSetting(key, def) {
  try { const v = localStorage.getItem(LS + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
}
function setSetting(key, val) {
  try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch (e) { /* 저장 못 해도 계속 */ }
  return true;
}
async function call(name, ...args) {
  switch (name) {
    case 'apptive_index': return JSON.parse(JSON.stringify(DATA.index));
    case 'apptive_read': {
      const [cid, lid] = args; const L = DATA.lessons[cid + '/' + lid];
      if (!L) throw new Error('레슨 없음: ' + cid + '/' + lid);
      return { lesson: JSON.parse(JSON.stringify(L)), assets: 'content/' + encodeURIComponent(cid) + '/' + encodeURIComponent(lid) + '/assets/', asset_files: [], mtime: 0, path: '' };
    }
    case 'shell_get_setting': return getSetting(args[0], args[1]);
    case 'shell_set_setting': return setSetting(args[0], args[1]);
    default: throw new Error('체험판에서는 쓸 수 없어요');
  }
}
// kit.js: 밝은/다크 (설정 없으면 시스템)
(function () {
  const system = matchMedia('(prefers-color-scheme: dark)');
  let chosen = null;
  const apply = (t) => { chosen = t === 'light' || t === 'dark' ? t : null; document.documentElement.dataset.theme = chosen || (system.matches ? 'dark' : 'light'); };
  try { system.addEventListener('change', () => { if (!chosen) apply(null); }); } catch (e) { /* 옛 브라우저 */ }
  apply(getSetting('theme', null));
})();
// APPTIVE 렌더러 — 별자리 벤또 → 별(레슨) 목록 → 폰 틀 안에서 레슨 재생.
// 폰 안 화면은 FigCraft "콘텐츠 견본 별은 왜 빛날까 v2 › 14 레슨 v5 와프" 24장의 좌표 · 글자 · 색을 그대로 쓴다.
// 와프 원본 값은 콘텐츠 폴더 _레이아웃/와프_v5.json (읽기용 덤프). 아래 상수는 그 값이다.

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const STAR_D = 'M12 2.5l2.6 6 6.4.6-4.8 4.3 1.4 6.4L12 16.5 6.4 19.8l1.4-6.4L3 9.1l6.4-.6z';
const starSvg = (cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'star ' + (cls || '')); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', STAR_D); s.appendChild(p); return s; };
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---- 와프 값
const W = 402, H = 874;
const C = { ink: '#111111', mid: '#555555', dim: '#8A8A8A', line: '#E2E2E2', line2: '#D4D4D4', panel: '#DADADA', pick: '#1E5BB8', ok: '#2E7D32', label: '#272757', quote: '#D2D2DA', white: '#FFFFFF' };
const ICON = (n) => `icons/${n}.svg`; // _레이아웃/svg
const X0 = 24, CW = 354;            // 본문 왼쪽 · 폭
const BTN_Y = 784, BTN_H = 56;      // 아래 버튼
const BODY_TOP = 96;                // 머리(뒤로가기 · 구간 막대 · 구간 글) 아래
const QUIZ_CENTER = 441, TALK_CENTER = 469; // 퀴즈 블록 · 설명 블록의 세로 중심 (와프 실측)
const LH = { 12: 18, 13: 20, 15: 22, 17: 26, 20: 30, 22: 32, 24: 36, 48: 48 };

let index = null, progress = {}, cur = null;

async function loadProgress() { progress = (await call('shell_get_setting', 'apptive_progress', null)) || {}; }
async function saveProgress() { await call('shell_set_setting', 'apptive_progress', progress); }
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 1800); }
function show(name) { for (const v of ['home', 'cons', 'play']) $('#' + v).hidden = v !== name; }
let backTo = null; // 위 막대 뒤로 버튼이 갈 곳
function setBack(fn) { backTo = fn; $('#back').hidden = !fn; }

// ---------- 1. 별자리 목록 (이름만)
async function renderHome() {
  index = await call('apptive_index');
  show('home'); setBack(null);
  const h = $('#home'); h.innerHTML = '';
  const cons = index.constellations || [];
  if (!cons.length) {
    const e = el('div', 'empty'); e.appendChild(el('b', '', '아직 별자리가 없어요'));
    const c = el('div'); c.append('콘텐츠 폴더에 ', el('code', '', '<별자리>/constellation.json'), ' 과 ', el('code', '', '<레슨>/lesson.json'), ' 을 넣어요.'); e.appendChild(c);
    const b = el('button', 'btn', '폴더 열기'); b.onclick = () => call('apptive_open_dir'); e.appendChild(b); h.appendChild(e); return;
  }
  cons.forEach((c, k) => {
    const row = el('div', 'row' + (c.error ? ' err' : ''));
    row.appendChild(el('span', 'no', String(k + 1).padStart(2, '0')));
    row.appendChild(el('span', '', c.error ? `${c.name} — ${c.error}` : c.name));
    if (!c.error) row.onclick = () => renderCons(c.id);
    h.appendChild(row);
  });
}

// ---------- 2. 별(레슨) 목록
function renderCons(cid) {
  const c = (index.constellations || []).find((x) => x.id === cid);
  if (!c) return renderHome();
  show('cons'); setBack(renderHome);
  $('#cons').dataset.id = cid;
  // 왼쪽: 다른 별자리 목록 (지금 것만 진하게)
  const side = $('#c-list'); side.innerHTML = '';
  index.constellations.forEach((o, k) => { const li = el('li', o.id === cid ? 'on' : ''); li.appendChild(el('span', 'no', String(k + 1).padStart(2, '0'))); li.appendChild(el('span', '', o.name)); if (!o.error) li.onclick = () => renderCons(o.id); side.appendChild(li); });
  const m = $('#c-body'); m.innerHTML = '';
  m.appendChild(el('h1', '', c.name));
  c.lessons.forEach((L, k) => {
    const row = el('div', 'row' + (L.error ? ' err' : '')); const p = progress[cid + '/' + L.id];
    row.appendChild(el('span', 'no' + (p?.done ? ' done' : ''), String(k + 1).padStart(2, '0')));
    row.appendChild(el('span', 'bar'));
    row.appendChild(el('span', 'name', L.error ? `${L.title} — ${L.error}` : L.title));
    if (!L.error) row.onclick = () => startLesson(cid, L.id);
    m.appendChild(row);
  });
}

// ---------- 3. 플레이어
async function startLesson(cid, lid, keepIndex = 0) {
  const r = await call('apptive_read', cid, lid);
  const c = (index.constellations || []).find((x) => x.id === cid);
  cur = { cid, lid, lesson: r.lesson, assets: r.assets, path: r.path, i: keepIndex, streak: 0, correct: 0, total: 0, mtime: r.mtime, stage: 0 };
  show('play'); setBack(() => renderCons(cid));
  renderScreen(); fitPhone();
}
const screens = () => cur.lesson.screens || [];
const sections = () => { const out = []; for (const s of screens()) { const n = s.section || ''; if (!out.includes(n)) out.push(n); } return out; };
function sectionPos(i) {
  const s = screens(); const name = s[i]?.section || '';
  const same = s.map((x, k) => [x, k]).filter(([x]) => (x.section || '') === name);
  return { name, idx: same.findIndex(([, k]) => k === i) + 1, n: same.length, sec: sections().indexOf(name), secs: sections().length };
}
function renderList() {
  const ol = $('#p-list'); ol.innerHTML = ''; let lastSec = null;
  screens().forEach((s, i) => {
    const sec = s.section || ''; if (sec !== lastSec) { ol.appendChild(el('li', 'sec', sec || '(구간 없음)')); lastSec = sec; }
    const li = el('li', i === cur.i ? 'on' : ''); li.appendChild(el('span', 'no', String(i + 1).padStart(2, '0'))); li.appendChild(el('span', '', labelOf(s)));
    li.onclick = () => goTo(i); ol.appendChild(li);
  });
  const end = el('li', cur.i >= screens().length ? 'on' : ''); end.appendChild(el('span', 'no', '끝')); end.appendChild(el('span', '', '별 점등 · 결과'));
  end.onclick = () => goTo(screens().length); ol.appendChild(end);
}
const KIND_KO = { ox: 'O/X', single: '하나 고르기', multi: '여러 개 고르기', blank: '빈칸', slider: '슬라이더', match: '짝 맞추기', chosung: '초성', audio: '소리 듣고 고르기' };
function labelOf(s) { if (s.type === 'quiz') return KIND_KO[s.kind] || ('퀴즈 ' + s.kind); return ({ narration: '나레이션', concept: '새 개념' })[s.type] || s.type; }
function fitPhone() { const wrap = $('.stagewrap'); const ph = $('#phone'); const m = matchMedia('(max-width: 760px)').matches; ph.style.zoom = m ? Math.min(wrap.clientHeight / H, wrap.clientWidth / W) : Math.min(1, (wrap.clientHeight - 40) / H, (wrap.clientWidth - 40) / W); }
window.addEventListener('resize', fitPhone);
// 화면을 옮길 때 앞 화면의 선택 · 입력을 지운다 (안 지우면 다음 퀴즈에 앞 선택이 미리 골라져 보인다)
function clearScreenState() {
  if (cur.audioEl) { try { cur.audioEl.pause(); } catch (e) { /* 없음 */ } }
  for (const k of ['picked', 'pickedSet', 'slide', 'typed', 'matchR', 'paired', 'sel', 'shakeR', 'ok', 'near', 'audioEl', 'popAnim']) delete cur[k];
  cur.stage = 0;
}
function goTo(i, dir = 0) { cur.i = i; clearScreenState(); cur.dir = dir; renderScreen(); }
function next() { goTo(Math.min(cur.i + 1, screens().length), 1); }
function prev() { if (cur.i > 0) goTo(cur.i - 1, -1); else renderCons(cur.cid); }
// 모션 도우미 (Web Animations)
const ease = 'cubic-bezier(.2,.7,.2,1)';
function anim(e, frames, ms, opts = {}) { try { return e.animate(frames, { duration: ms, easing: ease, fill: 'both', ...opts }); } catch (err) { return null; } }
function pop(e) { anim(e, [{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], 180); }
function fadeIn(e, dy = 8) { anim(e, [{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], 220); }
function shake(e) { anim(e, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], 320, { easing: 'linear' }); }

// ---------- 와프 그리기 도우미 (절대 좌표, 프레임 기준)
let root = null;
function T(x, y, w, text, size, weight, color, align = 'left', lh) {
  const e = el('div', 'n'); e.textContent = text ?? '';
  Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', fontSize: size + 'px', lineHeight: (lh || LH[size] || Math.round(size * 1.5)) + 'px', fontWeight: weight === 'Bold' ? 700 : 500, color, textAlign: align });
  root.appendChild(e); return e;
}
function R(x, y, w, h, fill, stroke, radius, sw = 1) {
  const e = el('div', 'n');
  Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', background: fill || 'transparent', border: stroke ? `${sw}px solid ${stroke}` : '0', borderRadius: Array.isArray(radius) ? radius.map((v) => v + 'px').join(' ') : (radius || 0) + 'px' });
  root.appendChild(e); return e;
}
function IMG(x, y, w, h, src, alt) { const e = el('img', 'n'); Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); e.src = src; e.alt = alt || ''; root.appendChild(e); return e; }
function HIT(x, y, w, h, onclick, title) { const b = el('button', 'hit'); Object.assign(b.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); b.onclick = onclick; if (title) b.title = title; root.appendChild(b); return b; }
// 글이 몇 줄로 접히는지 실제로 재서 높이를 돌려준다 (폰 틀 안에 임시로 붙임)
function measure(text, w, size, weight) { const e = T(-9999, 0, w, text, size, weight, '#000'); const h = e.offsetHeight; e.remove(); return h; }
// 블록을 세로 중심에 놓기: 아이템을 y=0 기준으로 그려 두고 나서 전부 밀어 올린다
function centerBlock(nodes, blockH, center, top = BODY_TOP, bottom = H) {
  const y0 = Math.round(Math.max(top + 16, Math.min(center - blockH / 2, bottom - blockH - 16)));
  for (const n of nodes) n.style.top = (parseFloat(n.style.top) + y0) + 'px';
  if (cur.shiftFrom != null && cur.shiftFrom !== y0) { const d = cur.shiftFrom - y0; for (const n of nodes) anim(n, [{ transform: `translateY(${d}px)` }, { transform: 'none' }], 260); }
  cur.shiftFrom = null; cur.blockY = y0;
  return y0;
}

// 머리: 뒤로가기 + 구간 막대 + 구간 글 (와프 01~24 공통)
function header(labelText) {
  IMG(27 - 10.4, 53 - 10.4, 38.8, 38.8, ICON('back')); HIT(14, 40, 44, 44, prev, '뒤로가기'); // 내보낸 svg 는 획 여백 포함. 누를 자리를 그림 위에 둔다(그림이 클릭을 가로채지 않게)
  const pos = sectionPos(Math.min(cur.i, screens().length - 1));
  const n = Math.max(1, pos.secs); const gap = 4; const segW = (314 - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    const x = 64 + k * (segW + gap);
    R(x, 61, segW, 4, C.line, null, 2);
    if (k < pos.sec || cur.i >= screens().length) R(x, 61, segW, 4, C.ink, null, 2);
    else if (k === pos.sec) {
      const w = Math.max(2, segW * (pos.idx / pos.n)); const f = R(x, 61, w, 4, C.ink, null, 2);
      const from = cur.segFill && cur.segFill.sec === k ? cur.segFill.w : 0;
      if (from !== w) anim(f, [{ width: from + 'px' }, { width: w + 'px' }], 320);
      cur.segFill = { sec: k, w };
    }
  }
  T(64, 74, 314, labelText ?? (cur.i >= screens().length ? '다 마침' : `${pos.name} · ${pos.idx}/${pos.n}`), 13, 'Medium', C.mid);
}
// 아래 버튼 (와프 06 · 17 · 23 · 24)
function bottomButton(text, onclick, disabled = false) {
  R(X0, BTN_Y, CW, BTN_H, disabled ? null : C.ink, disabled ? C.line2 : null, 14);
  T(X0, BTN_Y + 15, CW, text, 17, 'Bold', disabled ? C.dim : C.white, 'center');
  if (!disabled) HIT(X0, BTN_Y, CW, BTN_H, onclick);
}
// 결과 시트 (와프 06 · 12 · 15 · 18 · 20 · 22): 해설이 있으면 642/234, 없으면 706/170
function sheet(kind, resultText, explain, onNext) {
  const hasX = !!explain; const expH = hasX ? measure(explain, CW, 17, 'Medium') : 0;
  const top = hasX ? Math.min(642, 876 - (234 + (expH - 52))) : 706;
  const start = root.children.length;
  R(0, top, W, H - top + 2, C.white, C.line2, [24, 24, 0, 0]);
  R(181, top + 10, 40, 4, C.line2, null, 2);
  if (kind === 'ok') { IMG(24 - 5.48, top + 31 - 5.48, 26.96, 26.96, ICON('star')); T(46, top + 28, 200, resultText, 15, 'Bold', C.ok); }
  else T(24, top + 28, CW, resultText, 15, 'Bold', C.ink);
  if (hasX) T(24, top + 62, CW, explain, 17, 'Medium', C.ink);
  bottomButton('계속', onNext);
  if (cur.sheetAnim) { for (const n of [...root.children].slice(start)) anim(n, [{ transform: `translateY(${H - top}px)` }, { transform: 'none' }], 280); cur.sheetAnim = false; }
  return top;
}

function renderScreen() {
  root = $('#screen'); root.innerHTML = '';
  const s = screens()[cur.i];
  renderList();
  if (cur.dir) { anim(root, [{ opacity: 0, transform: `translateX(${cur.dir * 36}px)` }, { opacity: 1, transform: 'none' }], 200); cur.dir = 0; }
  if (!s) return renderEnd();
  header();
  const fn = { narration, concept, quiz }[s.type];
  if (fn) fn(s); else T(X0, 300, CW, `모르는 화면 유형: ${s.type}`, 15, 'Medium', C.dim);
}
// 고른 뒤 결과 단계로 갈 때 공통: 시트 올라옴 + 블록 미끄러짐
function toResult() { cur.sheetAnim = true; cur.shiftFrom = cur.blockY; cur.stage = 2; renderScreen(); }

// ---- 나레이션 (와프 03 · 10 · 13). lines 를 탭마다 한 줄씩 드러낸다. 마지막 줄만 진하게 + 반짝임.
let shown = 1;
function narration(s) {
  const lines = s.lines || [{ speaker: s.speaker, text: s.text }];
  if (cur.stage === 0) { shown = 1; cur.stage = 1; }
  const nodes = []; let y = 0;
  const single = lines.length === 1 && !lines[0].speaker; // 와프 13: 따옴표 장식 + 대사
  if (single) { nodes.push(T(X0, y, 60, '“', 48, 'Bold', C.quote)); y += 56; nodes.push(T(X0, y, CW, lines[0].text, 17, 'Medium', C.ink)); y += measure(lines[0].text, CW, 17, 'Medium'); }
  else {
    lines.slice(0, shown).forEach((L, k) => {
      const now = k === shown - 1;
      const fresh = [];
      if (now) { const sp = IMG(24, y + 4, 12, 12, ICON('sparkle')); sp.classList.add('blink'); nodes.push(sp); fresh.push(sp); const nm = T(44, y, 334, L.speaker || '', 13, 'Bold', C.ink); nodes.push(nm); fresh.push(nm); }
      else nodes.push(T(X0, y, CW, L.speaker || '', 13, 'Bold', C.dim));
      y += 24;
      const tx = T(X0, y, CW, L.text || '', 17, 'Medium', now ? C.ink : C.mid); nodes.push(tx); fresh.push(tx); y += measure(L.text || '', CW, 17, 'Medium');
      if (now && cur.lineAnim) fresh.forEach((e) => fadeIn(e));
      if (k < shown - 1) y += 32;
    });
  }
  if (s.source) { y += 16; nodes.push(T(X0, y, CW, '출처 · ' + s.source, 12, 'Medium', C.dim, 'left', 20)); y += 20; }
  centerBlock(nodes, y, TALK_CENTER);
  HIT(0, BODY_TOP, W, H - BODY_TOP, () => { if (!single && shown < lines.length) { shown++; cur.lineAnim = true; renderScreen(); cur.lineAnim = false; } else next(); });
}

// ---- 새 개념 (와프 04 · 09 · 16): 시각 자료 판 354×267 + 라벨 + 대사(들) + 출처
function concept(s) {
  const nodes = []; let y = 0;
  nodes.push(R(X0, y, CW, 267, C.white, C.panel, 16));
  if (s.image) { const img = IMG(X0 + 1, y + 1, CW - 2, 265, cur.assets + encodeURIComponent(s.image), s.keyword); img.style.borderRadius = '16px'; img.onerror = () => { img.replaceWith(T(X0, y + 120, CW, `그림 없음: ${s.image}`, 13, 'Medium', C.dim, 'center')); }; nodes.push(img); }
  if (s.keyword) nodes.push(T(X0, y + 22, CW, s.keyword, 13, 'Bold', C.label, 'center'));
  y += 267 + 16;
  // 나레이션처럼 탭마다 한 줄씩 드러낸다. 지난 줄만 회색, 지금 줄은 진하게.
  const lines = s.lines || [{ speaker: s.speaker, text: s.text }];
  if (cur.stage === 0) { shown = 1; cur.stage = 1; }
  const multi = lines.length > 1;
  lines.slice(0, shown).forEach((L, k) => {
    const now = k === shown - 1;
    const fresh = [];
    if (L.speaker && multi) {
      if (now) { const sp = IMG(24, y + 4, 12, 12, ICON('sparkle')); sp.classList.add('blink'); nodes.push(sp); fresh.push(sp); const nm = T(44, y, 334, L.speaker, 13, 'Bold', C.ink); nodes.push(nm); fresh.push(nm); }
      else nodes.push(T(X0, y, CW, L.speaker, 13, 'Bold', C.dim));
      y += 24;
    }
    const tx = T(X0, y, CW, L.text || '', 17, 'Medium', now ? C.ink : C.mid); nodes.push(tx); fresh.push(tx); y += measure(L.text || '', CW, 17, 'Medium');
    if (now && cur.lineAnim) fresh.forEach((e) => fadeIn(e));
    if (!now) y += 32;
  });
  if (s.source) { y += 16; nodes.push(T(X0, y, CW, '출처 · ' + s.source, 12, 'Medium', C.dim, 'left', 20)); y += 20; }
  centerBlock(nodes, y, TALK_CENTER);
  HIT(0, BODY_TOP, W, H - BODY_TOP, () => { if (shown < lines.length) { shown++; cur.lineAnim = true; renderScreen(); cur.lineAnim = false; } else next(); });
}

// ---- 퀴즈 공통 채점
function grade(s, ok) {
  if (s.explain == null) return;
  cur.total++; if (ok) { cur.correct++; cur.streak++; } else cur.streak = 0;
}
function quiz(s) {
  const fn = { ox, single, multi, blank, slider, match, chosung, audio }[s.kind];
  if (!fn) return T(X0, 300, CW, `모르는 퀴즈 유형: ${s.kind}`, 15, 'Medium', C.dim);
  fn(s);
}

// ---- O/X (와프 01 · 02 · 14 · 15): 질문 가운데 20 Bold, 165 누르는 영역 둘, O 원 84/8, X 획. 고른 쪽 파랑.
function ox(s) {
  const picked = cur.picked; const result = cur.stage === 2;
  const nodes = []; let y = 0;
  nodes.push(T(X0, y, CW, s.question, 20, 'Bold', C.ink, 'center')); y += measure(s.question, CW, 20, 'Bold') + 32;
  const o = R(68 - 27, 0, 84, 84, null, picked === true ? C.pick : C.dim, 42, 8); o.style.left = '68px'; o.style.top = (y + 40) + 'px'; nodes.push(o); if (picked === true && cur.popAnim) pop(o);
  const x1 = IMG(249, y + 42, 85, 80, ICON('x1')); const x2 = IMG(249, y + 42, 85, 80, ICON('x2')); nodes.push(x1, x2);
  if (picked === false) { x1.style.filter = x2.style.filter = 'brightness(0) saturate(100%) invert(26%) sepia(80%) saturate(1800%) hue-rotate(205deg)'; if (cur.popAnim) { pop(x1); pop(x2); } }
  const hitO = HIT(27, y, 165, 165, () => pick(true)); const hitX = HIT(210, y, 165, 165, () => pick(false)); nodes.push(hitO, hitX);
  y += 165;
  const bottom = result ? sheetTop(s) : H;
  centerBlock(nodes, y, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) sheet(picked === !!s.answer ? 'ok' : 'bad', picked === !!s.answer ? '정답' : '아쉬워요', s.explain, next);
  function pick(v) { if (cur.stage) return; cur.picked = v; const ok = v === !!s.answer; grade(s, ok); cur.popAnim = true; if (s.explain == null) { cur.stage = 1; renderScreen(); setTimeout(next, 260); } else { toResult(); } cur.popAnim = false; }
}
function sheetTop(s) { return s.explain ? Math.min(642, 876 - (234 + (measure(s.explain, CW, 17, 'Medium') - 52))) : 706; }

// ---- 하나 고르기 (와프 07 · 08 · 21 · 22): 질문 왼쪽 20 Bold, 구분선 + 보기 17, 고름 Bold #111, 결과는 정답 Bold + 체크, 나머지 흐림
function single(s) { choiceList(s, false); }
function multi(s) { choiceList(s, true); }
function choiceList(s, isMulti) {
  const result = cur.stage === 2; const picked = cur.pickedSet || new Set();
  const nodes = []; let y = 0;
  nodes.push(T(X0, y, CW, s.question, 20, 'Bold', C.ink)); y += measure(s.question, CW, 20, 'Bold') + 32;
  const opts = s.options || []; const answers = new Set(isMulti ? (s.answers || []) : [s.answer]);
  nodes.push(R(X0, y, CW, 1, C.line));
  opts.forEach((t, i) => {
    const isPick = picked.has(i); const isAns = answers.has(i);
    let weight = 'Medium', color = C.dim;
    if (result) { if (isAns) { weight = 'Bold'; color = C.ink; } }
    else if (isPick) { weight = 'Bold'; color = C.ink; }
    const tt = T(44, y + 19, 290, t, 17, weight, color); nodes.push(tt); if (isPick && cur.popAnim === i) pop(tt);
    if (result && isAns && !isMulti) nodes.push(IMG(355 - 9.6, y + 27 - 9.6, 35.2, 31.2, ICON('check')));
    if (!result) nodes.push(HIT(X0, y + 1, CW, 63, () => pick(i)));
    y += 64; nodes.push(R(X0, y, CW, 1, C.line));
  });
  y += 1;
  const bottom = result ? sheetTop(s) : (isMulti ? BTN_Y : H);
  centerBlock(nodes, y, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) { const ok = isMulti ? (picked.size === answers.size && [...picked].every((x) => answers.has(x))) : picked.has(s.answer); sheet(ok ? 'ok' : 'bad', ok ? '정답' : '아쉬워요', s.explain, next); }
  else if (isMulti) bottomButton('확인', confirm, !picked.size);
  function pick(i) {
    if (cur.stage) return;
    if (isMulti) { picked.has(i) ? picked.delete(i) : picked.add(i); cur.pickedSet = picked; cur.popAnim = i; renderScreen(); cur.popAnim = null; return; }
    cur.pickedSet = new Set([i]); const ok = i === s.answer; grade(s, ok); cur.popAnim = i;
    if (s.explain == null) { cur.stage = 1; renderScreen(); setTimeout(next, 260); } else { toResult(); } cur.popAnim = null;
  }
  function confirm() { const ok = picked.size === answers.size && [...picked].every((x) => answers.has(x)); grade(s, ok); toResult(); }
}

// ---- 빈칸 (와프 05 · 06): 문장 앞 20 Bold → 빈칸(150, 밑줄) + 문장 뒤 → 낱말 칩 112×48 셋 + 구분선. 결과: 밑줄 초록, 고른 칩 비움
function blank(s) {
  const result = cur.stage === 2; const pi = cur.picked;
  const nodes = []; let y = 0;
  // 앞 문장이 여러 줄로 접혀도 빈칸을 덮지 않게 실제 높이만큼 내린다(한 줄이면 전과 같은 42).
  nodes.push(T(X0, y, CW, s.before || '', 20, 'Bold', C.ink)); y += (s.before ? measure(s.before, CW, 20, 'Bold') : 30) + 12;
  const blankTxt = result ? s.options[pi] : '?'; const blankH = Math.max(30, measure(blankTxt, 150, 20, 'Bold')); // 한 줄이면 30 → 밑줄 y+34 그대로
  nodes.push(T(X0, y, 150, blankTxt, 20, 'Bold', result ? C.ink : C.dim, 'center'));
  nodes.push(R(X0, y + blankH + 4, 150, 2, result ? C.ok : C.line2, null, 1));
  nodes.push(T(186, y, 192, s.after || '', 20, 'Bold', C.ink));
  y += Math.max(70, (s.after ? measure(s.after, 192, 20, 'Bold') : 0) + 40, blankH + 40);
  // 보기 칸은 본문 폭을 똑같이 나눈다(3개면 112px). 두 줄로 접히면 칸 안 세로 가운데.
  const opts = s.options || []; const n = opts.length; const gap = 9; const cw = (CW - gap * (n - 1)) / n;
  opts.forEach((t, i) => {
    const x = X0 + i * (cw + gap);
    if (!(result && i === pi)) nodes.push(T(x, y + (48 - measure(t, cw, 15, 'Medium')) / 2, cw, t, 15, 'Medium', C.dim, 'center'));
    if (i < n - 1) nodes.push(R(x + cw + 4, y + 12, 1, 24, C.line2));
    if (!result) nodes.push(HIT(x, y, cw, 48, () => pick(i)));
  });
  y += 48;
  const bottom = result ? sheetTop(s) : H;
  centerBlock(nodes, y, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) sheet(pi === s.answer ? 'ok' : 'bad', pi === s.answer ? '정답' : '아쉬워요', s.explain, next);
  function pick(i) { if (cur.stage) return; cur.picked = i; const ok = i === s.answer; grade(s, ok); if (s.explain == null) { cur.stage = 1; renderScreen(); setTimeout(next, 260); } else { toResult(); } }
}

// ---- 슬라이더 (와프 11 · 12): 질문 가운데, 안내, 트랙 322@x40, 눈금 4, 손잡이 4×24. 끌어 놓으면 값 + 트랙 채움 + 근접도 시트
function slider(s) {
  const result = cur.stage === 2; const pos = cur.slide ?? 0; // 0~1
  const ticks = s.ticks || []; const target = typeof s.answer === 'number' && s.answer > 1 ? s.answer / Math.max(1, ticks.length - 1) : (s.answer ?? .5);
  const nodes = []; let y = 0;
  nodes.push(T(X0, y, CW, s.question, 20, 'Bold', C.ink, 'center')); y += measure(s.question, CW, 20, 'Bold') + 56;
  const hintEl = result ? null : T(X0, y, CW, s.hint || '끌어서 고르기', 13, 'Medium', C.dim, 'center'); if (hintEl) { nodes.push(hintEl); if (cur.stage === 1) hintEl.style.visibility = 'hidden'; }
  const trackY = y + 55; const hx = 40 + pos * 322;
  nodes.push(R(40, trackY, 322, 2, C.line, null, 1));
  if (result) { const fill = R(40, trackY, Math.max(0, hx - 40), 2, C.ink, null, 1); nodes.push(fill); if (cur.sheetAnim) anim(fill, [{ width: '0px' }, { width: Math.max(0, hx - 40) + 'px' }], 280); nodes.push(T(hx - 45, trackY - 45, 90, tickLabel(pos), 15, 'Bold', C.ink, 'center')); }
  ticks.forEach((t, i) => {
    const tx = ticks.length > 1 ? 40 + (322 * i) / (ticks.length - 1) : 201;
    nodes.push(R(Math.round(tx), trackY + 11, 1, 8, C.mid));
    const align = i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center';
    nodes.push(T(align === 'left' ? 24 : align === 'right' ? 298 : tx - 40, trackY + 23, 80, t, 12, 'Medium', C.mid, align));
  });
  const handle = R(hx - 2, trackY - 11, 4, 24, C.ink, null, 2); nodes.push(handle);
  if (!result) {
    const rng = el('input', 'n'); rng.type = 'range'; rng.min = 0; rng.max = 1000; rng.value = Math.round(pos * 1000);
    Object.assign(rng.style, { left: '18px', top: (trackY - 21) + 'px', width: '366px', height: '44px', opacity: 0, cursor: 'pointer' });
    // 끄는 동안은 다시 그리지 않고 손잡이 · 값 미리보기 · 트랙 채움만 옮긴다 (다시 그리면 드래그가 끊긴다)
    const live = T(hx - 45, trackY - 45, 90, cur.stage === 1 ? tickLabel(pos) : '', 15, 'Bold', C.ink, 'center'); nodes.push(live);
    const liveFill = R(40, trackY, cur.stage === 1 ? Math.max(0, hx - 40) : 0, 2, C.ink, null, 1); nodes.push(liveFill);
    rng.oninput = () => {
      cur.slide = rng.value / 1000; cur.stage = 1; const x = 40 + cur.slide * 322;
      if (hintEl) hintEl.style.visibility = 'hidden'; // 값 글자(손잡이 위)가 안내 글과 겹치지 않게
      handle.style.left = (x - 2) + 'px'; live.style.left = (x - 45) + 'px'; live.textContent = tickLabel(cur.slide); liveFill.style.width = Math.max(0, x - 40) + 'px';
    };
    // change 는 끌기 시작 값과 같은 자리에 놓으면 안 온다(0 에서 시작해 0 에 놓기). 놓을 때도 한 번 확정한다.
    rng.onpointerup = () => { if (cur.stage === 1) rng.onchange(); };
    rng.onchange = () => { if (cur.stage === 2) return; cur.slide = rng.value / 1000; const dist = Math.abs(cur.slide - target); const ok = dist <= (s.tolerance ?? .08); cur.near = Math.max(0, Math.round((1 - dist) * 100)); cur.ok = ok; grade(s, ok); toResult(); };
    root.appendChild(rng); nodes.push(rng);
  }
  y = trackY + 23 + 18;
  const bottom = result ? sheetTop({ explain: null }) : H;
  centerBlock(nodes, y, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) {
    // 와프 12: 시트에는 근접도 한 줄만. 해설(explain)은 그 다음 나레이션 화면이 맡는다.
    sheet(cur.ok ? 'ok' : 'near', cur.ok ? '정답' : `정답에 ${cur.near}% 근접했어요`, null, next);
  }
  function tickLabel(p) { return sliderValue(ticks, p); }
}
// 슬라이더 값 글자: 눈금이 모두 "숫자(+만·억·천)+단위"면 이웃 눈금 사이를 이어서 정확한 값을 보여 준다.
// 숫자가 아닌 눈금(예: '그대로')이 하나라도 있으면 가장 가까운 눈금 글자.
const TICK_MUL = { 천: 1e3, 만: 1e4, 억: 1e8 };
function parseTick(t) {
  const m = /^\s*(-?[\d,]*\.?\d+)\s*(천|만|억)?(\s*)(.*)$/.exec(String(t));
  if (!m) return null;
  return { v: parseFloat(m[1].replace(/,/g, '')) * (TICK_MUL[m[2]] || 1), sep: m[3], unit: m[4].trim(), kor: !!m[2] && m[2] !== '천' };
}
function fmtNum(v, step, group) {
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return Number(v.toFixed(dec)).toLocaleString('ko-KR', { maximumFractionDigits: dec, useGrouping: !!group });
}
function sliderValue(ticks, p) {
  if (!ticks.length) return Math.round(p * 100) + '%';
  if (ticks.length === 1) return String(ticks[0]);
  const near = ticks[Math.round(p * (ticks.length - 1))];
  const ps = ticks.map(parseTick);
  if (ps.some((x) => !x)) return near;
  const seg = p * (ticks.length - 1); const i = Math.min(Math.floor(seg), ticks.length - 2); const f = seg - i;
  const a = ps[i], b = ps[i + 1]; const span = Math.abs(b.v - a.v) || 1;
  // 눈금 간격의 1/20 단위로 반올림하되, 작은 쪽 눈금 값(예: 1톤)이 뭉개지지 않게 그 자릿수보다 거칠게 하지 않는다
  const lo = Math.min(Math.abs(a.v), Math.abs(b.v));
  let step = Math.pow(10, Math.floor(Math.log10(span / 20)));
  if (lo > 0) step = Math.min(step, Math.pow(10, Math.floor(Math.log10(lo))));
  const v = Math.round((a.v + (b.v - a.v) * f) / step) * step;
  const ref = b.unit ? b : a; const unit = ref.unit || ps.find((x) => x.unit)?.unit || '';
  const sep = unit ? ref.sep : '';
  const group = ticks.some((t) => String(t).includes(',')) || ps.some((x) => x.kor);
  if (ps.some((x) => x.kor) && Math.abs(v) >= 1e4) {
    const big = Math.abs(v) >= 1e8 ? [1e8, '억'] : [1e4, '만'];
    return fmtNum(v / big[0], Math.max(step / big[0], 0.1), true) + big[1] + sep + unit;
  }
  return fmtNum(v, step, group) + sep + unit;
}

// ---- 짝 맞추기 (와프 19 · 20): 질문 왼쪽, 왼쪽 열 x44 w136 · 오른쪽 열 x222 w136, 행 64, 17 Medium 흐림. 맞춘 짝은 #111 Bold.
function match(s) {
  const result = cur.stage === 2;
  if (!cur.matchR) { cur.matchR = shuffle((s.pairs || []).map((p, i) => ({ t: p[1], i }))); cur.paired = new Set(); cur.sel = null; }
  const nodes = []; let y = 0;
  nodes.push(T(X0, y, CW, s.question || '짝을 맞춰 보세요.', 20, 'Bold', C.ink)); y += measure(s.question || '짝', CW, 20, 'Bold') + 51;
  if (!result) (s.pairs || []).forEach((p, i) => {
    // 맞춘 짝은 사라진다(방금 맞춘 짝만 진하게 보였다가 흐려지며 사라짐). 자리는 그대로 비워 둔다.
    const done = cur.paired.has(i); const selL = cur.sel === i; const fadeL = done && cur.justPaired === i;
    if (!done || fadeL) { const lt = T(44, y, 136, p[0], 17, done || selL ? 'Bold' : 'Medium', done || selL ? C.ink : C.dim, 'center'); nodes.push(lt); if (fadeL) anim(lt, [{ opacity: 1 }, { opacity: 0 }], 280); }
    const r = cur.matchR[i]; const doneR = cur.paired.has(r.i); const fadeR = doneR && cur.justPaired === r.i;
    if (!doneR || fadeR) {
      const rt = T(222, y, 136, r.t, 17, doneR ? 'Bold' : 'Medium', doneR ? C.ink : C.dim, 'center'); nodes.push(rt);
      if (fadeR) anim(rt, [{ opacity: 1 }, { opacity: 0 }], 280);
      if (cur.shakeR === i) { shake(rt); cur.shakeR = null; }
    }
    if (!done) nodes.push(HIT(24, y - 19, 178, 64, () => { cur.sel = i; renderScreen(); }));
    if (!doneR) nodes.push(HIT(202, y - 19, 176, 64, () => { if (cur.sel == null) return; if (cur.sel === r.i) { cur.paired.add(r.i); cur.sel = null; if (cur.paired.size === (s.pairs || []).length) { grade(s, true); toResult(); return; } cur.justPaired = r.i; } else { cur.shakeR = i; } renderScreen(); cur.justPaired = null; }));
    y += 64;
  });
  const bottom = result ? sheetTop(s) : H;
  centerBlock(nodes, result ? 30 : y - 38, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) sheet('ok', '정답', s.explain, next);
}

// ---- 초성 · 소리 듣고 고르기: 와프에 아직 없음. 가까운 틀(빈칸 · 하나 고르기)로 임시 표시한다.
function chosung(s) {
  const result = cur.stage === 2; const nodes = []; let y = 0;
  if (s.question) { nodes.push(T(X0, y, CW, s.question, 20, 'Bold', C.ink)); y += measure(s.question, CW, 20, 'Bold') + 32; }
  nodes.push(T(X0, y, CW, s.hint || '', 24, 'Bold', C.dim, 'center')); y += 56;
  if (result) { nodes.push(T(X0, y, CW, cur.typed, 20, 'Bold', C.ink, 'center')); nodes.push(R(X0, y + 34, CW, 2, cur.ok ? C.ok : C.line2, null, 1)); y += 48; }
  else {
    const inp = el('input', 'n'); inp.placeholder = '정답 입력'; inp.autocomplete = 'off'; inp.value = cur.typed || '';
    Object.assign(inp.style, { left: X0 + 'px', top: y + 'px', width: CW + 'px', height: '34px', fontSize: '20px', fontWeight: 700, textAlign: 'center' });
    inp.oninput = () => { cur.typed = inp.value; }; inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    root.appendChild(inp); nodes.push(inp); nodes.push(R(X0, y + 34, CW, 2, C.line2, null, 1)); y += 48;
    setTimeout(() => inp.focus(), 30);
  }
  const bottom = result ? sheetTop(s) : BTN_Y;
  centerBlock(nodes, y, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) sheet(cur.ok ? 'ok' : 'bad', cur.ok ? '정답' : '아쉬워요', s.explain, next); else bottomButton('제출', submit, false);
  function submit() { const v = (cur.typed || '').trim().replace(/\s+/g, ''); if (!v) return; const ans = [].concat(s.answer).map((a) => String(a).replace(/\s+/g, '')); cur.ok = ans.includes(v); grade(s, cur.ok); toResult(); }
}
function audio(s) {
  if (!cur.audioEl) { cur.audioEl = new Audio(cur.assets + encodeURIComponent(s.audio || '')); }
  const result = cur.stage === 2; const picked = cur.pickedSet || new Set();
  const nodes = []; let y = 0;
  nodes.push(T(X0, y, CW, s.question, 20, 'Bold', C.ink)); y += measure(s.question, CW, 20, 'Bold') + 24;
  nodes.push(R(165, y, 72, 72, null, C.dim, 36, 2)); nodes.push(T(165, y + 22, 72, '▶', 20, 'Bold', C.ink, 'center'));
  nodes.push(HIT(165, y, 72, 72, () => { cur.audioEl.currentTime = 0; cur.audioEl.play().catch(() => toast('소리 파일을 못 읽었어요: ' + s.audio)); }));
  y += 72 + 24;
  nodes.push(R(X0, y, CW, 1, C.line));
  (s.options || []).forEach((t, i) => {
    const isAns = i === s.answer; const isPick = picked.has(i);
    const bold = result ? isAns : isPick;
    nodes.push(T(44, y + 19, 290, t, 17, bold ? 'Bold' : 'Medium', bold ? C.ink : C.dim));
    if (result && isAns) nodes.push(IMG(355 - 9.6, y + 27 - 9.6, 35.2, 31.2, ICON('check')));
    if (!result) nodes.push(HIT(X0, y + 1, CW, 63, () => { if (cur.stage) return; cur.pickedSet = new Set([i]); const ok = i === s.answer; grade(s, ok); cur.audioEl.pause(); if (s.explain == null) { cur.stage = 1; renderScreen(); setTimeout(next, 260); } else { toResult(); } }));
    y += 64; nodes.push(R(X0, y, CW, 1, C.line));
  });
  const bottom = result ? sheetTop(s) : H;
  centerBlock(nodes, y + 1, result ? (BODY_TOP + bottom) / 2 : QUIZ_CENTER, BODY_TOP, bottom);
  if (result) { const ok = picked.has(s.answer); sheet(ok ? 'ok' : 'bad', ok ? '정답' : '아쉬워요', s.explain, next); }
}

// ---- 끝 (와프 23 별 점등 → 24 결과). 별은 체험 링크와 같은 22×22 도트 그림(꺼짐 · 켜짐)을 7배로.
const DOT_ON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAA8UlEQVR4nGNgGGjgrCz8H4SJVc9IrKHbNivD+exapwjqYyHWBUwy9mDaw3AeUeqJNvjfk4PEKoU4hNRg2LZZGSxGscHkAngkOONwBbJrkYGX712chu69+5aREZt3SQU/X/+DswOT7oMNpjgofiIZigzABoNswOc1Yg2FuRbERknoztBwJiZY0L0PcyCKi2EAWYIUl2LTixHGewkECz7v4zWYnIjCBjAMdsaR9HAZun6eItY8wERtlxJt8E+ooaCwhMU+MYARXzD8fP0PIynBvA0KAnyRiLPY9IKmDPQYh/EDkxiwWoDTxegGEALk6KEIAABlU4Q0wPXdCwAAAABJRU5ErkJggg==';
const DOT_OFF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAA8ElEQVR4nGNgGGggr+zwH4SJVc9IrKF5+RVwfnGeB0F9LMS6wM3FAEz7+EYQpZ5og3ftucBACmAiNRjy8ivAYhQbTC6AR4I8DlcguxYZTJrYgdPQh3cPMDJi8y6p4OnT53D22jULwQZTHBRPkQxFBmCDQTbg8xqxhsJcC2KjJHR5aDgTEyzo3oc5EMXFMIAsQYpLsenFCOOHBIIFn/fxGkxORGEDGAbL40h6uAwNDonHmgeYqO1Sog1+CjUUFJaw2CcGMOILhqdPn2MkJZi3QUGALxJxFpuToCkDPcZh/LVrGLBagNPF6AYQAuTooQgAAHVsg+qQC6UcAAAAAElFTkSuQmCC';
function dotStar(x, y, src) { const e = IMG(x, y, 154, 154, src, '별'); e.style.imageRendering = 'pixelated'; return e; }
function renderEnd() {
  const L = cur.lesson; const end = L.ending || {};
  header('다 마침');
  const onSrc = end.image ? cur.assets + encodeURIComponent(end.image) : DOT_ON;
  if (cur.stage === 0) {
    const box = R(X0, 244, CW, 240, C.white, C.panel, 16); box.style.overflow = 'hidden';
    const glow = el('div', 'n'); Object.assign(glow.style, { left: (CW / 2 - 160) + 'px', top: (120 - 160) + 'px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,214,102,.22), rgba(255,214,102,0))', pointerEvents: 'none' });
    box.appendChild(glow); anim(glow, [{ opacity: 0 }, { opacity: 0, offset: 500 / 1700 }, { opacity: 1 }], 1700);
    const off = dotStar(124, 287, DOT_OFF); anim(off, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0 }], 1000);
    const on = dotStar(124, 287, onSrc);
    anim(on, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 0, transform: 'scale(.9)', offset: .45 }, { opacity: 1, transform: 'scale(1.04)', offset: .78 }, { opacity: 1, transform: 'scale(1)' }], 1100);
    const endTxt = end.text || '별에 불 들어왔다냥!';
    const after = [];
    after.push(T(X0, 500, CW, endTxt, 17, 'Medium', C.ink));
    const titleY = Math.max(566, 500 + measure(endTxt, CW, 17, 'Medium') + 40);
    after.push(T(X0, titleY, CW, L.title || '', 24, 'Bold', C.ink, 'center'));
    after.push(T(X0, Math.max(614, titleY + (L.title ? measure(L.title, CW, 24, 'Bold') : 36) + 12), CW, L.keyword || '', 17, 'Medium', C.mid, 'center'));
    after.forEach((n) => anim(n, [{ opacity: 0 }, { opacity: 0, offset: .64 }, { opacity: 1 }], 1100));
    bottomButton('계속', async () => {
      progress[cur.cid + '/' + cur.lid] = { done: true, score: cur.correct, total: cur.total, at: Date.now() };
      await saveProgress(); cur.stage = 1; renderScreen();
    });
  } else {
    dotStar(124, 318, onSrc);
    T(X0, 504, CW, `${cur.total}문제 중 ${cur.correct}개 맞혔어요`, 22, 'Bold', C.ink, 'center');
    T(X0, 544, CW, L.title || '', 15, 'Medium', C.mid, 'center');
    bottomButton('다음 학습', async () => { index = await call('apptive_index'); renderCons(cur.cid); });
  }
}

// ---------- 위 막대 · 단축키
$('#reload').onclick = async () => {
  if (cur && !$('#play').hidden) { const i = cur.i; await startLesson(cur.cid, cur.lid, i); toast('다시 읽었어요'); }
  else if (!$('#cons').hidden) { index = await call('apptive_index'); renderCons($('#cons').dataset.id || index.constellations[0]?.id); }
  else await renderHome();
};
$('#back').onclick = () => { if (backTo) backTo(); };
$('#open-dir').onclick = () => call('apptive_open_dir').catch((e) => toast(String(e.message || e)));
$('#reset').onclick = async () => { progress = {}; await saveProgress(); toast('진행을 지웠어요'); if (!$('#home').hidden) renderHome(); else if (!$('#cons').hidden) renderCons(cur?.cid || index.constellations[0]?.id); };
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'r' || e.key === 'R') $('#reload').click();
  if (!cur || $('#play').hidden) return;
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
});
// lesson.json 이 바뀌면 자동으로 다시 읽기
setInterval(async () => {
  if (!cur || $('#play').hidden) return;
  try { const r = await call('apptive_read', cur.cid, cur.lid); if (r.mtime !== cur.mtime) { const i = cur.i; await startLesson(cur.cid, cur.lid, i); toast('lesson.json 이 바뀌어 다시 읽었어요'); } } catch (e) { /* 저장 중 */ }
}, 2000);

(async () => { await loadProgress(); await renderHome(); })();

})();
