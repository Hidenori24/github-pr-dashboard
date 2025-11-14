// Analytics Page Logic

// Load analytics data
function loadAnalyticsData() {
    console.log('Loading analytics data...');
    
    // Reload the currently active tab, or load the first tab by default
    const activeTab = document.querySelector('.analysis-tab.active');
    const tabName = activeTab ? activeTab.getAttribute('data-tab') : 'residence';
    
    console.log('Reloading analytics tab:', tabName);
    loadTabData(tabName);
}

// Get filtered PRs based on repository selection
function getFilteredPRsForAnalytics() {
    // Use global filter only
    const globalFilter = document.getElementById('globalRepoFilter');
    const selectedRepo = globalFilter ? globalFilter.value : '';
    
    let filteredPRs = appData.prs || [];
    
    if (selectedRepo) {
        const [owner, repo] = selectedRepo.split('/');
        filteredPRs = filteredPRs.filter(pr => pr.owner === owner && pr.repo === repo);
        console.log(`Filtered to ${filteredPRs.length} PRs for ${selectedRepo}`);
    }

    // Ensure reviews array exists (enriched in app.js, but safeguard)
    filteredPRs.forEach(pr => {
        if (!pr.reviews && pr.review_details) {
            pr.reviews = pr.review_details.map(r => ({ author: r.author, state: r.state, createdAt: r.createdAt }));
        }
    });
    
    return filteredPRs;
}

// Load data for a specific tab
function loadTabData(tabName) {
    console.log('Loading tab data:', tabName);
    
    switch (tabName) {
        case 'residence':
            loadResidenceAnalysis();
            break;
        case 'blocker':
            loadBlockerAnalysis();
            break;
        case 'reviewer':
            loadReviewerAnalysis();
            break;
        case 'trend':
            loadTrendAnalysis();
            break;
        case 'bottleneck':
            loadBottleneckAnalysis();
            break;
        case 'speed':
            loadSpeedAnalysis();
            break;
        case 'pattern':
            loadPatternAnalysis();
            break;
    }
}

