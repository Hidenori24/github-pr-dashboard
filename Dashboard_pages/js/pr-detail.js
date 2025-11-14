// PR Detail Page Logic

let currentPR = null;

// Calculate PR "danger level" score
function calculatePRDangerLevel(pr) {
    let score = 0;
    let warnings = [];
    
    // Age factor (1 point per day over 3 days)
    const ageMs = new Date() - new Date(pr.createdAt);
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays > 3) {
        const ageScore = Math.min((ageDays - 3) * 5, 30);
        score += ageScore;
        if (ageDays > 7) warnings.push(`⏰ 放置期間が長い (${ageDays}日)`);
    }
    
    // Size factor (large PRs are risky)
    const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
    if (totalChanges > 1000) {
        score += 20;
        warnings.push('📦 変更量が大きすぎる');
    } else if (totalChanges > 500) {
        score += 10;
        warnings.push('📦 変更量が多い');
    }
    
    // Review factor
    const reviewCount = (pr.reviews && pr.reviews.length) || 0;
    const commentCount = pr.comments_count || 0;
    
    if (reviewCount === 0 && ageDays > 2) {
        score += 15;
        warnings.push('👁️ レビューがない');
    }
    
    // Comment/review ratio (too many comments might indicate issues)
    if (reviewCount > 0) {
        const commentPerReview = commentCount / reviewCount;
        if (commentPerReview > 10) {
            score += 15;
            warnings.push('💬 議論が多い (意見が分かれている可能性)');
        }
    }
    
    // Changes after review
    const changesRequested = pr.changes_requested || 0;
    if (changesRequested > 0) {
        score += changesRequested * 8;
        warnings.push(`🔧 修正要求あり (${changesRequested}件)`);
    }
    
    // Unresolved threads
    const unresolvedThreads = pr.unresolved_threads || 0;
    if (unresolvedThreads > 0) {
        score += unresolvedThreads * 5;
        warnings.push(`💭 未解決の会話 (${unresolvedThreads}件)`);
    }
    
    // Commits after first review
    if (pr.commits_after_review && pr.commits_after_review > 3) {
        score += Math.min(pr.commits_after_review * 3, 20);
        warnings.push(`🔄 レビュー後の変更が多い (${pr.commits_after_review}回)`);
    }
    
    // File count
    const changedFiles = pr.changedFiles || 0;
    if (changedFiles > 20) {
        score += 10;
        warnings.push('📁 変更ファイル数が多い');
    }
    
    // Determine danger level
    let level = 'safe';
    let color = '#10b981';
    let emoji = '✅';
    let label = '問題なし';
    
    if (score >= 50) {
        level = 'critical';
        color = '#dc2626';
        emoji = '🚨';
        label = '緊急対応必要';
    } else if (score >= 30) {
        level = 'warning';
        color = '#f59e0b';
        emoji = '⚠️';
        label = '注意が必要';
    } else if (score >= 15) {
        level = 'caution';
        color = '#fbbf24';
        emoji = '⚡';
        label = '要確認';
    }
    
    return { score, level, color, emoji, label, warnings };
}

