const vscode = acquireVsCodeApi();
let commandsData = []; // Tasks list
let commandsListData = []; // Commands list
let mcpsData = [];
let rulesData = [];
let labelsData = []; // Labels list
let allMcpsData = []; // 存储所有 MCP 数据用于前端筛选
let currentCategory = 'all'; // 当前选中的分类
let currentSearchText = ''; // 当前搜索文本
let mcpConfigsMap = {}; // 存储 MCP config 数据，key 为 serviceName

// 统一事件委托 - 处理所有点击事件
document.addEventListener('click', (e) => {
    const target = e.target;
    
        // 处理获取 Cursor 登录信息按钮
        if (target.id === 'get-cursor-login-btn') {
            console.log('[WebView] Get Cursor login info button clicked');
            vscode.postMessage({ type: 'getCursorLoginInfo' });
            return;
        }
        
        // 处理获取聊天历史按钮
        if (target.id === 'fetch-chat-history-btn') {
            console.log('[WebView] Fetch chat history button clicked');
            vscode.postMessage({ type: 'fetchChatHistory', filters: { limit: 20 } });
            return;
        }

        // 处理发送聊天消息按钮
        if (target.id === 'send-chat-message-btn') {
            console.log('[WebView] Send chat message button clicked');
            // 直接发送固定消息
            vscode.postMessage({
                type: 'sendChatMessage',
                message: '你好，Cursor！',
                waitForResponse: false
            });
            return;
        }
    
    // 处理 Tab 切换
    if (target.classList.contains('tab')) {
        const tabName = target.dataset.tab;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        target.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
        
        // 切换到对应 tab 时加载数据
        if (tabName === 'commands' && (!commandsData || (Array.isArray(commandsData) && commandsData.length === 0))) {
            vscode.postMessage({ type: 'fetchCommands' });
        } else if (tabName === 'commands-list') {
            if (!commandsListData || (Array.isArray(commandsListData) && commandsListData.length === 0)) {
                vscode.postMessage({ type: 'fetchCommandsList' });
            }
            // 如果 labels 数据未加载，则加载 labels
            if (!labelsData || labelsData.length === 0) {
                vscode.postMessage({ type: 'fetchLabels' });
            }
        } else if (tabName === 'mcps' && (!mcpsData || allMcpsData.length === 0)) {
            vscode.postMessage({ type: 'fetchMcps' });
        } else if (tabName === 'rules' && (!rulesData || (Array.isArray(rulesData) && rulesData.length === 0))) {
            vscode.postMessage({ type: 'fetchRules' });
        }
        return;
    }
    
    // 处理搜索和重置按钮
    if (target.classList.contains('btn-search') || target.classList.contains('btn-reset')) {
        const action = target.getAttribute('data-action');
        const targetType = target.getAttribute('data-target');
        
        if (action === 'search') {
            if (targetType === 'commands') {
                searchCommands();
            } else if (targetType === 'commands-list') {
                searchCommandsList();
            } else if (targetType === 'mcps') {
                searchMcps();
            } else if (targetType === 'rules') {
                searchRules();
            }
        } else if (action === 'reset') {
            if (targetType === 'commands') {
                resetCommandsFilter();
            } else if (targetType === 'commands-list') {
                resetCommandsListFilter();
            } else if (targetType === 'mcps') {
                resetMcpsFilter();
            } else if (targetType === 'rules') {
                resetRulesFilter();
            }
        }
        return;
    }

    // 处理 MCP 分类点击
    if (target.classList.contains('category-item') || target.closest('.category-item')) {
        const categoryItem = target.classList.contains('category-item') ? target : target.closest('.category-item');
        const category = categoryItem.getAttribute('data-category');
        if (category) {
            selectCategory(category);
        }
        return;
    }

    // 处理 MCP 搜索按钮
    if (target.id === 'mcp-search-btn' || target.closest('#mcp-search-btn')) {
        performMcpSearch();
        return;
    }

    // 处理顶部导航链接
    if (target.classList.contains('nav-link')) {
        const nav = target.getAttribute('data-nav');
        if (nav) {
            selectNav(nav);
        }
        return;
    }
    
    // 处理查看详情按钮
    if (target.classList.contains('btn-view-detail') || target.closest('.btn-view-detail')) {
        const detailBtn = target.classList.contains('btn-view-detail') ? target : target.closest('.btn-view-detail');
        const serviceName = detailBtn.getAttribute('data-service-name');
        const serviceCard = detailBtn.closest('.service-card');
        
        if (serviceCard) {
            const detailSection = serviceCard.querySelector('.service-detail-section');
            if (detailSection) {
                const isVisible = detailSection.style.display !== 'none';
                detailSection.style.display = isVisible ? 'none' : 'block';
                detailBtn.textContent = isVisible ? '查看详情' : '收起详情';
            }
        }
        return;
    }

    // 处理复制配置按钮
    if (target.classList.contains('btn-copy-config') || target.closest('.btn-copy-config')) {
        const copyBtn = target.classList.contains('btn-copy-config') ? target : target.closest('.btn-copy-config');
        const serviceName = copyBtn.getAttribute('data-service-name');
        
        // 从 map 中获取配置文本
        let configText = serviceName && mcpConfigsMap[serviceName] ? mcpConfigsMap[serviceName] : '';
        
        // 如果 map 中没有，尝试从 pre 元素中获取
        if (!configText || configText.trim() === '') {
            const configPre = copyBtn.closest('.service-config-section')?.querySelector('.service-config-content');
            if (configPre) {
                configText = configPre.textContent || configPre.innerText || '';
            }
        }
        
        if (configText) {
            // 复制到剪贴板
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(configText).then(() => {
                    // 显示复制成功提示
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✅ 已复制';
                    copyBtn.style.color = 'var(--vscode-textLink-foreground)';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.color = '';
                    }, 2000);
                }).catch(err => {
                    console.error('[WebView] Failed to copy config:', err);
                    // 降级方案
                    copyToClipboardFallback(configText, copyBtn);
                });
            } else {
                // 降级方案
                copyToClipboardFallback(configText, copyBtn);
            }
        }
        return;
    }

    // 处理 Rules 和 Commands 按钮
    if (target.classList.contains('btn-action-small') && target.hasAttribute('data-action')) {
        const action = target.getAttribute('data-action');
        const file_type = target.getAttribute('data-scope');
        const name = target.getAttribute('data-name');
        const oss_url = target.getAttribute('data-oss_url');
        const level = target.getAttribute('data-level');
        console.log('[WebView] Action button clicked:', { action, file_type, name, oss_url, level });
        
        if (action === 'openRules') {
            console.log('[WebView] openRules clicked:', { level, name, oss_url });
            vscode.postMessage({
                type: 'openRules',
                level: level,
                name: name,
                oss_url: oss_url
            });
        } else if (action === 'openCommands') {
            vscode.postMessage({
                type: 'openCommands',
                level: level,
                name: name,
                oss_url: oss_url
            });
        } else if (action === 'uninstallCommand') {
            vscode.postMessage({
                type: 'uninstallCommand',
                level: level,
                name: name
            });
        } else if (action === 'uninstallRule') {
            vscode.postMessage({
                type: 'uninstallRule',
                level: level,
                name: name
            });
        } else if (action === 'runCommand') {
            const fileName = target.getAttribute('data-name');
            const taskId = target.getAttribute('data-task-id');
            const gitRepoUrl = target.getAttribute('data-git-repo-url');
            vscode.postMessage({
                type: 'checkGitAndRunCommand',
                message: fileName,
                taskId: taskId,
                gitRepoUrl: gitRepoUrl
            });
        } else if (action === 'openMcps') {
            vscode.postMessage({
                type: 'openMcps',
                file_type: file_type,
                name: name,
                oss_url: oss_url
            });
        } else if (action === 'installMcp') {
            const serviceName = target.getAttribute('data-service-name');
            const config = target.getAttribute('data-config');
            console.log('[WebView] Install MCP button clicked:', { serviceName, config });
            if (serviceName && config) {
                vscode.postMessage({
                    type: 'installMcp',
                    serviceName: serviceName,
                    config: config
                });
            }
        } else if (action === 'uninstallMcp') {
            const serviceName = target.getAttribute('data-service-name');
            const config = target.getAttribute('data-config');
            console.log('[WebView] Uninstall MCP button clicked:', { serviceName, config });
            if (serviceName && config) {
                vscode.postMessage({
                    type: 'uninstallMcp',
                    serviceName: serviceName,
                    config: config
                });
            }
        } else if (action === 'completeTask') {
            const taskId = target.getAttribute('data-task-id');
            console.log('[WebView] Complete task button clicked:', taskId);
            if (taskId) {
                vscode.postMessage({
                    type: 'transitionTask',
                    taskId: taskId,
                    status: 'completed'
                });
            }
        }
        return;
    }

    // 处理分页按钮
    if (target.classList.contains('btn-pagination') && target.hasAttribute('data-action')) {
        const action = target.getAttribute('data-action');
        const dataType = target.getAttribute('data-type');

        if (action === 'prev-page' || action === 'next-page') {
            handlePagination(action, dataType);
        }
        return;
    }
});

