// share.js - 分享页面逻辑
class ShareApp {
    constructor() {
        this.sessionId = null;
        this.chatMessages = document.getElementById('chatMessages');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        this.init();
    }
    
    async init() {
        try {
            // 从URL参数获取会话ID
            this.sessionId = this.getSessionIdFromUrl();
            
            if (!this.sessionId) {
                this.showError('无效的分享链接', '缺少会话ID参数');
                return;
            }
            
            // 加载配置
            this.showLoading('正在加载配置...');
            if (!window.configManager.isLoaded) {
                await window.configManager.loadConfig();
            }
            
            // 加载分享的聊天记录
            await this.loadSharedChat();
            
        } catch (error) {
            console.error('❌ 分享页面初始化失败:', error);
            this.showError('加载失败', '无法加载分享的对话记录');
        }
    }
    
    getSessionIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('session');
    }
    
    async loadSharedChat() {
        try {
            this.showLoading('正在加载对话记录...');
            
            const apiUrl = window.configManager.getFullApiUrl(`/api/share/${encodeURIComponent(this.sessionId)}`);
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.showError('对话不存在', '未找到该会话的聊天记录，可能已被删除或会话ID无效');
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return;
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data || result.data.length === 0) {
                this.showEmptyState();
                return;
            }
            
            // 显示聊天记录
            this.displayChatHistory(result.data);
            
            // 更新页面标题
            document.title = `分享的对话 (${result.total_records}条消息) - MCP Web 智能助手`;
            
            this.hideLoading();
            
        } catch (error) {
            console.error('❌ 加载分享聊天记录失败:', error);
            this.showError('加载失败', `无法获取聊天记录: ${error.message}`);
        }
    }
    
    displayChatHistory(records) {
        this.chatMessages.innerHTML = '';
        
        // 添加分享信息头部
        this.addShareHeader(records.length);
        
        // 按对话ID分组显示
        const conversationGroups = this.groupByConversation(records);
        
        conversationGroups.forEach((conversation, index) => {
            // 添加对话分隔符（如果有多个对话）
            if (conversationGroups.length > 1) {
                this.addConversationSeparator(index + 1, conversation.length);
            }
            
            conversation.forEach(record => {
                // 添加用户消息
                this.addUserMessage(record.user_input, record.created_at);
                
                // 添加工具调用信息（如果有）
                if (record.mcp_tools_called && record.mcp_tools_called.length > 0) {
                    this.addToolsInfo(record.mcp_tools_called, record.mcp_results);
                }
                
                // 添加AI回复
                if (record.ai_response) {
                    this.addAIMessage(record.ai_response, record.ai_response_at);
                }
            });
        });
        
        // 滚动到顶部
        this.chatMessages.scrollTop = 0;
    }
    
    groupByConversation(records) {
        const groups = new Map();
        
        records.forEach(record => {
            const convId = record.conversation_id;
            if (!groups.has(convId)) {
                groups.set(convId, []);
            }
            groups.get(convId).push(record);
        });
        
        // 转换为数组并按对话ID排序
        return Array.from(groups.values()).sort((a, b) => {
            return a[0].conversation_id - b[0].conversation_id;
        });
    }
    
    addShareHeader(totalMessages) {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'share-header';
        headerDiv.innerHTML = `
            <div class="share-header-content">
                <div class="share-icon">🔗</div>
                <h2>分享的对话记录</h2>
                <p>会话ID: <code>${this.escapeHtml(this.sessionId)}</code></p>
                <p>共 ${totalMessages} 条对话记录</p>
                <div class="share-timestamp">
                    分享时间: ${new Date().toLocaleString('zh-CN')}
                </div>
            </div>
        `;
        
        // 添加样式
        if (!document.getElementById('share-header-styles')) {
            const styles = document.createElement('style');
            styles.id = 'share-header-styles';
            styles.textContent = `
                .share-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 1rem 0.75rem;
                    margin-bottom: 0.75rem;
                    text-align: center;
                }
                .share-header-content h2 {
                    margin: 0.25rem 0;
                    font-size: 1.2rem;
                }
                .share-header-content p {
                    margin: 0.15rem 0;
                    opacity: 0.9;
                    font-size: 0.9rem;
                }
                .share-header-content code {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 0.15rem 0.3rem;
                    border-radius: 3px;
                    font-family: monospace;
                    font-size: 0.85rem;
                }
                .share-icon {
                    font-size: 1.5rem;
                    margin-bottom: 0.25rem;
                }
                .share-timestamp {
                    font-size: 0.8rem;
                    opacity: 0.8;
                    margin-top: 0.5rem;
                }
                .conversation-separator {
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 1.5rem 0;
                    text-align: center;
                    color: #718096;
                }
                .tools-info {
                    background: #f0f9ff;
                    border: 1px solid #bae6fd;
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 0.5rem 0;
                }
                .tools-info-header {
                    font-weight: 600;
                    color: #0369a1;
                    margin-bottom: 0.5rem;
                }
                .tool-item {
                    background: white;
                    border-radius: 4px;
                    padding: 0.5rem;
                    margin: 0.25rem 0;
                    font-size: 0.9rem;
                    border: 1px solid #e5e7eb;
                }
                .tool-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .tool-icon {
                    font-size: 1rem;
                }
                .tool-info {
                    flex: 1;
                }
                .tool-name {
                    font-weight: 500;
                    color: #1e40af;
                    margin: 0;
                }
                .tool-status {
                    color: #6b7280;
                    font-size: 0.8rem;
                    margin: 0;
                }
                .tool-result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 0.5rem;
                    padding: 0.25rem 0;
                    border-top: 1px solid #f3f4f6;
                }
                .tool-result-size {
                    font-size: 0.75rem;
                    color: #9ca3af;
                }
                .tool-result-toggle {
                    background: none;
                    border: none;
                    color: #3b82f6;
                    cursor: pointer;
                    font-size: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    transition: background-color 0.2s;
                }
                .tool-result-toggle:hover {
                    background-color: #f3f4f6;
                }
                .tool-result-content {
                    margin-top: 0.5rem;
                    max-height: none;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                .tool-result-content.collapsed {
                    max-height: 0;
                }
                .tool-result-content pre {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    padding: 0.75rem;
                    margin: 0;
                    font-size: 0.8rem;
                    line-height: 1.4;
                    overflow-x: auto;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .tool-result-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 0.5rem 0;
                    font-size: 0.8rem;
                }
                .tool-result-content table th,
                .tool-result-content table td {
                    border: 1px solid #d1d5db;
                    padding: 0.5rem;
                    text-align: left;
                }
                .tool-result-content table th {
                    background-color: #f9fafb;
                    font-weight: 600;
                }
                .error-text {
                    color: #dc2626;
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 4px;
                    padding: 0.5rem;
                    font-size: 0.8rem;
                }
                .message-timestamp {
                    font-size: 0.8rem;
                    color: #9ca3af;
                    margin-top: 0.5rem;
                }
            `;
            document.head.appendChild(styles);
        }
        
        this.chatMessages.appendChild(headerDiv);
    }
    
    addConversationSeparator(conversationNumber, messageCount) {
        const separatorDiv = document.createElement('div');
        separatorDiv.className = 'conversation-separator';
        separatorDiv.innerHTML = `
            <strong>对话 ${conversationNumber}</strong>
            <span style="margin-left: 1rem; font-size: 0.9rem;">${messageCount} 条消息</span>
        `;
        this.chatMessages.appendChild(separatorDiv);
    }
    
    addUserMessage(content, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        
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
                <div class="message-timestamp">
                    ${this.formatTimestamp(timestamp)}
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
    }
    
    addAIMessage(content, timestamp) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        
        let renderedContent;
        try {
            if (typeof marked !== 'undefined') {
                renderedContent = marked.parse(content);
            } else {
                renderedContent = this.escapeHtml(content);
            }
        } catch (error) {
            console.warn('AI消息Markdown渲染错误:', error);
            renderedContent = this.escapeHtml(content);
        }
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${renderedContent}
                <div class="message-timestamp">
                    ${this.formatTimestamp(timestamp)}
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
    }
    
    addToolsInfo(toolsCalled, toolsResults) {
        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'tools-info';
        
        let toolsHtml = '<div class="tools-info-header">🔧 使用的工具</div>';
        
        toolsCalled.forEach((tool, index) => {
            const result = toolsResults && toolsResults[index];
            const toolId = `share-tool-${Date.now()}-${index}`;
            
            let statusIcon = '';
            let statusText = '';
            let resultSection = '';
            
            if (result && result.success) {
                statusIcon = '✅';
                statusText = '执行成功';
                
                // 添加结果显示
                if (result.result) {
                    const resultContent = this.formatToolResult(result.result);
                    const resultLength = result.result.length;
                    const resultSizeText = this.formatDataSize(resultLength);
                    const isLongContent = resultLength > 200;
                    
                    resultSection = `
                        <div class="tool-result-header">
                            <span class="tool-result-size">${resultSizeText}</span>
                            ${isLongContent ? `
                                <button class="tool-result-toggle" onclick="shareApp.toggleToolResult('${toolId}')">
                                    <span class="toggle-icon">▶</span>
                                    <span>展开</span>
                                </button>
                            ` : ''}
                        </div>
                        <div class="tool-result-content ${isLongContent ? 'collapsed' : ''}">
                            ${resultContent}
                        </div>
                    `;
                }
            } else if (result && !result.success) {
                statusIcon = '❌';
                statusText = '执行失败';
                resultSection = `<div class="tool-result-content error-text">${this.escapeHtml(result.error || '未知错误')}</div>`;
            } else {
                statusIcon = '⏳';
                statusText = '无结果';
            }
            
            toolsHtml += `
                <div class="tool-item" id="${toolId}">
                    <div class="tool-header">
                        <div class="tool-icon">${statusIcon}</div>
                        <div class="tool-info">
                            <div class="tool-name">${this.escapeHtml(tool.tool_name || '未知工具')}</div>
                            <div class="tool-status">${statusText}</div>
                        </div>
                    </div>
                    ${resultSection}
                </div>
            `;
        });
        
        toolsDiv.innerHTML = toolsHtml;
        this.chatMessages.appendChild(toolsDiv);
    }
    
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            console.warn('时间戳格式化错误:', error);
            return timestamp;
        }
    }
    
    // 切换工具结果显示状态
    toggleToolResult(toolId) {
        const toolDiv = document.getElementById(toolId);
        if (!toolDiv) return;

        const content = toolDiv.querySelector('.tool-result-content');
        if (!content) return;
        
        const toggleButton = toolDiv.querySelector('.tool-result-toggle');
        if (!toggleButton) return;

        const toggleIcon = toggleButton.querySelector('.toggle-icon');
        const toggleText = toggleButton.querySelector('span:last-child');
        
        // 切换折叠状态
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
    
    // 格式化数据大小显示
    formatDataSize(bytes) {
        if (bytes < 1024) return bytes + ' 字符';
        const kb = (bytes / 1024).toFixed(2);
        return `${kb} KB`;
    }
    
    // 格式化工具结果
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
            let i;
            for (i = separatorIndex + 1; i < lines.length; i++) {
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
            
            // 如果表格前后还有其他内容，也要显示
            const beforeTable = lines.slice(0, headerIndex).join('\n').trim();
            const afterTable = lines.slice(i).join('\n').trim()
            
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
    
    showError(title, message) {
        this.hideLoading();
        this.chatMessages.innerHTML = `
            <div class="error-message">
                <div class="error-icon">❌</div>
                <h2>${this.escapeHtml(title)}</h2>
                <p>${this.escapeHtml(message)}</p>
                <p><a href="index.html">返回首页</a></p>
            </div>
        `;
    }
    
    showEmptyState() {
        this.hideLoading();
        this.chatMessages.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h2>暂无对话记录</h2>
                <p>该会话还没有任何对话记录</p>
                <p><a href="index.html">开始新对话</a></p>
            </div>
        `;
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
const shareApp = new ShareApp();