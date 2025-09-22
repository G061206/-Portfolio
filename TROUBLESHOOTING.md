# 故障排除指南

## 🚨 上传失败问题诊断

### 常见错误和解决方案

#### 1. "Storage services not available"
**原因**: Vercel Blob 或 KV 服务未正确配置

**解决步骤**:
1. 检查 Vercel Dashboard → Project → Settings → Environment Variables
2. 确认以下变量已设置:
   ```
   BLOB_READ_WRITE_TOKEN=your_token
   KV_REST_API_URL=your_kv_url  
   KV_REST_API_TOKEN=your_kv_token
   ```
3. 重新部署项目

#### 2. "存储访问令牌无效"
**原因**: BLOB_READ_WRITE_TOKEN 错误或过期

**解决步骤**:
1. 进入 Vercel Dashboard → Storage → Blob
2. 重新生成访问令牌
3. 更新环境变量
4. 重新部署

#### 3. "存储空间不足"
**原因**: Vercel Blob 配额用完

**解决步骤**:
1. 检查 Vercel Dashboard → Storage → 使用量
2. 删除不需要的文件或升级套餐
3. 或使用其他存储方案

## 🔍 快速诊断

### 检查 Vercel 日志
1. 进入 Vercel Dashboard → Project → Functions
2. 点击最新的函数调用
3. 查看日志输出

应该看到类似这样的日志：
```
🔍 Environment check: {
  hasBlobToken: true,
  hasKvUrl: true, 
  hasKvToken: true,
  vercelEnv: 'production'
}
✅ Vercel Blob and KV services initialized
```

如果看到 `false` 值，说明对应的环境变量未设置。

### 测试上传请求
查找这样的日志：
```
📤 Upload request received: {
  hasFile: true,
  fileSize: 123456,
  title: "测试图片",
  isVercel: true,
  hasBlobAPI: true,
  hasKvAPI: true
}
```

如果 `hasBlobAPI` 或 `hasKvAPI` 为 `false`，说明服务初始化失败。

## 🛠️ 配置 Vercel 存储服务

### 步骤1: 创建 Blob 存储
1. 登录 Vercel Dashboard
2. 选择你的项目
3. 进入 Settings → Storage
4. 点击 "Create Database"
5. 选择 "Blob"
6. 创建后复制 `BLOB_READ_WRITE_TOKEN`

### 步骤2: 创建 KV 数据库
1. 在同一个 Storage 页面
2. 再次点击 "Create Database"
3. 选择 "KV"
4. 创建后复制:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

### 步骤3: 设置环境变量
1. 进入 Settings → Environment Variables
2. 添加以下变量:

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `BLOB_READ_WRITE_TOKEN` | [从 Blob 复制] | Production, Preview |
| `KV_REST_API_URL` | [从 KV 复制] | Production, Preview |
| `KV_REST_API_TOKEN` | [从 KV 复制] | Production, Preview |

**重要**: 确保为 Production 和 Preview 环境都设置了变量。

### 步骤4: 重新部署
设置完环境变量后：
1. 进入 Deployments 页面
2. 点击最新部署的 "..." 菜单
3. 选择 "Redeploy"
4. 或者推送新的代码触发部署

## 📱 测试流程

### 1. 访问网站
- 确认主页能正常加载
- 检查是否有 JavaScript 错误

### 2. 后台登录
- 访问 `/admin`
- 使用密码 `602160` 登录
- 确认能看到上传界面

### 3. 测试上传
- 选择一张小图片 (< 1MB)
- 填写标题
- 点击上传
- 查看浏览器 Network 标签页的错误信息

### 4. 检查结果
- 上传成功应该看到成功消息
- 主页应该显示新上传的图片
- 图片 URL 应该是 `https://...vercel-storage.com/...` 格式

## 🔧 备用方案

如果 Vercel Blob 配置困难，可以临时使用以下方案：

### 方案1: 降级到 Base64 存储
```bash
# 切换到上一个版本（Base64 存储）
git checkout HEAD~1 api/index.js
git commit -m "Temporary fallback to Base64 storage"
git push origin main
```

### 方案2: 使用 Cloudinary
1. 注册 Cloudinary 账号
2. 获取 API Key 和 Secret
3. 修改代码使用 Cloudinary API

## 📞 获取帮助

如果问题仍然存在：

1. **检查 Vercel 状态页面**: https://vercel-status.com/
2. **查看 Vercel 文档**: https://vercel.com/docs/storage
3. **联系 Vercel 支持**: 通过 Dashboard 提交工单

## 🔄 常用命令

### 本地测试
```bash
# 安装依赖
npm install

# 启动本地服务器
npm run dev

# 测试本地上传（使用文件存储）
curl -X POST http://localhost:3000/api/photos \
  -F "title=测试" \
  -F "photo=@test.jpg"
```

### 查看部署日志
```bash
# 使用 Vercel CLI
vercel logs

# 或在 Dashboard 中查看
```

### 重新部署
```bash
# 强制重新部署
vercel --prod --force

# 或推送代码
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```

## ✅ 验证清单

完成配置后，确认以下项目：

- [ ] Blob 存储已创建并获得 Token
- [ ] KV 数据库已创建并获得连接信息
- [ ] 环境变量已正确设置
- [ ] 项目已重新部署
- [ ] 能够登录后台管理
- [ ] 图片上传功能正常
- [ ] 图片在主页正确显示
- [ ] 删除功能正常工作