// 初始化事件监听器
initializeCommandToggle();

// 初始加载 commands 数据
vscode.postMessage({ type: 'fetchCommands' });

// 接收来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    console.log('[WebView] Received message:', message.type);
    console.log('[WebView] Message data:', message.data);
    
    switch (message.type) {
        case 'appIdConfig':
            console.log('[WebView] Received appId config:', message.data);
            updateAppIdFilter(message.data);
            break;
        case 'commandsData':
            console.log('[WebView] Processing commandsData');
            commandsData = message.data;
            renderCommands(commandsData);
            break;
        case 'commandsListData':
            console.log('[WebView] Processing commandsListData');
            commandsListData = message.data;
            renderCommandsList(commandsListData);
            break;
        case 'labelsData':
            console.log('[WebView] Processing labelsData');
            labelsData = message.data;
            updateLabelsFilter(labelsData);
            break;
        case 'mcpsData':
            console.log('[WebView] Processing mcpsData');
            console.log('[WebView] Data type:', typeof message.data);
            console.log('[WebView] Data is array:', Array.isArray(message.data));
            console.log('[WebView] Data length:', message.data ? message.data.length : 'null/undefined');
            mcpsData = message.data;
            // 保存所有数据用于前端筛选
            const items = Array.isArray(mcpsData) ? mcpsData : (mcpsData.data || []);
            allMcpsData = items;
            renderMcps(mcpsData);
            updateCategoryCounts(items);
            break;
        case 'rulesData':
            console.log('[WebView] Processing rulesData');
            console.log('[WebView] Data type:', typeof message.data);
            console.log('[WebView] Data is array:', Array.isArray(message.data));
            console.log('[WebView] Data length:', message.data ? message.data.length : 'null/undefined');
            rulesData = message.data;
            renderRules(rulesData);
            break;
        case 'cursorLoginInfo':
            console.log('[WebView] Received Cursor login info:', message.data);
            if (message.data.error) {
                console.error('[WebView] Error getting login info:', message.data.error);
            } else {
                console.log('[WebView] Email:', message.data.email);
                console.log('[WebView] Sign Up Type:', message.data.signUpType);
                console.log('[WebView] Access Token:', message.data.accessToken);
            }
            break;
        case 'chatHistoryData':
            console.log('[WebView] Received chat history data:', message.data);
            console.log('[WebView] Number of conversations:', message.data ? message.data.length : 0);
            if (message.data && message.data.length > 0) {
                message.data.forEach((conv, index) => {
                    console.log(`[WebView] Conversation ${index + 1}:`, {
                        id: conv.id,
                        title: conv.title,
                        messageCount: conv.messages ? conv.messages.length : 0
                    });
                });
            }
            break;
        case 'commandInstalledStatus':
            console.log('[WebView] Received command installed status:', message.data);
            updateCommandButtonState(message.data);
            break;
        case 'ruleInstalledStatus':
            console.log('[WebView] Received rule installed status:', message.data);
            updateRuleButtonState(message.data);
            break;
        case 'allInstalledMcps':
            console.log('[WebView] Received all installed MCPs:', message.data);
            updateAllMcpButtonStates(message.data);
            break;
        case 'mcpInstalledStatus':
            console.log('[WebView] Received MCP installed status:', message.data);
            updateMcpButtonState(message.data);
            break;
        default:
            console.warn('[WebView] Unknown message type:', message.type);
    }
});

// 搜索 Tasks
function searchCommands() {
    const appId = document.getElementById('task-appid-filter').value.trim();
    const assigner = document.getElementById('task-assigner-filter').value.trim();
    const executor = document.getElementById('task-executor-filter').value.trim();
    const status = document.getElementById('task-status-filter').value;
    const level = document.getElementById('task-level-filter').value;
    const page = commandsData.page || 1;

    vscode.postMessage({
        type: 'fetchCommands',
        filters: { appId, assigner, executor, status, level, page }
    });
}

// 重置 Tasks 筛选
function resetCommandsFilter() {
    document.getElementById('task-appid-filter').value = '';
    document.getElementById('task-assigner-filter').value = '';
    document.getElementById('task-executor-filter').value = '';
    document.getElementById('task-status-filter').value = '';
    document.getElementById('task-level-filter').value = '';
    commandsData.page = 1;
    vscode.postMessage({ type: 'fetchCommands', filters: { appId: '', assigner: '', executor: '', status: '', level: '', page: 1 } });
}

