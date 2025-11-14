// Global variables for Four Keys
let allPRsData = null;
let currentRepoFilter = 'all';

// Calculate Four Keys metrics from PR data
function calculateFourKeysFromPRs(prs) {
    const failureKeywords = ["revert", "hotfix", "urgent", "fix", "rollback", "emergency", "critical"];
    
    // Filter merged PRs
    const mergedPRs = prs.filter(pr => pr.state === 'MERGED' && pr.mergedAt);
    
    if (mergedPRs.length === 0) {
        return {
            metrics: {
                deploymentFrequency: { value: 0, unit: "per week", classification: { level: "Low", color: "#e74c3c" } },
                leadTime: { value: 0, unit: "days", classification: { level: "Low", color: "#e74c3c" } },
                changeFailureRate: { value: 0, unit: "percent", classification: { level: "Elite", color: "#27ae60" } },
                mttr: { value: 0, unit: "hours", classification: { level: "Elite", color: "#27ae60" } }
            },
            detailedData: { deployments: [], leadTimes: [], failures: [], restoreTimes: [] }
        };
    }
    
    // 1. Deployment Frequency
    const mergeDates = mergedPRs.map(pr => new Date(pr.mergedAt)).sort((a, b) => a - b);
    const dateRangeDays = (mergeDates[mergeDates.length - 1] - mergeDates[0]) / (1000 * 60 * 60 * 24);
    const weeks = Math.max(dateRangeDays / 7, 1);
    const deploymentFrequency = mergedPRs.length / weeks;
    
    // 2. Lead Time
    const leadTimes = mergedPRs
        .filter(pr => pr.createdAt && pr.mergedAt)
        .map(pr => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            const leadTimeDays = (merged - created) / (1000 * 60 * 60 * 24);
            return { number: pr.number, title: pr.title, leadTimeDays, createdAt: pr.createdAt, mergedAt: pr.mergedAt };
        });
    
    leadTimes.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    const medianLeadTime = leadTimes.length > 0 ? leadTimes[Math.floor(leadTimes.length / 2)].leadTimeDays : 0;
    const avgLeadTime = leadTimes.length > 0 ? leadTimes.reduce((sum, lt) => sum + lt.leadTimeDays, 0) / leadTimes.length : 0;
    
    // 3. Change Failure Rate
    const failurePRs = mergedPRs.filter(pr => {
        const title = (pr.title || '').toLowerCase();
        const labels = (pr.labels || []).map(l => l.toLowerCase());
        return failureKeywords.some(kw => title.includes(kw) || labels.some(l => l.includes(kw)));
    });
    const changeFailureRate = (failurePRs.length / mergedPRs.length) * 100;
    
    // 4. MTTR
    const restoreTimes = failurePRs.map(pr => {
        const created = new Date(pr.createdAt);
        const merged = new Date(pr.mergedAt);
        return (merged - created) / (1000 * 60 * 60); // hours
    }).sort((a, b) => a - b);
    const medianMTTR = restoreTimes.length > 0 ? restoreTimes[Math.floor(restoreTimes.length / 2)] : 0;
    
    // Classify levels
    const classifyDORA = (value, metric) => {
        if (metric === 'deployment_frequency') {
            if (value >= 30) return { level: 'Elite', color: '#27ae60' };
            if (value >= 7) return { level: 'High', color: '#3498db' };
            if (value >= 1) return { level: 'Medium', color: '#f39c12' };
            return { level: 'Low', color: '#e74c3c' };
        } else if (metric === 'lead_time') {
            if (value <= 1) return { level: 'Elite', color: '#27ae60' };
            if (value <= 7) return { level: 'High', color: '#3498db' };
            if (value <= 30) return { level: 'Medium', color: '#f39c12' };
            return { level: 'Low', color: '#e74c3c' };
        } else if (metric === 'change_failure_rate') {
            if (value <= 5) return { level: 'Elite', color: '#27ae60' };
            if (value <= 10) return { level: 'High', color: '#3498db' };
            if (value <= 15) return { level: 'Medium', color: '#f39c12' };
            return { level: 'Low', color: '#e74c3c' };
        } else if (metric === 'mttr') {
            if (value <= 1) return { level: 'Elite', color: '#27ae60' };
            if (value <= 24) return { level: 'High', color: '#3498db' };
            if (value <= 168) return { level: 'Medium', color: '#f39c12' };
            return { level: 'Low', color: '#e74c3c' };
        }
    };
    
    return {
        generated: new Date().toISOString(),
        metrics: {
            deploymentFrequency: {
                value: Math.round(deploymentFrequency * 100) / 100,
                unit: "per week",
                totalDeployments: mergedPRs.length,
                weeks: Math.round(weeks * 10) / 10,
                classification: classifyDORA(deploymentFrequency, 'deployment_frequency')
            },
            leadTime: {
                value: Math.round(medianLeadTime * 100) / 100,
                unit: "days",
                median: Math.round(medianLeadTime * 100) / 100,
                average: Math.round(avgLeadTime * 100) / 100,
                classification: classifyDORA(medianLeadTime, 'lead_time')
            },
            changeFailureRate: {
                value: Math.round(changeFailureRate * 100) / 100,
                unit: "percent",
                failures: failurePRs.length,
                total: mergedPRs.length,
                classification: classifyDORA(changeFailureRate, 'change_failure_rate')
            },
            mttr: {
                value: Math.round(medianMTTR * 100) / 100,
                unit: "hours",
                median: Math.round(medianMTTR * 100) / 100,
                classification: classifyDORA(medianMTTR, 'mttr')
            }
        },
        detailedData: {
            deployments: mergedPRs.map(pr => ({
                number: pr.number,
                title: pr.title,
                mergedAt: pr.mergedAt,
                createdAt: pr.createdAt
            })),
            leadTimes: leadTimes,
            failures: failurePRs.map(pr => ({
                number: pr.number,
                title: pr.title,
                labels: pr.labels || [],
                createdAt: pr.createdAt,
                mergedAt: pr.mergedAt
            })),
            restoreTimes: failurePRs.map((pr, i) => ({
                number: pr.number,
                title: pr.title,
                restoreTimeHours: restoreTimes[i] || 0,
                mergedAt: pr.mergedAt
            }))
        }
    };
}

// Update individual Four Keys metric card (robust against unexpected object shapes)
function updateFourKeysMetricCard(metricId, metricData) {
    console.warn(`🔍 [updateFourKeysMetricCard] Called for ${metricId} with data:`, metricData);
    try {
        const card = document.getElementById(metricId);
        if (!card) {
            console.error(`[Four Keys] Card not found: ${metricId}`);
            return;
        }
        const valueEl = card.querySelector('.metric-value');
        const unitEl = card.querySelector('.metric-unit');
        const badgeEl = card.querySelector('.metric-badge');
        if (!valueEl) {
            console.error(`[Four Keys] .metric-value missing in card: ${metricId}`);
            return;
        }

        // Normalize value - handle different data structures
        let rawValue;
        let unit = '';
        let classification = { level: '-', color: '#6b7280' };
        
        if (metricData == null) {
            rawValue = 0;
        } else if (typeof metricData === 'number') {
            rawValue = metricData;
        } else if (typeof metricData === 'object') {
            // Extract value from object
            if (typeof metricData.value === 'number') {
                rawValue = metricData.value;
            } else if (typeof metricData.median === 'number') {
                rawValue = metricData.median;
            } else {
                rawValue = 0;
            }
            
            // Extract unit
            unit = metricData.unit || '';
            
            // Extract classification
            if (metricData.classification && typeof metricData.classification === 'object') {
                classification = metricData.classification;
            }
        } else {
            rawValue = 0;
        }

        // Styling
        card.style.borderTop = `4px solid ${classification.color}`;
        valueEl.classList.remove('loading');
        valueEl.style.color = classification.color;

        // Format value
        let unitText = '';
        switch (unit) {
            case 'percent': unitText = '%'; break;
            case 'per week': unitText = '/週'; break;
            case 'days': unitText = '日'; break;
            case 'hours': unitText = '時間'; break;
        }

        let displayValue = '-';
        if (typeof rawValue === 'number' && !isNaN(rawValue)) {
            displayValue = rawValue.toFixed(1);
        }
        
        console.warn(`✅ [updateFourKeysMetricCard] ${metricId} - Final: value="${displayValue}" unit="${unitText}" level="${classification.level}"`);
        
        valueEl.textContent = displayValue;
        if (unitEl) unitEl.textContent = unitText;

        if (badgeEl) {
            badgeEl.style.background = `${classification.color}22`;
            badgeEl.style.color = classification.color;
            badgeEl.style.border = `2px solid ${classification.color}`;
            badgeEl.textContent = `DORA Level: ${classification.level}`;
        }
    } catch (e) {
        console.error(`[Four Keys] updateFourKeysMetricCard failed for ${metricId}:`, e);
    }
}

