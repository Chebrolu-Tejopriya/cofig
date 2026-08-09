/**
 * Blade Docs — Component Documentation Generator
 * Main thread. Reads the selected component, then draws a Razorpay Blade style
 * documentation page onto the canvas.
 *
 * The layout language is lifted from the Blade Design System Figma file:
 * every section is a white 48px-padded frame, opened by a header rule, laid out
 * left to right on one row with a 120px gutter.
 */

/* ------------------------------------------------------------------ *
 * Design constants (measured from the Blade file)
 * ------------------------------------------------------------------ */

var COLOR = {
  ink: '#192839',        // section titles, prop names
  body: '#768ea7',       // descriptions, eyebrow, footer link
  strong: '#40566d',     // table cell values
  soft: '#58728d',       // do/don't captions
  border: '#e3eaf3',     // header underline
  rowLine: '#6c849d',    // table row separators, drawn at 18%
  tableHead: '#f1f5fa',
  surface: '#f1f5fa',    // specimen stages
  white: '#ffffff',
  code: '#305eff',       // prop types, token names
  required: '#d92d20',
  dont: '#d13821',
  do: '#00a251',
  marker: '#e9690c',     // anatomy pointers
  dark: '#0d1420',
  thumb: '#f3f3f4',
  tableHeadText: '#202223',
  thickDivider: '#c1c8cf'
};

var GUTTER = 120;        // horizontal gap between sections
var PAD = 48;            // section padding

// contentWidth + 96 = section width, exactly as Blade sizes them
var WIDTH = {
  intro: 953,
  props: 1000,
  variations: 1000,
  usage: 1258,
  content: 1258,
  platforms: 1056,
  a11y: 800,
  changes: 1000
};

var PROP_COLS = [200, 280, 120, 200, 200];   // = 1000
var TOKEN_COLS = [280, 720];                 // = 1000

var FONTS = {};

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function rgb(hex) {
  var h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255
  };
}

function solid(hex, opacity) {
  var p = { type: 'SOLID', color: rgb(hex) };
  if (typeof opacity === 'number') p.opacity = opacity;
  return p;
}

/** Auto-layout frame builder. `width` means "fixed on the cross/primary axis as appropriate". */
function F(name, o) {
  o = o || {};
  var f = figma.createFrame();
  f.name = name;
  f.clipsContent = false;
  var dir = o.dir || 'NONE';
  f.layoutMode = dir;

  if (dir !== 'NONE') {
    f.itemSpacing = o.gap || 0;
    var p = o.pad || [0, 0, 0, 0];
    f.paddingTop = p[0];
    f.paddingRight = p[1];
    f.paddingBottom = p[2];
    f.paddingLeft = p[3];

    if (o.width) {
      f.resize(o.width, Math.max(1, f.height));
      if (dir === 'VERTICAL') {
        f.primaryAxisSizingMode = 'AUTO';
        f.counterAxisSizingMode = 'FIXED';
      } else {
        f.primaryAxisSizingMode = 'FIXED';
        f.counterAxisSizingMode = 'AUTO';
      }
    } else {
      f.primaryAxisSizingMode = 'AUTO';
      f.counterAxisSizingMode = 'AUTO';
    }
    if (o.align) f.counterAxisAlignItems = o.align;
    if (o.justify) f.primaryAxisAlignItems = o.justify;
    if (o.wrap) f.layoutWrap = 'WRAP';
  } else if (o.width && o.height) {
    f.resize(o.width, o.height);
  }

  f.fills = o.fill ? [solid(o.fill, o.fillOpacity)] : [];
  if (o.radius) f.cornerRadius = o.radius;

  if (o.stroke) {
    f.strokes = [solid(o.stroke, o.strokeOpacity)];
    f.strokeAlign = 'INSIDE';
    if (o.strokeSide) {
      f.strokeTopWeight = o.strokeSide === 'top' ? (o.strokeWeight || 1) : 0;
      f.strokeBottomWeight = o.strokeSide === 'bottom' ? (o.strokeWeight || 1) : 0;
      f.strokeLeftWeight = 0;
      f.strokeRightWeight = 0;
    } else {
      f.strokeWeight = o.strokeWeight || 1;
    }
  }
  return f;
}

/** Text node builder. All fonts are pre-loaded in initFonts(). */
function T(chars, o) {
  var t = figma.createText();
  t.fontName = o.font;
  t.characters = chars === null || chars === undefined ? '' : String(chars);
  t.fontSize = o.size;
  t.lineHeight = { unit: 'PIXELS', value: o.lh };
  t.fills = [solid(o.color, o.opacity)];
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(o.width, Math.max(1, t.height));
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  t.name = o.name || (chars ? String(chars).slice(0, 40) : 'text');
  return t;
}

function fill(node) {
  try { node.layoutSizingHorizontal = 'FILL'; } catch (e) { /* not in an auto-layout parent */ }
  return node;
}

function add(parent, child, doFill) {
  parent.appendChild(child);
  if (doFill) fill(child);
  return child;
}

/* ------------------------------------------------------------------ *
 * Fonts — Blade uses TASA Orbiter Display + Inter + Menlo.
 * We probe what is actually installed and degrade gracefully.
 * ------------------------------------------------------------------ */

async function initFonts() {
  var available = await figma.listAvailableFontsAsync();
  var index = {};
  for (var i = 0; i < available.length; i++) {
    var fn = available[i].fontName;
    if (!index[fn.family]) index[fn.family] = {};
    index[fn.family][fn.style] = true;
  }

  function pick(families, styles) {
    for (var a = 0; a < families.length; a++) {
      var set = index[families[a]];
      if (!set) continue;
      for (var b = 0; b < styles.length; b++) {
        if (set[styles[b]]) return { family: families[a], style: styles[b] };
      }
    }
    return { family: 'Inter', style: 'Regular' };
  }

  var display = ['TASA Orbiter Display', 'TASA Orbiter', 'Inter', 'Roboto'];
  var body = ['Inter', 'Roboto', 'Helvetica Neue', 'Arial'];
  var mono = ['Menlo', 'Roboto Mono', 'JetBrains Mono', 'Source Code Pro', 'Courier New'];

  FONTS.displayRegular = pick(display, ['Regular', 'Book']);
  FONTS.displayMedium = pick(display, ['Medium', 'Regular']);
  FONTS.displaySemi = pick(display, ['SemiBold', 'Semi Bold', 'Bold', 'Medium']);
  FONTS.bodyRegular = pick(body, ['Regular']);
  FONTS.bodyMedium = pick(body, ['Medium', 'Regular']);
  FONTS.bodySemi = pick(body, ['SemiBold', 'Semi Bold', 'Bold']);
  FONTS.mono = pick(mono, ['Regular']);
  FONTS.monoBold = pick(mono, ['Bold', 'Regular']);

  var uniq = {};
  Object.keys(FONTS).forEach(function (k) {
    uniq[FONTS[k].family + '||' + FONTS[k].style] = FONTS[k];
  });
  await Promise.all(Object.keys(uniq).map(function (k) { return figma.loadFontAsync(uniq[k]); }));
}

