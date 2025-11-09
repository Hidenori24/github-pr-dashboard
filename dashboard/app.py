# app.py - GitHub PR Dashboard & Analytics (統合エントリーポイント)
import streamlit as st
from datetime import datetime, timezone, timedelta
import threading
import config
import db_cache
import fetcher

st.set_page_config(
    page_title="GitHub PR Dashboard",
    layout="wide",
    initial_sidebar_state="expanded"
)

# セッション状態の初期化
if 'auto_update_started' not in st.session_state:
    st.session_state.auto_update_started = False
if 'auto_update_done' not in st.session_state:
    st.session_state.auto_update_done = False
if 'primary_repo_index' not in st.session_state:
    st.session_state.primary_repo_index = 0  # デフォルトは最初のリポジトリ
if 'dark_mode' not in st.session_state:
    st.session_state.dark_mode = False

# カスタムCSS - モダンなスタイリングとダークモード対応
def inject_custom_css():
    """Inject custom CSS for modern styling and dark mode support"""
    if st.session_state.dark_mode:
        # Dark mode styles
        st.markdown("""
        <style>
        /* Dark Mode Styles */
        .stApp {
            background-color: #1a1a1a;
            color: #e4e4e7;
        }
        
        section[data-testid="stSidebar"] {
            background-color: #262626;
        }
        
        section[data-testid="stSidebar"] .stMarkdown {
            color: #e4e4e7;
        }
        
        div[data-testid="stMetric"] {
            background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
            border: 1px solid #3f3f46;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        div[data-testid="stMetric"]:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 12px rgba(0, 0, 0, 0.4);
        }
        
        div[data-testid="stMetric"] label {
            color: #a1a1aa !important;
            font-weight: 600;
        }
        
        div[data-testid="stMetric"] [data-testid="stMetricValue"] {
            color: #4fc3f7 !important;
            font-size: 2rem;
            font-weight: 700;
        }
        
        .stButton button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.5rem 1.5rem;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .stButton button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
        }
        
        div[data-baseweb="card"] {
            background-color: #262626;
            border: 1px solid #3f3f46;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        h1, h2, h3 {
            color: #e4e4e7;
            font-weight: 700;
        }
        
        .stAlert {
            border-radius: 8px;
        }
        </style>
        """, unsafe_allow_html=True)
    else:
        # Light mode styles
        st.markdown("""
        <style>
        /* Modern Light Mode Styles */
        div[data-testid="stMetric"] {
            background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        div[data-testid="stMetric"]:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
        }
        
        div[data-testid="stMetric"] label {
            color: #6b7280 !important;
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        div[data-testid="stMetric"] [data-testid="stMetricValue"] {
            color: #ff4b4b !important;
            font-size: 2rem;
            font-weight: 700;
        }
        
        .stButton button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0.5rem 1.5rem;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .stButton button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
        }
        
        h1, h2, h3 {
            font-weight: 700;
        }
        
        .stAlert {
            border-radius: 8px;
        }
        </style>
        """, unsafe_allow_html=True)

inject_custom_css()


