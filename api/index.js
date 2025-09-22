const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// 存储服务管理类
class StorageManager {
    constructor() {
        this.blobAPI = null;
        this.redisAPI = null;
        this.isReady = false;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing storage services...');
            
            // 检查环境变量
            const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
            const redisUrl = process.env.REDIS_URL;
            
            if (!blobToken || !redisUrl) {
                throw new Error(`Missing environment variables: ${!blobToken ? 'BLOB_READ_WRITE_TOKEN ' : ''}${!redisUrl ? 'REDIS_URL' : ''}`);
            }

            // 动态导入Vercel服务
            const { put, del, list } = await import('@vercel/blob');
            const { Redis } = await import('@upstash/redis');
            
            this.blobAPI = { put, del, list };
            this.redisAPI = new Redis({ url: redisUrl });
            
            // 测试连接
            await this.testConnections();
            
            this.isReady = true;
            console.log('✅ Storage services initialized successfully');
            
        } catch (error) {
            console.error('❌ Storage initialization failed:', error.message);
            throw error;
        }
    }

    async testConnections() {
        // 测试Redis连接
        try {
            await this.redisAPI.ping();
            console.log('✅ Redis connection OK');
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
            throw new Error('Redis connection failed');
        }
        
        // Blob连接会在首次使用时测试
        console.log('✅ Blob service ready');
    }

    // 照片数据操作
    async getPhotos() {
        if (!this.isReady) throw new Error('Storage not initialized');
        
        try {
            console.log('📋 Fetching photos from Redis...');
            const photosJson = await this.redisAPI.get('photos');
            const photos = photosJson ? JSON.parse(photosJson) : [];
            console.log(`📊 Found ${photos.length} photos`);
            return photos;
        } catch (error) {
            console.error('❌ Error fetching photos:', error.message);
            throw new Error('Failed to fetch photos from database');
        }
    }

    async savePhotos(photos) {
        if (!this.isReady) throw new Error('Storage not initialized');
        
        try {
            console.log(`💾 Saving ${photos.length} photos to Redis...`);
            await this.redisAPI.set('photos', JSON.stringify(photos));
            console.log('✅ Photos saved successfully');
        } catch (error) {
            console.error('❌ Error saving photos:', error.message);
            throw new Error('Failed to save photos to database');
        }
    }

    async uploadImage(buffer, filename) {
        if (!this.isReady) throw new Error('Storage not initialized');
        
        try {
            console.log(`📤 Uploading image: ${filename}, Size: ${buffer.length} bytes`);
            const blob = await this.blobAPI.put(filename, buffer, {
                access: 'public',
                contentType: 'image/jpeg'
            });
            console.log(`✅ Image uploaded: ${blob.url}`);
            return blob.url;
        } catch (error) {
            console.error('❌ Image upload failed:', error.message);
            throw new Error('Failed to upload image to storage');
        }
    }

    async deleteImage(url) {
        if (!this.isReady) throw new Error('Storage not initialized');
        
        try {
            console.log(`🗑️ Deleting image: ${url}`);
            await this.blobAPI.del(url);
            console.log('✅ Image deleted successfully');
        } catch (error) {
            console.error('❌ Image deletion failed:', error.message);
            // 不抛出错误，因为图片可能已经不存在
            console.warn('⚠️ Image deletion failed, continuing...');
        }
    }
}

// 图片处理工具
class ImageProcessor {
    static async processImage(buffer) {
        try {
            let processor = sharp(buffer);
            const metadata = await processor.metadata();
            
            console.log(`🖼️ Processing image: ${metadata.width}x${metadata.height}, ${metadata.format}`);
            
            // 如果图片宽度大于1920px，调整大小
            if (metadata.width > 1920) {
                processor = processor.resize(1920, null, {
                    withoutEnlargement: true
                });
                console.log('📏 Resizing image to max width: 1920px');
            }
            
            // 转换为JPEG并压缩
            const processedBuffer = await processor.jpeg({ quality: 85 }).toBuffer();
            console.log(`✨ Image processed: ${buffer.length} → ${processedBuffer.length} bytes`);
            
            return processedBuffer;
        } catch (error) {
            console.error('❌ Image processing failed:', error.message);
            throw new Error('Failed to process image');
        }
    }
}

// 创建应用实例
const app = express();
const storage = new StorageManager();

// 中间件配置
app.use(express.json());
app.use(express.static('public'));

// CORS配置
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 文件上传配置
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('仅支持图片文件'), false);
        }
    }
});

// 配置
const ADMIN_PASSWORD = '602160';

// 存储状态检查中间件
const requireStorage = (req, res, next) => {
    if (!storage.isReady) {
        return res.status(503).json({
            success: false,
            message: '存储服务不可用，请稍后重试'
        });
    }
    next();
};

// 静态路由
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

// API路由

// 登录认证
app.post('/api/auth', async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({
                success: false,
                message: '密码不能为空'
            });
        }
        
        if (password === ADMIN_PASSWORD) {
            res.json({
                success: true,
                message: '登录成功'
            });
        } else {
            res.status(401).json({
                success: false,
                message: '密码错误'
            });
        }
    } catch (error) {
        console.error('❌ Auth error:', error);
        res.status(500).json({
            success: false,
            message: '登录失败'
        });
    }
});

