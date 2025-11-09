// Internationalization support for GitHub PR Dashboard
// Supports Japanese (ja) and English (en)

const i18n = {
    currentLang: 'ja', // Default language
    
    // Translation dictionary
    translations: {
        ja: {
            // Navigation
            'nav.home': 'ホーム',
            'nav.dashboard': 'PRダッシュボード',
            'nav.analytics': 'PR分析',
            'nav.fourkeys': 'Four Keys',
            
            // Home page
            'home.title': 'GitHub PR Dashboard & Analytics',
            'home.subtitle': 'GitHubのPRを可視化・分析する統合ダッシュボード',
            'home.features.title': '主な機能',
            'home.features.multi': 'マルチリポジトリ対応',
            'home.features.multi.desc': '複数リポジトリを一元管理',
            'home.features.comment': 'コメントスレッド分析',
            'home.features.comment.desc': '指摘→返信→解決の流れを可視化',
            'home.features.bottleneck': 'ボトルネック分析',
            'home.features.bottleneck.desc': '未応答時間を営業日ベースで計算',
            'home.features.reviewer': 'レビュワー分析',
            'home.features.reviewer.desc': '誰がレビューに応答していないかを特定',
            'home.features.speed': 'レビュー速度分析',
            'home.features.speed.desc': '作成からマージまでの時間分析',
            'home.features.pattern': '変更パターン分析',
            'home.features.pattern.desc': 'ファイル変更頻度とPR規模分析',
            'home.repos.title': '設定済みリポジトリ',
            'home.repos.select': 'プライマリーリポジトリを選択してください',
            'home.repos.loading': 'Loading repositories...',
            'home.cache.checking': 'Checking cache status...',
            
            // Dashboard
            'dashboard.title': 'PRダッシュボード',
            'dashboard.purpose': '目的:',
            'dashboard.purpose.desc': 'PRの状態とファイル変更を時系列で把握',
            'dashboard.features.title': '主な機能:',
            'dashboard.timeline': 'PRタイムライン',
            'dashboard.timeline.desc': 'ガントチャートでPRのライフサイクルを可視化',
            'dashboard.files': '書類/コード分析',
            'dashboard.files.desc': 'ディレクトリごとのPRタイムライン',
            'dashboard.action': 'アクション追跡',
            'dashboard.action.desc': 'レビュー待ち/修正待ちPRの自動検出',
            'dashboard.open': 'PRダッシュボードを開く',
            
            // Analytics
            'analytics.title': 'PR分析',
            'analytics.purpose': '目的:',
            'analytics.purpose.desc': 'PRデータの多角的分析とボトルネック検出',
            'analytics.features.title': '主な機能:',
            'analytics.stagnation': '滞留分析',
            'analytics.stagnation.desc': 'Open PRの滞留時間分布',
            'analytics.blocker': 'ブロッカー分析',
            'analytics.blocker.desc': '未クローズ原因の推定',
            'analytics.reviewer': 'レビュワー分析',
            'analytics.reviewer.desc': 'レビューアクティビティ分析',
            'analytics.trend': 'トレンド分析',
            'analytics.trend.desc': '週次PR作成数推移',
            'analytics.open': 'PR分析を開く',
            
            // Four Keys
            'fourkeys.title': 'Four Keys',
            'fourkeys.purpose': '目的:',
            'fourkeys.purpose.desc': 'DevOps Research and Assessment (DORA) の主要指標でソフトウェア開発のパフォーマンスを測定',
            'fourkeys.features.title': '4つの主要指標:',
            'fourkeys.deployment': 'デプロイ頻度 - 週あたりのデプロイ回数',
            'fourkeys.leadtime': '変更のリードタイム - PR作成からマージまでの時間',
            'fourkeys.failure': '変更失敗率 - 失敗PRの割合',
            'fourkeys.mttr': 'サービス復旧時間 (MTTR) - 問題解決までの時間',
            'fourkeys.open': 'Four Keysを開く',
            'fourkeys.subtitle': 'DevOps Research and Assessment (DORA) の 4つの主要指標でソフトウェア開発のパフォーマンスを測定',
            
            // Statistics
            'nav.statistics': '統計・レポート',
            'statistics.title': '統計情報・週間レポート',
            'statistics.subtitle': '開発プロセスの現状を理解し、改善の機会を見つけるための包括的な統計情報',
            'statistics.period': 'レポート期間:',
            'statistics.download': '週間レポートをダウンロード',
            'statistics.summary': '期間サマリー',
            'statistics.total_prs': '総PR数',
            'statistics.merged': 'マージ済み',
            'statistics.lead_time': '平均リードタイム',
            'statistics.active_authors': 'アクティブ開発者',
            'statistics.state_breakdown': 'PR状態の内訳',
            'statistics.review_activity': 'レビュー活動',
            'statistics.trends': 'トレンド分析（過去8週間）',
            'statistics.pr_count_trend': 'PR作成数の推移',
            'statistics.lead_time_trend': '平均リードタイムの推移',
            'statistics.insights': '洞察',
            'statistics.recommendations': '改善提案',
            'statistics.loading_insights': 'データを分析中...',
            'statistics.loading_recommendations': '提案を生成中...',
            'statistics.no_insights': '今期は特記すべき変化はありません。',
            'statistics.good_process': '現状のプロセスは良好です。引き続き維持してください。',
            
            // Common
            'loading': '読み込み中...',
            'error': 'エラー',
            'error.data_load': 'データの読み込みに失敗しました。GitHub Actionsが正常に実行されているか確認してください。',
            'github_pr_tools': 'GitHub PR Tools',
        },
        en: {
            // Navigation
            'nav.home': 'Home',
            'nav.dashboard': 'PR Dashboard',
            'nav.analytics': 'PR Analytics',
            'nav.fourkeys': 'Four Keys',
            
            // Home page
            'home.title': 'GitHub PR Dashboard & Analytics',
            'home.subtitle': 'Integrated dashboard for visualizing and analyzing GitHub PRs',
            'home.features.title': 'Key Features',
            'home.features.multi': 'Multi-Repository Support',
            'home.features.multi.desc': 'Manage multiple repositories in one place',
            'home.features.comment': 'Comment Thread Analysis',
            'home.features.comment.desc': 'Visualize the flow from feedback → response → resolution',
            'home.features.bottleneck': 'Bottleneck Analysis',
            'home.features.bottleneck.desc': 'Calculate unresponded time based on business days',
            'home.features.reviewer': 'Reviewer Analysis',
            'home.features.reviewer.desc': 'Identify who is not responding to reviews',
            'home.features.speed': 'Review Speed Analysis',
            'home.features.speed.desc': 'Analyze time from creation to merge',
            'home.features.pattern': 'Change Pattern Analysis',
            'home.features.pattern.desc': 'Analyze file change frequency and PR size',
            'home.repos.title': 'Configured Repositories',
            'home.repos.select': 'Select a primary repository',
            'home.repos.loading': 'Loading repositories...',
            'home.cache.checking': 'Checking cache status...',
            
            // Dashboard
            'dashboard.title': 'PR Dashboard',
            'dashboard.purpose': 'Purpose:',
            'dashboard.purpose.desc': 'Track PR status and file changes over time',
            'dashboard.features.title': 'Key Features:',
            'dashboard.timeline': 'PR Timeline',
            'dashboard.timeline.desc': 'Visualize PR lifecycle with Gantt charts',
            'dashboard.files': 'Document/Code Analysis',
            'dashboard.files.desc': 'PR timeline by directory',
            'dashboard.action': 'Action Tracking',
            'dashboard.action.desc': 'Auto-detect PRs waiting for review or fixes',
            'dashboard.open': 'Open PR Dashboard',
            
            // Analytics
            'analytics.title': 'PR Analytics',
            'analytics.purpose': 'Purpose:',
            'analytics.purpose.desc': 'Multi-faceted PR data analysis and bottleneck detection',
            'analytics.features.title': 'Key Features:',
            'analytics.stagnation': 'Stagnation Analysis',
            'analytics.stagnation.desc': 'Distribution of open PR duration',
            'analytics.blocker': 'Blocker Analysis',
            'analytics.blocker.desc': 'Estimate causes for unclosed PRs',
            'analytics.reviewer': 'Reviewer Analysis',
            'analytics.reviewer.desc': 'Analyze review activity',
            'analytics.trend': 'Trend Analysis',
            'analytics.trend.desc': 'Weekly PR creation trends',
            'analytics.open': 'Open PR Analytics',
            
            // Four Keys
            'fourkeys.title': 'Four Keys',
            'fourkeys.purpose': 'Purpose:',
            'fourkeys.purpose.desc': 'Measure software development performance using DevOps Research and Assessment (DORA) key metrics',
            'fourkeys.features.title': 'Four Key Metrics:',
            'fourkeys.deployment': 'Deployment frequency - Number of deployments per week',
            'fourkeys.leadtime': 'Lead time for changes - Time from PR creation to merge',
            'fourkeys.failure': 'Change failure rate - Percentage of failed PRs',
            'fourkeys.mttr': 'Time to restore service (MTTR) - Time to resolve issues',
            'fourkeys.open': 'Open Four Keys',
            'fourkeys.subtitle': 'Measure software development performance using the 4 key metrics from DevOps Research and Assessment (DORA)',
            
            // Statistics
            'nav.statistics': 'Statistics & Reports',
            'statistics.title': 'Statistics & Weekly Reports',
            'statistics.subtitle': 'Comprehensive statistics to understand the current state of development processes and find opportunities for improvement',
            'statistics.period': 'Report Period:',
            'statistics.download': 'Download Weekly Report',
            'statistics.summary': 'Period Summary',
            'statistics.total_prs': 'Total PRs',
            'statistics.merged': 'Merged',
            'statistics.lead_time': 'Avg Lead Time',
            'statistics.active_authors': 'Active Authors',
            'statistics.state_breakdown': 'PR State Breakdown',
            'statistics.review_activity': 'Review Activity',
            'statistics.trends': 'Trend Analysis (Last 8 Weeks)',
            'statistics.pr_count_trend': 'PR Creation Trend',
            'statistics.lead_time_trend': 'Average Lead Time Trend',
            'statistics.insights': 'Insights',
            'statistics.recommendations': 'Recommendations',
            'statistics.loading_insights': 'Analyzing data...',
            'statistics.loading_recommendations': 'Generating recommendations...',
            'statistics.no_insights': 'No notable changes this period.',
            'statistics.good_process': 'Current processes are performing well. Keep it up!',
            
            // Common
            'loading': 'Loading...',
            'error': 'Error',
            'error.data_load': 'Failed to load data. Please check if GitHub Actions is running correctly.',
            'github_pr_tools': 'GitHub PR Tools',
        }
    },
    
    // Get translated text
    t(key) {
        const translation = this.translations[this.currentLang][key];
        return translation || key;
    },
    
    // Set language
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('preferredLanguage', lang);
            this.updatePageText();
        }
    },
    
    // Initialize i18n
    init() {
        // Load saved language preference
        const savedLang = localStorage.getItem('preferredLanguage');
        if (savedLang && this.translations[savedLang]) {
            this.currentLang = savedLang;
        } else {
            // Auto-detect browser language
            const browserLang = navigator.language.toLowerCase();
            if (browserLang.startsWith('ja')) {
                this.currentLang = 'ja';
            } else {
                this.currentLang = 'en';
            }
        }
        this.updatePageText();
    },
    
    // Update all text on the page
    updatePageText() {
        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
        
        // Update placeholders with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
        
        // Update html lang attribute
        document.documentElement.lang = this.currentLang;
        
        // Update language toggle button
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.textContent = this.currentLang === 'ja' ? 'EN' : 'JA';
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = i18n;
}