// 搜索 Commands List
function searchCommandsList() {
    const keyword = document.getElementById('cmd-list-keyword-filter').value.trim();
    const level = document.getElementById('cmd-list-level-filter').value;
    const labelsSelect = document.getElementById('cmd-list-labels-filter');
    const labels = labelsSelect ? parseInt(labelsSelect.value) : 0;
    const page = 1;

    vscode.postMessage({
        type: 'fetchCommandsList',
        filters: { keyword, level, labels, page }
    });
}

// 重置 Commands List 筛选
function resetCommandsListFilter() {
    document.getElementById('cmd-list-keyword-filter').value = '';
    document.getElementById('cmd-list-level-filter').value = '';
    const labelsSelect = document.getElementById('cmd-list-labels-filter');
    if (labelsSelect) {
        labelsSelect.value = '0';
    }
    commandsListData.page = 1;
    vscode.postMessage({ type: 'fetchCommandsList', filters: { keyword: '', level: '', labels: 0, page: 1 } });
}

// 搜索 MCPs
function searchMcps() {
    const name = document.getElementById('mcp-name-filter')?.value.trim() || '';
    const scope = document.getElementById('mcp-scope-filter')?.value || '';
    const page = 1; // 搜索时重置到第一页

    vscode.postMessage({
        type: 'fetchMcps',
        filters: { name, scope, page }
    });
}

// 重置 MCPs 筛选
function resetMcpsFilter() {
    const nameInput = document.getElementById('mcp-name-filter');
    const scopeSelect = document.getElementById('mcp-scope-filter');
    if (nameInput) nameInput.value = '';
    if (scopeSelect) scopeSelect.value = '';
    vscode.postMessage({ type: 'fetchMcps', filters: { name: '', scope: '', page: 1 } });
}

// MCP 前端搜索（基于已加载的数据）
function performMcpSearch() {
    const searchInput = document.getElementById('mcp-name-filter');
    if (searchInput) {
        currentSearchText = searchInput.value.trim();
        filterAndRenderMcps();
    }
}

// 选择分类
function selectCategory(category) {
    currentCategory = category;
    
    // 更新分类项的 active 状态
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    const categoryItem = document.querySelector(`.category-item[data-category="${category}"]`);
    if (categoryItem) {
        categoryItem.classList.add('active');
    }
    
    filterAndRenderMcps();
}