// Residence Analysis: Open PR distribution
function loadResidenceAnalysis() {
    const chartContainer = document.getElementById('residenceChart');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    const openPRs = filteredPRs.filter(pr => pr.state === 'OPEN');
    
    if (openPRs.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><p>📭 Open PRがありません</p><p class="text-muted">素晴らしい！全てのPRが処理されています。</p></div>';
        return;
    }
    
    // Calculate hours since creation (age_hours) & business metrics
    const now = new Date();
    openPRs.forEach(pr => {
        const created = new Date(pr.createdAt);
        pr.age_hours = (now - created) / (1000 * 60 * 60);
        try {
            if (typeof calculateBusinessHours === 'function') {
                const bh = calculateBusinessHours(pr.createdAt, now);
                pr.business_hours = bh.business_hours;
                pr.business_days = bh.business_days;
            }
        } catch (e) {
            pr.business_hours = pr.age_hours * (5/7);
            pr.business_days = (pr.business_hours / 24);
        }
    });
    
    // Create age buckets (Streamlitと同じカテゴリ)
    const bins = [0, 24, 72, 168, 336, 672, 999999];
    const labels = ['<1d', '1-3d', '3-7d', '7-14d', '14-28d', '>=28d'];
    const distribution = {};
    labels.forEach(label => distribution[label] = 0);
    
    openPRs.forEach(pr => {
        for (let i = 0; i < bins.length - 1; i++) {
            if (pr.age_hours >= bins[i] && pr.age_hours < bins[i + 1]) {
                distribution[labels[i]]++;
                pr.age_bucket = labels[i];
                break;
            }
        }
    });
    
    // ヒストグラム用のデータ準備
    const trace1 = {
        x: labels,
        y: labels.map(l => distribution[l]),
        type: 'bar',
        name: 'OPEN PR数',
        marker: {
            color: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#dc2626'],
            line: {
                color: 'rgba(255,255,255,0.3)',
                width: 1
            }
        },
        text: labels.map(l => distribution[l]),
        textposition: 'auto',
        hovertemplate: '<b>%{x}</b><br>OPEN PR数: %{y}件<extra></extra>'
    };
    
    const layout = {
        title: {
            text: 'OPEN PR 滞留分布',
            font: { size: 16, weight: 600 }
        },
        xaxis: { 
            title: '経過時間カテゴリ',
            tickangle: -45
        },
        yaxis: { title: 'PR数' },
        height: 400,
        margin: { l: 60, r: 30, t: 50, b: 80 },
        showlegend: false
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        toImageButtonOptions: { format: 'svg' }
    };
    
    // チャート描画
    Plotly.newPlot(chartContainer, [trace1], layout, config);
    
    // サマリー情報を追加
    const summaryContainer = document.getElementById('residenceSummary');
    if (summaryContainer) {
    const median = calculateMedian(openPRs.map(pr => pr.age_hours));
    const medianBusiness = calculateMedian(openPRs.map(pr => pr.business_days || 0));
        const stale = openPRs.filter(pr => pr.age_hours >= 168).length;
        const urgent = openPRs.filter(pr => pr.age_hours >= 336).length;
        
        summaryContainer.innerHTML = `
            <div class="metrics-row">
                <div class="metric-card">
                    <div class="metric-label">総OPEN PR数</div>
                    <div class="metric-value">${openPRs.length}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">中央値</div>
                    <div class="metric-value">${(median / 24).toFixed(1)}日</div>
                    <div class="metric-description">${median.toFixed(0)}時間 (営業 ${(medianBusiness).toFixed(1)}日)</div>
                </div>
                <div class="metric-card warning">
                    <div class="metric-label">Stale (7日以上)</div>
                    <div class="metric-value">${stale}</div>
                    <div class="metric-description">${(stale / openPRs.length * 100).toFixed(0)}%</div>
                </div>
                <div class="metric-card danger">
                    <div class="metric-label">要注意 (14日以上)</div>
                    <div class="metric-value">${urgent}</div>
                    <div class="metric-description">${(urgent / openPRs.length * 100).toFixed(0)}%</div>
                </div>
            </div>
        `;
    }
}

