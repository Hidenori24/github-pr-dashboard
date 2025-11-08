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

# プライマリーリポジトリ表示（サイドバー）
if config.REPOSITORIES and 'primary_repo_index' in st.session_state:
    primary_repo = config.REPOSITORIES[st.session_state.primary_repo_index]
    st.sidebar.info(f"プライマリー:\n\n**{primary_repo['name']}**\n\n`{primary_repo['owner']}/{primary_repo['repo']}`")

page = st.sidebar.radio(
    "ページ選択",
    ["ホーム", "PRダッシュボード", "PR分析", "Four Keys"],
    label_visibility="collapsed"
)

if page == "ホーム":
    st.title("GitHub PR Dashboard & Analytics")
    
    st.markdown("""
    GitHubのPRを可視化・分析する統合Streamlitダッシュボード
    
    ## 主な機能
    
    - **マルチリポジトリ対応**: 複数リポジトリを一元管理
    - **コメントスレッド分析**: 指摘→返信→解決の流れを可視化
    - **ボトルネック分析強化**: 未応答時間を営業日ベースで計算
    - **レビュワー分析**: 誰がレビューに応答していないかを特定
    - **レビュー速度分析**: 作成からマージまでの時間分析
    - **変更パターン分析**: ファイル変更頻度とPR規模分析
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
    
    col1, col2, col3 = st.columns(3)
    
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
        
        **現在開発中**
        """)
        
        if st.button("Four Keysを開く", type="secondary", use_container_width=True):
            st.switch_page("pages/3_four_keys.py")
    
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
