# GitHub PR Dashboard

GitHubのPull Requestを可視化・分析するStreamlitダッシュボード

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)

PRの状態、レビュー状況、ボトルネックを直感的に可視化し、開発チームの生産性向上を支援します。

## ディレクトリ構成

```
dashboard/
├── app.py                # メインエントリーポイント
├── pages/
│   ├── 1_dashboard.py    # PRタイムライン可視化
│   ├── 2_analytics.py    # PR統計分析
│   └── 3_four_keys.py    # Four Keys指標
├── fetch_data.py         # データ取得スクリプト
├── config.py             # 設定ファイル
├── fetcher.py            # GitHub API呼び出し
├── db_cache.py           # SQLiteキャッシュ管理
├── action_tracker.py     # アクション追跡
└── pr_cache.db           # キャッシュDB(自動生成)
```

## クイックスタート

### 必要なパッケージ

```bash
pip install -r requirements.txt
```

### GitHub Tokenの設定

```bash
$env:GITHUB_TOKEN="your_token_here"
```

### 初回セットアップ

```bash
# データ取得
python dashboard/fetch_data.py --all

# ダッシュボード起動
cd dashboard
streamlit run app.py
```

詳細なドキュメントは `dashboard/README.md` を参照してください。

## 主な機能

- **マルチリポジトリ対応**: 複数のリポジトリを一元管理
- **PRタイムライン**: ガントチャートで視覚的にPRの進行状況を把握
- **ボトルネック分析**: レビュー待ち・修正待ちPRを自動検出（営業日ベース）
- **レビュワー分析**: 誰がレビューに応答していないかを特定
- **コメントスレッド分析**: 指摘→返信→解決の流れを追跡
- **高速表示**: ローカルキャッシュで0.1秒以下の表示速度

## スクリーンショット

（追加予定）

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## 貢献

バグ報告や機能リクエストは [Issues](../../issues) で受け付けています。
プルリクエストも歓迎します。