/* ------------------------------------------------------------------ *
 * Type ramp — one place, mirroring Blade's measured values
 * ------------------------------------------------------------------ */

var TYPE = {
  eyebrow: function () { return { font: FONTS.displayRegular, size: 20, lh: 26, color: COLOR.body }; },
  eyebrowStrong: function () { return { font: FONTS.displayMedium, size: 20, lh: 26, color: COLOR.body }; },
  sectionTitle: function () { return { font: FONTS.displaySemi, size: 32, lh: 38, color: COLOR.ink }; },
  sectionDesc: function () { return { font: FONTS.bodyRegular, size: 16, lh: 24, color: COLOR.body }; },
  blockTitle: function () { return { font: FONTS.displaySemi, size: 20, lh: 26, color: COLOR.ink }; },
  blockBody: function () { return { font: FONTS.bodyRegular, size: 14, lh: 20, color: COLOR.body }; },
  usageTitle: function () { return { font: FONTS.displaySemi, size: 24, lh: 32, color: COLOR.ink }; },
  tableHead: function () { return { font: FONTS.bodySemi, size: 16, lh: 24, color: COLOR.tableHeadText }; },
  cell: function () { return { font: FONTS.bodyRegular, size: 14, lh: 20, color: COLOR.strong }; },
  cellMuted: function () { return { font: FONTS.bodyRegular, size: 14, lh: 20, color: COLOR.body }; },
  propName: function () { return { font: FONTS.monoBold, size: 14, lh: 20, color: COLOR.ink }; },
  propType: function () { return { font: FONTS.mono, size: 14, lh: 20, color: COLOR.code }; },
  token: function () { return { font: FONTS.mono, size: 14, lh: 20, color: COLOR.code }; },
  caption: function () { return { font: FONTS.mono, size: 11, lh: 16, color: COLOR.body }; },
  markerLabel: function () { return { font: FONTS.bodyMedium, size: 11, lh: 16, color: COLOR.strong }; },
  badge: function () { return { font: FONTS.bodyRegular, size: 12, lh: 18, color: COLOR.ink }; }
};

function opts(base, extra) {
  var o = base();
  if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
  return o;
}

/* ------------------------------------------------------------------ *
 * Reusable documentation primitives
 * ------------------------------------------------------------------ */

/** The `.frame-header` equivalent: eyebrow, title, badge, description, right-hand link. */
function frameHeader(o) {
  var header = F('.frame-header', {
    dir: 'HORIZONTAL', gap: 40, width: o.width,
    pad: [0, 0, 16, 0],
    stroke: COLOR.border, strokeSide: 'bottom', strokeWeight: 1
  });

  var left = F('left-container', { dir: 'VERTICAL', gap: 40, pad: [0, 64, 0, 0] });
  var content = F('content', { dir: 'VERTICAL', gap: 40 });

  var eyebrow = F('logo-and-category', { dir: 'HORIZONTAL', gap: 4, align: 'CENTER' });
  add(eyebrow, T((o.system || 'Design System') + ' /', opts(TYPE.eyebrow, { name: 'system' })));
  add(eyebrow, T(o.category || 'Documentation', opts(TYPE.eyebrowStrong, { name: 'category' })));
  add(content, eyebrow);

  var textContainer = F('text-container', { dir: 'VERTICAL', gap: 8 });
  var titleRow = F('title-and-badge', { dir: 'HORIZONTAL', gap: 16, align: 'CENTER' });
  add(titleRow, T(o.title, opts(TYPE.sectionTitle, { name: 'title' })));
  if (o.badge) add(titleRow, badge(o.badge));
  add(textContainer, titleRow);
  if (o.description) {
    add(textContainer, T(o.description, opts(TYPE.sectionDesc, { name: 'description' })));
  }
  add(content, textContainer);
  add(left, content);
  add(header, left);
  fill(left);

  var right = F('right-container', { dir: 'VERTICAL', gap: 40 });
  add(right, T(o.link || 'Design Documentation', opts(TYPE.eyebrow, { name: 'website-link' })));
  add(header, right);

  return header;
}

function badge(text) {
  var map = {
    Published: { bg: '#00a251', fg: '#00733a' },
    'In Progress': { bg: '#e9690c', fg: '#b8500a' },
    Deprecated: { bg: '#e11414', fg: '#a40f0f' },
    Stable: { bg: '#305eff', fg: '#1f43c4' }
  };
  var c = map[text] || map.Published;
  var b = F('.badge', {
    dir: 'HORIZONTAL', gap: 8, pad: [4, 12, 4, 12], radius: 22,
    fill: c.bg, fillOpacity: 0.09,
    stroke: c.fg, strokeOpacity: 0.18, strokeWeight: 1,
    align: 'CENTER'
  });
  add(b, T(text, opts(TYPE.badge, { color: c.fg })));
  return b;
}

/** The `.Text Item` equivalent: a bold heading over muted body copy. */
function textItem(title, description, width) {
  var item = F('.Text Item', { dir: 'VERTICAL', gap: 4, width: width });
  if (title) add(item, T(title, opts(TYPE.blockTitle, { name: 'heading', width: width })), true);
  if (description) add(item, T(description, opts(TYPE.blockBody, { name: 'body-text', width: width })), true);
  return item;
}

function thickDivider(width) {
  var d = F('_SectionDivider', { dir: 'VERTICAL', width: width });
  var line = figma.createRectangle();
  line.name = 'border-bottom';
  line.resize(Math.max(1, width), 2);
  line.fills = [solid(COLOR.thickDivider)];
  add(d, line, true);
  return d;
}

/**
 * A whole documentation section: white card, padded 48, header rule, body stack.
 * Returns { section, body } so callers append their own blocks into `body`.
 */
function section(o) {
  var sec = F(o.name, {
    dir: 'VERTICAL', gap: 16, pad: [PAD, PAD, PAD, PAD],
    width: o.width + PAD * 2, fill: COLOR.white
  });
  var content = F('content', { dir: 'VERTICAL', gap: 32, width: o.width });
  add(content, frameHeader({
    width: o.width,
    title: o.title,
    description: o.description,
    category: o.category || 'Documentation',
    system: o.system,
    link: o.link,
    badge: o.badge
  }), true);

  var body = F('Body', { dir: 'VERTICAL', gap: o.bodyGap || 40, width: o.width });
  add(content, body, true);
  add(sec, content, true);
  return { section: sec, body: body };
}

