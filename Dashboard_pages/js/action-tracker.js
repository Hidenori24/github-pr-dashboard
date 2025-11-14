// action-tracker.js - PRのアクション担当者を判定
// Streamlit版 action_tracker.py からの移植

/**
 * PRの現在のアクション担当者を判定
 * @param {Object} pr - PR情報オブジェクト
 * @returns {Object} {action, waiting_for, reason}
 */
function determineActionOwner(pr) {
    const state = pr.state;
    const author = pr.author;
    const reviewDetails = pr.review_details || [];
    const requestedReviewersList = pr.requested_reviewers_list || [];
    const changesRequested = pr.changes_requested || 0;
    const unresolvedThreads = pr.unresolved_threads || 0;
    
    // CLOSEDやMERGEDは対象外
    if (state === 'CLOSED' || state === 'MERGED') {
        return {
            action: 'none',
            waiting_for: [],
            reason: `PR is ${state}`
        };
    }
    
    // 最新のレビュー状態を人ごとに集計
    const latestReviews = {};
    
    // createdAtで降順ソート
    const sortedReviews = [...reviewDetails].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
    });
    
    sortedReviews.forEach(rv => {
        const reviewer = rv.author;
        if (reviewer && !latestReviews[reviewer]) {
            latestReviews[reviewer] = rv.state;
        }
    });
    
    // Changes Requested がある場合は作成者のターン
    if (changesRequested > 0) {
        const changesBy = Object.entries(latestReviews)
            .filter(([_, state]) => state === 'CHANGES_REQUESTED')
            .map(([reviewer, _]) => reviewer);
        
        return {
            action: 'author',
            waiting_for: author ? [author] : [],
            reason: `修正要求あり (by: ${changesBy.join(', ')})`
        };
    }
    
    // 未解決の会話スレッドがある場合は作成者のターン
    if (unresolvedThreads > 0) {
        return {
            action: 'author',
            waiting_for: author ? [author] : [],
            reason: `未解決の会話あり (${unresolvedThreads}件)`
        };
    }
    
    // レビュー依頼中のレビュアーを特定
    const waitingReviewers = [];
    
    // reviewRequests に残っている人（まだレビューしていない）
    requestedReviewersList.forEach(reviewer => {
        if (!latestReviews[reviewer]) {
            waitingReviewers.push(reviewer);
        }
    });
    
    // レビュー済みでもAPPROVED以外の人
    Object.entries(latestReviews).forEach(([reviewer, state]) => {
        if (state !== 'APPROVED' && !waitingReviewers.includes(reviewer)) {
            // COMMENTEDのみの人もレビュー待ち扱い
            if (state === 'COMMENTED') {
                waitingReviewers.push(reviewer);
            }
        }
    });
    
    if (waitingReviewers.length > 0) {
        return {
            action: 'reviewers',
            waiting_for: waitingReviewers,
            reason: `レビュー待ち (${waitingReviewers.length}人)`
        };
    }
    
    // 全員承認済み
    const approvedReviewers = Object.entries(latestReviews)
        .filter(([_, state]) => state === 'APPROVED')
        .map(([reviewer, _]) => reviewer);
    
    if (approvedReviewers.length > 0) {
        return {
            action: 'ready_to_merge',
            waiting_for: author ? [author] : [],
            reason: `マージ可能 (承認: ${approvedReviewers.length}人)`
        };
    }
    
    // レビュー依頼がない場合
    if (requestedReviewersList.length === 0 && Object.keys(latestReviews).length === 0) {
        return {
            action: 'author',
            waiting_for: author ? [author] : [],
            reason: 'レビュー依頼なし'
        };
    }
    
    // その他
    return {
        action: 'unknown',
        waiting_for: [],
        reason: '状態不明'
    };
}

/**
 * 人ごとにアクションが必要なPRをまとめる
 * @param {Array} prs - PR情報配列
 * @returns {Object} {user: [{pr, action_info, role}, ...], ...}
 */
function buildActionSummary(prs) {
    const userActions = {};
    
    prs.forEach(pr => {
        if (pr.state !== 'OPEN') {
            return;
        }
        
        const actionInfo = determineActionOwner(pr);
        
        actionInfo.waiting_for.forEach(user => {
            if (!userActions[user]) {
                userActions[user] = [];
            }
            
            const role = user === pr.author ? 'author' : 'reviewer';
            
            userActions[user].push({
                pr: pr,
                action_info: actionInfo,
                role: role
            });
        });
    });
    
    return userActions;
}

/**
 * hoverに表示する担当者情報をフォーマット
 * @param {Object} pr - PR情報オブジェクト
 * @returns {string} フォーマットされた文字列
 */
function formatActionForHover(pr) {
    const actionInfo = determineActionOwner(pr);
    
    if (actionInfo.action === 'none') {
        return '';
    }
    
    let waiting = actionInfo.waiting_for.slice(0, 3).join(', ');
    if (actionInfo.waiting_for.length > 3) {
        waiting += ` (+${actionInfo.waiting_for.length - 3})`;
    }
    
    return `${actionInfo.reason} → ${waiting}`;
}

/**
 * アクション情報をHTML形式で表示用にフォーマット
 * @param {Object} actionInfo - determineActionOwnerの返り値
 * @returns {string} HTML文字列
 */
function formatActionAsHTML(actionInfo) {
    if (actionInfo.action === 'none') {
        return '';
    }
    
    const waitingFor = actionInfo.waiting_for.join(', ') || '不明';
    
    let bgColor = '#e0e7ff';
    let borderColor = '#6366f1';
    let icon = 'ℹ️';
    let textColor = '#1e3a8a';
    
    if (actionInfo.action === 'author') {
        bgColor = '#dbeafe';
        borderColor = '#3b82f6';
        icon = '🔄';
        textColor = '#1e40af';
    } else if (actionInfo.action === 'reviewers') {
        bgColor = '#fef3c7';
        borderColor = '#f59e0b';
        icon = '👀';
        textColor = '#92400e';
    } else if (actionInfo.action === 'ready_to_merge') {
        bgColor = '#d1fae5';
        borderColor = '#10b981';
        icon = '✅';
        textColor = '#065f46';
    }
    
    return `
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

// Export functions (ES6 modules or global scope)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        determineActionOwner,
        buildActionSummary,
        formatActionForHover,
        formatActionAsHTML
    };
}
