/**
 * Formats a currency amount into a readable abbreviated string.
 * Always works with the absolute value — sign is applied by the caller.
 */
export const formatAmount = (amount) => {
  const num = Math.abs(parseFloat(amount || 0));
  if (num >= 10_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000_000)  return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 100_000)    return (num / 1_000).toFixed(0) + 'k';
  if (num >= 10_000)     return (num / 1_000).toFixed(1) + 'k';
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};
