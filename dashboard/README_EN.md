# GitHub PR Dashboard

An integrated Streamlit dashboard for visualizing and analyzing GitHub PRs

[日本語](README.md) | English

## Key Features

### 🏠 Home
- Select primary repository
- Display data cache status
- Navigation to each page
- Toggle dark mode

### 📊 PR Dashboard
- **PR Timeline**: Gantt chart visualization
- **Documentation/Code Analysis**: PR timeline by directory
- **Action Tracking**: Auto-detect PRs awaiting review/fixes (business day-based)
- **Metrics**: Open/Merged/Closed counts, average merge time

### 📈 PR Analysis (7 Analysis Tabs)
- **Stagnation Analysis**: Distribution of open PR durations
- **Blocker Analysis**: Estimation of reasons for unclosed PRs
- **Reviewer Analysis**: Review activity and comment response status
- **Trend Analysis**: Weekly PR creation trends
- **Bottleneck Analysis**: Details on review/fix delays
- **Review Speed**: Time-to-merge analysis
- **Change Patterns**: File change frequency and PR size

### 🔑 Four Keys (DORA Metrics)
- **Deployment Frequency**: Deployments per week
- **Lead Time for Changes**: Time from PR creation to merge
- **Change Failure Rate**: Percentage of failed PRs
- **Time to Restore Service**: Mean Time To Recovery (MTTR)

### 📊 Statistics & Reports
- **Period Summary**: Total PRs, merge rate, average lead time, active developers
- **Trend Analysis**: 8-week trends for PR creation and average lead time
- **Review Activity**: Total reviews, comments, averages per PR
- **Automated Insights**: Development activity analysis and issue detection
- **Improvement Suggestions**: Concrete action proposals based on data
- **Weekly Report Export**: Markdown-formatted report generation

## Setup

### 1. Install Packages

```bash
# From repository root directory
pip install -r requirements.txt
```

### 2. GitHub Token Configuration

Set environment variable (repo scope required):

```bash
# Windows (PowerShell)
$env:GITHUB_TOKEN="your_token_here"

# Linux/Mac
export GITHUB_TOKEN=your_token_here
```

### 3. Repository Configuration

Configure target repositories in `config.py`:

```python
REPOSITORIES = [
    {
        "name": "MyProject",
        "owner": "your-organization",
        "repo": "your-repository"
    },
]
```

### 4. Fetch Data and Launch

```bash
# Fetch data
python fetch_data.py --all

# Launch dashboard
streamlit run app.py
```

## Data Updates

### Manual Update

```bash
python fetch_data.py --all          # All repositories
python fetch_data.py --all --force  # Force update
python fetch_data.py --days 180     # Specify period
```

### Scheduled Execution (Recommended)

```powershell
# Windows: Daily at 2 AM
schtasks /create /tn "GitHub PR Fetch" /tr "python C:\path\to\dashboard\fetch_data.py --all" /sc daily /st 02:00
```

```bash
# Linux/Mac: cron
0 2 * * * cd /path/to/dashboard && python fetch_data.py --all
```

## Feature Details

### PR Dashboard

- **PR Timeline**: Visualize with Gantt chart (business day-based, color-coded by state)
- **Document/Code Analysis**: PR impact by directory
- **Action Tracking**: Auto-detect PRs awaiting review/fixes

### PR Analytics

- **Retention Analysis**: Distribution of OPEN PR retention time
- **Blocker Analysis**: Estimate reasons for unclosed PRs
- **Reviewer Analysis**: Review activity and comment response status
- **Trend Analysis**: Weekly PR creation trends
- **Bottleneck Analysis**: Details of review/fix wait times (business day-based)
- **Review Speed**: Time-to-merge analysis
- **Change Patterns**: File change frequency and PR size

## Architecture

### Caching Mechanism

Stores PR data, ETag, and thread details in SQLite (`pr_cache.db`).
Data flow: `fetch_data.py` (once daily) → `pr_cache.db` → `app.py` (instant display)

### Performance

- Initial display: 0.1-0.5 seconds
- Subsequent display: <0.1 seconds
- API calls: Once per day only

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No data displayed | `python fetch_data.py --all` |
| Data is outdated | `python fetch_data.py --all --force` |
| Add repository | Add to REPOSITORIES in `config.py`, then refetch data |
| Thread info not displayed | `python fetch_data.py --all --force` |

## File Structure

```
dashboard/
├── app.py                # Entry point
├── pages/
│   ├── 1_dashboard.py    # PR Dashboard
│   ├── 2_analytics.py    # PR Analytics
│   └── 3_four_keys.py    # Four Keys
├── fetch_data.py         # Data fetching
├── config.py             # Repository config
├── fetcher.py            # GitHub API
├── db_cache.py           # Cache management
├── action_tracker.py     # Action tracking
└── pr_cache.db           # DB (auto-generated)
```

## Customization

- Business day definition: Modify `calculate_business_hours()` function
- Stale threshold: Adjust in sidebar (default: 168 hours)
- Color coding: By state (OPEN/MERGED/CLOSED), by elapsed time (green→red)
