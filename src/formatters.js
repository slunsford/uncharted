/**
 * Format a number according to configuration
 * @param {number} value - Raw numeric value
 * @param {Object} config - { thousands, compact, decimals, currency: { symbol, position } }
 * @returns {string} - Formatted string
 */
export function formatNumber(value, config = {}) {
  if (value == null || isNaN(value)) return '';

  const { thousands, compact, decimals, currency } = config;
  let num = value;
  let suffix = '';

  // Compact notation (K/M/B/T)
  if (compact) {
    const abs = Math.abs(num);
    if (abs >= 1e12) { num /= 1e12; suffix = 'T'; }
    else if (abs >= 1e9) { num /= 1e9; suffix = 'B'; }
    else if (abs >= 1e6) { num /= 1e6; suffix = 'M'; }
    else if (abs >= 1e3) { num /= 1e3; suffix = 'K'; }
  }

  // Decimal places (default: 0, or 1 if compact with suffix)
  const places = decimals ?? (suffix ? 1 : 0);

  // Format with or without thousands separators
  let formatted = thousands && !suffix
    ? num.toLocaleString('en-US', { minimumFractionDigits: places, maximumFractionDigits: places })
    : num.toFixed(places);

  formatted += suffix;

  // Currency symbol
  if (currency?.symbol) {
    const pos = currency.position ?? 'prefix';
    formatted = pos === 'prefix' ? currency.symbol + formatted : formatted + currency.symbol;
  }

  return formatted;
}
