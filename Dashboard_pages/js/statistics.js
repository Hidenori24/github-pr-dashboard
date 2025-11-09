// Statistics Page Logic - 統計情報と週間レポート

// Global variables
let currentPeriod = 'thisWeek';
let weeklyStats = null;

// Initialize statistics page
function initStatisticsPage() {
    console.log('Initializing statistics page...');
    loadStatisticsData();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Period selector
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            currentPeriod = e.target.value;
            loadStatisticsData();
        });
    }
    
    // Report download button
    const downloadBtn = document.getElementById('downloadReport');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadWeeklyReport);
    }
}

// Load statistics data
function loadStatisticsData() {
    console.log('Loading statistics data for period:', currentPeriod);
    
    if (!appData || !appData.prs) {
        console.error('No PR data available');
        return;
    }
    
    // Calculate date ranges
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(currentPeriod);
    
    // Filter PRs by period
    const currentPRs = appData.prs.filter(pr => {
        const created = new Date(pr.createdAt);
        return created >= currentStart && created < currentEnd;
    });
    
    const previousPRs = appData.prs.filter(pr => {
        const created = new Date(pr.createdAt);
        return created >= previousStart && created < previousEnd;
    });
    
    // Calculate statistics
    weeklyStats = calculateWeeklyStatistics(currentPRs, previousPRs);
    
    // Display statistics
    displaySummaryCards(weeklyStats);
    displayCharts(currentPRs);
    displayTrends();
    displayInsights(weeklyStats, appData.prs);
    displayRecommendations(weeklyStats);
}

// Get date ranges based on selected period
function getDateRanges(period) {
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;
    
    switch (period) {
        case 'thisWeek':
            // This week (Monday to today)
            // Handle Sunday (0) as last day of previous week
            currentStart = new Date(now);
            const dayOfWeek = now.getDay();
            const daysFromMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            currentStart.setDate(now.getDate() + daysFromMonday);
            currentStart.setHours(0, 0, 0, 0);
            currentEnd = now;
            
            previousStart = new Date(currentStart);
            previousStart.setDate(currentStart.getDate() - 7);
            previousEnd = currentStart;
            break;
            
        case 'lastWeek':
            // Last week (Monday to Sunday)
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - now.getDay() + 1 - 7);
            currentStart.setHours(0, 0, 0, 0);
            
            currentEnd = new Date(currentStart);
            currentEnd.setDate(currentStart.getDate() + 7);
            
            previousStart = new Date(currentStart);
            previousStart.setDate(currentStart.getDate() - 7);
            previousEnd = currentStart;
            break;
            
        case 'thisMonth':
            // This month (1st to today)
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
            currentEnd = now;
            
            previousStart = new Date(currentStart);
            previousStart.setMonth(currentStart.getMonth() - 1);
            previousEnd = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
            
        case 'lastMonth':
            // Last month (1st to last day)
            currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            currentEnd = new Date(now.getFullYear(), now.getMonth(), 1);
            
            previousStart = new Date(currentStart);
            previousStart.setMonth(currentStart.getMonth() - 1);
            previousEnd = currentStart;
            break;
            
        case 'last30days':
            // Last 30 days
            currentEnd = now;
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 30);
            
            previousEnd = currentStart;
            previousStart = new Date(currentStart);
            previousStart.setDate(currentStart.getDate() - 30);
            break;
            
        case 'last90days':
            // Last 90 days
            currentEnd = now;
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 90);
            
            previousEnd = currentStart;
            previousStart = new Date(currentStart);
            previousStart.setDate(currentStart.getDate() - 90);
            break;
            
        default:
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 7);
            currentEnd = now;
            previousStart = new Date(currentStart);
            previousStart.setDate(currentStart.getDate() - 7);
            previousEnd = currentStart;
    }
    
    return { currentStart, currentEnd, previousStart, previousEnd };
}

