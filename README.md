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
- 🧠 **Metadata Knowledge Base** — Drag in a metadata ZIP, get an LLM-ready Markdown doc for NotebookLM (see below)

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
| Metadata Knowledge Base 🧠 | Drag a metadata ZIP into `/metadata-kb` → get a Markdown knowledge base for NotebookLM |

## Metadata Knowledge Base

`/metadata-kb` is a standalone page: drag in a Salesforce Metadata API ZIP (objects, formulas, flows, Apex classes/triggers, LWC, Aura, profiles) and it parses everything **entirely in your browser** (a Web Worker + [JSZip](https://stuk.github.io/jszip/) + [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — nothing is uploaded). You get a Markdown document — with a **Download** button and a **Copy to Clipboard** button — ready to paste into [NotebookLM](https://notebooklm.google.com) or any other LLM as a knowledge source.

The parsing logic is adapted from [`sfdc-metadata-visualizer`](https://github.com/gambacloud/sfdc-metadata-visualizer)'s `parser/parsers/*.js`, vendored into `static/metadata-kb-parsers.js` as dependency-free browser JS (plus a new Profile permissions parser not in that repo).