// Optional: client-side calculation helper (keeps logic if you want to recalc from PR list)
function calculateFourKeysFromMergedPRs(mergedPRs) {
    if (!Array.isArray(mergedPRs) || mergedPRs.length === 0) {
        return {
            generated: new Date().toISOString(),
            metrics: {
                deploymentFrequency: { value: 0, unit: 'per week', totalDeployments: 0, weeks: 1, classification: classifyDeploymentFrequency(0) },
                leadTime: { value: 0, unit: 'days', median: 0, average: 0, classification: classifyLeadTime(0) },
                changeFailureRate: { value: 0, unit: 'percent', failures: 0, total: 0, classification: classifyChangeFailureRate(0) },
                mttr: { value: 0, unit: 'hours', median: 0, classification: classifyMTTR(0) }
            },
            detailedData: { deployments: [], leadTimes: [], failures: [], restoreTimes: [] }
        };
    }

    // 1. Deployment Frequency
    const mergeDates = mergedPRs
        .map(pr => pr && pr.mergedAt ? new Date(pr.mergedAt) : null)
        .filter(d => d instanceof Date && !isNaN(d))
        .sort((a, b) => a - b);

    const dateRangeDays = mergeDates.length > 1 ? (mergeDates[mergeDates.length - 1] - mergeDates[0]) / (1000 * 60 * 60 * 24) : 1;
    const weeks = Math.max(dateRangeDays / 7, 1);
    const deploymentFrequency = mergedPRs.length / weeks;

    const weeklyDeploys = {};
    mergedPRs.forEach(pr => {
        if (!pr || !pr.mergedAt) return;
        const d = new Date(pr.mergedAt);
        const weekKey = `${d.getUTCFullYear()}-W${String(Math.floor((d - new Date(d.getUTCFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
        if (!weeklyDeploys[weekKey]) weeklyDeploys[weekKey] = [];
        weeklyDeploys[weekKey].push({ number: pr.number, title: pr.title, mergedAt: pr.mergedAt });
    });
    const deployments = Object.keys(weeklyDeploys).sort().map(week => ({ week, count: weeklyDeploys[week].length, prs: weeklyDeploys[week] }));

    // 2. Lead Time for Changes
    const leadTimes = mergedPRs
        .filter(pr => pr && pr.createdAt && pr.mergedAt)
        .map(pr => {
            const created = new Date(pr.createdAt);
            const merged = new Date(pr.mergedAt);
            const leadTimeDays = (merged - created) / (1000 * 60 * 60 * 24);
            return {
                number: pr.number,
                title: pr.title,
                leadTimeDays,
                leadTimeHours: leadTimeDays * 24,
                createdAt: pr.createdAt,
                mergedAt: pr.mergedAt
            };
        })
        .sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));

    const medianLeadTime = leadTimes.length ? (() => {
        const arr = leadTimes.map(l => l.leadTimeDays).slice().sort((a,b)=>a-b);
        return arr[Math.floor(arr.length / 2)];
    })() : 0;
    const averageLeadTime = leadTimes.length ? leadTimes.reduce((s, l) => s + l.leadTimeDays, 0) / leadTimes.length : 0;

    // 3. Change Failure Rate (title / labels heuristic)
    const failureKeywords = ["revert", "hotfix", "urgent", "fix", "rollback", "emergency", "critical"];
    const failurePRs = mergedPRs.filter(pr => {
        if (!pr) return false;
        const title = (pr.title || '').toLowerCase();
        const labels = Array.isArray(pr.labels) ? pr.labels.map(lbl => String(lbl).toLowerCase()) : [];
        return failureKeywords.some(k => title.includes(k) || labels.some(l => l.includes(k)));
    }).map(pr => {
        const created = pr.createdAt ? new Date(pr.createdAt) : null;
        const merged = pr.mergedAt ? new Date(pr.mergedAt) : null;
        const restoreTimeHours = (created && merged) ? ((merged - created) / (1000 * 60 * 60)) : 0;
        return {
            number: pr.number,
            title: pr.title,
            labels: pr.labels || [],
            createdAt: pr.createdAt,
            mergedAt: pr.mergedAt,
            restoreTimeHours
        };
    });

    const changeFailureRate = mergedPRs.length ? (failurePRs.length / mergedPRs.length) * 100 : 0;

    // 4. MTTR
    const restoreTimes = failurePRs.map(fp => fp.restoreTimeHours).sort((a, b) => a - b);
    const medianMTTR = restoreTimes.length ? restoreTimes[Math.floor(restoreTimes.length / 2)] : 0;

    const fourkeys = {
        generated: new Date().toISOString(),
        metrics: {
            deploymentFrequency: {
                value: Number(deploymentFrequency.toFixed(2)),
                unit: 'per week',
                totalDeployments: mergedPRs.length,
                weeks: Number(weeks.toFixed(1)),
                classification: classifyDeploymentFrequency(deploymentFrequency)
            },
            leadTime: {
                value: Number(medianLeadTime.toFixed(2)),
                unit: 'days',
                median: Number(medianLeadTime.toFixed(2)),
                average: Number(averageLeadTime.toFixed(2)),
                classification: classifyLeadTime(medianLeadTime)
            },
            changeFailureRate: {
                value: Number(changeFailureRate.toFixed(2)),
                unit: 'percent',
                failures: failurePRs.length,
                total: mergedPRs.length,
                classification: classifyChangeFailureRate(changeFailureRate)
            },
            mttr: {
                value: Number(medianMTTR.toFixed(2)),
                unit: 'hours',
                median: Number(medianMTTR.toFixed(2)),
                classification: classifyMTTR(medianMTTR)
            }
        },
        detailedData: {
            deployments,
            leadTimes,
            failures: failurePRs,
            restoreTimes: failurePRs.map(fp => ({ number: fp.number, title: fp.title, restoreTimeHours: fp.restoreTimeHours, mergedAt: fp.mergedAt }))
        }
    };

    return fourkeys;
}

// Classification functions based on DORA standards
function classifyDeploymentFrequency(value) {
    if (value >= 7) return { level: 'Elite', color: '#10b981' };
    if (value >= 1) return { level: 'High', color: '#3b82f6' };
    if (value >= 0.25) return { level: 'Medium', color: '#f59e0b' };
    return { level: 'Low', color: '#ef4444' };
}

function classifyLeadTime(days) {
    if (days <= 1) return { level: 'Elite', color: '#10b981' };
    if (days <= 7) return { level: 'High', color: '#3b82f6' };
    if (days <= 30) return { level: 'Medium', color: '#f59e0b' };
    return { level: 'Low', color: '#ef4444' };
}

function classifyChangeFailureRate(percent) {
    if (percent <= 15) return { level: 'Elite', color: '#10b981' };
    if (percent <= 20) return { level: 'High', color: '#3b82f6' };
    if (percent <= 30) return { level: 'Medium', color: '#f59e0b' };
    return { level: 'Low', color: '#ef4444' };
}

function classifyMTTR(hours) {
    if (hours <= 1) return { level: 'Elite', color: '#10b981' };
    if (hours <= 24) return { level: 'High', color: '#3b82f6' };
    if (hours <= 168) return { level: 'Medium', color: '#f59e0b' };
    return { level: 'Low', color: '#ef4444' };
}

// Display error message
function showFourKeysError() {
    const container = document.getElementById('fourkeys-content');
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                <h3>⚠️ データの読み込みに失敗しました</h3>
                <p>Four Keysデータが見つかりません。データ生成スクリプトを実行してください。</p>
                <code>python Dashboard_pages/generate_data.py</code>
            </div>
        `;
    }
}

// Display Four Keys metrics
function displayFourKeysMetrics() {
    console.log('[Four Keys] displayFourKeysMetrics called');
    console.log('[Four Keys] fourkeysData:', fourkeysData);

    if (!fourkeysData || !fourkeysData.metrics) {
        console.warn('[Four Keys] No data or metrics available');
        showNoDataMessage();
        return;
    }

    console.log('[Four Keys] Metrics available:', Object.keys(fourkeysData.metrics));
    console.log('[Four Keys] Deployment Frequency data:', fourkeysData.metrics.deploymentFrequency);
    console.log('[Four Keys] Lead Time data:', fourkeysData.metrics.leadTime);
    console.log('[Four Keys] Change Failure Rate data:', fourkeysData.metrics.changeFailureRate);
    console.log('[Four Keys] MTTR data:', fourkeysData.metrics.mttr);

    // Hide dev banner
    hideDevBanner();

    // Update metric cards immediately (no animation delay)
    console.log('[Four Keys] Updating metric cards...');
    updateFourKeysMetricCard('deployment-frequency', fourkeysData.metrics.deploymentFrequency);
    updateFourKeysMetricCard('lead-time', fourkeysData.metrics.leadTime);
    updateFourKeysMetricCard('change-failure-rate', fourkeysData.metrics.changeFailureRate);
    updateFourKeysMetricCard('mttr', fourkeysData.metrics.mttr);
    console.log('[Four Keys] All metric cards updated');

    // Create detailed visualizations
    try {
        createFourKeysCharts();
    } catch (error) {
        console.error('Error creating charts:', error);
        createMetricsInfoOnly();
    }
}

// Helper: Show no data message
function showNoDataMessage() {
    const contentDiv = document.querySelector('#page-fourkeys .page-content') ||
                       document.querySelector('#page-fourkeys');
    if (contentDiv) {
        const existingMsg = contentDiv.querySelector('.info-message');
        if (existingMsg) existingMsg.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'info-message';
        messageDiv.style.cssText = 'padding: 2rem; text-align: center; margin: 2rem 0;';
        messageDiv.innerHTML = `
            <h3>ℹ️ データがありません</h3>
            <p>選択したリポジトリのマージされたPRがないため、Four Keys指標を計算できません。</p>
        `;
        contentDiv.appendChild(messageDiv);
    }
}

// Helper: Hide dev banner
function hideDevBanner() {
    const devBanner = document.getElementById('fourkeys-dev-banner');
    if (devBanner && devBanner.style.display !== 'none') {
        devBanner.style.transition = 'opacity 0.5s ease';
        devBanner.style.opacity = '0';
        setTimeout(() => {
            devBanner.style.display = 'none';
        }, 500);
    }
}

// Create metrics info without charts (fallback when Plotly is not available)
function createMetricsInfoOnly() {
    if (!fourkeysData || !fourkeysData.detailedData) return;

    let chartsContainer = document.getElementById('fourkeys-charts');
    if (!chartsContainer) {
        chartsContainer = document.createElement('div');
        chartsContainer.id = 'fourkeys-charts';
        chartsContainer.className = 'fourkeys-charts-container';

        const metricsGrid = document.querySelector('.metrics-grid');
        if (metricsGrid) {
            metricsGrid.after(chartsContainer);
        }
    }

    const metrics = fourkeysData.metrics;

    chartsContainer.innerHTML = `
        <hr class="divider">
        <h2>メトリクス詳細</h2>

        <div class="info-box">
            <h3>📊 Four Keys メトリクス サマリー</h3>

            <h4>1. Deployment Frequency (デプロイ頻度)</h4>
            <ul>
                <li><strong>値:</strong> ${metrics.deploymentFrequency.value.toFixed(2)} 回/週</li>
                <li><strong>総デプロイ数:</strong> ${metrics.deploymentFrequency.totalDeployments} 件</li>
                <li><strong>期間:</strong> ${metrics.deploymentFrequency.weeks} 週</li>
                <li><strong>DORA Level:</strong> <span style="color: ${metrics.deploymentFrequency.classification.color}; font-weight: bold;">${metrics.deploymentFrequency.classification.level}</span></li>
            </ul>

            <h4>2. Lead Time for Changes (変更のリードタイム)</h4>
            <ul>
                <li><strong>中央値:</strong> ${metrics.leadTime.median.toFixed(2)} 日</li>
                <li><strong>平均値:</strong> ${metrics.leadTime.average.toFixed(2)} 日</li>
                <li><strong>DORA Level:</strong> <span style="color: ${metrics.leadTime.classification.color}; font-weight: bold;">${metrics.leadTime.classification.level}</span></li>
            </ul>

            <h4>3. Change Failure Rate (変更失敗率)</h4>
            <ul>
                <li><strong>失敗率:</strong> ${metrics.changeFailureRate.value.toFixed(2)}%</li>
                <li><strong>失敗PR:</strong> ${metrics.changeFailureRate.failures} 件 / ${metrics.changeFailureRate.total} 件</li>
                <li><strong>DORA Level:</strong> <span style="color: ${metrics.changeFailureRate.classification.color}; font-weight: bold;">${metrics.changeFailureRate.classification.level}</span></li>
            </ul>

            <h4>4. Time to Restore Service (MTTR)</h4>
            <ul>
                <li><strong>中央値:</strong> ${metrics.mttr.median.toFixed(2)} 時間</li>
                <li><strong>DORA Level:</strong> <span style="color: ${metrics.mttr.classification.color}; font-weight: bold;">${metrics.mttr.classification.level}</span></li>
            </ul>
        </div>

        <hr class="divider">
        <h2>計測方法について</h2>
        <div class="info-box">
            <h3>📊 Four Keys メトリクスの計算方法</h3>
            <p>このダッシュボードでは、GitHubのPRデータから以下のように Four Keys を計算しています：</p>
            <h4>1. Deployment Frequency (デプロイ頻度)</h4>
            <ul>
                <li><strong>計測方法:</strong> MERGEDステータスのPRを「デプロイ」と見なして集計</li>
                <li><strong>単位:</strong> 週あたりのデプロイ回数</li>
                <li><strong>精度:</strong> ✅ 正確に測定可能（PRマージ＝デプロイと仮定）</li>
            </ul>
            <h4>2. Lead Time for Changes (変更のリードタイム)</h4>
            <ul>
                <li><strong>計測方法:</strong> PR作成からマージまでの時間（中央値）</li>
                <li><strong>単位:</strong> 日</li>
                <li><strong>精度:</strong> ✅ 正確に測定可能</li>
                <li><strong>注意:</strong> コミットからPR作成までの時間は含まれません</li>
            </ul>
            <h4>3. Change Failure Rate (変更失敗率)</h4>
            <ul>
                <li><strong>計測方法:</strong> 以下のキーワードを含むPRを「失敗」と判定</li>
                <li><strong>キーワード:</strong> revert, hotfix, urgent, fix, rollback, emergency, critical</li>
                <li><strong>単位:</strong> パーセント（失敗PR数 / 総PR数）</li>
                <li><strong>精度:</strong> ⚠️ 推定値（実際のインシデントとは異なる場合あり）</li>
            </ul>
            <h4>4. Time to Restore Service (MTTR)</h4>
            <ul>
                <li><strong>計測方法:</strong> 「失敗」PRの作成からマージまでの時間（中央値）</li>
                <li><strong>単位:</strong> 時間</li>
                <li><strong>精度:</strong> ⚠️ 推定値（実際の障害検知から復旧までの時間とは異なる）</li>
                <li><strong>注意:</strong> 本来はインシデント管理システムとの連携が必要</li>
            </ul>
        </div>
    `;
}

// Create Four Keys charts
function createFourKeysCharts() {
    if (!fourkeysData || !fourkeysData.detailedData) return;

    // Check if Plotly is available
    if (typeof Plotly === 'undefined') {
        console.warn('Plotly is not available, showing metrics info only');
        createMetricsInfoOnly();
        return;
    }

    console.log('[Four Keys] Creating charts...');

    // Setup tab switching
    setupTabSwitching();

    // Create Four Keys Radar Chart
    createFourKeysRadarChart();

    // Create Four Keys Quadrant Charts
    createFourKeysQuadrantCharts();
    
    // Create Detailed Analysis Charts
    try {
        console.log('[Four Keys] Creating detailed analysis charts...');
        createDetailedAnalysisCharts();
    } catch (error) {
        console.error('[Four Keys] Error creating detailed analysis charts:', error);
    }
}

// Setup tab switching functionality
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const activePane = document.getElementById(`tab-${tabName}`);
            if (activePane) {
                activePane.classList.add('active');
            }
        });
    });
}

