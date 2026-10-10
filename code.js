// Natural Color Palette turns one color into Light and Dark UI variables plus a preview on the canvas.
// Dark: the screen is the light source, so every level forward multiplies L and C by 1.22, like one material catching more light.
// Light: white is the ceiling, so the card takes white and every level nested inside it is 0.04 L darker, like a recessed fill.
// The steps match Apple and Material surface steps; text and accent move in lightness until they pass WCAG.

const MODES = ['Light', 'Dark']
const DEFAULT_NAME = 'Natural palette'

const DARK_BASE = 0.18
const DARK_STEP = 1.22
const LIGHT_BASE = 0.97
const LIGHT_STEP = 0.04
const LIGHT_TINT = 0.2
const TINT_MAX = 0.035
const MIN_CONTRAST = 4.5
const TEXT_CONTRAST = 7

// Concentric corners: each radius is its parent's radius minus the padding between them
const PAD = { frame: 24, card: 12, inner: 8 }
const R_CHIP = 8
const R_INNER = R_CHIP + PAD.inner
const R_CARD = R_INNER + PAD.card
const R_FRAME = R_CARD + PAD.frame

const SURFACE = ['FRAME_FILL', 'SHAPE_FILL']
const ROLES = [
  { name: 'surface/0', label: 'Level 0', description: 'Background', scopes: SURFACE },
  { name: 'surface/1', label: 'Level 1', description: 'Card', scopes: SURFACE },
  { name: 'surface/2', label: 'Level 2', description: 'Element inside a card', scopes: SURFACE },
  { name: 'surface/3', label: 'Level 3', description: 'Chip or control', scopes: SURFACE },
  { name: 'border', label: 'Border', description: 'Hairlines and dividers', scopes: ['STROKE_COLOR', 'SHAPE_FILL'] },
  { name: 'text/primary', label: 'Text', description: 'Primary text and icons', scopes: ['TEXT_FILL', 'SHAPE_FILL'] },
  { name: 'text/muted', label: 'Muted', description: 'Secondary text', scopes: ['TEXT_FILL'] },
  { name: 'accent', label: 'Accent', description: 'Buttons, links and selection', scopes: ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR'] },
  { name: 'on-accent', label: 'On accent', description: 'Text and icons on accent', scopes: ['TEXT_FILL', 'SHAPE_FILL'] },
]

// ---- color math

function toLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function toGamma(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x))
}

function rgbToOklch(rgb) {
  const r = toLinear(rgb.r)
  const g = toLinear(rgb.g)
  const b = toLinear(rgb.b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const H = (Math.atan2(B, A) * 180) / Math.PI
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    C: Math.hypot(A, B),
    H: H < 0 ? H + 360 : H,
  }
}

function oklchToLinear(L, C, H) {
  const A = C * Math.cos((H * Math.PI) / 180)
  const B = C * Math.sin((H * Math.PI) / 180)
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3)
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3)
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function inGamut(lin) {
  return lin.every((c) => c >= -1e-4 && c <= 1 + 1e-4)
}

// Largest chroma that still fits sRGB at this lightness and hue
function maxChroma(L, H) {
  let lo = 0
  let hi = 0.4
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToLinear(L, mid, H))) lo = mid
    else hi = mid
  }
  return lo
}

// Out-of-gamut colors give up chroma, never lightness or hue
function color(L, C, H) {
  const c = Math.min(C, maxChroma(L, H))
  const lin = oklchToLinear(L, c, H)

  // Rounded to 8 bits, so every contrast check measures the exact hex a user copies
  const q = (x) => Math.round(clamp01(toGamma(x)) * 255) / 255
  const rgb = { r: q(lin[0]), g: q(lin[1]), b: q(lin[2]) }
  return { L, C: c, rgb, hex: toHex(rgb) }
}

