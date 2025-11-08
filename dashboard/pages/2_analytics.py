# analytics.py - GitHub PR Analytics Dashboard (Streamlit)
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Tuple

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from zoneinfo import ZoneInfo

import action_tracker

import config
from fetcher import run_query
import db_cache


def add_click_to_pr_handler(fig, df, number_col="number", owner="MitsubishiElectric-InnerSource", repo="MMNGA"):
    """
    Plotlyグラフにクリックイベントを追加してPRを開けるようにする
    
    Args:
        fig: Plotlyのfigureオブジェクト
        df: データフレーム（number列を含む）
        number_col: PR番号の列名
        owner: GitHubオーナー
        repo: GitHubリポジトリ
    """
    if number_col in df.columns:
        # customdataにPR番号を追加
        if hasattr(fig, 'data') and len(fig.data) > 0:
            for trace in fig.data:
                # DataFrameのインデックスからPR番号を取得
                if hasattr(trace, 'customdata'):
                    # 既存のcustomdataがあれば保持
                    pass
                else:
                    # PR番号を追加
                    trace.customdata = df[[number_col]].values
    
    # クリックイベント用の設定
    fig.update_layout(
        hovermode='closest',
        clickmode='event+select'
    )
    
    return fig


def create_stylish_hover_template(base_template: str, show_extra: bool = False) -> str:
    """
    おしゃれなホバーテンプレートを生成
    
    Args:
        base_template: ベースとなるテンプレート文字列
        show_extra: extraテキスト（凡例名など）を表示するか
    
    Returns:
        フォーマット済みのホバーテンプレート
    """
    extra = "" if not show_extra else "<extra></extra>"
    return f"<b>{base_template}</b>{extra}"


st.set_page_config(page_title="PR分析", layout="wide", page_icon="")

st.markdown(
    """
    <style>
    h1, h2, h3 { margin-bottom: 0.4rem; }
    section[data-testid="stSidebar"] .stMarkdown { font-size: 0.95rem; }
    div[data-testid="stMetric"] { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 12px; }
    div[data-testid="stDataFrame"] { border: 1px solid #eee; border-radius: 10px; }
    .progress-label { font-weight: 600; }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      background: #eef2ff; color: #334155; font-size: 0.85rem; margin-right: 6px;
      border: 1px solid #e5e7eb;
    }
    .badge.strong { background: #dcfce7; }
    .small-note { color: #6b7280; font-size: 0.85rem; }
    </style>
    """,
    unsafe_allow_html=True,
)

JST = ZoneInfo("Asia/Tokyo")


def calculate_business_hours(start_dt: datetime, end_dt: datetime) -> float:
    """
    営業日（平日のみ）で経過時間を計算する
    土日を除外し、営業時間のみをカウント
    
    Args:
        start_dt: 開始日時
        end_dt: 終了日時
    
    Returns:
        営業日ベースの経過時間（時間単位）
    """
    if pd.isna(start_dt) or pd.isna(end_dt):
        return 0.0
    
    # datetimeに変換
    if isinstance(start_dt, str):
        start_dt = pd.to_datetime(start_dt, format="ISO8601", utc=True)
    if isinstance(end_dt, str):
        end_dt = pd.to_datetime(end_dt, format="ISO8601", utc=True)
    
    # 同じ日の場合は単純な差分
    if start_dt.date() == end_dt.date():
        # 土日なら0を返す
        if start_dt.weekday() >= 5:
            return 0.0
        return (end_dt - start_dt).total_seconds() / 3600
    
    # 日をまたぐ場合は日ごとに計算
    current = start_dt
    total_hours = 0.0
    
    while current.date() < end_dt.date():
        # 平日のみカウント（月曜=0, 日曜=6）
        if current.weekday() < 5:
            # その日の残り時間（翌日0時まで）
            next_day = datetime.combine(current.date() + timedelta(days=1), datetime.min.time(), tzinfo=current.tzinfo)
            total_hours += (next_day - current).total_seconds() / 3600
        
        # 次の日へ
        current = datetime.combine(current.date() + timedelta(days=1), datetime.min.time(), tzinfo=current.tzinfo)
    
    # 最終日の時間を追加
    if end_dt.weekday() < 5:
        total_hours += (end_dt - current).total_seconds() / 3600
    
    return total_hours


def parse_owner_repo(owner_in: str, repo_in: str) -> Tuple[str, str]:
    """Normalize owner/repo strings even if URLs are provided."""

    def extract_from_url(src: str) -> Tuple[str, str] | None:
        match = re.search(r"github\.com/([^/\s]+)/([^/\s]+)", src or "")
        if match:
            return match.group(1), match.group(2).rstrip("/")
        return None

    parsed = extract_from_url(owner_in) or extract_from_url(repo_in)
    if parsed:
        return parsed
    return (owner_in or "").strip().strip("/"), (repo_in or "").strip().strip("/")


def infer_blocker(row: pd.Series, stale_hours: int = 168) -> str | None:
    if row["state"] != "OPEN":
        return None
    if row.get("isDraft"):
        return "Draft"
    if row.get("reviewDecision") == "CHANGES_REQUESTED" or row.get("changes_requested", 0) > 0:
        return "Changes requested"
    checks = (row.get("checks_state") or "").upper()
    if checks in ("FAILURE", "FAILED"):
        return "Checks failing"
    if checks in ("PENDING", "EXPECTED"):
        return "Checks pending"
    if row.get("mergeable") == "CONFLICTING" or row.get("mergeStateStatus") in ("DIRTY", "BEHIND", "BLOCKED"):
        return "Merge conflict"
    if row.get("reviewDecision") == "REVIEW_REQUIRED":
        if row.get("requested_reviewers", 0) > 0:
            return "Waiting for review"
        return "No reviewer"
    age = float(row.get("age_hours") or 0.0)
    if row.get("mergeable") == "MERGEABLE" or row.get("mergeStateStatus") in ("CLEAN", "UNSTABLE", "HAS_HOOKS"):
        return "Ready to merge" if age < stale_hours else "Stale"
    return "Stale" if age >= stale_hours else "Unknown"


def load_local_prs(owner: str, repo: str, cutoff_dt) -> tuple:
    """
    ローカルDBからPRデータを読み込み（GitHub API呼び出しなし）
    """
    cached_data = db_cache.load_prs(owner, repo)
    
    if not cached_data:
        return [], "No cache (run: python fetch_data.py)"
    
    # 期間フィルタ
    if cutoff_dt:
        cutoff_iso = cutoff_dt.isoformat()
        cached_data = [
            pr for pr in cached_data 
            if pr.get("createdAt", "") >= cutoff_iso
        ]
    
    return cached_data, "Local cache"


def fetch_and_cache_prs(owner: str, repo: str, cutoff_dt, force_refresh: bool = False):
    """PRデータを取得（強制更新時のみGitHub APIを呼び出す）"""
    # 通常はローカルキャッシュから読み込み
    if not force_refresh:
        return load_local_prs(owner, repo, cutoff_dt)
    
    # 強制更新の場合のみGitHub APIを呼び出す
    etag_info = db_cache.get_etag(owner, repo)
    
    try:
        etag = etag_info["etag"] if etag_info else None
        last_modified = etag_info["last_modified"] if etag_info else None
        
        pr_list, new_etag, new_last_modified, is_modified = run_query(
            owner, repo,
            cutoff_dt=cutoff_dt,
            etag=etag,
            last_modified=last_modified
        )
        
        if new_etag or new_last_modified:
            db_cache.save_etag(owner, repo, new_etag, new_last_modified)
        
        if is_modified and pr_list:
            db_cache.save_prs(owner, repo, pr_list)
            return pr_list, "API (updated)"
        elif not is_modified:
            return load_local_prs(owner, repo, cutoff_dt)
        else:
            return load_local_prs(owner, repo, cutoff_dt)
            
    except Exception as e:
        cached_data, source = load_local_prs(owner, repo, cutoff_dt)
        if cached_data:
            return cached_data, f"Cache (API error: {str(e)[:50]})"
        raise


