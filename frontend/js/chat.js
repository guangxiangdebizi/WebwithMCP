// chat.js - 聊天界面逻辑
class ChatApp {
    constructor() {
        this.wsManager = new WebSocketManager();
        this.currentAIMessage = null; // 当前正在接收的AI消息
        this.currentAIContent = ''; // 当前AI消息的累积内容
        this.activeTools = new Map(); // 活跃的工具调用
        this.currentThinkingFlow = null; // 当前思维流容器
        
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
            case 'user_msg_received':
                // 用户消息已收到确认
                break;
                
            case 'status':
                if (data.content?.includes('分析')) {
                    this.updateThinkingStage('analyzing', 'AI 正在分析', data.content);
                }
                break;
                
            case 'tool_plan':
                this.updateThinkingStage(
                    'tools_planned', 
                    `决定使用 ${data.tool_count} 个工具`, 
                    '准备执行工具调用...',
                    { toolCount: data.tool_count }
                );
                break;
                
            case 'tool_start':
                this.addToolToThinking(data);
                break;
                
            case 'tool_end':
                this.updateToolInThinking(data, 'completed');
                break;
                
            case 'tool_error':
                this.updateToolInThinking(data, 'error');
                break;
                
            case 'ai_response_start':
                this.updateThinkingStage('responding', '准备回答', '正在整理回复内容...');
                
                // 确保思维流可见 - 滚动到思维流位置
                if (this.currentThinkingFlow) {
                    // 轻微延迟确保DOM更新完成
                    setTimeout(() => {
                        this.currentThinkingFlow.scrollIntoView({ 
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
                this.completeThinkingFlow('success');
                break;
                
            case 'error':
                this.showError(data.content);
                this.completeThinkingFlow('error');
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
        this.createThinkingFlow();

        // 发送到服务器
        const success = this.wsManager.send({
            type: 'user_msg',
            content: message
        });
        
        if (!success) {
            this.showError('发送消息失败，请检查网络连接');
            this.completeThinkingFlow('error');
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
    
    // 创建思维流容器
    createThinkingFlow() {
        const flowDiv = document.createElement('div');
        flowDiv.className = 'thinking-flow';
        flowDiv.id = `thinking-flow-${Date.now()}`;
        
        flowDiv.innerHTML = `
            <div class="thinking-flow-header">
                <div class="thinking-flow-title">
                    <span class="thinking-icon">🤖</span>
                    <span class="thinking-text">AI 正在思考...</span>
                </div>
                <button class="thinking-flow-toggle" onclick="chatApp.toggleThinkingFlow('${flowDiv.id}')">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div class="thinking-flow-content">
                <div class="thinking-stages">
                    <div class="thinking-stage active" data-stage="thinking">
                        <div class="stage-icon">
                            <div class="thinking-spinner"></div>
                        </div>
                        <div class="stage-content">
                            <div class="stage-title">正在分析问题</div>
                            <div class="stage-detail">理解用户需求，制定解决方案...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(flowDiv);
        this.currentThinkingFlow = flowDiv;
        this.scrollToBottom();
    }

    // 更新思维流阶段
    updateThinkingStage(stage, title, detail, data = {}) {
        if (!this.currentThinkingFlow) return;

        const stagesContainer = this.currentThinkingFlow.querySelector('.thinking-stages');
        const thinkingText = this.currentThinkingFlow.querySelector('.thinking-text');
        
        // 完成当前活跃阶段
        const activeStage = stagesContainer.querySelector('.thinking-stage.active');
        if (activeStage) {
            activeStage.classList.remove('active');
            activeStage.classList.add('completed');
            const spinner = activeStage.querySelector('.thinking-spinner');
            if (spinner) {
                spinner.outerHTML = '<span class="stage-check">✓</span>';
            }
        }

        // 更新标题
        thinkingText.textContent = title;

        // 创建新阶段
        const stageDiv = document.createElement('div');
        stageDiv.className = 'thinking-stage active';
        stageDiv.setAttribute('data-stage', stage);
        
        let iconContent = '<div class="thinking-spinner"></div>';
        if (stage === 'tools_planned') {
            iconContent = `<span class="stage-number">${data.toolCount || 1}</span>`;
        }
        
        stageDiv.innerHTML = `
            <div class="stage-icon">
                ${iconContent}
            </div>
            <div class="stage-content">
                <div class="stage-title">${title}</div>
                <div class="stage-detail">${detail}</div>
                ${stage === 'tools_planned' ? '<div class="tools-container"></div>' : ''}
            </div>
        `;
        
        stagesContainer.appendChild(stageDiv);
        this.scrollToBottom();
    }

    // 完成思维流
    completeThinkingFlow(status = 'success') {
        if (!this.currentThinkingFlow) return;

        const activeStage = this.currentThinkingFlow.querySelector('.thinking-stage.active');
        if (activeStage) {
            activeStage.classList.remove('active');
            activeStage.classList.add('completed');
            const spinner = activeStage.querySelector('.thinking-spinner');
            if (spinner) {
                spinner.outerHTML = '<span class="stage-check">✓</span>';
            }
        }

        const thinkingText = this.currentThinkingFlow.querySelector('.thinking-text');
        const flowHeader = this.currentThinkingFlow.querySelector('.thinking-flow-header');
        
        if (status === 'success') {
            thinkingText.textContent = '思考完成';
            flowHeader.classList.add('completed');
        } else {
            thinkingText.textContent = '处理出错';
            flowHeader.classList.add('error');
        }

        // 清理引用
        this.currentThinkingFlow = null;
    }

    // 添加工具到思维流
    addToolToThinking(data) {
        if (!this.currentThinkingFlow) return;

        const toolsContainer = this.currentThinkingFlow.querySelector('.tools-container');
        if (!toolsContainer) return;

        const toolDiv = document.createElement('div');
        toolDiv.className = 'thinking-tool executing';
        toolDiv.id = `thinking-tool-${data.tool_id}`;
        
        toolDiv.innerHTML = `
            <div class="tool-header">
                <div class="tool-icon">
                    <div class="tool-spinner"></div>
                </div>
                <div class="tool-info">
                    <div class="tool-name">${this.escapeHtml(data.tool_name)}</div>
                    <div class="tool-progress">准备执行</div>
                </div>
            </div>
        `;
        
        toolsContainer.appendChild(toolDiv);
        this.activeTools.set(data.tool_id, toolDiv);
        this.scrollToBottom();
    }

    // 更新思维流中的工具状态
    updateToolInThinking(data, status) {
        const toolDiv = this.activeTools.get(data.tool_id);
        if (!toolDiv) return;

        toolDiv.className = `thinking-tool ${status}`;
        
        let statusIcon = '';
        let statusText = '';
        let resultSection = '';

        if (status === 'completed') {
            statusIcon = '<span class="tool-check">✓</span>';
            statusText = '执行完成';
            
            // 添加结果显示
            const resultContent = this.formatToolResult(data.result);
            const resultLength = data.result.length;
            const resultSizeText = this.formatDataSize(resultLength);
            const isLongContent = resultLength > 200;

            resultSection = `
                <div class="tool-result-header">
                    <span class="tool-result-size">${resultSizeText}</span>
                    ${isLongContent ? `
                        <button class="tool-result-toggle" onclick="chatApp.toggleToolResult('${data.tool_id}')">
                            <span class="toggle-icon">▶</span>
                            <span>展开</span>
                        </button>
                    ` : ''}
                </div>
                <div class="tool-result-content ${isLongContent ? 'collapsed' : ''}">
                    ${resultContent}
                </div>
            `;

        } else if (status === 'error') {
            statusIcon = '<span class="tool-error">✗</span>';
            statusText = '执行失败';
            resultSection = `<div class="tool-result-content error-text">${this.escapeHtml(data.error)}</div>`;
        }
        
        toolDiv.innerHTML = `
            <div class="tool-header">
                <div class="tool-icon">${statusIcon}</div>
                <div class="tool-info">
                    <div class="tool-name">${this.escapeHtml(data.tool_name)}</div>
                    <div class="tool-progress">${statusText}</div>
                </div>
            </div>
            ${resultSection}
        `;

        // 检查是否所有工具都完成了
        this.checkAllToolsCompleted();
    }

    // 检查所有工具是否都完成
    checkAllToolsCompleted() {
        if (!this.currentThinkingFlow) return;

        const toolsContainer = this.currentThinkingFlow.querySelector('.tools-container');
        if (!toolsContainer) return;

        const allTools = toolsContainer.querySelectorAll('.thinking-tool');
        const completedTools = toolsContainer.querySelectorAll('.thinking-tool.completed, .thinking-tool.error');
        
        if (allTools.length > 0 && allTools.length === completedTools.length) {
            this.updateThinkingStage('tools_completed', '工具执行完成', '正在处理结果，准备回答...');
        }
    }

    // 切换思维流显示状态
    toggleThinkingFlow(flowId, forceCollapse = false) {
        const flowDiv = document.getElementById(flowId);
        if (!flowDiv) return;
        
        const content = flowDiv.querySelector('.thinking-flow-content');
        const toggleIcon = flowDiv.querySelector('.toggle-icon');
        const isCollapsed = flowDiv.classList.contains('collapsed');
        
        if (forceCollapse || !isCollapsed) {
            // 折叠
            flowDiv.classList.add('collapsed');
            content.style.maxHeight = '0';
            toggleIcon.textContent = '▶';
        } else {
            // 展开 - 完全展开，不限制高度
            flowDiv.classList.remove('collapsed');
            content.style.maxHeight = 'none'; // 完全展开，不限制高度
            toggleIcon.textContent = '▼';
        }
    }

    // 新增：切换工具结果显示状态
    toggleToolResult(toolId) {
        const toolDiv = document.getElementById(`thinking-tool-${toolId}`);
        if (!toolDiv) return;

        const content = toolDiv.querySelector('.tool-result-content');
        if (!content) return;
        
        const toggleButton = toolDiv.querySelector('.tool-result-toggle');
        if (!toggleButton) return;

        const toggleIcon = toggleButton.querySelector('.toggle-icon');
        const toggleText = toggleButton.querySelector('span:last-child');
        
        // 只切换class，让CSS处理动画和滚动
        content.classList.toggle('collapsed');
        const isNowCollapsed = content.classList.contains('collapsed');

        if (isNowCollapsed) {
            toggleIcon.textContent = '▶';
            toggleText.textContent = '展开';
        } else {
            toggleIcon.textContent = '▼';
            toggleText.textContent = '收起';
        }
    }

    // 新增：格式化数据大小显示
    formatDataSize(bytes) {
        if (bytes < 1024) return bytes + ' 字符';
        const kb = (bytes / 1024).toFixed(2);
        return `${kb} KB`;
    }
    
    formatToolResult(result) {
        // 尝试解析为JSON并美化显示
        try {
            const parsed = JSON.parse(result);
            if (typeof parsed === 'object') {
                return this.formatJsonResult(parsed);
            }
        } catch (e) {
            // 不是JSON，继续其他格式化
        }
        
        // 检查是否包含表格数据
        if (this.looksLikeTable(result)) {
            return this.formatTableResult(result);
        }
        
        // 普通文本，确保正确转义
        return `<pre>${this.escapeHtml(result)}</pre>`;
    }
    
    formatJsonResult(obj) {
        // 简单的JSON美化显示
        return `<pre>${this.escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
    }
    
    looksLikeTable(text) {
        // 简单检测是否包含表格标记
        return text.includes('|') && text.includes('---') || 
               text.includes('\t') && text.split('\n').length > 3;
    }
    
    formatTableResult(text) {
        // 如果是markdown表格，尝试转换为HTML表格
        const lines = text.split('\n');
        
        // 查找表格标题行和分隔行
        let tableStart = -1;
        let headerIndex = -1;
        let separatorIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes('|') && line.split('|').length > 2) {
                if (headerIndex === -1) {
                    headerIndex = i;
                } else if (separatorIndex === -1 && line.includes('---')) {
                    separatorIndex = i;
                    tableStart = headerIndex;
                    break;
                }
            }
        }
        
        if (tableStart >= 0 && separatorIndex > tableStart) {
            // 构建HTML表格
            let tableHtml = '<table>';
            
            // 添加表头
            const headerCells = lines[headerIndex].split('|').map(cell => cell.trim()).filter(cell => cell);
            if (headerCells.length > 0) {
                tableHtml += '<thead><tr>';
                headerCells.forEach(cell => {
                    tableHtml += `<th>${this.escapeHtml(cell)}</th>`;
                });
                tableHtml += '</tr></thead>';
            }
            
            // 添加表格数据
            tableHtml += '<tbody>';
            for (let i = separatorIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes('|')) {
                    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                    if (cells.length > 0) {
                        tableHtml += '<tr>';
                        cells.forEach(cell => {
                            tableHtml += `<td>${this.escapeHtml(cell)}</td>`;
                        });
                        tableHtml += '</tr>';
                    }
                } else if (line === '') {
                    continue;
                } else {
                    break; // 表格结束
                }
            }
            tableHtml += '</tbody></table>';
            
            // 添加表格前后的其他内容
            const beforeTable = lines.slice(0, tableStart).join('\n').trim();
            const afterTableStart = separatorIndex + 1;
            let afterTableEnd = afterTableStart;
            for (let i = afterTableStart; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes('|')) {
                    afterTableEnd = i + 1;
                } else if (line === '') {
                    continue;
                } else {
                    break;
                }
            }
            const afterTable = lines.slice(afterTableEnd).join('\n').trim();
            
            let result = '';
            if (beforeTable) {
                result += `<pre>${this.escapeHtml(beforeTable)}</pre>`;
            }
            result += tableHtml;
            if (afterTable) {
                result += `<pre>${this.escapeHtml(afterTable)}</pre>`;
            }
            
            return result || `<pre>${this.escapeHtml(text)}</pre>`;
        }
        
        // 不是标准表格，返回普通格式
        return `<pre>${this.escapeHtml(text)}</pre>`;
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
        this.activeTools.clear();
        this.currentThinkingFlow = null; // 清理思维流容器
        
        // 调用API清空后端历史
        try {
            // 确保配置已加载
            if (!window.configManager.isLoaded) {
                console.warn('⚠️ 配置未加载，无法清空服务器历史');
                return;
            }
            
            const apiUrl = window.configManager.getFullApiUrl('/api/history');
            
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