// Helper: Calculate median
function calculateMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Blocker Analysis: Reasons for unresolved PRs
function loadBlockerAnalysis() {
    const chartContainer = document.getElementById('blockerChart');
    const tableContainer = document.getElementById('blockerTable');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    const openPRs = filteredPRs.filter(pr => pr.state === 'OPEN');
    
    if (openPRs.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><p>📭 Open PRがありません</p></div>';
        if (tableContainer) tableContainer.innerHTML = '';
        return;
    }
    
    // Streamlit版のinfer_blockerロジックを実装
    const STALE_HOURS = 168; // 7日
    const now = new Date();
    
    const blockerCategories = {
        'Draft': { count: 0, prs: [], color: '#ffa421', icon: '📝' },
        'Changes Requested': { count: 0, prs: [], color: '#ef4444', icon: '🔧' },
        'CI Failed': { count: 0, prs: [], color: '#dc2626', icon: '❌' },
        'Conflict': { count: 0, prs: [], color: '#f97316', icon: '⚠️' },
        'Review Required': { count: 0, prs: [], color: '#3b82f6', icon: '👀' },
        'Ready to Merge': { count: 0, prs: [], color: '#10b981', icon: '✅' },
        'Stale': { count: 0, prs: [], color: '#6b7280', icon: '🕐' },
        'Unknown': { count: 0, prs: [], color: '#9ca3af', icon: '❓' }
    };
    
    openPRs.forEach(pr => {
        const ageHours = (now - new Date(pr.createdAt)) / (1000 * 60 * 60);
        let blocker = 'Unknown';
        
        // 優先度順に判定（Streamlit版と同じロジック）
        if (pr.isDraft) {
            blocker = 'Draft';
        } else if (pr.reviewDecision === 'CHANGES_REQUESTED' || (pr.reviews && pr.reviews.some(r => r.state === 'CHANGES_REQUESTED'))) {
            blocker = 'Changes Requested';
        } else if (pr.checks_state && ['FAILURE', 'FAILED'].includes(pr.checks_state.toUpperCase())) {
            blocker = 'CI Failed';
        } else if (pr.mergeable === 'CONFLICTING' || (pr.mergeStateStatus && ['DIRTY', 'BEHIND', 'BLOCKED'].includes(pr.mergeStateStatus))) {
            blocker = 'Conflict';
        } else if (pr.reviewDecision === 'REVIEW_REQUIRED' || !pr.reviews || pr.reviews.length === 0) {
            blocker = 'Review Required';
        } else if (pr.mergeable === 'MERGEABLE' || (pr.mergeStateStatus && ['CLEAN', 'UNSTABLE', 'HAS_HOOKS'].includes(pr.mergeStateStatus))) {
            blocker = 'Ready to Merge';
        } else if (ageHours >= STALE_HOURS) {
            blocker = 'Stale';
        }
        
        blockerCategories[blocker].count++;
        blockerCategories[blocker].prs.push({
            number: pr.number,
            title: pr.title,
            author: pr.author,
            ageHours: ageHours,
            url: pr.url,
            owner: pr.owner,
            repo: pr.repo
        });
    });
    
    // 円グラフ用のデータ準備（カウントが0より大きいもののみ）
    const activeBlockers = Object.entries(blockerCategories).filter(([_, data]) => data.count > 0);
    
    const trace = {
        labels: activeBlockers.map(([name, data]) => `${data.icon} ${name}`),
        values: activeBlockers.map(([_, data]) => data.count),
        type: 'pie',
        marker: {
            colors: activeBlockers.map(([_, data]) => data.color)
        },
        textinfo: 'label+percent+value',
        hovertemplate: '<b>%{label}</b><br>%{value}件 (%{percent})<extra></extra>'
    };
    
    const layout = {
        title: {
            text: 'Open PR ブロッカー分析',
            font: { size: 16, weight: 600 }
        },
        height: 450,
        margin: { l: 20, r: 20, t: 50, b: 20 },
        showlegend: true,
        legend: {
            orientation: 'v',
            x: 1.05,
            y: 0.5
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        toImageButtonOptions: { format: 'svg' }
    };
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
    
    // 詳細テーブルを表示
    if (tableContainer) {
        let tableHTML = `
            <h3 style="margin: 1.5rem 0 1rem 0;">ブロッカー別詳細</h3>
            <div class="blocker-details">
        `;
        
        activeBlockers.forEach(([name, data]) => {
            tableHTML += `
                <div class="blocker-category" style="border-left: 4px solid ${data.color}; margin-bottom: 1.5rem; padding-left: 1rem;">
                    <h4 style="margin: 0.5rem 0;">${data.icon} ${name} (${data.count}件)</h4>
                    <table class="data-table" style="margin-top: 0.5rem;">
                        <thead>
                            <tr>
                                <th>PR#</th>
                                <th>タイトル</th>
                                <th>作成者</th>
                                <th>経過時間</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            data.prs.slice(0, 10).forEach(pr => {
                const days = (pr.ageHours / 24).toFixed(1);
                tableHTML += `
                    <tr style="cursor: pointer;" onclick="navigateToPRDetail('${pr.owner}', '${pr.repo}', ${pr.number})">
                        <td><strong>#${pr.number}</strong></td>
                        <td>${pr.title}</td>
                        <td>${pr.author || 'Unknown'}</td>
                        <td>${days}日</td>
                    </tr>
                `;
            });
            
            if (data.prs.length > 10) {
                tableHTML += `
                    <tr>
                        <td colspan="4" style="text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                            ... 他${data.prs.length - 10}件
                        </td>
                    </tr>
                `;
            }
            
            tableHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        tableHTML += '</div>';
        tableContainer.innerHTML = tableHTML;
    }
}

// Reviewer Analysis: Review activity
function loadReviewerAnalysis() {
    const chartContainer = document.getElementById('reviewerChart');
    const summaryContainer = document.getElementById('reviewerSummary');
    const detailsContainer = document.getElementById('reviewerDetails');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    
    // レビューアクティビティを詳細に収集
    const reviewerStats = {};
    const reviewerComments = {};
    
    filteredPRs.forEach(pr => {
        // レビュー統計
        if (pr.reviews && Array.isArray(pr.reviews)) {
            pr.reviews.forEach(review => {
                const author = review.author || 'Unknown';
                if (!reviewerStats[author]) {
                    reviewerStats[author] = {
                        total: 0,
                        approved: 0,
                        changesRequested: 0,
                        commented: 0,
                        totalComments: 0,
                        prsReviewed: new Set()
                    };
                }
                reviewerStats[author].total++;
                reviewerStats[author].prsReviewed.add(pr.number);
                
                if (review.state === 'APPROVED') {
                    reviewerStats[author].approved++;
                } else if (review.state === 'CHANGES_REQUESTED') {
                    reviewerStats[author].changesRequested++;
                } else if (review.state === 'COMMENTED') {
                    reviewerStats[author].commented++;
                }
            });
        }
        
        // コメント統計
        if (pr.comments_details && Array.isArray(pr.comments_details)) {
            pr.comments_details.forEach(comment => {
                const author = comment.author || 'Unknown';
                if (!reviewerComments[author]) {
                    reviewerComments[author] = 0;
                }
                reviewerComments[author]++;
                
                if (reviewerStats[author]) {
                    reviewerStats[author].totalComments++;
                }
            });
        }
    });
    
    if (Object.keys(reviewerStats).length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><p>📭 レビューデータがありません</p></div>';
        return;
    }
    
    // Sort by total reviews
    const sortedReviewers = Object.entries(reviewerStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);
    
    // スタックバーチャート（Approved / Changes Requested / Commented）
    const trace1 = {
        x: sortedReviewers.map(r => r[0]),
        y: sortedReviewers.map(r => r[1].approved),
        name: 'Approved',
        type: 'bar',
        marker: { color: '#10b981' },
        hovertemplate: '<b>%{x}</b><br>Approved: %{y}<extra></extra>'
    };
    
    const trace2 = {
        x: sortedReviewers.map(r => r[0]),
        y: sortedReviewers.map(r => r[1].changesRequested),
        name: 'Changes Requested',
        type: 'bar',
        marker: { color: '#ef4444' },
        hovertemplate: '<b>%{x}</b><br>Changes Requested: %{y}<extra></extra>'
    };
    
    const trace3 = {
        x: sortedReviewers.map(r => r[0]),
        y: sortedReviewers.map(r => r[1].commented),
        name: 'Commented',
        type: 'bar',
        marker: { color: '#3b82f6' },
        hovertemplate: '<b>%{x}</b><br>Commented: %{y}<extra></extra>'
    };
    
    const layout = {
        title: {
            text: 'レビュワー別アクティビティ (Top 20)',
            font: { size: 16, weight: 600 }
        },
        xaxis: {
            title: 'レビュワー',
            tickangle: -45
        },
        yaxis: { title: 'レビュー数' },
        barmode: 'stack',
        height: 450,
        margin: { l: 60, r: 30, t: 50, b: 120 }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        toImageButtonOptions: { format: 'svg' }
    };
    
    Plotly.newPlot(chartContainer, [trace1, trace2, trace3], layout, config);
    
    // サマリー情報
    if (summaryContainer) {
        const totalReviewers = Object.keys(reviewerStats).length;
        const totalReviews = Object.values(reviewerStats).reduce((sum, s) => sum + s.total, 0);
        const totalComments = Object.values(reviewerComments).reduce((sum, c) => sum + c, 0);
        const avgReviewsPerPerson = (totalReviews / totalReviewers).toFixed(1);
        
        summaryContainer.innerHTML = `
            <div class="metrics-row">
                <div class="metric-card">
                    <div class="metric-label">総レビュワー数</div>
                    <div class="metric-value">${totalReviewers}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">総レビュー数</div>
                    <div class="metric-value">${totalReviews}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">総コメント数</div>
                    <div class="metric-value">${totalComments}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">平均レビュー数/人</div>
                    <div class="metric-value">${avgReviewsPerPerson}</div>
                </div>
            </div>
        `;
    }
    
    // 詳細テーブル
    if (detailsContainer) {
        let tableHTML = `
            <h3 style="margin: 1.5rem 0 1rem 0;">レビュワー詳細統計</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>レビュワー</th>
                        <th>総レビュー数</th>
                        <th>Approved</th>
                        <th>Changes Req.</th>
                        <th>Commented</th>
                        <th>総コメント数</th>
                        <th>レビューしたPR数</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedReviewers.forEach(([name, stats]) => {
            const comments = reviewerComments[name] || 0;
            const prCount = stats.prsReviewed.size;
            
            tableHTML += `
                <tr>
                    <td><strong>${name}</strong></td>
                    <td>${stats.total}</td>
                    <td style="color: var(--success-color);">${stats.approved}</td>
                    <td style="color: var(--chart-danger);">${stats.changesRequested}</td>
                    <td style="color: var(--chart-info);">${stats.commented}</td>
                    <td>${comments}</td>
                    <td>${prCount}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        detailsContainer.innerHTML = tableHTML;
    }
}

// Trend Analysis: Weekly PR creation trend
function loadTrendAnalysis() {
    const chartContainer = document.getElementById('trendChart');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    
    // Group PRs by week
    const weeklyData = {};
    
    filteredPRs.forEach(pr => {
        const created = new Date(pr.createdAt);
        const weekStart = new Date(created);
        weekStart.setDate(created.getDate() - created.getDay()); // Start of week (Sunday)
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = { open: 0, merged: 0, closed: 0 };
        }
        
        if (pr.state === 'OPEN') weeklyData[weekKey].open++;
        else if (pr.state === 'MERGED') weeklyData[weekKey].merged++;
        else if (pr.state === 'CLOSED') weeklyData[weekKey].closed++;
    });
    
    // Sort by date
    const sortedWeeks = Object.keys(weeklyData).sort();
    
    const trace1 = {
        x: sortedWeeks,
        y: sortedWeeks.map(w => weeklyData[w].merged),
        name: 'Merged',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#21c354' }
    };
    
    const trace2 = {
        x: sortedWeeks,
        y: sortedWeeks.map(w => weeklyData[w].open),
        name: 'Open',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#ff4b4b' }
    };
    
    const trace3 = {
        x: sortedWeeks,
        y: sortedWeeks.map(w => weeklyData[w].closed),
        name: 'Closed',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#6b7280' }
    };
    
    const layout = {
        title: '週次PR作成トレンド',
        xaxis: { title: '週' },
        yaxis: { title: 'PR数' },
        height: CONFIG.charts.defaultHeight
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, [trace1, trace2, trace3], layout, config);
}

// Bottleneck Analysis: Review and fix wait times
function loadBottleneckAnalysis() {
    const chartContainer = document.getElementById('bottleneckChart');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    const openPRs = filteredPRs.filter(pr => pr.state === 'OPEN');
    
    if (openPRs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">Open PRがありません</div>';
        return;
    }
    
    // Calculate wait times
    const now = new Date();
    const waitTimes = openPRs.map(pr => {
        const created = new Date(pr.createdAt);
        const days = (now - created) / (1000 * 60 * 60 * 24);
        return {
            number: pr.number,
            title: pr.title,
            days: days,
            state: pr.isDraft ? 'Draft' : 'Active'
        };
    }).sort((a, b) => b.days - a.days).slice(0, 20);
    
    const trace = {
        x: waitTimes.map(w => w.days),
        y: waitTimes.map(w => `#${w.number}: ${w.title.substring(0, 40)}...`),
        type: 'bar',
        orientation: 'h',
        marker: {
            color: waitTimes.map(w => w.state === 'Draft' ? '#ffa421' : '#ff4b4b')
        }
    };
    
    const layout = {
        title: 'ボトルネック: 長期滞留PR (Top 20)',
        xaxis: { title: '経過日数' },
        yaxis: { title: 'Pull Request', automargin: true },
        height: 600,
        margin: { l: 300 }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, [trace], layout, config).then(() => {
        // クリックイベントでPR詳細ページを開く
        chartContainer.on('plotly_click', function(data) {
            if (data && data.points && data.points.length > 0) {
                const pointIndex = data.points[0].pointIndex;
                const waitTime = waitTimes[pointIndex];
                const pr = openPRs.find(p => p.number === waitTime.number);
                
                if (pr && typeof navigateToPRDetail === 'function') {
                    navigateToPRDetail(pr.owner, pr.repo, pr.number);
                }
            }
        });
    });
}

// Speed Analysis: Time to merge
function loadSpeedAnalysis() {
    const chartContainer = document.getElementById('speedChart');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    const mergedPRs = filteredPRs.filter(pr => pr.state === 'MERGED' && pr.createdAt && pr.mergedAt);
    
    if (mergedPRs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">Merged PRがありません</div>';
        return;
    }
    
    // Calculate time to merge in days
    const timeToMerge = mergedPRs.map(pr => {
        const created = new Date(pr.createdAt);
        const merged = new Date(pr.mergedAt);
        return (merged - created) / (1000 * 60 * 60 * 24);
    });
    
    // Create distribution
    const distribution = {
        '0-1 day': 0,
        '1-3 days': 0,
        '3-7 days': 0,
        '7-14 days': 0,
        '14+ days': 0
    };
    
    timeToMerge.forEach(days => {
        if (days <= 1) distribution['0-1 day']++;
        else if (days <= 3) distribution['1-3 days']++;
        else if (days <= 7) distribution['3-7 days']++;
        else if (days <= 14) distribution['7-14 days']++;
        else distribution['14+ days']++;
    });
    
    const trace = {
        x: Object.keys(distribution),
        y: Object.values(distribution),
        type: 'bar',
        marker: {
            color: ['#21c354', '#00c0f2', '#ffa421', '#ff4b4b', '#dc2626']
        }
    };
    
    const layout = {
        title: 'レビュー速度: マージまでの時間分布',
        xaxis: { title: '経過時間' },
        yaxis: { title: 'PR数' },
        height: CONFIG.charts.defaultHeight
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
}

// Pattern Analysis: Change patterns
function loadPatternAnalysis() {
    const chartContainer = document.getElementById('patternChart');
    
    const filteredPRs = getFilteredPRsForAnalytics();
    
    if (filteredPRs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">データがありません</div>';
        return;
    }
    
    // Analyze file change patterns
    const prSizes = filteredPRs.map(pr => ({
        number: pr.number,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changedFiles || 0,
        state: pr.state
    }));
    
    const trace = {
        x: prSizes.map(pr => pr.additions + pr.deletions),
        y: prSizes.map(pr => pr.changedFiles),
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 8,
            color: prSizes.map(pr => {
                if (pr.state === 'MERGED') return '#21c354';
                if (pr.state === 'OPEN') return '#ff4b4b';
                return '#6b7280';
            }),
            opacity: 0.6
        },
        text: prSizes.map(pr => `PR #${pr.number}: ${pr.changedFiles} files, +${pr.additions}/-${pr.deletions}`),
        hovertemplate: '%{text}<extra></extra>'
    };
    
    const layout = {
        title: '変更パターン: ファイル数 vs 変更行数',
        xaxis: { title: '変更行数 (追加+削除)', type: 'log' },
        yaxis: { title: 'ファイル数' },
        height: CONFIG.charts.defaultHeight
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, [trace], layout, config).then(() => {
        // クリックイベントでPR詳細ページを開く
        chartContainer.on('plotly_click', function(data) {
            if (data && data.points && data.points.length > 0) {
                const pointIndex = data.points[0].pointIndex;
                const prSize = prSizes[pointIndex];
                const pr = filteredPRs.find(p => p.number === prSize.number);
                
                if (pr && typeof navigateToPRDetail === 'function') {
                    navigateToPRDetail(pr.owner, pr.repo, pr.number);
                }
            }
        });
    });
}

// Export functions
window.loadAnalyticsData = loadAnalyticsData;
window.loadTabData = loadTabData;
