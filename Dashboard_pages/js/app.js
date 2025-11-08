// Main Application Logic
let appData = {
    config: null,
    prs: [],
    analytics: null,
    cacheInfo: null,
    primaryRepoIndex: 0
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing GitHub PR Dashboard...');
    
    // Setup navigation
    setupNavigation();
    
    // Setup tab switching
    setupTabs();
    
    // Load data
    await loadAllData();
    
    // Initialize home page
    initializeHomePage();
    
    console.log('Dashboard initialized successfully');
});

// Setup navigation between pages
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });
}

// Navigate to a specific page
function navigateToPage(pageName) {
    console.log('Navigating to:', pageName);
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });
    
    // Show the selected page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load page-specific data
        if (pageName === 'dashboard') {
            loadDashboardData();
        } else if (pageName === 'analytics') {
            loadAnalyticsData();
        }
    }
}

// Setup tab switching for analytics page
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show corresponding tab pane
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            const targetPane = document.getElementById(`tab-${tabName}`);
            if (targetPane) {
                targetPane.classList.add('active');
                loadTabData(tabName);
            }
        });
    });
}

// Load all data from JSON files
async function loadAllData() {
    try {
        // Load configuration
        const configResponse = await fetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.config}`);
        if (configResponse.ok) {
            appData.config = await configResponse.json();
            console.log('Config loaded:', appData.config);
        } else {
            console.warn('Config file not found, using defaults');
            appData.config = {
                repositories: CONFIG.repositories,
                primaryRepoIndex: CONFIG.primaryRepoIndex
            };
        }
        
        // Load PR data
        const prsResponse = await fetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.prs}`);
        if (prsResponse.ok) {
            appData.prs = await prsResponse.json();
            console.log('PRs loaded:', appData.prs.length);
        } else {
            console.warn('PR data not found, trying sample data');
            // Try to load sample data as fallback
            try {
                const sampleResponse = await fetch(`${CONFIG.dataSource.basePath}sample_prs.json`);
                if (sampleResponse.ok) {
                    appData.prs = await sampleResponse.json();
                    console.log('Sample PRs loaded:', appData.prs.length);
                } else {
                    appData.prs = [];
                }
            } catch (e) {
                console.warn('Sample data also not found');
                appData.prs = [];
            }
        }
        
        // Load analytics data
        const analyticsResponse = await fetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.analytics}`);
        if (analyticsResponse.ok) {
            appData.analytics = await analyticsResponse.json();
            console.log('Analytics loaded');
        }
        
        // Load cache info
        const cacheResponse = await fetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.cache_info}`);
        if (cacheResponse.ok) {
            appData.cacheInfo = await cacheResponse.json();
            console.log('Cache info loaded');
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('データの読み込みに失敗しました。GitHub Actionsが正常に実行されているか確認してください。');
    }
}

// Initialize home page
function initializeHomePage() {
    // Update primary repo info in sidebar
    updatePrimaryRepoInfo();
    
    // Display repository list
    displayRepositoryList();
    
    // Display cache status
    displayCacheStatus();
}

// Update primary repository info in sidebar
function updatePrimaryRepoInfo() {
    const primaryRepoInfo = document.getElementById('primaryRepoInfo');
    
    if (appData.config && appData.config.repositories && appData.config.repositories.length > 0) {
        const primaryIndex = appData.config.primaryRepoIndex || 0;
        const primaryRepo = appData.config.repositories[primaryIndex];
        
        primaryRepoInfo.innerHTML = `
            <strong>${primaryRepo.name}</strong>
            <code>${primaryRepo.owner}/${primaryRepo.repo}</code>
        `;
    } else {
        primaryRepoInfo.innerHTML = '<div class="loading">設定なし</div>';
    }
}

