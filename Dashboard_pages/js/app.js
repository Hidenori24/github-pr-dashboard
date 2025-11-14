// Main Application Logic
let appData = {
    config: null,
    prs: [],
    issues: [],
    analytics: null,
    cacheInfo: null,
    primaryRepoIndex: 0
};

// Global loading state so pages can know data is still being fetched
let isDataLoading = false;

// Navigation history stack
let navigationHistory = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing GitHub PR Dashboard...');

    // Initialize theme
    initializeTheme();

    // Initialize i18n
    if (typeof i18n !== 'undefined') {
        i18n.init();
    }

    // Setup navigation
    setupNavigation();

    // Setup tab switching
    setupTabs();

    // Start loading data
    await loadAllData();

    // Initialize home page content (repository cards, etc.)
    initializeHomePage();

    // After data has finished loading, refresh the currently active page if it's not home
    refreshActivePageData();

    console.log('Dashboard initialized successfully');
});

// Toggle language between Japanese and English
function toggleLanguage() {
    if (typeof i18n !== 'undefined') {
        const newLang = i18n.currentLang === 'ja' ? 'en' : 'ja';
        i18n.setLanguage(newLang);
    }
}

// Toggle theme between light and dark mode
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
}

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

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
function navigateToPage(pageName, skipInit = false, addToHistory = true) {
    console.log('Navigating to:', pageName, 'skipInit:', skipInit, 'addToHistory:', addToHistory);
    
    // Get current page before navigating
    const currentPage = document.querySelector('.page.active')?.id.replace('page-', '');
    console.log('Current page:', currentPage, 'Target page:', pageName);
    
    // Add current page to history if it exists and addToHistory is true
    if (addToHistory && currentPage && currentPage !== pageName) {
        navigationHistory.push(currentPage);
        console.log('Added to history:', currentPage, 'Stack:', navigationHistory);
    } else {
        console.log('Not adding to history. Reason:', {addToHistory, currentPage, pageName, same: currentPage === pageName});
    }
    
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
        } else if (pageName === 'fourkeys') {
            if (typeof initializeFourKeysPage === 'function') {
                initializeFourKeysPage();
            }
        } else if (pageName === 'statistics') {
            if (typeof initStatisticsPage === 'function') {
                initStatisticsPage();
            }
        } else if (pageName === 'file-history') {
            if (typeof initializeFileHistoryPage === 'function') {
                initializeFileHistoryPage();
            }
        } else if (pageName === 'pr-detail') {
            // Skip initialization if skipInit is true
            if (!skipInit && typeof initializePRDetailPage === 'function') {
                initializePRDetailPage();
            }
        }
    }
    
    // Update back button visibility
    updateBackButton();
}

// Go back to previous page
function goBack() {
    console.log('🔙 goBack() called! History length:', navigationHistory.length, 'Stack:', navigationHistory);
    
    if (navigationHistory.length > 0) {
        const previousPage = navigationHistory.pop();
        console.log('🔙 Going back to:', previousPage, 'Remaining stack:', navigationHistory);
        
        // Clear PR detail session storage when going back
        sessionStorage.removeItem('pr_detail_owner');
        sessionStorage.removeItem('pr_detail_repo');
        sessionStorage.removeItem('pr_detail_number');
        
        navigateToPage(previousPage, false, false); // Don't add to history when going back
        
        // Scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    } else {
        console.log('🔙 No history to go back to!');
    }
}

// Update back button visibility
function updateBackButton() {
    const backButton = document.getElementById('back-button');
    if (backButton) {
        if (navigationHistory.length > 0) {
            backButton.style.display = 'flex';
        } else {
            backButton.style.display = 'none';
        }
    }
}

