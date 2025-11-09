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
    
    for repo_config in repositories:
        owner = repo_config['owner']
        repo = repo_config['repo']
        
        print(f"  Loading PRs from {owner}/{repo}...")
        
        try:
            cached_prs = db_cache.load_prs(owner, repo)
            
            # Add owner/repo to each PR for filtering
            for pr in cached_prs:
                pr['owner'] = owner
                pr['repo'] = repo
            
            all_prs.extend(cached_prs)
            print(f"    Loaded {len(cached_prs)} PRs")
            
        except Exception as e:
            print(f"    Warning: Could not load PRs from {owner}/{repo}: {e}")
    
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


def generate_fourkeys_json(output_dir: Path, prs: list):
    """Generate fourkeys.json with Four Keys metrics"""
    from datetime import timedelta
    
    # Filter merged PRs
    merged_prs = [pr for pr in prs if pr.get('state') == 'MERGED' and pr.get('mergedAt')]
    
    # Keywords to identify failure PRs
    failure_keywords = ["revert", "hotfix", "urgent", "fix", "rollback", "emergency", "critical"]
    
    fourkeys_data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "metrics": {},
        "detailedData": {
            "deployments": [],
            "leadTimes": [],
            "failures": [],
            "restoreTimes": []
        }
    }
    
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
    
    # Summary
    print("=" * 60)
    print("Summary:")
    print(f"  Repositories: {len(repositories)}")
    print(f"  Total PRs: {len(prs)}")
    print(f"  Open: {analytics['summary']['open']}")
    print(f"  Merged: {analytics['summary']['merged']}")
    print(f"  Closed: {analytics['summary']['closed']}")
    print()
    print("✓ All data files generated successfully!")
    print()
    print("Next steps:")
    print("  1. Open Dashboard_pages/index.html in a browser")
    print("  2. Or deploy to GitHub Pages")


if __name__ == "__main__":
    main()
