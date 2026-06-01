/* 批量生產頁：依目前版型動態產生欄位並輸出 ZIP */

const STORAGE_KEY = 'nameplateSettings';
const DEFAULT_OBJECT_IDS = ['default-name', 'default-company', 'default-position', 'default-qrcode'];
const PHILIPS_API_PREFIX = '/api/tableside/v1';
const PHILIPS_PROXY_API = '/api/philips/proxy';
const PHILIPS_DEVICES_API = '/api/philips/devices';
const PHILIPS_JPEG_MAX_BYTES = 750 * 1024;
const PHILIPS_JPEG_MAX_WIDTH = 800;
const PHILIPS_JPEG_MAX_HEIGHT = 480;
const DEVICE_TARGET_SUGGESTION_LIMIT = 40;
const DUAL_DISPLAY_UPDATE_DELAY_MS = 350;

const batchState = {
    template: null,
    schema: null,
    rows: [],
    qrCache: new Map(),
    renderer: null,
    philips: {
        serverPort: 3001,
        publicBaseUrl: '',
        imgDither: false,
        displayCallbackUrl: '/image-post',
        devices: []
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        initThemeFromMainPage();
        batchState.template = loadTemplateFromStorage();
        normalizePhilipsSettings();
        await loadServerManagedDevices();
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
    if (!state.nameTextColor) state.nameTextColor = state.textColor;
    if (!state.companyTextColor) state.companyTextColor = state.textColor;
    if (!state.positionTextColor) state.positionTextColor = state.textColor;
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
        nameTextColor: '#000000',
        companyTextColor: '#000000',
        positionTextColor: '#000000',
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
            aspectRatio: { w: 5, h: 3, canvasWidth: 800, canvasHeight: 480 },
            philips: null
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
        aspectRatio: parsed.aspectRatio || { w: 5, h: 3, canvasWidth: 800, canvasHeight: 480 },
        philips: parsed.philips || null
    };
}