// Switch issues tab
function switchIssuesTab(tabName) {
    console.log('Switching to issues tab:', tabName);
    
    // Update active tab button
    const issuesPage = document.getElementById('page-issues');
    const tabButtons = issuesPage.querySelectorAll('.tab');
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Show corresponding tab pane
    const tabPanels = issuesPage.querySelectorAll('.tab-panel');
    tabPanels.forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetPane = issuesPage.querySelector(`#tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
        if (typeof loadIssuesTab === 'function') {
            loadIssuesTab(tabName);
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

// Helper function to safely fetch JSON data with timeout and retry
async function safeFetch(url, options = {}) {
    const timeout = options.timeout || 10000; // 10 second timeout
    const retries = options.retries || 1;
    
    for (let i = 0; i <= retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            if (i === retries) {
                throw error;
            }
            console.warn(`Fetch attempt ${i + 1} failed, retrying...`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
}

// IndexedDB Cache Utilities
const CACHE_DB_NAME = 'GitHubDashboardCache';
const CACHE_DB_VERSION = 1;
const CACHE_EXPIRY_HOURS = 24; // Cache expires after 24 hours

// Open IndexedDB database
async function openCacheDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('cache')) {
                const store = db.createObjectStore('cache', { keyPath: 'key' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Set data in cache with timestamp
async function setCache(key, data) {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');

        const cacheEntry = {
            key: key,
            data: data,
            timestamp: Date.now()
        };

        await new Promise((resolve, reject) => {
            const request = store.put(cacheEntry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        console.log(`[Cache] Saved ${key} to IndexedDB`);
    } catch (error) {
        console.warn(`[Cache] Failed to save ${key}:`, error);
    }
}

// Get data from cache if valid
async function getCache(key) {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction(['cache'], 'readonly');
        const store = transaction.objectStore('cache');

        const cacheEntry = await new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!cacheEntry) {
            console.log(`[Cache] No cache found for ${key}`);
            return null;
        }

        // Check if cache is expired
        const ageHours = (Date.now() - cacheEntry.timestamp) / (1000 * 60 * 60);
        if (ageHours > CACHE_EXPIRY_HOURS) {
            console.log(`[Cache] Cache expired for ${key} (${ageHours.toFixed(1)} hours old)`);
            // Remove expired cache
            const deleteTransaction = db.transaction(['cache'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('cache');
            deleteStore.delete(key);
            return null;
        }

        console.log(`[Cache] Loaded ${key} from IndexedDB (${ageHours.toFixed(1)} hours old)`);
        return cacheEntry.data;
    } catch (error) {
        console.warn(`[Cache] Failed to load ${key}:`, error);
        return null;
    }
}

// Check if cache is valid (not expired)
async function isCacheValid(key) {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction(['cache'], 'readonly');
        const store = transaction.objectStore('cache');

        const cacheEntry = await new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!cacheEntry) return false;

        const ageHours = (Date.now() - cacheEntry.timestamp) / (1000 * 60 * 60);
        return ageHours <= CACHE_EXPIRY_HOURS;
    } catch (error) {
        console.warn(`[Cache] Failed to check validity for ${key}:`, error);
        return false;
    }
}

// Load all data from JSON files with caching
async function loadAllData() {
    isDataLoading = true;
    const loadingErrors = [];
    
    try {
        // Load configuration (always fetch fresh, cache for 24h)
        const configKey = 'config';
        try {
            const cachedConfig = await getCache(configKey);
            if (cachedConfig) {
                appData.config = cachedConfig;
                console.log('Config loaded from cache');
            } else {
                appData.config = await safeFetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.config}`, {
                    timeout: 5000,
                    retries: 2
                });
                await setCache(configKey, appData.config);
                console.log('Config loaded from API and cached');
            }
        } catch (error) {
            console.warn('Config file not found, using defaults:', error.message);
            appData.config = {
                repositories: CONFIG.repositories,
                primaryRepoIndex: CONFIG.primaryRepoIndex
            };
        }
        
        // Load PR data with caching
        const prsKey = 'prs';
        try {
            const cachedPRs = await getCache(prsKey);
            if (cachedPRs && cachedPRs.length > 0) {
                appData.prs = cachedPRs;
                console.log('PRs loaded from cache:', appData.prs.length);
            } else {
                appData.prs = await safeFetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.prs}`, {
                    timeout: 10000,
                    retries: 2
                });
                await setCache(prsKey, appData.prs);
                console.log('PRs loaded from API and cached:', appData.prs.length);
            }
            
            // Check if prs.json is empty and fall back to sample data
            if (!appData.prs || appData.prs.length === 0) {
                console.warn('PR data is empty, trying sample data');
                const sampleKey = 'sample_prs';
                const cachedSample = await getCache(sampleKey);
                if (cachedSample && cachedSample.length > 0) {
                    appData.prs = cachedSample;
                    console.log('Sample PRs loaded from cache:', appData.prs.length);
                } else {
                    try {
                        appData.prs = await safeFetch(`${CONFIG.dataSource.basePath}sample_prs.json`, {
                            timeout: 5000,
                            retries: 1
                        });
                        await setCache(sampleKey, appData.prs);
                        console.log('Sample PRs loaded from API and cached:', appData.prs.length);
                        showWarning(typeof i18n !== 'undefined' ? 
                            'Using sample data. GitHub Actions may not have generated real data yet.' :
                            'サンプルデータを使用しています。GitHub Actionsがまだ実データを生成していない可能性があります。');
                    } catch (e) {
                        console.warn('Sample data also not found:', e.message);
                        appData.prs = [];
                        loadingErrors.push('PR data');
                    }
                }
            }
        } catch (error) {
            console.warn('PR data not found, trying sample data:', error.message);
            // Try to load sample data as fallback
            const sampleKey = 'sample_prs';
            const cachedSample = await getCache(sampleKey);
            if (cachedSample && cachedSample.length > 0) {
                appData.prs = cachedSample;
                console.log('Sample PRs loaded from cache:', appData.prs.length);
            } else {
                try {
                    appData.prs = await safeFetch(`${CONFIG.dataSource.basePath}sample_prs.json`, {
                        timeout: 5000,
                        retries: 1
                    });
                    await setCache(sampleKey, appData.prs);
                    console.log('Sample PRs loaded from API and cached:', appData.prs.length);
                    showWarning(typeof i18n !== 'undefined' ? 
                        'Using sample data. GitHub Actions may not have generated real data yet.' :
                        'サンプルデータを使用しています。GitHub Actionsがまだ実データを生成していない可能性があります。');
                } catch (e) {
                    console.warn('Sample data also not found:', e.message);
                    appData.prs = [];
                    loadingErrors.push('PR data');
                }
            }
        }
        
        // Load analytics data (optional) with caching
        const analyticsKey = 'analytics';
        try {
            const cachedAnalytics = await getCache(analyticsKey);
            if (cachedAnalytics) {
                appData.analytics = cachedAnalytics;
                console.log('Analytics loaded from cache');
            } else {
                appData.analytics = await safeFetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.analytics}`, {
                    timeout: 5000,
                    retries: 1
                });
                await setCache(analyticsKey, appData.analytics);
                console.log('Analytics loaded from API and cached');
            }
        } catch (error) {
            console.warn('Analytics data not found:', error.message);
            appData.analytics = null;
        }
        
        // Load cache info (optional) with caching
        const cacheInfoKey = 'cache_info';
        try {
            const cachedCacheInfo = await getCache(cacheInfoKey);
            if (cachedCacheInfo) {
                appData.cacheInfo = cachedCacheInfo;
                console.log('Cache info loaded from cache');
            } else {
                appData.cacheInfo = await safeFetch(`${CONFIG.dataSource.basePath}${CONFIG.dataSource.files.cache_info}`, {
                    timeout: 5000,
                    retries: 1
                });
                await setCache(cacheInfoKey, appData.cacheInfo);
                console.log('Cache info loaded from API and cached');
            }
        } catch (error) {
            console.warn('Cache info not found:', error.message);
            appData.cacheInfo = null;
        }
        
        // Load issues data (optional) with caching
        const issuesKey = 'issues';
        try {
            const cachedIssues = await getCache(issuesKey);
            if (cachedIssues) {
                appData.issues = cachedIssues;
                console.log('Issues loaded from cache:', appData.issues.length);
            } else {
                appData.issues = await safeFetch(`${CONFIG.dataSource.basePath}issues.json`, {
                    timeout: 10000,
                    retries: 2
                });
                await setCache(issuesKey, appData.issues);
                console.log('Issues loaded from API and cached:', appData.issues.length);
            }
        } catch (error) {
            console.warn('Issues data not found:', error.message);
            appData.issues = [];
        }
        
        // Load statistics data (optional) with caching
        const statisticsKey = 'statistics';
        try {
            const cachedStatistics = await getCache(statisticsKey);
            if (cachedStatistics) {
                appData.statistics = cachedStatistics;
                console.log('Statistics loaded from cache');
            } else {
                appData.statistics = await safeFetch(`${CONFIG.dataSource.basePath}statistics.json`, {
                    timeout: 5000,
                    retries: 1
                });
                await setCache(statisticsKey, appData.statistics);
                console.log('Statistics loaded from API and cached');
            }
        } catch (error) {
            console.warn('Statistics data not found:', error.message);
            appData.statistics = null;
        }
        
        // Load fourkeys data (optional) with caching
        const fourkeysKey = 'fourkeys';
        try {
            const cachedFourkeys = await getCache(fourkeysKey);
            if (cachedFourkeys) {
                appData.fourkeys = cachedFourkeys;
                console.log('Four Keys loaded from cache');
            } else {
                appData.fourkeys = await safeFetch(`${CONFIG.dataSource.basePath}fourkeys.json`, {
                    timeout: 5000,
                    retries: 1
                });
                await setCache(fourkeysKey, appData.fourkeys);
                console.log('Four Keys loaded from API and cached');
            }
        } catch (error) {
            console.warn('Four Keys data not found:', error.message);
            appData.fourkeys = null;
        }
        
        // Show summary of loading issues if any
        if (loadingErrors.length > 0) {
            const errorMsg = typeof i18n !== 'undefined' ? 
                i18n.t('error.data_load') : 
                'データの読み込みに失敗しました。GitHub Actionsが正常に実行されているか確認してください。';
            showError(`${errorMsg}\nMissing: ${loadingErrors.join(', ')}`);
        }
    } catch (error) {
        console.error('Critical error loading data:', error);
        const errorMsg = typeof i18n !== 'undefined' ? i18n.t('error.data_load') : 'データの読み込みに失敗しました。GitHub Actionsが正常に実行されているか確認してください。';
        showError(errorMsg);
    } finally {
        isDataLoading = false;
        // Enrich loaded PR data with derived review arrays if missing (for analytics parity)
        try {
            enrichPRData();
        } catch (e) {
            console.warn('[App] enrichPRData failed:', e);
        }
    }
}

