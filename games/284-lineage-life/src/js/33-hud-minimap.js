/* ==========================================================================
   HTMLS 284：右上角小地圖與清單（桌機 HUD）
   - 小地圖：拿目前場景（安全區 #town-npc-map／狩獵區 #battle-view）的背景圖縮成正方形，
     安全區把 NPC 站位畫成小點，中間白點是自己。
   - 清單：安全區列出 NPC（點一下等同點地圖上的那位 NPC）；狩獵區不顯示。
   只讀既有 DOM，不改任何遊戲狀態；手機版由 CSS 隱藏。
   ========================================================================== */
(function () {
    if (typeof document === 'undefined') return;
    var mm, view, nameEl, zoneEl, tracker, lastKey = '', lastBg = '';

    function build() {
        var gs = document.getElementById('game-screen');
        if (!gs || document.getElementById('hud-minimap')) return !!mm;
        mm = document.createElement('div');
        mm.id = 'hud-minimap';
        mm.setAttribute('aria-hidden', 'true');
        mm.innerHTML = '<div class="mm-view"><i class="mm-me"></i></div><div class="mm-name"><b></b><span class="mm-zone"></span></div>';
        view = mm.querySelector('.mm-view');
        nameEl = mm.querySelector('.mm-name b');
        zoneEl = mm.querySelector('.mm-zone');
        tracker = document.createElement('nav');
        tracker.id = 'hud-tracker';
        tracker.setAttribute('aria-label', '本區 NPC');
        gs.appendChild(mm);
        gs.appendChild(tracker);
        return true;
    }

    function visible(el) { return !!(el && !el.classList.contains('hidden') && el.offsetParent !== null); }
    function lastUrl(bg) {
        var m = bg && bg.match(/url\((['"]?)([^'")]+)\1\)(?!.*url\()/);
        return m ? m[2] : '';
    }

    function tick() {
        if (!build()) return;
        var gs = document.getElementById('game-screen');
        if (!gs || gs.classList.contains('hidden') || getComputedStyle(mm).display === 'none') return;

        var townView = document.getElementById('town-view');
        var inTown = visible(townView);
        var src = inTown ? document.getElementById('town-npc-map') : document.getElementById('battle-view');
        var bg = src ? lastUrl(getComputedStyle(src).backgroundImage) : '';
        if (bg !== lastBg) {
            lastBg = bg;
            view.style.backgroundImage = bg ? 'url("' + bg + '")' : 'none';
        }

        var sel = document.getElementById('map-select');
        var label = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : '';
        if (nameEl.textContent !== label) nameEl.textContent = label;
        zoneEl.textContent = inTown ? '安全區域' : '戰鬥區域';
        zoneEl.classList.toggle('is-hunt', !inTown);

        // NPC 小點與清單（只在安全區）
        var npcs = inTown ? Array.prototype.slice.call(document.querySelectorAll('#town-npc-map .town-npc')) : [];
        var key = (inTown ? 't' : 'b') + '|' + label + '|' + npcs.map(function (n) {
            var nm = n.querySelector('.tn-name');
            return (nm ? nm.textContent : '') + '@' + n.style.left + ',' + n.style.top;
        }).join(';');
        if (key !== lastKey) {
            lastKey = key;
            Array.prototype.slice.call(view.querySelectorAll('.mm-dot')).forEach(function (d) { d.remove(); });
            tracker.textContent = '';
            if (npcs.length) {
                var head = document.createElement('div');
                head.className = 'trk-head';
                head.textContent = '本區 NPC';
                tracker.appendChild(head);
            }
            var crop = 9 / 16;   // 16:9 場景圖以 cover 塞進正方形：左右各裁掉 (1 - 9/16) / 2
            npcs.forEach(function (n) {
                var x = parseFloat(n.style.left), y = parseFloat(n.style.top);
                if (isFinite(x) && isFinite(y)) {
                    var mx = (x / 100 - (1 - crop) / 2) / crop;
                    if (mx >= 0 && mx <= 1) {
                        var d = document.createElement('i');
                        d.className = 'mm-dot';
                        d.style.left = (mx * 100).toFixed(1) + '%';
                        d.style.top = y.toFixed(1) + '%';
                        view.appendChild(d);
                    }
                }
                var nm = n.querySelector('.tn-name'), tt = n.querySelector('.tn-title');
                if (!nm) return;
                var b = document.createElement('button');
                b.type = 'button';
                b.textContent = nm.textContent;
                if (tt && tt.textContent) {
                    var s = document.createElement('span');
                    s.textContent = tt.textContent;
                    b.appendChild(s);
                }
                b.addEventListener('click', function () { if (n.isConnected) n.click(); });
                tracker.appendChild(b);
            });
        }

        // 清單接在地圖操作列下面
        var ctl = document.querySelector('#map-view-panel > .panel-header > div');
        if (ctl) {
            var r = ctl.getBoundingClientRect();
            var top = Math.round(r.bottom + 4) + 'px';
            if (tracker.style.top !== top) tracker.style.top = top;
        }
    }

    function start() { tick(); setInterval(tick, 500); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
