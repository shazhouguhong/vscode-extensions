import * as vscode from 'vscode';
import * as util from 'util';
import { LogViewProvider } from './logViewProvider';

/**
 * 日志工具类
 * 使用 Webview Panel 输出日志，提供独立的日志视图
 */
export class Logger {
    private static logProvider: LogViewProvider;

    /**
     * 初始化日志通道
     * @param context 扩展上下文
     */
    public static initialize(context: vscode.ExtensionContext) {
        this.logProvider = new LogViewProvider(context.extensionUri);
        
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                LogViewProvider.viewType,
                this.logProvider,
                {
                    webviewOptions: {
                        retainContextWhenHidden: true
                    }
                }
            )
        );
    }

    /**
     * 格式化时间戳
     * @returns 格式化的时间字符串 YYYY-MM-DD HH:mm:ss.SSS
     */
    private static getTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * 写入日志
     * @param level 日志级别
     * @param message 消息内容
     */
    private static writeLog(level: string, message: string) {
        const timestamp = this.getTimestamp();
        
        if (this.logProvider) {
            this.logProvider.addLog(level, message, timestamp);
        }
        
        // 同时也尝试打印到 Debug Console 作为备份，但不显示在 Output 面板
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * 输出日志信息
     * @param message 日志消息
     * @param args 额外的参数
     */
    public static log(message: string, ...args: any[]): void {
        const formattedMessage = util.format(message, ...args);
        this.writeLog('INFO', formattedMessage);
    }

    /**
     * 输出错误日志
     * @param message 错误消息
     * @param args 额外的参数
     */
    public static error(message: string, ...args: any[]): void {
        const formattedMessage = util.format(message, ...args);
        this.writeLog('ERROR', formattedMessage);
        
        // 错误时尝试聚焦视图
        if (this.logProvider) {
            this.logProvider.show();
        }
    }

    /**
     * 输出警告日志
     * @param message 警告消息
     * @param args 额外的参数
     */
    public static warn(message: string, ...args: any[]): void {
        const formattedMessage = util.format(message, ...args);
        this.writeLog('WARN', formattedMessage);
    }

    /**
     * 输出调试日志
     * @param message 调试消息
     * @param args 额外的参数
     */
    public static debug(message: string, ...args: any[]): void {
        const formattedMessage = util.format(message, ...args);
        this.writeLog('DEBUG', formattedMessage);
    }
}

