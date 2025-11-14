// Dashboard Page Logic

// Configuration for chart colors (use window.CONFIG to avoid re-declaration errors)
window.CONFIG = window.CONFIG || {
    charts: {
        colors: {
            'OPEN': '#1f77b4',      // 青（Streamlitのオープンと同じ）
            'MERGED': '#7fcdff',    // 水色（Streamlitのマージ済みと同じ）
            'CLOSED': '#6b7280',
            'draft': '#ffa421'
        },
        defaultHeight: 400
    }
};

// Format date helper function
function formatDate(date) {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
        console.warn('[Dashboard formatDate] Invalid date:', date);
        return 'Invalid Date';
    }
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// Show error message when data is not available
function showDashboardError() {
    const timelineContainer = document.getElementById('timelineChart');
    const prTableContainer = document.getElementById('prTable');
    const metricsContainer = document.getElementById('dashboardMetrics');

    const errorMsg = `
        <div class="error-message" style="padding: 2rem; text-align: center;">
            <h3>⚠️ データが利用できません</h3>
            <p>PRデータが読み込まれていません。GitHub Actionsが正常に実行されているか確認してください。</p>
        </div>
    `;

    if (timelineContainer) timelineContainer.innerHTML = errorMsg;
    if (prTableContainer) prTableContainer.innerHTML = errorMsg;
    if (metricsContainer) metricsContainer.innerHTML = '';
}

function showDashboardLoading() {
    const timelineContainer = document.getElementById('timelineChart');
    const prTableContainer = document.getElementById('prTable');
    const metricsContainer = document.getElementById('dashboardMetrics');
    if (timelineContainer) timelineContainer.innerHTML = '<div class="loading">Loading chart...</div>';
    if (prTableContainer) prTableContainer.innerHTML = '<div class="loading">Loading table...</div>';
    if (metricsContainer) metricsContainer.innerHTML = '<div class="loading" style="padding:0.5rem;">Loading metrics...</div>';
}

