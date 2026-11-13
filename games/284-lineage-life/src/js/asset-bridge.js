/* ==========================================================================
   Offline Asset Bridge (HTMLS 284 Integration)
   Maps logical asset URLs (`assets/...`, `public/assets/...`, percent-encoded
   CJK/spaces, `.ogg` -> `.mp3`, `castle-crown.gif` -> `.png`) to ASCII-safe
   files under `../assets/284/` and suppresses HTTP 404 probes for uncached keys
   while preserving native `onerror` fallback chains and logical `getAttribute`.
   ========================================================================== */
(function () {
  if (typeof window === 'undefined') return;

  var MAP = window.__LL_ASSETS || Object.create(null);
  var BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="8" fill="#1e293b" stroke="#475569" stroke-width="2"/>' +
      '<text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#94a3b8">?</text>' +
    '</svg>'
  );

  window.__LL_BLANK_GIF = BLANK_GIF;
  window.__LL_SVG_PLACEHOLDER = PLACEHOLDER_SVG;

  function normalizePath(raw) {
    if (!raw || typeof raw !== 'string') return null;
    var s = raw.trim();
    if (!s || /^(?:data:|blob:|https?:|mailto:|javascript:|\.\.\/assets\/284\/)/i.test(s)) return null;
    s = s.replace(/^[./]+/, '').replace(/[?#].*$/, '');
    if (s.indexOf('%') !== -1) {
      try { s = decodeURIComponent(s); } catch (_) {}
    }
    if (s.indexOf('public/assets/') === 0 || s.indexOf('assets/') === 0) return s;
    return null;
  }

  function resolveAsset(raw) {
    var norm = normalizePath(raw);
    if (!norm) return { local: false, found: true, url: raw };
    var mapped = MAP[norm];
    if (mapped) return { local: true, found: true, url: mapped, norm: norm };
    return { local: true, found: false, url: BLANK_GIF, norm: norm };
  }

  function hasAsset(raw) {
    var r = resolveAsset(raw);
    return !!(r.local && r.found);
  }

  function resolveAudioCandidates(baseNoExt, exts) {
    var out = [];
    var seen = Object.create(null);
    for (var i = 0; i < exts.length; i++) {
      var mapped = MAP[baseNoExt + '.' + exts[i]];
      if (mapped && !seen[mapped]) {
        seen[mapped] = true;
        out.push(mapped);
      }
    }
    return out;
  }

  function rewriteCssUrls(cssVal) {
    if (!cssVal || typeof cssVal !== 'string') return cssVal;
    if (cssVal.indexOf('assets/') === -1 && cssVal.indexOf('public/') === -1) return cssVal;
    return cssVal.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, function (full, q, rawUrl) {
      var r = resolveAsset(rawUrl);
      if (!r.local) return full;
      return r.found ? ("url('" + r.url + "')") : 'none';
    });
  }

  window.__llResolveAsset = resolveAsset;
  window.__llHasAsset = hasAsset;
  window.__llResolveAudioCandidates = resolveAudioCandidates;
  window.__llRewriteCssUrls = rewriteCssUrls;

  var imgProto = typeof HTMLImageElement !== 'undefined' ? HTMLImageElement.prototype : null;
  var elProto = typeof Element !== 'undefined' ? Element.prototype : null;
  var origSrcDesc = imgProto ? Object.getOwnPropertyDescriptor(imgProto, 'src') : null;
  var origGetAttr = elProto ? elProto.getAttribute : null;
  var origSetAttr = elProto ? elProto.setAttribute : null;
  var origInnerDesc = elProto ? Object.getOwnPropertyDescriptor(elProto, 'innerHTML') : null;
  var origInsertAdjacent = elProto ? elProto.insertAdjacentHTML : null;
  var origOuterDesc = elProto ? Object.getOwnPropertyDescriptor(elProto, 'outerHTML') : null;

  var origSrcMap = new WeakMap();
  var seqMap = new WeakMap();

  function setMissingImg(img, rawVal) {
    var hasErrHandler = (typeof img.onerror === 'function') || (origGetAttr && origGetAttr.call(img, 'onerror'));
    // Hold valid frame instead of flashing blank during multi-frame animation loops without onerror
    if (!hasErrHandler && origSrcDesc && origSrcDesc.get) {
      var cur = origSrcDesc.get.call(img);
      if (cur && cur !== BLANK_GIF && cur.indexOf('data:') !== 0 && img.complete && img.naturalWidth > 0) {
        origSrcMap.set(img, rawVal);
        return;
      }
    }
    var seq = (seqMap.get(img) || 0) + 1;
    seqMap.set(img, seq);
    origSrcMap.set(img, rawVal);
    if (origSrcDesc && origSrcDesc.set) origSrcDesc.set.call(img, BLANK_GIF);
    if (hasErrHandler) {
      Promise.resolve().then(function () {
        if (seqMap.get(img) !== seq) return;
        img.dispatchEvent(new Event('error', { bubbles: false }));
      });
    }
  }

  function assignImgSrc(img, rawVal) {
    var val = rawVal == null ? '' : String(rawVal);
    if (val.indexOf('https://placehold.co/') === 0) val = PLACEHOLDER_SVG;
    var r = resolveAsset(val);
    if (!r.local) {
      seqMap.set(img, (seqMap.get(img) || 0) + 1);
      origSrcMap.delete(img);
      if (origSrcDesc && origSrcDesc.set) origSrcDesc.set.call(img, val);
      return;
    }
    if (r.found) {
      seqMap.set(img, (seqMap.get(img) || 0) + 1);
      origSrcMap.set(img, val);
      if (origSrcDesc && origSrcDesc.set) origSrcDesc.set.call(img, r.url);
      return;
    }
    setMissingImg(img, val);
  }

  if (origSrcDesc && origSrcDesc.set && origSrcDesc.get) {
    Object.defineProperty(imgProto, 'src', {
      configurable: true,
      enumerable: origSrcDesc.enumerable,
      get: function () { return origSrcDesc.get.call(this); },
      set: function (v) { assignImgSrc(this, v); }
    });
  }

  if (elProto && origGetAttr && origSetAttr) {
    elProto.getAttribute = function (name) {
      if (this.tagName === 'IMG' && String(name).toLowerCase() === 'src' && origSrcMap.has(this)) {
        return origSrcMap.get(this);
      }
      return origGetAttr.call(this, name);
    };
    elProto.setAttribute = function (name, val) {
      if (this.tagName === 'IMG' && String(name).toLowerCase() === 'src') {
        var r = resolveAsset(String(val));
        if (r.local) {
          assignImgSrc(this, val);
          return;
        }
      }
      return origSetAttr.call(this, name, val);
    };
  }

  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function rewriteHtmlFragment(html) {
    if (typeof html !== 'string') return html;
    if (html.indexOf('assets/') === -1 && html.indexOf('public/') === -1 && html.indexOf('placehold.co') === -1) {
      return html;
    }
    var out = html.replace(/https:\/\/placehold\.co\/[^\s"'`<>)]+/g, PLACEHOLDER_SVG);
    out = out.replace(/style\s*=\s*(["'])([^"']*(?:assets\/|public\/)[^"']*)\1/gi, function (full, q, val) {
      return 'style=' + q + rewriteCssUrls(val) + q;
    });
    out = out.replace(/<img\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi, function (full, attrs) {
      var m = /\bsrc\s*=\s*(["'])([^"']*)\1/i.exec(attrs);
      if (!m) return full;
      var rawSrc = m[2].replace(/&amp;/g, '&');
      var r = resolveAsset(rawSrc);
      if (!r.local) return full;
      if (r.found) {
        var nextAttrs = attrs.replace(m[0], 'src="' + escAttr(r.url) + '" data-ll-orig="' + escAttr(rawSrc) + '"');
        return '<img' + nextAttrs + '>';
      }
      // Strip onload when missing so fallback blank image never falsely reports loaded
      var missAttrs = attrs
        .replace(m[0], 'data-ll-miss="1" data-ll-orig="' + escAttr(rawSrc) + '"')
        .replace(/\bonload\s*=\s*(["'])[^"']*\1/gi, '');
      return '<img' + missAttrs + '>';
    });
    return out;
  }

  function hydrateContainer(root) {
    if (!root || !root.querySelectorAll) return;
    var origEls = root.querySelectorAll('img[data-ll-orig]');
    for (var i = 0; i < origEls.length; i++) {
      var im = origEls[i];
      var orig = origGetAttr.call(im, 'data-ll-orig');
      if (orig !== null) origSrcMap.set(im, orig);
      im.removeAttribute('data-ll-orig');
    }
    var missEls = root.querySelectorAll('img[data-ll-miss]');
    for (var j = 0; j < missEls.length; j++) {
      var el = missEls[j];
      el.removeAttribute('data-ll-miss');
      el.onload = null;
      if (origSrcDesc && origSrcDesc.set) origSrcDesc.set.call(el, BLANK_GIF);
      el.dispatchEvent(new Event('error', { bubbles: false }));
    }
  }

  if (elProto && origInnerDesc && origInnerDesc.set) {
    Object.defineProperty(elProto, 'innerHTML', {
      configurable: true,
      enumerable: origInnerDesc.enumerable,
      get: function () { return origInnerDesc.get.call(this); },
      set: function (val) {
        var next = rewriteHtmlFragment(val);
        origInnerDesc.set.call(this, next);
        if (next !== val) hydrateContainer(this);
      }
    });
  }

  if (elProto && origInsertAdjacent) {
    elProto.insertAdjacentHTML = function (pos, val) {
      var next = rewriteHtmlFragment(val);
      origInsertAdjacent.call(this, pos, next);
      if (next !== val) {
        var scope = (pos === 'beforebegin' || pos === 'afterend') ? (this.parentElement || document) : this;
        hydrateContainer(scope);
      }
    };
  }

  if (elProto && origOuterDesc && origOuterDesc.set) {
    Object.defineProperty(elProto, 'outerHTML', {
      configurable: true,
      enumerable: origOuterDesc.enumerable,
      get: function () { return origOuterDesc.get.call(this); },
      set: function (val) {
        var parent = this.parentElement;
        var next = rewriteHtmlFragment(val);
        origOuterDesc.set.call(this, next);
        if (next !== val && parent) hydrateContainer(parent);
      }
    });
  }

  var styleProtos = [];
  if (typeof CSSStyleProperties !== 'undefined' && CSSStyleProperties.prototype) styleProtos.push(CSSStyleProperties.prototype);
  if (typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
    var rootStyleProto = Object.getPrototypeOf(document.documentElement.style);
    if (rootStyleProto && styleProtos.indexOf(rootStyleProto) === -1) styleProtos.push(rootStyleProto);
  }
  if (typeof CSSStyleDeclaration !== 'undefined' && CSSStyleDeclaration.prototype && styleProtos.indexOf(CSSStyleDeclaration.prototype) === -1) {
    styleProtos.push(CSSStyleDeclaration.prototype);
  }
  styleProtos.forEach(function (proto) {
    ['backgroundImage', 'cursor', 'background', 'cssText'].forEach(function (prop) {
      var desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set || !desc.get || !desc.configurable) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: function () { return desc.get.call(this); },
        set: function (v) { desc.set.call(this, rewriteCssUrls(v)); }
      });
    });
    if (typeof proto.setProperty === 'function') {
      var origSetProp = proto.setProperty;
      proto.setProperty = function (name, val, priority) {
        return origSetProp.call(this, name, rewriteCssUrls(val), priority);
      };
    }
  });

  // Chrome 157+ exposes every CSS property as an own data property of each style object,
  // so the prototype hooks above never fire there and town/battle scene art fell back to
  // a flat colour. Hand out a thin proxy from `el.style` whose writes go through the same
  // rewrite synchronously (before any layout read can start a fetch of the logical URL).
  var protoHooked = false;
  try {
    var probeEl = document.createElement('div');
    probeEl.style.backgroundImage = 'url("assets/__probe__.png")';
    protoHooked = probeEl.style.backgroundImage.indexOf('__probe__') === -1;
  } catch (_) {}
  if (!protoHooked && typeof Proxy !== 'undefined') {
    var proxyOf = new WeakMap();
    var wrapStyle = function (real) {
      var px = proxyOf.get(real);
      if (px) return px;
      var fnCache = Object.create(null);
      px = new Proxy(real, {
        get: function (t, k) {
          var v = t[k];
          if (typeof v !== 'function') return v;
          if (!fnCache[k]) {
            fnCache[k] = k === 'setProperty'
              ? function (name, val, prio) { return v.call(t, name, rewriteCssUrls(val), prio); }
              : function () { return v.apply(t, arguments); };
          }
          return fnCache[k];
        },
        set: function (t, k, v) {
          t[k] = (typeof v === 'string' && v.indexOf('assets/') !== -1) ? rewriteCssUrls(v) : v;
          return true;
        }
      });
      proxyOf.set(real, px);
      return px;
    };
    [typeof HTMLElement !== 'undefined' && HTMLElement.prototype,
     typeof SVGElement !== 'undefined' && SVGElement.prototype].forEach(function (proto) {
      if (!proto) return;
      var d = Object.getOwnPropertyDescriptor(proto, 'style');
      if (!d || !d.get || !d.configurable) return;
      Object.defineProperty(proto, 'style', {
        configurable: true,
        enumerable: d.enumerable,
        get: function () { return wrapStyle(d.get.call(this)); },
        set: function (v) { d.set.call(this, typeof v === 'string' ? rewriteCssUrls(v) : v); }
      });
    });
  }

  // Safety net for style attributes written as markup (innerHTML templates, setAttribute
  // paths that bypass the hooks): MutationObserver callbacks run before the next style
  // recalc, so the mapped file is usually swapped in before the browser fetches anything.
  if (typeof MutationObserver !== 'undefined' && origGetAttr && origSetAttr) {
    var needsRewrite = /url\(\s*['"]?(?:\.?\/)?(?:public\/)?assets\//i;
    var fixStyle = function (el) {
      var s = origGetAttr.call(el, 'style');
      if (!s || !needsRewrite.test(s)) return;
      var next = rewriteCssUrls(s);
      if (next !== s) origSetAttr.call(el, 'style', next);
    };
    var styleObserver = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'attributes') { fixStyle(m.target); continue; }
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          fixStyle(n);
          if (n.querySelectorAll) {
            var inner = n.querySelectorAll('[style*="assets/"]');
            for (var k = 0; k < inner.length; k++) fixStyle(inner[k]);
          }
        }
      }
    });
    var startObserver = function () {
      styleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
      var pre = document.querySelectorAll('[style*="assets/"]');
      for (var i = 0; i < pre.length; i++) fixStyle(pre[i]);
    };
    if (document.documentElement) startObserver();
  }
})();
