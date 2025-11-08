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