// Calculate weekly statistics
function calculateWeeklyStatistics(currentPRs, previousPRs) {
    const stats = {};
    
    // Basic counts
    stats.totalPRs = currentPRs.length;
    stats.openPRs = currentPRs.filter(pr => pr.state === 'OPEN').length;
    stats.mergedPRs = currentPRs.filter(pr => pr.state === 'MERGED').length;
    stats.closedPRs = currentPRs.filter(pr => pr.state === 'CLOSED').length;
    
    // Previous period comparison
    const prevTotal = previousPRs.length;
    stats.totalChange = stats.totalPRs - prevTotal;
    stats.totalChangePct = prevTotal > 0 ? (stats.totalChange / prevTotal * 100) : 0;
    
    // Lead time (for merged PRs)
    const mergedCurrent = currentPRs.filter(pr => pr.state === 'MERGED');
    if (mergedCurrent.length > 0) {
        const leadTimes = mergedCurrent.map(pr => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            return (merged - created) / (1000 * 60 * 60 * 24); // days
        });
        stats.avgLeadTime = median(leadTimes);
    } else {
        stats.avgLeadTime = 0;
    }
    
    // Previous lead time
    const mergedPrev = previousPRs.filter(pr => pr.state === 'MERGED');
    if (mergedPrev.length > 0) {
        const prevLeadTimes = mergedPrev.map(pr => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            return (merged - created) / (1000 * 60 * 60 * 24);
        });
        const prevLeadTime = median(prevLeadTimes);
        stats.leadTimeChange = stats.avgLeadTime - prevLeadTime;
    } else {
        stats.leadTimeChange = 0;
    }
    
    // Active authors
    const authors = new Set(currentPRs.map(pr => pr.author));
    stats.activeAuthors = authors.size;
    
    // Review statistics
    stats.totalReviews = currentPRs.reduce((sum, pr) => sum + (pr.reviews_count || 0), 0);
    stats.totalComments = currentPRs.reduce((sum, pr) => sum + (pr.comments_count || 0), 0);
    stats.avgReviewsPerPR = stats.totalPRs > 0 ? stats.totalReviews / stats.totalPRs : 0;
    stats.avgCommentsPerPR = stats.totalPRs > 0 ? stats.totalComments / stats.totalPRs : 0;
    
    return stats;
}

// Display summary cards
function displaySummaryCards(stats) {
    // Total PRs
    updateMetricCard('totalPRsCard', stats.totalPRs, 
        `${stats.totalChange >= 0 ? '+' : ''}${stats.totalChange} (${stats.totalChangePct >= 0 ? '+' : ''}${stats.totalChangePct.toFixed(0)}%)`,
        stats.totalChange >= 0);
    
    // Merged PRs
    const mergeRate = stats.totalPRs > 0 ? (stats.mergedPRs / stats.totalPRs * 100).toFixed(0) : 0;
    updateMetricCard('mergedPRsCard', stats.mergedPRs, `${mergeRate}%`, true);
    
    // Lead time
    updateMetricCard('leadTimeCard', `${stats.avgLeadTime.toFixed(1)}日`,
        stats.leadTimeChange !== 0 ? `${stats.leadTimeChange >= 0 ? '+' : ''}${stats.leadTimeChange.toFixed(1)}日` : null,
        stats.leadTimeChange <= 0);
    
    // Active authors
    updateMetricCard('activeAuthorsCard', stats.activeAuthors, null, true);
}

// Update a metric card
function updateMetricCard(cardId, value, delta, isPositive) {
    const card = document.getElementById(cardId);
    if (!card) return;
    
    const valueEl = card.querySelector('.metric-value');
    const deltaEl = card.querySelector('.metric-delta');
    
    if (valueEl) valueEl.textContent = value;
    
    if (deltaEl && delta) {
        deltaEl.textContent = delta;
        deltaEl.className = 'metric-delta ' + (isPositive ? 'positive' : 'negative');
        deltaEl.style.display = 'block';
    } else if (deltaEl) {
        deltaEl.style.display = 'none';
    }
}

