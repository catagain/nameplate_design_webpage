/**
 * 會議名牌編輯器
 */

// ========== 拖曳狀態 ==========
let dragState = {
    isDragging: false,
    selectedText: null,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
};

// 背景圖片 DataURL（用於下次訪問還原）
let bgImageDataUrl = null;
// QRCode DataURL（用於下次訪問還原）
let qrCodeDataUrl = null;
let qrCodeLibLoadingPromise = null;
let batchJobState = createEmptyBatchJobState();

const BATCH_REQUIRED_COLUMNS = ['name', 'company', 'position'];
const BATCH_OPTIONAL_COLUMNS = ['deviceId', 'meetingId', 'qrUrl'];
const PHILIPS_API_PREFIX = '/api/tableside/v1';
const PHILIPS_DISCOVERY_API = '/api/philips/discover';
const PHILIPS_JPEG_MAX_BYTES = 750 * 1024;
const PHILIPS_JPEG_MAX_WIDTH = 800;
const PHILIPS_JPEG_MAX_HEIGHT = 480;
const DEVICE_DISCOVERY_REFRESH_MS = 30000;

let philipsControlState = createDefaultPhilipsControlState();
let philipsDiscoveryIntervalId = null;

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    initRenderer();
    attachEventListeners();
    updateTextPositionControlRanges();
    loadPreferredSettings();
    initDarkMode();
    initPhilipsDeviceDiscovery();
    // 預先嘗試載入 QRCode 函式庫，降低首次點擊等待時間
    ensureQrCodeLibraryLoaded();
});

async function ensureQrCodeLibraryLoaded() {
    if (typeof QRCode !== 'undefined') {
        return true;
    }

    if (qrCodeLibLoadingPromise) {
        return qrCodeLibLoadingPromise;
    }

    qrCodeLibLoadingPromise = (async () => {
        const localLibPath = 'js/vendor/qrcode.min.js';

        try {
            await loadScript(localLibPath);
            if (typeof QRCode !== 'undefined') {
                return true;
            }
        } catch (err) {
            console.warn('QRCode 本地函式庫載入失敗:', localLibPath, err);
        }

        return false;
    })();

    const loaded = await qrCodeLibLoadingPromise;
    qrCodeLibLoadingPromise = null;
    return loaded;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (typeof QRCode !== 'undefined') {
                resolve();
                return;
            }
            // 若 script 已存在但 QRCode 仍不可用，通常代表先前載入已失敗；直接改試下一個 CDN
            reject(new Error(`Script 已存在但 QRCode 未就緒: ${src}`));
            return;
        }

        const script = document.createElement('script');
        const timeoutId = setTimeout(() => {
            script.remove();
            reject(new Error(`Script 載入逾時: ${src}`));
        }, 7000);

        script.src = src;
        script.async = true;
        script.onload = () => {
            clearTimeout(timeoutId);
            resolve();
        };
        script.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Script 載入失敗: ${src}`));
        };
        document.head.appendChild(script);
    });
}

// ========== 事件監聽 ==========
function attachEventListeners() {
    // 基本信息
    document.getElementById('nameInput').addEventListener('input', handleNameChange);
    document.getElementById('companyInput').addEventListener('input', handleCompanyChange);
    document.getElementById('positionInput').addEventListener('input', handlePositionChange);

    // 背景設置
    document.getElementById('bgColorInput').addEventListener('change', handleBgColorChange);
    document.getElementById('bgImageInput').addEventListener('change', handleImageUpload);
    document.getElementById('clearImageBtn').addEventListener('click', handleClearImage);
    document.getElementById('bgOpacity').addEventListener('input', handleOpacityChange);

    // QRCode 設置
    document.getElementById('qrImageInput').addEventListener('change', handleQrImageUpload);
    document.getElementById('generateQrBtn').addEventListener('click', handleGenerateQrCode);
    document.getElementById('clearQrBtn').addEventListener('click', handleClearQrCode);
    document.getElementById('qrSize').addEventListener('input', handleQrSizeChange);
    document.getElementById('qrcodeOffsetX').addEventListener('input', handleQrcodeOffsetXChange);
    document.getElementById('qrcodeOffsetY').addEventListener('input', handleQrcodeOffsetYChange);
    document.getElementById('qrcodeOffsetXInput').addEventListener('change', (e) => handleNumberInputChange('qrcodeOffsetX', e.target.value));
    document.getElementById('qrcodeOffsetYInput').addEventListener('change', (e) => handleNumberInputChange('qrcodeOffsetY', e.target.value));
    document.getElementById('qrcodeXCenterBtn').addEventListener('click', () => handleCenterPosition('qrcodeOffsetX'));
    document.getElementById('qrcodeYCenterBtn').addEventListener('click', () => handleCenterPosition('qrcodeOffsetY'));

    // 文字樣式
    document.getElementById('nameFontSize').addEventListener('input', handleNameFontSizeChange);
    document.getElementById('companyFontSize').addEventListener('input', handleCompanyFontSizeChange);
    document.getElementById('positionFontSize').addEventListener('input', handlePositionFontSizeChange);
    document.getElementById('textColorInput').addEventListener('change', handleTextColorChange);
    document.getElementById('textShadow').addEventListener('change', handleTextShadowChange);

    // 文字位置 - 姓名
    document.getElementById('nameOffsetX').addEventListener('input', handleNameOffsetXChange);
    document.getElementById('nameOffsetY').addEventListener('input', handleNameOffsetYChange);
    
    // 文字位置 - 公司
    document.getElementById('companyOffsetX').addEventListener('input', handleCompanyOffsetXChange);
    document.getElementById('companyOffsetY').addEventListener('input', handleCompanyOffsetYChange);
    
    // 文字位置 - 職位
    document.getElementById('positionOffsetX').addEventListener('input', handlePositionOffsetXChange);
    document.getElementById('positionOffsetY').addEventListener('input', handlePositionOffsetYChange);

    // Number Input 事件監聽器
    // 姓名
    document.getElementById('nameOffsetXInput').addEventListener('change', (e) => handleNumberInputChange('nameOffsetX', e.target.value));
    document.getElementById('nameOffsetYInput').addEventListener('change', (e) => handleNumberInputChange('nameOffsetY', e.target.value));
    // 公司
    document.getElementById('companyOffsetXInput').addEventListener('change', (e) => handleNumberInputChange('companyOffsetX', e.target.value));
    document.getElementById('companyOffsetYInput').addEventListener('change', (e) => handleNumberInputChange('companyOffsetY', e.target.value));
    // 職位
    document.getElementById('positionOffsetXInput').addEventListener('change', (e) => handleNumberInputChange('positionOffsetX', e.target.value));
    document.getElementById('positionOffsetYInput').addEventListener('change', (e) => handleNumberInputChange('positionOffsetY', e.target.value));

    // Center Button 事件監聽器
    document.getElementById('nameXCenterBtn').addEventListener('click', () => handleCenterPosition('nameOffsetX'));
    document.getElementById('nameYCenterBtn').addEventListener('click', () => handleCenterPosition('nameOffsetY'));
    document.getElementById('companyXCenterBtn').addEventListener('click', () => handleCenterPosition('companyOffsetX'));
    document.getElementById('companyYCenterBtn').addEventListener('click', () => handleCenterPosition('companyOffsetY'));
    document.getElementById('positionXCenterBtn').addEventListener('click', () => handleCenterPosition('positionOffsetX'));
    document.getElementById('positionYCenterBtn').addEventListener('click', () => handleCenterPosition('positionOffsetY'));
    
    // Canvas 拖曳事件 - 滑鼠
    const canvas = document.getElementById('nameplate');
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // Canvas 拖曳事件 - 觸摸（手機）
    canvas.addEventListener('touchstart', handleCanvasTouchStart);
    canvas.addEventListener('touchmove', handleCanvasTouchMove);
    canvas.addEventListener('touchend', handleCanvasTouchEnd);
    canvas.addEventListener('touchcancel', handleCanvasTouchEnd);

    // 操作按鈕
    document.getElementById('downloadBtn').addEventListener('click', handleDownload);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('batchCsvInput').addEventListener('change', handleBatchCsvImport);
    document.getElementById('batchTemplateBtn').addEventListener('click', handleBatchTemplateDownload);
    document.getElementById('batchClearBtn').addEventListener('click', handleBatchClear);
    document.getElementById('batchExportBtn').addEventListener('click', handleBatchExport);
    document.getElementById('batchRetryBtn').addEventListener('click', handleBatchRetryFailed);
    document.getElementById('batchReportBtn').addEventListener('click', handleBatchReportDownload);
    document.getElementById('batchPreviewBody').addEventListener('click', handleBatchPreviewAction);

    // 快速預設
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', handlePresetClick);
    });

    // 深色模式
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    // 尺寸比例
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const w = parseInt(btn.dataset.w);
            const h = parseInt(btn.dataset.h);
            applyAspectRatio(w, h);
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('customRatioW').value = w;
            document.getElementById('customRatioH').value = h;
        });
    });

    document.getElementById('applyCustomRatioBtn').addEventListener('click', () => {
        const w = parseInt(document.getElementById('customRatioW').value) || 10;
        const h = parseInt(document.getElementById('customRatioH').value) || 3;
        applyAspectRatio(w, h);
        document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    });

    // Philips 桌牌控制
    document.getElementById('deviceSelect').addEventListener('change', handleDeviceSelectionChange);
    document.getElementById('refreshDeviceListBtn').addEventListener('click', () => refreshPhilipsDeviceList(true, true));
    document.getElementById('saveDeviceBtn').addEventListener('click', handleSaveDevice);
    document.getElementById('deleteDeviceBtn').addEventListener('click', handleDeleteDevice);
    document.getElementById('networkModeSelect').addEventListener('change', handleNetworkModeChange);
    document.getElementById('pushImageABtn').addEventListener('click', () => handlePushDisplayImage('a'));
    document.getElementById('pushImageBBtn').addEventListener('click', () => handlePushDisplayImage('b'));
    document.getElementById('setServerBtn').addEventListener('click', handleSetServerConfig);
    document.getElementById('getServerBtn').addEventListener('click', handleGetServerConfig);
    document.getElementById('setHeartbeatBtn').addEventListener('click', handleSetHeartbeatConfig);
    document.getElementById('aboutBtn').addEventListener('click', handleGetDeviceAbout);
    document.getElementById('resetDeviceBtn').addEventListener('click', handleResetDevice);
    document.getElementById('factoryResetBtn').addEventListener('click', handleFactoryResetPreferences);
    document.getElementById('changeIpBtn').addEventListener('click', handleChangeIpConfig);
    document.getElementById('otaBtn').addEventListener('click', handleTriggerOtaUpdate);
}

function createDefaultPhilipsControlState() {
    return {
        devices: [],
        discoveredDevices: [],
        manualDevices: [],
        serverCandidates: [],
        selectedDeviceId: '',
        imageHostUrl: '',
        displayCallbackUrl: '/image-post',
        imgDither: false,
        serverAddr: '',
        serverPort: 3001,
        heartbeatUrl: '/heartbeat',
        heartbeatMinutes: 5,
        otaUrl: '',
        networkMode: 'dhcp',
        ip: '',
        netmask: '',
        gateway: '',
        dns1: '',
        dns2: '',
        lastDiscoveryAt: '',
        lastApiResult: '尚未呼叫 API'
    };
}

function generateDeviceId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `device_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function buildDeviceId(device) {
    const host = String(device?.host || '').trim();
    const port = clampNumber(device?.port, 1, 65535, 80);
    const protocol = device?.protocol === 'https' ? 'https' : 'http';

    if (!host) {
        return device?.id || generateDeviceId();
    }

    return `${protocol}://${host}:${port}`;
}

