# 摄影作品集网站

一个用于展示个人摄影作品的响应式网站，具有后台管理功能。

## 功能特性

- 📸 **作品展示**: 响应式瀑布流布局展示摄影作品
- 🔒 **后台管理**: 密码保护的管理界面
- 📱 **移动端优化**: 适配各种屏幕尺寸
- 🖼️ **图片优化**: 自动压缩和尺寸调整
- 🎨 **现代设计**: 简洁美观的用户界面
- ⚡ **快速加载**: 图片懒加载和优化

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (原生)
- **后端**: Node.js, Express.js
- **图片处理**: Sharp
- **部署**: Vercel
- **存储**: Vercel Blob (图片) + Vercel KV (数据)

## 本地开发

1. 克隆项目
```bash
git clone <repository-url>
cd photography-portfolio
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 访问网站
- 主页: http://localhost:3000
- 后台管理: http://localhost:3000/admin

## 部署到 Vercel

1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 部署项目
```bash
vercel
```

3. 按照提示完成配置

## 使用说明

### 访问后台管理

1. 访问 `/admin` 路径
2. 输入管理密码: `602160`
3. 上传和管理摄影作品

### 作品上传

- 支持常见图片格式 (JPG, PNG, WebP等)
- 最大文件大小: 10MB
- 自动压缩优化图片质量
- 支持添加标题和描述

## 文件结构

```
├── api/                 # API接口
│   ├── index.js        # 主API文件
│   ├── auth.js         # 认证接口
│   └── photos.js       # 照片管理接口
├── public/             # 静态文件
│   ├── index.html      # 主页
│   ├── admin.html      # 管理页面
│   ├── styles.css      # 主页样式
│   ├── admin-styles.css # 管理页面样式
│   ├── script.js       # 主页脚本
│   ├── admin-script.js # 管理页面脚本
│   └── uploads/        # 上传的图片 (自动创建)
├── data/               # 数据存储 (自动创建)
│   └── photos.json     # 图片信息
├── package.json        # 项目配置
├── vercel.json         # Vercel配置
└── README.md          # 说明文档
```

## 自定义配置

### 修改管理密码

在 `api/index.js` 文件中修改:
```javascript
const ADMIN_PASSWORD = '你的新密码';
```

### 修改网站信息

在 `public/index.html` 中修改:
- 网站标题
- 个人介绍
- 联系方式

## 响应式设计

网站针对以下设备进行了优化:
- 桌面端 (1200px+)
- 平板 (768px - 1199px)
- 手机 (< 768px)

## 安全特性

- 管理界面密码保护
- 文件类型验证
- 文件大小限制
- 图片自动处理和优化

## 性能优化

- 图片懒加载
- 自动压缩图片
- 响应式图片显示
- 现代CSS特性

## 浏览器支持

- Chrome (推荐)
- Firefox
- Safari
- Edge

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过以下方式联系:
- Email: your-email@example.com
- GitHub: your-github-username
