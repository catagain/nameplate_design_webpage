/**
 * 會議名牌編輯器 - API 集成示例
 * 
 * 這是一個 Node.js + Express 的後端示例，展示如何處理名牌上傳請求
 * 與 Philips 會議桌牌 webhook 對接
 * 
 * 安裝依賴:
 * npm install express cors multer sharp dotenv
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const WEB_ROOT = __dirname;
const DISCOVERY_TIMEOUT_MS = parseInt(process.env.DISCOVERY_TIMEOUT_MS || '900', 10);
const DISCOVERY_CACHE_MS = parseInt(process.env.DISCOVERY_CACHE_MS || '30000', 10);
const DISCOVERY_CONCURRENCY = parseInt(process.env.DISCOVERY_CONCURRENCY || '24', 10);
const DISCOVERY_PORTS = String(process.env.DISCOVERY_PORTS || '80')
    .split(',')
    .map(port => parseInt(port.trim(), 10))
    .filter(port => !Number.isNaN(port) && port > 0 && port <= 65535);
const DISCOVERY_HOST_LIMIT = 254;
const DEFAULT_DISCOVERY_PORTS = DISCOVERY_PORTS.length > 0 ? DISCOVERY_PORTS : [80];
let discoveryCache = {
    timestamp: 0,
    result: null,
    inFlight: null
};

// 中介軟體
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// 建立上傳目錄
const uploadDir = path.join(__dirname, 'uploads');
const callbackLogPath = path.join(uploadDir, 'philips-callbacks.json');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(callbackLogPath)) {
    fs.writeFileSync(callbackLogPath, '[]', 'utf8');
}

function getPublicBaseUrl(req) {
    if (PUBLIC_BASE_URL) {
        return PUBLIC_BASE_URL.replace(/\/$/, '');
    }

    return `${req.protocol}://${req.get('host')}`;
}

function appendCallbackLog(type, body) {
    const raw = fs.readFileSync(callbackLogPath, 'utf8');
    const list = JSON.parse(raw);
    list.unshift({
        type,
        timestamp: new Date().toISOString(),
        body
    });
    fs.writeFileSync(callbackLogPath, JSON.stringify(list.slice(0, 200), null, 2), 'utf8');
}

function isPrivateIpv4(address) {
    if (!address) return false;
    if (address.startsWith('10.')) return true;
    if (address.startsWith('192.168.')) return true;

    const match = address.match(/^172\.(\d{1,3})\./);
    if (!match) return false;

    const secondOctet = parseInt(match[1], 10);
    return secondOctet >= 16 && secondOctet <= 31;
}

function listLanInterfaces() {
    const interfaces = os.networkInterfaces();

    return Object.entries(interfaces)
        .flatMap(([name, entries]) => (entries || []).map(entry => ({ name, ...entry })))
        .filter(entry => entry.family === 'IPv4' && !entry.internal && isPrivateIpv4(entry.address))
        .map(entry => ({
            name: entry.name,
            address: entry.address,
            netmask: entry.netmask,
            cidr: entry.cidr || null
        }));
}

function buildSubnetCandidates(address) {
    const octets = String(address || '').split('.');
    if (octets.length !== 4) {
        return [];
    }

    const prefix = octets.slice(0, 3).join('.');
    const selfHost = parseInt(octets[3], 10);
    const candidates = [];

    for (let host = 1; host <= DISCOVERY_HOST_LIMIT; host += 1) {
        if (host === selfHost) {
            continue;
        }

        candidates.push(`${prefix}.${host}`);
    }

    return candidates;
}

function requestJson(urlString, timeoutMs = DISCOVERY_TIMEOUT_MS) {
    const targetUrl = new URL(urlString);
    const client = targetUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const request = client.request({
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: `${targetUrl.pathname}${targetUrl.search}`,
            method: 'GET'
        }, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
            });
            response.on('end', () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        request.on('error', reject);
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error('Request timeout'));
        });
        request.end();
    });
}

async function mapWithConcurrency(items, concurrency, iteratee) {
    const results = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
        while (currentIndex < items.length) {
            const itemIndex = currentIndex;
            currentIndex += 1;
            results[itemIndex] = await iteratee(items[itemIndex], itemIndex);
        }
    }

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

async function probePhilipsDevice(host, port) {
    const protocol = 'http';
    const aboutUrl = `${protocol}://${host}:${port}/api/tableside/v1/about`;

    try {
        const payload = await requestJson(aboutUrl);
        return {
            id: `${protocol}://${host}:${port}`,
            host,
            port,
            protocol,
            device_id: payload.device_id || '',
            label: payload.device_id || payload.mac || host,
            about: payload
        };
    } catch (error) {
        return null;
    }
}

async function discoverPhilipsDevices(forceRefresh = false) {
    const now = Date.now();

    if (!forceRefresh && discoveryCache.result && now - discoveryCache.timestamp < DISCOVERY_CACHE_MS) {
        return discoveryCache.result;
    }

    if (discoveryCache.inFlight) {
        return discoveryCache.inFlight;
    }

    discoveryCache.inFlight = (async () => {
        const interfaces = listLanInterfaces();
        const targets = [];
        const seenTargets = new Set();

        interfaces.forEach(networkInterface => {
            buildSubnetCandidates(networkInterface.address).forEach(host => {
                DEFAULT_DISCOVERY_PORTS.forEach(port => {
                    const key = `${host}:${port}`;
                    if (seenTargets.has(key)) {
                        return;
                    }

                    seenTargets.add(key);
                    targets.push({ host, port });
                });
            });
        });

        const scanned = await mapWithConcurrency(targets, DISCOVERY_CONCURRENCY, async target => probePhilipsDevice(target.host, target.port));
        const devices = scanned.filter(Boolean);
        const result = {
            scannedAt: new Date().toISOString(),
            interfaces,
            devices,
            targetCount: targets.length
        };

        discoveryCache.timestamp = Date.now();
        discoveryCache.result = result;
        discoveryCache.inFlight = null;
        return result;
    })().catch(error => {
        discoveryCache.inFlight = null;
        throw error;
    });

    return discoveryCache.inFlight;
}

/**
 * 健康檢查端點
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API 服務運行正常' });
});

app.get('/api/philips/callbacks', (req, res) => {
    const raw = fs.readFileSync(callbackLogPath, 'utf8');
    res.json({
        success: true,
        data: JSON.parse(raw)
    });
});

app.get('/api/philips/discover', async (req, res) => {
    try {
        const result = await discoverPhilipsDevices(req.query.force === '1');
        res.json({
            success: true,
            ...result,
            serverCandidates: listLanInterfaces(),
            publicBaseUrl: getPublicBaseUrl(req)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '桌牌掃描失敗',
            message: error.message
        });
    }
});

/**
 * 名牌上傳端點
 * POST /api/nameplate/upload
 * 
 * 請求體:
 * {
 *   name: string,
 *   company: string,
 *   position: string,
 *   image: string (base64),
 *   timestamp: string (ISO)
 * }
 */
