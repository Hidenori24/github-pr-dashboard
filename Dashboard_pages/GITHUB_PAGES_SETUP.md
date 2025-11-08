# GitHub Pages セットアップ - このリポジトリ用

このガイドは、**このリポジトリ (Hidenori24/github-pr-dashboard)** でGitHub Pagesを有効化するための手順です。

## 🚀 クイックセットアップ（3ステップ）

### ステップ1: GitHub Pagesを有効化

1. このリポジトリのページで **Settings** タブをクリック
2. 左サイドバーの **Pages** をクリック
3. **Source** セクションで:
   - **GitHub Actions** を選択
   - 自動的に保存されます

![GitHub Pages Settings](https://docs.github.com/assets/cb-66600/mw-1440/images/help/pages/publishing-source-drop-down.webp)

### ステップ2: ワークフローを実行

1. **Actions** タブをクリック
2. 左サイドバーから **Deploy GitHub PR Dashboard to Pages** を選択
3. 右上の **Run workflow** ボタンをクリック
4. ブランチを選択（`copilot/migrate-streamlit-to-github-pages` または `main`）
5. 緑の **Run workflow** ボタンをクリック

### ステップ3: ダッシュボードにアクセス

ワークフローが完了したら（通常2-3分）:

**アクセスURL:**
```
https://hidenori24.github.io/github-pr-dashboard/
```

または Settings > Pages で表示される URL をクリック

## ✅ 動作確認

ダッシュボードが正しく動作しているか確認:

1. ✅ ページが表示される
2. ✅ サイドバーナビゲーションが動作する
3. ✅ 日本語が正しく表示される
4. ✅ ページ切り替えがスムーズ（ホーム、PRダッシュボード、PR分析）
5. ✅ サンプルデータが表示される（5件のPR）

## 🔄 データの更新

### 自動更新（推奨）

ワークフローは以下のタイミングで自動実行されます:
- **毎日午前2時（UTC）** = 日本時間11時
- `Dashboard_pages/` または `dashboard/` の変更時

### 手動更新

いつでも手動で実行可能:
1. Actions タブを開く
2. Deploy GitHub PR Dashboard to Pages を選択
3. Run workflow をクリック

## 🎨 このリポジトリ専用の機能

### 現在の設定

- **リポジトリ**: streamlit/streamlit（サンプル）
- **サンプルデータ**: 5件のPRデータが含まれています
- **自動デプロイ**: PRブランチ（copilot/**）からもデプロイ可能

### 監視するリポジトリを変更する

`dashboard/config.py` を編集:

```python
REPOSITORIES = [
    {
        "name": "Your Project",
        "owner": "Hidenori24",  # あなたの組織名
        "repo": "your-repo"     # 監視したいリポジトリ
    },
]
```

変更後、ワークフローを再実行してください。

## 🔧 トラブルシューティング

### ページが表示されない

1. **確認**: Settings > Pages で GitHub Actions が選択されているか
2. **確認**: Actions タブでワークフローが成功しているか（緑のチェックマーク）
3. **確認**: URL が正しいか（`https://hidenori24.github.io/github-pr-dashboard/`）
4. **待機**: デプロイ後2-3分待つ
5. **キャッシュ**: ブラウザのキャッシュをクリアして再読み込み（Ctrl+Shift+R）

### 日本語が文字化けする

→ 問題ありません。HTML は UTF-8 で正しくエンコードされています。
   スクリーンショットツールの問題で、実際のページでは正しく表示されます。

### データが表示されない

1. **サンプルデータ**: 初期状態ではサンプルデータ（5件のPR）が表示されます
2. **実データ**: `dashboard/config.py` を設定後、ワークフローを実行
3. **確認**: ブラウザの開発者ツール（F12）でエラーを確認

### ワークフローが失敗する

1. **ログを確認**: Actions > 失敗したワークフロー > ジョブをクリック
2. **よくある原因**:
   - `dashboard/config.py` の設定エラー
   - GitHub Token の権限不足
   - Rate limit 超過

## 📱 動的機能の確認

このダッシュボードは JavaScript で動的に動作します:

### 確認方法

1. **ページ遷移**: サイドバーのリンクをクリック → ページがリロードせずに切り替わる
2. **フィルタ**: PRダッシュボードでフィルタを変更 → 即座に反映
3. **インタラクティブチャート**: チャートにカーソルを合わせる → 詳細情報が表示
4. **リポジトリ選択**: ホームページでリポジトリカードをクリック → 選択状態が変わる

### 開発者ツールで確認

F12 キーを押して Console タブを開く:
```
Initializing GitHub PR Dashboard...
Config loaded: {repositories: Array(1), ...}
PRs loaded: 5
Dashboard initialized successfully
```

このようなログが表示されれば、JavaScript が正しく動作しています。

## 🎯 次のステップ

1. ✅ このドキュメントの手順でセットアップ完了
2. ⚠️ `dashboard/config.py` で監視したいリポジトリを設定
3. ⚠️ ワークフローを実行してデータを取得
4. ✅ チームにダッシュボードURLを共有
5. ✅ 定期的にデータが更新されることを確認

## 💡 ヒント

- **ブックマーク**: URLをブックマークして簡単にアクセス
- **共有**: URLを Slack や Teams で共有
- **カスタマイズ**: `css/style.css` で色やレイアウトを変更可能
- **監視追加**: 複数のリポジトリを `config.py` に追加可能

## 📞 サポート

問題が解決しない場合:
1. [Issues](https://github.com/Hidenori24/github-pr-dashboard/issues) で検索
2. 新しい Issue を作成（エラーログを含める）
3. README.md や SETUP.md の詳細ガイドを参照

---

**このリポジトリ専用のセットアップガイド**  
最終更新: 2025-11-08
