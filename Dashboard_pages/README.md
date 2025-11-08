# GitHub PR Dashboard - GitHub Pages版

StreamlitベースのダッシュボードをGitHub Pages + Actionsに移植した静的Webアプリケーションです。

## 🎯 概要

このディレクトリには、GitHub Pagesでホストできる静的なPRダッシュボードが含まれています。
GitHub Actionsが定期的にPRデータを取得し、JSONファイルとして保存、静的HTMLページで可視化します。

### 主な特徴

- ✅ **完全静的**: サーバー不要、GitHub Pagesで動作
- ✅ **自動更新**: GitHub Actionsで毎日自動データ取得
- ✅ **高速表示**: ローカルファイル読み込みで瞬時に表示
- ✅ **Streamlit風UI**: 元のStreamlitダッシュボードのデザインを踏襲
- ✅ **マルチリポジトリ対応**: 複数リポジトリを一元管理
- ✅ **レスポンシブデザイン**: PC/タブレット/スマホ対応

## 📁 ディレクトリ構成

```
Dashboard_pages/
├── index.html           # メインHTMLファイル
├── css/
│   └── style.css       # スタイルシート（Streamlit風デザイン）
├── js/
│   ├── config.js       # 設定ファイル
│   ├── app.js          # メインアプリケーションロジック
│   ├── dashboard.js    # ダッシュボードページロジック
│   └── analytics.js    # 分析ページロジック
├── data/               # 生成されるJSONデータ（GitHub Actionsで自動生成）
│   ├── config.json     # リポジトリ設定
│   ├── prs.json        # PRデータ
│   ├── analytics.json  # 分析データ
│   └── cache_info.json # キャッシュ情報
├── generate_data.py    # データ生成スクリプト
└── README.md          # このファイル
```

## 🚀 セットアップ

### 方法1: GitHub Actions自動デプロイ（推奨）

1. **リポジトリ設定を更新**

   `dashboard/config.py` を編集してリポジトリを設定:
   
   ```python
   REPOSITORIES = [
       {
           "name": "Your Project",
           "owner": "your-org",
           "repo": "your-repo"
       },
   ]
   ```

2. **GitHub Pagesを有効化**

   リポジトリの Settings > Pages で:
   - Source: `GitHub Actions` を選択
   - Save

3. **GitHub Tokenを設定**

   デフォルトの `GITHUB_TOKEN` が自動的に使用されます。
   プライベートリポジトリや追加の権限が必要な場合は、Personal Access Tokenを作成:
   - Settings > Secrets and variables > Actions
   - New repository secret
   - Name: `GH_PAT`
   - Value: あなたのPersonal Access Token
   
   そして `.github/workflows/deploy-pages.yml` を更新:
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GH_PAT }}
   ```

4. **ワークフローを実行**

   - Actions タブを開く
   - "Deploy GitHub PR Dashboard to Pages" を選択
   - "Run workflow" をクリック

5. **ダッシュボードにアクセス**

   `https://<username>.github.io/<repository>/` でアクセス可能

### 方法2: ローカルでテスト

1. **データを生成**

   ```bash
   # 既存のStreamlitダッシュボードからデータを取得
   cd dashboard
   python fetch_data.py --all
   
   # 静的JSONファイルを生成
   cd ../Dashboard_pages
   python generate_data.py
   ```

2. **ローカルサーバーを起動**

   ```bash
   # Pythonの簡易サーバーを使用
   python -m http.server 8000
   
   # または Node.js の http-server
   npx http-server
   ```

3. **ブラウザでアクセス**

   `http://localhost:8000` を開く

## ⚙️ 設定

### 監視するリポジトリを変更

`dashboard/config.py` を編集:

```python
REPOSITORIES = [
    {
        "name": "表示名",
        "owner": "GitHubオーナー",
        "repo": "リポジトリ名"
    },
    # 複数追加可能
]
```

### 更新頻度を変更

`.github/workflows/deploy-pages.yml` のスケジュールを編集:

