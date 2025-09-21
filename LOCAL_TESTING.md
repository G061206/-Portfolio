# 本地测试指南

## 📋 准备工作

### 1. 安装 Node.js
确保你的系统已安装 Node.js (版本 18 或更高)：
```bash
node --version
npm --version
```

如果没有安装，请从 [Node.js 官网](https://nodejs.org/) 下载安装。

### 2. 安装项目依赖
在项目根目录运行：
```bash
npm install
```

## 🚀 启动本地开发服务器

### 方式一：使用 Node.js 直接运行 (推荐)
```bash
# 启动服务器
npm run dev
```

### 方式二：使用 Vercel CLI
```bash
# 安装 Vercel CLI (如果还没安装)
npm install -g vercel

# 启动本地开发服务器
npm run vercel-dev
# 或者直接运行
vercel dev
```

**注意**: 如果遇到 "recursive invocation" 错误，请使用方式一。

## 🌐 访问测试

### 本地地址
服务器启动后，通常会运行在：
- **主地址**: http://localhost:3000
- **管理后台**: http://localhost:3000/admin

### 测试页面
1. **主页测试** - 访问 http://localhost:3000
   - 检查页面布局是否正常
   - 验证响应式设计
   - 测试导航功能

2. **后台测试** - 访问 http://localhost:3000/admin
   - 使用密码 `602160` 登录
   - 测试文件上传功能
   - 验证图片管理功能

## 🧪 功能测试清单

### 前端功能测试
- [ ] 页面正常加载
- [ ] 响应式布局在不同屏幕尺寸下正常
- [ ] 导航链接平滑滚动
- [ ] 图片懒加载功能
- [ ] 模态框显示和关闭
- [ ] 移动端触摸操作

### 后台功能测试
- [ ] 登录页面显示正常
- [ ] 密码验证功能 (正确密码: 602160)
- [ ] 错误密码提示
- [ ] 文件选择和预览
- [ ] 图片上传功能
- [ ] 作品列表显示
- [ ] 删除功能
- [ ] 退出登录

### API 接口测试
```bash
# 测试获取照片列表
curl http://localhost:3000/api/photos

# 测试登录接口
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"602160"}'
```

## 📱 响应式测试

### 浏览器开发者工具测试
1. 打开浏览器开发者工具 (F12)
2. 点击设备模拟器图标
3. 测试不同设备尺寸：
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - iPad (768x1024)
   - iPad Pro (1024x1366)
   - Desktop (1920x1080)

### 测试要点
- 导航菜单在小屏幕上的显示
- 图片网格布局的响应性
- 文字大小和间距
- 按钮和链接的可点击性
- 模态框在移动设备上的显示

## 🔍 调试技巧

### 查看服务器日志
```bash
# Vercel CLI 会显示详细日志
vercel dev --debug
```

### 浏览器调试
1. 打开开发者工具 (F12)
2. 查看 Console 面板了解 JavaScript 错误
3. 查看 Network 面板监控 API 请求
4. 使用 Elements 面板检查 CSS 样式

### 常见问题排查

**问题：页面无法加载**
```bash
# 检查端口是否被占用
netstat -ano | findstr :3000

# 尝试使用不同端口
vercel dev --listen 3001
```

**问题：API 请求失败**
- 检查 `api/index.js` 文件是否存在
- 确认端口配置正确
- 查看服务器控制台错误信息

**问题：文件上传失败**
- 确认选择的是图片文件
- 检查文件大小 (不超过10MB)
- 查看浏览器网络请求是否正常

## 📂 文件结构检查

确保以下文件存在且内容正确：
```
项目根目录/
├── api/
│   ├── index.js ✓
│   ├── auth.js ✓
│   └── photos.js ✓
├── public/
│   ├── index.html ✓
│   ├── admin.html ✓
│   ├── styles.css ✓
│   ├── admin-styles.css ✓
│   ├── script.js ✓
│   └── admin-script.js ✓
├── package.json ✓
├── vercel.json ✓
└── node_modules/ ✓ (运行 npm install 后)
```

## 🔧 开发工具推荐

### VS Code 扩展
- Live Server - 实时预览
- Prettier - 代码格式化
- ESLint - 代码检查
- Auto Rename Tag - HTML 标签同步重命名

### 浏览器工具
- Chrome DevTools
- Firefox Developer Tools
- 响应式设计模式

## 📊 性能测试

### 图片加载测试
1. 上传不同大小的图片
2. 检查压缩效果
3. 验证懒加载功能

### 网络测试
1. 在开发者工具中模拟慢速网络
2. 测试加载状态显示
3. 验证错误处理

## 🔄 热重载

使用 Vercel CLI 时，文件更改会自动重新加载：
- 修改前端文件 (HTML/CSS/JS) 会立即生效
- 修改 API 文件需要重启服务器

## 📝 测试日志

建议创建测试记录：
```markdown
## 测试记录 - [日期]

### 功能测试
- [x] 主页加载
- [x] 后台登录
- [x] 图片上传
- [ ] 响应式布局

### 发现问题
1. 问题描述
2. 复现步骤
3. 解决方案

### 待优化
1. 加载速度
2. 用户体验
```

## 🛠️ 故障排除

### 重置开发环境
```bash
# 清理依赖重新安装
rm -rf node_modules
npm install

# 清理 Vercel 缓存
vercel dev --debug
```

### 检查端口占用 (Windows)
```cmd
netstat -ano | findstr :3000
taskkill /PID [PID号] /F
```

### 检查端口占用 (macOS/Linux)
```bash
lsof -ti:3000
kill -9 [PID号]
```

## 📋 上线前检查清单

- [ ] 所有功能正常工作
- [ ] 响应式设计完美
- [ ] 图片上传和压缩正常
- [ ] 后台管理功能完整
- [ ] 没有控制台错误
- [ ] 性能表现良好
- [ ] 安全性验证通过

完成本地测试后，就可以安全地部署到 Vercel 了！
