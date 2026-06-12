# P2 Implementation Plan: Visual Mapping Guide + Preview Gallery Strip

## Files Modified
- `batch.html` — modal HTML + gallery strip HTML
- `css/style.css` — modal styles + gallery strip styles
- `js/batch-page.js` — modal toggle logic, gallery rendering, schema mapping data

---

## Feature 1: Visual Mapping Guide

### 1a: Trigger button (batch.html)
Add a help button next to the "資料來源" h2 in Step 1:
```html
<h2>
    資料來源
    <button type="button" class="batch-help-btn" id="batchMappingGuideBtn" title="欄位對應說明">?</button>
</h2>
```

### 1b: Modal HTML (batch.html)
Add before the `</div>` of `.container.batch-page`:
```html
<div id="batchMappingGuide" class="batch-mapping-overlay" style="display:none;">
    <div class="batch-mapping-panel">
        <div class="batch-mapping-header">
            <h3>欄位對應說明</h3>
            <button type="button" class="batch-mapping-close" id="batchMappingCloseBtn">&times;</button>
        </div>
        <div class="batch-mapping-body">
            <p>上傳的 CSV / XLSX 檔案標題列需使用以下欄位 key，系統會自動對應到版型中的物件：</p>
            <div id="batchMappingContent"></div>
            <div class="batch-mapping-note">
                <strong>💡 提示：</strong>deviceTarget 為特殊欄位，填入桌牌名稱或 IP 後，輸出 ZIP 會自動依桌牌分資料夾；若已設定桌牌清單，可輸入名稱或 IP 進行推播。
            </div>
        </div>
    </div>
</div>
```

### 1c: CSS (style.css)
```css
.batch-help-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--secondary-color);
    background: transparent;
    color: var(--secondary-color);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-left: 8px;
    vertical-align: middle;
    line-height: 1;
    transition: all 0.2s ease;
}
.batch-help-btn:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: rgba(37, 99, 235, 0.08);
}
.batch-mapping-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}
.batch-mapping-panel {
    background: var(--bg-primary);
    border-radius: 12px;
    width: 560px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
}
.batch-mapping-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-light);
}
.batch-mapping-header h3 {
    margin: 0;
    font-size: 18px;
}
.batch-mapping-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--secondary-color);
    padding: 0 4px;
    line-height: 1;
}
.batch-mapping-close:hover {
    color: var(--text-color);
}
.batch-mapping-body {
    padding: 20px;
    overflow-y: auto;
}
.batch-mapping-body > p {
    margin-top: 0;
    font-size: 14px;
    color: var(--secondary-color);
}
.batch-mapping-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 16px;
}
.batch-mapping-table th,
.batch-mapping-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-light);
    text-align: left;
}
.batch-mapping-table th {
    background: var(--bg-secondary);
    font-weight: 600;
}
.batch-mapping-table .mapping-required {
    color: #dc2626;
    font-weight: 600;
}
.batch-mapping-table .mapping-optional {
    color: #2563eb;
    font-weight: 600;
}
.batch-mapping-table .mapping-device {
    color: #7c3aed;
    font-weight: 600;
}
.batch-mapping-table .mapping-object-id {
    font-family: monospace;
    font-size: 12px;
    color: var(--secondary-color);
}
.batch-mapping-note {
    padding: 12px;
    border-radius: 6px;
    background: rgba(37, 99, 235, 0.08);
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-color);
}
```

### 1d: JS — renderSchemaSummary replacement / enhancement
Currently `renderSchemaSummary()` just shows chips. Replace it with dynamic content also stored for the mapping modal.

Modify `renderSchemaSummary()` to also generate and store mapping data:
```javascript
function renderSchemaSummary() {
    const container = document.getElementById('batchSchemaSummary');
    if (!container) return;
    
    if (!batchState.schema) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    if (batchState.schema.required.length) {
        html += '<div class="batch-schema-row">';
        batchState.schema.required.forEach(col => {
            html += `<span class="batch-schema-chip required">${escapeHtml(col.label)} (${escapeHtml(col.key)})</span>`;
        });
        html += '</div>';
    }
    if (batchState.schema.optional.length) {
        html += '<div class="batch-schema-row">';
        batchState.schema.optional.forEach(col => {
            const cls = col.key === 'deviceTarget' ? 'optional device' : 'optional';
            html += `<span class="batch-schema-chip ${cls}">${escapeHtml(col.label)} (${escapeHtml(col.key)})</span>`;
        });
        html += '</div>';
    }
    container.innerHTML = html;
}
```

Add new function to render mapping modal content:
```javascript
function renderMappingContent() {
    const container = document.getElementById('batchMappingContent');
    if (!container || !batchState.schema) return;
    
    const getTypeLabel = (column) => {
        if (column.key === 'deviceTarget') return '<span class="mapping-device">桌牌</span>';
        if (column.type === 'url') return '<span class="mapping-optional">連結</span>';
        return '<span class="mapping-required">文字</span>';
    };
    
    const getRequiredLabel = (column) => {
        if (column.key === 'deviceTarget') return '<span class="mapping-device">選擇性</span>';
        return batchState.schema.required.includes(column)
            ? '<span class="mapping-required">必填</span>'
            : '<span class="mapping-optional">選填</span>';
    };
    
    let html = `<table class="batch-mapping-table">
        <thead><tr><th>欄位 Key</th><th>顯示名稱</th><th>類型</th><th>對應物件</th><th>必填</th></tr></thead><tbody>`;
    
    batchState.schema.all.forEach(col => {
        const objId = col.objectId || '-';
        const objLabel = col.objectLabel || col.label;
        html += `<tr>
            <td><code>${escapeHtml(col.key)}</code></td>
            <td>${escapeHtml(col.label)}</td>
            <td>${getTypeLabel(col)}</td>
            <td><span class="mapping-object-id">${escapeHtml(objLabel)}</span></td>
            <td>${getRequiredLabel(col)}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}
