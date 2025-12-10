import * as vscode from 'vscode';
import { AICIPanel } from './panel';
import { FileService } from './fileService';
import { Logger } from './logger';

let statusBarItem: vscode.StatusBarItem;

/**
 * 扩展激活入口函数
 */
export function activate(context: vscode.ExtensionContext) {
    // 初始化日志通道
    Logger.initialize(context);

    Logger.log('=============================================');
    Logger.log('[AIBOX] Extension is now active');
    Logger.log(`[AIBOX] Extension path: ${context.extensionPath}`);
    Logger.log(`[AIBOX] Extension globalStorage: ${context.globalStoragePath}`);
    Logger.log(`[AIBOX] Extension storageUri: ${context.storageUri}`);
    Logger.log(`[AIBOX] Extension version: ${context.extension.packageJSON.version}`);
    Logger.log('=============================================');

    // 设置扩展路径到FileService
    FileService.setExtensionPath(context.extensionPath);
    FileService.setContext(context);

    // 初始化 Cursor Chat Histroy 服务
    Logger.log('[AIBOX] CursorChatHistroyService initialized');

    // 创建状态栏按钮
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    
    // VSCode 状态栏只支持 Codicon 图标或 Emoji，不支持自定义图片
    
    // 选项1: 组合图标 - 闪电+电路板（最接近 AI-CI 概念）
    statusBarItem.text = '$(hubot) AIBOX';
    
    // 选项2: 单个图标
    // statusBarItem.text = '$(beaker) AIBOX';        // 烧杯 - 实验
    // statusBarItem.text = '$(hubot) AIBOX';         // 机器人 - AI
    // statusBarItem.text = '$(circuit-board) AIBOX'; // 电路板 - 技术
    
    // 选项3: Emoji（跨平台兼容性最好）
    // statusBarItem.text = '⚡ AIBOX';               // 闪电
    // statusBarItem.text = '🤖 AIBOX';               // 机器人
    // statusBarItem.text = '🚀 AIBOX';               // 火箭
    
    statusBarItem.command = 'ai-box.openPanel';
    statusBarItem.tooltip = 'Go to AI Box';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();
    
    Logger.log('[AIBOX] Status bar item created and shown');

    // 注册打开面板命令
    const openPanelCommand = vscode.commands.registerCommand(
        'ai-box.openPanel',
        () => {
            Logger.log('[AI-CI] Opening AI Box Panel...');
            AICIPanel.createOrShow(context);
        }
    );
    
    
    

    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(openPanelCommand);
    
}

/**
 * 扩展停用函数
 */
export function deactivate() {
    Logger.log('[AI-CI] Extension is being deactivated');
    if (statusBarItem) {
        statusBarItem.dispose();
        Logger.log('[AI-CI] Status bar item disposed');
    }
    Logger.log('[AI-CI] Extension deactivation complete');
}
