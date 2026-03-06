const { pool } = require('./db');

const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Admin';

async function seed() {
  const client = await pool.connect();
  try {
    // Check if already seeded
    const { rows } = await client.query('SELECT COUNT(*) FROM recipes');
    if (parseInt(rows[0].count) > 0) {
      console.log('Database already seeded, skipping');
      return;
    }

    console.log('Seeding database...');

    // Seed superadmin
    await client.query(
      `INSERT INTO members (name, role) VALUES ($1, 'superadmin') ON CONFLICT (name) DO UPDATE SET role = 'superadmin'`,
      [SUPERADMIN_NAME]
    );

    // Seed ingredients
    const ingredients = [
      // Pokok
      ['Beras', 'kg', 14000, 'Pokok'],
      ['Mie Instan', 'pcs', 3500, 'Pokok'],
      ['Tepung Tapioka', 'kg', 12000, 'Pokok'],
      ['Tepung Terigu', 'kg', 10000, 'Pokok'],
      // Protein
      ['Ayam', 'kg', 35000, 'Protein'],
      ['Daging Sapi', 'kg', 130000, 'Protein'],
      ['Telur', 'pcs', 2500, 'Protein'],
      ['Tempe', 'pcs', 5000, 'Protein'],
      ['Tahu', 'pcs', 4000, 'Protein'],
      ['Lele', 'kg', 30000, 'Protein'],
      ['Ikan', 'kg', 40000, 'Protein'],
      ['Udang', 'kg', 80000, 'Protein'],
      // Sayuran
      ['Wortel', 'kg', 15000, 'Sayuran'],
      ['Kol', 'kg', 8000, 'Sayuran'],
      ['Sawi', 'kg', 7000, 'Sayuran'],
      ['Tauge', 'kg', 10000, 'Sayuran'],
      ['Kacang Panjang', 'kg', 12000, 'Sayuran'],
      ['Kentang', 'kg', 16000, 'Sayuran'],
      ['Jagung', 'kg', 10000, 'Sayuran'],
      ['Labu Siam', 'kg', 8000, 'Sayuran'],
      ['Tomat', 'kg', 12000, 'Sayuran'],
      ['Kangkung', 'kg', 6000, 'Sayuran'],
      // Bumbu
      ['Bawang Merah', 'kg', 35000, 'Bumbu'],
      ['Bawang Putih', 'kg', 40000, 'Bumbu'],
      ['Cabai', 'kg', 45000, 'Bumbu'],
      ['Kunyit', 'kg', 30000, 'Bumbu'],
      ['Lengkuas', 'kg', 15000, 'Bumbu'],
      ['Serai', 'pcs', 1000, 'Bumbu'],
      ['Daun Jeruk', 'pcs', 500, 'Bumbu'],
      ['Daun Salam', 'pcs', 500, 'Bumbu'],
      ['Kemiri', 'kg', 60000, 'Bumbu'],
      ['Ketumbar', 'kg', 50000, 'Bumbu'],
      ['Asam Jawa', 'kg', 25000, 'Bumbu'],
      ['Jahe', 'kg', 25000, 'Bumbu'],
      // Lainnya
      ['Santan', 'pcs', 10000, 'Lainnya'],
      ['Kecap Manis', 'botol', 8000, 'Lainnya'],
      ['Minyak Goreng', 'liter', 18000, 'Lainnya'],
      ['Garam', 'kg', 5000, 'Lainnya'],
      ['Gula', 'kg', 14000, 'Lainnya'],
      ['Kecap Asin', 'botol', 8000, 'Lainnya'],
      ['Kacang Tanah', 'kg', 28000, 'Lainnya'],
      ['Bawang Goreng', 'kg', 50000, 'Lainnya'],
      ['Sambal', 'botol', 12000, 'Lainnya'],
    ];

    const ingredientIds = {};
    for (const [name, unit, price, category] of ingredients) {
      const res = await client.query(
        'INSERT INTO ingredients (name, unit, price_per_unit, category) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, unit, price, category]
      );
      ingredientIds[name] = res.rows[0].id;
    }

    // Seed recipes with per-person quantities
    const recipes = [
      {
        name: 'Nasi Goreng',
        description: 'Nasi goreng khas Indonesia dengan bumbu dan kecap manis',
        ingredients: [
          ['Beras', 0.15], ['Bawang Merah', 0.02], ['Bawang Putih', 0.01],
          ['Kecap Manis', 0.02], ['Telur', 1], ['Minyak Goreng', 0.03],
          ['Cabai', 0.01], ['Garam', 0.005]
        ]
      },
      {
        name: 'Soto Ayam',
        description: 'Soto ayam kuah kuning dengan bihun dan telur',
        ingredients: [
          ['Ayam', 0.15], ['Kunyit', 0.005], ['Serai', 1], ['Daun Jeruk', 2],
          ['Beras', 0.15], ['Bawang Merah', 0.02], ['Bawang Putih', 0.01],
          ['Jahe', 0.005], ['Minyak Goreng', 0.02], ['Garam', 0.005]
        ]
      },
      {
        name: 'Rendang',
        description: 'Rendang daging sapi khas Padang dengan santan dan rempah',
        ingredients: [
          ['Daging Sapi', 0.15], ['Santan', 0.5], ['Cabai', 0.03],
          ['Lengkuas', 0.01], ['Serai', 1], ['Bawang Merah', 0.03],
          ['Bawang Putih', 0.015], ['Kunyit', 0.005], ['Daun Jeruk', 2],
          ['Beras', 0.15], ['Garam', 0.005]
        ]
      },
      {
        name: 'Ayam Goreng',
        description: 'Ayam goreng bumbu kuning renyah',
        ingredients: [
          ['Ayam', 0.2], ['Bawang Putih', 0.01], ['Ketumbar', 0.003],
          ['Kunyit', 0.005], ['Minyak Goreng', 0.05], ['Garam', 0.005],
          ['Beras', 0.15]
        ]
      },
      {
        name: 'Gado-Gado',
        description: 'Salad sayuran Indonesia dengan bumbu kacang',
        ingredients: [
          ['Tahu', 0.5], ['Tempe', 0.5], ['Kacang Tanah', 0.05],
          ['Kol', 0.05], ['Tauge', 0.03], ['Kecap Manis', 0.02],
          ['Bawang Putih', 0.01], ['Cabai', 0.01], ['Garam', 0.005],
          ['Beras', 0.15]
        ]
      },
      {
        name: 'Mie Goreng',
        description: 'Mie goreng dengan sayuran dan bumbu kecap',
        ingredients: [
          ['Mie Instan', 1], ['Telur', 1], ['Bawang Merah', 0.02],
          ['Kecap Manis', 0.02], ['Sawi', 0.03], ['Bawang Putih', 0.01],
          ['Minyak Goreng', 0.02], ['Cabai', 0.01]
        ]
      },
      {
        name: 'Sayur Asem',
        description: 'Sayur asem segar dengan berbagai sayuran',
        ingredients: [
          ['Jagung', 0.1], ['Kacang Panjang', 0.05], ['Labu Siam', 0.05],
          ['Asam Jawa', 0.01], ['Bawang Merah', 0.02], ['Cabai', 0.01],
          ['Garam', 0.005], ['Gula', 0.005], ['Beras', 0.15]
        ]
      },
      {
        name: 'Pecel Lele',
        description: 'Lele goreng dengan sambal tomat dan lalapan',
        ingredients: [
          ['Lele', 0.2], ['Tomat', 0.05], ['Cabai', 0.02],
          ['Bawang Merah', 0.02], ['Kangkung', 0.05], ['Beras', 0.15],
          ['Minyak Goreng', 0.05], ['Garam', 0.005]
        ]
      },
      {
        name: 'Opor Ayam',
        description: 'Ayam masak santan dengan bumbu opor',
        ingredients: [
          ['Ayam', 0.15], ['Santan', 0.5], ['Kemiri', 0.01],
          ['Ketumbar', 0.003], ['Lengkuas', 0.01], ['Serai', 1],
          ['Daun Salam', 1], ['Bawang Merah', 0.02], ['Bawang Putih', 0.01],
          ['Beras', 0.15], ['Garam', 0.005]
        ]
      },
      {
        name: 'Tempe Goreng',
        description: 'Tempe goreng bumbu ketumbar renyah',
        ingredients: [
          ['Tempe', 1], ['Bawang Putih', 0.01], ['Ketumbar', 0.003],
          ['Garam', 0.005], ['Minyak Goreng', 0.03], ['Beras', 0.15]
        ]
      },
      {
        name: 'Bakso',
        description: 'Bakso sapi kuah kaldu dengan mie',
        ingredients: [
          ['Daging Sapi', 0.1], ['Tepung Tapioka', 0.03],
          ['Bawang Putih', 0.01], ['Mie Instan', 1], ['Bawang Goreng', 0.01],
          ['Serai', 0.5], ['Garam', 0.005]
        ]
      },
      {
        name: 'Soto Betawi',
        description: 'Soto Betawi kuah santan dengan daging sapi',
        ingredients: [
          ['Daging Sapi', 0.12], ['Santan', 0.5], ['Tomat', 0.05],
          ['Kentang', 0.05], ['Bawang Goreng', 0.01], ['Bawang Merah', 0.02],
          ['Bawang Putih', 0.01], ['Jahe', 0.005], ['Serai', 1],
          ['Daun Jeruk', 2], ['Beras', 0.15], ['Garam', 0.005]
        ]
      },
      {
        name: 'Nasi Uduk',
        description: 'Nasi gurih masak santan dengan serai dan daun salam',
        ingredients: [
          ['Beras', 0.15], ['Santan', 0.3], ['Serai', 1],
          ['Daun Salam', 1], ['Garam', 0.005]
        ]
      },
      {
        name: 'Capcay',
        description: 'Tumis sayuran campur ala Chinese-Indonesian',
        ingredients: [
          ['Wortel', 0.05], ['Sawi', 0.05], ['Jagung', 0.05],
          ['Bawang Putih', 0.01], ['Kecap Asin', 0.02],
          ['Minyak Goreng', 0.02], ['Garam', 0.005], ['Beras', 0.15]
        ]
      },
      {
        name: 'Sambal Goreng Kentang',
        description: 'Kentang dan tempe goreng balado',
        ingredients: [
          ['Kentang', 0.1], ['Cabai', 0.02], ['Bawang Merah', 0.02],
          ['Tempe', 0.5], ['Minyak Goreng', 0.04], ['Garam', 0.005],
          ['Gula', 0.005], ['Beras', 0.15]
        ]
      }
    ];

    for (const recipe of recipes) {
      const res = await client.query(
        'INSERT INTO recipes (name, description) VALUES ($1, $2) RETURNING id',
        [recipe.name, recipe.description]
      );
      const recipeId = res.rows[0].id;

      for (const [ingredientName, qtyPerPerson] of recipe.ingredients) {
        const ingId = ingredientIds[ingredientName];
        if (ingId) {
          await client.query(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person) VALUES ($1, $2, $3)',
            [recipeId, ingId, qtyPerPerson]
          );
        }
      }
    }

    console.log(`Seeded: superadmin "${SUPERADMIN_NAME}", ${ingredients.length} ingredients, ${recipes.length} recipes`);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    client.release();
  }
}

module.exports = { seed };
