// 技能與道具圖示：每個角色、每個技能一個手繪 SVG 記號（48×48），以角色的氣功色描繪。
import { ITEMS } from './config.js';
const W = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
const S = 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';
// 共用：瞬移（虛線弧＋菱形）、光束（兩掌間放出的寬帶）
const blinkIc = W(`<path d="M10 36 C14 16 26 10 38 12" ${S} stroke-dasharray="3 5"/><path d="M33 6 l8 6 -8 6 -8 -6z" ${F}/><circle cx="12" cy="36" r="3" ${F} opacity=".5"/>`);
const beamIc = (w) => W(`<path d="M6 ${24 - w} L42 ${24 - w * 1.8} L42 ${24 + w * 1.8} L6 ${24 + w} Z" ${F} opacity=".45"/><path d="M6 22 L42 18 L42 30 L6 26 Z" ${F}/><path d="M8 24 H42" stroke="#fff" stroke-width="2.4"/>`);

export const ICONS = {
  goku: {
    Q: W(`<circle cx="26" cy="24" r="11" ${F}/><circle cx="26" cy="24" r="5" fill="#fff"/><path d="M6 16 l8 4 M5 24 h9 M6 32 l8 -4" ${S} stroke-width="2.6"/>`),
    W: W(`<path d="M8 14 l9 10 -9 10 M17 14 l9 10 -9 10" ${S} opacity=".6"/><circle cx="34" cy="24" r="8" ${F}/><path d="M30 20 h8 M30 24 h8 M30 28 h7" stroke="#16110c" stroke-width="2"/>`),
    E: W(`<path d="M24 6 v8 M24 34 v8" ${S}/><path d="M14 24 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" ${S} stroke-dasharray="4 4"/><circle cx="24" cy="24" r="3.5" ${F}/>`),
    R: beamIc(8),
  },
  vegeta: {
    Q: W(`<circle cx="14" cy="30" r="6" ${F}/><circle cx="26" cy="20" r="5" ${F} opacity=".8"/><circle cx="37" cy="12" r="4" ${F} opacity=".6"/><path d="M14 30 L26 20 L37 12" ${S} stroke-width="1.8" stroke-dasharray="2 3"/>`),
    W: W(`<path d="M8 36 L28 20" ${S} stroke-width="5"/><path d="M26 14 l12 -4 -4 12" ${S}/><path d="M6 24 h8 M10 16 h6" ${S} stroke-width="2.2" opacity=".6"/>`),
    E: W(`<path d="M10 10 L38 38 M38 10 L10 38" ${S} stroke-width="4"/><circle cx="24" cy="24" r="4" fill="#16110c" stroke="currentColor" stroke-width="2"/>`),
    R: beamIc(13),
  },
  trunks: {
    Q: W(`<path d="M10 34 Q24 6 38 34" ${S} stroke-width="4"/><path d="M14 34 Q24 16 34 34" ${S} stroke-width="2" opacity=".6"/>`),
    W: W(`<path d="M8 40 L36 12" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M33 9 l6 6" ${S}/><path d="M6 30 C16 26 22 18 26 8" ${S} stroke-width="2" opacity=".55"/>`),
    E: W(`<path d="M12 38 C8 22 18 10 30 12 C40 14 40 26 30 28" ${S}/><path d="M28 24 l3 4 -5 2" ${S}/>`),
    R: W(`<path d="M6 40 A18 18 0 0 1 42 40 Z" ${F} opacity=".55"/><path d="M12 40 A12 12 0 0 1 36 40" ${S}/><path d="M24 4 V18" ${S} stroke-width="4"/>`),
  },
  piccolo: {
    Q: W(`<g ${F}><circle cx="24" cy="7" r="3.5"/><circle cx="38" cy="14" r="3.5"/><circle cx="41" cy="30" r="3.5"/><circle cx="30" cy="42" r="3.5"/><circle cx="14" cy="41" r="3.5"/><circle cx="7" cy="27" r="3.5"/><circle cx="12" cy="12" r="3.5"/></g><circle cx="24" cy="25" r="5" ${S} stroke-width="2.4"/>`),
    W: W(`<path d="M6 32 C14 32 18 24 28 24 H38" ${S} stroke-width="4"/><path d="M36 18 l6 6 -6 6" ${S}/>`),
    E: W(`<path d="M24 6 C34 12 38 22 34 32 C30 40 18 40 14 32 C10 22 14 12 24 6 Z" ${S}/><path d="M24 16 v14 M17 23 h14" ${S}/>`),
    R: W(`<path d="M4 24 H44" stroke="currentColor" stroke-width="3"/><path d="M6 24 C10 16 14 32 18 24 S26 16 30 24 S38 32 42 24" ${S} stroke-width="2.2"/>`),
  },
  frieza: {
    Q: W(`<path d="M6 38 L42 10" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="42" cy="10" r="4" ${F}/><circle cx="8" cy="36" r="2.5" ${F} opacity=".6"/>`),
    W: W(`<ellipse cx="24" cy="24" rx="17" ry="7" ${S}/><ellipse cx="24" cy="24" rx="9" ry="3.5" ${F} opacity=".6"/>`),
    E: blinkIc,
    R: W(`<circle cx="24" cy="18" r="13" ${F}/><circle cx="20" cy="14" r="4" fill="#fff" opacity=".7"/><path d="M24 34 v10 M18 44 h12" ${S}/>`),
  },
  a18: {
    Q: W(`<ellipse cx="24" cy="24" rx="16" ry="6" ${S} stroke-width="2.6"/><ellipse cx="24" cy="24" rx="10" ry="3" ${F}/><path d="M4 24 h4 M40 24 h4" ${S} stroke-width="2"/>`),
    W: W(`<path d="M32 10 C18 10 12 20 16 30" ${S}/><path d="M12 26 l4 6 6 -4" ${S}/><circle cx="34" cy="14" r="5" ${F}/>`),
    E: W(`<path d="M24 5 L40 14 L40 32 L24 43 L8 32 L8 14 Z" ${S}/><path d="M24 13 L33 18 L33 29 L24 35 L15 29 L15 18 Z" ${F} opacity=".7"/>`),
    R: W(`<g ${F}><circle cx="10" cy="24" r="4"/><circle cx="22" cy="14" r="3.4"/><circle cx="22" cy="34" r="3.4"/><circle cx="34" cy="8" r="2.8"/><circle cx="34" cy="24" r="3"/><circle cx="34" cy="40" r="2.8"/><circle cx="43" cy="16" r="2.2"/><circle cx="43" cy="32" r="2.2"/></g>`),
  },
  D: W(`<path d="M24 3 L28 15 L40 8 L33 20 L45 24 L33 28 L40 40 L28 33 L24 45 L20 33 L8 40 L15 28 L3 24 L15 20 L8 8 L20 15 Z" ${F} opacity=".85"/><circle cx="24" cy="24" r="6" fill="#16110c"/>`),
  B: W(`<path d="M10 40 V20 L24 9 L38 20 V40" ${S}/><path d="M19 40 V29 H29 V40" ${S}/>`),
  C: W(`<path d="M24 44 C12 40 12 28 18 20 C18 28 22 28 22 24 C22 16 26 10 30 6 C30 16 38 20 36 32 C35 40 30 44 24 44 Z" ${F}/>`),
  // 火影忍者
  naruto: {
    Q: W(`<circle cx="24" cy="24" r="13" ${F} opacity=".35"/><path d="M24 11 C33 11 37 20 31 25 C26 29 19 25 22 20 C24 17 28 19 27 22" ${S}/><path d="M24 37 C15 37 11 28 17 23" ${S} stroke-width="2.4"/>`),
    W: W(`<g ${F}><circle cx="24" cy="12" r="5"/><circle cx="12" cy="32" r="5" opacity=".7"/><circle cx="36" cy="32" r="5" opacity=".7"/></g><path d="M24 18 v8 M12 38 v4 M36 38 v4" ${S} stroke-width="2.4"/>`),
    E: W(`<rect x="14" y="10" width="20" height="30" rx="6" ${S}/><path d="M17 18 h14 M17 26 h14 M17 34 h14" ${S} stroke-width="1.8" opacity=".6"/><path d="M36 8 l6 -2 M38 14 l6 0" ${S} stroke-width="2"/>`),
    R: W(`<circle cx="24" cy="24" r="5" ${F}/><path d="M24 4 L28 20 L24 24 L20 20 Z M44 24 L28 28 L24 24 L28 20 Z M24 44 L20 28 L24 24 L28 28 Z M4 24 L20 20 L24 24 L20 28 Z" ${F} opacity=".8"/>`),
  },
  sasuke: {
    Q: W(`<circle cx="22" cy="26" r="13" ${F}/><path d="M22 18 C28 20 28 30 22 32 C16 30 16 22 22 18 Z" fill="#fff" opacity=".55"/><path d="M36 14 l6 -6 M38 22 h6" ${S} stroke-width="2.2"/>`),
    W: W(`<circle cx="18" cy="30" r="7" ${F}/><path d="M18 30 L26 18 L30 26 L42 8 M18 30 L8 22 M18 30 L12 42 M18 30 L28 38" ${S} stroke-width="2.4"/>`),
    E: W(`<circle cx="24" cy="24" r="15" ${S}/><circle cx="24" cy="24" r="4" ${F}/><g ${F}><path d="M24 13 a4 4 0 1 1 -1 7 a6 6 0 0 0 1 -7 Z"/><path d="M33 29 a4 4 0 1 1 -7 1 a6 6 0 0 0 7 -1 Z"/><path d="M15 29 a4 4 0 1 1 6 -4 a6 6 0 0 0 -6 4 Z"/></g>`),
    R: W(`<path d="M30 4 L18 22 L26 22 L14 44 L34 18 L26 18 L36 4 Z" ${F}/>`),
  },
  kakashi: {
    Q: W(`<path d="M6 34 C12 18 22 14 30 18 C36 21 38 28 32 32 C28 35 22 32 24 28" ${S} stroke-width="4"/><circle cx="38" cy="14" r="4" ${F}/>`),
    W: W(`<path d="M4 40 h40" ${S}/><path d="M10 40 l4 -10 4 10 M22 40 l4 -14 4 14 M34 40 l4 -10 4 10" ${F}/><circle cx="26" cy="18" r="5" ${F} opacity=".6"/>`),
    E: W(`<path d="M8 40 L30 18" ${S} stroke-width="4"/><path d="M30 18 L36 8 L34 16 L42 12 L34 22 L40 24 L30 26" ${S} stroke-width="2.2"/>`),
    R: W(`<path d="M24 24 m-16 0 a16 16 0 1 1 16 16" ${S}/><path d="M24 24 m-9 0 a9 9 0 1 1 9 9" ${S} stroke-width="2.4"/><circle cx="24" cy="24" r="3" ${F}/>`),
  },
  sakura: {
    Q: W(`<path d="M10 22 h20 a6 6 0 0 1 0 12 h-20 Z" ${F}/><path d="M4 40 l8 -4 M44 40 l-8 -4 M24 42 v4" ${S} stroke-width="2.2"/><path d="M14 22 v-6 M20 22 v-7 M26 22 v-6" ${S} stroke-width="2.4"/>`),
    W: W(`<path d="M6 24 h12" ${S} stroke-width="2" opacity=".6"/><path d="M18 18 h16 a6 6 0 0 1 0 12 h-16 Z" ${F}/><path d="M38 12 l6 -4 M40 24 h6 M38 36 l6 4" ${S} stroke-width="2.2"/>`),
    E: W(`<path d="M24 40 C10 30 6 20 12 13 C17 8 23 11 24 16 C25 11 31 8 36 13 C42 20 38 30 24 40 Z" ${S}/><path d="M24 18 v12 M18 24 h12" ${S}/>`),
    R: W(`<path d="M24 4 L28 16 L40 16 L30 24 L34 36 L24 28 L14 36 L18 24 L8 16 L20 16 Z" ${F} opacity=".45"/><path d="M14 30 h16 a5 5 0 0 1 0 10 h-16 Z" ${F}/>`),
  },
  // 海賊王
  luffy: {
    Q: W(`<path d="M4 24 H30" ${S} stroke-width="5"/><path d="M30 16 h8 a8 8 0 0 1 0 16 h-8 Z" ${F}/>`),
    W: W(`<path d="M6 40 C16 30 24 20 40 10" ${S} stroke-width="3" stroke-dasharray="4 4"/><path d="M34 6 l8 2 -2 8" ${S}/><circle cx="10" cy="38" r="4" ${F}/>`),
    E: W(`<path d="M14 40 C10 32 18 28 14 20 M24 40 C20 32 28 28 24 20 M34 40 C30 32 38 28 34 20" ${S} stroke-width="2.6"/><path d="M8 14 L40 14" ${S} stroke-width="2" opacity=".6"/><path d="M16 8 h16" ${S} stroke-width="2.6"/>`),
    R: W(`<path d="M4 24 H14" ${S} stroke-width="4"/><path d="M14 8 h14 a16 16 0 0 1 0 32 h-14 Z" ${F}/><path d="M18 16 h10 M18 24 h12 M18 32 h10" stroke="#16110c" stroke-width="2"/>`),
  },
  zoro: {
    Q: W(`<path d="M6 34 C18 14 30 14 42 34" ${S} stroke-width="4"/><path d="M14 30 C22 20 28 20 36 30" ${S} stroke-width="2" opacity=".55"/><path d="M38 34 l6 2" ${S}/>`),
    W: W(`<path d="M8 40 L38 10 M8 10 L38 40 M6 24 H42" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="23" cy="25" r="4" ${F}/>`),
    E: W(`<path d="M6 30 L42 18" ${S} stroke-width="2" stroke-dasharray="3 4"/><path d="M30 10 C38 12 42 18 40 26" ${S} stroke-width="3"/><path d="M14 40 l-4 -8 6 2" ${S}/>`),
    R: W(`<circle cx="24" cy="24" r="16" ${S} stroke-dasharray="6 4"/><path d="M24 6 L24 42 M8 15 L40 33 M8 33 L40 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`),
  },
  sanji: {
    Q: W(`<path d="M8 36 C14 34 22 26 26 18 L34 14" ${S} stroke-width="4"/><path d="M30 10 l10 4 -6 8" ${S}/>`),
    W: W(`<path d="M24 24 m-14 0 a14 14 0 1 0 28 0" ${S} stroke-width="3"/><path d="M38 24 l4 -6 2 8" ${S}/><path d="M22 6 v14 M26 6 v14" ${S} stroke-width="2.4"/>`),
    E: W(`<path d="M10 40 h6 M20 32 h6 M30 24 h6" ${S} stroke-width="3"/><path d="M36 18 l4 -10" ${S}/><circle cx="40" cy="8" r="3" ${F}/>`),
    R: W(`<path d="M24 44 C12 40 10 28 16 20 C16 28 20 28 20 24 C20 16 24 10 28 6 C28 16 36 20 34 32 C33 40 30 44 24 44 Z" ${F}/><path d="M18 40 L40 26" stroke="#16110c" stroke-width="2.4" stroke-linecap="round"/>`),
  },
  nami: {
    Q: W(`<path d="M10 16 C10 8 22 6 26 12 C30 6 42 8 40 18 Z" ${F} opacity=".55"/><path d="M26 18 L20 30 L27 30 L21 44" ${S}/>`),
    W: W(`<g ${F} opacity=".8"><circle cx="16" cy="20" r="6"/><circle cx="30" cy="16" r="5"/><circle cx="26" cy="32" r="7"/></g><path d="M8 40 h10 M30 42 h10" ${S} stroke-width="2"/>`),
    E: W(`<path d="M24 24 m0 -16 C40 8 42 30 26 32 C14 34 14 18 26 20 C32 21 30 28 26 27" ${S}/>`),
    R: W(`<path d="M6 18 C6 8 20 6 24 12 C28 6 42 8 42 18 Z" ${F}/><path d="M14 22 L10 32 M24 22 L20 36 L26 36 L22 46 M34 22 L30 32" ${S} stroke-width="2.4"/>`),
  },
};

