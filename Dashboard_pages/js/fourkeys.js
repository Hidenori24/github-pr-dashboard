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
    
    // Hide dev banner with fade animation
    const devBanner = document.getElementById('fourkeys-dev-banner');
    if (devBanner) {
        devBanner.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        devBanner.style.opacity = '0';
        devBanner.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            devBanner.style.display = 'none';
        }, 500);
    }
    
    // Update metric cards with animation
    setTimeout(() => {
        updateMetricCard('deployment-frequency', fourkeysData.metrics.deploymentFrequency);
        updateMetricCard('lead-time', fourkeysData.metrics.leadTime);
        updateMetricCard('change-failure-rate', fourkeysData.metrics.changeFailureRate);
        updateMetricCard('mttr', fourkeysData.metrics.mttr);
    }, 100);
    
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
    
    // Update card appearance with gradient
    card.style.borderTop = `4px solid ${classification.color}`;
    
    const valueElement = card.querySelector('.metric-value');
    const unitElement = card.querySelector('.metric-unit');
    
    if (valueElement) {
        valueElement.classList.remove('loading');
        valueElement.style.color = classification.color;
        
        if (unit === 'percent') {
            valueElement.textContent = value.toFixed(1);
            if (unitElement) unitElement.textContent = '%';
        } else if (unit === 'per week') {
            valueElement.textContent = value.toFixed(1);
            if (unitElement) unitElement.textContent = '/週';
        } else if (unit === 'days') {
            valueElement.textContent = value.toFixed(1);
            if (unitElement) unitElement.textContent = '日';
        } else if (unit === 'hours') {
            valueElement.textContent = value.toFixed(1);
            if (unitElement) unitElement.textContent = '時間';
        } else {
            valueElement.textContent = value.toFixed(1);
            if (unitElement) unitElement.textContent = '';
        }
    }
    
    // Add/update DORA level badge
    let badgeElement = card.querySelector('.metric-badge');
    if (!badgeElement) {
        badgeElement = document.createElement('div');
        badgeElement.className = 'metric-badge';
        card.querySelector('.metric-card-body').appendChild(badgeElement);
    }
    
    badgeElement.style.background = `${classification.color}22`;
    badgeElement.style.color = classification.color;
    badgeElement.style.border = `2px solid ${classification.color}`;
    badgeElement.textContent = `DORA Level: ${classification.level}`;
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
        
        const metricsGrid = document.querySelector('.metrics-grid');
        if (metricsGrid) {
            metricsGrid.after(chartsContainer);
        }
    }
    
    chartsContainer.innerHTML = `
        <hr class="divider">
        <h2>📊 時系列チャート - 4指標の推移</h2>
        <p class="chart-description">各指標の時間的な推移を一目で確認できます</p>
        
        <div class="charts-grid-2x2">
            <div class="chart-container">
                <h3>📦 Deployment Frequency</h3>
                <div id="chart-deployment-frequency" style="width: 100%; height: 280px;"></div>
            </div>
            
            <div class="chart-container">
                <h3>⏱️ Lead Time for Changes</h3>
                <div id="chart-lead-time" style="width: 100%; height: 280px;"></div>
            </div>
            
            <div class="chart-container">
                <h3>❌ Change Failure Rate</h3>
                <div id="chart-failure-rate" style="width: 100%; height: 280px;"></div>
            </div>
            
            <div class="chart-container">
                <h3>🔧 Mean Time to Restore</h3>
                <div id="chart-mttr" style="width: 100%; height: 280px;"></div>
            </div>
        </div>
        
        <hr class="divider">
        <h2>🔍 詳細分析 - 各指標の深掘り</h2>
        <p class="chart-description">タブを切り替えて、各指標の詳細な分析をご覧ください</p>
        
        <div class="tabs">
            <button class="tab-btn active" data-tab="deployment">📦 Deployment Frequency</button>
            <button class="tab-btn" data-tab="leadtime">⏱️ Lead Time</button>
            <button class="tab-btn" data-tab="failure">❌ Failure Rate</button>
            <button class="tab-btn" data-tab="mttr">🔧 MTTR</button>
        </div>
        
        <div class="tab-content">
            <div id="tab-deployment" class="tab-pane active">
                <h3>Deployment Frequency - デプロイ頻度の詳細</h3>
                <div id="chart-deployment-detail" style="width: 100%; height: 400px;"></div>
                <div class="metric-stats">
                    <div class="stat-card">
                        <div class="stat-label">週平均</div>
                        <div class="stat-value">${fourkeysData.metrics.deploymentFrequency.value.toFixed(1)} 回/週</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">総デプロイ数</div>
                        <div class="stat-value">${fourkeysData.metrics.deploymentFrequency.totalDeployments} 件</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">計測期間</div>
                        <div class="stat-value">${fourkeysData.metrics.deploymentFrequency.weeks} 週</div>
                    </div>
                </div>
            </div>
            
            <div id="tab-leadtime" class="tab-pane">
                <h3>Lead Time for Changes - リードタイムの詳細</h3>
                <div id="chart-leadtime-detail" style="width: 100%; height: 400px;"></div>
                <div class="metric-stats">
                    <div class="stat-card">
                        <div class="stat-label">中央値</div>
                        <div class="stat-value">${fourkeysData.metrics.leadTime.median.toFixed(1)} 日</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">平均値</div>
                        <div class="stat-value">${fourkeysData.metrics.leadTime.average.toFixed(1)} 日</div>
                    </div>
                </div>
            </div>
            
            <div id="tab-failure" class="tab-pane">
                <h3>Change Failure Rate - 失敗率の詳細</h3>
                <div id="chart-failure-detail" style="width: 100%; height: 400px;"></div>
                <div class="metric-stats">
                    <div class="stat-card">
                        <div class="stat-label">失敗率</div>
                        <div class="stat-value">${fourkeysData.metrics.changeFailureRate.value.toFixed(1)}%</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">失敗PR</div>
                        <div class="stat-value">${fourkeysData.metrics.changeFailureRate.failures} 件</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">総PR数</div>
                        <div class="stat-value">${fourkeysData.metrics.changeFailureRate.total} 件</div>
                    </div>
                </div>
            </div>
            
            <div id="tab-mttr" class="tab-pane">
                <h3>Mean Time to Restore - 復旧時間の詳細</h3>
                <div id="chart-mttr-detail" style="width: 100%; height: 400px;"></div>
                <div class="metric-stats">
                    <div class="stat-card">
                        <div class="stat-label">中央値</div>
                        <div class="stat-value">${fourkeysData.metrics.mttr.median.toFixed(1)} 時間</div>
                    </div>
                </div>
            </div>
        </div>
        
        <hr class="divider">
        <h2>📈 Four Keys レーダーチャート</h2>
        <p class="chart-description">4指標のバランスを視覚的に把握</p>
        <div id="chart-radar" style="width: 100%; height: 500px;"></div>
        
        <hr class="divider">
        <h2>📖 計測方法について</h2>
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
    
    // Setup tab switching
    setupTabSwitching();
    
    // Create overview charts (2x2 grid)
    createDeploymentFrequencyChart();
    createLeadTimeChart();
    createFailureRateChart();
    createMTTRChart();
    
    // Create detailed charts for tabs
    createDeploymentDetailChart();
    createLeadTimeDetailChart();
    createFailureDetailChart();
    createMTTRDetailChart();
    
    // Create radar chart
    createRadarChart();
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

// Initialize Four Keys page when navigated to
function initializeFourKeysPage() {
    loadFourKeysData();
}
