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
const DEFAULT_QR_SAMPLE_URL = 'https://github.com/catagain/nameplate_design_webpage';
let batchJobState = createEmptyBatchJobState();
let preferredPasteImageTarget = 'background';
let directUploadImageFile = null;

const BATCH_REQUIRED_COLUMNS = ['name', 'company', 'position'];
const BATCH_OPTIONAL_COLUMNS = ['deviceTarget', 'deviceId', 'meetingId', 'qrUrl'];
const PHILIPS_API_PREFIX = '/api/tableside/v1';
const PHILIPS_DISCOVERY_API = '/api/philips/discover';
const PHILIPS_PROXY_API = '/api/philips/proxy';
const PHILIPS_DEVICES_API = '/api/philips/devices';
const PHILIPS_JPEG_MAX_BYTES = 750 * 1024;
const PHILIPS_JPEG_MAX_WIDTH = 800;
const PHILIPS_JPEG_MAX_HEIGHT = 480;
const DEVICE_DISCOVERY_REFRESH_MS = 30000;
const DISCOVERED_HEARTBEAT_SYNC_RETRY_MS = 10 * 60 * 1000;
const DUAL_DISPLAY_UPDATE_DELAY_MS = 350;
const UNDO_HISTORY_LIMIT = 80;
const DEFAULT_OBJECT_IDS = ['default-name', 'default-company', 'default-position', 'default-qrcode'];

// ========== 推薦選項配置 ==========
const RECOMMENDED_BG_COLORS = [
    { name: '深藍', value: '#1e3a5f' },
    { name: '深靛', value: '#0f172a' },
    { name: '純黑', value: '#000000' },
    { name: '純白', value: '#ffffff' },
    { name: '深紅', value: '#7f1d1d' },
    { name: '深紫', value: '#4c1d95' },
    { name: '灰藍', value: '#475569' },
    { name: '深褐', value: '#451a03' },
    { name: '深綠', value: '#064e3b' },
    { name: '深橘', value: '#c2410c' },
    { name: '正紅', value: '#ff0000' },
    { name: '正藍', value: '#0000ff' },
    { name: '正綠', value: '#00ff00' },
    { name: '正黃', value: '#ffff00' },
    { name: '紫色', value: '#800080' },
    { name: '深青', value: '#083344' },
    { name: '深金', value: '#854d0e' },
    { name: '橄欖綠', value: '#3f6212' },
];

const RECOMMENDED_TEXT_COLORS = [
    { name: '純白', value: '#ffffff' },
    { name: '純黑', value: '#000000' },
    { name: '金黃', value: '#fef08a' },
    { name: '亮黃', value: '#fde047' },
    { name: '亮綠', value: '#86efac' },
    { name: '亮藍', value: '#93c5fd' },
    { name: '亮紅', value: '#fca5a5' },
    { name: '薄荷綠', value: '#a7f3d0' },
    { name: '淡紫', value: '#ddd6fe' },
    { name: '淺橘', value: '#fed7aa' },
    { name: '珍珠白', value: '#fafaf9' },
    { name: '正紅', value: '#ff0000' },
    { name: '正藍', value: '#0000ff' },
    { name: '正綠', value: '#00ff00' },
    { name: '正黃', value: '#ffff00' },
    { name: '紫色', value: '#800080' },
];

const COLOR_PALETTE_BASES = [
    { name: '純黑', h: 0, s: 0, l: 0 },
    { name: '深藍', h: 215, s: 65, l: 22 },
    { name: '深紅', h: 0, s: 70, l: 28 },
    { name: '深紫', h: 270, s: 60, l: 30 },
    { name: '深綠', h: 150, s: 55, l: 22 },
    { name: '深青', h: 190, s: 60, l: 24 },
    { name: '深橘', h: 25, s: 75, l: 35 },
    { name: '深金', h: 45, s: 65, l: 30 },
    { name: '深褐', h: 20, s: 55, l: 24 },
    { name: '純白', h: 0, s: 0, l: 100 },
];

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function generateCirclePaletteHTML(currentValue) {
    let html = '<div class="palette-row">';
    for (const base of COLOR_PALETTE_BASES) {
        const hex = hslToHex(base.h, base.s, base.l);
        const isActive = hex.toUpperCase() === (currentValue || '').toUpperCase();
        html += `<div class="rec-option${isActive ? ' is-active' : ''}" data-value="${hex}" title="${hex} ${base.name}">`;
        html += `<div class="rec-color" style="background-color:${hex}"></div></div>`;
    }
    html += '</div><div class="palette-row">';
    for (const base of COLOR_PALETTE_BASES) {
        const lightL = Math.min(92, base.l + 42);
        const hex = hslToHex(base.h, base.s, lightL);
        const isActive = hex.toUpperCase() === (currentValue || '').toUpperCase();
        html += `<div class="rec-option${isActive ? ' is-active' : ''}" data-value="${hex}" title="${hex} ${base.name}（淡色）">`;
        html += `<div class="rec-color" style="background-color:${hex}"></div></div>`;
    }
    html += '</div>';
    return html;
}

const RECOMMENDED_FONTS = [
    { name: '微軟正黑體', value: "'Microsoft JhengHei', '微軟正黑體', sans-serif" },
    { name: 'Noto Sans TC', value: "'Noto Sans TC', sans-serif" },
    { name: '襯線體', value: 'serif' },
    { name: '無襯線體', value: 'sans-serif' },
];

let philipsControlState = createDefaultPhilipsControlState();
let philipsDiscoveryIntervalId = null;
let discoveredHeartbeatSyncCache = new Map();
let undoHistoryStack = [];
let redoHistoryStack = [];
let lastSavedSnapshotKey = null;
let lastSavedSnapshot = null;
let isApplyingUndoState = false;
let autoApplyRatioTimer = null;
let autoApplyCanvasSizeTimer = null;
let selectedObjectId = 'default-name';
let draggedObjectId = null;
let isContinuousRangeAdjusting = false;
let rangeAdjustSnapshotPushed = false;

function generateObjectId(prefix = 'obj') {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function ensureObjectState(state = window.nameplateState) {
    if (!state) {
        return;
    }

    if (!state.objectVisibility || typeof state.objectVisibility !== 'object') {
        state.objectVisibility = {};
    }

    DEFAULT_OBJECT_IDS.forEach(objectId => {
        if (state.objectVisibility[objectId] == null) {
            state.objectVisibility[objectId] = true;
        }
    });

    if (!Array.isArray(state.customObjects)) {
        state.customObjects = [];
    }

    const allObjectIds = [
        ...DEFAULT_OBJECT_IDS,
        ...state.customObjects
            .filter(item => item && item.id)
            .map(item => item.id)
    ];

    const uniqueOrder = Array.isArray(state.objectOrder)
        ? state.objectOrder.filter((id, index, array) => id && array.indexOf(id) === index)
        : [];

    state.objectOrder = uniqueOrder.filter(id => allObjectIds.includes(id));
    allObjectIds.forEach(id => {
        if (!state.objectOrder.includes(id)) {
            state.objectOrder.push(id);
        }
    });
}

function getCustomObjectById(objectId, state = window.nameplateState) {
    ensureObjectState(state);
    return state.customObjects.find(item => item.id === objectId) || null;
}

function getObjectDisplayLabel(objectMeta) {
    if (objectMeta && objectMeta.displayLabel) {
        return objectMeta.displayLabel;
    }

    if (!objectMeta) {
        return '';
    }

    if (objectMeta.type === 'text') {
        const rawText = String(objectMeta.text || '').trim();
        return rawText || '（空白文字）';
    }

    if (objectMeta.type === 'qr') {
        return 'QRCode';
    }

    if (objectMeta.type === 'image') {
        return '小圖片';
    }

    return objectMeta.type || objectMeta.id;
}

function getDefaultTextFieldByObjectId(objectId) {
    const mapping = {
        'default-name': 'name',
        'default-company': 'company',
        'default-position': 'position'
    };

    return mapping[objectId] || '';
}

function getDefaultFontSizeFieldByObjectId(objectId) {
    const mapping = {
        'default-name': 'nameFontSize',
        'default-company': 'companyFontSize',
        'default-position': 'positionFontSize'
    };

    return mapping[objectId] || '';
}

function getDefaultTextColorFieldByObjectId(objectId) {
    const mapping = {
        'default-name': 'nameTextColor',
        'default-company': 'companyTextColor',
        'default-position': 'positionTextColor'
    };

    return mapping[objectId] || '';
}

function getDefaultTextShadowFieldByObjectId(objectId) {
    const mapping = {
        'default-name': 'nameTextShadow',
        'default-company': 'companyTextShadow',
        'default-position': 'positionTextShadow'
    };

    return mapping[objectId] || '';
}

function getObjectIdFromSelectionToken(token) {
    if (isCustomObjectToken(token)) {
        return getObjectIdFromToken(token);
    }

    const mapping = {
        name: 'default-name',
        company: 'default-company',
        position: 'default-position',
        qrcode: 'default-qrcode'
    };

    return mapping[token] || null;
}

function isObjectVisible(objectId, state = window.nameplateState) {
    ensureObjectState(state);

    if (DEFAULT_OBJECT_IDS.includes(objectId)) {
        return state.objectVisibility[objectId] !== false;
    }

    const objectMeta = getCustomObjectById(objectId, state);
    return objectMeta ? objectMeta.visible !== false : false;
}

function setObjectVisibility(objectId, visible, state = window.nameplateState) {
    ensureObjectState(state);

    if (DEFAULT_OBJECT_IDS.includes(objectId)) {
        state.objectVisibility[objectId] = Boolean(visible);
        return;
    }

    const objectMeta = getCustomObjectById(objectId, state);
    if (objectMeta) {
        objectMeta.visible = Boolean(visible);
    }
}

function getObjectEntries(state = window.nameplateState) {
    ensureObjectState(state);
    const list = [];
    let qrCounter = 0;
    let imageCounter = 0;
    const customObjectMap = new Map(
        state.customObjects
            .filter(item => item && item.id)
            .map(item => [item.id, item])
    );

    state.objectOrder.forEach(objectId => {
        if (DEFAULT_OBJECT_IDS.includes(objectId)) {
            const type = objectId === 'default-qrcode' ? 'qr' : 'text';
            let displayLabel = '';

            if (type === 'text') {
                const textField = getDefaultTextFieldByObjectId(objectId);
                displayLabel = String(state[textField] || '').trim() || '（空白文字）';
            } else {
                qrCounter += 1;
                displayLabel = `QRCode ${qrCounter}`;
            }

            list.push({
                id: objectId,
                isDefault: true,
                type,
                visible: isObjectVisible(objectId, state),
                displayLabel
            });
            return;
        }

        const objectMeta = customObjectMap.get(objectId);
        if (!objectMeta) {
            return;
        }

        let displayLabel = '';
        if (objectMeta.type === 'text') {
            displayLabel = String(objectMeta.text || '').trim() || '（空白文字）';
        } else if (objectMeta.type === 'qr') {
            qrCounter += 1;
            displayLabel = `QRCode ${qrCounter}`;
        } else if (objectMeta.type === 'image') {
            imageCounter += 1;
            displayLabel = `小圖片 ${imageCounter}`;
        } else {
            displayLabel = getObjectDisplayLabel(objectMeta);
        }

        list.push({ ...objectMeta, visible: objectMeta.visible !== false, displayLabel });
    });

    return list;
}

function moveObjectLayer(objectId, direction) {
    if (!objectId || !direction) {
        return false;
    }

    ensureObjectState();

    const currentIndex = window.nameplateState.objectOrder.indexOf(objectId);
    if (currentIndex < 0) {
        return false;
    }

    const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= window.nameplateState.objectOrder.length) {
        return false;
    }

    const order = [...window.nameplateState.objectOrder];
    const [moved] = order.splice(currentIndex, 1);
    order.splice(targetIndex, 0, moved);
    window.nameplateState.objectOrder = order;
    return true;
}

function getSelectedObjectMeta(state = window.nameplateState) {
    if (!selectedObjectId) {
        return null;
    }

    const objectEntries = getObjectEntries(state);
    return objectEntries.find(item => item.id === selectedObjectId) || null;
}

function selectObject(objectId, options = {}) {
    selectedObjectId = objectId || null;
    renderObjectManagerList();

    if (options.focusTextEditor) {
        requestAnimationFrame(() => {
            const textGroup = document.getElementById('objectEditTextGroup');
            const textInput = document.getElementById('objectEditTextInput');
            if (!textGroup || textGroup.hidden || !textInput) {
                return;
            }

            textInput.focus();
            textInput.select();
        });
    }
}

function beginContinuousRangeAdjust() {
    isContinuousRangeAdjusting = true;
    rangeAdjustSnapshotPushed = false;
}

function endContinuousRangeAdjust() {
    isContinuousRangeAdjusting = false;
    rangeAdjustSnapshotPushed = false;
}

function renderObjectManagerList() {
    const listNode = document.getElementById('objectManagerList');
    if (!listNode) {
        return;
    }

    const objectSection = document.querySelector('.object-manager-section');
    const settingsPanel = document.getElementById('objectSettingsPanel');
    if (settingsPanel && settingsPanel.parentElement === listNode && objectSection) {
        objectSection.insertBefore(settingsPanel, listNode.nextSibling);
    }

    const objectEntries = getObjectEntries();
    if (!selectedObjectId || !objectEntries.some(item => item.id === selectedObjectId)) {
        selectedObjectId = objectEntries.length > 0 ? objectEntries[0].id : null;
    }

    if (!objectEntries.length) {
        listNode.innerHTML = '<div class="batch-empty-state">目前沒有可編輯物件</div>';
        renderSelectedObjectSettings();
        return;
    }

    const displayEntries = [...objectEntries].reverse();

    listNode.innerHTML = displayEntries.map((item) => `
        <div class="object-manager-item" data-object-id="${escapeHtml(item.id)}" draggable="true">
            <div class="object-manager-row ${item.id === selectedObjectId ? 'is-selected' : ''} ${item.visible === false ? 'is-hidden' : ''}">
                <button type="button" class="object-manager-select" data-action="select" data-object-id="${escapeHtml(item.id)}">${escapeHtml(item.displayLabel || getObjectDisplayLabel(item))}</button>
                <button type="button" class="object-manager-toggle" data-action="toggle-visible" data-object-id="${escapeHtml(item.id)}">${item.visible === false ? '顯示' : '隱藏'}</button>
                <button type="button" class="object-manager-remove" data-action="delete" data-object-id="${escapeHtml(item.id)}">${item.isDefault ? '清除' : '刪除'}</button>
            </div>
        </div>
    `).join('');

    renderSelectedObjectSettings();

    const selectedItemNode = Array.from(listNode.querySelectorAll('.object-manager-item'))
        .find(node => node.dataset.objectId === selectedObjectId);
    if (settingsPanel && selectedItemNode && !settingsPanel.hidden) {
        selectedItemNode.insertAdjacentElement('afterend', settingsPanel);
    }
}

