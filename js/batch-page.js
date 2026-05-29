/* 批量生產頁：依目前版型動態產生欄位並輸出 ZIP */

const STORAGE_KEY = 'nameplateSettings';
const DEFAULT_OBJECT_IDS = ['default-name', 'default-company', 'default-position', 'default-qrcode'];

const batchState = {
    template: null,
    schema: null,
    rows: [],
    qrCache: new Map(),
    renderer: null
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initThemeFromMainPage();
        batchState.template = loadTemplateFromStorage();
        batchState.schema = buildSchema(batchState.template.state);
        window.nameplateState = cloneJson(batchState.template.state);
        ensureObjectState(window.nameplateState);
        batchState.renderer = new NameplateRenderer('batchCanvas');

        await initializeRendererAssets();
        attachEventListeners();
        renderSchemaSummary();
        addEmptyRow();
        setStatus('已載入目前版型。可上傳檔案或直接在表格編輯資料。');
    } catch (error) {
        console.error(error);
        setStatus(`初始化失敗: ${error.message}`);
    }
});

function setStatus(message) {
    const node = document.getElementById('batchStatusText');
    if (node) {
        node.textContent = message;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function ensureObjectState(state) {
    if (!state || typeof state !== 'object') {
        return;
    }

    if (!state.objectVisibility || typeof state.objectVisibility !== 'object') {
        state.objectVisibility = {};
    }

    DEFAULT_OBJECT_IDS.forEach((id) => {
        if (state.objectVisibility[id] == null) {
            state.objectVisibility[id] = true;
        }
    });

    if (!Array.isArray(state.customObjects)) {
        state.customObjects = [];
    }

    const allIds = [
        ...DEFAULT_OBJECT_IDS,
        ...state.customObjects.filter((item) => item && item.id).map((item) => item.id)
    ];

    const uniqueOrder = Array.isArray(state.objectOrder)
        ? state.objectOrder.filter((id, index, arr) => id && arr.indexOf(id) === index)
        : [];

    state.objectOrder = uniqueOrder.filter((id) => allIds.includes(id));
    allIds.forEach((id) => {
        if (!state.objectOrder.includes(id)) {
            state.objectOrder.push(id);
        }
    });
}

function normalizeTemplateState(state) {
    if (!state.bgColor) state.bgColor = '#ffffff';
    if (!state.textColor) state.textColor = '#000000';
    if (!state.name) state.name = '名子';
    if (!state.company) state.company = '公司名稱';
    if (!state.position) state.position = '職位名稱';

    const baseSize = parseInt(state.nameFontSize || state.fontSize || 120, 10) || 120;
    state.nameFontSize = baseSize;
    state.companyFontSize = parseInt(state.companyFontSize || Math.max(24, Math.round(baseSize * 0.42)), 10);
    state.positionFontSize = parseInt(state.positionFontSize || Math.max(24, Math.round(baseSize * 0.42)), 10);

    if (state.nameOffsetX == null) state.nameOffsetX = 0;
    if (state.nameOffsetY == null) state.nameOffsetY = 0;
    if (state.companyOffsetX == null) state.companyOffsetX = 0;
    if (state.companyOffsetY == null) state.companyOffsetY = 0;
    if (state.positionOffsetX == null) state.positionOffsetX = 0;
    if (state.positionOffsetY == null) state.positionOffsetY = 0;
    if (state.qrcodeOffsetX == null) state.qrcodeOffsetX = -280;
    if (state.qrcodeOffsetY == null) state.qrcodeOffsetY = 0;
    if (state.qrSize == null) state.qrSize = 100;
    if (state.qrVisible == null) state.qrVisible = true;

    ensureObjectState(state);
}

function getDefaultTemplateState() {
    return {
        name: '名子',
        company: '公司名稱',
        position: '職位名稱',
        bgColor: '#ffffff',
        nameFontSize: 120,
        companyFontSize: 50,
        positionFontSize: 50,
        textColor: '#000000',
        textShadow: false,
        nameTextShadow: false,
        companyTextShadow: false,
        positionTextShadow: false,
        nameOffsetX: 0,
        nameOffsetY: 0,
        companyOffsetX: 0,
        companyOffsetY: 0,
        positionOffsetX: 0,
        positionOffsetY: 0,
        qrcodeOffsetX: -280,
        qrcodeOffsetY: 0,
        qrSize: 100,
        qrVisible: true,
        objectVisibility: {
            'default-name': true,
            'default-company': true,
            'default-position': true,
            'default-qrcode': true
        },
        customObjects: [],
        objectOrder: [...DEFAULT_OBJECT_IDS]
    };
}

function loadTemplateFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        const state = getDefaultTemplateState();
        normalizeTemplateState(state);
        return {
            state,
            opacity: 100,
            bgImageDataUrl: null,
            qrCodeDataUrl: null,
            aspectRatio: { w: 5, h: 3, canvasWidth: 800, canvasHeight: 480 }
        };
    }

    const parsed = JSON.parse(saved);
    const state = parsed && parsed.state ? parsed.state : getDefaultTemplateState();
    normalizeTemplateState(state);

    return {
        state,
        opacity: parseInt(parsed.opacity || 100, 10) || 100,
        bgImageDataUrl: parsed.bgImageDataUrl || null,
        qrCodeDataUrl: parsed.qrCodeDataUrl || null,
        aspectRatio: parsed.aspectRatio || { w: 5, h: 3, canvasWidth: 800, canvasHeight: 480 }
    };
}

