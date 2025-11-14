// File History Page Logic - VSCode-style UI

let fileTree = {};
let allFiles = [];
let currentPath = [];
let filteredPRsByFile = [];
let selectedFilePath = null;

// Initialize File History Page
async function initializeFileHistoryPage() {
    console.log('Initializing file history page...');
    
    if (!appData.prs || appData.prs.length === 0) {
        document.getElementById('file-tree-container').innerHTML = 
            '<div class="error-message">PRデータが読み込まれていません</div>';
        return;
    }
    
    buildFileTree();
    renderFileTree();
}

// Build file tree from PR data
function buildFileTree() {
    console.log('Building file tree...');
    
    // Get global repository filter
    const globalRepoFilter = localStorage.getItem('globalRepoFilter') || '';
    console.log('Global repo filter:', globalRepoFilter);
    
    const fileSet = new Set();
    
    // Extract all unique files from PRs (applying global filter)
    let filteredPRs = appData.prs;
    if (globalRepoFilter) {
        filteredPRs = appData.prs.filter(pr => {
            const repoFullName = `${pr.owner}/${pr.repo}`;
            return repoFullName === globalRepoFilter;
        });
        console.log(`Filtered to ${filteredPRs.length} PRs for repo: ${globalRepoFilter}`);
    }
    
    // Filter to only recent/active PRs (OPEN or MERGED within last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const activePRs = filteredPRs.filter(pr => {
        if (pr.state === 'OPEN') return true;
        if (pr.state === 'MERGED' && pr.mergedAt) {
            const mergedDate = new Date(pr.mergedAt);
            return mergedDate >= sixMonthsAgo;
        }
        return false;
    });
    
    console.log(`Filtered to ${activePRs.length} active PRs (from ${filteredPRs.length} total)`);
    
    activePRs.forEach(pr => {
        if (pr.files && Array.isArray(pr.files)) {
            pr.files.forEach(file => {
                if (typeof file === 'string') {
                    fileSet.add(file);
                } else if (file.filename) {
                    fileSet.add(file.filename);
                }
            });
        }
    });
    
    allFiles = Array.from(fileSet).sort();
    console.log(`Found ${allFiles.length} unique files`);
    
    // Build tree structure
    fileTree = {};
    allFiles.forEach(filePath => {
        const parts = filePath.split('/');
        let node = fileTree;
        
        // Navigate/create directory structure
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!node[part]) {
                node[part] = { _isDir: true, _children: {} };
            }
            node = node[part]._children;
        }
        
        // Add file
        const fileName = parts[parts.length - 1];
        node[fileName] = { _isDir: false, _fullPath: filePath };
    });
    
    console.log('File tree built:', fileTree);
}