st.title("PR Analytics Dashboard")

with st.sidebar:
    # ========== リポジトリ選択 ==========
    st.header("データ取得")
    
    # リポジトリ選択（config.REPOSITORIESから）
    if config.REPOSITORIES:
        # プライマリーリポジトリをデフォルトに
        default_repo_idx = st.session_state.get('primary_repo_index', 0)
        
        repo_options = [f"{r['name']} ({r['owner']}/{r['repo']})" for r in config.REPOSITORIES]
        selected_repo_idx = st.selectbox(
            "リポジトリ選択",
            range(len(config.REPOSITORIES)),
            index=default_repo_idx,
            format_func=lambda i: repo_options[i],
            help="config.pyで設定したリポジトリから選択"
        )
        selected_repo_config = config.REPOSITORIES[selected_repo_idx]
        default_owner = selected_repo_config["owner"]
        default_repo = selected_repo_config["repo"]
        
        # プライマリーリポジトリの場合は星印表示
        if selected_repo_idx == st.session_state.get('primary_repo_index', 0):
            st.caption("⭐ プライマリーリポジトリ")
    else:
        default_owner = config.DEFAULT_OWNER
        default_repo = config.DEFAULT_REPO
    
    # 手動入力（上級者向け）
    with st.expander("手動入力（上級者向け）", expanded=False):
        owner_input = st.text_input("Owner または URL", value=default_owner, key="manual_owner")
        repo_input = st.text_input("Repo または URL", value=default_repo, key="manual_repo")
        use_manual = st.checkbox("手動入力を使用", value=False)
    
    # 最終的に使用するowner/repo
    if use_manual:
        owner_input_final = owner_input
        repo_input_final = repo_input
    else:
        owner_input_final = default_owner
        repo_input_final = default_repo
    
    st.divider()
    
    st.header("対象条件")
    days = st.slider("対象期間（日）", 7, 365, int(config.DEFAULT_DAYS), step=7)
    state_options = ["OPEN", "CLOSED", "MERGED"]
    default_states = [s for s in config.DEFAULT_STATE if s in state_options] or ["OPEN", "MERGED"]
    state_filter = st.multiselect("対象ステータス", state_options, default=default_states)
    
    # ========== データ更新（必要な時だけ） ==========
    st.divider()
    
    if "refresh_count" not in st.session_state:
        st.session_state.refresh_count = 0
    
    st.markdown("**データ更新:**")
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button("GitHub更新", use_container_width=True, type="primary", help="GitHub APIから最新データを取得"):
            st.session_state.refresh_count += 1
            st.rerun()
    
    with col_btn2:
        if st.button("キャッシュクリア", use_container_width=True, help="ローカルキャッシュを削除"):
            owner, repo = parse_owner_repo(owner_input_final, repo_input_final)
            if owner and repo:
                deleted_pr = db_cache.clear_cache(owner, repo)
                deleted_stats = db_cache.clear_aggregated_stats(owner, repo)
                deleted_files = db_cache.clear_file_caches(owner, repo)
                st.toast(f"PR:{deleted_pr}件、統計:{deleted_stats}件、ファイル:{deleted_files}件削除")
                st.session_state.refresh_count = 0
                time.sleep(0.5)
                st.rerun()
    
    # ========== キャッシュ情報（参考・下部） ==========
    st.divider()
    
    owner_tmp, repo_tmp = parse_owner_repo(owner_input_final, repo_input_final)
    if owner_tmp and repo_tmp:
        cache_info = db_cache.get_cache_info(owner_tmp, repo_tmp)
        etag_info = db_cache.get_etag(owner_tmp, repo_tmp)
        
        with st.expander("キャッシュ情報", expanded=False):
            if cache_info:
                latest = datetime.fromisoformat(cache_info["latest_fetch"])
                age_hours = (datetime.now(timezone.utc) - latest).total_seconds() / 3600
                
                st.metric("PR数", cache_info['count'])
                st.caption(f"最終取得: {age_hours:.1f}時間前")
                
                if etag_info:
                    checked = datetime.fromisoformat(etag_info["checked_at"])
                    check_age_min = (datetime.now(timezone.utc) - checked).total_seconds() / 60
                    st.caption(f"最終確認: {check_age_min:.0f}分前")
                
                if age_hours > 24:
                    st.warning("データが24時間以上古いです")
                    st.caption("💡 `python fetch_data.py` で更新")
            else:
                st.info("キャッシュなし")
                st.caption("💡 `python fetch_data.py` を実行してください")
    stale_hours = st.slider("Stale 判定時間 (h)", 24, 720, 168, step=24)

    st.divider()
    show_debug = st.checkbox("デバッグ情報を表示", value=False)


owner, repo = parse_owner_repo(owner_input_final, repo_input_final)

if not owner or not repo:
    st.warning("Owner / Repo を入力してね。URLでもOKだよ！")
    st.stop()

progress = st.progress(0)
progress_txt = st.empty()
status_ph = st.empty()


def set_progress(pct: int, message: str = "") -> None:
    pct_val = max(0, min(100, int(pct)))
    progress.progress(pct_val)
    if message:
        progress_txt.markdown(
            f"<span class='progress-label'>{pct_val}% - {message}</span>",
            unsafe_allow_html=True,
        )
    else:
        progress_txt.markdown(
            f"<span class='progress-label'>{pct_val}%</span>",
            unsafe_allow_html=True,
        )


t0 = time.perf_counter()
set_progress(5, "データ読み込み中")
status_ph.info("PR データを読み込み中...")

cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)

try:
    force_refresh = st.session_state.refresh_count > 0
    data, source = fetch_and_cache_prs(owner, repo, cutoff_dt, force_refresh=force_refresh)
    
    # refresh_countをリセット
    if force_refresh and st.session_state.refresh_count > 0:
        st.session_state.refresh_count = 0
    
    if source.startswith("API"):
        status_ph.success(f"GitHub APIから{len(data)}件取得しました")
    elif source == "Local cache":
        status_ph.success(f"ローカルキャッシュから{len(data)}件読み込みました（高速表示）")
    else:
        status_ph.info(f"{source}: {len(data)}件")
        
except Exception as exc:
    status_ph.error(f"データ取得エラー: {exc}")
    set_progress(100, "エラー")
    progress.empty()
    progress_txt.empty()
    st.stop()

set_progress(35, "データを整理中")

if not data:
    status_ph.warning("対象期間に PR が見つからなかったよ。期間やリポジトリを調整してみて！")
    set_progress(100, "完了")
    progress.empty()
    progress_txt.empty()
    st.stop()

raw_df = pd.DataFrame(data)
raw_df["createdAt_dt"] = pd.to_datetime(raw_df["createdAt"], format="ISO8601", utc=True)
raw_df["closedAt_dt"] = pd.to_datetime(raw_df["closedAt"], format="ISO8601", utc=True, errors="coerce")
raw_df["mergedAt_dt"] = pd.to_datetime(raw_df["mergedAt"], format="ISO8601", utc=True, errors="coerce")
raw_df["age_hours"] = pd.to_numeric(raw_df["age_hours"], errors="coerce").fillna(0.0)

