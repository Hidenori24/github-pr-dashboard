# fetcher.py
import os, requests, datetime as dt, time
from dateutil import parser as dp
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Optional, List, Tuple
import config

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# --- 正規化とデバッグ出力追加 ---
_raw_cfg = (config.GITHUB_API_URL or "").strip()
_raw_env = (os.getenv("GITHUB_API_URL") or "").strip()

_raw_endpoint = _raw_cfg if _raw_cfg else _raw_env
_raw_endpoint = _raw_endpoint.strip()

if not _raw_endpoint:
    API_URL_DEFAULT = "https://api.github.com/graphql"
else:
    # 末尾のスラッシュ除去
    base = _raw_endpoint.rstrip("/")
    # /graphql が付いていなければ付与
    if not base.endswith("graphql"):
        API_URL_DEFAULT = base + "/graphql"
    else:
        API_URL_DEFAULT = base

print(f"[DEBUG] fetcher endpoint decision: config='{_raw_cfg}' env='{_raw_env}' final='{API_URL_DEFAULT}'")

def _session():
    if not GITHUB_TOKEN:
        raise RuntimeError("GITHUB_TOKEN が未設定です。環境変数で設定してください。")
    s = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1.2,
        status_forcelist=[502, 503, 504, 520, 522],
        allowed_methods={"POST"},
        raise_on_status=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.headers.update({
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    })
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
    cutoff_dt: Optional[dt.datetime] = None,
    max_pages: int = 50,
    etag: Optional[str] = None,
    last_modified: Optional[str] = None
) -> Tuple[List[dict], Optional[str], Optional[str], bool]:
    print(f"[DEBUG] run_query using endpoint='{API_URL_DEFAULT}' owner='{owner}' repo='{repo}'")
    sess = _session()
    all_prs, cursor, pages = [], None, 0
    response_etag = None
    response_last_modified = None

    while pages < max_pages:
        variables = {"owner": owner, "name": repo, "cursor": cursor}
        r = _post_with_rate_limit(sess, {"query": PR_QUERY, "variables": variables}, timeout=30)

        if pages == 0:
            response_etag = r.headers.get("ETag")
            response_last_modified = r.headers.get("Last-Modified")

        data = r.json()
        if "errors" in data:
            msgs = []
            for err in data["errors"]:
                path = ".".join(err.get("path", [])) if err.get("path") else ""
                msgs.append(f"{err.get('message')}({path})")
            raise RuntimeError("GraphQL errors: " + " | ".join(msgs))

        repo_obj = data.get("data", {}).get("repository")
        if not repo_obj:
            raise RuntimeError(f"Repository not found or inaccessible: {owner}/{repo}")

        prs = repo_obj["pullRequests"]
        nodes = prs["nodes"] or []
        quit_early = False
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
    closed = dp.parse(n["closedAt"]) if n["closedAt"] else None
    merged = dp.parse(n["mergedAt"]) if n["mergedAt"] else None
    now = dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc)
    end_time = merged or closed or now
    age_hours = (end_time - created).total_seconds() / 3600.0
    reviews = (n.get("reviews") or {}).get("nodes") or []
    changes_requested = sum(1 for rv in reviews if rv.get("state") == "CHANGES_REQUESTED")
    approvals = sum(1 for rv in reviews if rv.get("state") == "APPROVED")
    review_details = [{
        "state": rv.get("state"),
        "author": rv.get("author", {}).get("login") if rv.get("author") else None,
        "createdAt": rv.get("createdAt")
    } for rv in reviews]
    commit_nodes = (n.get("commits") or {}).get("nodes") or []
    status_state = None
    if commit_nodes:
        roll = (commit_nodes[-1].get("commit") or {}).get("statusCheckRollup")
        status_state = roll.get("state") if roll else None
    rr_nodes = (n.get("reviewRequests") or {}).get("nodes") or []
    requested_reviewers = []
    for rr in rr_nodes:
        reviewer_obj = rr.get("requestedReviewer")
        if reviewer_obj:
            t = reviewer_obj.get("__typename")
            requested_reviewers.append(
                reviewer_obj.get("login") if t == "User" else f"team:{reviewer_obj.get('name')}"
            )
    review_threads_obj = n.get("reviewThreads") or {}
    total_threads = review_threads_obj.get("totalCount", 0)
    thread_nodes = review_threads_obj.get("nodes") or []
    unresolved_threads = 0
    thread_details = []
    for thread in thread_nodes:
        is_resolved = thread.get("isResolved", False)
        is_outdated = thread.get("isOutdated", False)
        resolved_by = thread.get("resolvedBy", {}).get("login") if thread.get("resolvedBy") else None
        if not is_resolved and not is_outdated:
            unresolved_threads += 1
        comments_obj = thread.get("comments") or {}
        comment_nodes = comments_obj.get("nodes") or []
        thread_comments = [{
            "author": c.get("author", {}).get("login") if c.get("author") else None,
            "body": c.get("body", ""),
            "createdAt": c.get("createdAt")
        } for c in comment_nodes if not c.get("isMinimized", False)]
        if thread_comments:
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
        "requested_reviewers": len(rr_nodes),
        "requested_reviewers_list": requested_reviewers,
        "review_details": review_details,
        "unresolved_threads": unresolved_threads,
        "thread_details": thread_details,
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
        "additions": n.get("additions", 0),
        "deletions": n.get("deletions", 0),
        "changedFiles": n.get("changedFiles", 0),
        "files": [f["path"] for f in ((n.get("files") or {}).get("nodes") or [])],
        "projects": [pi["project"]["title"] for pi in ((n.get("projectItems") or {}).get("nodes") or [])],
        "baseRefName": n.get("baseRefName"),
        "headRefName": n.get("headRefName"),
    }