function isObjectVisible(state, objectId) {
    if (DEFAULT_OBJECT_IDS.includes(objectId)) {
        return state.objectVisibility[objectId] !== false;
    }

    const objectMeta = state.customObjects.find((item) => item && item.id === objectId);
    return objectMeta ? objectMeta.visible !== false : false;
}

function getCustomObjectLabel(objectMeta, fallbackIndex) {
    if (!objectMeta) return `文字${fallbackIndex}`;
    if (objectMeta.type === 'text') {
        const value = String(objectMeta.text || '').trim();
        return value || `文字${fallbackIndex}`;
    }
    if (objectMeta.type === 'qr') {
        return `QRCode${fallbackIndex}`;
    }
    return `${objectMeta.type || 'object'}${fallbackIndex}`;
}

function buildSchema(state) {
    const required = [];
    const optional = [];

    let textIndex = 1;
    let qrIndex = 1;

    state.objectOrder.forEach((objectId) => {
        if (!isObjectVisible(state, objectId)) {
            return;
        }

        if (objectId === 'default-name') {
            required.push({ key: 'name', label: '姓名', type: 'text', target: objectId, required: true });
            return;
        }

        if (objectId === 'default-company') {
            required.push({ key: 'company', label: '公司/部門', type: 'text', target: objectId, required: true });
            return;
        }

        if (objectId === 'default-position') {
            required.push({ key: 'position', label: '職位', type: 'text', target: objectId, required: true });
            return;
        }

        if (objectId === 'default-qrcode' && state.qrVisible !== false) {
            optional.push({ key: 'qrUrl', label: 'QRCode URL', type: 'url', target: objectId, required: false });
            qrIndex += 1;
            return;
        }

        const objectMeta = state.customObjects.find((item) => item && item.id === objectId);
        if (!objectMeta) {
            return;
        }

        if (objectMeta.type === 'text') {
            required.push({
                key: `text_${objectMeta.id}`,
                label: getCustomObjectLabel(objectMeta, textIndex),
                type: 'text',
                target: objectMeta.id,
                required: true
            });
            textIndex += 1;
            return;
        }

        if (objectMeta.type === 'qr') {
            optional.push({
                key: `qrUrl_${objectMeta.id}`,
                label: getCustomObjectLabel(objectMeta, qrIndex),
                type: 'url',
                target: objectMeta.id,
                required: false
            });
            qrIndex += 1;
        }
    });

    optional.push({
        key: 'deviceTarget',
        label: '桌牌目標（名稱或 IP）',
        type: 'text',
        target: 'device-target',
        required: false
    });

    return {
        required,
        optional,
        all: [...required, ...optional]
    };
}

