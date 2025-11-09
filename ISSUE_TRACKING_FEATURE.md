# Issue Tracking & Analytics Feature

## Overview

This document describes the comprehensive Issue tracking and analytics feature added to the GitHub PR Dashboard. This feature addresses the requirements from the original issue to enhance development efficiency through better project management and insights from issue data.

## Features Implemented

### 1. Issue Data Collection

**Backend Components:**
- `fetcher.py`: Added GraphQL query for fetching issue data
- `db_cache.py`: Added SQLite caching for issues
- `fetch_data.py`: Extended to fetch both PRs and Issues
- `generate_data.py`: Generates `issues.json` for the frontend

**Data Collected:**
- Issue number, title, URL, state (OPEN/CLOSED)
- Author, assignees, labels, comments count
- Creation, update, and close timestamps
- Milestone information (title, due date, state)
- Project board information and status
- **Linked PRs** - All PRs connected to each issue
- **Cycle Time** - Time from issue creation to first PR merge
- Age and duration metrics

### 2. Issue Management Dashboard

**New Page:** Issue Management (`page-issues`)

**6 Analysis Tabs:**

#### Tab 1: Overview
- **Metrics Displayed:**
  - Total Issues
  - Open Issues
  - Closed Issues
  - Close Rate (%)
  
- **Visualizations:**
  - Status distribution (Open vs Closed) pie chart
  - Open issue age distribution bar chart (0-7 days, 8-30 days, 31-90 days, 91-180 days, 180+ days)

#### Tab 2: Timeline
- **Gantt Chart Visualization:**
  - Shows latest 50 issues
  - Timeline from creation to closure (or current date if still open)
  - Color-coded by state (green for closed, red for open)
  - Hover information: issue number, title, state, dates, duration

#### Tab 3: Cycle Time Analysis
- **Key Metrics:**
  - Issues with linked PRs
  - Average cycle time (days)
  - Median cycle time (days)
  - Fastest resolution time
  
- **Visualizations:**
  - Scatter plot showing cycle time distribution
  - Table of recent issues with cycle time details
  
- **Definition:** Cycle time measures the time from issue creation to the first linked PR being merged

#### Tab 4: Issue-PR Linking
- **Metrics:**
  - Issues with linked PRs
  - Issues without PRs
  - PR linking rate (%)
  - Average PRs per issue
  
- **Table View:**
  - Lists all issues with their linked PRs
  - Shows PR states (OPEN, MERGED, CLOSED)
  - Clickable links to GitHub

#### Tab 5: Milestone Tracking
- **Visual Cards for each Milestone:**
  - Milestone name and state
  - Due date
  - Progress bar (% complete)
  - Open vs Closed issue counts
  
- **Automatically groups issues by milestone**

#### Tab 6: Team Velocity
- **Metrics:**
  - Average velocity (issues/month)
  - Best month performance
  - Total closed issues
  - Tracking period
  
- **Trend Chart:**
  - Line graph showing issues closed over time
  - Monthly aggregation
  - Helps predict team capacity

## Technical Architecture

### Data Flow

```
1. GitHub API (GraphQL)
   ↓
2. fetcher.py (run_issue_query)
   ↓
3. db_cache.py (SQLite storage)
   ↓
4. generate_data.py (JSON generation)
   ↓
5. issues.json (static file)
   ↓
6. Frontend (issues.js)
   ↓
7. Visualizations (Chart.js, Plotly)
```

### Frontend Components

**Files Modified/Created:**
- `index.html` - Added Issues page with 6 tabs
- `js/issues.js` - New 600+ line module with all visualization logic
- `js/app.js` - Added issues data loading and navigation
- `css/style.css` - Added 300+ lines of styling for issues page
- `js/i18n.js` - Added Japanese/English translations

### Styling

**New CSS Classes:**
- `.metrics-grid` - Responsive grid for metric cards
- `.metric-card` - Individual metric display
- `.chart-container` - Chart wrapper with card styling
- `.data-table` - Styled tables for issue/PR data
- `.badge` - Status badges (open/closed)
- `.milestone-card` - Milestone progress cards
- `.progress-bar` - Visual progress indicator
- `.tab` / `.tab-panel` - Tab navigation system

## Usage Instructions

### Initial Setup

1. **Fetch Issue Data:**
```bash
cd dashboard
python fetch_data.py --all
```

This will fetch both PRs and Issues from configured repositories.

2. **Generate Static Data:**
```bash
cd Dashboard_pages
python generate_data.py
```

This creates `issues.json` in the `data/` directory.

3. **View Dashboard:**
Open `Dashboard_pages/index.html` in a browser, or deploy to GitHub Pages.

### Navigation

1. Click on "Issue管理" (Issue Management) in the sidebar
2. Select any of the 6 tabs to view different analyses
3. Hover over charts for detailed information
4. Click issue/PR numbers to open them on GitHub

