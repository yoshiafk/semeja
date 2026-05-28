const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { seedBekalSehat } = require('./seed-bekal');

const SUPERADMIN_NAME = process.env.SUPERADMIN_NAME || 'Admin';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'admin123';

async function seed() {
  let client = await pool.connect();
  try {
    // Check if already seeded
    const { rows } = await client.query('SELECT COUNT(*) FROM recipes');
    const alreadySeeded = parseInt(rows[0].count) > 0;

    // Always run bekal sehat seeding (has its own idempotency check)
    client.release();
    client = null;
    
    try {
      await seedBekalSehat();
    } catch (err) {
      console.warn('Bekal Sehat seeding failed (likely concurrent Vercel instances), skipping:', err.message);
    }
    
    client = await pool.connect();

    if (alreadySeeded) {
      console.log('Database already seeded, skipping');
      return;
    }

    console.log('Seeding database...');

    // Seed superadmin with hashed password
    const hashedPW = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
    await client.query(
      `INSERT INTO members (name, role, password_hash) VALUES ($1, 'superadmin', $2) 
       ON CONFLICT (name) DO UPDATE SET role = 'superadmin', password_hash = $2`,
      [SUPERADMIN_NAME, hashedPW]
    );

    // Seed ingredients
    const ingredients = [
      ['Melon', 'potong', 0, 'Buah'],
      ['Semangka', 'potong', 0, 'Buah'],
      ['Asam Jawa', 'kg', 25000, 'Bumbu'],
      ['Bawang Merah', 'kg', 49091, 'Bumbu'],
      ['Bawang Putih', 'kg', 43500, 'Bumbu'],
      ['Cabai Merah Keriting', 'buah', 0, 'Bumbu'],
      ['Cabai Rawit Merah', 'buah', 0, 'Bumbu'],
      ['Cabe Merah Keriting', 'kg', 52071, 'Bumbu'],
      ['Daun Jeruk', 'pack', 2000, 'Bumbu'],
      ['Daun Salam', 'pack', 2000, 'Bumbu'],
      ['Garam', 'bungkus', 3000, 'Bumbu'],
      ['Jahe', 'pack', 3000, 'Bumbu'],
      ['Kemiri', 'pack', 5000, 'Bumbu'],
      ['Ketumbar', 'kg', 50000, 'Bumbu'],
      ['Kunyit', 'pack', 3000, 'Bumbu'],
      ['Lengkuas', 'pack', 3000, 'Bumbu'],
      ['Serai', 'ikat', 3000, 'Bumbu'],
      ['Air untuk kuah', 'secukupnya', 0, 'Lainnya'],
      ['Bahan Kuah ;', 'secukupnya', 0, 'Lainnya'],
      ['Bawang Bombay kecil', 'buah', 0, 'Lainnya'],
      ['Bawang Goreng', 'kg', 50000, 'Lainnya'],
      ['Bumbu Rendang Jadi', 'bungkus', 0, 'Lainnya'],
      ['Bumbu Sayur Asem', 'bungkus', 0, 'Lainnya'],
      ['Cabe Rawit Merah', 'kg', 110310, 'Lainnya'],
      ['Caramel', 'secukupnya', 0, 'Lainnya'],
      ['Coklat Meses', 'sdm', 0, 'Lainnya'],
      ['Daun bawang', 'secukupnya', 0, 'Lainnya'],
      ['Es batu', 'gelas', 0, 'Lainnya'],
      ['Fanta stroberi', 'ml', 0, 'Lainnya'],
      ['Gelatin Bubuk, tambah 2 sdm air aduk rata tim sampai larut', 'sdm', 0, 'Lainnya'],
      ['Gula Merah (sy pake yg cair)', 'gr', 0, 'Lainnya'],
      ['Gula dan garam', 'secukupnya', 0, 'Lainnya'],
      ['Jagung Manis', 'buah', 0, 'Lainnya'],
      ['Jeruk Nipis', 'buah', 0, 'Lainnya'],
      ['Kacang Tanah', 'kg', 28000, 'Lainnya'],
      ['Kecap Asin', 'botol', 20000, 'Lainnya'],
      ['Kecap Manis', 'botol', 26500, 'Lainnya'],
      ['Kental manis Cap Enaak', 'sdm', 0, 'Lainnya'],
      ['Kulit Lumpia', 'lembar', 0, 'Lainnya'],
      ['Melinjo', 'genggam', 0, 'Lainnya'],
      ['Minyak untuk menumis', 'secukupnya', 0, 'Lainnya'],
      ['Nata de Coco', 'sdm', 0, 'Lainnya'],
      ['Nutrijel Mangga', 'bungkus', 0, 'Lainnya'],
      ['Pisang Uli', 'buah', 0, 'Lainnya'],
      ['Sambal', 'botol', 12000, 'Lainnya'],
      ['Santan', 'kemasan', 5000, 'Lainnya'],
      ['Santan Kental', 'liter', 0, 'Lainnya'],
      ['Sarden merk apa aja', 'kaleng', 0, 'Lainnya'],
      ['Seruas kunyit', 'secukupnya', 0, 'Lainnya'],
      ['Susu Full Cream', 'ml', 0, 'Lainnya'],
      ['Susu Kental Manis', 'sdm', 0, 'Lainnya'],
      ['Susu UHT', 'liter', 0, 'Lainnya'],
      ['Terasi Udang', 'sdt', 0, 'Lainnya'],
      ['Totole atau Masako / Garam', 'secukupnya', 0, 'Lainnya'],
      ['Udang Kupas', 'gram', 0, 'Lainnya'],
      ['Vanila Paste', 'sdt', 0, 'Lainnya'],
      ['Vanili', 'sdt', 0, 'Lainnya'],
      ['Whipping Cream Cair', 'ml', 0, 'Lainnya'],
      ['air(untuk gelatin)', 'sdm', 0, 'Lainnya'],
      ['cabai keriting diiris kecil-kecil', 'buah', 0, 'Lainnya'],
      ['daun salam dan jeruk', 'lembar', 0, 'Lainnya'],
      ['es batu dan grass jelly buat topping', 'secukupnya', 0, 'Lainnya'],
      ['gelatin bubuk(ada tulisan halalnya)', 'sdt', 0, 'Lainnya'],
      ['ikan kembung', 'ekor', 0, 'Lainnya'],
      ['jawa larutkan dengan sedikit air', 'sdm', 0, 'Lainnya'],
      ['kaldu bubuk', 'secukupnya', 0, 'Lainnya'],
      ['kuning telur(optional,bisa skip)', 'butir', 0, 'Lainnya'],
      ['lada bubuk', 'sdt', 0, 'Lainnya'],
      ['nutrijel plain', 'sdt', 0, 'Lainnya'],
      ['pakcoy', 'bonggol', 0, 'Lainnya'],
      ['saus tiram', 'sdm', 0, 'Lainnya'],
      ['sereh', 'batang', 0, 'Lainnya'],
      ['susu cair full cream', 'ml', 0, 'Lainnya'],
      ['tahu putih', 'bh', 0, 'Lainnya'],
      ['teh tubruk', 'sdm', 0, 'Lainnya'],
      ['tomat ijo', 'buah', 0, 'Lainnya'],
      ['Beras IR. I (IR 64)', 'kg', 15511, 'Pokok'],
      ['Gula', 'kg', 18500, 'Pokok'],
      ['Gula Pasir', 'sdm', 0, 'Pokok'],
      ['Mie Instan', 'pcs', 3500, 'Pokok'],
      ['Minyak Goreng (Kuning/Curah)', 'kg', 20463, 'Pokok'],
      ['Tepung Tapioka', 'kg', 12000, 'Pokok'],
      ['Tepung Terigu', 'kg', 12000, 'Pokok'],
      ['Ayam Negeri', 'ekor', 0, 'Protein'],
      ['Daging Ayam Broiler', 'kg', 40000, 'Protein'],
      ['Daging Sapi', 'kg', 148000, 'Protein'],
      ['Ikan', 'kg', 50000, 'Protein'],
      ['Ikan Nila', 'ekor', 0, 'Protein'],
      ['Lele', 'kg', 35000, 'Protein'],
      ['Tahu', 'pcs', 5000, 'Protein'],
      ['Telur Ayam Ras', 'kg', 30000, 'Protein'],
      ['Tempe', 'pcs', 8000, 'Protein'],
      ['Udang', 'kg', 90000, 'Protein'],
      ['Jagung', 'pcs', 5000, 'Sayuran'],
      ['Kacang Panjang', 'ikat', 7000, 'Sayuran'],
      ['Kangkung', 'ikat', 7000, 'Sayuran'],
      ['Kembang Kol', 'bonggol', 0, 'Sayuran'],
      ['Kentang', 'kg', 18500, 'Sayuran'],
      ['Kol', 'pcs', 10000, 'Sayuran'],
      ['Labu Siam', 'pcs', 5000, 'Sayuran'],
      ['Sawi', 'ikat', 5000, 'Sayuran'],
      ['Sawi Putih', 'lembar', 0, 'Sayuran'],
      ['Tauge', 'kg', 10000, 'Sayuran'],
      ['Tomat', 'kg', 18500, 'Sayuran'],
      ['Wortel', 'kg', 20000, 'Sayuran']
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
    if (client) client.release();
  }
}

module.exports = { seed };
