# action_tracker.py - PRのアクション担当者を判定
from typing import List, Dict, Set
from datetime import datetime

def determine_action_owner(pr: dict) -> Dict:
    """
    PRの現在のアクション担当者を判定
    
    Returns:
        {
            "action": "author" | "reviewers" | "ready_to_merge" | "blocked",
            "waiting_for": ["user1", "user2", ...],
            "reason": "説明文"
        }
    """
    state = pr.get("state")
    author = pr.get("author")
    review_details = pr.get("review_details", [])
    requested_reviewers_list = pr.get("requested_reviewers_list", [])
    changes_requested = pr.get("changes_requested", 0)
    unresolved_threads = pr.get("unresolved_threads", 0)
    
    # CLOSEDやMERGEDは対象外
    if state in ["CLOSED", "MERGED"]:
        return {
            "action": "none",
            "waiting_for": [],
            "reason": f"PR is {state}"
        }
    
    # 最新のレビュー状態を人ごとに集計
    latest_reviews = {}
    for rv in sorted(review_details, key=lambda x: x.get("createdAt", ""), reverse=True):
        reviewer = rv.get("author")
        if reviewer and reviewer not in latest_reviews:
            latest_reviews[reviewer] = rv.get("state")
    
    # Changes Requested がある場合は作成者のターン
    if changes_requested > 0:
        changes_by = [r for r, s in latest_reviews.items() if s == "CHANGES_REQUESTED"]
        return {
            "action": "author",
            "waiting_for": [author] if author else [],
            "reason": f"修正要求あり (by: {', '.join(changes_by)})"
        }
    
    # 未解決の会話スレッドがある場合は作成者のターン
    if unresolved_threads > 0:
        return {
            "action": "author",
            "waiting_for": [author] if author else [],
            "reason": f"未解決の会話あり ({unresolved_threads}件)"
        }
    
    # レビュー依頼中のレビュアーを特定
    waiting_reviewers = []
    
    # reviewRequests に残っている人（まだレビューしていない）
    for reviewer in requested_reviewers_list:
        if reviewer not in latest_reviews:
            waiting_reviewers.append(reviewer)
    
    # レビュー済みでもAPPROVED以外の人
    for reviewer, state in latest_reviews.items():
        if state not in ["APPROVED"] and reviewer not in waiting_reviewers:
            # COMMENTEDのみの人もレビュー待ち扱い
            if state == "COMMENTED":
                waiting_reviewers.append(reviewer)
    
    if waiting_reviewers:
        return {
            "action": "reviewers",
            "waiting_for": waiting_reviewers,
            "reason": f"レビュー待ち ({len(waiting_reviewers)}人)"
        }
    
    # 全員承認済み
    approved_reviewers = [r for r, s in latest_reviews.items() if s == "APPROVED"]
    if approved_reviewers:
        return {
            "action": "ready_to_merge",
            "waiting_for": [author] if author else [],
            "reason": f"マージ可能 (承認: {len(approved_reviewers)}人)"
        }
    
    # レビュー依頼がない場合
    if not requested_reviewers_list and not latest_reviews:
        return {
            "action": "author",
            "waiting_for": [author] if author else [],
            "reason": "レビュー依頼なし"
        }
    
    # その他
    return {
        "action": "unknown",
        "waiting_for": [],
        "reason": "状態不明"
    }


def build_action_summary(prs: List[dict]) -> Dict[str, List[dict]]:
    """
    人ごとにアクションが必要なPRをまとめる
    
    Returns:
        {
            "user1": [
                {"pr": pr_dict, "action_info": {...}, "role": "author"|"reviewer"},
                ...
            ],
            ...
        }
    """
    user_actions = {}
    
    for pr in prs:
        if pr.get("state") != "OPEN":
            continue
        
        action_info = determine_action_owner(pr)
        
        for user in action_info["waiting_for"]:
            if user not in user_actions:
                user_actions[user] = []
            
            role = "author" if user == pr.get("author") else "reviewer"
            
            user_actions[user].append({
                "pr": pr,
                "action_info": action_info,
                "role": role
            })
    
    return user_actions


def format_action_for_hover(pr: dict) -> str:
    """
    hoverに表示する担当者情報をフォーマット
    """
    action_info = determine_action_owner(pr)
    
    if action_info["action"] == "none":
        return ""
    
    waiting = ", ".join(action_info["waiting_for"][:3])
    if len(action_info["waiting_for"]) > 3:
        waiting += f" (+{len(action_info['waiting_for']) - 3})"
    
    return f"{action_info['reason']} → {waiting}"
