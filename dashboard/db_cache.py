# db_cache.py - SQLiteでPRデータをキャッシュ
import sqlite3
import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import pandas as pd


DB_PATH = Path(__file__).parent / "pr_cache.db"


def init_db():
    """データベースを初期化"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pr_cache (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            pr_number INTEGER NOT NULL,
            data TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            PRIMARY KEY (owner, repo, pr_number)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_fetched_at 
        ON pr_cache(owner, repo, fetched_at)
    """)
    
    # ETag管理テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS etag_cache (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            etag TEXT,
            last_modified TEXT,
            checked_at TEXT NOT NULL,
            PRIMARY KEY (owner, repo)
        )
    """)
    
    # 集計データキャッシュテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS aggregated_stats (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            stat_key TEXT NOT NULL,
            stat_data TEXT NOT NULL,
            computed_at TEXT NOT NULL,
            PRIMARY KEY (owner, repo, stat_type, stat_key)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_stats_type 
        ON aggregated_stats(owner, repo, stat_type, computed_at)
    """)
    
    # ファイルツリーキャッシュテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS file_tree_cache (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            all_paths TEXT NOT NULL,
            path_tree TEXT NOT NULL,
            computed_at TEXT NOT NULL,
            PRIMARY KEY (owner, repo)
        )
    """)
    
    # ディレクトリ統計キャッシュテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS dir_stats_cache (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            dir_path TEXT NOT NULL,
            total_prs INTEGER NOT NULL,
            open_count INTEGER NOT NULL,
            last_activity TEXT NOT NULL,
            computed_at TEXT NOT NULL,
            PRIMARY KEY (owner, repo, dir_path)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_dir_stats_activity 
        ON dir_stats_cache(owner, repo, last_activity DESC)
    """)
    
    # Issue cache table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS issue_cache (
            owner TEXT NOT NULL,
            repo TEXT NOT NULL,
            issue_number INTEGER NOT NULL,
            data TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            PRIMARY KEY (owner, repo, issue_number)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_issue_fetched_at 
        ON issue_cache(owner, repo, fetched_at)
    """)
    
    conn.commit()
    conn.close()


def save_prs(owner: str, repo: str, pr_list: List[Dict]) -> None:
    """PRデータをDBに保存（UPSERT）"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    for pr in pr_list:
        pr_number = pr.get("number")
        if not pr_number:
            continue
            
        cursor.execute("""
            INSERT OR REPLACE INTO pr_cache 
            (owner, repo, pr_number, data, fetched_at)
            VALUES (?, ?, ?, ?, ?)
        """, (owner, repo, pr_number, json.dumps(pr), now))
    
    conn.commit()
    conn.close()


def load_prs(owner: str, repo: str, max_age_hours: Optional[int] = None) -> List[Dict]:
    """DBからPRデータを読み込み"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if max_age_hours:
        cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
        cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
        
        cursor.execute("""
            SELECT data FROM pr_cache 
            WHERE owner = ? AND repo = ? AND fetched_at >= ?
            ORDER BY pr_number DESC
        """, (owner, repo, cutoff_iso))
    else:
        cursor.execute("""
            SELECT data FROM pr_cache 
            WHERE owner = ? AND repo = ?
            ORDER BY pr_number DESC
        """, (owner, repo))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [json.loads(row[0]) for row in rows]


def get_cache_info(owner: str, repo: str) -> Optional[Dict]:
    """キャッシュの最終更新情報を取得"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(*), MAX(fetched_at), MIN(fetched_at)
        FROM pr_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row or row[0] == 0:
        return None
    
    return {
        "count": row[0],
        "latest_fetch": row[1],
        "oldest_fetch": row[2]
    }


def clear_cache(owner: str, repo: str) -> int:
    """特定リポジトリのキャッシュをクリア"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM pr_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    cursor.execute("""
        DELETE FROM etag_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    
    return deleted