function initThemeFromMainPage() {
    applyTheme(localStorage.getItem('theme') || 'light');

    // 若使用者在其他頁籤調整主題，批量頁也同步更新。
    window.addEventListener('storage', (event) => {
        if (event.key !== 'theme') {
            return;
        }

        applyTheme(event.newValue || 'light');
    });
}

function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
    }
}

function renderSchemaSummary() {
    const container = document.getElementById('columnSchemaSummary');
    if (!container) {
        return;
    }

    if (!batchState.schema.all.length) {
        container.innerHTML = '<div class="batch-empty-state">目前沒有可用欄位，請先回編輯頁建立文字物件</div>';
        return;
    }

    const requiredHtml = batchState.schema.required
        .map((item) => `<span class="batch-schema-chip required">${escapeHtml(item.key)}（${escapeHtml(item.label)}）</span>`)
        .join('');

    const optionalHtml = batchState.schema.optional.length
        ? batchState.schema.optional
            .map((item) => `<span class="batch-schema-chip optional">${escapeHtml(item.key)}（${escapeHtml(item.label)}）</span>`)
            .join('')
        : '<span class="batch-empty-state">目前沒有可選欄位</span>';

    container.innerHTML = `
        <div>
            <h3>必填欄位</h3>
            <div class="batch-schema-row">${requiredHtml || '<span class="batch-empty-state">無</span>'}</div>
        </div>
        <div>
            <h3>可選欄位</h3>
            <div class="batch-schema-row">${optionalHtml}</div>
        </div>
    `;
}

function createEmptyRow() {
    return Object.fromEntries(batchState.schema.all.map((column) => [column.key, '']));
}

function addEmptyRow() {
    batchState.rows.push(createEmptyRow());
    renderTable();
}

function validateRow(row) {
    const missing = batchState.schema.required.filter((column) => !String(row[column.key] || '').trim());
    return {
        valid: missing.length === 0,
        missing
    };
}

function updateSummary() {
    const node = document.getElementById('batchSummary');
    if (!node) {
        return;
    }

    if (!batchState.rows.length) {
        node.textContent = '尚未建立資料';
        return;
    }

    const validCount = batchState.rows.filter((row) => validateRow(row).valid).length;
    node.textContent = `共 ${batchState.rows.length} 列，可輸出 ${validCount} 列，需補資料 ${batchState.rows.length - validCount} 列`;
}

