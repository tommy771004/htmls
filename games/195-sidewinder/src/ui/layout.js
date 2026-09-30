// 版面：畫布永遠滿版；比賽時用 renderer.setInsets 讓出 HUD 與觸控區，再依 trackRectOnScreen 擺倒數／橫幅。
//   wide     橫向桌機：右側看板欄（名次塔等），賽道在左側
//   portrait 直式手機：賽道在上、HUD 條在中、觸控鈕在下
//   land     橫式手機：賽道滿版，觸控鈕疊在兩側，HUD 縮成上緣一條

export function computeLayout(W, H, { race, touch }) {
  const portrait = H > W * 1.05;
  const land = !portrait && H < 560;
  const mode = portrait ? 'portrait' : land ? 'land' : 'wide';
  const out = { mode, W, H, side: 0, insets: { top: 0, right: 0, bottom: 0, left: 0 }, railW: 0, stripY: 0, stripH: 0, touchH: 0 };
  if (!race) return out;
  if (mode === 'wide') {
    out.railW = Math.round(Math.max(236, Math.min(300, W * 0.2)));
    out.insets = { top: 12, right: out.railW + 8, bottom: 12, left: 12 };
    if (touch) {
      out.touchH = Math.round(Math.max(150, Math.min(210, H * 0.26)));
      out.insets.bottom = out.touchH + 8;
    }
  } else if (mode === 'portrait') {
    out.touchH = touch ? Math.round(Math.max(172, Math.min(250, H * 0.27))) : 0;
    const trackH = Math.round(Math.min(W * 0.8, H - out.touchH - 176));
    out.stripY = trackH;
    out.stripH = H - out.touchH - trackH;
    out.insets = { top: 6, right: 6, bottom: H - trackH + 4, left: 6 };
  } else {
    out.touchH = touch ? H : 0;
    const side = touch ? Math.round(Math.min(W * 0.2, 190)) : 0;
    out.side = side;
    out.insets = { top: 46, right: side + 4, bottom: 6, left: side + 4 };
  }
  return out;
}

// 把版面寫進 CSS 變數與 body class
export function applyLayout(L, body) {
  body.classList.toggle('l-wide', L.mode === 'wide');
  body.classList.toggle('l-portrait', L.mode === 'portrait');
  body.classList.toggle('l-land', L.mode === 'land');
  const st = document.documentElement.style;
  st.setProperty('--rail-w', L.railW + 'px');
  st.setProperty('--strip-y', L.stripY + 'px');
  st.setProperty('--strip-h', L.stripH + 'px');
  st.setProperty('--touch-h', L.touchH + 'px');
  st.setProperty('--side', L.side + 'px');
}