// Create Deployment Frequency chart
function createDeploymentFrequencyChart() {
    const deployments = fourkeysData.detailedData.deployments;
    if (!deployments || deployments.length === 0) return;

    const weeks = deployments.map(d => d.week);
    const counts = deployments.map(d => d.count);

    const trace = {
        x: weeks,
        y: counts,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'デプロイ数',
        line: { color: '#3b82f6', width: 2 },
        marker: { size: 8 },
        fill: 'tozeroy',
        fillcolor: 'rgba(59, 130, 246, 0.2)'
    };

    const layout = {
        xaxis: { title: '週' },
        yaxis: { title: 'デプロイ数' },
        hovermode: 'x unified',
        margin: { l: 50, r: 20, t: 20, b: 50 }
    };

    Plotly.newPlot('chart-deployment-frequency', [trace], layout, { responsive: true });
}

// Create Lead Time chart
function createLeadTimeChart() {
    const leadTimes = fourkeysData.detailedData.leadTimes;
    if (!leadTimes || leadTimes.length === 0) return;

    const dates = leadTimes.map(lt => new Date(lt.mergedAt));
    const times = leadTimes.map(lt => lt.leadTimeDays);
    const prNumbers = leadTimes.map(lt => `PR #${lt.number}`);

    const trace = {
        x: dates,
        y: times,
        type: 'scatter',
        mode: 'markers',
        name: 'リードタイム',
        marker: {
            size: 8,
            color: '#f59e0b',
            opacity: 0.6
        },
        text: prNumbers,
        hovertemplate: '<b>%{text}</b><br>%{x}<br>リードタイム: %{y:.1f}日<extra></extra>'
    };

    const layout = {
        xaxis: { title: 'マージ日' },
        yaxis: { title: 'リードタイム (日)' },
        hovermode: 'closest',
        margin: { l: 50, r: 20, t: 20, b: 50 }
    };

    Plotly.newPlot('chart-lead-time', [trace], layout, { responsive: true });
}

