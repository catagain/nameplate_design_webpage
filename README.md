# 會議名牌編輯器

這個專案是一個純前端的會議名牌編輯工具，用來快速產出桌上名牌 PNG。現階段可在瀏覽器中直接編輯姓名、公司、職稱、背景、文字樣式與 QRCode，並即時預覽、下載圖片；後續預計再串接 Philips 電子紙會議名牌 API。

這份 README 的目的不是只放使用說明，而是把目前專案現況、待辦、串接前需要整理的資料，以及 GitHub 交接資訊集中在同一份文件，方便後續接手。

## 專案現況

### 目前已完成
- 純靜態前端，直接開啟 `index.html` 即可使用
- Canvas 即時渲染名牌預覽
- 支援姓名、公司/部門、職位三段文字
- 支援背景色、背景圖、背景圖透明度
- 支援姓名、公司、職位各自獨立字級調整
- 支援文字顏色、陰影
- 支援拖曳文字位置與 QRCode 位置
- 支援 QRCode 圖片上傳與網址即時產生
- 支援多種畫布比例，預設為 `10:3`，寬度固定 `1000px`
- 支援 LocalStorage 自動保存設定
- 支援深色模式
- 支援匯出 PNG
- 已保留 API 上傳區塊與前端上傳邏輯，但預設隱藏

### 目前不是正式後端整合
- 專案主體仍是前端頁面，沒有正式 production backend
- `api-example.js` 是 Node.js + Express 的示範 API，不是目前前端實際依賴的正式服務
- 畫面中的 API 區塊預設隱藏，代表串接功能仍在預留階段
- Philips 電子紙名牌 API 尚未補上，因此目前還不能直接同步到裝置

## 專案結構

```text
namePlate_web/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── renderer.js
│   └── vendor/
│       └── qrcode.min.js
├── api-example.js
└── README.md
```

### 主要檔案說明
- `index.html`: 畫面結構、控制項、預留 API 區塊
- `css/style.css`: 全部樣式與版面
- `js/app.js`: 表單事件、狀態管理、LocalStorage、下載、API 上傳、深色模式、比例調整
- `js/renderer.js`: Canvas 繪製、背景圖、文字、QRCode、匯出 Base64 / PNG
- `js/vendor/qrcode.min.js`: 本地 QRCode 函式庫，供離線產生 QRCode
- `api-example.js`: 範例後端，示範如何接收前端送出的 Base64 PNG 與名牌資料

## 快速使用

### 方式 1
直接用瀏覽器開啟 `index.html`。

### 方式 2
使用本地靜態伺服器。

```bash
python -m http.server 8000
```

或：

```bash
npx http-server
```

啟動後打開 `http://localhost:8000`。

## 功能整理

### 編輯內容
- 姓名，最長 20 字
- 公司或部門
- 職位

### 畫布與版型
- 預設比例 `10:3`
- 內建比例按鈕：`10:3`、`2:1`、`16:9`、`16:10`、`4:3`、`3:2`、`1:1`
- 支援自訂比例
- 畫布寬度固定 `1000px`，高度依比例計算

### 視覺樣式
- 背景顏色
- 背景圖片
- 背景圖片透明度
- 姓名、公司、職位各自字體大小
- 文字顏色
- 文字陰影
- 快速預設樣式
- 深色模式切換

### 位置控制
- 文字 X/Y 軸位移
- QRCode X/Y 軸位移
- 數值輸入與滑桿同步
- 一鍵置中
- 直接在 Canvas 上拖曳文字與 QRCode

### 匯出與保存
- 下載 PNG
- 檔名格式：`nameplate_<name>_<date>.png`
- 自動保存到 LocalStorage
- 下次開啟會自動還原設定與主題

## 目前資料流

### 前端內部狀態
前端主要透過 `window.nameplateState` 管理名牌內容，包含：

```json
{
  "name": "名子",
  "company": "公司名稱",
  "position": "職位名稱",
  "bgColor": "#ffffff",
  "nameFontSize": 48,
  "companyFontSize": 24,
  "positionFontSize": 24,
  "textColor": "#000000",
  "textShadow": false,
  "nameOffsetX": 0,
  "nameOffsetY": 0,
  "companyOffsetX": 0,
  "companyOffsetY": 0,
  "positionOffsetX": 0,
  "positionOffsetY": 0,
  "qrcodeOffsetX": 320,
  "qrcodeOffsetY": 0,
  "qrSize": 100
}
```

### LocalStorage
目前有兩個主要儲存鍵：
- `nameplateSettings`: 名牌設定、背景圖、QRCode、比例
- `theme`: 淺色或深色模式

### 前端預留的上傳 payload
目前 `handleUpload()` 送出的資料格式如下：

```json
{
  "name": "王小明",
  "company": "範例公司",
  "position": "Sales Director",
  "image": "data:image/png;base64,...",
  "timestamp": "2026-05-25T12:00:00.000Z"
}
```

