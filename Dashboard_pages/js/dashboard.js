// Dashboard Page Logic

// Load dashboard data
function loadDashboardData() {
    console.log('Loading dashboard data...');
    
    // Get filter values
    const repoFilter = document.getElementById('repoFilter').value;
    const stateFilter = Array.from(document.getElementById('stateFilter').selectedOptions).map(opt => opt.value);
    const daysFilter = parseInt(document.getElementById('daysFilter').value);
    
    // Populate repository filter if not already done
    if (document.getElementById('repoFilter').options.length <= 1) {
        populateRepoFilter();
    }
    
    // Filter PRs
    let filteredPRs = appData.prs;
    
    if (repoFilter) {
        const [owner, repo] = repoFilter.split('/');
        filteredPRs = filterPRs(filteredPRs, { owner, repo, states: stateFilter, days: daysFilter });
    } else {
        filteredPRs = filterPRs(filteredPRs, { states: stateFilter, days: daysFilter });
    }
    
    console.log(`Filtered ${filteredPRs.length} PRs`);
    
    // Update metrics
    updateDashboardMetrics(filteredPRs);
    
    // Update timeline chart
    updateTimelineChart(filteredPRs);
    
    // Update PR table
    updatePRTable(filteredPRs);
}

// Populate repository filter dropdown
function populateRepoFilter() {
    const repoFilter = document.getElementById('repoFilter');
    
    if (!appData.config || !appData.config.repositories) {
        repoFilter.innerHTML = '<option value="">リポジトリなし</option>';
        return;
    }
    
    const options = ['<option value="">すべてのリポジトリ</option>'];
    appData.config.repositories.forEach(repo => {
        options.push(`<option value="${repo.owner}/${repo.repo}">${repo.name}</option>`);
    });
    
    repoFilter.innerHTML = options.join('');
}

// Update dashboard metrics
function updateDashboardMetrics(prs) {
    const metricsContainer = document.getElementById('dashboardMetrics');
    
    const openPRs = prs.filter(pr => pr.state === 'OPEN').length;
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED').length;
    const closedPRs = prs.filter(pr => pr.state === 'CLOSED').length;
    const totalPRs = prs.length;
    
    // Calculate average time to merge (for merged PRs)
    const mergedPRsWithTime = prs.filter(pr => pr.state === 'MERGED' && pr.createdAt && pr.mergedAt);
    const avgTimeToMerge = mergedPRsWithTime.length > 0
        ? mergedPRsWithTime.reduce((sum, pr) => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            return sum + (merged - created) / (1000 * 60 * 60 * 24);
        }, 0) / mergedPRsWithTime.length
        : 0;
    
    metricsContainer.innerHTML = `
        <div class="metric-box">
            <div class="metric-label">Total PRs</div>
            <div class="metric-value">${totalPRs}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">Open</div>
            <div class="metric-value" style="color: var(--primary-color);">${openPRs}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">Merged</div>
            <div class="metric-value" style="color: var(--success-color);">${mergedPRs}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">Closed</div>
            <div class="metric-value" style="color: var(--text-secondary);">${closedPRs}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">Avg Time to Merge</div>
            <div class="metric-value">${avgTimeToMerge.toFixed(1)}</div>
            <div class="metric-description">days</div>
        </div>
    `;
}

// Update timeline chart (Gantt-style)
function updateTimelineChart(prs) {
    const chartContainer = document.getElementById('timelineChart');
    
    if (prs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">データがありません</div>';
        return;
    }
    
    // Sort PRs by creation date (newest first) and take top 30
    const sortedPRs = prs
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 30);
    
    // Prepare data for Plotly Gantt chart
    const traces = [];
    
    sortedPRs.forEach(pr => {
        const startDate = pr.createdAt;
        const endDate = pr.mergedAt || pr.closedAt || new Date().toISOString();
        
        let color = CONFIG.charts.colors[pr.state] || '#6b7280';
        if (pr.isDraft) {
            color = CONFIG.charts.colors.draft;
        }
        
        traces.push({
            x: [startDate, endDate],
            y: [`#${pr.number}: ${pr.title.substring(0, 50)}...`],
            type: 'bar',
            orientation: 'h',
            marker: {
                color: color
            },
            name: pr.state,
            showlegend: false,
            hovertemplate: `
                <b>PR #${pr.number}</b><br>
                ${pr.title}<br>
                状態: ${pr.state}<br>
                作成: ${formatDate(pr.createdAt)}<br>
                ${pr.mergedAt ? `マージ: ${formatDate(pr.mergedAt)}` : ''}
                ${pr.closedAt && !pr.mergedAt ? `クローズ: ${formatDate(pr.closedAt)}` : ''}
                <extra></extra>
            `
        });
    });
    
    const layout = {
        title: 'PR Timeline (最新30件)',
        xaxis: {
            title: '日付',
            type: 'date'
        },
        yaxis: {
            title: 'Pull Request',
            automargin: true
        },
        height: 600,
        margin: { l: 300, r: 50, t: 50, b: 50 },
        hovermode: 'closest',
        barmode: 'overlay'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, traces, layout, config);
}

// Update PR table
function updatePRTable(prs) {
    const tableContainer = document.getElementById('prTable');
    
    if (prs.length === 0) {
        tableContainer.innerHTML = '<div class="loading">データがありません</div>';
        return;
    }
    
    // Sort PRs by creation date (newest first)
    const sortedPRs = prs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Create table HTML
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>PR#</th>
                    <th>タイトル</th>
                    <th>状態</th>
                    <th>作成者</th>
                    <th>作成日</th>
                    <th>変更</th>
                    <th>コメント</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPRs.slice(0, 50).map(pr => {
                    const stateColor = CONFIG.charts.colors[pr.state] || '#6b7280';
                    const additions = pr.additions || 0;
                    const deletions = pr.deletions || 0;
                    const comments = pr.comments || 0;
                    
                    return `
                        <tr>
                            <td><a href="${pr.url}" target="_blank" style="color: var(--secondary-color);">#${pr.number}</a></td>
                            <td>${pr.title}</td>
                            <td><span style="color: ${stateColor}; font-weight: 600;">${pr.state}</span></td>
                            <td>${pr.author || '-'}</td>
                            <td>${formatDate(pr.createdAt)}</td>
                            <td>
                                <span style="color: var(--success-color);">+${additions}</span>
                                <span style="color: var(--primary-color);">-${deletions}</span>
                            </td>
                            <td>${comments}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        ${sortedPRs.length > 50 ? `<p style="text-align: center; margin-top: 1rem; color: var(--text-secondary);">最初の50件のみ表示 (全${sortedPRs.length}件)</p>` : ''}
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// Export function
window.loadDashboardData = loadDashboardData;
