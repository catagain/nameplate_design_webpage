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
     * 取得文字位置信息
     */
    getTextPositions(state) {
        const { name, company, position, fontSize } = state;
        const { width, height } = this.canvas;
        
        const nameOffsetX = state.nameOffsetX || 0;
        const nameOffsetY = state.nameOffsetY || 0;
        const companyOffsetX = state.companyOffsetX || 0;
        const companyOffsetY = state.companyOffsetY || 0;
        const positionOffsetX = state.positionOffsetX || 0;
        const positionOffsetY = state.positionOffsetY || 0;

        const totalLines = (company ? 1 : 0) + (position ? 1 : 0) + 1;
        const lineHeight = fontSize * 1.4;
        const totalHeight = lineHeight * totalLines;
        const baseStartY = (height - totalHeight) / 2 + fontSize / 2;

        const positions = [];
        let currentY = baseStartY;

        if (company) {
            positions.push({
                type: 'company',
                text: company,
                x: width / 2 + companyOffsetX,
                y: currentY + companyOffsetY,
                baseX: width / 2,
                baseY: currentY,
                fontSize: fontSize * 0.5,
                width: 100,
                height: fontSize * 0.5
            });
            currentY += lineHeight;
        }

        positions.push({
            type: 'name',
            text: name,
            x: width / 2 + nameOffsetX,
            y: currentY + nameOffsetY,
            baseX: width / 2,
            baseY: currentY,
            fontSize: fontSize,
            width: 150,
            height: fontSize
        });
        currentY += lineHeight;

        if (position) {
            positions.push({
                type: 'position',
                text: position,
                x: width / 2 + positionOffsetX,
                y: currentY + positionOffsetY,
                baseX: width / 2,
                baseY: currentY,
                fontSize: fontSize * 0.5,
                width: 100,
                height: fontSize * 0.5
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
        const positions = this.getTextPositions(window.nameplateState);
        
        for (let pos of positions) {
            // 設定正確的字體以計算文字寬度
            this.ctx.font = `bold ${pos.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
            if (pos.type === 'company' || pos.type === 'position') {
                this.ctx.font = `${pos.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
            }
            
            const textWidth = this.ctx.measureText(pos.text).width;
            const left = pos.x - textWidth / 2;
            const right = pos.x + textWidth / 2;
            const top = pos.y - pos.height / 2;
            const bottom = pos.y + pos.height / 2;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                return pos.type;
            }
        }
        
        return null;
    }

    /**
     * 繪製文字內容
     */
    drawText(state) {
        const { name, company, position, fontSize, textColor, textShadow } = state;
        const positions = this.getTextPositions(state);

        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        positions.forEach(pos => {
            this.ctx.font = `bold ${pos.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
            if (pos.type === 'company' || pos.type === 'position') {
                this.ctx.font = `${pos.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`;
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
    textShadow: false,
    // 分別的位置偏移
    nameOffsetX: 0,
    nameOffsetY: 0,
    companyOffsetX: 0,
    companyOffsetY: 0,
    positionOffsetX: 0,
    positionOffsetY: 0
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
