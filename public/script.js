// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    loadGallery();
    setupModal();
    setupSmoothScrolling();
});

// 加载作品展示
async function loadGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    
    try {
        const response = await fetch('/api/photos');
        
        if (!response.ok) {
            throw new Error('Failed to load photos');
        }
        
        const photos = await response.json();
        
        if (photos.length === 0) {
            galleryGrid.innerHTML = '<div class="loading">暂无作品，请稍后再来查看</div>';
            return;
        }
        
        galleryGrid.innerHTML = '';
        
        photos.forEach(photo => {
            const galleryItem = createGalleryItem(photo);
            galleryGrid.appendChild(galleryItem);
        });
        
    } catch (error) {
        console.error('Error loading gallery:', error);
        galleryGrid.innerHTML = '<div class="loading">加载失败，请刷新页面重试</div>';
    }
}

// 创建作品展示项
function createGalleryItem(photo) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.setAttribute('data-photo', JSON.stringify(photo));
    
    item.innerHTML = `
        <img src="${photo.url}" alt="${photo.title}" loading="lazy">
        <div class="gallery-item-content">
            <h3 class="gallery-item-title">${photo.title}</h3>
            <p class="gallery-item-description">${photo.description || '暂无描述'}</p>
        </div>
    `;
    
    // 添加点击事件
    item.addEventListener('click', () => openModal(photo));
    
    return item;
}

// 设置模态框
function setupModal() {
    const modal = document.getElementById('imageModal');
    const closeBtn = document.getElementById('closeModal');
    
    // 关闭模态框
    closeBtn.addEventListener('click', closeModal);
    
    // 点击背景关闭模态框
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// 打开模态框
function openModal(photo) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    
    modalImage.src = photo.url;
    modalImage.alt = photo.title;
    modalTitle.textContent = photo.title;
    modalDescription.textContent = photo.description || '暂无描述';
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // 恢复滚动
}

// 设置平滑滚动
function setupSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// 图片加载错误处理
document.addEventListener('error', function(e) {
    if (e.target.tagName === 'IMG') {
        e.target.style.display = 'none';
        const parent = e.target.closest('.gallery-item');
        if (parent) {
            parent.style.opacity = '0.5';
        }
    }
}, true);

// 响应式图片懒加载优化
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    });
    
    // 当新图片加载时应用懒加载
    const observeImages = () => {
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => imageObserver.observe(img));
    };
    
    // 初始观察
    observeImages();
}