// 选择顶部导航
function selectNav(nav) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const navLink = document.querySelector(`.nav-link[data-nav="${nav}"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    // 这里可以根据不同的导航显示不同的内容
}

// 筛选并渲染 MCPs
function filterAndRenderMcps() {
    // 确保 allMcpsData 是数组
    if (!Array.isArray(allMcpsData)) {
        allMcpsData = [];
    }
    
    let filteredItems = [...allMcpsData];
    
    // 按分类筛选
    if (currentCategory !== 'all') {
        filteredItems = filteredItems.filter(item => {
            if (!item) return false;
            const category = getItemCategory(item);
            return category === currentCategory;
        });
    }
    
    // 按名称搜索筛选
    if (currentSearchText) {
        const searchLower = currentSearchText.toLowerCase();
        filteredItems = filteredItems.filter(item => {
            if (!item) return false;
            const name = (item.serviceName || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            return name.includes(searchLower) || description.includes(searchLower);
        });
    }
    
    // 渲染筛选后的数据
    renderMcpsCards(filteredItems);
}

// 获取服务项的分类
function getItemCategory(item) {
    // 安全检查
    if (!item || typeof item !== 'object') {
        return 'other';
    }
    
    // 根据 item 的 tags 字段判断分类
    const tags = Array.isArray(item.tags) ? item.tags : [];
    
    // 检查是否是精选服务
    if (tags.includes('精选服务') || tags.includes('featured')) {
        return 'featured';
    }
    
    // 检查其他分类 - 根据 tags 数组中的值匹配
    const categoryMap = {
        '代码质量': 'code-quality',
        '文档与学习': 'documentation',
        '设计与开发工具': 'design-tools',
        '监控与分析': 'monitoring',
        '源码管理': 'source-control',
        '数据库与存储': 'database',
        '部署与云服务': 'deployment',
        '自动化与集成': 'automation',
        '其他': 'other'
    };
    
    // 检查 tags 数组中的每个标签
    for (const tag of tags) {
        if (tag === '精选服务' || tag === 'featured') {
            continue; // 已处理
        }
        if (categoryMap[tag]) {
            return categoryMap[tag];
        }
    }
    
    return 'other';
}

// 更新分类计数
function updateCategoryCounts(items) {
    // 确保 items 是数组
    if (!Array.isArray(items)) {
        items = [];
    }
    
    const counts = {
        'all': items.length,
        'featured': 0,
        'code-quality': 0,
        'documentation': 0,
        'design-tools': 0,
        'monitoring': 0,
        'source-control': 0,
        'database': 0,
        'deployment': 0,
        'automation': 0,
        'other': 0
    };
    
    items.forEach(item => {
        if (!item) return;
        const category = getItemCategory(item);
        if (category !== 'all' && counts[category] !== undefined) {
            counts[category]++;
        }
    });
    
    // 更新 UI
    Object.keys(counts).forEach(category => {
        const countElement = document.getElementById(`count-${category}`);
        if (countElement) {
            countElement.textContent = counts[category];
        }
    });
}

// 搜索 Rules
function searchRules() {
    const name = document.getElementById('rule-name-filter').value.trim();
    const scope = document.getElementById('rule-level-filter').value; // Using new Level filter (mapped to scope)
    const page = 1; 

    vscode.postMessage({
        type: 'fetchRules',
        filters: { name, scope, page }
    });
}

// 重置 Rules 筛选
function resetRulesFilter() {
    document.getElementById('rule-name-filter').value = '';
    document.getElementById('rule-level-filter').value = '';
    vscode.postMessage({ type: 'fetchRules', filters: { name: '', scope: '', page: 1 } });
}

// 统一事件委托 - 处理回车键搜索
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const target = e.target;
        
        if (target.id === 'cmd-name-filter') {
            searchCommands();
        } else if (target.id === 'cmd-list-keyword-filter') {
            searchCommandsList();
        } else if (target.id === 'mcp-name-filter') {
            // MCP 搜索使用前端筛选
            performMcpSearch();
        } else if (target.id === 'rule-name-filter') {
            searchRules();
        }
    }
});

// 监听 MCP 搜索输入框的输入事件（实时搜索）
document.addEventListener('input', (e) => {
    if (e.target.id === 'mcp-name-filter') {
        currentSearchText = e.target.value.trim();
        filterAndRenderMcps();
    }
});

function renderCommands(data) {
    console.log('[WebView] renderCommands called with data:', data);
    const container = document.getElementById('commands-tab');
    const filterSection = container.querySelector('.filter-section');

    // 处理分页数据结构
    let items = [];
    let total = 0;
    let currentPage = 1;

    if (Array.isArray(data)) {
        // 向后兼容：如果传入的是数组，直接使用
        items = data;
        total = data.length;
        currentPage = 1;
        console.log('[WebView] Received array data - total:', total, 'items length:', items.length);
    } else if (data && typeof data === 'object') {
        // 分页数据结构
        items = data.data || [];
        total = data.total !== undefined ? data.total : items.length;
        currentPage = data.page || 1;
        console.log('[WebView] Received object data - total:', total, 'page:', currentPage, 'items length:', items.length);
    }

    if (!items || items.length === 0) {
        console.log('[WebView] No tasks & commands data to render (empty or null)');
        const emptyHtml = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div>No tasks available</div>
                <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 8px;">Tasks with associated commands will be displayed here</div>
            </div>
        `;
        container.innerHTML = '';
        if (filterSection) {
            container.appendChild(filterSection);
        }
        container.insertAdjacentHTML('beforeend', emptyHtml);
        return;
    }

    console.log('[WebView] Rendering', items.length, 'tasks with commands (total:', total, ', page:', currentPage, ')');

    const html = `
        <div class="table-container">
            <table class="task-command-table">
                <thead>
                    <tr>
                        <th style="width: 20%">Task Title</th>
                        <th style="width: 12%">Assigner</th>
                        <th style="width: 12%">Executor</th>
                        <th style="width: 10%">Status</th>
                        <th style="width: 10%">Level</th>
                        <th style="width: 16%">Task Updated At</th>
                        <th style="width: 20%; text-align: right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const taskId = escapeHtml(item.id);
                        const taskTitle = escapeHtml(item.title);
                        const taskDescription = escapeHtml(item.description || '');
                        const assigner = escapeHtml(item.assigner || '');
                        const executor = escapeHtml(item.executor || '');
                        const status = escapeHtml(item.status || 'pending');
                        const level = escapeHtml(item.level || item.command?.level || '');
                        const taskUpdatedAt = escapeHtml(item.updated_at);
                        const gitRepoUrl = escapeHtml(item.git_repo_url || '');
                        const gitBranch = escapeHtml(item.git_branch || '');

                        // 任务行
                        let taskRow = `
                            <tr class="task-row" data-task-id="${taskId}">
                                <td>
                                    <div class="task-title">${taskTitle}</div>
                                    <div class="task-description">${taskDescription}</div>
                                </td>
                                <td>${assigner}</td>
                                <td>${executor}</td>
                                <td><span class="status-badge status-${status}">${status}</span></td>
                                <td><span class="level-badge">${level}</span></td>
                                <td>${new Date(taskUpdatedAt).toLocaleString()}</td>
                                <td style="text-align: right">
                                    <button class="btn-action-small complete-task-btn" data-action="completeTask" data-task-id="${taskId}" title="Complete Task" style="margin-right: 4px;">完成</button>
                                    <button class="btn-action-small toggle-command" data-task-id="${taskId}" title="Toggle Command Details">📋</button>
                                </td>
                            </tr>
                        `;

                        // 如果有command信息，添加command子行
                        if (item.command) {
                            const command = item.command;
                            const commandId = escapeHtml(command.id);
                            const fileName = escapeHtml(command.file_name);
                            // 移除 .md 扩展名以保持与后端一致
                            const fileNameWithoutExt = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
                            const commandDescription = escapeHtml(command.description || '');
                            const downloadUrl = escapeHtml(command.download_url || '');
                            const commandUpdatedAt = escapeHtml(command.updated_at);
                            const commandLevel = escapeHtml(command.level || item.level || 'user');
                            // 为每个command生成唯一ID用于后续更新按钮状态
                            const commandKey = `cmd_${fileNameWithoutExt}_${commandLevel}`;

                            taskRow += `
                                <tr class="command-row" data-task-id="${taskId}" style="display: none;">
                                    <td colspan="7" class="command-details">
                                        <div class="command-info">
                                            <div class="command-header">
                                                <h4>📄 ${fileName}</h4>
                                                <div class="command-actions" data-container-key="${commandKey}">
                                                    <button class="btn-action-small install-btn" data-action="openCommands"
                                                            data-name="${fileName}"
                                                            data-oss_url="${downloadUrl}"
                                                            data-level="${commandLevel}"
                                                            data-command-key="${commandKey}"
                                                            title="Install Command">安装</button>
                                                    <button class="btn-action-small uninstall-btn" data-action="uninstallCommand"
                                                            data-name="${fileNameWithoutExt}"
                                                            data-level="${commandLevel}"
                                                            data-command-key="${commandKey}"
                                                            title="Uninstall Command" style="display: none; margin-left: 8px;">卸载</button>
                                                    <button class="btn-action-small run-btn" data-action="runCommand"
                                                            data-name="${fileName}"
                                                            data-task-id="${taskId}"
                                                            data-command-key="${commandKey}"
                                                            data-git-repo-url="${gitRepoUrl}"
                                                            title="Run Command" style="display: none; margin-left: 8px;">运行</button>
                                                </div>
                                            </div>
                                            <div class="command-meta">
                                                <span class="command-desc">${commandDescription}</span>
                                                <span class="command-updated">Updated: ${new Date(commandUpdatedAt).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        } else {
                            // 没有command信息时显示提示
                            taskRow += `
                                <tr class="command-row no-command" data-task-id="${taskId}" style="display: none;">
                                    <td colspan="7" class="command-details">
                                        <div class="no-command-info">
                                            <span>⚠️ No command associated with this task</span>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }

                        return taskRow;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(total, currentPage, 'commands')}
    `;

    container.innerHTML = '';
    if (filterSection) {
        container.appendChild(filterSection);
    }
    container.insertAdjacentHTML('beforeend', html);

    // 检查每个command的安装状态
    items.forEach(item => {
        if (item.command) {
            const fileName = item.command.file_name;
            // 移除 .md 扩展名以保持与后端一致
            const fileNameWithoutExt = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
            const commandLevel = item.command.level || item.level || 'user';
            
            // 发送检查消息
            vscode.postMessage({
                type: 'checkCommandInstalled',
                name: fileNameWithoutExt,
                level: commandLevel
            });
        }
    });
}

