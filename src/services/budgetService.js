import { supabase } from '../lib/supabase';

export const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

// Returns categoryId + all its direct child IDs
export const getRelatedCategoryIds = (categoryId, allCategories) => {
  const children = (allCategories || [])
    .filter(c => c.parent_id === categoryId)
    .map(c => c.id);
  return [categoryId, ...children];
};

export const getActivePeriod = (startDate, frequency) => {
  const now = new Date();
  const start = parseLocalDate(startDate);
  
  if (frequency === 'once' || !frequency) {
    return { start: startDate, end: null };
  }

  let periodStart = new Date(start);
  while (true) {
    let next;
    if (frequency === 'daily') {
      next = new Date(periodStart); next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
      next = new Date(periodStart); next.setDate(next.getDate() + 7);
    } else if (frequency === 'monthly') {
      next = new Date(periodStart); next.setMonth(next.getMonth() + 1);
    } else if (frequency === 'yearly') {
      next = new Date(periodStart); next.setFullYear(next.getFullYear() + 1);
    }
    
    if (next > now) break;
    periodStart = next;
  }

  let periodEnd;
  if (frequency === 'daily') {
    periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 1);
  } else if (frequency === 'weekly') {
    periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 7);
  } else if (frequency === 'monthly') {
    periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (frequency === 'yearly') {
    periodEnd = new Date(periodStart); periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }
  
  periodEnd.setMilliseconds(periodEnd.getMilliseconds() - 1);
  return { start: formatLocalDate(periodStart), end: formatLocalDate(periodEnd) };
};

export const decodeBudget = (b) => {
  try {
    const config = JSON.parse(b.period);
    return {
      ...b,
      start_date: config.s,
      end_date: config.e,
      frequency: config.f,
      period: config.p
    };
  } catch (e) {
    const [y, m] = (b.period || '').split('-').map(Number);
    const start = (y && m) ? formatLocalDate(new Date(y, m - 1, 1)) : formatLocalDate(new Date(b.created_at));
    return {
      ...b,
      start_date: start,
      end_date: null,
      frequency: 'monthly'
    };
  }
};

function createId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const budgetService = {
  async getBudgets(userId) {
    const { data, error } = await supabase
      .from('budgets')
      .select('*, categories(id, name, icon, color, type)')
      .eq('user_id', userId);
    if (error) throw error;
    return { data: data || [] };
  },

  async saveBudget(userId, budgetData, existingId = null) {
    const id = existingId || budgetData.id || createId();
    
    // WORKAROUND: Encode advanced fields into the existing 'period' column to avoid schema errors
    const encodedConfig = JSON.stringify({
      s: budgetData.start_date,
      e: budgetData.end_date,
      f: budgetData.frequency,
      p: budgetData.period // legacy fallback
    });

    const payload = {
      id,
      user_id: userId,
      category_id: budgetData.category_id,
      total_amount: Number(budgetData.total_amount),
      period: encodedConfig,
      created_at: budgetData.created_at || new Date().toISOString(),
    };

    if (existingId) {
      const { error } = await supabase
        .from('budgets')
        .update({
          category_id: payload.category_id,
          total_amount: payload.total_amount,
          period: payload.period
        })
        .eq('id', existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('budgets').insert(payload);
      if (error) throw error;
    }
    return { queued: false, id };
  },

  async deleteBudget(userId, id) {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw error;
    return { queued: false, id };
  },
};

export default budgetService;
