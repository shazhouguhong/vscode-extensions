import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import axios from 'axios';
import { Logger } from './logger';

/**
 * 文件服务类 - 处理所有文件操作相关功能
 */
export class FileService {
    // 目录名称常量
    private static readonly DIR_NAMES = {
        CURSOR: '.cursor',
        COMMANDS: 'commands',
        RULES: 'rules',
        MCP_CONFIG: 'mcp.json',
        INSTALL_RECORDS: 'install-records.json'
    };

    // 扩展安装目录（通过setExtensionPath设置）
    private static extensionPath: string | null = null;

    private static context: vscode.ExtensionContext;
    
    // MCP 安装状态存储 key
    private static readonly MCP_INSTALLED_KEY = 'mcpInstalledServices';

    /**
     * 设置扩展安装目录
     */
    public static setExtensionPath(extensionPath: string): void {
        this.extensionPath = extensionPath;
    }
    public static setContext(context: vscode.ExtensionContext): void {
        this.context = context;
    }

    // 示例内容常量

    private static readonly EXAMPLE_RULE = `# 代码审查

请对当前代码进行详细审查：

- 代码质量和可读性
- 潜在的 bug 和安全问题
- 性能优化建议
- 最佳实践建议

请给出具体的改进建议和示例代码。`;

    private static readonly USER_RULE_TEMPLATE = `## 代码质量
- 保持代码简洁易读
- 使用有意义的变量和函数名
- 避免重复代码，提取公共方法
- 适当添加注释说明复杂逻辑`;

    private static readonly USER_RULE_DESCRIPTION = 'AI-CI 代码编码规范';
    private static readonly USER_RULE_GLOBS = '**/*';

    // MCP 配置常量
    private static readonly DEFAULT_MCP_SERVER = {
        "devops-mcp-server": {
            "type": "http stateless mcp server",
            "url": "https://gateway-office-public-stg.huolala.work/bfe-mdap-devops-svc/devops-mcp-server/mcp"
        }
    };

    /**
     * 获取目录名称常量
     */
    public static getDirNames() {
        return this.DIR_NAMES;
    }

    /**
     * 获取示例内容
     */
    public static getExampleContent() {
        return {
            rule: this.EXAMPLE_RULE,
            userRuleTemplate: this.USER_RULE_TEMPLATE,
            userRuleDescription: this.USER_RULE_DESCRIPTION,
            userRuleGlobs: this.USER_RULE_GLOBS
        };
    }


    /**
     * 下载并处理OSS URL内容
     */
    public static async downloadAndProcessOssContent(ossUrl: string, defaultContent: string): Promise<string> {
        let processedContent: string = defaultContent; // 默认值

        try {
            Logger.log('[FileService] Downloading content from OSS URL:', ossUrl);
            const response = await axios.get(ossUrl, {
                timeout: 10000, // 10秒超时
                headers: {
                    'User-Agent': 'AIBOX-Extension/1.0'
                }
            });

            const content = response.data;
            Logger.log('[FileService] Successfully downloaded content, length:', content.length);

            // 如果内容是字符串且包含路径相关信息，清理和处理
            processedContent = content;
            if (typeof content === 'string') {
                // 移除可能的换行符和空格
                processedContent = content.trim();
                //Logger.log('[FileService] Processed content:', processedContent);
            }
        } catch (error: any) {
            Logger.error('[FileService] Failed to download from OSS URL:', error.message);

            // 如果下载失败，使用默认内容
            Logger.warn('[FileService] Using default content due to download failure');
            processedContent = defaultContent;
        }

        return processedContent;
    }

