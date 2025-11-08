# fetcher.py
import os, requests, datetime as dt, time
from dateutil import parser as dp
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Optional, List, Tuple
import config

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
API_URL_DEFAULT = (config.GITHUB_API_URL or os.getenv("GITHUB_API_URL") or "https://api.github.com/graphql").strip()

def _session():
    if not GITHUB_TOKEN:
        raise RuntimeError("GITHUB_TOKEN が未設定です。環境変数で設定してください。")
    s = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1.2,
        status_forcelist=[502,503,504,520,522],
        allowed_methods={"POST"},
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({"Authorization": f"Bearer {GITHUB_TOKEN}"})
    return s

PR_QUERY = """
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequests(
      first: 30,
      after: $cursor,
      orderBy: {field: CREATED_AT, direction: DESC},
      states: [OPEN, CLOSED, MERGED]
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url state isDraft
        createdAt closedAt mergedAt
        author { login }
        baseRefName headRefName
        additions deletions changedFiles
        labels(first:50){ nodes { name } }
        comments { totalCount }
        reviewThreads(first:100) { 
          totalCount 
          nodes { 
            isResolved 
            isOutdated
            resolvedBy { login }
            comments(first:50) { 
              totalCount
              nodes { 
                author { login }
                body
                createdAt
                isMinimized
              } 
            }
          } 
        }
        reviewRequests(first:10){ nodes { requestedReviewer { __typename ... on User { login } ... on Team { name } } } }
        reviews(first:50){ nodes { state author { login } createdAt } }
        reviewDecision
        mergeable
        mergeStateStatus
        commits(last:1){
          nodes{
            commit{
              statusCheckRollup{ state }
              committedDate
            }
          }
        }
        files(first:100){ nodes { path additions deletions } }
        projectItems(first:10){ nodes { project { title } } }
      }
    }
  }
}
"""

def _post_with_rate_limit(sess, payload, timeout=30):
    r = sess.post(API_URL_DEFAULT, json=payload, timeout=timeout)
    if r.status_code == 403:
        reset = r.headers.get("X-RateLimit-Reset")
        remaining = r.headers.get("X-RateLimit-Remaining")
        if remaining == "0" and reset:
            wait = max(0, int(reset) - int(time.time())) + 1
            time.sleep(min(wait, 30))
            r = sess.post(API_URL_DEFAULT, json=payload, timeout=timeout)
    r.raise_for_status()
    return r

def run_query(
    owner: str, 
    repo: str, 
    cutoff_dt: Optional[dt.datetime]=None, 
    max_pages: int=50,
    etag: Optional[str] = None,
    last_modified: Optional[str] = None
) -> Tuple[List[dict], Optional[str], Optional[str], bool]:
    """
    owner/repo の PR を新しい順に取得。
    cutoff_dt（UTC）より古い createdAt に当たったらページングを早期終了。
    
    Returns:
        (pr_list, etag, last_modified, is_modified)
        is_modified=False の場合、pr_listは空で、ETagがマッチした（変更なし）
    """
    sess = _session()
    
    # 条件付きリクエストヘッダー追加
    if etag:
        sess.headers["If-None-Match"] = etag
    if last_modified:
        sess.headers["If-Modified-Since"] = last_modified
    
    all_prs, cursor, pages = [], None, 0
    quit_early = False
    response_etag = None
    response_last_modified = None

    while pages < max_pages and not quit_early:
        variables = {"owner": owner, "name": repo, "cursor": cursor}
        r = _post_with_rate_limit(sess, {"query": PR_QUERY, "variables": variables}, timeout=30)
        
        # ETag / Last-Modified を記録
        if pages == 0:
            response_etag = r.headers.get("ETag")
            response_last_modified = r.headers.get("Last-Modified")
        
        # 304 Not Modified チェック (GraphQLは304返さないけど念のため)
        if r.status_code == 304:
            return [], response_etag, response_last_modified, False
        
        data = r.json()
        if "errors" in data:
            raise RuntimeError(data["errors"])

        prs = data["data"]["repository"]["pullRequests"]
        nodes = prs["nodes"] or []

        for n in nodes:
            if cutoff_dt:
                created = dp.parse(n["createdAt"])
                if created < cutoff_dt:
                    quit_early = True
                    break
            all_prs.append(normalize_pr(n))

        if quit_early or not prs["pageInfo"]["hasNextPage"]:
            break
        cursor = prs["pageInfo"]["endCursor"]
        pages += 1

    return all_prs, response_etag, response_last_modified, True