// Display charts
function displayCharts(currentPRs) {
    // State distribution pie chart
    const stateData = {
        labels: ['OPEN', 'MERGED', 'CLOSED'],
        values: [
            currentPRs.filter(pr => pr.state === 'OPEN').length,
            currentPRs.filter(pr => pr.state === 'MERGED').length,
            currentPRs.filter(pr => pr.state === 'CLOSED').length
        ]
    };
    
    const pieTrace = {
        labels: stateData.labels,
        values: stateData.values,
        type: 'pie',
        marker: {
            colors: ['#f59e0b', '#10b981', '#6b7280']
        },
        textinfo: 'label+percent',
        textposition: 'inside'
    };
    
    const pieLayout = {
        title: 'PR状態の内訳',
        height: 300,
        showlegend: true
    };
    
    Plotly.newPlot('stateChart', [pieTrace], pieLayout, { responsive: true, displaylogo: false });
    
    // Review activity metrics
    displayReviewMetrics(currentPRs);
}

// Display review activity metrics
function displayReviewMetrics(currentPRs) {
    const totalReviews = currentPRs.reduce((sum, pr) => sum + (pr.reviews_count || 0), 0);
    const totalComments = currentPRs.reduce((sum, pr) => sum + (pr.comments_count || 0), 0);
    const avgReviews = currentPRs.length > 0 ? (totalReviews / currentPRs.length).toFixed(1) : 0;
    const avgComments = currentPRs.length > 0 ? (totalComments / currentPRs.length).toFixed(1) : 0;
    
    const container = document.getElementById('reviewMetrics');
    if (container) {
        container.innerHTML = `
            <div class="review-metric-item">
                <div class="metric-label">総レビュー数</div>
                <div class="metric-value">${totalReviews}</div>
                <div class="metric-sub">PR当たり平均: ${avgReviews}回</div>
            </div>
            <div class="review-metric-item">
                <div class="metric-label">総コメント数</div>
                <div class="metric-value">${totalComments}</div>
                <div class="metric-sub">PR当たり平均: ${avgComments}件</div>
            </div>
        `;
    }
}

// Display trend analysis (last 8 weeks)
function displayTrends() {
    const now = new Date();
    const weeksData = [];
    
    for (let i = 8; i > 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1 - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const weekPRs = appData.prs.filter(pr => {
            const created = new Date(pr.createdAt);
            return created >= weekStart && created < weekEnd;
        });
        
        const mergedPRs = weekPRs.filter(pr => pr.state === 'MERGED');
        const leadTimes = mergedPRs.map(pr => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            return (merged - created) / (1000 * 60 * 60 * 24);
        });
        
        weeksData.push({
            week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
            prCount: weekPRs.length,
            mergedCount: mergedPRs.length,
            avgLeadTime: leadTimes.length > 0 ? median(leadTimes) : 0
        });
    }
    
    // PR count trend
    const prCountTrace = {
        x: weeksData.map(w => w.week),
        y: weeksData.map(w => w.prCount),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'PR数',
        line: { color: '#3b82f6', width: 3 },
        marker: { size: 8 }
    };
    
    const prCountLayout = {
        title: 'PR作成数の推移',
        xaxis: { title: '週' },
        yaxis: { title: 'PR数' },
        height: 300
    };
    
    Plotly.newPlot('trendPRChart', [prCountTrace], prCountLayout, { responsive: true, displaylogo: false });
    
    // Lead time trend
    const leadTimeTrace = {
        x: weeksData.map(w => w.week),
        y: weeksData.map(w => w.avgLeadTime),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'リードタイム',
        line: { color: '#f59e0b', width: 3 },
        marker: { size: 8 }
    };
    
    const leadTimeLayout = {
        title: '平均リードタイムの推移',
        xaxis: { title: '週' },
        yaxis: { title: 'リードタイム (日)' },
        height: 300
    };
    
    Plotly.newPlot('trendLeadTimeChart', [leadTimeTrace], leadTimeLayout, { responsive: true, displaylogo: false });
}