// Determine action owner for PR
function determineActionOwner(pr) {
    const state = pr.state;
    const author = pr.author;
    const reviewDetails = pr.review_details || pr.reviews || [];
    const requestedReviewers = pr.requested_reviewers_list || [];
    const changesRequested = pr.changes_requested || 0;
    const unresolvedThreads = pr.unresolved_threads || 0;
    
    // CLOSED or MERGED
    if (state === 'CLOSED' || state === 'MERGED') {
        return { action: 'none', waitingFor: [], reason: `PR is ${state}` };
    }
    
    // Latest reviews per person
    const latestReviews = {};
    reviewDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    reviewDetails.forEach(rv => {
        const reviewer = rv.author;
        if (reviewer && !latestReviews[reviewer]) {
            latestReviews[reviewer] = rv.state;
        }
    });
    
    // Changes requested
    if (changesRequested > 0) {
        const changesBy = Object.entries(latestReviews)
            .filter(([_, state]) => state === 'CHANGES_REQUESTED')
            .map(([reviewer, _]) => reviewer);
        return {
            action: 'author',
            waitingFor: [author],
            reason: `修正要求あり (by: ${changesBy.join(', ')})`
        };
    }
    
    // Unresolved threads
    if (unresolvedThreads > 0) {
        return {
            action: 'author',
            waitingFor: [author],
            reason: `未解決の会話あり (${unresolvedThreads}件)`
        };
    }
    
    // Waiting reviewers
    const waitingReviewers = [];
    requestedReviewers.forEach(reviewer => {
        if (!latestReviews[reviewer]) {
            waitingReviewers.push(reviewer);
        }
    });
    
    Object.entries(latestReviews).forEach(([reviewer, state]) => {
        if (state === 'COMMENTED' && !waitingReviewers.includes(reviewer)) {
            waitingReviewers.push(reviewer);
        }
    });
    
    if (waitingReviewers.length > 0) {
        return {
            action: 'reviewers',
            waitingFor: waitingReviewers,
            reason: `レビュー待ち (${waitingReviewers.length}人)`
        };
    }
    
    // All approved
    const approvedReviewers = Object.entries(latestReviews)
        .filter(([_, state]) => state === 'APPROVED')
        .map(([reviewer, _]) => reviewer);
    
    if (approvedReviewers.length > 0) {
        return {
            action: 'ready_to_merge',
            waitingFor: [author],
            reason: `マージ可能 (承認: ${approvedReviewers.length}人)`
        };
    }
    
    // No review requests
    if (requestedReviewers.length === 0 && Object.keys(latestReviews).length === 0) {
        return {
            action: 'author',
            waitingFor: [author],
            reason: 'レビュー依頼なし'
        };
    }
    
    return { action: 'unknown', waitingFor: [], reason: '状態不明' };
}

// Load PR detail page
async function loadPRDetail(owner, repo, prNumber) {
    console.log(`Loading PR detail: ${owner}/${repo}#${prNumber}`);
    
    const contentDiv = document.getElementById('pr-detail-content');
    contentDiv.innerHTML = '<div class="loading">Loading PR details...</div>';
    
    try {
        // Find PR from appData
        if (!appData.prs || appData.prs.length === 0) {
            contentDiv.innerHTML = '<div class="error-message">PRデータが読み込まれていません</div>';
            return;
        }
        
        const pr = appData.prs.find(p => 
            p.owner === owner && 
            p.repo === repo && 
            p.number === parseInt(prNumber)
        );
        
        if (!pr) {
            contentDiv.innerHTML = `<div class="error-message">PR #${prNumber} が見つかりません</div>`;
            return;
        }
        
        currentPR = pr;
        renderPRDetail(pr);
        
    } catch (error) {
        console.error('Error loading PR detail:', error);
        contentDiv.innerHTML = `<div class="error-message">エラーが発生しました: ${error.message}</div>`;
    }
}

