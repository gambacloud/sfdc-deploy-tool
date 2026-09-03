# Salesforce Deployer Pro

Compare, validate, and deploy Salesforce metadata between orgs. No code leaves your machine.

## ✨ Highlights

- ⚡ **Fast Compare** — Instant side-by-side diff between any two orgs
- 📻 **Live Deploy Terminal** — Real-time progress with test results and coverage
- 🧪 **Test Class Picker** — Auto-detects test classes, one-click selection
- 🕐 **Audit Trail** — See who changed what, per component, per org
- 📜 **Deployment History** — Browse past deployments and re-view diffs
- 🔬 **Coverage Viewer** — Line-level test coverage overlay with copyable report
- 🔍 **Dependency Analyzer** — Check what depends on a component before you touch it

## Getting Started

### 1. Download Executable (Easiest)
1. Go to the [Actions tab](../../actions) → latest `Build Executables` run
2. Download for your OS (Windows, Mac, Linux)

### 2. Run from Source
```bash
git clone https://github.com/gambacloud/sfdc-deploy-tool.git
cd sfdc-deploy-tool
run.bat          # Windows
./run.sh         # Mac/Linux
```
Open `http://localhost:8000`

### 3. Deploy to Heroku
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

> **Security**: Session IDs are proxied but never stored. When running locally, everything stays on your machine.

---

## All Features

| Feature | What it does |
|---------|-------------|
| Org Compare | Side-by-side metadata diff between any two orgs |
| Fast Compare ⚡ | Skips Metadata API for Apex — much faster |
| Cherry-Pick Deploy | Select individual files to validate or deploy |
| Live Terminal | Component-by-component deploy progress |
| Coverage Dashboard | Per-class Apex test coverage during deployment |
| Coverage Viewer 🔬 | Line-level coverage overlay on diffs + copyable report |
| Test Class Picker 🧪 | Pick test classes from a searchable list |
| Audit Trail 🕐 | Per-component change history (Source + Target) |
| Deployment History | Re-view past diffs |
| Ignore Whitespace | Toggle to ignore trailing spaces in diffs |
| Managed Package Filter | Auto-hides managed package components |
| Dependency Analyzer | Find what references a component |
| Org Manager | Syncs with your local `sf` CLI environments |
| Setup Links | Click a component → opens in Salesforce Setup |
| Screenshot Proof 📸 | One-click capture to clipboard |
| Quick Swap | Swap Source ↔ Target instantly |
| Filtering & Sorting | Search, sort columns, filter by status |
| Manifest Builder | Visual metadata type picker with presets |
| Dark Mode | Full dark theme |

## Related tools

- [salesforce-debugtool](https://github.com/gambacloud/salesforce-debugtool) — manage, review, and analyze Salesforce debug logs
- [sfdc-flow-tool](https://github.com/gambacloud/sfdc-flow-tool) — describe a Salesforce flow in plain language and build it
- [sfdc-log-analyzer](https://github.com/gambacloud/sfdc-log-analyzer) — Salesforce debug log analyzer
