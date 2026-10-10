# Natural Color Palette

A Figma plugin that turns one color into UI color variables for Light and Dark mode, plus a preview frame bound to them. Its window uses Figma's own theme tokens, so it follows the editor's light or dark theme.

Source and issues: [github.com/marco-vrinssen/natural-color-palette](https://github.com/marco-vrinssen/natural-color-palette).

## Use

1. In Figma desktop, open Plugins, Development, Import plugin from manifest, and pick `manifest.json`.
2. Run Natural Color Palette. The window starts with the selected layer's fill, or the last color you used.
3. Pick a color, paste a hex, `rgb()`, `hsl()` or `oklch()` value, or click Use selection. The mockups and the contrast verdict update live; hover the verdict for the ratios.
4. Press Enter or click Create variables. A rerun on the same collection updates it, and every design bound to it recolors.

There is nothing to tune. The steps follow Apple and Material surface steps, and text and accent adjust their lightness until they pass WCAG.

- Canvas preview: one frame per collection, placed right of the selection where nothing overlaps, and replaced in place on reruns.
- Copy CSS: both modes as custom properties with `light-dark()`. Each variable also carries its CSS name as code syntax, so Dev Mode shows `var(--surface-0)`.
- Undo: each run is one undo step.

## What it creates

A collection with the modes Light and Dark and nine variables.

| Variable | Use |
| --- | --- |
| `surface/0` | Background |
| `surface/1` | Card |
| `surface/2` | Element inside a card |
| `surface/3` | Chip or control |
| `border` | Hairlines and dividers |
| `text/primary` | Primary text and icons |
| `text/muted` | Secondary text |
| `accent` | Buttons, links and selection |
| `on-accent` | Text and icons on accent |

On plans limited to one mode per collection, Light and Dark get a collection each.

## Rules

Everything keeps the input's hue.

- Dark mode: the screen is the light source, so every level forward gets lighter.
- Light mode: white is the ceiling, so the card takes white and every level nested inside it is one step darker, like a recessed fill. Elevation above the card comes from shadows.

| | Dark | Light |
| --- | --- | --- |
| Background, level 0 | L 0.18 | L 0.97 |
| Card, level 1 | L 0.22 | L 1.00, white |
| Inner, level 2 | L 0.27 | L 0.96 |
| Chip, level 3 | L 0.33 | L 0.92 |
| Step | L and C × 1.22 forward | L minus 0.04 inward |
| Surface chroma | Input chroma, capped at 0.035 | 20% of that per step, zero at white |
| Border | L 0.40 | L 0.88 |
| Text, muted | L 0.96, L 0.74 | L 0.22, L 0.50 |
| Accent | L 0.78, input chroma | L 0.55, input chroma |

Text reaches at least 7:1 and muted text 4.5:1 on every surface. The accent moves in lightness until text on it passes 4.5:1. Colors outside sRGB give up chroma, never lightness or hue. Every color is stored at its 8-bit hex value, so the ratios hold for the hex you copy.

The preview uses concentric corners: each radius is its parent's radius minus the padding between them, so chip 8, inner 16, card 28 and frame 52.

## Logo

- `logo.svg`: the mark with rounded corners.
- `icon.png`: a 128 px full-bleed square for the Figma Community listing.

Three neutral plates follow the plugin's own dark rule: the background sits at L 0.18, each plate is three ×1.22 steps lighter (L 0.33 and 0.59), and the top plate is white.

## Test

```sh
node test.js
```

It checks color parsing and math, reproduces the Midnight demo values, and asserts contrast and visible level steps for 33 inputs plus a 216-color grid in both modes.

## License

MIT, see [LICENSE](LICENSE).
