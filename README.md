# Salesforce Deployer Pro

A high-performance, stateless web tool for comparing, validating, and deploying Salesforce metadata. It runs entirely in the browser using your local Salesforce CLI (`sf`) authentication, ensuring no source code or credentials are ever saved to a server.

## Features

- **Direct Deployment**: Deploy metadata easily between two orgs.
- **Cherry-picking**: Selectively deploy a subset of files from the fetched package.
- **Validation (Check-Only)**: Simulate deployments and test runs without making actual changes.
- **Custom Testing**: Choose specific test levels (e.g., `RunLocalTests`, `RunSpecifiedTests`).
- **Org Manager**: Automatically syncs and uses your existing local Salesforce CLI (`sf`) environments.
- **Dependency Analyzer**: Check custom field/metadata usage and open them directly in Salesforce Setup.
- **Advanced Filtering & Sorting**: Quickly search components, filter by deployment status (New/Modified), or show only selected items. Sort by any column.
- **Last Modified Data**: See who last modified a component and when directly in the diff table.
- **Quick Swap**: Instantly swap Source and Target org credentials with a single click.

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
