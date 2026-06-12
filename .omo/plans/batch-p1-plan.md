# P1 Implementation Plan: Workflow Steps + Enhanced Data Grid

## Files Modified
- `batch.html` — step indicators, section wrapping, search bar, checkbox column
- `css/style.css` — step indicator styles, search bar, checkbox
- `js/batch-page.js` — step navigation, search/filter, select-all, bulk delete

---

## Feature 1: Stepped Workflow (Import → Review → Export)

### 1a: Step Indicator Bar (batch.html)
Insert after `<header>` and before the first `<section class="edit-section">`:

```html
<div class="batch-steps">
    <div class="batch-step is-active" data-step="1">
        <span class="batch-step-number">1</span>
        <span class="batch-step-label">匯入資料</span>
    </div>
    <div class="batch-step-connector"></div>
    <div class="batch-step" data-step="2">
        <span class="batch-step-number">2</span>
        <span class="batch-step-label">檢視與編輯</span>
    </div>
    <div class="batch-step-connector"></div>
    <div class="batch-step" data-step="3">
        <span class="batch-step-number">3</span>
        <span class="batch-step-label">批量輸出</span>
    </div>
</div>
```

### 1b: Wrap sections in step divs (batch.html)
- Step 1: `<div class="batch-step-content" data-step="1">` wraps the Data Source section + status box
- Step 2: `<div class="batch-step-content" data-step="2">` wraps Data Table + Canvas Preview sections
- Step 3: `<div class="batch-step-content" data-step="3">` wraps the Export section

Add navigation buttons inside each step-content div:
- Step 1: footer with `<button class="btn btn-primary" data-action="next-step">下一步</button>`
- Step 2: footer with `<button class="btn btn-secondary" data-action="prev-step">上一步</button>` + `<button class="btn btn-primary" data-action="next-step">下一步</button>`
- Step 3: footer with `<button class="btn btn-secondary" data-action="prev-step">上一步</button>`

### 1c: Step navigation CSS (style.css)
```css
.batch-steps { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 24px; padding: 16px 0; }
.batch-step { display: flex; align-items: center; gap: 10px; padding: 8px 20px; border-radius: 999px; background: var(--bg-secondary); border: 2px solid var(--border-light); opacity: 0.5; transition: all 0.3s ease; }
.batch-step.is-active { opacity: 1; border-color: var(--primary-color); background: rgba(37, 99, 235, 0.08); }
.batch-step.is-completed { opacity: 0.8; border-color: var(--success-color); }
.batch-step-number { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; background: var(--border-light); color: var(--secondary-color); }
.batch-step.is-active .batch-step-number { background: var(--primary-color); color: white; }
.batch-step.is-completed .batch-step-number { background: var(--success-color); color: white; }
.batch-step-label { font-weight: 600; font-size: 14px; white-space: nowrap; }
.batch-step-connector { width: 60px; height: 2px; background: var(--border-light); }
.batch-step-content[data-step]:not(.is-active) { display: none; }
.batch-step-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light); }
```

### 1d: Step navigation JS (batch-page.js)
```javascript
function goToStep(step) {
    document.querySelectorAll('.batch-step').forEach(el => el.classList.remove('is-active', 'is-completed'));
    document.querySelectorAll('.batch-step-content').forEach(el => el.classList.remove('is-active'));
    
    // Mark all previous steps as completed
    for (let i = 1; i < step; i++) {
        document.querySelector(`.batch-step[data-step="${i}"]`).classList.add('is-completed');
    }
    
    document.querySelector(`.batch-step[data-step="${step}"]`).classList.add('is-active');
    document.querySelector(`.batch-step-content[data-step="${step}"]`).classList.add('is-active');
}
```

Add navigation button event listeners in attachEventListeners():
```javascript
document.querySelectorAll('[data-action="next-step"]').forEach(btn => {
    btn.addEventListener('click', () => {
        const content = btn.closest('.batch-step-content');
        const currentStep = parseInt(content.dataset.step, 10);
        goToStep(currentStep + 1);
    });
});
document.querySelectorAll('[data-action="prev-step"]').forEach(btn => {
    btn.addEventListener('click', () => {
        const content = btn.closest('.batch-step-content');
        const currentStep = parseInt(content.dataset.step, 10);
        goToStep(currentStep - 1);
    });
});
```

Initialize step 1 as active in init function (after DOM ready):
```javascript
goToStep(1);
```

---

## Feature 2: Enhanced Data Grid

### 2a: Search/Filter Bar (batch.html)
Insert inside Step 2 content, BEFORE the `.batch-preview-wrapper`:

```html
<div class="batch-table-toolbar">
    <input type="text" id="batchSearchInput" class="batch-search-input" placeholder="搜尋所有欄位...">
    <span class="batch-search-count" id="batchSearchCount"></span>
</div>
```