function renderCommandsList(data) {
    console.log('[WebView] renderCommandsList called with data:', data);
    const container = document.getElementById('commands-list-tab');
    const filterSection = container.querySelector('.filter-section');

    let items = [];
    let total = 0;
    let currentPage = 1;

    if (data && typeof data === 'object') {
        items = data.data || [];
        total = data.total !== undefined ? data.total : items.length;
        currentPage = data.page || 1;
    } else if (Array.isArray(data)) {
        items = data;
        total = data.length;
    }

    if (!items || items.length === 0) {
        const emptyHtml = `
            <div class="empty-state">
                <div class="empty-state-icon">💻</div>
                <div>No commands available</div>
            </div>
        `;
        container.innerHTML = '';
        if (filterSection) container.appendChild(filterSection);
        container.insertAdjacentHTML('beforeend', emptyHtml);
        return;
    }

    const html = `
        <div class="table-container">
            <table class="task-command-table">
                <thead>
                    <tr>
                        <th style="width: 30%">Command Name</th>
                        <th style="width: 40%">Description</th>
                        <th style="width: 15%">Updated At</th>
                        <th style="width: 15%; text-align: right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const name = escapeHtml(item.file_name);
                        // 移除 .md 扩展名以保持与后端一致
                        const nameWithoutExt = name.endsWith('.md') ? name.slice(0, -3) : name;
                        const level = escapeHtml(item.level || 'user');
                        const description = escapeHtml(item.description || '');
                        const updatedAt = escapeHtml(item.updated_at);
                        const downloadUrl = escapeHtml(item.download_url || '');
                        
                        const commandKey = `cmd_${nameWithoutExt}_${level}`;

                        return `
                            <tr>
                                <td>
                                    <div class="task-title">${name}</div>
                                </td>
                                <td>${description}</td>
                                <td>${new Date(updatedAt).toLocaleString()}</td>
                                <td style="text-align: right">
                                    <div class="command-actions" data-container-key="${commandKey}">
                                        <button class="btn-action-small install-btn" data-action="openCommands"
                                                data-name="${name}"
                                                data-oss_url="${downloadUrl}"
                                                data-level="${level}"
                                                data-command-key="${commandKey}"
                                                title="Install Command">安装</button>
                                        <button class="btn-action-small uninstall-btn" data-action="uninstallCommand"
                                                data-name="${nameWithoutExt}"
                                                data-level="${level}"
                                                data-command-key="${commandKey}"
                                                title="Uninstall Command" style="display: none; margin-left: 8px;">卸载</button>
                                        <button class="btn-action-small run-btn" data-action="runCommand"
                                                data-name="${name}"
                                                data-command-key="${commandKey}"
                                                title="Run Command" style="display: none; margin-left: 8px;">运行</button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(total, currentPage, 'commands-list')}
    `;

    container.innerHTML = '';
    if (filterSection) container.appendChild(filterSection);
    container.insertAdjacentHTML('beforeend', html);

    // Check installation status
    items.forEach(item => {
        const name = item.file_name;
        // 移除 .md 扩展名以保持与后端一致
        const nameWithoutExt = name.endsWith('.md') ? name.slice(0, -3) : name;
        const level = item.level || 'user';
        vscode.postMessage({
            type: 'checkCommandInstalled',
            name: nameWithoutExt,
            level: level
        });
    });
}

function renderMcps(data) {
    console.log('[WebView] renderMcps called with data:', data);
    
    // 处理分页数据结构
    let items = [];
    if (Array.isArray(data)) {
        items = data;
    } else if (data && typeof data === 'object') {
        items = data.data || [];
    }
    
    // 保存所有数据
    allMcpsData = items;
    
    // 更新分类计数
    updateCategoryCounts(items);
    
    // 渲染卡片
    filterAndRenderMcps();
}

// 渲染 MCP 卡片
function renderMcpsCards(items) {
    const container = document.getElementById('mcp-cards-container');
    if (!container) {
        console.error('[WebView] MCP cards container not found');
        return;
    }
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔧</div>
                <div>暂无服务</div>
            </div>
        `;
        return;
    }
    
    const cardsHtml = items.map(item => {
        const serviceName = escapeHtml(item.serviceName || '');
        const description = escapeHtml(item.description || '');
        const updatedBy = escapeHtml(item.updatedBy || '');
        const updatedAt = item.updatedAt || '';
        const config = item.config || '';
        const tags = Array.isArray(item.tags) ? item.tags : [];
        const category = getItemCategory(item);
        
        // 格式化更新时间
        let updatedAtText = '';
        if (updatedAt) {
            try {
                const date = new Date(updatedAt);
                updatedAtText = date.toLocaleString('zh-CN');
            } catch (e) {
                updatedAtText = updatedAt;
            }
        }
        
        // 构建标签 HTML
        let tagsHtml = '';
        const isFeatured = tags.includes('精选服务') || tags.includes('featured') || category === 'featured';
        if (isFeatured) {
            tagsHtml += '<span class="service-tag featured">精选服务</span>';
        }
        
        // 添加分类标签
        const categoryNames = {
            'code-quality': '代码质量',
            'documentation': '文档与学习',
            'design-tools': '设计与开发工具',
            'monitoring': '监控与分析',
            'source-control': '源码管理',
            'database': '数据库与存储',
            'deployment': '部署与云服务',
            'automation': '自动化与集成',
            'other': '其他'
        };
        
        if (category !== 'all' && category !== 'featured' && categoryNames[category]) {
            tagsHtml += `<span class="service-tag category">${categoryNames[category]}</span>`;
        }
        
        // 如果没有标签，尝试从 tags 数组中获取
        if (!tagsHtml && tags.length > 0) {
            tags.forEach(tag => {
                if (tag !== '精选服务' && tag !== 'featured') {
                    tagsHtml += `<span class="service-tag category">${escapeHtml(tag)}</span>`;
                }
            });
        }
        
        // 格式化 config JSON（存储在 map 中，不默认显示）
        let formattedConfig = '';
        if (config) {
            try {
                // 尝试解析和格式化 JSON
                let configObj;
                if (typeof config === 'string') {
                    try {
                        configObj = JSON.parse(config);
                    } catch (e) {
                        // 如果解析失败，尝试处理转义字符
                        const unescaped = config.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        try {
                            configObj = JSON.parse(unescaped);
                        } catch (e2) {
                            // 如果还是失败，使用原始字符串
                            configObj = config;
                        }
                    }
                } else {
                    configObj = config;
                }
                
                // 格式化 JSON
                formattedConfig = typeof configObj === 'string' ? configObj : JSON.stringify(configObj, null, 2);
                
                // 存储到 map 中，使用 serviceName 作为 key
                mcpConfigsMap[serviceName] = formattedConfig;
            } catch (e) {
                // 如果格式化失败，使用原始内容
                formattedConfig = config;
                mcpConfigsMap[serviceName] = config;
            }
        }
        
        // 生成配置详情 HTML（默认隐藏）
        const escapedConfig = formattedConfig ? escapeHtml(formattedConfig) : '';
        const configDetailHtml = formattedConfig ? `
            <div class="service-detail-section" style="display: none;">
                <div class="service-description-detail">
                    <div class="service-detail-label">服务描述</div>
                    <div class="service-detail-text">${description}</div>
                </div>
                <div class="service-config-section">
                    <div class="service-config-header">
                        <span class="service-config-label">配置信息</span>
                        <button class="btn-copy-config" 
                                data-service-name="${serviceName}"
                                title="复制配置">📋 复制</button>
                    </div>
                    <pre class="service-config-content">${escapedConfig}</pre>
                </div>
            </div>
        ` : '';
        
        return `
            <div class="service-card" data-service-name="${serviceName}">
                <div class="service-card-header">
                    <div class="service-icon"><img src="https://ci-gateway-ui-v.huolala.work/static/media/huolala-icon.57580193.ico"/></div>
                    <div style="flex: 1;">
                        <div class="service-name">${serviceName}</div>
                        <div class="service-meta">
                            <span class="service-updated-by">更新人: ${updatedBy}</span>
                            <span class="service-updated-at">更新时间: ${updatedAtText}</span>
                        </div>
                    </div>
                </div>
                <div class="service-description">${description}</div>
                <div class="service-tags">${tagsHtml}</div>
                <div class="service-actions">
                    <button class="btn-action-small btn-view-detail" 
                            data-service-name="${serviceName}"
                            data-action="viewDetail"
                            title="查看详情">查看详情</button>
                    <button class="btn-action-small install-mcp-btn" 
                            data-action="installMcp" 
                            data-service-name="${serviceName}"
                            data-config="${escapeHtml(config)}"
                            title="安装 MCP 配置">安装</button>
                    <button class="btn-action-small uninstall-mcp-btn not-installed" 
                            data-action="uninstallMcp" 
                            data-service-name="${serviceName}"
                            data-config="${escapeHtml(config)}"
                            title="卸载 MCP 配置">卸载</button>
                </div>
                ${configDetailHtml}
            </div>
        `;
    }).join('');
    
    container.innerHTML = cardsHtml;
    
    // 请求所有已安装的 MCP 状态
    vscode.postMessage({ type: 'getAllInstalledMcps' });
}