function renderSelectedObjectSettings() {
    const panel = document.getElementById('objectSettingsPanel');
    if (!panel) {
        return;
    }

    const selected = getSelectedObjectMeta();
    if (!selected) {
        panel.hidden = true;
        return;
    }

    panel.hidden = false;
    document.getElementById('objectSettingsTitle').textContent = `物件設定：${selected.displayLabel || getObjectDisplayLabel(selected)}`;

    const visibleToggle = document.getElementById('objectVisibleToggle');
    visibleToggle.checked = selected.visible !== false;

    const isTextObject = selected.type === 'text';
    const isQrObject = selected.type === 'qr';
    const isImageObject = selected.type === 'image';

    document.getElementById('objectEditTextGroup').hidden = !isTextObject;
    document.getElementById('objectEditFontSizeGroup').hidden = !isTextObject;
    document.getElementById('objectEditColorGroup').hidden = !isTextObject;
    document.getElementById('objectEditFontFamilyGroup').hidden = !isTextObject;
    document.getElementById('objectEditShadowGroup').hidden = !isTextObject;
    document.getElementById('objectEditQrGroup').hidden = !isQrObject;
    document.getElementById('objectEditQrSizeGroup').hidden = !isQrObject;
    document.getElementById('objectEditImageWidthGroup').hidden = !isImageObject;
    document.getElementById('objectEditImageLockGroup').hidden = !isImageObject;
    document.getElementById('objectEditImageHeightGroup').hidden = !isImageObject;

    if (isTextObject) {
        const textField = getDefaultTextFieldByObjectId(selected.id);
        const fontSizeField = getDefaultFontSizeFieldByObjectId(selected.id);
        const colorField = getDefaultTextColorFieldByObjectId(selected.id);
        const textValue = selected.isDefault
            ? String(window.nameplateState[textField] || '')
            : String(selected.text || '');
        const fontSizeValue = selected.isDefault
            ? parseInt(window.nameplateState[fontSizeField] || 48, 10)
            : parseInt(selected.fontSize || 48, 10);
        const colorValue = selected.isDefault
            ? (window.nameplateState[colorField] || window.nameplateState.textColor || '#000000')
            : (selected.color || '#000000');
        const fontFamilyValue = selected.isDefault
            ? (window.nameplateState.fontFamily || 'sans-serif')
            : (selected.fontFamily || window.nameplateState.fontFamily || 'sans-serif');
        const shadowField = getDefaultTextShadowFieldByObjectId(selected.id);
        const shadowValue = selected.isDefault
            ? Boolean(window.nameplateState[shadowField])
            : Boolean(selected.textShadow);

        document.getElementById('objectEditTextInput').value = textValue;
        document.getElementById('objectEditFontSize').value = fontSizeValue;
        document.getElementById('objectEditFontSizeValue').textContent = `${fontSizeValue}px`;
        document.getElementById('objectEditColorInput').value = colorValue;
        document.getElementById('objectEditColorValue').textContent = colorValue;
        
        const fontFamilyInput = document.getElementById('objectEditFontFamilyInput');
        fontFamilyInput.innerHTML = RECOMMENDED_FONTS.map(f => `
            <option value="${f.value}" ${fontFamilyValue === f.value ? 'selected' : ''}>${f.name}</option>
        `).join('');
        fontFamilyInput.value = fontFamilyValue;

        document.getElementById('objectEditShadowInput').checked = shadowValue;

        document.getElementById('objectApplyColorAll').checked = false;
        document.getElementById('objectApplyFontAll').checked = false;

        renderObjectRecommendedOptions();
    }

    if (isQrObject) {
        const qrUrl = selected.isDefault
            ? String(document.getElementById('qrUrlInput').value || '')
            : String(selected.qrUrl || '');
        const qrSizeValue = selected.isDefault
            ? parseInt(window.nameplateState.qrSize || 100, 10)
            : parseInt(selected.size || 100, 10);
        document.getElementById('objectEditQrUrlInput').value = qrUrl;
        document.getElementById('objectEditQrSize').value = qrSizeValue;
        document.getElementById('objectEditQrSizeValue').textContent = `${qrSizeValue}px`;
    }

    if (isImageObject) {
        const imageWidthValue = parseInt(selected.width || 120, 10);
        const imageHeightValue = parseInt(selected.height || 120, 10);
        const imageLockRatio = Boolean(selected.lockAspectRatio);
        document.getElementById('objectEditImageWidth').value = imageWidthValue;
        document.getElementById('objectEditImageWidthValue').textContent = `${imageWidthValue}px`;
        document.getElementById('objectEditImageLockRatio').checked = imageLockRatio;
        document.getElementById('objectEditImageHeight').value = imageHeightValue;
        document.getElementById('objectEditImageHeightValue').textContent = `${imageHeightValue}px`;
    }
}

function syncSelectedObjectDisplayLabel() {
    const selected = getSelectedObjectMeta();
    if (!selected) {
        return;
    }

    const label = selected.displayLabel || getObjectDisplayLabel(selected);
    const titleNode = document.getElementById('objectSettingsTitle');
    if (titleNode) {
        titleNode.textContent = `物件設定：${label}`;
    }

    const listNode = document.getElementById('objectManagerList');
    if (!listNode) {
        return;
    }

    const selectedRow = Array.from(listNode.querySelectorAll('.object-manager-item'))
        .find(node => node.dataset.objectId === selectedObjectId);
    const labelButton = selectedRow ? selectedRow.querySelector('.object-manager-select') : null;
    if (labelButton) {
        labelButton.textContent = label;
    }
}

function updateSelectedObjectText(value) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'text') {
        return;
    }

    const textValue = String(value || '').trim();
    if (selected.isDefault) {
        const field = getDefaultTextFieldByObjectId(selected.id);
        if (field) {
            window.nameplateState[field] = textValue;

            const inputId = `${field}Input`;
            const textInput = document.getElementById(inputId);
            if (textInput) {
                textInput.value = textValue;
            }

            if (field === 'name') {
                updateCharCount(textValue.length);
            }
        }
    } else {
        const objectMeta = getCustomObjectById(selected.id);
        if (objectMeta) {
            objectMeta.text = textValue;
        }
    }

    syncSelectedObjectDisplayLabel();
    triggerRender();
    saveSettings();
}

function updateSelectedObjectFontSize(value) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'text') {
        return;
    }

    const fontSize = Math.max(16, Math.min(220, parseInt(value, 10) || 48));

    if (selected.isDefault) {
        const field = getDefaultFontSizeFieldByObjectId(selected.id);
        if (field) {
            window.nameplateState[field] = fontSize;

            const slider = document.getElementById(field);
            const valueText = document.getElementById(`${field}Value`);
            if (slider) slider.value = fontSize;
            if (valueText) valueText.textContent = `${fontSize}px`;
        }
    } else {
        const objectMeta = getCustomObjectById(selected.id);
        if (objectMeta) {
            objectMeta.fontSize = fontSize;
        }
    }

    document.getElementById('objectEditFontSize').value = fontSize;
    document.getElementById('objectEditFontSizeValue').textContent = `${fontSize}px`;
    triggerRender();
    saveSettings();
}

function updateSelectedObjectColor(color) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'text') {
        return;
    }

    const normalizedColor = color || '#000000';
    const applyAll = document.getElementById('objectApplyColorAll')?.checked;

    if (applyAll) {
        // 套用到所有文字物件
        const allTextObjects = getObjectEntries().filter(item => item.type === 'text');
        allTextObjects.forEach(item => {
            if (item.isDefault) {
                const colorField = getDefaultTextColorFieldByObjectId(item.id);
                if (colorField) {
                    window.nameplateState[colorField] = normalizedColor;
                }
            } else {
                const objectMeta = getCustomObjectById(item.id);
                if (objectMeta) {
                    objectMeta.color = normalizedColor;
                }
            }
        });

        // 同步更新預設輸入框
        document.getElementById('textColorInput').value = normalizedColor;
        document.getElementById('textColorValue').textContent = normalizedColor;
    } else {
        // 僅套用到目前選取物件
        if (selected.isDefault) {
            const colorField = getDefaultTextColorFieldByObjectId(selected.id);
            if (colorField) {
                window.nameplateState[colorField] = normalizedColor;
            }
            document.getElementById('textColorInput').value = normalizedColor;
            document.getElementById('textColorValue').textContent = normalizedColor;
        } else {
            const objectMeta = getCustomObjectById(selected.id);
            if (objectMeta) {
                objectMeta.color = normalizedColor;
            }
        }
    }

    document.getElementById('objectEditColorInput').value = normalizedColor;
    document.getElementById('objectEditColorValue').textContent = normalizedColor;
    renderObjectRecommendedOptions();
    triggerRender();
    saveSettings();
}

function updateSelectedObjectFontFamily(fontFamily) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'text') {
        return;
    }

    const applyAll = document.getElementById('objectApplyFontAll')?.checked;

    if (applyAll) {
        // 套用到所有文字物件
        const allTextObjects = getObjectEntries().filter(item => item.type === 'text');
        allTextObjects.forEach(item => {
            if (!item.isDefault) {
                const objectMeta = getCustomObjectById(item.id);
                if (objectMeta) {
                    objectMeta.fontFamily = fontFamily;
                }
            }
        });
        // 預設字體也更新
        window.nameplateState.fontFamily = fontFamily;
        const fontInput = document.getElementById('fontFamilyInput');
        if (fontInput) fontInput.value = fontFamily;
        updateActiveRecOption('recommendedFonts', fontFamily);
    } else {
        // 僅套用到目前選取物件
        if (selected.isDefault) {
            window.nameplateState.fontFamily = fontFamily;
            const fontInput = document.getElementById('fontFamilyInput');
            if (fontInput) fontInput.value = fontFamily;
            updateActiveRecOption('recommendedFonts', fontFamily);
        } else {
            const objectMeta = getCustomObjectById(selected.id);
            if (objectMeta) {
                objectMeta.fontFamily = fontFamily;
            }
        }
    }

    const objectFontInput = document.getElementById('objectEditFontFamilyInput');
    if (objectFontInput) objectFontInput.value = fontFamily;
    renderObjectRecommendedOptions();
    triggerRender();
    saveSettings();
}

function renderObjectRecommendedOptions() {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'text') {
        return;
    }

    const colorContainer = document.getElementById('objectRecommendedTextColors');
    if (colorContainer) {
        const currentColor = selected.isDefault
            ? (window.nameplateState[getDefaultTextColorFieldByObjectId(selected.id)] || window.nameplateState.textColor || '#000000')
            : (selected.color || '#000000');

        colorContainer.innerHTML = generateCirclePaletteHTML(currentColor);

        colorContainer.querySelectorAll('.rec-option').forEach(opt => {
            opt.addEventListener('click', () => updateSelectedObjectColor(opt.dataset.value));
        });
    }

    const fontContainer = document.getElementById('objectRecommendedFonts');
    if (fontContainer) {
        fontContainer.innerHTML = '';
    }
}


function updateSelectedObjectShadow(checked) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'text') {
        return;
    }

    if (selected.isDefault) {
        const shadowField = getDefaultTextShadowFieldByObjectId(selected.id);
        if (shadowField) {
            window.nameplateState[shadowField] = Boolean(checked);
        }
        document.getElementById('textShadow').checked = Boolean(checked);
    } else {
        const objectMeta = getCustomObjectById(selected.id);
        if (objectMeta) {
            objectMeta.textShadow = Boolean(checked);
        }
    }

    document.getElementById('objectEditShadowInput').checked = Boolean(checked);
    triggerRender();
    saveSettings();
}

async function updateSelectedObjectQrUrl() {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'qr') {
        return;
    }

    const qrUrlInput = document.getElementById('objectEditQrUrlInput');
    const qrUrl = String(qrUrlInput.value || '').trim();
    if (!qrUrl) {
        showNotification('請輸入 QRCode 網址', 'error');
        return;
    }

    if (selected.isDefault) {
        document.getElementById('qrUrlInput').value = qrUrl;
        await handleGenerateQrCode();
        renderSelectedObjectSettings();
        return;
    }

    const objectMeta = getCustomObjectById(selected.id);
    if (!objectMeta) {
        return;
    }

    try {
        objectMeta.qrUrl = qrUrl;
        objectMeta.dataUrl = await generateQrCodeDataUrl(qrUrl);
        triggerRender();
        saveSettings();
        showNotification('已更新 QRCode 物件', 'success');
    } catch (error) {
        showNotification(`更新 QRCode 失敗: ${error.message}`, 'error');
    }
}

function updateSelectedObjectQrSize(value) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'qr') {
        return;
    }

    const size = Math.max(40, Math.min(260, parseInt(value, 10) || 100));
    if (selected.isDefault) {
        window.nameplateState.qrSize = size;
        const defaultQrSlider = document.getElementById('qrSize');
        const defaultQrValue = document.getElementById('qrSizeValue');
        if (defaultQrSlider) defaultQrSlider.value = size;
        if (defaultQrValue) defaultQrValue.textContent = `${size}px`;
    } else {
        const objectMeta = getCustomObjectById(selected.id);
        if (objectMeta) {
            objectMeta.size = size;
        }
    }

    document.getElementById('objectEditQrSize').value = size;
    document.getElementById('objectEditQrSizeValue').textContent = `${size}px`;
    triggerRender();
    saveSettings();
}

function updateSelectedObjectImageSize(dimension, value) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'image') {
        return;
    }

    const size = Math.max(20, Math.min(600, parseInt(value, 10) || 120));
    const objectMeta = getCustomObjectById(selected.id);
    if (!objectMeta) {
        return;
    }

    const previousWidth = Math.max(1, parseInt(objectMeta.width || 120, 10));
    const previousHeight = Math.max(1, parseInt(objectMeta.height || 120, 10));
    const ratio = Number(objectMeta.aspectRatio) > 0
        ? Number(objectMeta.aspectRatio)
        : (previousWidth / previousHeight);

    if (dimension === 'width') {
        objectMeta.width = size;
        document.getElementById('objectEditImageWidth').value = size;
        document.getElementById('objectEditImageWidthValue').textContent = `${size}px`;

        if (objectMeta.lockAspectRatio) {
            const syncedHeight = Math.max(20, Math.min(600, Math.round(size / Math.max(0.01, ratio))));
            objectMeta.height = syncedHeight;
            document.getElementById('objectEditImageHeight').value = syncedHeight;
            document.getElementById('objectEditImageHeightValue').textContent = `${syncedHeight}px`;
        } else if ((parseInt(objectMeta.height || 0, 10)) > 0) {
            objectMeta.aspectRatio = objectMeta.width / objectMeta.height;
        }
    } else {
        objectMeta.height = size;
        document.getElementById('objectEditImageHeight').value = size;
        document.getElementById('objectEditImageHeightValue').textContent = `${size}px`;

        if (objectMeta.lockAspectRatio) {
            const syncedWidth = Math.max(20, Math.min(600, Math.round(size * Math.max(0.01, ratio))));
            objectMeta.width = syncedWidth;
            document.getElementById('objectEditImageWidth').value = syncedWidth;
            document.getElementById('objectEditImageWidthValue').textContent = `${syncedWidth}px`;
        }

        if ((parseInt(objectMeta.height || 0, 10)) > 0) {
            objectMeta.aspectRatio = objectMeta.width / objectMeta.height;
        }
    }

    triggerRender();
    saveSettings();
}