// Render PR detail page
function renderPRDetail(pr) {
    const contentDiv = document.getElementById('pr-detail-content');
    
    // Calculate metrics
    const createdDate = new Date(pr.createdAt);
    const mergedDate = pr.mergedAt ? new Date(pr.mergedAt) : null;
    const closedDate = pr.closedAt ? new Date(pr.closedAt) : null;
    const now = new Date();
    
    const ageHours = pr.age_hours || ((now - createdDate) / (1000 * 60 * 60));
    const ageDays = (ageHours / 24).toFixed(1);
    // Business metrics
    let businessDays = pr.business_days;
    let businessHours = pr.business_hours;
    if (businessDays === undefined || businessHours === undefined) {
        try {
            if (typeof calculateBusinessHours === 'function') {
                const endRef = mergedDate || closedDate || now;
                const bh = calculateBusinessHours(pr.createdAt, endRef);
                businessHours = bh.business_hours;
                businessDays = bh.business_days;
            } else {
                businessHours = ageHours * (5/7);
                businessDays = businessHours / 24;
            }
        } catch (e) {
            businessHours = ageHours * (5/7);
            businessDays = businessHours / 24;
        }
    }
    
    const additions = pr.additions || 0;
    const deletions = pr.deletions || 0;
    const changedFiles = pr.changedFiles || 0;
    
    const reviewCount = (pr.reviews && pr.reviews.length) || 0;
    const commentCount = pr.comments_count || 0;
    
    // Calculate danger level
    const dangerLevel = calculatePRDangerLevel(pr);
    
    // State color
    let stateColor = '#6b7280';
    let stateText = pr.state;
    if (pr.state === 'MERGED') {
        stateColor = '#10b981';
        stateText = 'マージ済み';
    } else if (pr.state === 'CLOSED') {
        stateColor = '#ef4444';
        stateText = 'クローズ';
    } else if (pr.state === 'OPEN') {
        stateColor = '#3b82f6';
        stateText = 'オープン';
    }
    
    const html = `
        <div class="pr-detail-container">
            <!-- Header -->
            <div class="pr-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <h1 style="margin: 0; font-size: 1.8rem;">PR #${pr.number}</h1>
                        <span style="background: ${stateColor}; padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.9rem; font-weight: 600;">${stateText}</span>
                        ${pr.isDraft ? '<span style="background: rgba(255,255,255,0.3); padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.9rem;">Draft</span>' : ''}
                    </div>
                    ${pr.state === 'OPEN' ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem; background: ${dangerLevel.color}; padding: 0.7rem 1.2rem; border-radius: 12px; font-weight: 700; font-size: 1.1rem;">
                        <span style="font-size: 1.5rem;">${dangerLevel.emoji}</span>
                        <span>${dangerLevel.label}</span>
                    </div>
                    ` : ''}
                </div>
                <h2 style="margin: 0 0 1rem 0; font-size: 1.3rem; font-weight: 500;">${pr.title}</h2>
                <div style="display: flex; gap: 2rem; font-size: 0.95rem; opacity: 0.9;">
                    <div>👤 <strong>${pr.author || 'Unknown'}</strong></div>
                    <div>📅 作成: ${formatDate(pr.createdAt)}</div>
                    ${mergedDate ? `<div>✅ マージ: ${formatDate(pr.mergedAt)}</div>` : ''}
                    ${closedDate && !mergedDate ? `<div>❌ クローズ: ${formatDate(pr.closedAt)}</div>` : ''}
                </div>
                <div style="margin-top: 1.5rem;">
                    <a href="${pr.url}" target="_blank" rel="noopener noreferrer" 
                       style="display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 0.7rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.3s ease; border: 2px solid rgba(255,255,255,0.3);"
                       onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-2px)'"
                       onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'">
                        <span style="margin-right: 0.5rem;">🔗</span>
                        GitHubで開く
                    </a>
                </div>
            </div>
            
            ${renderActionOwner(pr)}
            
            ${pr.state === 'OPEN' && dangerLevel.warnings.length > 0 ? `
            <!-- Danger Level Card -->
            <div style="background: ${dangerLevel.color}15; border: 2px solid ${dangerLevel.color}; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <span style="font-size: 2rem;">${dangerLevel.emoji}</span>
                    <div>
                        <h3 style="margin: 0; color: ${dangerLevel.color}; font-size: 1.3rem;">リスクレベル: ${dangerLevel.label}</h3>
                        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.3rem;">スコア: ${dangerLevel.score} / 100</div>
                    </div>
                </div>
                <div style="background: var(--card-bg); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <div style="height: 12px; background: var(--border-color); border-radius: 6px; overflow: hidden;">
                        <div style="width: ${Math.min(dangerLevel.score, 100)}%; height: 100%; background: ${dangerLevel.color}; transition: width 0.5s ease;"></div>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <strong style="color: ${dangerLevel.color};">⚠️ 検出された問題:</strong>
                    <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; color: var(--text-color);">
                        ${dangerLevel.warnings.map(w => `<li style="margin: 0.5rem 0;">${w}</li>`).join('')}
                    </ul>
                </div>
            </div>
            ` : ''}
            
            <!-- Metrics Cards -->
            <div class="metrics-grid" style="margin-bottom: 2rem;">
                <div class="metric-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div class="metric-icon">💬</div>
                    <div class="metric-value">${commentCount}</div>
                    <div class="metric-label">コメント数</div>
                </div>
                
                <div class="metric-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
                    <div class="metric-icon">👁️</div>
                    <div class="metric-value">${reviewCount}</div>
                    <div class="metric-label">レビュー数</div>
                </div>
                
                <div class="metric-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white;">
                    <div class="metric-icon">📝</div>
                    <div class="metric-value">${changedFiles}</div>
                    <div class="metric-label">変更ファイル数</div>
                </div>
                
                <div class="metric-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white;">
                    <div class="metric-icon">⏱️</div>
                    <div class="metric-value">${ageDays}</div>
                    <div class="metric-label">経過日数</div>
                </div>
                <div class="metric-card" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #2d2d2d;">
                    <div class="metric-icon">🏢</div>
                    <div class="metric-value">${(businessDays || 0).toFixed(1)}</div>
                    <div class="metric-label">営業日数</div>
                </div>
            </div>
            
            <!-- Code Changes -->
            <div class="chart-container" style="margin-bottom: 2rem;">
                <h2>📊 コード変更量</h2>
                <div style="display: flex; gap: 2rem; padding: 1.5rem; background: var(--card-bg); border-radius: 8px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 2rem; color: #10b981; font-weight: 700;">+${additions.toLocaleString()}</div>
                        <div style="color: var(--text-muted); margin-top: 0.5rem;">追加行</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 2rem; color: #ef4444; font-weight: 700;">-${deletions.toLocaleString()}</div>
                        <div style="color: var(--text-muted); margin-top: 0.5rem;">削除行</div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 2rem; color: var(--primary-color); font-weight: 700;">${(additions + deletions).toLocaleString()}</div>
                        <div style="color: var(--text-muted); margin-top: 0.5rem;">合計変更行</div>
                    </div>
                </div>
            </div>
            
            <!-- Tabs Section -->
            <div class="chart-container" style="margin-bottom: 2rem;">
                <div class="tabs">
                    <button class="tab-button active" onclick="switchPRTab(event, 'reviews')">👁️ レビュー状況</button>
                    <button class="tab-button" onclick="switchPRTab(event, 'files')">📁 変更ファイル</button>
                    <button class="tab-button" onclick="switchPRTab(event, 'timeline')">📅 タイムライン</button>
                </div>
                
                <div class="tab-content">
                    <!-- Reviews Tab -->
                    <div id="tab-reviews" class="tab-pane active">
                        <div id="pr-reviews-list">
                            ${renderReviewsList(pr)}
                        </div>
                    </div>
                    
                    <!-- Files Tab -->
                    <div id="tab-files" class="tab-pane">
                        <div id="pr-files-list">
                            ${renderFilesList(pr)}
                        </div>
                    </div>
                    
                    <!-- Timeline Tab -->
                    <div id="tab-timeline" class="tab-pane">
                        <div id="pr-timeline-chart" style="min-height: 400px;">
                            <!-- Timeline chart will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    contentDiv.innerHTML = html;
    
    // Render timeline chart if Plotly is available
    if (typeof Plotly !== 'undefined') {
        renderPRTimelineChart(pr);
    }
}