// Display repository list on home page
function displayRepositoryList() {
    const repoList = document.getElementById('repoList');
    
    if (!appData.config || !appData.config.repositories || appData.config.repositories.length === 0) {
        repoList.innerHTML = `
            <div class="card">
                <p>リポジトリが設定されていません。</p>
                <p>設定方法については <a href="#setup">セットアップガイド</a> を参照してください。</p>
            </div>
        `;
        return;
    }
    
    const repositories = appData.config.repositories;
    const primaryIndex = appData.config.primaryRepoIndex || 0;
    
    repoList.innerHTML = repositories.map((repo, index) => {
        const isSelected = index === primaryIndex;
        const selectedClass = isSelected ? 'selected' : '';
        const badge = isSelected ? '<div class="badge">プライマリー</div>' : '';
        
        return `
            <div class="repo-card ${selectedClass}" data-index="${index}" onclick="selectRepository(${index})">
                <h4>${repo.name}</h4>
                <code>${repo.owner}/${repo.repo}</code>
                ${badge}
            </div>
        `;
    }).join('');
    
    // Display selected repo info
    displaySelectedRepoInfo(primaryIndex);
}

// Select a repository
function selectRepository(index) {
    appData.config.primaryRepoIndex = index;
    appData.primaryRepoIndex = index;
    
    // Update display
    displayRepositoryList();
    updatePrimaryRepoInfo();
}

// Display selected repository info
function displaySelectedRepoInfo(index) {
    const selectedRepoInfo = document.getElementById('selectedRepoInfo');
    const repo = appData.config.repositories[index];
    
    selectedRepoInfo.innerHTML = `
        <strong>プライマリー:</strong> <strong>${repo.name}</strong> (<code>${repo.owner}/${repo.repo}</code>)
    `;
}

// Display cache status
function displayCacheStatus() {
    const cacheStatus = document.getElementById('cacheStatus');
    
    if (!appData.cacheInfo) {
        cacheStatus.innerHTML = `
            <div class="status-banner info">
                <span>ℹ️</span>
                <div>
                    <strong>キャッシュ情報なし</strong>
                    <p>GitHub Actionsを実行してデータを取得してください。</p>
                </div>
            </div>
        `;
        return;
    }
    
    const info = appData.cacheInfo;
    const lastUpdate = new Date(info.lastUpdate);
    const now = new Date();
    const ageHours = (now - lastUpdate) / (1000 * 60 * 60);
    
    let statusClass = 'success';
    let statusIcon = '✅';
    let statusTitle = 'データは最新';
    let statusMessage = `最終更新: ${lastUpdate.toLocaleString('ja-JP')} (${ageHours.toFixed(1)}時間前)`;
    
    if (ageHours > 24) {
        statusClass = 'warning';
        statusIcon = '⚠️';
        statusTitle = 'データが古い可能性があります';
        statusMessage = `最終更新: ${lastUpdate.toLocaleString('ja-JP')} (${ageHours.toFixed(1)}時間前)`;
    }
    
    cacheStatus.innerHTML = `
        <div class="status-banner ${statusClass}">
            <span>${statusIcon}</span>
            <div>
                <strong>${statusTitle}</strong>
                <p>${statusMessage}</p>
                <p>PRデータ数: ${info.totalPRs || appData.prs.length} 件</p>
            </div>
        </div>
    `;
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'status-banner warning';
    errorDiv.innerHTML = `
        <span>⚠️</span>
        <div>
            <strong>エラー</strong>
            <p>${message}</p>
        </div>
    `;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(errorDiv, mainContent.firstChild);
}

// Utility: Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Utility: Calculate business hours
function calculateBusinessHours(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Simple implementation - can be enhanced
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Rough approximation: exclude weekends (5/7 of total time)
    return diffHours * (5 / 7);
}

// Utility: Filter PRs by criteria
function filterPRs(prs, criteria) {
    return prs.filter(pr => {
        // Filter by repository
        if (criteria.owner && pr.owner !== criteria.owner) return false;
        if (criteria.repo && pr.repo !== criteria.repo) return false;
        
        // Filter by state
        if (criteria.states && criteria.states.length > 0) {
            if (!criteria.states.includes(pr.state)) return false;
        }
        
        // Filter by date range
        if (criteria.days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - criteria.days);
            const prDate = new Date(pr.createdAt);
            if (prDate < cutoffDate) return false;
        }
        
        return true;
    });
}

// Export functions for use in other modules
window.navigateToPage = navigateToPage;
window.selectRepository = selectRepository;
