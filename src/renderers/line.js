import { renderDot } from './dot.js';

export function renderLine(config) {
  return renderDot({ ...config, connectDots: true, chartType: 'line' });
}
