// Issues Page Logic - Issue Tracking and Analytics

// Load issues data
function loadIssuesData() {
    console.log('Loading issues data...');
    loadIssuesTab('overview');
}

// Load data for a specific tab
function loadIssuesTab(tabName) {
    console.log('Loading issues tab:', tabName);
    
    switch (tabName) {
        case 'overview':
            loadIssuesOverview();
            break;
        case 'timeline':
            loadIssuesTimeline();
            break;
        case 'cycle-time':
            loadCycleTimeAnalysis();
            break;
        case 'issue-pr-link':
            loadIssuePRLinking();
            break;
        case 'milestone':
            loadMilestoneTracking();
            break;
        case 'velocity':
            loadTeamVelocity();
            break;
    }
}

// Overview: Issue status and distribution
function loadIssuesOverview() {
    const container = document.getElementById('issuesOverviewCharts');
    
    if (!appData.issues || appData.issues.length === 0) {
        container.innerHTML = '<div class="no-data">No issue data available. Please run fetch_data.py with issue fetching enabled.</div>';
        return;
    }
    
    const openIssues = appData.issues.filter(issue => issue.state === 'OPEN');
    const closedIssues = appData.issues.filter(issue => issue.state === 'CLOSED');
    
    // Status distribution pie chart
    const statusData = {
        labels: ['Open', 'Closed'],
        datasets: [{
            data: [openIssues.length, closedIssues.length],
            backgroundColor: ['#ff4b4b', '#21c354']
        }]
    };
    
    container.innerHTML = `
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Total Issues</h3>
                <div class="metric-value">${appData.issues.length}</div>
            </div>
            <div class="metric-card">
                <h3>Open Issues</h3>
                <div class="metric-value">${openIssues.length}</div>
            </div>
            <div class="metric-card">
                <h3>Closed Issues</h3>
                <div class="metric-value">${closedIssues.length}</div>
            </div>
            <div class="metric-card">
                <h3>Close Rate</h3>
                <div class="metric-value">${((closedIssues.length / appData.issues.length) * 100).toFixed(1)}%</div>
            </div>
        </div>
        <div class="chart-row">
            <div class="chart-container">
                <canvas id="issueStatusChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="issueAgeChart"></canvas>
            </div>
        </div>
    `;
    
    // Status chart
    const statusCtx = document.getElementById('issueStatusChart');
    new Chart(statusCtx, {
        type: 'doughnut',
        data: statusData,
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Issue Status Distribution'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Age distribution chart
    const now = new Date();
    const ageDistribution = {
        '0-7 days': 0,
        '8-30 days': 0,
        '31-90 days': 0,
        '91-180 days': 0,
        '180+ days': 0
    };
    
    openIssues.forEach(issue => {
        const created = new Date(issue.createdAt);
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        
        if (days <= 7) ageDistribution['0-7 days']++;
        else if (days <= 30) ageDistribution['8-30 days']++;
        else if (days <= 90) ageDistribution['31-90 days']++;
        else if (days <= 180) ageDistribution['91-180 days']++;
        else ageDistribution['180+ days']++;
    });
    
    const ageCtx = document.getElementById('issueAgeChart');
    new Chart(ageCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(ageDistribution),
            datasets: [{
                label: 'Number of Open Issues',
                data: Object.values(ageDistribution),
                backgroundColor: ['#21c354', '#00c0f2', '#ffa421', '#ff8c00', '#dc2626']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Open Issue Age Distribution'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Timeline: Gantt chart for issues
function loadIssuesTimeline() {
    const container = document.getElementById('issuesTimelineChart');
    
    if (!appData.issues || appData.issues.length === 0) {
        container.innerHTML = '<div class="no-data">No issue data available.</div>';
        return;
    }
    
    // Prepare data for Gantt chart
    const issues = appData.issues
        .filter(issue => issue.createdAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 50); // Show latest 50 issues
    
    const traces = issues.map(issue => {
        const start = new Date(issue.createdAt);
        const end = issue.closedAt ? new Date(issue.closedAt) : new Date();
        
        return {
            x: [(end - start) / (1000 * 60 * 60 * 24)], // Duration in days
            y: [`#${issue.number}: ${issue.title.substring(0, 50)}...`],
            base: [start],
            type: 'bar',
            orientation: 'h',
            marker: {
                color: issue.state === 'CLOSED' ? '#21c354' : '#ff4b4b'
            },
            hovertemplate: `<b>#${issue.number}</b><br>${issue.title}<br>` +
                          `State: ${issue.state}<br>` +
                          `Created: ${start.toLocaleDateString()}<br>` +
                          `${issue.closedAt ? 'Closed: ' + end.toLocaleDateString() : 'Still Open'}<br>` +
                          `Duration: %{x:.1f} days<extra></extra>`,
            showlegend: false
        };
    });
    
    const layout = {
        title: 'Issue Timeline (Latest 50 Issues)',
        xaxis: {
            title: 'Duration (days)',
            type: 'linear'
        },
        yaxis: {
            title: 'Issue',
            automargin: true
        },
        height: Math.max(600, issues.length * 25),
        barmode: 'overlay'
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot(container, traces, layout, config);
}

// Cycle Time: Time from issue creation to linked PR merge
function loadCycleTimeAnalysis() {
    const container = document.getElementById('cycleTimeChart');
    
    if (!appData.issues || appData.issues.length === 0) {
        container.innerHTML = '<div class="no-data">No issue data available.</div>';
        return;
    }
    
    // Filter issues with cycle time data
    const issuesWithCycleTime = appData.issues.filter(issue => issue.cycle_time_hours !== null && issue.cycle_time_hours !== undefined);
    
    if (issuesWithCycleTime.length === 0) {
        container.innerHTML = '<div class="no-data">No issues with linked PRs found. Cycle time requires issues to be linked to merged PRs.</div>';
        return;
    }
    
    const cycleTimes = issuesWithCycleTime.map(issue => ({
        number: issue.number,
        title: issue.title,
        cycleTimeDays: issue.cycle_time_hours / 24,
        cycleTimeHours: issue.cycle_time_hours,
        linkedPR: issue.first_merged_pr
    }));
    
    // Calculate statistics
    const avgCycleTime = cycleTimes.reduce((sum, ct) => sum + ct.cycleTimeDays, 0) / cycleTimes.length;
    const medianCycleTime = cycleTimes.map(ct => ct.cycleTimeDays).sort((a, b) => a - b)[Math.floor(cycleTimes.length / 2)];
    
    container.innerHTML = `
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Issues with PRs</h3>
                <div class="metric-value">${issuesWithCycleTime.length}</div>
            </div>
            <div class="metric-card">
                <h3>Average Cycle Time</h3>
                <div class="metric-value">${avgCycleTime.toFixed(1)} days</div>
            </div>
            <div class="metric-card">
                <h3>Median Cycle Time</h3>
                <div class="metric-value">${medianCycleTime.toFixed(1)} days</div>
            </div>
            <div class="metric-card">
                <h3>Fastest Resolution</h3>
                <div class="metric-value">${Math.min(...cycleTimes.map(ct => ct.cycleTimeDays)).toFixed(1)} days</div>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="cycleTimeDistChart"></canvas>
        </div>
        <div class="cycle-time-list">
            <h3>Recent Issues with Cycle Time</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Issue</th>
                        <th>Title</th>
                        <th>Linked PR</th>
                        <th>Cycle Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${cycleTimes.slice(0, 20).map(ct => `
                        <tr>
                            <td>#${ct.number}</td>
                            <td>${ct.title.substring(0, 60)}...</td>
                            <td>#${ct.linkedPR}</td>
                            <td>${ct.cycleTimeDays.toFixed(1)} days</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Distribution chart
    const ctx = document.getElementById('cycleTimeDistChart');
    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Cycle Time per Issue',
                data: cycleTimes.map((ct, idx) => ({ x: idx, y: ct.cycleTimeDays })),
                backgroundColor: '#3b82f6',
                borderColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Cycle Time Distribution'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Issue Index'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Cycle Time (days)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Issue-PR Linking: Show which issues are linked to PRs
function loadIssuePRLinking() {
    const container = document.getElementById('issuePRLinkChart');
    
    if (!appData.issues || appData.issues.length === 0) {
        container.innerHTML = '<div class="no-data">No issue data available.</div>';
        return;
    }
    
    const issuesWithPRs = appData.issues.filter(issue => issue.linked_pr_count > 0);
    const issuesWithoutPRs = appData.issues.filter(issue => issue.linked_pr_count === 0);
    
    container.innerHTML = `
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Issues with Linked PRs</h3>
                <div class="metric-value">${issuesWithPRs.length}</div>
            </div>
            <div class="metric-card">
                <h3>Issues without PRs</h3>
                <div class="metric-value">${issuesWithoutPRs.length}</div>
            </div>
            <div class="metric-card">
                <h3>PR Linking Rate</h3>
                <div class="metric-value">${((issuesWithPRs.length / appData.issues.length) * 100).toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <h3>Avg PRs per Issue</h3>
                <div class="metric-value">${(issuesWithPRs.reduce((sum, i) => sum + i.linked_pr_count, 0) / issuesWithPRs.length).toFixed(1)}</div>
            </div>
        </div>
        <div class="issue-pr-list">
            <h3>Issues with Linked PRs</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Issue</th>
                        <th>Title</th>
                        <th>State</th>
                        <th>Linked PRs</th>
                        <th>PR Details</th>
                    </tr>
                </thead>
                <tbody>
                    ${issuesWithPRs.slice(0, 30).map(issue => `
                        <tr>
                            <td><a href="${issue.url}" target="_blank">#${issue.number}</a></td>
                            <td>${issue.title.substring(0, 50)}...</td>
                            <td><span class="badge badge-${issue.state.toLowerCase()}">${issue.state}</span></td>
                            <td>${issue.linked_pr_count}</td>
                            <td>
                                ${issue.linked_prs.slice(0, 3).map(pr => 
                                    `<a href="${pr.url}" target="_blank" title="${pr.title}">#${pr.number} (${pr.state})</a>`
                                ).join(', ')}
                                ${issue.linked_prs.length > 3 ? '...' : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Milestone Tracking: Show milestone progress
function loadMilestoneTracking() {
    const container = document.getElementById('milestoneChart');
    
    if (!appData.issues || appData.issues.length === 0) {
        container.innerHTML = '<div class="no-data">No issue data available.</div>';
        return;
    }
    
    const issuesWithMilestone = appData.issues.filter(issue => issue.milestone);
    
    if (issuesWithMilestone.length === 0) {
        container.innerHTML = '<div class="no-data">No issues with milestones found.</div>';
        return;
    }
    
    // Group by milestone
    const milestones = {};
    issuesWithMilestone.forEach(issue => {
        const milestoneName = issue.milestone.title;
        if (!milestones[milestoneName]) {
            milestones[milestoneName] = {
                name: milestoneName,
                dueOn: issue.milestone.dueOn,
                state: issue.milestone.state,
                totalIssues: 0,
                openIssues: 0,
                closedIssues: 0
            };
        }
        milestones[milestoneName].totalIssues++;
        if (issue.state === 'OPEN') {
            milestones[milestoneName].openIssues++;
        } else {
            milestones[milestoneName].closedIssues++;
        }
    });
    
    const milestoneList = Object.values(milestones);
    
    container.innerHTML = `
        <div class="milestone-grid">
            ${milestoneList.map(milestone => {
                const progress = (milestone.closedIssues / milestone.totalIssues) * 100;
                const dueDate = milestone.dueOn ? new Date(milestone.dueOn).toLocaleDateString() : 'No due date';
                return `
                    <div class="milestone-card">
                        <h3>${milestone.name}</h3>
                        <div class="milestone-info">
                            <span class="badge badge-${milestone.state.toLowerCase()}">${milestone.state}</span>
                            <span>Due: ${dueDate}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="milestone-stats">
                            <span>${milestone.closedIssues}/${milestone.totalIssues} closed (${progress.toFixed(0)}%)</span>
                            <span>${milestone.openIssues} open</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Team Velocity: Issues closed per week
function loadTeamVelocity() {
    const container = document.getElementById('velocityChart');
    
    if (!appData.issues || appData.issues.length === 0) {
        container.innerHTML = '<div class="no-data">No issue data available.</div>';
        return;
    }
    
    const closedIssues = appData.issues.filter(issue => issue.closedAt);
    
    if (closedIssues.length === 0) {
        container.innerHTML = '<div class="no-data">No closed issues found.</div>';
        return;
    }
    
    // Group by week
    const weeklyData = {};
    closedIssues.forEach(issue => {
        const closedDate = new Date(issue.closedAt);
        const weekKey = closedDate.toISOString().slice(0, 10).substring(0, 7); // YYYY-MM format
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = 0;
        }
        weeklyData[weekKey]++;
    });
    
    const sortedWeeks = Object.keys(weeklyData).sort();
    const velocityData = sortedWeeks.map(week => weeklyData[week]);
    
    const avgVelocity = velocityData.reduce((sum, v) => sum + v, 0) / velocityData.length;
    
    container.innerHTML = `
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Average Velocity</h3>
                <div class="metric-value">${avgVelocity.toFixed(1)} issues/month</div>
            </div>
            <div class="metric-card">
                <h3>Best Month</h3>
                <div class="metric-value">${Math.max(...velocityData)} issues</div>
            </div>
            <div class="metric-card">
                <h3>Total Closed</h3>
                <div class="metric-value">${closedIssues.length} issues</div>
            </div>
            <div class="metric-card">
                <h3>Tracking Period</h3>
                <div class="metric-value">${sortedWeeks.length} months</div>
            </div>
        </div>
        <div class="chart-container">
            <canvas id="velocityLineChart"></canvas>
        </div>
    `;
    
    const ctx = document.getElementById('velocityLineChart');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedWeeks,
            datasets: [{
                label: 'Issues Closed',
                data: velocityData,
                borderColor: '#21c354',
                backgroundColor: 'rgba(33, 195, 84, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Team Velocity - Issues Closed Over Time'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Issues Closed'
                    }
                }
            }
        }
    });
}
