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
3. 自訂背景和文字樣式
4. 點擊「下載為 PNG」按鈕（或按 ctrl + S 快捷鍵直接下載）

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
- **文字大小**：24-72px，使用滑塊調整
- **文字顏色**：選擇名字的顯示顏色
- **文字陰影**：在淺色背景下啟用，增強可讀性

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
在代碼中取消註釋以下這行以啟用API上傳：
```javascript
// 在 index.html 中：
document.getElementById('apiSection').style.display = 'block';
```

## 本地儲存

應用自動將編輯設置保存到瀏覽器的 LocalStorage：
- 所有編輯內容在下次訪問時自動恢復
- 點擊「重置」按鈕可清除保存的設置
- 瀏覽器無痕模式不會保存設置

## 瀏覽器相容性

✅ Chrome/Edge 90+
✅ Firefox 88+
✅ Safari 14+
✅ 行動瀏覽器（iOS Safari、Android Chrome）

## 性能優化

- 使用 Canvas 進行實時渲染，性能高效
- 圖片懶加載和快取
- LocalStorage 離線支持

## 版本歷史

### v1.0.0 (2026.04.16)
- ✨ 初始版本發佈
- ✅ 完整的編輯功能
- ✅ 即時預覽
- ✅ PNG 下載
- ✅ 本地儲存
- ✅ 快速預設

## LICENSE

MIT License - 自由使用和修改

## 製作者

Made by **貓又**

## 支持和反饋

如果有問題，可以直接發 issue 或是聯繫我，感謝！

**提示**：定期保存你的設計！使用瀏覽器的 LocalStorage 會自動保存，但建議定期導出 PNG 備份重要的設計。
