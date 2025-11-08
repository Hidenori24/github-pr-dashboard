# Configuration Example for GitHub PR Dashboard
# Copy this file to ../dashboard/config.py and customize it

# --- Repository Configuration ---
# Add all repositories you want to monitor
REPOSITORIES = [
    {
        "name": "Main Project",        # Display name for the dashboard
        "owner": "your-organization",  # GitHub owner/organization name
        "repo": "your-repository"      # Repository name
    },
    {
        "name": "Backend API",
        "owner": "your-organization",
        "repo": "backend-api"
    },
    {
        "name": "Frontend App",
        "owner": "your-organization",
        "repo": "frontend-app"
    },
    # Add more repositories as needed
]

# --- Default Settings ---
DEFAULT_OWNER = REPOSITORIES[0]["owner"] if REPOSITORIES else "your-organization"
DEFAULT_REPO  = REPOSITORIES[0]["repo"] if REPOSITORIES else "your-repository"
DEFAULT_DAYS  = 180                                # Default time period (days)
DEFAULT_STATE = ["OPEN","MERGED"]                  # Default state filters
DEFAULT_GANTT_STATES = ["OPEN","MERGED"]           # Timeline initial display states
DEFAULT_GANTT_TOP_N = 30                           # Number of PRs to show in timeline
DEFAULT_GANTT_COLOR_MODE = "state（状態）"          # Timeline color mode
DEFAULT_GROUPING = "ディレクトリ（階層）"           # Initial grouping for directory view
DEFAULT_DIR_DEPTH = 2                              # Directory hierarchy depth
DEFAULT_SHOW_ONLY_OPEN_GROUPS = False              # Show only OPEN groups initially

# --- GitHub Enterprise Configuration ---
# Only set this if you're using GitHub Enterprise Server
# Leave empty for github.com
# Example: "https://github.your-company.com/api/graphql"
GITHUB_API_URL = ""   # Or use environment variable GITHUB_API_URL

# --- GitHub Pages Specific Settings ---
# These are used by the GitHub Pages version
PAGES_CONFIG = {
    # Base path for GitHub Pages deployment
    # Leave as "/" for root deployment
    # Set to "/repository-name/" if deploying to a project page
    "basePath": "/",
    
    # Enable/disable features
    "features": {
        "timeline": True,       # PR timeline visualization
        "analytics": True,      # Analytics page
        "fourkeys": False,      # Four Keys (under development)
        "multiRepo": True       # Multi-repository support
    },
    
    # UI Customization
    "ui": {
        "theme": "light",       # Theme: "light" or "dark"
        "language": "ja",       # Language: "ja" or "en"
        "defaultPage": "home"   # Default page on load
    }
}

# --- Data Fetching Configuration ---
FETCH_CONFIG = {
    # Number of days of data to fetch
    "days": 365,
    
    # Enable ETag caching for efficient API usage
    "useETag": True,
    
    # Maximum number of PRs to fetch per repository
    "maxPRs": 1000,
    
    # Fetch timeout (seconds)
    "timeout": 300
}

# --- Analytics Configuration ---
ANALYTICS_CONFIG = {
    # Business days calculation
    # 0 = Monday, 6 = Sunday
    "businessDays": [0, 1, 2, 3, 4],  # Monday to Friday
    
    # Working hours (24-hour format)
    "workingHours": {
        "start": 9,   # 9 AM
        "end": 18     # 6 PM
    },
    
    # Thresholds for alerts
    "thresholds": {
        "staleHours": 72,           # PRs waiting > 72 hours
        "reviewTimeHours": 24,      # Expected review time
        "criticalAgeHours": 168     # Critical age (1 week)
    }
}

# --- Export Configuration ---
# These settings are used when generating static data for GitHub Pages
EXPORT_CONFIG = {
    # Output directory for JSON files
    "outputDir": "Dashboard_pages/data",
    
    # Compression
    "compress": True,  # Minify JSON
    
    # Include debug information
    "debug": False
}
