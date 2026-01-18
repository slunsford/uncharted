# Uncharted

A CSS-based charting plugin for Eleventy. Renders charts as pure HTML/CSS with no JavaScript dependencies.

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

CSV files use the first column as labels and subsequent columns as data series:

```csv
label,existing,new
Finance,11,11
Sales,16,2
Core,8,0
```

For scatter plots, use `label`, `x`, `y`, and optionally `series`:

```csv
label,x,y,series
Point A,10,45,alpha
Point B,25,78,alpha
Point C,15,32,beta
```

## Negative Values

Stacked column, dot, and scatter charts support negative values. When negative values are present, a zero axis line appears automatically and values are positioned relative to it.

For stacked columns, positive values stack upward from zero and negative values stack downward:

```csv
label,Cost,Profit
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
| `legend` | array | Custom legend labels |
| `center` | object | Donut center content (`value`, `label`) |
| `animate` | boolean | Override global animation setting |

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