// Refresh data for whichever page is currently active (excluding home)
function refreshActivePageData() {
    const activePageEl = document.querySelector('.page.active');
    if (!activePageEl) return;
    const pageId = activePageEl.id.replace('page-', '');
    if (pageId === 'home') return; // nothing to refresh

    console.log('[App] Refreshing active page after data load:', pageId);
    switch (pageId) {
        case 'dashboard':
            if (typeof loadDashboardData === 'function') loadDashboardData();
            break;
        case 'analytics':
            if (typeof loadAnalyticsData === 'function') loadAnalyticsData();
            break;
        case 'fourkeys':
            if (typeof initializeFourKeysPage === 'function') initializeFourKeysPage();
            break;
        case 'statistics':
            if (typeof initStatisticsPage === 'function') initStatisticsPage();
            break;
        case 'issues':
            if (typeof loadIssuesData === 'function') loadIssuesData();
            break;
    }
}

// Initialize home page
function initializeHomePage() {
    // Display cache status
    displayCacheStatus();
    
    // Populate global repository filter
    populateGlobalRepoFilter();
}

// Update primary repository info in sidebar
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
    const errorTitle = typeof i18n !== 'undefined' ? i18n.t('error') : 'エラー';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'status-banner warning';
    errorDiv.innerHTML = `
        <span>⚠️</span>
        <div>
            <strong>${errorTitle}</strong>
            <p>${message}</p>
        </div>
    `;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(errorDiv, mainContent.firstChild);
}

