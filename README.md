# Uncharted

A CSS-based chart plugin for Eleventy. Renders charts as pure HTML/CSS.

**[Full Documentation](https://uncharted.docs.seanlunsford.com/)**

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

## Quick Example

Define a chart in frontmatter and render with the shortcode:

```markdown
---
charts:
  sales:
    type: stacked-bar
    title: Quarterly Sales
    file: charts/sales.csv
---

{% chart "sales" %}
```

Chart types: `donut`, `stacked-bar`, `stacked-column`, `dot`, `scatter`

See the [documentation](https://uncharted.docs.seanlunsford.com/) for configuration options, styling, animations, and more.
