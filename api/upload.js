const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();

// 中间件配置
app.use(express.json());

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

// 图片处理配置 - 使用内存存储
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

// 存储配置 - Vercel环境
let photosData = [];

// 模拟数据存储（在真实项目中应该使用数据库）
function addPhoto(photo) {
    photosData.push(photo);
    return photo;
}

function getAllPhotos() {
    return photosData.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
}

function deletePhoto(photoId) {
    const index = photosData.findIndex(p => p.id === photoId);
    if (index !== -1) {
        photosData.splice(index, 1);
        return true;
    }
    return false;
}

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
        const photos = getAllPhotos();
        res.json(photos);
    } catch (error) {
        console.error('Error getting photos:', error);
        res.status(500).json({ success: false, message: '获取照片失败' });
    }
});

// 上传新照片 - Vercel 兼容版本
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
        const fileExtension = req.file.originalname.split('.').pop();
        const filename = `${photoId}.${fileExtension}`;
        
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
        
        // 获取处理后的图片buffer
        const optimizedBuffer = await processedImage.toBuffer();
        
        // 将图片转为base64编码存储（临时方案）
        const base64Image = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
        
        // 创建照片记录
        const photo = {
            id: photoId,
            title: title.trim(),
            description: description ? description.trim() : '',
            filename: filename,
            url: base64Image, // 使用base64数据URL
            uploadDate: new Date().toISOString(),
            originalName: req.file.originalname,
            size: optimizedBuffer.length
        };
        
        // 添加到内存存储
        addPhoto(photo);
        
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
        
        const deleted = deletePhoto(photoId);
        
        if (deleted) {
            res.json({ 
                success: true, 
                message: '照片删除成功' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: '照片不存在' 
            });
        }
        
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
        const photos = getAllPhotos();
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

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API 正常运行 (Vercel版本)',
        timestamp: new Date().toISOString(),
        environment: 'vercel',
        photosCount: photosData.length
    });
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

module.exports = app;