def get_etag(owner: str, repo: str) -> Optional[Dict]:
    """ETag情報を取得"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT etag, last_modified, checked_at 
        FROM etag_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        "etag": row[0],
        "last_modified": row[1],
        "checked_at": row[2]
    }


def save_etag(owner: str, repo: str, etag: Optional[str], last_modified: Optional[str]) -> None:
    """ETag情報を保存"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute("""
        INSERT OR REPLACE INTO etag_cache 
        (owner, repo, etag, last_modified, checked_at)
        VALUES (?, ?, ?, ?, ?)
    """, (owner, repo, etag, last_modified, now))
    
    conn.commit()
    conn.close()


def save_aggregated_stats(owner: str, repo: str, stat_type: str, stats_dict: Dict[str, any]) -> None:
    """
    集計統計をDBに保存
    stat_type: 'dir_stats', 'file_stats', 'summary', etc.
    stats_dict: {key: value} の辞書
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    for key, value in stats_dict.items():
        cursor.execute("""
            INSERT OR REPLACE INTO aggregated_stats 
            (owner, repo, stat_type, stat_key, stat_data, computed_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (owner, repo, stat_type, key, json.dumps(value), now))
    
    conn.commit()
    conn.close()


def load_aggregated_stats(owner: str, repo: str, stat_type: str, max_age_minutes: int = 60) -> Optional[Dict]:
    """
    集計統計をDBから読み込み
    max_age_minutes: 統計の有効期限（分）
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cutoff = datetime.now(timezone.utc).timestamp() - (max_age_minutes * 60)
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    
    cursor.execute("""
        SELECT stat_key, stat_data, computed_at 
        FROM aggregated_stats 
        WHERE owner = ? AND repo = ? AND stat_type = ? AND computed_at >= ?
    """, (owner, repo, stat_type, cutoff_iso))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return None
    
    result = {}
    for row in rows:
        result[row[0]] = json.loads(row[1])
    
    return result


def clear_aggregated_stats(owner: str, repo: str) -> int:
    """集計統計をクリア"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM aggregated_stats 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    
    return deleted


def save_file_tree(owner: str, repo: str, all_paths: List[str], path_tree: dict) -> None:
    """ファイルツリー情報をDBに保存"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # setをlistに変換してからJSON化
    def convert_sets(obj):
        if isinstance(obj, dict):
            return {k: convert_sets(v) for k, v in obj.items()}
        elif isinstance(obj, set):
            return list(obj)
        return obj
    
    tree_serializable = convert_sets(path_tree)
    
    cursor.execute("""
        INSERT OR REPLACE INTO file_tree_cache 
        (owner, repo, all_paths, path_tree, computed_at)
        VALUES (?, ?, ?, ?, ?)
    """, (owner, repo, json.dumps(all_paths), json.dumps(tree_serializable), now))
    
    conn.commit()
    conn.close()


def load_file_tree(owner: str, repo: str, max_age_hours: int = 24) -> Optional[Tuple[List[str], dict]]:
    """ファイルツリー情報をDBから読み込み"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    
    cursor.execute("""
        SELECT all_paths, path_tree, computed_at 
        FROM file_tree_cache 
        WHERE owner = ? AND repo = ? AND computed_at >= ?
    """, (owner, repo, cutoff_iso))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    all_paths = json.loads(row[0])
    path_tree = json.loads(row[1])
    
    # __files__をsetに戻す
    def restore_sets(obj):
        if isinstance(obj, dict):
            result = {}
            for k, v in obj.items():
                if k == "__files__" and isinstance(v, list):
                    result[k] = set(v)
                else:
                    result[k] = restore_sets(v)
            return result
        return obj
    
    path_tree = restore_sets(path_tree)
    
    return all_paths, path_tree


def save_dir_stats(owner: str, repo: str, dir_stats_df: pd.DataFrame) -> None:
    """ディレクトリ統計をDBに保存"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    # 既存データを削除
    cursor.execute("""
        DELETE FROM dir_stats_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    # 新しいデータを挿入
    for _, row in dir_stats_df.iterrows():
        cursor.execute("""
            INSERT INTO dir_stats_cache 
            (owner, repo, dir_path, total_prs, open_count, last_activity, computed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            owner, repo, 
            row['dir_key'], 
            int(row['total_prs']), 
            int(row['open_cnt']),
            row['last_activity'].isoformat() if hasattr(row['last_activity'], 'isoformat') else str(row['last_activity']),
            now
        ))
    
    conn.commit()
    conn.close()


def load_dir_stats(owner: str, repo: str, max_age_hours: int = 24) -> Optional[pd.DataFrame]:
    """ディレクトリ統計をDBから読み込み"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    
    cursor.execute("""
        SELECT dir_path, total_prs, open_count, last_activity 
        FROM dir_stats_cache 
        WHERE owner = ? AND repo = ? AND computed_at >= ?
        ORDER BY last_activity DESC
    """, (owner, repo, cutoff_iso))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return None
    
    df = pd.DataFrame(rows, columns=['dir_key', 'total_prs', 'open_cnt', 'last_activity'])
    df['last_activity'] = pd.to_datetime(df['last_activity'], format="ISO8601", utc=True)
    
    return df


def clear_file_caches(owner: str, repo: str) -> int:
    """ファイル関連のキャッシュをクリア"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM file_tree_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    deleted_tree = cursor.rowcount
    
    cursor.execute("""
        DELETE FROM dir_stats_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    deleted_stats = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    return deleted_tree + deleted_stats


def save_issues(owner: str, repo: str, issue_list: List[Dict]) -> None:
    """Save issue data to DB (UPSERT)"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now(timezone.utc).isoformat()
    
    for issue in issue_list:
        issue_number = issue.get("number")
        if not issue_number:
            continue
            
        cursor.execute("""
            INSERT OR REPLACE INTO issue_cache 
            (owner, repo, issue_number, data, fetched_at)
            VALUES (?, ?, ?, ?, ?)
        """, (owner, repo, issue_number, json.dumps(issue), now))
    
    conn.commit()
    conn.close()


def load_issues(owner: str, repo: str, max_age_hours: Optional[int] = None) -> List[Dict]:
    """Load issue data from DB"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if max_age_hours:
        cutoff = datetime.now(timezone.utc).timestamp() - (max_age_hours * 3600)
        cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
        
        cursor.execute("""
            SELECT data FROM issue_cache 
            WHERE owner = ? AND repo = ? AND fetched_at >= ?
            ORDER BY issue_number DESC
        """, (owner, repo, cutoff_iso))
    else:
        cursor.execute("""
            SELECT data FROM issue_cache 
            WHERE owner = ? AND repo = ?
            ORDER BY issue_number DESC
        """, (owner, repo))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [json.loads(row[0]) for row in rows]


def get_issue_cache_info(owner: str, repo: str) -> Optional[Dict]:
    """Get issue cache information"""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT COUNT(*), MAX(fetched_at), MIN(fetched_at)
        FROM issue_cache 
        WHERE owner = ? AND repo = ?
    """, (owner, repo))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row or row[0] == 0:
        return None
    
    return {
        "count": row[0],
        "latest_fetch": row[1],
        "oldest_fetch": row[2]
    }