# 営業日ベースの経過時間を計算
now_utc = datetime.now(timezone.utc)
raw_df["end_dt"] = raw_df.apply(
    lambda row: row["mergedAt_dt"] if pd.notna(row["mergedAt_dt"]) 
    else (row["closedAt_dt"] if pd.notna(row["closedAt_dt"]) else now_utc),
    axis=1
)
raw_df["business_hours"] = raw_df.apply(
    lambda row: calculate_business_hours(row["createdAt_dt"], row["end_dt"]),
    axis=1
)
raw_df["business_days"] = (raw_df["business_hours"] / 24).round(1)

bins = [0, 24, 72, 168, 336, 672, 999999]
labels = ["<1d", "1-3d", "3-7d", "7-14d", "14-28d", ">=28d"]
raw_df["age_bucket"] = pd.cut(raw_df["age_hours"], bins=bins, labels=labels, right=False)

if not state_filter:
    status_ph.warning("ステータスが一つも選ばれてないから、全ステータスを対象にするね。")
    state_filter = ["OPEN", "CLOSED", "MERGED"]

filtered_df = raw_df[raw_df["state"].isin(state_filter)].copy()
filtered_df.sort_values("createdAt_dt", ascending=False, inplace=True)
filtered_df.reset_index(drop=True, inplace=True)

set_progress(55, "統計を計算中")

open_only = filtered_df[filtered_df["state"] == "OPEN"].copy()

# サマリ統計
latest_created = raw_df["createdAt_dt"].max().tz_convert(JST)
open_count = int((raw_df["state"] == "OPEN").sum())
closed_count = int((raw_df["state"] == "CLOSED").sum())
merged_count = int((raw_df["state"] == "MERGED").sum())
median_open_age = open_only["age_hours"].median() if not open_only.empty else 0

with st.container():
    now_jst = datetime.now(JST)
    st.markdown(f"### {owner}/{repo}")
    st.caption(f"最新PR作成: {latest_created.strftime('%Y-%m-%d %H:%M')} JST | "
               f"表示時刻: {now_jst.strftime('%Y-%m-%d %H:%M')} JST")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("総PR件数 (フィルタ後)", len(filtered_df))
    col2.metric("OPEN", open_count)
    col3.metric("MERGED", merged_count)
    col4.metric("CLOSED", closed_count)
    st.markdown(
        f"<span class='badge strong'>OPEN中央値: {median_open_age:.1f} h</span>"
        f"<span class='badge'>データ期間: 過去 {days} 日</span>",
        unsafe_allow_html=True,
    )

set_progress(70, "グラフを描画中")

st.markdown("---")

# タブで分析カテゴリを分ける
tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "滞留分析",
    "ブロッカー分析", 
    "� レビュワー分析",
    "トレンド分析",
    "ボトルネック分析",
    "レビュー速度",
    "変更パターン"
])

with tab1:
    st.markdown("### OPEN PR 滞留分布")
    
    if open_only.empty:
        st.info("OPEN PR なし")
    else:
        col_left, col_right = st.columns(2)
        
        with col_left:
            st.markdown("#### 滞留時間バケット")
            bucket_counts = (
                open_only.groupby("age_bucket", observed=True)
                .size()
                .reset_index(name="count")
            )
            bucket_counts["age_bucket"] = bucket_counts["age_bucket"].astype(str)
            total_bucket = int(bucket_counts["count"].sum())
            bucket_counts["ratio_%"] = (
                bucket_counts["count"] / total_bucket * 100
            ).round(1)

            fig_bucket = px.bar(
                bucket_counts, x="age_bucket", y="count", text="ratio_%",
                height=350,
                hover_data={"count": True, "ratio_%": ":.1f"}
            )
            fig_bucket.update_traces(
                hovertemplate="<b>%{x}</b><br>%{y}件 (%{text}%)<extra></extra>"
            )
            fig_bucket.update_layout(
                margin=dict(l=10, r=10, t=20, b=30),
                showlegend=False,
                xaxis_title="滞留時間",
                yaxis_title="PR数",
                hovermode='closest'
            )
            st.plotly_chart(fig_bucket, use_container_width=True, key="bucket_chart")
            st.caption("各バケットの構成比 (%) | クリックでフィルタ")
        
        with col_right:
            st.markdown("#### 滞留時間分布")
            fig_hist = px.histogram(
                open_only, 
                x="age_hours", 
                nbins=30,
                height=350,
                labels={"age_hours": "滞留時間 (h)"},
                hover_data={"age_hours": ":.1f"}
            )
            fig_hist.update_traces(
                hovertemplate="<b>%{x:.1f}時間</b><br>%{y}件<extra></extra>"
            )
            fig_hist.update_layout(
                margin=dict(l=10, r=10, t=20, b=30),
                showlegend=False,
                yaxis_title="PR数",
                hovermode='closest'
            )
            st.plotly_chart(fig_hist, use_container_width=True, key="hist_chart")
            st.caption("滞留時間のヒストグラム")
        
        st.markdown("---")
        st.markdown("#### 📋 滞留PR一覧")
        
        stale_list = open_only.sort_values("age_hours", ascending=False).head(50)
        display_cols = ["number", "title", "author", "age_hours", "business_days", "comments_count", "url"]
        st.dataframe(
            stale_list[display_cols].rename(columns={
                "number": "PR#",
                "title": "タイトル",
                "author": "作成者",
                "age_hours": "滞留時間(h)",
                "business_days": "営業日数",
                "comments_count": "コメント数",
                "url": "URL"
            }),
            use_container_width=True,
            height=400
        )

with tab2:
    st.markdown("### 未クローズ原因の推定")
    
    if open_only.empty:
        st.info("OPEN PR なし")
    else:
        open_only_copy = open_only.copy()
        open_only_copy["blocker"] = open_only_copy.apply(
            lambda row: infer_blocker(row, stale_hours=stale_hours), axis=1
        )
        
        col_left, col_right = st.columns([1, 1])
        
        with col_left:
            st.markdown("#### ブロッカー分布")
            blocker_counts = (
                open_only_copy.groupby("blocker", observed=True)
                .size()
                .reset_index(name="count")
                .sort_values("count", ascending=False)
            )
            fig_blocker = px.bar(
                blocker_counts, x="blocker", y="count",
                height=350,
                hover_data={"blocker": True, "count": True}
            )
            fig_blocker.update_traces(
                hovertemplate="<b>%{x}</b><br>%{y}件のPR<extra></extra>"
            )
            fig_blocker.update_layout(
                margin=dict(l=10, r=10, t=20, b=30),
                showlegend=False,
                xaxis_title="ブロッカー種別",
                yaxis_title="PR数",
                hovermode='closest'
            )
            st.plotly_chart(fig_blocker, use_container_width=True, key="blocker_chart")
            st.caption("OPENのみ対象 | クリックで詳細")
        
        with col_right:
            st.markdown("#### ブロッカー別統計")
            blocker_stats = (
                open_only_copy.groupby("blocker", observed=True)
                .agg(
                    count=("number", "size"),
                    avg_age=("age_hours", "mean"),
                    median_age=("age_hours", "median"),
                    max_age=("age_hours", "max")
                )
                .reset_index()
                .sort_values("count", ascending=False)
            )
            st.dataframe(
                blocker_stats.rename(columns={
                    "blocker": "ブロッカー",
                    "count": "件数",
                    "avg_age": "平均滞留(h)",
                    "median_age": "中央値(h)",
                    "max_age": "最大(h)"
                }),
                use_container_width=True,
                height=350
            )
        
        st.markdown("---")
        
        # ブロッカー別のPR一覧
        selected_blocker = st.selectbox(
            "ブロッカーを選択してPR一覧を表示",
            ["すべて"] + blocker_counts["blocker"].tolist()
        )
        
        if selected_blocker == "すべて":
            blocker_prs = open_only_copy
        else:
            blocker_prs = open_only_copy[open_only_copy["blocker"] == selected_blocker]
        
        st.markdown(f"#### 📋 {selected_blocker} のPR一覧")
        display_cols = ["number", "title", "author", "age_hours", "blocker", "url"]
        st.dataframe(
            blocker_prs[display_cols].sort_values("age_hours", ascending=False).rename(columns={
                "number": "PR#",
                "title": "タイトル",
                "author": "作成者",
                "age_hours": "滞留時間(h)",
                "blocker": "ブロッカー",
                "url": "URL"
            }),
            use_container_width=True,
            height=400
        )