// 道具圖示
export const ITEM_ICONS = {
  gi: W(`<path d="M12 10 L20 8 L24 14 L28 8 L36 10 L40 22 L34 24 L34 40 H14 V24 L8 22 Z" fill="#ff8a2a"/><path d="M20 8 L24 22 L28 8" fill="none" stroke="#1f4fa0" stroke-width="3"/><rect x="14" y="26" width="20" height="4" fill="#1f4fa0"/>`),
  kiband: W(`<rect x="10" y="17" width="28" height="14" rx="5" fill="#2a63c9"/><circle cx="24" cy="24" r="4.5" fill="#bfe8ff"/><path d="M14 17 v14 M34 17 v14" stroke="#173a7a" stroke-width="2"/>`),
  boots: W(`<path d="M14 8 h10 v20 l12 4 c3 1 4 4 4 8 H12 Z" fill="#2a4fa0"/><path d="M14 28 h10 M12 36 h28" stroke="#e8c04a" stroke-width="3"/>`),
  potara: W(`<circle cx="16" cy="18" r="6" fill="#ffd34a"/><circle cx="32" cy="18" r="6" fill="#ffd34a"/><circle cx="16" cy="32" r="5" fill="#6ad08a"/><circle cx="32" cy="32" r="5" fill="#6ad08a"/><path d="M16 24 v3 M32 24 v3" stroke="#c9a020" stroke-width="2.4"/>`),
  control: W(`<circle cx="24" cy="26" r="13" fill="#2a1a12"/><circle cx="24" cy="26" r="10" fill="#ff7a3a" opacity=".9"/><path d="M24 16 v20 M14 26 h20" stroke="#7a2a10" stroke-width="1.4"/><circle cx="24" cy="26" r="4" fill="#ffe08a"/><rect x="21" y="6" width="6" height="7" rx="2" fill="#9a9a9a"/>`),
  ward: W(`<circle cx="24" cy="26" r="13" fill="#1f2a1f"/><circle cx="24" cy="26" r="10" fill="#5cff8a" opacity=".85"/><path d="M24 16 v20 M14 26 h20" stroke="#145a2a" stroke-width="1.4"/><circle cx="29" cy="22" r="2.4" fill="#ffd34a"/><rect x="21" y="6" width="6" height="7" rx="2" fill="#9a9a9a"/>`),
  senzu: W(`<path d="M14 30 C10 20 18 10 28 12 C38 14 40 26 32 34 C26 40 17 38 14 30 Z" fill="#8fbf4a"/><path d="M20 28 C22 22 26 18 32 18" fill="none" stroke="#d9f0a0" stroke-width="2.4" stroke-linecap="round"/>`),
  weights: W(`<rect x="10" y="16" width="28" height="16" rx="4" fill="#7a5a3a"/><rect x="10" y="21" width="28" height="6" fill="#c9a26a"/><path d="M16 16 v16 M32 16 v16" stroke="#3a2a1a" stroke-width="2"/>`),
  scouter: W(`<path d="M10 30 C10 18 18 12 28 12" fill="none" stroke="#c8c8c8" stroke-width="3" stroke-linecap="round"/><rect x="24" y="14" width="16" height="12" rx="2" fill="#5cff8a" opacity=".85"/><path d="M27 20 h10" stroke="#145a2a" stroke-width="1.6"/><circle cx="12" cy="32" r="4" fill="#9a9a9a"/>`),
  nimbus: W(`<path d="M8 30 C4 24 12 18 18 22 C20 14 32 14 32 22 C40 18 46 28 38 32 Z" fill="#ffd34a"/><path d="M12 30 C18 34 30 34 38 32" fill="none" stroke="#e0a020" stroke-width="2"/>`),
  armor: W(`<path d="M10 14 L18 10 H30 L38 14 L36 30 C32 38 16 38 12 30 Z" fill="#f3efe6"/><path d="M10 14 L16 20 M38 14 L32 20" stroke="#e0b24a" stroke-width="4" stroke-linecap="round"/><path d="M18 26 h12" stroke="#c9bfa8" stroke-width="2"/>`),
  kiamp: W(`<circle cx="24" cy="24" r="14" fill="none" stroke="#4fc3ff" stroke-width="3"/><path d="M24 12 V24 L32 30" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="#4fc3ff"/>`),
  cell: W(`<circle cx="24" cy="24" r="13" fill="#7bd36a"/><circle cx="20" cy="20" r="4" fill="#d8ffb0"/><circle cx="29" cy="28" r="3" fill="#3a8a3a"/><circle cx="18" cy="30" r="2" fill="#3a8a3a"/>`),
  kaioken: W(`<rect x="6" y="18" width="36" height="12" rx="3" fill="#d9472b"/><path d="M6 24 h36" stroke="#ff9a7a" stroke-width="1.6"/><rect x="20" y="16" width="8" height="16" rx="2" fill="#ffd34a"/>`),
  water: W(`<path d="M18 8 h12 v6 l4 6 v20 c0 3 -2 4 -4 4 h-12 c-2 0 -4 -1 -4 -4 v-20 l4 -6 z" fill="#bfe8ff" opacity=".9"/><path d="M16 26 h16 v12 c0 2 -1 3 -3 3 h-10 c-2 0 -3 -1 -3 -3 z" fill="#6fb8ff"/><rect x="18" y="6" width="12" height="4" fill="#8a6a4a"/>`),
  // 《英雄聯盟》原型的裝備
  capsule: W(`<rect x="9" y="17" width="30" height="14" rx="7" fill="#e9eef5"/><path d="M24 17 h8 a7 7 0 0 1 0 14 h-8 z" fill="#4f9bff"/><circle cx="15" cy="24" r="2" fill="#9aa8bc"/><path d="M27 21 h6" stroke="#bfe0ff" stroke-width="1.6" stroke-linecap="round"/>`),
  scroll: W(`<rect x="12" y="10" width="24" height="28" fill="#f0dfb0"/><rect x="9" y="8" width="30" height="5" rx="2.5" fill="#a8653a"/><rect x="9" y="35" width="30" height="5" rx="2.5" fill="#a8653a"/><text x="24" y="29" text-anchor="middle" font-size="13" font-weight="900" fill="#c23a1a" font-family="serif">龜</text>`),
  gloves: W(`<path d="M14 40 V20 c0 -2 3 -2 3 0 v-6 c0 -2 3 -2 3 0 v-2 c0 -2 3 -2 3 0 v2 c0 -2 3 -2 3 0 v8 l3 -3 c2 -2 4 0 3 2 l-5 9 v10 z" fill="#d9472b"/><circle cx="21" cy="30" r="4" fill="none" stroke="#ffe08a" stroke-width="1.8"/><path d="M21 24 v3 M21 33 v3 M15 30 h3 M24 30 h3" stroke="#ffe08a" stroke-width="1.6"/>`),
  cloth: W(`<path d="M12 12 L20 9 h8 L36 12 L34 38 H14 Z" fill="#7a8a6a"/><path d="M14 18 h20 M14 24 h20 M15 30 h18" stroke="#56634a" stroke-width="2"/><path d="M20 9 L24 15 L28 9" fill="none" stroke="#c9b98a" stroke-width="2"/>`),
  cape: W(`<path d="M16 8 h16 l8 32 c-6 2 -10 -2 -16 0 c-6 2 -10 -2 -16 0 z" fill="#8a3ad9"/><path d="M16 8 h16 l-2 6 h-12 z" fill="#ffd34a"/><path d="M24 14 V38" stroke="#5a1fa0" stroke-width="1.6"/>`),
  tear: W(`<path d="M24 6 C30 16 36 22 36 30 a12 12 0 0 1 -24 0 C12 22 18 16 24 6 Z" fill="#4f9bff"/><path d="M19 30 a5 5 0 0 0 5 5" fill="none" stroke="#d8ecff" stroke-width="2.4" stroke-linecap="round"/>`),
  sheen: W(`<circle cx="24" cy="24" r="13" fill="none" stroke="#bfe8ff" stroke-width="4"/><circle cx="24" cy="11" r="3.4" fill="#ffffff"/><circle cx="35" cy="30" r="3" fill="#bfe8ff"/><circle cx="13" cy="30" r="3" fill="#bfe8ff"/>`),
  fang: W(`<path d="M14 8 C18 16 18 28 24 40 C30 28 30 16 34 8 C30 12 18 12 14 8 Z" fill="#f3efe6"/><path d="M24 24 V38" stroke="#d9472b" stroke-width="2.4" stroke-linecap="round"/><path d="M14 8 C18 12 30 12 34 8" fill="none" stroke="#8a1f12" stroke-width="2"/>`),
  brave: W(`<path d="M24 4 L28 10 V32 H20 V10 Z" fill="#dfe6ee"/><path d="M24 6 V31" stroke="#9aa8bc" stroke-width="1.4"/><rect x="13" y="32" width="22" height="4" fill="#b88a3a"/><rect x="22" y="36" width="4" height="8" fill="#5a3a1a"/>`),
  tome: W(`<path d="M10 10 h14 v30 h-14 z" fill="#2a63c9"/><path d="M24 10 h14 v30 h-14 z" fill="#1f4fa0"/><path d="M24 10 v30" stroke="#ffd34a" stroke-width="2"/><circle cx="17" cy="22" r="3.5" fill="#bfe8ff"/><circle cx="31" cy="22" r="3.5" fill="#ffd34a"/>`),
  bramble: W(`<rect x="11" y="16" width="26" height="16" rx="4" fill="#6a5a3a"/><path d="M11 20 l-5 -2 l5 5 M37 20 l5 -2 l-5 5 M18 16 l-1 -6 l4 6 M30 16 l1 -6 l-4 6 M18 32 l-1 6 l4 -6 M30 32 l1 6 l-4 -6" fill="#c9bfa8" stroke="#c9bfa8" stroke-width="1.6" stroke-linejoin="round"/>`),
  trinity: W(`<circle cx="24" cy="24" r="14" fill="none" stroke="#ffd34a" stroke-width="4"/><circle cx="24" cy="12" r="4" fill="#d9472b"/><circle cx="34.4" cy="30" r="4" fill="#4f9bff"/><circle cx="13.6" cy="30" r="4" fill="#7bd36a"/>`),
  zsword: W(`<path d="M24 2 L29 9 V33 H19 V9 Z" fill="#f3efe6"/><path d="M21 12 h6 M21 18 h6" stroke="#d9472b" stroke-width="2.4"/><text x="24" y="29" text-anchor="middle" font-size="9" font-weight="900" fill="#1a2133" font-family="sans-serif">Z</text><rect x="12" y="33" width="24" height="4" fill="#ffd34a"/><rect x="22" y="37" width="4" height="8" fill="#2a3a6a"/>`),
  majin: W(`<path d="M14 8 C18 16 18 28 24 40 C30 28 30 16 34 8 C30 12 18 12 14 8 Z" fill="#ff8ab8"/><path d="M24 22 V38" stroke="#8a1f12" stroke-width="2.4" stroke-linecap="round"/><text x="24" y="20" text-anchor="middle" font-size="9" font-weight="900" fill="#1a2133" font-family="sans-serif">M</text>`),
  hourglass: W(`<rect x="12" y="6" width="24" height="4" rx="1.5" fill="#b88a3a"/><rect x="12" y="38" width="24" height="4" rx="1.5" fill="#b88a3a"/><path d="M15 10 h18 c0 8 -7 10 -7 14 c0 4 7 6 7 14 h-18 c0 -8 7 -10 7 -14 c0 -4 -7 -6 -7 -14 z" fill="#e9eef5" opacity=".9"/><path d="M18 34 h12 l-6 -6 z M20 14 h8 l-4 5 z" fill="#ffd34a"/>`),
  halo: W(`<ellipse cx="24" cy="14" rx="13" ry="4.5" fill="none" stroke="#ffe08a" stroke-width="3.4"/><path d="M24 22 C14 22 10 30 8 40 C16 36 20 34 24 34 C28 34 32 36 40 40 C38 30 34 22 24 22 Z" fill="#f3efe6"/>`),
  thorn: W(`<path d="M12 12 L20 9 h8 L36 12 L34 38 H14 Z" fill="#5a4a2a"/><path d="M12 14 l-6 -3 M36 14 l6 -3 M14 24 l-7 0 M34 24 l7 0 M14 34 l-6 3 M34 34 l6 3 M24 9 v-6" stroke="#e9dcc0" stroke-width="2.6" stroke-linecap="round"/><path d="M18 20 h12 M18 28 h12" stroke="#2a1f10" stroke-width="2"/>`),
  beerus: W(`<path d="M8 30 C8 18 16 10 24 10 C32 10 40 18 40 30 Z" fill="#8a3ad9"/><path d="M8 30 h32 v5 h-32 z" fill="#ffd34a"/><path d="M14 24 L10 8 L20 18 M34 24 L38 8 L28 18" fill="#c99aff"/><circle cx="24" cy="22" r="3.5" fill="#4fc3ff"/>`),
  staff: W(`<path d="M22 14 L26 14 L27 44 L21 44 Z" fill="#8a6a4a"/><circle cx="24" cy="10" r="7" fill="#4f9bff"/><circle cx="24" cy="10" r="3" fill="#d8ecff"/><path d="M16 6 L19 9 M32 6 L29 9 M24 0 V3" stroke="#ffd34a" stroke-width="2" stroke-linecap="round"/>`),
  holy: W(`<path d="M20 8 h8 v6 l6 8 v16 c0 3 -2 4 -4 4 h-12 c-2 0 -4 -1 -4 -4 v-16 l6 -8 z" fill="#f3efe6" opacity=".95"/><path d="M16 28 h16 v10 c0 2 -1 3 -3 3 h-10 c-2 0 -3 -1 -3 -3 z" fill="#ffd34a"/><rect x="19" y="5" width="10" height="4" fill="#a8653a"/><path d="M24 30 v8 M20 34 h8" stroke="#ffffff" stroke-width="2"/>`),
};

