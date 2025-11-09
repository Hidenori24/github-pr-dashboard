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
│   ├── index.html        # Main HTML page
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript logic
│   ├── data/             # JSON data (auto-generated)
│   ├── generate_data.py  # Data generation script
│   └── README.md         # Pages version documentation
│
└── dashboard/            # Streamlit version (local execution)
    ├── app.py            # Main entry point
    ├── pages/
    │   ├── 1_dashboard.py    # PR timeline visualization
    │   ├── 2_analytics.py    # PR statistics analysis
    │   └── 3_four_keys.py    # Four Keys metrics
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

- **Multi-Repository Support**: Manage multiple repositories centrally
- **PR Timeline**: Visually track PR progress with Gantt charts
- **Bottleneck Analysis**: Auto-detect PRs awaiting review/fixes (business day-based)
- **Reviewer Analysis**: Identify non-responsive reviewers
- **Comment Thread Analysis**: Track feedback → response → resolution flow
- **Fast Display**: Local cache enables sub-0.1 second display speeds

## Screenshots

### PR Timeline

![PR Timeline](images/dashboard-timeline.png)

Visualize the timeline from PR creation to completion with Gantt charts. View status (OPEN/MERGED), creation time, and duration at a glance.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Bug reports and feature requests are welcome via [Issues](../../issues).
Pull requests are also welcome.