function showWarning(message) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'status-banner info';
    warningDiv.innerHTML = `
        <span>ℹ️</span>
        <div>
            <p>${message}</p>
        </div>
    `;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(warningDiv, mainContent.firstChild);
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

// Handle global repository filter change
function handleGlobalRepoFilterChange() {
    const globalFilter = document.getElementById('globalRepoFilter');
    if (!globalFilter) return;
    
    const selectedRepo = globalFilter.value;
    console.log('Global filter changed to:', selectedRepo || 'All repositories');
    
    // Save to localStorage
    if (selectedRepo) {
        localStorage.setItem('globalRepoFilter', selectedRepo);
    } else {
        localStorage.removeItem('globalRepoFilter');
    }
    
    // Show visual feedback
    showFilterChangeIndicator();
    
    // Update global repo info display
    updateGlobalRepoInfo(selectedRepo);
    
    // Sync with page-specific filters
    syncRepoFilters(selectedRepo);
    
    // Reload current page data
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    
    const pageId = activePage.id.replace('page-', '');
    console.log('Reloading data for page:', pageId);
    
    switch (pageId) {
        case 'fourkeys':
            if (typeof loadFourKeysData === 'function') loadFourKeysData();
            break;
        case 'analytics':
            if (typeof loadAnalyticsData === 'function') loadAnalyticsData();
            break;
        case 'statistics':
            if (typeof initStatisticsPage === 'function') initStatisticsPage();
            break;
        case 'dashboard':
            if (typeof loadDashboardData === 'function') loadDashboardData();
            break;
        case 'issues':
            if (typeof loadIssuesOverview === 'function') {
                // Reload the currently active issues tab
                const activeTab = document.querySelector('.issues-tab.active');
                if (activeTab) {
                    const tabName = activeTab.dataset.tab;
                    document.querySelectorAll('.issues-tab-content').forEach(tab => tab.classList.remove('active'));
                    document.getElementById(`issues-${tabName}`).classList.add('active');
                    
                    switch(tabName) {
                        case 'overview': loadIssuesOverview(); break;
                        case 'timeline': loadIssuesTimeline(); break;
                        case 'cycletime': loadCycleTimeAnalysis(); break;
                        case 'linking': loadIssuePRLinking(); break;
                        case 'milestone': loadMilestoneTracking(); break;
                        case 'velocity': loadTeamVelocity(); break;
                    }
                } else {
                    loadIssuesOverview(); // Default to overview
                }
            }
            break;
        case 'file-history':
            if (typeof initializeFileHistoryPage === 'function') {
                initializeFileHistoryPage();
            }
            break;
    }
}