### Automation with GitHub Actions

The existing `.github/workflows/deploy-pages.yml` can be extended to automatically fetch issue data:

```yaml
- name: Fetch PR and Issue data
  run: |
    cd dashboard
    python fetch_data.py --all
```

## Key Insights Provided

### Development Velocity
- Track how many issues the team closes per month
- Identify trends in productivity
- Predict capacity for future sprints

### Cycle Time Optimization
- Identify issues that take too long from creation to PR merge
- Optimize workflow by reducing cycle time
- Track improvement over time

### Issue-PR Traceability
- Ensure all issues have associated PRs
- Find orphaned issues without implementation
- Verify work completion

### Milestone Progress
- Visual tracking of milestone completion
- Identify at-risk milestones
- Plan releases based on progress

### Issue Age Management
- Identify stale issues
- Prioritize old open issues
- Maintain healthy issue backlog

## Advanced Metrics

### Cycle Time Calculation
```
Cycle Time = (First Linked PR Merge Time) - (Issue Creation Time)
```

This metric is crucial for measuring:
- **Development efficiency**: How fast can we go from idea to implementation?
- **Process improvement**: Are we getting faster over time?
- **Bottleneck identification**: Which issues take longer and why?

### Team Velocity
```
Velocity = Issues Closed per Time Period (Month)
```

Benefits:
- **Capacity planning**: Predict how much work team can handle
- **Sprint planning**: Set realistic goals
- **Performance tracking**: Monitor team productivity trends

## Best Practices

### 1. Link Issues to PRs
Always reference issue numbers in PR descriptions:
```
Fixes #123
Closes #456
Resolves #789
```

This enables:
- Automatic issue-PR linking
- Accurate cycle time calculation
- Better traceability

### 2. Use Milestones
- Assign issues to milestones
- Set due dates
- Track progress visually

### 3. Use Labels
- Categorize issues (bug, feature, enhancement)
- Filter and analyze by type
- Identify patterns

### 4. Regular Updates
- Run `fetch_data.py --all` daily
- Deploy updated data to GitHub Pages
- Monitor metrics regularly

## Comparison with Existing Features

| Feature | PR Dashboard | Issue Dashboard |
|---------|-------------|-----------------|
| **Timeline** | PR lifecycle | Issue lifecycle |
| **Cycle Time** | PR creation → merge | Issue creation → PR merge |
| **Status Tracking** | OPEN/MERGED/CLOSED | OPEN/CLOSED |
| **Linking** | PRs to files/reviews | Issues to PRs |
| **Velocity** | PRs per week | Issues per month |
| **Progress** | Review status | Milestone progress |

## Future Enhancements

Potential additions in future phases:

### Phase 2: Advanced Metrics
- [ ] Burndown/Burnup charts for milestones
- [ ] Cumulative Flow Diagram (CFD)
- [ ] Work In Progress (WIP) limits
- [ ] Throughput analysis
- [ ] Predictability metrics

### Phase 3: Developer Insights
- [ ] Individual developer velocity
- [ ] Issue assignment patterns
- [ ] Response time metrics
- [ ] Collaboration analysis

### Phase 4: Automation
- [ ] Automated alerts for stale issues
- [ ] SLA tracking and violations
- [ ] Real-time webhook integration
- [ ] AI-powered recommendations

## Troubleshooting

### No Issue Data Displayed
**Problem:** "No issue data available" message

**Solutions:**
1. Check if `issues.json` exists in `Dashboard_pages/data/`
2. Run `python fetch_data.py --all` to fetch data
3. Run `python generate_data.py` to create JSON
4. Verify GitHub token has permission to read issues

### Cycle Time Not Calculated
**Problem:** Cycle time shows as null

**Cause:** Issue has no linked PRs or PRs not merged

**Solution:** 
- Link PRs to issues using keywords in PR description
- Wait for PRs to be merged
- Re-fetch data after PRs are merged

### Empty Milestone Tab
**Problem:** "No issues with milestones found"

**Solution:**
- Create milestones in GitHub
- Assign issues to milestones
- Re-fetch issue data

## Contributing

To extend the Issue tracking features:

1. **Add new metrics** in `js/issues.js`
2. **Add new tabs** in `index.html`
3. **Style components** in `css/style.css`
4. **Add translations** in `js/i18n.js`
5. **Test thoroughly** with real data

## References

- [GitHub GraphQL API - Issues](https://docs.github.com/en/graphql/reference/objects#issue)
- [Cycle Time vs Lead Time](https://www.atlassian.com/agile/kanban/cycle-time)
- [Team Velocity](https://www.atlassian.com/agile/project-management/metrics)
- [DORA Metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)

## License

MIT License - Same as the main project
