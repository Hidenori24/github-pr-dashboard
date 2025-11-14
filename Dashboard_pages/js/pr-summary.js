// pr-summary.js - PR詳細サマリページ

// Global variables
let currentPR = null;
let currentTab = 'review';

// Initialize PR summary page
function initPRSummaryPage() {
    console.log('Initializing PR summary page...');
    loadPRList();
    setupEventListeners();
}

// Load PR list for selector
async function loadPRList() {
    if (!appData || !appData.prs) {
        console.error('No PR data available');
        return;
    }

    const prSelector = document.getElementById('prSelector');
    if (!prSelector) return;

    // Clear existing options except the first one
    prSelector.innerHTML = '<option value="">PRを選択してください...</option>';

    // Filter to OPEN PRs and sort by creation date (newest first)
    const openPRs = appData.prs
        .filter(pr => pr.state === 'OPEN')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    openPRs.forEach(pr => {
        const option = document.createElement('option');
        option.value = pr.number;
        option.textContent = `#${pr.number} - ${pr.title.substring(0, 60)}${pr.title.length > 60 ? '...' : ''}`;
        prSelector.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // PR selector change is handled by onchange attribute
}

// Handle PR selection
function onPRSelected() {
    const prSelector = document.getElementById('prSelector');
    const selectedPRNumber = prSelector.value;

    if (!selectedPRNumber) {
        hidePRDetail();
        return;
    }

    // Find the selected PR
    currentPR = appData.prs.find(pr => pr.number == selectedPRNumber);
    if (!currentPR) {
        console.error('PR not found:', selectedPRNumber);
        return;
    }

    displayPRDetail(currentPR);
}

// Display PR detail
function displayPRDetail(pr) {
    // Show detail container, hide empty state
    document.getElementById('prDetailContainer').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';

    // Update PR header
    document.getElementById('prTitle').textContent = `#${pr.number} - ${pr.title}`;
    document.getElementById('prAuthor').textContent = `作成者: ${pr.author || '不明'}`;

    const createdDate = new Date(pr.createdAt);
    document.getElementById('prCreatedAt').textContent = `作成日: ${formatDate(createdDate)} ${createdDate.toLocaleTimeString('ja-JP')}`;

    // Update GitHub link
    const githubLink = document.getElementById('githubLink');
    githubLink.onclick = () => window.open(pr.url, '_blank');

    // Display action owner info
    displayActionOwnerInfo(pr);

    // Update metrics
    updatePRMetrics(pr);

    // Display current tab content
    displayTabContent(currentTab, pr);
}

// Display action owner information
function displayActionOwnerInfo(pr) {
    const container = document.getElementById('actionOwnerInfo');
    if (!container) return;

    if (pr.state !== 'OPEN') {
        container.innerHTML = '';
        return;
    }

    const actionInfo = ActionTracker.determineActionOwner(pr);

    if (actionInfo.action === 'none') {
        container.innerHTML = '';
        return;
    }

    const waitingFor = actionInfo.waiting_for.join(', ') || '不明';

    let bgColor = '#e0e7ff';
    let borderColor = '#6366f1';
    let icon = 'ℹ️';
    let textColor = '#1e3a8a';

    switch (actionInfo.action) {
        case 'author':
            bgColor = '#dbeafe';
            borderColor = '#3b82f6';
            icon = '🔄';
            textColor = '#1e40af';
            break;
        case 'reviewers':
            bgColor = '#fef3c7';
            borderColor = '#f59e0b';
            icon = '👀';
            textColor = '#92400e';
            break;
        case 'ready_to_merge':
            bgColor = '#d1fae5';
            borderColor = '#10b981';
            icon = '✅';
            textColor = '#065f46';
            break;
    }

    container.innerHTML = `
        <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${textColor};">
                <span style="font-size: 1.5rem;">${icon}</span>
                <strong style="font-size: 1.1rem;">アクションすべき人:</strong>
                <span style="font-size: 1rem;">${waitingFor}</span>
                <span style="margin-left: 0.5rem; opacity: 0.8;">- ${actionInfo.reason}</span>
            </div>
        </div>
    `;
}

// Update PR metrics
function updatePRMetrics(pr) {
    // Comments count
    document.getElementById('commentsCount').textContent = pr.comments_count || 0;

    // Reviews count
    const reviewCount = (pr.requested_reviewers || 0) + (pr.changes_requested || 0);
    document.getElementById('reviewsCount').textContent = reviewCount;

    // Age in days
    const ageHours = pr.age_hours || 0;
    const ageDays = ageHours / 24;
    document.getElementById('ageDays').textContent = `${ageDays.toFixed(1)}日`;

    // Code changes
    const additions = pr.additions || 0;
    const deletions = pr.deletions || 0;
    document.getElementById('codeChanges').textContent = `+${additions} -${deletions}`;

    // Business days (simplified calculation)
    const businessDays = ageHours / 24; // Placeholder - should implement proper business days calculation
    document.getElementById('businessDays').textContent = `${businessDays.toFixed(1)}日`;
}

// Switch tab
function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Display tab content
    if (currentPR) {
        displayTabContent(tabName, currentPR);
    }
}

// Display tab content
function displayTabContent(tabName, pr) {
    switch (tabName) {
        case 'review':
            displayReviewStatus(pr);
            break;
        case 'files':
            displayFilesList(pr);
            break;
        case 'timeline':
            displayTimeline(pr);
            break;
    }
}

// Display review status
function displayReviewStatus(pr) {
    const container = document.getElementById('reviewStatus');

    let reviewDecisionHTML = '';
    const reviewDecision = pr.reviewDecision || '';

    if (reviewDecision === 'APPROVED') {
        reviewDecisionHTML = '<div class="status-badge approved">✅ 承認済み</div>';
    } else if (reviewDecision === 'CHANGES_REQUESTED' || pr.changes_requested > 0) {
        reviewDecisionHTML = '<div class="status-badge changes">🔄 変更要求あり</div>';
    } else if (reviewDecision === 'REVIEW_REQUIRED') {
        reviewDecisionHTML = '<div class="status-badge pending">👀 レビュー待ち</div>';
    } else {
        reviewDecisionHTML = '<div class="status-badge info">💬 レビュー進行中</div>';
    }

    // Review details
    const requestedReviewers = pr.requested_reviewers || 0;
    const changesRequested = pr.changes_requested || 0;

    let reviewersInfo = '';
    if (requestedReviewers > 0) {
        reviewersInfo += `<p><strong>依頼中のレビュアー:</strong> ${requestedReviewers}人</p>`;
    }
    if (changesRequested > 0) {
        reviewersInfo += `<p><strong>変更要求:</strong> ${changesRequested}件</p>`;
    }

    // Merge status
    let mergeStatusHTML = '';
    const mergeable = pr.mergeable || '';
    const mergeState = pr.mergeStateStatus || '';

    if (mergeable === 'MERGEABLE' || ['CLEAN', 'UNSTABLE', 'HAS_HOOKS'].includes(mergeState)) {
        mergeStatusHTML = '<div class="status-badge success">✅ マージ可能</div>';
    } else if (mergeable === 'CONFLICTING' || ['DIRTY', 'BEHIND', 'BLOCKED'].includes(mergeState)) {
        mergeStatusHTML = '<div class="status-badge error">❌ コンフリクトあり</div>';
    } else {
        mergeStatusHTML = '<div class="status-badge info">ℹ️ マージ状態不明</div>';
    }

    // Checks status
    let checksHTML = '';
    const checks = pr.checks_state || '';
    if (checks) {
        if (['SUCCESS', 'SUCCEEDED'].includes(checks.toUpperCase())) {
            checksHTML = '<div class="status-badge success">✅ チェック成功</div>';
        } else if (['FAILURE', 'FAILED'].includes(checks.toUpperCase())) {
            checksHTML = '<div class="status-badge error">❌ チェック失敗</div>';
        } else if (['PENDING', 'EXPECTED'].includes(checks.toUpperCase())) {
            checksHTML = '<div class="status-badge pending">⏳ チェック実行中</div>';
        }
    }

    container.innerHTML = `
        ${reviewDecisionHTML}
        ${reviewersInfo}
        <br>
        ${mergeStatusHTML}
        <br>
        ${checksHTML}
    `;
}

// Display files list
function displayFilesList(pr) {
    const container = document.getElementById('filesList');

    const files = pr.files || [];
    if (files.length === 0) {
        container.innerHTML = '<div class="info-message">ファイル情報がありません</div>';
        return;
    }

    let filesHTML = `<div class="file-count">合計 ${files.length}個のファイル</div>`;
    filesHTML += '<div class="files-table">';

    files.forEach(file => {
        filesHTML += `
            <div class="file-item">
                <span class="file-name">${file}</span>
            </div>
        `;
    });

    filesHTML += '</div>';
    container.innerHTML = filesHTML;
}

// Display timeline
function displayTimeline(pr) {
    const container = document.getElementById('timelineChart');

    // Build timeline events (simplified version)
    const events = buildPRTimelineEvents(pr);

    if (events.length === 0) {
        container.innerHTML = '<div class="info-message">イベント情報がありません</div>';
        return;
    }

    let timelineHTML = '<div class="timeline-events">';

    events.forEach(event => {
        const timestamp = new Date(event.timestamp);
        timelineHTML += `
            <div class="timeline-event">
                <div class="timeline-icon">${event.icon}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${event.event}</div>
                    <div class="timeline-meta">${formatDate(timestamp)} ${timestamp.toLocaleTimeString('ja-JP')} (${event.actor})</div>
                </div>
            </div>
        `;
    });

    timelineHTML += '</div>';
    container.innerHTML = timelineHTML;
}

// Build PR timeline events (simplified)
function buildPRTimelineEvents(pr) {
    const events = [];

    // Creation event
    events.push({
        timestamp: pr.createdAt,
        event: 'PR作成',
        actor: pr.author || '不明',
        icon: '📝'
    });

    // Review events
    if (pr.reviews && pr.reviews.nodes) {
        pr.reviews.nodes.forEach(review => {
            let eventType = 'レビュー';
            let icon = '👀';

            switch (review.state) {
                case 'APPROVED':
                    eventType = '承認';
                    icon = '✅';
                    break;
                case 'CHANGES_REQUESTED':
                    eventType = '変更要求';
                    icon = '🔄';
                    break;
                case 'COMMENTED':
                    eventType = 'コメント';
                    icon = '💬';
                    break;
            }

            events.push({
                timestamp: review.createdAt,
                event: eventType,
                actor: review.author || '不明',
                icon: icon
            });
        });
    }

    // Closed/Merged event
    if (pr.closedAt) {
        const eventType = pr.mergedAt ? 'マージ' : 'クローズ';
        const icon = pr.mergedAt ? '🔀' : '❌';

        events.push({
            timestamp: pr.closedAt,
            event: eventType,
            actor: pr.author || '不明',
            icon: icon
        });
    }

    // Sort by timestamp
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Hide PR detail
function hidePRDetail() {
    document.getElementById('prDetailContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    currentPR = null;
}

// Open PR in GitHub
function openInGitHub() {
    if (currentPR && currentPR.url) {
        window.open(currentPR.url, '_blank');
    }
}

// Go back function
function goBack() {
    window.history.back();
}

// Helper functions
function formatDate(date) {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }
    return `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPRSummaryPage);
} else {
    initPRSummaryPage();
}