function renderTable() {
    const head = document.getElementById('batchPreviewHead');
    const body = document.getElementById('batchPreviewBody');

    if (!head || !body) {
        return;
    }

    head.innerHTML = `
        <tr>
            <th>列</th>
            ${batchState.schema.all.map((column) => `<th>${escapeHtml(column.label)}<br><small>${escapeHtml(column.key)}</small></th>`).join('')}
            <th>狀態</th>
            <th>操作</th>
        </tr>
    `;

    if (!batchState.rows.length) {
        body.innerHTML = `<tr><td colspan="${batchState.schema.all.length + 3}" class="batch-empty-state">尚無資料，請上傳檔案或新增一列</td></tr>`;
        updateSummary();
        return;
    }

    body.innerHTML = batchState.rows.map((row, rowIndex) => {
        const validation = validateRow(row);
        const statusText = validation.valid
            ? '<span class="batch-status-pill valid">可輸出</span>'
            : `<span class="batch-status-pill invalid">缺欄位：${escapeHtml(validation.missing.map((item) => item.key).join(', '))}</span>`;

        const cells = batchState.schema.all.map((column) => {
            const inputType = column.type === 'url' ? 'url' : 'text';
            return `
                <td>
                    <input
                        class="batch-inline-input"
                        type="${inputType}"
                        value="${escapeHtml(row[column.key] || '')}"
                        data-row-index="${rowIndex}"
                        data-key="${escapeHtml(column.key)}"
                        placeholder="${escapeHtml(column.key)}"
                    >
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td>${rowIndex + 1}</td>
                ${cells}
                <td>${statusText}</td>
                <td class="batch-row-actions">
                    <button type="button" class="btn btn-secondary" data-action="preview" data-row-index="${rowIndex}">預覽</button>
                    <button type="button" class="btn btn-secondary" data-action="delete" data-row-index="${rowIndex}">刪除</button>
                </td>
            </tr>
        `;
    }).join('');

    updateSummary();
}

function attachEventListeners() {
    document.getElementById('batchAddRowBtn').addEventListener('click', () => {
        addEmptyRow();
    });

    document.getElementById('batchClearBtn').addEventListener('click', () => {
        batchState.rows = [];
        renderTable();
        setStatus('資料已清除。');
    });

    document.getElementById('batchTemplateBtn').addEventListener('click', downloadCurrentTemplateCsv);
    document.getElementById('batchDownloadCsvBtn').addEventListener('click', downloadCurrentTableCsv);
    document.getElementById('batchCsvInput').addEventListener('change', handleSpreadsheetUpload);
    document.getElementById('batchExportBtn').addEventListener('click', handleBatchExport);

    document.getElementById('batchPreviewBody').addEventListener('input', (event) => {
        const input = event.target.closest('input[data-row-index][data-key]');
        if (!input) {
            return;
        }

        const rowIndex = parseInt(input.dataset.rowIndex, 10);
        const key = input.dataset.key;
        if (!Number.isFinite(rowIndex) || !key || !batchState.rows[rowIndex]) {
            return;
        }

        batchState.rows[rowIndex][key] = input.value;
        updateSummary();
    });

    document.getElementById('batchPreviewBody').addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-action][data-row-index]');
        if (!btn) {
            return;
        }

        const rowIndex = parseInt(btn.dataset.rowIndex, 10);
        if (!Number.isFinite(rowIndex) || !batchState.rows[rowIndex]) {
            return;
        }

        if (btn.dataset.action === 'delete') {
            batchState.rows.splice(rowIndex, 1);
            renderTable();
            return;
        }

        if (btn.dataset.action === 'preview') {
            await applyRowPreview(batchState.rows[rowIndex]);
            setStatus(`已套用第 ${rowIndex + 1} 列預覽`);
        }
    });
}

function escapeCsvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadTextFile(fileName, content, contentType = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function downloadCurrentTemplateCsv() {
    const headers = batchState.schema.all.map((column) => column.key);
    const content = `\uFEFF${headers.map(escapeCsvCell).join(',')}\n`;
    downloadTextFile('batch-template.csv', content);
}

function downloadCurrentTableCsv() {
    const headers = batchState.schema.all.map((column) => column.key);
    const lines = [headers.map(escapeCsvCell).join(',')];

    batchState.rows.forEach((row) => {
        const values = headers.map((key) => String(row[key] || ''));
        lines.push(values.map(escapeCsvCell).join(','));
    });

    const content = `\uFEFF${lines.join('\n')}`;
    downloadTextFile('batch-data.csv', content);
    setStatus(`已下載目前表格 CSV（${batchState.rows.length} 列）。`);
}

function parseCsvText(text) {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let inQuotes = false;

    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index];
        const nextChar = normalized[index + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentValue += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            currentRow.push(currentValue);
            currentValue = '';
            continue;
        }

        if (char === '\n' && !inQuotes) {
            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
            continue;
        }

        currentValue += char;
    }

    currentRow.push(currentValue);
    rows.push(currentRow);

    return rows
        .map((row) => row.map((cell) => String(cell ?? '').trim()))
        .filter((row) => row.some((cell) => cell !== ''));
}