```

Call `renderMappingContent()` after `renderSchemaSummary()`.

Modal event listeners:
```javascript
document.getElementById('batchMappingGuideBtn').addEventListener('click', () => {
    document.getElementById('batchMappingGuide').style.display = 'flex';
    renderMappingContent();
});
document.getElementById('batchMappingCloseBtn').addEventListener('click', () => {
    document.getElementById('batchMappingGuide').style.display = 'none';
});
document.getElementById('batchMappingGuide').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
    }
});
```

### 1e: Add batchSchemaSummary container to batch.html Step 1
After the datalist and before the toolbar:
```html
<div id="batchSchemaSummary" class="batch-schema-list"></div>
```

---

## Feature 2: Preview Gallery Strip

### 2a: Gallery HTML (batch.html)
Add inside Step 2, AFTER the canvas preview section:
```html
<section class="edit-section">
    <h2>批次縮圖預覽</h2>
    <div class="batch-gallery-strip" id="batchGalleryStrip">
        <div class="batch-gallery-empty">尚無資料，請先匯入資料</div>
    </div>
</section>
```

### 2b: CSS (style.css)
```css
.batch-gallery-strip {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 8px 4px;
    min-height: 100px;
    scroll-behavior: smooth;
}
.batch-gallery-strip::-webkit-scrollbar {
    height: 6px;
}
.batch-gallery-strip::-webkit-scrollbar-track {
    background: var(--bg-primary);
    border-radius: 3px;
}
.batch-gallery-strip::-webkit-scrollbar-thumb {
    background: var(--border-light);
    border-radius: 3px;
}
.batch-gallery-item {
    flex: 0 0 auto;
    width: 160px;
    border: 2px solid var(--border-light);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--bg-secondary);
}
.batch-gallery-item:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}
.batch-gallery-item.is-active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}
.batch-gallery-item canvas,
.batch-gallery-item img {
    width: 100%;
    height: 96px;
    object-fit: cover;
    display: block;
}
.batch-gallery-item-label {
    padding: 4px 8px;
    font-size: 11px;
    color: var(--secondary-color);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.batch-gallery-empty {
    width: 100%;
    text-align: center;
    padding: 32px 0;
    color: var(--secondary-color);
    font-size: 14px;
}
```

### 2c: JS — Gallery rendering
Add function:
```javascript
function renderGalleryStrip() {
    const strip = document.getElementById('batchGalleryStrip');
    if (!strip) return;
    
    if (!batchState.rows.length) {
        strip.innerHTML = '<div class="batch-gallery-empty">尚無資料，請先匯入資料</div>';
        return;
    }
    
    const limit = Math.min(batchState.rows.length, 10);
    let html = '';
    
    for (let i = 0; i < limit; i++) {
        const row = batchState.rows[i];
        const name = String(row.name || row.company || row.position || `第 ${i + 1} 列`).trim();
        html += `
            <div class="batch-gallery-item" data-row-index="${i}" title="${escapeHtml(name)}">
                <canvas width="160" height="96" class="batch-gallery-canvas"></canvas>
                <div class="batch-gallery-item-label">${escapeHtml(name)}</div>
            </div>
        `;
    }
    
    strip.innerHTML = html;
    
    // Attach click listeners
    strip.querySelectorAll('.batch-gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.rowIndex, 10);
            strip.querySelectorAll('.batch-gallery-item').forEach(el => el.classList.remove('is-active'));
            item.classList.add('is-active');
            applyRowPreview(batchState.rows[idx]);
        });
    });
    
    // Render thumbnails asynchronously
    requestAnimationFrame(() => renderGalleryThumbnails());
}

async function renderGalleryThumbnails() {
    const items = document.querySelectorAll('.batch-gallery-item');
    const originalState = window.nameplateState;
    
    for (const item of items) {
        const idx = parseInt(item.dataset.rowIndex, 10);
        const row = batchState.rows[idx];
        if (!row) continue;
        
        const canvas = item.querySelector('.batch-gallery-canvas');
        if (!canvas) continue;
        
        try {
            const nextState = cloneJson(batchState.template.state);
            batchState.schema.required.forEach((column) => {
                applyTextColumnToState(nextState, column, row);
            });
            const defaultQrDataUrl = await applyQrColumnsToState(nextState, row);
            
            const miniRenderer = new NameplateRenderer(canvas);
            miniRenderer.setBackgroundOpacity(batchState.template.opacity || 100);
            if (batchState.template.bgImageDataUrl) {
                miniRenderer.setBackgroundImageDataUrl(batchState.template.bgImageDataUrl);
            }
            await miniRenderer.setQrCodeDataUrl(defaultQrDataUrl || '');
            miniRenderer.render(nextState);
        } catch (e) {
            // Silently skip failed thumbnails
        }
    }
    
    // Restore original state on the main canvas
    window.nameplateState = originalState;
    batchState.renderer.render(originalState);
}
```

Call `renderGalleryStrip()` in `renderTable()` (at the end, after updateSummary()).

Also call it when rows change (addEmptyRow, delete row, spreadsheet upload).

---

## Execution Order
Wave 5: batch.html + style.css (mapping guide modal + gallery strip)
Wave 6: batch-page.js (schema rendering, mapping modal logic, gallery rendering)

## Skills
- `frontend-ui-ux`

## Category
- `visual-engineering`
