# Documentation

This directory contains the MkDocs documentation for Jodit Connector Node.js.

## Structure

```
docs/
├── content/              # Documentation source files
│   ├── index.md         # Main documentation page
│   ├── authentication.md # Authentication guide
│   ├── config.md        # Configuration reference
│   ├── storage-adapters.md # Storage adapters guide
│   └── deployment.md    # Deployment guide
├── mkdocs.yml           # MkDocs configuration
├── requirements.txt     # Python dependencies
└── .venv/               # Python virtual environment (gitignored)
```

## Setup

1. Create a Python virtual environment:
```bash
cd docs
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Development

Serve documentation locally with hot reload:
```bash
mkdocs serve
```

Then open http://127.0.0.1:8000 in your browser.

## Build

Build static documentation:
```bash
mkdocs build
```

Output will be in `../site/` directory.

## Deploy

Documentation is automatically deployed to GitHub Pages via GitHub Actions workflow `.github/workflows/docs.yml`.

Manual deployment (if needed):
```bash
mkdocs gh-deploy
```

## Technology Stack

- **MkDocs** - Static site generator
- **Material for MkDocs** - Material Design theme
- **PyMdown Extensions** - Markdown extensions (code highlighting, admonitions, etc.)
- **Awesome Pages Plugin** - Enhanced navigation