function clampNumber(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function tryParseUrl(value) {
    try {
        return new URL(value);
    } catch (error) {
        return null;
    }
}

function normalizeBatchDeviceTarget(value) {
    return String(value || '').trim().toLowerCase();
}

function extractDeviceHostFromTarget(value) {
    const match = String(value || '').trim().match(/\(([^()]+)\)\s*$/);
    if (!match) {
        return '';
    }

    return normalizeBatchDeviceTarget(match[1]);
}

function buildDisplayImageUrl(baseUrl, target) {
    try {
        const parsed = new URL(baseUrl, window.location.origin);
        parsed.searchParams.set('np_target', target);
        parsed.searchParams.set('np_ts', Date.now().toString());
        return parsed.toString();
    } catch (error) {
        const separator = String(baseUrl).includes('?') ? '&' : '?';
        return `${baseUrl}${separator}np_target=${encodeURIComponent(target)}&np_ts=${Date.now()}`;
    }
}

function buildDisplayCallbackUrl(target) {
    const baseCallback = batchState.philips.displayCallbackUrl || '/image-post';

    try {
        const parsed = new URL(baseCallback, window.location.origin);
        parsed.searchParams.set('side', target);
        if (!/^https?:/i.test(baseCallback)) {
            return `${parsed.pathname}${parsed.search}`;
        }

        return parsed.toString();
    } catch (error) {
        const separator = String(baseCallback).includes('?') ? '&' : '?';
        return `${baseCallback}${separator}side=${encodeURIComponent(target)}`;
    }
}

function normalizePhilipsDevice(device = {}) {
    const protocol = device.protocol === 'https' ? 'https' : 'http';
    const host = String(device.host || '').trim();
    const port = clampNumber(device.port || (protocol === 'https' ? 443 : 80), 1, 65535, protocol === 'https' ? 443 : 80);
    if (!host) {
        return null;
    }

    return {
        id: device.id || `${protocol}://${host}:${port}`,
        protocol,
        host,
        port,
        label: String(device.label || '').trim(),
        device_id: String(device.device_id || '').trim()
    };
}

function collectPhilipsDevices() {
    const state = batchState.template && batchState.template.philips ? batchState.template.philips : null;
    if (!state || typeof state !== 'object') {
        return [];
    }

    const fromList = [];
    const candidateLists = [state.devices, state.discoveredDevices, state.manualDevices];
    candidateLists.forEach((list) => {
        if (!Array.isArray(list)) {
            return;
        }

        list.forEach((item) => {
            const normalized = normalizePhilipsDevice(item);
            if (normalized) {
                fromList.push(normalized);
            }
        });
    });

    const uniqueMap = new Map();
    fromList.forEach((device) => {
        uniqueMap.set(device.id, device);
    });

    return Array.from(uniqueMap.values());
}

function normalizePhilipsSettings() {
    const state = batchState.template && batchState.template.philips ? batchState.template.philips : {};
    const serverPort = clampNumber(state.serverPort || 3001, 1, 65535, 3001);
    batchState.philips = {
        serverPort,
        publicBaseUrl: String(state.publicBaseUrl || '').trim(),
        imgDither: Boolean(state.imgDither),
        displayCallbackUrl: String(state.displayCallbackUrl || '/image-post').trim() || '/image-post',
        devices: collectPhilipsDevices()
    };
    renderDeviceTargetSuggestions();
}

async function loadServerManagedDevices() {
    if (window.location.protocol === 'file:') {
        return;
    }

    try {
        const response = await fetchFromPhilipsApi(PHILIPS_DEVICES_API, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        }

        const list = Array.isArray(payload.data) ? payload.data : [];
        const map = new Map(batchState.philips.devices.map(device => [device.id, device]));
        list.forEach((item) => {
            const normalized = normalizePhilipsDevice(item);
            if (normalized) {
                map.set(normalized.id, normalized);
            }
        });

        batchState.philips.devices = Array.from(map.values());
        renderDeviceTargetSuggestions();
    } catch (error) {
        console.warn('讀取伺服器桌牌設定失敗:', error);
    }
}

function formatDeviceTargetDisplay(device) {
    const label = String(device?.label || device?.device_id || '').trim();
    const host = String(device?.host || '').trim();
    if (label && host && label !== host) {
        return `${label}(${host})`;
    }

    return label || host || String(device?.id || '').trim();
}

function renderDeviceTargetSuggestions() {
    const datalist = document.getElementById('deviceTargetSuggestions');
    if (!datalist) {
        return;
    }

    const options = new Map();

    batchState.philips.devices.forEach((device) => {
        [formatDeviceTargetDisplay(device), device.host, device.id, device.device_id].forEach((candidate) => {
            const value = String(candidate || '').trim();
            const key = normalizeBatchDeviceTarget(value);
            if (!value || !key || options.has(key)) {
                return;
            }

            options.set(key, value);
        });
    });

    datalist.innerHTML = Array.from(options.values())
        .slice(0, DEVICE_TARGET_SUGGESTION_LIMIT)
        .map((value) => `<option value="${escapeHtml(value)}"></option>`)
        .join('');
}

function collectPhilipsApiBaseCandidates() {
    const candidates = [];
    const seen = new Set();

    function addCandidate(urlLike) {
        const parsed = tryParseUrl(urlLike);
        if (!parsed) {
            return;
        }

        const origin = parsed.origin;
        if (seen.has(origin)) {
            return;
        }

        seen.add(origin);
        candidates.push(origin);
    }

    if (window.location.protocol !== 'file:') {
        addCandidate(window.location.origin);
    }

    if (batchState.philips.publicBaseUrl) {
        addCandidate(batchState.philips.publicBaseUrl);
    }

    addCandidate(`http://127.0.0.1:${batchState.philips.serverPort}`);
    addCandidate(`http://localhost:${batchState.philips.serverPort}`);

    return candidates;
}

async function fetchFromPhilipsApi(path, options = {}) {
    const candidates = collectPhilipsApiBaseCandidates();
    let lastError = null;

    for (const baseUrl of candidates) {
        const url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
        try {
            const response = await fetch(url, options);
            if (response.status === 404) {
                continue;
            }
            return response;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('找不到可用的 Philips API 服務位址');
}

function findPhilipsDeviceByBatchTarget(target) {
    const normalizedTarget = normalizeBatchDeviceTarget(target);
    if (!normalizedTarget) {
        return null;
    }

    const bracketHost = extractDeviceHostFromTarget(target);

    const parsedUrl = tryParseUrl(target);
    const parsedTargetHost = parsedUrl ? normalizeBatchDeviceTarget(parsedUrl.hostname) : '';
    const parsedTargetPort = parsedUrl ? String(clampNumber(parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80), 1, 65535, 80)) : '';

    const matched = batchState.philips.devices.find((device) => {
        const deviceId = normalizeBatchDeviceTarget(device.id);
        const label = normalizeBatchDeviceTarget(device.label);
        const host = normalizeBatchDeviceTarget(device.host);
        const deviceCode = normalizeBatchDeviceTarget(device.device_id);
        const hostMatchesUrl = parsedUrl
            ? host === parsedTargetHost && String(clampNumber(device.port, 1, 65535, 80)) === parsedTargetPort
            : false;

        return normalizedTarget === deviceId
            || normalizedTarget === label
            || normalizedTarget === host
            || normalizedTarget === deviceCode
            || (bracketHost && bracketHost === host)
            || hostMatchesUrl;
    });

    if (matched) {
        return matched;
    }

    // fallback: 允許直接輸入 IP 或 host[:port]
    if (parsedUrl && parsedUrl.hostname) {
        return normalizePhilipsDevice({
            protocol: parsedUrl.protocol === 'https:' ? 'https' : 'http',
            host: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            label: String(target || '').trim()
        });
    }

    const hostPortMatch = String(target || '').trim().match(/^([^:\s]+)(?::(\d{1,5}))?$/);
    if (!hostPortMatch) {
        return null;
    }

    return normalizePhilipsDevice({
        protocol: 'http',
        host: hostPortMatch[1],
        port: hostPortMatch[2] || 80,
        label: String(target || '').trim()
    });
}

async function uploadNameplateImageForRow(row, jpegDataUrl) {
    const response = await fetchFromPhilipsApi('/api/nameplate/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: row.name || 'nameplate',
            company: row.company || '',
            position: row.position || '',
            image: jpegDataUrl,
            format: 'jpeg',
            timestamp: new Date().toISOString()
        })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.data || !payload.data.publicUrl) {
        throw new Error(payload.message || payload.error || `上傳圖片失敗（HTTP ${response.status}）`);
    }

    return payload.data.publicUrl;
}

