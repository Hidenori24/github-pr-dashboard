// Statistics Page Logic - 統計情報と週間レポート

// Helper function: Calculate median
function median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Global variables
let currentPeriod = 'thisWeek';
let weeklyStats = null;
let historicalData = null;
let viewMode = 'current'; // 'current' or 'historical'

// Global variables for Four Keys integration
let fourKeysData = null;

// Initialize statistics page
function initStatisticsPage() {
    console.log('Initializing statistics page...');
    
    // Check if data is available
    if (!appData || !appData.prs || appData.prs.length === 0) {
        console.warn('[Statistics] Waiting for PR data to load...');
        // Retry after a short delay if data hasn't loaded yet
        setTimeout(() => {
            if (appData && appData.prs && appData.prs.length > 0) {
                console.log('[Statistics] Data loaded, initializing...');
                initStatisticsPage();
            } else {
                console.error('[Statistics] No PR data available after retry');
            }
        }, 1000);
        return;
    }
    
    console.log('[Statistics] Initializing with', appData.prs.length, 'PRs');
    loadHistoricalData();
    setupEventListeners();
    loadStatisticsData();
    loadFourKeysDataForStatistics();
}

// Load historical statistics data
async function loadHistoricalData() {
    try {
        const response = await fetch('data/historical_statistics.json');
        if (response.ok) {
            historicalData = await response.json();
            console.log('Historical data loaded:', historicalData);
        } else {
            console.warn('Historical data not available, using current data only');
        }
    } catch (error) {
        console.warn('Could not load historical data:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // View mode selector
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
        viewModeSelect.addEventListener('change', (e) => {
            viewMode = e.target.value;
            handleViewModeChange();
        });
    }
    
    // Period selector
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            currentPeriod = e.target.value;
            loadStatisticsData();
        });
    }
    
    // Historical period selector
    const historicalSelect = document.getElementById('historicalSelect');
    if (historicalSelect) {
        historicalSelect.addEventListener('change', (e) => {
            loadHistoricalPeriodData();
        });
    }
    
    // Report download button
    const downloadBtn = document.getElementById('downloadReport');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadWeeklyReport);
    }
}

// Handle view mode change
function handleViewModeChange() {
    const periodSelectContainer = document.getElementById('periodSelect').parentElement;
    const historicalSelectContainer = document.getElementById('historicalSelectContainer');
    
    if (viewMode === 'current') {
        // Show current period selector
        periodSelectContainer.style.display = 'block';
        historicalSelectContainer.style.display = 'none';
        loadStatisticsData();
    } else {
        // Show historical selector
        periodSelectContainer.style.display = 'none';
        historicalSelectContainer.style.display = 'block';
        populateHistoricalSelector();
        loadHistoricalPeriodData();
    }
}