// Render action owner section
function renderActionOwner(pr) {
    if (pr.state !== 'OPEN') {
        return '';
    }
    
    const actionInfo = determineActionOwner(pr);
    
    if (actionInfo.action === 'none') {
        return '';
    }
    
    const waitingFor = actionInfo.waitingFor.join(', ') || '不明';
    
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
        <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${textColor};">
                <span style="font-size: 1.5rem;">${icon}</span>
                <strong style="font-size: 1.1rem;">アクションすべき人:</strong>
                <span style="font-size: 1rem;">${waitingFor}</span>
                <span style="margin-left: 0.5rem; opacity: 0.8;">- ${actionInfo.reason}</span>
            </div>
        </div>
    `;
}

// Render reviews list
function renderReviewsList(pr) {
    if (!pr.reviews || pr.reviews.length === 0) {
        return '<p style="color: var(--text-muted); padding: 1rem;">レビューはまだありません</p>';
    }
    
    // Group reviews by author to show latest status per person
    const reviewsByAuthor = {};
    pr.reviews.forEach(review => {
        if (!reviewsByAuthor[review.author] || new Date(review.createdAt) > new Date(reviewsByAuthor[review.author].createdAt)) {
            reviewsByAuthor[review.author] = review;
        }
    });
    
    // Count review states
    const approvals = Object.values(reviewsByAuthor).filter(r => r.state === 'APPROVED').length;
    const changesRequested = Object.values(reviewsByAuthor).filter(r => r.state === 'CHANGES_REQUESTED').length;
    const comments = Object.values(reviewsByAuthor).filter(r => r.state === 'COMMENTED').length;
    
    const summaryHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: linear-gradient(135deg, #10b98120, #10b98105); border: 1px solid #10b981; border-radius: 8px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem;">✅</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #10b981; margin-top: 0.3rem;">${approvals}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">承認</div>
            </div>
            <div style="background: linear-gradient(135deg, #ef444420, #ef444405); border: 1px solid #ef4444; border-radius: 8px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem;">🔄</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444; margin-top: 0.3rem;">${changesRequested}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">変更要求</div>
            </div>
            <div style="background: linear-gradient(135deg, #3b82f620, #3b82f605); border: 1px solid #3b82f6; border-radius: 8px; padding: 1rem; text-align: center;">
                <div style="font-size: 2rem;">💬</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6; margin-top: 0.3rem;">${comments}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">コメント</div>
            </div>
        </div>
    `;
    
    const reviewsHTML = Object.values(reviewsByAuthor)
        .sort((a, b) => {
            // Sort by state priority: CHANGES_REQUESTED > COMMENTED > APPROVED
            const priority = { 'CHANGES_REQUESTED': 0, 'COMMENTED': 1, 'APPROVED': 2 };
            return priority[a.state] - priority[b.state];
        })
        .map(review => {
            let icon = '💬';
            let color = '#6b7280';
            let bgGradient = 'linear-gradient(135deg, #6b728020, #6b728005)';
            let text = review.state;
            
            if (review.state === 'APPROVED') {
                icon = '✅';
                color = '#10b981';
                bgGradient = 'linear-gradient(135deg, #10b98120, #10b98105)';
                text = '承認';
            } else if (review.state === 'CHANGES_REQUESTED') {
                icon = '🔄';
                color = '#ef4444';
                bgGradient = 'linear-gradient(135deg, #ef444420, #ef444405)';
                text = '変更要求';
            } else if (review.state === 'COMMENTED') {
                icon = '💬';
                color = '#3b82f6';
                bgGradient = 'linear-gradient(135deg, #3b82f620, #3b82f605)';
                text = 'コメント';
            }
            
            return `
                <div style="display: flex; align-items: center; padding: 1rem; background: ${bgGradient}; border-left: 4px solid ${color}; margin-bottom: 0.8rem; border-radius: 8px; transition: transform 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <span style="font-size: 2rem; margin-right: 1.2rem;">${icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-color);">${review.author}</div>
                        <div style="display: flex; align-items: center; gap: 0.8rem; margin-top: 0.3rem;">
                            <span style="font-size: 0.95rem; color: ${color}; font-weight: 600;">${text}</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">📅 ${formatDate(review.createdAt)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
    return summaryHTML + `<div style="max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">${reviewsHTML}</div>`;
}

// Render files list
function renderFilesList(pr) {
    if (!pr.files || pr.files.length === 0) {
        return '<p style="color: var(--text-muted); padding: 1rem;">ファイル情報がありません</p>';
    }
    
    const filesHTML = pr.files.slice(0, 50).map(file => {
        // Handle both string and object formats
        let filename = '';
        let additions = 0;
        let deletions = 0;
        let changes = 0;
        
        if (typeof file === 'string') {
            filename = file;
        } else if (typeof file === 'object') {
            filename = file.filename || file.path || '';
            additions = file.additions || 0;
            deletions = file.deletions || 0;
            changes = file.changes || (additions + deletions);
        }
        
        return `
            <div style="display: flex; align-items: center; padding: 0.8rem; background: var(--card-bg); margin-bottom: 0.5rem; border-radius: 4px;">
                <div style="flex: 1; font-family: monospace; font-size: 0.9rem; color: var(--text-primary); word-break: break-all;">
                    📄 ${filename || '(unknown file)'}
                </div>
                ${changes > 0 ? `
                <div style="display: flex; gap: 1rem; font-size: 0.85rem;">
                    <span style="color: #10b981;">+${additions}</span>
                    <span style="color: #ef4444;">-${deletions}</span>
                    <span style="color: var(--text-muted);">${changes} changes</span>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    const moreFiles = pr.files.length > 50 ? `<p style="text-align: center; color: var(--text-muted); margin-top: 1rem;">他 ${pr.files.length - 50} ファイル...</p>` : '';
    
    return `<div style="max-height: 500px; overflow-y: auto;">${filesHTML}${moreFiles}</div>`;
}

// Render PR timeline chart
function renderPRTimelineChart(pr) {
    const chartDiv = document.getElementById('pr-timeline-chart');
    if (!chartDiv) return;
    
    // Prepare timeline events with more details
    const events = [
        { date: pr.createdAt, event: 'PR作成', type: 'created', color: '#3b82f6', icon: '🚀', author: pr.author }
    ];
    
    // Add commits
    if (pr.commits && pr.commits > 0) {
        const commitDate = pr.updatedAt || pr.createdAt;
        events.push({
            date: commitDate,
            event: `${pr.commits} コミット`,
            type: 'commits',
            color: '#8b5cf6',
            icon: '📝',
            author: pr.author
        });
    }
    
    // Add reviews with details
    if (pr.reviews) {
        pr.reviews.forEach(review => {
            let icon = '💬';
            let color = '#6b7280';
            let eventText = 'コメント';
            
            if (review.state === 'APPROVED') {
                icon = '✅';
                color = '#10b981';
                eventText = '承認';
            } else if (review.state === 'CHANGES_REQUESTED') {
                icon = '🔄';
                color = '#ef4444';
                eventText = '変更要求';
            }
            
            events.push({
                date: review.createdAt,
                event: eventText,
                type: 'review',
                color: color,
                icon: icon,
                author: review.author
            });
        });
    }
    
    if (pr.mergedAt) {
        events.push({ 
            date: pr.mergedAt, 
            event: 'マージ完了', 
            type: 'merged',
            color: '#10b981',
            icon: '🎉',
            author: pr.author
        });
    } else if (pr.closedAt) {
        events.push({ 
            date: pr.closedAt, 
            event: 'クローズ', 
            type: 'closed',
            color: '#ef4444',
            icon: '❌',
            author: pr.author
        });
    }
    
    // Sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate Y positions for better vertical spacing
    const yPositions = events.map((_, i) => Math.floor(i / 2) * 2 + (i % 2));
    
    const trace = {
        x: events.map(e => e.date),
        y: yPositions,
        mode: 'markers+text',
        marker: {
            size: 20,
            color: events.map(e => e.color),
            line: {
                color: '#ffffff',
                width: 3
            }
        },
        text: events.map(e => `${e.icon} ${e.event}<br>${e.author || ''}`),
        textposition: 'top center',
        textfont: {
            size: 11,
            family: 'Arial, sans-serif'
        },
        hovertemplate: '<b>%{text}</b><br>%{x|%Y-%m-%d %H:%M}<extra></extra>',
        type: 'scatter'
    };
    
    // Add connecting lines between events
    const lineTrace = {
        x: events.map(e => e.date),
        y: yPositions,
        mode: 'lines',
        line: {
            color: 'rgba(100, 100, 100, 0.3)',
            width: 2,
            dash: 'dot'
        },
        hoverinfo: 'skip',
        showlegend: false
    };
    
    const layout = {
        title: '',
        xaxis: { 
            title: '📅 タイムライン', 
            type: 'date',
            tickformat: '%m/%d %H:%M',
            gridcolor: 'rgba(200, 200, 200, 0.2)'
        },
        yaxis: { 
            visible: false,
            range: [-1, Math.max(...yPositions) + 2]
        },
        height: Math.max(300, events.length * 40),
        margin: { l: 50, r: 50, t: 30, b: 80 },
        showlegend: false,
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        hovermode: 'closest'
    };
    
    Plotly.newPlot(chartDiv, [lineTrace, trace], layout, { responsive: true });
}

// Format date helper
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

// Switch between PR detail tabs
function switchPRTab(event, tabName) {
    // Remove active class from all tabs and panes
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));
    
    // Add active class to selected tab and pane
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Re-render Plotly chart if switching to timeline tab
    if (tabName === 'timeline' && currentPR && typeof Plotly !== 'undefined') {
        // Small delay to ensure the container is visible
        setTimeout(() => {
            renderPRTimelineChart(currentPR);
        }, 100);
    }
}

// Export for global scope
window.switchPRTab = switchPRTab;

// Initialize PR detail page when navigated
function initializePRDetailPage() {
    // Get PR info from URL parameters or session storage
    const urlParams = new URLSearchParams(window.location.search);
    const owner = urlParams.get('owner') || sessionStorage.getItem('pr_detail_owner');
    const repo = urlParams.get('repo') || sessionStorage.getItem('pr_detail_repo');
    const prNumber = urlParams.get('pr') || sessionStorage.getItem('pr_detail_number');
    
    if (owner && repo && prNumber) {
        loadPRDetail(owner, repo, prNumber);
    } else {
        document.getElementById('pr-detail-content').innerHTML = 
            '<div class="error-message">PR情報が指定されていません</div>';
    }
}

// Export functions
window.loadPRDetail = loadPRDetail;
window.initializePRDetailPage = initializePRDetailPage;
window.calculatePRDangerLevel = calculatePRDangerLevel;
window.determineActionOwner = determineActionOwner;