function normalizeDeviceRecord(device = {}, source = 'manual') {
    const protocol = device.protocol === 'https' ? 'https' : 'http';
    const host = String(device.host || '').trim();
    const port = clampNumber(device.port, 1, 65535, 80);

    return {
        id: buildDeviceId({ ...device, protocol, host, port }),
        label: String(device.label || '').trim(),
        host,
        port,
        protocol,
        source,
        device_id: String(device.device_id || '').trim(),
        about: device.about || null
    };
}

function createDefaultDevice() {
    return normalizeDeviceRecord();
}

function sortDevices(deviceA, deviceB) {
    const sourceWeightA = deviceA.source === 'discovered' ? 0 : 1;
    const sourceWeightB = deviceB.source === 'discovered' ? 0 : 1;
    if (sourceWeightA !== sourceWeightB) {
        return sourceWeightA - sourceWeightB;
    }

    return (deviceA.label || deviceA.host).localeCompare(deviceB.label || deviceB.host, 'zh-Hant');
}

function mergeAvailableDevices(discoveredDevices, manualDevices) {
    const mergedMap = new Map();

    discoveredDevices.forEach(device => {
        mergedMap.set(device.id, { ...device, source: 'discovered' });
    });

    manualDevices.forEach(device => {
        if (!mergedMap.has(device.id)) {
            mergedMap.set(device.id, { ...device, source: 'manual' });
            return;
        }

        const discovered = mergedMap.get(device.id);
        mergedMap.set(device.id, {
            ...discovered,
            label: device.label || discovered.label,
            protocol: device.protocol || discovered.protocol,
            port: device.port || discovered.port
        });
    });

    return Array.from(mergedMap.values()).sort(sortDevices);
}

function rebuildAvailableDevices() {
    philipsControlState.devices = mergeAvailableDevices(
        philipsControlState.discoveredDevices,
        philipsControlState.manualDevices
    );

    if (!philipsControlState.devices.some(device => device.id === philipsControlState.selectedDeviceId)) {
        philipsControlState.selectedDeviceId = '';
    }
}

function normalizePhilipsControlState(state) {
    const defaults = createDefaultPhilipsControlState();
    const normalized = {
        ...defaults,
        ...(state || {})
    };

    const legacyManualDevices = Array.isArray(normalized.manualDevices)
        ? normalized.manualDevices
        : (Array.isArray(normalized.devices) ? normalized.devices : []);

    normalized.manualDevices = legacyManualDevices
        .map(device => normalizeDeviceRecord(device, 'manual'))
        .filter(device => device.host || device.label);
    normalized.discoveredDevices = [];
    normalized.devices = [];
    normalized.serverCandidates = Array.isArray(normalized.serverCandidates) ? normalized.serverCandidates : [];

    normalized.serverPort = parseInt(normalized.serverPort, 10) || defaults.serverPort;
    normalized.heartbeatMinutes = clampNumber(normalized.heartbeatMinutes, 0, 999, defaults.heartbeatMinutes);
    normalized.networkMode = normalized.networkMode === 'static' ? 'static' : 'dhcp';
    normalized.imgDither = Boolean(normalized.imgDither);
    normalized.lastDiscoveryAt = normalized.lastDiscoveryAt || '';
    normalized.lastApiResult = normalized.lastApiResult || defaults.lastApiResult;

    rebuildNormalizedDevices(normalized);

    return normalized;
}

function rebuildNormalizedDevices(state) {
    state.devices = mergeAvailableDevices(state.discoveredDevices || [], state.manualDevices || []);
    state.selectedDeviceId = state.devices.some(device => device.id === state.selectedDeviceId)
        ? state.selectedDeviceId
        : '';
}

function clampNumber(value, min, max, fallback) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function getSelectedDevice() {
    return philipsControlState.devices.find(device => device.id === philipsControlState.selectedDeviceId) || null;
}

function setDeviceDiscoveryStatus(message) {
    const statusNode = document.getElementById('deviceDiscoveryStatus');
    if (statusNode) {
        statusNode.textContent = message;
    }
}

function shouldAutofillServerAddr() {
    const current = String(philipsControlState.serverAddr || '').trim();
    return !current || current === 'localhost' || current === '127.0.0.1';
}

function applyDiscoveryResult(payload) {
    philipsControlState.discoveredDevices = Array.isArray(payload.devices)
        ? payload.devices.map(device => normalizeDeviceRecord(device, 'discovered'))
        : [];
    philipsControlState.serverCandidates = Array.isArray(payload.serverCandidates) ? payload.serverCandidates : [];
    philipsControlState.lastDiscoveryAt = payload.scannedAt || '';

    if (shouldAutofillServerAddr()) {
        const preferredServer = philipsControlState.serverCandidates.find(candidate => candidate.address) || null;
        if (preferredServer) {
            philipsControlState.serverAddr = preferredServer.address;
        }
    }

    if ((philipsControlState.serverPort === 3001 || !philipsControlState.serverPort) && window.location.port) {
        philipsControlState.serverPort = clampNumber(window.location.port, 1, 65535, 3001);
    }

    rebuildAvailableDevices();
    syncPhilipsControlsFromState();

    const discoveredCount = philipsControlState.discoveredDevices.length;
    const timestamp = philipsControlState.lastDiscoveryAt
        ? new Date(philipsControlState.lastDiscoveryAt).toLocaleTimeString('zh-TW', { hour12: false })
        : '--:--:--';
    setDeviceDiscoveryStatus(`已掃描 ${payload.targetCount || 0} 個位址，找到 ${discoveredCount} 台桌牌，更新時間 ${timestamp}`);
}

async function refreshPhilipsDeviceList(forceRefresh = false, notifyOnFailure = false) {
    if (window.location.protocol === 'file:') {
        setDeviceDiscoveryStatus('請改由同一台電腦上的 Node server 開啟此頁，才能自動掃描桌牌');
        return;
    }

    setDeviceDiscoveryStatus('正在掃描目前網路環境中的桌牌...');

    try {
        const url = forceRefresh ? `${PHILIPS_DISCOVERY_API}?force=1` : PHILIPS_DISCOVERY_API;
        const response = await fetch(url, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        }

        applyDiscoveryResult(payload);
        saveSettings();
    } catch (error) {
        setDeviceDiscoveryStatus(`桌牌掃描失敗: ${error.message}`);
        if (notifyOnFailure) {
            showNotification(`桌牌掃描失敗: ${error.message}`, 'error');
        }
    }
}

async function initPhilipsDeviceDiscovery() {
    if (window.location.protocol !== 'file:' && window.location.port) {
        philipsControlState.serverPort = clampNumber(window.location.port, 1, 65535, philipsControlState.serverPort || 3001);
    }

    await refreshPhilipsDeviceList(true, false);

    if (philipsDiscoveryIntervalId) {
        clearInterval(philipsDiscoveryIntervalId);
    }

    if (window.location.protocol !== 'file:') {
        philipsDiscoveryIntervalId = setInterval(() => {
            refreshPhilipsDeviceList(false, false);
        }, DEVICE_DISCOVERY_REFRESH_MS);
    }
}

function handleDeviceSelectionChange(event) {
    philipsControlState.selectedDeviceId = event.target.value || '';
    const selectedDevice = getSelectedDevice();

    if (selectedDevice) {
        syncDeviceEditorFields(selectedDevice);
    } else {
        syncDeviceEditorFields(createDefaultDevice());
    }

    syncPhilipsPanel();
    saveSettings();
}

function handleSaveDevice() {
    const draft = normalizeDeviceRecord(readDeviceDraftFromForm(), 'manual');

    if (!draft.label || !draft.host) {
        showNotification('請輸入桌牌名稱與 IP / 網域', 'error');
        return;
    }

    const existingIndex = philipsControlState.manualDevices.findIndex(device => device.id === draft.id);
    if (existingIndex >= 0) {
        philipsControlState.manualDevices[existingIndex] = draft;
    } else {
        philipsControlState.manualDevices.push(draft);
    }

    philipsControlState.selectedDeviceId = draft.id;
    rebuildAvailableDevices();
    renderDeviceOptions();
    syncPhilipsPanel();
    saveSettings();
    showNotification(`已儲存桌牌設定: ${draft.label}`, 'success');
}

function handleDeleteDevice() {
    const selectedDevice = getSelectedDevice();
    if (!selectedDevice) {
        showNotification('目前沒有可刪除的桌牌', 'info');
        return;
    }

    const beforeCount = philipsControlState.manualDevices.length;
    philipsControlState.manualDevices = philipsControlState.manualDevices.filter(device => device.id !== selectedDevice.id);
    rebuildAvailableDevices();
    philipsControlState.selectedDeviceId = philipsControlState.devices.some(device => device.id === selectedDevice.id)
        ? selectedDevice.id
        : '';
    syncDeviceEditorFields(getSelectedDevice() || createDefaultDevice());
    renderDeviceOptions();
    syncPhilipsPanel();
    saveSettings();
    if (beforeCount === philipsControlState.manualDevices.length) {
        showNotification('已清除目前桌牌的手動設定，若設備在線仍會保留掃描結果', 'info');
    } else {
        showNotification(`已刪除桌牌設定: ${selectedDevice.label}`, 'info');
    }
}

