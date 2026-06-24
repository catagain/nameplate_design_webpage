# 會議桌上名牌管理系統

本專案是一套前端可視化名牌編輯器，搭配 Node.js 中介服務，支援單張編輯、Philips 桌牌控制與批量生產流程。

目前桌牌對照資料（桌牌名稱與 IP）已改為伺服器端保存，不再以使用者瀏覽器本機資料為主。

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
  - 桌牌設定伺服器儲存：
    - `GET /api/philips/devices`
    - `POST /api/philips/devices`
    - `DELETE /api/philips/devices/:id`
  - 桌牌下拉顯示格式：`桌牌名稱(IP)`

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
    - 支援下拉建議（可手動輸入）
    - 可解析 `桌牌名稱(IP)` 並對應桌牌
  - 批量推送 Philips 時：
    - 使用 baseline-like JPEG 流程（800x480、壓縮上限控制）
    - 同步更新 A/B 兩面（沿用主頁雙面同步邏輯）
  - 支援自訂圖片物件：每列可透過圖片網址或上傳本地圖片來設定桌牌中的圖片物件內容
    - 表格欄位旁提供 📁 上傳按鈕，選取圖片後立即顯示縮圖預覽
    - 圖片資料儲存為 data URL，流暢串接預覽、縮圖廊、ZIP 輸出與 Philips 推送

- UI / UX 調整
  - 主頁舊內嵌批量區塊已隱藏
  - 主頁按鈕導向獨立批量頁
  - 批量頁主標題：`批量生產會議桌牌圖片`
  - 批量頁底部主按鈕文案：`批量輸出`
  - 批量頁「目前欄位需求」區塊已隱藏
  - 批量頁新增列控制改為表頭操作欄綠色粗體 `+`
  - 標頭加入左上角 Logo（依 theme 切換）
    - Light: `images/logo_Black.png.webp`
    - Dark: `images/LOGO.png.webp`
  - 主頁標題更新為：
    - `會議桌上名牌管理系統`
    - `建立、下載及上傳會議桌上名牌圖片`
  - 預設物件「名子」更改為「姓名」
  - 「抖動運算」預設啟用並加上「(建議)」標記
  - 桌牌控制 IP 欄位權限優化：選擇既有桌牌時唯讀，新增/儲存時可輸入
  - 更新「更新桌牌畫面」按鈕：未選擇桌牌時禁用並顯示禁止符號與提示
  - 更新批量生產按鈕文案為「儲存目前設定 開始批量生產」
  - 點擊 Canvas 物件後自動選取對應設定並滾動至「圖片內容管理」區塊
  - 圖片內容管理區塊下方新增操作提示（修改內容、調整圖層）
  - 新增物件三按鈕樣式統一：相同高度（76px）與寬度（80px），圖示大小 40px
  - 圖片與 QRCode 圖示改為深淺色模式雙色分割圖（半白半黑，依 theme 切換左右半）
  - 批量生產自訂文字欄位 key 改為使用文字內容（經 sanitize），取代隨機 ID
  - 修正 dark mode 下新增物件圖示顏色未變化的問題

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
│   ├── philips-devices.json    # 桌牌設定（名稱/IP/協定/port）伺服器端儲存
│   ├── philips-callbacks.json
│   └── upload-access-log.json
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

- 前後端自動化測試
- lint / format / CI

### P2

  - 模板管理與品牌樣式配置
  - 批量排程發布
  - 進階後台設定頁
  - 顏色預設選單 UI 優化與美化

## 桌牌設定存放與網路建議

### 現在設定是存在哪裡？

- 目前桌牌設定（名稱/IP 對照）是存在伺服器端檔案：`uploads/philips-devices.json`。
- 前端 localStorage 仍會保存使用者個人的版型編輯狀態（顏色、物件、背景等），但桌牌清單以伺服器資料為主。

### 名稱對 IP 對照是否一定要固定 IP？

- 如果你是用「名稱 -> IP」直接對應，實務上建議要固定 IP，否則 DHCP 重新分配後，名稱可能會指到舊 IP，造成推送失敗或送錯裝置。

### 建議做法（優先順序）

1. 最推薦：在路由器做 DHCP Reservation（綁 MAC 配固定 IP）
2. 次選：在每台桌牌內設定 Static IP
3. 同時保留桌牌名稱，讓操作人員以名稱辨識，系統以 IP 連線

### 如何執行 DHCP Reservation

1. 到路由器管理頁找到 DHCP / Address Reservation
2. 針對每台桌牌填入 MAC 位址並指定固定 IP
3. 讓桌牌重新取得租約（重開機或 renew）
4. 在本系統儲存桌牌名稱與該固定 IP

### 何時不用固定 IP？

- 若未來改成用 Philips `device_id` 或 DNS 名稱做主要識別，並在發送前做即時解析，可降低對固定 IP 的依賴。
- 但在目前「名稱+IP 直接對照」模式下，固定 IP 仍是最穩定做法。

## 授權

MIT License
