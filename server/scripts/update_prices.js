require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // reliably load `.env` from root
const { pool } = require('../db');

const ingredientsUpdate = [
  // Pokok
  ['Beras', 'kg', 14000, 'Pokok'],
  ['Mie Instan', 'pcs', 3500, 'Pokok'],
  ['Tepung Tapioka', 'kg', 12000, 'Pokok'],
  ['Tepung Terigu', 'kg', 12000, 'Pokok'],
  // Protein
  ['Ayam', 'kg', 45000, 'Protein'],
  ['Daging Sapi', 'kg', 148000, 'Protein'],
  ['Telur', 'pcs', 2000, 'Protein'],
  ['Tempe', 'pcs', 8000, 'Protein'],
  ['Tahu', 'pcs', 5000, 'Protein'],
  ['Lele', 'kg', 35000, 'Protein'],
  ['Ikan', 'kg', 50000, 'Protein'],
  ['Udang', 'kg', 90000, 'Protein'],
  // Sayuran
  ['Wortel', 'kg', 20000, 'Sayuran'],
  ['Kol', 'pcs', 10000, 'Sayuran'],
  ['Sawi', 'ikat', 5000, 'Sayuran'],
  ['Tauge', 'kg', 10000, 'Sayuran'],
  ['Kacang Panjang', 'ikat', 7000, 'Sayuran'],
  ['Kentang', 'kg', 18500, 'Sayuran'],
  ['Jagung', 'pcs', 5000, 'Sayuran'],
  ['Labu Siam', 'pcs', 5000, 'Sayuran'],
  ['Tomat', 'kg', 18500, 'Sayuran'],
  ['Kangkung', 'ikat', 7000, 'Sayuran'],
  // Bumbu
  ['Bawang Merah', 'kg', 51500, 'Bumbu'],
  ['Bawang Putih', 'kg', 43500, 'Bumbu'],
  ['Cabai', 'kg', 80000, 'Bumbu'],
  ['Kunyit', 'pack', 3000, 'Bumbu'],
  ['Lengkuas', 'pack', 3000, 'Bumbu'],
  ['Serai', 'ikat', 3000, 'Bumbu'],
  ['Daun Jeruk', 'pack', 2000, 'Bumbu'],
  ['Daun Salam', 'pack', 2000, 'Bumbu'],
  ['Kemiri', 'pack', 5000, 'Bumbu'],
  ['Ketumbar', 'kg', 50000, 'Bumbu'],
  ['Asam Jawa', 'kg', 25000, 'Bumbu'],
  ['Jahe', 'pack', 3000, 'Bumbu'],
  // Lainnya
  ['Santan', 'kemasan', 5000, 'Lainnya'],
  ['Kecap Manis', 'botol', 26500, 'Lainnya'],
  ['Minyak Goreng', 'liter', 20500, 'Lainnya'],
  ['Garam', 'bungkus', 3000, 'Lainnya'],
  ['Gula', 'kg', 18500, 'Lainnya'],
  ['Kecap Asin', 'botol', 20000, 'Lainnya'],
  ['Kacang Tanah', 'kg', 28000, 'Lainnya'],
  ['Bawang Goreng', 'kg', 50000, 'Lainnya'],
  ['Sambal', 'botol', 12000, 'Lainnya'],
];

async function updatePrices() {
  const client = await pool.connect();
  try {
    console.log('Starting price update...');
    let updatedCount = 0;
    
    // Begin transaction
    await client.query('BEGIN');

    for (const [name, unit, price, category] of ingredientsUpdate) {
      const res = await client.query(
        'UPDATE ingredients SET price_per_unit = $1, unit = $2 WHERE name = $3 RETURNING id',
        [price, unit, name]
      );
      
      if (res.rowCount > 0) {
        updatedCount++;
        console.log(`Updated ${name}: Rp${price}/${unit}`);
      } else {
        console.log(`⚠️ Ingredient "${name}" not found in DB! Checking if we need to insert it...`);
        // Optionally insert if missing, though they should all be there from original seed
        const insertRes = await client.query(
          'INSERT INTO ingredients (name, unit, price_per_unit, category) VALUES ($1, $2, $3, $4) RETURNING id',
          [name, unit, price, category]
        );
        if (insertRes.rowCount > 0) {
            updatedCount++;
            console.log(`Inserted missing ${name}: Rp${price}/${unit}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ Successfully updated prices for ${updatedCount} ingredients.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating prices:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

updatePrices();