function readDeviceDraftFromForm() {
    const protocol = document.getElementById('deviceProtocolSelect').value === 'https' ? 'https' : 'http';
    const host = document.getElementById('deviceHostInput').value.trim();
    const port = clampNumber(document.getElementById('devicePortInput').value, 1, 65535, 80);

    return {
        id: buildDeviceId({ host, port, protocol }),
        label: document.getElementById('deviceLabelInput').value.trim(),
        host,
        port,
        protocol
    };
}

function syncDeviceEditorFields(device) {
    document.getElementById('deviceLabelInput').value = device.label || '';
    document.getElementById('deviceHostInput').value = device.host || '';
    document.getElementById('devicePortInput').value = device.port || 80;
    document.getElementById('deviceProtocolSelect').value = device.protocol || 'http';
}

function renderDeviceOptions() {
    const select = document.getElementById('deviceSelect');
    const placeholder = '<option value="">請先選擇桌牌</option>';
    const options = philipsControlState.devices
        .map(device => {
            const suffix = device.source === 'manual' ? ' (手動)' : '';
            return `<option value="${escapeHtml(device.id)}">${escapeHtml(device.label || device.device_id || device.host)}${suffix}</option>`;
        })
        .join('');

    select.innerHTML = `${placeholder}${options}`;
    select.value = philipsControlState.selectedDeviceId || '';
}

function syncPhilipsControlsToState() {
    philipsControlState.imageHostUrl = document.getElementById('imageHostUrlInput').value.trim();
    philipsControlState.displayCallbackUrl = document.getElementById('displayCallbackUrlInput').value.trim() || '/image-post';
    philipsControlState.imgDither = document.getElementById('imgDitherInput').checked;
    philipsControlState.serverAddr = document.getElementById('serverAddrInput').value.trim();
    philipsControlState.serverPort = clampNumber(document.getElementById('serverPortInput').value, 1, 65535, 3001);
    philipsControlState.heartbeatUrl = document.getElementById('heartbeatUrlInput').value.trim() || '/heartbeat';
    philipsControlState.heartbeatMinutes = clampNumber(document.getElementById('heartbeatMinutesInput').value, 0, 999, 5);
    philipsControlState.otaUrl = document.getElementById('otaUrlInput').value.trim();
    philipsControlState.networkMode = document.getElementById('networkModeSelect').value === 'static' ? 'static' : 'dhcp';
    philipsControlState.ip = document.getElementById('ipInput').value.trim();
    philipsControlState.netmask = document.getElementById('netmaskInput').value.trim();
    philipsControlState.gateway = document.getElementById('gatewayInput').value.trim();
    philipsControlState.dns1 = document.getElementById('dns1Input').value.trim();
    philipsControlState.dns2 = document.getElementById('dns2Input').value.trim();
}

function syncPhilipsControlsFromState() {
    renderDeviceOptions();
    syncDeviceEditorFields(getSelectedDevice() || createDefaultDevice());
    document.getElementById('imageHostUrlInput').value = philipsControlState.imageHostUrl || '';
    document.getElementById('displayCallbackUrlInput').value = philipsControlState.displayCallbackUrl || '/image-post';
    document.getElementById('imgDitherInput').checked = Boolean(philipsControlState.imgDither);
    document.getElementById('serverAddrInput').value = philipsControlState.serverAddr || '';
    document.getElementById('serverPortInput').value = philipsControlState.serverPort || 3001;
    document.getElementById('heartbeatUrlInput').value = philipsControlState.heartbeatUrl || '/heartbeat';
    document.getElementById('heartbeatMinutesInput').value = philipsControlState.heartbeatMinutes ?? 5;
    document.getElementById('otaUrlInput').value = philipsControlState.otaUrl || '';
    document.getElementById('networkModeSelect').value = philipsControlState.networkMode || 'dhcp';
    document.getElementById('ipInput').value = philipsControlState.ip || '';
    document.getElementById('netmaskInput').value = philipsControlState.netmask || '';
    document.getElementById('gatewayInput').value = philipsControlState.gateway || '';
    document.getElementById('dns1Input').value = philipsControlState.dns1 || '';
    document.getElementById('dns2Input').value = philipsControlState.dns2 || '';
    document.getElementById('apiResultOutput').textContent = philipsControlState.lastApiResult || '尚未呼叫 API';
    handleNetworkModeChange();
    syncPhilipsPanel();
}

function syncPhilipsPanel() {
    const selectedDevice = getSelectedDevice();
    const controlsPanel = document.getElementById('deviceControlsPanel');
    controlsPanel.hidden = !selectedDevice;

    const summaryText = document.getElementById('deviceSummaryText');
    const footerDeviceName = document.getElementById('footerDeviceName');
    const footerDeviceEndpoint = document.getElementById('footerDeviceEndpoint');
    const footerWebhookEndpoint = document.getElementById('footerWebhookEndpoint');

    if (!selectedDevice) {
        summaryText.textContent = '請先建立或選擇桌牌，才能操作 Philips API。';
        footerDeviceName.textContent = '尚未選擇';
        footerDeviceEndpoint.textContent = '-';
    } else {
        const deviceBaseUrl = buildDeviceBaseUrl(selectedDevice);
        const sourceLabel = selectedDevice.source === 'manual' ? '手動' : '自動掃描';
        summaryText.textContent = `目前選擇 ${selectedDevice.label || selectedDevice.device_id || selectedDevice.host}（${sourceLabel}），API 會送到 ${deviceBaseUrl}${PHILIPS_API_PREFIX}`;
        footerDeviceName.textContent = selectedDevice.label || selectedDevice.device_id || selectedDevice.host;
        footerDeviceEndpoint.textContent = deviceBaseUrl;
    }

    footerWebhookEndpoint.textContent = buildWebhookServerBaseUrl() || '-';
}

function handleNetworkModeChange() {
    const networkMode = document.getElementById('networkModeSelect').value;
    const staticFields = document.getElementById('staticNetworkFields');
    staticFields.hidden = networkMode !== 'static';
}

function buildDeviceBaseUrl(device = getSelectedDevice()) {
    if (!device || !device.host) return '';
    const protocol = device.protocol || 'http';
    const port = parseInt(device.port, 10) || 80;
    const includePort = !((protocol === 'http' && port === 80) || (protocol === 'https' && port === 443));
    return `${protocol}://${device.host}${includePort ? `:${port}` : ''}`;
}

function buildWebhookServerBaseUrl() {
    syncPhilipsControlsToState();
    if (!philipsControlState.serverAddr) {
        return '';
    }

    return `http://${philipsControlState.serverAddr}:${philipsControlState.serverPort}`;
}

function updateApiResult(title, payload) {
    const resultOutput = document.getElementById('apiResultOutput');
    const statusText = document.getElementById('apiStatusText');
    const renderedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    const fullText = `${title}\n${renderedPayload}`;

    statusText.textContent = title;
    resultOutput.textContent = fullText;
    philipsControlState.lastApiResult = fullText;
    saveSettings();
}

async function performPhilipsRequest(path, options = {}) {
    syncPhilipsControlsToState();
    const selectedDevice = getSelectedDevice();
    if (!selectedDevice) {
        throw new Error('請先選擇桌牌');
    }

    const url = `${buildDeviceBaseUrl(selectedDevice)}${path}`;
    const requestOptions = {
        method: options.method || 'GET',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    };

    if (options.body) {
        requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, requestOptions);
    const responseText = await response.text();
    let payload;

    try {
        payload = responseText ? JSON.parse(responseText) : { success: response.ok };
    } catch (err) {
        payload = responseText || { success: response.ok };
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
    }

    return {
        url,
        status: response.status,
        payload
    };
}