with tab3:
    st.markdown("### � レビュワー分析")
    st.caption("誰がレビューしているか、誰がレビューしていないかを可視化")
    
    # レビュー詳細情報を展開
    reviewer_activities = []
    
    for idx, row in filtered_df.iterrows():
        review_details = row.get("review_details", [])
        if isinstance(review_details, list):
            for review in review_details:
                reviewer = review.get("author")
                review_created_at = review.get("createdAt")
                if reviewer:
                    reviewer_activities.append({
                        "PR#": row["number"],
                        "タイトル": row["title"],
                        "作成者": row["author"],
                        "レビュワー": reviewer,
                        "レビュー状態": review.get("state"),
                        "レビュー日時": review_created_at,
                        "レビュー日時_dt": pd.to_datetime(review_created_at, format="ISO8601", utc=True) if review_created_at else None,
                        "PR状態": row["state"],
                        "未解決スレッド": row.get("unresolved_threads", 0),
                        "コメント数": row.get("comments_count", 0),
                        "URL": row["url"]
                    })
    
    if reviewer_activities:
        reviewer_df = pd.DataFrame(reviewer_activities)
        
        # レビュワー別統計
        st.markdown("#### レビュワー別アクティビティ")
        
        reviewer_stats = (
            reviewer_df.groupby("レビュワー")
            .agg({
                "PR#": "nunique",  # ユニークなPR数
                "レビュー状態": "count",  # 総レビュー数
            })
            .reset_index()
            .rename(columns={
                "PR#": "レビューしたPR数",
                "レビュー状態": "総レビュー回数"
            })
        )
        
        # レビュー状態別のカウント
        review_state_counts = (
            reviewer_df.groupby(["レビュワー", "レビュー状態"])
            .size()
            .unstack(fill_value=0)
            .reset_index()
        )
        
        # マージ
        reviewer_stats = reviewer_stats.merge(review_state_counts, on="レビュワー", how="left")
        
        # 承認率を計算
        if "APPROVED" in reviewer_stats.columns:
            reviewer_stats["承認率(%)"] = (
                reviewer_stats["APPROVED"] / reviewer_stats["総レビュー回数"] * 100
            ).round(1)
        else:
            reviewer_stats["承認率(%)"] = 0.0
        
        reviewer_stats = reviewer_stats.sort_values("レビューしたPR数", ascending=False)
        
        col_left, col_right = st.columns([1, 1])
        
        with col_left:
            st.markdown("##### レビューPR数ランキング")
            top_reviewers = reviewer_stats.head(20)
            fig_reviewers = px.bar(
                top_reviewers,
                x="レビュワー",
                y="レビューしたPR数",
                height=350,
                hover_data={"レビュワー": True, "レビューしたPR数": True, "総レビュー回数": True}
            )
            fig_reviewers.update_traces(
                hovertemplate="<b>%{x}</b><br>%{y}件のPRをレビュー<br>総レビュー: %{customdata[1]}回<extra></extra>"
            )
            fig_reviewers.update_layout(
                margin=dict(l=10, r=10, t=20, b=80),
                xaxis_tickangle=-45,
                xaxis_title="レビュワー",
                yaxis_title="レビューしたPR数",
                hovermode='closest'
            )
            st.plotly_chart(fig_reviewers, use_container_width=True, key="reviewers_chart")
            st.caption("TOP20のレビュワー")
        
        with col_right:
            st.markdown("##### レビュー状態分布")
            
            # レビュー状態の列名を取得
            state_cols = [col for col in reviewer_stats.columns if col in ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED", "PENDING"]]
            
            if state_cols:
                state_display = {
                    "APPROVED": "承認",
                    "CHANGES_REQUESTED": "変更要求",
                    "COMMENTED": "コメント",
                    "DISMISSED": "却下",
                    "PENDING": "保留"
                }
                
                # 集計
                state_totals = reviewer_stats[state_cols].sum().reset_index()
                state_totals.columns = ["状態", "件数"]
                state_totals["状態"] = state_totals["状態"].map(state_display)
                
                fig_states = px.pie(
                    state_totals,
                    values="件数",
                    names="状態",
                    height=350
                )
                fig_states.update_traces(
                    textposition='inside',
                    textinfo='percent+label',
                    hovertemplate="<b>%{label}</b><br>%{value}件 (%{percent})<extra></extra>"
                )
                st.plotly_chart(fig_states, use_container_width=True, key="review_states_chart")
                st.caption("全レビューの状態分布")
        
        st.markdown("---")
        st.markdown("#### 📋 レビュワー詳細統計")
        
        # 表示する列を選択
        display_cols = ["レビュワー", "レビューしたPR数", "総レビュー回数"]
        for col in ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "承認率(%)"]:
            if col in reviewer_stats.columns:
                display_cols.append(col)
        
        st.dataframe(
            reviewer_stats[display_cols].rename(columns={
                "APPROVED": "承認",
                "CHANGES_REQUESTED": "変更要求",
                "COMMENTED": "コメント"
            }),
            use_container_width=True,
            height=400
        )
        
        st.markdown("---")
        
        # レビュワー選択して詳細PR一覧
        st.markdown("#### レビュワー別PR詳細")
        selected_reviewer = st.selectbox(
            "レビュワーを選択",
            ["すべて"] + reviewer_stats["レビュワー"].tolist(),
            key="reviewer_detail_select"
        )
        
        if selected_reviewer == "すべて":
            display_reviews = reviewer_df
        else:
            display_reviews = reviewer_df[reviewer_df["レビュワー"] == selected_reviewer]
        
        # レビュー状態でフィルタ
        review_state_filter = st.multiselect(
            "レビュー状態でフィルタ",
            ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED", "PENDING"],
            default=["APPROVED", "CHANGES_REQUESTED", "COMMENTED"]
        )
        
        if review_state_filter:
            display_reviews = display_reviews[display_reviews["レビュー状態"].isin(review_state_filter)]
        
        st.dataframe(
            display_reviews[["PR#", "タイトル", "作成者", "レビュー状態", "未解決スレッド", "コメント数", "PR状態", "URL"]].sort_values("PR#", ascending=False),
            use_container_width=True,
            height=400
        )
        
        st.markdown("---")
        
        # 未応答の可能性があるレビュワーを検出
        st.markdown("#### 未応答の可能性があるレビュワー")
        st.caption("コメントしたが未解決スレッドが残っているOPEN PR (時間は最後のレビューからの経過)")
        
        # 未解決スレッドがあるPRをレビューしたレビュワー (OPEN PRのみ)
        unresolved_reviews = reviewer_df[
            (reviewer_df["未解決スレッド"] > 0) & 
            (reviewer_df["PR状態"] == "OPEN")
        ].copy()
        
        if not unresolved_reviews.empty:
            # 現在時刻
            now_utc = datetime.now(timezone.utc)
            
            # レビューからの経過時間を計算 (営業日)
            unresolved_reviews["未応答時間(h)"] = unresolved_reviews["レビュー日時_dt"].apply(
                lambda dt: (now_utc - dt).total_seconds() / 3600 if pd.notna(dt) else 0
            )
            unresolved_reviews["未応答営業日"] = unresolved_reviews["レビュー日時_dt"].apply(
                lambda dt: calculate_business_hours(dt, now_utc) / 24 if pd.notna(dt) else 0
            )
            
            # PR#ごとに最後のレビュー時刻でグループ化
            pr_unresolved = (
                unresolved_reviews.groupby("PR#")
                .agg({
                    "タイトル": "first",
                    "作成者": "first",
                    "レビュワー": lambda x: ", ".join(sorted(set(x))),
                    "未解決スレッド": "first",
                    "未応答時間(h)": "min",  # 最も古いレビューからの時間
                    "未応答営業日": "min",
                    "URL": "first"
                })
                .reset_index()
            )
            
            # レビュワー別統計
            unresolved_stats = (
                unresolved_reviews.groupby("レビュワー")
                .agg({
                    "PR#": "nunique",
                    "未解決スレッド": "sum",
                    "未応答営業日": "mean"
                })
                .reset_index()
                .rename(columns={
                    "PR#": "未解決PR数",
                    "未解決スレッド": "総未解決スレッド数",
                    "未応答営業日": "平均未応答日数"
                })
                .sort_values("未解決PR数", ascending=False)
            )
            
            col_left, col_right = st.columns([1, 1])
            
            with col_left:
                fig_unresolved = px.bar(
                    unresolved_stats.head(20),
                    x="レビュワー",
                    y="未解決PR数",
                    color="平均未応答日数",
                    text="未解決PR数",
                    color_continuous_scale="Reds",
                    height=350,
                    hover_data={"レビュワー": True, "未解決PR数": True, "総未解決スレッド数": True, "平均未応答日数": ":.1f"}
                )
                fig_unresolved.update_traces(
                    textposition="outside",
                    hovertemplate="<b>%{x}</b><br>%{y}件のPR<br>%{customdata[1]}個の未解決スレッド<br>平均 %{customdata[2]:.1f}営業日<extra></extra>"
                )
                fig_unresolved.update_layout(
                    xaxis_title="レビュワー",
                    yaxis_title="未解決PR数",
                    xaxis_tickangle=-45,
                    margin=dict(l=10, r=10, t=20, b=80),
                    hovermode='closest'
                )
                st.plotly_chart(fig_unresolved, use_container_width=True, key="unresolved_chart")
                st.caption("色が濃いほど未応答時間が長い")
            
            with col_right:
                st.markdown("##### 統計サマリ")
                st.dataframe(
                    unresolved_stats.style.format({
                        "未解決PR数": "{:.0f}",
                        "総未解決スレッド数": "{:.0f}",
                        "平均未応答日数": "{:.1f}"
                    }),
                    use_container_width=True,
                    height=350
                )
            
            st.markdown("---")
            
            # PR別の未解決一覧
            st.markdown("##### 📋 未解決PR一覧 (最後のレビューからの経過時間順)")
            
            selected_unresolved_reviewer = st.selectbox(
                "レビュワーを選択して未解決PRを確認",
                ["すべて"] + unresolved_stats["レビュワー"].tolist(),
                key="unresolved_reviewer_select"
            )
            
            if selected_unresolved_reviewer == "すべて":
                display_unresolved = pr_unresolved
            else:
                # 選択されたレビュワーが含まれるPRのみ
                display_unresolved = pr_unresolved[
                    pr_unresolved["レビュワー"].str.contains(selected_unresolved_reviewer, na=False)
                ]
            
            st.dataframe(
                display_unresolved[["PR#", "タイトル", "作成者", "レビュワー", "未解決スレッド", "未応答営業日", "URL"]].sort_values("未応答営業日", ascending=False).rename(columns={
                    "未応答営業日": "未応答(営業日)"
                }).style.format({
                    "未応答(営業日)": "{:.1f}"
                }),
                use_container_width=True,
                height=400
            )
        else:
            st.success("すべてのレビュースレッドが解決済みです！")
        
        # 新規: コメントスレッドベースの詳細分析
        st.markdown("---")
        st.markdown("#### コメントスレッド詳細分析")
        st.caption("指摘→返信→解決の流れを可視化")
        
        # レビュースレッド詳細情報を展開
        thread_activities = []
        
        for idx, row in filtered_df.iterrows():
            thread_details = row.get("thread_details", [])
            if isinstance(thread_details, list):
                for thread in thread_details:
                    comments = thread.get("comments", [])
                    if comments:
                        # 最初のコメント作成者 (レビュー指摘者)
                        first_comment = comments[0]
                        first_author = first_comment.get("author")
                        first_created_at = first_comment.get("createdAt")
                        
                        # 最後のコメント作成者と時刻
                        last_comment = comments[-1]
                        last_author = last_comment.get("author")
                        last_created_at = last_comment.get("createdAt")
                        
                        # 解決者
                        resolved_by = thread.get("resolvedBy")
                        is_resolved = thread.get("isResolved", False)
                        
                        # 未解決の場合、最初のコメント作成者が応答待ち
                        if not is_resolved and row["state"] == "OPEN":
                            waiting_for = first_author
                        else:
                            waiting_for = None
                        
                        thread_activities.append({
                            "PR#": row["number"],
                            "タイトル": row["title"],
                            "作成者": row["author"],
                            "指摘者": first_author,
                            "指摘日時": first_created_at,
                            "指摘日時_dt": pd.to_datetime(first_created_at, format="ISO8601", utc=True) if first_created_at else None,
                            "最終返信者": last_author,
                            "最終返信日時": last_created_at,
                            "最終返信日時_dt": pd.to_datetime(last_created_at, format="ISO8601", utc=True) if last_created_at else None,
                            "解決済み": is_resolved,
                            "解決者": resolved_by,
                            "応答待ち": waiting_for,
                            "コメント数": len(comments),
                            "PR状態": row["state"],
                            "URL": row["url"]
                        })
        
        if thread_activities:
            thread_df = pd.DataFrame(thread_activities)
            
            # OPENで未解決のスレッドを抽出
            open_unresolved = thread_df[
                (thread_df["PR状態"] == "OPEN") & 
                (~thread_df["解決済み"])
            ].copy()
            
            if not open_unresolved.empty:
                # 現在時刻
                now_utc = datetime.now(timezone.utc)
                
                # 指摘からの経過時間を計算
                open_unresolved["未解決日数"] = open_unresolved["指摘日時_dt"].apply(
                    lambda dt: calculate_business_hours(dt, now_utc) / 24 if pd.notna(dt) else 0
                )
                
                st.markdown("##### 解決待ちレビュワー (OPEN PRのみ)")
                st.caption("指摘したが解決マークをつけていないレビュワー")
                
                # 応答待ちの指摘者ごとに集計
                waiting_stats = (
                    open_unresolved.groupby("応答待ち")
                    .agg({
                        "PR#": "nunique",
                        "指摘日時": "count",
                        "未解決日数": "mean"
                    })
                    .reset_index()
                    .rename(columns={
                        "PR#": "未解決PR数",
                        "指摘日時": "未解決スレッド数",
                        "未解決日数": "平均未解決日数"
                    })
                    .sort_values("未解決スレッド数", ascending=False)
                )
                
                col_left, col_right = st.columns([1, 1])
                
                with col_left:
                    fig_waiting = px.bar(
                        waiting_stats.head(20),
                        x="応答待ち",
                        y="未解決スレッド数",
                        color="平均未解決日数",
                        text="未解決スレッド数",
                        color_continuous_scale="Reds",
                        height=350
                    )
                    fig_waiting.update_traces(
                        textposition="outside",
                        hovertemplate="<b>%{x}</b><br>%{y}個のスレッド未解決<br>平均 %{marker.color:.1f}営業日<extra></extra>"
                    )
                    fig_waiting.update_layout(
                        xaxis_title="解決待ちレビュワー",
                        yaxis_title="未解決スレッド数",
                        xaxis_tickangle=-45,
                        margin=dict(l=10, r=10, t=20, b=80)
                    )
                    st.plotly_chart(fig_waiting, use_container_width=True, key="waiting_threads_chart")
                
                with col_right:
                    st.dataframe(
                        waiting_stats.style.format({
                            "未解決PR数": "{:.0f}",
                            "未解決スレッド数": "{:.0f}",
                            "平均未解決日数": "{:.1f}"
                        }),
                        use_container_width=True,
                        height=350
                    )
                
                st.markdown("---")
                st.markdown("##### 📋 未解決スレッド詳細")
                
                selected_waiter = st.selectbox(
                    "解決待ちレビュワーを選択",
                    ["すべて"] + waiting_stats["応答待ち"].tolist(),
                    key="waiting_select"
                )
                
                if selected_waiter == "すべて":
                    display_waiting = open_unresolved
                else:
                    display_waiting = open_unresolved[open_unresolved["応答待ち"] == selected_waiter]
                
                st.dataframe(
                    display_waiting[["PR#", "タイトル", "作成者", "指摘者", "最終返信者", "コメント数", "未解決日数", "URL"]].sort_values("未解決日数", ascending=False).rename(columns={
                        "未解決日数": "未解決(営業日)"
                    }).style.format({
                        "未解決(営業日)": "{:.1f}"
                    }),
                    use_container_width=True,
                    height=400
                )
            else:
                st.info("未解決スレッドなし")
        else:
            st.warning("""
            ### 📌 スレッド情報がありません
            
            コメントスレッド詳細分析を利用するには、最新のデータ形式でPRデータを再取得する必要があります。
            
            **更新方法:**
            1. サイドバーの「GitHub更新」ボタンをクリック
            2. または、コマンドラインで `python fetch_data.py --all --force` を実行
            
            データ更新後、このページを再読み込みしてください。
            """)
    else:
        st.info("レビュー情報なし")