def normalize_pr(n: dict) -> dict:
    created = dp.parse(n["createdAt"])
    closed  = dp.parse(n["closedAt"]) if n["closedAt"] else None
    merged  = dp.parse(n["mergedAt"]) if n["mergedAt"] else None
    now = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
    end_time = merged or closed or now
    age_hours = (end_time - created).total_seconds()/3600.0

    reviews = (n.get("reviews") or {}).get("nodes") or []
    changes_requested = sum(1 for rv in reviews if rv.get("state")=="CHANGES_REQUESTED")
    approvals = sum(1 for rv in reviews if rv.get("state")=="APPROVED")
    
    # レビュー状態の詳細を保存
    review_details = []
    for rv in reviews:
        review_details.append({
            "state": rv.get("state"),
            "author": rv.get("author", {}).get("login") if rv.get("author") else None,
            "createdAt": rv.get("createdAt")
        })

    commit_nodes = (n.get("commits") or {}).get("nodes") or []
    status_state = None
    if commit_nodes:
        roll = (commit_nodes[-1].get("commit") or {}).get("statusCheckRollup")
        status_state = roll.get("state") if roll else None

    rr_nodes = (n.get("reviewRequests") or {}).get("nodes") or []
    requested_cnt = len(rr_nodes)
    
    # レビュー依頼者のリストを保存
    requested_reviewers = []
    for rr in rr_nodes:
        reviewer_obj = rr.get("requestedReviewer")
        if reviewer_obj:
            typename = reviewer_obj.get("__typename")
            if typename == "User":
                requested_reviewers.append(reviewer_obj.get("login"))
            elif typename == "Team":
                requested_reviewers.append(f"team:{reviewer_obj.get('name')}")
    
    # レビュースレッドの詳細を保存
    review_threads_obj = n.get("reviewThreads") or {}
    total_threads = review_threads_obj.get("totalCount", 0)
    thread_nodes = review_threads_obj.get("nodes") or []
    
    unresolved_threads = 0
    thread_details = []
    
    for thread in thread_nodes:
        is_resolved = thread.get("isResolved", False)
        is_outdated = thread.get("isOutdated", False)
        resolved_by = thread.get("resolvedBy", {}).get("login") if thread.get("resolvedBy") else None
        
        # 未解決かつ古くないスレッドをカウント
        if not is_resolved and not is_outdated:
            unresolved_threads += 1
        
        # コメント詳細を取得
        comments_obj = thread.get("comments") or {}
        comment_nodes = comments_obj.get("nodes") or []
        
        thread_comments = []
        for comment in comment_nodes:
            if not comment.get("isMinimized", False):  # 非表示コメントは除外
                thread_comments.append({
                    "author": comment.get("author", {}).get("login") if comment.get("author") else None,
                    "body": comment.get("body", ""),
                    "createdAt": comment.get("createdAt")
                })
        
        if thread_comments:  # コメントがあるスレッドのみ保存
            thread_details.append({
                "isResolved": is_resolved,
                "isOutdated": is_outdated,
                "resolvedBy": resolved_by,
                "comments": thread_comments,
                "totalComments": comments_obj.get("totalCount", 0)
            })

    return {
        "number": n["number"],
        "title": n["title"],
        "url": n["url"],
        "state": n["state"],
        "isDraft": n.get("isDraft", False),
        "reviewDecision": n.get("reviewDecision"),
        "mergeable": n.get("mergeable"),
        "mergeStateStatus": n.get("mergeStateStatus"),
        "checks_state": status_state,
        "requested_reviewers": requested_cnt,
        "requested_reviewers_list": requested_reviewers,
        "review_details": review_details,
        "unresolved_threads": unresolved_threads,
        "thread_details": thread_details,  # NEW! 詳細なスレッド情報
        "author": n["author"]["login"] if n["author"] else None,
        "createdAt": n["createdAt"],
        "closedAt": n["closedAt"],
        "mergedAt": n["mergedAt"],
        "age_hours": age_hours,
        "labels": [l["name"] for l in ((n["labels"] or {}).get("nodes") or [])],
        "comments_count": (n.get("comments") or {}).get("totalCount", 0),
        "review_threads": total_threads,
        "changes_requested": changes_requested,
        "approvals": approvals,
        "additions": n.get("additions",0),
        "deletions": n.get("deletions",0),
        "changedFiles": n.get("changedFiles",0),
        "files": [f["path"] for f in ((n.get("files") or {}).get("nodes") or [])],
        "projects": [pi["project"]["title"] for pi in ((n.get("projectItems") or {}).get("nodes") or [])],
        "baseRefName": n.get("baseRefName"),
        "headRefName": n.get("headRefName"),
    }
