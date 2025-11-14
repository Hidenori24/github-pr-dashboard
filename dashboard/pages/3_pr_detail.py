# 3_pr_detail.py - PR詳細サマリページ
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

import config
import db_cache
import action_tracker

st.set_page_config(page_title="PR詳細", layout="wide", page_icon="📄")

JST = ZoneInfo("Asia/Tokyo")

# ダークモード対応CSS
if st.session_state.get('dark_mode', False):
    st.markdown(
        """
        <style>
        .stApp { background-color: #1a1a1a; color: #e4e4e7; }
        h1, h2, h3 { color: #e4e4e7; font-weight: 700; }
        .metric-card {
            background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
            border: 1px solid #3f3f46;
            border-radius: 12px;
            padding: 20px;
            margin: 10px 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .badge {
            display: inline-block; 
            padding: 4px 10px; 
            border-radius: 999px;
            background: #3f3f46; 
            color: #e4e4e7; 
            font-size: 0.85rem; 
            margin-right: 6px;
            border: 1px solid #52525b;
        }
        .badge.approved { background: #166534; color: #86efac; }
        .badge.changes { background: #991b1b; color: #fca5a5; }
        .badge.commented { background: #1e3a8a; color: #93c5fd; }
        </style>
        """,
        unsafe_allow_html=True,
    )
