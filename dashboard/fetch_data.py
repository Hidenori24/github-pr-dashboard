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
import requests  # REST API 用に追加（pip install requests が必要）
from datetime import datetime, timedelta, timezone
from pathlib import Path

# カレントディレクトリをスクリプトの場所に設定
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

import config
from fetcher import run_query, run_issue_query
import db_cache


def parse_repo_arg(repo_arg: str) -> tuple[str, str]:
    """owner/repo形式をパース"""
    if '/' in repo_arg:
        parts = repo_arg.split('/')
        return parts[0], parts[1]
    return config.DEFAULT_OWNER, repo_arg


def run_query_rest(owner: str, repo: str, cutoff_dt: datetime) -> list:
    """REST API を使用して PR データを取得（GraphQL フォールバック用）"""
    endpoint = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    headers = {
        "Authorization": f"token {config.GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    params = {
        "state": "all",
        "sort": "updated",
        "direction": "desc",
        "per_page": 100  # 1回のリクエストで最大100件
    }
    
    pr_list = []
    page = 1
    
    while True:
        params["page"] = page
        response = requests.get(endpoint, headers=headers, params=params)
        
        if response.status_code == 403 and "API rate limit exceeded" in response.text:
            raise Exception("REST API rate limit exceeded")
        elif response.status_code != 200:
            raise Exception(f"REST API error: {response.status_code} - {response.text}")
        
        data = response.json()
        if not data:
            break
        
        for pr in data:
            # GraphQL のデータ構造にマッピング
            created_at = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            if created_at < cutoff_dt:
                continue  # 対象期間外
            
            mapped_pr = {
                "number": pr["number"],
                "title": pr["title"],
                "state": pr["state"].upper(),  # "open" -> "OPEN", "closed" -> "CLOSED"
                "author": pr["user"]["login"] if pr["user"] else None,
                "createdAt": pr["created_at"],
                "updatedAt": pr["updated_at"],
                "closedAt": pr.get("closed_at"),
                "mergedAt": pr.get("merged_at"),
                "labels": [label["name"] for label in pr.get("labels", [])],
                "comments_count": pr.get("comments", 0),
                "reviews_count": 0,  # REST API では直接取得できないのでデフォルト0（必要に応じて拡張）
                "additions": 0,  # 同上
                "deletions": 0,  # 同上
                "changedFiles": 0  # 同上
            }
            pr_list.append(mapped_pr)
        
        page += 1
        if len(data) < 100:  # 最終ページ
            break
    
    return pr_list


def run_issue_query_rest(owner: str, repo: str, cutoff_dt: datetime) -> list:
    """REST API を使用して Issue データを取得（GraphQL フォールバック用）"""
    endpoint = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = {
        "Authorization": f"token {config.GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    params = {
        "state": "all",
        "sort": "updated",
        "direction": "desc",
        "per_page": 100,
        "filter": "all"  # Issues + PR を除外しない
    }
    
    issue_list = []
    page = 1
    
    while True:
        params["page"] = page
        response = requests.get(endpoint, headers=headers, params=params)
        
        if response.status_code == 403 and "API rate limit exceeded" in response.text:
            raise Exception("REST API rate limit exceeded")
        elif response.status_code != 200:
            raise Exception(f"REST API error: {response.status_code} - {response.text}")
        
        data = response.json()
        if not data:
            break
        
        for issue in data:
            # PR を除外（pull_request フィールドがあるものは PR）
            if "pull_request" in issue:
                continue
            
            created_at = datetime.fromisoformat(issue["created_at"].replace("Z", "+00:00"))
            if created_at < cutoff_dt:
                continue
            
            mapped_issue = {
                "number": issue["number"],
                "title": issue["title"],
                "state": issue["state"].upper(),
                "author": issue["user"]["login"] if issue["user"] else None,
                "createdAt": issue["created_at"],
                "updatedAt": issue["updated_at"],
                "closedAt": issue.get("closed_at"),
                "labels": [label["name"] for label in issue.get("labels", [])],
                "comments_count": issue.get("comments", 0),
                "assignees": [assignee["login"] for assignee in issue.get("assignees", [])]
            }
            issue_list.append(mapped_issue)
        
        page += 1
        if len(data) < 100:
            break
    
    return issue_list