// Load dashboard data
function loadDashboardData() {
    console.log('[Dashboard] Loading dashboard data...');

    // If data is still loading, show loading state and retry shortly
    if (typeof isDataLoading !== 'undefined' && isDataLoading) {
        showDashboardLoading();
        setTimeout(() => {
            if (!isDataLoading) {
                loadDashboardData();
            }
        }, 500);
        return;
    }

    // Check if appData is available / has PRs
    if (typeof appData === 'undefined' || !appData.prs || appData.prs.length === 0) {
        console.warn('[Dashboard] No PR data available after load');
        showDashboardError();
        return;
    }
    
    // Get filter values - USE GLOBAL FILTER
    const globalRepoFilter = document.getElementById('globalRepoFilter');
    const repoFilterValue = globalRepoFilter ? globalRepoFilter.value : '';
    const stateFilter = Array.from(document.getElementById('stateFilter').selectedOptions).map(opt => opt.value);
    const daysFilter = parseInt(document.getElementById('daysFilter').value);
    
    console.log(`[Dashboard] Filters - Repo: ${repoFilterValue || 'All'}, States: ${stateFilter.join(',')}, Days: ${daysFilter}`);
    
    // Filter PRs
    let filteredPRs = appData.prs;
    
    if (repoFilterValue) {
        const [owner, repo] = repoFilterValue.split('/');
        filteredPRs = filterPRs(filteredPRs, { owner, repo, states: stateFilter, days: daysFilter });
    } else {
        filteredPRs = filterPRs(filteredPRs, { states: stateFilter, days: daysFilter });
    }
    
    console.log(`[Dashboard] Filtered ${filteredPRs.length} PRs from ${appData.prs.length} total`);
    
    // Calculate business hours for each PR
    filteredPRs.forEach(pr => {
        if (!pr.business_days && pr.createdAt) {
            const endDate = pr.mergedAt ? new Date(pr.mergedAt) : 
                           pr.closedAt ? new Date(pr.closedAt) : 
                           new Date();
            const bhResult = calculateBusinessHours(pr.createdAt, endDate);
            pr.business_days = bhResult.business_days;
            pr.business_hours = bhResult.business_hours;
            pr.total_hours = bhResult.total_hours;
        }
    });
    
    // Update metrics
    updateDashboardMetrics(filteredPRs);
    
    // Update timeline chart
    updateTimelineChart(filteredPRs);
    
    // Update PR table
    updatePRTable(filteredPRs);
    
    // Update risky PRs section
    updateRiskyPRs(filteredPRs);
    
    // Update action tracker section
    updateActionTracker(filteredPRs);
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
function updateTimelineChart(prs, limit = null) {
    const chartContainer = document.getElementById('timelineChart');
    
    if (prs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">データがありません</div>';
        return;
    }
    
    // Check if Plotly is available
    if (typeof Plotly === 'undefined') {
        chartContainer.innerHTML = '<div class="error-message">⚠️ チャートライブラリの読み込みに失敗しました。ページを再読み込みしてください。</div>';
        console.error('Plotly is not loaded. Cannot render timeline chart.');
        return;
    }
    
    // Get limit from dropdown if not provided
    if (limit === null) {
        const limitSelect = document.getElementById('timelineLimit');
        const limitValue = limitSelect ? limitSelect.value : '30';
        limit = limitValue === 'all' ? prs.length : parseInt(limitValue);
    }
    
    // Sort PRs by creation date (newest first) and apply limit
    const sortedPRs = prs
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    
    // Prepare data for Gantt-style chart
    const traces = [];
    const maxTitleLen = 28;
    
    sortedPRs.forEach((pr, index) => {
        const shortTitle = pr.title.length > maxTitleLen ? pr.title.substring(0, maxTitleLen) + '…' : pr.title;
        const label = `#${pr.number}: ${shortTitle}`;
        const prLink = `https://github.com/${pr.owner}/${pr.repo}/pull/${pr.number}`;
        
        // 開始日時と終了日時を計算
        const startDate = new Date(pr.createdAt);
        const endDate = pr.mergedAt ? new Date(pr.mergedAt) : 
                       pr.closedAt ? new Date(pr.closedAt) : 
                       new Date();
        
        // 期間（日数）を計算
        const duration = endDate - startDate;
        
        let color = window.CONFIG.charts.colors[pr.state] || '#6b7280';
        if (pr.isDraft) color = window.CONFIG.charts.colors.draft;
        
        // 各PRを個別のトレースとして追加（ガントチャートスタイル）
        // Business metrics already enriched in app.js
        const businessDays = typeof pr.business_days === 'number' ? pr.business_days : 0;
        const businessHours = typeof pr.business_hours === 'number' ? pr.business_hours : 0;

        traces.push({
            type: 'bar',
            orientation: 'h',
            x: [duration],
            y: [label],
            base: [startDate.getTime()],
            marker: { 
                color: color,
                line: {
                    color: color,
                    width: 1
                }
            },
            name: pr.state,
            showlegend: false,
            text: [`${pr.state}`],
            textposition: 'none',
            customdata: [[prLink, pr.number, pr.title, pr.state, pr.createdAt, pr.mergedAt, pr.closedAt, pr.age_hours, businessHours, businessDays]],
            hovertemplate: `<b>PR #${pr.number}</b><br>` +
                          `${pr.title}<br>` +
                          `状態: ${pr.state}<br>` +
                          `作成: ${formatDate(pr.createdAt)}<br>` +
                          `${pr.mergedAt ? `マージ: ${formatDate(pr.mergedAt)}<br>` : ''}` +
                          `${pr.closedAt && !pr.mergedAt ? `クローズ: ${formatDate(pr.closedAt)}<br>` : ''}` +
                          `期間: ${Math.round(duration / (1000 * 60 * 60 * 24))}日 (営業: ${businessDays.toFixed(1)}日 / ${businessHours.toFixed(1)}h)<br>` +
                          `経過時間: ${pr.age_hours.toFixed(1)}h<br>` +
                          `<br><b>クリックで詳細を表示</b>` +
                          `<extra></extra>`
        });
    });

    const layout = {
        title: `PR Timeline (最新${sortedPRs.length}件${sortedPRs.length < prs.length ? ' / 全' + prs.length + '件' : ''}) - クリックで詳細表示`,
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
        height: 600,
        margin: { l: 280, r: 50, t: 50, b: 50 },
        hovermode: 'closest',
        barmode: 'stack',
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        toImageButtonOptions: { format: 'svg' },
    };
    
    try {
        Plotly.newPlot(chartContainer, traces, layout, config).then(() => {
            // クリックイベントでPR詳細ページを開く
            chartContainer.on('plotly_click', function(data) {
                if (data && data.points && data.points.length > 0) {
                    // curveNumberが実際のPRのインデックス(各PRが個別のトレース)
                    const curveNumber = data.points[0].curveNumber;
                    const pr = sortedPRs[curveNumber];
                    
                    console.log('Timeline clicked - curveNumber:', curveNumber, 'PR:', pr);
                    
                    if (pr && typeof navigateToPRDetail === 'function') {
                        navigateToPRDetail(pr.owner, pr.repo, pr.number);
                    } else {
                        console.error('PR not found or navigateToPRDetail not available', { pr, navigateToPRDetail });
                    }
                }
            });
        });
    } catch (error) {
        console.error('Failed to render PR timeline chart:', error);
        chartContainer.innerHTML = '<div class="error-message">Timeline chart could not be rendered</div>';
    }
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
                    <th>営業日</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPRs.slice(0, 50).map(pr => {
                    const stateColor = window.CONFIG.charts.colors[pr.state] || '#6b7280';
                    const additions = pr.additions || 0;
                    const deletions = pr.deletions || 0;
                    const comments = pr.comments || 0;
                    
                    return `
                        <tr style="cursor: pointer;" onclick="navigateToPRDetail('${pr.owner}', '${pr.repo}', ${pr.number})">
                            <td><span style="color: var(--secondary-color); font-weight: 600;">#${pr.number}</span></td>
                            <td>${pr.title}</td>
                            <td><span style="color: ${stateColor}; font-weight: 600;">${pr.state}</span></td>
                            <td>${pr.author || '-'}</td>
                            <td>${formatDate(pr.createdAt)}</td>
                            <td>
                                <span style="color: var(--success-color);">+${additions}</span>
                                <span style="color: var(--primary-color);">-${deletions}</span>
                            </td>
                            <td>${comments}</td>
                            <td>${(pr.business_days || 0).toFixed(1)}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        ${sortedPRs.length > 50 ? `<p style="text-align: center; margin-top: 1rem; color: var(--text-secondary);">最初の50件のみ表示 (全${sortedPRs.length}件)</p>` : ''}
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// Handle timeline limit change
function handleTimelineLimitChange() {
    console.log('Timeline limit changed');
    // Reload dashboard data to update timeline
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
}

// Show score breakdown tooltip
function showScoreBreakdown(event, pr, danger) {
    event.stopPropagation();
    
    // Remove existing tooltip
    const existingTooltip = document.querySelector('.score-tooltip');
    if (existingTooltip) existingTooltip.remove();
    
    // Calculate score breakdown
    const ageMs = new Date() - new Date(pr.createdAt);
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageScore = ageDays > 3 ? Math.min((ageDays - 3) * 5, 30) : 0;
    
    const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
    let sizeScore = 0;
    if (totalChanges > 1000) sizeScore = 20;
    else if (totalChanges > 500) sizeScore = 10;
    
    const reviewCount = (pr.reviews && pr.reviews.length) || 0;
    const reviewScore = (reviewCount === 0 && ageDays > 2) ? 15 : 0;
    
    const changesRequested = pr.changes_requested || 0;
    const changesScore = changesRequested * 8;
    
    const unresolvedThreads = pr.unresolved_threads || 0;
    const threadsScore = unresolvedThreads * 5;
    
    const changedFiles = pr.changedFiles || 0;
    const filesScore = changedFiles > 20 ? 10 : 0;
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'score-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        background: var(--card-bg);
        border: 2px solid ${danger.color};
        border-radius: 12px;
        padding: 1rem;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 320px;
        font-size: 0.9rem;
    `;
    
    const breakdown = [
        { label: '放置期間', score: ageScore, detail: `${ageDays}日 (3日超: 5点/日)` },
        { label: '変更量', score: sizeScore, detail: `${totalChanges}行` },
        { label: 'レビュー不足', score: reviewScore, detail: reviewCount === 0 ? 'レビューなし' : `${reviewCount}件` },
        { label: '修正要求', score: changesScore, detail: `${changesRequested}件 (8点/件)` },
        { label: '未解決スレッド', score: threadsScore, detail: `${unresolvedThreads}件 (5点/件)` },
        { label: 'ファイル数', score: filesScore, detail: `${changedFiles}ファイル` }
    ].filter(item => item.score > 0);
    
    tooltip.innerHTML = `
        <div style="font-weight: 700; color: ${danger.color}; margin-bottom: 0.75rem; font-size: 1rem;">
            📊 スコア内訳 (合計: ${danger.score}点)
        </div>
        ${breakdown.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                <div>
                    <div style="font-weight: 600;">${item.label}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${item.detail}</div>
                </div>
                <div style="font-weight: 700; color: ${danger.color}; font-size: 1.1rem;">+${item.score}</div>
            </div>
        `).join('')}
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 2px solid ${danger.color}; text-align: center; font-size: 0.85rem; color: var(--text-secondary);">
            クリックして閉じる
        </div>
    `;
    
    // Position tooltip near cursor
    tooltip.style.left = `${Math.min(event.clientX + 10, window.innerWidth - 340)}px`;
    tooltip.style.top = `${Math.min(event.clientY + 10, window.innerHeight - 400)}px`;
    
    document.body.appendChild(tooltip);
    
    // Close on click
    tooltip.addEventListener('click', (e) => {
        e.stopPropagation();
        tooltip.remove();
    });
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', () => tooltip.remove(), { once: true });
    }, 100);
}

// Update risky PRs section
function updateRiskyPRs(prs) {
    const container = document.getElementById('riskyPRsContainer');
    if (!container) return;
    
    // Only show OPEN PRs
    const openPRs = prs.filter(pr => pr.state === 'OPEN');
    
    // Calculate danger level for each PR (if function is available)
    if (typeof window.calculatePRDangerLevel !== 'function') {
        console.warn('[Dashboard] calculatePRDangerLevel function not available');
        return;
    }
    
    const prsWithDanger = openPRs.map(pr => ({
        ...pr,
        danger: window.calculatePRDangerLevel(pr)
    }));
    
    // Filter only risky PRs (score >= 15)
    const riskyPRs = prsWithDanger.filter(pr => pr.danger.score >= 15);
    
    // Sort by danger score (highest first)
    riskyPRs.sort((a, b) => b.danger.score - a.danger.score);
    
    // Take top 5
    const topRiskyPRs = riskyPRs.slice(0, 5);
    
    if (topRiskyPRs.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">✅</div>
                <div style="font-size: 1.1rem; font-weight: 600;">リスクの高いPRはありません</div>
                <div style="margin-top: 0.5rem; opacity: 0.7;">すべてのPRが健全な状態です</div>
            </div>
        `;
        return;
    }
    
    const riskyHTML = topRiskyPRs.map((pr, index) => {
        const ageMs = new Date() - new Date(pr.createdAt);
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        
        return `
            <div class="risky-pr-card" style="
                background: ${pr.danger.color}08;
                border-left: 4px solid ${pr.danger.color};
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
                cursor: pointer;
                transition: all 0.2s;
            " onclick="navigateToPRDetail('${pr.owner}', '${pr.repo}', ${pr.number})"
            onmouseover="this.style.background='${pr.danger.color}15'"
            onmouseout="this.style.background='${pr.danger.color}08'">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                            <span style="font-size: 1.5rem;">${pr.danger.emoji}</span>
                            <span style="font-weight: 700; color: ${pr.danger.color};">${pr.danger.label}</span>
                            <span 
                                id="score-badge-${index}"
                                style="
                                    background: ${pr.danger.color}22; 
                                    color: ${pr.danger.color}; 
                                    padding: 0.2rem 0.6rem; 
                                    border-radius: 12px; 
                                    font-size: 0.8rem; 
                                    font-weight: 600;
                                    cursor: help;
                                    border: 1px solid ${pr.danger.color}44;
                                    transition: all 0.2s;
                                "
                                onmouseover="this.style.background='${pr.danger.color}33'; this.style.transform='scale(1.05)'"
                                onmouseout="this.style.background='${pr.danger.color}22'; this.style.transform='scale(1)'"
                                title="クリックでスコア内訳を表示">
                                📊 スコア: ${pr.danger.score}
                            </span>
                        </div>
                        <div style="font-weight: 600; margin-bottom: 0.3rem;">
                            #${pr.number} ${pr.title}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <span>👤 ${pr.author}</span>
                            <span style="margin-left: 1rem;">⏱️ ${ageDays}日前</span>
                            <span style="margin-left: 1rem;">📝 ${(pr.additions || 0) + (pr.deletions || 0)} 行</span>
                        </div>
                    </div>
                </div>
                ${pr.danger.warnings.length > 0 ? `
                <div style="background: var(--card-bg); padding: 0.75rem; border-radius: 6px; font-size: 0.9rem;">
                    <strong style="color: ${pr.danger.color};">⚠️ 検出された問題:</strong>
                    <ul style="margin: 0.3rem 0 0 0; padding-left: 1.5rem;">
                        ${pr.danger.warnings.slice(0, 3).map(w => `<li style="margin: 0.2rem 0;">${w}</li>`).join('')}
                        ${pr.danger.warnings.length > 3 ? `<li style="opacity: 0.7;">他 ${pr.danger.warnings.length - 3}件...</li>` : ''}
                    </ul>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = riskyHTML;
    
    // Add click handlers for score badges
    topRiskyPRs.forEach((pr, index) => {
        const badge = document.getElementById(`score-badge-${index}`);
        if (badge) {
            badge.addEventListener('click', (e) => showScoreBreakdown(e, pr, pr.danger));
        }
    });
}

// Update Action Tracker section
function updateActionTracker(prs) {
    const container = document.getElementById('actionTrackerContainer');
    if (!container) return;
    
    // Filter only OPEN PRs
    const openPRs = prs.filter(pr => pr.state === 'OPEN');
    
    if (openPRs.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">✅</div>
                <div style="font-size: 1.1rem; font-weight: 600;">OPENのPRはありません</div>
            </div>
        `;
        return;
    }
    
    // Check if determineActionOwner is available
    if (typeof window.determineActionOwner !== 'function') {
        console.warn('[Dashboard] determineActionOwner function not available');
        container.innerHTML = '<div class="loading">機能を読み込み中...</div>';
        return;
    }
    
    // Build action summary by user
    const userActions = {};
    
    openPRs.forEach(pr => {
        const actionInfo = window.determineActionOwner(pr);
        
        if (actionInfo.action === 'none') return;
        
        actionInfo.waitingFor.forEach(user => {
            if (!userActions[user]) {
                userActions[user] = {
                    author: [],
                    reviewer: []
                };
            }
            
            const role = user === pr.author ? 'author' : 'reviewer';
            userActions[user][role].push({
                pr: pr,
                actionInfo: actionInfo
            });
        });
    });
    
    // Sort users by total action count
    const sortedUsers = Object.entries(userActions)
        .map(([user, actions]) => ({
            user,
            authorCount: actions.author.length,
            reviewerCount: actions.reviewer.length,
            totalCount: actions.author.length + actions.reviewer.length,
            actions
        }))
        .sort((a, b) => b.totalCount - a.totalCount);
    
    if (sortedUsers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                <div style="font-size: 1.1rem; font-weight: 600;">アクションが必要なPRはありません</div>
                <div style="margin-top: 0.5rem; opacity: 0.7;">すべてのPRが順調に進んでいます</div>
            </div>
        `;
        return;
    }
    
    // Render user cards (top 5)
    const topUsers = sortedUsers.slice(0, 5);
    
    const actionHTML = topUsers.map(userInfo => {
        const { user, authorCount, reviewerCount, totalCount, actions } = userInfo;
        
        // Determine card color based on action type
        let bgColor = '#e0e7ff';
        let borderColor = '#6366f1';
        let icon = '👤';
        
        if (authorCount > reviewerCount) {
            bgColor = '#dbeafe';
            borderColor = '#3b82f6';
            icon = '✍️';
        } else if (reviewerCount > authorCount) {
            bgColor = '#fef3c7';
            borderColor = '#f59e0b';
            icon = '👀';
        }
        
        return `
            <div style="
                background: ${bgColor};
                border-left: 4px solid ${borderColor};
                border-radius: 8px;
                padding: 1rem;
                margin-bottom: 1rem;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.5rem;">${icon}</span>
                        <span style="font-weight: 700; font-size: 1.1rem;">${user}</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        ${authorCount > 0 ? `
                        <span style="background: #3b82f6; color: white; padding: 0.3rem 0.7rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                            作成者 ${authorCount}件
                        </span>
                        ` : ''}
                        ${reviewerCount > 0 ? `
                        <span style="background: #f59e0b; color: white; padding: 0.3rem 0.7rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
                            レビュー ${reviewerCount}件
                        </span>
                        ` : ''}
                    </div>
                </div>
                
                <div style="background: var(--card-bg); border-radius: 6px; padding: 0.75rem; font-size: 0.9rem;">
                    ${actions.author.length > 0 ? `
                    <div style="margin-bottom: ${actions.reviewer.length > 0 ? '0.75rem' : '0'};">
                        <strong style="color: #3b82f6;">✍️ 作成者として対応が必要:</strong>
                        <ul style="margin: 0.3rem 0 0 0; padding-left: 1.5rem;">
                            ${actions.author.slice(0, 3).map(item => `
                            <li style="margin: 0.2rem 0; cursor: pointer; transition: color 0.2s;" 
                                onclick="navigateToPRDetail('${item.pr.owner}', '${item.pr.repo}', ${item.pr.number})"
                                onmouseover="this.style.color='var(--primary-color)'"
                                onmouseout="this.style.color='inherit'">
                                #${item.pr.number} ${item.pr.title.length > 40 ? item.pr.title.substring(0, 40) + '...' : item.pr.title}
                                <span style="opacity: 0.7; font-size: 0.85rem;"> - ${item.actionInfo.reason}</span>
                            </li>
                            `).join('')}
                            ${actions.author.length > 3 ? `<li style="opacity: 0.7;">他 ${actions.author.length - 3}件...</li>` : ''}
                        </ul>
                    </div>
                    ` : ''}
                    
                    ${actions.reviewer.length > 0 ? `
                    <div>
                        <strong style="color: #f59e0b;">👀 レビュー待ち:</strong>
                        <ul style="margin: 0.3rem 0 0 0; padding-left: 1.5rem;">
                            ${actions.reviewer.slice(0, 3).map(item => `
                            <li style="margin: 0.2rem 0; cursor: pointer; transition: color 0.2s;" 
                                onclick="navigateToPRDetail('${item.pr.owner}', '${item.pr.repo}', ${item.pr.number})"
                                onmouseover="this.style.color='var(--primary-color)'"
                                onmouseout="this.style.color='inherit'">
                                #${item.pr.number} ${item.pr.title.length > 40 ? item.pr.title.substring(0, 40) + '...' : item.pr.title}
                                <span style="opacity: 0.7; font-size: 0.85rem;"> - by ${item.pr.author}</span>
                            </li>
                            `).join('')}
                            ${actions.reviewer.length > 3 ? `<li style="opacity: 0.7;">他 ${actions.reviewer.length - 3}件...</li>` : ''}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = actionHTML;
    
    if (sortedUsers.length > 5) {
        container.innerHTML += `
            <div style="text-align: center; padding: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                他 ${sortedUsers.length - 5}人のユーザーにもアクションが必要です
            </div>
        `;
    }
}

// Export functions
window.loadDashboardData = loadDashboardData;
window.handleTimelineLimitChange = handleTimelineLimitChange;
