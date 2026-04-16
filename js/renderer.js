/**
 * 名牌渲染器 - 處理Canvas繪製邏輯
 */
class NameplateRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.bgImage = null;
        this.bgImageOpacity = 1;
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
     * 清除背景圖片
     */
    clearBackgroundImage() {
        this.bgImage = null;
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

        // 繪製文字
        this.drawText(state);

        // 繪製邊框
        this.drawBorder();
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
     * 繪製文字內容
     */
    drawText(state) {
        const { name, company, position, fontSize, textColor, textShadow } = state;
        const { width, height } = this.canvas;

        this.ctx.fillStyle = textColor;
        this.ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // 計算垂直偏移
        const totalLines = (company ? 1 : 0) + (position ? 1 : 0) + 1;
        const lineHeight = fontSize * 1.4;
        const totalHeight = lineHeight * totalLines;
        const startY = (height - totalHeight) / 2 + fontSize / 2;

        let currentY = startY;

        // 繪製 "公司/部門"
        if (company) {
            const smallFontSize = fontSize * 0.5;
            this.ctx.font = `${smallFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
            this.drawTextWithShadow(company, width / 2, currentY, textShadow, textColor);
            currentY += lineHeight;
        }

        // 繪製 "姓名"
        this.ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
        this.drawTextWithShadow(name, width / 2, currentY, textShadow, textColor);
        currentY += lineHeight;

        // 繪製 "職位" 
        if (position) {
            const smallFontSize = fontSize * 0.5;
            this.ctx.font = `${smallFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
            this.drawTextWithShadow(position, width / 2, currentY, textShadow, textColor);
        }
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
    fontSize: 48,
    textColor: '#ffffff',
    textShadow: false
};

/**
 * 快速預設樣式
 */
const presets = {
    corporate: {
        bgColor: '#1e3a5f',
        textColor: '#ffffff',
        fontSize: 48,
        textShadow: true
    },
    blue: {
        bgColor: '#e0f2fe',
        textColor: '#0c4a6e',
        fontSize: 48,
        textShadow: false
    },
    modern: {
        bgColor: '#ffffff',
        textColor: '#1e293b',
        fontSize: 48,
        textShadow: false
    },
    tech: {
        bgColor: '#0f172a',
        textColor: '#e0e7ff',
        fontSize: 48,
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