/** A block inside a section body: heading + specimen area + divider. */
function block(o) {
  var b = F(o.name || 'block', { dir: 'VERTICAL', gap: 24, width: o.width });
  if (o.title || o.description) {
    add(b, textItem(o.title, o.description, o.width), true);
  }
  if (o.content) add(b, o.content, o.contentFill !== false);
  if (o.divider !== false) add(b, thickDivider(o.width), true);
  return b;
}

/* ------------------------------------------------------------------ *
 * Props & tokens tables
 * ------------------------------------------------------------------ */

function tableRow(cells, o) {
  var row = F(o.name || '.row', {
    dir: 'HORIZONTAL', gap: 0, width: o.width,
    fill: o.fill,
    stroke: COLOR.rowLine, strokeOpacity: 0.18, strokeSide: 'bottom', strokeWeight: 1
  });
  row.counterAxisAlignItems = 'MIN';
  for (var i = 0; i < cells.length; i++) {
    var cell = F('cell', {
      dir: 'VERTICAL', gap: 8, width: o.cols[i],
      pad: o.header ? [8, 16, 8, 16] : [16, 16, 16, 16]
    });
    var payload = cells[i];
    if (payload) {
      // Only text should stretch — filling a badge or a name row would blow
      // it out to the full column width.
      var list = Array.isArray(payload) ? payload : [payload];
      for (var j = 0; j < list.length; j++) {
        add(cell, list[j], list[j].type === 'TEXT');
      }
    }
    add(row, cell);
  }
  return row;
}

function propsTable(props, width) {
  var table = F('table', { dir: 'VERTICAL', gap: 0, width: width });
  var heads = ['Prop Name', 'Description', 'Type', 'Prop Values', 'Default'];

  add(table, tableRow(heads.map(function (h) {
    return T(h, opts(TYPE.tableHead, { width: null }));
  }), { cols: PROP_COLS, width: width, header: true, fill: COLOR.tableHead, name: '.prop-header' }), true);

  for (var i = 0; i < props.length; i++) {
    var p = props[i];

    var nameRow = F('title', { dir: 'HORIZONTAL', gap: 4 });
    add(nameRow, T(p.name, opts(TYPE.propName)));
    if (p.required) add(nameRow, T('*', opts(TYPE.propName, { color: COLOR.required })));

    var values = (p.values || 'N/A').split('\n').filter(function (v) { return v.trim(); });
    var valueText = values.length && values[0] !== 'N/A'
      ? values.map(function (v) { return '• ' + v; }).join('\n')
      : 'N/A';

    add(table, tableRow([
      nameRow,
      T(p.description || '—', opts(TYPE.cellMuted, { width: PROP_COLS[1] - 32 })),
      T(p.type, opts(TYPE.propType)),
      T(valueText, opts(TYPE.cell, { width: PROP_COLS[3] - 32 })),
      T(p.default === '' || p.default === undefined ? 'N/A' : String(p.default), opts(TYPE.cell, { width: PROP_COLS[4] - 32 }))
    ], { cols: PROP_COLS, width: width, name: '.prop' }), true);
  }
  return table;
}

function tokensTable(tokens, width) {
  var table = F('table', { dir: 'VERTICAL', gap: 0, width: width });
  add(table, tableRow([
    T('Property', opts(TYPE.tableHead)),
    T('Token Name', opts(TYPE.tableHead))
  ], { cols: TOKEN_COLS, width: width, header: true, fill: COLOR.tableHead, name: '.Token-header' }), true);

  for (var i = 0; i < tokens.length; i++) {
    add(table, tableRow([
      T(tokens[i].property, opts(TYPE.cell, { width: TOKEN_COLS[0] - 32 })),
      T(tokens[i].token, opts(TYPE.token, { width: TOKEN_COLS[1] - 32 }))
    ], { cols: TOKEN_COLS, width: width, name: '.Token' }), true);
  }
  return table;
}

/* ------------------------------------------------------------------ *
 * Do / Don't
 * ------------------------------------------------------------------ */

function usageMarker(isDo) {
  var wrap = F('.usage-markers', { dir: 'HORIZONTAL', gap: 8, align: 'CENTER' });

  // The dot and its glyph must be stacked, so they live in a plain (non
  // auto-layout) frame — an auto-layout parent would ignore their x/y.
  var icon = F('icon', { width: 20, height: 20 });
  icon.fills = [];
  var dot = figma.createEllipse();
  dot.resize(20, 20);
  dot.fills = [solid(isDo ? COLOR.do : COLOR.dont)];
  dot.name = 'dot';
  icon.appendChild(dot);
  dot.x = 0;
  dot.y = 0;

  var glyph = figma.createText();
  glyph.fontName = FONTS.bodySemi;
  glyph.characters = isDo ? '✓' : '✕';
  glyph.fontSize = 11;
  glyph.fills = [solid(COLOR.white)];
  glyph.textAutoResize = 'NONE';
  glyph.resize(20, 20);
  glyph.textAlignHorizontal = 'CENTER';
  glyph.textAlignVertical = 'CENTER';
  glyph.name = 'glyph';
  icon.appendChild(glyph);
  glyph.x = 0;
  glyph.y = 0;

  add(wrap, icon);
  add(wrap, T(isDo ? 'Do' : 'Don’t', opts(TYPE.usageTitle, {
    color: isDo ? COLOR.do : COLOR.dont
  })));
  return wrap;
}

function doDontCard(isDo, caption, specimenNodes, width) {
  var col = F(isDo ? 'dos' : 'donts', { dir: 'VERTICAL', gap: 16, width: width });
  var main = F('main-content', {
    dir: 'VERTICAL', gap: 24, pad: [32, 32, 32, 32], radius: 8, width: width,
    fill: isDo ? COLOR.do : COLOR.dont, fillOpacity: 0.09
  });

  var textContainer = F('text-container', { dir: 'VERTICAL', gap: 8, width: width - 64 });
  add(textContainer, usageMarker(isDo));
  if (caption) {
    add(textContainer, T(caption, opts(TYPE.blockBody, { color: COLOR.soft, width: width - 64 })), true);
  }
  add(main, textContainer, true);

  var stage = F('example-frame', {
    dir: 'VERTICAL', gap: 24, pad: [48, 48, 48, 48],
    fill: COLOR.white, width: width - 64, align: 'CENTER', justify: 'CENTER'
  });
  for (var i = 0; i < specimenNodes.length; i++) add(stage, specimenNodes[i]);
  add(main, stage, true);

  add(col, main, true);
  return col;
}

