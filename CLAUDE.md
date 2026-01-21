# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uncharted is an Eleventy plugin that renders CSS-based charts from CSV data using shortcodes. Charts are pure HTML/CSS with no JavaScript dependencies.

## Development Commands

```bash
# Run the test site (from project root)
cd test && npx @11ty/eleventy --serve

# View test page at http://localhost:8080
```

## Architecture

**Plugin entry point**: `eleventy.config.js` registers the `{% chart "id" %}` shortcode. It resolves chart config from page frontmatter or global data (`_data/charts.json`), loads CSV data if specified, and delegates to the appropriate renderer.

**Renderers** (`src/renderers/`): Each chart type has its own renderer that returns an HTML string:
- `donut.js` - Conic-gradient pie/donut charts
- `stacked-bar.js` - Horizontal stacked bars
- `stacked-column.js` - Vertical stacked columns
- `dot.js` - Categorical dot charts (columns with Y-positioned dots)
- `scatter.js` - XY scatter plots with continuous axes

**Data loading** (`src/csv.js`): Simple CSV parser that converts files to arrays of objects. First column becomes `label`, subsequent columns become series keys.

**Utilities** (`src/utils.js`): Shared helpers for slugifying names, calculating percentages, extracting series names, and HTML escaping.

**Styles** (`css/uncharted.css`): All chart styling including:
- CSS custom properties for colors (`--chart-color-1` through `--chart-color-8`)
- Dual class system: ordinal (`.chart-color-N`) and semantic (`.chart-series-{name}`)
- Optional animations triggered by `.chart-animate` class

## CSS Patterns

Charts use `--value` CSS custom property for positioning/sizing elements. Animations reference wrapped project patterns with specific timings:
- Bar: 1s, 0.08s stagger
- Column: 0.6s, 0.05s stagger
- Dot/Scatter: 0.8s, 0.08s stagger
- Donut: 0.8s clockwise reveal using `@property`

## Documentation

- Docs site: https://uncharted.docs.seanlunsford.com/
- Docs repo: https://github.com/seanlunsford/uncharted-docs

## Test Site

The `test/` directory contains a complete Eleventy site for testing all chart types. It has its own `eleventy.config.js` that imports the plugin from the parent directory.

## Publishing

The package is published to npm automatically via GitHub Actions when a version tag is pushed. The workflow (`.github/workflows/publish.yml`) uses OIDC trusted publishing—no npm token secret is needed. The trusted publisher is configured on npmjs.com to allow publishes from the `slunsford/uncharted` repository's `publish.yml` workflow.

To release a new version:
1. Update version with `npm version patch|minor|major` (creates commit and tag)
2. Push with tags: `git push && git push --tags`
3. Create a GitHub release from the tag (optional, for release notes)