### 2b: Search/Filter CSS (style.css)
```css
.batch-table-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.batch-search-input { flex: 1; padding: 8px 12px; border: 1px solid var(--border-light); border-radius: 6px; font-size: 14px; background: var(--bg-primary); color: var(--text-color); }
.batch-search-input:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.batch-search-count { font-size: 13px; color: var(--secondary-color); white-space: nowrap; }
```

### 2c: Search/Filter JS (batch-page.js)
Add to batchState: `searchQuery: ''`

In attachEventListeners():
```javascript
document.getElementById('batchSearchInput').addEventListener('input', (e) => {
    batchState.searchQuery = e.target.value.trim().toLowerCase();
    renderTable();
});
```

Modify renderTable() to filter rows:
```javascript
// After getting rows, filter by search
let displayRows = batchState.rows;
if (batchState.searchQuery) {
    displayRows = batchState.rows.filter(row => {
        return batchState.schema.all.some(column => {
            const val = String(row[column.key] || '').toLowerCase();
            return val.includes(batchState.searchQuery);
        });
    });
}
// Then render displayRows instead of batchState.rows
```

Update the empty state message to differentiate "no data" vs "no results":
```javascript
if (!displayRows.length) {
    const msg = batchState.searchQuery ? '無符合搜尋條件的資料列' : '尚無資料，請上傳檔案或新增一列';
    body.innerHTML = `<tr><td colspan="..." class="batch-empty-state">${msg}</td></tr>`;
}
```

Update search count:
```javascript
const countNode = document.getElementById('batchSearchCount');
if (countNode) {
    countNode.textContent = batchState.searchQuery 
        ? `篩選 ${displayRows.length} / ${batchState.rows.length} 列`
        : `共 ${batchState.rows.length} 列`;
}
```

### 2d: Bulk Selection with Checkboxes (batch.html + batch-page.js)

**HTML**: Add checkbox column to table head and body.

In renderTable() head:
```html
<th class="batch-check-col"><input type="checkbox" id="batchSelectAll" title="全選"></th>
```

In renderTable() body, for each row:
```html
<td class="batch-check-col"><input type="checkbox" class="batch-row-checkbox" data-row-index="${rowIndex}"></td>
```

Update colspan values whenever they're used.

**CSS**:
```css
.batch-check-col { width: 40px; text-align: center; vertical-align: middle; }
.batch-check-col input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
```

**JS**: In attachEventListeners():
```javascript
// Select all
document.getElementById('batchSelectAll').addEventListener('change', (e) => {
    const checked = e.target.checked;
    document.querySelectorAll('.batch-row-checkbox').forEach(cb => cb.checked = checked);
});

// Individual checkbox sync with select-all
document.getElementById('batchPreviewBody').addEventListener('change', (e) => {
    if (e.target.classList.contains('batch-row-checkbox')) {
        const allCbs = document.querySelectorAll('.batch-row-checkbox');
        const allChecked = document.querySelectorAll('.batch-row-checkbox:checked');
        document.getElementById('batchSelectAll').checked = allCbs.length === allChecked.length;
    }
});
```

Add bulk action buttons in table toolbar area:
```html
<button id="batchDeleteSelectedBtn" class="btn btn-secondary" type="button">刪除選取列</button>
```

**JS for bulk delete**:
```javascript
document.getElementById('batchDeleteSelectedBtn').addEventListener('click', () => {
    const checked = document.querySelectorAll('.batch-row-checkbox:checked');
    if (!checked.length) {
        setStatus('請先選取要刪除的資料列');
        return;
    }
    // Delete from highest index to lowest to avoid index shifting
    const indices = Array.from(checked).map(cb => parseInt(cb.dataset.rowIndex, 10)).sort((a, b) => b - a);
    for (const idx of indices) {
        batchState.rows.splice(idx, 1);
    }
    renderTable();
    setStatus(`已刪除 ${indices.length} 列`);
});
```

---

## Execution Order (Sequential — Wave 3 then Wave 4)

Wave 3: batch.html + style.css (step indicators, search bar, checkbox HTML/CSS)
Wave 4: batch-page.js (step navigation, search/filter logic, bulk selection handlers)

## Skills to Load
- `frontend-ui-ux` — visual design for workflow steps

## Category
- `visual-engineering` — frontend/UI work

## Manual QA Plan
1. Load batch.html → step 1 "匯入資料" is active, only data source section visible
2. Click "下一步" → step 2 "檢視與編輯" active, table + preview visible
3. Type in search bar → table filters in real-time, count updates
4. Check select all → all rows checked
5. Check individual rows → select all syncs
6. Click "刪除選取列" → selected rows removed
7. Click "下一步" → step 3 "批量輸出" active, export button visible
8. Click "上一步" → returns to step 2
9. Run export → overlay works (P0 feature)
