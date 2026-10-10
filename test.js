// Checks the color math and the contrast promises without Figma: node test.js
const assert = require('node:assert')
const { parseColor, buildPalette, contrast, toHex, toCss } = require('./code.js')

assert.strictEqual(toHex(parseColor('3b82f6')), '#3B82F6')
assert.strictEqual(toHex(parseColor('#fff')), '#FFFFFF')
assert.strictEqual(parseColor('blue'), null)
assert.strictEqual(parseColor('oklch(2 0.1 200)'), null)
assert.strictEqual(toHex(parseColor('rgb(59 130 246)')), '#3B82F6')
assert.strictEqual(toHex(parseColor('rgba(59, 130, 246, 0.5)')), '#3B82F6')
assert.strictEqual(toHex(parseColor('hsl(0 100% 50%)')), '#FF0000')
assert.strictEqual(toHex(parseColor('hsl(217.2, 91.2%, 59.8%)')), '#3B82F6')
assert.strictEqual(parseColor('rgb(1 2)'), null)
assert.strictEqual(toHex(parseColor('#3b82f680')), '#3B82F6')
assert.strictEqual(toHex(parseColor('#38f8')), '#3388FF')
assert.strictEqual(parseColor('#3b82f'), null)
assert.strictEqual(toHex(parseColor('oklch(60% 37.5% 255)')), toHex(parseColor('oklch(0.6 0.15 255)')))
assert.strictEqual(toHex(parseColor('oklch(0.6 0.15 0.5turn)')), toHex(parseColor('oklch(0.6 0.15 180)')))
assert.strictEqual(toHex(parseColor('hsl(0.5turn 100% 50%)')), '#00FFFF')

// Colors are stored at their hex value, so the contrast promise holds for what users copy; this accent measured 4.49:1 before
const green = buildPalette(parseColor('rgb(51 170 34)')).modes.Light
for (const c of Object.values(green)) assert.deepStrictEqual(parseColor(c.hex), c.rgb)
assert.ok(contrast(parseColor(green.accent.hex), parseColor(green['on-accent'].hex)) >= 4.5)

// The CSS export carries every role with both modes
const css = toCss(buildPalette(parseColor('#3B82F6')))
assert.strictEqual((css.match(/light-dark\(oklch\([^)]*\), oklch\([^)]*\)\)/g) || []).length, 9)
assert.ok(css.includes('--surface-0: light-dark(oklch(0.970 ') && css.includes('--on-accent:'))

// The Midnight demo built in the Cortex file on 2026-10-10
const midnight = buildPalette(parseColor('oklch(0.6 0.15 255)')).modes.Dark
assert.deepStrictEqual(
  [0, 1, 2, 3].map((n) => midnight['surface/' + n].hex),
  ['#071221', '#0C1B2E', '#13273F', '#1D3554'],
)

// Every hue, the sRGB primaries and a gray keep text readable on every surface in both modes
const inputs = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#808080', '#000000', '#FFFFFF']
for (let h = 0; h < 360; h += 15) inputs.push(`oklch(0.6 0.15 ${h})`)

for (const input of inputs) {
  const palette = buildPalette(parseColor(input))
  for (const [mode, c] of Object.entries(palette.modes)) {
    const where = `${input} ${mode}`
    for (let n = 0; n <= 3; n++) {
      const surface = c['surface/' + n].rgb
      assert.ok(contrast(c['text/primary'].rgb, surface) >= 7, `${where}: text on surface/${n}`)
      assert.ok(contrast(c['text/muted'].rgb, surface) >= 4.5, `${where}: muted on surface/${n}`)
    }
    assert.ok(contrast(c['on-accent'].rgb, c.accent.rgb) >= 4.5, `${where}: on-accent on accent`)
    assert.ok(contrast(c.accent.rgb, c['surface/0'].rgb) >= 3, `${where}: accent on background`)
  }
}

// Every color on a 216-color grid keeps contrast and visible level steps, so no input needs manual tuning
for (let r = 0; r <= 255; r += 51) {
  for (let g = 0; g <= 255; g += 51) {
    for (let b = 0; b <= 255; b += 51) {
      const checks = buildPalette({ r: r / 255, g: g / 255, b: b / 255 }).checks
      for (const mode of ['Light', 'Dark']) {
        const c = checks[mode]
        const where = `rgb(${r} ${g} ${b}) ${mode}`
        assert.ok(c.text >= 7 && c.muted >= 4.5 && c.accent >= 4.5, `${where}: contrast`)
        assert.ok(c.step >= 0.03, `${where}: level steps`)
      }
    }
  }
}

console.log(`ok: ${inputs.length} inputs and a 216-color grid, Light and Dark`)
