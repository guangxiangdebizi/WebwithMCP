// chat.js - 聊天界面逻辑
class ChatApp {
    constructor() {
        this.wsManager = new WebSocketManager();
        this.currentAIMessage = null; // 当前正在接收的AI消息
        this.currentAIContent = ''; // 当前AI消息的累积内容
        this.thinkingFlow = new ThinkingFlow(this); // 思维流管理器
        this.sessionId = null; // 当前会话ID，由后端分配
        
        // DOM 元素
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.connectionText = document.getElementById('connectionText');
        this.charCount = document.getElementById('charCount');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        this.init();
    }
    
    async init() {
        try {
            // 首先确保配置已加载
            this.showLoading('正在加载配置文件...');
            
            if (!window.configManager.isLoaded) {
                await window.configManager.loadConfig();
            }
            
            // 配置加载成功后再初始化其他组件
            this.setupEventListeners();
            this.setupWebSocket();
            await this.connectWebSocket();
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.hideLoading();
            // 配置加载失败时，错误已经在configManager中显示，这里不需要额外处理
        }
    }
    
    setupEventListeners() {
        // 发送按钮点击
        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // 输入框事件
        this.messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.adjustInputHeight();
            this.updateSendButton();
        });
        
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) {
                    // Shift + Enter 换行
                    return;
                } else {
                    // Enter 发送
                    e.preventDefault();
                    this.sendMessage();
                }
            }
        });
        
        // 清空聊天
        this.clearChatBtn.addEventListener('click', () => {
            this.clearChat();
        });
        
        // 初始化分享模块
        this.shareModule = new ShareModule(this);
        
        // 页面卸载时关闭连接
        window.addEventListener('beforeunload', () => {
            this.wsManager.close();
        });
    }
    
    setupWebSocket() {
        // WebSocket 事件回调
        this.wsManager.onOpen = () => {
            this.updateConnectionStatus('online');
            this.hideLoading();
        };
        
        this.wsManager.onMessage = (data) => {
            this.handleWebSocketMessage(data);
        };
        
        this.wsManager.onClose = () => {
            this.updateConnectionStatus('offline');
        };
        
        this.wsManager.onError = () => {
            this.updateConnectionStatus('offline');
            this.showError('WebSocket 连接错误');
        };
        
        this.wsManager.onReconnecting = (attempt, maxAttempts) => {
            this.updateConnectionStatus('connecting');
            this.showStatus(`正在重连... (${attempt}/${maxAttempts})`);
        };
    }
    
    async connectWebSocket() {
        this.showLoading('正在连接服务器...');
        this.updateConnectionStatus('connecting');
        await this.wsManager.connect();
    }
    
    handleWebSocketMessage(data) {
        console.log('📨 收到消息:', data);
        
        switch (data.type) {
            case 'session_info':
                // 接收会话ID
                this.sessionId = data.session_id;
                console.log('🆔 收到会话ID:', this.sessionId);
                break;
                
            case 'user_msg_received':
                // 用户消息已收到确认
                break;
                
            case 'status':
                // 移除硬编码的status处理，让AI思考内容自然显示
                break;
                
            case 'ai_thinking_start':
                // 开始AI思考流式显示
                this.thinkingFlow.startThinkingContent(data.iteration);
                break;
                
            case 'ai_thinking_chunk':
                // AI思考内容片段
                this.thinkingFlow.appendThinkingContent(data.content, data.iteration);
                break;
                
            case 'ai_thinking_end':
                // 结束AI思考
                this.thinkingFlow.endThinkingContent(data.iteration);
                break;
                
            case 'tool_plan':
                this.thinkingFlow.updateThinkingStage(
                    'tools_planned', 
                    `决定使用 ${data.tool_count} 个工具`, 
                    '准备执行工具调用...',
                    { toolCount: data.tool_count }
                );
                break;
                
            case 'tool_start':
                this.thinkingFlow.addToolToThinking(data);
                break;
                
            case 'tool_end':
                this.thinkingFlow.updateToolInThinking(data, 'completed');
                break;
                
            case 'tool_error':
                this.thinkingFlow.updateToolInThinking(data, 'error');
                break;
                
            case 'ai_response_start':
                this.thinkingFlow.updateThinkingStage('responding', '准备回答', '正在整理回复内容...');
                
                // 确保思维流可见 - 滚动到思维流位置
                const currentFlow = this.thinkingFlow.getCurrentFlow();
                if (currentFlow) {
                    // 轻微延迟确保DOM更新完成
                    setTimeout(() => {
                        currentFlow.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start',
                            inline: 'nearest'
                        });
                    }, 100);
                }

                this.startAIResponse();
                break;
                
            case 'ai_response_chunk':
                this.appendAIResponse(data.content);
                break;
                
            case 'ai_response_end':
                this.endAIResponse();
                this.thinkingFlow.completeThinkingFlow('success');
                break;
                
            case 'error':
                this.showError(data.content);
                this.thinkingFlow.completeThinkingFlow('error');
                break;
                
            default:
                console.warn('未知消息类型:', data.type);
        }
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.wsManager.isConnected()) {
            return;
        }

        // 显示用户消息
        this.addUserMessage(message);
        
        // 清空输入框并重置状态
        this.messageInput.value = '';
        this.updateCharCount();
        this.adjustInputHeight();
        this.updateSendButton();

        // 隐藏欢迎消息
        this.hideWelcomeMessage();

        // 创建思维流
        this.thinkingFlow.createThinkingFlow();

        // 发送到服务器
        const success = this.wsManager.send({
            type: 'user_msg',
            content: message
        });
        
        if (!success) {
            this.showError('发送消息失败，请检查网络连接');
            this.thinkingFlow.completeThinkingFlow('error');
        }
    }
    
    addUserMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        
        // 尝试渲染markdown，如果失败则使用原始文本
        let renderedContent;
        try {
            if (typeof marked !== 'undefined') {
                renderedContent = marked.parse(content);
            } else {
                renderedContent = this.escapeHtml(content);
            }
        } catch (error) {
            console.warn('用户消息Markdown渲染错误:', error);
            renderedContent = this.escapeHtml(content);
        }
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${renderedContent}
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showStatus(content) {
        // 可以在这里显示状态信息，暂时用console.log
        console.log('📊 状态:', content);
    }
    











    
    startAIResponse() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        messageDiv.innerHTML = `
            <div class="message-bubble">
                <span class="ai-cursor">▋</span>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.currentAIMessage = messageDiv.querySelector('.message-bubble');
        this.currentAIContent = ''; // 重置累积内容
        this.scrollToBottom();
    }
    
    appendAIResponse(content) {
        if (this.currentAIMessage) {
            // 累积内容
            this.currentAIContent += content;
            
            // 实时渲染markdown
            this.renderMarkdownContent();
            
            this.scrollToBottom();
        }
    }
    
    endAIResponse() {
        if (this.currentAIMessage) {
            // 最终渲染markdown（确保所有内容都被处理）
            this.renderMarkdownContent(true);
            
            // 移除光标
            const cursor = this.currentAIMessage.querySelector('.ai-cursor');
            if (cursor) {
                cursor.remove();
            }
            
            this.currentAIMessage = null;
            this.currentAIContent = '';
        }
    }
    
    // 实时markdown渲染方法
    renderMarkdownContent(isFinal = false) {
        if (!this.currentAIMessage || typeof marked === 'undefined') {
            // 如果marked.js未加载，使用原始文本显示
            this.currentAIMessage.innerHTML = this.escapeHtml(this.currentAIContent) + 
                (!isFinal ? '<span class="ai-cursor">▋</span>' : '');
            return;
        }
        
        try {
            let content = this.currentAIContent;
            let renderedContent = '';
            
            if (isFinal) {
                // 最终渲染，直接处理所有内容
                renderedContent = marked.parse(content);
            } else {
                // 实时渲染，需要智能处理不完整的markdown
                renderedContent = this.renderPartialMarkdown(content);
            }
            
            // 更新内容并添加光标
            this.currentAIMessage.innerHTML = renderedContent + 
                (!isFinal ? '<span class="ai-cursor">▋</span>' : '');
                
        } catch (error) {
            console.warn('Markdown渲染错误:', error);
            // 出错时使用原始文本
            this.currentAIMessage.innerHTML = this.escapeHtml(this.currentAIContent) + 
                (!isFinal ? '<span class="ai-cursor">▋</span>' : '');
        }
    }
    
    // 渲染部分markdown内容（处理不完整的语法）
    renderPartialMarkdown(content) {
        // 检测可能不完整的markdown模式
        const patterns = [
            { regex: /```[\s\S]*?```/g, type: 'codeblock' },  // 代码块
            { regex: /`[^`\n]*`/g, type: 'code' },            // 行内代码
            { regex: /\*\*[^*\n]*\*\*/g, type: 'bold' },      // 粗体
            { regex: /\*[^*\n]*\*/g, type: 'italic' },        // 斜体
            { regex: /^#{1,6}\s+.*/gm, type: 'heading' },     // 标题
            { regex: /^\*.+$/gm, type: 'list' },              // 列表
            { regex: /^\d+\..+$/gm, type: 'orderedlist' },    // 有序列表
            { regex: /^>.+$/gm, type: 'quote' }               // 引用
        ];
        
        let processedContent = content;
        let lastCompletePos = 0;
        
        // 找到最后一个完整的markdown元素位置
        for (let pattern of patterns) {
            const matches = [...content.matchAll(pattern.regex)];
            for (let match of matches) {
                const endPos = match.index + match[0].length;
                if (this.isCompleteMarkdown(match[0], pattern.type)) {
                    lastCompletePos = Math.max(lastCompletePos, endPos);
                }
            }
        }
        
        if (lastCompletePos > 0) {
            // 分割内容：完整部分用markdown渲染，不完整部分用原始文本
            const completeContent = content.substring(0, lastCompletePos);
            const incompleteContent = content.substring(lastCompletePos);
            
            const renderedComplete = marked.parse(completeContent);
            const escapedIncomplete = this.escapeHtml(incompleteContent);
            
            return renderedComplete + escapedIncomplete;
        } else {
            // 没有完整的markdown，使用原始文本
            return this.escapeHtml(content);
        }
    }
    
    // 检查markdown元素是否完整
    isCompleteMarkdown(text, type) {
        switch (type) {
            case 'codeblock':
                return text.startsWith('```') && text.endsWith('```') && text.length > 6;
            case 'code':
                return text.startsWith('`') && text.endsWith('`') && text.length > 2;
            case 'bold':
                return text.startsWith('**') && text.endsWith('**') && text.length > 4;
            case 'italic':
                return text.startsWith('*') && text.endsWith('*') && text.length > 2 && !text.startsWith('**');
            case 'heading':
                return text.match(/^#{1,6}\s+.+$/);
            case 'list':
                return text.match(/^\*\s+.+$/);
            case 'orderedlist':
                return text.match(/^\d+\.\s+.+$/);
            case 'quote':
                return text.match(/^>\s*.+$/);
            default:
                return true;
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message ai';
        errorDiv.innerHTML = `
            <div class="message-bubble" style="background: rgba(245, 101, 101, 0.1); border-color: rgba(245, 101, 101, 0.3); color: #e53e3e;">
                ❌ ${this.escapeHtml(message)}
            </div>
        `;
        
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
    }
    
    clearChat() {
        // 清空消息区域，保留欢迎消息
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        this.chatMessages.innerHTML = '';
        
        if (welcomeMessage) {
            this.chatMessages.appendChild(welcomeMessage);
            welcomeMessage.style.display = 'block';
        }
        
        // 清理状态
        this.currentAIMessage = null;
        this.thinkingFlow.clear(); // 清理思维流状态
        
        // 调用API清空后端历史
        try {
            // 确保配置已加载
            if (!window.configManager.isLoaded) {
                console.warn('⚠️ 配置未加载，无法清空服务器历史');
                return;
            }
            
            // 构建API URL，如果有会话ID则传递
            let apiUrl = window.configManager.getFullApiUrl('/api/history');
            if (this.sessionId) {
                apiUrl += `?session_id=${encodeURIComponent(this.sessionId)}`;
                console.log('🗑️ 清空当前会话历史:', this.sessionId);
            } else {
                console.log('🗑️ 清空所有历史（无会话ID）');
            }
            
            fetch(apiUrl, {
                method: 'DELETE'
            }).catch(error => {
                console.warn('清空服务器历史失败:', error);
            });
        } catch (error) {
            console.error('❌ 无法获取API URL，清空历史失败:', error);
        }
    }
    
    hideWelcomeMessage() {
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }
    
    updateConnectionStatus(status) {
        this.connectionStatus.className = `status-dot ${status}`;
        
        switch (status) {
            case 'online':
                this.connectionText.textContent = '在线';
                break;
            case 'offline':
                this.connectionText.textContent = '离线';
                break;
            case 'connecting':
                this.connectionText.textContent = '连接中';
                break;
        }
    }
    
    updateCharCount() {
        const count = this.messageInput.value.length;
        this.charCount.textContent = count;
        
        if (count > 1800) {
            this.charCount.style.color = '#e53e3e';
        } else if (count > 1500) {
            this.charCount.style.color = '#ed8936';
        } else {
            this.charCount.style.color = '#a0aec0';
        }
    }
    
    adjustInputHeight() {
        // 保存滚动位置
        const scrollTop = this.messageInput.scrollTop;
        
        // 重置高度
        this.messageInput.style.height = 'auto';
        
        // 设置新高度
        const newHeight = Math.min(this.messageInput.scrollHeight, 150);
        this.messageInput.style.height = newHeight + 'px';
        
        // 恢复滚动位置
        this.messageInput.scrollTop = scrollTop;
        
        // 如果内容超出了可视区域，滚动到底部
        if (this.messageInput.scrollHeight > newHeight) {
            this.messageInput.scrollTop = this.messageInput.scrollHeight;
        }
    }
    
    updateSendButton() {
        const hasText = this.messageInput.value.trim().length > 0;
        const isConnected = this.wsManager.isConnected();
        
        this.sendBtn.disabled = !hasText || !isConnected;
    }
    
    scrollToBottom() {
        // 使用requestAnimationFrame确保DOM更新完成后再滚动
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
    }
    
    showLoading(text = '加载中...') {
        this.loadingOverlay.style.display = 'flex';
        this.loadingOverlay.querySelector('div').textContent = text;
    }
    
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
    
    escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }
        return text.toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
    }
}
// 实例化并初始化
const chatApp = new ChatApp();