function toHex(rgb) {
  const channels = [rgb.r, rgb.g, rgb.b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
  return '#' + channels.join('').toUpperCase()
}

function luminance(rgb) {
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
}

function contrast(a, b) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function oklchText(rgb) {
  const c = rgbToOklch(rgb)
  return `oklch(${c.L.toFixed(2)} ${c.C.toFixed(3)} ${Math.round(c.H)})`
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + hue / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return { r: f(0), g: f(8), b: f(4) }
}

// Accepts hex with or without alpha, rgb(), hsl() and oklch(), as pasted from Figma, CSS or other tools; alpha is dropped
function parseColor(input) {
  const s = String(input || '').trim().toLowerCase()
  const hex = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (hex) {
    const h = hex[1].length <= 4 ? hex[1].replace(/./g, '$&$&') : hex[1]
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }
  }
  const ok = s.match(/^oklch\(\s*([\d.]+)(%?)[\s,]+([\d.]+)(%?)[\s,]+([\d.]+)(deg|turn)?\s*(?:\/[^)]*)?\)$/)
  if (ok) {
    const L = parseFloat(ok[1]) / (ok[2] ? 100 : 1)

    // CSS maps 100% chroma to 0.4
    const C = parseFloat(ok[3]) * (ok[4] ? 0.004 : 1)
    const H = parseFloat(ok[5]) * (ok[6] === 'turn' ? 360 : 1)
    if (L >= 0 && L <= 1 && C >= 0 && H >= 0) return color(L, C, H).rgb
  }
  const fn = s.match(/^(rgb|hsl)a?\(([^)]*)\)$/)
  const parts = fn ? fn[2].split(/[\s,/]+/).filter(Boolean).slice(0, 3) : []
  const n = parts.map(parseFloat)
  if (parts.length === 3 && n.every(isFinite)) {
    if (fn[1] === 'hsl') return hslToRgb(n[0] * (parts[0].endsWith('turn') ? 360 : 1), clamp01(n[1] / 100), clamp01(n[2] / 100))
    const channel = (p, v) => clamp01(p.endsWith('%') ? v / 100 : v / 255)
    return { r: channel(parts[0], n[0]), g: channel(parts[1], n[1]), b: channel(parts[2], n[2]) }
  }
  return null
}

// light-dark() keeps both modes in one declaration and works in all current browsers
function toCss(palette) {
  const value = (c) => `oklch(${c.L.toFixed(3)} ${c.C.toFixed(4)} ${palette.H.toFixed(1)})`
  const lines = ROLES.map((role) => {
    const light = value(palette.modes.Light[role.name])
    const dark = value(palette.modes.Dark[role.name])
    return `  ${cssName(role.name)}: light-dark(${light}, ${dark});`
  })
  return [':root {', '  color-scheme: light dark;'].concat(lines, ['}']).join('\n')
}