else:
    st.markdown(
        """
        <style>
        .metric-card {
            background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            margin: 10px 0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        }
        .badge {
            display: inline-block; 
            padding: 4px 10px; 
            border-radius: 999px;
            background: #eef2ff; 
            color: #334155; 
            font-size: 0.85rem; 
            margin-right: 6px;
            border: 1px solid #e5e7eb;
        }
        .badge.approved { background: #dcfce7; color: #166534; }
        .badge.changes { background: #fee2e2; color: #991b1b; }
        .badge.commented { background: #dbeafe; color: #1e3a8a; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def parse_owner_repo(owner_in: str, repo_in: str):
    """1_dashboard.pyと同じ処理"""
    import re
    
    def extract_from_url(src: str):
        match = re.search(r"github\.com/([^/\s]+)/([^/\s]+)", src or "")
        if match:
            return match.group(1), match.group(2).rstrip("/")
        return None

    parsed = extract_from_url(owner_in) or extract_from_url(repo_in)
    if parsed:
        return parsed
    return (owner_in or "").strip().strip("/"), (repo_in or "").strip().strip("/")


def build_pr_timeline_events(pr: dict) -> list:
    """PRのイベントタイムラインを構築"""
    events = []
    
    # 作成
    if pr.get("createdAt"):
        events.append({
            "event": "作成",
            "timestamp": pd.to_datetime(pr["createdAt"], format="ISO8601", utc=True),
            "actor": pr.get("author", ""),
            "icon": "✨"
        })
    
    # レビューリクエスト
    if pr.get("requested_reviewers", 0) > 0:
        events.append({
            "event": "レビュー依頼",
            "timestamp": pd.to_datetime(pr["createdAt"], format="ISO8601", utc=True),
            "actor": pr.get("author", ""),
            "icon": "👀"
        })
    
    # 変更要求
    if pr.get("changes_requested", 0) > 0:
        events.append({
            "event": "変更要求",
            "timestamp": pd.to_datetime(pr.get("updatedAt", pr["createdAt"]), format="ISO8601", utc=True),
            "actor": "レビュアー",
            "icon": "🔄"
        })
    
    # クローズ
    if pr.get("closedAt"):
        events.append({
            "event": "クローズ",
            "timestamp": pd.to_datetime(pr["closedAt"], format="ISO8601", utc=True),
            "actor": "",
            "icon": "🔒"
        })
    
    # マージ
    if pr.get("mergedAt"):
        events.append({
            "event": "マージ",
            "timestamp": pd.to_datetime(pr["mergedAt"], format="ISO8601", utc=True),
            "actor": "",
            "icon": "✅"
        })
    
    # タイムスタンプでソート
    events.sort(key=lambda x: x["timestamp"])
    
    return events


def calculate_business_hours(start_dt, end_dt):
    """営業日ベースの経過時間(平日のみ)を時間単位で算出。
    土日を完全に除外し、日跨ぎは部分時間を合算。Streamlit他ページと同一ロジック。
    """
    import pandas as pd
    from datetime import datetime, timedelta
    if start_dt is None or end_dt is None:
        return 0.0
    # 文字列ならISOとして解釈
    if isinstance(start_dt, str):
        start_dt = pd.to_datetime(start_dt, format="ISO8601", utc=True)
    if isinstance(end_dt, str):
        end_dt = pd.to_datetime(end_dt, format="ISO8601", utc=True)
    # 同日処理
    if start_dt.date() == end_dt.date():
        if start_dt.weekday() >= 5:  # 土日
            return 0.0
        return (end_dt - start_dt).total_seconds() / 3600
    current = start_dt
    total_hours = 0.0
    while current.date() < end_dt.date():
        if current.weekday() < 5:
            next_day = datetime.combine(current.date() + timedelta(days=1), datetime.min.time(), tzinfo=current.tzinfo)
            total_hours += (next_day - current).total_seconds() / 3600
        current = datetime.combine(current.date() + timedelta(days=1), datetime.min.time(), tzinfo=current.tzinfo)
    if end_dt.weekday() < 5:
        total_hours += (end_dt - current).total_seconds() / 3600
    return total_hours


st.title("📄 PR詳細サマリ")

# ページトップにスクロール
st.markdown('<script>window.scrollTo(0, 0);</script>', unsafe_allow_html=True)

# クエリパラメータから情報取得
query_params = st.query_params
owner = query_params.get("owner", "")
repo = query_params.get("repo", "")
pr_number = query_params.get("number", "")

if not owner or not repo or not pr_number:
    st.warning("PR情報が不足しています。ダッシュボードからPRを選択してください。")
    if st.button("← ダッシュボードに戻る"):
        st.switch_page("pages/1_dashboard.py")
    st.stop()

try:
    pr_number = int(pr_number)
except ValueError:
    st.error("無効なPR番号です")
    st.stop()

# キャッシュからPRデータを取得
with st.spinner("PR情報を読み込み中..."):
    cached_prs = db_cache.load_prs(owner, repo)
    
    if not cached_prs:
        st.error(f"キャッシュにデータがありません。先にダッシュボードでデータを取得してください。")
        if st.button("← ダッシュボードに戻る"):
            st.switch_page("pages/1_dashboard.py")
        st.stop()
    
    # 該当PRを検索
    pr = None
    for p in cached_prs:
        if p.get("number") == pr_number:
            pr = p
            break
    
    if not pr:
        st.error(f"PR #{pr_number} が見つかりません")
        if st.button("← ダッシュボードに戻る"):
            st.switch_page("pages/1_dashboard.py")
        st.stop()

# ヘッダー
col_back, col_title, col_github = st.columns([1, 7, 2])
with col_back:
    if st.button("← 戻る", use_container_width=True):
        st.switch_page("pages/1_dashboard.py")

with col_title:
    state_emoji = {"OPEN": "🟢", "MERGED": "🟣", "CLOSED": "🔴"}.get(pr.get("state"), "⚪")
    st.markdown(f"### {state_emoji} #{pr_number}: {pr.get('title', '')}")

with col_github:
    st.markdown("<br>", unsafe_allow_html=True)  # スペース調整
    st.link_button("🔗 GitHubで開く", pr.get('url', ''), use_container_width=True)

st.markdown(f"**作成者:** {pr.get('author', '')} | **作成日:** {pd.to_datetime(pr.get('createdAt'), format='ISO8601', utc=True).tz_convert(JST).strftime('%Y-%m-%d %H:%M')}")

# アクション担当者情報
if pr.get('state') == 'OPEN':
    action_info = action_tracker.determine_action_owner(pr)
    
    if action_info['action'] != 'none':
        waiting_for = ', '.join(action_info['waiting_for']) if action_info['waiting_for'] else '不明'
        
        # アクションタイプに応じた色分け
        if action_info['action'] == 'author':
            st.info(f"🔄 **アクションすべき人:** {waiting_for} - {action_info['reason']}")
        elif action_info['action'] == 'reviewers':
            st.warning(f"👀 **アクションすべき人:** {waiting_for} - {action_info['reason']}")
        elif action_info['action'] == 'ready_to_merge':
            st.success(f"✅ **アクションすべき人:** {waiting_for} - {action_info['reason']}")
        else:
            st.info(f"ℹ️ **アクションすべき人:** {waiting_for} - {action_info['reason']}")

st.divider()

# メトリクスカード
col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.metric("💬 コメント数", pr.get("comments_count", 0))

with col2:
    review_count = pr.get("requested_reviewers", 0) + pr.get("changes_requested", 0)
    st.metric("👀 レビュー数", review_count)

with col3:
    age_days = pr.get("age_hours", 0) / 24
    st.metric("⏱️ 経過日数", f"{age_days:.1f}日")

with col4:
    additions = pr.get("additions", 0)
    deletions = pr.get("deletions", 0)
    total_changes = additions + deletions
    st.metric("📝 コード変更", f"+{additions} -{deletions}")

with col5:
    # business時間の計算 (merged / closed / now)
    import pandas as pd
    from datetime import datetime, timezone
    created_at = pr.get("createdAt")
    end_candidate = pr.get("mergedAt") or pr.get("closedAt") or datetime.now(timezone.utc).isoformat()
    business_hours = calculate_business_hours(created_at, end_candidate)
    business_days = business_hours / 24.0
    st.metric("🏢 営業日数", f"{business_days:.1f}日", help="土日を除外した経過日数。深夜もフルカウントで暫定版")

st.divider()

# タブセクション
tab1, tab2, tab3 = st.tabs(["レビュー状況", "変更ファイル", "タイムライン"])

with tab1:
    st.markdown("### レビュー状況")
    
    review_decision = pr.get("reviewDecision", "")
    if review_decision == "APPROVED":
        st.success("✅ 承認済み")
    elif review_decision == "CHANGES_REQUESTED" or pr.get("changes_requested", 0) > 0:
        st.warning("🔄 変更要求あり")
    elif review_decision == "REVIEW_REQUIRED":
        st.info("👀 レビュー待ち")
    else:
        st.info("💬 レビュー進行中")
    
    # レビュアー情報
    requested_reviewers = pr.get("requested_reviewers", 0)
    if requested_reviewers > 0:
        st.markdown(f"**依頼中のレビュアー:** {requested_reviewers}人")
    
    changes_requested = pr.get("changes_requested", 0)
    if changes_requested > 0:
        st.markdown(f"**変更要求:** {changes_requested}件")
    
    # マージ可能性
    mergeable = pr.get("mergeable", "")
    merge_state = pr.get("mergeStateStatus", "")
    
    if mergeable == "MERGEABLE" or merge_state in ["CLEAN", "UNSTABLE", "HAS_HOOKS"]:
        st.success("✅ マージ可能")
    elif mergeable == "CONFLICTING" or merge_state in ["DIRTY", "BEHIND", "BLOCKED"]:
        st.error("❌ コンフリクトあり")
    else:
        st.info("ℹ️ マージ状態不明")
    
    # チェック状態
    checks = pr.get("checks_state", "")
    if checks:
        if checks.upper() in ["SUCCESS", "SUCCEEDED"]:
            st.success(f"✅ チェック成功")
        elif checks.upper() in ["FAILURE", "FAILED"]:
            st.error(f"❌ チェック失敗")
        elif checks.upper() in ["PENDING", "EXPECTED"]:
            st.info(f"⏳ チェック実行中")

with tab2:
    st.markdown("### 変更ファイル")
    
    files = pr.get("files", [])
    if files:
        st.caption(f"合計 {len(files)}個のファイル")
        
        # DataFrameで表示
        files_df = pd.DataFrame([{"ファイル": f} for f in files])
        st.dataframe(files_df, use_container_width=True, height=400)
    else:
        st.info("ファイル情報がありません")

with tab3:
    st.markdown("### PRタイムライン")
    
    events = build_pr_timeline_events(pr)
    
    if events:
        # タイムライン表示
        for event in events:
            timestamp_jst = event["timestamp"].tz_convert(JST)
            st.markdown(f"{event['icon']} **{event['event']}** - {timestamp_jst.strftime('%Y-%m-%d %H:%M')} ({event['actor']})")
        
        st.divider()
        
        # タイムラインチャート
        events_df = pd.DataFrame(events)
        events_df["y_pos"] = range(len(events_df))
        
        fig = go.Figure()
        
        # イベントポイント
        fig.add_trace(go.Scatter(
            x=events_df["timestamp"],
            y=events_df["y_pos"],
            mode="markers+text",
            marker=dict(size=15, color="royalblue"),
            text=events_df["icon"],
            textposition="middle center",
            textfont=dict(size=12),
            hovertemplate="<b>%{customdata[0]}</b><br>%{customdata[1]}<br>%{x}<extra></extra>",
            customdata=events_df[["event", "actor"]].values,
            showlegend=False
        ))
        
        # ライン
        fig.add_trace(go.Scatter(
            x=events_df["timestamp"],
            y=events_df["y_pos"],
            mode="lines",
            line=dict(color="gray", width=2, dash="dot"),
            showlegend=False,
            hoverinfo="skip"
        ))
        
        fig.update_layout(
            title="PRの進行状況",
            xaxis_title="日時",
            yaxis_title="",
            yaxis=dict(showticklabels=False),
            height=300,
            margin=dict(l=20, r=20, t=40, b=40)
        )
        
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("イベント情報がありません")

st.divider()

# フッター
now_jst = datetime.now(JST).strftime("%Y-%m-%d %H:%M:%S %Z")
st.caption(f"表示時刻: {now_jst} | {owner}/{repo}")