// Create Change Failure Rate chart
function createFailureRateChart() {
    const failures = fourkeysData.detailedData.failures;
    const deployments = fourkeysData.detailedData.deployments;

    if (!deployments || deployments.length === 0) return;

    // Calculate weekly failure rates
    const weeklyData = {};

    deployments.forEach(d => {
        weeklyData[d.week] = { total: d.count, failures: 0 };
    });

    failures.forEach(f => {
        const mergedDate = new Date(f.mergedAt);
        const week = `${mergedDate.getFullYear()}-W${String(Math.floor((mergedDate - new Date(mergedDate.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
        if (weeklyData[week]) {
            weeklyData[week].failures++;
        }
    });

    const weeks = Object.keys(weeklyData).sort();
    const failureRates = weeks.map(w => (weeklyData[w].failures / weeklyData[w].total) * 100);
    const successRates = weeks.map(w => 100 - (weeklyData[w].failures / weeklyData[w].total) * 100);

    const trace1 = {
        x: weeks,
        y: failureRates,
        type: 'bar',
        name: '失敗率',
        marker: { color: '#ef4444' }
    };

    const trace2 = {
        x: weeks,
        y: successRates,
        type: 'bar',
        name: '成功率',
        marker: { color: '#10b981' }
    };

    const layout = {
        xaxis: { title: '週' },
        yaxis: { title: '割合 (%)' },
        barmode: 'stack',
        hovermode: 'x unified',
        margin: { l: 50, r: 20, t: 20, b: 50 }
    };

    Plotly.newPlot('chart-failure-rate', [trace1, trace2], layout, { responsive: true });
}

// Create MTTR chart
function createMTTRChart() {
    const restoreTimes = fourkeysData.detailedData.restoreTimes;
    if (!restoreTimes || restoreTimes.length === 0) {
        const container = document.getElementById('chart-mttr');
        if (container) {
            container.innerHTML = '<div class="no-data-message">失敗PRがないため、データがありません</div>';
        }
        return;
    }

    const dates = restoreTimes.map(rt => new Date(rt.mergedAt));
    const times = restoreTimes.map(rt => rt.restoreTimeHours);
    const prNumbers = restoreTimes.map(rt => `PR #${rt.number}`);

    const trace = {
        x: dates,
        y: times,
        type: 'scatter',
        mode: 'markers',
        name: '復旧時間',
        marker: {
            size: 10,
            color: '#ef4444',
            opacity: 0.7
        },
        text: prNumbers,
        hovertemplate: '<b>%{text}</b><br>%{x}<br>復旧時間: %{y:.1f}時間<extra></extra>'
    };

    const layout = {
        xaxis: { title: 'マージ日' },
        yaxis: { title: '復旧時間 (時間)' },
        hovermode: 'closest',
        margin: { l: 50, r: 20, t: 20, b: 50 }
    };

    Plotly.newPlot('chart-mttr', [trace], layout, { responsive: true });
}

// Create Radar chart
function createRadarChart() {
    const metrics = fourkeysData.metrics;

    // Map DORA levels to numeric values
    const levelMap = {
        'Elite': 4,
        'High': 3,
        'Medium': 2,
        'Low': 1,
        'Unknown': 0
    };

    const categories = [
        'Deployment<br>Frequency',
        'Lead Time<br>for Changes',
        'Change<br>Failure Rate',
        'MTTR'
    ];

    const values = [
        levelMap[metrics.deploymentFrequency.classification.level],
        levelMap[metrics.leadTime.classification.level],
        levelMap[metrics.changeFailureRate.classification.level],
        // MTTRは小さいほど良いので値を反転（4:Elite, 1:Low）
        5 - levelMap[metrics.mttr.classification.level]
    ];

    // Close the radar chart
    const radarCategories = [...categories, categories[0]];
    const radarValues = [...values, values[0]];

    const trace1 = {
        type: 'scatterpolar',
        r: radarValues,
        theta: radarCategories,
        fill: 'toself',
        name: '現在のレベル',
        line: { color: '#3b82f6', width: 2 },
        fillcolor: 'rgba(59, 130, 246, 0.3)'
    };

    const trace2 = {
        type: 'scatterpolar',
        r: [4, 4, 4, 4, 4],
        theta: radarCategories,
        fill: 'toself',
        name: 'Elite基準',
        line: { color: '#10b981', width: 1, dash: 'dash' },
        fillcolor: 'rgba(16, 185, 129, 0.1)'
    };

    const layout = {
        polar: {
            radialaxis: {
                visible: true,
                range: [0, 4],
                tickvals: [1, 2, 3, 4],
                ticktext: ['Low', 'Medium', 'High', 'Elite']
            }
        },
        showlegend: true,
        margin: { l: 80, r: 80, t: 40, b: 40 }
    };

    Plotly.newPlot('chart-radar', [trace1, trace2], layout, { responsive: true });
}

// Create detailed Deployment Frequency chart
function createDeploymentDetailChart() {
    const deployments = fourkeysData.detailedData.deployments;
    if (!deployments || deployments.length === 0) return;

    const weeks = deployments.map(d => d.week);
    const counts = deployments.map(d => d.count);

    const trace = {
        x: weeks,
        y: counts,
        type: 'bar',
        name: 'デプロイ数',
        marker: {
            color: counts.map(c => c >= 5 ? '#10b981' : '#3b82f6'),
            line: { color: '#1f2937', width: 1 }
        },
        text: counts,
        textposition: 'outside',
        hovertemplate: '<b>%{x}</b><br>デプロイ数: %{y}件<extra></extra>'
    };

    const layout = {
        xaxis: { title: '週' },
        yaxis: { title: 'デプロイ数' },
        hovermode: 'x unified',
        margin: { l: 50, r: 20, t: 20, b: 50 },
        showlegend: false
    };

    Plotly.newPlot('chart-deployment-detail', [trace], layout, { responsive: true });
}

// Create detailed Lead Time chart
function createLeadTimeDetailChart() {
    const leadTimes = fourkeysData.detailedData.leadTimes;
    if (!leadTimes || leadTimes.length === 0) return;

    const dates = leadTimes.map(lt => new Date(lt.mergedAt));
    const times = leadTimes.map(lt => lt.leadTimeDays);
    const prNumbers = leadTimes.map(lt => `PR #${lt.number}`);
    const titles = leadTimes.map(lt => lt.title);

    // Sort by date
    const sortedData = dates.map((d, i) => ({ date: d, time: times[i], pr: prNumbers[i], title: titles[i] }))
        .sort((a, b) => a.date - b.date);

    const trace1 = {
        x: sortedData.map(d => d.date),
        y: sortedData.map(d => d.time),
        type: 'scatter',
        mode: 'markers',
        name: 'リードタイム',
        marker: {
            size: 12,
            color: sortedData.map(d => d.time),
            colorscale: [[0, '#10b981'], [0.5, '#f59e0b'], [1, '#ef4444']],
            showscale: true,
            colorbar: { title: '日数' }
        },
        text: sortedData.map(d => d.pr),
        customdata: sortedData.map(d => d.title),
        hovertemplate: '<b>%{text}</b><br>%{customdata}<br>%{x}<br>リードタイム: %{y:.1f}日<extra></extra>'
    };

    // Add moving average line
    if (sortedData.length >= 3) {
        const movingAvg = [];
        const movingAvgDates = [];
        for (let i = 2; i < sortedData.length; i++) {
            const avg = (sortedData[i-2].time + sortedData[i-1].time + sortedData[i].time) / 3;
            movingAvg.push(avg);
            movingAvgDates.push(sortedData[i].date);
        }

        const trace2 = {
            x: movingAvgDates,
            y: movingAvg,
            type: 'scatter',
            mode: 'lines',
            name: '移動平均 (3点)',
            line: { color: '#f59e0b', width: 3, dash: 'dash' },
            hovertemplate: '<b>移動平均</b><br>%{x}<br>%{y:.1f}日<extra></extra>'
        };

        Plotly.newPlot('chart-leadtime-detail', [trace1, trace2], {
            xaxis: { title: 'マージ日' },
            yaxis: { title: 'リードタイム (日)' },
            hovermode: 'closest',
            margin: { l: 50, r: 20, t: 20, b: 50 }
        }, { responsive: true });
    } else {
        Plotly.newPlot('chart-leadtime-detail', [trace1], {
            xaxis: { title: 'マージ日' },
            yaxis: { title: 'リードタイム (日)' },
            hovermode: 'closest',
            margin: { l: 50, r: 20, t: 20, b: 50 }
        }, { responsive: true });
    }
}

// Create detailed Failure Rate chart
function createFailureDetailChart() {
    const failures = fourkeysData.detailedData.failures;
    const deployments = fourkeysData.detailedData.deployments;

    if (!deployments || deployments.length === 0) return;

    // Calculate weekly failure rates
    const weeklyData = {};

    deployments.forEach(d => {
        weeklyData[d.week] = { total: d.count, failures: 0 };
    });

    failures.forEach(f => {
        const mergedDate = new Date(f.mergedAt);
        const week = `${mergedDate.getFullYear()}-W${String(Math.floor((mergedDate - new Date(mergedDate.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
        if (weeklyData[week]) {
            weeklyData[week].failures++;
        }
    });

    const weeks = Object.keys(weeklyData).sort();
    const failureRates = weeks.map(w => (weeklyData[w].failures / weeklyData[w].total) * 100);
    const failureCounts = weeks.map(w => weeklyData[w].failures);
    const totalCounts = weeks.map(w => weeklyData[w].total);

    const trace1 = {
        x: weeks,
        y: failureRates,
        type: 'scatter',
        mode: 'lines+markers',
        name: '失敗率',
        line: { color: '#ef4444', width: 3 },
        marker: { size: 10 },
        fill: 'tozeroy',
        fillcolor: 'rgba(239, 68, 68, 0.2)',
        customdata: weeks.map((w, i) => `${failureCounts[i]}/${totalCounts[i]}`),
        hovertemplate: '<b>%{x}</b><br>失敗率: %{y:.1f}%<br>失敗PR: %{customdata}<extra></extra>'
    };

    // Add threshold line at 15% (Elite level)
    const trace2 = {
        x: weeks,
        y: new Array(weeks.length).fill(15),
        type: 'scatter',
        mode: 'lines',
        name: 'Elite基準 (15%)',
        line: { color: '#10b981', width: 2, dash: 'dash' },
        hovertemplate: 'Elite基準: 15%<extra></extra>'
    };

    const layout = {
        xaxis: { title: '週' },
        yaxis: { title: '失敗率 (%)' },
        hovermode: 'x unified',
        margin: { l: 50, r: 20, t: 20, b: 50 },
        showlegend: true
    };

    Plotly.newPlot('chart-failure-detail', [trace1, trace2], layout, { responsive: true });
}

// Create detailed MTTR chart
function createMTTRDetailChart() {
    const restoreTimes = fourkeysData.detailedData.restoreTimes;
    if (!restoreTimes || restoreTimes.length === 0) {
        const container = document.getElementById('chart-mttr-detail');
        if (container) {
            container.innerHTML = '<div class="no-data-message">失敗PRがないため、データがありません</div>';
        }
        return;
    }

    const dates = restoreTimes.map(rt => new Date(rt.mergedAt));
    const times = restoreTimes.map(rt => rt.restoreTimeHours);
    const prNumbers = restoreTimes.map(rt => `PR #${rt.number}`);
    const titles = restoreTimes.map(rt => rt.title);

    // Sort by date
    const sortedData = dates.map((d, i) => ({ date: d, time: times[i], pr: prNumbers[i], title: titles[i] }))
        .sort((a, b) => a.date - b.date);

    const trace1 = {
        x: sortedData.map(d => d.date),
        y: sortedData.map(d => d.time),
        type: 'bar',
        name: '復旧時間',
        marker: {
            color: sortedData.map(d => d.time < 24 ? '#3b82f6' : '#ef4444'),
            line: { color: '#1f2937', width: 1 }
        },
        text: sortedData.map(d => d.pr),
        customdata: sortedData.map(d => d.title),
        hovertemplate: '<b>%{text}</b><br>%{customdata}<br>%{x}<br>復旧時間: %{y:.1f}時間<extra></extra>'
    };

    // Add threshold line at 24 hours (High level)
    const trace2 = {
        x: sortedData.map(d => d.date),
        y: new Array(sortedData.length).fill(24),
        type: 'scatter',
        mode: 'lines',
        name: 'High基準 (24h)',
        line: { color: '#f59e0b', width: 2, dash: 'dash' },
        hovertemplate: 'High基準: 24時間<extra></extra>'
    };

    const layout = {
        xaxis: { title: 'マージ日' },
        yaxis: { title: '復旧時間 (時間)' },
        hovermode: 'x unified',
        margin: { l: 50, r: 20, t: 20, b: 50 },
        showlegend: true
    };

    Plotly.newPlot('chart-mttr-detail', [trace1, trace2], layout, { responsive: true });
}

// Create Four Keys Radar Chart (new)
function createFourKeysRadarChart() {
    if (!fourkeysData || !fourkeysData.metrics) {
        console.log('[Four Keys Radar] No data available');
        return;
    }

    const metrics = fourkeysData.metrics;

    // DORAレベルを数値化 (Elite=4, High=3, Medium=2, Low=1)
    const levelMap = { 'Elite': 4, 'High': 3, 'Medium': 2, 'Low': 1 };

    const dfLevel = classifyDeploymentFrequency(metrics.deploymentFrequency.value || metrics.deploymentFrequency).level;
    const ltLevel = classifyLeadTime(metrics.leadTime.median || metrics.leadTime.value || metrics.leadTimeMedian).level;
    const cfrLevel = classifyChangeFailureRate(metrics.changeFailureRate.value || metrics.changeFailureRate).level;
    const mttrLevel = classifyMTTR(metrics.mttr.value || metrics.mttr).level;

    const radarData = [
        levelMap[dfLevel] || 0,
        levelMap[ltLevel] || 0,
        levelMap[cfrLevel] || 0,
        levelMap[mttrLevel] || 0
    ];

    const categories = [
        'Deployment<br>Frequency',
        'Lead Time<br>for Changes',
        'Change<br>Failure Rate',
        'MTTR'
    ];

    const trace1 = {
        r: [...radarData, radarData[0]],
        theta: [...categories, categories[0]],
        fill: 'toself',
        name: '現在のレベル',
        type: 'scatterpolar',
        line: { color: '#3b82f6', width: 2 },
        fillcolor: 'rgba(59, 130, 246, 0.3)'
    };

    // Elite基準線
    const trace2 = {
        r: [4, 4, 4, 4, 4],
        theta: [...categories, categories[0]],
        fill: 'toself',
        name: 'Elite基準',
        type: 'scatterpolar',
        line: { color: '#10b981', width: 1, dash: 'dash' },
        fillcolor: 'rgba(16, 185, 129, 0.1)'
    };

    const layout = {
        polar: {
            radialaxis: {
                visible: true,
                range: [0, 4],
                tickvals: [1, 2, 3, 4],
                ticktext: ['Low', 'Medium', 'High', 'Elite']
            }
        },
        showlegend: true,
        margin: { l: 80, r: 80, t: 40, b: 40 }
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot('fourkeys-radar-chart', [trace1, trace2], layout, config);
}

// Create Four Keys Quadrant Charts (2x2 layout)
function createFourKeysQuadrantCharts() {
    if (!fourkeysData || !fourkeysData.detailedData) {
        console.log('[Four Keys Quadrant] No detailed data available');
        return;
    }

    const detailedData = fourkeysData.detailedData;
    const metrics = fourkeysData.metrics;

    // Deployment Frequency
    createDeploymentFrequencyQuadrant(detailedData, metrics);

    // Lead Time
    createLeadTimeQuadrant(detailedData, metrics);

    // Change Failure Rate
    createChangeFailureRateQuadrant(detailedData, metrics);

    // MTTR
    createMTTRQuadrant(detailedData, metrics);
}

function createDeploymentFrequencyQuadrant(detailedData, metrics) {
    // 日別デプロイ数
    const dailyDeploys = {};
    
    // Check if deployments data exists
    if (!detailedData || !detailedData.deployments) {
        console.warn('[Four Keys] No deployments data available for quadrant chart');
        const container = document.getElementById('fourkeys-quad-df');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">データなし</div>';
        }
        return;
    }
    
    // Handle both array format (new) and week-based format (old)
    if (Array.isArray(detailedData.deployments)) {
        detailedData.deployments.forEach(pr => {
            const date = pr.mergedAt.split('T')[0];
            dailyDeploys[date] = (dailyDeploys[date] || 0) + 1;
        });
    } else {
        // Old format: week-based deployments
        detailedData.deployments.forEach(week => {
            if (week.prs && Array.isArray(week.prs)) {
                week.prs.forEach(pr => {
                    const date = pr.mergedAt.split('T')[0];
                    dailyDeploys[date] = (dailyDeploys[date] || 0) + 1;
                });
            }
        });
    }

    const dates = Object.keys(dailyDeploys).sort();
    const counts = dates.map(d => dailyDeploys[d]);

    const trace = {
        x: dates,
        y: counts,
        type: 'bar',
        marker: { color: '#3b82f6' },
        hovertemplate: '%{x}<br>デプロイ数: %{y}件<extra></extra>'
    };

    const layout = {
        xaxis: { title: '日付', tickangle: -45 },
        yaxis: { title: 'デプロイ数' },
        margin: { l: 50, r: 20, t: 20, b: 80 },
        showlegend: false
    };

    Plotly.newPlot('fourkeys-quad-df', [trace], layout, { responsive: true, displayModeBar: false });

    // メトリクス表示
    const dfValue = typeof metrics.deploymentFrequency.value === 'number' 
        ? metrics.deploymentFrequency.value 
        : (typeof metrics.deploymentFrequency === 'number' ? metrics.deploymentFrequency : 0);
    const classification = metrics.deploymentFrequency.classification || classifyDeploymentFrequency(dfValue);
    const metricDiv = document.getElementById('quad-df-metric');
    const totalDeploys = (detailedData.deployments || []).length;
    metricDiv.innerHTML = `
        <strong>${dfValue.toFixed(1)} 回/週</strong><br>
        DORA Level: <span style="color: ${classification.color};">${classification.level}</span><br>
        <small>総デプロイ数: ${totalDeploys}件</small>
    `;
}

function createLeadTimeQuadrant(detailedData, metrics) {
    // Check if leadTimes data exists
    if (!detailedData || !detailedData.leadTimes || detailedData.leadTimes.length === 0) {
        console.warn('[Four Keys] No leadTimes data available for quadrant chart');
        const container = document.getElementById('fourkeys-quad-lt');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">データなし</div>';
        }
        return;
    }
    
    // リードタイムの推移
    const sortedData = [...detailedData.leadTimes].sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));

    const trace = {
        x: sortedData.map(d => d.mergedAt.split('T')[0]),
        y: sortedData.map(d => d.leadTimeDays),
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#f59e0b' },
        line: { color: '#f59e0b' },
        hovertemplate: '%{x}<br>リードタイム: %{y:.1f}日<extra></extra>'
    };

    const layout = {
        xaxis: { title: 'マージ日', tickangle: -45 },
        yaxis: { title: 'リードタイム (日)' },
        margin: { l: 50, r: 20, t: 20, b: 80 },
        showlegend: false
    };

    Plotly.newPlot('fourkeys-quad-lt', [trace], layout, { responsive: true, displayModeBar: false });

    // メトリクス表示
    const ltValue = typeof metrics.leadTime?.median === 'number' ? metrics.leadTime.median 
        : (typeof metrics.leadTime?.value === 'number' ? metrics.leadTime.value : 0);
    const ltAvg = typeof metrics.leadTime?.average === 'number' ? metrics.leadTime.average : 0;
    const classification = metrics.leadTime?.classification || classifyLeadTime(ltValue);
    const metricDiv = document.getElementById('quad-lt-metric');
    metricDiv.innerHTML = `
        <strong>${ltValue.toFixed(1)} 日</strong><br>
        DORA Level: <span style="color: ${classification.color};">${classification.level}</span><br>
        <small>中央値（平均: ${ltAvg.toFixed(1)}日）</small>
    `;
}

function createChangeFailureRateQuadrant(detailedData, metrics) {
    // Check if failures data exists
    if (!detailedData || !detailedData.failures) {
        console.warn('[Four Keys] No failures data available for quadrant chart');
        const container = document.getElementById('fourkeys-quad-cfr');
        if (container) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">データなし</div>';
        }
        return;
    }
    
    // 週ごとの失敗数と総デプロイ数
    const weeklyData = {};
    
    // 全デプロイを週ごとに集計
    (detailedData.deployments || []).forEach(pr => {
        const week = pr.mergedAt.substring(0, 10); // YYYY-MM-DD
        if (!weeklyData[week]) {
            weeklyData[week] = { total: 0, failures: 0 };
        }
        weeklyData[week].total++;
    });
    
    // 失敗PRを週ごとに集計
    (detailedData.failures || []).forEach(pr => {
        const week = pr.mergedAt.substring(0, 10);
        if (weeklyData[week]) {
            weeklyData[week].failures++;
        }
    });

    const weeks = Object.keys(weeklyData).sort();
    const rates = weeks.map(w => (weeklyData[w].failures / weeklyData[w].total) * 100);

    const trace = {
        x: weeks,
        y: rates,
        type: 'bar',
        marker: { color: '#ef4444' },
        hovertemplate: '%{x}<br>失敗率: %{y:.1f}%<extra></extra>'
    };

    const layout = {
        xaxis: { title: '週', tickangle: -45 },
        yaxis: { title: '失敗率 (%)' },
        margin: { l: 50, r: 20, t: 20, b: 80 },
        showlegend: false
    };

    Plotly.newPlot('fourkeys-quad-cfr', [trace], layout, { responsive: true, displayModeBar: false });

    // メトリクス表示
    const cfrValue = typeof metrics.changeFailureRate.value === 'number' 
        ? metrics.changeFailureRate.value 
        : (typeof metrics.changeFailureRate === 'number' ? metrics.changeFailureRate : 0);
    const classification = classifyChangeFailureRate(cfrValue);
    const metricDiv = document.getElementById('quad-cfr-metric');
    const totalDeploys = (detailedData.deployments || []).length;
    const totalFailures = (detailedData.failures || []).length;
    metricDiv.innerHTML = `
        <strong>${cfrValue.toFixed(1)}%</strong><br>
        DORA Level: <span style="color: ${classification.color};">${classification.level}</span><br>
        <small>失敗PR: ${totalFailures}件 / ${totalDeploys}件</small>
    `;
}