// 更新所有 MCP 按钮状态
function updateAllMcpButtonStates(installedMcps) {
    if (!installedMcps || typeof installedMcps !== 'object') {
        return;
    }
    
    Object.keys(installedMcps).forEach(serviceName => {
        updateMcpButtonState({
            serviceName: serviceName,
            isInstalled: installedMcps[serviceName]
        });
    });
}

// 更新单个 MCP 按钮状态
function updateMcpButtonState(data) {
    const { serviceName, isInstalled } = data;
    if (!serviceName) {
        return;
    }
    
    const serviceCard = document.querySelector(`.service-card[data-service-name="${serviceName}"]`);
    if (!serviceCard) {
        return;
    }
    
    const installBtn = serviceCard.querySelector('.install-mcp-btn');
    const uninstallBtn = serviceCard.querySelector('.uninstall-mcp-btn');
    
    if (installBtn) {
        if (isInstalled) {
            installBtn.classList.add('installed');
            installBtn.disabled = false; // 仍然可以点击
        } else {
            installBtn.classList.remove('installed');
        }
    }
    
    if (uninstallBtn) {
        // 默认状态是 not-installed（灰色），只有确认已安装时才移除
        if (isInstalled) {
            uninstallBtn.classList.remove('not-installed');
        } else {
            // 确保 not-installed 类存在（默认状态）
            uninstallBtn.classList.add('not-installed');
            uninstallBtn.disabled = false; // 仍然可以点击
        }
    }
}

