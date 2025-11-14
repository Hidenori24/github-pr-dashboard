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
    
    filteredPRs.forEach(pr => {
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
        else if (['py'].includes(ext)) icon = '🐍';
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
    console.log('Selected file:', filePath);
    selectedFilePath = filePath;
    
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
    if (searchInput.value.trim()) {
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
    const tableContainer = document.getElementById('file-pr-table-container');
    
    if (filteredPRsByFile.length === 0) {
        tableContainer.innerHTML = '';
        return;
    }
    
    const sortedPRs = [...filteredPRsByFile].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    let tableHTML = `
        <h3 style="margin-bottom: 1rem;">PR一覧</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>PR番号</th>
                        <th>タイトル</th>
                        <th>状態</th>
                        <th>作成日</th>
                        <th>作成者</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedPRs.forEach(pr => {
        const statusBadge = getStatusBadge(pr.state);
        const createdDate = formatDate(pr.createdAt);
        
        tableHTML += `
            <tr>
                <td><a href="https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}" target="_blank">#${pr.number}</a></td>
                <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis;">${pr.title}</td>
                <td>${statusBadge}</td>
                <td>${createdDate}</td>
                <td>${pr.author}</td>
                <td>
                    <button onclick="navigateToPRDetail('${pr.owner}', '${pr.repo}', ${pr.number})" 
                            style="background: var(--primary-color); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer;">
                        詳細
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
    
    tableContainer.innerHTML = tableHTML;
}

// Helper: Get status badge HTML
function getStatusBadge(state) {
    const colors = {
        'OPEN': 'background: #22c55e; color: white;',
        'MERGED': 'background: #8b5cf6; color: white;',
        'CLOSED': 'background: #ef4444; color: white;',
        'DRAFT': 'background: #6b7280; color: white;'
    };
    
    return `<span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; ${colors[state] || ''}">${state}</span>`;
}

// Helper: Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

// Export functions
window.initializeFileHistoryPage = initializeFileHistoryPage;
window.navigateToRoot = navigateToRoot;
window.navigateUp = navigateUp;
window.navigateToPath = navigateToPath;
window.enterDirectory = enterDirectory;
window.selectFile = selectFile;
window.filterFileTree = filterFileTree;