// Populate historical period selector
function populateHistoricalSelector() {
    const historicalSelect = document.getElementById('historicalSelect');
    if (!historicalSelect || !historicalData) return;
    
    historicalSelect.innerHTML = '';
    
    if (viewMode === 'historical-weekly') {
        historicalData.weekly.forEach((week, index) => {
            const weekStart = new Date(week.weekStart);
            const weekEnd = new Date(week.weekEnd);
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)} (週${historicalData.weekly.length - index})`;
            historicalSelect.appendChild(option);
        });
        // Select the most recent week
        historicalSelect.value = historicalData.weekly.length - 1;
    } else if (viewMode === 'historical-monthly') {
        historicalData.monthly.forEach((month, index) => {
            const monthStart = new Date(month.monthStart);
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`;
            historicalSelect.appendChild(option);
        });
        // Select the most recent month
        historicalSelect.value = historicalData.monthly.length - 1;
    } else if (viewMode === 'historical-yearly') {
        historicalData.yearly.forEach((year, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${year.year}年`;
            historicalSelect.appendChild(option);
        });
        // Select the most recent year
        historicalSelect.value = historicalData.yearly.length - 1;
    }
}

// Load historical period data
function loadHistoricalPeriodData() {
    if (!historicalData) {
        console.error('Historical data not available');
        return;
    }
    
    const historicalSelect = document.getElementById('historicalSelect');
    const selectedIndex = parseInt(historicalSelect.value);
    
    let periodData;
    if (viewMode === 'historical-weekly') {
        periodData = historicalData.weekly[selectedIndex];
        displayHistoricalWeeklyData(periodData, selectedIndex);
    } else if (viewMode === 'historical-monthly') {
        periodData = historicalData.monthly[selectedIndex];
        displayHistoricalMonthlyData(periodData, selectedIndex);
    } else if (viewMode === 'historical-yearly') {
        periodData = historicalData.yearly[selectedIndex];
        displayHistoricalYearlyData(periodData, selectedIndex);
    }
}

// Display historical weekly data
function displayHistoricalWeeklyData(weekData, index) {
    // Convert to stats format for display
    const stats = {
        totalPRs: weekData.totalPRs,
        openPRs: weekData.openPRs,
        mergedPRs: weekData.mergedPRs,
        closedPRs: weekData.closedPRs,
        totalChange: weekData.totalChange,
        totalChangePct: weekData.totalChangePct,
        avgLeadTime: weekData.avgLeadTime,
        leadTimeChange: weekData.leadTimeChange,
        activeAuthors: weekData.activeAuthors,
        totalReviews: weekData.totalReviews,
        totalComments: weekData.totalComments,
        avgReviewsPerPR: weekData.avgReviewsPerPR,
        avgCommentsPerPR: weekData.avgCommentsPerPR
    };
    
    displaySummaryCards(stats);
    displayHistoricalCharts(weekData);
    displayHistoricalTrends('weekly', index);
    displayInsights(stats, appData.prs);
    displayRecommendations(stats);
}

// Display historical monthly data
function displayHistoricalMonthlyData(monthData, index) {
    const stats = {
        totalPRs: monthData.totalPRs,
        openPRs: monthData.openPRs,
        mergedPRs: monthData.mergedPRs,
        closedPRs: monthData.closedPRs,
        totalChange: monthData.totalChange,
        totalChangePct: 0,
        avgLeadTime: monthData.avgLeadTime,
        leadTimeChange: 0,
        activeAuthors: monthData.activeAuthors,
        totalReviews: 0,
        totalComments: 0,
        avgReviewsPerPR: 0,
        avgCommentsPerPR: 0
    };
    
    displaySummaryCards(stats);
    displayHistoricalCharts(monthData);
    displayHistoricalTrends('monthly', index);
    displayInsights(stats, appData.prs);
    displayRecommendations(stats);
}

// Display historical yearly data
function displayHistoricalYearlyData(yearData, index) {
    const stats = {
        totalPRs: yearData.totalPRs,
        openPRs: yearData.openPRs,
        mergedPRs: yearData.mergedPRs,
        closedPRs: yearData.closedPRs,
        totalChange: 0,
        totalChangePct: 0,
        avgLeadTime: yearData.avgLeadTime,
        leadTimeChange: 0,
        activeAuthors: yearData.activeAuthors,
        totalReviews: 0,
        totalComments: 0,
        avgReviewsPerPR: 0,
        avgCommentsPerPR: 0
    };
    
    displaySummaryCards(stats);
    displayHistoricalCharts(yearData);
    displayHistoricalTrends('yearly', index);
    displayInsights(stats, appData.prs);
    displayRecommendations(stats);
}

// Display historical charts
function displayHistoricalCharts(periodData) {
    // State distribution pie chart
    const stateData = {
        labels: ['OPEN', 'MERGED', 'CLOSED'],
        values: [
            periodData.openPRs,
            periodData.mergedPRs,
            periodData.closedPRs
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
    const container = document.getElementById('reviewMetrics');
    if (container) {
        if (periodData.totalReviews !== undefined) {
            container.innerHTML = `
                <div class="review-metric-item">
                    <div class="metric-label">総レビュー数</div>
                    <div class="metric-value">${periodData.totalReviews || 0}</div>
                    <div class="metric-sub">PR当たり平均: ${(periodData.avgReviewsPerPR || 0).toFixed(1)}回</div>
                </div>
                <div class="review-metric-item">
                    <div class="metric-label">総コメント数</div>
                    <div class="metric-value">${periodData.totalComments || 0}</div>
                    <div class="metric-sub">PR当たり平均: ${(periodData.avgCommentsPerPR || 0).toFixed(1)}件</div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="review-metric-item">
                    <div class="metric-label">レビュー統計</div>
                    <div class="metric-value">N/A</div>
                    <div class="metric-sub">この期間のデータは利用できません</div>
                </div>
            `;
        }
    }
}

// Display historical trends
function displayHistoricalTrends(periodType, currentIndex) {
    if (!historicalData) return;
    
    let dataArray, labelFormatter;
    
    if (periodType === 'weekly') {
        dataArray = historicalData.weekly;
        labelFormatter = (item) => {
            const date = new Date(item.weekStart);
            return `${date.getMonth() + 1}/${date.getDate()}`;
        };
    } else if (periodType === 'monthly') {
        dataArray = historicalData.monthly;
        labelFormatter = (item) => {
            const date = new Date(item.monthStart);
            return `${date.getFullYear()}/${date.getMonth() + 1}`;
        };
    } else if (periodType === 'yearly') {
        dataArray = historicalData.yearly;
        labelFormatter = (item) => `${item.year}`;
    }
    
    // Show last 12 periods or all if less
    const displayCount = Math.min(12, dataArray.length);
    const startIndex = Math.max(0, dataArray.length - displayCount);
    const displayData = dataArray.slice(startIndex);
    
    // PR count trend
    const prCountTrace = {
        x: displayData.map(labelFormatter),
        y: displayData.map(d => d.totalPRs),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'PR数',
        line: { color: '#3b82f6', width: 3 },
        marker: { size: 8 }
    };
    
    const prCountLayout = {
        title: 'PR作成数の推移',
        xaxis: { title: periodType === 'weekly' ? '週' : periodType === 'monthly' ? '月' : '年' },
        yaxis: { title: 'PR数' },
        height: 300
    };
    
    Plotly.newPlot('trendPRChart', [prCountTrace], prCountLayout, { responsive: true, displaylogo: false });
    
    // Lead time trend
    const leadTimeTrace = {
        x: displayData.map(labelFormatter),
        y: displayData.map(d => d.avgLeadTime),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'リードタイム',
        line: { color: '#f59e0b', width: 3 },
        marker: { size: 8 }
    };
    
    const leadTimeLayout = {
        title: '平均リードタイムの推移',
        xaxis: { title: periodType === 'weekly' ? '週' : periodType === 'monthly' ? '月' : '年' },
        yaxis: { title: 'リードタイム (日)' },
        height: 300
    };
    
    Plotly.newPlot('trendLeadTimeChart', [leadTimeTrace], leadTimeLayout, { responsive: true, displaylogo: false });
}

// Load statistics data
function loadStatisticsData() {
    console.log('Loading statistics data for period:', currentPeriod);

    if (!appData || !appData.prs) {
        console.error('No PR data available');
        return;
    }

    // Use global repo filter (unified)
    const globalFilter = document.getElementById('globalRepoFilter');
    const selectedRepo = globalFilter ? globalFilter.value : '';
    let filteredPRs = appData.prs;

    if (selectedRepo) {
        const [owner, repo] = selectedRepo.split('/');
        filteredPRs = filteredPRs.filter(pr => pr.owner === owner && pr.repo === repo);
        console.log(`[Statistics] Filtered to ${filteredPRs.length} PRs for ${selectedRepo}`);
    }
    
    // Calculate date ranges
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(currentPeriod);
    
    // Filter PRs by period
    const currentPRs = filteredPRs.filter(pr => {
        const created = new Date(pr.createdAt);
        return created >= currentStart && created < currentEnd;
    });
    
    const previousPRs = filteredPRs.filter(pr => {
        const created = new Date(pr.createdAt);
        return created >= previousStart && created < previousEnd;
    });
    
    // Calculate statistics
    weeklyStats = calculateWeeklyStatistics(currentPRs, previousPRs);
    
    // Display statistics
    displaySummaryCards(weeklyStats);
    displayCharts(currentPRs);
    displayTrends(filteredPRs);
    displayInsights(weeklyStats, filteredPRs);
    displayRecommendations(weeklyStats);
    
    // Display detailed statistics
    displayAuthorStats(currentPRs);
    displayReviewerStats(currentPRs);
    
    // Display Four Keys metrics and correlation analysis
    displayFourKeysMetricsInStatistics();
    if (fourKeysData && fourKeysData.metrics) {
        const correlations = analyzeMetricsCorrelation(weeklyStats, fourKeysData.metrics);
        displayCorrelationInsights(correlations);
    }
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
    
    // New metrics: PR Review Time, Review Depth, PR Size
    const newMetrics = calculateNewMetrics(currentPRs);
    Object.assign(stats, newMetrics);
    
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
    
    // Calculate new metrics
    const newMetrics = calculateNewMetrics(currentPRs);
    
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
            <div class="review-metric-item">
                <div class="metric-label">平均レビュー時間</div>
                <div class="metric-value">${newMetrics.avgReviewTime.toFixed(1)}時間</div>
                <div class="metric-sub">PR作成から最初のレビューまで</div>
            </div>
            <div class="review-metric-item">
                <div class="metric-label">平均レビューの深さ</div>
                <div class="metric-value">${newMetrics.avgReviewDepth.toFixed(1)}</div>
                <div class="metric-sub">PR当たりのレビューコメント数</div>
            </div>
            <div class="review-metric-item">
                <div class="metric-label">平均PRサイズ</div>
                <div class="metric-value">${newMetrics.avgPRSize.toFixed(0)}行</div>
                <div class="metric-sub">変更行数: ${newMetrics.avgChangedFiles.toFixed(1)}ファイル</div>
            </div>
        `;
    }
    
    // Display review decision stats (inline if container exists)
    const decisionContainer = document.getElementById('reviewDecisionStats');
    if (decisionContainer && newMetrics.reviewDecisionStats) {
        const stats = newMetrics.reviewDecisionStats;
        const total = stats.approved + stats.changes_requested + stats.commented;
        if (total > 0) {
            decisionContainer.innerHTML = `
                <h4>レビュー決定の内訳</h4>
                <div class="decision-stats-grid">
                    <div class="decision-stat">
                        <span class="decision-label">✅ 承認</span>
                        <span class="decision-value">${stats.approved} (${(stats.approved / total * 100).toFixed(0)}%)</span>
                    </div>
                    <div class="decision-stat">
                        <span class="decision-label">🔄 変更要求</span>
                        <span class="decision-value">${stats.changes_requested} (${(stats.changes_requested / total * 100).toFixed(0)}%)</span>
                    </div>
                    <div class="decision-stat">
                        <span class="decision-label">💬 コメント</span>
                        <span class="decision-value">${stats.commented} (${(stats.commented / total * 100).toFixed(0)}%)</span>
                    </div>
                </div>
            `;
        }
    }
}

// Display trend analysis (last 8 weeks)
function displayTrends(prsToAnalyze) {
    // Use provided PRs or fall back to appData.prs
    const prs = prsToAnalyze || (appData ? appData.prs : []);
    if (!prs || prs.length === 0) {
        console.warn('[Statistics] No PRs available for trend analysis');
        return;
    }
    
    const now = new Date();
    const weeksData = [];
    
    for (let i = 8; i > 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1 - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const weekPRs = prs.filter(pr => {
            const created = new Date(pr.createdAt);
            return created >= weekStart && created < weekEnd;
        });
        
        const mergedPRs = weekPRs.filter(pr => pr.state === 'MERGED');
        const leadTimes = mergedPRs.map(pr => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            return (merged - created) / (1000 * 60 * 60 * 24);
        });
        
        // Calculate review metrics for this week
        const weekMetrics = calculateNewMetrics(weekPRs);
        const totalReviews = weekPRs.reduce((sum, pr) => sum + (pr.reviews_count || 0), 0);
        const totalComments = weekPRs.reduce((sum, pr) => sum + (pr.comments_count || 0), 0);
        
        weeksData.push({
            week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
            prCount: weekPRs.length,
            mergedCount: mergedPRs.length,
            avgLeadTime: leadTimes.length > 0 ? median(leadTimes) : 0,
            avgReviewTime: weekMetrics.avgReviewTime,
            avgReviewDepth: weekMetrics.avgReviewDepth,
            avgPRSize: weekMetrics.avgPRSize,
            totalReviews: totalReviews,
            totalComments: totalComments
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
    
    try {
        Plotly.newPlot('trendPRChart', [prCountTrace], prCountLayout, { responsive: true, displaylogo: false });
    } catch (error) {
        console.error('[Statistics] Failed to create PR count trend chart:', error);
        const container = document.getElementById('trendPRChart');
        if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">チャート表示エラー</div>';
    }
    
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
    
    try {
        Plotly.newPlot('trendLeadTimeChart', [leadTimeTrace], leadTimeLayout, { responsive: true, displaylogo: false });
    } catch (error) {
        console.error('[Statistics] Failed to create lead time trend chart:', error);
        const container = document.getElementById('trendLeadTimeChart');
        if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">チャート表示エラー</div>';
    }
    
    // Review activity trends (NEW!)
    displayReviewActivityTrends(weeksData);
}

// Display review activity trends
function displayReviewActivityTrends(weeksData) {
    // Review Time Trend
    const reviewTimeTrace = {
        x: weeksData.map(w => w.week),
        y: weeksData.map(w => w.avgReviewTime),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'レビュー時間',
        line: { color: '#8b5cf6', width: 3 },
        marker: { size: 8 }
    };
    
    const reviewTimeLayout = {
        title: '平均レビュー時間の推移',
        xaxis: { title: '週' },
        yaxis: { title: 'レビュー時間 (時間)' },
        height: 300
    };
    
    try {
        const container = document.getElementById('trendReviewTimeChart');
        if (container) {
            Plotly.newPlot('trendReviewTimeChart', [reviewTimeTrace], reviewTimeLayout, { responsive: true, displaylogo: false });
        }
    } catch (error) {
        console.error('[Statistics] Failed to create review time trend chart:', error);
    }
    
    // Review Depth Trend
    const reviewDepthTrace = {
        x: weeksData.map(w => w.week),
        y: weeksData.map(w => w.avgReviewDepth),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'レビューの深さ',
        line: { color: '#ec4899', width: 3 },
        marker: { size: 8 }
    };
    
    const reviewDepthLayout = {
        title: 'レビューの深さの推移',
        xaxis: { title: '週' },
        yaxis: { title: 'レビューコメント数' },
        height: 300
    };
    
    try {
        const container = document.getElementById('trendReviewDepthChart');
        if (container) {
            Plotly.newPlot('trendReviewDepthChart', [reviewDepthTrace], reviewDepthLayout, { responsive: true, displaylogo: false });
        }
    } catch (error) {
        console.error('[Statistics] Failed to create review depth trend chart:', error);
    }
    
    // PR Size Trend
    const prSizeTrace = {
        x: weeksData.map(w => w.week),
        y: weeksData.map(w => w.avgPRSize),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'PRサイズ',
        line: { color: '#14b8a6', width: 3 },
        marker: { size: 8 }
    };
    
    const prSizeLayout = {
        title: '平均PRサイズの推移',
        xaxis: { title: '週' },
        yaxis: { title: '変更行数' },
        height: 300
    };
    
    try {
        const container = document.getElementById('trendPRSizeChart');
        if (container) {
            Plotly.newPlot('trendPRSizeChart', [prSizeTrace], prSizeLayout, { responsive: true, displaylogo: false });
        }
    } catch (error) {
        console.error('[Statistics] Failed to create PR size trend chart:', error);
    }
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
    
    // New metrics insights
    // PR Review Time
    if (stats.avgReviewTime > 24) { // More than 24 hours
        insights.push({
            type: 'warning',
            title: 'レビュー開始の遅れ',
            message: `PR作成から最初のレビューまでの平均時間が${stats.avgReviewTime.toFixed(1)}時間です。レビュー担当者のアサインを迅速化することをお勧めします。`
        });
    } else if (stats.avgReviewTime < 2) { // Less than 2 hours
        insights.push({
            type: 'success',
            title: '迅速なレビュー開始',
            message: `PR作成から最初のレビューまでの平均時間が${stats.avgReviewTime.toFixed(1)}時間です。レビュープロセスが効率的に機能しています。`
        });
    }
    
    // Review Depth
    if (stats.avgReviewDepth < 2) {
        insights.push({
            type: 'warning',
            title: 'レビューの深さが不足',
            message: `PR当たりの平均レビューコメント数が${stats.avgReviewDepth.toFixed(1)}件です。より詳細なレビューを実施することで品質向上が期待できます。`
        });
    } else if (stats.avgReviewDepth > 10) {
        insights.push({
            type: 'info',
            title: '詳細なレビュー実施',
            message: `PR当たりの平均レビューコメント数が${stats.avgReviewDepth.toFixed(1)}件です。チームで徹底的なレビューが行われています。`
        });
    }
    
    // PR Size
    if (stats.avgPRSize > 500) { // Large PRs
        insights.push({
            type: 'warning',
            title: 'PRサイズが大きい',
            message: `PRの平均変更行数が${stats.avgPRSize.toFixed(0)}行です。小さなPRに分割することでレビュー効率が向上します。`
        });
    } else if (stats.avgPRSize < 50) { // Very small PRs
        insights.push({
            type: 'info',
            title: '適切なPRサイズ',
            message: `PRの平均変更行数が${stats.avgPRSize.toFixed(0)}行です。適切なサイズのPRが作成されています。`
        });
    }
    
    // Review Decision balance
    const totalDecisions = stats.reviewDecisionStats.approved + stats.reviewDecisionStats.changes_requested + stats.reviewDecisionStats.commented;
    if (totalDecisions > 0) {
        const approveRate = (stats.reviewDecisionStats.approved / totalDecisions * 100);
        const changeRate = (stats.reviewDecisionStats.changes_requested / totalDecisions * 100);
        
        if (changeRate > 30) {
            insights.push({
                type: 'warning',
                title: 'レビュー基準の厳格化',
                message: `レビューの${changeRate.toFixed(0)}%で変更要求が出されています。レビュー基準を見直すか、コード品質の向上を検討してください。`
            });
        } else if (approveRate > 80) {
            insights.push({
                type: 'info',
                title: 'スムーズなレビュー通過',
                message: `レビューの${approveRate.toFixed(0)}%が承認されています。コード品質が安定しています。`
            });
        }
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
    
    // New metrics recommendations
    // Long review time
    if (stats.avgReviewTime > 24) {
        recommendations.push({
            title: 'レビュー開始時間の短縮',
            actions: [
                'PR作成時の自動レビュワーアサイン',
                'レビュワー通知の改善（Slack/Mail）',
                'レビュワー不在時のバックアップ体制',
                'レビュー待ちPRの可視化ダッシュボード作成'
            ]
        });
    }
    
    // Low review depth
    if (stats.avgReviewDepth < 2) {
        recommendations.push({
            title: 'レビュー品質の向上',
            actions: [
                'レビューガイドラインの詳細化',
                'レビュー研修の実施',
                'コードレビューツールの活用',
                'レビューポイントのチェックリスト作成'
            ]
        });
    }
    
    // Large PR size
    if (stats.avgPRSize > 500) {
        recommendations.push({
            title: 'PRサイズの最適化',
            actions: [
                'コミット粒度の見直し',
                '機能ブランチ戦略の改善',
                'コード分割の検討',
                'PRサイズ制限の設定'
            ]
        });
    }
    
    // High change request rate
    const totalDecisions = stats.reviewDecisionStats.approved + stats.reviewDecisionStats.changes_requested + stats.reviewDecisionStats.commented;
    if (totalDecisions > 0) {
        const changeRate = (stats.reviewDecisionStats.changes_requested / totalDecisions * 100);
        if (changeRate > 30) {
            recommendations.push({
                title: 'レビュー基準の適正化',
                actions: [
                    'レビュー基準の明確化',
                    '事前コード品質チェックの導入',
                    '自動テストカバレッジの向上',
                    'コード品質メトリクスの導入'
                ]
            });
        }
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

## 新規指標

- **平均レビュー開始時間**: ${weeklyStats.avgReviewTime.toFixed(1)}時間
- **平均レビューの深さ**: ${weeklyStats.avgReviewDepth.toFixed(1)}件
- **平均PRサイズ**: ${weeklyStats.avgPRSize.toFixed(0)}行 (${weeklyStats.avgChangedFiles.toFixed(1)}ファイル)
- **レビュー決定分布**: 承認${weeklyStats.reviewDecisionStats.approved}件, 変更要求${weeklyStats.reviewDecisionStats.changes_requested}件, コメント${weeklyStats.reviewDecisionStats.commented}件

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

// Calculate new metrics: PR Review Time, Review Depth, PR Size
function calculateNewMetrics(prs) {
    const metrics = {
        // PR Review Time - PR作成から最初のレビューまでの時間
        avgReviewTime: 0,
        reviewTimeData: [],
        
        // Review Depth - レビューの深さ
        avgReviewDepth: 0,
        totalReviewThreads: 0,
        reviewDecisionStats: { approved: 0, changes_requested: 0, commented: 0 },
        
        // PR Size - PRの大きさ
        avgPRSize: 0,
        avgChangedFiles: 0,
        totalAdditions: 0,
        totalDeletions: 0
    };
    
    if (prs.length === 0) return metrics;
    
    let prsWithReviews = 0;
    let totalReviewTime = 0;
    let totalReviewDepth = 0;
    let totalChangedFiles = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    prs.forEach(pr => {
        // PR Review Time - review_details を使用
        if (pr.review_details && pr.review_details.length > 0) {
            const prCreated = new Date(pr.createdAt);
            const firstReview = pr.review_details
                .map(review => new Date(review.createdAt))
                .sort((a, b) => a - b)[0]; // 最初のレビュー
            
            if (firstReview) {
                const reviewTimeHours = (firstReview - prCreated) / (1000 * 60 * 60); // hours
                metrics.reviewTimeData.push(reviewTimeHours);
                totalReviewTime += reviewTimeHours;
                prsWithReviews++;
            }
        }
        
        // Review Depth - review_threads と comments_count を使用
        const reviewThreadCount = pr.review_threads || 0;
        const commentCount = pr.comments_count || 0;
        const totalReviewActivity = reviewThreadCount + commentCount;
        
        totalReviewDepth += totalReviewActivity;
        metrics.totalReviewThreads += reviewThreadCount;
        
        // Review Decisions - review_details の state を確認
        if (pr.review_details && pr.review_details.length > 0) {
            pr.review_details.forEach(review => {
                const state = review.state ? review.state.toLowerCase() : '';
                if (state === 'approved') metrics.reviewDecisionStats.approved++;
                else if (state === 'changes_requested') metrics.reviewDecisionStats.changes_requested++;
                else if (state === 'commented') metrics.reviewDecisionStats.commented++;
            });
        }
        
        // PR Size
        const additions = pr.additions || 0;
        const deletions = pr.deletions || 0;
        const changedFiles = pr.changedFiles || 0;
        
        totalAdditions += additions;
        totalDeletions += deletions;
        totalChangedFiles += changedFiles;
    });
    
    // Calculate averages
    metrics.avgReviewTime = prsWithReviews > 0 ? totalReviewTime / prsWithReviews : 0;
    metrics.avgReviewDepth = prs.length > 0 ? totalReviewDepth / prs.length : 0;
    metrics.avgPRSize = prs.length > 0 ? (totalAdditions + totalDeletions) / prs.length : 0;
    metrics.avgChangedFiles = prs.length > 0 ? totalChangedFiles / prs.length : 0;
    metrics.totalAdditions = totalAdditions;
    metrics.totalDeletions = totalDeletions;
    
    // Debug logging
    console.log('[Statistics] New Metrics Calculated:', {
        totalPRs: prs.length,
        prsWithReviews,
        avgReviewTime: metrics.avgReviewTime.toFixed(2) + ' hours',
        avgReviewDepth: metrics.avgReviewDepth.toFixed(2),
        avgPRSize: metrics.avgPRSize.toFixed(0) + ' lines',
        reviewDecisions: metrics.reviewDecisionStats
    });
    
    return metrics;
}

// Load Four Keys data for correlation analysis
async function loadFourKeysDataForStatistics() {
    try {
        const base = (typeof CONFIG !== 'undefined' && CONFIG.dataSource && CONFIG.dataSource.basePath) ? CONFIG.dataSource.basePath : './data/';
        const prsUrl = `${base.replace(/\/?$/,'/')}prs.json`;

        const prsResponse = await fetch(prsUrl);
        if (prsResponse.ok) {
            const prsData = await prsResponse.json();
            console.log('PR data loaded for statistics correlation:', prsData.length, 'PRs');

            // Calculate Four Keys metrics from PR data
            if (typeof calculateFourKeysFromPRs === 'function') {
                fourKeysData = calculateFourKeysFromPRs(prsData);
                console.log('Four Keys metrics calculated:', fourKeysData.metrics);
            } else {
                console.warn('calculateFourKeysFromPRs function not available');
            }
        }
    } catch (error) {
        console.warn('Could not load PR data for statistics:', error);
    }
}

// Display Four Keys metrics in statistics page
function displayFourKeysMetricsInStatistics() {
    const container = document.getElementById('fourKeysMetricsContainer');
    if (!container || !fourKeysData || !fourKeysData.metrics) {
        if (container) {
            container.innerHTML = '<div class="info-message">Four Keysデータが利用できません</div>';
        }
        return;
    }

    const metrics = fourKeysData.metrics;

    container.innerHTML = `
        <h3>🔑 Four Keys メトリクス</h3>
        <div class="four-keys-grid">
            <div class="metric-card modern-card">
                <div class="metric-card-header">
                    <span class="metric-icon">🚀</span>
                    <h4>デプロイ頻度</h4>
                </div>
                <div class="metric-card-body">
                    <div class="metric-value-container">
                        <p class="metric-value">${metrics.deploymentFrequency.value.toFixed(1)}</p>
                        <p class="metric-unit">回/週</p>
                    </div>
                    <div class="metric-badge" style="background: ${metrics.deploymentFrequency.classification.color}22; color: ${metrics.deploymentFrequency.classification.color};">
                        DORA Level: ${metrics.deploymentFrequency.classification.level}
                    </div>
                </div>
            </div>

            <div class="metric-card modern-card">
                <div class="metric-card-header">
                    <span class="metric-icon">⏱️</span>
                    <h4>リードタイム</h4>
                </div>
                <div class="metric-card-body">
                    <div class="metric-value-container">
                        <p class="metric-value">${metrics.leadTime.value.toFixed(1)}</p>
                        <p class="metric-unit">日</p>
                    </div>
                    <div class="metric-badge" style="background: ${metrics.leadTime.classification.color}22; color: ${metrics.leadTime.classification.color};">
                        DORA Level: ${metrics.leadTime.classification.level}
                    </div>
                </div>
            </div>

            <div class="metric-card modern-card">
                <div class="metric-card-header">
                    <span class="metric-icon">❌</span>
                    <h4>変更失敗率</h4>
                </div>
                <div class="metric-card-body">
                    <div class="metric-value-container">
                        <p class="metric-value">${metrics.changeFailureRate.value.toFixed(1)}</p>
                        <p class="metric-unit">%</p>
                    </div>
                    <div class="metric-badge" style="background: ${metrics.changeFailureRate.classification.color}22; color: ${metrics.changeFailureRate.classification.color};">
                        DORA Level: ${metrics.changeFailureRate.classification.level}
                    </div>
                </div>
            </div>

            <div class="metric-card modern-card">
                <div class="metric-card-header">
                    <span class="metric-icon">🔧</span>
                    <h4>MTTR</h4>
                </div>
                <div class="metric-card-body">
                    <div class="metric-value-container">
                        <p class="metric-value">${metrics.mttr.value.toFixed(1)}</p>
                        <p class="metric-unit">時間</p>
                    </div>
                    <div class="metric-badge" style="background: ${metrics.mttr.classification.color}22; color: ${metrics.mttr.classification.color};">
                        DORA Level: ${metrics.mttr.classification.level}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Analyze correlation between new metrics and Four Keys
function analyzeMetricsCorrelation(newMetrics, fourKeysMetrics) {
    if (!fourKeysMetrics || !newMetrics) return null;

    const correlations = {
        reviewTimeVsLeadTime: {
            correlation: newMetrics.reviewTimeData && newMetrics.reviewTimeData.length > 0 ?
                calculateCorrelation(newMetrics.reviewTimeData, Array(newMetrics.reviewTimeData.length).fill(fourKeysMetrics.leadTime.value)) : 0,
            insight: '',
            recommendation: ''
        },
        reviewDepthVsFailureRate: {
            correlation: calculateCorrelation([newMetrics.avgReviewDepth], [fourKeysMetrics.changeFailureRate.value]),
            insight: '',
            recommendation: ''
        },
        prSizeVsDeploymentFrequency: {
            correlation: calculateCorrelation([newMetrics.avgPRSize], [fourKeysMetrics.deploymentFrequency.value]),
            insight: '',
            recommendation: ''
        }
    };

    // Generate insights based on correlations
    if (Math.abs(correlations.reviewTimeVsLeadTime.correlation) > 0.3) {
        correlations.reviewTimeVsLeadTime.insight = 'レビュー時間が長いPRは全体のリードタイムを延ばす傾向があります';
        correlations.reviewTimeVsLeadTime.recommendation = 'レビュー時間を短縮するためのガイドラインを作成することを検討してください';
    }

    if (correlations.reviewDepthVsFailureRate.correlation < -0.2) {
        correlations.reviewDepthVsFailureRate.insight = 'レビューが深いPRは失敗率が低い傾向があります';
        correlations.reviewDepthVsFailureRate.recommendation = 'コードレビューの品質を維持しつつ効率化を図るバランスが重要です';
    }

    if (correlations.prSizeVsDeploymentFrequency.correlation < -0.2) {
        correlations.prSizeVsDeploymentFrequency.insight = '大きなPRはデプロイ頻度を低下させる可能性があります';
        correlations.prSizeVsDeploymentFrequency.recommendation = 'PRを小さく保つことでデプロイ頻度を向上させることができます';
    }

    return correlations;
}

// Simple correlation calculation
function calculateCorrelation(x, y) {
    if (!x || !y || x.length !== y.length || x.length < 2) return 0;

    // Check for valid numbers
    if (x.some(val => isNaN(val)) || y.some(val => isNaN(val))) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    // Compute sums required for Pearson correlation
    const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0);
    const sumX2 = x.reduce((s, xi) => s + xi * xi, 0);
    const sumY2 = y.reduce((s, yi) => s + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0 || isNaN(denominator)) return 0;

    const correlation = numerator / denominator;

    // Check for valid correlation value
    return isNaN(correlation) ? 0 : Math.max(-1, Math.min(1, correlation));
}

// Display correlation insights
function displayCorrelationInsights(correlations) {
    const container = document.getElementById('correlationInsightsContainer');
    if (!container || !correlations) {
        if (container) {
            container.innerHTML = '<div class="info-message">相関分析データが利用できません</div>';
        }
        return;
    }

    let insightsHtml = '<h3>🔍 指標相関分析</h3>';

    Object.entries(correlations).forEach(([key, data]) => {
        const title = key === 'reviewTimeVsLeadTime' ? 'レビュー時間 vs リードタイム' :
                     key === 'reviewDepthVsFailureRate' ? 'レビュー深度 vs 失敗率' :
                     'PRサイズ vs デプロイ頻度';

        const correlationText = data.correlation === 0 ? 'データ不足' : data.correlation.toFixed(2);

        insightsHtml += `
            <div class="correlation-item">
                <h4>${title}</h4>
                <p><strong>相関係数:</strong> ${correlationText}</p>
                ${data.insight ? `<p><strong>洞察:</strong> ${data.insight}</p>` : ''}
                ${data.recommendation ? `<p><strong>推奨:</strong> ${data.recommendation}</p>` : ''}
            </div>
        `;
    });

    container.innerHTML = insightsHtml;
}

// Display author statistics
function displayAuthorStats(currentPRs) {
    const container = document.getElementById('authorStatsContainer');
    if (!container) return;

    if (!currentPRs || currentPRs.length === 0) {
        container.innerHTML = '<div class="info-message">データがありません</div>';
        return;
    }

    // Group by author
    const authorStats = {};
    currentPRs.forEach(pr => {
        const author = pr.author || 'Unknown';
        if (!authorStats[author]) {
            authorStats[author] = {
                prCount: 0,
                mergedCount: 0
            };
        }
        authorStats[author].prCount++;
        if (pr.state === 'MERGED') {
            authorStats[author].mergedCount++;
        }
    });

    // Convert to array and calculate merge rate
    const authorArray = Object.entries(authorStats).map(([author, stats]) => ({
        author,
        prCount: stats.prCount,
        mergedCount: stats.mergedCount,
        mergeRate: stats.prCount > 0 ? (stats.mergedCount / stats.prCount * 100).toFixed(1) : 0
    }));

    // Sort by PR count descending
    authorArray.sort((a, b) => b.prCount - a.prCount);

    // Create table HTML
    let tableHtml = `
        <div class="stats-table-wrapper">
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>作成者</th>
                        <th>PR数</th>
                        <th>マージ数</th>
                        <th>マージ率 (%)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    authorArray.forEach(row => {
        tableHtml += `
            <tr>
                <td>${row.author}</td>
                <td>${row.prCount}</td>
                <td>${row.mergedCount}</td>
                <td>${row.mergeRate}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHtml;
}

// Display reviewer statistics
function displayReviewerStats(currentPRs) {
    const container = document.getElementById('reviewerStatsContainer');
    if (!container) return;

    if (!currentPRs || currentPRs.length === 0) {
        container.innerHTML = '<div class="info-message">レビューデータがありません</div>';
        return;
    }

    // Collect reviewer activities
    const reviewerActivities = [];
    currentPRs.forEach(pr => {
        const reviewDetails = pr.review_details || [];
        if (Array.isArray(reviewDetails)) {
            reviewDetails.forEach(review => {
                const reviewer = review.author;
                if (reviewer) {
                    reviewerActivities.push({
                        reviewer,
                        prNumber: pr.number,
                        state: review.state
                    });
                }
            });
        }
    });

    if (reviewerActivities.length === 0) {
        container.innerHTML = '<div class="info-message">レビューデータがありません</div>';
        return;
    }

    // Group by reviewer
    const reviewerStats = {};
    reviewerActivities.forEach(activity => {
        const reviewer = activity.reviewer;
        if (!reviewerStats[reviewer]) {
            reviewerStats[reviewer] = {
                prsReviewed: new Set(),
                totalReviews: 0
            };
        }
        reviewerStats[reviewer].prsReviewed.add(activity.prNumber);
        reviewerStats[reviewer].totalReviews++;
    });

    // Convert to array
    const reviewerArray = Object.entries(reviewerStats).map(([reviewer, stats]) => ({
        reviewer,
        prsReviewedCount: stats.prsReviewed.size,
        totalReviews: stats.totalReviews
    }));

    // Sort by PRs reviewed descending
    reviewerArray.sort((a, b) => b.prsReviewedCount - a.prsReviewedCount);

    // Create table HTML
    let tableHtml = `
        <div class="stats-table-wrapper">
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>レビュワー</th>
                        <th>レビューしたPR数</th>
                        <th>総レビュー回数</th>
                    </tr>
                </thead>
                <tbody>
    `;

    reviewerArray.forEach(row => {
        tableHtml += `
            <tr>
                <td>${row.reviewer}</td>
                <td>${row.prsReviewedCount}</td>
                <td>${row.totalReviews}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHtml;
}

function formatDate(date) {
    // Handle both Date objects and ISO strings
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
        console.warn('[formatDate] Invalid date:', date);
        return 'Invalid Date';
    }
    return `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
}

// Export functions for use by other modules
window.initStatisticsPage = initStatisticsPage;

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatisticsPage);
} else {
    initStatisticsPage();
}