// Display insights
function displayInsights(stats, allPRs) {
    const insights = [];
    
    // PR count change
    if (stats.totalChangePct > 20) {
        insights.push({
            type: 'success',
            title: '開発活動が活発化',
            message: `先週と比較してPR作成数が${stats.totalChangePct.toFixed(0)}%増加しました。チームの開発速度が向上しています。`
        });
    } else if (stats.totalChangePct < -20) {
        insights.push({
            type: 'warning',
            title: '開発活動の低下',
            message: `先週と比較してPR作成数が${Math.abs(stats.totalChangePct).toFixed(0)}%減少しました。原因を確認することをお勧めします。`
        });
    }
    
    // Lead time change
    if (stats.leadTimeChange < -1) {
        insights.push({
            type: 'success',
            title: 'レビュー速度の改善',
            message: `レビュー完了までの時間が${Math.abs(stats.leadTimeChange).toFixed(1)}日短縮されました。レビュープロセスが効率化しています。`
        });
    } else if (stats.leadTimeChange > 2) {
        insights.push({
            type: 'warning',
            title: 'レビュー遅延の増加',
            message: `レビュー完了までの時間が${stats.leadTimeChange.toFixed(1)}日増加しました。レビューのボトルネックを確認してください。`
        });
    }
    
    // Merge rate
    const mergeRate = stats.totalPRs > 0 ? (stats.mergedPRs / stats.totalPRs * 100) : 0;
    if (mergeRate < 30) {
        insights.push({
            type: 'warning',
            title: 'マージ率が低い',
            message: `今週のマージ率は${mergeRate.toFixed(0)}%です。OPENまたはCLOSEDのPRが多く残っている可能性があります。`
        });
    }
    
    // Review activity
    if (stats.avgReviewsPerPR < 1) {
        insights.push({
            type: 'warning',
            title: 'レビュー活動の不足',
            message: `PR当たりの平均レビュー数が${stats.avgReviewsPerPR.toFixed(1)}回です。レビュー活動を促進することで品質向上が期待できます。`
        });
    } else if (stats.avgReviewsPerPR > 3) {
        insights.push({
            type: 'info',
            title: '活発なレビュー活動',
            message: `PR当たりの平均レビュー数が${stats.avgReviewsPerPR.toFixed(1)}回です。チーム全体でレビューに積極的に参加しています。`
        });
    }
    
    // Stale PRs
    const openPRs = allPRs.filter(pr => pr.state === 'OPEN');
    const now = new Date();
    const stalePRs = openPRs.filter(pr => {
        const created = new Date(pr.createdAt);
        const days = (now - created) / (1000 * 60 * 60 * 24);
        return days > 7;
    });
    
    if (stalePRs.length > 5) {
        insights.push({
            type: 'warning',
            title: '滞留PRの増加',
            message: `7日以上滞留しているOPEN PRが${stalePRs.length}件あります。定期的なレビューとフォローアップをお勧めします。`
        });
    }
    
    // Display insights
    const container = document.getElementById('insightsContainer');
    if (container) {
        if (insights.length === 0) {
            container.innerHTML = '<div class="info-message">今期は特記すべき変化はありません。</div>';
        } else {
            container.innerHTML = insights.map(insight => {
                const typeClass = insight.type === 'success' ? 'success-insight' : 
                                 insight.type === 'warning' ? 'warning-insight' : 'insight-card';
                const icon = insight.type === 'success' ? '✅' : 
                            insight.type === 'warning' ? '⚠️' : 'ℹ️';
                
                return `
                    <div class="${typeClass}">
                        <h4>${icon} ${insight.title}</h4>
                        <p>${insight.message}</p>
                    </div>
                `;
            }).join('');
        }
    }
}

