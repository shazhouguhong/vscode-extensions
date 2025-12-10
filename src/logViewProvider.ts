import * as vscode from 'vscode';

export class LogViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-box.logView';

    private _view?: vscode.WebviewView;
    private _buffer: { level: string; message: string; timestamp: string }[] = [];

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 监听 Webview 变为可见的状态
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this._buffer.length > 0) {
                this.flushBuffer();
            }
        });

        // 初始加载
        if (this._buffer.length > 0) {
            this.flushBuffer();
        }
    }

    private flushBuffer() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'add-logs', logs: this._buffer });
            this._buffer = [];
        }
    }

    public addLog(level: string, message: string, timestamp: string) {
        const logEntry = { level, message, timestamp };
        
        if (this._view && this._view.visible) {
            this._view.webview.postMessage({ type: 'add-log', log: logEntry });
        } else {
            this._buffer.push(logEntry);
            if (this._buffer.length > 500) {
                this._buffer.shift();
            }
        }
    }

    public show() {
        if (this._view) {
            this._view.show(true);
        } else {
            vscode.commands.executeCommand(LogViewProvider.viewType + '.focus');
        }
    }

    public clear() {
        this._buffer = [];
        if (this._view) {
            this._view.webview.postMessage({ type: 'clear-logs' });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Box Logs</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    font-weight: var(--vscode-editor-font-weight);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    overflow: hidden;
                }
                .toolbar {
                    position: fixed;
                    top: 0;
                    right: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 6px 10px;
                    gap: 8px;
                    background-color: var(--vscode-editor-background);
                    z-index: 100;
                    opacity: 0.9;
                }
                .search-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                    width: 200px;
                }
                .search-input {
                    width: 100%;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 4px 6px;
                    outline: none;
                    font-family: inherit;
                    font-size: inherit;
                }
                .search-input:focus {
                    border-color: var(--vscode-focusBorder);
                }
                .icon-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--vscode-icon-foreground);
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn:hover {
                    background-color: var(--vscode-toolbar-hoverBackground);
                    color: var(--vscode-foreground);
                }
                #log-container {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: auto;
                    padding: 10px;
                }
                .log-entry {
                    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
                    margin-bottom: 2px;
                    white-space: pre;
                    line-height: 1.4;
                    display: flex;
                    align-items: flex-start;
                }
                .log-entry.hidden {
                    display: none !important;
                }
                .timestamp {
                    color: var(--vscode-descriptionForeground);
                    margin-right: 8px;
                    font-size: 0.85em;
                    flex-shrink: 0;
                    white-space: nowrap;
                }
                .level {
                    font-weight: bold;
                    margin-right: 8px;
                    flex-shrink: 0;
                    min-width: 60px;
                }
                .message {
                    flex-grow: 1;
                }
                .level-INFO { color: var(--vscode-terminal-ansiGreen); }
                .level-WARN { color: var(--vscode-terminal-ansiYellow); }
                .level-ERROR { color: var(--vscode-terminal-ansiRed); }
                .level-DEBUG { color: var(--vscode-terminal-ansiBlue); }
                
                /* Scrollbar styling to match VSCode */
                ::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }
                ::-webkit-scrollbar-thumb {
                    background: var(--vscode-scrollbarSlider-background);
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: var(--vscode-scrollbarSlider-hoverBackground);
                }
                ::-webkit-scrollbar-thumb:active {
                    background: var(--vscode-scrollbarSlider-activeBackground);
                }
            </style>
        </head>
        <body>
            <div class="toolbar">
                <div class="search-container">
                    <input type="text" id="search-input" class="search-input" placeholder="Filter logs...">
                </div>
                <button id="clear-btn" class="icon-btn" title="Clear Output">
                    <svg width="20" height="20" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H7v1h2V2zM4 13h8V4H4v9zm2-8h1v7H6V5zm3 0h1v7H9V5z"/>
                    </svg>
                </button>
            </div>
            <div id="log-container"></div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const container = document.getElementById('log-container');
                const searchInput = document.getElementById('search-input');
                const clearBtn = document.getElementById('clear-btn');
                
                let filterTerm = '';

                function appendLog(log) {
                    const entryDiv = document.createElement('div');
                    entryDiv.className = 'log-entry';
                    
                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'timestamp';
                    timestampSpan.textContent = '[' + log.timestamp + ']';
                    
                    const levelSpan = document.createElement('span');
                    levelSpan.className = 'level level-' + log.level;
                    levelSpan.textContent = '[' + log.level + ']';
                    
                    const messageSpan = document.createElement('span');
                    messageSpan.className = 'message';
                    messageSpan.textContent = log.message;
                    
                    entryDiv.appendChild(timestampSpan);
                    entryDiv.appendChild(levelSpan);
                    entryDiv.appendChild(messageSpan);
                    
                    // Apply current filter
                    if (filterTerm) {
                        const text = (log.timestamp + ' ' + log.level + ' ' + log.message).toLowerCase();
                        if (!text.includes(filterTerm)) {
                            entryDiv.classList.add('hidden');
                        }
                    }

                    container.appendChild(entryDiv);
                    
                    // Limit log count to 1000
                    while (container.children.length > 1000) {
                        container.removeChild(container.firstElementChild);
                    }
                    
                    // Auto scroll if near bottom or always
                    if (!entryDiv.classList.contains('hidden')) {
                        entryDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                }

                function filterLogs() {
                    filterTerm = searchInput.value.toLowerCase();
                    const entries = container.getElementsByClassName('log-entry');
                    for (let entry of entries) {
                        if (entry.textContent.toLowerCase().includes(filterTerm)) {
                            entry.classList.remove('hidden');
                        } else {
                            entry.classList.add('hidden');
                        }
                    }
                }
                
                function clearLogs() {
                    container.innerHTML = '';
                }

                searchInput.addEventListener('input', filterLogs);
                
                clearBtn.addEventListener('click', () => {
                    clearLogs();
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'add-log':
                            appendLog(message.log);
                            break;
                        case 'add-logs':
                            message.logs.forEach(log => appendLog(log));
                            break;
                        case 'clear-logs':
                            clearLogs();
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