async function withPhilipsAction(actionLabel, action) {
    showLoading(true);

    try {
        const result = await action();
        updateApiResult(`${actionLabel} 成功`, result);
        showNotification(`${actionLabel} 成功`, 'success');
        return result;
    } catch (error) {
        updateApiResult(`${actionLabel} 失敗`, { message: error.message });
        showNotification(`${actionLabel} 失敗: ${error.message}`, 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

function renderCanvasForPhilips() {
    const sourceCanvas = document.getElementById('nameplate');
    const scale = Math.min(
        PHILIPS_JPEG_MAX_WIDTH / sourceCanvas.width,
        PHILIPS_JPEG_MAX_HEIGHT / sourceCanvas.height,
        1
    );

    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    targetCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    const context = targetCanvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    context.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
    return targetCanvas;
}

function dataUrlByteLength(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil((base64.length * 3) / 4);
}

function exportPhilipsJpegDataUrl() {
    const canvas = renderCanvasForPhilips();
    const qualities = [0.92, 0.86, 0.8, 0.72, 0.64, 0.56];

    for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrlByteLength(dataUrl) <= PHILIPS_JPEG_MAX_BYTES) {
            return dataUrl;
        }
    }

    const fallback = canvas.toDataURL('image/jpeg', 0.5);
    if (dataUrlByteLength(fallback) > PHILIPS_JPEG_MAX_BYTES) {
        throw new Error('目前名牌轉成 JPEG 後仍超過 750KB，請降低背景複雜度或縮小畫布比例');
    }

    return fallback;
}

async function uploadCurrentNameplateToWebhookServer() {
    syncPhilipsControlsToState();
    const serverBaseUrl = buildWebhookServerBaseUrl();
    if (!serverBaseUrl) {
        throw new Error('請先填寫可讓桌牌存取的 Webhook Server 位址與 Port，或直接輸入圖片公開網址');
    }

    const imageData = exportPhilipsJpegDataUrl();
    const response = await fetch(`${serverBaseUrl}/api/nameplate/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: window.nameplateState.name,
            company: window.nameplateState.company || '',
            position: window.nameplateState.position || '',
            image: imageData,
            format: 'jpeg',
            timestamp: new Date().toISOString()
        })
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || `上傳圖片失敗: HTTP ${response.status}`);
    }

    const publicUrl = payload.data?.publicUrl || `${serverBaseUrl}${payload.data?.url || ''}`;
    philipsControlState.imageHostUrl = publicUrl;
    document.getElementById('imageHostUrlInput').value = publicUrl;
    saveSettings();
    return publicUrl;
}

async function resolveImageTargetUrl() {
    syncPhilipsControlsToState();

    if (philipsControlState.imageHostUrl) {
        return philipsControlState.imageHostUrl;
    }

    return uploadCurrentNameplateToWebhookServer();
}

async function handlePushDisplayImage(target) {
    const targetLabel = target === 'a' ? '左側畫面 A' : '右側畫面 B';

    await withPhilipsAction(`更新${targetLabel}`, async () => {
        const imageTargetUrl = await resolveImageTargetUrl();
        const result = await performPhilipsRequest(`${PHILIPS_API_PREFIX}/display/image/${target}`, {
            method: 'PUT',
            body: {
                img_target_url: imageTargetUrl,
                img_dither: philipsControlState.imgDither ? 1 : 0,
                display_callback_url: philipsControlState.displayCallbackUrl || '/image-post'
            }
        });

        return {
            ...result,
            imageTargetUrl
        };
    });
}

async function handleSetServerConfig() {
    await withPhilipsAction('設定伺服器位址', async () => {
        syncPhilipsControlsToState();
        if (!philipsControlState.serverAddr) {
            throw new Error('請先填寫 Webhook Server 位址');
        }

        return performPhilipsRequest(`${PHILIPS_API_PREFIX}/server`, {
            method: 'PUT',
            body: {
                server_addr: philipsControlState.serverAddr,
                server_port: philipsControlState.serverPort
            }
        });
    });
}

async function handleGetServerConfig() {
    await withPhilipsAction('取得伺服器設定', async () => performPhilipsRequest(`${PHILIPS_API_PREFIX}/server`));
}

async function handleSetHeartbeatConfig() {
    await withPhilipsAction('設定心跳', async () => {
        syncPhilipsControlsToState();
        return performPhilipsRequest(`${PHILIPS_API_PREFIX}/heartbeat`, {
            method: 'PUT',
            body: {
                heartbeat_url: philipsControlState.heartbeatUrl || '/heartbeat',
                minutes: clampNumber(philipsControlState.heartbeatMinutes, 0, 999, 5)
            }
        });
    });
}

async function handleGetDeviceAbout() {
    await withPhilipsAction('取得裝置資訊', async () => performPhilipsRequest(`${PHILIPS_API_PREFIX}/about`));
}

async function handleResetDevice() {
    await withPhilipsAction('重啟裝置', async () => performPhilipsRequest(`${PHILIPS_API_PREFIX}/reset`));
}

async function handleFactoryResetPreferences() {
    await withPhilipsAction('恢復出廠設定', async () => performPhilipsRequest(`${PHILIPS_API_PREFIX}/preferences`, {
        method: 'DELETE'
    }));
}

async function handleChangeIpConfig() {
    await withPhilipsAction('修改 IP 設定', async () => {
        syncPhilipsControlsToState();
        const body = {
            ip_mode: philipsControlState.networkMode
        };

        if (philipsControlState.networkMode === 'static') {
            const requiredFields = ['ip', 'netmask', 'gateway', 'dns1'];
            const missingField = requiredFields.find(fieldName => !philipsControlState[fieldName]);
            if (missingField) {
                throw new Error(`static 模式缺少欄位: ${missingField}`);
            }

            body.ip = philipsControlState.ip;
            body.netmask = philipsControlState.netmask;
            body.gateway = philipsControlState.gateway;
            body.dns1 = philipsControlState.dns1;
            body.dns2 = philipsControlState.dns2 || '';
        }

        return performPhilipsRequest(`${PHILIPS_API_PREFIX}/changeip`, {
            method: 'PUT',
            body
        });
    });
}

async function handleTriggerOtaUpdate() {
    await withPhilipsAction('觸發 OTA 更新', async () => {
        syncPhilipsControlsToState();
        if (!philipsControlState.otaUrl) {
            throw new Error('請先填寫 OTA 韌體網址');
        }

        return performPhilipsRequest(`${PHILIPS_API_PREFIX}/ota`, {
            method: 'PUT',
            body: {
                ota_url: philipsControlState.otaUrl
            }
        });
    });
}

function createEmptyBatchJobState() {
    return {
        fileName: '',
        headers: [],
        records: [],
        validRecords: [],
        invalidRecords: [],
        lastResults: []
    };
}

function cloneNameplateState() {
    return JSON.parse(JSON.stringify(window.nameplateState));
}

function createBatchTemplateState() {
    return {
        state: cloneNameplateState(),
        bgImageDataUrl,
        qrCodeDataUrl,
        opacity: parseInt(document.getElementById('bgOpacity').value, 10) || 100
    };
}

function sanitizeFileNamePart(value, fallback = 'nameplate') {
    const safeValue = String(value || fallback)
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_');

    return safeValue || fallback;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
        .map(row => row.map(cell => cell.trim()))
        .filter(row => row.some(cell => cell !== ''));
}

function normalizeBatchHeader(header) {
    return String(header || '').trim();
}

async function parseBatchSpreadsheet(file) {
    const lowerFileName = file.name.toLowerCase();

    if (lowerFileName.endsWith('.csv')) {
        const text = await file.text();
        return parseCsvText(text);
    }

    if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX 函式庫未載入，請確認 js/vendor/xlsx.full.min.js 存在');
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
            throw new Error('試算表中沒有可讀取的工作表');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            blankrows: false,
            defval: ''
        });

        return rows
            .map(row => row.map(cell => String(cell ?? '').trim()))
            .filter(row => row.some(cell => cell !== ''));
    }

    throw new Error('目前僅支援 CSV、XLSX、XLS 檔案');
}

function validateBatchHeaders(rows, sourceLabel) {
    if (rows.length < 2) {
        throw new Error(`${sourceLabel} 至少需要標題列與一筆資料`);
    }

    const headers = rows[0].map(normalizeBatchHeader);
    const missingHeaders = BATCH_REQUIRED_COLUMNS.filter(column => !headers.includes(column));

    if (missingHeaders.length > 0) {
        throw new Error(`缺少必要欄位: ${missingHeaders.join(', ')}`);
    }

    return headers;
}

function validateBatchRecord(record) {
    const errors = [];

    if (!record.name) {
        errors.push('缺少姓名');
    } else if (record.name.length > 20) {
        errors.push('姓名超過 20 字');
    }

    if (!record.company) {
        errors.push('缺少公司');
    } else if (record.company.length > 30) {
        errors.push('公司超過 30 字');
    }

    if (!record.position) {
        errors.push('缺少職位');
    } else if (record.position.length > 30) {
        errors.push('職位超過 30 字');
    }

    if (record.qrUrl) {
        try {
            new URL(record.qrUrl);
        } catch (error) {
            errors.push('QRCode 網址格式錯誤');
        }
    }

    return errors;
}

function buildBatchRecords(headers, rows) {
    return rows.map((row, index) => {
        const values = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] || '']));
        const record = {
            rowNumber: index + 2,
            name: values.name || '',
            company: values.company || '',
            position: values.position || '',
            deviceId: values.deviceId || '',
            meetingId: values.meetingId || '',
            qrUrl: values.qrUrl || '',
            errors: []
        };

        record.errors = validateBatchRecord(record);
        return record;
    });
}

function setBatchStatus(message) {
    document.getElementById('batchStatusText').textContent = message;
}

function setBatchResultSummary(message) {
    document.getElementById('batchResultSummary').textContent = message;
}

function getBatchResultMap() {
    return new Map(batchJobState.lastResults.map(result => [result.rowNumber, result]));
}

function updateBatchActionButtons() {
    document.getElementById('batchExportBtn').disabled = batchJobState.validRecords.length === 0;

    const failedCount = batchJobState.lastResults.filter(result => !result.success).length;
    document.getElementById('batchRetryBtn').disabled = failedCount === 0;
    document.getElementById('batchReportBtn').disabled = batchJobState.lastResults.length === 0;
}

function renderBatchPreview() {
    const summary = document.getElementById('batchSummary');
    const previewBody = document.getElementById('batchPreviewBody');
    const resultMap = getBatchResultMap();

    if (!batchJobState.records.length) {
        summary.textContent = '尚未匯入批次資料';
        previewBody.innerHTML = '<tr><td colspan="6" class="batch-empty-state">匯入 CSV 後會在這裡顯示預覽</td></tr>';
        setBatchResultSummary('尚未執行批量輸出');
        updateBatchActionButtons();
        return;
    }

    summary.textContent = `已匯入 ${batchJobState.records.length} 筆，通過 ${batchJobState.validRecords.length} 筆，需修正 ${batchJobState.invalidRecords.length} 筆`;
    updateBatchActionButtons();

    previewBody.innerHTML = batchJobState.records.map((record, index) => {
        const exportResult = resultMap.get(record.rowNumber);
        const statusClass = record.errors.length ? 'invalid' : 'valid';
        const statusLabel = record.errors.length ? '需修正' : '可產牌';
        const errorText = record.errors.length
            ? `<span class="batch-row-errors">${escapeHtml(record.errors.join('、'))}</span>`
            : '';
        const resultText = exportResult
            ? `<span class="batch-row-errors">${escapeHtml(exportResult.message || exportResult.fileName || '')}</span>`
            : '';
        const resultPill = exportResult
            ? `<span class="batch-status-pill ${exportResult.success ? 'exported' : 'failed'}">${exportResult.success ? '已輸出' : '輸出失敗'}</span>`
            : '';

        return `
            <tr class="is-${statusClass}">
                <td>${record.rowNumber}</td>
                <td>${escapeHtml(record.name)}</td>
                <td>${escapeHtml(record.company)}</td>
                <td>${escapeHtml(record.position)}</td>
                <td>
                    <span class="batch-status-pill ${statusClass}">${statusLabel}</span>
                    ${errorText}
                    ${resultPill}
                    ${resultText}
                </td>
                <td>
                    <button
                        type="button"
                        class="batch-row-apply-btn"
                        data-record-index="${index}"
                        ${record.errors.length ? 'disabled' : ''}
                    >套用預覽</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateBatchJobState(fileName, headers, records) {
    batchJobState = {
        fileName,
        headers,
        records,
        validRecords: records.filter(record => record.errors.length === 0),
        invalidRecords: records.filter(record => record.errors.length > 0),
        lastResults: []
    };

    renderBatchPreview();
}

function updateBatchResults(results, mode = 'replace') {
    if (mode === 'merge') {
        const previous = getBatchResultMap();
        results.forEach(result => {
            previous.set(result.rowNumber, result);
        });
        batchJobState.lastResults = Array.from(previous.values()).sort((left, right) => left.rowNumber - right.rowNumber);
    } else {
        batchJobState.lastResults = results;
    }

    const successCount = batchJobState.lastResults.filter(result => result.success).length;
    const failedCount = batchJobState.lastResults.filter(result => !result.success).length;

    if (batchJobState.lastResults.length === 0) {
        setBatchResultSummary('尚未執行批量輸出');
    } else {
        setBatchResultSummary(`最近一次結果：成功 ${successCount} 筆，失敗 ${failedCount} 筆`);
    }

    renderBatchPreview();
}

function getRetryableBatchRecords() {
    const failedRowNumbers = new Set(
        batchJobState.lastResults
            .filter(result => !result.success)
            .map(result => result.rowNumber)
    );

    return batchJobState.validRecords.filter(record => failedRowNumbers.has(record.rowNumber));
}

function createStateFromBatchRecord(templateState, record) {
    return {
        ...templateState,
        name: record.name || templateState.name,
        company: record.company || '',
        position: record.position || ''
    };
}

function applyStateToCanvasOnly(state) {
    window.nameplateState = state;
    triggerRender();
}

function restoreTemplateState(template) {
    window.nameplateState = template.state;
    syncControlsFromState(template.state, template.opacity);

    if (template.bgImageDataUrl) {
        window.renderer.setBackgroundImageDataUrl(template.bgImageDataUrl);
    } else {
        window.renderer.clearBackgroundImage();
    }

    if (template.qrCodeDataUrl) {
        window.renderer.setQrCodeDataUrl(template.qrCodeDataUrl);
        updateQrPreview(template.qrCodeDataUrl);
    } else {
        window.renderer.clearQrCode();
    }

    triggerRender();
}

function waitForNextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function exportBlobFromCurrentCanvas() {
    const dataUrl = window.renderer.exportBase64();
    const response = await fetch(dataUrl);
    return response.blob();
}

async function saveBlobToDirectory(directoryHandle, fileName, blob) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

async function triggerBlobDownload(fileName, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    await waitForNextFrame();
    URL.revokeObjectURL(url);
}

function createBatchZipArchive() {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip 未載入，請確認 js/vendor/jszip.min.js 存在');
    }

    return new JSZip();
}

async function generateBatchZipBlob(zipArchive) {
    return zipArchive.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });
}

