# GitHub PR Dashboard

GitHubのPull Requestを可視化・分析するダッシュボード

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)

日本語 | [English](README_EN.md)

PRの状態、レビュー状況、ボトルネックを直感的に可視化し、開発チームの生産性向上を支援します。

## 2つのバージョン

このリポジトリは2つの実装を提供しています:

1. **[Streamlit版](dashboard/)** - ローカルPC上で動作するPythonベースのダッシュボード
2. **[GitHub Pages版](Dashboard_pages/)** - GitHub Pagesで公開できる静的Webアプリケーション（推奨）

| 機能 | Streamlit版 | GitHub Pages版 |
|------|------------|------------------|
| 実行環境 | ローカルPC | クラウド（無料） |
| セットアップ | Python環境必要 | 不要（ブラウザのみ） |
| 自動更新 | 手動設定 | GitHub Actions（自動） |
| アクセス | localhost | 公開URL |
| チーム共有 | 難しい | 簡単（URLを共有） |

GitHub Pages版の使い方は [Dashboard_pages/README.md](Dashboard_pages/README.md) を参照してください。

[デモサイト (GitHub Pages)](https://hidenori24.github.io/github-pr-dashboard/) でこのリポジトリのPRダッシュボードを確認できます。

## ディレクトリ構成

```
├── Dashboard_pages/       # GitHub Pages版（静的Webアプリ）
│   ├── index.html        # メインHTMLページ（5ページ統合）
│   ├── css/
│   │   └── style.css     # スタイルシート
│   ├── js/
│   │   ├── config.js     # 設定ファイル
│   │   ├── i18n.js       # 多言語対応
│   │   ├── app.js        # メインアプリケーションロジック
│   │   ├── dashboard.js  # ダッシュボードページ
│   │   ├── analytics.js  # 分析ページ
│   │   ├── fourkeys.js   # Four Keysページ
│   │   └── statistics.js # 統計・レポートページ
│   ├── data/             # JSONデータ（GitHub Actions自動生成）
│   │   ├── config.json   # リポジトリ設定
│   │   ├── prs.json      # PRデータ
│   │   ├── analytics.json # 分析データ
│   │   ├── fourkeys.json # Four Keysデータ
│   │   └── cache_info.json # キャッシュ情報
│   ├── generate_data.py  # データ生成スクリプト
│   └── README.md         # Pages版のドキュメント
│
└── dashboard/            # Streamlit版（ローカル実行）
    ├── app.py            # メインエントリーポイント
    ├── pages/
    │   ├── 1_dashboard.py    # PRタイムライン可視化
    │   ├── 2_analytics.py    # PR統計分析（7つの分析タブ）
    │   ├── 3_four_keys.py    # Four Keys指標（DORA Metrics）
    │   └── 4_statistics.py   # 統計・週間レポート
    ├── fetch_data.py     # データ取得スクリプト
    ├── config.py         # 設定ファイル
    ├── fetcher.py        # GitHub API呼び出し
    ├── db_cache.py       # SQLiteキャッシュ管理
    ├── action_tracker.py # アクション追跡
    └── pr_cache.db       # キャッシュDB(自動生成)
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

### ダッシュボード機能
- **マルチリポジトリ対応**: 複数のリポジトリを一元管理
- **PRタイムライン**: ガントチャートで視覚的にPRの進行状況を把握
- **書類/コード分析**: ディレクトリごとのPRタイムライン
- **アクション追跡**: レビュー待ち・修正待ちPRの自動検出（営業日ベース）

### 分析機能（7つの分析タブ）
- **滞留分析**: Open PRの滞留時間分布
- **ブロッカー分析**: 未クローズ原因の推定
- **レビュワー分析**: レビューアクティビティとコメント応答状況
- **トレンド分析**: 週次PR作成数推移
- **ボトルネック分析**: レビュー待ち・修正待ちの詳細
- **レビュー速度**: マージまでの時間分析
- **変更パターン**: ファイル変更頻度とPR規模

### Four Keys指標
- **Deployment Frequency**: デプロイ頻度（週あたりのデプロイ回数）
- **Lead Time for Changes**: 変更のリードタイム（PR作成からマージまで）
- **Change Failure Rate**: 変更失敗率（失敗PRの割合）
- **Time to Restore Service**: サービス復旧時間（MTTR）

### 統計・レポート機能
- **期間サマリー**: 総PR数、マージ率、平均リードタイム、アクティブ開発者数
- **トレンド分析**: 過去8週間のPR作成数と平均リードタイムの推移
- **レビュー活動**: 総レビュー数、総コメント数、PR当たりの平均値
- **自動洞察**: 開発活動の分析と問題検知
- **改善提案**: データに基づく具体的なアクション提案
- **週間レポート出力**: Markdown形式でのレポート生成

### パフォーマンス
- **高速表示**: ローカルキャッシュで0.1秒以下の表示速度
- **自動更新**: GitHub Actionsによる定期データ更新
- **Rate Limit対策**: ETag/Last-Modifiedヘッダーを使用した効率的なAPI呼び出し

## Four Keys指標（DORA Metrics）

DevOps Research and Assessment (DORA) の4つの主要指標でソフトウェア開発のパフォーマンスを測定します。

### 4つの主要指標

1. **Deployment Frequency（デプロイ頻度）**
   - コードが本番環境にデプロイされる頻度
   - マージされたPRの数から算出
   - 高パフォーマンスチームは1日に複数回デプロイ

2. **Lead Time for Changes（変更のリードタイム）**
   - コミットから本番環境へのデプロイまでの時間
   - PR作成からマージまでの平均時間で測定
   - 高パフォーマンスチームは1日以内

3. **Change Failure Rate（変更失敗率）**
   - デプロイが失敗または修正が必要となる割合
   - クローズされたPRとマージされたPRの比率から算出
   - 高パフォーマンスチームは15%以下

4. **Time to Restore Service（サービス復旧時間/MTTR）**
   - 本番環境の問題から復旧までの時間
   - Hotfixタグのついたイシューの解決時間で測定
   - 高パフォーマンスチームは1時間以内

### パフォーマンスレベル

DORA Metricsに基づく4つのパフォーマンスレベル：

- **Elite（エリート）**: 全指標で最高レベル
- **High（高）**: 多くの指標で優秀
- **Medium（中）**: 平均的なパフォーマンス
- **Low（低）**: 改善の余地あり

## 統計情報・週間レポート機能

開発プロセスの現状を理解し、改善の機会を見つけるための包括的な統計情報を提供します。

### 主な統計指標

- **期間サマリー**: 総PR数、マージ率、平均リードタイム、アクティブ開発者数
- **トレンド分析**: 過去8週間のPR作成数と平均リードタイムの推移
- **レビュー活動**: 総レビュー数、総コメント数、PR当たりの平均値

### 自動洞察機能

統計データから以下のような洞察を自動生成：

- 開発活動の活発化・低下の検知
- レビュー速度の改善・遅延の分析
- マージ率の評価
- レビュー活動の監視
- 滞留PRの警告

### 改善提案

現状の課題に基づいて具体的な改善アクションを提案：

- レビュー時間の短縮方法
- レビュー文化の醸成
- PR完了率の向上策
- チームコラボレーションの促進

### 週間レポート出力

- Markdown形式でのレポート出力
- 主要メトリクスのサマリー
- 前週との比較
- 改善提案の一覧

## スクリーンショット

### PRタイムライン

![PRタイムライン](images/dashboard-timeline.png)

PRの作成から完了までの時系列をガントチャートで可視化。状態（OPEN/MERGED）、作成日時、期間を一目で把握できます。

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

## 貢献

バグ報告や機能リクエストは [Issues](../../issues) で受け付けています。
プルリクエストも歓迎します。