with tab4:
    st.markdown("### 時系列トレンド分析")
    
    # 週ごとの集計
    df_timeline = filtered_df.copy()
    df_timeline["week"] = df_timeline["createdAt_dt"].dt.to_period("W").astype(str)
    
    weekly_stats = (
        df_timeline.groupby(["week", "state"], observed=True)
        .size()
        .reset_index(name="count")
    )
    
    st.markdown("#### 週次PR作成数")
    fig_weekly = px.line(
        weekly_stats,
        x="week",
        y="count",
        color="state",
        markers=True,
        height=350
    )
    fig_weekly.update_layout(
        margin=dict(l=10, r=10, t=20, b=80),
        xaxis_tickangle=-45,
        xaxis_title="週",
        yaxis_title="PR数"
    )
    st.plotly_chart(fig_weekly, use_container_width=True)
    
    st.markdown("---")
    
    # 累積PR数
    st.markdown("#### 累積PR数推移")
    cumulative = (
        df_timeline.groupby(["week", "state"], observed=True)
        .size()
        .groupby(level=1)
        .cumsum()
        .reset_index(name="cumulative")
    )
    cumulative["week"] = weekly_stats["week"]
    cumulative["state"] = weekly_stats["state"]
    
    fig_cumulative = px.line(
        cumulative,
        x="week",
        y="cumulative",
        color="state",
        markers=True,
        height=350
    )
    fig_cumulative.update_layout(
        margin=dict(l=10, r=10, t=20, b=80),
        xaxis_tickangle=-45,
        xaxis_title="週",
        yaxis_title="累積PR数"
    )
    st.plotly_chart(fig_cumulative, use_container_width=True)

