# Salesforce Deployer Pro

A high-performance, stateless web tool for comparing, validating, and deploying Salesforce metadata. It runs entirely in the browser using your local Salesforce CLI (`sf`) authentication, ensuring no source code or credentials are ever saved to a server.

- **Fast Compare**: ⚡ Blazing fast comparisons using REST API for Apex and Visualforce.
- **Live Deployment Terminal**: 📻 Real-time feedback with component-by-component statuses, test results, and coverage dashboards.
- **Screenshot Proof**: 📸 Integrated capture utility for deployment outcomes (perfect for JIRA/Slack).
- **Direct Setup Links**: 🔗 Click component names to open them directly in your Salesforce Org Setup.
- **Cherry-picking**: Selectively deploy or validate a subset of files from any comparison.
- **Org Manager**: Automatically syncs with your local Salesforce CLI (`sf`) environments.
- **Dependency Analyzer**: Deep-dive into field/metadata usage before you deploy.
- **Advanced Filtering**: Search, sort, and filter by status (New/Modified) or modification date.
- **Quick Swap**: Instantly swap Source and Target orgs with a single click.

## Getting Started

You can run this tool in three different ways:

### 1. Download Executable (Easiest)
Download the standalone executable and double-click to run.
1. Go to the [Actions tab](../../actions) in this repository.
2. Click on the latest successful `Build Executables` workflow run.
3. Download the artifact for your OS (Windows, Mac, or Linux) at the bottom of the page.

### 2. Run Locally from Source
Run the Python FastAPI server locally using the included scripts.
1. Clone the repository: `git clone https://github.com/gambacloud/sfdc-deploy-tool.git`
2. Run `run.bat` (Windows) or `./run.sh` (Mac/Linux) to automatically install requirements and start the server.
3. Open `http://localhost:8000` in your browser.

### 3. Deploy to Heroku
Deploy your own instance to the cloud (Stateless proxy).
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)
Or via Heroku CLI:
```bash
heroku create sfdc-deployer
git push heroku main
```

> **Security Note**: This tool proxies Salesforce session IDs. If deploying to a cloud server like Heroku, ensure HTTPS is enabled and target instance URLs/session IDs are never logged. When running locally or via executable, communication stays on your machine.
