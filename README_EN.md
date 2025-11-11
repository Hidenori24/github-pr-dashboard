# GitHub PR Dashboard

A dashboard for visualizing and analyzing GitHub Pull Requests

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)

[日本語](README.md) | English

Visualize PR status, review progress, and bottlenecks intuitively to improve your development team's productivity.

## Two Versions

This repository provides two implementations:

1. **[Streamlit Version](dashboard/)** - Python-based dashboard running on local PC
2. **[GitHub Pages Version](Dashboard_pages/)** - Static web application that can be published on GitHub Pages (Recommended)

| Feature | Streamlit Version | GitHub Pages Version |
|---------|------------------|--------------------------|
| Runtime | Local PC | Cloud (Free) |
| Setup | Python environment required | Not required (Browser only) |
| Auto Update | Manual setup | GitHub Actions (Automatic) |
| Access | localhost | Public URL |
| Team Sharing | Difficult | Easy (Share URL) |

For GitHub Pages version usage, see [Dashboard_pages/README.md](Dashboard_pages/README.md).

Check out the [Live Demo (GitHub Pages)](https://hidenori24.github.io/github-pr-dashboard/) to see the PR dashboard for this repository.

## Directory Structure

```
├── Dashboard_pages/       # GitHub Pages version (static web app)
│   ├── index.html        # Main HTML page (5 pages integrated)
│   ├── css/
│   │   └── style.css     # Stylesheets
│   ├── js/
│   │   ├── config.js     # Configuration
│   │   ├── i18n.js       # Internationalization
│   │   ├── app.js        # Main application logic
│   │   ├── dashboard.js  # Dashboard page
│   │   ├── analytics.js  # Analytics page
│   │   ├── fourkeys.js   # Four Keys page
│   │   └── statistics.js # Statistics & Reports page
│   ├── data/             # JSON data (GitHub Actions auto-generated)
│   │   ├── config.json   # Repository configuration
│   │   ├── prs.json      # PR data
│   │   ├── analytics.json # Analytics data
│   │   ├── fourkeys.json # Four Keys data
│   │   └── cache_info.json # Cache information
│   ├── generate_data.py  # Data generation script
│   └── README.md         # Pages version documentation
│
└── dashboard/            # Streamlit version (local execution)
    ├── app.py            # Main entry point
    ├── pages/
    │   ├── 1_dashboard.py    # PR timeline visualization
    │   ├── 2_analytics.py    # PR statistics analysis (7 tabs)
    │   ├── 3_four_keys.py    # Four Keys metrics (DORA Metrics)
    │   └── 4_statistics.py   # Statistics & Weekly Reports
    ├── fetch_data.py     # Data fetching script
    ├── config.py         # Configuration file
    ├── fetcher.py        # GitHub API calls
    ├── db_cache.py       # SQLite cache management
    ├── action_tracker.py # Action tracking
    └── pr_cache.db       # Cache DB (auto-generated)
```

## Quick Start

### Required Packages

```bash
pip install -r requirements.txt
```

### GitHub Token Setup

```bash
$env:GITHUB_TOKEN="your_token_here"
```

### Initial Setup

```bash
# Fetch data
python dashboard/fetch_data.py --all

# Start dashboard
cd dashboard
streamlit run app.py
```

For detailed documentation, see `dashboard/README.md`.

## Main Features

### Dashboard Features
- **Multi-Repository Support**: Manage multiple repositories centrally
- **PR Timeline**: Visually track PR progress with Gantt charts
- **Documentation/Code Analysis**: PR timeline by directory
- **Action Tracking**: Auto-detect PRs awaiting review/fixes (business day-based)

### Analysis Features (7 Analysis Tabs)
- **Stagnation Analysis**: Distribution of open PR durations
- **Blocker Analysis**: Estimation of reasons for unclosed PRs
- **Reviewer Analysis**: Review activity and comment response status
- **Trend Analysis**: Weekly PR creation trends
- **Bottleneck Analysis**: Details on review/fix delays
- **Review Speed**: Time-to-merge analysis
- **Change Patterns**: File change frequency and PR size

### Four Keys Metrics
- **Deployment Frequency**: Number of deployments per week
- **Lead Time for Changes**: Time from PR creation to merge
- **Change Failure Rate**: Percentage of failed PRs
- **Time to Restore Service**: Mean Time To Recovery (MTTR)

### Statistics & Reports
- **Period Summary**: Total PRs, merge rate, average lead time, active developers
- **Trend Analysis**: 8-week trends for PR creation and average lead time
- **Review Activity**: Total reviews, comments, averages per PR
- **Automated Insights**: Development activity analysis and issue detection
- **Improvement Suggestions**: Concrete action proposals based on data
- **Weekly Report Export**: Markdown-formatted report generation

### Performance
- **Fast Display**: Local cache enables sub-0.1 second display speeds
- **Auto Update**: Periodic data updates via GitHub Actions
- **Rate Limit Protection**: Efficient API calls using ETag/Last-Modified headers

## Four Keys Metrics (DORA Metrics)

Measure software development performance using the four key metrics from DevOps Research and Assessment (DORA).

### The Four Key Metrics

1. **Deployment Frequency**
   - How often code is deployed to production
   - Calculated from the number of merged PRs
   - High-performing teams deploy multiple times per day

2. **Lead Time for Changes**
   - Time from commit to production deployment
   - Measured as average time from PR creation to merge
   - High-performing teams achieve less than one day

3. **Change Failure Rate**
   - Percentage of deployments causing failures or requiring fixes
   - Calculated from the ratio of closed to merged PRs
   - High-performing teams stay below 15%

4. **Time to Restore Service (MTTR)**
   - Time from production incident to recovery
   - Measured by resolution time of issues tagged as hotfix
   - High-performing teams recover in less than one hour

### Performance Levels

Four performance levels based on DORA Metrics:

- **Elite**: Top level across all metrics
- **High**: Excellent in most metrics
- **Medium**: Average performance
- **Low**: Room for improvement

## Statistics & Weekly Reports

Provides comprehensive statistics to understand current development processes and find opportunities for improvement.

### View Modes

**🆕 Now supports historical data viewing!**

Choose from 4 viewing modes:

- **Current Period**: Select from this week, last week, this month, last month, last 30 days, or last 90 days
- **Historical Weekly**: Select from the past 52 weeks (1 year) of weekly data
- **Historical Monthly**: Select from the past 24 months (2 years) of monthly data
- **Historical Yearly**: Select from the past 3 years of annual data

### Key Metrics

- **Period Summary**: Total PRs, merge rate, average lead time, active developers
- **Trend Analysis**: 
  - Current period mode: 8-week trends for PR creation and average lead time
  - Historical weekly: 12-week trends
  - Historical monthly: 12-month trends
  - Historical yearly: All years trends
- **Review Activity**: Total reviews, total comments, averages per PR

### Automatic Historical Data Storage

- Automatically saves historical data during GitHub Actions execution
- Automatically calculates weekly, monthly, and yearly statistics
- Enables long-term trend analysis

### Automated Insights

Automatically generates insights from statistical data:

- Detection of increased/decreased development activity
- Analysis of improved/delayed review speed
- Merge rate evaluation
- Review activity monitoring
- Stale PR warnings

### Improvement Recommendations

Provides specific action items based on current issues:

- Methods to reduce review time
- Fostering review culture
- Strategies to improve PR completion rate
- Promoting team collaboration

### Weekly Report Export

- Export reports in Markdown format
- Summary of key metrics
- Comparison with previous week
- List of improvement recommendations

## Screenshots

### PR Timeline

![PR Timeline](images/dashboard-timeline.png)

Visualize the timeline from PR creation to completion with Gantt charts. View status (OPEN/MERGED), creation time, and duration at a glance.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Bug reports and feature requests are welcome via [Issues](../../issues).
Pull requests are also welcome.
