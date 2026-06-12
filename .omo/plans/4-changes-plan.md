# Plan: 4 UI/UX Changes to Nameplate Editor

## Summary
Four independent changes to the nameplate web editor. Tasks 1-3 are implementation, Task 4 is planning-only.

---

## Task 1: Add Pure White (#FFFFFF) to Color Palettes

**Goal:** Add pure white to `COLOR_PALETTE_BASES` so it appears in both background and text color palettes.

**Files:**
- `js/app.js`

**Changes:**
1. Add `{ name: '純白', h: 0, s: 0, l: 100 }` to the end of `COLOR_PALETTE_BASES` array (after line 90)
2. No other changes needed — `generateCirclePaletteHTML()` already iterates this array for both palettes

**Verification:**
- First palette row shows white circle (#FFFFFF) as the last color in the row
- Second palette row shows very light gray (#EBEBEB) as the last color
- Both background settings (initRecommendedOptions) and object text settings (renderObjectRecommendedOptions) show the new colors

---

## Task 2: Hide Opacity Slider When No Image

**Goal:** The background image opacity slider (`#bgOpacity`) should only be visible when a background image is uploaded.

**Files:**
- `index.html`
- `js/app.js`

**Changes:**

### index.html:
- Add `id="bgOpacityGroup"` to the `<div class="form-group">` wrapping the opacity slider (line 125)
- Add `style="display: none;"` initially (since there's no image by default)

### js/app.js:
- In `applyBackgroundImageFile()` (inside `reader.onload`, around line 3605): add `document.getElementById('bgOpacityGroup').style.display = 'block';`
- In `handleClearImage()` (line 3632): add `document.getElementById('bgOpacityGroup').style.display = 'none';`
- In `loadPreferredSettings()`:
  - Inside the `if (bgImageDataUrl)` block (line 5391): add show call
  - Inside the `else` block (line 5398): add hide call

**Verification:**
- When page loads with no saved image → opacity slider hidden
- When image is uploaded → opacity slider appears
- When image is cleared → opacity slider hides again
- When page loads with a saved image → opacity slider visible

---

## Task 3: Beautify "新增物件" Button

**Goal:** Remove the duplicate `<h3>` heading and change button from green to blue.

**Files:**
- `index.html`

**Changes:**
1. Remove line 524: `<h3>新增物件</h3>`
2. Change `btn-success` to `btn-primary` on the button (line 525)

**CSS note:** `.btn-primary` already exists in Bootstrap (blue). The `.add-object-btn` custom CSS remains unchanged — only the modifier class changes.

**Verification:**
- The "新增物件" section has no redundant heading
- The button is blue (primary) instead of green (success)
- Button still full-width and bold per `.add-object-btn` styles

---

## Task 4: Plan Batch Production Page UI/UX Optimization (NO IMPLEMENTATION)

**Goal:** Analyze the batch production page and produce a written plan for UI/UX optimization.

**Scope:** Research only — produce a written plan document. No code changes.

**Plan document should cover:**
1. Current batch page structure and layout audit
2. Identified pain points (workflow gaps, confusing UI elements, visual inconsistencies)
3. Proposed improvements (with before/after comparison)
4. Prioritization (P0, P1, P2)
5. Implementation recommendations (files affected, approach)

**Input sources:**
- `batch.html`
- `js/batch-page.js`
- `css/style.css` (batch-related sections)

---

## Execution Order

Since all tasks are INDEPENDENT, they can be done in parallel:

```
Parallel Batch:
  [Task 1] ─── js/app.js ─── add COLOR_PALETTE_BASES entry
  [Task 2] ─── index.html + js/app.js ─── opacity visibility
  [Task 3] ─── index.html ─── button cleanup
  [Task 4] ─── batch.html + batch-page.js + style.css ─── plan only
```

**Delegation:** Tasks 1-3 are simple enough for `quick` category agents. Task 4 needs `explore` + `writing`.

**Verification after all tasks:**
- `lsp_diagnostics` clean on modified files
- Visual check via browser for Tasks 1-3
