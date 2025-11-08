# config.py
# --- リポジトリ設定 ---
# 複数のリポジトリを管理する場合はここに追加
REPOSITORIES = [
    {
        "name": "GitHub PR Dashboard",  # 表示名
        "owner": "Hidenori24",
        "repo": "github-pr-dashboard"
    },
    # 追加例:
    # {
    #     "name": "別プロジェクト",
    #     "owner": "organization",
    #     "repo": "repository-name"
    # },
]

# --- 初期値（後方互換性のため維持） ---
DEFAULT_OWNER = REPOSITORIES[0]["owner"] if REPOSITORIES else "your-organization"
DEFAULT_REPO  = REPOSITORIES[0]["repo"] if REPOSITORIES else "your-repository"
DEFAULT_DAYS  = 180                                # 既定の対象期間（日）
DEFAULT_STATE = ["OPEN","MERGED"]                           # 既定の状態フィルタ
DEFAULT_GANTT_STATES = ["OPEN","MERGED"]                    # タイムライン初期表示状態
DEFAULT_GANTT_TOP_N = 30                                      # タイムラインに表示するPR件数
DEFAULT_GANTT_COLOR_MODE = "state（状態）"                   # タイムラインの色情報
DEFAULT_GROUPING = "ディレクトリ（階層）"                  # 書類/コードタブの初期グルーピング
DEFAULT_DIR_DEPTH = 2                                          # ディレクトリ階層の初期値
DEFAULT_SHOW_ONLY_OPEN_GROUPS = False                          # OPENグループのみ表示の初期設定

# GitHub Enterprise Server の場合だけ設定（例: "https://git.example.co.jp/api/graphql"）
# 何も書かない場合は https://api.github.com/graphql を使用
GITHUB_API_URL = ""   # または環境変数 GITHUB_API_URL を使ってもOK