function buildBatchArchiveFileName(timestamp) {
    const sourceName = batchJobState.fileName ? sanitizeFileNamePart(batchJobState.fileName.replace(/\.csv$/i, '')) : 'nameplates';
    return `${sourceName}_${timestamp}.zip`;
}

function escapeCsvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function buildBatchReportFileName() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const sourceName = batchJobState.fileName
        ? sanitizeFileNamePart(batchJobState.fileName.replace(/\.(csv|xlsx|xls)$/i, ''))
        : 'nameplates';
    return `${sourceName}_batch_report_${timestamp}.csv`;
}

function buildBatchReportCsv() {
    const resultMap = getBatchResultMap();
    const headers = ['rowNumber', 'name', 'company', 'position', 'qrUrl', 'validationStatus', 'exportStatus', 'fileName', 'message'];
    const lines = [headers.map(escapeCsvCell).join(',')];

    batchJobState.records.forEach(record => {
        const result = resultMap.get(record.rowNumber);
        const row = [
            record.rowNumber,
            record.name,
            record.company,
            record.position,
            record.qrUrl,
            record.errors.length ? record.errors.join('、') : 'valid',
            result ? (result.success ? 'success' : 'failed') : 'not_exported',
            result?.fileName || '',
            result?.message || ''
        ];

        lines.push(row.map(escapeCsvCell).join(','));
    });

    return `\uFEFF${lines.join('\n')}`;
}

// ========== 基本資訊處理 ==========
function handleNameChange(e) {
    const value = e.target.value;
    window.nameplateState.name = value || '名字';
    updateCharCount(value.length);
    triggerRender();
    saveSettings();
}

function handleCompanyChange(e) {
    const value = e.target.value;
    window.nameplateState.company = value;
    triggerRender();
    saveSettings();
}

function handlePositionChange(e) {
    const value = e.target.value;
    window.nameplateState.position = value;
    triggerRender();
    saveSettings();
}

function updateCharCount(count) {
    document.getElementById('charCount').textContent = count;
}

/**
 * 格式化並顯示位移值（只顯示整數）
 */
function updateOffsetDisplay(elementId, value) {
    const intValue = Math.round(value);
    document.getElementById(elementId).textContent = `${intValue}px`;
}

