# 部署说明

## Vercel 部署步骤

### 方式一：通过 Vercel CLI（推荐）

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel
   ```

4. **按照提示完成配置**
   - 选择项目名称
   - 选择团队（或个人账户）
   - 确认项目设置

5. **生产环境部署**
   ```bash
   vercel --prod
   ```

### 方式二：通过 GitHub 集成

1. **将代码推送到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```

2. **连接 Vercel**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "New Project"
   - 选择从 GitHub 导入
   - 选择你的仓库
   - 配置项目设置
   - 点击 "Deploy"

## 环境配置

### 必要的目录结构
部署后，以下目录将自动创建：
- `/data/` - 存储照片信息的JSON文件
- `/public/uploads/` - 存储上传的图片文件

### 环境变量（可选）
如果需要自定义配置，可以在 Vercel 中设置以下环境变量：

- `ADMIN_PASSWORD` - 管理后台密码（默认：602160）
- `MAX_FILE_SIZE` - 最大文件上传大小（默认：10MB）

## 域名配置

### 使用 Vercel 提供的域名
部署完成后，Vercel 会自动分配一个域名：
- `your-project-name.vercel.app`

### 绑定自定义域名
1. 在 Vercel Dashboard 中进入项目设置
2. 点击 "Domains" 标签
3. 添加你的自定义域名
4. 按照提示配置 DNS 记录

## 部署后检查

### 功能测试清单
- [ ] 主页正常显示
- [ ] 响应式设计在各种设备上正常
- [ ] 后台登录页面 (`/admin`) 可访问
- [ ] 使用密码 `602160` 可正常登录
- [ ] 图片上传功能正常
- [ ] 图片显示和模态框正常
- [ ] 图片删除功能正常

### 常见问题排查

**问题：API 接口无法访问**
- 检查 `vercel.json` 配置是否正确
- 确认 `api/index.js` 文件存在
- 查看 Vercel 函数日志

**问题：图片上传失败**
- 检查文件大小是否超过限制（10MB）
- 确认文件格式是否为图片
- 查看服务器日志了解具体错误

**问题：数据不持久化**
- Vercel 函数是无状态的，数据存储在项目文件系统中
- 如果需要持久化存储，建议集成数据库服务

## 性能优化建议

### 图片优化
- 项目已集成 Sharp 进行自动图片压缩
- 大于 1920px 宽度的图片会自动调整尺寸
- JPEG 质量设置为 85%

### CDN 加速
- Vercel 自动提供全球 CDN 加速
- 静态资源会被自动缓存

### 监控和分析
- 在 Vercel Dashboard 中查看访问统计
- 监控函数执行时间和错误率

## 维护和更新

### 代码更新
```bash
# 更新代码
git add .
git commit -m "Update description"
git push origin main

# 重新部署（如果使用 CLI）
vercel --prod
```

### 数据备份
定期下载 `/data/photos.json` 文件作为备份：
```bash
# 通过 API 接口获取数据
curl https://your-domain.com/api/photos > backup.json
```

### 清理存储
如果需要清理存储空间：
1. 登录后台管理
2. 删除不需要的照片
3. 系统会自动清理对应的文件

## 扩展功能建议

### 可能的改进方向
- 集成数据库（如 Vercel KV、Supabase）
- 添加图片标签和分类功能
- 实现图片批量上传
- 添加访问统计功能
- 集成评论系统
- 添加 SEO 优化
- 实现图片水印功能

### 集成第三方服务
- **图片存储**: Cloudinary、AWS S3
- **数据库**: Vercel KV、PlanetScale、Supabase
- **分析**: Google Analytics、Vercel Analytics
- **评论**: Disqus、Utterances
