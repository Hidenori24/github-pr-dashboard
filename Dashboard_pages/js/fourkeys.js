// Four Keys Metrics Page Logic

let fourkeysData = null;

// Load Four Keys data
async function loadFourKeysData() {
    try {
        const response = await fetch('data/fourkeys.json');
        if (!response.ok) {
            throw new Error('Failed to load Four Keys data');
        }
        fourkeysData = await response.json();
        displayFourKeysMetrics();
    } catch (error) {
        console.error('Error loading Four Keys data:', error);
        showFourKeysError();
    }
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
    if (!fourkeysData || !fourkeysData.metrics) {
        showFourKeysError();
        return;
    }
    
    // Remove dev banner
    const devBanner = document.querySelector('.dev-banner');
    if (devBanner) {
        devBanner.remove();
    }
    
    // Update metric cards
    updateMetricCard('deployment-frequency', fourkeysData.metrics.deploymentFrequency);
    updateMetricCard('lead-time', fourkeysData.metrics.leadTime);
    updateMetricCard('change-failure-rate', fourkeysData.metrics.changeFailureRate);
    updateMetricCard('mttr', fourkeysData.metrics.mttr);
    
    // Create detailed visualizations
    try {
        createFourKeysCharts();
    } catch (error) {
        console.error('Error creating charts:', error);
        // Show metrics info even if charts fail
        createMetricsInfoOnly();
    }
}

// Update individual metric card
function updateMetricCard(metricId, metricData) {
    const card = document.getElementById(metricId);
    if (!card) return;
    
    const classification = metricData.classification;
    const value = metricData.value;
    const unit = metricData.unit;
    
    card.style.borderLeft = `4px solid ${classification.color}`;
    card.style.background = `${classification.color}22`;
    
    const valueElement = card.querySelector('.metric-value');
    if (valueElement) {
        if (unit === 'percent') {
            valueElement.textContent = `${value.toFixed(1)}%`;
        } else if (unit === 'per week') {
            valueElement.textContent = `${value.toFixed(1)} /週`;
        } else if (unit === 'days') {
            valueElement.textContent = `${value.toFixed(1)} 日`;
        } else if (unit === 'hours') {
            valueElement.textContent = `${value.toFixed(1)} 時間`;
        } else {
            valueElement.textContent = value.toFixed(1);
        }
    }
    
    // Add DORA level badge
    const descElement = card.querySelector('.metric-description');
    if (descElement) {
        const levelBadge = document.createElement('div');
        levelBadge.className = 'dora-level-badge';
        levelBadge.style.color = classification.color;
        levelBadge.style.fontWeight = 'bold';
        levelBadge.style.marginTop = '0.5rem';
        levelBadge.textContent = `DORA Level: ${classification.level}`;
        
        // Check if badge already exists
        const existingBadge = card.querySelector('.dora-level-badge');
        if (existingBadge) {
            existingBadge.replaceWith(levelBadge);
        } else {
            descElement.after(levelBadge);
        }
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
        
        const metricsGrid = document.querySelector('.feature-grid');
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
            
            <h3>⚠️ 制約事項</h3>
            <ul>
                <li>PRデータのみから計算しているため、実際のデプロイプロセスやインシデント管理とは異なる場合があります</li>
                <li>より正確な測定には、CI/CDシステムやインシデント管理ツールとの連携が推奨されます</li>
                <li>Change Failure Rate と MTTR は推定値です。実際の環境に合わせてキーワードや計算ロジックの調整が必要な場合があります</li>
            </ul>
            
            <h3>📈 DORA レベルについて</h3>
            <p>各メトリクスは DORA (DevOps Research and Assessment) の基準に基づいて、Elite / High / Medium / Low の4段階で評価されます。</p>
            
            <h4>参考資料</h4>
            <ul>
                <li><a href="https://www.devops-research.com/research.html" target="_blank">DORA Research</a></li>
                <li><a href="https://github.com/GoogleCloudPlatform/fourkeys" target="_blank">Google Cloud - Four Keys Project</a></li>
                <li><a href="https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance" target="_blank">Four Keys の使い方</a></li>
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
    
    // Create container for charts if it doesn't exist
    let chartsContainer = document.getElementById('fourkeys-charts');
    if (!chartsContainer) {
        chartsContainer = document.createElement('div');
        chartsContainer.id = 'fourkeys-charts';
        chartsContainer.className = 'fourkeys-charts-container';
        
        const metricsGrid = document.querySelector('.feature-grid');
        if (metricsGrid) {
            metricsGrid.after(chartsContainer);
        }
    }
    
    chartsContainer.innerHTML = `
        <hr class="divider">
        <h2>詳細分析</h2>
        
        <div class="charts-grid">
            <div class="chart-container">
                <h3>Deployment Frequency</h3>
                <div id="chart-deployment-frequency" style="width: 100%; height: 300px;"></div>
            </div>
            
            <div class="chart-container">
                <h3>Lead Time for Changes</h3>
                <div id="chart-lead-time" style="width: 100%; height: 300px;"></div>
            </div>
            
            <div class="chart-container">
                <h3>Change Failure Rate</h3>
                <div id="chart-failure-rate" style="width: 100%; height: 300px;"></div>
            </div>
            
            <div class="chart-container">
                <h3>Mean Time to Restore</h3>
                <div id="chart-mttr" style="width: 100%; height: 300px;"></div>
            </div>
        </div>
        
        <hr class="divider">
        <h2>Four Keys レーダーチャート</h2>
        <div id="chart-radar" style="width: 100%; height: 500px;"></div>
        
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
            
            <h3>⚠️ 制約事項</h3>
            <ul>
                <li>PRデータのみから計算しているため、実際のデプロイプロセスやインシデント管理とは異なる場合があります</li>
                <li>より正確な測定には、CI/CDシステムやインシデント管理ツールとの連携が推奨されます</li>
                <li>Change Failure Rate と MTTR は推定値です。実際の環境に合わせてキーワードや計算ロジックの調整が必要な場合があります</li>
            </ul>
            
            <h3>📈 DORA レベルについて</h3>
            <p>各メトリクスは DORA (DevOps Research and Assessment) の基準に基づいて、Elite / High / Medium / Low の4段階で評価されます。</p>
            
            <h4>参考資料</h4>
            <ul>
                <li><a href="https://www.devops-research.com/research.html" target="_blank">DORA Research</a></li>
                <li><a href="https://github.com/GoogleCloudPlatform/fourkeys" target="_blank">Google Cloud - Four Keys Project</a></li>
                <li><a href="https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance" target="_blank">Four Keys の使い方</a></li>
            </ul>
        </div>
    `;
    
    // Create charts
    createDeploymentFrequencyChart();
    createLeadTimeChart();
    createFailureRateChart();
    createMTTRChart();
    createRadarChart();
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
        levelMap[metrics.mttr.classification.level]
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

// Initialize Four Keys page when navigated to
function initializeFourKeysPage() {
    loadFourKeysData();
}