// Update global repository info display (Always visible, updates repo name)
function updateGlobalRepoInfo(selectedRepo) {
    const globalRepoInfo = document.getElementById('globalRepoInfo');
    const globalRepoName = document.getElementById('globalRepoName');
    
    if (!globalRepoInfo || !globalRepoName) return;
    
    if (selectedRepo) {
        // Find repository name from config
        const repo = appData.config?.repositories?.find(r => `${r.owner}/${r.repo}` === selectedRepo);
        const displayName = repo ? repo.name : selectedRepo;
        
        globalRepoName.textContent = displayName;
        globalRepoInfo.classList.add('active-filter');
    } else {
        globalRepoName.textContent = 'すべてのリポジトリ';
        globalRepoInfo.classList.remove('active-filter');
    }
}

// Sync all page-specific repo filters with global filter (now deprecated - only global filter exists)
function syncRepoFilters(selectedValue) {
    // This function is kept for compatibility but no longer needed
    // All pages now use globalRepoFilter directly
    console.log('[syncRepoFilters] Deprecated - all pages use globalRepoFilter');
}

// Populate global repository filter
function populateGlobalRepoFilter() {
    const globalFilter = document.getElementById('globalRepoFilter');
    if (!globalFilter || !appData.config || !appData.config.repositories) return;
    
    const options = ['<option value="">すべてのリポジトリ</option>'];
    appData.config.repositories.forEach((repo, idx) => {
        options.push(`<option value="${repo.owner}/${repo.repo}">${repo.name}</option>`);
    });
    globalFilter.innerHTML = options.join('');

    // Restore from localStorage if exists
    const savedFilter = localStorage.getItem('globalRepoFilter');
    if (savedFilter) {
        globalFilter.value = savedFilter;
        updateGlobalRepoInfo(savedFilter);
        console.log('Restored repository filter from localStorage:', savedFilter);
    } else {
        // 初期選択をプライマリーレポジトリへ設定
        const primaryIndex = appData.config.primaryRepoIndex || 0;
        const primaryRepo = appData.config.repositories[primaryIndex];
        if (primaryRepo) {
            const value = `${primaryRepo.owner}/${primaryRepo.repo}`;
            globalFilter.value = value;
            localStorage.setItem('globalRepoFilter', value);
            updateGlobalRepoInfo(value);
        }
    }
}