### 前端預期的基本 API 行為
- HTTP Method: `POST`
- Content-Type: `application/json`
- 成功時回傳 JSON
- 前端目前只檢查 HTTP 狀態碼與是否能解析 JSON

## Philips 電子紙串接規劃

### 現在已經有的基礎
- 前端可輸出 PNG Base64
- 已有預留 API URL 欄位與上傳按鈕
- 已有示範後端可接收 `name + metadata + image`

### Philips API 補上後的建議串接方式
建議不要讓前端直接綁死 Philips API，而是保留一層自家中介服務。

原因：
- 可以隔離 Philips 認證方式
- 可以統一裝置 mapping 邏輯
- 可以做佇列、重試、記錄與錯誤追蹤
- 可以避免把 vendor-specific 規則散在前端

建議流程：
1. 前端輸出名牌 PNG 或 Base64
2. 前端呼叫自家 backend API
3. backend 依 Philips API 要求轉格式、簽名、上傳
4. backend 回傳裝置更新結果、task id 或 error code

## 串接 Philips 前必須整理的資料

這一段是後續最重要的交接清單。Philips API 補上後，至少要先拿到以下資訊，才能開始做正式整合。

### API 規格
- API Base URL
- 測試環境與正式環境 URL
- 認證方式，例：API Key、Bearer Token、OAuth2、簽章
- 每個 endpoint 的 request / response 範例
- 錯誤碼列表
- 速率限制
- 是否需要白名單 IP

### 裝置與畫面規格
- 電子紙型號
- 螢幕解析度
- 長寬比例
- 支援的圖片格式，例：PNG、BMP、單色圖、灰階圖
- 檔案大小限制
- 顏色限制，例：黑白紅、灰階、全彩
- 是否需要旋轉或特定方向輸出
- 更新一次所需時間

### 裝置識別與綁定規則
- 裝置 ID 欄位名稱
- 會議室 / 座位 / 人員 與裝置的 mapping 規則
- 一筆名牌更新是指定單一 device 還是一組 device
- 是否支援批次更新
- 是否有查詢目前裝置狀態的 API

### 同步與作業流程
- 更新是同步完成還是非同步任務
- 若是非同步，task id 如何查狀態
- 是否有 callback / webhook
- 更新失敗的重試策略
- 是否需要排程更新或指定生效時間

### 安全與維運
- 憑證保存方式
- 日誌需求
- 失敗告警方式
- 權限模型
- 測試帳號 / 測試設備資訊

## TODO

### 高優先
- 補齊 Philips 電子紙 API 規格文件
- 確認裝置解析度、比例、顏色限制與圖片格式要求
- 確認裝置 ID 與會議資料的對應方式
- 決定是否透過自家 backend 中介後再呼叫 Philips API
- 定義正式的 upload API contract 與錯誤處理格式

### 中優先
- 把目前隱藏的 API 區塊改為可由環境設定開關控制
- 將前端 `handleUpload()` 改成呼叫正式 backend 路徑
- 補上上傳成功 / 失敗 / 重試中的 UI 狀態
- 補上上傳歷程或操作記錄
- 整理會議資料來源，確認是否來自既有會議系統或 CSV / Excel

### 低優先
- 加入多版型模板
- 加入批次匯出
- 加入更多字型或品牌樣式 preset
- 補前端測試與基本 lint / format 流程

## 如果要正式串接，建議先定義的 backend contract

前端不要直接依賴 Philips 原始規格，先定義一個內部 API，例如：

```http
POST /api/nameplates/publish
Content-Type: application/json
```

```json
{
  "meetingId": "meeting-20260525-001",
  "deviceId": "room-a-seat-01",
  "name": "王小明",
  "company": "範例公司",
  "position": "Sales Director",
  "image": "data:image/png;base64,...",
  "requestedBy": "admin@example.com"
}
```

建議回傳：

```json
{
  "success": true,
  "jobId": "publish_123456",
  "vendor": "philips",
  "deviceId": "room-a-seat-01",
  "status": "queued"
}
```

## 範例 API

專案中的 `api-example.js` 提供以下示範端點：
- `GET /health`
- `POST /api/nameplate/upload`
- `GET /api/nameplate/list`
- `GET /api/nameplate/:id`
- `DELETE /api/nameplate/:id`

用途是先驗證前端上傳 Base64 PNG 的流程，不代表 Philips 正式 API 設計。

## 開發備註

### 啟用前端 API 測試區塊
目前 `index.html` 中的 API 區塊預設隱藏；若要人工測試上傳流程，需要先讓 `#apiSection` 顯示。

### 建議後續補的工程項目
- `.env` 或設定檔
- 正式 backend 專案
- request validation
- error handling 與 retry 機制
- deployment / release 流程
- Philips sandbox 測試紀錄

## GitHub

- Repository: `https://github.com/catagain/nameplate_design_webpage`
- Remote: `origin`

## 授權

MIT License

## 維護者

Made by 貓又
