const { Client } = require('pg');

const connectionString = 'postgresql://postgres:SHBq6NygO80JwMdP@db.vsfijgaggpobdiwvdvxl.supabase.co:5432/postgres';

async function fixCategories() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Fixing categories to be shared (user_id = NULL)...\n');

    // Set all existing categories' user_id to NULL so they are shared across all users
    const updateResult = await client.query(`
      UPDATE public.categories SET user_id = NULL WHERE user_id IS NOT NULL
    `);
    console.log(`Updated ${updateResult.rowCount} categories to shared (user_id = NULL)`);

    // Verify categories exist, insert defaults if none
    const { rows: existing } = await client.query('SELECT id, name, color, icon, type FROM public.categories ORDER BY name');
    
    if (existing.length === 0) {
      console.log('\nNo categories found, inserting default shared categories...');
      const categories = [
        { name: 'Dining Out', color: '#FF5722', icon: 'Utensils', type: 'expense' },
        { name: 'Entertainment', color: '#F44336', icon: 'Tv', type: 'expense' },
        { name: 'Freelance', color: '#4CAF50', icon: 'Briefcase', type: 'income' },
        { name: 'Fuel', color: '#03A9F4', icon: 'Fuel', type: 'expense' },
        { name: 'Grocery', color: '#FF9800', icon: 'ShoppingCart', type: 'expense' },
        { name: 'Salary', color: '#8BC34A', icon: 'Wallet', type: 'income' },
        { name: 'Transport', color: '#03A9F4', icon: 'Car', type: 'expense' },
        { name: 'Utilities', color: '#FFC107', icon: 'Zap', type: 'expense' },
      ];

      for (const cat of categories) {
        await client.query(`
          INSERT INTO public.categories (name, color, icon, type, user_id)
          VALUES ($1, $2, $3, $4, NULL)
        `, [cat.name, cat.color, cat.icon, cat.type]);
      }
      console.log(`Inserted ${categories.length} shared categories`);
    }

    // Show final state
    const { rows: final } = await client.query('SELECT id, name, user_id FROM public.categories ORDER BY name');
    console.log('\nFinal categories:');
    final.forEach(c => console.log(`  ${c.name} — user_id: ${c.user_id ?? 'NULL (shared)'}`));

    console.log('\nDone! All categories are now shared and visible to all users.');
  } catch (err) {
    console.error('Fix failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixCategories();
