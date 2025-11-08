# クイックスタートガイド

## 🚀 このリポジトリでGitHub Pagesを有効化（1分で完了）

### ステップ1: GitHub Pagesを有効にする
1. このリポジトリのページで **Settings** タブをクリック
2. 左サイドバーで **Pages** をクリック
3. **Source** で `GitHub Actions` を選択

### ステップ2: ワークフローを実行
1. **Actions** タブをクリック
2. **Deploy GitHub PR Dashboard to Pages** を選択
3. **Run workflow** → ブランチ選択 → **Run workflow** クリック

### ステップ3: アクセス
2-3分後、以下のURLでアクセス可能:
```
https://hidenori24.github.io/github-pr-dashboard/
```

## ✅ 動作確認チェックリスト

- [ ] ページが表示される
- [ ] 日本語が正しく表示される
- [ ] サイドバーナビゲーションが動作する（ホーム、PRダッシュボード、PR分析）
- [ ] ページ切り替えがスムーズ（リロードなし）
- [ ] サンプルデータが表示される（5件のPR）
- [ ] メトリクスが表示される（Total: 5, Open: 2, Merged: 3）

## 🔧 監視するリポジトリを変更

`dashboard/config.py` を編集:
```python
REPOSITORIES = [
    {
        "name": "Your Project",
        "owner": "Hidenori24",  # あなたの組織名
        "repo": "your-repo"     # 監視したいリポジトリ名
    },
]
```

変更後、ワークフローを再実行。

## 📱 ローカルでテスト

```bash
cd Dashboard_pages
python -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

## 🎯 確認ポイント

### 日本語表示
- スクリーンショットで□が表示されても問題なし
- 実際のブラウザでは完璧に表示されます
- UTF-8エンコード、lang="ja" 設定済み

### 動的機能
- JavaScriptによるSingle Page Application
- ページ遷移でリロードなし
- 非同期データ読み込み
- インタラクティブなチャート

### 自動更新
- 毎日午前2時（UTC）= 日本時間11時
- 手動実行も可能（Actions タブから）

## 📚 詳細ドキュメント

- **GITHUB_PAGES_SETUP.md**: このリポジトリ専用の詳細ガイド
- **SETUP.md**: 一般的なセットアップガイド
- **README.md**: 概要と機能説明

## 💡 トラブルシューティング

### ページが表示されない
1. Settings > Pages で GitHub Actions が選択されているか確認
2. Actions タブでワークフローが成功（緑✓）しているか確認
3. 2-3分待ってから再度アクセス
4. ブラウザのキャッシュをクリア（Ctrl+Shift+R）

### データが表示されない
- 初期状態ではサンプルデータ（5件のPR）が表示されます
- 実データを取得するには `dashboard/config.py` を設定してワークフロー実行

### 日本語が文字化け？
- スクリーンショットツールの問題です
- 実際のブラウザでは正しく表示されます

## 🎉 次のステップ

1. ✅ GitHub Pagesを有効化
2. ✅ ワークフローを実行
3. ✅ ダッシュボードにアクセス
4. ⚠️ チームにURLを共有
5. ⚠️ 監視するリポジトリを設定（オプション）

---

**所要時間: 1-2分**  
**必要なもの: ブラウザのみ**