    /**
     * 写入本地文件（如果文件存在会提示是否覆盖）
     */
    public static async writeLocalFile(filePath: string, content: string, fileDescription: string): Promise<number> {
        Logger.log('[FileService] Writing  file:', filePath);

        // 检查文件是否已存在
        if (fs.existsSync(filePath)) {
            const fileName = path.basename(filePath);
            const answer = await vscode.window.showWarningMessage(
                `⚠️ ${fileName}文件已存在，是否覆盖？`, { modal: true },
                '覆盖',
                '打开文件'
            );

            if (!answer) {
                Logger.log('[FileService] file write cancelled by user');
                return 1;
            } else if (answer === '打开文件') {
                // 打开现有文件让用户查看
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
                return 1;
            }
            // answer === '覆盖' 继续执行
        }

        fs.writeFileSync(filePath, content, 'utf-8');

        Logger.log('[FileService]  file written successfully');
        return 0;
    }

    /**
     * 打开 Rules 配置
     */
    public static async openRules(level: string, name: string, ossUrl: string): Promise<void> {
        Logger.log('[FileService] Opening Rules with level:', level, name, ossUrl);

        let rulesDir: string;
        const targetLevel = level || 'project';

        if (targetLevel === 'user') {
            // 用户级规则：安装到用户目录
            rulesDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR, this.DIR_NAMES.RULES);
            Logger.log('[FileService] Installing rule to user directory:', rulesDir);
        } else if (targetLevel === 'project') {
            // 项目级规则：安装到项目目录
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    const answer = await vscode.window.showWarningMessage(
                        '请先打开一个工作区才能使用项目级规则',
                        { modal: true },
                        '打开文件夹'
                    );
                    if (answer === '打开文件夹') {
                        await vscode.commands.executeCommand('workbench.action.files.openFolder');
                    }
                    return;
                }

                const workspaceUri = workspaceFolders[0].uri;
                if (!workspaceUri || !workspaceUri.fsPath) {
                    vscode.window.showWarningMessage('无法获取工作区路径');
                    return;
                }

