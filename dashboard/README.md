# GitHub PR Dashboard

GitHubのPRを可視化・分析する統合Streamlitダッシュボード

日本語 | [English](README_EN.md)

## 主な機能

- マルチリポジトリ対応
- PRタイムライン可視化（ガントチャート）
- コメントスレッド分析（指摘→返信→解決の流れを追跡）
- ボトルネック分析（レビュー待ち/修正待ちPRを自動検出）
- レビュワー分析（応答状況の可視化）
- レビュー速度分析
- 変更パターン分析

---

## セットアップ

### 1. パッケージインストール

```bash
# リポジトリのルートディレクトリで
pip install -r requirements.txt
```

### 2. GitHub Token設定

環境変数に設定（repoスコープ必要）:

```bash
# Windows (PowerShell)
$env:GITHUB_TOKEN="your_token_here"

# Linux/Mac
export GITHUB_TOKEN=your_token_here
```

### 3. リポジトリ設定

`config.py` で対象リポジトリを設定:

```python
REPOSITORIES = [
    {
        "name": "MyProject",
        "owner": "your-organization",
        "repo": "your-repository"
    },
]
```

### 4. データ取得と起動

```bash
# データ取得
python fetch_data.py --all

# ダッシュボード起動
streamlit run app.py
```

---

## データ更新

### 手動更新

```bash
python fetch_data.py --all          # 全リポジトリ
python fetch_data.py --all --force  # 強制更新
python fetch_data.py --days 180     # 期間指定
```

### 定期実行（推奨）

```powershell
# Windows: 毎日午前2時
schtasks /create /tn "GitHub PR Fetch" /tr "python C:\path\to\dashboard\fetch_data.py --all" /sc daily /st 02:00
```

```bash
# Linux/Mac: cron
0 2 * * * cd /path/to/dashboard && python fetch_data.py --all
```

---

## 機能詳細

### PRダッシュボード

- **PRタイムライン**: ガントチャートで可視化（営業日ベース、状態別色分け）
- **書類/コード分析**: ディレクトリごとのPR影響範囲
- **アクション追跡**: レビュー待ち/修正待ちPRの自動検出

### PR分析

- **滞留分析**: OPEN PRの滞留時間分布
- **ブロッカー分析**: 未クローズ原因の推定
- **レビュワー分析**: レビュー活動とコメント応答状況
- **トレンド分析**: 週次PR作成数の推移
- **ボトルネック分析**: レビュー待ち/修正待ちの詳細（営業日ベース）
- **レビュー速度**: マージまでの時間分析
- **変更パターン**: ファイル変更頻度とPR規模

---

## アーキテクチャ

### キャッシュ機構

SQLite（`pr_cache.db`）にPRデータ、ETag、スレッド詳細を保存。
データフロー: `fetch_data.py`（1日1回） → `pr_cache.db` → `app.py`（即座に表示）

### パフォーマンス

- 初回表示: 0.1-0.5秒
- 再表示: 0.1秒以下
- API呼び出し: 1日1回のみ

---

## トラブルシューティング

| 問題 | 対処法 |
|------|--------|
| データが表示されない | `python fetch_data.py --all` |
| データが古い | `python fetch_data.py --all --force` |
| リポジトリ追加 | `config.py`のREPOSITORIESに追加後、データ再取得 |
| スレッド情報が表示されない | `python fetch_data.py --all --force` |

---

## ファイル構成

```
dashboard/
├── app.py                # エントリーポイント
├── pages/
│   ├── 1_dashboard.py    # PRダッシュボード
│   ├── 2_analytics.py    # PR分析
│   └── 3_four_keys.py    # Four Keys
├── fetch_data.py         # データ取得
├── config.py             # リポジトリ設定
├── fetcher.py            # GitHub API
├── db_cache.py           # キャッシュ管理
├── action_tracker.py     # アクション追跡
└── pr_cache.db           # DB（自動生成）
```

---

## カスタマイズ

- 営業日定義: `calculate_business_hours()` 関数を修正
- Stale判定: サイドバーで調整（デフォルト: 168時間）
- 色分け: 状態別（OPEN/MERGED/CLOSED）、経過時間別（緑→赤）

---