/* ------------------------------------------------------------------ *
 * Specimens
 * ------------------------------------------------------------------ */

function specimenStage(nodes, o) {
  o = o || {};
  // Wrapping only takes effect on a horizontal frame with a fixed main-axis
  // size, so the width must go through F() rather than a later resize.
  var stage = F(o.name || 'stage', {
    dir: o.dir || 'HORIZONTAL', gap: o.gap || 24,
    pad: [o.padY || 40, o.padX || 40, o.padY || 40, o.padX || 40],
    fill: o.fill || COLOR.surface, radius: 8,
    align: 'CENTER', justify: 'CENTER',
    width: o.width,
    wrap: o.wrap
  });
  for (var i = 0; i < nodes.length; i++) add(stage, nodes[i]);
  return stage;
}

function labelledSpecimen(node, caption) {
  var col = F('specimen', { dir: 'VERTICAL', gap: 12, align: 'CENTER' });
  add(col, node);
  if (caption) add(col, T(caption, opts(TYPE.caption, { align: 'CENTER' })));
  return col;
}

/* ------------------------------------------------------------------ *
 * Anatomy
 * ------------------------------------------------------------------ */

var SKIP_PART = /^(container|content|wrapper|frame|group|left|right|body|root|holder|stack|row|col|column|base|layer|rectangle|ellipse|vector|union|subtract)\b/i;

/**
 * Layer names carry a lot of housekeeping: parenthetical notes designers leave
 * for themselves ("label (don't hide)"), and leading marker glyphs like ×, ❖, ⚠️.
 */
function cleanLabel(name) {
  return String(name === undefined || name === null ? '' : name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[_\-]+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function usablePartName(name) {
  var s = cleanLabel(name);
  return s.length >= 2 && s.length <= 28 && /[a-z]/i.test(s);
}

function collectParts(root, limit) {
  var out = [];
  function walk(node, depth) {
    if (out.length >= limit || depth > 4) return;
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) {
      if (out.length >= limit) return;
      var ch = kids[i];
      if (ch.visible === false) continue;
      var named = ch.name && ch.name.charAt(0) !== '.' && ch.name.charAt(0) !== '_' &&
        !SKIP_PART.test(ch.name) && usablePartName(ch.name);
      var leafish = !ch.children || ch.children.length === 0 || ch.type === 'INSTANCE' || ch.type === 'TEXT';
      if (named && leafish && ch.width > 2 && ch.height > 2) {
        out.push(ch);
      } else if (ch.children && ch.children.length) {
        walk(ch, depth + 1);
      }
    }
  }
  walk(root, 0);
  return out;
}

function partRect(part, instance) {
  var x = 0, y = 0, n = part;
  while (n && n !== instance) {
    x += n.x; y += n.y;
    n = n.parent;
  }
  return { x: x, y: y, w: part.width, h: part.height, cx: x + part.width / 2, cy: y + part.height / 2 };
}

var STEM_BASE = 26;
var STEM_STEP = 20;
var LABEL_GAP = 10;

/**
 * Gives every marker in a group a tier (a stem length) such that no two labels
 * on the same tier overlap horizontally. Without this, parts that sit close
 * together on the x axis print their labels on top of each other.
 */
function assignTiers(items) {
  var placed = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var tier = 0;
    while (tier < 8) {
      var clash = false;
      for (var j = 0; j < placed.length; j++) {
        var p = placed[j];
        if (p.tier !== tier) continue;
        var minGap = p.label.width / 2 + it.label.width / 2 + LABEL_GAP;
        if (Math.abs(p.rect.cx - it.rect.cx) < minGap) { clash = true; break; }
      }
      if (!clash) break;
      tier++;
    }
    it.tier = tier;
    placed.push(it);
  }
}

function maxTier(items) {
  var m = 0;
  for (var i = 0; i < items.length; i++) m = Math.max(m, items[i].tier);
  return m;
}

/**
 * Blade's anatomy diagram: the component centred on a tinted stage with
 * labelled leader lines pointing at each part. Parts in the top half of the
 * component are labelled above it, the rest below.
 */
function anatomyStage(instance, labels, contentWidth, dark) {
  var parts = collectParts(instance, 8);

  var items = [];
  for (var i = 0; i < parts.length; i++) {
    var rect = partRect(parts[i], instance);
    var provided = labels && labels[i] !== undefined && labels[i] !== null && String(labels[i]).trim();
    var text = cleanLabel(provided ? labels[i] : parts[i].name);
    if (!text) continue;
    items.push({
      rect: rect,
      label: T(text, opts(TYPE.markerLabel, { align: 'CENTER', name: 'label' })),
      above: rect.cy < instance.height / 2
    });
  }

  function byCx(a, b) { return a.rect.cx - b.rect.cx; }
  var above = items.filter(function (it) { return it.above; }).sort(byCx);
  var below = items.filter(function (it) { return !it.above; }).sort(byCx);
  assignTiers(above);
  assignTiers(below);

  var labelH = items.length ? items[0].label.height : 16;
  var topMargin = above.length ? STEM_BASE + maxTier(above) * STEM_STEP + labelH + 24 : 48;
  var bottomMargin = below.length ? STEM_BASE + maxTier(below) * STEM_STEP + labelH + 24 : 48;

  // Widen the stage so no label is cut off, then keep it inside the section.
  var minX = 0, maxX = instance.width;
  for (var k = 0; k < items.length; k++) {
    minX = Math.min(minX, items[k].rect.cx - items[k].label.width / 2);
    maxX = Math.max(maxX, items[k].rect.cx + items[k].label.width / 2);
  }
  var sidePad = 32;
  var stageW = Math.min(Math.max(maxX - minX + sidePad * 2, 320), contentWidth - 80);
  var stageH = instance.height + topMargin + bottomMargin;

  var stage = F('anatomy-stage', { width: stageW, height: stageH });
  stage.fills = [];

  var instX = Math.max(sidePad, (stageW - instance.width) / 2);
  var instY = topMargin;
  stage.appendChild(instance);
  instance.x = instX;
  instance.y = instY;

  drawMarkers(stage, above, instance, instX, instY, true, stageW);
  drawMarkers(stage, below, instance, instX, instY, false, stageW);

  var wrap = F(dark ? 'anatomy-dark' : 'anatomy-light', {
    dir: 'VERTICAL', gap: 8, pad: [40, 40, 40, 40],
    width: contentWidth, fill: dark ? COLOR.dark : COLOR.surface,
    align: 'CENTER', justify: 'CENTER', radius: 8
  });
  add(wrap, stage);
  return wrap;
}