app.post('/api/nameplate/upload', async (req, res) => {
    try {
        const { name, company, position, image, timestamp, format } = req.body;

        // 輸入驗證
        if (!name || !image) {
            return res.status(400).json({
                success: false,
                error: '缺少必需的字段: name 和 image'
            });
        }

        // 生成文件ID和文件名
        const fileId = `nameplate_${Date.now()}`;
        const sanitizedName = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '');
        const normalizedFormat = String(format || '').toLowerCase() === 'jpeg' ? 'jpeg' : 'png';
        const extension = normalizedFormat === 'jpeg' ? 'jpg' : 'png';
        const filename = `${fileId}_${sanitizedName}.${extension}`;
        const filepath = path.join(uploadDir, filename);

        // 解析 Base64 圖片
        const base64Data = image.split(',')[1] || image;
        const buffer = Buffer.from(base64Data, 'base64');

        let outputBuffer = buffer;
        let metadata;

        // 資料庫紀錄
        try {
            metadata = await sharp(buffer).metadata();
            console.log(`圖片資訊: ${metadata.width}x${metadata.height}px, ${metadata.format}`);
        } catch (err) {
            return res.status(400).json({
                success: false,
                error: '無效的圖片文件'
            });
        }

        if (normalizedFormat === 'jpeg') {
            outputBuffer = await sharp(buffer)
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 88, mozjpeg: true })
                .toBuffer();
        }

        fs.writeFileSync(filepath, outputBuffer);

        const record = {
            id: fileId,
            name: name,
            company: company || '',
            position: position || '',
            filename: filename,
            filepath: filepath,
            uploadTime: timestamp || new Date().toISOString(),
            fileSize: outputBuffer.length,
            format: normalizedFormat,
            status: 'completed',
            width: metadata?.width || null,
            height: metadata?.height || null
        };

        // 待更新資料庫保存
        // await db.nameplates.insert(record);

        console.log('名牌已保存:', record);

        // 返回成功響應
        res.json({
            success: true,
            id: fileId,
            message: '上傳成功',
            data: {
                filename: filename,
                url: `/uploads/${filename}`,
                publicUrl: `${getPublicBaseUrl(req)}/uploads/${filename}`,
                size: outputBuffer.length,
                format: normalizedFormat,
                timestamp: record.uploadTime
            }
        });

    } catch (error) {
        console.error('上傳失敗:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤',
            message: error.message
        });
    }
});

