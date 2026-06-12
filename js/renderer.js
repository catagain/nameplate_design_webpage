/**
 * 名牌渲染器 - 處理Canvas繪製邏輯
 */
class NameplateRenderer {
    constructor(canvasId) {
        if (typeof canvasId === 'string') {
            this.canvas = document.getElementById(canvasId);
        } else if (canvasId instanceof HTMLCanvasElement) {
            this.canvas = canvasId;
        }
        this.ctx = this.canvas.getContext('2d');
        this.bgImage = null;
        this.qrImage = null;
        this.bgImageOpacity = 1;
        this.objectImageCache = new Map();
    }

    /**
     * 設定背景圖片
     */
    setBackgroundImage(file) {
        if (!file) {
            this.bgImage = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.bgImage = img;
                this.render(window.nameplateState);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * 由 DataURL 設定背景圖片（用於還原）
     */
    setBackgroundImageDataUrl(dataUrl) {
        if (!dataUrl) {
            this.bgImage = null;
            this.render(window.nameplateState);
            return;
        }

        const img = new Image();
        img.onload = () => {
            this.bgImage = img;
            this.render(window.nameplateState);
        };
        img.src = dataUrl;
    }

    /**
     * 清除背景圖片
     */
    clearBackgroundImage() {
        this.bgImage = null;
    }

    /**
     * 由 DataURL 設定 QRCode 圖片
     */
    setQrCodeDataUrl(dataUrl) {
        if (!dataUrl) {
            this.qrImage = null;
            this.render(window.nameplateState);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.qrImage = img;
                this.render(window.nameplateState);
                resolve();
            };
            img.onerror = () => {
                reject(new Error('QRCode 圖片載入失敗'));
            };
            img.src = dataUrl;
        });
    }

    /**
     * 清除 QRCode
     */
    clearQrCode() {
        this.qrImage = null;
    }

    /**
     * 設定背景圖片透明度
     */
    setBackgroundOpacity(opacity) {
        this.bgImageOpacity = opacity / 100;
    }

    /**
     * 主渲染函數
     */
    render(state) {
        const { width, height } = this.canvas;
        
        // 清空畫布
        this.ctx.clearRect(0, 0, width, height);

        // 繪製背景
        this.drawBackground(state.bgColor);

        // 繪製背景圖片
        if (this.bgImage) {
            this.drawBackgroundImage();
        }

        // 依物件順序繪製（後面的物件會覆蓋前面的物件）
        this.drawObjectsByOrder(state);

        // 繪製邊框
        this.drawBorder();
    }

    /**
     * 取得 QRCode 繪製資訊
     */
    getQrCodeRect(state) {
        const size = state.qrSize || 100;
        const centerX = this.canvas.width / 2 + (state.qrcodeOffsetX || 0);
        const centerY = this.canvas.height / 2 + (state.qrcodeOffsetY || 0);

        return {
            centerX,
            centerY,
            size,
            left: centerX - size / 2,
            top: centerY - size / 2,
            right: centerX + size / 2,
            bottom: centerY + size / 2
        };
    }

    isDefaultObjectVisible(state, objectId) {
        if (!state || !state.objectVisibility) {
            return true;
        }

        return state.objectVisibility[objectId] !== false;
    }

    getCustomObjects(state) {
        if (!state || !Array.isArray(state.customObjects)) {
            return [];
        }

        return state.customObjects.filter(item => item && item.id && item.visible !== false);
    }