function updateSelectedObjectImageAspectLock(checked) {
    const selected = getSelectedObjectMeta();
    if (!selected || selected.type !== 'image') {
        return;
    }

    const objectMeta = getCustomObjectById(selected.id);
    if (!objectMeta) {
        return;
    }

    objectMeta.lockAspectRatio = Boolean(checked);
    if (objectMeta.lockAspectRatio) {
        const width = Math.max(1, parseInt(objectMeta.width || 120, 10));
        const height = Math.max(1, parseInt(objectMeta.height || 120, 10));
        objectMeta.aspectRatio = width / height;
    }

    document.getElementById('objectEditImageLockRatio').checked = Boolean(checked);
    saveSettings();
}

function toggleObjectVisibility(objectId) {
    if (!objectId) {
        return;
    }

    const nextVisible = !isObjectVisible(objectId);
    setObjectVisibility(objectId, nextVisible);
    renderObjectManagerList();
    triggerRender();
    saveSettings();
}

function deleteObjectById(objectId) {
    if (!objectId) {
        return;
    }

    ensureObjectState();

    if (DEFAULT_OBJECT_IDS.includes(objectId)) {
        setObjectVisibility(objectId, false);
    } else {
        window.nameplateState.customObjects = window.nameplateState.customObjects.filter(item => item.id !== objectId);
        window.nameplateState.objectOrder = window.nameplateState.objectOrder.filter(id => id !== objectId);
    }

    const objectEntries = getObjectEntries();
    selectedObjectId = objectEntries.length > 0 ? objectEntries[0].id : null;
    renderObjectManagerList();
    triggerRender();
    saveSettings();
}

// ========== 推薦選項邏輯 ==========
function initRecommendedOptions() {
    const bgContainer = document.getElementById('recommendedBgColors');
    if (bgContainer) {
        bgContainer.innerHTML = generateCirclePaletteHTML();
        bgContainer.querySelectorAll('.rec-option').forEach(opt => {
            opt.addEventListener('click', () => handleRecBgColorClick(opt.dataset.value));
        });
    }

    const textContainer = document.getElementById('recommendedTextColors');
    if (textContainer) {
        textContainer.innerHTML = generateCirclePaletteHTML();
        textContainer.querySelectorAll('.rec-option').forEach(opt => {
            opt.addEventListener('click', () => handleRecTextColorClick(opt.dataset.value));
        });
    }

    const fontContainer = document.getElementById('recommendedFonts');
    if (fontContainer) {
        fontContainer.innerHTML = RECOMMENDED_FONTS.map(f => `
            <div class="rec-option" data-value="${f.value}" title="${f.name}">
                <div class="rec-font" style="font-family: ${f.value}">${f.name}</div>
            </div>
        `).join('');
        fontContainer.querySelectorAll('.rec-option').forEach(opt => {
            opt.addEventListener('click', () => handleRecFontClick(opt.dataset.value));
        });
    }
}

function updateActiveRecOption(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.rec-option').forEach(opt => {
        opt.classList.toggle('is-active', opt.dataset.value === value);
    });
}

function handleRecBgColorClick(color) {
    window.nameplateState.bgColor = color;
    const input = document.getElementById('bgColorInput');
    const display = document.getElementById('colorValue');
    if (input) input.value = color;
    if (display) display.textContent = color;
    updateActiveRecOption('recommendedBgColors', color);
    triggerRender();
    saveSettings();
}

function handleRecTextColorClick(color) {
    window.nameplateState.textColor = color;
    const input = document.getElementById('textColorInput');
    const display = document.getElementById('textColorValue');
    if (input) input.value = color;
    if (display) display.textContent = color;
    updateActiveRecOption('recommendedTextColors', color);
    triggerRender();
    saveSettings();
}

function handleRecFontClick(font) {
    handleFontFamilyChange(font);
}

function handleFontFamilyChange(font) {
    window.nameplateState.fontFamily = font;
    const input = document.getElementById('fontFamilyInput');
    if (input) input.value = font;
    updateActiveRecOption('recommendedFonts', font);
    triggerRender();
    saveSettings();
}

// ========== 分頁切換 ==========
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(content => {
                content.hidden = content.dataset.tab !== targetTab;
            });

            // 同步更新上一頁/下一頁按鈕狀態
            updateTabNavButtons();
        });
    });
}

function switchToTab(tabName) {
    const tab = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (!tab) return;
    tab.click();
}

// ========== 各分頁內上一頁/下一頁按鈕 ==========
function initTabNavigation() {
    // 上一頁 / 下一頁按鈕
    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabs = ['canvas', 'objects', 'device', 'upload'];
            const currentTab = document.querySelector('.tab-content:not([hidden])');
            if (!currentTab) return;
            const currentIdx = tabs.indexOf(currentTab.dataset.tab);
            const dir = btn.dataset.nav;
            const nextIdx = dir === 'next' ? currentIdx + 1 : currentIdx - 1;
            if (nextIdx >= 0 && nextIdx < tabs.length) {
                switchToTab(tabs[nextIdx]);
            }
        });
    });

    // 初始化按鈕狀態
    updateTabNavButtons();
}

function updateTabNavButtons() {
    const tabs = ['canvas', 'objects', 'device', 'upload'];
    const currentTab = document.querySelector('.tab-content:not([hidden])');
    if (!currentTab) return;
    const currentIdx = tabs.indexOf(currentTab.dataset.tab);

    document.querySelectorAll('.tab-nav-btn[data-nav="prev"]').forEach(btn => {
        btn.disabled = currentIdx <= 0;
    });
    document.querySelectorAll('.tab-nav-btn[data-nav="next"]').forEach(btn => {
        btn.disabled = currentIdx >= tabs.length - 1;
    });
}

// ========== 功能提示按鈕（？） ==========
const HELP_SECTION_MAP = [
    { sel: '.edit-section.presets', text: '快速套用專業設計的主題配色與字型設定。' },
    { sel: '.tab-content[data-tab="canvas"] > .edit-section:nth-of-type(2)', text: '調整桌牌畫布的比例與尺寸，建議使用 800×480 px 的標準規格。' },
    { sel: '.tab-content[data-tab="canvas"] > .edit-section:nth-of-type(3)', text: '設定背景顏色或上傳背景圖片，支援透明度調整。' },
    { sel: '.edit-section.object-manager-section', text: '管理所有物件的顯示狀態與圖層順序，點擊可選取或隱藏。' },
    { sel: '.edit-section.device-section', text: '選擇目標桌牌並上傳畫面、觸發 OTA 更新，或查看 API 執行結果。' },
    { sel: '.action-section', text: '直接上傳圖片至桌牌、更新雙面畫面、批量生產或下載 PNG。' },
];

function initSectionHelpButtons() {
    const tooltip = document.getElementById('tab-tooltip');
    const textEl = document.getElementById('tab-tooltip-text');
    if (!tooltip || !textEl) return;

    for (const entry of HELP_SECTION_MAP) {
        const section = document.querySelector(entry.sel);
        if (!section) continue;

        // Find the heading element inside the section
        const heading = section.querySelector('h2, h3');
        if (!heading) continue;

        // Add "?" button
        const btn = document.createElement('span');
        btn.className = 'section-help-btn';
        btn.textContent = '?';
        btn.title = '查看使用說明';
        section.style.position = 'relative';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            textEl.textContent = entry.text;
            tooltip.style.display = 'block';

            // Position tooltip near the button
            const br = btn.getBoundingClientRect();
            let left = br.right + 8;
            let top = br.top - 10;
            const tw = 260;
            if (left + tw > window.innerWidth - 8) {
                left = Math.max(8, br.left - tw - 8);
            }
            if (top < 4) top = 4;
            if (top + 80 > window.innerHeight) top = window.innerHeight - 90;
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';

            const dismiss = (ev) => {
                if (!tooltip.contains(ev.target) && ev.target !== btn) {
                    tooltip.style.display = 'none';
                    document.removeEventListener('click', dismiss, true);
                }
            };
            setTimeout(() => document.addEventListener('click', dismiss, true), 0);
        });

        // Insert after heading
        heading.insertAdjacentElement('afterend', btn);
    }
}

// ========== 預覽面板固定位置 ==========
// 讓預覽面板保持在畫面初始位置，不隨滾動立即上移，
// 直到下方欄位（頁尾）碰觸到才自然被推上去。
function initPreviewStickyPosition() {
    const previewPanel = document.querySelector('.preview-panel');
    if (!previewPanel) return;

    function updateStickyTop() {
        // 清除 inline top，回到自然流位置
        previewPanel.style.removeProperty('top');
        // 強制 reflow 確保 getBoundingClientRect() 是正確的自然位置
        void previewPanel.offsetHeight;
        const rect = previewPanel.getBoundingClientRect();
        // 讓預覽面板保持在初始位置，不隨滾動上移，
        // 直到下方欄位（頁尾）碰觸到才被自然推上去
        const topOffset = Math.max(10, rect.top);
        previewPanel.style.top = topOffset + 'px';
    }

    // DOMContentLoaded 時先設一次
    updateStickyTop();

    // 等所有資源（圖片、字型）載入完成後再修正一次
    window.addEventListener('load', () => {
        requestAnimationFrame(updateStickyTop);
    });

    // 視窗縮放時重新計算
    window.addEventListener('resize', () => {
        requestAnimationFrame(updateStickyTop);
    });
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
    initRenderer();
    attachEventListeners();
    initSectionCollapse();
    updateTextPositionControlRanges();
    loadPreferredSettings();
    initDarkMode();
    initRecommendedOptions();
    initTabs();
    initTabNavigation();
    initSectionHelpButtons();
    initAddObjectModal();
    initPreviewStickyPosition();
    await initPhilipsDeviceDiscovery();
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
    document.getElementById('toggleQrBtn').addEventListener('click', handleToggleQrVisibility);
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
    document.getElementById('fontFamilyInput').addEventListener('change', (e) => handleFontFamilyChange(e.target.value));

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
    document.getElementById('directImageUploadInput').addEventListener('change', handleDirectImageUploadPreview);
    document.getElementById('uploadImageToBothBtn').addEventListener('click', handleUploadImageToBothDisplays);
    document.getElementById('downloadBtn').addEventListener('click', handleDownload);
    document.getElementById('openBatchPageBtn').addEventListener('click', handleOpenBatchPage);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('batchCsvInput').addEventListener('change', handleBatchCsvImport);
    document.getElementById('batchTemplateBtn').addEventListener('click', handleBatchTemplateDownload);
    document.getElementById('batchClearBtn').addEventListener('click', handleBatchClear);
    document.getElementById('batchExportBtn').addEventListener('click', handleBatchExport);
    document.getElementById('batchRetryBtn').addEventListener('click', handleBatchRetryFailed);
    document.getElementById('batchReportBtn').addEventListener('click', handleBatchReportDownload);
    document.getElementById('batchPreviewBody').addEventListener('click', handleBatchPreviewAction);
    document.getElementById('batchPreviewBody').addEventListener('change', handleBatchPreviewEdit);

    document.getElementById('addObjectBtn').addEventListener('click', handleAddObjectClick);
    document.getElementById('deleteSelectedObjectBtn').addEventListener('click', () => deleteObjectById(selectedObjectId));
    document.getElementById('objectManagerList').addEventListener('click', handleObjectManagerClick);
    document.getElementById('objectManagerList').addEventListener('dragstart', handleObjectManagerDragStart);
    document.getElementById('objectManagerList').addEventListener('dragover', handleObjectManagerDragOver);
    document.getElementById('objectManagerList').addEventListener('drop', handleObjectManagerDrop);
    document.getElementById('objectManagerList').addEventListener('dragend', handleObjectManagerDragEnd);

    // 滑桿拖曳屬於連續動作：整段拖曳只記一個 Undo 步驟
    document.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('pointerdown', beginContinuousRangeAdjust);
        input.addEventListener('pointerup', endContinuousRangeAdjust);
        input.addEventListener('pointercancel', endContinuousRangeAdjust);
    });
    window.addEventListener('pointerup', endContinuousRangeAdjust);
    window.addEventListener('pointercancel', endContinuousRangeAdjust);
    document.getElementById('objectVisibleToggle').addEventListener('change', (event) => {
        if (!selectedObjectId) {
            return;
        }

        setObjectVisibility(selectedObjectId, event.target.checked);
        renderObjectManagerList();
        triggerRender();
        saveSettings();
    });
    document.getElementById('objectEditTextInput').addEventListener('input', (event) => {
        updateSelectedObjectText(event.target.value);
    });
    document.getElementById('objectEditFontSize').addEventListener('input', (event) => {
        updateSelectedObjectFontSize(event.target.value);
    });
    document.getElementById('objectEditColorInput').addEventListener('change', (event) => {
        updateSelectedObjectColor(event.target.value);
    });

    document.getElementById('objectEditFontFamilyInput').addEventListener('change', (event) => {
        updateSelectedObjectFontFamily(event.target.value);
    });

    document.getElementById('objectEditShadowInput').addEventListener('change', (event) => {
        updateSelectedObjectShadow(event.target.checked);
    });
    document.getElementById('applyObjectQrUrlBtn').addEventListener('click', async () => {
        await updateSelectedObjectQrUrl();
    });
    document.getElementById('objectEditQrSize').addEventListener('input', (event) => {
        updateSelectedObjectQrSize(event.target.value);
    });
    document.getElementById('objectEditImageWidth').addEventListener('input', (event) => {
        updateSelectedObjectImageSize('width', event.target.value);
    });
    document.getElementById('objectEditImageLockRatio').addEventListener('change', (event) => {
        updateSelectedObjectImageAspectLock(event.target.checked);
    });
    document.getElementById('objectEditImageHeight').addEventListener('input', (event) => {
        updateSelectedObjectImageSize('height', event.target.value);
    });

    // 貼上圖片目標偏好（使用者最近互動的上傳區）
    document.getElementById('bgImageInput').addEventListener('focus', () => { preferredPasteImageTarget = 'background'; });
    document.getElementById('imagePreview').addEventListener('click', () => { preferredPasteImageTarget = 'background'; });
    document.getElementById('qrImageInput').addEventListener('focus', () => { preferredPasteImageTarget = 'qrcode'; });
    document.getElementById('qrPreview').addEventListener('click', () => { preferredPasteImageTarget = 'qrcode'; });
    document.getElementById('directImageUploadInput').addEventListener('focus', () => { preferredPasteImageTarget = 'direct-upload'; });
    document.getElementById('directImagePreview').addEventListener('click', () => { preferredPasteImageTarget = 'direct-upload'; });
    document.getElementById('uploadImageToBothBtn').addEventListener('focus', () => { preferredPasteImageTarget = 'direct-upload'; });
    document.getElementById('objectImageFileInput').addEventListener('focus', () => { preferredPasteImageTarget = 'object-image'; });
    document.getElementById('objectManagerList').addEventListener('click', () => { preferredPasteImageTarget = 'object-image'; });

    // 全域貼上圖片支援
    document.addEventListener('paste', handleGlobalImagePaste);

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
            const canvasWidth = parseInt(btn.dataset.canvasWidth);
            const canvasHeight = parseInt(btn.dataset.canvasHeight);
            applyAspectRatio(w, h, {
                canvasWidth: Number.isNaN(canvasWidth) ? undefined : canvasWidth,
                canvasHeight: Number.isNaN(canvasHeight) ? undefined : canvasHeight
            });
            document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('customRatioW').value = w;
            document.getElementById('customRatioH').value = h;

            // 非會議桌牌建議比例時提示
            const isMeetingPreset = w === 5 && h === 3 && canvasWidth === 800 && canvasHeight === 480;
            if (!isMeetingPreset) {
                showToast('此比例非 Philips 會議桌牌建議尺寸 (800×480)，可能無法正確顯示。', 'warning', 4000);
            }
        });
    });

    document.getElementById('applyCustomRatioBtn').addEventListener('click', () => {
        handleApplyCustomRatio();
    });

    ['customRatioW', 'customRatioH'].forEach(inputId => {
        const input = document.getElementById(inputId);
        input.addEventListener('input', () => scheduleAutoApplyCustomRatio());
        input.addEventListener('change', () => handleApplyCustomRatio());
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleApplyCustomRatio();
            }
        });
    });

    document.getElementById('applyCustomCanvasSizeBtn').addEventListener('click', () => {
        handleApplyCustomCanvasSize();
    });

    ['customCanvasWidth', 'customCanvasHeight'].forEach(inputId => {
        const input = document.getElementById(inputId);
        input.addEventListener('input', () => scheduleAutoApplyCustomCanvasSize());
        input.addEventListener('change', () => handleApplyCustomCanvasSize());
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleApplyCustomCanvasSize();
            }
        });
    });

    // Philips 桌牌控制
    document.getElementById('deviceSelect').addEventListener('change', handleDeviceSelectionChange);
    document.getElementById('refreshDeviceListBtn').addEventListener('click', () => refreshPhilipsDeviceList(true, true));
    document.getElementById('saveDeviceBtn').addEventListener('click', handleSaveDevice);
    document.getElementById('deleteDeviceBtn').addEventListener('click', handleDeleteDevice);
    document.getElementById('networkModeSelect').addEventListener('change', handleNetworkModeChange);
    document.getElementById('pushImageBothBtn').addEventListener('click', handlePushDisplayBothImages);
    document.getElementById('pushImageABtn').addEventListener('click', () => handlePushDisplayImage('a'));
    document.getElementById('pushImageBBtn').addEventListener('click', () => handlePushDisplayImage('b'));
    document.getElementById('getImageABtn').addEventListener('click', () => handleGetDisplayImage('a'));
    document.getElementById('getImageBBtn').addEventListener('click', () => handleGetDisplayImage('b'));
    document.getElementById('setServerBtn').addEventListener('click', handleSetServerConfig);
    document.getElementById('getServerBtn').addEventListener('click', handleGetServerConfig);
    document.getElementById('setHeartbeatBtn').addEventListener('click', handleSetHeartbeatConfig);
    document.getElementById('aboutBtn').addEventListener('click', handleGetDeviceAbout);
    document.getElementById('viewCallbacksBtn').addEventListener('click', handleGetPhilipsCallbacks);
    document.getElementById('viewImageAccessLogBtn').addEventListener('click', handleGetImageAccessLogs);
    document.getElementById('resetDeviceBtn').addEventListener('click', handleResetDevice);
    document.getElementById('factoryResetBtn').addEventListener('click', handleFactoryResetPreferences);
    document.getElementById('changeIpBtn').addEventListener('click', handleChangeIpConfig);
    document.getElementById('otaBtn').addEventListener('click', handleTriggerOtaUpdate);
}