function createMTTRQuadrant(detailedData, metrics) {
    if (!detailedData.restoreTimes || detailedData.restoreTimes.length === 0) {
        const el = document.getElementById('fourkeys-quad-mttr');
        if (el) el.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">失敗PRがありません</div>';
        const md = document.getElementById('quad-mttr-metric');
        if (md) md.innerHTML = '<small>データなし</small>';
        return;
    }

    // 復旧時間の推移
    const sortedData = [...detailedData.restoreTimes].sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));

    const trace = {
        x: sortedData.map(d => d.mergedAt.split('T')[0]),
        y: sortedData.map(d => d.restoreTimeHours),
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#10b981' },
        line: { color: '#10b981' },
        hovertemplate: '%{x}<br>復旧時間: %{y:.1f}時間<extra></extra>'
    };

    const layout = {
        xaxis: { title: 'マージ日', tickangle: -45 },
        yaxis: { title: '復旧時間 (時間)' },
        margin: { l: 50, r: 20, t: 20, b: 80 },
        showlegend: false
    };

    Plotly.newPlot('fourkeys-quad-mttr', [trace], layout, { responsive: true, displayModeBar: false });

    // メトリクス表示
    const mttrValue = typeof metrics.mttr?.median === 'number' ? metrics.mttr.median 
        : (typeof metrics.mttr?.value === 'number' ? metrics.mttr.value : 0);
    const classification = metrics.mttr?.classification || classifyMTTR(mttrValue);
    const metricDiv = document.getElementById('quad-mttr-metric');
    metricDiv.innerHTML = `
        <strong>${mttrValue.toFixed(1)} 時間</strong><br>
        DORA Level: <span style="color: ${classification.color};">${classification.level}</span><br>
        <small>復旧時間中央値</small>
    `;
}