/**
 * Labels sit on shared bands outside the component — one band per tier — and
 * the leader line stretches from the part itself out to its band. Anchoring on
 * the band rather than on each part's own edge is what keeps labels from
 * colliding, and it lets a line start inside the component the way Blade's do.
 */
function drawMarkers(stage, items, instance, instX, instY, isAbove, stageW) {
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var cx = instX + it.rect.cx;
    var offset = STEM_BASE + it.tier * STEM_STEP;

    var lineTop, lineHeight, labelY;
    if (isAbove) {
      var bandY = instY - offset;                       // where the line ends
      var partTop = instY + it.rect.y;
      lineTop = bandY;
      lineHeight = Math.max(8, partTop - bandY);
      labelY = bandY - it.label.height - 4;
    } else {
      var bandBottom = instY + instance.height + offset;
      var partBottom = instY + it.rect.y + it.rect.h;
      lineTop = partBottom;
      lineHeight = Math.max(8, bandBottom - partBottom);
      labelY = bandBottom + 4;
    }

    var line = figma.createRectangle();
    line.name = 'pointer';
    line.resize(1, lineHeight);
    line.fills = [solid(COLOR.marker)];
    stage.appendChild(line);
    line.x = Math.round(cx);
    line.y = Math.round(lineTop);

    stage.appendChild(it.label);
    it.label.y = Math.round(labelY);
    // keep the label inside the stage even when the part sits near an edge
    it.label.x = Math.round(Math.min(Math.max(cx - it.label.width / 2, 4), stageW - it.label.width - 4));
  }
}

/* ------------------------------------------------------------------ *
 * Component analysis
 * ------------------------------------------------------------------ */

var PROP_HINTS = {
  color: 'Sets the intent of the component.',
  variant: 'Switches the visual style of the component.',
  emphasis: 'Sets the visual intensity of the component.',
  size: 'Controls the size of the component.',
  state: 'Reflects the current interaction state.',
  isdisabled: 'Disables the component and blocks all interaction.',
  isloading: 'Shows a loading indicator and blocks interaction while work is in flight.',
  isselected: 'Marks the component as selected.',
  isfullwidth: 'Stretches the component to the full width of its container.',
  isrequired: 'Marks the field as mandatory.',
  isdismissible: 'Adds a close affordance so users can dismiss the component.',
  title: 'Short heading, ideally 3–4 words.',
  label: 'Describes the purpose of the component to the user.',
  message: 'Supporting copy shown under the title.',
  description: 'Supporting copy that adds context.',
  placeholder: 'Hint text shown when the field is empty.',
  helptext: 'Guidance shown below the field.',
  errortext: 'Message shown when validation fails.',
  icon: 'Icon rendered inside the component.',
  leadingicon: 'Icon rendered before the content.',
  trailingicon: 'Icon rendered after the content.',
  onclick: 'Callback fired when the user activates the component.',
  screensize: 'Adapts the layout to the target breakpoint.',
  elevation: 'Applies a shadow token to lift the surface.'
};

function hintFor(name) {
  var key = name.toLowerCase().replace(/[^a-z]/g, '');
  if (PROP_HINTS[key]) return PROP_HINTS[key];
  if (/^(show|is|has|can)/i.test(name)) {
    var rest = name.replace(/^(show|is|has|can)/i, '');
    rest = rest.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    if (/^show/i.test(name)) return 'Toggles the visibility of the ' + rest + '.';
    return 'Marks the component as ' + rest + '.';
  }
  return '';
}

async function resolveTarget(node) {
  if (!node) return null;
  if (node.type === 'COMPONENT_SET') return node;
  if (node.type === 'COMPONENT') {
    return node.parent && node.parent.type === 'COMPONENT_SET' ? node.parent : node;
  }
  if (node.type === 'INSTANCE') {
    var main = await node.getMainComponentAsync();
    if (!main) return null;
    return main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
  }
  return null;
}

function defaultVariantOf(target) {
  if (target.type === 'COMPONENT_SET') {
    return target.defaultVariant || target.children[0];
  }
  return target;
}

