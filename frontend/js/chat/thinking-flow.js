// thinking-flow.js - 思维流管理模块
class ThinkingFlow {
    constructor(chatApp) {
        this.chatApp = chatApp;
        this.currentThinkingFlow = null;
        this.activeTools = new Map();
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
                <button class="thinking-flow-toggle" onclick="chatApp.thinkingFlow.toggleThinkingFlow('${flowDiv.id}')">
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
        
        this.chatApp.chatMessages.appendChild(flowDiv);
        this.currentThinkingFlow = flowDiv;
        this.chatApp.scrollToBottom();
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
        this.chatApp.scrollToBottom();
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
                    <div class="tool-name">${this.chatApp.escapeHtml(data.tool_name)}</div>
                    <div class="tool-progress">准备执行</div>
                </div>
            </div>
        `;
        
        toolsContainer.appendChild(toolDiv);
        this.activeTools.set(data.tool_id, toolDiv);
        this.chatApp.scrollToBottom();
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
                        <button class="tool-result-toggle" onclick="chatApp.thinkingFlow.toggleToolResult('${data.tool_id}')">
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
            resultSection = `<div class="tool-result-content error-text">${this.chatApp.escapeHtml(data.error)}</div>`;
        }
        
        toolDiv.innerHTML = `
            <div class="tool-header">
                <div class="tool-icon">${statusIcon}</div>
                <div class="tool-info">
                    <div class="tool-name">${this.chatApp.escapeHtml(data.tool_name)}</div>
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

    // 切换工具结果显示状态
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

    // 格式化数据大小显示
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
        return `<pre>${this.chatApp.escapeHtml(result)}</pre>`;
    }
    
    formatJsonResult(obj) {
        // 简单的JSON美化显示
        return `<pre>${this.chatApp.escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
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
                    tableHtml += `<th>${this.chatApp.escapeHtml(cell)}</th>`;
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
                            tableHtml += `<td>${this.chatApp.escapeHtml(cell)}</td>`;
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
                result += `<pre>${this.chatApp.escapeHtml(beforeTable)}</pre>`;
            }
            result += tableHtml;
            if (afterTable) {
                result += `<pre>${this.chatApp.escapeHtml(afterTable)}</pre>`;
            }
            
            return result || `<pre>${this.chatApp.escapeHtml(text)}</pre>`;
        }
        
        // 不是标准表格，返回普通格式
        return `<pre>${this.chatApp.escapeHtml(text)}</pre>`;
    }

    // 清理思维流状态
    clear() {
        this.currentThinkingFlow = null;
        this.activeTools.clear();
    }

    // 获取当前思维流状态
    getCurrentFlow() {
        return this.currentThinkingFlow;
    }

    // 获取活跃工具
    getActiveTools() {
        return this.activeTools;
    }
}