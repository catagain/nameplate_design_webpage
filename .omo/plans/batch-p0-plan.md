# P0 Implementation Plan: Export Orchestrator + Post-Export Audit

## Scope
Two independent but cooperating features for the batch production page.

- **Feature A**: Visual Export Orchestrator — progress bar, real-time log, cancel button
- **Feature B**: Post-Export Audit — row-level success/failure indicators in table

## Files Modified
- `batch.html` — new HTML for progress overlay + log panel
- `css/style.css` — new CSS for progress overlay
- `js/batch-page.js` — core logic changes

---

## Feature A: Visual Export Orchestrator

### A1: Progress Overlay HTML (batch.html)
Add a modal overlay after the existing `<div class="container batch-page">` but before `</div>` closing:
```html
<div id="batchExportOverlay" class="batch-export-overlay" style="display:none;">
    <div class="batch-export-panel">
        <h3>批量輸出中...</h3>
        <div class="batch-export-progress-bar">
            <div id="batchExportProgressFill" class="batch-export-progress-fill"></div>
        </div>
        <div class="batch-export-progress-text">
            <span id="batchExportProgressLabel">0 / 0</span>
        </div>
        <div class="batch-export-log" id="batchExportLog">
            <!-- Log entries appended here -->
        </div>
        <button id="batchExportCancelBtn" class="btn btn-secondary" type="button">取消輸出</button>
    </div>
</div>
```

### A2: Progress Overlay CSS (style.css)
```css
.batch-export-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}
.batch-export-panel {
    background: var(--bg-primary);
    border-radius: 12px;
    padding: 24px;
    min-width: 420px;
    max-width: 520px;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
}
.batch-export-panel h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
}
.batch-export-progress-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-secondary);
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 8px;
}
.batch-export-progress-fill {
    height: 100%;
    width: 0%;
    background: var(--primary-color);
    border-radius: 999px;
    transition: width 0.3s ease;
}
.batch-export-progress-text {
    text-align: center;
    font-size: 14px;
    color: var(--secondary-color);
    margin-bottom: 12px;
}
.batch-export-log {
    flex: 1;
    overflow-y: auto;
    max-height: 240px;
    background: var(--bg-secondary);
    border-radius: 6px;
    padding: 8px;
    font-size: 12px;
    font-family: monospace;
    line-height: 1.6;
    margin-bottom: 12px;
}
.batch-export-log .log-entry {
    padding: 2px 4px;
    border-radius: 2px;
}
.batch-export-log .log-entry.log-success { color: #047857; }
.batch-export-log .log-entry.log-error { color: #b91c1c; }
.batch-export-log .log-entry.log-info { color: var(--secondary-color); }
```

### A3: JS Changes (batch-page.js)

#### A3a: Add batchState.exportCancel flag
Add to batchState (near line 14):
```javascript
exportCancel: false,
```

#### A3b: Show/hide overlay functions
```javascript
function showExportOverlay(totalRows) {
    document.getElementById('batchExportOverlay').style.display = 'flex';
    document.getElementById('batchExportProgressFill').style.width = '0%';
    document.getElementById('batchExportProgressLabel').textContent = `0 / ${totalRows}`;
    document.getElementById('batchExportLog').innerHTML = '';
    batchState.exportCancel = false;
}

function hideExportOverlay() {
    document.getElementById('batchExportOverlay').style.display = 'none';
}

function appendExportLog(message, type = 'info') {
    const log = document.getElementById('batchExportLog');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}
```

#### A3c: Cancel button handler
Add event listener (near attachEventListeners):
```javascript
document.getElementById('batchExportCancelBtn').addEventListener('click', () => {
    batchState.exportCancel = true;
    appendExportLog('正在取消輸出... (等待目前列處理完成)', 'info');
});
```

#### A3d: Modify handleBatchExport()
Replace the current flow:

Before loop:
- Call `showExportOverlay(validRows.length)`
- Replace `setStatus('開始輸出...')` with `appendExportLog('開始批量輸出...', 'info')`

Inside loop (at start):
- Add cancel check: `if (batchState.exportCancel) { appendExportLog('使用者取消輸出', 'info'); break; }`
- Replace `setStatus('輸出中... (i/n)')` with:
  - Update progress bar: `document.getElementById('batchExportProgressFill').style.width = \`${((index + 1) / validRows.length * 100).toFixed(1)}%\`;`
  - Update label: `document.getElementById('batchExportProgressLabel').textContent = \`${index + 1} / ${validRows.length}\`;`

After each row (after pushRowToPhilipsDevice call):
- Log success/failure: `appendExportLog(\`第 ${index + 1} 列 (${preferredName}): ${success ? '已輸出' : '桌牌更新失敗'}\`, success ? 'success' : 'error');`
- Also store result on the row object for audit feature

After loop (success completion):
- `hideExportOverlay()`
- `setStatus()` with the final summary (keep setStatus for the status box below the table)

After error:
- `hideExportOverlay()`
- Keep error setStatus

---

## Feature B: Post-Export Audit System

### B1: Store per-row results during export
In handleBatchExport, after each row processing:
```javascript
row._exportResult = syncResult.skipped ? 'skipped' : 'success';
row._exportError = syncError ? syncError.message : null;
```
And in catch:
```javascript
row._exportResult = 'failed';
row._exportError = syncError.message;
```

### B2: Update renderTable() status column
Replace the static status cell with logic that shows different pills based on `row._exportResult`:

```javascript
function getStatusPillHtml(row) {
    if (!row._exportResult) {
        return '<span class="batch-status-pill valid">可輸出</span>';
    }
    switch (row._exportResult) {
        case 'success':
            return '<span class="batch-status-pill exported">已匯出</span>';
        case 'skipped':
            return '<span class="batch-status-pill exported">已跳過</span>';
        case 'failed':
            const errorMsg = escapeHtml(row._exportError || '未知錯誤');
            return `<span class="batch-status-pill failed">失敗</span><span class="batch-row-errors">${errorMsg}</span>`;
        default:
            return '<span class="batch-status-pill valid">可輸出</span>';
    }
}
```

Update renderTable() status cell (line 858):
Replace:
```html
<td>${statusText}</td>
```
With:
```html
<td>${getStatusPillHtml(row)}</td>
```

Also add row highlighting based on result. After building the row HTML, add a class to `<tr>`:
- `is-valid` if result is 'success'
- `is-invalid` if result is 'failed'

### B3: Result summary in status box
After export completes, the setStatus call at line 1354 already works with setStatus. Modify to show more detail:
```
批量輸出完成，共 N 筆；成功 M 筆，失敗 F 筆，跳過 S 筆。
```

---

## Execution Order (Sequential — each depends on previous)

Wave 1: batch.html + style.css (no dependency)
Wave 2: batch-page.js changes (depends on Wave 1 for HTML element IDs)

## Skills to Load
- `frontend-ui-ux` — visual design sense for the overlay

## Category
- `visual-engineering` — frontend/UI work

## Manual QA Plan
1. Open batch.html, add a few rows
2. Click "批量輸出" → overlay appears with progress bar and log
3. Verify progress bar fills and log shows per-row status
4. Let it complete → overlay closes, result shown in status box
5. Verify table shows exported/skipped/failed pills per row
6. Test cancel: start export, click "取消輸出" → export stops gracefully
