---
layout: base.njk
title: Uncharted Test Page
charts:
  platform-growth:
    type: stacked-bar
    title: Platform Growth
    subtitle: Models by domain
    max: 25
    file: charts/platform-growth.csv
  quick-stats:
    type: donut
    title: Issue Types
    subtitle: Current sprint
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
---

# Uncharted Charts Demo

This page demonstrates all four chart types supported by the Uncharted plugin.

## Stacked Bar Chart (Page Frontmatter)

{% chart "platform-growth" %}

## Stacked Column Chart (Global Data)

{% chart "releases" %}

## Donut Chart (Inline Data)

{% chart "quick-stats" %}

## Dot Chart (Categorical)

{% chart "adoption" %}

## Scatter Plot

{% chart "scatter" %}

## Error Handling

Below is a reference to a non-existent chart:

{% chart "does-not-exist" %}