// Render file tree (VSCode-style)
function renderFileTree() {
    const container = document.getElementById('file-tree-container');
    
    if (allFiles.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">ファイル情報がありません</p>';
        return;
    }
    
    // Get current node
    let currentNode = fileTree;
    for (const part of currentPath) {
        currentNode = currentNode[part]._children;
    }
    
    // Render breadcrumb
    let breadcrumbHTML = `<div class="file-breadcrumb">`;
    breadcrumbHTML += `<div class="breadcrumb-item" onclick="navigateToRoot()">🏠 ルート</div>`;
    
    currentPath.forEach((part, index) => {
        breadcrumbHTML += `<span class="breadcrumb-separator">/</span>`;
        const isLast = index === currentPath.length - 1;
        if (isLast) {
            breadcrumbHTML += `<div class="breadcrumb-item" style="background: var(--primary-color); color: white; border-color: var(--primary-color);">${part}</div>`;
        } else {
            breadcrumbHTML += `<div class="breadcrumb-item" onclick="navigateToPath(${index})">${part}</div>`;
        }
    });
    
    breadcrumbHTML += '</div>';
    
    // Add "up" button if not at root
    let upButtonHTML = '';
    if (currentPath.length > 0) {
        upButtonHTML = `
            <div class="tree-item" onclick="navigateUp()" style="font-weight: 600; color: var(--primary-color);">
                <span class="tree-item-icon">↰</span>
                <span class="tree-item-label">..</span>
            </div>
        `;
    }
    
    // Render entries as tree list
    let entriesHTML = '';
    const entries = Object.keys(currentNode).sort();
    
    // Separate dirs and files
    const dirs = entries.filter(name => currentNode[name]._isDir);
    const files = entries.filter(name => !currentNode[name]._isDir);
    
    // Directories first
    dirs.forEach(name => {
        entriesHTML += `
            <div class="tree-item" onclick="enterDirectory('${name}')">
                <span class="tree-item-icon">📁</span>
                <span class="tree-item-label">${name}</span>
            </div>
        `;
    });
    
    // Then files
    files.forEach(name => {
        const fullPath = currentNode[name]._fullPath;
        const ext = name.split('.').pop().toLowerCase();
        let icon = '📄';
        if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) icon = '📜';
        else if (['py'].includes(ext)) icon = '�';
        else if (['html', 'css', 'scss'].includes(ext)) icon = '🎨';
        else if (['json', 'yaml', 'yml'].includes(ext)) icon = '⚙️';
        else if (['md'].includes(ext)) icon = '📝';
        
        const isSelected = fullPath === selectedFilePath;
        const selectedClass = isSelected ? ' selected' : '';
        
        entriesHTML += `
            <div class="tree-item${selectedClass}" onclick="selectFile('${fullPath.replace(/'/g, "\\'")}')">
                <span class="tree-item-icon">${icon}</span>
                <span class="tree-item-label">${name}</span>
            </div>
        `;
    });
    
    container.innerHTML = breadcrumbHTML + upButtonHTML + entriesHTML;
}

// Navigate to root
function navigateToRoot() {
    currentPath = [];
    renderFileTree();
}

// Navigate up one level
function navigateUp() {
    if (currentPath.length > 0) {
        currentPath.pop();
        renderFileTree();
    }
}

// Navigate to specific path index
function navigateToPath(index) {
    currentPath = currentPath.slice(0, index + 1);
    renderFileTree();
}

// Enter directory
function enterDirectory(dirName) {
    currentPath.push(dirName);
    renderFileTree();
}

