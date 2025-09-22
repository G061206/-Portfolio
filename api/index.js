const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// Blob存储管理类
class BlobStorageManager {
    constructor() {
        this.blobAPI = null;
        this.isReady = false;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Blob storage...');
            
            const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
            if (!blobToken) {
                throw new Error('BLOB_READ_WRITE_TOKEN environment variable not found');
            }

            // 动态导入Vercel Blob API
            const { put, del, list } = await import('@vercel/blob');
            this.blobAPI = { put, del, list };
            
            this.isReady = true;
            console.log('✅ Blob storage initialized successfully');
            
        } catch (error) {
            console.error('❌ Blob storage initialization failed:', error.message);
            throw error;
        }
    }

    // 上传图片到Blob，包含元数据
    async uploadImage(buffer, metadata) {
        if (!this.isReady) throw new Error('Blob storage not initialized');
        
        try {
            const { id, title, description, originalName } = metadata;
            const timestamp = Date.now();
            const filename = `photos/${timestamp}-${id}.jpg`;
            
            console.log(`📤 Uploading image: ${filename}, Size: ${buffer.length} bytes`);
            
            const blob = await this.blobAPI.put(filename, buffer, {
                access: 'public',
                contentType: 'image/jpeg',
                // 将元数据存储在Blob的customMetadata中
                addRandomSuffix: false,
                metadata: {
                    title: title,
                    description: description || '',
                    originalName: originalName,
                    uploadDate: new Date().toISOString(),
                    id: id
                }
            });
            
            console.log(`✅ Image uploaded: ${blob.url}`);
            return {
                url: blob.url,
                pathname: blob.pathname,
                metadata: metadata
            };
        } catch (error) {
            console.error('❌ Image upload failed:', error.message);
            throw new Error('Failed to upload image to storage');
        }
    }

    // 获取所有照片列表
    async getPhotos() {
        if (!this.isReady) throw new Error('Blob storage not initialized');
        
        try {
            console.log('📋 Fetching photos from Blob storage...');
            
            // 列出所有photos/目录下的文件
            const { blobs } = await this.blobAPI.list({ 
                prefix: 'photos/',
                limit: 1000  // 限制返回数量
            });
            
            console.log(`📊 Found ${blobs.length} blobs in storage`);
            
            // 转换为照片对象并按时间戳排序
            const photos = blobs
                .map(blob => {
                    // 从文件名提取时间戳和ID
                    const filename = blob.pathname.split('/').pop();
                    const parts = filename.split('-');
                    const timestamp = parts[0];
                    const id = parts.slice(1).join('-').replace('.jpg', '');
                    
                    return {
                        id: id,
                        title: blob.metadata?.title || `照片 ${id.substring(0, 8)}`,
                        description: blob.metadata?.description || '',
                        url: blob.url,
                        uploadDate: blob.metadata?.uploadDate || blob.uploadedAt,
                        originalName: blob.metadata?.originalName || filename,
                        size: blob.size,
                        timestamp: parseInt(timestamp) || 0
                    };
                })
                .sort((a, b) => b.timestamp - a.timestamp); // 按时间戳降序排列
            
            console.log(`✅ Processed ${photos.length} photos`);
            return photos;
            
        } catch (error) {
            console.error('❌ Error fetching photos:', error.message);
            throw new Error('Failed to fetch photos from storage');
        }
    }

    // 删除图片
    async deleteImage(photoId) {
        if (!this.isReady) throw new Error('Blob storage not initialized');
        
        try {
            console.log(`🗑️ Deleting photo: ${photoId}`);
            
            // 首先找到对应的blob
            const { blobs } = await this.blobAPI.list({ prefix: 'photos/' });
            const targetBlob = blobs.find(blob => {
                const filename = blob.pathname.split('/').pop();
                return filename.includes(photoId);
            });
            
            if (!targetBlob) {
                throw new Error('Photo not found');
            }
            
            await this.blobAPI.del(targetBlob.url);
            console.log(`✅ Photo deleted: ${photoId}`);
            
        } catch (error) {
            console.error('❌ Image deletion failed:', error.message);
            throw new Error('Failed to delete image');
        }
    }

    // 获取单个照片信息
    async getPhoto(photoId) {
        const photos = await this.getPhotos();
        return photos.find(photo => photo.id === photoId);
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
const storage = new BlobStorageManager();

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
        
        // 生成唯一ID
        const photoId = uuidv4();
        
        // 处理图片
        const processedBuffer = await ImageProcessor.processImage(req.file.buffer);
        
        // 准备元数据
        const metadata = {
            id: photoId,
            title: title.trim(),
            description: description ? description.trim() : '',
            originalName: req.file.originalname
        };
        
        // 上传到Blob存储
        const result = await storage.uploadImage(processedBuffer, metadata);
        
        // 创建照片记录
        const photo = {
            id: photoId,
            title: metadata.title,
            description: metadata.description,
            url: result.url,
            uploadDate: new Date().toISOString(),
            originalName: metadata.originalName,
            size: processedBuffer.length
        };
        
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
        
        // 删除图片
        await storage.deleteImage(photoId);
        
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
        const photo = await storage.getPhoto(photoId);
        
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
        environment: 'vercel-blob-only',
        vercelEnv: process.env.VERCEL_ENV || 'development',
        hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
        storageReady: storage.isReady,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    };
    
    // 检查环境变量详情
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        config.blobToken = process.env.BLOB_READ_WRITE_TOKEN.substring(0, 20) + '...';
    }
    
    // 实时测试Blob连接
    if (storage.blobAPI && process.env.BLOB_READ_WRITE_TOKEN) {
        try {
            const { blobs } = await storage.blobAPI.list({ limit: 1 });
            config.blobTestResult = 'connection_ok';
            config.totalBlobs = blobs.length;
        } catch (error) {
            config.blobTestResult = 'connection_failed';
            config.blobError = error.message;
        }
    } else {
        config.blobTestResult = 'not_initialized';
    }
    
    // 分析状态
    let recommendation = 'Configuration issues detected';
    if (config.hasBlob && config.storageReady) {
        if (config.blobTestResult === 'connection_ok') {
            recommendation = 'All systems operational - Blob-only storage ready';
        } else {
            recommendation = 'Blob connection failed - check token';
        }
    }
    
    console.log('🔍 Debug endpoint called:', config);
    
    res.json({
        success: true,
        config: config,
        recommendation: recommendation
    });
});

