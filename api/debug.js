// 调试端点 - 检查环境配置
module.exports = async (req, res) => {
    const isVercel = process.env.VERCEL === '1';
    
    const config = {
        environment: isVercel ? 'vercel' : 'local',
        vercelEnv: process.env.VERCEL_ENV || 'not-set',
        hasBlob: !!process.env.BLOB_READ_WRITE_TOKEN,
        hasRedis: !!process.env.REDIS_URL,
        blobToken: process.env.BLOB_READ_WRITE_TOKEN ? 
            process.env.BLOB_READ_WRITE_TOKEN.substring(0, 20) + '...' : 'not-set',
        redisUrl: process.env.REDIS_URL ? 
            process.env.REDIS_URL.substring(0, 30) + '...' : 'not-set',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    };
    
    // 检查旧的 KV 变量
    const oldKV = {
        hasKvUrl: !!process.env.KV_REST_API_URL,
        hasKvToken: !!process.env.KV_REST_API_TOKEN
    };
    
    if (oldKV.hasKvUrl || oldKV.hasKvToken) {
        config.warning = 'Old KV environment variables detected';
        config.oldKV = oldKV;
    }
    
    console.log('🔍 Debug endpoint called:', config);
    
    res.json({
        success: true,
        config: config,
        recommendation: config.hasBlob && config.hasRedis ? 
            'Configuration looks good' :
            'Missing required environment variables'
    });
};