function handleOpenBatchPage() {
    saveSettings();
    window.location.href = 'batch.html';
}

function getClipboardImageFile(event) {
    const clipboardItems = event.clipboardData && event.clipboardData.items
        ? Array.from(event.clipboardData.items)
        : [];

    const imageItem = clipboardItems.find(item => item.kind === 'file' && item.type && item.type.startsWith('image/'));
    if (!imageItem) {
        return null;
    }

    return imageItem.getAsFile();
}

function resolvePasteImageTarget(event) {
    const activeElement = document.activeElement;
    const targetElement = event.target instanceof Element ? event.target : activeElement;

    if (targetElement && targetElement.closest('.upload-direct-block')) {
        return 'direct-upload';
    }

    if (targetElement && targetElement.closest('.object-manager-section')) {
        return 'object-image';
    }

    if (activeElement && activeElement.id === 'qrImageInput') {
        return 'qrcode';
    }

    if (activeElement && activeElement.id === 'directImageUploadInput') {
        return 'direct-upload';
    }

    if (activeElement && activeElement.id === 'objectImageFileInput') {
        return 'object-image';
    }

    return preferredPasteImageTarget || 'background';
}

async function handleGlobalImagePaste(event) {
    const imageFile = getClipboardImageFile(event);
    if (!imageFile) {
        return;
    }

    event.preventDefault();
    const target = resolvePasteImageTarget(event);

    if (target === 'qrcode') {
        applyQrImageFile(imageFile);
        preferredPasteImageTarget = 'qrcode';
        return;
    }

    if (target === 'direct-upload') {
        applyDirectUploadImageFile(imageFile);
        preferredPasteImageTarget = 'direct-upload';
        showNotification('已貼上圖片，可直接上傳到桌牌', 'success');
        return;
    }

    if (target === 'object-image') {
        await addImageObjectFromFile(imageFile);
        preferredPasteImageTarget = 'object-image';
        return;
    }

    applyBackgroundImageFile(imageFile);
    preferredPasteImageTarget = 'background';
}

function initSectionCollapse() {
    // 選取各分頁內的可收合區塊（排除物件管理區，該區固定展開），
    // 以及設備控制面板內巢狀的直接上傳區塊
    const sections = document.querySelectorAll(
        '.edit-panel .tab-content > .edit-section:not(.object-manager-section),' +
        '#deviceControlsPanel > .edit-section.direct-upload-section'
    );

    sections.forEach(section => {
        const heading = section.querySelector(':scope > h2, :scope > h3');
        if (!heading) {
            return;
        }

        section.classList.add('collapsible-section');
        heading.setAttribute('role', 'button');
        heading.setAttribute('tabindex', '0');

        const setCollapsed = (collapsed) => {
            section.classList.toggle('is-collapsed', collapsed);
            heading.setAttribute('aria-expanded', (!collapsed).toString());
        };

        const startCollapsed = section.classList.contains('batch-section')
            || section.classList.contains('direct-upload-section');
        setCollapsed(startCollapsed);

        const toggle = () => {
            setCollapsed(!section.classList.contains('is-collapsed'));
        };

        heading.addEventListener('click', toggle);
        heading.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });
    });
}

function createDefaultPhilipsControlState() {
    return {
        devices: [],
        discoveredDevices: [],
        manualDevices: [],
        serverCandidates: [],
        publicBaseUrl: '',
        selectedDeviceId: '',
        imageHostUrl: '',
        displayCallbackUrl: '/image-post',
         imgDither: true,
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
    normalized.publicBaseUrl = String(normalized.publicBaseUrl || '').trim();

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

function findPhilipsDeviceByBatchTarget(target) {
    const normalizedTarget = normalizeBatchDeviceTarget(target);
    if (!normalizedTarget) {
        return null;
    }

    const bracketHost = extractDeviceHostFromTarget(target);

    const parsedUrl = tryParseUrl(target);
    const parsedTargetHost = parsedUrl ? normalizeBatchDeviceTarget(parsedUrl.hostname) : '';
    const parsedTargetPort = parsedUrl ? String(clampNumber(parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80), 1, 65535, 80)) : '';

    return philipsControlState.devices.find(device => {
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
    }) || null;
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

function tryParseUrl(value) {
    try {
        return new URL(value);
    } catch (error) {
        return null;
    }
}

function getPublicServerConfig() {
    const candidate = philipsControlState.publicBaseUrl || (window.location.protocol !== 'file:' ? window.location.origin : '');
    const parsed = tryParseUrl(candidate);

    if (!parsed) {
        return null;
    }

    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
    return {
        baseUrl: parsed.origin,
        host: parsed.hostname,
        port: clampNumber(parsed.port || defaultPort, 1, 65535, defaultPort),
        protocol: parsed.protocol.replace(':', '')
    };
}

function buildApiUrl(baseUrl, path) {
    if (!baseUrl) {
        return path;
    }

    return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function collectPhilipsApiBaseCandidates() {
    const candidates = [];
    const seen = new Set();

    function addCandidate(value) {
        const parsed = tryParseUrl(value);
        if (!parsed) {
            return;
        }

        const normalized = parsed.origin;
        if (seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        candidates.push(normalized);
    }

    if (window.location.protocol !== 'file:') {
        addCandidate(window.location.origin);
    }

    const publicServer = getPublicServerConfig();
    if (publicServer) {
        addCandidate(publicServer.baseUrl);
    }

    syncPhilipsControlsToState();
    const configuredPort = clampNumber(philipsControlState.serverPort, 1, 65535, publicServer ? publicServer.port : 3001);

    addCandidate(`http://127.0.0.1:${configuredPort}`);
    addCandidate(`http://localhost:${configuredPort}`);

    if (philipsControlState.serverAddr) {
        const isHttpsOrigin = publicServer && publicServer.protocol === 'https';
        const explicitProtocol = isHttpsOrigin && configuredPort === 443 ? 'https' : 'http';
        addCandidate(`${explicitProtocol}://${philipsControlState.serverAddr}:${configuredPort}`);
    }

    return candidates;
}

function isNetworkFetchError(error) {
    return error instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String(error && error.message ? error.message : error));
}

function isUnexpectedHtmlApiResponse(response) {
    if (!response) {
        return false;
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html')) {
        return false;
    }

    return response.status === 404 || response.status === 405 || response.redirected;
}

async function fetchFromPhilipsApi(path, options = {}) {
    const candidates = collectPhilipsApiBaseCandidates();
    const urls = candidates.length > 0 ? candidates.map(baseUrl => buildApiUrl(baseUrl, path)) : [path];
    let lastError = null;

    for (const url of urls) {
        try {
            const response = await fetch(url, options);
            if (isUnexpectedHtmlApiResponse(response)) {
                lastError = new Error(`非預期的 HTML 回應: ${url}`);
                continue;
            }

            return response;
        } catch (error) {
            lastError = error;
            if (!isNetworkFetchError(error)) {
                throw error;
            }
        }
    }

    throw lastError || new Error(`無法連線到本機 Philips server: ${path}`);
}

async function fetchServerManagedPhilipsDevices() {
    if (window.location.protocol === 'file:') {
        return [];
    }

    const response = await fetchFromPhilipsApi(PHILIPS_DEVICES_API, { cache: 'no-store' });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
        throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    }

    const list = Array.isArray(payload.data) ? payload.data : [];
    return list
        .map(device => normalizeDeviceRecord(device, 'manual'))
        .filter(device => device.host || device.label);
}

async function persistManualDeviceToServer(device) {
    if (window.location.protocol === 'file:') {
        return;
    }

    const response = await fetchFromPhilipsApi(PHILIPS_DEVICES_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
        throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    }
}

async function deleteManualDeviceFromServer(deviceId) {
    if (window.location.protocol === 'file:') {
        return;
    }

    const encodedId = encodeURIComponent(String(deviceId || ''));
    const response = await fetchFromPhilipsApi(`${PHILIPS_DEVICES_API}/${encodedId}`, {
        method: 'DELETE'
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
        throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    }
}

async function refreshServerManagedDevices(notifyOnFailure = false) {
    try {
        const manualDevices = await fetchServerManagedPhilipsDevices();
        philipsControlState.manualDevices = manualDevices;
        rebuildAvailableDevices();
        syncPhilipsControlsFromState();
        saveSettings();
    } catch (error) {
        if (notifyOnFailure) {
            showNotification(`讀取伺服器桌牌設定失敗: ${error.message}`, 'error');
        }
    }
}

function applyDiscoveryResult(payload) {
    philipsControlState.discoveredDevices = Array.isArray(payload.devices)
        ? payload.devices.map(device => normalizeDeviceRecord(device, 'discovered'))
        : [];
    philipsControlState.serverCandidates = Array.isArray(payload.serverCandidates) ? payload.serverCandidates : [];
    philipsControlState.publicBaseUrl = String(payload.publicBaseUrl || philipsControlState.publicBaseUrl || '').trim();
    philipsControlState.lastDiscoveryAt = payload.scannedAt || '';
    const publicServer = getPublicServerConfig();

    if (shouldAutofillServerAddr()) {
        if (publicServer) {
            philipsControlState.serverAddr = publicServer.host;
            philipsControlState.serverPort = publicServer.port;
        } else {
            const preferredServer = philipsControlState.serverCandidates.find(candidate => candidate.address) || null;
            if (preferredServer) {
                philipsControlState.serverAddr = preferredServer.address;
            }
        }
    }

    if (publicServer && (philipsControlState.serverPort === 3001 || !philipsControlState.serverPort)) {
        philipsControlState.serverPort = publicServer.port;
    } else if ((philipsControlState.serverPort === 3001 || !philipsControlState.serverPort) && window.location.port) {
        philipsControlState.serverPort = clampNumber(window.location.port, 1, 65535, 3001);
    }

    rebuildAvailableDevices();
    syncPhilipsControlsFromState();
    void syncDiscoveredDeviceHeartbeats(philipsControlState.discoveredDevices);
    renderDiscoveredDeviceList();

    const discoveredCount = philipsControlState.discoveredDevices.length;
    const timestamp = philipsControlState.lastDiscoveryAt
        ? new Date(philipsControlState.lastDiscoveryAt).toLocaleTimeString('zh-TW', { hour12: false })
        : '--:--:--';
    if (payload.servedFromCache && payload.refreshing) {
        setDeviceDiscoveryStatus(`已載入快取：掃描 ${payload.targetCount || 0} 個位址，找到 ${discoveredCount} 台桌牌，背景更新中，最後更新 ${timestamp}`);
        return;
    }

    if (payload.servedFromCache) {
        setDeviceDiscoveryStatus(`已載入快取：掃描 ${payload.targetCount || 0} 個位址，找到 ${discoveredCount} 台桌牌，更新時間 ${timestamp}`);
        return;
    }

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
        const response = await fetchFromPhilipsApi(url, { cache: 'no-store' });
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

    await refreshServerManagedDevices(false);

    await refreshPhilipsDeviceList(false, false);

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
    const hostInput = document.getElementById('deviceHostInput');
    if (hostInput) {
        hostInput.readOnly = Boolean(philipsControlState.selectedDeviceId);
    }

    const pushBtn = document.getElementById('pushImageBothBtn');
    if (pushBtn) {
        const hasDevice = Boolean(philipsControlState.selectedDeviceId);
        pushBtn.disabled = !hasDevice;
        pushBtn.title = hasDevice ? '' : '請先選擇桌牌';
    }

    if (selectedDevice) {
        syncDeviceEditorFields(selectedDevice);
    } else {
        syncDeviceEditorFields(createDefaultDevice());
    }



    syncPhilipsPanel();
    saveSettings();
}

async function handleSaveDevice() {
    const draft = normalizeDeviceRecord(readDeviceDraftFromForm(), 'manual');

    if (!draft.label || !draft.host) {
        showNotification('請輸入桌牌名稱與 IP / 網域', 'error');
        return;
    }

    try {
        await persistManualDeviceToServer(draft);
    } catch (error) {
        showNotification(`儲存桌牌設定失敗: ${error.message}`, 'error');
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
    renderDiscoveredDeviceList();
    renderDeviceOptions();
    syncPhilipsPanel();
    saveSettings();
    showNotification(`已儲存桌牌設定: ${draft.label}`, 'success');
}

async function handleDeleteDevice() {
    const selectedDevice = getSelectedDevice();
    if (!selectedDevice) {
        showNotification('目前沒有可刪除的桌牌', 'info');
        return;
    }

    const existsInManualList = philipsControlState.manualDevices.some(device => device.id === selectedDevice.id);
    if (!existsInManualList) {
        showNotification('目前選擇的是自動掃描桌牌，沒有可刪除的已儲存設定', 'info');
        return;
    }

    try {
        await deleteManualDeviceFromServer(selectedDevice.id);
    } catch (error) {
        showNotification(`刪除桌牌設定失敗: ${error.message}`, 'error');
        return;
    }

    const beforeCount = philipsControlState.manualDevices.length;
    philipsControlState.manualDevices = philipsControlState.manualDevices.filter(device => device.id !== selectedDevice.id);
    rebuildAvailableDevices();
    renderDiscoveredDeviceList();
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

function formatDeviceTargetDisplay(device) {
    const label = String(device?.label || device?.device_id || '').trim();
    const host = String(device?.host || '').trim();
    if (label && host && label !== host) {
        return `${label}(${host})`;
    }

    return label || host || String(device?.id || '').trim();
}

function renderDeviceOptions() {
    const select = document.getElementById('deviceSelect');
    const placeholder = '<option value="">請先選擇桌牌</option>';
    const options = philipsControlState.devices
        .map(device => {
            const suffix = device.source === 'manual' ? ' (手動)' : '';
            return `<option value="${escapeHtml(device.id)}">${escapeHtml(formatDeviceTargetDisplay(device))}${suffix}</option>`;
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
    renderDiscoveredDeviceList();

    const pushBtn = document.getElementById('pushImageBothBtn');
    if (pushBtn) {
        const hasDevice = Boolean(philipsControlState.selectedDeviceId);
        pushBtn.disabled = !hasDevice;
        pushBtn.title = hasDevice ? '' : '請先選擇桌牌';
    }
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
        summaryText.textContent = `目前選擇 ${selectedDevice.label || selectedDevice.device_id || selectedDevice.host}（${sourceLabel}），控制指令會由後端轉發到 ${deviceBaseUrl}${PHILIPS_API_PREFIX}`;
        footerDeviceName.textContent = selectedDevice.label || selectedDevice.device_id || selectedDevice.host;
        footerDeviceEndpoint.textContent = deviceBaseUrl;
    }

    footerWebhookEndpoint.textContent = buildWebhookServerBaseUrl() || '-';
}

function renderDiscoveredDeviceList() {
    const listNode = document.getElementById('discoveredDeviceList');
    const countNode = document.getElementById('discoveredDeviceCount');
    if (!listNode || !countNode) {
        return;
    }

    // 合併掃描發現與使用者已儲存的桌牌，以 ID 去重
    const discoveredDevices = Array.isArray(philipsControlState.discoveredDevices)
        ? philipsControlState.discoveredDevices
        : [];
    const manualDevices = Array.isArray(philipsControlState.manualDevices)
        ? philipsControlState.manualDevices
        : [];

    const mergedMap = new Map();
    discoveredDevices.forEach(device => {
        mergedMap.set(device.id, { ...device, _listSource: 'discovered' });
    });
    manualDevices.forEach(device => {
        if (mergedMap.has(device.id)) {
            // 保留掃描記錄，但補上已儲存的名稱
            const existing = mergedMap.get(device.id);
            existing.label = device.label || existing.label;
            existing._listSource = 'both';
        } else {
            mergedMap.set(device.id, { ...device, _listSource: 'manual' });
        }
    });

    const allDevices = Array.from(mergedMap.values());

    countNode.textContent = `${allDevices.length} 台`;

    if (!allDevices.length) {
        listNode.innerHTML = '<div class="discovered-device-empty">目前尚未掃描到桌牌</div>';
        return;
    }

    const items = allDevices.map(device => {
        const heartbeatAt = discoveredHeartbeatSyncCache.get(device.id) || 0;
        const isConnected = heartbeatAt > 0;
        const heartbeatLabel = isConnected ? '已連線' : '未連線';
        const heartbeatTime = isConnected
            ? new Date(heartbeatAt).toLocaleTimeString('zh-TW', { hour12: false })
            : '';
        const endpoint = buildDeviceBaseUrl(device);

        let sourceBadge = '';
        if (device._listSource === 'manual') {
            sourceBadge = '<span class="discovered-device-source discovered-device-source--saved">已儲存</span>';
        } else if (device._listSource === 'discovered') {
            sourceBadge = '<span class="discovered-device-source discovered-device-source--scanned">掃描發現</span>';
        } else {
            sourceBadge = '<span class="discovered-device-source discovered-device-source--both">已儲存</span>';
        }

        return `
            <div class="discovered-device-card ${isConnected ? 'is-connected' : 'is-disconnected'}">
                <div class="discovered-device-card-head">
                    <span class="discovered-device-dot" aria-hidden="true"></span>
                    <div>
                        <div class="discovered-device-name">${escapeHtml(device.label || device.device_id || device.host || '未命名桌牌')}</div>
                        <div class="discovered-device-meta">${escapeHtml(endpoint || '-')} ${sourceBadge}</div>
                    </div>
                    <div class="discovered-device-heartbeat ${isConnected ? 'is-connected' : 'is-disconnected'}">
                        ${escapeHtml(heartbeatLabel)}
                    </div>
                </div>
                <div class="discovered-device-details">
                    <span>IP: ${escapeHtml(device.host || '-')}</span>
                    <span>Port: ${escapeHtml(device.port || '-')}</span>
                    <span>ID: ${escapeHtml(device.device_id || device.id || '-')}</span>
                    <span>${isConnected ? `最後 heartbeat: ${escapeHtml(heartbeatTime)}` : '尚未同步 heartbeat'}</span>
                </div>
            </div>
        `;
    }).join('');

    listNode.innerHTML = items;
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
    const publicServer = getPublicServerConfig();
    if (philipsControlState.serverAddr) {
        const configuredPort = clampNumber(philipsControlState.serverPort, 1, 65535, publicServer ? publicServer.port : 3001);
        if (publicServer && philipsControlState.serverAddr === publicServer.host && configuredPort === publicServer.port) {
            return publicServer.baseUrl;
        }

        return `http://${philipsControlState.serverAddr}:${configuredPort}`;
    }

    return publicServer ? publicServer.baseUrl : '';
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

    return performPhilipsRequestToDevice(getSelectedDevice(), path, options);
}

async function performPhilipsRequestToDevice(device, path, options = {}) {
    if (!device) {
        throw new Error('請先選擇桌牌');
    }

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

    return {
        url: payload.url,
        status: payload.status || response.status,
        payload: payload.payload,
        forwardedTo: payload.forwardedTo,
        forwardedRequest: payload.forwardedRequest
    };
}

function pruneDiscoveredHeartbeatSyncCache(activeDevices) {
    const activeIds = new Set((activeDevices || []).map(device => device.id));

    for (const deviceId of discoveredHeartbeatSyncCache.keys()) {
        if (!activeIds.has(deviceId)) {
            discoveredHeartbeatSyncCache.delete(deviceId);
        }
    }
}

async function syncDiscoveredDeviceHeartbeats(devices) {
    const discoveredDevices = Array.isArray(devices) ? devices : [];
    if (!discoveredDevices.length) {
        pruneDiscoveredHeartbeatSyncCache(discoveredDevices);
        return;
    }

    syncPhilipsControlsToState();
    const heartbeatUrl = philipsControlState.heartbeatUrl || '/heartbeat';
    const minutes = 1;
    const now = Date.now();
    const pendingDevices = discoveredDevices.filter(device => {
        const lastSyncedAt = discoveredHeartbeatSyncCache.get(device.id) || 0;
        return now - lastSyncedAt >= DISCOVERED_HEARTBEAT_SYNC_RETRY_MS;
    });

    pruneDiscoveredHeartbeatSyncCache(discoveredDevices);

    if (!pendingDevices.length) {
        return;
    }

    const results = await Promise.allSettled(pendingDevices.map(device => performPhilipsRequestToDevice(device, `${PHILIPS_API_PREFIX}/heartbeat`, {
        method: 'PUT',
        body: {
            heartbeat_url: heartbeatUrl,
            minutes
        }
    })));

    results.forEach((result, index) => {
        const device = pendingDevices[index];
        if (result.status === 'fulfilled') {
            discoveredHeartbeatSyncCache.set(device.id, Date.now());
            return;
        }

        console.warn(`同步桌牌 heartbeat 失敗: ${device.label || device.host}`, result.reason);
    });

    renderDiscoveredDeviceList();
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

function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('讀取圖片失敗'));
        reader.readAsDataURL(file);
    });
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('圖片格式無法解析'));
        image.src = dataUrl;
    });
}