async function readTokens(root) {
  var rows = [];
  var seen = {};
  var cache = {};

  async function nameOfVariable(id) {
    if (cache[id] !== undefined) return cache[id];
    var out = null;
    try {
      var v = await figma.variables.getVariableByIdAsync(id);
      out = v ? v.name : null;
    } catch (e) { out = null; }
    cache[id] = out;
    return out;
  }

  function push(property, token) {
    if (!token) return;
    var k = property + '|' + token;
    if (seen[k]) return;
    seen[k] = true;
    rows.push({ property: property, token: token });
  }

  async function boundOr(node, field, literal) {
    var bv = node.boundVariables || {};
    if (bv[field] && bv[field].id) {
      var n = await nameOfVariable(bv[field].id);
      if (n) return n;
    }
    return literal;
  }

  function hex(paint) {
    if (!paint || paint.type !== 'SOLID') return null;
    function h(v) { var s = Math.round(v * 255).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + h(paint.color.r) + h(paint.color.g) + h(paint.color.b);
  }

  async function paintToken(node, key, label) {
    var arr = node[key];
    if (!arr || arr === figma.mixed || !arr.length) return;
    var bv = (node.boundVariables || {})[key];
    if (bv && bv.length && bv[0].id) {
      var n = await nameOfVariable(bv[0].id);
      if (n) { push(label, n); return; }
    }
    var lit = hex(arr[0]);
    if (lit) push(label, lit);
  }

  // Container level geometry
  if ('paddingLeft' in root) {
    var pl = await boundOr(root, 'paddingLeft', root.paddingLeft + 'px');
    var pr = await boundOr(root, 'paddingRight', root.paddingRight + 'px');
    var pt = await boundOr(root, 'paddingTop', root.paddingTop + 'px');
    var pb = await boundOr(root, 'paddingBottom', root.paddingBottom + 'px');
    if (pl === pr) push('Horizontal Padding', 'padding-horizontal: ' + pl);
    else { push('Padding (Left)', 'padding-left: ' + pl); push('Padding (Right)', 'padding-right: ' + pr); }
    if (pt === pb) push('Vertical Padding', 'padding-vertical: ' + pt);
    else { push('Padding (Top)', 'padding-top: ' + pt); push('Padding (Bottom)', 'padding-bottom: ' + pb); }
  }
  if ('itemSpacing' in root && root.layoutMode && root.layoutMode !== 'NONE') {
    push('Gap', 'gap: ' + (await boundOr(root, 'itemSpacing', root.itemSpacing + 'px')));
  }
  if ('cornerRadius' in root && root.cornerRadius !== figma.mixed && root.cornerRadius) {
    push('Border Radius', 'border-radius: ' + (await boundOr(root, 'topLeftRadius', root.cornerRadius + 'px')));
  }
  if ('strokeWeight' in root && root.strokes && root.strokes.length && root.strokeWeight !== figma.mixed && root.strokeWeight) {
    push('Border Width', 'border-width: ' + (await boundOr(root, 'strokeWeight', root.strokeWeight + 'px')));
  }
  await paintToken(root, 'fills', 'Background');
  await paintToken(root, 'strokes', 'Border Color');

  // Text + icon descendants
  var descendants = root.findAll ? root.findAll(function () { return true; }).slice(0, 80) : [];
  var textSeen = 0, iconSeen = 0;
  for (var i = 0; i < descendants.length; i++) {
    var n = descendants[i];
    if (n.type === 'TEXT' && textSeen < 4) {
      textSeen++;
      var label = 'Text (' + n.name.slice(0, 24) + ')';
      if (n.textStyleId && typeof n.textStyleId === 'string') {
        try {
          var st = await figma.getStyleByIdAsync(n.textStyleId);
          if (st) push(label, 'typography: ' + st.name);
        } catch (e) { /* ignore */ }
      } else if (n.fontName !== figma.mixed && n.fontSize !== figma.mixed) {
        push(label, n.fontName.family + ' ' + n.fontName.style + ' ' + n.fontSize + 'px');
      }
      await paintToken(n, 'fills', label + ' Color');
    }
    if (iconSeen < 2 && /icon/i.test(n.name) && n.width && n.width <= 48) {
      iconSeen++;
      push('Icon Size', 'icon-size: ' + Math.round(n.width) + 'px');
    }
  }

  return rows;
}

/** Instance-swap defaults arrive as node ids like "60:132"; show a name instead. */
async function componentNameFor(value) {
  if (!value || !/^[0-9]+:[0-9]+$/.test(value)) return value || 'N/A';
  try {
    var node = await figma.getNodeByIdAsync(value);
    if (!node) return 'N/A';
    if (node.parent && node.parent.type === 'COMPONENT_SET') {
      return node.parent.name + ' / ' + node.name;
    }
    return node.name;
  } catch (e) {
    return 'N/A';
  }
}

async function analyze(target) {
  var dv = defaultVariantOf(target);
  var defs = target.componentPropertyDefinitions || {};
  var props = [];

  var keys = Object.keys(defs);
  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki];
    var d = defs[key];
    var name = key.split('#')[0];
    var type = 'string';
    var values = 'N/A';
    var required = false;
    var dflt = d.defaultValue === undefined || d.defaultValue === null ? 'N/A' : String(d.defaultValue);

    if (d.type === 'VARIANT') {
      values = (d.variantOptions || []).join('\n');
      type = 'string';
      required = true;
    } else if (d.type === 'BOOLEAN') {
      values = 'True\nFalse';
      type = 'boolean';
    } else if (d.type === 'TEXT') {
      values = 'N/A';
      type = 'string';
      required = true;
    } else if (d.type === 'INSTANCE_SWAP') {
      values = 'N/A';
      type = 'ReactNode';
      // defaultValue is a raw node id — show the component's name instead.
      dflt = await componentNameFor(dflt);
    }

    props.push({
      key: key,
      name: name,
      figmaType: d.type,
      type: type,
      values: values,
      default: dflt,
      required: required,
      description: hintFor(name)
    });
  }

  props.sort(function (a, b) {
    var order = { VARIANT: 0, TEXT: 1, BOOLEAN: 2, INSTANCE_SWAP: 3 };
    return (order[a.figmaType] - order[b.figmaType]) || a.name.localeCompare(b.name);
  });

  var parts = collectParts(dv, 8).map(function (p) { return p.name; });
  var tokens = await readTokens(dv);

  return {
    id: target.id,
    name: target.name,
    isSet: target.type === 'COMPONENT_SET',
    variantCount: target.type === 'COMPONENT_SET' ? target.children.length : 1,
    description: target.description || '',
    props: props,
    parts: parts,
    tokens: tokens
  };
}

/* ------------------------------------------------------------------ *
 * Instance factory
 * ------------------------------------------------------------------ */

function makeInstance(target, propsToSet) {
  var dv = defaultVariantOf(target);
  var inst = dv.createInstance();
  if (propsToSet) {
    try { inst.setProperties(propsToSet); } catch (e) { /* invalid combo, keep default */ }
  }
  return inst;
}

/* ------------------------------------------------------------------ *
 * Section builders
 * ------------------------------------------------------------------ */

function buildIntroduction(target, cfg, data) {
  var w = WIDTH.intro;
  var s = section({
    name: '_Introduction',
    title: 'Introduction',
    description: data.name + ' component',
    width: w, system: cfg.systemName, link: cfg.docsLink, badge: cfg.status
  });

  add(s.body, T(cfg.introduction, opts(TYPE.sectionDesc, { width: w, name: 'intro-copy' })), true);

  if (cfg.sections.anatomy) {
    var anatomy = F('anatomy', { dir: 'VERTICAL', gap: 16, width: w });
    add(anatomy, anatomyStage(makeInstance(target), cfg.anatomyLabels, w, false), true);
    if (cfg.darkAnatomy) {
      add(anatomy, anatomyStage(makeInstance(target), cfg.anatomyLabels, w, true), true);
    }
    add(s.body, anatomy, true);
  }
  return s.section;
}

function buildProps(target, cfg, data) {
  var w = WIDTH.props;
  var s = section({
    name: '_Component Props',
    title: 'Props & Tokens',
    description: 'Properties offered by the component useful for developers',
    width: w, system: cfg.systemName, link: cfg.docsLink
  });

  var propsGroup = F('props', { dir: 'VERTICAL', gap: 16, width: w });
  add(propsGroup, textItem('Props', 'Prop list for the component', w), true);
  add(propsGroup, propsTable(cfg.props, w), true);
  add(s.body, propsGroup, true);

  if (cfg.tokens.length) {
    var tokensGroup = F('tokens', { dir: 'VERTICAL', gap: 16, width: w });
    add(tokensGroup, textItem('Tokens', 'Tokens used for the component', w), true);
    add(tokensGroup, tokensTable(cfg.tokens, w), true);
    add(s.body, tokensGroup, true);
  }
  return s.section;
}