function cssName(role) {
  return '--' + role.replace(/\//g, '-')
}

// ---- palette

// Lightness moves away from the surface until the pair reaches the contrast target
function readableL(L, C, H, on, min, step) {
  let l = L
  while (l > 0.05 && l < 0.99 && contrast(color(l, C, H).rgb, on.rgb) < min) l += step
  return l
}

// Weakest contrast per role across all surfaces, and the smallest lightness gap between nested levels
function checksFor(m) {
  const surfaces = [0, 1, 2, 3].map((n) => m['surface/' + n])
  const weakest = (key) => Math.min(...surfaces.map((s) => contrast(m[key].rgb, s.rgb)))
  const gaps = [1, 2, 3].map((n) => Math.abs(surfaces[n].L - surfaces[n - 1].L))
  return {
    text: weakest('text/primary'),
    muted: weakest('text/muted'),
    accent: contrast(m.accent.rgb, m['on-accent'].rgb),
    step: Math.min(...gaps),
  }
}

function buildPalette(rgb) {
  const src = rgbToOklch(rgb)
  const H = src.H
  const tint = Math.min(src.C, TINT_MAX)
  const dark = {}
  const light = {}

  for (let n = 0; n <= 3; n++) {
    const k = Math.pow(DARK_STEP, n)
    dark['surface/' + n] = color(DARK_BASE * k, tint * k, H)
  }

  // Chroma shrinks with the distance to white, so the white card carries none
  const lightL = [LIGHT_BASE, 1, 1 - LIGHT_STEP, 1 - 2 * LIGHT_STEP]
  lightL.forEach((L, n) => {
    light['surface/' + n] = color(L, (tint * LIGHT_TINT * (1 - L)) / LIGHT_STEP, H)
  })

  // Borders sit one step past the deepest surface in both modes
  const k4 = Math.pow(DARK_STEP, 4)
  dark.border = color(DARK_BASE * k4, tint * k4, H)
  light.border = color(1 - 3 * LIGHT_STEP, tint * LIGHT_TINT * 3, H)

  // Text is measured against the surface closest to it in lightness
  const darkTop = dark['surface/3']
  const lightLow = light['surface/0'].L < light['surface/3'].L ? light['surface/0'] : light['surface/3']
  dark['text/primary'] = color(readableL(0.96, tint * 0.35, H, darkTop, TEXT_CONTRAST, 0.01), tint * 0.35, H)
  dark['text/muted'] = color(readableL(0.74, tint * 0.85, H, darkTop, MIN_CONTRAST, 0.01), tint * 0.85, H)
  light['text/primary'] = color(readableL(0.22, tint * 0.6, H, lightLow, TEXT_CONTRAST, -0.01), tint * 0.6, H)
  light['text/muted'] = color(readableL(0.5, tint * 0.85, H, lightLow, MIN_CONTRAST, -0.01), tint * 0.85, H)

  // The accent keeps the input's hue and chroma, so it reads as the same brand color in both modes
  dark['on-accent'] = dark['surface/0']
  light['on-accent'] = color(1, 0, H)
  dark.accent = color(readableL(0.78, src.C, H, dark['on-accent'], MIN_CONTRAST, 0.01), src.C, H)
  light.accent = color(readableL(0.55, src.C, H, light['on-accent'], MIN_CONTRAST, -0.01), src.C, H)

  return {
    source: toHex(rgb),
    oklch: oklchText(rgb),
    H,
    modes: { Light: light, Dark: dark },
    checks: { Light: checksFor(light), Dark: checksFor(dark) },
  }
}

// ---- variables

// Plugin data marks our collections, variables and previews, so a same-named item of the user's is never touched
function createCollection(title, name, split) {
  const col = figma.variables.createVariableCollection(title)
  col.setPluginData('name', name)
  col.setPluginData('split', split)
  col.renameMode(col.modes[0].modeId, split || 'Light')
  return col
}

function modeIdFor(col, mode) {
  const found = col.modes.find((m) => m.name === mode)
  return found ? found.modeId : col.addMode(mode)
}

// Light and Dark become modes of one collection; plans limited to one mode get a collection per mode
async function ensureTargets(name) {
  const all = await figma.variables.getLocalVariableCollectionsAsync()
  const owned = all.filter((c) => c.getPluginData('name') === name)
  const split = (mode) => owned.find((c) => c.getPluginData('split') === mode)
  const single = (col, mode) => ({ mode, col, modeId: col.modes[0].modeId })
  if (split('Light') && split('Dark')) return [single(split('Light'), 'Light'), single(split('Dark'), 'Dark')]

  // A Light collection left alone after its Dark one was deleted is reused, not duplicated
  const col = owned.find((c) => !c.getPluginData('split')) || split('Light') || createCollection(name, name, '')
  try {
    return MODES.map((mode) => ({ mode, col, modeId: modeIdFor(col, mode) }))
  } catch (e) {
    col.name = name + ' Light'
    col.setPluginData('split', 'Light')
    return [single(col, 'Light'), single(split('Dark') || createCollection(name + ' Dark', name, 'Dark'), 'Dark')]
  }
}

async function writeVariables(targets, palette) {
  const vars = {}
  let created = 0
  for (const t of targets) {
    const existing = await Promise.all(t.col.variableIds.map((id) => figma.variables.getVariableByIdAsync(id)))
    vars[t.mode] = {}
    for (const role of ROLES) {
      // The role tag survives a rename; the untagged name match picks up palettes made before tagging
      let v =
        existing.find((x) => x && x.getPluginData('role') === role.name) ||
        existing.find((x) => x && !x.getPluginData('role') && x.name === role.name)
      if (!v) {
        v = figma.variables.createVariable(role.name, t.col, 'COLOR')
        created++
      }
      v.setPluginData('role', role.name)
      v.description = role.description
      v.scopes = role.scopes
      v.setVariableCodeSyntax('WEB', `var(${cssName(role.name)})`)
      v.setValueForMode(t.modeId, palette.modes[t.mode][role.name].rgb)
      vars[t.mode][role.name] = v
    }
  }
  return { vars, created }
}

// ---- preview

function paint(variable) {
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', variable)
}

function stack(direction, opts) {
  const f = figma.createFrame()
  f.layoutMode = direction
  f.primaryAxisSizingMode = 'AUTO'
  f.counterAxisSizingMode = 'AUTO'
  f.name = opts.name
  f.itemSpacing = opts.gap || 0
  f.paddingLeft = f.paddingRight = opts.padX || 0
  f.paddingTop = f.paddingBottom = opts.padY || 0
  f.cornerRadius = opts.radius || 0
  f.fills = opts.fill ? [paint(opts.fill)] : []
  return f
}

function text(chars, size, style, fill) {
  const t = figma.createText()
  t.fontName = { family: 'Inter', style }
  t.characters = chars
  t.fontSize = size
  t.fills = [paint(fill)]
  return t
}

// Appends and stretches the child across its auto-layout parent
function stretch(parent, child) {
  parent.appendChild(child)
  child.layoutSizingHorizontal = 'FILL'
  return child
}

function num(x, digits) {
  return x.toFixed(digits).replace(/^0/, '')
}

function titleBlock(title, subtitle, size, v) {
  const block = stack('VERTICAL', { name: 'Title', gap: 2 })
  block.appendChild(text(title, size, 'Medium', v['text/primary']))
  block.appendChild(text(subtitle, 12, 'Regular', v['text/muted']))
  return block
}

function swatch(row, role, c, v) {
  const cell = stretch(row, stack('VERTICAL', { name: role.label, gap: 6 }))
  const rect = figma.createRectangle()
  rect.name = role.name
  rect.resize(64, 48)
  rect.cornerRadius = R_CHIP
  rect.fills = [paint(v[role.name])]
  if (role.name === 'surface/0') {
    rect.strokes = [paint(v.border)]
    rect.strokeAlign = 'INSIDE'
  }
  stretch(cell, rect)
  cell.appendChild(text(role.label, 12, 'Medium', v['text/primary']))
  cell.appendChild(text(c.hex, 11, 'Regular', v['text/muted']))
  cell.appendChild(text(`L ${num(c.L, 2)}  C ${num(c.C, 3)}`, 11, 'Regular', v['text/muted']))
}

function modeFrame(t, palette, v) {
  const frame = stack('VERTICAL', { name: t.mode, gap: 24, padX: PAD.frame, padY: PAD.frame, radius: R_FRAME, fill: v['surface/0'] })
  frame.resize(360, 100)
  frame.primaryAxisSizingMode = 'AUTO'
  frame.setExplicitVariableModeForCollection(t.col, t.modeId)

  const head = stretch(frame, stack('VERTICAL', { name: 'Header', gap: 4 }))
  head.appendChild(text(t.mode, 20, 'Medium', v['text/primary']))
  const rule = t.mode === 'Dark' ? `L and C × ${DARK_STEP} per level.` : `White card, each level inward ${LIGHT_STEP} L darker.`
  const caption = text(`From ${palette.source}, hue ${Math.round(palette.H)}°. ${rule}`, 12, 'Regular', v['text/muted'])
  caption.textAutoResize = 'HEIGHT'
  stretch(head, caption)

  const card = stretch(frame, stack('VERTICAL', { name: 'Card', gap: 12, padX: PAD.card, padY: PAD.card, radius: R_CARD, fill: v['surface/1'] }))
  card.appendChild(titleBlock('Weekly focus', 'Card, level 1', 15, v))
  const inner = stretch(card, stack('VERTICAL', { name: 'Inner', gap: 12, padX: PAD.inner, padY: PAD.inner, radius: R_INNER, fill: v['surface/2'] }))
  inner.appendChild(titleBlock('Design review', 'Inner, level 2', 14, v))

  const actions = stretch(inner, stack('HORIZONTAL', { name: 'Actions', gap: 8 }))
  actions.primaryAxisAlignItems = 'SPACE_BETWEEN'
  actions.counterAxisAlignItems = 'CENTER'
  const chip = stack('HORIZONTAL', { name: 'Chip', padX: 10, padY: 6, radius: R_CHIP, fill: v['surface/3'] })
  chip.appendChild(text('Chip, level 3', 12, 'Regular', v['text/primary']))
  const button = stack('HORIZONTAL', { name: 'Button', padX: 12, padY: 6, radius: R_CHIP, fill: v.accent })
  button.appendChild(text('Open', 12, 'Medium', v['on-accent']))
  actions.appendChild(chip)
  actions.appendChild(button)

  for (const group of [ROLES.slice(0, 4), ROLES.slice(4, 8)]) {
    const row = stretch(frame, stack('HORIZONTAL', { name: 'Swatches', gap: 8 }))
    for (const role of group) swatch(row, role, palette.modes[t.mode][role.name], v)
  }
  return frame
}

// Starts right of the selection, or centered in view, and moves right until nothing on the page is underneath
function freeSpot(root) {
  const gap = 80
  const boxes = figma.currentPage.selection.map((n) => n.absoluteBoundingBox).filter(Boolean)
  const center = figma.viewport.center
  let x = boxes.length ? Math.max(...boxes.map((b) => b.x + b.width)) + gap : center.x - root.width / 2
  const y = boxes.length ? Math.min(...boxes.map((b) => b.y)) : center.y - root.height / 2
  const others = figma.currentPage.children.filter((n) => n !== root && n.absoluteBoundingBox)
  for (let moved = true; moved; ) {
    moved = false
    for (const n of others) {
      const b = n.absoluteBoundingBox
      if (x < b.x + b.width && x + root.width > b.x && y < b.y + b.height && y + root.height > b.y) {
        x = b.x + b.width + gap
        moved = true
      }
    }
  }
  return { x: Math.round(x), y: Math.round(y) }
}

// One preview per collection: a rerun replaces the old frame in its place instead of adding another
async function buildPreview(name, palette, targets, vars) {
  await Promise.all([
    figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
    figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
  ])
  const old = figma.currentPage.children.find((n) => n.getPluginData('preview') === name)
  const root = stack('HORIZONTAL', { name: name + ' preview', gap: 32 })
  root.setPluginData('preview', name)
  for (const t of targets) root.appendChild(modeFrame(t, palette, vars[t.mode]))
  const spot = old ? { x: old.x, y: old.y } : freeSpot(root)
  if (old) old.remove()
  root.x = spot.x
  root.y = spot.y
  figma.currentPage.selection = [root]
  figma.viewport.scrollAndZoomIntoView([root])
}

async function generate(rgb, name, withPreview) {
  const palette = buildPalette(rgb)
  const targets = await ensureTargets(name)
  const result = await writeVariables(targets, palette)
  if (withPreview) await buildPreview(name, palette, targets, result.vars)
  const action = result.created ? 'Created' : 'Updated'
  const split = targets[0].col !== targets[1].col ? ' as two collections, since this plan allows one mode each' : ''
  return `${action} “${name}” with ${ROLES.length} colors in Light and Dark${split}.`
}

// ---- window

const STORAGE_KEY = 'settings'
const INVALID_COLOR = 'Enter a hex, rgb(), hsl() or oklch() color.'

function selectionHex() {
  for (const node of figma.currentPage.selection) {
    const fills = 'fills' in node && Array.isArray(node.fills) ? node.fills : []
    const solid = fills.find((p) => p.type === 'SOLID' && p.visible !== false)
    if (solid) return toHex(solid.color)
  }
  return null
}

async function paletteNames() {
  const names = (await figma.variables.getLocalVariableCollectionsAsync()).map((c) => c.getPluginData('name')).filter(Boolean)
  return Array.from(new Set(names))
}

async function handleMessage(msg) {
  const rgb = parseColor(msg.color)
  if (msg.type === 'preview') {
    if (!rgb) {
      figma.ui.postMessage({ type: 'palette', error: INVALID_COLOR })
      return
    }
    const palette = buildPalette(rgb)
    figma.ui.postMessage({ type: 'palette', palette, css: toCss(palette) })
    return
  }
  if (msg.type === 'create') {
    const name = String(msg.name || '').trim() || DEFAULT_NAME
    if (!rgb) figma.notify(INVALID_COLOR, { error: true })
    else {
      try {
        figma.notify(await generate(rgb, name, msg.preview))
        // The window stays open, so each run is committed as its own undo step
        figma.commitUndo()

        // Saved settings are a convenience, so a storage failure never reads as a failed run
        await figma.clientStorage.setAsync(STORAGE_KEY, { color: msg.color, name, preview: msg.preview }).catch(() => {})
      } catch (e) {
        figma.notify('Could not create the palette: ' + e.message, { error: true })
      }
    }

    // Always answers, so the window never stays on Working…
    figma.ui.postMessage({ type: 'created', names: await paletteNames() })
  }
}

async function start() {
  figma.showUI(__html__, { width: 320, height: 432, themeColors: true, title: 'Natural Color Palette' })

  // Without readable storage the window starts from defaults
  const saved = (await figma.clientStorage.getAsync(STORAGE_KEY).catch(() => null)) || {}
  figma.ui.onmessage = (msg) => handleMessage(msg).catch((e) => figma.notify(e.message, { error: true }))
  figma.on('selectionchange', () => figma.ui.postMessage({ type: 'selection', hex: selectionHex() }))
  figma.ui.postMessage({
    type: 'init',
    roles: ROLES.map((r) => r.name),
    modes: MODES,
    minContrast: MIN_CONTRAST,
    defaultName: DEFAULT_NAME,
    names: await paletteNames(),
    selection: selectionHex(),
    saved,
  })
}

if (typeof figma === 'object') start()

if (typeof module === 'object') module.exports = { parseColor, buildPalette, contrast, toHex, toCss }
