# pages/4_statistics.py - 統計情報と週間レポート
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import json

import config
import db_cache

st.set_page_config(page_title="統計情報・週間レポート", layout="wide", page_icon="📊")

# Initialize dark mode state if not exists
if 'dark_mode' not in st.session_state:
    st.session_state.dark_mode = False

# Apply custom CSS based on theme
if st.session_state.dark_mode:
    st.markdown(
        """
        <style>
        .stApp { background-color: #1a1a1a; color: #e4e4e7; }
        h1, h2, h3 { color: #e4e4e7; font-weight: 700; }
        section[data-testid="stSidebar"] { background-color: #262626; }
        div[data-testid="stMetric"] { 
            background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
            border: 1px solid #3f3f46;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .insight-card {
            background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
            border-left: 4px solid #3b82f6;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
            border: 1px solid #3f3f46;
        }
        .recommendation {
            background: #1e3a8a22;
            border-left: 4px solid #3b82f6;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
        .warning-insight {
            background: #7c2d1222;
            border-left: 4px solid #ef4444;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
        .success-insight {
            background: #14532d22;
            border-left: 4px solid #10b981;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )
else:
    st.markdown(
        """
        <style>
        h1, h2, h3 { font-weight: 700; }
        div[data-testid="stMetric"] { 
            background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        }
        .insight-card {
            background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
            border-left: 4px solid #3b82f6;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
            border: 1px solid #e5e7eb;
        }
        .recommendation {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
        .warning-insight {
            background: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
        .success-insight {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 0.5rem 0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

JST = ZoneInfo("Asia/Tokyo")


# NOTE: This function is defined for potential future use and may also be imported by other modules.
def calculate_business_hours(start_dt: datetime, end_dt: datetime) -> float:
    """営業日（平日のみ）で経過時間を計算（時間単位）"""
    if pd.isna(start_dt) or pd.isna(end_dt):
        return 0.0
    
    if isinstance(start_dt, str):
        start_dt = pd.to_datetime(start_dt, format="ISO8601", utc=True)
    if isinstance(end_dt, str):
        end_dt = pd.to_datetime(end_dt, format="ISO8601", utc=True)
    
    if start_dt.date() == end_dt.date():
        if start_dt.weekday() >= 5:
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
        day_start = datetime.combine(end_dt.date(), datetime.min.time(), tzinfo=end_dt.tzinfo)
        total_hours += (end_dt - day_start).total_seconds() / 3600
    
    return total_hours


def generate_weekly_statistics(df: pd.DataFrame, current_week_df: pd.DataFrame, previous_week_df: pd.DataFrame) -> dict:
    """週間統計を生成"""
    stats = {}
    
    # 基本統計
    stats['total_prs'] = len(current_week_df)
    stats['open_prs'] = len(current_week_df[current_week_df['state'] == 'OPEN'])
    stats['merged_prs'] = len(current_week_df[current_week_df['state'] == 'MERGED'])
    stats['closed_prs'] = len(current_week_df[current_week_df['state'] == 'CLOSED'])
    
    # 前週比
    prev_total = len(previous_week_df)
    stats['total_change'] = stats['total_prs'] - prev_total
    stats['total_change_pct'] = (stats['total_change'] / prev_total * 100) if prev_total > 0 else 0
    
    # レビュー時間
    merged_current = current_week_df[current_week_df['state'] == 'MERGED']
    if not merged_current.empty:
        merged_current_copy = merged_current.copy()
        merged_current_copy['lead_time'] = (
            pd.to_datetime(merged_current_copy['mergedAt'], format="ISO8601", utc=True) - 
            pd.to_datetime(merged_current_copy['createdAt'], format="ISO8601", utc=True)
        ).dt.total_seconds() / 3600 / 24
        stats['avg_lead_time'] = merged_current_copy['lead_time'].median()
    else:
        stats['avg_lead_time'] = 0
    
    # 前週のレビュー時間
    merged_prev = previous_week_df[previous_week_df['state'] == 'MERGED']
    if not merged_prev.empty:
        merged_prev_copy = merged_prev.copy()
        merged_prev_copy['lead_time'] = (
            pd.to_datetime(merged_prev_copy['mergedAt'], format="ISO8601", utc=True) - 
            pd.to_datetime(merged_prev_copy['createdAt'], format="ISO8601", utc=True)
        ).dt.total_seconds() / 3600 / 24
        prev_lead_time = merged_prev_copy['lead_time'].median()
        stats['lead_time_change'] = stats['avg_lead_time'] - prev_lead_time
    else:
        stats['lead_time_change'] = 0
    
    # アクティブな開発者数
    stats['active_authors'] = current_week_df['author'].nunique()
    
    # レビュー統計
    total_reviews = 0
    total_comments = 0
    for _, row in current_week_df.iterrows():
        total_reviews += row.get('reviews_count', 0)
        total_comments += row.get('comments_count', 0)
    
    stats['total_reviews'] = total_reviews
    stats['total_comments'] = total_comments
    stats['avg_reviews_per_pr'] = total_reviews / stats['total_prs'] if stats['total_prs'] > 0 else 0
    stats['avg_comments_per_pr'] = total_comments / stats['total_prs'] if stats['total_prs'] > 0 else 0
    
    return stats


def generate_insights(stats: dict, df_all: pd.DataFrame) -> list:
    """統計から洞察を生成"""
    insights = []
    
    # PR作成数の変化
    if stats['total_change_pct'] > 20:
        insights.append({
            'type': 'success',
            'title': '開発活動が活発化',
            'message': f"先週と比較してPR作成数が{stats['total_change_pct']:.0f}%増加しました。チームの開発速度が向上しています。"
        })
    elif stats['total_change_pct'] < -20:
        insights.append({
            'type': 'warning',
            'title': '開発活動の低下',
            'message': f"先週と比較してPR作成数が{abs(stats['total_change_pct']):.0f}%減少しました。原因を確認することをお勧めします。"
        })
    
    # リードタイムの変化
    if stats['lead_time_change'] < -1:
        insights.append({
            'type': 'success',
            'title': 'レビュー速度の改善',
            'message': f"レビュー完了までの時間が{abs(stats['lead_time_change']):.1f}日短縮されました。レビュープロセスが効率化しています。"
        })
    elif stats['lead_time_change'] > 2:
        insights.append({
            'type': 'warning',
            'title': 'レビュー遅延の増加',
            'message': f"レビュー完了までの時間が{stats['lead_time_change']:.1f}日増加しました。レビューのボトルネックを確認してください。"
        })
    
    # マージ率
    merge_rate = (stats['merged_prs'] / stats['total_prs'] * 100) if stats['total_prs'] > 0 else 0
    if merge_rate < 30:
        insights.append({
            'type': 'warning',
            'title': 'マージ率が低い',
            'message': f"今週のマージ率は{merge_rate:.0f}%です。OPENまたはCLOSEDのPRが多く残っている可能性があります。"
        })
    
    # レビュー活動
    if stats['avg_reviews_per_pr'] < 1:
        insights.append({
            'type': 'warning',
            'title': 'レビュー活動の不足',
            'message': f"PR当たりの平均レビュー数が{stats['avg_reviews_per_pr']:.1f}回です。レビュー活動を促進することで品質向上が期待できます。"
        })
    elif stats['avg_reviews_per_pr'] > 3:
        insights.append({
            'type': 'info',
            'title': '活発なレビュー活動',
            'message': f"PR当たりの平均レビュー数が{stats['avg_reviews_per_pr']:.1f}回です。チーム全体でレビューに積極的に参加しています。"
        })
    
    # 滞留PR
    open_prs = df_all[df_all['state'] == 'OPEN'].copy()
    if not open_prs.empty:
        now = datetime.now(timezone.utc)
        open_prs['age_days'] = (now - pd.to_datetime(open_prs['createdAt'], format="ISO8601", utc=True)).dt.total_seconds() / 86400
        stale_prs = open_prs[open_prs['age_days'] > 7]
        
        if len(stale_prs) > 5:
            insights.append({
                'type': 'warning',
                'title': '滞留PRの増加',
                'message': f"7日以上滞留しているOPEN PRが{len(stale_prs)}件あります。定期的なレビューとフォローアップをお勧めします。"
            })
    
    return insights


def generate_recommendations(stats: dict, insights: list) -> list:
    """改善提案を生成"""
    recommendations = []
    
    # リードタイムが長い場合
    if stats['avg_lead_time'] > 5:
        recommendations.append({
            'title': 'レビュー時間の短縮',
            'actions': [
                'PRのサイズを小さくする（1PR = 1機能）',
                'レビュー担当者を明示的にアサインする',
                'レビュー時間を定例化する（例：毎日午前中）',
                'Draft PRを活用して早期フィードバックを得る'
            ]
        })
    
    # レビュー活動が不足している場合
    if stats['avg_reviews_per_pr'] < 1:
        recommendations.append({
            'title': 'レビュー文化の醸成',
            'actions': [
                'ペアプログラミング/モブプログラミングの導入',
                'レビュー担当のローテーション制度',
                'レビューガイドラインの整備',
                'レビュー活動の可視化と表彰'
            ]
        })
    
    # マージ率が低い場合
    merge_rate = (stats['merged_prs'] / stats['total_prs'] * 100) if stats['total_prs'] > 0 else 0
    if merge_rate < 40:
        recommendations.append({
            'title': 'PR完了率の向上',
            'actions': [
                'OPEN PRの定期的な棚卸し',
                '不要なPRのクローズ',
                'WIP（Work In Progress）の見える化',
                'PRのライフサイクル管理ルールの設定'
            ]
        })
    
    # 開発者が少ない場合
    if stats['active_authors'] < 3:
        recommendations.append({
            'title': 'チームコラボレーションの促進',
            'actions': [
                'クロスファンクショナルな開発体制の構築',
                'ナレッジシェアの機会を増やす',
                'コードオーナーシップの分散',
                'オンボーディングプロセスの改善'
            ]
        })
    
    return recommendations


st.title("📊 統計情報・週間レポート")

st.markdown("""
このページでは、開発プロセスの現状を理解し、改善の機会を見つけるための包括的な統計情報を提供します。
""")

# サイドバー
with st.sidebar:
    st.header("データ取得")
    
    # リポジトリ選択
    if config.REPOSITORIES:
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
        owner = selected_repo_config["owner"]
        repo = selected_repo_config["repo"]
        
        if selected_repo_idx == st.session_state.get('primary_repo_index', 0):
            st.caption("⭐ プライマリーリポジトリ")
    else:
        owner = config.DEFAULT_OWNER
        repo = config.DEFAULT_REPO
    
    st.divider()
    
    st.header("レポート期間")
    report_period = st.selectbox(
        "期間を選択",
        ["今週", "先週", "今月", "先月", "過去30日", "過去90日"],
        index=0
    )
    
    st.divider()
    
    # レポート出力オプション
    st.header("レポート出力")
    if st.button("📄 週間レポートをダウンロード", use_container_width=True):
        st.session_state['generate_report'] = True

# データ取得
cached_data = db_cache.load_prs(owner, repo)

if not cached_data:
    st.error("データがありません。`python fetch_data.py --all` を実行してください。")
    st.stop()

# DataFrameに変換
df_all = pd.DataFrame(cached_data)
df_all["createdAt_dt"] = pd.to_datetime(df_all["createdAt"], format="ISO8601", utc=True)
df_all["closedAt_dt"] = pd.to_datetime(df_all["closedAt"], format="ISO8601", utc=True, errors='coerce')
df_all["mergedAt_dt"] = pd.to_datetime(df_all["mergedAt"], format="ISO8601", utc=True, errors='coerce')

# 期間設定
now = datetime.now(timezone.utc)
if report_period == "今週":
    # 今週の月曜日から今日まで
    week_start = now - timedelta(days=now.weekday())
    week_end = now
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start
    period_days = 7
elif report_period == "先週":
    # 先週の月曜日から日曜日まで
    week_start = now - timedelta(days=now.weekday() + 7)
    week_end = week_start + timedelta(days=7)
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end = week_start
    period_days = 7
elif report_period == "今月":
    # 今月の1日から今日まで
    week_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_end = now
    # 前月の同じ期間
    if week_start.month == 1:
        prev_week_start = week_start.replace(year=week_start.year - 1, month=12)
    else:
        prev_week_start = week_start.replace(month=week_start.month - 1)
    prev_week_end = prev_week_start + (week_end - week_start)
    period_days = (week_end - week_start).days
elif report_period == "先月":
    # 先月の1日から末日まで
    first_day = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if first_day.month == 1:
        week_start = first_day.replace(year=first_day.year - 1, month=12)
    else:
        week_start = first_day.replace(month=first_day.month - 1)
    week_end = first_day
    # 前々月
    if week_start.month == 1:
        prev_week_start = week_start.replace(year=week_start.year - 1, month=12)
    else:
        prev_week_start = week_start.replace(month=week_start.month - 1)
    prev_week_end = week_start
    period_days = (week_end - week_start).days
elif report_period == "過去30日":
    week_start = now - timedelta(days=30)
    week_end = now
    prev_week_start = week_start - timedelta(days=30)
    prev_week_end = week_start
    period_days = 30
else:  # 過去90日
    week_start = now - timedelta(days=90)
    week_end = now
    prev_week_start = week_start - timedelta(days=90)
    prev_week_end = week_start
    period_days = 90

# 期間でフィルタ
current_week_df = df_all[
    (df_all['createdAt_dt'] >= week_start) & 
    (df_all['createdAt_dt'] < week_end)
].copy()

previous_week_df = df_all[
    (df_all['createdAt_dt'] >= prev_week_start) & 
    (df_all['createdAt_dt'] < prev_week_end)
].copy()

# 統計生成
stats = generate_weekly_statistics(df_all, current_week_df, previous_week_df)
insights = generate_insights(stats, df_all)
recommendations = generate_recommendations(stats, insights)

# レポート表示
st.markdown("---")

# サマリーカード
st.markdown(f"### 📅 {report_period}のサマリー")
st.caption(f"{week_start.astimezone(JST).strftime('%Y/%m/%d')} - {week_end.astimezone(JST).strftime('%Y/%m/%d')}")

col1, col2, col3, col4 = st.columns(4)

with col1:
    delta_color = "normal" if stats['total_change'] >= 0 else "inverse"
    st.metric(
        "総PR数",
        stats['total_prs'],
        delta=f"{stats['total_change']:+d} ({stats['total_change_pct']:+.0f}%)",
        delta_color=delta_color
    )

with col2:
    st.metric(
        "マージ済み",
        stats['merged_prs'],
        delta=f"{(stats['merged_prs']/stats['total_prs']*100):.0f}%" if stats['total_prs'] > 0 else "0%"
    )

with col3:
    delta_text = f"{stats['lead_time_change']:+.1f}日" if stats['lead_time_change'] != 0 else None
    delta_color = "inverse" if stats['lead_time_change'] > 0 else "normal"
    st.metric(
        "平均リードタイム",
        f"{stats['avg_lead_time']:.1f}日",
        delta=delta_text,
        delta_color=delta_color
    )

with col4:
    st.metric(
        "アクティブ開発者",
        stats['active_authors']
    )

st.markdown("---")

# グラフ表示
col_left, col_right = st.columns(2)

with col_left:
    st.markdown("#### PR状態の内訳")
    
    state_data = pd.DataFrame({
        '状態': ['OPEN', 'MERGED', 'CLOSED'],
        '件数': [stats['open_prs'], stats['merged_prs'], stats['closed_prs']]
    })
    
    fig_state = px.pie(
        state_data,
        values='件数',
        names='状態',
        color='状態',
        color_discrete_map={'OPEN': '#f59e0b', 'MERGED': '#10b981', 'CLOSED': '#6b7280'},
        height=300
    )
    fig_state.update_traces(
        textposition='inside',
        textinfo='percent+label',
        hovertemplate='<b>%{label}</b><br>%{value}件 (%{percent})<extra></extra>'
    )
    st.plotly_chart(fig_state, use_container_width=True)

with col_right:
    st.markdown("#### レビュー活動")
    
    col_a, col_b = st.columns(2)
    with col_a:
        st.metric("総レビュー数", stats['total_reviews'])
        st.metric("PR当たり平均", f"{stats['avg_reviews_per_pr']:.1f}回")
    
    with col_b:
        st.metric("総コメント数", stats['total_comments'])
        st.metric("PR当たり平均", f"{stats['avg_comments_per_pr']:.1f}件")

st.markdown("---")

# トレンド分析
st.markdown("### 📈 トレンド分析（過去8週間）")

# 過去8週間のデータを取得
weeks_data = []
for i in range(8, 0, -1):
    week_s = now - timedelta(days=now.weekday() + 7*i)
    week_e = week_s + timedelta(days=7)
    
    week_df = df_all[
        (df_all['createdAt_dt'] >= week_s) & 
        (df_all['createdAt_dt'] < week_e)
    ].copy()
    
    merged_week = week_df[week_df['state'] == 'MERGED']
    if not merged_week.empty:
        merged_week_copy = merged_week.copy()
        merged_week_copy['lead_time'] = (
            pd.to_datetime(merged_week_copy['mergedAt'], format="ISO8601", utc=True) - 
            pd.to_datetime(merged_week_copy['createdAt'], format="ISO8601", utc=True)
        ).dt.total_seconds() / 3600 / 24
        avg_lead = merged_week_copy['lead_time'].median()
    else:
        avg_lead = 0
    
    weeks_data.append({
        '週': week_s.strftime('%m/%d'),
        'PR数': len(week_df),
        'マージ数': len(week_df[week_df['state'] == 'MERGED']),
        '平均リードタイム': avg_lead
    })

trend_df = pd.DataFrame(weeks_data)

col_left, col_right = st.columns(2)

with col_left:
    st.markdown("#### PR作成数の推移")
    fig_trend_pr = go.Figure()
    fig_trend_pr.add_trace(go.Scatter(
        x=trend_df['週'],
        y=trend_df['PR数'],
        mode='lines+markers',
        name='PR数',
        line=dict(color='#3b82f6', width=3),
        marker=dict(size=8),
        hovertemplate='<b>%{x}</b><br>PR数: %{y}件<extra></extra>'
    ))
    fig_trend_pr.update_layout(
        xaxis_title="週",
        yaxis_title="PR数",
        height=300,
        margin=dict(l=0, r=0, t=20, b=0),
        hovermode='x unified'
    )
    st.plotly_chart(fig_trend_pr, use_container_width=True)

with col_right:
    st.markdown("#### 平均リードタイムの推移")
    fig_trend_lead = go.Figure()
    fig_trend_lead.add_trace(go.Scatter(
        x=trend_df['週'],
        y=trend_df['平均リードタイム'],
        mode='lines+markers',
        name='リードタイム',
        line=dict(color='#f59e0b', width=3),
        marker=dict(size=8),
        hovertemplate='<b>%{x}</b><br>リードタイム: %{y:.1f}日<extra></extra>'
    ))
    fig_trend_lead.update_layout(
        xaxis_title="週",
        yaxis_title="リードタイム (日)",
        height=300,
        margin=dict(l=0, r=0, t=20, b=0),
        hovermode='x unified'
    )
    st.plotly_chart(fig_trend_lead, use_container_width=True)

st.markdown("---")

# 洞察
st.markdown("### 💡 洞察")

if insights:
    for insight in insights:
        if insight['type'] == 'success':
            st.markdown(f"""
            <div class="success-insight">
                <h4 style="margin-top: 0;">✅ {insight['title']}</h4>
                <p style="margin-bottom: 0;">{insight['message']}</p>
            </div>
            """, unsafe_allow_html=True)
        elif insight['type'] == 'warning':
            st.markdown(f"""
            <div class="warning-insight">
                <h4 style="margin-top: 0;">⚠️ {insight['title']}</h4>
                <p style="margin-bottom: 0;">{insight['message']}</p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="insight-card">
                <h4 style="margin-top: 0;">ℹ️ {insight['title']}</h4>
                <p style="margin-bottom: 0;">{insight['message']}</p>
            </div>
            """, unsafe_allow_html=True)
else:
    st.info("今期は特記すべき変化はありません。")

st.markdown("---")

# 改善提案
st.markdown("### 🎯 改善提案")

if recommendations:
    for rec in recommendations:
        with st.expander(f"💡 {rec['title']}", expanded=False):
            st.markdown("**具体的なアクション:**")
            for action in rec['actions']:
                st.markdown(f"- {action}")
else:
    st.success("現状のプロセスは良好です。引き続き維持してください。")

st.markdown("---")

# 週間レポート生成
if st.session_state.get('generate_report', False):
    st.markdown("### 📄 週間レポート")
    
    report_text = f"""# GitHub PR 週間レポート

**リポジトリ**: {owner}/{repo}  
**期間**: {week_start.astimezone(JST).strftime('%Y/%m/%d')} - {week_end.astimezone(JST).strftime('%Y/%m/%d')}  
**作成日時**: {datetime.now(JST).strftime('%Y/%m/%d %H:%M:%S')} JST

---

## サマリー

- **総PR数**: {stats['total_prs']}件 ({stats['total_change']:+d}件, {stats['total_change_pct']:+.0f}%)
- **マージ済み**: {stats['merged_prs']}件 ({(stats['merged_prs']/stats['total_prs']*100):.0f}%)
- **平均リードタイム**: {stats['avg_lead_time']:.1f}日 ({stats['lead_time_change']:+.1f}日)
- **アクティブ開発者**: {stats['active_authors']}名

---

## 主な洞察

"""
    
    for insight in insights:
        report_text += f"\n### {insight['title']}\n\n{insight['message']}\n"
    
    report_text += "\n---\n\n## 改善提案\n\n"
    
    for rec in recommendations:
        report_text += f"\n### {rec['title']}\n\n"
        for action in rec['actions']:
            report_text += f"- {action}\n"
    
    report_text += "\n---\n\n*このレポートは GitHub PR Dashboard により自動生成されました。*"
    
    st.download_button(
        label="📥 Markdownでダウンロード",
        data=report_text,
        file_name=f"weekly_report_{week_start.strftime('%Y%m%d')}.md",
        mime="text/markdown"
    )
    
    st.markdown(report_text)
    
    # リセット
    st.session_state['generate_report'] = False

st.markdown("---")

# 詳細統計
with st.expander("📊 詳細統計", expanded=False):
    st.markdown("#### PR作成者別統計")
    
    if not current_week_df.empty:
        author_stats = current_week_df.groupby('author').agg({
            'number': 'count',
            'state': lambda x: (x == 'MERGED').sum()
        }).reset_index()
        author_stats.columns = ['作成者', 'PR数', 'マージ数']
        author_stats['マージ率'] = (author_stats['マージ数'] / author_stats['PR数'] * 100).round(1)
        author_stats = author_stats.sort_values('PR数', ascending=False)
        
        st.dataframe(
            author_stats,
            use_container_width=True,
            height=300
        )
    else:
        st.info("データがありません")
    
    st.markdown("#### レビュワー別統計")
    
    reviewer_activities = []
    for _, row in current_week_df.iterrows():
        review_details = row.get("review_details", [])
        if isinstance(review_details, list):
            for review in review_details:
                reviewer = review.get("author")
                if reviewer:
                    reviewer_activities.append({
                        "レビュワー": reviewer,
                        "PR#": row["number"],
                        "状態": review.get("state")
                    })
    
    if reviewer_activities:
        reviewer_df = pd.DataFrame(reviewer_activities)
        reviewer_stats = reviewer_df.groupby('レビュワー').agg({
            'PR#': 'nunique',
            '状態': 'count'
        }).reset_index()
        reviewer_stats.columns = ['レビュワー', 'レビューしたPR数', '総レビュー回数']
        reviewer_stats = reviewer_stats.sort_values('レビューしたPR数', ascending=False)
        
        st.dataframe(
            reviewer_stats,
            use_container_width=True,
            height=300
        )
    else:
        st.info("レビューデータがありません")