app.post('/heartbeat', (req, res) => {
    appendCallbackLog('heartbeat', req.body);
    console.log('收到 heartbeat:', req.body);
    res.json({ success: true, received: true });
});

app.post('/image-post', (req, res) => {
    appendCallbackLog('image-post', req.body);
    console.log('收到 image-post:', req.body);
    res.json({ success: true, received: true });
});

app.post('/ota-post', (req, res) => {
    appendCallbackLog('ota-post', req.body);
    console.log('收到 ota-post:', req.body);
    res.json({ success: true, received: true });
});

/**
 * 獲取已上傳的名牌列表
 * GET /api/nameplate/list
 */
app.get('/api/nameplate/list', (req, res) => {
    try {
        const files = fs.readdirSync(uploadDir);
        const nameplates = files.map(file => ({
            filename: file,
            url: `/uploads/${file}`,
            uploadTime: fs.statSync(path.join(uploadDir, file)).mtime
        }));

        res.json({
            success: true,
            count: nameplates.length,
            data: nameplates
        });
    } catch (error) {
        console.error('獲取列表失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取列表失敗'
        });
    }
});

/**
 * 獲取單個名牌
 * GET /api/nameplate/:id
 */
app.get('/api/nameplate/:id', (req, res) => {
    try {
        const { id } = req.params;
        const files = fs.readdirSync(uploadDir);
        const file = files.find(f => f.startsWith(id));

        if (!file) {
            return res.status(404).json({
                success: false,
                error: '名牌不存在'
            });
        }

        const filepath = path.join(uploadDir, file);
        const stats = fs.statSync(filepath);

        res.json({
            success: true,
            data: {
                filename: file,
                url: `/uploads/${file}`,
                size: stats.size,
                uploadTime: stats.mtime
            }
        });
    } catch (error) {
        console.error('獲取名牌失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取名牌失敗'
        });
    }
});

/**
 * 删除名牌
 * DELETE /api/nameplate/:id
 */
app.delete('/api/nameplate/:id', (req, res) => {
    try {
        const { id } = req.params;
        const files = fs.readdirSync(uploadDir);
        const file = files.find(f => f.startsWith(id));

        if (!file) {
            return res.status(404).json({
                success: false,
                error: '名牌不存在'
            });
        }

        const filepath = path.join(uploadDir, file);
        fs.unlinkSync(filepath);

        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除失敗:', error);
        res.status(500).json({
            success: false,
            error: '删除失敗'
        });
    }
});

/**
 * 靜態文件讀取
 */
app.use('/uploads', express.static(uploadDir));
app.use(express.static(WEB_ROOT, { index: false }));

app.get('/', (req, res) => {
    res.sendFile(path.join(WEB_ROOT, 'index.html'));
});

/**
 * 錯誤訊息處理
 */
app.use((err, req, res, next) => {
    console.error('錯誤:', err);
    res.status(500).json({
        success: false,
        error: '伺服器錯誤',
        message: err.message
    });
});

/**
 * 啟動伺服器
 */
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  會議名牌編輯器 - API 服務               ║
╠════════════════════════════════════════╣
║  伺服器運行在: http://localhost:${PORT} ║
║  上傳目錄: ${uploadDir}                 ║
║                                        ║
║  可用端點:                              ║
║  • POST   /api/nameplate/upload        ║
║  • GET    /api/nameplate/list          ║
║  • GET    /api/nameplate/:id           ║
║  • DELETE /api/nameplate/:id           ║
║  • GET    /api/philips/callbacks       ║
║  • GET    /api/philips/discover        ║
║  • POST   /heartbeat                   ║
║  • POST   /image-post                  ║
║  • POST   /ota-post                    ║
║  • GET    /health                      ║
╚════════════════════════════════════════╝
    `);
});

module.exports = app;