// Filter file tree by search
function filterFileTree() {
    const searchInput = document.getElementById('file-search-input');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderFileTree();
        return;
    }
    
    // Search through all files
    const matchedFiles = allFiles.filter(file => 
        file.toLowerCase().includes(searchTerm)
    );
    
    const container = document.getElementById('file-tree-container');
    
    if (matchedFiles.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">検索結果がありません</p>';
        return;
    }
    
    // Show search results as flat list
    let resultsHTML = `<div style="padding: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
        ${matchedFiles.length}件の結果
    </div>`;
    
    matchedFiles.forEach(filePath => {
        const fileName = filePath.split('/').pop();
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        const ext = fileName.split('.').pop().toLowerCase();
        
        let icon = '📄';
        if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) icon = '📜';
        else if (['py'].includes(ext)) icon = '🐍';
        else if (['html', 'css', 'scss'].includes(ext)) icon = '🎨';
        else if (['json', 'yaml', 'yml'].includes(ext)) icon = '⚙️';
        else if (['md'].includes(ext)) icon = '📝';
        
        const isSelected = filePath === selectedFilePath;
        const selectedClass = isSelected ? ' selected' : '';
        
        resultsHTML += `
            <div class="tree-item${selectedClass}" onclick="selectFile('${filePath.replace(/'/g, "\\'")}')">
                <span class="tree-item-icon">${icon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div class="tree-item-label">${fileName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dir}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = resultsHTML;
}

// Select file and show related PRs
function selectFile(filePath) {
    selectedFilePath = filePath;
    console.log('Selected file:', filePath);
    
    // Get global repository filter
    const globalRepoFilter = localStorage.getItem('globalRepoFilter') || '';
    
    // Filter PRs that contain this file (applying global filter)
    let prsToFilter = appData.prs;
    if (globalRepoFilter) {
        prsToFilter = appData.prs.filter(pr => {
            const repoFullName = `${pr.owner}/${pr.repo}`;
            return repoFullName === globalRepoFilter;
        });
    }
    
    filteredPRsByFile = prsToFilter.filter(pr => {
        if (!pr.files || !Array.isArray(pr.files)) return false;
        
        return pr.files.some(file => {
            if (typeof file === 'string') {
                return file === filePath;
            } else if (file.filename) {
                return file.filename === filePath;
            }
            return false;
        });
    });
    
    console.log(`Found ${filteredPRsByFile.length} PRs for file:`, filePath);
    
    // Re-render tree to show selection
    const searchInput = document.getElementById('file-search-input');
    if (searchInput && searchInput.value.trim()) {
        filterFileTree();
    } else {
        renderFileTree();
    }
    
    // Show PR list container
    document.getElementById('file-pr-list-container').style.display = 'block';
    
    // Update path display
    document.getElementById('file-selected-path').textContent = `📄 ${filePath}`;
    
    // Update metrics
    const openPRs = filteredPRsByFile.filter(pr => pr.state === 'OPEN').length;
    const mergedPRs = filteredPRsByFile.filter(pr => pr.state === 'MERGED').length;
    const latestUpdate = filteredPRsByFile.length > 0 
        ? new Date(Math.max(...filteredPRsByFile.map(pr => new Date(pr.createdAt)))).toLocaleDateString('ja-JP')
        : '-';
    
    document.getElementById('file-total-prs').textContent = filteredPRsByFile.length;
    document.getElementById('file-open-prs').textContent = openPRs;
    document.getElementById('file-merged-prs').textContent = mergedPRs;
    document.getElementById('file-last-update').textContent = latestUpdate;
    
    // Render timeline
    renderFilePRTimeline();
    
    // Render PR table
    renderFilePRTable();
}

// Render PR timeline for selected file
function renderFilePRTimeline() {
    const chartContainer = document.getElementById('file-pr-timeline-chart');
    
    if (filteredPRsByFile.length === 0) {
        chartContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">このファイルに関連するPRがありません</p>';
        return;
    }
    
    // Sort PRs by creation date
    const sortedPRs = [...filteredPRsByFile].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Prepare data for Gantt-style chart
    const traces = [];
    const maxTitleLen = 28;
    
    sortedPRs.forEach((pr, index) => {
        const shortTitle = pr.title.length > maxTitleLen ? pr.title.substring(0, maxTitleLen) + '…' : pr.title;
        const label = `#${pr.number}: ${shortTitle}`;
        
        const startDate = new Date(pr.createdAt);
        const endDate = pr.mergedAt ? new Date(pr.mergedAt) : 
                       pr.closedAt ? new Date(pr.closedAt) : 
                       new Date();
        
        const duration = endDate - startDate;
        
        let color = window.CONFIG.charts.colors[pr.state] || '#6b7280';
        if (pr.isDraft) color = window.CONFIG.charts.colors.draft;
        
        traces.push({
            type: 'bar',
            orientation: 'h',
            x: [duration],
            y: [label],
            base: [startDate.getTime()],
            marker: { color: color },
            name: pr.state,
            showlegend: false,
            hovertemplate: `<b>PR #${pr.number}</b><br>` +
                          `${pr.title}<br>` +
                          `状態: ${pr.state}<br>` +
                          `作成: ${formatDate(pr.createdAt)}<br>` +
                          `${pr.mergedAt ? `マージ: ${formatDate(pr.mergedAt)}<br>` : ''}` +
                          `${pr.closedAt && !pr.mergedAt ? `クローズ: ${formatDate(pr.closedAt)}<br>` : ''}` +
                          `<br><b>クリックで詳細を表示</b>` +
                          `<extra></extra>`
        });
    });

    const layout = {
        title: `PRタイムライン (${sortedPRs.length}件)`,
        xaxis: {
            title: '期間',
            type: 'date',
            tickformat: '%Y-%m-%d'
        },
        yaxis: {
            title: 'Pull Request',
            automargin: true,
            tickfont: { family: 'monospace', size: 11 },
        },
        height: Math.max(400, sortedPRs.length * 40),
        margin: { l: 280, r: 50, t: 50, b: 50 },
        hovermode: 'closest',
        barmode: 'stack',
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
    };
    
    try {
        Plotly.newPlot(chartContainer, traces, layout, config).then(() => {
            chartContainer.on('plotly_click', function(data) {
                if (data && data.points && data.points.length > 0) {
                    const curveNumber = data.points[0].curveNumber;
                    const pr = sortedPRs[curveNumber];
                    
                    if (pr && typeof navigateToPRDetail === 'function') {
                        navigateToPRDetail(pr.owner, pr.repo, pr.number);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Failed to render file PR timeline chart:', error);
        chartContainer.innerHTML = '<div class="error-message">Timeline chart could not be rendered</div>';
    }
}

// Render PR table for selected file
function renderFilePRTable() {
    const container = document.getElementById('file-pr-table-container');
    
    if (filteredPRsByFile.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">このファイルを含むPRはありません</p>';
        return;
    }
    
    // Sort by creation date (newest first)
    const sortedPRs = [...filteredPRsByFile].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    let tableHTML = `
        <h2>PR一覧 (${sortedPRs.length}件)</h2>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: var(--primary-color); color: white;">
                        <th style="padding: 0.8rem; text-align: left;">PR番号</th>
                        <th style="padding: 0.8rem; text-align: left;">タイトル</th>
                        <th style="padding: 0.8rem; text-align: center;">状態</th>
                        <th style="padding: 0.8rem; text-align: left;">作成者</th>
                        <th style="padding: 0.8rem; text-align: left;">作成日</th>
                        <th style="padding: 0.8rem; text-align: center;">会話</th>
                        <th style="padding: 0.8rem; text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedPRs.forEach((pr, index) => {
        const stateColor = pr.state === 'MERGED' ? '#10b981' : (pr.state === 'CLOSED' ? '#ef4444' : '#3b82f6');
        const stateText = pr.state === 'MERGED' ? 'マージ済み' : (pr.state === 'CLOSED' ? 'クローズ' : 'オープン');
        const createdDate = new Date(pr.createdAt).toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        });
        const rowBg = index % 2 === 0 ? 'var(--card-bg)' : 'rgba(0,0,0,0.02)';
        
        // 会話情報
        const commentsCount = pr.comments_count || 0;
        const unresolvedThreads = pr.unresolved_threads || 0;
        const totalThreads = pr.review_threads || 0;
        const conversationInfo = `${commentsCount}コメント, ${unresolvedThreads}/${totalThreads}スレッド`;
        const hasUnresolved = unresolvedThreads > 0;
        
        tableHTML += `
            <tr style="background: ${rowBg}; border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.8rem;">
                    <strong style="color: var(--primary-color);">#${pr.number}</strong>
                </td>
                <td style="padding: 0.8rem; max-width: 400px;">
                    ${pr.title}
                </td>
                <td style="padding: 0.8rem; text-align: center;">
                    <span style="background: ${stateColor}; color: white; padding: 0.3rem 0.8rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                        ${stateText}
                    </span>
                </td>
                <td style="padding: 0.8rem;">
                    ${pr.author}
                </td>
                <td style="padding: 0.8rem;">
                    ${createdDate}
                </td>
                <td style="padding: 0.8rem; text-align: center;">
                    <div style="font-size: 0.85rem;">
                        <div>${conversationInfo}</div>
                        ${hasUnresolved ? '<div style="color: #ef4444; font-weight: 600;">未解決スレッドあり</div>' : ''}
                    </div>
                </td>
                <td style="padding: 0.8rem; text-align: center;">
                    <button onclick="navigateToPRDetail('${pr.owner}', '${pr.repo}', ${pr.number})" 
                            style="background: var(--primary-color); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-right: 0.5rem;">
                        詳細
                    </button>
                    <button onclick="showPRConversation(${pr.number})" 
                            style="background: #6b7280; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        会話
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

// Show PR conversation details
function showPRConversation(prNumber) {
    const pr = filteredPRsByFile.find(p => p.number === prNumber);
    if (!pr) {
        console.error('PR not found:', prNumber);
        return;
    }
    
    // Create modal for conversation
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 1000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--card-bg); border-radius: 8px; padding: 2rem;
        max-width: 800px; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    let conversationHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 style="margin: 0;">PR #${pr.number} - 会話履歴</h2>
            <button onclick="this.closest('.modal').remove()" 
                    style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">
                ×
            </button>
        </div>
        <div style="margin-bottom: 1rem;">
            <strong>タイトル:</strong> ${pr.title}<br>
            <strong>作成者:</strong> ${pr.author}<br>
            <strong>作成日:</strong> ${new Date(pr.createdAt).toLocaleString('ja-JP')}
        </div>
    `;
    
    // Comments section
    const commentsCount = pr.comments_count || 0;
    conversationHTML += `<h3>コメント (${commentsCount}件)</h3>`;
    
    if (commentsCount === 0) {
        conversationHTML += '<p style="color: var(--text-muted);">コメントはありません</p>';
    } else {
        // Note: comments_details not available in current data structure
        conversationHTML += '<p style="color: var(--text-muted);">コメント詳細は現在利用できません。GitHubで直接確認してください。</p>';
    }
    
    // Review threads section
    const totalThreads = pr.review_threads || 0;
    const unresolvedThreads = pr.unresolved_threads || 0;
    conversationHTML += `<h3>レビュースレッド (${totalThreads}件, 未解決: ${unresolvedThreads}件)</h3>`;
    
    if (pr.thread_details && pr.thread_details.length > 0) {
        pr.thread_details.forEach((thread, index) => {
            const status = thread.isResolved ? '解決済み' : (thread.isOutdated ? '古い' : '未解決');
            const statusColor = thread.isResolved ? '#10b981' : (thread.isOutdated ? '#6b7280' : '#ef4444');
            
            conversationHTML += `
                <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong>スレッド ${index + 1}</strong>
                        <span style="background: ${statusColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">
                            ${status}
                        </span>
                    </div>
            `;
            
            if (thread.comments && thread.comments.length > 0) {
                thread.comments.forEach(comment => {
                    const commentDate = new Date(comment.createdAt).toLocaleString('ja-JP');
                    conversationHTML += `
                        <div style="margin-left: 1rem; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px; margin-bottom: 0.5rem;">
                            <div style="font-weight: 600; color: var(--primary-color);">${comment.author}</div>
                            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">${commentDate}</div>
                            <div style="white-space: pre-wrap;">${comment.body || '(本文なし)'}</div>
                        </div>
                    `;
                });
            } else {
                conversationHTML += '<p style="color: var(--text-muted); margin-left: 1rem;">コメントがありません</p>';
            }
            
            conversationHTML += '</div>';
        });
    } else {
        conversationHTML += '<p style="color: var(--text-muted);">レビュースレッドの詳細は現在利用できません。GitHubで直接確認してください。</p>';
    }
    
    // Review details section
    conversationHTML += '<h3>レビュー履歴</h3>';
    if (pr.review_details && pr.review_details.length > 0) {
        pr.review_details.forEach(review => {
            const reviewDate = new Date(review.createdAt).toLocaleString('ja-JP');
            const stateText = {
                'APPROVED': '承認',
                'CHANGES_REQUESTED': '変更要求',
                'COMMENTED': 'コメント'
            }[review.state] || review.state;
            const stateColor = {
                'APPROVED': '#10b981',
                'CHANGES_REQUESTED': '#f59e0b',
                'COMMENTED': '#6b7280'
            }[review.state] || '#6b7280';
            
            conversationHTML += `
                <div style="display: flex; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px;">
                    <span style="background: ${stateColor}; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.5rem;">
                        ${stateText}
                    </span>
                    <strong>${review.author}</strong>
                    <span style="color: var(--text-muted); margin-left: auto;">${reviewDate}</span>
                </div>
            `;
        });
    } else {
        conversationHTML += '<p style="color: var(--text-muted);">レビュー履歴がありません</p>';
    }
    
    modalContent.innerHTML = conversationHTML;
    modal.appendChild(modalContent);
    modal.classList.add('modal');
    
    document.body.appendChild(modal);
}

// Export functions
window.initializeFileHistoryPage = initializeFileHistoryPage;
window.navigateToRoot = navigateToRoot;
window.navigateUp = navigateUp;
window.navigateToPath = navigateToPath;
window.enterDirectory = enterDirectory;
window.selectFile = selectFile;
window.filterFileTree = filterFileTree;
window.showPRConversation = showPRConversation;