def check_and_update_cache():
    """キャッシュが古い場合は自動更新"""
    # プライマリーリポジトリを使用
    if config.REPOSITORIES:
        primary_repo = config.REPOSITORIES[st.session_state.get('primary_repo_index', 0)]
        owner = primary_repo['owner']
        repo = primary_repo['repo']
    else:
        owner = config.DEFAULT_OWNER
        repo = config.DEFAULT_REPO
    
    cache_info = db_cache.get_cache_info(owner, repo)
    
    if cache_info is None:
        # キャッシュなし
        return {
            'needs_update': True,
            'message': '初回データ取得が必要です',
            'age_hours': None
        }
    
    # 最終更新時刻
    latest_fetch_str = cache_info['latest_fetch']
    latest_fetch = datetime.fromisoformat(latest_fetch_str.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    age = now - latest_fetch
    age_hours = age.total_seconds() / 3600
    
    if age > timedelta(hours=24):
        return {
            'needs_update': True,
            'message': f'データが古い（{age_hours:.1f}時間前）',
            'age_hours': age_hours
        }
    
    return {
        'needs_update': False,
        'message': f'データは最新（{age_hours:.1f}時間前）',
        'age_hours': age_hours
    }


def auto_update_background():
    """バックグラウンドで自動更新"""
    # プライマリーリポジトリを使用
    if config.REPOSITORIES:
        primary_repo = config.REPOSITORIES[st.session_state.get('primary_repo_index', 0)]
        owner = primary_repo['owner']
        repo = primary_repo['repo']
    else:
        owner = config.DEFAULT_OWNER
        repo = config.DEFAULT_REPO
    
    try:
        # fetch_data.py と同じロジック
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=config.DEFAULT_DAYS)
        
        etag_info = db_cache.get_etag(owner, repo)
        etag = etag_info["etag"] if etag_info else None
        last_modified = etag_info["last_modified"] if etag_info else None
        
        pr_list, new_etag, new_last_modified, is_modified = fetcher.run_query(
            owner, repo,
            cutoff_dt=cutoff_dt,
            etag=etag,
            last_modified=last_modified
        )
        
        # ETag情報を保存
        if new_etag or new_last_modified:
            db_cache.save_etag(owner, repo, new_etag, new_last_modified)
        
        if is_modified and pr_list:
            db_cache.save_prs(owner, repo, pr_list)
        
        st.session_state.auto_update_done = True
    except Exception as e:
        print(f"Auto update failed: {e}")


# メインページ選択
st.sidebar.title("GitHub PR Tools")

# ダークモードトグル
col1, col2 = st.sidebar.columns([3, 1])
with col2:
    if st.button("🌙" if not st.session_state.dark_mode else "☀️", key="theme_toggle"):
        st.session_state.dark_mode = not st.session_state.dark_mode
        inject_custom_css()
        st.rerun()

# プライマリーリポジトリ表示（サイドバー）
if config.REPOSITORIES and 'primary_repo_index' in st.session_state:
    primary_repo = config.REPOSITORIES[st.session_state.primary_repo_index]
    st.sidebar.info(f"プライマリー:\n\n**{primary_repo['name']}**\n\n`{primary_repo['owner']}/{primary_repo['repo']}`")

page = st.sidebar.radio(
    "ページ選択",
    ["ホーム", "PRダッシュボード", "PR分析", "Four Keys", "統計・レポート"],
    label_visibility="collapsed"
)