with tab5:
    st.markdown("### レビューボトルネック分析")
    st.caption("誰がレビュー待ちPRを多く抱えているかを分析")
    
    open_prs = raw_df[raw_df["state"] == "OPEN"].copy()
    
    if open_prs.empty:
        st.info("OPEN PR なし")
    else:
        # アクション集計
        user_actions = action_tracker.build_action_summary(open_prs.to_dict('records'))
        
        if not user_actions:
            st.info("アクション待ちPRなし")
        else:
            # レビュアー別の待ちPR数
            reviewer_stats = []
            reviewer_prs = {}  # レビュアーごとのPR情報を保存
            
            for user, actions in user_actions.items():
                reviewer_actions = [a for a in actions if a["role"] == "reviewer"]
                if reviewer_actions:
                    total_prs = len(reviewer_actions)
                    avg_age = sum(a["pr"].get("age_hours", 0) for a in reviewer_actions) / total_prs
                    stale_count = sum(1 for a in reviewer_actions if a["pr"].get("age_hours", 0) > 168)
                    
                    reviewer_stats.append({
                        "レビュアー": user,
                        "待ちPR数": total_prs,
                        "平均待ち時間(日)": avg_age / 24,
                        "滞留PR数(>7日)": stale_count
                    })
                    
                    # PRリスト保存
                    reviewer_prs[user] = [a["pr"] for a in reviewer_actions]
            
            if reviewer_stats:
                st.markdown("#### レビュアー別 待ちPR数")
                reviewer_df = pd.DataFrame(reviewer_stats).sort_values("待ちPR数", ascending=False)
                
                fig_reviewer = px.bar(
                    reviewer_df.head(20),
                    x="レビュアー",
                    y="待ちPR数",
                    color="滞留PR数(>7日)",
                    text="待ちPR数",
                    color_continuous_scale="Reds",
                    hover_data={"レビュアー": True, "待ちPR数": True, "平均待ち時間(日)": ":.1f"}
                )
                fig_reviewer.update_traces(
                    textposition="outside",
                    hovertemplate="<b>%{x}</b><br>%{y}件待ち<br>平均 %{customdata[0]:.1f}日<extra></extra>",
                    customdata=reviewer_df.head(20)[["平均待ち時間(日)"]].values
                )
                fig_reviewer.update_layout(
                    xaxis_title="レビュアー",
                    yaxis_title="待ちPR数",
                    height=400,
                    hovermode='closest'
                )
                st.plotly_chart(fig_reviewer, use_container_width=True, key="reviewer_chart")
                st.caption("レビュアー別の待機PR数 | バーをホバーで詳細確認")
                
                st.dataframe(
                    reviewer_df.style.format({
                        "待ちPR数": "{:.0f}",
                        "平均待ち時間(日)": "{:.1f}",
                        "滞留PR数(>7日)": "{:.0f}"
                    }),
                    use_container_width=True,
                    height=300
                )
                
                # レビュアー選択してPR一覧表示
                st.markdown("---")
                st.markdown("#### 📋 レビュアー別 待ちPR詳細")
                selected_reviewer = st.selectbox(
                    "レビュアーを選択",
                    ["すべて"] + reviewer_df["レビュアー"].tolist(),
                    key="reviewer_select"
                )
                
                if selected_reviewer == "すべて":
                    all_reviewer_prs = []
                    for user, prs in reviewer_prs.items():
                        for pr in prs:
                            pr_copy = pr.copy()
                            pr_copy["reviewer"] = user
                            all_reviewer_prs.append(pr_copy)
                    display_prs = pd.DataFrame(all_reviewer_prs)
                else:
                    display_prs = pd.DataFrame(reviewer_prs[selected_reviewer])
                    display_prs["reviewer"] = selected_reviewer
                
                if not display_prs.empty:
                    display_cols = ["number", "title", "author", "reviewer", "age_hours", "url"]
                    if "reviewer" not in display_prs.columns:
                        display_cols.remove("reviewer")
                    
                    available_cols = [col for col in display_cols if col in display_prs.columns]
                    st.dataframe(
                        display_prs[available_cols].sort_values("age_hours", ascending=False).rename(columns={
                            "number": "PR#",
                            "title": "タイトル",
                            "author": "作成者",
                            "reviewer": "レビュアー",
                            "age_hours": "待ち時間(h)",
                            "url": "URL"
                        }),
                        use_container_width=True,
                        height=400
                    )
            
            # 作成者別の待ち（修正待ち）
            st.markdown("---")
            st.markdown("#### ✍️ 作成者別 修正待ちPR数")
            
            author_stats = []
            author_prs = {}  # 作成者ごとのPR情報を保存
            
            for user, actions in user_actions.items():
                author_actions = [a for a in actions if a["role"] == "author"]
                if author_actions:
                    total_prs = len(author_actions)
                    avg_age = sum(a["pr"].get("age_hours", 0) for a in author_actions) / total_prs
                    stale_count = sum(1 for a in author_actions if a["pr"].get("age_hours", 0) > 168)
                    
                    author_stats.append({
                        "作成者": user,
                        "修正待ちPR数": total_prs,
                        "平均待ち時間(日)": avg_age / 24,
                        "滞留PR数(>7日)": stale_count
                    })
                    
                    # PRリスト保存
                    author_prs[user] = [a["pr"] for a in author_actions]
            
            if author_stats:
                author_df = pd.DataFrame(author_stats).sort_values("修正待ちPR数", ascending=False)
                
                fig_author = px.bar(
                    author_df.head(20),
                    x="作成者",
                    y="修正待ちPR数",
                    color="滞留PR数(>7日)",
                    text="修正待ちPR数",
                    color_continuous_scale="Oranges",
                    hover_data={"作成者": True, "修正待ちPR数": True, "平均待ち時間(日)": ":.1f"}
                )
                fig_author.update_traces(
                    textposition="outside",
                    hovertemplate="<b>%{x}</b><br>%{y}件修正待ち<br>平均 %{customdata[0]:.1f}日<extra></extra>",
                    customdata=author_df.head(20)[["平均待ち時間(日)"]].values
                )
                fig_author.update_layout(
                    xaxis_title="作成者",
                    yaxis_title="修正待ちPR数",
                    height=400,
                    hovermode='closest'
                )
                st.plotly_chart(fig_author, use_container_width=True, key="author_chart")
                st.caption("作成者別の修正待ちPR数 | バーをホバーで詳細確認")
                
                st.dataframe(
                    author_df.style.format({
                        "修正待ちPR数": "{:.0f}",
                        "平均待ち時間(日)": "{:.1f}",
                        "滞留PR数(>7日)": "{:.0f}"
                    }),
                    use_container_width=True,
                    height=300
                )
                
                # 作成者選択してPR一覧表示
                st.markdown("---")
                st.markdown("#### 📋 作成者別 修正待ちPR詳細")
                selected_author = st.selectbox(
                    "作成者を選択",
                    ["すべて"] + author_df["作成者"].tolist(),
                    key="author_select"
                )
                
                if selected_author == "すべて":
                    all_author_prs = []
                    for user, prs in author_prs.items():
                        for pr in prs:
                            all_author_prs.append(pr)
                    display_prs = pd.DataFrame(all_author_prs)
                else:
                    display_prs = pd.DataFrame(author_prs[selected_author])
                
                if not display_prs.empty:
                    display_cols = ["number", "title", "author", "age_hours", "url"]
                    available_cols = [col for col in display_cols if col in display_prs.columns]
                    st.dataframe(
                        display_prs[available_cols].sort_values("age_hours", ascending=False).rename(columns={
                            "number": "PR#",
                            "title": "タイトル",
                            "author": "作成者",
                            "age_hours": "待ち時間(h)",
                            "url": "URL"
                        }),
                        use_container_width=True,
                        height=400
                    )