// 《英雄聯盟》全裝備的圖示：沒有手繪的道具依主屬性畫一個記號（刀、珠、盾、弓、鞋、結晶、水滴、藥瓶），
// 顏色依 id 小幅變化，層級用右上角的刻痕表示（進階一道、終極兩道金色）。
const hashOf = (id) => { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const GLYPH = {
  blade: (c, d) => `<path d="M34 6 L40 8 L18 34 L13 32 Z" fill="${c}"/><path d="M36 8 L16 32" stroke="${d}" stroke-width="1.4"/><path d="M10 30 L18 38" stroke="#b88a3a" stroke-width="4" stroke-linecap="round"/><path d="M8 40 L13 35" stroke="#5a3a1a" stroke-width="4" stroke-linecap="round"/>`,
  orb: (c, d) => `<circle cx="24" cy="25" r="13" fill="${c}"/><circle cx="24" cy="25" r="8" fill="none" stroke="${d}" stroke-width="2.4"/><circle cx="19" cy="20" r="3.4" fill="#ffffff" opacity=".8"/>`,
  shield: (c, d) => `<path d="M24 6 L39 11 C39 26 34 36 24 42 C14 36 9 26 9 11 Z" fill="${c}"/><path d="M24 11 L34 14 C34 25 31 32 24 37 Z" fill="${d}" opacity=".55"/>`,
  heart: (c, d) => `<path d="M24 40 C10 30 7 22 10 16 C13 10 21 10 24 16 C27 10 35 10 38 16 C41 22 38 30 24 40 Z" fill="${c}"/><path d="M15 17 C16 14 19 14 20 16" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`,
  bow: (c, d) => `<path d="M14 6 C34 12 34 36 14 42" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M14 6 V42" stroke="${d}" stroke-width="1.6"/><path d="M8 24 H38 M33 19 L39 24 L33 29" fill="none" stroke="#f3efe6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  boot: (c, d) => `<path d="M14 8 h11 v20 l11 4 c3 1 5 4 5 8 H12 Z" fill="${c}"/><path d="M14 26 h11 M12 36 h29" stroke="${d}" stroke-width="2.6"/>`,
  crystal: (c, d) => `<path d="M24 5 L35 18 L24 43 L13 18 Z" fill="${c}"/><path d="M13 18 H35 M24 5 L20 18 L24 43 L28 18 Z" fill="none" stroke="${d}" stroke-width="1.6" stroke-linejoin="round"/>`,
  drop: (c, d) => `<path d="M24 6 C30 16 36 22 36 30 a12 12 0 0 1 -24 0 C12 22 18 16 24 6 Z" fill="${c}"/><path d="M19 30 a5 5 0 0 0 5 5" fill="none" stroke="${d}" stroke-width="2.4" stroke-linecap="round"/>`,
  flask: (c, d) => `<path d="M20 6 h8 v10 l9 16 c2 5 -1 10 -6 10 h-14 c-5 0 -8 -5 -6 -10 l9 -16 z" fill="#e9eef5" opacity=".9"/><path d="M14 30 h20 l2 4 c1 4 -1 7 -5 7 h-14 c-4 0 -6 -3 -5 -7 z" fill="${c}"/><rect x="19" y="4" width="10" height="4" rx="1" fill="#8a6a4a"/>`,
};
const PAL = { blade: ['#dfe6ee', '#8a96a8'], orb: ['#4f9bff', '#bfe0ff'], shield: ['#9aa6a0', '#4f5a55'], heart: ['#e0453a', '#8a1f12'], bow: ['#c98a3a', '#5a3a1a'], boot: ['#3a6ac9', '#e8c04a'], crystal: ['#7fd8e8', '#2a8a9a'], drop: ['#4f9bff', '#d8ecff'], flask: ['#e0453a', '#ffffff'] };
function glyphOf(it) {
  const s = it.stats || {};
  if (it.tier === 0) return 'flask';
  if (s.ms || it.boots) return 'boot';
  if (s.ap || s.mpen || s.mpenPct) return 'orb';
  if (s.crit || s.as) return 'bow';
  if (s.ad || s.leth || s.apen) return 'blade';
  if (s.armor || s.mr || s.ten) return 'shield';
  if (s.hp || s.hpr) return 'heart';
  if (s.mp || s.mpr) return 'drop';
  return 'crystal';
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join(''); }
function genIcon(it) {
  const g = glyphOf(it), h = hashOf(it.id), [c, d] = PAL[g];
  const k = 0.82 + ((h % 7) / 6) * 0.36; // 同類道具的明暗變化
  let mark = '';
  if (it.tier === 2) mark = '<path d="M38 4 L44 4 L44 10" fill="none" stroke="#c9d2dc" stroke-width="2.4" stroke-linecap="round"/>';
  if (it.tier === 3) mark = '<path d="M36 4 L44 4 L44 12 M40 4 L44 8" fill="none" stroke="#ffd34a" stroke-width="2.4" stroke-linecap="round"/>';
  // 有被動或主動的道具在左下加一個小記號
  const fx = it.psv || it.act ? `<circle cx="8" cy="41" r="3" fill="${it.act ? '#ffd34a' : '#f3efe6'}"/>` : '';
  return W(GLYPH[g](shade(c, k), d) + mark + fx);
}
const _hand = ITEM_ICONS;
export const itemIcon = (id) => _hand[id] || (_hand[id] = (() => { const it = ITEMS.find((i) => i.id === id); return it ? genIcon(it) : ''; })());
