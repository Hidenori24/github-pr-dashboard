# GitHub PR Dashboard

A Streamlit-based dashboard for visualizing and analyzing GitHub Pull Requests

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)

[日本語](README.md) | English

Visualize PR status, review progress, and bottlenecks intuitively to improve your development team's productivity.

## Key Features

- **Multi-Repository Support**: Manage multiple repositories in one place
- **PR Timeline**: Visualize PR progress with Gantt charts
- **Bottleneck Analysis**: Auto-detect PRs waiting for review or fixes (based on business days)
- **Reviewer Analysis**: Identify who is not responding to reviews
- **Comment Thread Analysis**: Track the flow from feedback → response → resolution
- **High-Speed Display**: Display in less than 0.1 seconds with local caching

## Directory Structure

```
dashboard/
├── app.py                # Main entry point
├── pages/
│   ├── 1_dashboard.py    # PR timeline visualization
│   ├── 2_analytics.py    # PR statistics analysis
│   └── 3_four_keys.py    # Four Keys metrics
├── fetch_data.py         # Data fetching script
├── config.py             # Configuration file
├── fetcher.py            # GitHub API calls
├── db_cache.py           # SQLite cache management
├── action_tracker.py     # Action tracking
└── pr_cache.db           # Cache DB (auto-generated)
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

(To be added)

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Bug reports and feature requests are welcome via [Issues](../../issues).
Pull requests are also welcome.
