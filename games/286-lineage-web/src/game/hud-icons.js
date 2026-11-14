// 286 天堂實境客戶端：右下角工具列與自動狩獵高精細向量圖示組（純圖示無文字、免額外圖片請求）

export const HUD_ICONS = {
  // 道具欄：皮革冒險行囊與黃銅鎖扣
  bag: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-bag-b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#a86438"/>
        <stop offset="55%" stop-color="#6d3a1c"/>
        <stop offset="100%" stop-color="#3c1e0d"/>
      </linearGradient>
      <linearGradient id="ll-i-bag-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="100%" stop-color="#b47b2b"/>
      </linearGradient>
    </defs>
    <path d="M9 5.5c0-1.7 1.3-2.8 3-2.8s3 1.1 3 2.8" fill="none" stroke="url(#ll-i-bag-g)" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="4" y="6.2" width="16" height="14.6" rx="4.2" fill="url(#ll-i-bag-b)" stroke="#2b1409" stroke-width="0.9"/>
    <path d="M4.3 9.2c0-2.1 1.6-3.2 3.7-3.2h8c2.1 0 3.7 1.1 3.7 3.2v1.8c0 1.4-1.2 2.4-2.7 2.4H7c-1.5 0-2.7-1-2.7-2.4z" fill="#8b4d27" stroke="#f3cf7a" stroke-width="0.65" stroke-opacity="0.7"/>
    <rect x="10.4" y="10.8" width="3.2" height="3.6" rx="1" fill="url(#ll-i-bag-g)" stroke="#4a2c0a" stroke-width="0.6"/>
    <circle cx="12" cy="12.6" r="0.7" fill="#38bdf8"/>
    <path d="M7.5 16.5h9" stroke="#f5d07a" stroke-width="0.8" stroke-opacity="0.35" stroke-linecap="round"/>
  </svg>`,

  // 魔法書：鎏金秘法典籍與翡翠魔導徽印
  spells: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-sp-cov" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e4d46"/>
        <stop offset="60%" stop-color="#112b32"/>
        <stop offset="100%" stop-color="#09151c"/>
      </linearGradient>
      <linearGradient id="ll-i-sp-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="100%" stop-color="#c0842e"/>
      </linearGradient>
      <radialGradient id="ll-i-sp-gem" cx="45%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#a7f3d0"/>
        <stop offset="50%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#064e3b"/>
      </radialGradient>
    </defs>
    <rect x="4.5" y="3.2" width="15" height="17.6" rx="2.2" fill="url(#ll-i-sp-cov)" stroke="url(#ll-i-sp-gold)" stroke-width="1.2"/>
    <rect x="4.5" y="3.2" width="3.2" height="17.6" rx="1" fill="#0d2224" stroke="url(#ll-i-sp-gold)" stroke-width="0.8"/>
    <path d="M13.5 6.8l1.2 3.1 3.1 1.2-3.1 1.2-1.2 3.1-1.2-3.1-3.1-1.2 3.1-1.2z" fill="url(#ll-i-sp-gold)"/>
    <circle cx="13.5" cy="11.1" r="1.9" fill="url(#ll-i-sp-gem)" stroke="#fef08a" stroke-width="0.5"/>
    <path d="M9.6 17.6h7.8" stroke="url(#ll-i-sp-gold)" stroke-width="0.9" stroke-linecap="round" stroke-opacity="0.75"/>
  </svg>`,

  // 狀態／紙娃娃：藍底金邊皇家紋章盾
  status: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-st-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="50%" stop-color="#d49b42"/>
        <stop offset="100%" stop-color="#85561a"/>
      </linearGradient>
      <linearGradient id="ll-i-st-in" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#254c8f"/>
        <stop offset="100%" stop-color="#0e1e3f"/>
      </linearGradient>
    </defs>
    <path d="M12 2.8l7.4 2.7v5.7c0 4.8-3.1 8.4-7.4 10.1-4.3-1.7-7.4-5.3-7.4-10.1V5.5z" fill="url(#ll-i-st-in)" stroke="url(#ll-i-st-rim)" stroke-width="1.5"/>
    <path d="M12 6.8c.9 1.6 1 3 0 4.3 1.4-.6 2.5-.2 2.9.8.3.9-.4 1.9-1.6 2 .5.8.2 1.8-.6 2.2l-.7 1.1-.7-1.1c-.8-.4-1.1-1.4-.6-2.2-1.2-.1-1.9-1.1-1.6-2 .4-1 1.5-1.4 2.9-.8-1-1.3-.9-2.7 0-4.3z" fill="url(#ll-i-st-rim)"/>
  </svg>`,

  // 世界地圖：古羊皮卷軸與羅盤標記
  map: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-mp-p" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f5dfaf"/>
        <stop offset="100%" stop-color="#b98b4e"/>
      </linearGradient>
    </defs>
    <path d="M3.8 6.4l5.2-2.2 6 2.2 5.2-2.2v13.4l-5.2 2.2-6-2.2-5.2 2.2z" fill="url(#ll-i-mp-p)" stroke="#5c3a18" stroke-width="1"/>
    <path d="M9 4.2v13.4M15 6.4v13.4" stroke="#7c5228" stroke-width="0.7" stroke-opacity="0.55"/>
    <path d="M6.4 13.6c1.8-1.9 3.6-1.2 4.8-3.1 1-1.6 2.9-1.1 4.1-.4" fill="none" stroke="#854d0e" stroke-width="1.15" stroke-dasharray="1.8 1.5" stroke-linecap="round"/>
    <circle cx="16.8" cy="10.4" r="2.2" fill="#dc2626" stroke="#fef08a" stroke-width="0.7"/>
    <circle cx="16.8" cy="10.4" r="0.7" fill="#fef08a"/>
  </svg>`,

  // 內掛設定：鎏金八齒魔導齒輪與紅寶石核心
  auto: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-ge-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="55%" stop-color="#d49b42"/>
        <stop offset="100%" stop-color="#8b5a19"/>
      </linearGradient>
    </defs>
    <path d="M10.4 2.5h3.2l.6 2.2c.6.2 1.2.4 1.7.8l2-1.1 2.2 2.2-1.1 2c.4.5.6 1.1.8 1.7l2.2.6v3.2l-2.2.6c-.2.6-.4 1.2-.8 1.7l1.1 2-2.2 2.2-2-1.1c-.5.4-1.1.6-1.7.8l-.6 2.2h-3.2l-.6-2.2c-.6-.2-1.2-.4-1.7-.8l-2 1.1-2.2-2.2 1.1-2c-.4-.5-.6-1.1-.8-1.7L2.5 13.6v-3.2l2.2-.6c.2-.6.4-1.2.8-1.7l-1.1-2 2.2-2.2 2 1.1c.5-.4 1.1-.6 1.7-.8z" fill="url(#ll-i-ge-g)" stroke="#3d2408" stroke-width="0.7"/>
    <circle cx="12" cy="12" r="4.3" fill="#131922" stroke="#f5d07a" stroke-width="0.8"/>
    <circle cx="12" cy="12" r="2.1" fill="#34d399"/>
  </svg>`,

  // 鎖敵攻擊：雙十字精鋼戰劍
  targetSword: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-sw-b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="65%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
      <linearGradient id="ll-i-sw-h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="100%" stop-color="#b47b2b"/>
      </linearGradient>
    </defs>
    <path d="M19.8 3.6l-1.4 4.2-7.8 7.8-2.2-2.2 7.8-7.8z" fill="url(#ll-i-sw-b)" stroke="#1e293b" stroke-width="0.7"/>
    <path d="M4.2 3.6l3.6 1.4 7.8 7.8-2.2 2.2-7.8-7.8z" fill="url(#ll-i-sw-b)" stroke="#1e293b" stroke-width="0.7"/>
    <path d="M6.2 13.8l4 4M17.8 13.8l-4 4" stroke="url(#ll-i-sw-h)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M7 17l-2.6 2.6M17 17l2.6 2.6" stroke="#7c2d12" stroke-width="2" stroke-linecap="round"/>
    <circle cx="4" cy="20" r="1.2" fill="#f59e0b"/>
    <circle cx="20" cy="20" r="1.2" fill="#f59e0b"/>
  </svg>`,

  // 拾取道具：鑲金寶箱與星芒
  pickup: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-pk-w" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#b45309"/>
        <stop offset="100%" stop-color="#451a03"/>
      </linearGradient>
      <linearGradient id="ll-i-pk-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>
    <path d="M4 9.2c0-2.3 1.7-3.8 4-3.8h8c2.3 0 4 1.5 4 3.8v1.3H4z" fill="#92400e" stroke="url(#ll-i-pk-g)" stroke-width="1"/>
    <rect x="4" y="10.5" width="16" height="8.5" rx="1.6" fill="url(#ll-i-pk-w)" stroke="url(#ll-i-pk-g)" stroke-width="1"/>
    <path d="M8.2 5.4v13.6M15.8 5.4v13.6" stroke="url(#ll-i-pk-g)" stroke-width="1.15" stroke-opacity="0.85"/>
    <rect x="10.3" y="9.2" width="3.4" height="3.8" rx="0.8" fill="url(#ll-i-pk-g)" stroke="#451a03" stroke-width="0.6"/>
    <circle cx="12" cy="11.1" r="0.8" fill="#38bdf8"/>
    <path d="M18.6 2.4l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="#fef08a"/>
  </svg>`,

  // 系統控制：典雅銅金控制推桿
  system: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-sy-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fde68a"/>
        <stop offset="100%" stop-color="#b47b2b"/>
      </linearGradient>
    </defs>
    <line x1="4.5" y1="6.8" x2="19.5" y2="6.8" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
    <line x1="4.5" y1="12" x2="19.5" y2="12" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
    <line x1="4.5" y1="17.2" x2="19.5" y2="17.2" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
    <circle cx="9.2" cy="6.8" r="2.3" fill="url(#ll-i-sy-g)" stroke="#1e293b" stroke-width="0.7"/>
    <circle cx="15.2" cy="12" r="2.3" fill="url(#ll-i-sy-g)" stroke="#1e293b" stroke-width="0.7"/>
    <circle cx="10.5" cy="17.2" r="2.3" fill="url(#ll-i-sy-g)" stroke="#1e293b" stroke-width="0.7"/>
  </svg>`,

  // 周邊鎖敵圓鈕：精準準星鎖定符文
  scanTarget: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-sc-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="100%" stop-color="#d49b42"/>
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="6.8" fill="none" stroke="url(#ll-i-sc-g)" stroke-width="1.5" stroke-dasharray="5.5 2.6"/>
    <path d="M12 2.8v3.2M12 18v3.2M2.8 12h3.2M18 12h3.2" stroke="#fde68a" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="12" r="2.2" fill="#f43f5e" stroke="#fef08a" stroke-width="0.8"/>
  </svg>`,

  // 自動狩獵（待機）：鎏金魔導啟動核心
  autoIdle: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-au-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef3c7"/>
        <stop offset="50%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#92400e"/>
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="12.5" fill="none" stroke="url(#ll-i-au-g)" stroke-width="1.35" stroke-dasharray="11 3.4"/>
    <circle cx="16" cy="16" r="9.4" fill="rgba(234,179,8,0.08)" stroke="#f5d07a" stroke-width="0.7" stroke-opacity="0.5"/>
    <path d="M12.4 10.2l10.2 5.8-10.2 5.8z" fill="url(#ll-i-au-g)" stroke="#451a03" stroke-width="0.8" stroke-linejoin="round"/>
  </svg>`,

  // 自動狩獵（執行中）：翠玉啟動雙刃暫停符印
  autoActive: `<svg viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="ll-i-aa-e" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a7f3d0"/>
        <stop offset="100%" stop-color="#10b981"/>
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="12.5" fill="none" stroke="url(#ll-i-aa-e)" stroke-width="1.6" stroke-dasharray="9 3"/>
    <circle cx="16" cy="16" r="9.2" fill="rgba(16,185,129,0.16)" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="11.5" y="10.6" width="3.4" height="10.8" rx="1.2" fill="url(#ll-i-aa-e)"/>
    <rect x="17.1" y="10.6" width="3.4" height="10.8" rx="1.2" fill="url(#ll-i-aa-e)"/>
  </svg>`,
};
