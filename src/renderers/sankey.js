import { slugify, escapeHtml, renderDownloadLink } from '../utils.js';
import { formatNumber } from '../formatters.js';

/**
 * Render a Sankey diagram
 * @param {Object} config - Chart configuration
 * @param {string} config.title - Chart title
 * @param {string} [config.subtitle] - Chart subtitle
 * @param {Object[]} config.data - Chart data (source, target, value columns)
 * @param {boolean} [config.legend] - Show legend for nodes
 * @param {boolean} [config.animate] - Enable animations
 * @param {number} [config.nodeWidth] - Width of node bars in pixels (default: 20)
 * @param {number} [config.nodePadding] - Vertical gap between nodes in pixels (default: 10)
 * @param {boolean} [config.endLabelsOutside] - Position last level labels outside/right (default: false)
 * @param {boolean} [config.proportional] - Force proportional node heights for data integrity (default: false)
 * @returns {string} - HTML string
 */
export function renderSankey(config) {
  const { title, subtitle, data, legend, animate, format, id, downloadData, downloadDataUrl, nodeWidth = 20, nodePadding = 10, endLabelsOutside = false, proportional = false } = config;

  if (!data || data.length === 0) {
    return `<!-- Sankey chart: no data provided -->`;
  }

  const animateClass = animate ? ' chart-animate' : '';

  // Get column keys positionally
  const keys = Object.keys(data[0]);
  const sourceKey = keys[0];  // First column: source
  const targetKey = keys[1];  // Second column: target
  const valueKey = keys[2];   // Third column: value

  // Parse edges and build node set
  const edges = [];
  const nodeSet = new Set();
  const nodeInFlow = new Map();  // Total flow into each node
  const nodeOutFlow = new Map(); // Total flow out of each node

  data.forEach((row, rowIndex) => {
    const source = String(row[sourceKey] ?? '').trim();
    const target = String(row[targetKey] ?? '').trim();
    const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0;

    if (source && target && value > 0) {
      // Check for self-loops
      if (source === target) {
        throw new Error(`Sankey chart error: Self-loop detected at row ${rowIndex + 2} - "${source}" cannot flow to itself`);
      }
      edges.push({ source, target, value });
      nodeSet.add(source);
      nodeSet.add(target);
      nodeOutFlow.set(source, (nodeOutFlow.get(source) || 0) + value);
      nodeInFlow.set(target, (nodeInFlow.get(target) || 0) + value);
    }
  });

  if (edges.length === 0) {
    return `<!-- Sankey chart: no valid edges -->`;
  }

  // Aggregate duplicate edges (same source -> target)
  const edgeMap = new Map();
  edges.forEach(({ source, target, value }) => {
    const key = `${source}::${target}`;
    edgeMap.set(key, (edgeMap.get(key) || 0) + value);
  });

  const aggregatedEdges = Array.from(edgeMap.entries()).map(([key, value]) => {
    const [source, target] = key.split('::');
    return { source, target, value };
  });

  // Count flows per node (for minimum height calculation)
  const nodeOutFlowCount = new Map();
  const nodeInFlowCount = new Map();
  aggregatedEdges.forEach(({ source, target }) => {
    nodeOutFlowCount.set(source, (nodeOutFlowCount.get(source) || 0) + 1);
    nodeInFlowCount.set(target, (nodeInFlowCount.get(target) || 0) + 1);
  });

  // Determine node levels via topological sort (BFS from sources)
  const nodeLevel = new Map();
  const nodes = Array.from(nodeSet);

  // Find source nodes (nodes with no incoming edges)
  const sourceNodes = nodes.filter(n => !nodeInFlow.has(n) || nodeInFlow.get(n) === 0);

  // Initialize source nodes at level 0
  const queue = sourceNodes.map(n => ({ node: n, level: 0 }));
  sourceNodes.forEach(n => nodeLevel.set(n, 0));

  // BFS to assign levels
  while (queue.length > 0) {
    const { node, level } = queue.shift();

    // Find edges from this node
    aggregatedEdges.forEach(edge => {
      if (edge.source === node) {
        const targetLevel = level + 1;
        const currentLevel = nodeLevel.get(edge.target);

        // Use the maximum level (longest path to this node)
        if (currentLevel === undefined || targetLevel > currentLevel) {
          nodeLevel.set(edge.target, targetLevel);
          queue.push({ node: edge.target, level: targetLevel });
        }
      }
    });
  }

  // Handle any unassigned nodes (cycles or disconnected)
  nodes.forEach(n => {
    if (!nodeLevel.has(n)) {
      nodeLevel.set(n, 0);
    }
  });

  // Group nodes by level
  const levelCount = Math.max(...nodeLevel.values()) + 1;
  const levels = Array.from({ length: levelCount }, () => []);
  nodes.forEach(n => {
    levels[nodeLevel.get(n)].push(n);
  });

  // Calculate max label width per level (character count × 0.5rem + padding)
  const maxLabelWidthPerLevel = levels.map(levelNodes => {
    const maxChars = Math.max(...levelNodes.map(node => node.length));
    return maxChars * 0.5 + 1; // 0.5rem per char + 1rem padding
  });

  // Calculate minimum flow column width
  // For each flow column between levels i and i+1:
  // - Level i labels extend right into the flow column
  // - Level i+1 labels extend left into the flow column (only if it's the last level AND !endLabelsOutside)
  let minFlowWidth = 0;
  for (let i = 0; i < levelCount - 1; i++) {
    let width = maxLabelWidthPerLevel[i]; // Labels from level i (pointing right)
    const isNextLevelLast = (i + 1 === levelCount - 1);
    if (isNextLevelLast && !endLabelsOutside) {
      width += maxLabelWidthPerLevel[i + 1]; // Labels from last level pointing left
    }
    if (width > minFlowWidth) {
      minFlowWidth = width;
    }
  }

  // Calculate node throughput (max of in/out flow) for sizing
  const nodeThroughput = new Map();
  nodes.forEach(n => {
    const inFlow = nodeInFlow.get(n) || 0;
    const outFlow = nodeOutFlow.get(n) || 0;
    nodeThroughput.set(n, Math.max(inFlow, outFlow));
  });

  // Calculate total throughput per level for scaling
  const levelThroughput = levels.map(levelNodes =>
    levelNodes.reduce((sum, n) => sum + nodeThroughput.get(n), 0)
  );
  const maxLevelThroughput = Math.max(...levelThroughput);

  // Calculate vertical positions for nodes within each level
  // Positions are percentages (0-100)
  const nodePosition = new Map(); // { top: %, height: % }
  const paddingPct = (nodePadding / 400) * 100; // Convert px to approximate %
  const minNodeHeight = 2; // Minimum node height in percentage points
  const minGapHeight = 4; // Minimum gap to prevent label overlap (%)
  const minFlowHeightBase = 0.4; // Base minimum flow height (before scaling)

  // Track maximum height needed across all levels
  let maxLevelHeight = 100;

  // When proportional mode is on, scale the entire chart so the smallest node
  // is at least ~1px visible, preserving true proportions
  // 0.4% of base 16rem min-height ≈ 1px
  const proportionalMinHeight = 0.4;
  let proportionalScale = 1;
  if (proportional) {
    const smallestHeight = Math.min(...nodes.map(n => (nodeThroughput.get(n) / maxLevelThroughput) * 100));
    if (smallestHeight > 0 && smallestHeight < proportionalMinHeight) {
      proportionalScale = proportionalMinHeight / smallestHeight;
    }
  }

  levels.forEach((levelNodes, levelIndex) => {
    // Calculate proportional heights based on full 100% (not reduced by padding)
    const nodeHeights = levelNodes.map(node => {
      const throughput = nodeThroughput.get(node);
      return {
        node,
        height: (throughput / maxLevelThroughput) * 100 * proportionalScale
      };
    });

    let effectivePadding = paddingPct;

    if (!proportional) {
      // Count nodes that will hit minimum height to determine if we need larger gaps
      const smallNodeCount = nodeHeights.filter(n => n.height < minNodeHeight).length;

      // If more than half the nodes are small, use minimum gap to prevent label overlap
      if (smallNodeCount > levelNodes.length / 2) {
        effectivePadding = Math.max(paddingPct, minGapHeight);
      }

      // Enforce minimum heights (container will scale to fit)
      // Node must be tall enough for: 1) visibility, 2) all connected flows
      nodeHeights.forEach(n => {
        const outFlows = nodeOutFlowCount.get(n.node) || 0;
        const inFlows = nodeInFlowCount.get(n.node) || 0;
        const flowBasedMin = Math.max(outFlows, inFlows) * minFlowHeightBase;
        const nodeMin = Math.max(minNodeHeight, flowBasedMin);
        if (n.height < nodeMin) {
          n.height = nodeMin;
        }
      });
    }

    // Assign positions (padding adds to total, may exceed 100%)
    let currentTop = 0;
    nodeHeights.forEach(({ node, height }) => {
      nodePosition.set(node, {
        top: currentTop,
        height: height,
        level: levelIndex
      });
      currentTop += height + effectivePadding;
    });

    // Track the actual height needed (last node bottom = currentTop - last padding)
    const levelHeight = currentTop - effectivePadding;
    if (levelHeight > maxLevelHeight) {
      maxLevelHeight = levelHeight;
    }
  });

  // Calculate height scale factor if content exceeds 100%
  const heightScale = maxLevelHeight / 100;

  // Normalize positions to 0-100 range; container grows via --height-scale CSS variable
  if (heightScale > 1) {
    nodePosition.forEach((pos, node) => {
      pos.top = pos.top / heightScale;
      pos.height = pos.height / heightScale;
    });
  }

  // Center each level vertically based on its own content height
  levels.forEach((levelNodes, levelIndex) => {
    if (levelNodes.length === 0) return;

    // Find the bottom of the last node in this level
    let maxBottom = 0;
    levelNodes.forEach(node => {
      const pos = nodePosition.get(node);
      const bottom = pos.top + pos.height;
      if (bottom > maxBottom) maxBottom = bottom;
    });

    // Center this level
    const centerOffset = (100 - maxBottom) / 2;
    if (centerOffset > 0) {
      levelNodes.forEach(node => {
        const pos = nodePosition.get(node);
        pos.top = pos.top + centerOffset;
      });
    }
  });

  // Sort edges by source level, then target level for consistent rendering
  aggregatedEdges.sort((a, b) => {
    const aSourceLevel = nodeLevel.get(a.source);
    const bSourceLevel = nodeLevel.get(b.source);
    if (aSourceLevel !== bSourceLevel) return aSourceLevel - bSourceLevel;
    const aTargetLevel = nodeLevel.get(a.target);
    const bTargetLevel = nodeLevel.get(b.target);
    return aTargetLevel - bTargetLevel;
  });

  // Calculate flow heights proportional to each end's node height.
  // Flows taper between source and target, naturally filling both nodes.
  const flowData = aggregatedEdges.map((edge, index) => {
    const sourcePos = nodePosition.get(edge.source);
    const targetPos = nodePosition.get(edge.target);
    const sourceThroughput = nodeThroughput.get(edge.source);
    const targetThroughput = nodeThroughput.get(edge.target);

    return {
      ...edge,
      fromLevel: sourcePos.level,
      toLevel: targetPos.level,
      fromHeight: (edge.value / sourceThroughput) * sourcePos.height,
      toHeight: (edge.value / targetThroughput) * targetPos.height,
      index
    };
  });

  // Calculate flow positions within each node
  const nodeOutOffset = new Map();
  const nodeInOffset = new Map();
  nodes.forEach(n => {
    nodeOutOffset.set(n, 0);
    nodeInOffset.set(n, 0);
  });

  const flows = flowData.map(f => {
    const sourcePos = nodePosition.get(f.source);
    const targetPos = nodePosition.get(f.target);

    const sourceOffset = nodeOutOffset.get(f.source);
    const targetOffset = nodeInOffset.get(f.target);

    nodeOutOffset.set(f.source, sourceOffset + f.fromHeight);
    nodeInOffset.set(f.target, targetOffset + f.toHeight);

    return {
      ...f,
      fromTop: sourcePos.top + sourceOffset,
      toTop: targetPos.top + targetOffset
    };
  });

  // Enforce minimum flow heights by redistributing space
  // Small flows get bumped up; space is borrowed from larger flows
  // Minimum flow height in percentage points (scale down if container is taller)
  const minFlowHeight = minFlowHeightBase / (heightScale > 1 ? heightScale : 1);

  // Helper to redistribute heights for one side of flows at a node
  function enforceMinHeights(flowsAtNode, heightKey, topKey, nodeTop, nodeHeight) {
    if (flowsAtNode.length === 0) return;

    // Identify small and large flows
    const small = flowsAtNode.filter(f => f[heightKey] < minFlowHeight);
    const large = flowsAtNode.filter(f => f[heightKey] >= minFlowHeight);

    if (small.length === 0) return; // Nothing to adjust

    // Calculate space needed
    const spaceNeeded = small.reduce((sum, f) => sum + (minFlowHeight - f[heightKey]), 0);
    const largeTotal = large.reduce((sum, f) => sum + f[heightKey], 0);

    if (largeTotal <= 0) {
      // All flows are small; just set them all to minimum
      small.forEach(f => { f[heightKey] = minFlowHeight; });
    } else {
      // Borrow space proportionally from large flows
      const borrowRatio = Math.min(1, spaceNeeded / largeTotal);
      large.forEach(f => {
        f[heightKey] = f[heightKey] * (1 - borrowRatio);
      });
      small.forEach(f => {
        f[heightKey] = minFlowHeight;
      });
    }

    // Recalculate top positions
    let currentTop = nodeTop;
    flowsAtNode.forEach(f => {
      f[topKey] = currentTop;
      currentTop += f[heightKey];
    });
  }

  // Group flows by source node and adjust fromHeight/fromTop
  const flowsBySource = new Map();
  flows.forEach(f => {
    if (!flowsBySource.has(f.source)) flowsBySource.set(f.source, []);
    flowsBySource.get(f.source).push(f);
  });
  flowsBySource.forEach((nodeFlows, nodeName) => {
    const pos = nodePosition.get(nodeName);
    enforceMinHeights(nodeFlows, 'fromHeight', 'fromTop', pos.top, pos.height);
  });

  // Group flows by target node and adjust toHeight/toTop
  const flowsByTarget = new Map();
  flows.forEach(f => {
    if (!flowsByTarget.has(f.target)) flowsByTarget.set(f.target, []);
    flowsByTarget.get(f.target).push(f);
  });
  flowsByTarget.forEach((nodeFlows, nodeName) => {
    const pos = nodePosition.get(nodeName);
    enforceMinHeights(nodeFlows, 'toHeight', 'toTop', pos.top, pos.height);
  });

  // Assign colors to nodes
  const nodeColors = new Map();
  nodes.forEach((node, i) => {
    nodeColors.set(node, (i % 12) + 1);
  });

  // Build HTML
  // Generate grid columns: alternating node-width and minmax(min-flow-width, 1fr)
  // For n levels: node-width (minmax node-width) * (n-1)
  const gridColumns = Array(levelCount).fill('var(--sankey-node-width)').join(' minmax(var(--min-flow-width), 1fr) ');

  // Calculate end label width if labels are outside
  let endLabelWidthStyle = '';
  if (endLabelsOutside && levels.length > 0) {
    const lastLevel = levels[levels.length - 1];
    const maxLabelLength = Math.max(...lastLevel.map(node => node.length));
    // Approximate width: 0.5ch per character at 0.75rem + padding
    const labelWidth = maxLabelLength * 0.5 + 1; // in rem
    endLabelWidthStyle = ` --end-label-width: ${labelWidth.toFixed(1)}rem;`;
  }

  const idClass = id ? ` chart-${id}` : '';
  const endLabelsOutsideClass = endLabelsOutside ? ' chart-sankey-end-labels-outside' : '';
  let html = `<figure class="chart chart-sankey${animateClass}${idClass}${endLabelsOutsideClass}" style="--node-width: ${nodeWidth}px; --level-count: ${levelCount}; --grid-columns: ${gridColumns}; --min-flow-width: ${minFlowWidth.toFixed(1)}rem; --height-scale: ${heightScale.toFixed(2)};${endLabelWidthStyle}">`;

  if (title) {
    html += `<figcaption class="chart-title">${escapeHtml(title)}`;
    if (subtitle) {
      html += `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`;
    }
    html += `</figcaption>`;
  }

  // Legend (optional)
  if (legend) {
    html += `<ul class="chart-legend">`;
    nodes.forEach((node, i) => {
      const colorClass = `chart-color-${nodeColors.get(node)}`;
      const seriesClass = `chart-series-${slugify(node)}`;
      const throughput = nodeThroughput.get(node);
      html += `<li class="chart-legend-item ${colorClass} ${seriesClass}">${escapeHtml(node)}`;
      if (format) {
        html += ` <span class="legend-value">${formatNumber(throughput, format) || throughput}</span>`;
      }
      html += `</li>`;
    });
    html += `</ul>`;
  }

  html += `<div class="chart-sankey-container">`;

  // Flows (rendered as SVG paths with bezier curves)
  const delayStep = flows.length > 1 ? Math.min(0.1, 1 / (flows.length - 1)) : 0;
  flows.forEach((flow, i) => {
    const sourceColor = nodeColors.get(flow.source);
    const targetColor = nodeColors.get(flow.target);
    const tooltipText = `${flow.source} → ${flow.target}: ${formatNumber(flow.value, format) || flow.value}`;

    // Flow spans from after source node column to target node column
    const colStart = flow.fromLevel * 2 + 2;
    const colEnd = flow.toLevel * 2 + 1;

    // SVG path coordinates (0-100 viewBox)
    const y1 = flow.fromTop;
    const y2 = flow.toTop;
    const fh = flow.fromHeight;
    const th = flow.toHeight;

    // Bezier control points at 40% and 60% for smooth S-curve
    const cx1 = 40;
    const cx2 = 60;

    // Path: top edge (left to right with curve), then bottom edge (right to left with curve)
    // Flow tapers between fromHeight at source and toHeight at target
    // Extend slightly past 0/100 to overlap with node columns and prevent subpixel gaps
    const x0 = -2;
    const x1end = 102;
    const pathD = `M ${x0},${y1.toFixed(2)} C ${cx1},${y1.toFixed(2)} ${cx2},${y2.toFixed(2)} ${x1end},${y2.toFixed(2)} L ${x1end},${(y2 + th).toFixed(2)} C ${cx2},${(y2 + th).toFixed(2)} ${cx1},${(y1 + fh).toFixed(2)} ${x0},${(y1 + fh).toFixed(2)} Z`;

    html += `<svg class="chart-sankey-flow" viewBox="0 0 100 100" preserveAspectRatio="none" `;
    html += `style="grid-column: ${colStart} / ${colEnd}; --from-level: ${flow.fromLevel}; --flow-index: ${i}; --delay-step: ${delayStep.toFixed(3)}s">`;
    html += `<defs><linearGradient id="sankey-grad-${id || 'default'}-${i}">`;
    html += `<stop offset="0%" style="stop-color: var(--chart-color-${sourceColor})" />`;
    html += `<stop offset="100%" style="stop-color: var(--chart-color-${targetColor})" />`;
    html += `</linearGradient></defs>`;
    html += `<path d="${pathD}" fill="url(#sankey-grad-${id || 'default'}-${i})"><title>${escapeHtml(tooltipText)}</title></path>`;
    html += `</svg>`;
  });

  // Nodes grouped by level
  levels.forEach((levelNodes, levelIndex) => {
    // Level i goes in column (2*i + 1) using 1-based indexing
    const isFirst = levelIndex === 0;
    const isLast = levelIndex === levels.length - 1;
    const levelClass = isFirst ? ' chart-sankey-level-first' : isLast ? ' chart-sankey-level-last' : '';
    html += `<div class="chart-sankey-level${levelClass}" style="grid-column: ${levelIndex * 2 + 1}">`;
    levelNodes.forEach(node => {
      const pos = nodePosition.get(node);
      const colorIndex = nodeColors.get(node);
      const colorClass = `chart-color-${colorIndex}`;
      const seriesClass = `chart-series-${slugify(node)}`;
      const throughput = nodeThroughput.get(node);
      const tooltipText = `${node}: ${formatNumber(throughput, format) || throughput}`;

      html += `<div class="chart-sankey-node ${colorClass} ${seriesClass}" `;
      html += `style="--top: ${pos.top.toFixed(2)}%; --height: ${pos.height.toFixed(2)}%" `;
      html += `title="${escapeHtml(tooltipText)}">`;
      html += `<span class="chart-sankey-node-label">${escapeHtml(node)}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  });

  html += `</div>`;
  html += renderDownloadLink(downloadDataUrl, downloadData);
  html += `</figure>`;

  return html;
}