function getTextOffsetBounds() {
    const canvas = document.getElementById('nameplate');
    const maxX = Math.round(canvas.width / 2);
    const maxY = Math.round(canvas.height / 2);
    return {
        minX: -maxX,
        maxX,
        minY: -maxY,
        maxY
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function updateTextPositionControlRanges() {
    const bounds = getTextOffsetBounds();
    const textTypes = ['name', 'company', 'position'];

    textTypes.forEach(type => {
        const xKey = `${type}OffsetX`;
        const yKey = `${type}OffsetY`;

        const xSlider = document.getElementById(xKey);
        const ySlider = document.getElementById(yKey);
        const xInput = document.getElementById(`${xKey}Input`);
        const yInput = document.getElementById(`${yKey}Input`);

        xSlider.min = bounds.minX;
        xSlider.max = bounds.maxX;
        ySlider.min = bounds.minY;
        ySlider.max = bounds.maxY;

        xInput.min = bounds.minX;
        xInput.max = bounds.maxX;
        yInput.min = bounds.minY;
        yInput.max = bounds.maxY;

        const nextX = clamp(parseInt(window.nameplateState[xKey] || 0), bounds.minX, bounds.maxX);
        const nextY = clamp(parseInt(window.nameplateState[yKey] || 0), bounds.minY, bounds.maxY);

        window.nameplateState[xKey] = nextX;
        window.nameplateState[yKey] = nextY;

        xSlider.value = nextX;
        ySlider.value = nextY;
        xInput.value = nextX;
        yInput.value = nextY;

        updateOffsetDisplay(`${xKey}Value`, nextX);
        updateOffsetDisplay(`${yKey}Value`, nextY);
    });
}

// ========== 背景設置處理 ==========
function handleBgColorChange(e) {
    const color = e.target.value;
    window.nameplateState.bgColor = color;
    document.getElementById('colorValue').textContent = color;
    triggerRender();
    saveSettings();
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        // 驗證檔案大小（限制5MB）
        if (file.size > 5 * 1024 * 1024) {
            showNotification('圖片大小不能超過 5MB', 'error');
            return;
        }

        // 顯示圖片預覽
        const reader = new FileReader();
        reader.onload = (e) => {
            bgImageDataUrl = e.target.result;
            window.renderer.setBackgroundImageDataUrl(bgImageDataUrl);

            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="背景預覽">`;
            preview.classList.add('has-image');
            document.getElementById('clearImageBtn').style.display = 'block';

            saveSettings();
        };
        reader.readAsDataURL(file);

        showNotification('圖片已上傳', 'success');
    }
}

function handleClearImage() {
    document.getElementById('bgImageInput').value = '';
    window.renderer.clearBackgroundImage();
    bgImageDataUrl = null;
    
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '<span>未選擇圖片</span>';
    preview.classList.remove('has-image');
    document.getElementById('clearImageBtn').style.display = 'none';
    
    triggerRender();
    saveSettings();
}

function handleOpacityChange(e) {
    const value = e.target.value;
    window.renderer.setBackgroundOpacity(value);
    document.getElementById('opacityValue').textContent = `${value}%`;
    triggerRender();
    saveSettings();
}

function handleQrImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showNotification('QRCode 圖片大小不能超過 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        qrCodeDataUrl = event.target.result;
        window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
        updateQrPreview(qrCodeDataUrl);
        saveSettings();
        showNotification('已上傳 QRCode 圖片', 'success');
    };
    reader.readAsDataURL(file);
}

async function handleGenerateQrCode() {
    const qrUrl = document.getElementById('qrUrlInput').value.trim();
    if (!qrUrl) {
        showNotification('請先輸入網址', 'error');
        return;
    }

    const generateBtn = document.getElementById('generateQrBtn');
    const originalBtnText = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = '產生中...';

    try {
        qrCodeDataUrl = await generateQrCodeDataUrl(qrUrl);
        await window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
        updateQrPreview(qrCodeDataUrl);
        saveSettings();
        showNotification('已由網址產生 QRCode', 'success');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = originalBtnText;
    }
}

async function generateQrCodeDataUrl(qrUrl) {
    if (!await ensureQrCodeLibraryLoaded()) {
        throw new Error('QRCode 本地函式庫未載入，請確認 js/vendor/qrcode.min.js 存在');
    }

    const tmpDiv = document.createElement('div');
    tmpDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:512px;height:512px;';
    document.body.appendChild(tmpDiv);

    try {
        new QRCode(tmpDiv, {
            text: qrUrl,
            width: 512,
            height: 512,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = tmpDiv.querySelector('canvas');
        const img = tmpDiv.querySelector('img');
        let url = null;

        if (canvas) {
            url = canvas.toDataURL('image/png');
        } else if (img && img.src) {
            url = img.src;
        }

        if (!url) {
            throw new Error('無法取得 QRCode 圖片資料');
        }

        return url;
    } finally {
        document.body.removeChild(tmpDiv);
    }
}

async function prepareBatchQrCode(record, template) {
    if (record.qrUrl) {
        const dataUrl = await generateQrCodeDataUrl(record.qrUrl);
        await window.renderer.setQrCodeDataUrl(dataUrl);
        return;
    }

    if (template.qrCodeDataUrl) {
        await window.renderer.setQrCodeDataUrl(template.qrCodeDataUrl);
        return;
    }

    window.renderer.clearQrCode();
    triggerRender();
}

function handleClearQrCode() {
    document.getElementById('qrImageInput').value = '';
    document.getElementById('qrUrlInput').value = '';
    qrCodeDataUrl = null;
    window.renderer.clearQrCode();

    const preview = document.getElementById('qrPreview');
    preview.innerHTML = '<span>未設定 QRCode</span>';
    preview.classList.remove('has-image');
    document.getElementById('clearQrBtn').style.display = 'none';

    triggerRender();
    saveSettings();
}

function handleQrSizeChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.qrSize = value;
    document.getElementById('qrSizeValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
}

function handleQrcodeOffsetXChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.qrcodeOffsetX = value;
    updateOffsetDisplay('qrcodeOffsetXValue', value);
    document.getElementById('qrcodeOffsetXInput').value = value;
    triggerRender();
    saveSettings();
}

function handleQrcodeOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.qrcodeOffsetY = value;
    updateOffsetDisplay('qrcodeOffsetYValue', value);
    document.getElementById('qrcodeOffsetYInput').value = value;
    triggerRender();
    saveSettings();
}

function updateQrPreview(dataUrl) {
    const preview = document.getElementById('qrPreview');
    preview.innerHTML = `<img src="${dataUrl}" alt="QRCode 預覽">`;
    preview.classList.add('has-image');
    document.getElementById('clearQrBtn').style.display = 'block';
}

// ========== 文字樣式處理 ==========
function handleFontSizeChange(stateKey, valueElementId, value) {
    const size = parseInt(value);
    window.nameplateState[stateKey] = size;
    document.getElementById(valueElementId).textContent = `${size}px`;
    triggerRender();
    saveSettings();
}

function handleNameFontSizeChange(e) {
    handleFontSizeChange('nameFontSize', 'nameFontSizeValue', e.target.value);
}

function handleCompanyFontSizeChange(e) {
    handleFontSizeChange('companyFontSize', 'companyFontSizeValue', e.target.value);
}

function handlePositionFontSizeChange(e) {
    handleFontSizeChange('positionFontSize', 'positionFontSizeValue', e.target.value);
}

function handleTextColorChange(e) {
    const color = e.target.value;
    window.nameplateState.textColor = color;
    document.getElementById('textColorValue').textContent = color;
    triggerRender();
    saveSettings();
}

function handleTextShadowChange(e) {
    window.nameplateState.textShadow = e.target.checked;
    triggerRender();
    saveSettings();
}

// ========== 文字位置處理 - 姓名 ==========
function handleNameOffsetXChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.nameOffsetX = value;
    updateOffsetDisplay('nameOffsetXValue', value);
    document.getElementById('nameOffsetXInput').value = value;
    triggerRender();
    saveSettings();
}

function handleNameOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.nameOffsetY = value;
    updateOffsetDisplay('nameOffsetYValue', value);
    document.getElementById('nameOffsetYInput').value = value;
    triggerRender();
    saveSettings();
}

// ========== 文字位置處理 - 公司 ==========
function handleCompanyOffsetXChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.companyOffsetX = value;
    updateOffsetDisplay('companyOffsetXValue', value);
    document.getElementById('companyOffsetXInput').value = value;
    triggerRender();
    saveSettings();
}

function handleCompanyOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.companyOffsetY = value;
    updateOffsetDisplay('companyOffsetYValue', value);
    document.getElementById('companyOffsetYInput').value = value;
    triggerRender();
    saveSettings();
}

// ========== 文字位置處理 - 職位 ==========
function handlePositionOffsetXChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.positionOffsetX = value;
    updateOffsetDisplay('positionOffsetXValue', value);
    document.getElementById('positionOffsetXInput').value = value;
    triggerRender();
    saveSettings();
}

function handlePositionOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.positionOffsetY = value;
    updateOffsetDisplay('positionOffsetYValue', value);
    document.getElementById('positionOffsetYInput').value = value;
    triggerRender();
    saveSettings();
}

// ========== Number Input 和 Center Button 處理 ==========
function handleNumberInputChange(offsetKey, value) {
    const slider = document.getElementById(offsetKey);
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);
    const numValue = Math.max(min, Math.min(max, parseInt(value) || 0));
    
    window.nameplateState[offsetKey] = numValue;
    
    // 更新滑塊
    document.getElementById(offsetKey).value = numValue;
    updateOffsetDisplay(`${offsetKey}Value`, numValue);
    
    // 更新number input（防止超出範圍）
    document.getElementById(`${offsetKey}Input`).value = numValue;
    
    triggerRender();
    saveSettings();
}

function handleCenterPosition(offsetKey) {
    window.nameplateState[offsetKey] = 0;
    
    // 更新滑塊
    document.getElementById(offsetKey).value = 0;
    updateOffsetDisplay(`${offsetKey}Value`, 0);
    
    // 更新number input
    document.getElementById(`${offsetKey}Input`).value = 0;
    
    triggerRender();
    saveSettings();
    showNotification(`${getTextLabel(offsetKey.split('Offset')[0])} 已置中`, 'success');
}

// ========== Canvas 拖曳處理 ==========
function handleCanvasMouseDown(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 縮放係數（Canvas 實際大小與顯示大小的比例）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    const textType = window.renderer.getTextAtPoint(scaledX, scaledY);
    
    if (textType) {
        dragState.isDragging = true;
        dragState.selectedText = textType;
        dragState.startX = x;
        dragState.startY = y;
        dragState.startOffsetX = window.nameplateState[`${textType}OffsetX`] || 0;
        dragState.startOffsetY = window.nameplateState[`${textType}OffsetY`] || 0;
        
        canvas.style.cursor = 'grabbing';
        showNotification(`拖曳${getTextLabel(textType)}`, 'info');
    }
}

function handleCanvasMouseMove(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 縮放係數
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (dragState.isDragging && dragState.selectedText) {
        // 計算拖曳的距離（相對於縮放）
        const deltaX = (x - dragState.startX) * scaleX;
        const deltaY = (y - dragState.startY) * scaleY;

        // 更新狀態
        const bounds = getTextOffsetBounds();
        const newOffsetX = clamp(dragState.startOffsetX + deltaX, bounds.minX, bounds.maxX);
        const newOffsetY = clamp(dragState.startOffsetY + deltaY, bounds.minY, bounds.maxY);

        window.nameplateState[`${dragState.selectedText}OffsetX`] = newOffsetX;
        window.nameplateState[`${dragState.selectedText}OffsetY`] = newOffsetY;

        // 更新滑塊
        document.getElementById(`${dragState.selectedText}OffsetX`).value = newOffsetX;
        document.getElementById(`${dragState.selectedText}OffsetY`).value = newOffsetY;
        updateOffsetDisplay(`${dragState.selectedText}OffsetXValue`, newOffsetX);
        updateOffsetDisplay(`${dragState.selectedText}OffsetYValue`, newOffsetY);
        
        // 更新number input
        document.getElementById(`${dragState.selectedText}OffsetXInput`).value = newOffsetX;
        document.getElementById(`${dragState.selectedText}OffsetYInput`).value = newOffsetY;

        triggerRender();
    } else {
        // 檢查是否懸停在文字上
        const textType = window.renderer.getTextAtPoint(scaledX, scaledY);
        canvas.style.cursor = textType ? 'grab' : 'default';
    }
}

function handleCanvasMouseUp(e) {
    if (dragState.isDragging) {
        dragState.isDragging = false;
        dragState.selectedText = null;
        saveSettings();
        showNotification('位置已調整', 'success');
    }
    e.target.style.cursor = 'default';
}

function handleCanvasMouseLeave(e) {
    if (dragState.isDragging) {
        dragState.isDragging = false;
        dragState.selectedText = null;
        saveSettings();
    }
    e.target.style.cursor = 'default';
}

// ========== Canvas 觸摸拖曳處理（手機） ==========
function handleCanvasTouchStart(e) {
    const canvas = e.target;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // 縮放係數
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    const textType = window.renderer.getTextAtPoint(scaledX, scaledY);
    
    if (textType) {
        dragState.isDragging = true;
        dragState.selectedText = textType;
        dragState.startX = x;
        dragState.startY = y;
        dragState.startOffsetX = window.nameplateState[`${textType}OffsetX`] || 0;
        dragState.startOffsetY = window.nameplateState[`${textType}OffsetY`] || 0;
        
        e.preventDefault(); // 防止頁面滾動
        showNotification(`拖曳${getTextLabel(textType)}`, 'info');
    }
}

function handleCanvasTouchMove(e) {
    if (!dragState.isDragging || !dragState.selectedText) {
        return;
    }

    const canvas = e.target;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // 縮放係數
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 計算拖曳的距離
    const deltaX = (x - dragState.startX) * scaleX;
    const deltaY = (y - dragState.startY) * scaleY;

    // 更新狀態
    const bounds = getTextOffsetBounds();
    const newOffsetX = clamp(dragState.startOffsetX + deltaX, bounds.minX, bounds.maxX);
    const newOffsetY = clamp(dragState.startOffsetY + deltaY, bounds.minY, bounds.maxY);

    window.nameplateState[`${dragState.selectedText}OffsetX`] = newOffsetX;
    window.nameplateState[`${dragState.selectedText}OffsetY`] = newOffsetY;

    // 更新滑塊
    document.getElementById(`${dragState.selectedText}OffsetX`).value = newOffsetX;
    document.getElementById(`${dragState.selectedText}OffsetY`).value = newOffsetY;
    updateOffsetDisplay(`${dragState.selectedText}OffsetXValue`, newOffsetX);
    updateOffsetDisplay(`${dragState.selectedText}OffsetYValue`, newOffsetY);
    
    // 更新number input
    document.getElementById(`${dragState.selectedText}OffsetXInput`).value = newOffsetX;
    document.getElementById(`${dragState.selectedText}OffsetYInput`).value = newOffsetY;

    triggerRender();
    
    e.preventDefault(); // 防止頁面滾動
}

function handleCanvasTouchEnd(e) {
    if (dragState.isDragging) {
        dragState.isDragging = false;
        dragState.selectedText = null;
        saveSettings();
        showNotification('位置已調整', 'success');
    }
}

function getTextLabel(type) {
    const labels = {
        name: '姓名',
        company: '公司',
        position: '職位',
        qrcode: 'QRCode'
    };
    return labels[type] || type;
}

async function handleBatchCsvImport(e) {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    try {
        const rows = await parseBatchSpreadsheet(file);
        const sourceLabel = file.name.toLowerCase().endsWith('.csv') ? 'CSV' : '試算表';
        const headers = validateBatchHeaders(rows, sourceLabel);

        const records = buildBatchRecords(headers, rows.slice(1));
        updateBatchJobState(file.name, headers, records);

        setBatchStatus(`已匯入 ${file.name}。可先逐筆套用預覽，再執行批量下載。`);
        showNotification(`批次名單已載入，共 ${records.length} 筆`, 'success');
    } catch (error) {
        batchJobState = createEmptyBatchJobState();
        document.getElementById('batchCsvInput').value = '';
        renderBatchPreview();
        setBatchStatus('批次匯入失敗，請確認欄位名稱與檔案格式。');
        showNotification(`檔案解析失敗: ${error.message}`, 'error');
    }
}

function handleBatchTemplateDownload() {
    const link = document.createElement('a');
    link.href = 'batch-test.csv';
    link.download = 'batch-test.csv';
    link.click();
}

function handleBatchClear() {
    batchJobState = createEmptyBatchJobState();
    document.getElementById('batchCsvInput').value = '';
    renderBatchPreview();
    setBatchStatus('批次名單已清除。');
}

async function handleBatchReportDownload() {
    if (!batchJobState.lastResults.length) {
        showNotification('目前沒有可下載的批量結果報表', 'info');
        return;
    }

    const reportContent = buildBatchReportCsv();
    const reportBlob = new Blob([reportContent], { type: 'text/csv;charset=utf-8;' });
    const reportFileName = buildBatchReportFileName();

    await triggerBlobDownload(reportFileName, reportBlob);
    showNotification(`已下載結果報表: ${reportFileName}`, 'success');
}

function handleBatchPreviewAction(e) {
    const applyButton = e.target.closest('[data-record-index]');
    if (!applyButton) {
        return;
    }

    const index = parseInt(applyButton.dataset.recordIndex, 10);
    const record = batchJobState.records[index];
    if (!record || record.errors.length) {
        return;
    }

    const template = createBatchTemplateState();
    const nextState = createStateFromBatchRecord(template.state, record);
    window.nameplateState = nextState;
    syncControlsFromState(nextState, template.opacity);
    triggerRender();
    setBatchStatus(`已套用第 ${record.rowNumber} 列到編輯器，可直接檢查版面。`);
    showNotification(`已套用 ${record.name} 的資料`, 'info');
}

async function handleBatchExport() {
    await runBatchExport(batchJobState.validRecords, 'replace');
}

async function handleBatchRetryFailed() {
    const retryRecords = getRetryableBatchRecords();
    if (!retryRecords.length) {
        showNotification('目前沒有可重試的失敗列', 'info');
        return;
    }

    await runBatchExport(retryRecords, 'merge');
}

async function runBatchExport(records, resultMode) {
    if (!records.length) {
        showNotification('沒有可匯出的有效資料', 'error');
        return;
    }

    if (!batchJobState.validRecords.length) {
        showNotification('沒有可匯出的有效資料', 'error');
        return;
    }

    const template = createBatchTemplateState();
    const timestamp = new Date().toISOString().slice(0, 10);
    const results = [];
    const zipArchive = createBatchZipArchive();

    showLoading(true);
    setBatchStatus(`開始輸出 ${records.length} 筆資料...`);

    try {
        for (let index = 0; index < records.length; index += 1) {
            const record = records[index];
            const nextState = createStateFromBatchRecord(template.state, record);
            const fileName = `nameplate_${sanitizeFileNamePart(record.name)}_${timestamp}.png`;

            try {
                await prepareBatchQrCode(record, template);
                applyStateToCanvasOnly(nextState);
                await waitForNextFrame();

                const blob = await exportBlobFromCurrentCanvas();
                zipArchive.file(fileName, blob);

                results.push({
                    rowNumber: record.rowNumber,
                    fileName,
                    success: true,
                    message: '輸出完成'
                });
            } catch (error) {
                console.error('單筆批量輸出失敗:', record, error);
                results.push({
                    rowNumber: record.rowNumber,
                    fileName,
                    success: false,
                    message: error.message || '未知錯誤'
                });
            }

            setBatchStatus(`已處理 ${index + 1}/${records.length}: ${record.name}`);
        }

        updateBatchResults(results, resultMode);

        const successCount = results.filter(result => result.success).length;
        const failedCount = results.length - successCount;

        if (failedCount > 0) {
            showNotification(`批量輸出完成，成功 ${successCount} 筆，失敗 ${failedCount} 筆`, 'info');
        } else {
            showNotification(`批量輸出完成，共 ${successCount} 筆`, 'success');
        }

        if (successCount > 0) {
            const zipBlob = await generateBatchZipBlob(zipArchive);
            const zipFileName = buildBatchArchiveFileName(timestamp);
            await triggerBlobDownload(zipFileName, zipBlob);
            setBatchStatus(`批量輸出完成，已下載 ZIP：${zipFileName}；若有失敗列，可直接重試。`);
        } else {
            setBatchStatus('批量輸出未產生任何成功檔案；請修正失敗列後重試。');
        }
    } finally {
        restoreTemplateState(template);
        showLoading(false);
    }
}

// ========== 操作處理 ==========
function handleDownload() {
    const name = window.nameplateState.name || 'nameplate';
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `nameplate_${name}_${timestamp}.png`;
    
    try {
        window.renderer.exportPNG(filename);
        showNotification(`已下載: ${filename}`, 'success');
    } catch (err) {
        console.error('下載失敗:', err);
        showNotification('下載失敗，請重試', 'error');
    }
}

function handleReset() {
    if (confirm('確定要重置所有設定?')) {
        // 重置表單
        document.getElementById('nameInput').value = '名子';
        document.getElementById('companyInput').value = '公司名稱';
        document.getElementById('positionInput').value = '職位名稱';
        document.getElementById('bgColorInput').value = '#ffffff';
        document.getElementById('textColorInput').value = '#000000';
        document.getElementById('nameFontSize').value = 48;
        document.getElementById('companyFontSize').value = 24;
        document.getElementById('positionFontSize').value = 24;
        document.getElementById('bgOpacity').value = 100;
        document.getElementById('textShadow').checked = false;
        document.getElementById('nameOffsetX').value = 0;
        document.getElementById('nameOffsetY').value = 0;
        document.getElementById('companyOffsetX').value = 0;
        document.getElementById('companyOffsetY').value = 0;
        document.getElementById('positionOffsetX').value = 0;
        document.getElementById('positionOffsetY').value = 0;
        document.getElementById('qrcodeOffsetX').value = 320;
        document.getElementById('qrcodeOffsetY').value = 0;
        document.getElementById('qrcodeOffsetXInput').value = 320;
        document.getElementById('qrcodeOffsetYInput').value = 0;
        document.getElementById('qrSize').value = 100;
        document.getElementById('qrSizeValue').textContent = '100px';
        document.getElementById('qrUrlInput').value = '';

        // 重置狀態
        window.nameplateState = {
            name: '名子',
            company: '公司名稱',
            position: '職位名稱',
            bgColor: '#ffffff',
            nameFontSize: 48,
            companyFontSize: 24,
            positionFontSize: 24,
            textColor: '#000000',
            textShadow: false,
            nameOffsetX: 0,
            nameOffsetY: 0,
            companyOffsetX: 0,
            companyOffsetY: 0,
            positionOffsetX: 0,
            positionOffsetY: 0,
            qrcodeOffsetX: 320,
            qrcodeOffsetY: 0,
            qrSize: 100
        };

        // 清除圖片
        handleClearImage();

        // 更新UI
        document.getElementById('colorValue').textContent = '#ffffff';
        document.getElementById('textColorValue').textContent = '#000000';
        document.getElementById('nameFontSizeValue').textContent = '48px';
        document.getElementById('companyFontSizeValue').textContent = '24px';
        document.getElementById('positionFontSizeValue').textContent = '24px';
        document.getElementById('opacityValue').textContent = '100%';
        updateOffsetDisplay('nameOffsetXValue', 0);
        updateOffsetDisplay('nameOffsetYValue', 0);
        updateOffsetDisplay('companyOffsetXValue', 0);
        updateOffsetDisplay('companyOffsetYValue', 0);
        updateOffsetDisplay('positionOffsetXValue', 0);
        updateOffsetDisplay('positionOffsetYValue', 0);
        updateOffsetDisplay('qrcodeOffsetXValue', 320);
        updateOffsetDisplay('qrcodeOffsetYValue', 0);
        
        // 重置number input
        document.getElementById('nameOffsetXInput').value = 0;
        document.getElementById('nameOffsetYInput').value = 0;
        document.getElementById('companyOffsetXInput').value = 0;
        document.getElementById('companyOffsetYInput').value = 0;
        document.getElementById('positionOffsetXInput').value = 0;
        document.getElementById('positionOffsetYInput').value = 0;
        document.getElementById('qrcodeOffsetXInput').value = 320;
        document.getElementById('qrcodeOffsetYInput').value = 0;

        // 清除 QRCode
        handleClearQrCode();
        
        updateCharCount(0);

        triggerRender();
        localStorage.removeItem('nameplateSettings');
        showNotification('已重置所有設定', 'info');
    }
}

// ========== 快速預設處理 ==========
function handlePresetClick(e) {
    const presetName = e.target.dataset.preset;
    const preset = presets[presetName];

    if (!preset) return;

    // 應用預設
    window.nameplateState.bgColor = preset.bgColor;
    window.nameplateState.nameFontSize = preset.nameFontSize;
    window.nameplateState.companyFontSize = preset.companyFontSize;
    window.nameplateState.positionFontSize = preset.positionFontSize;
    window.nameplateState.textColor = preset.textColor;
    window.nameplateState.textShadow = preset.textShadow;

    // 更新表單
    document.getElementById('bgColorInput').value = preset.bgColor;
    document.getElementById('nameFontSize').value = preset.nameFontSize;
    document.getElementById('companyFontSize').value = preset.companyFontSize;
    document.getElementById('positionFontSize').value = preset.positionFontSize;
    document.getElementById('textColorInput').value = preset.textColor;
    document.getElementById('textShadow').checked = preset.textShadow;

    // 更新顯示值
    document.getElementById('colorValue').textContent = preset.bgColor;
    document.getElementById('nameFontSizeValue').textContent = `${preset.nameFontSize}px`;
    document.getElementById('companyFontSizeValue').textContent = `${preset.companyFontSize}px`;
    document.getElementById('positionFontSizeValue').textContent = `${preset.positionFontSize}px`;
    document.getElementById('textColorValue').textContent = preset.textColor;

    // 更新按鈕狀態
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');

    triggerRender();
    saveSettings();
    showNotification(`已應用預設: ${getPresetLabel(presetName)}`, 'info');
}

function getPresetLabel(presetName) {
    const labels = {
        corporate: '企業風格',
        blue: '藍色優雅',
        modern: '現代簡約',
        tech: '科技感'
    };
    return labels[presetName] || presetName;
}

// ========== 存儲和加載設置 ==========
// ========== 尺寸比例 ==========
let currentAspectRatio = { w: 10, h: 3 };

function applyAspectRatio(w, h) {
    const canvasWidth = 1000;
    const canvasHeight = Math.round(canvasWidth * h / w);
    const canvas = document.getElementById('nameplate');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    currentAspectRatio = { w, h };

    const sizeText = `目前尺寸: ${canvasWidth}×${canvasHeight} px`;
    const canvasSizeInfo = document.getElementById('canvasSizeInfo');
    if (canvasSizeInfo) canvasSizeInfo.textContent = sizeText;
    const previewSizeInfo = document.getElementById('previewSizeInfo');
    if (previewSizeInfo) previewSizeInfo.textContent = `預覽尺寸: ${canvasWidth}×${canvasHeight} px`;

    updateTextPositionControlRanges();

    triggerRender();
    saveSettings();
}

function saveSettings() {
    try {
        syncPhilipsControlsToState();
        const settings = {
            state: window.nameplateState,
            opacity: document.getElementById('bgOpacity').value,
            bgImageDataUrl: bgImageDataUrl,
            qrCodeDataUrl: qrCodeDataUrl,
            aspectRatio: currentAspectRatio,
            philips: philipsControlState
        };
        localStorage.setItem('nameplateSettings', JSON.stringify(settings));
    } catch (err) {
        console.error('保存設置失敗:', err);
    }
}

function normalizeFontSizes(state) {
    const legacyBaseSize = parseInt(state.fontSize || 48);
    if (!state.nameFontSize) {
        state.nameFontSize = legacyBaseSize;
    }
    if (!state.companyFontSize) {
        state.companyFontSize = Math.round(legacyBaseSize * 0.5);
    }
    if (!state.positionFontSize) {
        state.positionFontSize = Math.round(legacyBaseSize * 0.5);
    }
}

function normalizeQrState(state) {
    if (state.qrSize == null) state.qrSize = 100;
    if (state.qrcodeOffsetX == null) state.qrcodeOffsetX = 320;
    if (state.qrcodeOffsetY == null) state.qrcodeOffsetY = 0;
}

function normalizeTextOffsetState(state) {
    if (state.nameOffsetX == null) state.nameOffsetX = 0;
    if (state.nameOffsetY == null) state.nameOffsetY = 0;
    if (state.companyOffsetX == null) state.companyOffsetX = 0;
    if (state.companyOffsetY == null) state.companyOffsetY = 0;
    if (state.positionOffsetX == null) state.positionOffsetX = 0;
    if (state.positionOffsetY == null) state.positionOffsetY = 0;

    const isLegacyDefaultOffsets =
        state.nameOffsetX === 0 &&
        state.nameOffsetY === 0 &&
        state.companyOffsetX === 0 &&
        state.companyOffsetY === 100 &&
        state.positionOffsetX === 0 &&
        state.positionOffsetY === -100;

    if (isLegacyDefaultOffsets) {
        state.companyOffsetY = 0;
        state.positionOffsetY = 0;
    }
}

function syncControlsFromState(state, opacity = 100) {
    normalizeFontSizes(state);
    normalizeQrState(state);
    normalizeTextOffsetState(state);

    document.getElementById('nameInput').value = state.name || '';
    document.getElementById('companyInput').value = state.company || '';
    document.getElementById('positionInput').value = state.position || '';
    document.getElementById('bgColorInput').value = state.bgColor;
    document.getElementById('textColorInput').value = state.textColor;
    document.getElementById('nameFontSize').value = state.nameFontSize;
    document.getElementById('companyFontSize').value = state.companyFontSize;
    document.getElementById('positionFontSize').value = state.positionFontSize;
    document.getElementById('bgOpacity').value = opacity;
    document.getElementById('textShadow').checked = state.textShadow;

    document.getElementById('nameOffsetX').value = state.nameOffsetX || 0;
    document.getElementById('nameOffsetY').value = state.nameOffsetY || 0;
    document.getElementById('companyOffsetX').value = state.companyOffsetX || 0;
    document.getElementById('companyOffsetY').value = state.companyOffsetY || 0;
    document.getElementById('positionOffsetX').value = state.positionOffsetX || 0;
    document.getElementById('positionOffsetY').value = state.positionOffsetY || 0;
    document.getElementById('qrcodeOffsetX').value = state.qrcodeOffsetX || 0;
    document.getElementById('qrcodeOffsetY').value = state.qrcodeOffsetY || 0;
    document.getElementById('qrSize').value = state.qrSize || 100;

    document.getElementById('colorValue').textContent = state.bgColor;
    document.getElementById('textColorValue').textContent = state.textColor;
    document.getElementById('nameFontSizeValue').textContent = `${state.nameFontSize}px`;
    document.getElementById('companyFontSizeValue').textContent = `${state.companyFontSize}px`;
    document.getElementById('positionFontSizeValue').textContent = `${state.positionFontSize}px`;
    document.getElementById('opacityValue').textContent = `${opacity}%`;
    updateOffsetDisplay('nameOffsetXValue', state.nameOffsetX || 0);
    updateOffsetDisplay('nameOffsetYValue', state.nameOffsetY || 0);
    updateOffsetDisplay('companyOffsetXValue', state.companyOffsetX || 0);
    updateOffsetDisplay('companyOffsetYValue', state.companyOffsetY || 0);
    updateOffsetDisplay('positionOffsetXValue', state.positionOffsetX || 0);
    updateOffsetDisplay('positionOffsetYValue', state.positionOffsetY || 0);
    updateOffsetDisplay('qrcodeOffsetXValue', state.qrcodeOffsetX || 0);
    updateOffsetDisplay('qrcodeOffsetYValue', state.qrcodeOffsetY || 0);
    document.getElementById('qrSizeValue').textContent = `${state.qrSize || 100}px`;

    document.getElementById('nameOffsetXInput').value = state.nameOffsetX || 0;
    document.getElementById('nameOffsetYInput').value = state.nameOffsetY || 0;
    document.getElementById('companyOffsetXInput').value = state.companyOffsetX || 0;
    document.getElementById('companyOffsetYInput').value = state.companyOffsetY || 0;
    document.getElementById('positionOffsetXInput').value = state.positionOffsetX || 0;
    document.getElementById('positionOffsetYInput').value = state.positionOffsetY || 0;
    document.getElementById('qrcodeOffsetXInput').value = state.qrcodeOffsetX || 0;
    document.getElementById('qrcodeOffsetYInput').value = state.qrcodeOffsetY || 0;

    updateTextPositionControlRanges();
    updateCharCount((state.name || '').length);
}

function loadPreferredSettings() {
    try {
        const saved = localStorage.getItem('nameplateSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            window.nameplateState = settings.state;
            normalizeFontSizes(window.nameplateState);
            normalizeQrState(window.nameplateState);
            normalizeTextOffsetState(window.nameplateState);
            bgImageDataUrl = settings.bgImageDataUrl || null;
            qrCodeDataUrl = settings.qrCodeDataUrl || null;
            philipsControlState = normalizePhilipsControlState(settings.philips);

            syncControlsFromState(settings.state, settings.opacity || 100);
            syncPhilipsControlsFromState();

            // 還原比例
            if (settings.aspectRatio) {
                const { w, h } = settings.aspectRatio;
                const canvas = document.getElementById('nameplate');
                canvas.width = 1000;
                canvas.height = Math.round(1000 * h / w);
                currentAspectRatio = { w, h };
                // 同步 UI
                document.getElementById('customRatioW').value = w;
                document.getElementById('customRatioH').value = h;
                document.querySelectorAll('.ratio-btn').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.w) === w && parseInt(btn.dataset.h) === h);
                });
                const canvasHeight = canvas.height;
                const canvasSizeInfo = document.getElementById('canvasSizeInfo');
                if (canvasSizeInfo) canvasSizeInfo.textContent = `目前尺寸: 1000×${canvasHeight} px`;
                const previewSizeInfo = document.getElementById('previewSizeInfo');
                if (previewSizeInfo) previewSizeInfo.textContent = `預覽尺寸: 1000×${canvasHeight} px`;
            }

            if (bgImageDataUrl) {
                window.renderer.setBackgroundImageDataUrl(bgImageDataUrl);
                const preview = document.getElementById('imagePreview');
                preview.innerHTML = `<img src="${bgImageDataUrl}" alt="背景預覽">`;
                preview.classList.add('has-image');
                document.getElementById('clearImageBtn').style.display = 'block';
            } else {
                document.getElementById('bgImageInput').value = '';
                window.renderer.clearBackgroundImage();
                const preview = document.getElementById('imagePreview');
                preview.innerHTML = '<span>未選擇圖片</span>';
                preview.classList.remove('has-image');
                document.getElementById('clearImageBtn').style.display = 'none';
            }

            if (qrCodeDataUrl) {
                window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
                updateQrPreview(qrCodeDataUrl);
            } else {
                document.getElementById('qrImageInput').value = '';
                document.getElementById('qrUrlInput').value = '';
                window.renderer.clearQrCode();
                const qrPreview = document.getElementById('qrPreview');
                qrPreview.innerHTML = '<span>未設定 QRCode</span>';
                qrPreview.classList.remove('has-image');
                document.getElementById('clearQrBtn').style.display = 'none';
            }

            triggerRender();
        } else {
            syncControlsFromState(window.nameplateState, document.getElementById('bgOpacity').value || 100);
            bgImageDataUrl = null;
            qrCodeDataUrl = null;
            philipsControlState = normalizePhilipsControlState();
            syncPhilipsControlsFromState();
        }
    } catch (err) {
        console.error('加載設置失敗:', err);
        philipsControlState = normalizePhilipsControlState();
        syncPhilipsControlsFromState();
    }
}

// ========== UI 輔助函数 ==========
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.style.display = 'flex';
    } else {
        loading.style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// ========== 輔助功能 ==========
// 支援鍵盤快捷鍵
document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S - 下載
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleDownload();
    }
});

// ========== 深色模式 ==========
/**
 * 初始化深色模式
 */
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    updateThemeIcon();
}

/**
 * 設置主題
 */
function setTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    }
    updateThemeIcon();
}

/**
 * 更新主題圖標
 */
function updateThemeIcon() {
    const html = document.documentElement;
    const icon = document.querySelector('.theme-icon');
    const isDark = html.getAttribute('data-theme') === 'dark';
    
    if (icon) {
        icon.textContent = isDark ? 'Light mode' : 'Dark mode';
    }
}

/**
 * 切換深色模式
 */
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
}