// 存储统计端点
app.get('/api/stats', requireStorage, async (req, res) => {
    try {
        const photos = await storage.getPhotos();
        const totalSize = photos.reduce((sum, photo) => sum + (photo.size || 0), 0);
        
        res.json({
            success: true,
            stats: {
                totalPhotos: photos.length,
                totalSize: totalSize,
                totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                oldestPhoto: photos.length > 0 ? photos[photos.length - 1].uploadDate : null,
                newestPhoto: photos.length > 0 ? photos[0].uploadDate : null
            }
        });
    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({
            success: false,
            message: '获取统计信息失败'
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
        console.log('🎉 Blob-only application ready!');
    } catch (error) {
        console.error('💥 Application initialization failed:', error.message);
        console.error('Please check your Vercel Blob configuration');
    }
}

// 启动初始化（在Vercel环境中会自动执行）
initializeApp();

// 本地开发服务器
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📸 Photography Portfolio - Blob-Only Edition`);
        console.log(`👉 Main site: http://localhost:${PORT}`);
        console.log(`🔧 Admin panel: http://localhost:${PORT}/admin`);
        console.log(`🔑 Admin password: 602160`);
        console.log(`🔍 Debug info: http://localhost:${PORT}/api/debug`);
        console.log(`📊 Stats: http://localhost:${PORT}/api/stats`);
    });
}

module.exports = app;