// Display recommendations
function displayRecommendations(stats) {
    const recommendations = [];
    
    // Long lead time
    if (stats.avgLeadTime > 5) {
        recommendations.push({
            title: 'レビュー時間の短縮',
            actions: [
                'PRのサイズを小さくする（1PR = 1機能）',
                'レビュー担当者を明示的にアサインする',
                'レビュー時間を定例化する（例：毎日午前中）',
                'Draft PRを活用して早期フィードバックを得る'
            ]
        });
    }
    
    // Low review activity
    if (stats.avgReviewsPerPR < 1) {
        recommendations.push({
            title: 'レビュー文化の醸成',
            actions: [
                'ペアプログラミング/モブプログラミングの導入',
                'レビュー担当のローテーション制度',
                'レビューガイドラインの整備',
                'レビュー活動の可視化と表彰'
            ]
        });
    }
    
    // Low merge rate
    const mergeRate = stats.totalPRs > 0 ? (stats.mergedPRs / stats.totalPRs * 100) : 0;
    if (mergeRate < 40) {
        recommendations.push({
            title: 'PR完了率の向上',
            actions: [
                'OPEN PRの定期的な棚卸し',
                '不要なPRのクローズ',
                'WIP（Work In Progress）の見える化',
                'PRのライフサイクル管理ルールの設定'
            ]
        });
    }
    
    // Few active authors
    if (stats.activeAuthors < 3) {
        recommendations.push({
            title: 'チームコラボレーションの促進',
            actions: [
                'クロスファンクショナルな開発体制の構築',
                'ナレッジシェアの機会を増やす',
                'コードオーナーシップの分散',
                'オンボーディングプロセスの改善'
            ]
        });
    }
    
    // Display recommendations
    const container = document.getElementById('recommendationsContainer');
    if (container) {
        if (recommendations.length === 0) {
            container.innerHTML = '<div class="success-message">現状のプロセスは良好です。引き続き維持してください。</div>';
        } else {
            container.innerHTML = recommendations.map(rec => `
                <div class="recommendation-card">
                    <h4>💡 ${rec.title}</h4>
                    <div class="recommendation-actions">
                        <strong>具体的なアクション:</strong>
                        <ul>
                            ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `).join('');
        }
    }
}

// Download weekly report
function downloadWeeklyReport() {
    if (!weeklyStats) {
        alert('統計データがありません');
        return;
    }
    
    const { currentStart, currentEnd } = getDateRanges(currentPeriod);
    const now = new Date();
    
    // Get repository info from primary repository in config
    const primaryIndex = appData.config?.primaryRepoIndex || 0;
    const primaryRepo = appData.config?.repositories?.[primaryIndex] || { owner: 'Unknown', repo: 'Unknown' };
    
    const report = `# GitHub PR 週間レポート

**リポジトリ**: ${primaryRepo.owner}/${primaryRepo.repo}
**期間**: ${formatDate(currentStart)} - ${formatDate(currentEnd)}
**作成日時**: ${formatDate(now)} ${now.toLocaleTimeString('ja-JP')}

---

## サマリー

- **総PR数**: ${weeklyStats.totalPRs}件 (${weeklyStats.totalChange >= 0 ? '+' : ''}${weeklyStats.totalChange}件, ${weeklyStats.totalChangePct >= 0 ? '+' : ''}${weeklyStats.totalChangePct.toFixed(0)}%)
- **マージ済み**: ${weeklyStats.mergedPRs}件 (${(weeklyStats.mergedPRs / weeklyStats.totalPRs * 100).toFixed(0)}%)
- **平均リードタイム**: ${weeklyStats.avgLeadTime.toFixed(1)}日 (${weeklyStats.leadTimeChange >= 0 ? '+' : ''}${weeklyStats.leadTimeChange.toFixed(1)}日)
- **アクティブ開発者**: ${weeklyStats.activeAuthors}名

---

## レビュー活動

- **総レビュー数**: ${weeklyStats.totalReviews}回
- **PR当たり平均**: ${weeklyStats.avgReviewsPerPR.toFixed(1)}回
- **総コメント数**: ${weeklyStats.totalComments}件
- **PR当たり平均**: ${weeklyStats.avgCommentsPerPR.toFixed(1)}件

---

*このレポートは GitHub PR Dashboard により自動生成されました。*
`;
    
    // Download as markdown file
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly_report_${formatDate(currentStart).replace(/\//g, '')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Helper functions
function median(values) {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatDate(date) {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatisticsPage);
} else {
    initStatisticsPage();
}
