# 會議名牌編輯器

這個專案是一個會議名牌編輯工具，用來快速產出桌上名牌 PNG，並可透過同一台電腦上的 Node.js 服務作為前端網站、圖片託管、Philips webhook 接收與區網桌牌掃描中介。現階段可在瀏覽器中直接編輯姓名、公司、職稱、背景、文字樣式與 QRCode，並即時預覽、下載圖片，再由整合式 server 協助呼叫 Philips 電子紙會議名牌 API。

## 專案現況

### 目前已完成
- 可由同一個 Node.js / Express 服務提供前端頁面與中介 API
# 會議名牌編輯器

一個前端可編輯、可匯出、可批次產圖的會議名牌工具，並內建 Node.js 中介服務處理 Philips 桌牌掃描、代理呼叫與圖片託管。

## 精簡架設方式

### 需求

- Node.js 18+
- npm

### 本機啟動 (最推薦)

```bash
npm install
npm start
```

啟動後開啟:

- http://localhost:3001

### 一鍵腳本啟動

Windows:

```bat
start-nameplate.bat
```

macOS / Linux:

```bash
chmod +x start-nameplate.sh
./start-nameplate.sh
```

### 常用環境變數

- HOST: 預設 0.0.0.0
- PORT: 預設 3001
- PUBLIC_BASE_URL: 對外網址 (影響上傳圖片與 callback URL)

### 對外部署重點

- 以 Node.js 啟動服務，前面加 Nginx/Caddy/IIS 反向代理
- 建議強制 HTTPS
- Philips discovery 屬於區網掃描，server 需與桌牌在同一個 LAN/VLAN

## 專案架構

```text
namePlate_web/
├── index.html                   # 前端 UI
├── css/
│   └── style.css                # 樣式
├── js/
│   ├── app.js                   # 前端狀態與事件、批次流程、Philips 控制
│   ├── renderer.js              # Canvas 渲染與圖片匯出
│   └── vendor/                  # 第三方前端函式庫
├── api-example.js               # Node.js/Express API 與靜態服務
├── deploy/
│   └── nginx.nameplate.conf     # 反向代理範例
├── uploads/                     # 上傳圖片與 callback/access log
├── batch-test.csv               # 批次測試資料
├── start-nameplate.bat          # Windows 啟動腳本
├── start-nameplate.sh           # macOS/Linux 啟動腳本
├── package.json                 # 依賴與 scripts
└── README.md
```

## TODO List

### P0 (優先處理)

- 補上 API 驗證機制 (token/key)
- 補上 rate limit 與 upload 容量限制
- Philips proxy/discovery 錯誤碼、超時、重試策略完整化
- 增加關鍵操作日誌與追蹤 ID

### P1 (近期)

- 建立前端與後端自動化測試
- 補齊 lint/format 與 CI
- 批次流程加入部分失敗重送與完整報表
- 裝置映射規則標準化 (deviceId/meetingId)

### P2 (可排程)

- 模板化版型與品牌樣式管理
- 批次排程發布
- 進階後台設定頁 (環境與裝置管理)

## 補充

- 建議從 http://localhost:3001 使用，不建議長期直接開 file 模式
- 若網路環境複雜，請保留手動裝置設定作為掃描 fallback
- 
#### 做法 1：部署到雲端主機

適合：

- 只需要外網編輯器
- 需要固定網址
- 需要多人遠端使用

流程：

1. 把專案放到雲端主機
2. 執行 `npm install`
3. 設定 `HOST=0.0.0.0`
4. 設定 `PUBLIC_BASE_URL=https://你的網域`
5. 用 Nginx / Caddy 轉發到 `localhost:3001`
6. 開 HTTPS

#### 做法 2：先在你自己的電腦對外測試

適合：

- 臨時 Demo
- 還沒正式上雲

流程：

1. 在你的電腦執行 `npm start`
2. 確認 Windows 防火牆允許 Node.js / 3001
3. 在路由器做 port forwarding，把公網 port 導到這台電腦的 `3001`
4. 設定 `PUBLIC_BASE_URL` 為你的公網網址或 DDNS

這種方式風險較高，不建議長期使用。

### 目前程式已支援的部分

