# pages/3_four_keys.py - DevOps Four Keys Metrics
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta, timezone
import numpy as np

import config
import db_cache

st.set_page_config(page_title="Four Keys", layout="wide", page_icon="🔑")

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
        section[data-testid="stSidebar"] .stMarkdown { color: #e4e4e7; }
        div[data-testid="stMetric"] { 
            background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
            border: 1px solid #3f3f46;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease;
        }
        div[data-testid="stMetric"]:hover { transform: translateY(-4px); }
        .stAlert { border-radius: 8px; }
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
            transition: transform 0.3s ease;
        }
        div[data-testid="stMetric"]:hover { transform: translateY(-4px); }
        .stAlert { border-radius: 8px; }
        </style>
        """,
        unsafe_allow_html=True,
    )


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


def classify_dora_level(value: float, metric: str) -> tuple:
    """DORA指標のレベル分類 (value, metric) -> (level, color)"""
    if metric == "deployment_frequency":  # 週あたりのデプロイ回数
        if value >= 7:  # 1日1回以上
            return "Elite", "#10b981"
        elif value >= 1:  # 週1回以上
            return "High", "#3b82f6"
        elif value >= 0.25:  # 月1回以上
            return "Medium", "#f59e0b"
        else:
            return "Low", "#ef4444"
    
    elif metric == "lead_time":  # 日数
        if value < 1:
            return "Elite", "#10b981"
        elif value < 7:
            return "High", "#3b82f6"
        elif value < 30:
            return "Medium", "#f59e0b"
        else:
            return "Low", "#ef4444"
    
    elif metric == "change_failure_rate":  # パーセント
        if value <= 15:
            return "Elite", "#10b981"
        elif value <= 30:
            return "High", "#3b82f6"
        elif value <= 45:
            return "Medium", "#f59e0b"
        else:
            return "Low", "#ef4444"
    
    elif metric == "mttr":  # 時間
        if value < 1:
            return "Elite", "#10b981"
        elif value < 24:
            return "High", "#3b82f6"
        elif value < 168:  # 1週間
            return "Medium", "#f59e0b"
        else:
            return "Low", "#ef4444"
    
    return "Unknown", "#6b7280"


st.title("DevOps Four Keys Metrics")

st.markdown("""
DevOpsの4つの主要指標（Four Keys）を可視化します。
""")

st.info("""
### 計算方法について

Four Keysメトリクスは以下の仮定に基づいて計算しています:

- **Deployment Frequency**: MERGEDステータスのPRを「デプロイ」と見なす
- **Lead Time for Changes**: PR作成からマージまでの時間で計算
- **Change Failure Rate**: 
  - "revert", "hotfix", "urgent", "fix" などのラベル/タイトルを持つPRを「失敗」と見なす
  - または、マージ後24時間以内に作成された修正PRを失敗としてカウント（仮定）
- **Time to Restore Service**: 
  - 上記の「失敗」PRの作成からマージまでの時間で計算（仮定）
  - 本来はインシデント管理システムと連携が必要

