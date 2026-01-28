import { renderStackedBar } from './stacked-bar.js';
import { renderStackedColumn } from './stacked-column.js';
import { renderDonut } from './donut.js';
import { renderDot } from './dot.js';
import { renderScatter } from './scatter.js';
import { renderSankey } from './sankey.js';

export const renderers = {
  'stacked-bar': renderStackedBar,
  'stacked-column': renderStackedColumn,
  'donut': renderDonut,
  'dot': renderDot,
  'scatter': renderScatter,
  'sankey': renderSankey
};

export { renderStackedBar, renderStackedColumn, renderDonut, renderDot, renderScatter, renderSankey };
