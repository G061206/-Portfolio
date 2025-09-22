const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

const app = express();

// 中间件配置
app.use(express.json());
app.use(express.static('public'));

// CORS 配置
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 存储配置
const PHOTOS_DIR = path.join(process.cwd(), 'public', 'uploads');
const DATA_FILE = path.join(process.cwd(), 'data', 'photos.json');

// 确保目录存在
async function ensureDirectories() {
    try {
        await fs.mkdir(PHOTOS_DIR, { recursive: true });
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    } catch (error) {
        console.error('Error creating directories:', error);
    }
}

// 读取照片数据
async function readPhotosData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // 如果文件不存在，返回空数组
        return [];
    }
}

// 写入照片数据
async function writePhotosData(photos) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(photos, null, 2));
    } catch (error) {
        console.error('Error writing photos data:', error);
        throw error;
    }
}

// 图片处理配置
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传图片文件'), false);
        }
    }
});

// 密码验证
const ADMIN_PASSWORD = '602160';

// 认证中间件
function requireAuth(req, res, next) {
    // 简单的认证检查 - 在生产环境中应该使用更安全的方法
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader === 'Bearer authenticated') {
        next();
    } else {
        res.status(401).json({ success: false, message: '未授权访问' });
    }
}

// 初始化
ensureDirectories();

// 路由处理

// 静态路由处理
app.get('/admin', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

// 处理根路径
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 登录认证
app.post('/api/auth', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ success: false, message: '密码不能为空' });
        }
        
        if (password === ADMIN_PASSWORD) {
            res.json({ success: true, message: '登录成功' });
        } else {
            res.status(401).json({ success: false, message: '密码错误' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取所有照片
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await readPhotosData();
        // 按上传时间倒序排列
        photos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        res.json(photos);
    } catch (error) {
        console.error('Error getting photos:', error);
        res.status(500).json({ success: false, message: '获取照片失败' });
    }
});

// 上传新照片
app.post('/api/photos', upload.single('photo'), async (req, res) => {
    try {
        const { title, description } = req.body;
        
        if (!title || !req.file) {
            return res.status(400).json({ 
                success: false, 
                message: '标题和图片都是必需的' 
            });
        }
        
        // 生成唯一文件名
        const photoId = uuidv4();
        const fileExtension = path.extname(req.file.originalname);
        const filename = `${photoId}${fileExtension}`;
        const filePath = path.join(PHOTOS_DIR, filename);
        
        // 使用 Sharp 处理图片（压缩和优化）
        let processedImage = sharp(req.file.buffer);
        
        // 获取图片元数据
        const metadata = await processedImage.metadata();
        
        // 如果图片宽度大于 1920px，则调整大小
        if (metadata.width > 1920) {
            processedImage = processedImage.resize(1920, null, {
                withoutEnlargement: true
            });
        }
        
        // 压缩图片
        processedImage = processedImage.jpeg({ quality: 85 });
        
        // 保存处理后的图片
        await processedImage.toFile(filePath);
        
        // 创建照片记录
        const photo = {
            id: photoId,
            title: title.trim(),
            description: description ? description.trim() : '',
            filename: filename,
            url: `/uploads/${filename}`,
            uploadDate: new Date().toISOString(),
            originalName: req.file.originalname,
            size: req.file.size
        };
        
        // 读取现有数据并添加新照片
        const photos = await readPhotosData();
        photos.push(photo);
        await writePhotosData(photos);
        
        res.json({ 
            success: true, 
            message: '照片上传成功',
            photo: photo
        });
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ 
            success: false, 
            message: '上传失败: ' + error.message 
        });
    }
});

// 删除照片
app.delete('/api/photos/:id', async (req, res) => {
    try {
        const photoId = req.params.id;
        
        // 读取现有数据
        const photos = await readPhotosData();
        const photoIndex = photos.findIndex(p => p.id === photoId);
        
        if (photoIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: '照片不存在' 
            });
        }
        
        const photo = photos[photoIndex];
        
        // 删除文件
        try {
            const filePath = path.join(PHOTOS_DIR, photo.filename);
            await fs.unlink(filePath);
        } catch (fileError) {
            console.error('Error deleting file:', fileError);
            // 即使文件删除失败，也继续删除数据记录
        }
        
        // 从数据中移除
        photos.splice(photoIndex, 1);
        await writePhotosData(photos);
        
        res.json({ 
            success: true, 
            message: '照片删除成功' 
        });
        
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ 
            success: false, 
            message: '删除失败: ' + error.message 
        });
    }
});

// 获取单个照片信息
app.get('/api/photos/:id', async (req, res) => {
    try {
        const photoId = req.params.id;
        const photos = await readPhotosData();
        const photo = photos.find(p => p.id === photoId);
        
        if (!photo) {
            return res.status(404).json({ 
                success: false, 
                message: '照片不存在' 
            });
        }
        
        res.json(photo);
    } catch (error) {
        console.error('Error getting photo:', error);
        res.status(500).json({ 
            success: false, 
            message: '获取照片失败' 
        });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                message: '文件大小不能超过 10MB' 
            });
        }
    }
    
    res.status(500).json({ 
        success: false, 
        message: '服务器内部错误' 
    });
});

// API 404 处理 - 只处理 /api 路径
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API 端点不存在' 
    });
});

// 处理其他所有路径 - 返回 index.html (SPA 路由)
app.get('*', (req, res) => {
    // 如果是静态资源请求，让 express.static 处理
    if (req.path.includes('.')) {
        return res.status(404).send('File not found');
    }
    // 其他路径返回主页
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 本地开发服务器
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📸 Photography Portfolio`);
        console.log(`👉 Main site: http://localhost:${PORT}`);
        console.log(`🔧 Admin panel: http://localhost:${PORT}/admin`);
        console.log(`🔑 Admin password: 602160`);
        console.log(`\n📁 Uploads will be saved to: ${path.join(process.cwd(), 'public', 'uploads')}`);
        console.log(`💾 Data will be saved to: ${path.join(process.cwd(), 'data', 'photos.json')}`);
    });
}

module.exports = app;
