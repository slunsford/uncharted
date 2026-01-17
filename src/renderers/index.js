import { renderStackedBar } from './stacked-bar.js';
import { renderStackedColumn } from './stacked-column.js';
import { renderDonut } from './donut.js';
import { renderDot } from './dot.js';
import { renderScatter } from './scatter.js';

export const renderers = {
  'stacked-bar': renderStackedBar,
  'stacked-column': renderStackedColumn,
  'donut': renderDonut,
  'dot': renderDot,
  'scatter': renderScatter
};

export { renderStackedBar, renderStackedColumn, renderDonut, renderDot, renderScatter };