// Helper function to get week key
function getWeekKey(date) {
    if (!(date instanceof Date)) {
        date = new Date(date);
        if (isNaN(date)) return 'unknown';
    }
    const year = date.getFullYear();
    const week = Math.ceil((((date - new Date(year, 0, 1)) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

// Create Detailed Analysis Charts
function createDetailedAnalysisCharts() {
    const detailedData = fourkeysData.detailedData;
    const metrics = fourkeysData.metrics;
    
    if (!detailedData) {
        console.warn('[Four Keys] No detailed data available for analysis charts');
        return;
    }
    
    // Deployment Frequency Detail
    createDeploymentFrequencyDetail(detailedData, metrics);
    
    // Lead Time Detail
    createLeadTimeDetail(detailedData, metrics);
    
    // Change Failure Rate Detail
    createChangeFailureRateDetail(detailedData, metrics);
    
    // MTTR Detail
    createMTTRDetail(detailedData, metrics);
}

function createDeploymentFrequencyDetail(detailedData, metrics) {
    const container = document.getElementById('fourkeys-df-detail');
    const tableContainer = document.getElementById('fourkeys-df-table');
    
    if (!detailedData.deployments || detailedData.deployments.length === 0) {
        if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">データなし</div>';
        if (tableContainer) tableContainer.innerHTML = '';
        return;
    }
    
    // 週ごとのデプロイ数
    const weeklyDeploys = {};
    detailedData.deployments.forEach(pr => {
        const week = getWeekKey(new Date(pr.mergedAt));
        weeklyDeploys[week] = (weeklyDeploys[week] || 0) + 1;
    });
    
    const weeks = Object.keys(weeklyDeploys).sort();
    const counts = weeks.map(w => weeklyDeploys[w]);
    
    const trace = {
        x: weeks,
        y: counts,
        type: 'bar',
        marker: { color: '#3b82f6' },
        name: 'デプロイ数'
    };
    
    const layout = {
        title: '週次デプロイ頻度',
        xaxis: { title: '週' },
        yaxis: { title: 'デプロイ数' },
        margin: { l: 60, r: 40, t: 60, b: 60 }
    };
    
    Plotly.newPlot('fourkeys-df-detail', [trace], layout, { responsive: true });
    
    // Table
    if (tableContainer) {
        const recentDeploys = [...detailedData.deployments]
            .sort((a, b) => new Date(b.mergedAt) - new Date(a.mergedAt))
            .slice(0, 10);
        
        tableContainer.innerHTML = `
            <h4>最近のデプロイ（上位10件）</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>PR番号</th>
                        <th>タイトル</th>
                        <th>マージ日時</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentDeploys.map(pr => `
                        <tr>
                            <td>#${pr.number}</td>
                            <td>${pr.title}</td>
                            <td>${new Date(pr.mergedAt).toLocaleString('ja-JP')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function createLeadTimeDetail(detailedData, metrics) {
    const container = document.getElementById('fourkeys-lt-detail');
    const tableContainer = document.getElementById('fourkeys-lt-table');
    
    if (!detailedData.leadTimes || detailedData.leadTimes.length === 0) {
        if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">データなし</div>';
        if (tableContainer) tableContainer.innerHTML = '';
        return;
    }
    
    // リードタイム分布
    const sortedLeadTimes = [...detailedData.leadTimes].sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    
    const trace = {
        y: sortedLeadTimes.map(d => d.leadTimeDays),
        type: 'box',
        name: 'リードタイム',
        marker: { color: '#f59e0b' }
    };
    
    const layout = {
        title: 'リードタイム分布',
        yaxis: { title: 'リードタイム（日）' },
        margin: { l: 60, r: 40, t: 60, b: 60 }
    };
    
    Plotly.newPlot('fourkeys-lt-detail', [trace], layout, { responsive: true });
    
    // Table
    if (tableContainer) {
        const topLongest = [...sortedLeadTimes].reverse().slice(0, 10);
        
        tableContainer.innerHTML = `
            <h4>リードタイムが長いPR（上位10件）</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>PR番号</th>
                        <th>タイトル</th>
                        <th>リードタイム</th>
                        <th>作成日</th>
                        <th>マージ日</th>
                    </tr>
                </thead>
                <tbody>
                    ${topLongest.map(pr => `
                        <tr>
                            <td>#${pr.number}</td>
                            <td>${pr.title}</td>
                            <td>${pr.leadTimeDays.toFixed(1)}日</td>
                            <td>${new Date(pr.createdAt).toLocaleDateString('ja-JP')}</td>
                            <td>${new Date(pr.mergedAt).toLocaleDateString('ja-JP')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function createChangeFailureRateDetail(detailedData, metrics) {
    const container = document.getElementById('fourkeys-cfr-detail');
    const tableContainer = document.getElementById('fourkeys-cfr-table');
    
    if (!detailedData.failures || detailedData.failures.length === 0) {
        if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">失敗PRなし</div>';
        if (tableContainer) tableContainer.innerHTML = '';
        return;
    }
    
    // 月ごとの失敗率
    const monthlyData = {};
    
    (detailedData.deployments || []).forEach(pr => {
        const month = pr.mergedAt.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { total: 0, failures: 0 };
        }
        monthlyData[month].total++;
    });
    
    detailedData.failures.forEach(pr => {
        const month = pr.mergedAt.substring(0, 7);
        if (monthlyData[month]) {
            monthlyData[month].failures++;
        }
    });
    
    const months = Object.keys(monthlyData).sort();
    const rates = months.map(m => (monthlyData[m].failures / monthlyData[m].total) * 100);
    
    const trace = {
        x: months,
        y: rates,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { color: '#ef4444', size: 8 },
        line: { color: '#ef4444', width: 2 },
        name: '失敗率'
    };
    
    const layout = {
        title: '月次変更失敗率',
        xaxis: { title: '月' },
        yaxis: { title: '失敗率（%）' },
        margin: { l: 60, r: 40, t: 60, b: 60 }
    };
    
    Plotly.newPlot('fourkeys-cfr-detail', [trace], layout, { responsive: true });
    
    // Table
    if (tableContainer) {
        const recentFailures = [...detailedData.failures]
            .sort((a, b) => new Date(b.mergedAt) - new Date(a.mergedAt))
            .slice(0, 10);
        
        tableContainer.innerHTML = `
            <h4>最近の失敗PR（上位10件）</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>PR番号</th>
                        <th>タイトル</th>
                        <th>ラベル</th>
                        <th>マージ日</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentFailures.map(pr => `
                        <tr>
                            <td>#${pr.number}</td>
                            <td>${pr.title}</td>
                            <td>${(pr.labels || []).join(', ')}</td>
                            <td>${new Date(pr.mergedAt).toLocaleDateString('ja-JP')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function createMTTRDetail(detailedData, metrics) {
    const container = document.getElementById('fourkeys-mttr-detail');
    const tableContainer = document.getElementById('fourkeys-mttr-table');
    
    if (!detailedData.restoreTimes || detailedData.restoreTimes.length === 0) {
        if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280;">データなし</div>';
        if (tableContainer) tableContainer.innerHTML = '';
        return;
    }
    
    // 復旧時間分布
    const sortedRestoreTimes = [...detailedData.restoreTimes].sort((a, b) => a.restoreTimeHours - b.restoreTimeHours);
    
    const trace = {
        y: sortedRestoreTimes.map(d => d.restoreTimeHours),
        type: 'box',
        name: '復旧時間',
        marker: { color: '#10b981' }
    };
    
    const layout = {
        title: '復旧時間分布',
        yaxis: { title: '復旧時間（時間）' },
        margin: { l: 60, r: 40, t: 60, b: 60 }
    };
    
    Plotly.newPlot('fourkeys-mttr-detail', [trace], layout, { responsive: true });
    
    // Table
    if (tableContainer) {
        const topLongest = [...sortedRestoreTimes].reverse().slice(0, 10);
        
        tableContainer.innerHTML = `
            <h4>復旧時間が長いPR（上位10件）</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>PR番号</th>
                        <th>タイトル</th>
                        <th>復旧時間</th>
                        <th>マージ日</th>
                    </tr>
                </thead>
                <tbody>
                    ${topLongest.map(pr => `
                        <tr>
                            <td>#${pr.number}</td>
                            <td>${pr.title}</td>
                            <td>${pr.restoreTimeHours.toFixed(1)}時間</td>
                            <td>${new Date(pr.mergedAt).toLocaleDateString('ja-JP')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

// ========================================
// Data Loading
// ========================================

let fourkeysData = null;

// Load Four Keys data from JSON file
async function loadFourKeysData() {
    console.log('[Four Keys] Loading data...');
    const devBanner = document.getElementById('fourkeys-dev-banner');

    try {
        const base = (typeof CONFIG !== 'undefined' && CONFIG.dataSource && CONFIG.dataSource.basePath) ? CONFIG.dataSource.basePath : './data/';
        
        // Load both fourkeys.json and prs.json
        const fourkeysUrl = `${base.replace(/\/?$/,'/') }fourkeys.json`;
        const prsUrl = `${base.replace(/\/?$/,'/') }prs.json`;
        console.log('[Four Keys] Fetching URLs:', fourkeysUrl, prsUrl);

        const [fourkeysResponse, prsResponse] = await Promise.all([
            fetch(fourkeysUrl),
            fetch(prsUrl)
        ]);

        if (!fourkeysResponse.ok) {
            throw new Error(`HTTP error loading fourkeys.json! status: ${fourkeysResponse.status}`);
        }
        if (!prsResponse.ok) {
            throw new Error(`HTTP error loading prs.json! status: ${prsResponse.status}`);
        }

        fourkeysData = await fourkeysResponse.json();
        const prsData = await prsResponse.json();
        console.log('[Four Keys] Data loaded successfully');

        // Extract all PRs from prs.json
        allPRsData = [];
        
        // Handle both array format and repository object format
        if (Array.isArray(prsData)) {
            // New format: array of PRs with owner/repo fields
            allPRsData = prsData.map(pr => ({
                ...pr,
                repository: `${pr.owner}/${pr.repo}`
            }));
        } else if (prsData && prsData.repositories) {
            // Old format: repositories object with nested PRs
            Object.entries(prsData.repositories).forEach(([repoName, repoData]) => {
                if (repoData.prs && Array.isArray(repoData.prs)) {
                    repoData.prs.forEach(pr => {
                        allPRsData.push({ ...pr, repository: repoName });
                    });
                }
            });
        }
        
        // Count unique repositories
        const uniqueRepos = new Set(allPRsData.map(pr => pr.repository));
        console.log(`[Four Keys] Loaded ${allPRsData.length} PRs from ${uniqueRepos.size} repositories`);

        // Hide banner and calculate metrics based on current filter
        if (devBanner) {
            devBanner.style.display = 'none';
        }
        
        // Calculate and display metrics based on current global filter
        updateMetricsForCurrentFilter();
    } catch (error) {
        console.error('[Four Keys] Failed to load data:', error);
        // Show banner on error
        if (devBanner) {
            devBanner.style.display = 'block';
        }
    }
}

// Update metrics based on global repository filter
function updateMetricsForCurrentFilter() {
    if (!allPRsData || allPRsData.length === 0) {
        console.warn('[Four Keys] No PR data available for filtering');
        return;
    }

    // Get current filter from global sidebar filter
    const globalFilter = document.getElementById('globalRepoFilter');
    const selectedRepo = globalFilter ? globalFilter.value : '';

    let filteredPRs = allPRsData;
    
    // Filter by repository if a specific repo is selected
    if (selectedRepo && selectedRepo !== '') {
        filteredPRs = allPRsData.filter(pr => pr.repository === selectedRepo);
        console.log(`[Four Keys] Filtered to ${filteredPRs.length} PRs for repository: ${selectedRepo}`);
    } else {
        console.log(`[Four Keys] Showing all ${filteredPRs.length} PRs`);
    }

    // Recalculate metrics from filtered PRs
    const calculatedData = calculateFourKeysFromPRs(filteredPRs);
    
    // Update global fourkeysData with calculated metrics
    fourkeysData = calculatedData;
    
    // Re-display metrics
    displayFourKeysMetrics();
}

// Initialize Four Keys page when navigated to
function initializeFourKeysPage() {
    loadFourKeysData();
}

// Export functions for use by other modules
window.initializeFourKeysPage = initializeFourKeysPage;
window.loadFourKeysData = loadFourKeysData;