if page == "ホーム":
    st.title("GitHub PR Dashboard & Analytics")
    
    st.markdown("""
    GitHubのPRを可視化・分析する統合Streamlitダッシュボード
    
    ## 主な機能
    
    - **マルチリポジトリ対応**: 複数リポジトリを一元管理
    - **PRタイムライン**: ガントチャートでPRの進行状況を可視化
    - **コメントスレッド分析**: 指摘→返信→解決の流れを可視化
    - **ボトルネック分析**: 未応答時間を営業日ベースで計算
    - **レビュワー分析**: 誰がレビューに応答していないかを特定
    - **レビュー速度分析**: 作成からマージまでの時間分析
    - **変更パターン分析**: ファイル変更頻度とPR規模分析
    - **Four Keys指標**: DevOps Research and Assessmentの主要指標を測定
    - **統計・週間レポート**: 開発プロセスの統計分析と自動改善提案
    """)
    
    # 設定済みリポジトリ一覧
    if config.REPOSITORIES:
        st.markdown("### 設定済みリポジトリ")
        st.markdown("プライマリーリポジトリを選択してください（データ自動更新の対象になります）")
        
        repo_cols = st.columns(min(len(config.REPOSITORIES), 3))
        for idx, repo_info in enumerate(config.REPOSITORIES):
            with repo_cols[idx % 3]:
                # 現在選択中か判定
                is_primary = (st.session_state.primary_repo_index == idx)
                
                # ボタンのスタイル
                button_type = "primary" if is_primary else "secondary"
                button_prefix = "[選択中] " if is_primary else ""
                
                # リポジトリカードをボタンとして表示
                if st.button(
                    f"{button_prefix}**{repo_info['name']}**\n\n`{repo_info['owner']}/{repo_info['repo']}`",
                    key=f"repo_select_{idx}",
                    type=button_type,
                    use_container_width=True
                ):
                    # プライマリーリポジトリを変更
                    st.session_state.primary_repo_index = idx
                    st.rerun()
        
        # 選択中のリポジトリ情報を表示
        primary_repo = config.REPOSITORIES[st.session_state.primary_repo_index]
        st.success(f"プライマリー: **{primary_repo['name']}** (`{primary_repo['owner']}/{primary_repo['repo']}`)")
    
    st.markdown("---")
    
    # キャッシュ状態チェック
    cache_status = check_and_update_cache()
    
    # ステータスバナー表示
    if cache_status['needs_update']:
        if not st.session_state.auto_update_started:
            st.warning(f"{cache_status['message']} - バックグラウンドで更新を開始します...")
            # バックグラウンド更新開始
            thread = threading.Thread(target=auto_update_background, daemon=True)
            thread.start()
            st.session_state.auto_update_started = True
        elif st.session_state.auto_update_done:
            st.success("データ更新完了。ページを再読み込みしてください。")
            if st.button("再読み込み"):
                st.session_state.auto_update_started = False
                st.session_state.auto_update_done = False
                st.rerun()
        else:
            st.info("データ更新中...（古いデータで表示可能）")
    else:
        st.success(cache_status['message'])
    
    st.markdown("---")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("### PRダッシュボード")
        st.markdown("""
        **目的:** PRの状態とファイル変更を時系列で把握
        
        **主な機能:**
        - **PRタイムライン**: ガントチャートでPRのライフサイクルを可視化
          - 営業日ベースの経過時間表示
          - 色分け（状態/経過時間）
        - **書類/コード分析**: ディレクトリごとのPRタイムライン
        - **アクション追跡**: レビュー待ち/修正待ちPRの自動検出
        
        **こんな時に:**
        - 日次のPR確認
        - ファイル影響範囲の確認
        - コードレビューの優先順位付け
        """)
        
        if st.button("PRダッシュボードを開く", type="primary", use_container_width=True):
            st.switch_page("pages/1_dashboard.py")
    
    with col2:
        st.markdown("### PR分析")
        st.markdown("""
        **目的:** PRの統計分析と問題の早期発見
        
        **7つの分析タブ:**
        - **滞留分析**: OPEN PRの滞留時間分布
        - **ブロッカー分析**: 未クローズ原因の推定
        - **レビュワー分析**: レビューアクティビティとコメント応答状況
        - **トレンド分析**: 週次PR作成数推移
        - **ボトルネック分析**: レビュー待ち/修正待ちの詳細
        - **レビュー速度**: マージまでの時間分析
        - **変更パターン**: ファイル変更頻度とPR規模
        
        **こんな時に:**
        - 問題PRの早期発見
        - レビュワーの応答遅延検出
        - レトロスペクティブ
        - マネジメントレポート
        """)
        
        if st.button("PR分析を開く", type="primary", use_container_width=True):
            st.switch_page("pages/2_analytics.py")
    
    
    col3, col4 = st.columns(2)
    
    with col3:
        st.markdown("### Four Keys")
        st.markdown("""
        **目的:** DevOps Four Keysメトリクスの測定
        
        **4つの主要指標:**
        - **Deployment Frequency**: デプロイ頻度
        - **Lead Time for Changes**: 変更のリードタイム
        - **Change Failure Rate**: 変更失敗率
        - **Time to Restore Service**: サービス復旧時間
        
        **こんな時に:**
        - DevOpsパフォーマンス測定
        - DORA指標の可視化
        - チーム改善の定量評価
        """)
        
        if st.button("Four Keysを開く", type="primary", use_container_width=True):
            st.switch_page("pages/3_four_keys.py")
    
    with col4:
        st.markdown("### 統計・レポート")
        st.markdown("""
        **目的:** 開発プロセスの現状分析と改善提案
        
        **主な機能:**
        - **期間サマリー**: 総PR数、マージ率、リードタイム
        - **トレンド分析**: 過去8週間のPR作成数と平均リードタイムの推移
        - **レビュー活動**: 総レビュー数、総コメント数
        - **自動洞察**: 開発活動の分析と問題検知
        - **改善提案**: データに基づく具体的なアクション提案
        - **週間レポート**: Markdown形式でのレポート出力
        
        **こんな時に:**
        - 週次・月次レポート作成
        - チームの改善活動
        - マネジメントへの報告
        """)
        
        if st.button("統計・レポートを開く", type="primary", use_container_width=True):
            st.switch_page("pages/4_statistics.py")
    
    st.markdown("---")
    
    st.markdown("### クイックスタート")
    
    st.markdown("""
    #### 1. リポジトリ設定
    `config.py` の `REPOSITORIES` リストに追加:
    ```python
    REPOSITORIES = [
        {
            "name": "MMNGA",
            "owner": "MitsubishiElectric-InnerSource",
            "repo": "MMNGA"
        },
    ]
    ```
    
    #### 2. データ取得（初回/全リポジトリ）
    ```bash
    python fetch_data.py --all
    ```
    
    #### 3. ダッシュボード起動
    ```bash
    streamlit run app.py
    ```
    
    #### 4. 定期更新設定（推奨）
    毎日自動でデータ更新（1日1回、午前2時）:
    
    **Windows (Task Scheduler):**
    ```powershell
    schtasks /create /tn "GitHub PR Fetch" /tr "python C:\\path\\to\\dashboard\\fetch_data.py --all" /sc daily /st 02:00
    ```
    
    **Linux/Mac (cron):**
    ```bash
    0 2 * * * cd /path/to/dashboard && python fetch_data.py --all
    ```
    """)
    
    st.markdown("---")
    
    st.markdown("### Tips")
    
    col_tip1, col_tip2, col_tip3 = st.columns(3)
    
    with col_tip1:
        st.info("""
        **高速表示**
        
        ローカルファースト方式で瞬時に表示
        - 初回表示: 0.1-0.5秒
        - 再表示: 0.1秒以下
        - GitHub API呼び出しは1日1回のみ
        - Rate Limit の心配なし
        """)
    
    with col_tip2:
        st.info("""
        **データ更新**
        
        必要な時だけ手動更新:
        - 各ページの「GitHub更新」ボタン
        - または `python fetch_data.py --all --force`
        - データが24時間以上古い場合は警告表示
        """)
    
    with col_tip3:
        st.info("""
        **コメントスレッド分析**
        
        未応答レビュワーを特定:
        - 指摘→返信→解決の流れを追跡
        - 未解決スレッドを自動検出
        - 営業日ベースの未応答時間計算
        - レビュワー別の応答率可視化
        """)
    
    st.markdown("---")
    
    st.markdown("### 詳細ドキュメント")
    st.markdown("""
    詳細な使い方やトラブルシューティングは [README.md](README.md) を参照してください。
    
    主な内容:
    - マルチリポジトリ対応の詳細
    - 7つの分析タブの説明
    - GraphQLクエリ詳細
    - カスタマイズ方法
    - トラブルシューティング
    """)

elif page == "PRダッシュボード":
    st.switch_page("pages/1_dashboard.py")

elif page == "PR分析":
    st.switch_page("pages/2_analytics.py")

elif page == "Four Keys":
    st.switch_page("pages/3_four_keys.py")

elif page == "統計・レポート":
    st.switch_page("pages/4_statistics.py")