// Show visual feedback when filter changes
function showFilterChangeIndicator() {
    // Add a brief highlight animation to the filter
    const globalFilter = document.getElementById('globalRepoFilter');
    if (!globalFilter) return;
    
    // Add flash class
    globalFilter.style.transition = 'box-shadow 0.3s ease';
    globalFilter.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
    
    setTimeout(() => {
        globalFilter.style.boxShadow = '';
    }, 300);
    
    // Show a subtle loading indicator on the active page
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        activePage.style.opacity = '0.6';
        setTimeout(() => {
            activePage.style.opacity = '1';
        }, 200);
    }
}

// Navigate to PR detail page
function navigateToPRDetail(owner, repo, prNumber) {
    console.log(`Navigating to PR detail: ${owner}/${repo}#${prNumber}`);
    
    // Store PR info in session storage (as backup)
    sessionStorage.setItem('pr_detail_owner', owner);
    sessionStorage.setItem('pr_detail_repo', repo);
    sessionStorage.setItem('pr_detail_number', prNumber);
    
    // Navigate to PR detail page, skip initialization
    navigateToPage('pr-detail', true);
    
    // Immediately load the PR detail with the correct parameters
    if (typeof loadPRDetail === 'function') {
        loadPRDetail(owner, repo, prNumber);
    }
    
    // Scroll to top of page
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Export functions for use in other modules
window.navigateToPage = navigateToPage;
window.navigateToPRDetail = navigateToPRDetail;
window.goBack = goBack;
window.selectRepository = selectRepository;
window.handleGlobalRepoFilterChange = handleGlobalRepoFilterChange;
window.refreshActivePageData = refreshActivePageData;

// Add derived fields similar to Streamlit preprocessing (reviews array, reviewThreads, etc.)
function enrichPRData() {
    if (!appData.prs || appData.prs.length === 0) return;
    const now = new Date();
    appData.prs.forEach(pr => {
        // Normalize reviews array from review_details
        if (!pr.reviews && pr.review_details) {
            pr.reviews = pr.review_details.map(r => ({
                author: r.author,
                state: r.state,
                createdAt: r.createdAt
            }));
        }
        // Backfill counts for uniform access
        pr.reviews_count = typeof pr.reviews_count === 'number' ? pr.reviews_count : (pr.reviews ? pr.reviews.length : 0);
        pr.comments = typeof pr.comments_count === 'number' ? pr.comments_count : pr.comments_count || 0;
        pr.changedFiles = pr.changedFiles || 0;
        pr.reviewThreads = pr.review_threads || pr.unresolved_threads || 0;

        // Age hours (終了済みは終了時点、OPENは現在時刻まで)
        const endRef = pr.mergedAt ? new Date(pr.mergedAt) : (pr.closedAt ? new Date(pr.closedAt) : now);
        const createdDt = pr.createdAt ? new Date(pr.createdAt) : now;
        pr.age_hours = Math.max(0, (endRef - createdDt) / (1000 * 60 * 60));

        // Business hours/days (utilの高精度計算を優先。フェールバックに簡易版)
        try {
            if (typeof window.calculateBusinessHours === 'function') {
                const bh = window.calculateBusinessHours(pr.createdAt, endRef);
                pr.business_hours = bh.business_hours;
                pr.business_days = bh.business_days;
            } else {
                // 簡易週末除外近似 (5/7)
                pr.business_hours = pr.age_hours * (5/7);
                pr.business_days = pr.business_hours / 24;
            }
        } catch (e) {
            console.warn('[enrichPRData] business hour calc failed', e);
            pr.business_hours = pr.age_hours * (5/7);
            pr.business_days = pr.business_hours / 24;
        }
    });
    console.log('[App] PR data enriched for front-end analytics');
}
