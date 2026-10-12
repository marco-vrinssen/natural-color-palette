# Natural Color Palette

## Rules

- No build step. Figma loads `code.js` and `ui.html` directly.
- The plugin makes no network requests, and `networkAccess` in `manifest.json` stays `none`.
- The window uses native HTML controls styled only with Figma's `themeColors` tokens, so it follows the editor's light or dark theme.
- There is nothing to tune. The window offers only the color, the collection name, the canvas preview toggle and Create. Rules are fixed and contrast is automatic.
- The color rules under "Rules" in `README.md` are the spec. Change the README and `code.js` together.
- Text reaches at least 7:1 and muted text 4.5:1 on every surface. The accent moves in lightness until text on it passes 4.5:1. Colors outside sRGB give up chroma, never lightness or hue. Contrast is checked on the 8-bit hex that gets stored.
- Each run is one undo step. A rerun on the same collection updates its variables and its single preview frame in place.
- Preview corners are concentric: each radius is its parent's radius minus the padding between them.

## Checks

- `node test.js` after any change to the color math. It runs without Figma.
- The rest runs only in Figma desktop: import `manifest.json` under Plugins, Development.