- 前端 API 主要使用相對路徑，可跟著同一個網站網域一起工作
- server 可直接提供靜態頁與 API，不需要拆前後端
- `PUBLIC_BASE_URL` 可控制對外產生的圖片 URL
- Philips 控制現已可透過後端 `/api/philips/proxy` 轉發，不需要讓瀏覽器直接存取桌牌 IP
- `display_callback_url`、`heartbeat_url`、`ota_url` 若填相對路徑，後端會自動展開成 `PUBLIC_BASE_URL` 對應的完整網址

### 目前仍不建議直接公開的部分

- `api-example.js` 目前沒有身份驗證
- 沒有 rate limit
- 沒有正式日誌、權限控管、佇列與重試機制
- Philips discovery 是區網掃描，不是公開網際網路裝置註冊機制

如果要正式上線，至少建議先補：

1. 反向代理與 HTTPS
2. API 身份驗證
3. 上傳大小與 rate limit
4. PM2 / NSSM / systemd 這類常駐程序管理
5. 正式錯誤日誌

### Nginx 反向代理範例

可參考 `deploy/nginx.nameplate.conf`。部署時記得：

- 反向代理到 `127.0.0.1:3001`
- 對外網域要和 `PUBLIC_BASE_URL` 一致
- 若 Philips 桌牌需要回呼 `heartbeat`、`image-post`、`ota-post`，這三條路徑必須能從桌牌網路連回你的網站

### Philips 代理模式

如果你要的是「外網使用者只操作網站，桌牌都由後端所在網路控制」，目前程式已符合這個方向：

- 前端不再直接呼叫桌牌 IP
- 前端會把桌牌操作送到後端 `/api/philips/proxy`
- 後端再轉呼叫桌牌的 `/api/tableside/v1/...`
- callback / webhook 類網址會優先使用 `PUBLIC_BASE_URL`

因此正式部署時，建議至少設定：

```bash
HOST=0.0.0.0
PORT=3001
PUBLIC_BASE_URL=https://nameplate.your-domain.example.com
```

如果 Philips 桌牌不是透過公開網域回來，而是走內網 IP，也可以在前端介面中的 `Webhook Server 位址 / Port` 手動覆寫。

*** Add File: c:\working_space\namePlate_web\deploy\nginx.nameplate.conf
server {
  listen 80;
  server_name nameplate.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name nameplate.example.com;

  ssl_certificate /etc/letsencrypt/live/nameplate.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/nameplate.example.com/privkey.pem;

  client_max_body_size 50m;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}

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

### 桌牌控制
- 下拉選單會透過同機 server 自動掃描目前區網中的桌牌並定期刷新
- 可為掃描到的桌牌儲存別名，也可保留手動補充的裝置設定作為 fallback
- 選擇桌牌後才顯示 Philips 可控制的 API 按鈕
- 支援更新左 / 右側電子紙畫面、設定 server、heartbeat、changeip、ota、reset、preferences、about
- 若未手動提供圖片網址，前端會嘗試把目前名牌轉成 JPEG 並上傳到 `api-example.js`，再把公開 URL 交給桌牌下載
- 若 `Webhook Server 位址` 尚未設定，系統會優先套用本機 server 掃描到的區網 IP

### 區網掃描限制
- 自動掃描目前以本機私有 IPv4 網卡所在的 `/24` 網段為主
- 掃描方式是嘗試呼叫 `GET /api/tableside/v1/about`，只有有回應的桌牌才會出現在下拉選單
- 若桌牌不在同一子網、不是預設掃描 port，或被防火牆阻擋，就不會被自動發現
- 若現場網路較複雜，建議保留手動補充的裝置設定作為備援

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

### 前端圖片上傳 payload
前端在需要自動產生桌牌圖片網址時，會送出以下 payload 到 `api-example.js`：

```json
{
  "name": "王小明",
  "company": "範例公司",
  "position": "Sales Director",
  "image": "data:image/jpeg;base64,...",
  "format": "jpeg",
  "timestamp": "2026-05-25T12:00:00.000Z"
}
```

### 前端預期的基本 API 行為
- HTTP Method: `POST`
- Content-Type: `application/json`
- 成功時回傳 JSON
- 前端目前只檢查 HTTP 狀態碼與是否能解析 JSON

## GitHub

- Repository: `https://github.com/catagain/nameplate_design_webpage`
- Remote: `origin`

## 授權

MIT License

## 維護者

Made by 貓又 CatAgain