function renderRules(data) {
    console.log('[WebView] renderRules called with data:', data);
    const container = document.getElementById('rules-tab');
    const filterSection = container.querySelector('.filter-section');

    // 处理分页数据结构
    let items = [];
    let total = 0;
    let currentPage = 1;

    if (Array.isArray(data)) {
        items = data;
        total = data.length;
        currentPage = 1;
    } else if (data && typeof data === 'object') {
        items = data.data || []; // Changed from data.commands to data.data as per ApiService
        total = data.total !== undefined ? data.total : items.length;
        currentPage = data.page || 1;
    }

    if (!items || items.length === 0) {
        const emptyHtml = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div>No Rules available</div>
            </div>
        `;
        container.innerHTML = '';
        if (filterSection) container.appendChild(filterSection);
        container.insertAdjacentHTML('beforeend', emptyHtml);
        return;
    }

    const html = `
        <div class="table-container">
            <table class="task-command-table">
                <thead>
                    <tr>
                        <th style="width: 35%">Rule Name</th>
                        <th style="width: 40%">Description</th>
                        <th style="width: 25%; text-align: right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const name = escapeHtml(item.file_name);
                        // 移除 .mdc 扩展名以保持与后端一致
                        const nameWithoutExt = name.endsWith('.mdc') ? name.slice(0, -4) : name;
                        const description = escapeHtml(item.description || '');
                        const oss_url = escapeHtml(item.download_url || '');
                        
                        // 统一使用 project 作为 level
                        const level = 'project';
                        const ruleKey = `rule_${nameWithoutExt}_${level}`;

                        return `
                            <tr>
                                <td>
                                    <div class="task-title">${name}</div>
                                </td>
                                <td>${description}</td>
                                <td style="text-align: right">
                                    <div class="rule-actions" data-container-key="${ruleKey}">
                                        <button class="btn-action-small install-rule-btn" data-action="openRules"
                                                data-name="${nameWithoutExt}"
                                                data-oss_url="${oss_url}"
                                                data-level="${level}"
                                                data-rule-key="${ruleKey}"
                                                title="Install Rule">安装</button>
                                        <button class="btn-action-small uninstall-rule-btn" data-action="uninstallRule"
                                                data-name="${nameWithoutExt}"
                                                data-level="${level}"
                                                data-rule-key="${ruleKey}"
                                                title="Uninstall Rule" style="display: inline-block; margin-left: 8px; opacity: 0.5; cursor: not-allowed;" disabled>卸载</button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${renderPagination(total, currentPage, 'rules')}
    `;

    container.innerHTML = '';
    if (filterSection) container.appendChild(filterSection);
    container.insertAdjacentHTML('beforeend', html);

    // 检查每个规则的安装状态
    items.forEach(item => {
        const name = item.file_name;
        // 移除 .mdc 扩展名以保持与后端一致
        const nameWithoutExt = name.endsWith('.mdc') ? name.slice(0, -4) : name;
        // 统一使用 project 作为 level
        const level = 'project';
        
        console.log('[WebView] Checking rule installed status:', { name, nameWithoutExt, level, ruleKey: `rule_${nameWithoutExt}_${level}` });
        
        // 发送检查消息
        vscode.postMessage({
            type: 'checkRuleInstalled',
            name: nameWithoutExt,
            level: level
        });
    });
}

// 渲染分页控件
function renderPagination(total, currentPage, dataType) {
    const pageSize = 10;
    const totalPages = Math.ceil(total / pageSize);

    console.log(`[WebView] renderPagination called - total: ${total}, currentPage: ${currentPage}, dataType: ${dataType}, totalPages: ${totalPages}`);

    // 如果没有数据，不显示分页
    if (total <= 0) {
        console.log(`[WebView] Not showing pagination - total: ${total} <= 0`);
        return '';
    }

    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;
    const startItem = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const endItem = Math.min(currentPage * pageSize, total);

    console.log(`[WebView] Showing pagination - startItem: ${startItem}, endItem: ${endItem}, total: ${total}`);

    return `
        <div class="pagination">
            <div class="pagination-info">
                显示 ${startItem} - ${endItem} 条，共 ${total} 条
            </div>
            <div class="pagination-controls">
                <button class="btn-pagination btn-prev" data-action="prev-page" data-type="${dataType}" ${!hasPrev ? 'disabled' : ''} title="上一页">
                    ‹ 上一页
                </button>
                <span class="pagination-current">
                    第 ${currentPage} 页，共 ${totalPages} 页
                </span>
                <button class="btn-pagination btn-next" data-action="next-page" data-type="${dataType}" ${!hasNext ? 'disabled' : ''} title="下一页">
                    下一页 ›
                </button>
            </div>
        </div>
    `;
}

// 处理分页事件
function handlePagination(action, dataType) {
    let currentData;
    let currentPage = 1;
    const pageSize = 10;

    // 获取当前数据和页码
    switch (dataType) {
        case 'commands':
            currentData = commandsData;
            if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
                currentPage = currentData.page || 1;
            }
            break;
        case 'commands-list':
            currentData = commandsListData;
            if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
                currentPage = currentData.page || 1;
            }
            break;
        case 'mcps':
            currentData = mcpsData;
            if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
                currentPage = currentData.page || 1;
            }
            break;
        case 'rules':
            currentData = rulesData;
            if (currentData && typeof currentData === 'object' && !Array.isArray(currentData)) {
                currentPage = currentData.page || 1;
            }
            break;
    }

    // 计算新页码
    let newPage = currentPage;
    if (action === 'prev-page') {
        newPage = Math.max(1, currentPage - 1);
    } else if (action === 'next-page') {
        const total = currentData && typeof currentData === 'object' && !Array.isArray(currentData) ? currentData.total : 0;
        const totalPages = Math.ceil(total / pageSize);
        newPage = Math.min(totalPages, currentPage + 1);
    }

    // 如果页码没有变化，不执行操作
    if (newPage === currentPage) {
        return;
    }

    // 发送分页请求
    if (dataType === 'commands') {
        commandsData.page = newPage;
        vscode.postMessage({
            type: 'fetchCommands',
            filters: { page: newPage, size: pageSize }
        });
    } else if (dataType === 'commands-list') {
        commandsListData.page = newPage;
        const keyword = document.getElementById('cmd-list-keyword-filter')?.value.trim() || '';
        const level = document.getElementById('cmd-list-level-filter')?.value || '';
        const labelsSelect = document.getElementById('cmd-list-labels-filter');
        const labels = labelsSelect ? parseInt(labelsSelect.value) : 0;
        vscode.postMessage({
            type: 'fetchCommandsList',
            filters: { keyword, level, labels, page: newPage, size: pageSize }
        });
    } else if (dataType === 'mcps') {
        mcpsData.page = newPage;
        vscode.postMessage({
            type: 'fetchMcps',
            filters: { page: newPage, size: pageSize }
        });
    } else if (dataType === 'rules') {
        rulesData.page = newPage;
        vscode.postMessage({
            type: 'fetchRules',
            filters: { page: newPage, size: pageSize }
        });
    }
}

// renderMcps 函数已在上面定义

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
}

// 复制到剪贴板的降级方案
function copyToClipboardFallback(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const originalText = button.textContent;
            button.textContent = '✅ 已复制';
            button.style.color = 'var(--vscode-textLink-foreground)';
            setTimeout(() => {
                button.textContent = originalText;
                button.style.color = '';
            }, 2000);
        } else {
            console.error('[WebView] Fallback copy failed');
        }
    } catch (e) {
        console.error('[WebView] Fallback copy error:', e);
    }
    
    document.body.removeChild(textArea);
}

