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

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    initRenderer();
    attachEventListeners();
    loadPreferredSettings();
    initDarkMode();
});

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

    // 文字樣式
    document.getElementById('fontSize').addEventListener('input', handleFontSizeChange);
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
    
    // Canvas 拖曳事件
    const canvas = document.getElementById('nameplate');
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

    // 操作按鈕
    document.getElementById('downloadBtn').addEventListener('click', handleDownload);
    document.getElementById('resetBtn').addEventListener('click', handleReset);
    document.getElementById('uploadBtn').addEventListener('click', handleUpload);

    // 快速預設
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', handlePresetClick);
    });

    // 深色模式
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
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

        window.renderer.setBackgroundImage(file);
        
        // 顯示圖片預覽
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${e.target.result}" alt="背景預覽">`;
            preview.classList.add('has-image');
            document.getElementById('clearImageBtn').style.display = 'block';
        };
        reader.readAsDataURL(file);

        showNotification('圖片已上傳', 'success');
        saveSettings();
    }
}

function handleClearImage() {
    document.getElementById('bgImageInput').value = '';
    window.renderer.clearBackgroundImage();
    
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

// ========== 文字樣式處理 ==========
function handleFontSizeChange(e) {
    const size = parseInt(e.target.value);
    window.nameplateState.fontSize = size;
    document.getElementById('fontSizeValue').textContent = `${size}px`;
    triggerRender();
    saveSettings();
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
    document.getElementById('nameOffsetXValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
}

function handleNameOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.nameOffsetY = value;
    document.getElementById('nameOffsetYValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
}

// ========== 文字位置處理 - 公司 ==========
function handleCompanyOffsetXChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.companyOffsetX = value;
    document.getElementById('companyOffsetXValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
}

function handleCompanyOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.companyOffsetY = value;
    document.getElementById('companyOffsetYValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
}

// ========== 文字位置處理 - 職位 ==========
function handlePositionOffsetXChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.positionOffsetX = value;
    document.getElementById('positionOffsetXValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
}

function handlePositionOffsetYChange(e) {
    const value = parseInt(e.target.value);
    window.nameplateState.positionOffsetY = value;
    document.getElementById('positionOffsetYValue').textContent = `${value}px`;
    triggerRender();
    saveSettings();
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
        const newOffsetX = Math.max(-100, Math.min(100, dragState.startOffsetX + deltaX));
        const newOffsetY = Math.max(-100, Math.min(100, dragState.startOffsetY + deltaY));

        window.nameplateState[`${dragState.selectedText}OffsetX`] = newOffsetX;
        window.nameplateState[`${dragState.selectedText}OffsetY`] = newOffsetY;

        // 更新滑塊
        document.getElementById(`${dragState.selectedText}OffsetX`).value = newOffsetX;
        document.getElementById(`${dragState.selectedText}OffsetY`).value = newOffsetY;
        document.getElementById(`${dragState.selectedText}OffsetXValue`).textContent = `${newOffsetX}px`;
        document.getElementById(`${dragState.selectedText}OffsetYValue`).textContent = `${newOffsetY}px`;

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

function getTextLabel(type) {
    const labels = {
        name: '姓名',
        company: '公司',
        position: '職位'
    };
    return labels[type] || type;
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
        document.getElementById('fontSize').value = 48;
        document.getElementById('bgOpacity').value = 100;
        document.getElementById('textShadow').checked = false;
        document.getElementById('nameOffsetX').value = 0;
        document.getElementById('nameOffsetY').value = 0;
        document.getElementById('companyOffsetX').value = 0;
        document.getElementById('companyOffsetY').value = 0;
        document.getElementById('positionOffsetX').value = 0;
        document.getElementById('positionOffsetY').value = 0;

        // 重置狀態
        window.nameplateState = {
            name: '名子',
            company: '公司名稱',
            position: '職位名稱',
            bgColor: '#ffffff',
            fontSize: 48,
            textColor: '#000000',
            textShadow: false,
            nameOffsetX: 0,
            nameOffsetY: 0,
            companyOffsetX: 0,
            companyOffsetY: 0,
            positionOffsetX: 0,
            positionOffsetY: 0
        };

        // 清除圖片
        handleClearImage();

        // 更新UI
        document.getElementById('colorValue').textContent = '#ffffff';
        document.getElementById('textColorValue').textContent = '#000000';
        document.getElementById('fontSizeValue').textContent = '48px';
        document.getElementById('opacityValue').textContent = '100%';
        document.getElementById('nameOffsetXValue').textContent = '0px';
        document.getElementById('nameOffsetYValue').textContent = '0px';
        document.getElementById('companyOffsetXValue').textContent = '0px';
        document.getElementById('companyOffsetYValue').textContent = '0px';
        document.getElementById('positionOffsetXValue').textContent = '0px';
        document.getElementById('positionOffsetYValue').textContent = '0px';
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
    window.nameplateState.fontSize = preset.fontSize;
    window.nameplateState.textColor = preset.textColor;
    window.nameplateState.textShadow = preset.textShadow;

    // 更新表單
    document.getElementById('bgColorInput').value = preset.bgColor;
    document.getElementById('fontSize').value = preset.fontSize;
    document.getElementById('textColorInput').value = preset.textColor;
    document.getElementById('textShadow').checked = preset.textShadow;

    // 更新顯示值
    document.getElementById('colorValue').textContent = preset.bgColor;
    document.getElementById('fontSizeValue').textContent = `${preset.fontSize}px`;
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

// ========== API上傳處理 ==========
function handleUpload() {
    const uploadUrl = document.getElementById('uploadUrl').value;

    if (!uploadUrl) {
        showNotification('請輸入 API 位址', 'error');
        return;
    }

    showLoading(true);

    try {
        const imageData = window.renderer.exportBase64();
        const payloadData = {
            name: window.nameplateState.name,
            company: window.nameplateState.company || '',
            position: window.nameplateState.position || '',
            image: imageData,
            timestamp: new Date().toISOString()
        };

        fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadData)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                showLoading(false);
                showNotification('上傳成功！', 'success');
                console.log('API 回應:', data);
            })
            .catch(error => {
                showLoading(false);
                console.error('上傳失敗:', error);
                showNotification(`上傳失敗: ${error.message}`, 'error');
            });
    } catch (err) {
        showLoading(false);
        console.error('準備資料失敗:', err);
        showNotification('準備資料失敗', 'error');
    }
}

// ========== 存儲和加載設置 ==========
function saveSettings() {
    try {
        const settings = {
            state: window.nameplateState,
            opacity: document.getElementById('bgOpacity').value
        };
        localStorage.setItem('nameplateSettings', JSON.stringify(settings));
    } catch (err) {
        console.error('保存設置失敗:', err);
    }
}

function loadPreferredSettings() {
    try {
        const saved = localStorage.getItem('nameplateSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            window.nameplateState = settings.state;

            // 恢復表單值
            document.getElementById('nameInput').value = settings.state.name || '';
            document.getElementById('companyInput').value = settings.state.company || '';
            document.getElementById('positionInput').value = settings.state.position || '';
            document.getElementById('bgColorInput').value = settings.state.bgColor;
            document.getElementById('textColorInput').value = settings.state.textColor;
            document.getElementById('fontSize').value = settings.state.fontSize;
            document.getElementById('bgOpacity').value = settings.opacity || 100;
            document.getElementById('textShadow').checked = settings.state.textShadow;
            
            // 恢復位置設定
            document.getElementById('nameOffsetX').value = settings.state.nameOffsetX || 0;
            document.getElementById('nameOffsetY').value = settings.state.nameOffsetY || 0;
            document.getElementById('companyOffsetX').value = settings.state.companyOffsetX || 0;
            document.getElementById('companyOffsetY').value = settings.state.companyOffsetY || 0;
            document.getElementById('positionOffsetX').value = settings.state.positionOffsetX || 0;
            document.getElementById('positionOffsetY').value = settings.state.positionOffsetY || 0;

            // 更新顯示值
            document.getElementById('colorValue').textContent = settings.state.bgColor;
            document.getElementById('textColorValue').textContent = settings.state.textColor;
            document.getElementById('fontSizeValue').textContent = `${settings.state.fontSize}px`;
            document.getElementById('opacityValue').textContent = `${settings.opacity || 100}%`;
            document.getElementById('nameOffsetXValue').textContent = `${settings.state.nameOffsetX || 0}px`;
            document.getElementById('nameOffsetYValue').textContent = `${settings.state.nameOffsetY || 0}px`;
            document.getElementById('companyOffsetXValue').textContent = `${settings.state.companyOffsetX || 0}px`;
            document.getElementById('companyOffsetYValue').textContent = `${settings.state.companyOffsetY || 0}px`;
            document.getElementById('positionOffsetXValue').textContent = `${settings.state.positionOffsetX || 0}px`;
            document.getElementById('positionOffsetYValue').textContent = `${settings.state.positionOffsetY || 0}px`;
            
            updateCharCount(settings.state.name.length);

            triggerRender();
        }
    } catch (err) {
        console.error('加載設置失敗:', err);
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
