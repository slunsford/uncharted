import { renderDot } from './dot.js';

export function renderLine(config) {
  const connectDots = config.lines !== false; // default true
  return renderDot({ ...config, connectDots, chartType: 'line' });
}
