// Analytics Page Logic

// Load analytics data
function loadAnalyticsData() {
    console.log('Loading analytics data...');
    // Load the first tab by default
    loadTabData('residence');
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
    
    const openPRs = appData.prs.filter(pr => pr.state === 'OPEN');
    
    if (openPRs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">Open PRがありません</div>';
        return;
    }
    
    // Calculate days since creation
    const now = new Date();
    const distribution = {
        '0-7 days': 0,
        '8-14 days': 0,
        '15-30 days': 0,
        '31-60 days': 0,
        '61+ days': 0
    };
    
    openPRs.forEach(pr => {
        const created = new Date(pr.createdAt);
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        
        if (days <= 7) distribution['0-7 days']++;
        else if (days <= 14) distribution['8-14 days']++;
        else if (days <= 30) distribution['15-30 days']++;
        else if (days <= 60) distribution['31-60 days']++;
        else distribution['61+ days']++;
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
        title: 'Open PR 滞留時間分布',
        xaxis: { title: '経過日数' },
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

// Blocker Analysis: Reasons for unresolved PRs
function loadBlockerAnalysis() {
    const chartContainer = document.getElementById('blockerChart');
    
    const openPRs = appData.prs.filter(pr => pr.state === 'OPEN');
    
    if (openPRs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">Open PRがありません</div>';
        return;
    }
    
    // Categorize blockers
    const blockers = {
        'Draft PR': 0,
        'Review待ち': 0,
        '修正待ち': 0,
        'その他': 0
    };
    
    openPRs.forEach(pr => {
        if (pr.isDraft) {
            blockers['Draft PR']++;
        } else if (pr.reviewThreads && pr.reviewThreads > 0) {
            blockers['修正待ち']++;
        } else if (pr.comments === 0) {
            blockers['Review待ち']++;
        } else {
            blockers['その他']++;
        }
    });
    
    const trace = {
        labels: Object.keys(blockers),
        values: Object.values(blockers),
        type: 'pie',
        marker: {
            colors: ['#ffa421', '#ff4b4b', '#00c0f2', '#6b7280']
        }
    };
    
    const layout = {
        title: 'Open PR ブロッカー分析',
        height: CONFIG.charts.defaultHeight
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
}

// Reviewer Analysis: Review activity
function loadReviewerAnalysis() {
    const chartContainer = document.getElementById('reviewerChart');
    
    // Count reviews by author
    const reviewerStats = {};
    
    appData.prs.forEach(pr => {
        if (pr.reviews && Array.isArray(pr.reviews)) {
            pr.reviews.forEach(review => {
                const author = review.author || 'Unknown';
                if (!reviewerStats[author]) {
                    reviewerStats[author] = { total: 0, approved: 0, changesRequested: 0 };
                }
                reviewerStats[author].total++;
                
                if (review.state === 'APPROVED') {
                    reviewerStats[author].approved++;
                } else if (review.state === 'CHANGES_REQUESTED') {
                    reviewerStats[author].changesRequested++;
                }
            });
        }
    });
    
    if (Object.keys(reviewerStats).length === 0) {
        chartContainer.innerHTML = '<div class="loading">レビューデータがありません</div>';
        return;
    }
    
    // Sort by total reviews
    const sortedReviewers = Object.entries(reviewerStats)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 15);
    
    const trace1 = {
        x: sortedReviewers.map(r => r[0]),
        y: sortedReviewers.map(r => r[1].approved),
        name: 'Approved',
        type: 'bar',
        marker: { color: '#21c354' }
    };
    
    const trace2 = {
        x: sortedReviewers.map(r => r[0]),
        y: sortedReviewers.map(r => r[1].changesRequested),
        name: 'Changes Requested',
        type: 'bar',
        marker: { color: '#ff4b4b' }
    };
    
    const layout = {
        title: 'レビュワー別アクティビティ (Top 15)',
        xaxis: { title: 'レビュワー' },
        yaxis: { title: 'レビュー数' },
        barmode: 'stack',
        height: CONFIG.charts.defaultHeight
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(chartContainer, [trace1, trace2], layout, config);
}

// Trend Analysis: Weekly PR creation trend
function loadTrendAnalysis() {
    const chartContainer = document.getElementById('trendChart');
    
    // Group PRs by week
    const weeklyData = {};
    
    appData.prs.forEach(pr => {
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
    
    const openPRs = appData.prs.filter(pr => pr.state === 'OPEN');
    
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
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
}

// Speed Analysis: Time to merge
function loadSpeedAnalysis() {
    const chartContainer = document.getElementById('speedChart');
    
    const mergedPRs = appData.prs.filter(pr => pr.state === 'MERGED' && pr.createdAt && pr.mergedAt);
    
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
    
    if (appData.prs.length === 0) {
        chartContainer.innerHTML = '<div class="loading">データがありません</div>';
        return;
    }
    
    // Analyze file change patterns
    const prSizes = appData.prs.map(pr => ({
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
    
    Plotly.newPlot(chartContainer, [trace], layout, config);
}

// Export functions
window.loadAnalyticsData = loadAnalyticsData;
window.loadTabData = loadTabData;