async function parseSpreadsheet(file) {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.csv')) {
        return parseCsvText(await file.text());
    }

    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX 函式庫未載入');
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            throw new Error('試算表沒有工作表');
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            blankrows: false,
            defval: ''
        });

        return rows
            .map((row) => row.map((cell) => String(cell ?? '').trim()))
            .filter((row) => row.some((cell) => cell !== ''));
    }

    throw new Error('僅支援 CSV、XLSX、XLS');
}

function buildRowsFromSheetRows(rows) {
    if (!rows.length) {
        throw new Error('檔案內容為空');
    }

    const headers = rows[0].map((header) => String(header || '').trim());
    const allowedKeys = new Set(batchState.schema.all.map((column) => column.key));
    const missingRequired = batchState.schema.required.filter((column) => !headers.includes(column.key));
    if (missingRequired.length > 0) {
        throw new Error(`缺少必填欄位: ${missingRequired.map((item) => item.key).join(', ')}`);
    }

    const unknownHeaders = headers.filter((header) => header && !allowedKeys.has(header));
    if (unknownHeaders.length > 0) {
        throw new Error(`存在未支援欄位: ${unknownHeaders.join(', ')}`);
    }

    const dataRows = rows.slice(1);
    if (!dataRows.length) {
        throw new Error('至少需要一筆資料列');
    }

    return dataRows.map((row) => {
        const record = createEmptyRow();
        headers.forEach((header, columnIndex) => {
            if (!header || !allowedKeys.has(header)) {
                return;
            }
            record[header] = String(row[columnIndex] || '').trim();
        });
        return record;
    });
}

async function handleSpreadsheetUpload(event) {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    if (!file) {
        return;
    }

    try {
        const rows = await parseSpreadsheet(file);
        batchState.rows = buildRowsFromSheetRows(rows);
        renderTable();
        setStatus(`已載入 ${file.name}，共 ${batchState.rows.length} 列。`);
    } catch (error) {
        setStatus(`檔案解析失敗: ${error.message}`);
    }
}

function sanitizeFileNamePart(value, fallback = 'nameplate') {
    const safe = String(value || fallback)
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_');

    return safe || fallback;
}

function sanitizeFolderName(value, fallback = 'unassigned') {
    return sanitizeFileNamePart(value, fallback);
}

function waitForNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function waitForMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
}