function buildVariations(target, cfg, data) {
  var w = WIDTH.variations;
  var s = section({
    name: '_Variations',
    title: 'Variations',
    description: 'Every variation the component ships with, and when to reach for each',
    width: w, system: cfg.systemName, link: cfg.docsLink
  });

  var variantProps = cfg.props.filter(function (p) {
    return p.figmaType === 'VARIANT' && p.values && p.values !== 'N/A';
  });

  if (!variantProps.length) {
    add(s.body, block({
      name: 'default',
      title: 'Default',
      description: 'This component has a single appearance.',
      width: w,
      content: specimenStage([makeInstance(target)], { width: w }),
      divider: false
    }), true);
    return s.section;
  }

  for (var i = 0; i < variantProps.length; i++) {
    var p = variantProps[i];
    var values = p.values.split('\n').filter(function (v) { return v.trim(); });
    var specimens = [];
    for (var j = 0; j < values.length && j < 12; j++) {
      var setter = {};
      setter[p.name] = values[j];
      specimens.push(labelledSpecimen(makeInstance(target, setter), p.name + ' = ' + values[j]));
    }
    add(s.body, block({
      name: p.name,
      title: p.name,
      description: p.description || 'Available values: ' + values.join(', ') + '.',
      width: w,
      content: specimenStage(specimens, { width: w, wrap: true, gap: 32 }),
      divider: i < variantProps.length - 1
    }), true);
  }
  return s.section;
}

function buildUsage(target, cfg) {
  var w = WIDTH.usage;
  var s = section({
    name: '_Usage Guidelines',
    title: 'Usage Guidelines',
    description: 'General rules and advice while using this component in the product',
    width: w, system: cfg.systemName, link: cfg.docsLink
  });

  var half = (w - 24) / 2;
  var items = cfg.usage;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var content = null;
    if (it.do || it.dont) {
      content = F('body', { dir: 'HORIZONTAL', gap: 24, width: w });
      add(content, doDontCard(true, it.do, [makeInstance(target)], half), true);
      add(content, doDontCard(false, it.dont, [makeInstance(target)], half), true);
    }
    add(s.body, block({
      name: 'guideline-' + (i + 1),
      title: it.title,
      description: it.description,
      width: w,
      content: content,
      divider: i < items.length - 1
    }), true);
  }
  return s.section;
}

function buildContent(target, cfg) {
  var w = WIDTH.content;
  var s = section({
    name: '_Content Guidelines',
    title: 'Content Guidelines',
    description: 'General rules while writing content for this component',
    width: w, system: cfg.systemName, link: cfg.docsLink
  });

  var half = (w - 24) / 2;
  for (var i = 0; i < cfg.content.length; i++) {
    var it = cfg.content[i];
    var body = F('body', { dir: 'HORIZONTAL', gap: 24, width: w });
    add(body, doDontCard(true, it.do, [makeInstance(target)], half), true);
    add(body, doDontCard(false, it.dont, [makeInstance(target)], half), true);
    add(s.body, block({
      name: 'content-' + (i + 1),
      title: it.title,
      description: it.description,
      width: w,
      content: body,
      divider: i < cfg.content.length - 1
    }), true);
  }
  return s.section;
}

function buildPlatforms(target, cfg) {
  var w = WIDTH.platforms;
  var s = section({
    name: '_Platforms',
    title: 'Platform',
    description: 'How this component behaves across desktop, tablet and mobile',
    width: w, system: cfg.systemName, link: cfg.docsLink
  });

  var rows = [
    { title: 'Desktop', description: 'Used on websites and dashboards.' },
    { title: 'Tablet', description: 'Used on tablet breakpoints, sized between desktop and mobile.' },
    { title: 'Mobile', description: 'Used on native mobile apps and small breakpoints.' }
  ];
  for (var i = 0; i < rows.length; i++) {
    add(s.body, block({
      name: rows[i].title.toLowerCase(),
      title: rows[i].title,
      description: rows[i].description,
      width: w,
      content: specimenStage([makeInstance(target)], { width: w }),
      divider: i < rows.length - 1
    }), true);
  }
  return s.section;
}

function buildAccessibility(cfg) {
  var w = WIDTH.a11y;
  var s = section({
    name: '_Accessibility',
    title: 'Accessibility',
    description: 'Accessibility practices to take care of while using this component',
    width: w, system: cfg.systemName, link: cfg.docsLink,
    bodyGap: 24
  });
  for (var i = 0; i < cfg.a11y.length; i++) {
    var item = textItem(cfg.a11y[i].title, cfg.a11y[i].description, w);
    item.paddingBottom = 24;
    add(s.body, item, true);
  }
  return s.section;
}

function buildChanges(cfg) {
  var w = WIDTH.changes;
  var s = section({
    name: '_Changes',
    title: 'Changelog',
    description: 'Changes made to this component over time',
    width: w, system: cfg.systemName, link: cfg.docsLink,
    bodyGap: 0
  });

  var table = F('table', { dir: 'VERTICAL', gap: 0, width: w });
  add(table, tableRow([
    T('Version', opts(TYPE.tableHead)),
    T('Date', opts(TYPE.tableHead)),
    T('Change', opts(TYPE.tableHead))
  ], { cols: [140, 160, 700], width: w, header: true, fill: COLOR.tableHead }), true);

  for (var i = 0; i < cfg.changelog.length; i++) {
    var c = cfg.changelog[i];
    add(table, tableRow([
      T(c.version, opts(TYPE.propType)),
      T(c.date, opts(TYPE.cell)),
      [badge(c.type || 'Published'), T(c.text, opts(TYPE.cellMuted, { width: 700 - 32 }))]
    ], { cols: [140, 160, 700], width: w }), true);
  }
  add(s.body, table, true);
  return s.section;
}

function buildThumb(target, cfg, data) {
  var thumb = F('_Thumb', {
    dir: 'VERTICAL', gap: 0, width: 380, fill: COLOR.thumb,
    align: 'CENTER', justify: 'CENTER', radius: 8, pad: [32, 32, 32, 32]
  });
  thumb.resize(380, 272);
  thumb.primaryAxisSizingMode = 'FIXED';
  thumb.counterAxisSizingMode = 'FIXED';
  thumb.clipsContent = true;
  add(thumb, makeInstance(target));
  return thumb;
}

/* ------------------------------------------------------------------ *
 * Page assembly
 * ------------------------------------------------------------------ */

var MARKER_KEY = 'blade-docs';
var MARKER_NS = 'bladeDocsGenerator';

