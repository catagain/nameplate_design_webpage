/**
 * 會議名牌編輯器 - API 集成示例
 * 
 * 這是一個 Node.js + Express 的後端示例，展示如何處理名牌上傳請求
 * 
 * 安裝依賴:
 * npm install express cors multer sharp dotenv
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中介軟體
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// 建立上傳目錄
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * 健康檢查端點
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'API 服務運行正常' });
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
        const { name, company, position, image, timestamp } = req.body;

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
        const filename = `${fileId}_${sanitizedName}.png`;
        const filepath = path.join(uploadDir, filename);

        // 解析 Base64 圖片
        const base64Data = image.split(',')[1] || image;
        const buffer = Buffer.from(base64Data, 'base64');

        // 使用 sharp 修改圖片
        try {
            const metadata = await sharp(buffer).metadata();
            console.log(`圖片資訊: ${metadata.width}x${metadata.height}px, ${metadata.format}`);
        } catch (err) {
            return res.status(400).json({
                success: false,
                error: '無效的圖片文件'
            });
        }

        // 保存圖片
        fs.writeFileSync(filepath, buffer);

        // 資料庫紀錄
        const record = {
            id: fileId,
            name: name,
            company: company || '',
            position: position || '',
            filename: filename,
            filepath: filepath,
            uploadTime: timestamp || new Date().toISOString(),
            fileSize: buffer.length,
            status: 'completed'
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
                size: buffer.length,
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

/**
 * 获取已上传的名牌列表
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
        console.error('获取列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取列表失败'
        });
    }
});

/**
 * 获取单个名牌
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
        console.error('获取名牌失败:', error);
        res.status(500).json({
            success: false,
            error: '获取名牌失败'
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
        console.error('删除失败:', error);
        res.status(500).json({
            success: false,
            error: '删除失败'
        });
    }
});

/**
 * 提供静态文件访问
 */
app.use('/uploads', express.static(uploadDir));

/**
 * 错误处理
 */
app.use((err, req, res, next) => {
    console.error('错误:', err);
    res.status(500).json({
        success: false,
        error: '服务器错误',
        message: err.message
    });
});

/**
 * 启动服务器
 */
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  会议名牌编辑器 - API 服务              ║
╠════════════════════════════════════════╣
║  服务器运行在: http://localhost:${PORT}      ║
║  上传目录: ${uploadDir}                     ║
║                                        ║
║  可用端点:                              ║
║  • POST   /api/nameplate/upload       ║
║  • GET    /api/nameplate/list         ║
║  • GET    /api/nameplate/:id          ║
║  • DELETE /api/nameplate/:id          ║
║  • GET    /health                     ║
╚════════════════════════════════════════╝
    `);
});

module.exports = app;