with tab6:
    st.markdown("### レビュー速度分析")
    st.caption("レビューにかかる時間を分析してプロセス改善のヒントを見つける")
    
    merged_prs = raw_df[raw_df["state"] == "MERGED"].copy()
    
    if merged_prs.empty:
        st.info("マージ済みPRなし")
    else:
        # タイムラインイベントからレビュー時間を計算
        review_times = []
        
        for idx, row in merged_prs.iterrows():
            created = row["createdAt_dt"]
            merged = row["mergedAt_dt"]
            
            # 初回レビューコメント時間を探す（簡易版: コメント数があればレビュー済みと仮定）
            comments_count = row.get("comments_count", 0)
            reviews_count = row.get("reviews_count", 0)
            
            if reviews_count > 0 or comments_count > 0:
                # マージまでの時間を営業日で計算
                merge_hours = calculate_business_hours(created, merged)
                
                review_times.append({
                    "PR#": row["number"],
                    "タイトル": row["title"],
                    "作成者": row["author"],
                    "作成日": created,
                    "マージ日": merged,
                    "レビュー時間(営業日)": merge_hours / 24,
                    "コメント数": comments_count,
                    "レビュー数": reviews_count,
                    "URL": row["url"]
                })
        
        if review_times:
            review_df = pd.DataFrame(review_times)
            
            col_left, col_right = st.columns([1, 1])
            
            with col_left:
                st.markdown("#### レビュー完了時間の分布")
                fig_review_dist = px.histogram(
                    review_df,
                    x="レビュー時間(営業日)",
                    nbins=30,
                    height=350,
                    labels={"レビュー時間(営業日)": "レビュー時間 (営業日)"}
                )
                fig_review_dist.update_traces(
                    hovertemplate="<b>%{x:.1f}営業日</b><br>%{y}件<extra></extra>"
                )
                fig_review_dist.update_layout(
                    margin=dict(l=10, r=10, t=20, b=30),
                    yaxis_title="PR数"
                )
                st.plotly_chart(fig_review_dist, use_container_width=True, key="review_dist_chart")
                st.caption("作成からマージまでの営業日数")
            
            with col_right:
                st.markdown("#### 統計サマリ")
                avg_time = review_df["レビュー時間(営業日)"].mean()
                median_time = review_df["レビュー時間(営業日)"].median()
                p75_time = review_df["レビュー時間(営業日)"].quantile(0.75)
                p95_time = review_df["レビュー時間(営業日)"].quantile(0.95)
                
                st.metric("平均レビュー時間", f"{avg_time:.1f}営業日")
                st.metric("中央値", f"{median_time:.1f}営業日")
                st.metric("75%タイル", f"{p75_time:.1f}営業日")
                st.metric("95%タイル", f"{p95_time:.1f}営業日")
            
            st.markdown("---")
            
            # 作成者別のレビュー時間
            st.markdown("#### 👤 作成者別レビュー時間")
            author_review_time = (
                review_df.groupby("作成者")
                .agg({
                    "レビュー時間(営業日)": ["count", "mean", "median"],
                    "PR#": "count"
                })
                .reset_index()
            )
            author_review_time.columns = ["作成者", "PR数_", "平均時間", "中央値時間", "PR数"]
            author_review_time = author_review_time[["作成者", "PR数", "平均時間", "中央値時間"]]
            author_review_time = author_review_time.sort_values("PR数", ascending=False).head(20)
            
            fig_author_review = px.bar(
                author_review_time,
                x="作成者",
                y="平均時間",
                text="PR数",
                height=350,
                hover_data={"作成者": True, "平均時間": ":.1f", "中央値時間": ":.1f", "PR数": True}
            )
            fig_author_review.update_traces(
                textposition="outside",
                hovertemplate="<b>%{x}</b><br>平均 %{y:.1f}営業日<br>%{text}件<extra></extra>"
            )
            fig_author_review.update_layout(
                xaxis_title="作成者",
                yaxis_title="平均レビュー時間 (営業日)",
                height=400,
                hovermode='closest'
            )
            st.plotly_chart(fig_author_review, use_container_width=True, key="author_review_chart")
            st.caption("作成者別の平均レビュー完了時間 (TOP20)")
            
            st.dataframe(
                author_review_time.style.format({
                    "PR数": "{:.0f}",
                    "平均時間": "{:.1f}",
                    "中央値時間": "{:.1f}"
                }),
                use_container_width=True,
                height=300
            )
            
            st.markdown("---")
            st.markdown("#### 📋 レビュー時間が長いPR")
            slow_prs = review_df.nlargest(20, "レビュー時間(営業日)")
            st.dataframe(
                slow_prs[["PR#", "タイトル", "作成者", "レビュー時間(営業日)", "コメント数", "URL"]],
                use_container_width=True,
                height=400
            )
        else:
            st.info("レビュー済みPRなし")