async function generate(cfg) {
  var target = await figma.getNodeByIdAsync(cfg.targetId);
  if (!target) throw new Error('The component could not be found. Re-select it and try again.');

  var data = await analyze(target);

  // Reuse an existing generated page for this component so re-running updates it.
  var pageName = '❖ ' + data.name;
  var page = null;
  var roots = figma.root.children;
  for (var i = 0; i < roots.length; i++) {
    // Page stubs are not always readable before they load; a miss just means
    // we fall through and create a fresh page.
    try {
      if (roots[i].getSharedPluginData(MARKER_NS, MARKER_KEY) === target.id) { page = roots[i]; break; }
    } catch (e) { /* unloaded page, skip */ }
  }
  var reused = !!page;
  if (!page) {
    page = figma.createPage();
    page.setSharedPluginData(MARKER_NS, MARKER_KEY, target.id);
  } else {
    await page.loadAsync();
    var existing = page.children.slice();
    for (var k = 0; k < existing.length; k++) existing[k].remove();
  }
  page.name = pageName;
  await figma.setCurrentPageAsync(page);

  var sections = [];
  sections.push(buildThumb(target, cfg, data));
  if (cfg.sections.introduction) sections.push(buildIntroduction(target, cfg, data));
  if (cfg.sections.props) sections.push(buildProps(target, cfg, data));
  if (cfg.sections.variations) sections.push(buildVariations(target, cfg, data));
  if (cfg.sections.usage && cfg.usage.length) sections.push(buildUsage(target, cfg));
  if (cfg.sections.content && cfg.content.length) sections.push(buildContent(target, cfg));
  if (cfg.sections.platforms) sections.push(buildPlatforms(target, cfg));
  if (cfg.sections.accessibility && cfg.a11y.length) sections.push(buildAccessibility(cfg));
  if (cfg.sections.changelog && cfg.changelog.length) sections.push(buildChanges(cfg));

  var x = 0;
  var ids = [];
  for (var s = 0; s < sections.length; s++) {
    page.appendChild(sections[s]);
    sections[s].x = x;
    sections[s].y = 0;
    x += sections[s].width + GUTTER;
    ids.push(sections[s].id);
  }

  figma.currentPage.selection = sections;
  figma.viewport.scrollAndZoomIntoView(sections);

  return { pageName: pageName, sectionCount: sections.length, reused: reused, ids: ids };
}

/* ------------------------------------------------------------------ *
 * Defaults for the editable copy
 * ------------------------------------------------------------------ */

function defaultContent(data) {
  var n = data.name;
  return {
    introduction: data.description
      ? data.description
      : n + ' is a component in the design system. Describe what it does, when a designer or '
        + 'developer should reach for it, and what it should not be used for.\n\nFew points to remember:\n'
        + '• Use it consistently across surfaces so users learn it once.\n'
        + '• Keep the content short and specific.\n'
        + '• Reach for a simpler component when this one is more than the job needs.',
    usage: [
      {
        title: 'Use ' + n + ' for its intended purpose',
        description: 'Explain the situation this component was built for, and the closest alternative for everything else.',
        do: 'Use ' + n + ' where the pattern genuinely applies.',
        dont: 'Do not repurpose ' + n + ' for a job another component already does.'
      },
      {
        title: 'Keep placement predictable',
        description: 'Users should find this component in the same place on every surface it appears.',
        do: 'Place it consistently, close to the content it describes.',
        dont: 'Do not scatter it or bury it far from its context.'
      }
    ],
    content: [
      {
        title: 'Write short, specific copy',
        description: 'Front-load the value. Cut words that do not change the reader’s decision.',
        do: 'Lead with the outcome in plain language.',
        dont: 'Do not pad the copy with filler or jargon.'
      }
    ],
    a11y: [
      { title: 'Text', description: 'All text must be readable by assistive technologies such as screen readers.' },
      { title: 'Colors', description: 'Colour contrast between foreground and background should be at least 4.5:1 for body text and 3:1 for large text and non-text elements.' },
      { title: 'Keyboard', description: 'Every interactive element must be reachable with Tab and operable with Enter or Space, with a visible focus ring.' },
      { title: 'Motion', description: 'Respect the reduced-motion preference: animation should be shortened or removed when a user has asked for less motion.' }
    ],
    changelog: [
      { version: 'v1.0.0', date: todayISO(), text: 'Component published to the design system.', type: 'Published' }
    ]
  };
}

function todayISO() {
  var d = new Date();
  function p(v) { return v < 10 ? '0' + v : String(v); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* ------------------------------------------------------------------ *
 * Selection plumbing
 * ------------------------------------------------------------------ */

var lastTargetId = null;

/**
 * Only re-draft the panel when a genuinely different component is selected.
 * Re-sending on every selection change would throw away edits the moment the
 * user clicked anything on the canvas.
 */
async function pushSelection(force) {
  var sel = figma.currentPage.selection;
  var target = sel.length ? await resolveTarget(sel[0]) : null;

  if (!target) {
    if (lastTargetId && !force) return;   // keep whatever is on screen
    figma.ui.postMessage({ type: 'no-selection' });
    return;
  }
  if (!force && target.id === lastTargetId) return;

  lastTargetId = target.id;
  var data = await analyze(target);
  var saved = null;
  try { saved = await figma.clientStorage.getAsync('doc:' + target.id); } catch (e) { /* ignore */ }
  figma.ui.postMessage({
    type: 'selection',
    data: data,
    defaults: defaultContent(data),
    saved: saved || null
  });
}

figma.showUI(__html__, { width: 520, height: 720, themeColors: true });

figma.ui.onmessage = async function (msg) {
  try {
    if (msg.type === 'ready') {
      await initFonts();
      figma.ui.postMessage({ type: 'fonts', fonts: FONTS });
      await pushSelection();
      return;
    }

    if (msg.type === 'refresh') {
      await pushSelection(true);
      return;
    }

    if (msg.type === 'generate') {
      figma.ui.postMessage({ type: 'busy' });
      var result = await generate(msg.config);
      try { await figma.clientStorage.setAsync('doc:' + msg.config.targetId, msg.config); } catch (e) { /* ignore */ }
      figma.ui.postMessage({ type: 'done', result: result });
      return;
    }

    if (msg.type === 'close') {
      figma.closePlugin();
      return;
    }
  } catch (err) {
    figma.ui.postMessage({ type: 'error', message: (err && err.message) ? err.message : String(err) });
  }
};

figma.on('selectionchange', function () {
  pushSelection().catch(function () { /* fonts may not be ready yet */ });
});
