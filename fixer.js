/* Xteink X4 EPUB fixer — logica condivisa browser/node. Nessun dato lascia il dispositivo. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.X4Fixer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var root_hyph_default = (typeof self !== 'undefined' && self.X4Hyphen) || null;
  var root_hyph = root_hyph_default;
  var SPACE_RE = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;
  var ZW_RE = /[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g;
  var ENT_SPACE_RE = /&(?:nbsp|ensp|emsp|thinsp|hairsp|numsp|puncsp|MediumSpace|ThinSpace|VeryThinSpace|NoBreak|#160|#x0*a0|#8192|#8193|#8194|#8195|#8196|#8197|#8198|#8199|#8200|#8201|#8202|#8239|#8287|#12288|#x0*20(?:0[0-9a]|2f|5f)|#x3000);/gi;
  var ENT_ZW_RE = /&(?:shy|ZeroWidthSpace|zwnj|zwj|NoBreak|#173|#8203|#8204|#8205|#8288|#65279|#x0*ad|#x0*200[bcd]|#x0*2060|#x0*feff);/gi;
  var DECL_RE = /(?<![\w-])(text-align-last|text-align|text-indent|margin-left|margin-right|padding-left|padding-right|margin|padding)(\s*:\s*)([^;}]+)/gi;
  var FONTFAM_RE = /(?<![\w-])font-family\s*:[^;}]*;?/gi;
  var FONT_FILE_RE = /\.(ttf|otf|woff2?|eot)$/i;

  var OPT = { left: false, hyphenate: true };
  function xteinkCss() {
    return '/* Aggiunto da Xteink X4 fixer */\n' +
      (OPT.left ? 'html, body, p, div, li, blockquote, dd, dt, td, th { text-align: left; }\n' : '') +
      '* { word-spacing: normal !important; letter-spacing: normal !important; text-justify: none; hyphens: manual; -webkit-hyphens: manual; }\n';
  }

  function fmt(n) { return String(parseFloat(n.toPrecision(12))); }

  function capLen(v) {
    v = v.trim();
    var m = /^(-?[\d.]+)(%|em|rem|ex|pt|px)?$/.exec(v);
    if (!m) return v;
    var n = parseFloat(m[1]), u = m[2] || '';
    if (u === '%') return n > 0 ? '0' : v;
    var lim = { em: 1.2, rem: 1.2, ex: 2.4, pt: 14, px: 16 }[u];
    if (lim !== undefined && n > lim) return fmt(lim) + u;
    return v;
  }

  function fixDecl(prop, val) {
    var tw = val.slice(val.replace(/\s+$/, '').length);
    val = val.replace(/\s+$/, '');
    return fixDecl0(prop, val) + tw;
  }
  function fixDecl0(prop, val) {
    var imp = '';
    var m = /\s*!important\s*$/i.exec(val);
    if (m) { imp = ' !important'; val = val.slice(0, m.index); }
    var p = prop.toLowerCase();
    if (p === 'text-align' || p === 'text-align-last') {
      if (OPT.left) val = val.replace(/justify(?:-all)?/gi, 'left');
    } else if (p === 'text-indent') {
      var v = val.trim();
      var mm = /^(-?[\d.]+)(%|em|rem|pt|px)?$/.exec(v);
      if (mm) {
        var n = parseFloat(mm[1]), u = mm[2] || '';
        if (n < 0 || u === '%') val = '0';
        else if (((u === 'em' || u === 'rem') && n > 1.5) || (u === 'pt' && n > 18) || (u === 'px' && n > 24)) val = '1.5em';
      }
    } else if (p === 'margin-left' || p === 'margin-right' || p === 'padding-left' || p === 'padding-right') {
      val = capLen(val);
    } else if (p === 'margin' || p === 'padding') {
      var t = val.split(/\s+/).filter(function (x) { return x !== ''; });
      if (t.length === 2 || t.length === 3) t[1] = capLen(t[1]);
      else if (t.length === 4) { t[1] = capLen(t[1]); t[3] = capLen(t[3]); }
      val = t.join(' ');
    }
    return val + imp;
  }
  function declSub(s) {
    return s.replace(DECL_RE, function (_, a, b, c) { return a + b + fixDecl(a, c); });
  }

  function fixCss(css) {
    css = css.replace(/@font-face\s*\{[^}]*\}/gi, '');
    css = css.replace(FONTFAM_RE, '');
    return declSub(css);
  }

  var LET = 'A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ff';
  var RUN_RE = new RegExp('[' + LET + '\u2019\'\u02bc-]{5,}', 'g');
  var ALPHA_RE = new RegExp('^[' + LET + ']+$');
  function hyphWord(w) {
    return w.split(/([\u2019'\u02bc-])/).map(function (p) {
      return (p.length >= 5 && ALPHA_RE.test(p) && root_hyph) ? root_hyph.hyphenate(p).join('\u00ad') : p;
    }).join('');
  }
  function hyphText(t) {
    return t.replace(/\S+/g, function (c) {
      if (/\d|:\/\/|www\.|@/.test(c)) return c;
      return c.replace(RUN_RE, hyphWord);
    });
  }
  function hyphenateHtml(h) {
    var m = /<body\b/i.exec(h);
    if (!m) return h;
    var head = h.slice(0, m.index), body = h.slice(m.index), skip = 0, out = [];
    body.split(/(<!--[\s\S]*?-->|<[^>]+>|&#?\w+;)/).forEach(function (t) {
      if (t.charAt(0) === '<') {
        var tl = t.toLowerCase();
        if (/^<(script|style|title)\b/.test(tl)) skip++;
        else if (/^<\/(script|style|title)/.test(tl)) skip = Math.max(0, skip - 1);
        out.push(t);
      } else if (t.charAt(0) === '&' || skip) out.push(t);
      else out.push(hyphText(t));
    });
    return head + out.join('');
  }

  function fixHtml(h, lang) {
    h = h.replace(ENT_SPACE_RE, ' ').replace(ENT_ZW_RE, '');
    h = h.replace(SPACE_RE, ' ').replace(ZW_RE, '');
    h = h.replace(/(<(?:p|div|li|blockquote|h[1-6])\b[^>]*>) +(?=[^<\s])/g, '$1');
    if (OPT.left) h = h.replace(/(\salign\s*=\s*)(["'])\s*justify\s*\2/gi, '$1$2left$2');
    h = h.replace(/(\sstyle\s*=\s*)(["'])([\s\S]*?)\2/gi, function (_, a, q, body) {
      return a + q + declSub(body.replace(FONTFAM_RE, '')) + q;
    });
    h = h.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, function (_, a, b, c) { return a + fixCss(b) + c; });
    h = h.replace(/<html\b[^>]*>/i, function (tag) {
      if (!/\sxml:lang\s*=/.test(tag)) tag = tag.slice(0, -1) + ' xml:lang="' + lang + '">';
      if (!/\slang\s*=/.test(tag)) tag = tag.slice(0, -1) + ' lang="' + lang + '">';
      return tag;
    });
    if (OPT.hyphenate && root_hyph) h = hyphenateHtml(h);
    return h;
  }

  function dirname(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function normpath(p) {
    var out = [];
    p.split('/').forEach(function (s) {
      if (s === '' || s === '.') return;
      if (s === '..') out.pop(); else out.push(s);
    });
    return out.join('/');
  }
  function join(a, b) { return a ? a + '/' + b : b; }
  function relpath(target, fromDir) {
    var t = target.split('/'), f = fromDir ? fromDir.split('/') : [];
    var i = 0;
    while (i < t.length - 1 && i < f.length && t[i] === f[i]) i++;
    var ups = f.length - i, parts = [];
    for (var k = 0; k < ups; k++) parts.push('..');
    return parts.concat(t.slice(i)).join('/');
  }
  function decode(u8) { return new TextDecoder('utf-8').decode(u8); }
  function encode(s) { return new TextEncoder().encode(s); }

  /** JSZipLib: costruttore JSZip. input: ArrayBuffer/Uint8Array. */
  async function fixEpub(JSZipLib, input, opts) {
    opts = opts || {};
    OPT.left = !!opts.left; OPT.hyphenate = opts.hyphenate !== false;
    root_hyph = opts.hyphenator || root_hyph_default;
    var zin = await JSZipLib.loadAsync(input);
    var names = Object.keys(zin.files).filter(function (n) { return !zin.files[n].dir; });
    var cont = zin.file('META-INF/container.xml');
    if (!cont) throw new Error('Non è un EPUB valido (manca container.xml).');
    var container = decode(await cont.async('uint8array'));
    var om = /full-path\s*=\s*"([^"]+)"/.exec(container);
    if (!om) throw new Error('EPUB non valido (rootfile mancante).');
    var opfPath = om[1];
    var opf = decode(await zin.file(opfPath).async('uint8array'));
    var opfDir = dirname(opfPath);
    var lm = /<dc:language[^>]*>\s*([^<\s]+)/.exec(opf);
    var lang = lm ? lm[1] : 'it';
    var tm = /<dc:title[^>]*>([^<]+)/.exec(opf);
    var title = tm ? tm[1].trim() : null;
    var items = opf.match(/<item\b[^>]*\/?>/g) || [];
    var removed = new Set(), cssFiles = new Set(), htmlFiles = new Set();
    items.forEach(function (it) {
      var href = /href="([^"]+)"/.exec(it), mt = /media-type="([^"]+)"/.exec(it);
      if (!href) return;
      var full = normpath(join(opfDir, decodeURI(href[1])));
      var m = mt ? mt[1] : '';
      if (/font|opentype|truetype/i.test(m) || FONT_FILE_RE.test(full)) removed.add(full);
      else if (m === 'text/css') cssFiles.add(full);
      else if (m === 'application/xhtml+xml' || m === 'text/html') htmlFiles.add(full);
    });
    names.forEach(function (n) { if (FONT_FILE_RE.test(n)) removed.add(n); });
    function dropItem(s) {
      var href = /href="([^"]+)"/.exec(s);
      if (href && removed.has(normpath(join(opfDir, decodeURI(href[1]))))) return '';
      return s;
    }
    var opf2 = opf.replace(/[ \t]*<item\b[^>]*\/>[ \t]*\r?\n?/g, dropItem);
    opf2 = opf2.replace(/[ \t]*<item\b[^>]*[^/]>\s*<\/item>[ \t]*\r?\n?/g, dropItem);
    opf2 = opf2.replace('</manifest>', function () {
      return '    <item id="xteink-fix-css" href="Styles/xteink_fix.css" media-type="text/css"/>\n  </manifest>';
    });
    var cssName = join(opfDir, 'Styles/xteink_fix.css');
    var encDrop = false;
    if (zin.file('META-INF/encryption.xml')) {
      var enc = decode(await zin.file('META-INF/encryption.xml').async('uint8array'));
      var uris = []; var re = /<(?:\w+:)?CipherReference\s+URI="([^"]+)"/g, mm;
      while ((mm = re.exec(enc))) uris.push(mm[1]);
      if (uris.length && uris.every(function (u) { return removed.has(u); })) encDrop = true;
    }
    var D = new Date(Date.UTC(1980, 0, 1));
    var zout = new JSZipLib();
    zout.file('mimetype', 'application/epub+zip', { compression: 'STORE', date: D, createFolders: false });
    var stats = { fontsRemoved: 0, files: 0, spaces: 0 };
    stats.fontsRemoved = removed.size;
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (n === 'mimetype' || removed.has(n) || (encDrop && n === 'META-INF/encryption.xml')) continue;
      var data = await zin.file(n).async('uint8array');
      if (n === opfPath) data = encode(opf2);
      else if (cssFiles.has(n) || /\.css$/i.test(n)) data = encode(fixCss(decode(data)));
      else if (htmlFiles.has(n) || /\.x?html?$/i.test(n)) {
        var src = decode(data);
        stats.spaces += (src.match(ENT_SPACE_RE) || []).length + (src.match(SPACE_RE) || []).length;
        var h = fixHtml(src, lang);
        var rel = relpath(cssName, dirname(n));
        h = h.replace(/<\/head>/i, function () {
          return '  <link href="' + rel + '" type="text/css" rel="stylesheet"/>\n</head>';
        });
        data = encode(h); stats.files++;
      }
      zout.file(n, data, { compression: 'DEFLATE', date: D, createFolders: false });
    }
    zout.file(cssName, xteinkCss(), { compression: 'DEFLATE', date: D, createFolders: false });
    var out = await zout.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
    return { data: out, title: title, stats: stats };
  }

  function outName(title, originalName, suffix) {
    var base = title || (originalName || 'libro').replace(/\.epub$/i, '');
    base = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim() || 'libro';
    return base + '_X4' + (suffix || '') + '.epub';
  }
  function setOpts(o) { OPT.left = !!o.left; OPT.hyphenate = o.hyphenate !== false; if (o.hyphenator) root_hyph = o.hyphenator; }
  return { fixEpub: fixEpub, fixCss: fixCss, fixHtml: fixHtml, outName: outName, setOpts: setOpts };
});
