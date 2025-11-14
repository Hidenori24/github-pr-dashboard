#!/usr/bin/env python3
"""
Generate static JSON data files for GitHub Pages dashboard
This script reads data from the Streamlit dashboard cache and generates JSON files
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path to import dashboard modules
script_dir = Path(__file__).parent
parent_dir = script_dir.parent
sys.path.insert(0, str(parent_dir / "dashboard"))

try:
    import config
    import db_cache
except ImportError as e:
    print(f"Error importing dashboard modules: {e}")
    print("Make sure the dashboard directory is accessible")
    sys.exit(1)


def generate_config_json(output_dir: Path):
    """Generate config.json from dashboard config"""
    config_data = {
        "repositories": config.REPOSITORIES if config.REPOSITORIES else [],
        "primaryRepoIndex": 0,
        "lastGenerated": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }
    
    output_file = output_dir / "config.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file}")
    return config_data


def generate_prs_json(output_dir: Path, repositories: list):
    """Generate prs.json from cached PR data"""
    all_prs = []
    cache_available = False
    
    # Check if cache database exists
    cache_db_path = parent_dir / "dashboard" / "pr_cache.db"
    if cache_db_path.exists():
        cache_available = True
    
    for repo_config in repositories:
        owner = repo_config['owner']
        repo = repo_config['repo']
        
        print(f"  Loading PRs from {owner}/{repo}...")
        
        if cache_available:
            try:
                cached_prs = db_cache.load_prs(owner, repo)
                
                # Add owner/repo to each PR for filtering
                for pr in cached_prs:
                    pr['owner'] = owner
                    pr['repo'] = repo
                
                all_prs.extend(cached_prs)
                print(f"    Loaded {len(cached_prs)} PRs from cache")
                
            except Exception as e:
                print(f"    Warning: Could not load PRs from {owner}/{repo}: {e}")
        else:
            print(f"    Warning: Cache database not found, skipping")
    
    # If no PRs were loaded from cache, create an empty file
    # The frontend will fall back to sample_prs.json
    if len(all_prs) == 0:
        print("  ⚠️  No PRs loaded from cache. Creating empty prs.json.")
        print("     The dashboard will use sample data as fallback.")
    
    output_file = output_dir / "prs.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_prs, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file} ({len(all_prs)} PRs)")
    return all_prs


def generate_cache_info_json(output_dir: Path, repositories: list, total_prs: int):
    """Generate cache_info.json with metadata"""
    cache_info = {
        "lastUpdate": datetime.now(timezone.utc).isoformat(),
        "totalPRs": total_prs,
        "repositories": len(repositories)
    }
    
    # Add per-repository cache info
    repo_info = []
    cache_db_path = parent_dir / "dashboard" / "pr_cache.db"
    
    if cache_db_path.exists():
        for repo_config in repositories:
            owner = repo_config['owner']
            repo = repo_config['repo']
            
            try:
                info = db_cache.get_cache_info(owner, repo)
                if info:
                    repo_info.append({
                        "owner": owner,
                        "repo": repo,
                        "count": info['count'],
                        "lastFetch": info['latest_fetch']
                    })
            except Exception:
                pass
    else:
        # Cache database doesn't exist, add placeholder info
        for repo_config in repositories:
            repo_info.append({
                "owner": repo_config['owner'],
                "repo": repo_config['repo'],
                "count": 0,
                "lastFetch": None
            })
    
    cache_info['repositoryInfo'] = repo_info
    
    output_file = output_dir / "cache_info.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cache_info, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file}")
    return cache_info


def generate_analytics_json(output_dir: Path, prs: list):
    """Generate analytics.json with pre-computed statistics"""
    analytics = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(prs),
            "open": len([pr for pr in prs if pr.get('state') == 'OPEN']),
            "merged": len([pr for pr in prs if pr.get('state') == 'MERGED']),
            "closed": len([pr for pr in prs if pr.get('state') == 'CLOSED'])
        }
    }
    
    output_file = output_dir / "analytics.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(analytics, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file}")
    return analytics


def generate_fourkeys_json(output_dir: Path, prs: list):
    """Generate fourkeys.json placeholder - metrics are now calculated client-side"""
    # Four Keys metrics are now calculated dynamically in JavaScript
    # This file is kept for backward compatibility but contains minimal data
    fourkeys = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "note": "Four Keys metrics are calculated dynamically from prs.json on the client side",
        "totalPRs": len(prs),
        "mergedPRs": len([pr for pr in prs if pr.get('state') == 'MERGED']),
        "metrics": {
            "deploymentFrequency": {
                "value": 0,
                "unit": "per week",
                "classification": {"level": "Calculating...", "color": "#6b7280"}
            },
            "leadTime": {
                "value": 0,
                "unit": "days",
                "classification": {"level": "Calculating...", "color": "#6b7280"}
            },
            "changeFailureRate": {
                "value": 0,
                "unit": "percent",
                "classification": {"level": "Calculating...", "color": "#6b7280"}
            },
            "mttr": {
                "value": 0,
                "unit": "hours",
                "classification": {"level": "Calculating...", "color": "#6b7280"}
            }
        }
    }
    
    output_file = output_dir / "fourkeys.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fourkeys, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file} (placeholder - metrics calculated client-side)")
    return fourkeys


def classify_dora_level(value: float, metric: str) -> dict:
    """Classify DORA metric level based on value"""
    if metric == "deployment_frequency":  # per week
        if value >= 7:  # Daily or more
            return {"level": "Elite", "color": "#10b981"}
        elif value >= 1:  # Weekly
            return {"level": "High", "color": "#3b82f6"}
        elif value >= 0.25:  # Monthly
            return {"level": "Medium", "color": "#f59e0b"}
        else:
            return {"level": "Low", "color": "#ef4444"}
    
    elif metric == "lead_time":  # days
        if value < 1:
            return {"level": "Elite", "color": "#10b981"}
        elif value < 7:
            return {"level": "High", "color": "#3b82f6"}
        elif value < 30:
            return {"level": "Medium", "color": "#f59e0b"}
        else:
            return {"level": "Low", "color": "#ef4444"}
    
    elif metric == "change_failure_rate":  # percentage
        if value <= 15:
            return {"level": "Elite", "color": "#10b981"}
        elif value <= 30:
            return {"level": "High", "color": "#3b82f6"}
        elif value <= 45:
            return {"level": "Medium", "color": "#f59e0b"}
        else:
            return {"level": "Low", "color": "#ef4444"}
    
    elif metric == "mttr":  # hours
        if value < 1:
            return {"level": "Elite", "color": "#10b981"}
        elif value < 24:
            return {"level": "High", "color": "#3b82f6"}
        elif value < 168:  # 1 week
            return {"level": "Medium", "color": "#f59e0b"}
        else:
            return {"level": "Low", "color": "#ef4444"}
    
    return {"level": "Unknown", "color": "#6b7280"}


def calculate_repo_fourkeys(repo_prs: list, failure_keywords: list) -> dict:
    """Calculate Four Keys metrics for a single repository"""
    from datetime import timedelta
    
    # Filter merged PRs
    merged_prs = [pr for pr in repo_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
    
    if not merged_prs:
        # Return empty metrics if no merged PRs
        fourkeys_data["metrics"] = {
            "deploymentFrequency": {
                "value": 0,
                "unit": "per week",
                "classification": classify_dora_level(0, "deployment_frequency")
            },
            "leadTime": {
                "value": 0,
                "unit": "days",
                "classification": classify_dora_level(0, "lead_time")
            },
            "changeFailureRate": {
                "value": 0,
                "unit": "percent",
                "classification": classify_dora_level(0, "change_failure_rate")
            },
            "mttr": {
                "value": 0,
                "unit": "hours",
                "classification": classify_dora_level(0, "mttr")
            }
        }
        
        output_file = output_dir / "fourkeys.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(fourkeys_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Generated: {output_file} (no merged PRs)")
        return fourkeys_data
    
    # 1. Deployment Frequency
    merge_dates = [datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00')) for pr in merged_prs]
    merge_dates.sort()
    date_range_days = (merge_dates[-1] - merge_dates[0]).days
    weeks = max(date_range_days / 7, 1)
    deployment_frequency = len(merged_prs) / weeks
    
    # Group by week for detailed data
    weekly_deploys = {}
    for pr in merged_prs:
        merged_date = datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00'))
        week_key = merged_date.strftime('%Y-W%U')
        if week_key not in weekly_deploys:
            weekly_deploys[week_key] = []
        weekly_deploys[week_key].append({
            "number": pr.get('number'),
            "title": pr.get('title'),
            "mergedAt": pr.get('mergedAt')
        })
    
    fourkeys_data["detailedData"]["deployments"] = [
        {"week": week, "count": len(prs), "prs": prs}
        for week, prs in sorted(weekly_deploys.items())
    ]
    
    # 2. Lead Time for Changes
    lead_times = []
    for pr in merged_prs:
        if pr.get('createdAt') and pr.get('mergedAt'):
            created = datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))
            merged = datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00'))
            lead_time_days = (merged - created).total_seconds() / (3600 * 24)
            lead_times.append({
                "number": pr.get('number'),
                "title": pr.get('title'),
                "leadTimeDays": lead_time_days,
                "leadTimeHours": lead_time_days * 24,
                "createdAt": pr.get('createdAt'),
                "mergedAt": pr.get('mergedAt')
            })
    
    median_lead_time = sorted([lt['leadTimeDays'] for lt in lead_times])[len(lead_times) // 2] if lead_times else 0
    fourkeys_data["detailedData"]["leadTimes"] = lead_times
    
    # 3. Change Failure Rate
    failure_prs = []
    for pr in merged_prs:
        title = pr.get('title', '').lower()
        labels = [label.lower() for label in pr.get('labels', [])]
        
        is_failure = any(
            keyword in title or any(keyword in label for label in labels)
            for keyword in failure_keywords
        )
        
        if is_failure:
            created = datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))
            merged = datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00'))
            restore_time_hours = (merged - created).total_seconds() / 3600
            
            failure_prs.append({
                "number": pr.get('number'),
                "title": pr.get('title'),
                "labels": pr.get('labels', []),
                "createdAt": pr.get('createdAt'),
                "mergedAt": pr.get('mergedAt'),
                "restoreTimeHours": restore_time_hours
            })
    
    change_failure_rate = (len(failure_prs) / len(merged_prs)) * 100 if merged_prs else 0
    fourkeys_data["detailedData"]["failures"] = failure_prs
    
    # 4. Mean Time to Restore (MTTR)
    if failure_prs:
        restore_times = [fp['restoreTimeHours'] for fp in failure_prs]
        median_mttr = sorted(restore_times)[len(restore_times) // 2]
        fourkeys_data["detailedData"]["restoreTimes"] = [
            {
                "number": fp['number'],
                "title": fp['title'],
                "restoreTimeHours": fp['restoreTimeHours'],
                "mergedAt": fp['mergedAt']
            }
            for fp in failure_prs
        ]
    else:
        median_mttr = 0
        fourkeys_data["detailedData"]["restoreTimes"] = []
    
    # Compile metrics
    fourkeys_data["metrics"] = {
        "deploymentFrequency": {
            "value": round(deployment_frequency, 2),
            "unit": "per week",
            "totalDeployments": len(merged_prs),
            "weeks": round(weeks, 1),
            "classification": classify_dora_level(deployment_frequency, "deployment_frequency")
        },
        "leadTime": {
            "value": round(median_lead_time, 2),
            "unit": "days",
            "median": round(median_lead_time, 2),
            "average": round(sum(lt['leadTimeDays'] for lt in lead_times) / len(lead_times), 2) if lead_times else 0,
            "classification": classify_dora_level(median_lead_time, "lead_time")
        },
        "changeFailureRate": {
            "value": round(change_failure_rate, 2),
            "unit": "percent",
            "failures": len(failure_prs),
            "total": len(merged_prs),
            "classification": classify_dora_level(change_failure_rate, "change_failure_rate")
        },
        "mttr": {
            "value": round(median_mttr, 2),
            "unit": "hours",
            "median": round(median_mttr, 2),
            "classification": classify_dora_level(median_mttr, "mttr")
        }
    }
    
    output_file = output_dir / "fourkeys.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(fourkeys_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file}")
    print(f"    Deployment Frequency: {deployment_frequency:.1f}/week ({fourkeys_data['metrics']['deploymentFrequency']['classification']['level']})")
    print(f"    Lead Time: {median_lead_time:.1f} days ({fourkeys_data['metrics']['leadTime']['classification']['level']})")
    print(f"    Change Failure Rate: {change_failure_rate:.1f}% ({fourkeys_data['metrics']['changeFailureRate']['classification']['level']})")
    print(f"    MTTR: {median_mttr:.1f} hours ({fourkeys_data['metrics']['mttr']['classification']['level']})")
    
    return fourkeys_data


def calculate_weekly_statistics(prs: list, week_start: datetime, week_end: datetime) -> dict:
    """Calculate statistics for a specific week"""
    from datetime import timedelta
    
    # Filter PRs created in this week
    week_prs = [
        pr for pr in prs
        if pr.get('createdAt') and
        week_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) < week_end
    ]
    
    # Previous week for comparison
    prev_week_start = week_start - timedelta(days=7)
    prev_week_prs = [
        pr for pr in prs
        if pr.get('createdAt') and
        prev_week_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) < week_start
    ]
    
    # Basic counts
    total_prs = len(week_prs)
    open_prs = len([pr for pr in week_prs if pr.get('state') == 'OPEN'])
    merged_prs = len([pr for pr in week_prs if pr.get('state') == 'MERGED'])
    closed_prs = len([pr for pr in week_prs if pr.get('state') == 'CLOSED'])
    
    # Previous period comparison
    prev_total = len(prev_week_prs)
    total_change = total_prs - prev_total
    total_change_pct = (total_change / prev_total * 100) if prev_total > 0 else 0
    
    # Lead time calculation
    merged_current = [pr for pr in week_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
    if merged_current:
        lead_times = []
        for pr in merged_current:
            created = datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))
            merged = datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00'))
            lead_time_days = (merged - created).total_seconds() / (3600 * 24)
            lead_times.append(lead_time_days)
        
        lead_times.sort()
        median_lead_time = lead_times[len(lead_times) // 2] if lead_times else 0
    else:
        median_lead_time = 0
    
    # Previous lead time
    merged_prev = [pr for pr in prev_week_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
    if merged_prev:
        prev_lead_times = []
        for pr in merged_prev:
            created = datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))
            merged = datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00'))
            lead_time_days = (merged - created).total_seconds() / (3600 * 24)
            prev_lead_times.append(lead_time_days)
        
        prev_lead_times.sort()
        prev_lead_time = prev_lead_times[len(prev_lead_times) // 2] if prev_lead_times else 0
        lead_time_change = median_lead_time - prev_lead_time
    else:
        lead_time_change = 0
    
    # Active authors
    active_authors = len(set(pr.get('author') for pr in week_prs if pr.get('author')))
    
    # Review statistics
    total_reviews = sum(pr.get('reviews_count', 0) for pr in week_prs)
    total_comments = sum(pr.get('comments_count', 0) for pr in week_prs)
    avg_reviews_per_pr = total_reviews / total_prs if total_prs > 0 else 0
    avg_comments_per_pr = total_comments / total_prs if total_prs > 0 else 0
    
    return {
        'weekStart': week_start.isoformat(),
        'weekEnd': week_end.isoformat(),
        'totalPRs': total_prs,
        'openPRs': open_prs,
        'mergedPRs': merged_prs,
        'closedPRs': closed_prs,
        'totalChange': total_change,
        'totalChangePct': round(total_change_pct, 1),
        'avgLeadTime': round(median_lead_time, 2),
        'leadTimeChange': round(lead_time_change, 2),
        'activeAuthors': active_authors,
        'totalReviews': total_reviews,
        'totalComments': total_comments,
        'avgReviewsPerPR': round(avg_reviews_per_pr, 2),
        'avgCommentsPerPR': round(avg_comments_per_pr, 2)
    }


def generate_historical_statistics_json(output_dir: Path, prs: list):
    """Generate historical statistics for past weeks, months, and years"""
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    historical_data = {
        "generated": now.isoformat(),
        "weekly": [],
        "monthly": [],
        "yearly": []
    }
    
    # Generate weekly statistics for past 52 weeks (1 year)
    print("  Calculating weekly statistics...")
    for i in range(52, 0, -1):
        week_start = now - timedelta(days=now.weekday() + 7*i)
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        
        stats = calculate_weekly_statistics(prs, week_start, week_end)
        historical_data["weekly"].append(stats)
    
    # Current week
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    stats = calculate_weekly_statistics(prs, week_start, now)
    historical_data["weekly"].append(stats)
    
    print(f"    Generated {len(historical_data['weekly'])} weekly statistics")
    
    # Generate monthly statistics for past 24 months (2 years)
    print("  Calculating monthly statistics...")
    for i in range(24, 0, -1):
        # Calculate month start
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        
        month_start = datetime(year, month, 1, tzinfo=timezone.utc)
        
        # Calculate month end (first day of next month)
        if month == 12:
            month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        # Calculate stats for the month
        month_prs = [
            pr for pr in prs
            if pr.get('createdAt') and
            month_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) < month_end
        ]
        
        # Previous month for comparison
        if month == 1:
            prev_month_start = datetime(year - 1, 12, 1, tzinfo=timezone.utc)
            prev_month_end = datetime(year, 1, 1, tzinfo=timezone.utc)
        else:
            prev_month_start = datetime(year, month - 1, 1, tzinfo=timezone.utc)
            prev_month_end = month_start
        
        prev_month_prs = [
            pr for pr in prs
            if pr.get('createdAt') and
            prev_month_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) < prev_month_end
        ]
        
        # Calculate statistics
        total_prs = len(month_prs)
        merged_prs = [pr for pr in month_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
        
        if merged_prs:
            lead_times = [
                (datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00')) -
                 datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))).total_seconds() / (3600 * 24)
                for pr in merged_prs
            ]
            lead_times.sort()
            median_lead_time = lead_times[len(lead_times) // 2] if lead_times else 0
        else:
            median_lead_time = 0
        
        historical_data["monthly"].append({
            'monthStart': month_start.isoformat(),
            'monthEnd': month_end.isoformat(),
            'totalPRs': total_prs,
            'openPRs': len([pr for pr in month_prs if pr.get('state') == 'OPEN']),
            'mergedPRs': len(merged_prs),
            'closedPRs': len([pr for pr in month_prs if pr.get('state') == 'CLOSED']),
            'totalChange': total_prs - len(prev_month_prs),
            'avgLeadTime': round(median_lead_time, 2),
            'activeAuthors': len(set(pr.get('author') for pr in month_prs if pr.get('author')))
        })
    
    # Current month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_prs = [
        pr for pr in prs
        if pr.get('createdAt') and
        month_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) <= now
    ]
    
    merged_prs = [pr for pr in month_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
    if merged_prs:
        lead_times = [
            (datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00')) -
             datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))).total_seconds() / (3600 * 24)
            for pr in merged_prs
        ]
        lead_times.sort()
        median_lead_time = lead_times[len(lead_times) // 2] if lead_times else 0
    else:
        median_lead_time = 0
    
    historical_data["monthly"].append({
        'monthStart': month_start.isoformat(),
        'monthEnd': now.isoformat(),
        'totalPRs': len(month_prs),
        'openPRs': len([pr for pr in month_prs if pr.get('state') == 'OPEN']),
        'mergedPRs': len(merged_prs),
        'closedPRs': len([pr for pr in month_prs if pr.get('state') == 'CLOSED']),
        'totalChange': 0,
        'avgLeadTime': round(median_lead_time, 2),
        'activeAuthors': len(set(pr.get('author') for pr in month_prs if pr.get('author')))
    })
    
    print(f"    Generated {len(historical_data['monthly'])} monthly statistics")
    
    # Generate yearly statistics for past 3 years
    print("  Calculating yearly statistics...")
    for i in range(3, 0, -1):
        year_start = datetime(now.year - i, 1, 1, tzinfo=timezone.utc)
        year_end = datetime(now.year - i + 1, 1, 1, tzinfo=timezone.utc)
        
        year_prs = [
            pr for pr in prs
            if pr.get('createdAt') and
            year_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) < year_end
        ]
        
        merged_prs = [pr for pr in year_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
        
        if merged_prs:
            lead_times = [
                (datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00')) -
                 datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))).total_seconds() / (3600 * 24)
                for pr in merged_prs
            ]
            lead_times.sort()
            median_lead_time = lead_times[len(lead_times) // 2] if lead_times else 0
        else:
            median_lead_time = 0
        
        historical_data["yearly"].append({
            'yearStart': year_start.isoformat(),
            'yearEnd': year_end.isoformat(),
            'year': now.year - i,
            'totalPRs': len(year_prs),
            'openPRs': len([pr for pr in year_prs if pr.get('state') == 'OPEN']),
            'mergedPRs': len(merged_prs),
            'closedPRs': len([pr for pr in year_prs if pr.get('state') == 'CLOSED']),
            'avgLeadTime': round(median_lead_time, 2),
            'activeAuthors': len(set(pr.get('author') for pr in year_prs if pr.get('author')))
        })
    
    # Current year (year to date)
    year_start = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    year_prs = [
        pr for pr in prs
        if pr.get('createdAt') and
        year_start <= datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00')) <= now
    ]
    
    merged_prs = [pr for pr in year_prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
    if merged_prs:
        lead_times = [
            (datetime.fromisoformat(pr['mergedAt'].replace('Z', '+00:00')) -
             datetime.fromisoformat(pr['createdAt'].replace('Z', '+00:00'))).total_seconds() / (3600 * 24)
            for pr in merged_prs
        ]
        lead_times.sort()
        median_lead_time = lead_times[len(lead_times) // 2] if lead_times else 0
    else:
        median_lead_time = 0
    
    historical_data["yearly"].append({
        'yearStart': year_start.isoformat(),
        'yearEnd': now.isoformat(),
        'year': now.year,
        'totalPRs': len(year_prs),
        'openPRs': len([pr for pr in year_prs if pr.get('state') == 'OPEN']),
        'mergedPRs': len(merged_prs),
        'closedPRs': len([pr for pr in year_prs if pr.get('state') == 'CLOSED']),
        'avgLeadTime': round(median_lead_time, 2),
        'activeAuthors': len(set(pr.get('author') for pr in year_prs if pr.get('author')))
    })
    
    print(f"    Generated {len(historical_data['yearly'])} yearly statistics")
    
    output_file = output_dir / "historical_statistics.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(historical_data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file}")
    return historical_data


def main():
    """Main function to generate all data files"""
    print("GitHub PR Dashboard - Data Generator")
    print("=" * 60)
    
    # Determine output directory
    output_dir = script_dir / "data"
    output_dir.mkdir(exist_ok=True)
    
    print(f"Output directory: {output_dir}")
    print()
    
    # Generate config.json
    print("Generating config.json...")
    config_data = generate_config_json(output_dir)
    repositories = config_data['repositories']
    
    if not repositories:
        print("\n⚠️  Warning: No repositories configured in dashboard/config.py")
        print("   Add repositories to REPOSITORIES list in config.py")
        return
    
    print()
    
    # Generate prs.json
    print("Generating prs.json...")
    prs = generate_prs_json(output_dir, repositories)
    print()
    
    # Generate cache_info.json
    print("Generating cache_info.json...")
    cache_info = generate_cache_info_json(output_dir, repositories, len(prs))
    print()
    
    # Generate analytics.json
    print("Generating analytics.json...")
    analytics = generate_analytics_json(output_dir, prs)
    print()
    
    # Generate fourkeys.json
    print("Generating fourkeys.json...")
    fourkeys = generate_fourkeys_json(output_dir, prs)
    print()
    
    # Generate issues.json
    print("Generating issues.json...")
    issues = generate_issues_json(output_dir, repositories)
    print()
    
    # Generate historical statistics
    print("Generating historical_statistics.json...")
    historical_stats = generate_historical_statistics_json(output_dir, prs)
    print()
    
    # Summary
    print("=" * 60)
    print("Summary:")
    print(f"  Repositories: {len(repositories)}")
    print(f"  Total PRs: {len(prs)}")
    print(f"  Total Issues: {len(issues)}")
    print(f"  Open PRs: {analytics['summary']['open']}")
    print(f"  Merged PRs: {analytics['summary']['merged']}")
    print(f"  Closed PRs: {analytics['summary']['closed']}")
    print(f"  Historical weeks: {len(historical_stats['weekly'])}")
    print(f"  Historical months: {len(historical_stats['monthly'])}")
    print(f"  Historical years: {len(historical_stats['yearly'])}")
    print()
    print("✓ All data files generated successfully!")
    print()
    print("Next steps:")
    print("  1. Open Dashboard_pages/index.html in a browser")
    print("  2. Or deploy to GitHub Pages")


def generate_issues_json(output_dir: Path, repositories: list):
    """Generate issues.json from cached issue data"""
    all_issues = []
    
    for repo_config in repositories:
        owner = repo_config['owner']
        repo = repo_config['repo']
        
        print(f"  Loading Issues from {owner}/{repo}...")
        
        try:
            cached_issues = db_cache.load_issues(owner, repo)
            
            # Add owner/repo to each issue for filtering
            for issue in cached_issues:
                issue['owner'] = owner
                issue['repo'] = repo
            
            all_issues.extend(cached_issues)
            print(f"    Loaded {len(cached_issues)} Issues")
            
        except Exception as e:
            print(f"    Warning: Could not load Issues from {owner}/{repo}: {e}")
    
    output_file = output_dir / "issues.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_issues, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated: {output_file} ({len(all_issues)} Issues)")
    return all_issues


if __name__ == "__main__":
    main()
