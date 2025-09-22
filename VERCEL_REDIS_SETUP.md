# Vercel Redis + Blob 设置指南

## 🎉 升级说明

项目已升级使用最新的 Vercel Redis（替代已废弃的 KV）+ Blob 存储方案。

## 🔧 新的存储架构

### 存储服务
- **图片存储**: Vercel Blob（永久存储，全球CDN）
- **元数据存储**: Vercel Redis（高性能键值存储）
- **本地开发**: 文件系统（无需额外配置）

### 依赖包
- ✅ `@vercel/blob@^2.0.0` - 文件存储
- ✅ `@vercel/redis@^1.0.0` - Redis 数据存储

## 🚀 配置步骤

### 步骤1：创建 Vercel Redis 数据库

1. **访问 Vercel Dashboard**
   - 登录 https://vercel.com
   - 选择你的摄影作品集项目

2. **创建 Redis 数据库**
   - 点击 **Settings** → **Storage**
   - 点击 **Create Database**
   - 选择 **Redis**
   - 输入数据库名称（例如：`photography-redis`）
   - 选择区域（推荐选择离用户最近的区域）
   - 点击 **Create**

3. **获取连接信息**
   创建完成后，你会看到：
   ```
   REDIS_URL=redis://default:xxxxx@xxx.redis.vercel-storage.com:6379
   ```

### 步骤2：创建 Vercel Blob 存储

1. **在同一个 Storage 页面**
   - 点击 **Create Database**
   - 选择 **Blob**
   - 创建完成后复制：
   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxx
   ```

### 步骤3：配置环境变量

在 Vercel Dashboard 的项目设置中添加：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `REDIS_URL` | [从 Redis 数据库复制] | Production, Preview |
| `BLOB_READ_WRITE_TOKEN` | [从 Blob 存储复制] | Production, Preview |

**重要**: 确保为 Production 和 Preview 环境都设置了变量。

### 步骤4：重新部署

```bash
git add .
git commit -m "Upgrade from KV to Redis storage"
git push origin main
```

## 📋 环境变量清单

确保你的项目有以下环境变量：

```
REDIS_URL=redis://default:xxxxx@xxx.redis.vercel-storage.com:6379
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxx
```

## 🔍 验证部署

### 1. 检查日志
部署后查看 Functions 日志，应该看到：
```
🔍 Environment check: {
  hasBlobToken: true,
  hasRedisUrl: true,
  vercelEnv: 'production'
}
✅ Vercel Blob and Redis services initialized
```

### 2. 测试功能
- ✅ 后台登录（密码：602160）
- ✅ 图片上传成功
- ✅ 图片显示正常（CDN URL）
- ✅ 删除功能正常
- ✅ 数据持久化（重启后数据仍在）

## 🎯 新功能特性

### Redis 优势
- **高性能**: 毫秒级数据访问
- **持久化**: 数据永久保存
- **可扩展**: 支持大量并发
- **类型丰富**: 支持多种数据结构

### Blob 优势
- **全球CDN**: 图片加载速度快
- **自动优化**: 智能压缩和格式转换
- **安全可靠**: 企业级存储服务
- **成本优化**: 按使用量计费

## 📊 成本信息

### Vercel Redis
- **免费额度**: 每月 30,000 命令
- **存储**: 256MB 免费
- **超出费用**: 按使用量计费

### Vercel Blob
- **免费额度**: 每月 5GB
- **超出费用**: $0.15/GB
- **请求费用**: 免费

## 🛠️ 本地开发

本地开发无需配置 Vercel 服务：

```bash
# 启动本地服务器
npm run dev

# 本地使用文件存储
# 图片保存在: public/uploads/
# 数据保存在: data/photos.json
```

## 🔧 故障排除

### 常见错误和解决方案

#### 1. "Missing required environment variables REDIS_URL"
**解决方案**:
1. 确认 Redis 数据库已创建
2. 检查环境变量是否正确设置
3. 重新部署项目

#### 2. Redis 连接失败
**检查项目**:
1. REDIS_URL 格式是否正确
2. 数据库状态是否正常
3. 网络连接是否稳定

#### 3. 上传仍然失败
**调试步骤**:
1. 查看 Vercel Functions 日志
2. 确认 Blob Token 是否有效
3. 检查文件大小和格式

## 📈 迁移说明

### 从 KV 迁移到 Redis

如果你之前使用了 KV 存储：

1. **数据不会自动迁移**
2. **需要重新上传图片**
3. **或者手动导出/导入数据**

### 迁移脚本（可选）
如果需要数据迁移，可以创建临时脚本：

```javascript
// 迁移脚本示例
const { kv } = require('@vercel/kv');
const { Redis } = require('@vercel/redis');

async function migrateData() {
    const oldData = await kv.get('photos');
    const redis = new Redis({ url: process.env.REDIS_URL });
    await redis.set('photos', oldData);
}
```

## 🔄 监控和维护

### 使用情况监控
- Vercel Dashboard → Storage → 查看使用量
- 监控 Redis 命令数和存储使用
- 设置用量警报

### 性能优化
- Redis 支持数据压缩
- 可以使用 Redis 的数据结构优化存储
- 定期清理无用数据

## 🎊 升级完成

恭喜！你的摄影作品集现在使用了最新的 Vercel 存储方案：

- 🚀 **Redis**: 高性能数据存储
- 📸 **Blob**: 专业图片托管
- 🌍 **CDN**: 全球加速访问
- 💰 **成本优化**: 按需付费

现在可以享受更快、更稳定的服务了！
