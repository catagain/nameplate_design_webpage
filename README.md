# 會議桌上名牌管理系統

本專案是一套前端可視化名牌編輯器，搭配 Node.js 中介服務，支援單張編輯、Philips 桌牌控制與批量生產流程。

## 目前進度

### 已完成

- 主頁編輯器
  - 物件化編輯（預設文字/QRCode + 自訂文字/QRCode/圖片）
  - 拖曳調整位置、圖層排序、顯示/隱藏
  - 比例與尺寸控制、背景/字色/陰影設定
  - 單張 PNG 匯出

- Philips 整合
  - 後端 proxy：`/api/philips/proxy`
  - 區網 discovery（同網段掃描）
  - callback 路由：`/heartbeat`、`/image-post`、`/ota-post`

- 批量生產（新版）
  - 獨立分頁：`batch.html`
  - 載入主頁目前已保存的版型與內容作為預覽
  - 支援上傳 `CSV / XLSX / XLS`
  - 支援直接在網頁表格編輯（不需上傳檔案）
  - 支援下載：
    - 目前欄位範本 CSV
    - 目前表格 CSV
    - 批量輸出 ZIP
  - 新增欄位 `deviceTarget`（桌牌名稱或 IP）
    - 欄位固定在最右側
    - ZIP 依 `deviceTarget` 自動分資料夾

- UI / UX 調整
  - 主頁舊內嵌批量區塊已隱藏
  - 主頁按鈕導向獨立批量頁
  - 批量頁主標題：`批量生產會議桌牌圖片`
  - 批量頁底部主按鈕文案：`批量輸出`
  - 標頭加入左上角 Logo（依 theme 切換）
    - Light: `images/logo_Black.png.webp`
    - Dark: `images/LOGO.png.webp`
  - 主頁標題更新為：
    - `會議桌上名牌管理系統`
    - `建立、下載及上傳會議桌上名牌圖片`

## 快速啟動

### 需求

- Node.js 18+
- npm

### 本機啟動

```bash
npm install
npm start
```

啟動後開啟：

- `http://localhost:3001`

### 一鍵腳本

Windows:

```bat
start-nameplate.bat
```

macOS / Linux:

```bash
chmod +x start-nameplate.sh
./start-nameplate.sh
```

## 專案結構

```text
namePlate_web/
├── index.html                  # 主頁編輯器
├── batch.html                  # 批量生產分頁（新版）
├── css/
│   └── style.css               # 共用樣式
├── js/
│   ├── app.js                  # 主頁邏輯（編輯、Philips、儲存）
│   ├── batch-page.js           # 批量頁邏輯（表格、匯入、批量輸出）
│   ├── renderer.js             # Canvas 繪製與匯出
│   └── vendor/                 # 第三方函式庫（JSZip / QRCode / XLSX）
├── images/                     # 品牌 Logo 圖片
├── api-example.js              # Node.js / Express 中介服務
├── deploy/
│   └── nginx.nameplate.conf    # 反向代理範例
├── uploads/                    # 上傳與 callback/access 記錄
├── batch-test.csv              # 批量測試資料
├── start-nameplate.bat
├── start-nameplate.sh
└── README.md
```

## TODO

### P0

- API 驗證機制（token/key）
- rate limit 與 upload 容量限制
- Philips proxy/discovery 的錯誤碼與重試策略完整化

### P1

- 批量資料與桌牌映射規則（deviceTarget/deviceId）一致化
- 前後端自動化測試
- lint / format / CI

### P2

- 模板管理與品牌樣式配置
- 批量排程發布
- 進階後台設定頁

## 授權

MIT License