    getOrderedRenderableObjects(state) {
        const customObjects = Array.isArray(state?.customObjects) ? state.customObjects : [];
        const customMap = new Map(customObjects.filter(item => item && item.id).map(item => [item.id, item]));
        const knownIds = ['default-name', 'default-company', 'default-position', 'default-qrcode', ...customMap.keys()];
        const baseOrder = Array.isArray(state?.objectOrder) ? state.objectOrder : [];
        const order = [];

        baseOrder.forEach(id => {
            if (knownIds.includes(id) && !order.includes(id)) {
                order.push(id);
            }
        });

        knownIds.forEach(id => {
            if (!order.includes(id)) {
                order.push(id);
            }
        });

        return order.map(id => {
            if (id === 'default-name') {
                return {
                    id,
                    kind: 'default-text',
                    token: 'name',
                    text: state.name,
                    fontSize: state.nameFontSize || state.fontSize || 120,
                    color: state.nameTextColor || state.textColor || '#000000',
                    textShadow: state.nameTextShadow == null ? Boolean(state.textShadow) : Boolean(state.nameTextShadow),
                    offsetX: state.nameOffsetX || 0,
                    offsetY: state.nameOffsetY || 0,
                    visible: this.isDefaultObjectVisible(state, id)
                };
            }

            if (id === 'default-company') {
                const nameFontSize = state.nameFontSize || state.fontSize || 120;
                return {
                    id,
                    kind: 'default-text',
                    token: 'company',
                    text: state.company,
                    fontSize: state.companyFontSize || Math.max(24, Math.round(nameFontSize * 0.42)),
                    color: state.companyTextColor || state.textColor || '#000000',
                    textShadow: state.companyTextShadow == null ? Boolean(state.textShadow) : Boolean(state.companyTextShadow),
                    offsetX: state.companyOffsetX || 0,
                    offsetY: state.companyOffsetY || 0,
                    visible: this.isDefaultObjectVisible(state, id)
                };
            }

            if (id === 'default-position') {
                const nameFontSize = state.nameFontSize || state.fontSize || 120;
                return {
                    id,
                    kind: 'default-text',
                    token: 'position',
                    text: state.position,
                    fontSize: state.positionFontSize || Math.max(24, Math.round(nameFontSize * 0.42)),
                    color: state.positionTextColor || state.textColor || '#000000',
                    textShadow: state.positionTextShadow == null ? Boolean(state.textShadow) : Boolean(state.positionTextShadow),
                    offsetX: state.positionOffsetX || 0,
                    offsetY: state.positionOffsetY || 0,
                    visible: this.isDefaultObjectVisible(state, id)
                };
            }

            if (id === 'default-qrcode') {
                return {
                    id,
                    kind: 'default-qr',
                    token: 'qrcode',
                    size: state.qrSize || 100,
                    offsetX: state.qrcodeOffsetX || 0,
                    offsetY: state.qrcodeOffsetY || 0,
                    visible: state.qrVisible !== false && this.isDefaultObjectVisible(state, id)
                };
            }

            const custom = customMap.get(id);
            if (!custom) {
                return null;
            }

            return {
                ...custom,
                id,
                kind: 'custom',
                token: `object:${id}`,
                visible: custom.visible !== false
            };
        }).filter(Boolean);
    }

    getDefaultTextBaseY(token, state) {
        const centerY = this.canvas.height / 2;
        const nameFontSize = state.nameFontSize || state.fontSize || 120;
        const verticalGap = Math.max(Math.round(this.canvas.height * 0.23), Math.round(nameFontSize * 0.95));

        if (token === 'company') return centerY - verticalGap;
        if (token === 'position') return centerY + verticalGap;
        return centerY;
    }