async function generateQrCodeDataUrl(qrUrl) {
    if (!qrUrl) {
        return '';
    }

    const cacheKey = String(qrUrl).trim();
    if (batchState.qrCache.has(cacheKey)) {
        return batchState.qrCache.get(cacheKey);
    }

    if (typeof QRCode === 'undefined') {
        throw new Error('QRCode 函式庫未載入');
    }

    const tmpDiv = document.createElement('div');
    tmpDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:512px;height:512px;';
    document.body.appendChild(tmpDiv);

    try {
        new QRCode(tmpDiv, {
            text: cacheKey,
            width: 512,
            height: 512,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        await waitForMs(50);

        const canvas = tmpDiv.querySelector('canvas');
        const img = tmpDiv.querySelector('img');
        const url = canvas ? canvas.toDataURL('image/png') : (img && img.src ? img.src : '');

        if (!url) {
            throw new Error('無法產生 QRCode 圖片');
        }

        batchState.qrCache.set(cacheKey, url);
        return url;
    } finally {
        document.body.removeChild(tmpDiv);
    }
}

function applyTextColumnToState(nextState, column, row) {
    const value = String(row[column.key] || '').trim();

    if (column.target === 'default-name') {
        nextState.name = value;
        return;
    }

    if (column.target === 'default-company') {
        nextState.company = value;
        return;
    }

    if (column.target === 'default-position') {
        nextState.position = value;
        return;
    }

    const objectMeta = nextState.customObjects.find((item) => item && item.id === column.target);
    if (objectMeta) {
        objectMeta.text = value;
    }
}

async function applyQrColumnsToState(nextState, row) {
    let defaultQrDataUrl = batchState.template.qrCodeDataUrl || '';

    for (const column of batchState.schema.optional) {
        const value = String(row[column.key] || '').trim();

        if (column.target === 'default-qrcode') {
            if (value) {
                defaultQrDataUrl = await generateQrCodeDataUrl(value);
            }
            continue;
        }

        const objectMeta = nextState.customObjects.find((item) => item && item.id === column.target && item.type === 'qr');
        if (!objectMeta) {
            continue;
        }

        if (value) {
            objectMeta.qrUrl = value;
            objectMeta.dataUrl = await generateQrCodeDataUrl(value);
        }
    }

    return defaultQrDataUrl;
}

async function applyRowPreview(row) {
    const nextState = cloneJson(batchState.template.state);

    batchState.schema.required.forEach((column) => {
        applyTextColumnToState(nextState, column, row);
    });

    const defaultQrDataUrl = await applyQrColumnsToState(nextState, row);
    window.nameplateState = nextState;
    await batchState.renderer.setQrCodeDataUrl(defaultQrDataUrl);
    batchState.renderer.render(nextState);
}

async function initializeRendererAssets() {
    const canvas = document.getElementById('batchCanvas');
    const ratio = batchState.template.aspectRatio || {};
    if (Number.isFinite(ratio.canvasWidth) && Number.isFinite(ratio.canvasHeight)) {
        canvas.width = ratio.canvasWidth;
        canvas.height = ratio.canvasHeight;
    }

    batchState.renderer.setBackgroundOpacity(batchState.template.opacity || 100);
    window.nameplateState = cloneJson(batchState.template.state);
    ensureObjectState(window.nameplateState);

    if (batchState.template.bgImageDataUrl) {
        batchState.renderer.setBackgroundImageDataUrl(batchState.template.bgImageDataUrl);
    } else {
        batchState.renderer.clearBackgroundImage();
    }

    await batchState.renderer.setQrCodeDataUrl(batchState.template.qrCodeDataUrl || '');
    batchState.renderer.render(window.nameplateState);
}

async function handleBatchExport() {
    if (!batchState.rows.length) {
        setStatus('請先建立資料列。');
        return;
    }

    const validRows = batchState.rows.filter((row) => validateRow(row).valid);
    if (!validRows.length) {
        setStatus('目前沒有可輸出的有效資料列。');
        return;
    }

    if (typeof JSZip === 'undefined') {
        setStatus('JSZip 函式庫未載入，無法輸出 ZIP。');
        return;
    }

    const zip = new JSZip();
    const dateText = new Date().toISOString().slice(0, 10);

    setStatus(`開始輸出 ${validRows.length} 筆資料...`);

    try {
        for (let index = 0; index < validRows.length; index += 1) {
            const row = validRows[index];
            const nextState = cloneJson(batchState.template.state);

            batchState.schema.required.forEach((column) => {
                applyTextColumnToState(nextState, column, row);
            });

            const defaultQrDataUrl = await applyQrColumnsToState(nextState, row);
            window.nameplateState = nextState;
            batchState.renderer.setBackgroundOpacity(batchState.template.opacity || 100);
            await batchState.renderer.setQrCodeDataUrl(defaultQrDataUrl);
            batchState.renderer.render(nextState);
            await waitForNextFrame();

            const imageDataUrl = batchState.renderer.exportBase64();
            const imageBlob = await dataUrlToBlob(imageDataUrl);
            const preferredName = String(row.name || row.company || row.position || `row_${index + 1}`).trim();
            const fileName = `nameplate_${sanitizeFileNamePart(preferredName, `row_${index + 1}`)}_${dateText}.png`;
            const targetFolder = sanitizeFolderName(row.deviceTarget, 'unassigned');
            zip.file(`${targetFolder}/${fileName}`, imageBlob);

            setStatus(`輸出中... (${index + 1}/${validRows.length})`);
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        downloadTextFile(`nameplates_${dateText}.zip`, zipBlob, 'application/zip');
        setStatus(`批量輸出完成，共 ${validRows.length} 筆。`);
    } catch (error) {
        console.error(error);
        setStatus(`批量輸出失敗: ${error.message}`);
    }
}