async function convertUploadedImageToPhilipsJpegDataUrl(file) {
    const inputDataUrl = await readImageFileAsDataUrl(file);
    const image = await loadImageFromDataUrl(inputDataUrl);

    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = PHILIPS_JPEG_MAX_WIDTH;
    targetCanvas.height = PHILIPS_JPEG_MAX_HEIGHT;
    const context = targetCanvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    const scale = Math.min(
        PHILIPS_JPEG_MAX_WIDTH / image.width,
        PHILIPS_JPEG_MAX_HEIGHT / image.height
    );
    const drawWidth = Math.max(1, Math.round(image.width * scale));
    const drawHeight = Math.max(1, Math.round(image.height * scale));
    const drawX = Math.round((PHILIPS_JPEG_MAX_WIDTH - drawWidth) / 2);
    const drawY = Math.round((PHILIPS_JPEG_MAX_HEIGHT - drawHeight) / 2);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const qualities = [0.92, 0.86, 0.8, 0.72, 0.64, 0.56];
    for (const quality of qualities) {
        const dataUrl = targetCanvas.toDataURL('image/jpeg', quality);
        if (dataUrlByteLength(dataUrl) <= PHILIPS_JPEG_MAX_BYTES) {
            return dataUrl;
        }
    }

    throw new Error('圖片轉檔後超過 750KB，請上傳較簡單或較小的圖片');
}

function isAutoGeneratedNameplateImageUrl(rawUrl) {
    const normalizedUrl = String(rawUrl || '').trim();
    if (!normalizedUrl) {
        return false;
    }

    try {
        const parsed = new URL(normalizedUrl, window.location.origin);
        return /^\/uploads\/nameplate_.*\.(jpg|jpeg|png)$/i.test(parsed.pathname);
    } catch (error) {
        return /^\/uploads\/nameplate_.*\.(jpg|jpeg|png)$/i.test(normalizedUrl);
    }
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
    if (window.location.protocol === 'file:') {
        throw new Error('請改由同一台後端 server 開啟此頁，才能上傳圖片並提供桌牌存取');
    }

    const imageData = exportPhilipsJpegDataUrl();
    return uploadNameplateJpegToWebhookServer(imageData, window.nameplateState.name || 'nameplate');
}