// 更新appId筛选框选项
function updateAppIdFilter(config) {
    const appIdDropdown = document.getElementById('appid-dropdown');
    const appIdFilter = document.getElementById('task-appid-filter');
    
    if (!appIdDropdown || !appIdFilter || !config || !config.options) {
        return;
    }

    // 清空现有选项
    appIdDropdown.innerHTML = '';

    // 添加新选项到下拉列表
    config.options.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'custom-select-option';
        optionElement.setAttribute('data-value', option.value);
        optionElement.textContent = option.label;
        
        // 点击选项时设置值
        optionElement.addEventListener('click', () => {
            appIdFilter.value = option.value;
            appIdDropdown.style.display = 'none';
            // 更新选中状态
            appIdDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            optionElement.classList.add('selected');
        });
        
        appIdDropdown.appendChild(optionElement);
    });

    // 设置默认值
    if (config.defaultAppId) {
        appIdFilter.value = config.defaultAppId;
        // 标记选中的选项
        const selectedOption = appIdDropdown.querySelector(`[data-value="${config.defaultAppId}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }

    console.log('[WebView] Updated appId filter with options:', config.options);
}

// 更新 labels 筛选框选项
function updateLabelsFilter(data) {
    const labelsSelect = document.getElementById('cmd-list-labels-filter');
    
    if (!labelsSelect || !data) {
        return;
    }

    // 处理数据结构
    const labels = Array.isArray(data) ? data : (data.data || []);

    // 清空现有选项（保留默认的"All Labels"）
    labelsSelect.innerHTML = '<option value="0">All Labels</option>';

    // 添加新选项
    labels.forEach(label => {
        const option = document.createElement('option');
        option.value = label.id;
        option.textContent = label.name;
        labelsSelect.appendChild(option);
    });

    console.log('[WebView] Updated labels filter with', labels.length, 'labels');
}

// App ID 下拉框交互逻辑
document.addEventListener('DOMContentLoaded', () => {
    const appIdFilter = document.getElementById('task-appid-filter');
    const appIdDropdown = document.getElementById('appid-dropdown');
    const appIdDropdownBtn = document.getElementById('appid-dropdown-btn');
    
    if (!appIdFilter || !appIdDropdown || !appIdDropdownBtn) {
        return;
    }
    
    // 点击箭头按钮切换下拉列表
    appIdDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = appIdDropdown.style.display !== 'none';
        appIdDropdown.style.display = isVisible ? 'none' : 'block';
        
        // 如果打开，筛选选项
        if (!isVisible) {
            filterDropdownOptions(appIdFilter.value.trim().toLowerCase());
        }
    });
    
    // 输入时筛选选项
    appIdFilter.addEventListener('input', () => {
        const searchText = appIdFilter.value.trim().toLowerCase();
        filterDropdownOptions(searchText);
        appIdDropdown.style.display = 'block';
    });
    
    // 聚焦时显示下拉列表
    appIdFilter.addEventListener('focus', () => {
        filterDropdownOptions(appIdFilter.value.trim().toLowerCase());
        appIdDropdown.style.display = 'block';
    });
    
    // 点击外部关闭下拉列表
    document.addEventListener('click', (e) => {
        if (!appIdFilter.contains(e.target) && !appIdDropdown.contains(e.target) && !appIdDropdownBtn.contains(e.target)) {
            appIdDropdown.style.display = 'none';
        }
    });
    
    // 筛选下拉选项
    function filterDropdownOptions(searchText) {
        // 移除之前的"无匹配结果"提示
        const noResultHint = appIdDropdown.querySelector('.no-result-hint');
        if (noResultHint) {
            noResultHint.remove();
        }
        
        const options = appIdDropdown.querySelectorAll('.custom-select-option:not(.no-result-hint)');
        let hasVisibleOption = false;
        
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            const value = option.getAttribute('data-value').toLowerCase();
            const matches = !searchText || text.includes(searchText) || value.includes(searchText);
            
            option.style.display = matches ? 'block' : 'none';
            if (matches) hasVisibleOption = true;
        });
        
        // 如果没有匹配项且有搜索文本，显示提示
        if (!hasVisibleOption && searchText) {
            const noResultDiv = document.createElement('div');
            noResultDiv.className = 'custom-select-option no-result-hint';
            noResultDiv.style.color = 'var(--vscode-descriptionForeground)';
            noResultDiv.style.cursor = 'default';
            noResultDiv.textContent = '无匹配结果（可直接输入自定义 App ID）';
            appIdDropdown.appendChild(noResultDiv);
        }
    }
});

// 更新命令按钮状态（根据安装状态显示安装或卸载按钮）
function updateCommandButtonState(data) {
    const { name, level, isInstalled } = data;
    const commandKey = `cmd_${name}_${level}`;
    const actionsContainers = document.querySelectorAll(`.command-actions[data-container-key="${commandKey}"]`);
    
    if (actionsContainers.length === 0) {
        return;
    }
    
    actionsContainers.forEach(actionsContainer => {
        const installBtn = actionsContainer.querySelector('.install-btn');
        const uninstallBtn = actionsContainer.querySelector('.uninstall-btn');
        const runBtn = actionsContainer.querySelector('.run-btn');
        
        if (isInstalled) {
            // 已安装，显示卸载按钮和运行按钮，隐藏安装按钮
            if (installBtn) installBtn.style.display = 'none';
            if (uninstallBtn) uninstallBtn.style.display = 'inline-block';
            if (runBtn) runBtn.style.display = 'inline-block';
        } else {
            // 未安装，显示安装按钮，隐藏卸载按钮和运行按钮
            if (installBtn) installBtn.style.display = 'inline-block';
            if (uninstallBtn) uninstallBtn.style.display = 'none';
            if (runBtn) runBtn.style.display = 'none';
        }
    });
}

// 更新规则按钮状态（根据安装状态显示安装或卸载按钮）
function updateRuleButtonState(data) {
    const { name, level, isInstalled } = data;
    const ruleKey = `rule_${name}_${level}`;
    console.log('[WebView] updateRuleButtonState:', { name, level, isInstalled, ruleKey });
    const actionsContainers = document.querySelectorAll(`.rule-actions[data-container-key="${ruleKey}"]`);
    
    if (actionsContainers.length === 0) {
        console.warn('[WebView] No rule actions container found for key:', ruleKey);
        // 尝试查找所有 rule-actions 容器，用于调试
        const allContainers = document.querySelectorAll('.rule-actions');
        console.log('[WebView] All rule-actions containers:', Array.from(allContainers).map(c => c.getAttribute('data-container-key')));
        return;
    }
    
    console.log('[WebView] Found', actionsContainers.length, 'containers for key:', ruleKey);
    
    actionsContainers.forEach(actionsContainer => {
        const installBtn = actionsContainer.querySelector('.install-rule-btn');
        const uninstallBtn = actionsContainer.querySelector('.uninstall-rule-btn');
        
        console.log('[WebView] Updating buttons - installBtn:', !!installBtn, 'uninstallBtn:', !!uninstallBtn, 'isInstalled:', isInstalled);
        
        if (isInstalled) {
            // 已安装：安装按钮变灰（禁用），卸载按钮可用
            if (installBtn) {
                installBtn.disabled = true;
                installBtn.style.opacity = '0.5';
                installBtn.style.cursor = 'not-allowed';
            }
            if (uninstallBtn) {
                uninstallBtn.disabled = false;
                uninstallBtn.style.opacity = '1';
                uninstallBtn.style.cursor = 'pointer';
            }
        } else {
            // 未安装：安装按钮可用，卸载按钮变灰（禁用）
            if (installBtn) {
                installBtn.disabled = false;
                installBtn.style.opacity = '1';
                installBtn.style.cursor = 'pointer';
            }
            if (uninstallBtn) {
                uninstallBtn.disabled = true;
                uninstallBtn.style.opacity = '0.5';
                uninstallBtn.style.cursor = 'not-allowed';
            }
        }
    });
}

// 初始化任务command展开/折叠功能（事件委托）
function initializeCommandToggle() {
    // 使用事件委托，只添加一次监听器
    document.addEventListener('click', (e) => {
        const target = e.target;

        // 检查点击的是否是toggle-command按钮
        if (target && target.classList.contains('toggle-command')) {
            e.preventDefault();
            e.stopPropagation();

            const taskId = target.getAttribute('data-task-id');
            if (!taskId) return;

            const commandRows = document.querySelectorAll(`.command-row[data-task-id="${taskId}"]`);

            commandRows.forEach(row => {
                const isVisible = row.style.display !== 'none';
                row.style.display = isVisible ? 'none' : 'table-row';

                // 更新按钮图标和提示
                target.textContent = isVisible ? '📋' : '📂';
                target.title = isVisible ? 'Show Command Details' : 'Hide Command Details';
            });
        }
    });
}