with tab7:
    st.markdown("### 変更パターン分析")
    st.caption("どのファイルが頻繁に変更されているかを分析")
    
    # ファイル変更情報を収集
    file_changes = []
    
    for idx, row in filtered_df.iterrows():
        changed_files = row.get("changed_files", [])
        additions = row.get("additions", 0)
        deletions = row.get("deletions", 0)
        
        if isinstance(changed_files, list) and changed_files:
            for file_path in changed_files:
                file_changes.append({
                    "PR#": row["number"],
                    "ファイル": file_path,
                    "作成者": row["author"],
                    "追加行数": additions,
                    "削除行数": deletions,
                    "変更総行数": additions + deletions,
                    "状態": row["state"]
                })
    
    if file_changes:
        files_df = pd.DataFrame(file_changes)
        
        # ファイル別変更頻度
        st.markdown("#### 最も変更されるファイル TOP30")
        file_freq = (
            files_df.groupby("ファイル")
            .agg({
                "PR#": "count",
                "変更総行数": "sum"
            })
            .reset_index()
            .rename(columns={"PR#": "変更回数"})
            .sort_values("変更回数", ascending=False)
            .head(30)
        )
        
        fig_files = px.bar(
            file_freq,
            x="ファイル",
            y="変更回数",
            height=400,
            hover_data={"ファイル": True, "変更回数": True, "変更総行数": True}
        )
        fig_files.update_traces(
            hovertemplate="<b>%{x}</b><br>%{y}回変更<br>%{customdata[0]}行<extra></extra>"
        )
        fig_files.update_layout(
            xaxis_title="ファイルパス",
            yaxis_title="変更回数",
            xaxis_tickangle=-45,
            margin=dict(l=10, r=10, t=20, b=150),
            hovermode='closest'
        )
        st.plotly_chart(fig_files, use_container_width=True, key="files_chart")
        st.caption("変更頻度が高いファイルはレビュー負荷や不具合の温床になりやすい")
        
        st.dataframe(
            file_freq.style.format({
                "変更回数": "{:.0f}",
                "変更総行数": "{:.0f}"
            }),
            use_container_width=True,
            height=300
        )
        
        st.markdown("---")
        
        # PR規模分析
        st.markdown("#### 📏 PR規模の分布")
        
        pr_sizes = (
            filtered_df.groupby("number")
            .agg({
                "additions": "first",
                "deletions": "first",
                "changed_files_count": "first",
                "title": "first",
                "author": "first",
                "state": "first"
            })
            .reset_index()
        )
        pr_sizes["変更総行数"] = pr_sizes["additions"] + pr_sizes["deletions"]
        
        col_left, col_right = st.columns([1, 1])
        
        with col_left:
            st.markdown("##### 変更行数の分布")
            fig_size_dist = px.histogram(
                pr_sizes,
                x="変更総行数",
                nbins=50,
                height=300,
                labels={"変更総行数": "変更行数"}
            )
            fig_size_dist.update_traces(
                hovertemplate="<b>%{x:.0f}行</b><br>%{y}件のPR<extra></extra>"
            )
            fig_size_dist.update_layout(
                margin=dict(l=10, r=10, t=20, b=30),
                yaxis_title="PR数"
            )
            st.plotly_chart(fig_size_dist, use_container_width=True, key="size_dist_chart")
        
        with col_right:
            st.markdown("##### ファイル数の分布")
            fig_files_dist = px.histogram(
                pr_sizes,
                x="changed_files_count",
                nbins=30,
                height=300,
                labels={"changed_files_count": "変更ファイル数"}
            )
            fig_files_dist.update_traces(
                hovertemplate="<b>%{x:.0f}ファイル</b><br>%{y}件のPR<extra></extra>"
            )
            fig_files_dist.update_layout(
                margin=dict(l=10, r=10, t=20, b=30),
                yaxis_title="PR数"
            )
            st.plotly_chart(fig_files_dist, use_container_width=True, key="files_dist_chart")
        
        st.markdown("---")
        st.markdown("#### 🐘 大規模PR (変更行数 TOP20)")
        large_prs = pr_sizes.nlargest(20, "変更総行数")
        st.dataframe(
            large_prs[["number", "title", "author", "変更総行数", "changed_files_count", "state"]].rename(columns={
                "number": "PR#",
                "title": "タイトル",
                "author": "作成者",
                "changed_files_count": "ファイル数",
                "state": "状態"
            }),
            use_container_width=True,
            height=400
        )
        st.caption("💡 大規模PRはレビューが困難になりがち。分割を検討しよう")
    else:
        st.info("ファイル変更情報なし")


t1 = time.perf_counter()
set_progress(100, "完了")
progress.empty()
progress_txt.empty()
status_ph.success("描画完了！")

now_jst = datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S %Z")
st.caption(f"最終更新: {now_jst} ｜ 所要時間: {(t1 - t0):.2f} 秒")

if show_debug:
    with st.expander("描画ログ（内部ステップ）"):
        st.write(
            {
                "owner": owner,
                "repo": repo,
                "days": days,
                "state_filter": state_filter,
                "records_after_filter": int(len(filtered_df)),
            }
        )