async function uploadNameplateJpegToWebhookServer(imageData, displayName = 'nameplate') {
    if (window.location.protocol === 'file:') {
        throw new Error('請改由同一台後端 server 開啟此頁，才能上傳圖片並提供桌牌存取');
    }

    const response = await fetch('/api/nameplate/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: displayName,
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

    const publicUrl = payload.data?.publicUrl || `${buildWebhookServerBaseUrl()}${payload.data?.url || ''}`;
    philipsControlState.imageHostUrl = publicUrl;
    document.getElementById('imageHostUrlInput').value = publicUrl;
    saveSettings();
    return publicUrl;
}

async function resolveImageTargetUrl() {
    syncPhilipsControlsToState();

    if (philipsControlState.imageHostUrl && !isAutoGeneratedNameplateImageUrl(philipsControlState.imageHostUrl)) {
        return philipsControlState.imageHostUrl;
    }

    return uploadCurrentNameplateToWebhookServer();
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
    const baseCallback = philipsControlState.displayCallbackUrl || '/image-post';

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

function waitForDualDisplayGap() {
    return new Promise(resolve => {
        setTimeout(resolve, DUAL_DISPLAY_UPDATE_DELAY_MS);
    });
}

async function pushImageUrlToBothDisplays(imageTargetUrl) {
    const imageTargetUrlA = buildDisplayImageUrl(imageTargetUrl, 'a');
    const imageTargetUrlB = buildDisplayImageUrl(imageTargetUrl, 'b');
    const displayCallbackUrlA = buildDisplayCallbackUrl('a');
    const displayCallbackUrlB = buildDisplayCallbackUrl('b');
    const requestBody = {
        img_target_url: imageTargetUrlA,
        img_dither: philipsControlState.imgDither ? 1 : 0,
        display_callback_url: displayCallbackUrlA
    };

    const sideResults = {
        targetA: null,
        targetB: null
    };
    const sideErrors = [];

    try {
        sideResults.targetA = await performPhilipsRequest(`${PHILIPS_API_PREFIX}/display/image/a`, {
            method: 'PUT',
            body: requestBody
        });
    } catch (error) {
        sideErrors.push(`A 面更新失敗: ${error.message}`);
    }

    await waitForDualDisplayGap();

    try {
        sideResults.targetB = await performPhilipsRequest(`${PHILIPS_API_PREFIX}/display/image/b`, {
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
        imageTargetUrl,
        imageTargetUrlA,
        imageTargetUrlB,
        displayCallbackUrlA,
        displayCallbackUrlB,
        ...sideResults
    };
}

async function handlePushDisplayImage(target) {
    const targetLabel = target === 'a' ? '左側畫面 A' : '右側畫面 B';

    await withPhilipsAction(`更新${targetLabel}`, async () => {
        const imageTargetUrl = buildDisplayImageUrl(await resolveImageTargetUrl(), target);
        const result = await performPhilipsRequest(`${PHILIPS_API_PREFIX}/display/image/${target}`, {
            method: 'PUT',
            body: {
                img_target_url: imageTargetUrl,
                img_dither: philipsControlState.imgDither ? 1 : 0,
                display_callback_url: buildDisplayCallbackUrl(target)
            }
        });

        return {
            ...result,
            imageTargetUrl
        };
    });
}

async function handlePushDisplayBothImages() {
    await withPhilipsAction('同步更新雙面畫面', async () => {
        const imageTargetUrl = await resolveImageTargetUrl();
        return pushImageUrlToBothDisplays(imageTargetUrl);
    });
}

async function handleUploadImageToBothDisplays() {
    await withPhilipsAction('上傳圖片並同步更新雙面', async () => {
        const fileInput = document.getElementById('directImageUploadInput');
        const selectedFile = (fileInput && fileInput.files ? fileInput.files[0] : null) || directUploadImageFile;
        if (!selectedFile) {
            throw new Error('請先選擇要上傳的圖片');
        }

        const imageData = await convertUploadedImageToPhilipsJpegDataUrl(selectedFile);
        const publicUrl = await uploadNameplateJpegToWebhookServer(imageData, selectedFile.name || 'upload');
        const result = await pushImageUrlToBothDisplays(publicUrl);

        return {
            sourceFile: selectedFile.name,
            ...result
        };
    });
}

async function handleGetDisplayImage(target) {
    const targetLabel = target === 'a' ? '左側畫面 A' : '右側畫面 B';

    await withPhilipsAction(`讀取${targetLabel}`, async () => performPhilipsRequest(`${PHILIPS_API_PREFIX}/display/image/${target}`));
}

async function handleSetServerConfig() {
    await withPhilipsAction('設定伺服器位址', async () => {
        syncPhilipsControlsToState();
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

async function handleGetPhilipsCallbacks() {
    showLoading(true);

    try {
        const response = await fetchFromPhilipsApi('/api/philips/callbacks', { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        }

        updateApiResult('查看 Callback 紀錄', {
            count: Array.isArray(payload.data) ? payload.data.length : 0,
            data: Array.isArray(payload.data) ? payload.data : []
        });
        showNotification('已載入 Callback 紀錄', 'success');
    } catch (error) {
        updateApiResult('查看 Callback 紀錄失敗', { message: error.message });
        showNotification(`查看 Callback 紀錄失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function getCurrentImageFilename() {
    const rawUrl = String(philipsControlState.imageHostUrl || document.getElementById('imageHostUrlInput').value || '').trim();
    if (!rawUrl) {
        return '';
    }

    try {
        return decodeURIComponent(new URL(rawUrl).pathname.split('/').pop() || '');
    } catch (error) {
        const parts = rawUrl.split('/');
        return decodeURIComponent(parts.pop() || '');
    }
}

async function handleGetImageAccessLogs() {
    showLoading(true);

    try {
        const filename = getCurrentImageFilename();
        const query = filename ? `?filename=${encodeURIComponent(filename)}` : '';
        const response = await fetchFromPhilipsApi(`/api/nameplate/access-logs${query}`, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        }

        updateApiResult('查看圖片抓取紀錄', {
            filename: filename || null,
            count: Array.isArray(payload.data) ? payload.data.length : 0,
            data: Array.isArray(payload.data) ? payload.data : []
        });
        showNotification('已載入圖片抓取紀錄', 'success');
    } catch (error) {
        updateApiResult('查看圖片抓取紀錄失敗', { message: error.message });
        showNotification(`查看圖片抓取紀錄失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
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
            deviceTarget: values.deviceTarget || values.deviceId || '',
            deviceId: values.deviceId || '',
            meetingId: values.meetingId || '',
            qrUrl: values.qrUrl || '',
            errors: []
        };

        record.errors = validateBatchRecord(record);
        return record;
    });
}

function updateBatchRecordField(rowNumber, fieldName, value) {
    const record = batchJobState.records.find(item => item.rowNumber === rowNumber);
    if (!record) {
        return;
    }

    const normalizedValue = String(value ?? '').trim();
    record[fieldName] = normalizedValue;

    if (fieldName === 'deviceTarget' || fieldName === 'deviceId') {
        record.deviceTarget = normalizedValue;
        record.deviceId = normalizedValue;
    }

    record.errors = validateBatchRecord(record);
    batchJobState.validRecords = batchJobState.records.filter(item => item.errors.length === 0);
    batchJobState.invalidRecords = batchJobState.records.filter(item => item.errors.length > 0);
    batchJobState.lastResults = [];
    renderBatchPreview();
    setBatchStatus(`已更新第 ${rowNumber} 列資料，請確認後再輸出。`);
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
        previewBody.innerHTML = '<tr><td colspan="8" class="batch-empty-state">匯入 CSV 後會在這裡顯示預覽</td></tr>';
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
                <td><input class="batch-inline-input" type="text" value="${escapeHtml(record.name)}" data-row-number="${record.rowNumber}" data-field="name" aria-label="姓名"></td>
                <td><input class="batch-inline-input" type="text" value="${escapeHtml(record.company)}" data-row-number="${record.rowNumber}" data-field="company" aria-label="公司"></td>
                <td><input class="batch-inline-input" type="text" value="${escapeHtml(record.position)}" data-row-number="${record.rowNumber}" data-field="position" aria-label="職位"></td>
                <td><input class="batch-inline-input" type="text" value="${escapeHtml(record.deviceTarget || record.deviceId || '')}" data-row-number="${record.rowNumber}" data-field="deviceTarget" aria-label="桌牌名稱或 IP"></td>
                <td><input class="batch-inline-input" type="url" value="${escapeHtml(record.qrUrl || '')}" data-row-number="${record.rowNumber}" data-field="qrUrl" aria-label="QRCode 網址"></td>
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

function handleBatchPreviewEdit(event) {
    const input = event.target.closest('input[data-row-number][data-field]');
    if (!input) {
        return;
    }

    const rowNumber = parseInt(input.dataset.rowNumber, 10);
    const fieldName = input.dataset.field;
    if (!Number.isFinite(rowNumber) || !fieldName) {
        return;
    }

    updateBatchRecordField(rowNumber, fieldName, input.value);
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

async function performPhilipsRequestForDevice(device, path, options = {}) {
    syncPhilipsControlsToState();

    if (!device) {
        throw new Error('請先選擇桌牌');
    }

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

    return {
        url: payload.url,
        status: payload.status || response.status,
        payload: payload.payload,
        forwardedTo: payload.forwardedTo,
        forwardedRequest: payload.forwardedRequest
    };
}

async function pushBatchRecordToPhilipsDevice(record) {
    const targetText = record.deviceTarget || record.deviceId || '';
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
            message: `找不到桌牌：${targetText}，僅輸出圖片檔`
        };
    }

    const imageTargetUrl = await resolveImageTargetUrl();
    const result = await performPhilipsRequestForDevice(device, `${PHILIPS_API_PREFIX}/display/image/a`, {
        method: 'PUT',
        body: {
            img_target_url: imageTargetUrl,
            img_dither: philipsControlState.imgDither ? 1 : 0,
            display_callback_url: philipsControlState.displayCallbackUrl || '/image-post'
        }
    });

    return {
        skipped: false,
        device,
        imageTargetUrl,
        message: `已同步更新桌牌：${device.label || device.host}`,
        ...result
    };
}

function applyStateToCanvasOnly(state) {
    window.nameplateState = state;
    ensureObjectState(window.nameplateState);
    triggerRender();
}

function restoreTemplateState(template) {
    window.nameplateState = template.state;
    ensureObjectState(window.nameplateState);
    syncControlsFromState(template.state, template.opacity);
    renderObjectManagerList();

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
    const headers = ['rowNumber', 'name', 'company', 'position', 'deviceTarget', 'qrUrl', 'validationStatus', 'exportStatus', 'fileName', 'message'];
    const lines = [headers.map(escapeCsvCell).join(',')];

    batchJobState.records.forEach(record => {
        const result = resultMap.get(record.rowNumber);
        const row = [
            record.rowNumber,
            record.name,
            record.company,
            record.position,
            record.deviceTarget || record.deviceId || '',
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
    renderSelectedObjectSettings();
    triggerRender();
    saveSettings();
}

function handleCompanyChange(e) {
    const value = e.target.value;
    window.nameplateState.company = value;
    renderSelectedObjectSettings();
    triggerRender();
    saveSettings();
}

function handlePositionChange(e) {
    const value = e.target.value;
    window.nameplateState.position = value;
    renderSelectedObjectSettings();
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

function applyBackgroundImageFile(file) {
    if (!file) {
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        showNotification('請貼上或選擇圖片檔案', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showNotification('圖片大小不能超過 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        bgImageDataUrl = event.target.result;
        window.renderer.setBackgroundImageDataUrl(bgImageDataUrl);

        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${event.target.result}" alt="背景預覽">`;
        preview.classList.add('has-image');
        document.getElementById('clearImageBtn').style.display = 'block';
        document.getElementById('bgOpacityGroup').style.display = 'block';

        saveSettings();
    };
    reader.readAsDataURL(file);

    showNotification('圖片已上傳', 'success');
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    preferredPasteImageTarget = 'background';
    applyBackgroundImageFile(file);
}

function handleClearImage() {
    document.getElementById('bgImageInput').value = '';
    window.renderer.clearBackgroundImage();
    bgImageDataUrl = null;
    
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '<span>未選擇圖片</span>';
    preview.classList.remove('has-image');
    document.getElementById('clearImageBtn').style.display = 'none';
    document.getElementById('bgOpacityGroup').style.display = 'none';
    
    triggerRender();
    saveSettings();
}

function updateDirectImagePreview(imageDataUrl) {
    const preview = document.getElementById('directImagePreview');
    if (!preview) {
        return;
    }

    if (!imageDataUrl) {
        preview.innerHTML = '<span>未選擇圖片</span>';
        preview.classList.remove('has-image');
        return;
    }

    preview.innerHTML = `<img src="${imageDataUrl}" alt="上傳預覽">`;
    preview.classList.add('has-image');
}

function applyDirectUploadImageFile(file) {
    if (!file) {
        directUploadImageFile = null;
        updateDirectImagePreview('');
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        showNotification('請選擇圖片檔案', 'error');
        directUploadImageFile = null;
        updateDirectImagePreview('');
        return;
    }

    directUploadImageFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
        updateDirectImagePreview(String(event.target.result || ''));
    };
    reader.onerror = () => {
        showNotification('圖片預覽讀取失敗', 'error');
        directUploadImageFile = null;
        updateDirectImagePreview('');
    };
    reader.readAsDataURL(file);
}

function handleDirectImageUploadPreview(e) {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    preferredPasteImageTarget = 'direct-upload';
    applyDirectUploadImageFile(file);

    if (!file || (file.type && file.type.startsWith('image/'))) {
        return;
    }

    e.target.value = '';
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
    if (!file) {
        return;
    }

    preferredPasteImageTarget = 'qrcode';
    applyQrImageFile(file);
}

function applyQrImageFile(file) {
    if (!file) {
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        showNotification('請貼上或選擇 QRCode 圖片', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showNotification('QRCode 圖片大小不能超過 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        qrCodeDataUrl = event.target.result;
        window.nameplateState.qrVisible = true;
        window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
        updateQrPreview(qrCodeDataUrl);
        updateQrToggleButton();
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
        window.nameplateState.qrVisible = true;
        await window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
        updateQrPreview(qrCodeDataUrl);
        updateQrToggleButton();
        renderSelectedObjectSettings();
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
    updateQrToggleButton();

    renderSelectedObjectSettings();
    triggerRender();
    saveSettings();
}

function handleToggleQrVisibility() {
    window.nameplateState.qrVisible = window.nameplateState.qrVisible === false;
    updateQrToggleButton();
    renderSelectedObjectSettings();
    triggerRender();
    saveSettings();
}

function updateQrToggleButton() {
    const toggleBtn = document.getElementById('toggleQrBtn');
    if (!toggleBtn) return;

    const isVisible = window.nameplateState.qrVisible !== false;
    toggleBtn.textContent = isVisible ? '隱藏 QRCode' : '顯示 QRCode';
    toggleBtn.classList.toggle('is-hidden', !isVisible);
}

async function applyDefaultSampleQrIfNeeded() {
    if (qrCodeDataUrl) {
        return;
    }

    try {
        document.getElementById('qrUrlInput').value = DEFAULT_QR_SAMPLE_URL;
        qrCodeDataUrl = await generateQrCodeDataUrl(DEFAULT_QR_SAMPLE_URL);
        window.nameplateState.qrVisible = true;
        await window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
        updateQrPreview(qrCodeDataUrl);
        updateQrToggleButton();
        saveSettings();
    } catch (err) {
        console.warn('載入預設 QRCode 失敗:', err);
    }
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
    renderSelectedObjectSettings();
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
    window.nameplateState.nameTextColor = color;
    window.nameplateState.companyTextColor = color;
    window.nameplateState.positionTextColor = color;
    document.getElementById('textColorValue').textContent = color;
    renderSelectedObjectSettings();
    triggerRender();
    saveSettings();
}

function handleTextShadowChange(e) {
    const value = Boolean(e.target.checked);
    window.nameplateState.textShadow = value;
    window.nameplateState.nameTextShadow = value;
    window.nameplateState.companyTextShadow = value;
    window.nameplateState.positionTextShadow = value;
    renderSelectedObjectSettings();
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

function isCustomObjectToken(token) {
    return typeof token === 'string' && token.startsWith('object:');
}

function getObjectIdFromToken(token) {
    return isCustomObjectToken(token) ? token.replace('object:', '') : '';
}

function getDragStartOffsets(selectionToken) {
    if (isCustomObjectToken(selectionToken)) {
        const objectId = getObjectIdFromToken(selectionToken);
        const objectMeta = getCustomObjectById(objectId);
        return {
            offsetX: objectMeta ? parseInt(objectMeta.offsetX || 0, 10) : 0,
            offsetY: objectMeta ? parseInt(objectMeta.offsetY || 0, 10) : 0
        };
    }

    return {
        offsetX: window.nameplateState[`${selectionToken}OffsetX`] || 0,
        offsetY: window.nameplateState[`${selectionToken}OffsetY`] || 0
    };
}

function applyDraggedOffsets(selectionToken, newOffsetX, newOffsetY) {
    if (isCustomObjectToken(selectionToken)) {
        const objectId = getObjectIdFromToken(selectionToken);
        const objectMeta = getCustomObjectById(objectId);
        if (!objectMeta) {
            return;
        }

        objectMeta.offsetX = newOffsetX;
        objectMeta.offsetY = newOffsetY;
        return;
    }

    window.nameplateState[`${selectionToken}OffsetX`] = newOffsetX;
    window.nameplateState[`${selectionToken}OffsetY`] = newOffsetY;
}

function syncDraggedOffsetControls(selectionToken, newOffsetX, newOffsetY) {
    if (isCustomObjectToken(selectionToken)) {
        return;
    }

    document.getElementById(`${selectionToken}OffsetX`).value = newOffsetX;
    document.getElementById(`${selectionToken}OffsetY`).value = newOffsetY;
    updateOffsetDisplay(`${selectionToken}OffsetXValue`, newOffsetX);
    updateOffsetDisplay(`${selectionToken}OffsetYValue`, newOffsetY);
    document.getElementById(`${selectionToken}OffsetXInput`).value = newOffsetX;
    document.getElementById(`${selectionToken}OffsetYInput`).value = newOffsetY;
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
        const startOffsets = getDragStartOffsets(textType);
        dragState.startOffsetX = startOffsets.offsetX;
        dragState.startOffsetY = startOffsets.offsetY;

        const objectId = getObjectIdFromSelectionToken(textType);
        if (objectId) {
            switchToTab('objects');
            selectObject(objectId);
            const managerSection = document.querySelector('.object-manager-section');
            if (managerSection) {
                managerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        
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

        applyDraggedOffsets(dragState.selectedText, newOffsetX, newOffsetY);
        syncDraggedOffsetControls(dragState.selectedText, newOffsetX, newOffsetY);

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
        const startOffsets = getDragStartOffsets(textType);
        dragState.startOffsetX = startOffsets.offsetX;
        dragState.startOffsetY = startOffsets.offsetY;

        const objectId = getObjectIdFromSelectionToken(textType);
        if (objectId) {
            switchToTab('objects');
            selectObject(objectId);
            const managerSection = document.querySelector('.object-manager-section');
            if (managerSection) {
                managerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        
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

    applyDraggedOffsets(dragState.selectedText, newOffsetX, newOffsetY);
    syncDraggedOffsetControls(dragState.selectedText, newOffsetX, newOffsetY);

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
    if (isCustomObjectToken(type)) {
        const objectId = getObjectIdFromToken(type);
        const objectEntry = getObjectEntries().find(item => item.id === objectId);
        return objectEntry ? (objectEntry.displayLabel || getObjectDisplayLabel(objectEntry)) : '自訂物件';
    }

    const labels = {
        name: '姓名',
        company: '公司',
        position: '職位',
        qrcode: 'QRCode'
    };
    return labels[type] || type;
}

function handleObjectManagerClick(event) {
    const target = event.target.closest('[data-action][data-object-id]');
    if (!target) {
        return;
    }

    const objectId = target.getAttribute('data-object-id');
    const action = target.getAttribute('data-action');
    const objectMeta = getObjectEntries().find(item => item.id === objectId) || null;

    if (action === 'select') {
        selectObject(objectId, { focusTextEditor: objectMeta?.type === 'text' });
        showNotification('已選取物件，可在畫布拖曳調整位置', 'info');
        return;
    }

    if (action === 'toggle-visible') {
        toggleObjectVisibility(objectId);
        showNotification('已更新物件顯示狀態', 'success');
        return;
    }

    if (action === 'delete') {
        deleteObjectById(objectId);
        showNotification('物件已清除', 'success');
    }
}

function handleObjectManagerDragStart(event) {
    const itemNode = event.target.closest('.object-manager-item[data-object-id]');
    if (!itemNode) {
        return;
    }

    draggedObjectId = itemNode.dataset.objectId;
    itemNode.classList.add('is-dragging');
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedObjectId);
    }
}

function handleObjectManagerDragOver(event) {
    if (!draggedObjectId) {
        return;
    }

    const listNode = document.getElementById('objectManagerList');
    const targetNode = event.target.closest('.object-manager-item[data-object-id]');
    const draggingNode = listNode ? listNode.querySelector(`.object-manager-item[data-object-id="${draggedObjectId}"]`) : null;

    if (!listNode || !draggingNode) {
        return;
    }

    event.preventDefault();

    if (!targetNode) {
        listNode.appendChild(draggingNode);
        return;
    }

    if (targetNode === draggingNode) {
        return;
    }

    const rect = targetNode.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    if (insertAfter) {
        listNode.insertBefore(draggingNode, targetNode.nextSibling);
    } else {
        listNode.insertBefore(draggingNode, targetNode);
    }
}

function handleObjectManagerDrop(event) {
    if (!draggedObjectId) {
        return;
    }

    event.preventDefault();
    const listNode = document.getElementById('objectManagerList');
    if (!listNode) {
        return;
    }

    const displayOrder = Array.from(listNode.querySelectorAll('.object-manager-item[data-object-id]'))
        .map(node => node.dataset.objectId)
        .filter(Boolean);

    if (!displayOrder.length) {
        return;
    }

    window.nameplateState.objectOrder = [...displayOrder].reverse();
    renderObjectManagerList();
    triggerRender();
    saveSettings();
    showNotification('已調整圖層順序', 'success');
}

function handleObjectManagerDragEnd() {
    const listNode = document.getElementById('objectManagerList');
    if (listNode) {
        listNode.querySelectorAll('.object-manager-item.is-dragging').forEach(node => {
            node.classList.remove('is-dragging');
        });
    }

    draggedObjectId = null;
}

function handleAddTextObject() {
    ensureObjectState();
    const textInput = document.getElementById('objectTextInput');
    const textValue = String(textInput.value || '').trim() || '新文字';

    const objectMeta = {
        id: generateObjectId('text'),
        type: 'text',
        text: textValue,
        fontSize: Math.max(20, Math.round((window.nameplateState.nameFontSize || 120) * 0.42)),
        color: window.nameplateState.textColor || '#000000',
        textShadow: false,
        offsetX: 0,
        offsetY: 0,
        visible: true
    };

    window.nameplateState.customObjects.push(objectMeta);
    ensureObjectState();
    textInput.value = '';
    selectObject(objectMeta.id);
    triggerRender();
    saveSettings();
    showNotification('已新增文字物件', 'success');
}

// ========== 新增物件按鈕與彈窗 ==========
function handleAddObjectClick() {
    const modal = document.getElementById('addObjectModal');
    if (modal) modal.style.display = 'flex';
}

function initAddObjectModal() {
    const modal = document.getElementById('addObjectModal');
    if (!modal) return;

    modal.querySelectorAll('.add-object-option').forEach(btn => {
        btn.addEventListener('click', function () {
            const type = this.dataset.type;
            modal.style.display = 'none';

            if (type === 'text') {
                const text = prompt('請輸入文字內容：', '新文字');
                if (text === null) return;
                document.getElementById('objectTextInput').value = text;
                handleAddTextObject();
            } else if (type === 'image') {
                document.getElementById('objectImageFileInput').click();
            } else if (type === 'qr') {
                const url = prompt('請輸入 QRCode 網址：', 'https://');
                if (url === null || url.trim() === '') return;
                document.getElementById('objectQrUrlInput').value = url;
                handleAddQrObject();
            }
        });
    });

    const closeBtn = modal.querySelector('.add-object-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // File input change → auto-create image object
    document.getElementById('objectImageFileInput').addEventListener('change', function () {
        const file = this.files && this.files[0] ? this.files[0] : null;
        if (file) addImageObjectFromFile(file);
        this.value = '';
    });
}

async function handleAddQrObject() {
    ensureObjectState();
    const qrUrlInput = document.getElementById('objectQrUrlInput');
    const qrUrl = String(qrUrlInput.value || '').trim() || DEFAULT_QR_SAMPLE_URL;

    try {
        const dataUrl = await generateQrCodeDataUrl(qrUrl);
        const objectMeta = {
            id: generateObjectId('qr'),
            type: 'qr',
            qrUrl,
            dataUrl,
            size: window.nameplateState.qrSize || 100,
            offsetX: 0,
            offsetY: 0,
            visible: true
        };

        window.nameplateState.customObjects.push(objectMeta);
        ensureObjectState();
        qrUrlInput.value = '';
        selectObject(objectMeta.id);
        triggerRender();
        saveSettings();
        showNotification('已新增 QRCode 物件', 'success');
    } catch (error) {
        showNotification(`新增 QRCode 失敗: ${error.message}`, 'error');
    }
}

async function addImageObjectFromFile(file) {
    ensureObjectState();
    if (!file) {
        showNotification('請先選擇小圖片檔案', 'error');
        return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
        showNotification('檔案格式不正確，請選擇圖片', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showNotification('圖片大小不能超過 5MB', 'error');
        return;
    }

    try {
        const dataUrl = await readImageFileAsDataUrl(file);
        const objectMeta = {
            id: generateObjectId('img'),
            type: 'image',
            name: file.name,
            dataUrl,
            width: 120,
            height: 120,
            lockAspectRatio: false,
            aspectRatio: 1,
            offsetX: 0,
            offsetY: 0,
            visible: true
        };

        window.nameplateState.customObjects.push(objectMeta);
        ensureObjectState();
        const imageInput = document.getElementById('objectImageFileInput');
        if (imageInput) {
            imageInput.value = '';
        }
        selectObject(objectMeta.id);
        triggerRender();
        saveSettings();
        showNotification('已新增小圖片物件', 'success');
    } catch (error) {
        showNotification(`新增小圖片失敗: ${error.message}`, 'error');
    }
}

async function handleAddImageObject() {
    preferredPasteImageTarget = 'object-image';
    const imageInput = document.getElementById('objectImageFileInput');
    const file = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
    await addImageObjectFromFile(file);
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
    ensureObjectState(window.nameplateState);
    syncControlsFromState(nextState, template.opacity);
    renderObjectManagerList();
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

                let deviceSyncMessage = '';
                try {
                    const deviceSyncResult = await pushBatchRecordToPhilipsDevice(record);
                    if (deviceSyncResult && deviceSyncResult.message) {
                        deviceSyncMessage = deviceSyncResult.skipped
                            ? deviceSyncResult.message
                            : `；${deviceSyncResult.message}`;
                    }
                } catch (deviceError) {
                    deviceSyncMessage = `；桌牌同步失敗: ${deviceError.message}`;
                    console.warn('批次桌牌同步失敗:', record, deviceError);
                }

                results.push({
                    rowNumber: record.rowNumber,
                    fileName,
                    success: true,
                    message: `輸出完成${deviceSyncMessage}`
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
                        document.getElementById('nameInput').value = '姓名';
        document.getElementById('companyInput').value = '公司名稱';
        document.getElementById('positionInput').value = '職位名稱';
        document.getElementById('bgColorInput').value = '#ffffff';
        document.getElementById('textColorInput').value = '#000000';
        document.getElementById('nameFontSize').value = 120;
        document.getElementById('companyFontSize').value = 50;
        document.getElementById('positionFontSize').value = 50;
        document.getElementById('bgOpacity').value = 100;
        document.getElementById('textShadow').checked = false;
        document.getElementById('nameOffsetX').value = 0;
        document.getElementById('nameOffsetY').value = 0;
        document.getElementById('companyOffsetX').value = 0;
        document.getElementById('companyOffsetY').value = 0;
        document.getElementById('positionOffsetX').value = 0;
        document.getElementById('positionOffsetY').value = 0;
        document.getElementById('qrcodeOffsetX').value = -280;
        document.getElementById('qrcodeOffsetY').value = 0;
        document.getElementById('qrcodeOffsetXInput').value = -280;
        document.getElementById('qrcodeOffsetYInput').value = 0;
        document.getElementById('qrSize').value = 100;
        document.getElementById('qrSizeValue').textContent = '100px';
        document.getElementById('qrUrlInput').value = '';
        document.getElementById('directImageUploadInput').value = '';
        directUploadImageFile = null;
        updateDirectImagePreview('');

        // 重置狀態
        window.nameplateState = {
                name: '姓名',
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
            customObjects: []
        };
        selectedObjectId = 'default-name';
        renderObjectManagerList();

        // 清除圖片
        handleClearImage();

        // 更新UI
        document.getElementById('colorValue').textContent = '#ffffff';
        document.getElementById('textColorValue').textContent = '#000000';
        document.getElementById('nameFontSizeValue').textContent = '120px';
        document.getElementById('companyFontSizeValue').textContent = '50px';
        document.getElementById('positionFontSizeValue').textContent = '50px';
        document.getElementById('opacityValue').textContent = '100%';
        updateOffsetDisplay('nameOffsetXValue', 0);
        updateOffsetDisplay('nameOffsetYValue', 0);
        updateOffsetDisplay('companyOffsetXValue', 0);
        updateOffsetDisplay('companyOffsetYValue', 0);
        updateOffsetDisplay('positionOffsetXValue', 0);
        updateOffsetDisplay('positionOffsetYValue', 0);
        updateOffsetDisplay('qrcodeOffsetXValue', -280);
        updateOffsetDisplay('qrcodeOffsetYValue', 0);
        
        // 重置number input
        document.getElementById('nameOffsetXInput').value = 0;
        document.getElementById('nameOffsetYInput').value = 0;
        document.getElementById('companyOffsetXInput').value = 0;
        document.getElementById('companyOffsetYInput').value = 0;
        document.getElementById('positionOffsetXInput').value = 0;
        document.getElementById('positionOffsetYInput').value = 0;
        document.getElementById('qrcodeOffsetXInput').value = -280;
        document.getElementById('qrcodeOffsetYInput').value = 0;

        // 清除 QRCode
        handleClearQrCode();
        applyDefaultSampleQrIfNeeded();
        
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
    window.nameplateState.nameTextColor = preset.textColor;
    window.nameplateState.companyTextColor = preset.textColor;
    window.nameplateState.positionTextColor = preset.textColor;
    window.nameplateState.textShadow = preset.textShadow;
    window.nameplateState.nameTextShadow = preset.textShadow;
    window.nameplateState.companyTextShadow = preset.textShadow;
    window.nameplateState.positionTextShadow = preset.textShadow;

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

    // 更新推薦選項的選中狀態
    updateActiveRecOption('recommendedBgColors', preset.bgColor);
    updateActiveRecOption('recommendedTextColors', preset.textColor);

    // 同步更新物件管理器設定面板
    renderSelectedObjectSettings();

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
let currentAspectRatio = { w: 5, h: 3, canvasWidth: 800, canvasHeight: 480 };

function isFixedCanvasPreset(aspectRatio) {
    if (!aspectRatio) {
        return false;
    }

    const defaultCanvasHeight = Math.round(1000 * aspectRatio.h / aspectRatio.w);
    const canvasWidth = aspectRatio.canvasWidth || 1000;
    const canvasHeight = aspectRatio.canvasHeight || defaultCanvasHeight;

    return canvasWidth !== 1000 || canvasHeight !== defaultCanvasHeight;
}

function simplifyRatio(width, height) {
    let a = Math.max(1, Math.round(width));
    let b = Math.max(1, Math.round(height));

    while (b !== 0) {
        const t = b;
        b = a % b;
        a = t;
    }

    const gcd = Math.max(a, 1);
    return {
        w: Math.max(1, Math.round(width / gcd)),
        h: Math.max(1, Math.round(height / gcd))
    };
}

function scheduleAutoApplyCustomRatio() {
    if (autoApplyRatioTimer) {
        clearTimeout(autoApplyRatioTimer);
    }

    autoApplyRatioTimer = setTimeout(() => {
        handleApplyCustomRatio({ silentInvalid: true });
    }, 300);
}

function scheduleAutoApplyCustomCanvasSize() {
    if (autoApplyCanvasSizeTimer) {
        clearTimeout(autoApplyCanvasSizeTimer);
    }

    autoApplyCanvasSizeTimer = setTimeout(() => {
        handleApplyCustomCanvasSize({ silentInvalid: true });
    }, 300);
}

function handleApplyCustomRatio(options = {}) {
    if (autoApplyRatioTimer) {
        clearTimeout(autoApplyRatioTimer);
        autoApplyRatioTimer = null;
    }

    const w = parseInt(document.getElementById('customRatioW').value, 10);
    const h = parseInt(document.getElementById('customRatioH').value, 10);

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        if (!options.silentInvalid) {
            showNotification('請輸入有效的比例數值', 'error');
        }
        return;
    }

    applyAspectRatio(w, h);
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));

    // 自訂比例非 Philips 建議尺寸，提示使用者
    showToast('此比例非 Philips 會議桌牌建議尺寸 (800×480)，可能無法正確顯示。', 'warning', 4000);
}

function handleApplyCustomCanvasSize(options = {}) {
    if (autoApplyCanvasSizeTimer) {
        clearTimeout(autoApplyCanvasSizeTimer);
        autoApplyCanvasSizeTimer = null;
    }

    const width = parseInt(document.getElementById('customCanvasWidth').value, 10);
    const height = parseInt(document.getElementById('customCanvasHeight').value, 10);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        if (!options.silentInvalid) {
            showNotification('請輸入有效的畫布尺寸 (px)', 'error');
        }
        return;
    }

    const ratio = simplifyRatio(width, height);
    document.getElementById('customRatioW').value = ratio.w;
    document.getElementById('customRatioH').value = ratio.h;

    applyAspectRatio(ratio.w, ratio.h, {
        canvasWidth: width,
        canvasHeight: height
    });
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));

    // 自訂尺寸非 Philips 建議尺寸 (800×480) 時提示
    if (width !== 800 || height !== 480) {
        showToast('此尺寸非 Philips 會議桌牌建議尺寸 (800×480)，可能無法正確顯示。', 'warning', 4000);
    }
}

function cloneJsonCompatible(value) {
    return JSON.parse(JSON.stringify(value));
}

function createSettingsSnapshot() {
    return {
        state: cloneJsonCompatible(window.nameplateState),
        opacity: String(document.getElementById('bgOpacity').value || '100'),
        bgImageDataUrl,
        qrCodeDataUrl,
        aspectRatio: cloneJsonCompatible(currentAspectRatio),
        philips: cloneJsonCompatible(philipsControlState)
    };
}

function getSnapshotKey(snapshot) {
    return JSON.stringify(snapshot);
}

function pushUndoSnapshot(snapshot) {
    undoHistoryStack.push(snapshot);
    if (undoHistoryStack.length > UNDO_HISTORY_LIMIT) {
        undoHistoryStack.shift();
    }
}

function pushRedoSnapshot(snapshot) {
    redoHistoryStack.push(snapshot);
    if (redoHistoryStack.length > UNDO_HISTORY_LIMIT) {
        redoHistoryStack.shift();
    }
}

function syncAspectRatioControls(w, h) {
    document.getElementById('customRatioW').value = w;
    document.getElementById('customRatioH').value = h;
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        const buttonCanvasWidth = parseInt(btn.dataset.canvasWidth);
        const buttonCanvasHeight = parseInt(btn.dataset.canvasHeight);
        const hasFixedCanvasSize = !Number.isNaN(buttonCanvasWidth) && !Number.isNaN(buttonCanvasHeight);
        const matchesFixedCanvasSize = hasFixedCanvasSize &&
            buttonCanvasWidth === currentAspectRatio.canvasWidth &&
            buttonCanvasHeight === currentAspectRatio.canvasHeight;
        const matchesRatioOnly = !hasFixedCanvasSize &&
            !isFixedCanvasPreset(currentAspectRatio) &&
            parseInt(btn.dataset.w) === w &&
            parseInt(btn.dataset.h) === h;
        btn.classList.toggle('active', matchesFixedCanvasSize || matchesRatioOnly);
    });
}

async function applySnapshot(snapshot, options = {}) {
    if (!snapshot) {
        return;
    }

    isApplyingUndoState = true;
    try {
        window.nameplateState = cloneJsonCompatible(snapshot.state || window.nameplateState);
        normalizeFontSizes(window.nameplateState);
        normalizeQrState(window.nameplateState);
        normalizeTextOffsetState(window.nameplateState);

        bgImageDataUrl = snapshot.bgImageDataUrl || null;
        qrCodeDataUrl = snapshot.qrCodeDataUrl || null;
        philipsControlState = normalizePhilipsControlState(snapshot.philips);

        const opacity = parseInt(snapshot.opacity, 10) || 100;
        const aspectRatio = snapshot.aspectRatio || currentAspectRatio;
        if (aspectRatio) {
            const { w, h, canvasWidth, canvasHeight } = aspectRatio;
            applyAspectRatio(w, h, {
                canvasWidth,
                canvasHeight,
                skipSave: true
            });
            syncAspectRatioControls(w, h);
        }

        syncControlsFromState(window.nameplateState, opacity);
        syncPhilipsControlsFromState();
        window.renderer.setBackgroundOpacity(opacity);

        if (bgImageDataUrl) {
            window.renderer.setBackgroundImageDataUrl(bgImageDataUrl);
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${bgImageDataUrl}" alt="背景預覽">`;
            preview.classList.add('has-image');
            document.getElementById('clearImageBtn').style.display = 'block';
        } else {
            window.renderer.clearBackgroundImage();
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = '<span>未選擇圖片</span>';
                preview.classList.remove('has-image');
                document.getElementById('clearImageBtn').style.display = 'none';
                document.getElementById('bgOpacityGroup').style.display = 'none';
        }

        if (qrCodeDataUrl) {
            await window.renderer.setQrCodeDataUrl(qrCodeDataUrl);
            updateQrPreview(qrCodeDataUrl);
        } else {
            window.renderer.clearQrCode();
            const qrPreview = document.getElementById('qrPreview');
            qrPreview.innerHTML = '<span>未設定 QRCode</span>';
            qrPreview.classList.remove('has-image');
            document.getElementById('clearQrBtn').style.display = 'none';
        }

        updateQrToggleButton();
        renderObjectManagerList();
        triggerRender();
        saveSettings({ skipHistory: true });

        if (options.showNotification !== false) {
            showNotification(options.message || '已還原上一步', 'info');
        }
    } finally {
        isApplyingUndoState = false;
    }
}

function handleUndoShortcut() {
    if (undoHistoryStack.length === 0) {
        showNotification('沒有可還原的步驟', 'info');
        return;
    }

    const currentSnapshot = createSettingsSnapshot();
    pushRedoSnapshot(cloneJsonCompatible(currentSnapshot));

    const snapshot = undoHistoryStack.pop();
    void applySnapshot(snapshot, { showNotification: true, message: '已還原上一步' });
}

function handleRedoShortcut() {
    if (redoHistoryStack.length === 0) {
        showNotification('沒有可重做的步驟', 'info');
        return;
    }

    const currentSnapshot = createSettingsSnapshot();
    pushUndoSnapshot(cloneJsonCompatible(currentSnapshot));

    const snapshot = redoHistoryStack.pop();
    void applySnapshot(snapshot, { showNotification: true, message: '已重做上一步' });
}

function applyAspectRatio(w, h, options = {}) {
    const canvasWidth = Number.isFinite(options.canvasWidth) ? options.canvasWidth : 1000;
    const canvasHeight = Number.isFinite(options.canvasHeight)
        ? options.canvasHeight
        : Math.round(canvasWidth * h / w);
    const canvas = document.getElementById('nameplate');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    currentAspectRatio = { w, h, canvasWidth, canvasHeight };

    const sizeText = `目前尺寸: ${canvasWidth}×${canvasHeight} px`;
    const canvasSizeInfo = document.getElementById('canvasSizeInfo');
    if (canvasSizeInfo) canvasSizeInfo.textContent = sizeText;
    const previewSizeInfo = document.getElementById('previewSizeInfo');
    if (previewSizeInfo) previewSizeInfo.textContent = `預覽尺寸: ${canvasWidth}×${canvasHeight} px`;
    const customCanvasWidthInput = document.getElementById('customCanvasWidth');
    const customCanvasHeightInput = document.getElementById('customCanvasHeight');
    if (customCanvasWidthInput) customCanvasWidthInput.value = canvasWidth;
    if (customCanvasHeightInput) customCanvasHeightInput.value = canvasHeight;

    updateTextPositionControlRanges();

    triggerRender();
    if (!options.skipSave) {
        saveSettings();
    }
}

function saveSettings(options = {}) {
    try {
        ensureObjectState(window.nameplateState);
        syncPhilipsControlsToState();
        const snapshot = createSettingsSnapshot();
        const snapshotKey = getSnapshotKey(snapshot);

        if (!options.skipRedoClear && !isApplyingUndoState && lastSavedSnapshot && lastSavedSnapshotKey !== snapshotKey) {
            redoHistoryStack = [];
        }

        if (isContinuousRangeAdjusting && !rangeAdjustSnapshotPushed && lastSavedSnapshot && lastSavedSnapshotKey !== snapshotKey) {
            pushUndoSnapshot(cloneJsonCompatible(lastSavedSnapshot));
            rangeAdjustSnapshotPushed = true;
        }

        if (!options.skipHistory && !isApplyingUndoState && !isContinuousRangeAdjusting && lastSavedSnapshot && lastSavedSnapshotKey !== snapshotKey) {
            pushUndoSnapshot(cloneJsonCompatible(lastSavedSnapshot));
        }

        const settings = {
            state: window.nameplateState,
            opacity: document.getElementById('bgOpacity').value,
            bgImageDataUrl: bgImageDataUrl,
            qrCodeDataUrl: qrCodeDataUrl,
            aspectRatio: currentAspectRatio,
            philips: {
                ...philipsControlState,
                devices: [],
                discoveredDevices: [],
                manualDevices: []
            }
        };
        localStorage.setItem('nameplateSettings', JSON.stringify(settings));

        lastSavedSnapshot = snapshot;
        lastSavedSnapshotKey = snapshotKey;
    } catch (err) {
        console.error('保存設置失敗:', err);
    }
}

function normalizeFontSizes(state) {
    const legacyBaseSize = parseInt(state.fontSize || 120);
    if (!state.nameFontSize) {
        state.nameFontSize = legacyBaseSize;
    }
    if (!state.companyFontSize) {
        state.companyFontSize = Math.max(24, Math.round(legacyBaseSize * 0.42));
    }
    if (!state.positionFontSize) {
        state.positionFontSize = Math.max(24, Math.round(legacyBaseSize * 0.42));
    }
}

function normalizeQrState(state) {
    if (state.qrSize == null) state.qrSize = 100;
    if (state.qrcodeOffsetX == null) state.qrcodeOffsetX = -280;
    if (state.qrcodeOffsetY == null) state.qrcodeOffsetY = 0;
    if (state.qrVisible == null) state.qrVisible = true;
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

function normalizeDefaultTextShadowState(state) {
    const legacyShadow = Boolean(state.textShadow);
    if (state.nameTextShadow == null) state.nameTextShadow = legacyShadow;
    if (state.companyTextShadow == null) state.companyTextShadow = legacyShadow;
    if (state.positionTextShadow == null) state.positionTextShadow = legacyShadow;
}

function normalizeDefaultTextColorState(state) {
    const legacyColor = String(state.textColor || '#000000');
    if (!state.nameTextColor) state.nameTextColor = legacyColor;
    if (!state.companyTextColor) state.companyTextColor = legacyColor;
    if (!state.positionTextColor) state.positionTextColor = legacyColor;
}

function syncControlsFromState(state, opacity = 100) {
    ensureObjectState(state);
    normalizeFontSizes(state);
    normalizeQrState(state);
    normalizeTextOffsetState(state);
    normalizeDefaultTextShadowState(state);
    normalizeDefaultTextColorState(state);

    document.getElementById('nameInput').value = state.name || '';
    document.getElementById('companyInput').value = state.company || '';
    document.getElementById('positionInput').value = state.position || '';
    document.getElementById('bgColorInput').value = state.bgColor;
    document.getElementById('textColorInput').value = state.textColor;
    document.getElementById('nameFontSize').value = state.nameFontSize;
    document.getElementById('companyFontSize').value = state.companyFontSize;
    document.getElementById('positionFontSize').value = state.positionFontSize;
    document.getElementById('bgOpacity').value = opacity;
    document.getElementById('textShadow').checked = Boolean(state.nameTextShadow || state.companyTextShadow || state.positionTextShadow);

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

    updateQrToggleButton();
    updateTextPositionControlRanges();
    updateCharCount((state.name || '').length);
}

function loadPreferredSettings() {
    try {
        const saved = localStorage.getItem('nameplateSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            window.nameplateState = settings.state;
            ensureObjectState(window.nameplateState);
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
                const { w, h, canvasWidth, canvasHeight } = settings.aspectRatio;
                applyAspectRatio(w, h, {
                    canvasWidth,
                    canvasHeight,
                    skipSave: true
                });
                syncAspectRatioControls(w, h);
            }

            if (bgImageDataUrl) {
                window.renderer.setBackgroundImageDataUrl(bgImageDataUrl);
                const preview = document.getElementById('imagePreview');
                preview.innerHTML = `<img src="${bgImageDataUrl}" alt="背景預覽">`;
                preview.classList.add('has-image');
                document.getElementById('clearImageBtn').style.display = 'block';
                document.getElementById('bgOpacityGroup').style.display = 'block';
            } else {
                document.getElementById('bgImageInput').value = '';
                window.renderer.clearBackgroundImage();
                const preview = document.getElementById('imagePreview');
                preview.innerHTML = '<span>未選擇圖片</span>';
                preview.classList.remove('has-image');
                document.getElementById('clearImageBtn').style.display = 'none';
                document.getElementById('bgOpacityGroup').style.display = 'none';
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

            updateQrToggleButton();

            triggerRender();
            renderObjectManagerList();
        } else {
            ensureObjectState(window.nameplateState);
            syncControlsFromState(window.nameplateState, document.getElementById('bgOpacity').value || 100);
            bgImageDataUrl = null;
            qrCodeDataUrl = null;
            philipsControlState = normalizePhilipsControlState();
            syncPhilipsControlsFromState();
            updateQrToggleButton();
            applyDefaultSampleQrIfNeeded();
            renderObjectManagerList();
        }

        lastSavedSnapshot = createSettingsSnapshot();
        lastSavedSnapshotKey = getSnapshotKey(lastSavedSnapshot);
        undoHistoryStack = [];
        redoHistoryStack = [];
    } catch (err) {
        console.error('加載設置失敗:', err);
        ensureObjectState(window.nameplateState);
        renderObjectManagerList();
        philipsControlState = normalizePhilipsControlState();
        syncPhilipsControlsFromState();
    }
}

// ========== UI 輔助函数 ==========
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
    const loadingBar = document.getElementById('loading-bar');
    if (loadingBar) {
        loadingBar.style.display = show ? 'block' : 'none';
    }
}

function setLoading(show) {
    showLoading(show);
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        // Fallback to old notification element
        showNotification(message, type);
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => {
        toast.classList.add('toast-out');
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }, duration);
}

function showNotification(message, type = 'info') {
    // Delegate to new toast system
    showToast(message, type);
}

// ========== 輔助功能 ==========
function normalizeShortcutKey(key) {
    if (!key) {
        return '';
    }

    // 將全形英數轉為半形，避免 Ctrl+ｚ 無法辨識
    const normalized = Array.from(String(key)).map(char => {
        const code = char.charCodeAt(0);
        if (code >= 0xFF01 && code <= 0xFF5E) {
            return String.fromCharCode(code - 0xFEE0);
        }
        return char;
    }).join('');

    return normalized.toLowerCase();
}

function isUndoShortcut(event) {
    if (!(event.ctrlKey || event.metaKey) || event.shiftKey) {
        return false;
    }

    // 優先使用實體鍵位，再退回 key 值（含全形字元）
    if (event.code === 'KeyZ') {
        return true;
    }

    return normalizeShortcutKey(event.key) === 'z';
}

function isRedoShortcut(event) {
    if (!(event.ctrlKey || event.metaKey)) {
        return false;
    }

    if (event.shiftKey && event.code === 'KeyZ') {
        return true;
    }

    if (event.shiftKey && normalizeShortcutKey(event.key) === 'z') {
        return true;
    }

    if (!event.shiftKey && event.code === 'KeyY') {
        return true;
    }

    return !event.shiftKey && normalizeShortcutKey(event.key) === 'y';
}

// 支援鍵盤快捷鍵
document.addEventListener('keydown', (e) => {
    // Ctrl+S / Cmd+S - 下載
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleDownload();
        return;
    }

    // Ctrl+Z / Cmd+Z - 還原上一步
    if (isUndoShortcut(e)) {
        e.preventDefault();
        handleUndoShortcut();
        return;
    }

    // Ctrl+Y / Cmd+Y 或 Ctrl+Shift+Z / Cmd+Shift+Z - 重做
    if (isRedoShortcut(e)) {
        e.preventDefault();
        handleRedoShortcut();
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
