import { renderStackedBar } from './stacked-bar.js';
import { renderStackedColumn } from './stacked-column.js';
import { renderDonut } from './donut.js';
import { renderDot } from './dot.js';
import { renderScatter } from './scatter.js';
import { renderSankey } from './sankey.js';
import { renderLine } from './line.js';
import { renderTimeseries } from './timeseries.js';
import { renderBubble } from './bubble.js';

export const renderers = {
  'stacked-bar': renderStackedBar,
  'stacked-column': renderStackedColumn,
  'donut': renderDonut,
  'dot': renderDot,
  'scatter': renderScatter,
  'sankey': renderSankey,
  'line': renderLine,
  'timeseries': renderTimeseries,
  'bubble': renderBubble
};

export { renderStackedBar, renderStackedColumn, renderDonut, renderDot, renderScatter, renderSankey, renderLine, renderTimeseries, renderBubble };