正確な測定には、デプロイメントログやインシデント管理システムとの統合が推奨されます。
""")

st.markdown("---")

# サイドバー
with st.sidebar:
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
        owner = selected_repo_config["owner"]
        repo = selected_repo_config["repo"]
        
        # プライマリーリポジトリの場合は星印表示
        if selected_repo_idx == st.session_state.get('primary_repo_index', 0):
            st.caption("⭐ プライマリーリポジトリ")
    else:
        owner = config.DEFAULT_OWNER
        repo = config.DEFAULT_REPO
    
    st.divider()
    
    st.header("対象条件")
    days = st.slider("対象期間（日）", 7, 365, 90, step=7)

st.markdown("---")

# データ取得
owner_tmp = owner
repo_tmp = repo
cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)

cached_data = db_cache.load_prs(owner_tmp, repo_tmp)

if not cached_data:
    st.error("データがありません。`python fetch_data.py --all` を実行してください。")
    st.stop()

# DataFrameに変換
df_all = pd.DataFrame(cached_data)

# 日時変換
df_all["createdAt_dt"] = pd.to_datetime(df_all["createdAt"], format="ISO8601", utc=True)
df_all["closedAt_dt"] = pd.to_datetime(df_all["closedAt"], format="ISO8601", utc=True, errors='coerce')
df_all["mergedAt_dt"] = pd.to_datetime(df_all["mergedAt"], format="ISO8601", utc=True, errors='coerce')

# 期間フィルタ
df_filtered = df_all[df_all["createdAt_dt"] >= cutoff_dt].copy()

st.caption(f"対象PR数: {len(df_filtered)}件 (OPEN: {(df_filtered['state']=='OPEN').sum()}, MERGED: {(df_filtered['state']=='MERGED').sum()}, CLOSED: {(df_filtered['state']=='CLOSED').sum()})")

# ========== Four Keys計算 ==========

# 1. Deployment Frequency (デプロイ頻度)
merged_prs = df_filtered[df_filtered["state"] == "MERGED"].copy()
if not merged_prs.empty:
    # 週数を計算
    date_range = (merged_prs["mergedAt_dt"].max() - merged_prs["mergedAt_dt"].min()).days
    weeks = max(date_range / 7, 1)
    deployment_frequency = len(merged_prs) / weeks
    
    # 週ごとの集計
    merged_prs["week"] = merged_prs["mergedAt_dt"].dt.to_period("W").astype(str)
    weekly_deploys = merged_prs.groupby("week").size().reset_index(name="deploys")
else:
    deployment_frequency = 0
    weekly_deploys = pd.DataFrame()

# 2. Lead Time for Changes (変更のリードタイム)
if not merged_prs.empty:
    merged_prs["lead_time_hours"] = (merged_prs["mergedAt_dt"] - merged_prs["createdAt_dt"]).dt.total_seconds() / 3600
    merged_prs["lead_time_days"] = merged_prs["lead_time_hours"] / 24
    avg_lead_time_days = merged_prs["lead_time_days"].median()  # 中央値を使用
else:
    avg_lead_time_days = 0

# 3. Change Failure Rate (変更失敗率)
# 仮定: "revert", "hotfix", "urgent", "fix" などのキーワードを含むPRを失敗と見なす
failure_keywords = ["revert", "hotfix", "urgent", "fix", "rollback", "emergency", "critical"]

if not merged_prs.empty:
    merged_prs["is_failure"] = merged_prs.apply(
        lambda row: any(
            keyword in str(row["title"]).lower() or 
            keyword in ",".join(row.get("labels", [])).lower()
            for keyword in failure_keywords
        ),
        axis=1
    )
    
    failure_count = merged_prs["is_failure"].sum()
    change_failure_rate = (failure_count / len(merged_prs)) * 100 if len(merged_prs) > 0 else 0
    
    # 失敗PRリスト
    failure_prs = merged_prs[merged_prs["is_failure"]].copy()
else:
    change_failure_rate = 0
    failure_prs = pd.DataFrame()

# 4. Time to Restore Service (MTTR: Mean Time To Restore)
# 仮定: 失敗PRの作成からマージまでの時間を復旧時間とする
if not failure_prs.empty:
    failure_prs["restore_time_hours"] = failure_prs["lead_time_hours"]
    avg_mttr_hours = failure_prs["restore_time_hours"].median()  # 中央値を使用
else:
    avg_mttr_hours = 0

# 4つのメトリクス表示エリア
st.markdown("## Four Keys メトリクス")

col1, col2, col3, col4 = st.columns(4)

# メトリクスカード表示
with col1:
    level, color = classify_dora_level(deployment_frequency, "deployment_frequency")
    st.markdown(f"""
    <div style="background: {color}22; border-left: 4px solid {color}; padding: 1rem; border-radius: 0.5rem;">
        <h4 style="margin: 0; color: {color};">Deployment Frequency</h4>
        <h2 style="margin: 0.5rem 0;">{deployment_frequency:.1f} /週</h2>
        <p style="margin: 0; font-weight: bold; color: {color};">DORA Level: {level}</p>
    </div>
    """, unsafe_allow_html=True)
    st.caption(f"総デプロイ数: {len(merged_prs)}件")

with col2:
    level, color = classify_dora_level(avg_lead_time_days, "lead_time")
    st.markdown(f"""
    <div style="background: {color}22; border-left: 4px solid {color}; padding: 1rem; border-radius: 0.5rem;">
        <h4 style="margin: 0; color: {color};">Lead Time for Changes</h4>
        <h2 style="margin: 0.5rem 0;">{avg_lead_time_days:.1f} 日</h2>
        <p style="margin: 0; font-weight: bold; color: {color};">DORA Level: {level}</p>
    </div>
    """, unsafe_allow_html=True)
    st.caption(f"中央値: {avg_lead_time_days:.1f}日")

with col3:
    level, color = classify_dora_level(change_failure_rate, "change_failure_rate")
    st.markdown(f"""
    <div style="background: {color}22; border-left: 4px solid {color}; padding: 1rem; border-radius: 0.5rem;">
        <h4 style="margin: 0; color: {color};">Change Failure Rate</h4>
        <h2 style="margin: 0.5rem 0;">{change_failure_rate:.1f}%</h2>
        <p style="margin: 0; font-weight: bold; color: {color};">DORA Level: {level}</p>
    </div>
    """, unsafe_allow_html=True)
    st.caption(f"失敗PR: {len(failure_prs)}件 / {len(merged_prs)}件")

with col4:
    level, color = classify_dora_level(avg_mttr_hours, "mttr")
    st.markdown(f"""
    <div style="background: {color}22; border-left: 4px solid {color}; padding: 1rem; border-radius: 0.5rem;">
        <h4 style="margin: 0; color: {color};">MTTR</h4>
        <h2 style="margin: 0.5rem 0;">{avg_mttr_hours:.1f} 時間</h2>
        <p style="margin: 0; font-weight: bold; color: {color};">DORA Level: {level}</p>
    </div>
    """, unsafe_allow_html=True)
    st.caption(f"復旧時間中央値")

st.markdown("---")

# 4象限グラフ（4つの指標を2x2で表示）
st.markdown("### Four Keys 4象限表示")

# 2x2のレイアウト
col1, col2 = st.columns(2)

# 左上: Deployment Frequency
with col1:
    st.markdown("#### Deployment Frequency")
    df_level, df_color = classify_dora_level(deployment_frequency, "deployment_frequency")
    
    # 日別デプロイ数を集計
    if not merged_prs.empty:
        daily_deploys = merged_prs.groupby(merged_prs["mergedAt_dt"].dt.date).size().reset_index(name="count")
        daily_deploys.columns = ["date", "count"]
        
        fig_df = go.Figure()
        fig_df.add_trace(go.Scatter(
            x=daily_deploys["date"],
            y=daily_deploys["count"],
            mode='lines+markers',
            name='デプロイ数',
            line=dict(color=df_color, width=2),
            marker=dict(size=6),
            hovertemplate='<b>%{x}</b><br>デプロイ数: %{y}件<extra></extra>'
        ))
        fig_df.update_layout(
            xaxis_title="日付",
            yaxis_title="デプロイ数",
            height=250,
            margin=dict(l=0, r=0, t=10, b=0),
            showlegend=False,
            hovermode='x unified'
        )
        st.plotly_chart(fig_df, use_container_width=True)
    
    st.metric(
        label="平均デプロイ頻度",
        value=f"{deployment_frequency:.1f} 回/週",
        delta=f"{df_level}",
        delta_color="normal" if df_level in ["Elite", "High"] else "inverse"
    )
    st.caption("PRマージ = デプロイと仮定")

# 右上: Lead Time for Changes
with col2:
    st.markdown("#### Lead Time for Changes")
    lt_level, lt_color = classify_dora_level(avg_lead_time_days, "lead_time")
    
    # リードタイムの推移
    if not merged_prs.empty:
        lead_time_by_date = merged_prs[["mergedAt_dt", "lead_time_days"]].copy()
        lead_time_by_date = lead_time_by_date.sort_values("mergedAt_dt")
        
        fig_lt = go.Figure()
        fig_lt.add_trace(go.Scatter(
            x=lead_time_by_date["mergedAt_dt"],
            y=lead_time_by_date["lead_time_days"],
            mode='markers',
            name='リードタイム',
            marker=dict(size=6, color=lt_color, opacity=0.6),
            hovertemplate='<b>%{x}</b><br>リードタイム: %{y:.1f}日<extra></extra>'
        ))
        
        # 移動平均線を追加
        if len(lead_time_by_date) >= 7:
            lead_time_by_date["ma7"] = lead_time_by_date["lead_time_days"].rolling(window=7, min_periods=1).mean()
            fig_lt.add_trace(go.Scatter(
                x=lead_time_by_date["mergedAt_dt"],
                y=lead_time_by_date["ma7"],
                mode='lines',
                name='7日移動平均',
                line=dict(color=lt_color, width=2, dash='dash'),
                hovertemplate='<b>%{x}</b><br>7日平均: %{y:.1f}日<extra></extra>'
            ))
        
        fig_lt.update_layout(
            xaxis_title="日付",
            yaxis_title="リードタイム (日)",
            height=250,
            margin=dict(l=0, r=0, t=10, b=0),
            showlegend=False,
            hovermode='x unified'
        )
        st.plotly_chart(fig_lt, use_container_width=True)
    
    st.metric(
        label="リードタイム中央値",
        value=f"{avg_lead_time_days:.1f} 日",
        delta=f"{lt_level}",
        delta_color="normal" if lt_level in ["Elite", "High"] else "inverse"
    )
    st.caption("PR作成からマージまでの中央値")

# 左下: Change Failure Rate
with col1:
    st.markdown("#### Change Failure Rate")
    cfr_level, cfr_color = classify_dora_level(change_failure_rate, "change_failure_rate")
    
    # 週ごとの失敗率
    if not merged_prs.empty:
        merged_prs["week_period"] = merged_prs["mergedAt_dt"].dt.to_period("W")
        weekly_failure = merged_prs.groupby("week_period").agg({
            "is_failure": ["sum", "count"]
        }).reset_index()
        weekly_failure.columns = ["week", "failures", "total"]
        weekly_failure["failure_rate"] = (weekly_failure["failures"] / weekly_failure["total"]) * 100
        weekly_failure["week_str"] = weekly_failure["week"].astype(str)
        
        fig_cfr = go.Figure()
        fig_cfr.add_trace(go.Bar(
            x=weekly_failure["week_str"],
            y=weekly_failure["failure_rate"],
            name='失敗率',
            marker=dict(color=cfr_color),
            hovertemplate='<b>%{x}</b><br>失敗率: %{y:.1f}%<extra></extra>'
        ))
        
        fig_cfr.update_layout(
            xaxis_title="週",
            yaxis_title="失敗率 (%)",
            height=250,
            margin=dict(l=0, r=0, t=10, b=0),
            showlegend=False,
            hovermode='x unified'
        )
        st.plotly_chart(fig_cfr, use_container_width=True)
    
    st.metric(
        label="変更失敗率",
        value=f"{change_failure_rate:.1f} %",
        delta=f"{cfr_level}",
        delta_color="normal" if cfr_level in ["Elite", "High"] else "inverse"
    )
    st.caption(f"失敗PR: {len(failure_prs)}件 / {len(merged_prs)}件")

# 右下: Mean Time to Restore
with col2:
    st.markdown("#### Mean Time to Restore")
    mttr_level, mttr_color = classify_dora_level(avg_mttr_hours, "mttr")
    
    # 復旧時間の推移
    if not failure_prs.empty:
        restore_time_by_date = failure_prs[["mergedAt_dt", "restore_time_hours"]].copy()
        restore_time_by_date = restore_time_by_date.sort_values("mergedAt_dt")
        
        fig_mttr = go.Figure()
        fig_mttr.add_trace(go.Scatter(
            x=restore_time_by_date["mergedAt_dt"],
            y=restore_time_by_date["restore_time_hours"],
            mode='markers',
            name='復旧時間',
            marker=dict(size=6, color=mttr_color, opacity=0.6),
            hovertemplate='<b>%{x}</b><br>復旧時間: %{y:.1f}時間<extra></extra>'
        ))
        
        # 移動平均線を追加
        if len(restore_time_by_date) >= 3:
            restore_time_by_date["ma3"] = restore_time_by_date["restore_time_hours"].rolling(window=3, min_periods=1).mean()
            fig_mttr.add_trace(go.Scatter(
                x=restore_time_by_date["mergedAt_dt"],
                y=restore_time_by_date["ma3"],
                mode='lines',
                name='3件移動平均',
                line=dict(color=mttr_color, width=2, dash='dash'),
                hovertemplate='<b>%{x}</b><br>3件平均: %{y:.1f}時間<extra></extra>'
            ))
        
        fig_mttr.update_layout(
            xaxis_title="日付",
            yaxis_title="復旧時間 (時間)",
            height=250,
            margin=dict(l=0, r=0, t=10, b=0),
            showlegend=False,
            hovermode='x unified'
        )
        st.plotly_chart(fig_mttr, use_container_width=True)
    
    st.metric(
        label="平均復旧時間",
        value=f"{avg_mttr_hours:.1f} 時間",
        delta=f"{mttr_level}",
        delta_color="normal" if mttr_level in ["Elite", "High"] else "inverse"
    )
    st.caption("失敗PRのリードタイムを復旧時間と仮定")

st.markdown("---")

st.markdown("---")

# レーダーチャート（4指標を正規化して表示）
st.markdown("### Four Keys レーダーチャート")

# DORAレベルを数値化 (Elite=4, High=3, Medium=2, Low=1)
level_map = {"Elite": 4, "High": 3, "Medium": 2, "Low": 1}

df_level, _ = classify_dora_level(deployment_frequency, "deployment_frequency")
lt_level, _ = classify_dora_level(avg_lead_time_days, "lead_time")
cfr_level, _ = classify_dora_level(change_failure_rate, "change_failure_rate")
mttr_level, _ = classify_dora_level(avg_mttr_hours, "mttr")

radar_data = pd.DataFrame({
    "指標": ["Deployment<br>Frequency", "Lead Time<br>for Changes", "Change<br>Failure Rate", "MTTR"],
    "レベル": [
        level_map.get(df_level, 0),
        level_map.get(lt_level, 0),
        level_map.get(cfr_level, 0),
        level_map.get(mttr_level, 0)
    ]
})

fig_radar = go.Figure()

fig_radar.add_trace(go.Scatterpolar(
    r=radar_data["レベル"].tolist() + [radar_data["レベル"].iloc[0]],  # 最初の点を追加して閉じる
    theta=radar_data["指標"].tolist() + [radar_data["指標"].iloc[0]],
    fill='toself',
    name='現在のレベル',
    line=dict(color='#3b82f6', width=2),
    fillcolor='rgba(59, 130, 246, 0.3)'
))

# Elite基準線（参考）
fig_radar.add_trace(go.Scatterpolar(
    r=[4, 4, 4, 4, 4],
    theta=radar_data["指標"].tolist() + [radar_data["指標"].iloc[0]],
    fill='toself',
    name='Elite基準',
    line=dict(color='#10b981', width=1, dash='dash'),
    fillcolor='rgba(16, 185, 129, 0.1)'
))

fig_radar.update_layout(
    polar=dict(
        radialaxis=dict(
            visible=True,
            range=[0, 4],
            tickvals=[1, 2, 3, 4],
            ticktext=["Low", "Medium", "High", "Elite"]
        )
    ),
    showlegend=True,
    height=500
)

st.plotly_chart(fig_radar, use_container_width=True)

st.markdown("---")

# 詳細分析タブ
tab1, tab2, tab3, tab4 = st.tabs(["Deployment Frequency", "Lead Time", "Change Failure Rate", "MTTR"])

with tab1:
    st.markdown("### Deployment Frequency (デプロイ頻度)")
    
    if not merged_prs.empty:
        # 日別デプロイ数を集計
        daily_deploys_tab = merged_prs.groupby(merged_prs["mergedAt_dt"].dt.date).size().reset_index(name="count")
        daily_deploys_tab.columns = ["date", "count"]
        
        fig_df = go.Figure()
        fig_df.add_trace(go.Scatter(
            x=daily_deploys_tab["date"],
            y=daily_deploys_tab["count"],
            mode='lines+markers',
            name='デプロイ数',
            line=dict(color='#3b82f6', width=2),
            marker=dict(size=8),
            fill='tozeroy',
            fillcolor='rgba(59, 130, 246, 0.2)',
            hovertemplate='<b>%{x}</b><br>デプロイ数: %{y}件<extra></extra>'
        ))
        fig_df.update_layout(
            title="日別デプロイ数",
            xaxis_title="日付",
            yaxis_title="デプロイ数",
            height=400,
            hovermode='x unified'
        )
        st.plotly_chart(fig_df, use_container_width=True)
        
        st.markdown("#### 統計")
        col_a, col_b, col_c = st.columns(3)
        with col_a:
            st.metric("総デプロイ数", f"{len(merged_prs)}件")
        with col_b:
            st.metric("週平均", f"{deployment_frequency:.1f}件")
        with col_c:
            weekly_max = weekly_deploys["deploys"].max()
            st.metric("週最大", f"{weekly_max}件")
    else:
        st.info("マージされたPRがありません")

with tab2:
    st.markdown("### Lead Time for Changes (変更のリードタイム)")
    
    if not merged_prs.empty:
        # リードタイムの時系列推移
        lead_time_sorted = merged_prs[["mergedAt_dt", "lead_time_days", "number", "title"]].copy()
        lead_time_sorted = lead_time_sorted.sort_values("mergedAt_dt")
        
        fig_lt = go.Figure()
        fig_lt.add_trace(go.Scatter(
            x=lead_time_sorted["mergedAt_dt"],
            y=lead_time_sorted["lead_time_days"],
            mode='markers',
            name='リードタイム',
            marker=dict(size=8, color='#f59e0b', opacity=0.6),
            text=lead_time_sorted["number"],
            hovertemplate='<b>PR #%{text}</b><br>%{x}<br>リードタイム: %{y:.1f}日<extra></extra>'
        ))
        
        # 移動平均線を追加
        if len(lead_time_sorted) >= 7:
            lead_time_sorted["ma7"] = lead_time_sorted["lead_time_days"].rolling(window=7, min_periods=1).mean()
            fig_lt.add_trace(go.Scatter(
                x=lead_time_sorted["mergedAt_dt"],
                y=lead_time_sorted["ma7"],
                mode='lines',
                name='7日移動平均',
                line=dict(color='#f59e0b', width=3),
                hovertemplate='<b>7日平均</b><br>%{x}<br>%{y:.1f}日<extra></extra>'
            ))
        
        fig_lt.update_layout(
            title="リードタイムの推移",
            xaxis_title="マージ日",
            yaxis_title="リードタイム (日)",
            height=400,
            hovermode='closest'
        )
        st.plotly_chart(fig_lt, use_container_width=True)
        
        st.markdown("#### 統計")
        col_a, col_b, col_c, col_d = st.columns(4)
        with col_a:
            st.metric("中央値", f"{merged_prs['lead_time_days'].median():.1f}日")
        with col_b:
            st.metric("平均", f"{merged_prs['lead_time_days'].mean():.1f}日")
        with col_c:
            st.metric("最小", f"{merged_prs['lead_time_days'].min():.1f}日")
        with col_d:
            st.metric("最大", f"{merged_prs['lead_time_days'].max():.1f}日")
        
        st.markdown("#### � リードタイムが長いPR TOP10")
        slow_prs = merged_prs.nlargest(10, "lead_time_days")[["number", "title", "author", "lead_time_days", "url"]]
        st.dataframe(
            slow_prs.rename(columns={
                "number": "PR#",
                "title": "タイトル",
                "author": "作成者",
                "lead_time_days": "リードタイム(日)",
                "url": "URL"
            }).style.format({"リードタイム(日)": "{:.1f}"}),
            use_container_width=True
        )
    else:
        st.info("マージされたPRがありません")

with tab3:
    st.markdown("### Change Failure Rate (変更失敗率)")
    
    st.info(f"""
    **検出キーワード**: {", ".join(failure_keywords)}
    
    これらのキーワードがタイトルまたはラベルに含まれるPRを「失敗」と見なしています。
    """)
    
    if not merged_prs.empty:
        # 週ごとの失敗率推移
        merged_prs_tab = merged_prs.copy()
        merged_prs_tab["week_start"] = merged_prs_tab["mergedAt_dt"].dt.to_period("W").apply(lambda r: r.start_time)
        weekly_failure_tab = merged_prs_tab.groupby("week_start").agg({
            "is_failure": ["sum", "count"]
        }).reset_index()
        weekly_failure_tab.columns = ["week", "failures", "total"]
        weekly_failure_tab["failure_rate"] = (weekly_failure_tab["failures"] / weekly_failure_tab["total"]) * 100
        weekly_failure_tab["success_rate"] = 100 - weekly_failure_tab["failure_rate"]
        
        fig_cfr = go.Figure()
        fig_cfr.add_trace(go.Bar(
            x=weekly_failure_tab["week"],
            y=weekly_failure_tab["failure_rate"],
            name='失敗率',
            marker=dict(color='#ef4444'),
            hovertemplate='<b>%{x}</b><br>失敗率: %{y:.1f}%<extra></extra>'
        ))
        fig_cfr.add_trace(go.Bar(
            x=weekly_failure_tab["week"],
            y=weekly_failure_tab["success_rate"],
            name='成功率',
            marker=dict(color='#10b981'),
            hovertemplate='<b>%{x}</b><br>成功率: %{y:.1f}%<extra></extra>'
        ))
        
        fig_cfr.update_layout(
            title="週次変更失敗率の推移",
            xaxis_title="週",
            yaxis_title="割合 (%)",
            barmode='stack',
            height=400,
            hovermode='x unified'
        )
        st.plotly_chart(fig_cfr, use_container_width=True)
        
        if not failure_prs.empty:
            st.markdown("#### 失敗PR一覧")
            st.dataframe(
                failure_prs[["number", "title", "author", "mergedAt_dt", "labels", "url"]].rename(columns={
                    "number": "PR#",
                    "title": "タイトル",
                    "author": "作成者",
                    "mergedAt_dt": "マージ日時",
                    "labels": "ラベル",
                    "url": "URL"
                }),
                use_container_width=True
            )
        else:
            st.success("失敗PRはありません！")
    else:
        st.info("マージされたPRがありません")

with tab4:
    st.markdown("### Time to Restore Service (MTTR)")
    
    st.info("""
    **計算方法**: 失敗PRの作成からマージまでの時間を「復旧時間」としています。
    
    本来は、インシデント発生時刻から復旧完了までの時間を測定すべきですが、
    PRデータのみから推定しています。
    """)
    
    if not failure_prs.empty:
        # 復旧時間の時系列推移
        restore_sorted = failure_prs[["mergedAt_dt", "restore_time_hours", "number", "title"]].copy()
        restore_sorted = restore_sorted.sort_values("mergedAt_dt")
        
        fig_mttr = go.Figure()
        fig_mttr.add_trace(go.Scatter(
            x=restore_sorted["mergedAt_dt"],
            y=restore_sorted["restore_time_hours"],
            mode='markers',
            name='復旧時間',
            marker=dict(size=10, color='#ef4444', opacity=0.7),
            text=restore_sorted["number"],
            hovertemplate='<b>PR #%{text}</b><br>%{x}<br>復旧時間: %{y:.1f}時間<extra></extra>'
        ))
        
        # 移動平均線を追加
        if len(restore_sorted) >= 3:
            restore_sorted["ma3"] = restore_sorted["restore_time_hours"].rolling(window=3, min_periods=1).mean()
            fig_mttr.add_trace(go.Scatter(
                x=restore_sorted["mergedAt_dt"],
                y=restore_sorted["ma3"],
                mode='lines',
                name='3件移動平均',
                line=dict(color='#ef4444', width=3),
                hovertemplate='<b>3件平均</b><br>%{x}<br>%{y:.1f}時間<extra></extra>'
            ))
        
        fig_mttr.update_layout(
            title="復旧時間の推移",
            xaxis_title="マージ日",
            yaxis_title="復旧時間 (時間)",
            height=400,
            hovermode='closest'
        )
        st.plotly_chart(fig_mttr, use_container_width=True)
        
        st.markdown("#### 統計")
        col_a, col_b, col_c, col_d = st.columns(4)
        with col_a:
            st.metric("中央値", f"{failure_prs['restore_time_hours'].median():.1f}時間")
        with col_b:
            st.metric("平均", f"{failure_prs['restore_time_hours'].mean():.1f}時間")
        with col_c:
            st.metric("最小", f"{failure_prs['restore_time_hours'].min():.1f}時間")
        with col_d:
            st.metric("最大", f"{failure_prs['restore_time_hours'].max():.1f}時間")
        
        st.markdown("#### � 復旧に時間がかかったPR TOP10")
        slow_restore = failure_prs.nlargest(10, "restore_time_hours")[["number", "title", "author", "restore_time_hours", "url"]]
        st.dataframe(
            slow_restore.rename(columns={
                "number": "PR#",
                "title": "タイトル",
                "author": "作成者",
                "restore_time_hours": "復旧時間(時間)",
                "url": "URL"
            }).style.format({"復旧時間(時間)": "{:.1f}"}),
            use_container_width=True
        )
    else:
        st.success("失敗PRがないため、復旧時間データはありません")

st.markdown("---")

st.markdown("""
### 参考情報

- [DORA (DevOps Research and Assessment)](https://www.devops-research.com/research.html)
- [Google Cloud - Four Keys Project](https://github.com/GoogleCloudPlatform/fourkeys)
- [Accelerate (書籍)](https://itrevolution.com/product/accelerate/)

### � 改善のヒント

**Deployment Frequency を上げるには:**
- PR サイズを小さくする
- CI/CD パイプラインを高速化
- フィーチャーフラグを活用

**Lead Time を短縮するには:**
- PRレビューを迅速化
- 自動テストを充実
- PR作成前のコミュニケーション強化

**Change Failure Rate を下げるには:**
- テストカバレッジ向上
- Canary デプロイメント導入
- プレプロダクション環境の活用

**MTTR を短縮するには:**
- モニタリング・アラート強化
- ロールバック手順の自動化
- インシデント対応訓練
""")
