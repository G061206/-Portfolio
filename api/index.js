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
        this.redisReady = false;
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
        // 测试Redis连接（非阻塞）
        try {
            await this.redisAPI.ping();
            console.log('✅ Redis connection OK');
            this.redisReady = true;
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
            console.warn('⚠️ Redis unavailable - metadata operations will be limited');
            this.redisReady = false;
            // 不抛出错误，允许服务继续运行
        }
        
        // Blob连接会在首次使用时测试
        console.log('✅ Blob service ready');
    }

    // 照片数据操作
    async getPhotos() {
        if (!this.isReady) throw new Error('Storage not initialized');
        
        if (!this.redisReady) {
            console.warn('⚠️ Redis not available, returning empty photo list');
            return [];
        }
        
        try {
            console.log('📋 Fetching photos from Redis...');
            const photosJson = await this.redisAPI.get('photos');
            const photos = photosJson ? JSON.parse(photosJson) : [];
            console.log(`📊 Found ${photos.length} photos`);
            return photos;
        } catch (error) {
            console.error('❌ Error fetching photos:', error.message);
            console.warn('⚠️ Redis error, returning empty list');
            return [];
        }
    }

    async savePhotos(photos) {
        if (!this.isReady) throw new Error('Storage not initialized');
        
        if (!this.redisReady) {
            console.warn('⚠️ Redis not available, cannot save photo metadata');
            throw new Error('Redis unavailable - metadata cannot be saved');
        }
        
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

    // Redis重试机制
    async retryRedisConnection() {
        if (this.redisReady) return true;
        
        console.log('🔄 Retrying Redis connection...');
        try {
            await this.redisAPI.ping();
            console.log('✅ Redis reconnection successful');
            this.redisReady = true;
            return true;
        } catch (error) {
            console.error('❌ Redis reconnection failed:', error.message);
            return false;
        }
    }

    // 强制重新初始化Redis
    async reinitializeRedis() {
        console.log('🔄 Reinitializing Redis connection...');
        
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            throw new Error('REDIS_URL environment variable not found');
        }
        
        try {
            const { Redis } = await import('@upstash/redis');
            this.redisAPI = new Redis({ url: redisUrl });
            
            // 测试连接
            await this.redisAPI.ping();
            this.redisReady = true;
            
            console.log('✅ Redis reinitialization successful');
            return true;
        } catch (error) {
            console.error('❌ Redis reinitialization failed:', error.message);
            this.redisReady = false;
            throw error;
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
    
    // 在请求上下文中添加Redis状态信息
    req.redisReady = storage.redisReady;
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
        try {
            const photos = await storage.getPhotos();
            photos.push(photo);
            await storage.savePhotos(photos);
            
            console.log(`✅ Photo uploaded successfully: ${photo.id}`);
            
            res.json({
                success: true,
                message: '照片上传成功',
                photo: photo
            });
        } catch (metadataError) {
            console.error('❌ Failed to save metadata:', metadataError.message);
            
            // 图片已上传成功，但元数据保存失败
            if (metadataError.message.includes('Redis unavailable')) {
                res.json({
                    success: true,
                    message: '图片上传成功，但元数据保存失败 - 请检查Redis配置',
                    photo: photo,
                    warning: 'Redis not available - metadata not saved'
                });
            } else {
                // 其他错误，尝试删除已上传的图片
                try {
                    await storage.deleteImage(imageUrl);
                    console.log('🗑️ Cleaned up uploaded image due to metadata failure');
                } catch (cleanupError) {
                    console.error('⚠️ Failed to cleanup uploaded image:', cleanupError.message);
                }
                
                throw metadataError;
            }
        }
        
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
app.get('/api/debug', async (req, res) => {
    const config = {
        environment: 'vercel',
        vercelEnv: process.env.VERCEL_ENV || 'development',
        hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
        hasRedis: !!process.env.REDIS_URL,
        storageReady: storage.isReady,
        redisReady: storage.redisReady,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    };
    
    // 检查环境变量详情
    if (process.env.REDIS_URL) {
        config.redisUrl = process.env.REDIS_URL.substring(0, 50) + '...';
        config.redisUrlFormat = process.env.REDIS_URL.startsWith('redis://') ? 'correct' : 'incorrect';
    }
    
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        config.blobToken = process.env.BLOB_READ_WRITE_TOKEN.substring(0, 20) + '...';
    }
    
    // 检查旧的KV变量
    if (process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN) {
        config.warning = 'Old KV environment variables detected - please remove them';
    }
    
    // 实时测试Redis连接
    if (storage.redisAPI && process.env.REDIS_URL) {
        try {
            await storage.redisAPI.ping();
            config.redisTestResult = 'connection_ok';
        } catch (error) {
            config.redisTestResult = 'connection_failed';
            config.redisError = error.message;
        }
    } else {
        config.redisTestResult = 'not_initialized';
    }
    
    // 分析状态
    let recommendation = 'Configuration issues detected';
    if (config.hasBlob && config.hasRedis && config.storageReady) {
        if (config.redisReady && config.redisTestResult === 'connection_ok') {
            recommendation = 'All systems operational';
        } else if (config.redisTestResult === 'connection_failed') {
            recommendation = 'Redis connection failed - check URL format and network';
        } else {
            recommendation = 'Redis not properly initialized';
        }
    }
    
    console.log('🔍 Debug endpoint called:', config);
    
    res.json({
        success: true,
        config: config,
        recommendation: recommendation
    });
});

// Redis重试端点
app.post('/api/retry-redis', async (req, res) => {
    try {
        console.log('🔄 Manual Redis retry requested...');
        
        // 首先尝试简单重试
        let success = await storage.retryRedisConnection();
        
        // 如果简单重试失败，尝试重新初始化
        if (!success) {
            console.log('🔄 Simple retry failed, attempting reinitialization...');
            await storage.reinitializeRedis();
            success = true;
        }
        
        if (success) {
            res.json({
                success: true,
                message: 'Redis连接已恢复',
                redisReady: true
            });
        } else {
            res.json({
                success: false,
                message: 'Redis连接重试失败，请检查环境配置',
                redisReady: false
            });
        }
    } catch (error) {
        console.error('❌ Redis retry error:', error);
        res.status(500).json({
            success: false,
            message: 'Redis重试失败: ' + error.message
        });
    }
});

// 从Blob恢复数据端点
app.post('/api/recover-from-blob', async (req, res) => {
    try {
        console.log('🔄 Attempting to recover data from Blob storage...');
        
        if (!storage.isReady || !storage.blobAPI) {
            return res.status(503).json({
                success: false,
                message: 'Blob存储不可用'
            });
        }
        
        // 列出所有Blob中的图片
        const { blobs } = await storage.blobAPI.list({ prefix: 'photos/' });
        console.log(`📋 Found ${blobs.length} images in Blob storage`);
        
        if (blobs.length === 0) {
            return res.json({
                success: true,
                message: 'Blob存储中没有找到图片',
                recovered: 0
            });
        }
        
        // 将Blob数据转换为照片记录
        const photos = blobs.map((blob, index) => {
            const filename = blob.pathname.split('/').pop();
            const id = filename ? filename.split('.')[0] : `recovered-${index}`;
            
            return {
                id: id,
                title: `恢复的图片 ${index + 1}`,
                description: '从Blob存储恢复的图片',
                url: blob.url,
                uploadDate: blob.uploadedAt || new Date().toISOString(),
                originalName: filename || 'recovered.jpg',
                size: blob.size || 0
            };
        });
        
        // 尝试保存到Redis
        if (storage.redisReady) {
            await storage.savePhotos(photos);
            console.log(`✅ Successfully recovered ${photos.length} photos to Redis`);
            
            res.json({
                success: true,
                message: `成功从Blob恢复 ${photos.length} 张图片到Redis`,
                recovered: photos.length,
                photos: photos
            });
        } else {
            console.warn('⚠️ Redis not ready, cannot save recovered data');
            res.json({
                success: false,
                message: 'Redis不可用，无法保存恢复的数据',
                recovered: 0,
                foundInBlob: photos.length,
                photos: photos
            });
        }
        
    } catch (error) {
        console.error('❌ Recovery error:', error);
        res.status(500).json({
            success: false,
            message: '恢复失败: ' + error.message
        });
    }
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