async function performPhilipsRequestForDevice(device, path, options = {}) {
    const response = await fetchFromPhilipsApi(PHILIPS_PROXY_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: JSON.stringify({
            device,
            path,
            method: options.method || 'GET',
            body: options.body || null
        })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
        throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function waitForDualDisplayGap() {
    return new Promise(resolve => {
        setTimeout(resolve, DUAL_DISPLAY_UPDATE_DELAY_MS);
    });
}

async function pushRowToPhilipsDevice(row, philipsJpegDataUrl) {
    const targetText = String(row.deviceTarget || '').trim();
    if (!targetText) {
        return {
            skipped: true,
            message: '未填桌牌資訊，僅輸出圖片檔'
        };
    }

    const device = findPhilipsDeviceByBatchTarget(targetText);
    if (!device) {
        return {
            skipped: true,
            message: `找不到桌牌：${targetText}`
        };
    }

    const publicUrl = await uploadNameplateImageForRow(row, philipsJpegDataUrl);
    const imageTargetUrlA = buildDisplayImageUrl(publicUrl, 'a');
    const imageTargetUrlB = buildDisplayImageUrl(publicUrl, 'b');
    const displayCallbackUrlA = buildDisplayCallbackUrl('a');
    const displayCallbackUrlB = buildDisplayCallbackUrl('b');
    const requestBody = {
        img_target_url: imageTargetUrlA,
        img_dither: batchState.philips.imgDither ? 1 : 0,
        display_callback_url: displayCallbackUrlA
    };
    const sideResults = {
        targetA: null,
        targetB: null
    };
    const sideErrors = [];

    try {
        sideResults.targetA = await performPhilipsRequestForDevice(device, `${PHILIPS_API_PREFIX}/display/image/a`, {
            method: 'PUT',
            body: requestBody
        });
    } catch (error) {
        sideErrors.push(`A 面更新失敗: ${error.message}`);
    }

    await waitForDualDisplayGap();

    try {
        sideResults.targetB = await performPhilipsRequestForDevice(device, `${PHILIPS_API_PREFIX}/display/image/b`, {
            method: 'PUT',
            body: {
                ...requestBody,
                img_target_url: imageTargetUrlB,
                display_callback_url: displayCallbackUrlB
            }
        });
    } catch (error) {
        sideErrors.push(`B 面更新失敗: ${error.message}`);
    }

    if (sideErrors.length > 0) {
        throw new Error(sideErrors.join(' | '));
    }

    return {
        skipped: false,
        imageTargetUrl: publicUrl,
        imageTargetUrlA,
        imageTargetUrlB,
        displayCallbackUrlA,
        displayCallbackUrlB,
        ...sideResults,
        message: `已更新桌牌：${device.label || device.host}`
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
    return {
        valid: true,
        missing: []
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

    node.textContent = `共 ${batchState.rows.length} 列，全部可輸出（空白欄位會維持空白）`;
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
            <th>
                操作
                <button
                    type="button"
                    class="batch-row-plus-btn"
                    data-action="add-row"
                    title="新增一列"
                    aria-label="新增一列"
                >+</button>
            </th>
        </tr>
    `;

    if (!batchState.rows.length) {
        body.innerHTML = `<tr><td colspan="${batchState.schema.all.length + 3}" class="batch-empty-state">尚無資料，請上傳檔案或新增一列</td></tr>`;
        updateSummary();
        return;
    }

    body.innerHTML = batchState.rows.map((row, rowIndex) => {
        const statusText = '<span class="batch-status-pill valid">可輸出</span>';

        const cells = batchState.schema.all.map((column) => {
            const inputType = column.type === 'url' ? 'url' : 'text';
            const listAttr = column.key === 'deviceTarget' ? 'list="deviceTargetSuggestions"' : '';
            return `
                <td>
                    <input
                        class="batch-inline-input"
                        type="${inputType}"
                        ${listAttr}
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
    document.getElementById('batchPreviewHead').addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action="add-row"]');
        if (!btn) {
            return;
        }

        addEmptyRow();
        setStatus('已新增一列');
    });

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

function dataUrlByteLength(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
}

function exportPhilipsJpegDataUrlFromBatchCanvas() {
    const sourceCanvas = document.getElementById('batchCanvas');
    if (!sourceCanvas) {
        throw new Error('找不到批量預覽畫布');
    }

    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = PHILIPS_JPEG_MAX_WIDTH;
    targetCanvas.height = PHILIPS_JPEG_MAX_HEIGHT;
    const context = targetCanvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    const scale = Math.min(
        PHILIPS_JPEG_MAX_WIDTH / sourceCanvas.width,
        PHILIPS_JPEG_MAX_HEIGHT / sourceCanvas.height
    );
    const drawWidth = Math.max(1, Math.round(sourceCanvas.width * scale));
    const drawHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
    const drawX = Math.round((PHILIPS_JPEG_MAX_WIDTH - drawWidth) / 2);
    const drawY = Math.round((PHILIPS_JPEG_MAX_HEIGHT - drawHeight) / 2);
    context.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);

    const qualities = [0.92, 0.86, 0.8, 0.72, 0.64, 0.56];
    for (const quality of qualities) {
        const dataUrl = targetCanvas.toDataURL('image/jpeg', quality);
        if (dataUrlByteLength(dataUrl) <= PHILIPS_JPEG_MAX_BYTES) {
            return dataUrl;
        }
    }

    throw new Error('目前名牌轉成 JPEG 後超過 750KB，請降低背景複雜度或調整尺寸');
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

    const validRows = batchState.rows;

    if (typeof JSZip === 'undefined') {
        setStatus('JSZip 函式庫未載入，無法輸出 ZIP。');
        return;
    }

    const zip = new JSZip();
    const dateText = new Date().toISOString().slice(0, 10);
    let syncedCount = 0;
    let syncFailedCount = 0;

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
            const philipsJpegDataUrl = exportPhilipsJpegDataUrlFromBatchCanvas();
            const preferredName = String(row.name || row.company || row.position || `row_${index + 1}`).trim();
            const fileName = `nameplate_${sanitizeFileNamePart(preferredName, `row_${index + 1}`)}_${dateText}.png`;
            const targetFolder = sanitizeFolderName(row.deviceTarget, 'unassigned');
            zip.file(`${targetFolder}/${fileName}`, imageBlob);

            try {
                const syncResult = await pushRowToPhilipsDevice(row, philipsJpegDataUrl);
                if (!syncResult.skipped) {
                    syncedCount += 1;
                }
            } catch (syncError) {
                syncFailedCount += 1;
                console.warn(`第 ${index + 1} 列桌牌更新失敗:`, syncError);
            }

            setStatus(`輸出中... (${index + 1}/${validRows.length})`);
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        downloadTextFile(`nameplates_${dateText}.zip`, zipBlob, 'application/zip');
        setStatus(`批量輸出完成，共 ${validRows.length} 筆；桌牌更新成功 ${syncedCount} 筆，失敗 ${syncFailedCount} 筆。`);
    } catch (error) {
        console.error(error);
        setStatus(`批量輸出失敗: ${error.message}`);
    }
}