                rulesDir = path.join(workspaceUri.fsPath, this.DIR_NAMES.CURSOR, this.DIR_NAMES.RULES);
                Logger.log('[FileService] Installing rule to project directory:', rulesDir);
            } catch (error: any) {
                Logger.error('[FileService] Error getting workspace path:', error);
                const errorMessage = error.message || error.toString();
                if (errorMessage.includes('NoWorkspaceUriError') || errorMessage.includes('workspace')) {
                    vscode.window.showWarningMessage('请先打开一个工作区');
                } else {
                    vscode.window.showErrorMessage(`获取工作区路径失败: ${errorMessage}`);
                }
                return;
            }
        } else {
            // 其他情况（如 team），默认使用用户目录
            rulesDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR, this.DIR_NAMES.RULES);
            Logger.log('[FileService] Installing rule to user directory (default):', rulesDir);
        }

        // 确保目录存在
        if (!fs.existsSync(rulesDir)) {
            fs.mkdirSync(rulesDir, { recursive: true });
        }

        // 确保name不包含.mdc扩展名
        const nameWithoutExt = name.endsWith('.mdc') ? name.slice(0, -4) : name;
        const filePath = path.join(rulesDir, nameWithoutExt + '.mdc');
        
        // 下载并处理OSS URL内容
        const defaultContent = this.EXAMPLE_RULE;
        const processedContent = await this.downloadAndProcessOssContent(ossUrl, defaultContent);
        const result = await this.writeLocalFile(filePath, processedContent, nameWithoutExt);
        if (result === 1) {
            return;
        }

        // 在文件浏览器中打开目录
        const uri = vscode.Uri.file(rulesDir);
        await vscode.commands.executeCommand('revealFileInOS', uri);

        // 保存安装记录（使用不包含扩展名的name）
        await this.saveRuleInstallRecord(nameWithoutExt, targetLevel, filePath);

        const levelText = targetLevel === 'user' ? '用户级' : targetLevel === 'project' ? '项目级' : '团队级';
        vscode.window.showInformationMessage(
            `✅ ${levelText}规则 ${nameWithoutExt}.mdc 安装成功！`
        );
    }

    /**
     * 打开 Commands 目录
     */
    public static async openCommands(level: string, name: string, ossUrl: string): Promise<string | undefined> {
        Logger.log('[FileService] Opening Commands with level:', level, 'name:', name);

        let commandsDir: string;
        const targetLevel = level || 'project'; // 默认为 project，与 Rules 保持一致

        if (targetLevel === 'user') {
            // 用户级命令：安装到用户目录
            commandsDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR, this.DIR_NAMES.COMMANDS);
            Logger.log('[FileService] Installing command to user directory:', commandsDir);
        } else if (targetLevel === 'project') {
            // 项目级命令：安装到项目目录
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    const answer = await vscode.window.showWarningMessage(
                        '请先打开一个工作区才能使用项目级命令',
                        { modal: true },
                        '打开文件夹'
                    );
                    if (answer === '打开文件夹') {
                        await vscode.commands.executeCommand('workbench.action.files.openFolder');
                    }
                    return;
                }

                const workspaceUri = workspaceFolders[0].uri;
                if (!workspaceUri || !workspaceUri.fsPath) {
                    vscode.window.showWarningMessage('无法获取工作区路径');
                    return;
                }

                commandsDir = path.join(workspaceUri.fsPath, this.DIR_NAMES.CURSOR, this.DIR_NAMES.COMMANDS);
                Logger.log('[FileService] Installing command to project directory:', commandsDir);
            } catch (error: any) {
                Logger.error('[FileService] Error getting workspace path:', error);
                const errorMessage = error.message || error.toString();
                if (errorMessage.includes('NoWorkspaceUriError') || errorMessage.includes('workspace')) {
                    vscode.window.showWarningMessage('请先打开一个工作区');
                } else {
                    vscode.window.showErrorMessage(`获取工作区路径失败: ${errorMessage}`);
                }
                return;
            }
        } else {
            // 其他情况（如 team），默认使用用户目录
            commandsDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR, this.DIR_NAMES.COMMANDS);
            Logger.log('[FileService] Installing command to user directory (default):', commandsDir);
        }

        // 确保目录存在
        if (!fs.existsSync(commandsDir)) {
            fs.mkdirSync(commandsDir, { recursive: true });
        }

        // 确保name不包含.md扩展名
        const nameWithoutExt = name.endsWith('.md') ? name.slice(0, -3) : name;
        const filePath = path.join(commandsDir, nameWithoutExt + '.md');
        // 下载并处理OSS URL内容
        const processedContent = await this.downloadAndProcessOssContent(ossUrl, '');
        const result = await this.writeLocalFile(filePath, processedContent, nameWithoutExt);
        if (result === 1) {
            return;
        }

        // 在文件浏览器中打开目录
        const uri = vscode.Uri.file(commandsDir);
        await vscode.commands.executeCommand('revealFileInOS', uri);

        // 保存安装记录（使用不包含扩展名的name）
        await this.saveInstallRecord(nameWithoutExt, targetLevel, filePath);

        const levelText = targetLevel === 'user' ? '用户级' : targetLevel === 'project' ? '项目级' : '团队级';
        const answer = await vscode.window.showInformationMessage(
            `✅ ${levelText}命令 ${nameWithoutExt}.md 安装成功！\n可在 Cursor Chat 中使用 /${nameWithoutExt} 命令`,
            { modal: true },
            '立即试用'
        );

        if (answer === '立即试用') {
            return nameWithoutExt;
        }
        return undefined;
    }

    /**
     * 获取安装记录文件路径
     * 记录放在用户目录下
     */
    private static getInstallRecordsPath(): string | null {
        return path.join(os.homedir(), this.DIR_NAMES.CURSOR, this.DIR_NAMES.INSTALL_RECORDS);
    }

    /**
     * 读取安装记录
     */
    private static readInstallRecords(): Record<string, { level: string; filePath: string }> {
        const recordsPath = this.getInstallRecordsPath();
        if (!recordsPath || !fs.existsSync(recordsPath)) {
            return {};
        }

        try {
            const content = fs.readFileSync(recordsPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            Logger.error('[FileService] Failed to read install records:', error);
            return {};
        }
    }

    /**
     * 写入安装记录
     */
    private static writeInstallRecords(records: Record<string, { level: string; filePath: string }>): void {
        const recordsPath = this.getInstallRecordsPath();
        if (!recordsPath) {
            Logger.warn('[FileService] Cannot save install records: extension path not set');
            return;
        }

        try {
            fs.writeFileSync(recordsPath, JSON.stringify(records, null, 2), 'utf-8');
        } catch (error) {
            Logger.error('[FileService] Failed to write install records:', error);
        }
    }

    /**
     * 生成记录Key
     */
    private static getRecordKey(name: string, level: string, type: 'command' | 'rule' = 'command'): string {
        // 统一处理扩展名
        let nameWithoutExt: string;
        if (type === 'command') {
            nameWithoutExt = name.endsWith('.md') ? name.slice(0, -3) : name;
        } else {
            nameWithoutExt = name.endsWith('.mdc') ? name.slice(0, -4) : name;
        }
        
        const prefix = type === 'command' ? 'cmd_' : 'rule_';
        
        if (level === 'project') {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const projectPath = workspaceFolders[0].uri.fsPath;
                // 使用 MD5 hash 确保 key 的安全性
                const hash = crypto.createHash('md5').update(projectPath).digest('hex');
                return `${prefix}${nameWithoutExt}_${level}_${hash}`;
            }
        }
        
        return `${prefix}${nameWithoutExt}_${level}`;
    }

    /**
     * 保存安装记录
     * 以名称和level为唯一值
     */
    private static async saveInstallRecord(name: string, level: string, filePath: string): Promise<void> {
        const records = this.readInstallRecords();
        const key = this.getRecordKey(name, level, 'command');
        records[key] = { level, filePath };
        this.writeInstallRecords(records);
        Logger.log('[FileService] Saved install record:', key, filePath);
    }

    /**
     * 保存规则安装记录
     * 以名称和level为唯一值
     */
    private static async saveRuleInstallRecord(name: string, level: string, filePath: string): Promise<void> {
        Logger.log('[FileService] Saving rule install record - name:', name, 'level:', level, 'filePath:', filePath);
        const records = this.readInstallRecords();
        const key = this.getRecordKey(name, level, 'rule');
        Logger.log('[FileService] Generated rule record key:', key);
        records[key] = { level, filePath };
        this.writeInstallRecords(records);
        Logger.log('[FileService] Saved rule install record:', key, filePath);
    }

    /**
     * 检查是否已安装
     */
    public static isCommandInstalled(name: string, level: string): boolean {
        const records = this.readInstallRecords();
        const key = this.getRecordKey(name, level, 'command');
        const record = records[key];
        
        if (!record) {
            return false;
        }

        // 检查文件是否还存在
        if (record.filePath && fs.existsSync(record.filePath)) {
            return true;
        }

        // 文件不存在，删除记录
        delete records[key];
        this.writeInstallRecords(records);
        return false;
    }

    /**
     * 检查规则是否已安装
     */
    public static isRuleInstalled(name: string, level: string): boolean {
        const records = this.readInstallRecords();
        const key = this.getRecordKey(name, level, 'rule');
        const record = records[key];
        
        if (!record) {
            return false;
        }

        // 检查文件是否还存在
        if (record.filePath && fs.existsSync(record.filePath)) {
            return true;
        }

        // 文件不存在，删除记录
        delete records[key];
        this.writeInstallRecords(records);
        return false;
    }

    /**
     * 卸载命令
     */
    public static async uninstallCommand(name: string, level: string): Promise<void> {
        const records = this.readInstallRecords();
        const key = this.getRecordKey(name, level, 'command');
        const record = records[key];
        // 确保name不包含.md扩展名
        const nameWithoutExt = name.endsWith('.md') ? name.slice(0, -3) : name;

        if (!record) {
            vscode.window.showWarningMessage(`未找到 ${nameWithoutExt} (${level}) 的安装记录`);
            return;
        }

        // 确认删除
        const levelText = level === 'user' ? '用户级' : level === 'project' ? '项目级' : '团队级';
        const answer = await vscode.window.showWarningMessage(
            `确定要卸载 ${levelText}命令 ${nameWithoutExt}.md 吗？此操作将删除文件且无法恢复。`,
            { modal: true },
            '确定'
        );

        if (answer !== '确定') {
            return;
        }

        // 删除文件
        if (record.filePath && fs.existsSync(record.filePath)) {
            try {
                fs.unlinkSync(record.filePath);
                Logger.log('[FileService] Deleted command file:', record.filePath);
            } catch (error: any) {
                Logger.error('[FileService] Failed to delete command file:', error);
                vscode.window.showErrorMessage(`删除文件失败: ${error.message || error.toString()}`);
                return;
            }
        }

        // 删除记录
        delete records[key];
        this.writeInstallRecords(records);
        Logger.log('[FileService] Removed install record:', key);

        vscode.window.showInformationMessage(`✅ ${levelText}命令 ${nameWithoutExt}.md 已卸载`);
    }

    /**
     * 卸载规则
     */
    public static async uninstallRule(name: string, level: string): Promise<void> {
        const records = this.readInstallRecords();
        const key = this.getRecordKey(name, level, 'rule');
        const record = records[key];
        // 确保name不包含.mdc扩展名
        const nameWithoutExt = name.endsWith('.mdc') ? name.slice(0, -4) : name;

        if (!record) {
            vscode.window.showWarningMessage(`未找到 ${nameWithoutExt} (${level}) 的安装记录`);
            return;
        }

        // 确认删除
        const levelText = level === 'user' ? '用户级' : level === 'project' ? '项目级' : '团队级';
        const answer = await vscode.window.showWarningMessage(
            `确定要卸载 ${levelText}规则 ${nameWithoutExt}.mdc 吗？此操作将删除文件且无法恢复。`,
            { modal: true },
            '确定'
        );

        if (answer !== '确定') {
            return;
        }

        // 删除文件
        if (record.filePath && fs.existsSync(record.filePath)) {
            try {
                fs.unlinkSync(record.filePath);
                Logger.log('[FileService] Deleted rule file:', record.filePath);
            } catch (error: any) {
                Logger.error('[FileService] Failed to delete rule file:', error);
                vscode.window.showErrorMessage(`删除文件失败: ${error.message || error.toString()}`);
                return;
            }
        }

        // 删除记录
        delete records[key];
        this.writeInstallRecords(records);
        Logger.log('[FileService] Removed rule install record:', key);
        vscode.window.showInformationMessage(`✅ ${levelText}规则 ${nameWithoutExt}.mdc 已卸载`);
    }

    /**
     * 打开 MCPs 目录并添加配置
     */
    public static async openMcps(scope: string, name: string, ossUrl: string): Promise<void> {
        Logger.log('[FileService] Opening MCPs with scope:', scope, name, ossUrl);

        let mcpsDir: string;

        // 全局 MCP 配置目录
        mcpsDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR);

        // 确保目录存在
        if (!fs.existsSync(mcpsDir)) {
            fs.mkdirSync(mcpsDir, { recursive: true });
        }

        const mcpsJsonPath = path.join(mcpsDir, this.DIR_NAMES.MCP_CONFIG);

        // 读取或创建 mcp.json
        let mcpConfig: any = { mcpServers: {} };

        if (fs.existsSync(mcpsJsonPath)) {
            try {
                const content = fs.readFileSync(mcpsJsonPath, 'utf-8');
                mcpConfig = JSON.parse(content);

                // 确保 mcpServers 根节点存在
                if (!mcpConfig.mcpServers) {
                    mcpConfig.mcpServers = {};
                }
            } catch (error) {
                Logger.error('[FileService] Failed to parse mcp.json:', error);
                mcpConfig = { mcpServers: {} };
            }
        }

        // 示例 MCP 配置（要添加的单个 MCP Server）
        const newMcpServer = this.DEFAULT_MCP_SERVER;

        // 检查是否已存在相同的 key
        const existingKeys = Object.keys(mcpConfig.mcpServers);
        const newKeys = Object.keys(newMcpServer);
        const duplicateKeys = newKeys.filter(key => existingKeys.includes(key));

        if (duplicateKeys.length > 0) {
            // 询问是否覆盖
            const answer = await vscode.window.showWarningMessage(
                `MCP "${duplicateKeys.join(', ')}" 已存在，是否覆盖？`,
                '覆盖',
                '取消',
                '打开文件'
            );

            if (answer === '覆盖') {
                // 覆盖现有配置（合并到 mcpServers 中）
                Object.assign(mcpConfig.mcpServers, newMcpServer);
                fs.writeFileSync(mcpsJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
                vscode.window.showInformationMessage('✅ MCP 配置已更新');
            } else if (answer === '打开文件') {
                // 直接打开文件让用户编辑
                const document = await vscode.workspace.openTextDocument(mcpsJsonPath);
                await vscode.window.showTextDocument(document);
                return;
            } else {
                // 取消操作
                return;
            }
        } else {
            // 询问是否添加
            const mcpServerName = Object.keys(newMcpServer)[0];
            const answer = await vscode.window.showInformationMessage(
                `是否添加 "${mcpServerName}" 到 MCP 配置？`,
                '添加',
                '取消',
                '打开文件'
            );

            if (answer === '添加') {
                // 添加新配置（合并到 mcpServers 中）
                Object.assign(mcpConfig.mcpServers, newMcpServer);
                fs.writeFileSync(mcpsJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
                vscode.window.showInformationMessage('✅ MCP 配置已添加');
            } else if (answer === '打开文件') {
                // 直接打开文件让用户编辑
                const document = await vscode.workspace.openTextDocument(mcpsJsonPath);
                await vscode.window.showTextDocument(document);
                return;
            } else {
                // 取消操作
                return;
            }
        }

        // 在文件浏览器中打开目录
        const uri = vscode.Uri.file(mcpsDir);
        await vscode.commands.executeCommand('revealFileInOS', uri);

        const scopeText = scope === 'user' ? '全局' : '项目';
        vscode.window.showInformationMessage(`${scopeText} MCP 配置文件: ${mcpsJsonPath}`);
    }

    /**
     * 安装 MCP 配置
     * @param serviceName 服务名称
     * @param config 配置字符串（JSON格式）
     */
    public static async installMcp(serviceName: string, config: string): Promise<void> {
        Logger.log('[FileService] Installing MCP:', serviceName);

        // MCP 配置目录
        const mcpsDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR);
        const mcpsJsonPath = path.join(mcpsDir, this.DIR_NAMES.MCP_CONFIG);

        // 确保目录存在
        if (!fs.existsSync(mcpsDir)) {
            fs.mkdirSync(mcpsDir, { recursive: true });
        }

        // 读取或创建 mcp.json
        let mcpConfig: any = { mcpServers: {} };

        if (fs.existsSync(mcpsJsonPath)) {
            try {
                const content = fs.readFileSync(mcpsJsonPath, 'utf-8');
                mcpConfig = JSON.parse(content);

                // 确保 mcpServers 根节点存在
                if (!mcpConfig.mcpServers) {
                    mcpConfig.mcpServers = {};
                }
            } catch (error) {
                Logger.error('[FileService] Failed to parse mcp.json:', error);
                mcpConfig = { mcpServers: {} };
            }
        }

        // 解析 config 字符串
        let configObj: any = {};
        try {
            // config 可能是 JSON 字符串，需要解析
            if (typeof config === 'string') {
                // 先尝试直接解析
                try {
                    configObj = JSON.parse(config);
                } catch (e) {
                    // 如果解析失败，可能是转义的 JSON 字符串，尝试再次解析
                    try {
                        const unescaped = config.replace(/\\n/g, '').replace(/\\"/g, '"');
                        configObj = JSON.parse(unescaped);
                    } catch (e2) {
                        // 如果还是失败，尝试包装成对象
                        try {
                            configObj = JSON.parse(`{${config}}`);
                        } catch (e3) {
                            throw new Error('无法解析配置格式');
                        }
                    }
                }
            } else {
                configObj = config;
            }
        } catch (error: any) {
            Logger.error('[FileService] Failed to parse config:', error);
            vscode.window.showErrorMessage(`配置格式错误: ${error.message || error}`);
            return;
        }

        // 提取 mcpServers 配置
        // config 格式可能是: {"mcpServers": {...}} 或直接是 {...}
        let newMcpServers: any = {};
        if (configObj.mcpServers) {
            newMcpServers = configObj.mcpServers;
        } else {
            // 如果 config 直接是 mcpServers 对象
            newMcpServers = configObj;
        }

        // 检查是否已存在相同的 key
        const existingKeys = Object.keys(mcpConfig.mcpServers);
        const newKeys = Object.keys(newMcpServers);
        const duplicateKeys = newKeys.filter(key => existingKeys.includes(key));

        let shouldOverwrite = false;

        if (duplicateKeys.length > 0) {
            // 询问是否覆盖
            const answer = await vscode.window.showWarningMessage(
                `MCP 服务 "${duplicateKeys.join(', ')}" 已存在，是否覆盖？`,
                { modal: true },
                '覆盖'
            );

            if (answer === '覆盖') {
                shouldOverwrite = true;
            } else {
                return; // 取消操作
            }
        }

        // 合并配置到 mcpServers
        Object.assign(mcpConfig.mcpServers, newMcpServers);

        // 写入文件
        try {
            fs.writeFileSync(mcpsJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
            
            // 保存安装状态到 globalStorage
            await this.saveMcpInstallStatus(serviceName, true);
            
            if (shouldOverwrite) {
                vscode.window.showInformationMessage(`✅ MCP 配置 "${serviceName}" 已更新`);
            } else {
                vscode.window.showInformationMessage(`✅ MCP 配置 "${serviceName}" 已安装`);
            }
            
            Logger.log('[FileService] MCP config installed successfully:', mcpsJsonPath);
        } catch (error: any) {
            Logger.error('[FileService] Failed to write mcp.json:', error);
            vscode.window.showErrorMessage(`写入配置文件失败: ${error.message || error.toString()}`);
        }
    }

    /**
     * 卸载 MCP 配置
     * @param serviceName 服务名称
     * @param config 配置字符串（JSON格式），用于识别要删除的服务
     */
    public static async uninstallMcp(serviceName: string, config: string): Promise<void> {
        Logger.log('[FileService] Uninstalling MCP:', serviceName);

        // MCP 配置目录
        const mcpsDir = path.join(os.homedir(), this.DIR_NAMES.CURSOR);
        const mcpsJsonPath = path.join(mcpsDir, this.DIR_NAMES.MCP_CONFIG);

        // 检查文件是否存在
        if (!fs.existsSync(mcpsJsonPath)) {
            vscode.window.showWarningMessage(`MCP 配置文件不存在: ${mcpsJsonPath}`);
            return;
        }

        // 读取 mcp.json
        let mcpConfig: any = { mcpServers: {} };
        try {
            const content = fs.readFileSync(mcpsJsonPath, 'utf-8');
            mcpConfig = JSON.parse(content);

            // 确保 mcpServers 根节点存在
            if (!mcpConfig.mcpServers) {
                mcpConfig.mcpServers = {};
            }
        } catch (error) {
            Logger.error('[FileService] Failed to parse mcp.json:', error);
            vscode.window.showErrorMessage(`读取配置文件失败: ${error}`);
            return;
        }

        // 解析 config 字符串，获取要删除的服务 key
        let configObj: any = {};
        try {
            if (typeof config === 'string') {
                try {
                    configObj = JSON.parse(config);
                } catch (e) {
                    // 如果解析失败，尝试处理转义字符
                    const unescaped = config.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                    try {
                        configObj = JSON.parse(unescaped);
                    } catch (e2) {
                        throw new Error('无法解析配置格式');
                    }
                }
            } else {
                configObj = config;
            }
        } catch (error: any) {
            Logger.error('[FileService] Failed to parse config:', error);
            vscode.window.showErrorMessage(`配置格式错误: ${error.message || error}`);
            return;
        }

        // 提取 mcpServers 配置中的 key
        let serviceKeys: string[] = [];
        if (configObj.mcpServers) {
            serviceKeys = Object.keys(configObj.mcpServers);
        } else {
            // 如果 config 直接是 mcpServers 对象
            serviceKeys = Object.keys(configObj);
        }

        if (serviceKeys.length === 0) {
            vscode.window.showWarningMessage(`无法从配置中识别要删除的服务`);
            return;
        }

        // 检查哪些服务存在于配置中
        const existingKeys = Object.keys(mcpConfig.mcpServers);
        const keysToRemove = serviceKeys.filter(key => existingKeys.includes(key));

        if (keysToRemove.length === 0) {
            vscode.window.showInformationMessage(`MCP 服务 "${serviceKeys.join(', ')}" 未在配置中找到`);
            return;
        }

        // 确认删除
        const answer = await vscode.window.showWarningMessage(
            `确定要卸载 MCP 服务 "${keysToRemove.join(', ')}" 吗？`,
            { modal: true },
            '确定'
        );

        if (answer !== '确定') {
            return;
        }

        // 删除服务配置
        keysToRemove.forEach(key => {
            delete mcpConfig.mcpServers[key];
            Logger.log('[FileService] Removed MCP service:', key);
        });

        // 写入文件
        try {
            fs.writeFileSync(mcpsJsonPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
            
            // 更新安装状态到 globalStorage
            await this.saveMcpInstallStatus(serviceName, false);
            
            vscode.window.showInformationMessage(`✅ MCP 配置 "${serviceName}" 已卸载`);
            Logger.log('[FileService] MCP config uninstalled successfully:', mcpsJsonPath);
        } catch (error: any) {
            Logger.error('[FileService] Failed to write mcp.json:', error);
            vscode.window.showErrorMessage(`写入配置文件失败: ${error.message || error.toString()}`);
        }
    }

    /**
     * 保存 MCP 安装状态到 globalStorage
     */
    private static async saveMcpInstallStatus(serviceName: string, installed: boolean): Promise<void> {
        if (!this.context) {
            Logger.warn('[FileService] Context not set, cannot save install status');
            return;
        }

        try {
            const installedServices = this.context.globalState.get<Record<string, boolean>>(this.MCP_INSTALLED_KEY, {});
            if (installed) {
                installedServices[serviceName] = true;
            } else {
                delete installedServices[serviceName];
            }
            await this.context.globalState.update(this.MCP_INSTALLED_KEY, installedServices);
            Logger.log('[FileService] Saved MCP install status:', serviceName, installed);
        } catch (error) {
            Logger.error('[FileService] Failed to save install status:', error);
        }
    }

    /**
     * 获取 MCP 安装状态
     */
    public static isMcpInstalled(serviceName: string): boolean {
        if (!this.context) {
            return false;
        }

        try {
            const installedServices = this.context.globalState.get<Record<string, boolean>>(this.MCP_INSTALLED_KEY, {});
            return installedServices[serviceName] === true;
        } catch (error) {
            Logger.error('[FileService] Failed to get install status:', error);
            return false;
        }
    }

    /**
     * 获取所有已安装的 MCP 服务
     */
    public static getAllInstalledMcps(): Record<string, boolean> {
        if (!this.context) {
            return {};
        }

        try {
            return this.context.globalState.get<Record<string, boolean>>(this.MCP_INSTALLED_KEY, {});
        } catch (error) {
            Logger.error('[FileService] Failed to get all installed mcps:', error);
            return {};
        }
    }
}
