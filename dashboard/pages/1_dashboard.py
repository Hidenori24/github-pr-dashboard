# dashboard.py - GitHub PR dashboard (Streamlit)
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Tuple

import pandas as pd
import plotly.express as px
import streamlit as st
from zoneinfo import ZoneInfo

import action_tracker

import config
from fetcher import run_query
import db_cache  # SQLiteキャッシュ


st.set_page_config(page_title="PRダッシュボード", layout="wide", page_icon="")

st.markdown(
    """
    <style>
    h1, h2, h3 { margin-bottom: 0.4rem; }
    section[data-testid=\"stSidebar\"] .stMarkdown { font-size: 0.95rem; }
    div[data-testid=\"stMetric\"] { background: #fafafa; border: 1px solid #eee; border-radius: 12px; padding: 12px; }
    div[data-testid=\"stDataFrame\"] { border: 1px solid #eee; border-radius: 10px; }
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
        match = re.search(r"github\\.com/([^/\\s]+)/([^/\\s]+)", src or "")
        if match:
            return match.group(1), match.group(2).rstrip("/")
        return None

    parsed = extract_from_url(owner_in) or extract_from_url(repo_in)
    if parsed:
        return parsed
    return (owner_in or "").strip().strip("/"), (repo_in or "").strip().strip("/")


def build_pr_timeline_df(source: pd.DataFrame, compact: bool = False) -> pd.DataFrame:
    """Create a DataFrame tailored for Plotly timeline charts."""

    now_iso = datetime.now(timezone.utc).isoformat()
    df = source.copy()
    df["Start"] = pd.to_datetime(df["createdAt"], format="ISO8601", utc=True)
    df["Finish"] = pd.to_datetime(
        df["mergedAt"].fillna(df["closedAt"]).fillna(now_iso), format="ISO8601", utc=True
    )

    if compact:
        df["Task"] = "#" + df["number"].astype(str)
    else:
        df["Task"] = (
            "#" + df["number"].astype(str)
            + ": "
            + df["title"].fillna("")
            + "  ("
            + df["author"].fillna("")
            + ")"
        )

    df["title_info"] = df["title"].fillna("")
    df["author_info"] = df["author"].fillna("")
    
    # 営業日ベースの経過時間を計算
    df["business_hours"] = df.apply(
        lambda row: calculate_business_hours(row["Start"], row["Finish"]),
        axis=1
    )
    df["business_days"] = (df["business_hours"] / 24).round(1)
    
    # 担当者情報を追加
    df["action_owner"] = df.apply(
        lambda row: action_tracker.format_action_for_hover(row.to_dict()), 
        axis=1
    )

    return df[
        [
            "number",
            "Task",
            "Start",
            "Finish",
            "state",
            "age_hours",
            "business_hours",
            "business_days",
            "comments_count",
            "changes_requested",
            "url",
            "title_info",
            "author_info",
            "action_owner",
        ]
    ]


def build_files_table(df_all: pd.DataFrame) -> pd.DataFrame:
    """Explode file paths per PR."""

    pr_cols = [
        "number",
        "title",
        "url",
        "state",
        "author",
        "createdAt",
        "closedAt",
        "mergedAt",
        "age_hours",
        "comments_count",
        "changes_requested",
    ]
    pr_uni = df_all.drop_duplicates("number")[pr_cols + ["files"]].copy()
    pr_uni = pr_uni.explode("files").dropna(subset=["files"])
    if pr_uni.empty:
        return pr_uni
    pr_uni["createdAt_dt"] = pd.to_datetime(pr_uni["createdAt"], format="ISO8601", utc=True)
    return pr_uni


def dir_key(path: str, depth: int) -> str:
    parts = (path or "").split("/")
    if depth <= 0:
        return path or ""
    if len(parts) <= depth:
        return "/".join(parts)
    return "/".join(parts[:depth])


def build_path_tree(paths: Iterable[str]) -> dict:
    tree: dict = {}
    for raw_path in paths:
        path = (raw_path or "").strip("/")
        if not path:
            continue
        parts = path.split("/")
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node.setdefault("__files__", set()).add(parts[-1])
    return tree


def reset_directory_explorer(key_prefix: str) -> None:
    targets = [
        key
        for key in st.session_state.keys()
        if key.startswith(f"{key_prefix}_dir_") or key == f"{key_prefix}_file"
    ]
    for key in targets:
        del st.session_state[key]


def directory_explorer_v2(
    paths: Iterable[str], key_prefix: str = "explorer"
) -> Tuple[str, str]:
    """
    Windows風の階層的ファイルエクスプローラ（クリック可能なパンくずリスト）
    Returns: (selected_path, level: 'file' or 'dir')
    """
    tree = build_path_tree(paths)
    
    # セッション状態で現在のパスを管理
    if f"{key_prefix}_current_path" not in st.session_state:
        st.session_state[f"{key_prefix}_current_path"] = []
    
    current_path = st.session_state[f"{key_prefix}_current_path"]
    
    # 現在のノードに移動
    node = tree
    for part in current_path:
        node = node.get(part, {})
    
    # パンくずリスト（クリック可能）
    st.markdown("**📍 現在地:**")
    breadcrumb_cols = st.columns(len(current_path) + 2)  # root + 各階層 + 上へボタン
    
    # rootボタン
    with breadcrumb_cols[0]:
        if st.button("", key=f"{key_prefix}_root", help="ルートへ戻る"):
            st.session_state[f"{key_prefix}_current_path"] = []
            st.rerun()
    
    # 各階層のボタン
    for idx, part in enumerate(current_path):
        with breadcrumb_cols[idx + 1]:
            # 最後の階層は太字で表示（現在地）
            if idx == len(current_path) - 1:
                st.markdown(f"**/{part}**")
            else:
                if st.button(f"/{part}", key=f"{key_prefix}_bread_{idx}"):
                    st.session_state[f"{key_prefix}_current_path"] = current_path[:idx + 1]
                    st.rerun()
    
    # 上へボタン
    if current_path:
        with breadcrumb_cols[-1]:
            if st.button("⬆️ 上へ", key=f"{key_prefix}_up"):
                st.session_state[f"{key_prefix}_current_path"] = current_path[:-1]
                st.rerun()
    
    st.markdown("---")
    
    # ディレクトリとファイルを取得
    dirs = sorted([name for name in node.keys() if name != "__files__"])
    files = sorted(node.get("__files__", []))
    
    # ディレクトリリスト（クリックで開く）
    if dirs:
        st.markdown("### 📂 フォルダ")
        for dir_name in dirs:
            if st.button(f"{dir_name}", key=f"{key_prefix}_dir_{dir_name}", use_container_width=True):
                st.session_state[f"{key_prefix}_current_path"] = current_path + [dir_name]
                st.rerun()
    
    # ファイルリスト
    if files:
        st.markdown("### 📄 ファイル")
        selected_file = st.radio(
            "ファイルを選択",
            files,
            key=f"{key_prefix}_file_radio",
            label_visibility="collapsed",
            format_func=lambda x: f"📄 {x}"
        )
        if selected_file:
            full_path = "/".join(current_path + [selected_file]) if current_path else selected_file
            return full_path, "file"
    
    if not dirs and not files:
        st.info("フォルダもファイルもありません")
    
    # ディレクトリ全体を選択
    if current_path:
        full_dir_path = "/".join(current_path)
        return full_dir_path, "dir"
    
    return "", "dir"


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


def compute_and_cache_stats(owner: str, repo: str, raw_df: pd.DataFrame, filtered_df: pd.DataFrame, files_df_all: pd.DataFrame = None) -> None:
    """
    統計情報を事前計算してDBに保存（ファイルツリー含む）
    """
    stats = {}
    
    # サマリ統計
    stats['summary'] = {
        'total_count': len(raw_df),
        'open_count': int((raw_df["state"] == "OPEN").sum()),
        'closed_count': int((raw_df["state"] == "CLOSED").sum()),
        'merged_count': int((raw_df["state"] == "MERGED").sum()),
        'latest_created': raw_df["createdAt_dt"].max().isoformat() if not raw_df.empty else None,
    }
    
    open_only = filtered_df[filtered_df["state"] == "OPEN"]
    if not open_only.empty:
        stats['summary']['median_open_age'] = float(open_only["age_hours"].median())
    else:
        stats['summary']['median_open_age'] = 0.0
    
    # 滞留バケット集計
    if not open_only.empty:
        bucket_counts = (
            open_only.groupby("age_bucket", observed=True)
            .size()
            .reset_index(name="count")
        )
        bucket_counts["age_bucket"] = bucket_counts["age_bucket"].astype(str)
        stats['buckets'] = bucket_counts.to_dict('records')
    
    # DBに保存
    db_cache.save_aggregated_stats(owner, repo, 'summary', stats)
    
    # ファイルツリーとディレクトリ統計をキャッシュ
    if files_df_all is not None and not files_df_all.empty:
        # ファイルパス一覧とツリー構造
        all_paths = sorted(set(files_df_all["files"].dropna().astype(str)))
        path_tree = build_path_tree(all_paths)
        db_cache.save_file_tree(owner, repo, all_paths, path_tree)
        
        # ディレクトリ統計
        files_df_copy = files_df_all.copy()
        files_df_copy["dir_key"] = files_df_copy["files"].apply(
            lambda p: "/".join(str(p).split("/")[:-1]) if "/" in str(p) else "(root)"
        )
        
        dir_agg = (
            files_df_copy.groupby("dir_key", observed=True)
            .agg(
                total_prs=("number", lambda s: len(set(s))),
                open_cnt=("state", lambda s: int((s == "OPEN").sum())),
                last_activity=("createdAt_dt", "max"),
            )
            .reset_index()
        )
        db_cache.save_dir_stats(owner, repo, dir_agg)


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
    """
    PRデータを取得（強制更新時のみGitHub APIを呼び出す）
    通常はローカルキャッシュから読み込み
    """
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
        
        # ETag情報を保存
        if new_etag or new_last_modified:
            db_cache.save_etag(owner, repo, new_etag, new_last_modified)
        
        if is_modified and pr_list:
            # 変更あり → DBに保存
            db_cache.save_prs(owner, repo, pr_list)
            return pr_list, "API (updated)"
        elif not is_modified:
            # 変更なし → DBから読み込み
            return load_local_prs(owner, repo, cutoff_dt)
        else:
            # 空の場合もDBから
            return load_local_prs(owner, repo, cutoff_dt)
            
    except Exception as e:
        # API失敗時はキャッシュにフォールバック
        cached_data, source = load_local_prs(owner, repo, cutoff_dt)
        if cached_data:
            return cached_data, f"Cache (API error: {str(e)[:50]})"
        raise


st.title("PR ダッシュボード")

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
    stale_hours = st.slider("Stale 判定時間 (h)", 24, 720, 168, step=24)

    st.divider()
    
    st.header("⚙️ 表示オプション")
    show_only_open_groups = st.checkbox(
        "OPENのみ表示（書類/コード）", value=config.DEFAULT_SHOW_ONLY_OPEN_GROUPS
    )
    show_debug = st.checkbox("デバッグ情報を表示", value=False)
    
    # ========== データ更新（必要な時だけ） ==========
    st.divider()
    
    # 更新ボタン（セッションステートで管理）
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
                
                # 定期更新の案内
                if age_hours > 24:
                    st.warning("データが24時間以上古いです")
                    st.caption("💡 `python fetch_data.py` で更新")
            else:
                st.info("キャッシュなし")
                st.caption("💡 `python fetch_data.py` を実行してください")


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
set_progress(5, "入力を確認中")
status_ph.info("PR データを読み込み中...")

cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)

try:
    force_refresh = st.session_state.refresh_count > 0
    data, source = fetch_and_cache_prs(owner, repo, cutoff_dt, force_refresh=force_refresh)
    
    # refresh_countをリセット（次回は通常モード）
    if force_refresh and st.session_state.refresh_count > 0:
        st.session_state.refresh_count = 0
    
    if source.startswith("API"):
        status_ph.success(f"GitHub APIから{len(data)}件取得しました")
    elif source == "Local cache":
        status_ph.success(f"ローカルキャッシュから{len(data)}件読み込みました（高速表示）")
    else:
        status_ph.info(f"{source}: {len(data)}件")
        
except Exception as exc:  # pragma: no cover
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

bins = [0, 24, 72, 168, 336, 672, 999999]
labels = ["<1d", "1-3d", "3-7d", "7-14d", "14-28d", ">=28d"]
raw_df["age_bucket"] = pd.cut(raw_df["age_hours"], bins=bins, labels=labels, right=False)

if not state_filter:
    status_ph.warning("ステータスが一つも選ばれてないから、全ステータスを対象にするね。")
    state_filter = ["OPEN", "CLOSED", "MERGED"]

filtered_df = raw_df[raw_df["state"].isin(state_filter)].copy()
filtered_df.sort_values("createdAt_dt", ascending=False, inplace=True)
filtered_df.reset_index(drop=True, inplace=True)

set_progress(55, "メトリクスを計算中")

# ファイルテーブルを先に構築（キャッシュ用）
files_df_all = build_files_table(filtered_df)

# 統計情報を計算してDBにキャッシュ（API取得時のみ、ファイル情報含む）
if source == "API" or source.startswith("API"):
    compute_and_cache_stats(owner, repo, raw_df, filtered_df, files_df_all)

open_only = filtered_df[filtered_df["state"] == "OPEN"].copy()
uniq_all = filtered_df.copy()
uniq = filtered_df.copy()

# キャッシュされた統計を読み込み（1時間有効）
cached_stats = db_cache.load_aggregated_stats(owner, repo, 'summary', max_age_minutes=60)
if cached_stats and 'summary' in cached_stats:
    summary = cached_stats['summary']
    latest_created_iso = summary.get('latest_created')
    if latest_created_iso:
        latest_created = pd.to_datetime(latest_created_iso, utc=True).tz_convert(JST)
    else:
        latest_created = raw_df["createdAt_dt"].max().tz_convert(JST)
    open_count = summary.get('open_count', 0)
    closed_count = summary.get('closed_count', 0)
    merged_count = summary.get('merged_count', 0)
    median_open_age = summary.get('median_open_age', 0.0)
else:
    # フォールバック: リアルタイム計算
    latest_created = raw_df["createdAt_dt"].max().tz_convert(JST)
    open_count = int((raw_df["state"] == "OPEN").sum())
    closed_count = int((raw_df["state"] == "CLOSED").sum())
    merged_count = int((raw_df["state"] == "MERGED").sum())
    median_open_age = open_only["age_hours"].median() if not open_only.empty else 0

with st.container():
    now_jst = datetime.now(JST)
    st.markdown(
        f"### {owner}/{repo}"
    )
    st.caption(f"最新PR作成: {latest_created.strftime('%Y-%m-%d %H:%M')} JST | "
               f"キャッシュ有効期限: 24時間 | "
               f"表示時刻: {now_jst.strftime('%Y-%m-%d %H:%M')} JST")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("総PR件数 (フィルタ後)", len(uniq))
    col2.metric("OPEN", open_count)
    col3.metric("MERGED", merged_count)
    col4.metric("CLOSED", closed_count)
    st.markdown(
        f"<span class='badge strong'>OPEN中央値: {median_open_age:.1f} h</span>"
        f"<span class='badge'>データ期間: 過去 {days} 日</span>",
        unsafe_allow_html=True,
    )

set_progress(70, "グラフ描画の準備")

st.markdown("---")

# === タブセクション: PRタイムライン & 書類/コード & アクション待ち ===
tab1, tab2, tab3 = st.tabs(
    [
        "PRタイムライン",
        "ファイル変更",
        "アクション待ち",
    ]
)

with tab1:
    st.markdown('### PRタイムライン')
    show_states = st.multiselect(
        "表示する状態",
        options=["OPEN", "CLOSED", "MERGED"],
        default=config.DEFAULT_GANTT_STATES,
        key="gantt_states",
    )
    initial_top_n = max(10, min(400, int(config.DEFAULT_GANTT_TOP_N)))
    top_n = st.slider(
        "最大表示PR数（新しい順）",
        10,
        400,
        initial_top_n,
        step=10,
        key="gantt_top_n",
    )
    
    # ソート順選択
    sort_mode = st.radio(
        "並び順",
        ["開始が新しい順", "開始が古い順", "期間が長い順"],
        index=0,
        horizontal=True,
        key="gantt_sort"
    )
    
    color_mode_options = ["state（状態）", "滞留時間（連続）"]
    default_color_index = (
        color_mode_options.index(config.DEFAULT_GANTT_COLOR_MODE)
        if config.DEFAULT_GANTT_COLOR_MODE in color_mode_options
        else 0
    )
    color_mode = st.selectbox(
        "色分け",
        color_mode_options,
        index=default_color_index,
        key="gantt_color",
    )

    src = uniq_all[uniq_all["state"].isin(show_states)].sort_values(
        "createdAt_dt", ascending=False
    )
    src = src.head(top_n)

    if src.empty:
        st.info("該当するPRがありません")
    else:
        # compact=True でPR番号のみ表示
        tl_df = build_pr_timeline_df(src, compact=True)

        # PR番号とURLのマッピングを作成
        pr_number_to_url = dict(zip(tl_df["Task"], tl_df["url"]))

        # ソート順を適用
        if sort_mode == "開始が新しい順":
            tl_df = tl_df.sort_values("Start", ascending=True)
        elif sort_mode == "開始が古い順":
            tl_df = tl_df.sort_values("Start", ascending=False)
        else:
            tl_df["duration"] = (tl_df["Finish"] - tl_df["Start"]).dt.total_seconds()
            tl_df = tl_df.sort_values("duration", ascending=True)

        task_order = tl_df["Task"].tolist()
        chart_height = max(350, min(1200, len(tl_df) * 18))

        fig_timeline = px.timeline(
            tl_df,
            x_start="Start",
            x_end="Finish",
            y="Task",
            color=("state" if color_mode.startswith("state") else "age_hours"),
            hover_data={
                "number": True,
                "state": True,
                "title_info": True,
                "author_info": True,
                "action_owner": True,
                "age_hours": ":.1f",
                "business_hours": ":.1f",
                "business_days": ":.1f",
                "comments_count": True,
                "changes_requested": True,
                "url": False,
                "Start": False,
                "Finish": False,
            },
            labels={
                "number": "PR#",
                "title_info": "タイトル",
                "author_info": "作成者",
                "action_owner": "担当",
                "age_hours": "経過時間(h)",
                "business_hours": "営業時間(h)",
                "business_days": "営業日数",
                "comments_count": "コメント",
                "changes_requested": "変更要求",
            },
            category_orders={"Task": task_order},
            height=chart_height,
        )

        fig_timeline.update_traces(
            hovertemplate="<b>%{customdata[2]}</b><br>" +
                         "<b>PR#%{customdata[0]}</b> | %{customdata[1]}<br>" +
                         "👤 %{customdata[3]}<br>" +
                         "%{customdata[4]}<br>" +
                         "%{customdata[5]:.1f}時間 (%{customdata[7]:.1f} 営業日)<br>" +
                         "営業時間: %{customdata[6]:.1f}h<br>" +
                         "%{customdata[8]}件 | %{customdata[9]}<br>" +
                         "<extra></extra>",
            customdata=tl_df[["number", "state", "title_info", "author_info", 
                             "action_owner", "age_hours", "business_hours", "business_days",
                             "comments_count", "changes_requested"]].values
        )

        fig_timeline.update_layout(
            yaxis={
                'categoryorder': 'array',
                'categoryarray': task_order,
                'automargin': True,
                'type': 'category',
            },
            xaxis_title="期間",
            yaxis_title="PR#",
            margin=dict(l=80, r=20, t=40, b=40),
            bargap=0.2,
            bargroupgap=0,
            hovermode='closest',
        )
        fig_timeline.update_yaxes(tickfont=dict(size=10))
        st.plotly_chart(fig_timeline, use_container_width=True, key="timeline_chart")

        st.caption(f"💡 {len(tl_df)}件表示中 | hover で詳細確認")

with tab2:
    st.markdown("### ファイル変更")

    # キャッシュからファイルツリーとディレクトリ統計を読み込み
    cached_tree = db_cache.load_file_tree(owner, repo, max_age_hours=24)
    cached_dir_stats = db_cache.load_dir_stats(owner, repo, max_age_hours=24)
    
    # キャッシュがない場合はリアルタイム計算
    if cached_tree is None or cached_dir_stats is None:
        set_progress(72, "ファイルツリーを構築中（初回のみ）")
        files_df_all = build_files_table(filtered_df)
        
        if files_df_all.empty:
            st.info("ファイル変更情報がありません")
        else:
            files_df_all = files_df_all.copy()
            files_df_all["files"] = files_df_all["files"].astype(str)
            
            # ディレクトリ集計
            files_df_all["dir_key"] = files_df_all["files"].apply(
                lambda p: "/".join(p.split("/")[:-1]) if "/" in p else "(root)"
            )
            
            dir_agg = (
                files_df_all.groupby("dir_key", observed=True)
                .agg(
                    total_prs=("number", lambda s: len(set(s))),
                    open_cnt=("state", lambda s: int((s == "OPEN").sum())),
                    last_activity=("createdAt_dt", "max"),
                )
                .reset_index()
            )
            
            all_paths = sorted(set(files_df_all["files"].dropna()))
    else:
        # キャッシュから復元
        all_paths, path_tree = cached_tree
        dir_agg = cached_dir_stats
        
        # files_df_allを復元（詳細表示用）
        files_df_all = build_files_table(filtered_df)
        if not files_df_all.empty:
            files_df_all = files_df_all.copy()
            files_df_all["files"] = files_df_all["files"].astype(str)
    
    if files_df_all.empty:
        st.info("ファイル変更情報がありません")
    else:
        if show_only_open_groups:
            dir_agg = dir_agg[dir_agg["open_cnt"] > 0]
        
        # Recent update順にソート
        dir_agg = dir_agg.sort_values("last_activity", ascending=False)
        
        # ディレクトリ選択用のセレクトボックス（シンプルに上部に配置）
        dir_options = ["（選択なし）"] + dir_agg["dir_key"].tolist()
        selected_dir_option = st.selectbox(
            "ディレクトリを選択してPRタイムラインを表示",
            dir_options,
            index=0,
            key="dir_selector_main"
        )
        
        selected_dir_from_selector = None
        if selected_dir_option != "（選択なし）":
            selected_dir_from_selector = selected_dir_option
        
        selected_rows = pd.DataFrame()
        selection_label: str | None = None
        
        # セレクトボックスから選択された場合
        if selected_dir_from_selector:
            if selected_dir_from_selector == "(root)":
                selected_rows = files_df_all[~files_df_all["files"].str.contains("/", na=False)]
            else:
                selected_rows = files_df_all[
                    files_df_all["files"].str.startswith(selected_dir_from_selector + "/")
                ]
            selection_label = selected_dir_from_selector

        # 選択されている場合、PRタイムラインを表示
        if not selected_rows.empty and selection_label:
            display_name = selection_label.split("/")[-1] if "/" in selection_label else selection_label
            if len(display_name) > 50:
                display_name = display_name[:47] + "..."

            st.markdown(f"##### � `{display_name}` のPRタイムライン")
            pr_numbers = selected_rows["number"].unique().tolist()
            gantt_src = raw_df[raw_df["number"].isin(pr_numbers)].copy()

            if gantt_src.empty:
                st.info("該当するPRがありません")
            else:
                # ソート順選択
                file_sort_mode = st.radio(
                    "並び順",
                    ["開始が新しい順", "開始が古い順", "期間が長い順"],
                    index=0,
                    horizontal=True,
                    key="file_timeline_sort"
                )
                
                gantt_df = build_pr_timeline_df(gantt_src, compact=True)

                # ソート順を適用
                if file_sort_mode == "開始が新しい順":
                    gantt_df = gantt_df.sort_values("Start", ascending=True)
                elif file_sort_mode == "開始が古い順":
                    gantt_df = gantt_df.sort_values("Start", ascending=False)
                else:  # "期間が長い順"
                    gantt_df["duration"] = (gantt_df["Finish"] - gantt_df["Start"]).dt.total_seconds()
                    gantt_df = gantt_df.sort_values("duration", ascending=True)
                
                # Y軸の順序を明示的に指定
                task_order = gantt_df["Task"].tolist()

                # タイムライン高さを動的調整
                chart_height = max(300, min(800, len(gantt_df) * 18))
                
                fig_file = px.timeline(
                    gantt_df,
                    x_start="Start",
                    x_end="Finish",
                    y="Task",
                    color="state",
                    hover_data={
                        "Task": True,
                        "state": True,
                        "title_info": True,
                        "author_info": True,
                        "action_owner": True,
                        "age_hours": ":.1f",
                        "business_hours": ":.1f",
                        "business_days": ":.1f",
                        "comments_count": True,
                        "changes_requested": True,
                        "url": False,
                        "Start": False,
                        "Finish": False,
                    },
                    labels={
                        "title_info": "タイトル",
                        "author_info": "作成者",
                        "action_owner": "担当",
                        "age_hours": "経過時間(h)",
                        "business_hours": "営業時間(h)",
                        "business_days": "営業日数",
                        "comments_count": "コメント数",
                        "changes_requested": "変更要求",
                    },
                    category_orders={"Task": task_order},
                    height=chart_height,
                )
                
                # シンプルなホバーテンプレート
                fig_file.update_traces(
                    hovertemplate="<b>%{customdata[2]}</b><br>" +
                                 "<b>PR#%{customdata[0]}</b> | %{customdata[1]}<br>" +
                                 "👤 %{customdata[3]}<br>" +
                                 "%{customdata[4]}<br>" +
                                 "%{customdata[5]:.1f}時間 (%{customdata[7]:.1f} 営業日)<br>" +
                                 "営業時間: %{customdata[6]:.1f}h<br>" +
                                 "%{customdata[8]}件 | %{customdata[9]}<br>" +
                                 "<extra></extra>",
                    customdata=gantt_df[["number", "state", "title_info", "author_info", 
                                        "action_owner", "age_hours", "business_hours", "business_days",
                                        "comments_count", "changes_requested"]].values
                )
                
                # Y軸をカテゴリカルにして隙間なし
                fig_file.update_layout(
                    yaxis={
                        'categoryorder': 'array',
                        'categoryarray': task_order,
                        'automargin': True,
                        'type': 'category',
                    },
                    xaxis_title="期間",
                    yaxis_title="PR#",
                    margin=dict(l=60, r=20, t=20, b=40),
                    bargap=0.2,
                    bargroupgap=0,
                    showlegend=True,
                    hovermode='closest',
                )
                fig_file.update_yaxes(tickfont=dict(size=10))
                st.plotly_chart(fig_file, use_container_width=True, key="file_timeline_chart")

                st.caption(f"💡 {len(gantt_df)}件のPR | hover で詳細確認")
        else:
            st.info("上のセレクトボックスからディレクトリを選択してPRタイムラインを表示します")
        
        # グラフ表示後、ディレクトリ統計とエクスプローラを下に配置
        st.markdown("---")
        st.markdown("#### ディレクトリ統計")
        
        # ディレクトリ統計テーブル（参照用）
        dir_display = dir_agg[["dir_key", "open_cnt", "total_prs", "last_activity"]].copy()
        dir_display = dir_display.rename(columns={
            "dir_key": "ディレクトリ",
            "open_cnt": "OPEN",
            "total_prs": "総PR",
            "last_activity": "最終更新"
        })
        
        st.dataframe(
            dir_display,
            use_container_width=True,
            height=400
        )
        
        # ファイル詳細エクスプローラのセクション（折りたたみ可能）
        with st.expander("ファイル詳細エクスプローラ（階層選択）", expanded=False):
            st.caption("より詳細にファイル/フォルダを選択したい場合はこちら")
            if all_paths:
                # エクスプローラを表示
                if cached_tree is not None:
                    _, cached_path_tree = cached_tree
                    directory_explorer_v2(all_paths, key_prefix="file_explorer")
                else:
                    directory_explorer_v2(all_paths, key_prefix="file_explorer")


with tab3:
    st.markdown("### アクション待ちPR")
    
    # OPEN PRのみ対象
    open_prs = raw_df[raw_df["state"] == "OPEN"].copy()
    
    if open_prs.empty:
        st.info("OPEN PR がありません")
    else:
        # 人ごとのアクションリストを作成
        user_actions = action_tracker.build_action_summary(open_prs.to_dict('records'))
        
        if not user_actions:
            st.info("アクションが必要なPRはありません")
        else:
            st.caption(f"📋 {len(user_actions)}人に対応が必要なアクションがあります")
            
            # 人ごとに表示
            for user, actions in sorted(user_actions.items(), key=lambda x: len(x[1]), reverse=True):
                action_count = len(actions)
                
                # 滞留チェック（168時間 = 7日以上待ちの場合）
                stale_count = sum(1 for a in actions if a["pr"].get("age_hours", 0) > 168)
                stale_mark = " 滞留あり" if stale_count > 0 else ""
                
                with st.expander(f"👤 **{user}** ({action_count}件){stale_mark}", expanded=False):
                    for action in sorted(actions, key=lambda x: x["pr"].get("age_hours", 0), reverse=True):
                        pr = action["pr"]
                        action_info = action["action_info"]
                        role = action["role"]
                        
                        age_days = pr.get("age_hours", 0) / 24
                        pr_number = pr.get("number")
                        pr_title = pr.get("title", "")
                        pr_url = pr.get("url", "")
                        author = pr.get("author", "")
                        
                        # 経過日数でマーク
                        age_mark = ""
                        if age_days > 7:
                            age_mark = " 🔴"
                        elif age_days > 3:
                            age_mark = " 🟡"
                        
                        role_badge = "✍️ 作成者" if role == "author" else "レビュアー"
                        
                        st.markdown(f"""
**[#{pr_number}]({pr_url})** {pr_title[:60]}{'...' if len(pr_title) > 60 else ''}{age_mark}
- 役割: {role_badge} | 理由: {action_info['reason']} | 経過: {age_days:.1f}日
- 作成者: {author}
                        """)
                        st.divider()


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
                "records_after_filter": int(len(uniq)),
            }
        )

