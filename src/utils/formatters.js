/**
 * Formats a currency amount into a readable string (e.g., 1k, 1M).
 */
export const formatAmount = (amount) => {
  const num = parseFloat(amount || 0);
  if (num >= 10000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 100000) return (num / 1000).toFixed(0) + 'k';
  if (num >= 10000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};
