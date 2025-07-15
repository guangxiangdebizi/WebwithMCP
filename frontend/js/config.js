// config.js - 配置管理器
class ConfigManager {
    constructor() {
        this.config = null;
        this.isLoaded = false;
        this.loadPromise = null;
    }
    
    async loadConfig() {
        // 如果已经在加载中，返回相同的Promise
        if (this.loadPromise) {
            return this.loadPromise;
        }
        
        this.loadPromise = this._doLoadConfig();
        return this.loadPromise;
    }
    
    async _doLoadConfig() {
        try {
            console.log('📋 开始加载配置文件...');
            const response = await fetch('./config.json');
            
            if (!response.ok) {
                throw new Error(`配置文件加载失败: HTTP ${response.status} ${response.statusText}`);
            }
            
            this.config = await response.json();
            this.isLoaded = true;
            
            // 验证配置完整性
            this._validateConfig();
            
            console.log('✅ 配置文件加载成功:', this.config);
            return this.config;
        } catch (error) {
            this.config = null;
            this.isLoaded = false;
            console.error('❌ 配置文件加载失败:', error);
            
            // 显示用户友好的错误信息
            this._showConfigError(error.message);
            throw new Error(`配置加载失败: ${error.message}`);
        }
    }
    
    _validateConfig() {
        if (!this.config) {
            throw new Error('配置对象为空');
        }
        
        if (!this.config.backend) {
            throw new Error('配置文件缺少 backend 配置');
        }
        
        const { host, port, protocol, wsProtocol } = this.config.backend;
        
        if (!host) {
            throw new Error('配置文件缺少 backend.host');
        }
        
        if (!port) {
            throw new Error('配置文件缺少 backend.port');
        }
        
        if (!protocol) {
            throw new Error('配置文件缺少 backend.protocol');
        }
        
        if (!wsProtocol) {
            throw new Error('配置文件缺少 backend.wsProtocol');
        }
        
        console.log('✅ 配置文件验证通过');
    }
    
    _showConfigError(message) {
        // 创建错误提示界面
        const errorHtml = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: white;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    background: #f56565;
                    padding: 30px;
                    border-radius: 10px;
                    max-width: 500px;
                    text-align: center;
                ">
                    <h2>⚠️ 配置文件加载失败</h2>
                    <p>${message}</p>
                    <p><strong>请检查 config.json 文件是否存在且格式正确！</strong></p>
                    <button onclick="window.location.reload()" style="
                        background: white;
                        color: #f56565;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: bold;
                        margin-top: 15px;
                    ">重新加载</button>
                </div>
            </div>
        `;
        
        // 添加到页面
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = errorHtml;
        document.body.appendChild(errorDiv);
    }
    
    // 确保配置已加载的检查方法
    _ensureConfigLoaded() {
        if (!this.isLoaded || !this.config) {
            throw new Error('配置文件未加载，请先调用 loadConfig() 方法');
        }
    }
    
    getApiBaseUrl() {
        this._ensureConfigLoaded();
        
        // 优先使用 api.baseUrl，否则构建地址
        if (this.config.api && this.config.api.baseUrl) {
            return this.config.api.baseUrl;
        }
        
        const { protocol, host, port } = this.config.backend;
        return `${protocol}://${host}:${port}`;
    }
    
    getWebSocketUrl() {
        this._ensureConfigLoaded();
        
        // 优先使用 api.wsUrl，否则构建地址
        if (this.config.api && this.config.api.wsUrl) {
            return this.config.api.wsUrl;
        }
        
        const { wsProtocol, host, port } = this.config.backend;
        return `${wsProtocol}://${host}:${port}`;
    }
    
    getFullApiUrl(endpoint) {
        const baseUrl = this.getApiBaseUrl();
        return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }
    
    getFullWebSocketUrl(endpoint) {
        const wsUrl = this.getWebSocketUrl();
        return `${wsUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    }
    
    // 检查当前页面host是否与配置host一致
    isLocalDeployment() {
        this._ensureConfigLoaded();
        
        const currentHost = window.location.hostname;
        const configHost = this.config.backend.host;
        
        // 如果配置的host是localhost或127.0.0.1，且当前也是，认为是本地部署
        const localhostAliases = ['localhost', '127.0.0.1', '::1'];
        const currentIsLocal = localhostAliases.includes(currentHost);
        const configIsLocal = localhostAliases.includes(configHost);
        
        return currentIsLocal && configIsLocal;
    }
    
    // 智能获取WebSocket URL（考虑跨域情况）
    getSmartWebSocketUrl(endpoint = '/ws/chat') {
        this._ensureConfigLoaded();
        
        // 如果是本地部署，使用配置的地址
        if (this.isLocalDeployment()) {
            return this.getFullWebSocketUrl(endpoint);
        }
        
        // 如果是跨域部署，使用当前页面的host但配置的端口
        const currentProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const currentHost = window.location.hostname;
        const configPort = this.config.backend.port;
        
        return `${currentProtocol}://${currentHost}:${configPort}${endpoint}`;
    }
}

// 创建全局配置管理器实例
window.configManager = new ConfigManager();

// 立即开始加载配置
window.configManager.loadConfig().catch(error => {
    console.error('❌ 配置加载失败，应用无法正常工作:', error);
}); 