def fetch_repository(owner: str, repo: str, days: int = 365, force: bool = False, fetch_issues: bool = True) -> dict:
    """単一リポジトリのデータを取得（GraphQL -> REST フォールバック対応）"""
    print(f"Fetching: {owner}/{repo}")
    
    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)
    result = {
        "owner": owner,
        "repo": repo,
        "pr_status": "empty",
        "pr_count": 0,
        "issue_status": "empty",
        "issue_count": 0
    }
    
    # Fetch PRs
    etag_info = db_cache.get_etag(owner, repo) if not force else None
    
    pr_list = None
    pr_error = None
    
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
            db_cache.save_prs(owner, repo, pr_list)
            print(f"   Saved {len(pr_list)} PRs (updated via GraphQL)")
            result["pr_status"] = "updated"
            result["pr_count"] = len(pr_list)
        elif not is_modified:
            cached_data = db_cache.load_prs(owner, repo)
            print(f"   No changes (cached: {len(cached_data)} PRs)")
            result["pr_status"] = "unchanged"
            result["pr_count"] = len(cached_data)
        else:
            print(f"   No PR data returned")
            
    except Exception as e:
        pr_error = str(e)
        print(f"   GraphQL PR Error: {pr_error}")
        
        # GraphQL がレートリミットなら REST API にフォールバック
        if "rate limit" in pr_error.lower():
            print("   Falling back to REST API for PRs...")
            try:
                pr_list = run_query_rest(owner, repo, cutoff_dt)
                if pr_list:
                    db_cache.save_prs(owner, repo, pr_list)
                    print(f"   Saved {len(pr_list)} PRs (updated via REST API)")
                    result["pr_status"] = "updated"
                    result["pr_count"] = len(pr_list)
                else:
                    print("   No PR data from REST API")
            except Exception as rest_e:
                print(f"   REST API PR Error: {str(rest_e)}")
                result["pr_status"] = "error"
                result["pr_error"] = str(rest_e)
        else:
            result["pr_status"] = "error"
            result["pr_error"] = pr_error
    
    # Fetch Issues
    if fetch_issues:
        issue_list = None
        issue_error = None
        
        try:
            issue_list = run_issue_query(owner, repo, cutoff_dt=cutoff_dt)
            
            if issue_list:
                db_cache.save_issues(owner, repo, issue_list)
                print(f"   Saved {len(issue_list)} Issues (via GraphQL)")
                result["issue_status"] = "updated"
                result["issue_count"] = len(issue_list)
            else:
                print(f"   No issue data returned")
                
        except Exception as e:
            issue_error = str(e)
            print(f"   GraphQL Issue Error: {issue_error}")
            
            # GraphQL がレートリミットなら REST API にフォールバック
            if "rate limit" in issue_error.lower():
                print("   Falling back to REST API for Issues...")
                try:
                    issue_list = run_issue_query_rest(owner, repo, cutoff_dt)
                    if issue_list:
                        db_cache.save_issues(owner, repo, issue_list)
                        print(f"   Saved {len(issue_list)} Issues (via REST API)")
                        result["issue_status"] = "updated"
                        result["issue_count"] = len(issue_list)
                    else:
                        print("   No issue data from REST API")
                except Exception as rest_e:
                    print(f"   REST API Issue Error: {str(rest_e)}")
                    result["issue_status"] = "error"
                    result["issue_error"] = str(rest_e)
            else:
                result["issue_status"] = "error"
                result["issue_error"] = issue_error
    
    # Overall status
    if result["pr_status"] == "error" and result["issue_status"] == "error":
        result["status"] = "error"
    elif "updated" in [result["pr_status"], result["issue_status"]]:
        result["status"] = "updated"
    elif "unchanged" in [result["pr_status"], result["issue_status"]]:
        result["status"] = "unchanged"
    else:
        result["status"] = "empty"
    
    return result


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
            issue_info = db_cache.get_issue_cache_info(result['owner'], result['repo'])
            pr_count = cache_info['count'] if cache_info else 0
            issue_count = issue_info['count'] if issue_info else 0
            print(f"{result['owner']}/{result['repo']}: {pr_count} PRs, {issue_count} Issues in cache")
    
    # エラーがあれば終了コード1
    if any(r['status'] == 'error' for r in results):
        sys.exit(1)
    
    print()
    print("Done!")


if __name__ == "__main__":
    main()