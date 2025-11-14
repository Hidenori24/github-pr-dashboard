# GitHub Pages セットアップガイド

このガイドでは、GitHub PR DashboardをGitHub Pagesで公開するための手順を説明します。

## 📋 前提条件

- GitHubアカウント
- このリポジトリへのアクセス権
- （オプション）監視したいリポジトリへのアクセス権

## 🚀 セットアップ手順

### ステップ1: リポジトリ設定を更新

1. `dashboard/config.py` を開く
2. `REPOSITORIES` リストを編集して、監視したいリポジトリを追加

```python
REPOSITORIES = [
    {
        "name": "マイプロジェクト",      # 表示名
        "owner": "your-organization",  # GitHubオーナー名
        "repo": "your-repository"      # リポジトリ名
    },
    # 複数のリポジトリを追加可能
    {
        "name": "別のプロジェクト",
        "owner": "another-org",
        "repo": "another-repo"
    },
]
```

3. 変更をコミット＆プッシュ

```bash
git add dashboard/config.py
git commit -m "Update repository configuration"
git push
```

### ステップ2: GitHub Pagesを有効化

1. GitHubリポジトリページを開く
2. **Settings** タブをクリック
3. 左サイドバーから **Pages** を選択
4. **Source** セクションで:
   - ドロップダウンから `GitHub Actions` を選択
   - Save ボタンをクリック（自動的に保存されます）

![GitHub Pages Settings](https://docs.github.com/assets/cb-66600/mw-1440/images/help/pages/publishing-source-drop-down.webp)

### ステップ3: GitHub Token設定（必要に応じて）

デフォルトでは、ワークフローは自動的に提供される `GITHUB_TOKEN` を使用します。

#### プライベートリポジトリを監視する場合

Personal Access Token (PAT) が必要です:

1. GitHub設定 > Developer settings > Personal access tokens > Tokens (classic)
2. **Generate new token (classic)** をクリック
3. 権限を選択:
   - `repo` (フルアクセス)
   - または `public_repo` (パブリックリポジトリのみ)
4. トークンを生成してコピー

5. リポジトリの Settings > Secrets and variables > Actions に移動
6. **New repository secret** をクリック
7. Name: `GH_PAT`
8. Value: 生成したトークンを貼り付け
9. **Add secret** をクリック

10. `.github/workflows/deploy-pages.yml` を編集:

```yaml
- name: Fetch PR data from GitHub API
  env:
    GITHUB_TOKEN: ${{ secrets.GH_PAT }}  # ここを変更
  run: |
    cd dashboard
    python fetch_data.py --all
```

### ステップ4: ワークフローを実行

#### 方法A: 手動実行（推奨・初回）

1. リポジトリの **Actions** タブを開く
2. 左サイドバーから **Deploy GitHub PR Dashboard to Pages** を選択
3. 右上の **Run workflow** ボタンをクリック
4. ブランチを選択（通常は `main`）
5. **Run workflow** をクリック

#### 方法B: 自動実行を待つ

ワークフローは以下のタイミングで自動実行されます:
- 毎日午前2時（UTC）
- `Dashboard_pages/` または `dashboard/` ディレクトリの変更がプッシュされた時

### ステップ5: デプロイを確認

1. Actions タブでワークフローの実行状況を確認
2. 緑のチェックマークが表示されたら成功
3. Settings > Pages で公開URLを確認
4. URLをクリックしてダッシュボードにアクセス

通常のURL: `https://<username>.github.io/<repository>/`

## ⚙️ 詳細設定

### 更新頻度の変更

`.github/workflows/deploy-pages.yml` の `schedule` セクションを編集:

```yaml
schedule:
  # 毎日午前2時（UTC）
  - cron: '0 2 * * *'
  
  # 例: 6時間ごと
  # - cron: '0 */6 * * *'
  
  # 例: 毎週月曜日の午前9時（UTC）
  # - cron: '0 9 * * 1'
```

Cron式の例:
- `0 * * * *` - 毎時
- `0 */6 * * *` - 6時間ごと
- `0 0 * * *` - 毎日0時
- `0 9 * * 1` - 毎週月曜日9時

### カスタムドメインの設定

1. Settings > Pages > Custom domain にドメインを入力
2. DNSレコードを設定（詳細はGitHub Docsを参照）

### プライベートページ（Enterprise限定）

GitHub Enterprise を使用している場合は、ページをプライベートに設定できます:
1. Settings > Pages > Private pages
2. チェックボックスをONにする

## 🔍 トラブルシューティング

### ワークフローが失敗する

**症状:** Actions タブで赤い ✗ マークが表示される

**確認項目:**
1. ログを確認:
   - Actions > 失敗したワークフロー > ジョブ名をクリック
   - エラーメッセージを確認

2. よくあるエラー:
   - `GITHUB_TOKEN` の権限不足
     → Personal Access Token を設定
   - `dashboard/config.py` のリポジトリ設定が間違っている
     → owner/repo を確認
   - Rate limit 超過
     → しばらく待つ、または Token を使用

### ページが表示されない（404エラー）

**確認項目:**
1. GitHub Pages が有効になっているか
2. ワークフローが成功しているか
3. URLが正しいか
4. リポジトリが public か（または GitHub Pages が private repo に対応しているプランか）

### データが古い

**確認項目:**
1. 最終実行時刻を確認
   - Actions タブで最後の実行を確認
2. 手動でワークフローを実行
   - Actions > Run workflow
3. スケジュール設定を確認
   - `.github/workflows/deploy-pages.yml` の cron 式

### チャートが表示されない

**確認項目:**
1. ブラウザのコンソールでエラーを確認
2. CDN（Plotly.js, Chart.js）が読み込めているか確認
3. `data/prs.json` にデータが存在するか確認

## 📞 サポート

問題が解決しない場合:
1. [Issues](../../issues) で既存の問題を検索
2. 新しい Issue を作成（エラーログを含める）
3. [GitHub Docs - Pages](https://docs.github.com/ja/pages) を参照

## 🎉 次のステップ

セットアップが完了したら:
- ダッシュボードURLをチームに共有
- ブックマークに追加
- 定期的にデータを確認
- カスタマイズしてチームに合わせる

Happy Analyzing! 📊
