// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

// 检查认证状态
function checkAuth() {
    const isAuthenticated = sessionStorage.getItem('authenticated') === 'true';
    
    if (isAuthenticated) {
        showAdminPanel();
        loadPhotos();
    } else {
        showLoginScreen();
    }
}

// 显示登录界面
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

// 显示管理界面
function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
}

// 设置事件监听器
function setupEventListeners() {
    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // 上传表单
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
    
    // 文件选择
    document.getElementById('photo').addEventListener('change', handleFileSelect);
    
    // 删除确认模态框
    document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
    document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('loginError');
    
    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            sessionStorage.setItem('authenticated', 'true');
            showAdminPanel();
            loadPhotos();
            errorElement.textContent = '';
        } else {
            errorElement.textContent = '密码错误，请重试';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = '登录失败，请重试';
    }
}

// 处理退出登录
function handleLogout() {
    sessionStorage.removeItem('authenticated');
    showLoginScreen();
    document.getElementById('password').value = '';
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('imagePreview');
    const fileText = document.querySelector('.file-input-text');
    
    if (file) {
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            e.target.value = '';
            return;
        }
        
        // 检查文件大小 (最大 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('图片文件不能超过 10MB');
            e.target.value = '';
            return;
        }
        
        // 显示预览
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="预览图">`;
            fileText.textContent = file.name;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
        fileText.textContent = '点击选择图片文件';
    }
}

// 处理上传
async function handleUpload(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const uploadBtn = document.getElementById('uploadBtn');
    
    // 检查认证状态
    if (sessionStorage.getItem('authenticated') !== 'true') {
        alert('请先登录');
        return;
    }
    
    // 验证必填字段
    if (!formData.get('title') || !formData.get('photo')) {
        alert('请填写标题并选择图片');
        return;
    }
    
    // 设置加载状态
    uploadBtn.disabled = true;
    uploadBtn.classList.add('loading');
    
    try {
        const response = await fetch('/api/photos', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 显示成功消息
            showMessage('✅ 作品上传成功！', 'success');
            form.reset();
            document.getElementById('imagePreview').innerHTML = '';
            document.querySelector('.file-input-text').textContent = '点击选择图片文件';
            loadPhotos(); // 重新加载作品列表
        } else {
            showMessage(`❌ 上传失败: ${result.message || '未知错误'}`, 'error');
        }
    } catch (error) {
        console.error('❌ Upload error:', error);
        if (error.message.includes('503')) {
            showMessage('❌ 存储服务不可用，请稍后重试', 'error');
        } else {
            showMessage('❌ 上传失败，请检查网络连接后重试', 'error');
        }
    } finally {
        // 恢复按钮状态
        uploadBtn.disabled = false;
        uploadBtn.classList.remove('loading');
    }
}

// 加载作品列表
async function loadPhotos() {
    const photosGrid = document.getElementById('photosGrid');
    
    // 显示加载状态
    photosGrid.innerHTML = '<div class="loading">📸 正在加载作品...</div>';
    
    try {
        const response = await fetch('/api/photos');
        
        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('存储服务暂时不可用，请稍后重试');
            }
            throw new Error(`加载失败 (${response.status})`);
        }
        
        const photos = await response.json();
        
        if (photos.length === 0) {
            photosGrid.innerHTML = '<div class="loading">📷 暂无作品，上传第一张照片吧！</div>';
            return;
        }
        
        photosGrid.innerHTML = '';
        
        photos.forEach(photo => {
            const photoItem = createPhotoItem(photo);
            photosGrid.appendChild(photoItem);
        });
        
        console.log(`✅ 已加载 ${photos.length} 张作品`);
        
    } catch (error) {
        console.error('❌ Error loading photos:', error);
        photosGrid.innerHTML = `
            <div class="loading error">
                ❌ ${error.message}
                <br><br>
                <button onclick="loadPhotos()" class="btn-primary">重新加载</button>
            </div>
        `;
    }
}

// 创建作品项目
function createPhotoItem(photo) {
    const item = document.createElement('div');
    item.className = 'photo-item';
    
    item.innerHTML = `
        <img src="${photo.url}" alt="${photo.title}" loading="lazy">
        <div class="photo-item-content">
            <h3 class="photo-item-title">${photo.title}</h3>
            <p class="photo-item-description">${photo.description || '暂无描述'}</p>
            <div class="photo-item-actions">
                <button class="btn-danger" onclick="deletePhoto('${photo.id}')">删除</button>
            </div>
        </div>
    `;
    
    return item;
}

// 删除作品变量
let photoToDelete = null;

// 删除作品
function deletePhoto(photoId) {
    photoToDelete = photoId;
    document.getElementById('deleteModal').style.display = 'block';
}

// 关闭删除确认模态框
function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    photoToDelete = null;
}

// 确认删除
async function confirmDelete() {
    if (!photoToDelete) return;
    
    // 检查认证状态
    if (sessionStorage.getItem('authenticated') !== 'true') {
        alert('请先登录');
        closeDeleteModal();
        return;
    }
    
    try {
        const response = await fetch(`/api/photos/${photoToDelete}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadPhotos(); // 重新加载作品列表
            closeDeleteModal();
        } else {
            alert(`删除失败: ${result.message || '未知错误'}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('删除失败，请重试');
    }
}

// 显示消息提示
function showMessage(message, type = 'info') {
    // 移除已存在的消息
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message-toast ${type}`;
    messageEl.textContent = message;
    
    // 添加样式
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
        ${type === 'success' ? 'background: #10b981;' : ''}
        ${type === 'error' ? 'background: #ef4444;' : ''}
        ${type === 'info' ? 'background: #3b82f6;' : ''}
    `;
    
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => messageEl.remove(), 300);
        }
    }, 3000);
}

// 添加动画样式
if (!document.querySelector('#message-animations')) {
    const style = document.createElement('style');
    style.id = 'message-animations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// 图片加载错误处理
document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.style.display = 'none';
        const parent = e.target.closest('.photo-item');
        if (parent) {
            parent.style.opacity = '0.5';
        }
    }
}, true);
