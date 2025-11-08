#!/usr/bin/env python3
# fetch_data.py - GitHub PR データ取得スクリプト（定期実行用）
"""
GitHub APIからPRデータを取得してローカルDBに保存

使い方:
    python fetch_data.py                    # デフォルトリポジトリ
    python fetch_data.py owner/repo         # 特定リポジトリ
    python fetch_data.py --all              # config.pyの全リポジトリ
    python fetch_data.py --force            # ETagを無視して強制取得
    
定期実行（cron/Task Scheduler）:
    毎日午前2時に実行: 0 2 * * * cd /path/to/dashboard && python fetch_data.py
"""

import sys
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

# カレントディレクトリをスクリプトの場所に設定
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

import config
from fetcher import run_query
import db_cache


def parse_repo_arg(repo_arg: str) -> tuple[str, str]:
    """owner/repo形式をパース"""
    if '/' in repo_arg:
        parts = repo_arg.split('/')
        return parts[0], parts[1]
    return config.DEFAULT_OWNER, repo_arg


def fetch_repository(owner: str, repo: str, days: int = 365, force: bool = False) -> dict:
    """単一リポジトリのデータを取得"""
    print(f"Fetching: {owner}/{repo}")
    
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)
    
    # ETag情報を取得
    etag_info = db_cache.get_etag(owner, repo) if not force else None
    
    try:
        etag = etag_info["etag"] if etag_info else None
        last_modified = etag_info["last_modified"] if etag_info else None
        
        pr_list, new_etag, new_last_modified, is_modified = run_query(
            owner, repo,
            cutoff_dt=cutoff_dt,
            etag=etag,
            last_modified=last_modified
        )
        
        # ETag情報を保存
        if new_etag or new_last_modified:
            db_cache.save_etag(owner, repo, new_etag, new_last_modified)
        
        if is_modified and pr_list:
            # 変更あり → DBに保存
            db_cache.save_prs(owner, repo, pr_list)
            print(f"   Saved {len(pr_list)} PRs (updated)")
            return {
                "status": "updated",
                "count": len(pr_list),
                "owner": owner,
                "repo": repo
            }
        elif not is_modified:
            # 変更なし
            cached_data = db_cache.load_prs(owner, repo)
            print(f"   No changes (cached: {len(cached_data)} PRs)")
            return {
                "status": "unchanged",
                "count": len(cached_data),
                "owner": owner,
                "repo": repo
            }
        else:
            # 空の場合
            print(f"   No data returned")
            return {
                "status": "empty",
                "count": 0,
                "owner": owner,
                "repo": repo
            }
            
    except Exception as e:
        print(f"   Error: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "owner": owner,
            "repo": repo
        }


def main():
    parser = argparse.ArgumentParser(
        description="GitHub PR データ取得スクリプト",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'repository',
        nargs='?',
        default=None,
        help='リポジトリ指定 (owner/repo形式)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='config.pyの全リポジトリを取得'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='ETagを無視して強制取得'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=365,
        help='取得対象期間（日）デフォルト: 365'
    )
    
    args = parser.parse_args()
    
    start_time = datetime.now(timezone.utc)
    print(f"GitHub PR Data Fetcher")
    print(f"Start: {start_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print(f"Target period: {args.days} days")
    if args.force:
        print(f"Force mode: ETag ignored")
    print()
    
    results = []
    
    if args.all:
        # config.pyの全リポジトリを取得
        if config.REPOSITORIES:
            repositories = [(r['owner'], r['repo']) for r in config.REPOSITORIES]
        else:
            repositories = [(config.DEFAULT_OWNER, config.DEFAULT_REPO)]
        
        print(f"Fetching {len(repositories)} repositories from config")
        print()
        
        for owner, repo in repositories:
            result = fetch_repository(owner, repo, args.days, args.force)
            results.append(result)
            print()
    
    elif args.repository:
        # コマンドライン引数で指定
        owner, repo = parse_repo_arg(args.repository)
        result = fetch_repository(owner, repo, args.days, args.force)
        results.append(result)
    
    else:
        # デフォルトリポジトリ
        result = fetch_repository(
            config.DEFAULT_OWNER,
            config.DEFAULT_REPO,
            args.days,
            args.force
        )
        results.append(result)
    
    # サマリ表示
    end_time = datetime.now(timezone.utc)
    duration = (end_time - start_time).total_seconds()
    
    print("=" * 60)
    print("Summary:")
    print(f"   Total repositories: {len(results)}")
    print(f"   Updated: {sum(1 for r in results if r['status'] == 'updated')}")
    print(f"   Unchanged: {sum(1 for r in results if r['status'] == 'unchanged')}")
    print(f"   Errors: {sum(1 for r in results if r['status'] == 'error')}")
    print(f"   Duration: {duration:.1f}s")
    print(f"End: {end_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    print()
    
    # キャッシュ統計
    for result in results:
        if result['status'] in ['updated', 'unchanged']:
            cache_info = db_cache.get_cache_info(result['owner'], result['repo'])
            if cache_info:
                print(f"{result['owner']}/{result['repo']}: {cache_info['count']} PRs in cache")
    
    # エラーがあれば終了コード1
    if any(r['status'] == 'error' for r in results):
        sys.exit(1)
    
    print()
    print("Done!")


if __name__ == "__main__":
    main()