    getObjectMetrics(item, state) {
        const centerX = this.canvas.width / 2;

        if (item.kind === 'default-text') {
            const x = centerX + parseInt(item.offsetX || 0, 10);
            const y = this.getDefaultTextBaseY(item.token, state) + parseInt(item.offsetY || 0, 10);
            const fontWeight = item.token === 'name' ? 'bold ' : '';
            this.ctx.font = `${fontWeight}${item.fontSize}px ${item.fontFamily || state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
            const text = String(item.text || '');
            const width = this.ctx.measureText(text).width;
            const height = item.fontSize;
            return { x, y, width, height, text };
        }

        if (item.kind === 'default-qr') {
            const x = centerX + parseInt(item.offsetX || 0, 10);
            const y = this.canvas.height / 2 + parseInt(item.offsetY || 0, 10);
            const size = parseInt(item.size || 100, 10);
            return { x, y, width: size, height: size, size };
        }

        const x = centerX + parseInt(item.offsetX || 0, 10);
        const y = this.canvas.height / 2 + parseInt(item.offsetY || 0, 10);

        if (item.type === 'text') {
            const fontSize = parseInt(item.fontSize || 42, 10);
            this.ctx.font = `${fontSize}px ${item.fontFamily || state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
            const text = String(item.text || '新文字');
            return { x, y, width: this.ctx.measureText(text).width, height: fontSize, text, fontSize };
        }

        if (item.type === 'qr') {
            const size = parseInt(item.size || 100, 10);
            return { x, y, width: size, height: size, size };
        }

        const width = parseInt(item.width || 120, 10);
        const height = parseInt(item.height || 120, 10);
        return { x, y, width, height };
    }

    drawObjectsByOrder(state) {
        const objects = this.getOrderedRenderableObjects(state);
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        objects.forEach(item => {
            if (!item.visible) {
                return;
            }

            const metrics = this.getObjectMetrics(item, state);

            if (item.kind === 'default-text') {
                const fontWeight = item.token === 'name' ? 'bold ' : '';
                this.ctx.font = `${fontWeight}${item.fontSize}px ${item.fontFamily || state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
                this.drawTextWithShadow(String(metrics.text || ''), metrics.x, metrics.y, Boolean(item.textShadow), item.color || state.textColor || '#000000');
                return;
            }

            if (item.kind === 'default-qr') {
                if (!this.qrImage) {
                    return;
                }

                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(metrics.x - metrics.size / 2 - 4, metrics.y - metrics.size / 2 - 4, metrics.size + 8, metrics.size + 8);
                this.ctx.drawImage(this.qrImage, metrics.x - metrics.size / 2, metrics.y - metrics.size / 2, metrics.size, metrics.size);
                return;
            }

            if (item.type === 'text') {
                const fontSize = parseInt(item.fontSize || 42, 10);
                this.ctx.font = `${fontSize}px ${item.fontFamily || state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
                this.drawTextWithShadow(String(metrics.text || '新文字'), metrics.x, metrics.y, Boolean(item.textShadow), item.color || state.textColor || '#000000');
                return;
            }

            const image = this.getCachedObjectImage(item.id, item.dataUrl);
            if (!image) {
                return;
            }

            if (item.type === 'qr') {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(metrics.x - metrics.size / 2 - 4, metrics.y - metrics.size / 2 - 4, metrics.size + 8, metrics.size + 8);
                this.ctx.drawImage(image, metrics.x - metrics.size / 2, metrics.y - metrics.size / 2, metrics.size, metrics.size);
                return;
            }

            this.ctx.drawImage(image, metrics.x - metrics.width / 2, metrics.y - metrics.height / 2, metrics.width, metrics.height);
        });
    }

    /**
     * 取得文字位置信息
     * 座標中心點在 Canvas 正中間 (500, 150)
     */
    getTextPositions(state) {
        const { name, company, position } = state;
        const { width, height } = this.canvas;
        const nameFontSize = state.nameFontSize || state.fontSize || 120;
        const companyFontSize = state.companyFontSize || Math.max(24, Math.round(nameFontSize * 0.42));
        const positionFontSize = state.positionFontSize || Math.max(24, Math.round(nameFontSize * 0.42));
        
        // 基礎偏移 - 用於排列多行文字
        const nameOffsetX = state.nameOffsetX || 0;
        const nameOffsetY = state.nameOffsetY || 0;
        const companyOffsetX = state.companyOffsetX || 0;
        const companyOffsetY = state.companyOffsetY || 0;
        const positionOffsetX = state.positionOffsetX || 0;
        const positionOffsetY = state.positionOffsetY || 0;

        const centerX = width / 2;
        const centerY = height / 2;
        const verticalGap = Math.max(Math.round(height * 0.23), Math.round(nameFontSize * 0.95));
        const companyBaseY = centerY - verticalGap;
        const nameBaseY = centerY;
        const positionBaseY = centerY + verticalGap;
        const positions = [];

        if (company && company.length > 0 && this.isDefaultObjectVisible(state, 'default-company')) {
            positions.push({
                type: 'company',
                text: company,
                x: centerX + companyOffsetX,
                y: companyBaseY + companyOffsetY,
                baseX: centerX,
                baseY: companyBaseY,
                fontSize: companyFontSize,
                width: 100,
                height: companyFontSize
            });
        }

        if (this.isDefaultObjectVisible(state, 'default-name')) {
            positions.push({
                type: 'name',
                text: name,
                x: centerX + nameOffsetX,
                y: nameBaseY + nameOffsetY,
                baseX: centerX,
                baseY: nameBaseY,
                fontSize: nameFontSize,
                width: 150,
                height: nameFontSize
            });
        }

        if (position && position.length > 0 && this.isDefaultObjectVisible(state, 'default-position')) {
            positions.push({
                type: 'position',
                text: position,
                x: centerX + positionOffsetX,
                y: positionBaseY + positionOffsetY,
                baseX: centerX,
                baseY: positionBaseY,
                fontSize: positionFontSize,
                width: 100,
                height: positionFontSize
            });
        }

        return positions;
    }

    /**
     * 繪製背景顏色
     */
    drawBackground(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * 繪製背景圖片
     */
    drawBackgroundImage() {
        if (!this.bgImage) return;

        const canvas = this.canvas;
        const img = this.bgImage;

        // 計算背景圖片尺寸
        const canvasRatio = canvas.width / canvas.height;
        const imgRatio = img.width / img.height;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgRatio > canvasRatio) {
            // 圖片更寬
            drawHeight = canvas.height;
            drawWidth = drawHeight * imgRatio;
            drawX = -(drawWidth - canvas.width) / 2;
            drawY = 0;
        } else {
            // 圖片更高
            drawWidth = canvas.width;
            drawHeight = drawWidth / imgRatio;
            drawX = 0;
            drawY = -(drawHeight - canvas.height) / 2;
        }

        this.ctx.globalAlpha = this.bgImageOpacity;
        this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        this.ctx.globalAlpha = 1;
    }

    /**
     * 檢查點是否在文字元素內
     */
    getTextAtPoint(x, y) {
        const objects = this.getOrderedRenderableObjects(window.nameplateState);

        for (let index = objects.length - 1; index >= 0; index -= 1) {
            const item = objects[index];
            if (!item.visible) {
                continue;
            }

            if (item.kind === 'default-qr' && !this.qrImage) {
                continue;
            }

            const metrics = this.getObjectMetrics(item, window.nameplateState);
            const left = metrics.x - metrics.width / 2;
            const right = metrics.x + metrics.width / 2;
            const top = metrics.y - metrics.height / 2;
            const bottom = metrics.y + metrics.height / 2;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                return item.token;
            }
        }

        return null;
    }

    /**
     * 繪製文字內容
     */
    drawText(state) {
        const { textColor, textShadow } = state;
        const positions = this.getTextPositions(state);

        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        positions.forEach(pos => {
            this.ctx.font = `bold ${pos.fontSize}px ${state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
            if (pos.type === 'company' || pos.type === 'position') {
                this.ctx.font = `${pos.fontSize}px ${state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
            }
            this.drawTextWithShadow(pos.text, pos.x, pos.y, textShadow, textColor);
        });
    }

    /**
     * 繪製帶陰影的文字
     */
    drawTextWithShadow(text, x, y, hasShadow, color) {
        if (hasShadow) {
            // 繪製陰影
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillText(text, x + 2, y + 2);

            // 繪製文字邊框
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(text, x, y);
        }

        // 繪製主要文字
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
    }

    /**
     * 繪製 QRCode
     */
    drawQrCode(state) {
        if (!this.qrImage || state.qrVisible === false || !this.isDefaultObjectVisible(state, 'default-qrcode')) return;

        const qr = this.getQrCodeRect(state);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(qr.left - 4, qr.top - 4, qr.size + 8, qr.size + 8);
        this.ctx.drawImage(this.qrImage, qr.left, qr.top, qr.size, qr.size);
    }

    getCachedObjectImage(objectId, dataUrl) {
        if (!objectId || !dataUrl) {
            return null;
        }

        const cached = this.objectImageCache.get(objectId);
        if (cached && cached.src === dataUrl && cached.img.complete) {
            return cached.img;
        }

        const img = new Image();
        img.onload = () => this.render(window.nameplateState);
        img.src = dataUrl;
        this.objectImageCache.set(objectId, { src: dataUrl, img });
        return img.complete ? img : null;
    }

    drawCustomObjects(state) {
        const customObjects = this.getCustomObjects(state);
        if (!customObjects.length) {
            return;
        }

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        customObjects.forEach(objectMeta => {
            const x = centerX + parseInt(objectMeta.offsetX || 0, 10);
            const y = centerY + parseInt(objectMeta.offsetY || 0, 10);

            if (objectMeta.type === 'text') {
                const fontSize = parseInt(objectMeta.fontSize || 42, 10);
                this.ctx.font = `${fontSize}px ${objectMeta.fontFamily || state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.drawTextWithShadow(
                    String(objectMeta.text || '新文字'),
                    x,
                    y,
                    Boolean(objectMeta.textShadow),
                    objectMeta.color || state.textColor || '#000000'
                );
                return;
            }

            if (objectMeta.type === 'qr') {
                const size = parseInt(objectMeta.size || 100, 10);
                const qrImage = this.getCachedObjectImage(objectMeta.id, objectMeta.dataUrl);
                if (!qrImage) {
                    return;
                }

                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8);
                this.ctx.drawImage(qrImage, x - size / 2, y - size / 2, size, size);
                return;
            }

            if (objectMeta.type === 'image') {
                const width = parseInt(objectMeta.width || 120, 10);
                const height = parseInt(objectMeta.height || 120, 10);
                const image = this.getCachedObjectImage(objectMeta.id, objectMeta.dataUrl);
                if (!image) {
                    return;
                }

                this.ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
            }
        });
    }

    getCustomObjectAtPoint(state, x, y) {
        const customObjects = this.getCustomObjects(state);
        if (!customObjects.length) {
            return null;
        }

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        for (let index = customObjects.length - 1; index >= 0; index -= 1) {
            const objectMeta = customObjects[index];
            const objX = centerX + parseInt(objectMeta.offsetX || 0, 10);
            const objY = centerY + parseInt(objectMeta.offsetY || 0, 10);

            if (objectMeta.type === 'text') {
                const fontSize = parseInt(objectMeta.fontSize || 42, 10);
                this.ctx.font = `${fontSize}px ${objectMeta.fontFamily || state.fontFamily || '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif'}`;
                const text = String(objectMeta.text || '新文字');
                const textWidth = this.ctx.measureText(text).width;
                const left = objX - textWidth / 2;
                const right = objX + textWidth / 2;
                const top = objY - fontSize / 2;
                const bottom = objY + fontSize / 2;

                if (x >= left && x <= right && y >= top && y <= bottom) {
                    return objectMeta.id;
                }
                continue;
            }

            const width = parseInt(objectMeta.type === 'qr' ? (objectMeta.size || 100) : (objectMeta.width || 120), 10);
            const height = parseInt(objectMeta.type === 'qr' ? (objectMeta.size || 100) : (objectMeta.height || 120), 10);
            const left = objX - width / 2;
            const right = objX + width / 2;
            const top = objY - height / 2;
            const bottom = objY + height / 2;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                return objectMeta.id;
            }
        }

        return null;
    }

    /**
     * 繪製邊框
     */
    drawBorder() {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
    }

    /**
     * 導出為PNG
     */
    exportPNG(filename = 'nameplate.png') {
        const link = document.createElement('a');
        link.href = this.canvas.toDataURL('image/png', 1.0);
        link.download = filename;
        link.click();
    }

    /**
     * 導出為Base64（用於API上傳）
     */
    exportBase64() {
        return this.canvas.toDataURL('image/png', 1.0);
    }
}

/**
 * 全局應用狀態
 */
window.nameplateState = {
    name: '名字',
    company: '公司名稱',
    position: '職位名稱',
    bgColor: '#1e3a5f',
    fontFamily: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', \'Microsoft YaHei\', sans-serif',
    nameFontSize: 120,
    companyFontSize: 50,
    positionFontSize: 50,
    textColor: '#ffffff',
    textShadow: false,
    nameTextShadow: false,
    companyTextShadow: false,
    positionTextShadow: false,
    // 分別的位置偏移 (預設值)
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
    objectOrder: ['default-name', 'default-company', 'default-position', 'default-qrcode'],
    customObjects: []
};

/**
 * 快速預設樣式
 */
const presets = {
    corporate: {
        bgColor: '#1e3a5f',
        textColor: '#ffffff',
        nameFontSize: 120,
        companyFontSize: 50,
        positionFontSize: 50,
        textShadow: true
    },
    blue: {
        bgColor: '#e0f2fe',
        textColor: '#0c4a6e',
        nameFontSize: 120,
        companyFontSize: 50,
        positionFontSize: 50,
        textShadow: false
    },
    modern: {
        bgColor: '#ffffff',
        textColor: '#1e293b',
        nameFontSize: 120,
        companyFontSize: 50,
        positionFontSize: 50,
        textShadow: false
    },
    tech: {
        bgColor: '#0f172a',
        textColor: '#e0e7ff',
        nameFontSize: 120,
        companyFontSize: 50,
        positionFontSize: 50,
        textShadow: true
    }
};

/**
 * 初始化渲染器
 */
function initRenderer() {
    window.renderer = new NameplateRenderer('nameplate');
    window.renderer.render(window.nameplateState);
}

/**
 * 觸發重新渲染
 */
function triggerRender() {
    if (window.renderer) {
        window.renderer.render(window.nameplateState);
    }
}