```yaml
schedule:
  # 毎日午前2時（UTC）
  - cron: '0 2 * * *'
  
  # 毎時実行したい場合
  # - cron: '0 * * * *'
  
  # 毎週月曜日の午前2時
  # - cron: '0 2 * * 1'
```

### UIカスタマイズ

- **カラー**: `css/style.css` の `:root` セクション
- **チャート**: `js/config.js` の `charts` セクション
- **デフォルト表示**: `js/config.js` の `ui` セクション

## 📊 機能

### ホームページ

- リポジトリ選択
- キャッシュステータス表示
- 各ページへのナビゲーション

### PRダッシュボード

- **PRタイムライン**: Ganttチャート形式でPRのライフサイクルを可視化
- **メトリクス**: Open/Merged/Closedの件数、平均マージ時間
- **PR一覧**: フィルタ可能な詳細テーブル

### PR分析

7つの分析タブ:

1. **滞留分析**: Open PRの滞留時間分布
2. **ブロッカー分析**: 未クローズ原因の推定
3. **レビュワー分析**: レビューアクティビティ
4. **トレンド分析**: 週次PR作成数推移
5. **ボトルネック分析**: 長期滞留PRの特定
6. **レビュー速度**: マージまでの時間分析
7. **変更パターン**: ファイル変更頻度とPR規模

### Four Keys（開発中）

DevOps Four Keysメトリクスの測定機能（今後実装予定）

## 🔄 データフロー

```
┌─────────────────────┐
│  GitHub API         │
│  (PR データ)        │
└─────────┬───────────┘
          │
          │ fetch_data.py
          ↓
┌─────────────────────┐
│  SQLite Cache       │
│  (pr_cache.db)      │
└─────────┬───────────┘
          │
          │ generate_data.py
          ↓
┌─────────────────────┐
│  JSON Files         │
│  (data/*.json)      │
└─────────┬───────────┘
          │
          │ JavaScript
          ↓
┌─────────────────────┐
│  Dashboard UI       │
│  (ブラウザ表示)      │
└─────────────────────┘
```

## 🛠️ トラブルシューティング

### データが表示されない

1. `data/prs.json` が存在するか確認
2. ブラウザのコンソールでエラーを確認
3. GitHub Actionsのログを確認

### GitHub Actionsが失敗する

1. `GITHUB_TOKEN` の権限を確認
2. `dashboard/config.py` のリポジトリ設定を確認
3. rate limitに達していないか確認

### ページが404エラー

1. GitHub Pagesが有効になっているか確認
2. ワークフローが正常に完了しているか確認
3. リポジトリが public か、GitHub Pages の設定が正しいか確認

## 📝 Streamlitからの主な変更点

| 機能 | Streamlit版 | Pages版 |
|------|------------|---------|
| 実行環境 | ローカルPC | GitHub Pages |
| データ取得 | 手動/スケジュール | GitHub Actions（自動） |
| 表示方法 | Python/Streamlit | HTML/CSS/JavaScript |
| 更新 | リアルタイム | 定期更新（デフォルト: 毎日） |
| インタラクション | Python側処理 | クライアント側JavaScript |
| チャート | Plotly (Python) | Plotly.js |

## 🎨 デザイン

Streamlitの以下のデザイン要素を踏襲:

- サイドバーナビゲーション
- カラースキーム（赤/緑/青のアクセントカラー）
- カードベースのレイアウト
- クリーンでミニマルなUI
- レスポンシブデザイン

## 🔐 セキュリティ

- GitHub Tokenは GitHub Actions の secrets で管理
- 静的ファイルのみ公開、サーバーサイド処理なし
- プライベートリポジトリのデータも安全に処理可能

## 📄 ライセンス

このプロジェクトは元のリポジトリと同じライセンスで提供されます。

## 🤝 貢献

バグ報告や機能リクエストは [Issues](../../issues) で受け付けています。

## 📚 関連ドキュメント

- [元のStreamlit版README](../dashboard/README.md)
- [GitHub Pages ドキュメント](https://docs.github.com/ja/pages)
- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
