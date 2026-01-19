# Uncharted

A CSS-based chart plugin for Eleventy. Renders charts as pure HTML/CSS with no JavaScript dependencies.

## Installation

```bash
npm install eleventy-plugin-uncharted
```

## Setup

```javascript
// eleventy.config.js
import uncharted from 'eleventy-plugin-uncharted';

export default function(eleventyConfig) {
  eleventyConfig.addPlugin(uncharted);
}
```

That's it! The plugin automatically copies the CSS to your output directory and injects the stylesheet link into pages that contain charts.

### Options

```javascript
eleventyConfig.addPlugin(uncharted, {
  dataDir: '_data',              // where to find CSV files (default: '_data')
  animate: true,                 // enable animations globally (default: false)
  cssPath: '/css/uncharted.css', // output path for stylesheet (default: '/css/uncharted.css')
  injectCss: false               // disable automatic CSS handling (default: true)
});
```

If you set `injectCss: false`, you'll need to manually include the stylesheet in your layout:

```html
<link rel="stylesheet" href="/css/uncharted.css">
```

## Chart Types

| Type | Description | Negative Values |
|------|-------------|-----------------|
| `donut` | Pie/donut chart using conic-gradient | No |
| `stacked-bar` | Horizontal bars with stacked segments | No |
| `stacked-column` | Vertical columns with stacked segments | Yes |
| `dot` | Categorical dot chart with Y-axis positioning | Yes |
| `scatter` | XY scatter plot with continuous axes | Yes (X and Y) |

## Value Formatting

Format displayed numbers with thousands separators, compact notation, or currency symbols.
Raw values are preserved for calculations; only display output is affected.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `thousands` | boolean | Add commas: `1000` → `1,000` |
| `compact` | boolean | Use suffixes: `1000` → `1K`, `1000000` → `1M` |
| `decimals` | number | Decimal places (default: 0, or 1 if compact) |
| `currency.symbol` | string | Currency symbol: `$`, `€`, etc. |
| `currency.position` | string | `prefix` (default) or `suffix` |

### Examples

**Thousands separators:**

```yaml
format:
  thousands: true
# 1234567 → 1,234,567
```

**Compact notation:**

```yaml
format:
  compact: true
# 1500 → 1.5K, 2000000 → 2M
```

**Currency:**

```yaml
format:
  thousands: true
  currency:
    symbol: "$"
# 1234 → $1,234
```

**Scatter charts** support separate X/Y formatting:

```yaml
format:
  x:
    thousands: true
  y:
    compact: true
    currency:
      symbol: "$"
```

## Usage

### Page Frontmatter

Define charts in your page's frontmatter and reference them with the `chart` shortcode:

```markdown
---
charts:
  growth:
    type: stacked-bar
    title: Platform Growth
    subtitle: Models by domain
    max: 25
    file: charts/platform-growth.csv
---

{% chart "growth" %}
```

### Global Data Files

Define charts in `_data/charts.json` or `_data/charts.yaml`:

```json
{
  "releases": {
    "type": "stacked-column",
    "title": "Release Cadence",
    "file": "charts/releases.csv",
    "legend": ["Production", "Hotfix", "Beta"]
  }
}
```

```markdown
{% chart "releases" %}
```

### Inline Data

Embed data directly in frontmatter:

```yaml
charts:
  issues:
    type: donut
    title: Issue Types
    center:
      value: total
      label: Issues
    data:
      - label: Features
        value: 33
      - label: Bugs
        value: 21
      - label: Other
        value: 4
```

## CSV Format

CSV files use the first column as labels and subsequent columns as data series. The column names can be anything descriptive:

```csv
department,existing,new
Finance,11,11
Sales,16,2
Core,8,0
```

For scatter plots, columns are positional: point label, X value, Y value, and optionally series. Column names become axis labels by default:

```csv
country,population,gdp,region
USA,330,21,Americas
China,1400,14,Asia
Germany,83,4,Europe
```

This displays "population" as the X-axis title and "gdp" as the Y-axis title. Override with explicit titles:

```yaml
charts:
  my-scatter:
    type: scatter
    file: charts/data.csv
    titleX: "Population (millions)"
    titleY: "GDP (trillions)"
```

## Negative Values

Stacked column, dot, and scatter charts support negative values. When negative values are present, a zero axis line appears automatically and values are positioned relative to it.

For stacked columns, positive values stack upward from zero and negative values stack downward:

```csv
quarter,Cost,Profit
Q1,20,10
Q2,25,-10
Q3,15,25
Q4,30,-10
```

The chart automatically calculates the range from the maximum positive stack to the minimum negative stack, ensuring proper scaling.

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `type` | string | Chart type (required) |
| `title` | string | Chart title |
| `subtitle` | string | Subtitle below title |
| `file` | string | Path to CSV file (relative to dataDir) |
| `data` | array | Inline data array |
| `max` | number | Maximum Y value for scaling |
| `min` | number | Minimum Y value for scaling (column, dot) |
| `maxX` | number | Maximum X value (scatter only) |
| `maxY` | number | Maximum Y value (scatter only) |
| `minX` | number | Minimum X value (scatter only) |
| `minY` | number | Minimum Y value (scatter only) |
| `titleX` | string | X-axis title (scatter only, defaults to column name) |
| `titleY` | string | Y-axis title (scatter only, defaults to column name) |
| `legend` | array | Custom legend labels |
| `center` | object | Donut center content (`value`, `label`) |
| `animate` | boolean | Override global animation setting |
| `format` | object | Number formatting options (see Value Formatting) |

## Styling

### CSS Custom Properties

Override the default color palette:

```css
:root {
  --chart-color-1: #2196f3;
  --chart-color-2: #4caf50;
  --chart-color-3: #ffc107;
  --chart-color-4: #ff7043;
  --chart-color-5: #9c27b0;
  --chart-color-6: #e91e63;
  --chart-color-7: #009688;
  --chart-color-8: #78909c;
  --chart-bg: rgba(128, 128, 128, 0.15);
}
```

### Dual Class System

Each chart element gets two classes for styling flexibility:

1. **Ordinal**: `.chart-color-1`, `.chart-color-2`, etc.
2. **Semantic**: `.chart-series-{slugified-name}`

```css
/* Style by position */
.chart-color-1 { --color: #ff6b6b; }

/* Style by series name */
.chart-series-production { --color: #51cf66; }
```

## Animations

Animations are CSS-based with staggered reveals. Enable globally or per-chart:

```javascript
// Global
eleventyConfig.addPlugin(uncharted, { animate: true });
```

```yaml
# Per-chart override
charts:
  static-chart:
    type: donut
    animate: false
```

For scroll-triggered animations, add your own Intersection Observer to toggle the `.chart-animate` class.

## License

MIT
