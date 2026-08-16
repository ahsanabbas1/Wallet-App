import { getDb, generateId } from '../lib/db';
import { transactionService } from './transactionService';

const MIN_OCCURRENCES = 3;
const LOOKBACK_DAYS = 365;

// Median-interval tolerance bands, in days
const FREQUENCY_BUCKETS = [
  { key: 'weekly', days: 7, tolerance: 2 },
  { key: 'monthly', days: 30, tolerance: 5 },
  { key: 'yearly', days: 365, tolerance: 20 },
];

const signatureOf = (t) => `${(t.title || '').trim().toLowerCase()}|${t.category_id || ''}|${t.type}`;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyFrequency(intervalMedian) {
  for (const bucket of FREQUENCY_BUCKETS) {
    if (Math.abs(intervalMedian - bucket.days) <= bucket.tolerance) return bucket.key;
  }
  return null;
}

const FREQUENCY_DAYS = { weekly: 7, monthly: 30, yearly: 365 };

export const recurringDetectionService = {
  // Returns candidate recurring transactions the user hasn't already planned
  // or dismissed — at least 3 occurrences, roughly regular interval, roughly
  // consistent amount.
  async detect(userId) {
    if (!userId) return [];
    const db = getDb();

    const { data: transactions } = await transactionService.getTransactions(userId, { period: 'ALL' });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);

    const relevant = transactions.filter(t =>
      t.is_loan !== 1 && t.type !== 'transfer' && t.title && new Date(t.date) >= cutoff
    );

    const groups = {};
    relevant.forEach(t => {
      const sig = signatureOf(t);
      (groups[sig] = groups[sig] || []).push(t);
    });

    const [dismissedRows, plannedRows] = await Promise.all([
      db.getAllAsync('SELECT signature FROM dismissed_recurring_suggestions WHERE user_id = ?', [userId]),
      db.getAllAsync('SELECT title, category_id FROM planned_payments WHERE user_id = ? AND is_active = 1', [userId]),
    ]);
    const dismissedSet = new Set(dismissedRows.map(d => d.signature));
    const plannedSet = new Set(plannedRows.map(p => `${(p.title || '').trim().toLowerCase()}|${p.category_id || ''}`));

    const suggestions = [];
    for (const sig of Object.keys(groups)) {
      if (dismissedSet.has(sig)) continue;

      const group = groups[sig].sort((a, b) => new Date(a.date) - new Date(b.date));
      if (group.length < MIN_OCCURRENCES) continue;

      const [titleKey, categoryId] = sig.split('|');
      if (plannedSet.has(`${titleKey}|${categoryId}`)) continue;

      const intervals = [];
      for (let i = 1; i < group.length; i++) {
        intervals.push((new Date(group[i].date) - new Date(group[i - 1].date)) / 86400000);
      }
      const intervalMedian = median(intervals);
      const intervalDeviation = intervals.reduce((s, v) => s + Math.abs(v - intervalMedian), 0) / intervals.length;
      if (intervalDeviation > intervalMedian * 0.35 + 3) continue; // too irregular

      const frequency = classifyFrequency(intervalMedian);
      if (!frequency) continue;

      const amounts = group.map(t => parseFloat(t.amount));
      const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length;
      const amountDeviation = amounts.reduce((s, v) => s + Math.abs(v - avgAmount), 0) / amounts.length;
      if (amountDeviation > avgAmount * 0.25) continue; // amounts too inconsistent

      const last = group[group.length - 1];
      const nextDate = new Date(last.date);
      nextDate.setDate(nextDate.getDate() + FREQUENCY_DAYS[frequency]);

      suggestions.push({
        signature: sig,
        title: last.title,
        type: last.type,
        category_id: last.category_id,
        categoryName: last.categories?.name || 'Uncategorized',
        amount: Math.round(avgAmount),
        frequency,
        occurrences: group.length,
        lastDate: last.date,
        suggestedNextDate: nextDate.toISOString().split('T')[0],
        account_id: last.account_id || null,
      });
    }

    return suggestions.sort((a, b) => b.occurrences - a.occurrences);
  },

  async dismiss(userId, signature) {
    if (!userId || !signature) return;
    const db = getDb();
    await db.runAsync(
      `INSERT INTO dismissed_recurring_suggestions (id, user_id, signature, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, signature) DO NOTHING`,
      [generateId(), userId, signature, new Date().toISOString()]
    );
  },
};

export default recurringDetectionService;
