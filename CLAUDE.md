# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Docusaurus-based technical documentation site** titled "남키 노트" (Namgi Notes), focused on penetration testing and red team technical notes. The site is deployed to GitHub Pages at `https://naaamgi.github.io/my-docusaurus-page/`.

### Key Characteristics
- **Framework**: Docusaurus 3.9.1
- **Deployment**: GitHub Pages (gh-pages branch)
- **Package Manager**: Yarn (or npm)
- **Node Version**: >= 20.0
- **Primary Language**: Korean with English technical terms
- **Search**: Algolia DocSearch integration

---

## Common Commands

### Development

```bash
# Install dependencies
yarn

# Start local development server (hot reload)
yarn start

# Build static site for production
yarn build

# Serve built site locally
yarn serve

# Clear Docusaurus cache
yarn clear
```

### Deployment

```bash
# Deploy to GitHub Pages (with SSH)
USE_SSH=true yarn deploy

# Deploy to GitHub Pages (without SSH)
GIT_USER=<username> yarn deploy
```

---

## Documentation Architecture

### Site Configuration

**Key Config File**: `docusaurus.config.js`

Important settings:
- **Route Base Path**: `/` (docs served at root, not `/docs`)
- **Blog**: Disabled (external link to `https://naaamgi.github.io/`)
- **Base URL**: `/my-docusaurus-page/`
- **Organization**: `naaamgi`
- **Project**: `my-docusaurus-page`

### Content Structure

```
docs/
├── index.md                    # Landing page (intro)
├── cheatsheet/                 # Cheatsheet documents
├── penetration/                # Penetration testing guides
└── redteam/                    # Red team documentation
    ├── _category_.json
    ├── 외부정찰_초기침투_치트시트.md
    └── 인프라구축_단계별가이드.md
```

**Sidebar Configuration**: Auto-generated from file structure (`sidebars.js`)

---

## Document Front Matter

All Docusaurus markdown files should include front matter:

```yaml
---
sidebar_position: 1
title: Document Title
description: Brief description
keywords: [keyword1, keyword2, keyword3]
draft: false
---
```

**Important**:
- `sidebar_position`: Controls order in sidebar (lower number = higher position)
- `draft: false`: Published documents (true = hidden in production)
- `keywords`: Used for SEO and Algolia search

---

## Writing Documentation Guidelines

### Document Style
1. **Target Audience**: Red team practitioners, penetration testers
2. **Format**: Cheatsheet-style (command-focused, minimal prose)
3. **Language**: Korean explanations with English technical terms
4. **Code Blocks**: Always include language identifier (```bash, ```python, etc.)

### Content Organization
- Use tables for configuration options, tool comparisons
- Include "빠른 명령어 참조" (Quick Command Reference) sections
- Add "트러블슈팅 체크리스트" (Troubleshooting Checklist) at the end
- Provide GitHub links and official documentation references

### Example Structure
```markdown
---
sidebar_position: 3
title: Tool Cheatsheet
description: Quick reference for tool usage
keywords: [tool, redteam, commands]
---

# Tool Cheatsheet

> Brief description

## 도구 목록 (Tool List)

| Tool | Purpose | Installation |
|------|---------|-------------|
| ... | ... | ... |

## 1. Category Name

### Command Name

```bash
command -option value
```

**출력 예시** (Example Output):
```
expected output
```

## 빠른 명령어 참조 (Quick Reference)

### Category 1
```bash
command1
command2
```

## 트러블슈팅 체크리스트

### Issue 1
- [ ] Check item 1
- [ ] Check item 2
```

---

## Search Integration

### Algolia DocSearch
- **App ID**: `IKHBXIBECM`
- **Index Name**: `namgi-notes`
- **Config**: `docusaurus.config.js` lines 132-139

To trigger re-indexing:
1. Push changes to main branch
2. Algolia crawler runs automatically (configured separately)

---

## Deployment Workflow

1. **Edit Content**: Modify files in `docs/` directory
2. **Test Locally**: `yarn start`
3. **Build**: `yarn build` (creates `build/` directory)
4. **Deploy**: `yarn deploy` (pushes to gh-pages branch)

**GitHub Pages Settings**:
- Source: `gh-pages` branch
- Path: `/` (root)
- Custom domain: Not configured

---

## Content Categories

### Red Team (`docs/redteam/`)
Focus on offensive security operations:
- Infrastructure setup guides
- Tool cheatsheets (bbot, IP2Provider, AWS CLI, etc.)
- OPSEC techniques
- External reconnaissance and initial access

### Penetration Testing (`docs/penetration/`)
General pentesting resources

### Cheatsheets (`docs/cheatsheet/`)
Quick reference guides for various tools and techniques

---

## Important Notes

### URL Structure
- Root path is `/` (not `/docs`) due to `routeBasePath: '/'` setting
- External blog link redirects to `https://naaamgi.github.io/`
- All internal doc links should use relative paths

### File Naming
- Use Korean descriptive names: `외부정찰_초기침투_치트시트.md`
- Underscores separate major topics
- Include category prefix if applicable

### Build Artifacts
- `build/`: Generated static files (gitignored)
- `.docusaurus/`: Cache directory (gitignored)
- `node_modules/`: Dependencies (gitignored)

---

## Troubleshooting

### Build Fails
1. Clear cache: `yarn clear`
2. Delete `node_modules` and reinstall: `rm -rf node_modules && yarn`
3. Check Node version: `node --version` (must be >= 20.0)

### Search Not Working
1. Verify Algolia configuration in `docusaurus.config.js`
2. Check index name matches Algolia dashboard
3. Wait for crawler to re-index (may take hours)

### Deployment Fails
1. Verify `organizationName` and `projectName` in config
2. Check GitHub Pages settings in repository
3. Ensure `gh-pages` branch exists and is not protected

---

## Related Resources

- Docusaurus Docs: https://docusaurus.io/docs
- Algolia DocSearch: https://docsearch.algolia.com/
- GitHub Pages: https://pages.github.com/