// 获取所有照片
app.get('/api/photos', requireStorage, async (req, res) => {
    try {
        const photos = await storage.getPhotos();
        
        // 按上传时间倒序排列
        photos.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        
        res.json(photos);
    } catch (error) {
        console.error('❌ Get photos error:', error);
        res.status(500).json({
            success: false,
            message: '获取照片列表失败'
        });
    }
});

// 上传照片
app.post('/api/photos', requireStorage, upload.single('photo'), async (req, res) => {
    try {
        const { title, description } = req.body;
        
        // 验证输入
        if (!title || !req.file) {
            return res.status(400).json({
                success: false,
                message: '标题和图片都是必需的'
            });
        }

        console.log(`📸 Processing upload: "${title}" (${req.file.size} bytes)`);
        
        // 生成唯一ID和文件名
        const photoId = uuidv4();
        const filename = `photos/${photoId}.jpg`;
        
        // 处理图片
        const processedBuffer = await ImageProcessor.processImage(req.file.buffer);
        
        // 上传到Blob存储
        const imageUrl = await storage.uploadImage(processedBuffer, filename);
        
        // 创建照片记录
        const photo = {
            id: photoId,
            title: title.trim(),
            description: description ? description.trim() : '',
            url: imageUrl,
            uploadDate: new Date().toISOString(),
            originalName: req.file.originalname,
            size: processedBuffer.length
        };
        
        // 保存到数据库
        const photos = await storage.getPhotos();
        photos.push(photo);
        await storage.savePhotos(photos);
        
        console.log(`✅ Photo uploaded successfully: ${photo.id}`);
        
        res.json({
            success: true,
            message: '照片上传成功',
            photo: photo
        });
        
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            message: '上传失败: ' + error.message
        });
    }
});

// 删除照片
app.delete('/api/photos/:id', requireStorage, async (req, res) => {
    try {
        const photoId = req.params.id;
        
        console.log(`🗑️ Deleting photo: ${photoId}`);
        
        // 获取照片列表
        const photos = await storage.getPhotos();
        const photoIndex = photos.findIndex(p => p.id === photoId);
        
        if (photoIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '照片不存在'
            });
        }
        
        const photo = photos[photoIndex];
        
        // 从Blob存储删除图片
        await storage.deleteImage(photo.url);
        
        // 从数据库移除记录
        photos.splice(photoIndex, 1);
        await storage.savePhotos(photos);
        
        console.log(`✅ Photo deleted successfully: ${photoId}`);
        
        res.json({
            success: true,
            message: '照片删除成功'
        });
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        res.status(500).json({
            success: false,
            message: '删除失败: ' + error.message
        });
    }
});

// 获取单个照片
app.get('/api/photos/:id', requireStorage, async (req, res) => {
    try {
        const photoId = req.params.id;
        const photos = await storage.getPhotos();
        const photo = photos.find(p => p.id === photoId);
        
        if (!photo) {
            return res.status(404).json({
                success: false,
                message: '照片不存在'
            });
        }
        
        res.json(photo);
    } catch (error) {
        console.error('❌ Get photo error:', error);
        res.status(500).json({
            success: false,
            message: '获取照片失败'
        });
    }
});

// 调试端点
app.get('/api/debug', (req, res) => {
    const config = {
        environment: 'vercel',
        vercelEnv: process.env.VERCEL_ENV || 'development',
        hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
        hasRedis: !!process.env.REDIS_URL,
        storageReady: storage.isReady,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    };
    
    // 检查旧的KV变量
    if (process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN) {
        config.warning = 'Old KV environment variables detected - please remove them';
    }
    
    console.log('🔍 Debug endpoint called:', config);
    
    res.json({
        success: true,
        config: config,
        recommendation: config.hasBlob && config.hasRedis && config.storageReady ? 
            'All systems operational' :
            'Configuration issues detected'
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('💥 Server error:', error);
    
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

// API 404处理
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API端点不存在'
    });
});

// SPA路由处理
app.get('*', (req, res) => {
    if (req.path.includes('.')) {
        return res.status(404).send('File not found');
    }
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 初始化存储服务
async function initializeApp() {
    try {
        await storage.initialize();
        console.log('🎉 Application ready!');
    } catch (error) {
        console.error('💥 Application initialization failed:', error.message);
        console.error('Please check your Vercel Blob and Redis configuration');
    }
}

// 启动初始化（在Vercel环境中会自动执行）
initializeApp();

// 本地开发服务器
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📸 Photography Portfolio - Vercel Edition`);
        console.log(`👉 Main site: http://localhost:${PORT}`);
        console.log(`🔧 Admin panel: http://localhost:${PORT}/admin`);
        console.log(`🔑 Admin password: 602160`);
        console.log(`🔍 Debug info: http://localhost:${PORT}/api/debug`);
    });
}

module.exports = app;