// share-module.js - 分享功能模块
class ShareModule {
    constructor(chatApp) {
        this.chatApp = chatApp;
        this.init();
    }
    
    init() {
        // 绑定分享按钮事件
        const shareChatBtn = document.getElementById('shareChatBtn');
        if (shareChatBtn) {
            shareChatBtn.addEventListener('click', () => this.shareChat());
        }
    }
    
    shareChat() {
        if (!this.chatApp.sessionId) {
            this.chatApp.showError('无法分享', '当前没有活跃的对话会话');
            return;
        }
        
        // 生成分享链接
        const shareUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}share.html?session=${encodeURIComponent(this.chatApp.sessionId)}`;
        
        // 显示分享对话框
        this.showShareDialog(shareUrl);
    }
    
    showShareDialog(shareUrl) {
        // 创建模态对话框
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h3>🔗 分享对话</h3>
                    <button class="share-modal-close">&times;</button>
                </div>
                <div class="share-modal-body">
                    <p>通过以下链接分享当前对话：</p>
                    <div class="share-url-container">
                        <input type="text" class="share-url-input" value="${shareUrl}" readonly>
                        <button class="share-copy-btn">复制</button>
                    </div>
                    <div class="share-notice">
                        <p><strong>注意事项：</strong></p>
                        <ul>
                            <li>分享的对话为只读模式，其他人无法在此基础上继续对话</li>
                            <li>请确保对话内容不包含敏感信息</li>
                            <li>分享链接包含完整的对话历史记录</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        // 添加模态对话框样式
        this.addShareModalStyles();
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 绑定事件
        this.bindShareModalEvents(modal, shareUrl);
        
        // 显示模态框
        setTimeout(() => modal.classList.add('show'), 10);
    }
    
    addShareModalStyles() {
        if (document.getElementById('share-modal-styles')) {
            return; // 样式已存在
        }
        
        const styles = document.createElement('style');
        styles.id = 'share-modal-styles';
        styles.textContent = `
            .share-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .share-modal.show {
                opacity: 1;
            }
            .share-modal-content {
                background: white;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                transform: translateY(-20px);
                transition: transform 0.3s ease;
            }
            .share-modal.show .share-modal-content {
                transform: translateY(0);
            }
            .share-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid #e5e7eb;
            }
            .share-modal-header h3 {
                margin: 0;
                color: #1f2937;
                font-size: 1.25rem;
            }
            .share-modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #6b7280;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s;
            }
            .share-modal-close:hover {
                background-color: #f3f4f6;
            }
            .share-modal-body {
                padding: 1.5rem;
            }
            .share-modal-body p {
                margin: 0 0 1rem 0;
                color: #374151;
            }
            .share-url-container {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1.5rem;
            }
            .share-url-input {
                flex: 1;
                padding: 0.75rem;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 0.9rem;
                background-color: #f9fafb;
                color: #374151;
            }
            .share-copy-btn {
                padding: 0.75rem 1rem;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
                white-space: nowrap;
            }
            .share-copy-btn:hover {
                background: #2563eb;
            }
            .share-copy-btn.copied {
                background: #10b981;
            }
            .share-notice {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 1rem;
            }
            .share-notice p {
                margin: 0 0 0.5rem 0;
                color: #92400e;
                font-weight: 600;
            }
            .share-notice ul {
                margin: 0;
                padding-left: 1.25rem;
                color: #92400e;
            }
            .share-notice li {
                margin-bottom: 0.25rem;
                font-size: 0.9rem;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    bindShareModalEvents(modal, shareUrl) {
        // 关闭按钮
        const closeBtn = modal.querySelector('.share-modal-close');
        closeBtn.addEventListener('click', () => this.closeShareModal(modal));
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeShareModal(modal);
            }
        });
        
        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeShareModal(modal);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // 复制按钮
        const copyBtn = modal.querySelector('.share-copy-btn');
        const urlInput = modal.querySelector('.share-url-input');
        
        copyBtn.addEventListener('click', async () => {
            try {
                // 尝试使用现代API
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(shareUrl);
                } else {
                    // 降级方案
                    urlInput.select();
                    urlInput.setSelectionRange(0, 99999); // 移动端兼容
                    document.execCommand('copy');
                }
                
                // 显示复制成功状态
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制';
                copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.classList.remove('copied');
                }, 2000);
                
            } catch (error) {
                console.error('复制失败:', error);
                this.chatApp.showError('复制失败', '请手动选择并复制链接');
            }
        });
        
        // 点击输入框全选
        urlInput.addEventListener('click', () => {
            urlInput.select();
        });
    }
    
    closeShareModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

// 导出模块
window.ShareModule = ShareModule;