# 📇 會議名牌編輯器

一個網頁，用於建立、編輯和下載專業的會議桌上名牌（會議牌）。

## 功能特性

### 核心功能
- ✏️ **輸入名字** - 支持姓名、公司/部門、職位資訊
- 🎨 **背景編輯** - 自訂義背景顏色或上傳背景圖片
- 🖼️ **圖片處理** - 支持圖片透明度調整
- 📝 **文字樣式** - 自訂義字號、字體顏色、陰影效果
- ⬇️ **PNG下載** - 一鍵下載名牌圖片
- 💾 **本地儲存** - 自動保存編輯設置到瀏覽器
- 🎯 **快速預設** - 內建預設風格

### 高級功能
- 📐 **精確尺寸** - 1000×300px（20cm×6cm @150dpi）適合印刷
- 🔍 **實時預覽** - 編輯時同步更新預覽效果
- ⌨️ **快捷鍵** - Ctrl+S (Mac: Cmd+S) 快速下載
- 📱 **響應式設計** - 完美支持各種螢幕尺寸

### API集成（預留）
- 🔌 **API上傳接口** - 準備與現有會議系統集成

## 項目結構

```
namePlate_web/
├── index.html          # 主頁面
├── css/
│   └── style.css       # 樣式表
├── js/
│   ├── renderer.js     # Canvas渲染引擎
│   └── app.js          # 主應用邏輯
└── README.md           # 本文檔
```

## 快速開始

### 方式一：直接打開
1. 在瀏覽器中打開 `index.html` 檔案
2. 輸入參會者資訊
3. 自訂義背景和文字樣式
4. 點擊「下載為 PNG」按鈕

### 方式二：使用本地伺服器
```bash
# 使用 Python (Python 3.x)
python -m http.server 8000

# 或使用 Node.js http-server
npx http-server

# 或使用 PHP
php -S localhost:8000
```

然後訪問 `http://localhost:8000`

## 使用說明

### 基本資訊
- **姓名**：必填，最多20個字符
- **公司/部門**：可選
- **職位**：可選

### 背景設置
1. **背景顏色**：點擊顏色選擇器選擇背景色
2. **背景圖片**
   - 支持 JPG、PNG、GIF、WebP 等格式
   - 最大檔案大小：5MB
   - 圖片會自動縮放以覆蓋整個名牌
3. **圖片透明度**：調整圖片背後的可見程度

### 文字樣式
- **名字字號**：24-72px，使用滑塊調整
- **文字顏色**：選擇名字的顯示顏色
- **文字陰影**：在淺色背景下啟用，增強可讀性

### 快速預設
點擊快速預設按鈕快速應用預定義的設計風格：
- 🏢 **企業風格**：深藍背景、白色文字
- 💙 **藍色優雅**：淺藍背景、深灰文字
- ⚪ **現代簡約**：白色背景、黑色文字
- ⚡ **科技感**：深色背景、淺紫文字

### 下載
1. 編輯完成後，點擊「下載為 PNG」
2. 檔案名稱格式：`nameplate_[名字]_[日期].png`
3. 預設分辨率：1000×300px（適合標準會議牌列印）

## API集成指南

### 後端接口要求

```
POST /api/nameplate/upload
Content-Type: application/json

請求體格式：
{
  "name": "毛毛卿",
  "company": "黎明探索公司",
  "position": "經理",
  "image": "data:image/png;base64,...",  // Base64編碼的PNG
  "timestamp": "2024-04-10T12:00:00.000Z"
}

響應格式：
{
  "success": true,
  "id": "nameplate_123",
  "message": "上傳成功"
}
```

### 啟用API功能
在代碼中取消註釋以下行以啟用API上傳：
```javascript
// 在 index.html 中：
document.getElementById('apiSection').style.display = 'block';
```

### 示例後端實現（Node.js Express）
```javascript
const express = require('express');
const app = express();

app.use(express.json({ limit: '50mb' }));

app.post('/api/nameplate/upload', (req, res) => {
  const { name, company, position, image, timestamp } = req.body;
  
  // 處理Base64圖片
  const buffer = Buffer.from(image.split(',')[1], 'base64');
  
  // 保存或處理圖片...
  
  res.json({
    success: true,
    id: `nameplate_${Date.now()}`,
    message: '上傳成功'
  });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

## 本地儲存

應用自動將編輯設置保存到瀏覽器的 LocalStorage：
- 所有編輯內容在下次訪問時自動恢復
- 點擊「重置」按鈕可清除保存的設置
- 瀏覽器隱身模式不會保存設置

## 瀏覽器相容性

✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 14+
✅ 行動瀏覽器（iOS Safari、Android Chrome）

## 技術堆棧

- **HTML5** - 頁面結構
- **CSS3** - 響應式設計
- **Vanilla JavaScript** - 無依賴的純JS實現
- **Canvas API** - 圖像渲染和處理
- **Fetch API** - API通訊

## 性能優化

- 使用 Canvas 進行實時渲染，性能高效
- 圖片懶加載和快取
- LocalStorage 離線支持

## 版本歷史

### v1.0.0 (2024.04.10)
- ✨ 初始版本發佈
- ✅ 完整的編輯功能
- ✅ 即時預覽
- ✅ PNG 下載
- ✅ 本地儲存
- ✅ 快速預設

## 許可證

MIT License - 自由使用和修改

## 支持和反饋

如有問題或建議，請聯繫我或提交 Issue。

---

**提示**：定期保存你的設計！使用瀏覽器的 LocalStorage 會自動保存，但建議定期導出 PNG 備份重要的設計。
