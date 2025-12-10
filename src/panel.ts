import * as vscode from 'vscode';
import { FileService } from './fileService';
import { Logger } from './logger';
import fs from 'fs';

/**
 * AI-CI Panel 管理类 - 简化的核心管理类
 */
export class AICIPanel {
    public static currentPanel: AICIPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    /**
     * 创建或显示面板
     */
    public static createOrShow(context: vscode.ExtensionContext) {
        Logger.log('[AICIPanel] createOrShow called');

        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (AICIPanel.currentPanel) {
            Logger.log('[AICIPanel] Panel already exists, revealing...');
            AICIPanel.currentPanel._panel.reveal(column);
            return;
        }

        Logger.log('[AICIPanel] Creating new panel...');
        const panel = vscode.window.createWebviewPanel(
            'aiciPanel',
            '🤖 AI BOX',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'webview')
                ]
            }
        );

       
        Logger.log('[AICIPanel] Panel created successfully');
        AICIPanel.currentPanel = new AICIPanel(panel, context);
    }

    /**
     * 构造函数
     */
    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        Logger.log('[AICIPanel] Constructor called');

        this._panel = panel;
        this._context = context;
        this._extensionUri = context.extensionUri;

        Logger.log('[AICIPanel] Setting up webview HTML...');
        this._panel.webview.html = this._getHtmlForWebview();

        Logger.log('[AICIPanel] Registering event handlers...');
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                Logger.log(`[AICIPanel] Received message from webview: ${message.type}`);
                await this._handleMessage(message);
            },
            null,
            this._disposables
        );

        // 延迟发送appId配置信息，确保webview已准备好接收消息
        setTimeout(() => {
            this._sendAppIdConfig();
        }, 100);

        Logger.log('[AICIPanel] Panel initialization complete');
    }

    /**
     * 发送appId配置信息给前端
     */
    private _sendAppIdConfig(): void {
        try {
            

        } catch (error) {
            Logger.error('[AICIPanel] Failed to send appId config:', error);
        }
    }

    /**
     * 处理来自 WebView 的消息
     */
    private async _handleMessage(message: any) {
        Logger.log(`[AICIPanel] Message data: ${JSON.stringify(message)}`);

        switch (message.type) {
            case 'fetchCommands':
                Logger.log(`[AICIPanel] Fetching tasks with commands: ${JSON.stringify(message.filters)}`);
                await this._fetchTasksWithCommands(message.filters);
                break;
            case 'fetchCommandsList':
                Logger.log(`[AICIPanel] Fetching Commands List with filters: ${JSON.stringify(message.filters)}`);
                await this._fetchCommandsList(message.filters);
                break;
            case 'fetchLabels':
                Logger.log(`[AICIPanel] Fetching Labels`);
                await this._fetchLabels();
                break;
            case 'fetchMcps':
                Logger.log(`[AICIPanel] Fetching MCPs with filters: ${JSON.stringify(message.filters)}`);
                await this._fetchMcps(message.filters);
                break;
            case 'checkMcpInstalled':
                Logger.log(`[AICIPanel] Checking if MCP is installed: ${message.serviceName}`);
                try {
                    const isInstalled = FileService.isMcpInstalled(message.serviceName);
                    this._panel.webview.postMessage({
                        type: 'mcpInstalledStatus',
                        data: {
                            serviceName: message.serviceName,
                            isInstalled: isInstalled
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error checking MCP installation:', error);
                    this._panel.webview.postMessage({
                        type: 'mcpInstalledStatus',
                        data: {
                            serviceName: message.serviceName,
                            isInstalled: false
                        }
                    });
                }
                break;
            case 'getAllInstalledMcps':
                Logger.log(`[AICIPanel] Getting all installed MCPs`);
                try {
                    const installedMcps = FileService.getAllInstalledMcps();
                    this._panel.webview.postMessage({
                        type: 'allInstalledMcps',
                        data: installedMcps
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error getting all installed MCPs:', error);
                    this._panel.webview.postMessage({
                        type: 'allInstalledMcps',
                        data: {}
                    });
                }
                break;
            case 'fetchRules':
                Logger.log(`[AICIPanel] Fetching Rules with filters: ${JSON.stringify(message.filters)}`);
                await this._fetchRules(message.filters);
                break;
            case 'openRules':
                Logger.log(`[AICIPanel] Opening Rules level: ${message.level}, name: ${message.name}`);
                try {
                    // 从 message.level 获取 level
                    const level = message.level || 'project';
                    
                    // 统一处理 name，移除 .mdc 扩展名
                    const nameWithoutExt = message.name.endsWith('.mdc') ? message.name.slice(0, -4) : message.name;
                    // FileService.openRules 内部会处理 name（移除扩展名），所以传递原始 name
                    await FileService.openRules(level, message.name, message.oss_url);
                    // 安装成功后，通知前端更新状态
                    const isInstalled = FileService.isRuleInstalled(nameWithoutExt, level);
                    Logger.log(`[AICIPanel] Rule installed status - name: ${nameWithoutExt}, level: ${level}, isInstalled: ${isInstalled}`);
                    this._panel.webview.postMessage({
                        type: 'ruleInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: level,
                            isInstalled: isInstalled
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error opening Rules:', error);
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    if (errorMessage.includes('NoWorkspaceUriError') || errorMessage.includes('workspace')) {
                        vscode.window.showWarningMessage('请先打开一个工作区');
                    } else {
                        vscode.window.showErrorMessage(`打开规则失败: ${errorMessage}`);
                    }
                }
                break;
            case 'uninstallRule':
                Logger.log(`[AICIPanel] Uninstalling Rule: ${message.name}, level: ${message.level}`);
                try {
                    await FileService.uninstallRule(message.name, message.level);
                    // 卸载成功后，通知前端更新状态（统一处理 name，移除 .mdc 扩展名）
                    const nameWithoutExt = message.name.endsWith('.mdc') ? message.name.slice(0, -4) : message.name;
                    this._panel.webview.postMessage({
                        type: 'ruleInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: false
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error uninstalling Rule:', error);
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    vscode.window.showErrorMessage(`卸载规则失败: ${errorMessage}`);
                }
                break;
            case 'checkRuleInstalled':
                Logger.log(`[AICIPanel] Checking if rule is installed: ${message.name}, level: ${message.level}`);
                try {
                    // 统一处理 name，移除 .mdc 扩展名
                    const nameWithoutExt = message.name.endsWith('.mdc') ? message.name.slice(0, -4) : message.name;
                    const isInstalled = FileService.isRuleInstalled(nameWithoutExt, message.level);
                    this._panel.webview.postMessage({
                        type: 'ruleInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: isInstalled
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error checking rule installation:', error);
                    const nameWithoutExt = message.name.endsWith('.mdc') ? message.name.slice(0, -4) : message.name;
                    this._panel.webview.postMessage({
                        type: 'ruleInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: false
                        }
                    });
                }
                break;
            case 'openCommands':
                Logger.log(`[AICIPanel] Opening Commands with scope: ${message.scope}, level: ${message.level}`);
                try {
                    const commandName = await FileService.openCommands(message.level, message.name, message.oss_url);
                    
                    // 安装成功后，发送状态更新（统一处理 name，移除 .md 扩展名）
                    const nameWithoutExt = message.name.endsWith('.md') ? message.name.slice(0, -3) : message.name;
                    const isInstalled = FileService.isCommandInstalled(nameWithoutExt, message.level);
                    this._panel.webview.postMessage({
                        type: 'commandInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: isInstalled
                        }
                    });
                    
                    // 重新获取命令列表以更新UI
                    await this._fetchTasksWithCommands();

                    
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error opening Commands:', error);
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    if (errorMessage.includes('NoWorkspaceUriError') || errorMessage.includes('workspace')) {
                        vscode.window.showWarningMessage('请先打开一个工作区');
                    } else {
                        vscode.window.showErrorMessage(`打开命令失败: ${errorMessage}`);
                    }
                }
                break;
            case 'uninstallCommand':
                Logger.log(`[AICIPanel] Uninstalling Command: ${message.name}, level: ${message.level}`);
                try {
                    await FileService.uninstallCommand(message.name, message.level);
                    
                    // 卸载成功后，发送状态更新（统一处理 name，移除 .md 扩展名）
                    const nameWithoutExt = message.name.endsWith('.md') ? message.name.slice(0, -3) : message.name;
                    this._panel.webview.postMessage({
                        type: 'commandInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: false
                        }
                    });
                    
                    // 重新获取命令列表以更新UI
                    await this._fetchTasksWithCommands();
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error uninstalling Command:', error);
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    vscode.window.showErrorMessage(`卸载命令失败: ${errorMessage}`);
                }
                break;
            case 'checkCommandInstalled':
                Logger.log(`[AICIPanel] Checking if command is installed: ${message.name}, level: ${message.level}`);
                try {
                    // 统一处理 name，移除 .md 扩展名
                    const nameWithoutExt = message.name.endsWith('.md') ? message.name.slice(0, -3) : message.name;
                    const isInstalled = FileService.isCommandInstalled(nameWithoutExt, message.level);
                    this._panel.webview.postMessage({
                        type: 'commandInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: isInstalled
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error checking command installation:', error);
                    const nameWithoutExt = message.name.endsWith('.md') ? message.name.slice(0, -3) : message.name;
                    this._panel.webview.postMessage({
                        type: 'commandInstalledStatus',
                        data: {
                            name: nameWithoutExt,
                            level: message.level,
                            isInstalled: false
                        }
                    });
                }
                break;
            // case 'openMcps':
            //     Logger.log(`[AICIPanel] Opening MCPs with scope: ${message.scope}`);
            //     try {
            //         await FileService.openMcps(message.file_type, message.name, message.oss_url);
            //     } catch (error: any) {
            //         Logger.error('[AICIPanel] Error opening MCPs:', error);
            //         const errorMessage = error?.message || error?.toString() || 'Unknown error';
            //         vscode.window.showErrorMessage(`打开 MCP 配置失败: ${errorMessage}`);
            //     }
            //     break;
            case 'installMcp':
                Logger.log(`[AICIPanel] Installing MCP: ${message.serviceName}`);
                try {
                    await FileService.installMcp(message.serviceName, message.config);
                    // 安装成功后，通知前端更新状态
                    this._panel.webview.postMessage({
                        type: 'mcpInstalledStatus',
                        data: {
                            serviceName: message.serviceName,
                            isInstalled: true
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error installing MCP:', error);
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    vscode.window.showErrorMessage(`安装 MCP 配置失败: ${errorMessage}`);
                }
                break;
            case 'uninstallMcp':
                Logger.log(`[AICIPanel] Uninstalling MCP: ${message.serviceName}`);
                try {
                    await FileService.uninstallMcp(message.serviceName, message.config);
                    // 卸载成功后，通知前端更新状态
                    this._panel.webview.postMessage({
                        type: 'mcpInstalledStatus',
                        data: {
                            serviceName: message.serviceName,
                            isInstalled: false
                        }
                    });
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error uninstalling MCP:', error);
                    const errorMessage = error?.message || error?.toString() || 'Unknown error';
                    vscode.window.showErrorMessage(`卸载 MCP 配置失败: ${errorMessage}`);
                }
                break;

            case 'transitionTask':
                Logger.log(`[AICIPanel] Transitioning task: ${message.taskId} with status: ${message.status}`);
                try {
                    
                } catch (error: any) {
                    Logger.error('[AICIPanel] Error transitioning task:', error);
                    vscode.window.showErrorMessage(`任务状态更新失败: ${error.message || error.toString()}`);
                }
                break;
            default:
                Logger.warn(`[AICIPanel] Unknown message type: ${message.type}`);
        }
    }

    /**
     * 获取 tasks 与 commands 关联数据
     */
    private async _fetchTasksWithCommands(filters?: { appId?: string; assigner?: string; executor?: string; status?: string; level?: string; page?: number; size?: number }) {
        try {
           
           
        } catch (error: any) {
            Logger.error('[AICIPanel] Failed to fetch tasks with commands:', error);
            this._showError(`Failed to fetch tasks with commands: ${error.message || error.toString()}`);
        }
    }

    /**
     * 获取 commands 列表数据 (独立的Commands Tab)
     */
    private async _fetchCommandsList(filters?: { keyword?: string; level?: string; labels?: number; page?: number; size?: number }) {
        try {
           
        } catch (error: any) {
            Logger.error('[AICIPanel] Failed to fetch Commands List:', error);
            this._showError(`Failed to fetch Commands List: ${error.message || error.toString()}`);
        }
    }

    /**
     * 获取 labels 列表数据
     */
    private async _fetchLabels() {
        try {
           
        } catch (error: any) {
            Logger.error('[AICIPanel] Failed to fetch Labels:', error);
            this._showError(`Failed to fetch Labels: ${error.message || error.toString()}`);
        }
    }

    /**
     * 获取 mcps 数据
     */
    private async _fetchMcps(filters?: { name?: string; scope?: string; page?: number; size?: number }) {
        try {
            
        } catch (error: any) {
            Logger.error('[AICIPanel] Failed to fetch MCPs:', error);
            this._showError(`Failed to fetch MCPs: ${error.message || error.toString()}`);
        }
    }

    /**
     * 获取 rules 数据
     */
    private async _fetchRules(filters?: { name?: string; scope?: string; page?: number; size?: number }) {
        try {
            
        } catch (error: any) {
            Logger.error('[AICIPanel] Failed to fetch Rules:', error);
            this._showError(`Failed to fetch Rules: ${error.message || error.toString()}`);
        }
    }

    /**
     * 获取聊天历史
     */
    private async _fetchChatHistory(filters?: { limit?: number; search?: string; conversationId?: string }) {
        try {
            
        } catch (error: any) {
            // 错误已经在CursorService中处理了
        }
    }

    /**
     * 显示错误消息
     */
    private _showError(message: string) {
        vscode.window.showErrorMessage(message);
    }

    /**
     * 获取 WebView HTML 内容
     */
    private _getHtmlForWebview(): string {
        try {
            // 获取 webview 目录中的资源文件 URI
            const webviewPath = vscode.Uri.joinPath(this._extensionUri, 'webview');
            const htmlPath = vscode.Uri.joinPath(webviewPath, 'index.html');
            const stylesPath = vscode.Uri.joinPath(webviewPath, 'styles.css');
            const scriptPath = vscode.Uri.joinPath(webviewPath, 'main.js');

            // 转换为 webview 可用的 URI
            const stylesUri = this._panel.webview.asWebviewUri(stylesPath);
            const scriptUri = this._panel.webview.asWebviewUri(scriptPath);
            const cspSource = this._panel.webview.cspSource;

            Logger.log(`[AICIPanel] Loading HTML from: ${htmlPath.fsPath}`);
            Logger.log(`[AICIPanel] Extension URI: ${this._extensionUri.toString()}`);
            Logger.log(`[AICIPanel] Styles URI: ${stylesUri.toString()}`);
            Logger.log(`[AICIPanel] Script URI: ${scriptUri.toString()}`);

            // 检查文件是否存在
            if (!fs.existsSync(htmlPath.fsPath)) {
                const errorMsg = `HTML file not found at: ${htmlPath.fsPath}`;
                Logger.error(`[AICIPanel] ${errorMsg}`);
                throw new Error(errorMsg);
            }

            // 读取 HTML 文件
            let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // 验证文件内容不为空
            if (!html || html.trim().length === 0) {
                throw new Error('HTML file is empty');
            }

            // 替换占位符
            html = html.replace(/\{\{stylesUri\}\}/g, stylesUri.toString());
            html = html.replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
            html = html.replace(/\{\{cspSource\}\}/g, cspSource);

            // 验证占位符是否全部替换
            if (html.includes('{{stylesUri}}') || html.includes('{{scriptUri}}') || html.includes('{{cspSource}}')) {
                Logger.warn('[AICIPanel] Warning: Some placeholders were not replaced');
            }

            Logger.log('[AICIPanel] HTML loaded successfully');
            return html;
        } catch (error: any) {
            const errorMsg = `Failed to load webview HTML: ${error.message || error.toString()}`;
            Logger.error(`[AICIPanel] ${errorMsg}`, error);
            // 返回一个基本的错误页面HTML
            return this._getErrorHtml(errorMsg);
        }
    }

    /**
     * 获取错误页面的 HTML
     */
    private _getErrorHtml(errorMessage: string): string {
        const cspSource = this._panel.webview.cspSource;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource};">
    <title>AI-BOX - Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .error-container {
            max-width: 600px;
            text-align: center;
        }
        .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        .error-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 16px;
            color: var(--vscode-errorForeground);
        }
        .error-message {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 24px;
            word-break: break-word;
        }
        .error-details {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-textBlockQuote-background);
            padding: 12px;
            border-radius: 4px;
            text-align: left;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-title">无法加载 AIBOX 页面</div>
        <div class="error-message">${this._escapeHtml(errorMessage)}</div>
        <div class="error-details">
            <strong>请检查：</strong><br>
            1. 扩展是否正确安装<br>
            2. webview 文件是否存在<br>
            3. 查看开发者控制台获取更多信息
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * HTML 转义
     */
    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 释放资源
     */
    public dispose() {
        Logger.log('[AICIPanel] Disposing panel...');

        AICIPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }

        Logger.log('[AICIPanel] Panel disposed');
    }

    /**
     * 检查 Git 仓库并运行命令
     */
    private async _handleCheckGitAndRunCommand(message: any) {
        const { gitRepoUrl, ...chatMessage } = message;
        
        if (gitRepoUrl) {
            try {
                const currentGitUrl = await this._getGitRemoteUrl();
                Logger.log(`[AICIPanel] Git check - Current: ${currentGitUrl}, Target: ${gitRepoUrl}`);
                
                if (currentGitUrl && !this._isSameGitRepo(currentGitUrl, gitRepoUrl)) {
                     const answer = await vscode.window.showWarningMessage(
                        `当前 Git 仓库 (${currentGitUrl}) 与任务关联的仓库 (${gitRepoUrl}) 不一致。是否继续运行？`,
                        { modal: true },
                        '继续运行'
                    );
                    
                    if (answer !== '继续运行') {
                        return;
                    }
                }
            } catch (e) {
                Logger.error('[AICIPanel] Error checking git repo:', e);
            }
        }
        
    }

    private async _getGitRemoteUrl(): Promise<string | undefined> {
        try {
            const extension = vscode.extensions.getExtension('vscode.git');
            if (!extension) return undefined;
            
            const git = extension.isActive ? extension.exports.getAPI(1) : await extension.activate().then((ext: any) => ext.getAPI(1));
            if (git.repositories.length > 0) {
                return git.repositories[0].state.remotes[0]?.fetchUrl;
            }
        } catch (e) {
            Logger.error('[AICIPanel] Failed to get git remote:', e);
        }
        return undefined;
    }

    private _isSameGitRepo(url1: string, url2: string): boolean {
        if (!url1 || !url2) return false;
        
        const normalize = (url: string) => {
            return url.trim()
                      .replace(/\.git$/, '')
                      .replace(/^(https?:\/\/|ssh?:\/\/git@|git@)/, '')
                      .replace(/.*@/, '') 
                      .replace(/:\d+/, '') // 移除端口号（如 :56358）
                      .replace(':', '/'); 
        };
        
        return normalize(url1) === normalize(url2);
    }
}
