const { pool } = require('./db');

/**
 * Append new diverse recipes to bekal_recipe_pool.
 * Adjusted to strictly reuse condiments and spices (no single-use ingredients).
 */
async function appendBekalPool() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Backfill protein_type on existing records by name pattern
    await client.query(`
      UPDATE bekal_recipe_pool SET protein_type =
        CASE
          WHEN name ILIKE '%ayam%'  THEN 'ayam'
          WHEN name ILIKE '%ikan%' OR name ILIKE '%dori%' THEN 'ikan'
          WHEN name ILIKE '%telur%' THEN 'telur'
          WHEN name ILIKE '%tempe%' THEN 'tempe'
          WHEN name ILIKE '%tahu%'  THEN 'tahu'
          WHEN name ILIKE '%sosis%' OR name ILIKE '%daging%' OR name ILIKE '%sapi%' THEN 'other_meat'
          ELSE 'other'
        END
      WHERE protein_type IS NULL AND category = 'protein'
    `);

    // Self-healing check: if we haven't inserted the budget recipes yet, drop the old free-form ones
    const { rows: check } = await client.query("SELECT COUNT(*) FROM bekal_recipe_pool WHERE name = 'Tahu Kecap Manis'");
    if (parseInt(check[0].count) === 0) {
      await client.query("DELETE FROM bekal_recipe_pool WHERE is_bumbu_free = true");
      console.log("Cleaned up old free-form recipes to replace with budget-friendly versions.");
    }

    // Force deletion of old Ikan/Nangka recipes and the buggy plan if they still exist
    const { rows: checkIkan } = await client.query("SELECT COUNT(*) FROM bekal_recipe_pool WHERE name ILIKE '%ikan%' OR name ILIKE '%nangka%'");
    if (parseInt(checkIkan[0].count) > 0) {
      await client.query("DELETE FROM bekal_recipe_pool WHERE name ILIKE '%ikan%' OR name ILIKE '%nangka%'");
      await client.query("DELETE FROM bekal_plans WHERE status = 'upcoming'");
      console.log("Cleaned up old ikan/nangka recipes and upcoming plans.");
    }

    const newRecipes = [
      // ── FREE-FORM AYAM ───────────────────────────────────────────────
      {
        name: 'Ayam Kecap Sederhana', category: 'protein',
        description: 'Ayam dimasak dengan kecap manis, bawang putih, dan jahe. Sangat mudah dibuat.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 25, kalori: 240,
        tips_bekal: 'Ayam kecap tahan lama. Cocok dimakan dengan nasi hangat.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Jahe (parut)', qty: 0.5, unit: 'ruas' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
          { name: 'Air', qty: 50, unit: 'ml' },
        ],
        steps: [
          'Potong ayam fillet, marinasi dengan kecap, garam 10 menit.',
          'Panaskan minyak, tumis bawang putih dan jahe sampai harum.',
          'Masukkan ayam beserta marinasi, aduk rata.',
          'Tambahkan air, masak api sedang sampai air menyusut.',
          'Angkat dan sajikan.',
        ],
      },
      {
        name: 'Ayam Geprek Bawang', category: 'protein',
        description: 'Ayam goreng tepung yang digeprek lalu dilumuri sambal bawang. Renyah, pedas.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 290,
        tips_bekal: 'Bungkus ayam dan sambal terpisah agar ayam tetap renyah.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Tepung terigu', qty: 3, unit: 'sdm' },
          { name: 'Tepung maizena', qty: 1, unit: 'sdm' },
          { name: 'Bawang putih', qty: 4, unit: 'siung' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Cabai rawit merah', qty: 5, unit: 'buah' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Geprek 2 bawang putih, marinasi ayam dengan bawang geprek dan garam 15 menit.',
          'Balut ayam dengan campuran tepung terigu dan tepung maizena.',
          'Goreng ayam di minyak panas sampai keemasan dan matang.',
          'Ulek kasar cabai rawit dan sisa bawang putih untuk sambal.',
          'Tumis sambal sebentar, geprek ayam goreng, lumuri dengan sambal.',
        ],
      },
      {
        name: 'Ayam Semur Jawa', category: 'protein',
        description: 'Ayam dimasak kental berbumbu kecap, pala, dan cengkeh. Manis-gurih.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 35, kalori: 250,
        tips_bekal: 'Semur makin enak setelah bumbu meresap. Bawa kuah sedikit.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Bawang merah', qty: 3, unit: 'siung' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Kecap manis', qty: 3, unit: 'sdm' },
          { name: 'Pala bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Cengkeh', qty: 2, unit: 'buah' },
          { name: 'Gula merah', qty: 5, unit: 'gram' },
          { name: 'Air', qty: 100, unit: 'ml' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Tumis bawang merah dan bawang putih sampai harum.',
          'Masukkan ayam, kecap, pala, cengkeh, dan gula merah.',
          'Tuang air, masak api kecil sambil diaduk.',
          'Koreksi rasa. Angkat saat ayam empuk dan kuah kental.',
        ],
      },
      {
        name: 'Ayam Rica-Rica', category: 'protein',
        description: 'Ayam tumis pedas dengan serai, dan daun jeruk. Harum dan menggugah selera.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 265,
        tips_bekal: 'Rica-rica tahan cukup lama. Simpan dalam wadah tertutup.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Cabai merah keriting', qty: 4, unit: 'buah' },
          { name: 'Cabai rawit merah', qty: 3, unit: 'buah' },
          { name: 'Bawang merah', qty: 4, unit: 'siung' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Serai', qty: 1, unit: 'batang' },
          { name: 'Daun jeruk', qty: 3, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Potong ayam menjadi potongan kecil, goreng sebentar.',
          'Haluskan cabai, bawang merah, dan bawang putih.',
          'Tumis bumbu halus bersama serai dan daun jeruk sampai harum.',
          'Tambahkan ayam, aduk rata dan masak sampai matang.',
          'Koreksi garam, angkat.',
        ],
      },
      {
        name: 'Ayam Goreng Mentega', category: 'protein',
        description: 'Ayam digoreng lalu ditumis dengan margarin, saus tiram, dan kecap manis.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 320,
        tips_bekal: 'Saus mentega sangat gurih. Jangan terlalu banyak air.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Bawang bombay', qty: 0.5, unit: 'buah' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Kecap manis', qty: 1, unit: 'sdm' },
          { name: 'Saus tiram', qty: 1, unit: 'sdm' },
          { name: 'Kecap asin', qty: 1, unit: 'sdt' },
          { name: 'Margarin', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Potong ayam, goreng sebentar sampai matang. Sisihkan.',
          'Panaskan margarin, tumis bawang bombay dan bawang putih.',
          'Masukkan kecap manis, saus tiram, dan kecap asin.',
          'Masukkan ayam goreng, aduk cepat hingga rata.',
          'Angkat dan sajikan.',
        ],
      },
      {
        name: 'Ayam Suwir Cabai Garam', category: 'protein',
        description: 'Ayam suwir gurih pedas ditumis dengan cabai, bawang, dan daun jeruk.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 270,
        tips_bekal: 'Ayam suwir sangat mudah dimakan dari kotak bekal.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Bawang merah', qty: 4, unit: 'siung' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Cabai merah keriting', qty: 3, unit: 'buah' },
          { name: 'Cabai rawit merah', qty: 3, unit: 'buah' },
          { name: 'Daun jeruk', qty: 2, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Rebus/goreng ayam hingga matang, lalu suwir-suwir.',
          'Iris tipis bawang merah, bawang putih, dan cabai.',
          'Tumis bawang dan cabai bersama daun jeruk hingga harum.',
          'Masukkan ayam suwir dan garam.',
          'Aduk rata hingga agak kering, angkat.',
        ],
      },
      {
        name: 'Ayam Bakar Kecap Bawang', category: 'protein',
        description: 'Ayam diungkep lalu dibakar. Harum dengan rasa manis gurih.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 35, kalori: 230,
        tips_bekal: 'Ayam bakar tahan lama dan tidak mudah basi.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Bawang merah', qty: 3, unit: 'siung' },
          { name: 'Ketumbar bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Margarin', qty: 0.5, unit: 'sdm' },
        ],
        steps: [
          'Campurkan kecap, bawang putih, bawang merah, ketumbar, dan garam. Marinasi ayam.',
          'Rebus ayam beserta marinasi dengan sedikit air sampai matang.',
          'Panaskan teflon dengan margarin.',
          'Bakar ayam sambil dioles sisa bumbu, balik hingga kecokelatan.',
        ],
      },
      {
        name: 'Ayam Crispy Saus Asam Manis', category: 'protein',
        description: 'Ayam goreng tepung siram saus tomat asam manis segar.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 35, kalori: 300,
        tips_bekal: 'Kemas ayam dan saus terpisah.',
        ingredients: [
          { name: 'Ayam fillet', qty: 150, unit: 'gram' },
          { name: 'Tepung terigu', qty: 3, unit: 'sdm' },
          { name: 'Tepung maizena', qty: 1, unit: 'sdm' },
          { name: 'Telur', qty: 0.5, unit: 'butir' },
          { name: 'Saus tomat', qty: 2, unit: 'sdm' },
          { name: 'Cuka masak', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 1, unit: 'sdt' },
          { name: 'Bawang bombay', qty: 0.25, unit: 'buah' },
          { name: 'Nanas', qty: 30, unit: 'gram' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Marinasi ayam. Celup telur, balut campuran tepung, goreng matang. Tiriskan.',
          'Tumis bawang bombay. Masukkan saus tomat, cuka, gula, nanas, dan air.',
          'Masak saus sampai mengental.',
          'Masukkan ayam goreng, aduk cepat. Angkat segera.',
        ],
      },
      {
        name: 'Ayam Cabai Hijau', category: 'protein',
        description: 'Ayam tumis irisan cabai hijau besar dan bawang.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 25, kalori: 245,
        tips_bekal: 'Gunakan wadah kedap udara.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Cabai hijau besar', qty: 4, unit: 'buah' },
          { name: 'Bawang merah', qty: 4, unit: 'siung' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Serai', qty: 1, unit: 'batang' },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Tumis bawang merah, bawang putih, serai, dan daun salam sampai harum.',
          'Masukkan ayam, aduk sampai berubah warna.',
          'Tambahkan cabai hijau iris, aduk rata.',
          'Masak sampai ayam matang dan cabai layu. Angkat.',
        ],
      },
      {
        name: 'Ayam Goreng Kalasan', category: 'protein',
        description: 'Ayam ungkep rempah gurih manis, digoreng.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 40, kalori: 270,
        tips_bekal: 'Ayam goreng sangat tahan lama.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Air', qty: 150, unit: 'ml' },
          { name: 'Bawang putih', qty: 4, unit: 'siung' },
          { name: 'Ketumbar bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Kunyit bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Gula merah', qty: 5, unit: 'gram' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Haluskan bawang putih. Campurkan dengan ketumbar, kunyit, gula, dan garam.',
          'Ungkep ayam dengan bumbu, daun salam, dan air sampai air habis.',
          'Dinginkan ayam sebentar.',
          'Goreng ayam di minyak panas sampai keemasan.',
        ],
      },
      {
        name: 'Ayam Teriyaki Sederhana', category: 'protein',
        description: 'Ayam saus teriyaki ala rumahan — kecap asin, manis, jahe.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 25, kalori: 250,
        tips_bekal: 'Saus teriyaki meresap baik.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap asin', qty: 1, unit: 'sdm' },
          { name: 'Kecap manis', qty: 1, unit: 'sdm' },
          { name: 'Gula pasir', qty: 1, unit: 'sdt' },
          { name: 'Jahe (parut)', qty: 0.5, unit: 'ruas' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Campurkan kecap asin, kecap manis, gula, jahe, dan bawang putih jadi saus.',
          'Marinasi ayam dengan setengah saus selama 15 menit.',
          'Panggang/bakar ayam di teflon sampai matang.',
          'Tuang sisa saus, masak sampai saus mengental.',
        ],
      },
      // ── FREE-FORM TAHU/TELUR (BUDGET) ───────────────────────────────
      {
        name: 'Tahu Kecap Manis', category: 'protein',
        description: 'Tahu putih goreng saus kecap manis bawang putih. Sangat cepat dan murah.',
        protein_type: 'tahu', is_bumbu_free: true, estimasi_waktu: 15, kalori: 180,
        tips_bekal: 'Goreng tahu sampai berkulit agar bumbu lebih meresap dan tahu tidak hancur.',
        ingredients: [
          { name: 'Tahu putih (potong dadu)', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Jahe', qty: 0.5, unit: 'ruas' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
        ],
        steps: [
          'Goreng tahu putih di minyak panas sampai berkulit. Angkat dan sisihkan.',
          'Tumis bawang putih dan jahe sampai harum.',
          'Masukkan kecap manis, garam, dan sedikit air. Didihkan.',
          'Masukkan tahu goreng, aduk sampai air menyusut dan bumbu meresap. Angkat.',
        ],
      },
      {
        name: 'Telur Dadar Asam Manis', category: 'protein',
        description: 'Telur dadar tebal siram saus tomat asam manis.',
        protein_type: 'telur', is_bumbu_free: true, estimasi_waktu: 15, kalori: 220,
        tips_bekal: 'Telur dadar awet dan enak dimakan dengan saus asam manis.',
        ingredients: [
          { name: 'Telur ayam', qty: 2, unit: 'butir' },
          { name: 'Saus tomat', qty: 2, unit: 'sdm' },
          { name: 'Bawang bombay', qty: 0.25, unit: 'buah' },
          { name: 'Nanas', qty: 30, unit: 'gram' },
          { name: 'Gula pasir', qty: 1, unit: 'sdt' },
          { name: 'Cuka masak', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Kocok telur dengan sedikit garam, buat dadar tebal, lalu potong-potong. Sisihkan.',
          'Tumis bawang bombay, masukkan saus tomat, nanas, gula, cuka, dan air.',
          'Masak sampai saus mengental.',
          'Sajikan telur dadar dengan siraman saus asam manis.',
        ],
      },
      // ── FREE-FORM TELUR ──────────────────────────────────────────────
      {
        name: 'Telur Semur Kecap', category: 'protein',
        description: 'Telur rebus dalam kuah semur kecap gurih.',
        protein_type: 'telur', is_bumbu_free: true, estimasi_waktu: 20, kalori: 180,
        tips_bekal: 'Makin enak direndam lama.',
        ingredients: [
          { name: 'Telur ayam', qty: 2, unit: 'butir' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang merah', qty: 3, unit: 'siung' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Pala bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Cengkeh', qty: 1, unit: 'buah' },
          { name: 'Gula merah', qty: 3, unit: 'gram' },
          { name: 'Air', qty: 100, unit: 'ml' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Rebus telur, kupas. Goreng sebentar sampai berkulit.',
          'Tumis bawang merah dan bawang putih harum.',
          'Masukkan kecap, pala, cengkeh, gula, dan air.',
          'Masukkan telur, masak api kecil sampai mengental.',
        ],
      },
      // ── FREE-FORM SAYURAN ────────────────────────────────────────────
      {
        name: 'Tumis Buncis Saus Tiram', category: 'sayuran',
        description: 'Buncis tumis bawang dan saus tiram.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 80,
        tips_bekal: 'Masak buncis jangan terlalu lama.',
        ingredients: [
          { name: 'Buncis', qty: 100, unit: 'gram' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Saus tiram', qty: 1, unit: 'sdm' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Cuci dan potong buncis.',
          'Tumis bawang putih hingga harum.',
          'Masukkan buncis, tumis api besar.',
          'Beri saus tiram dan garam. Angkat.',
        ],
      },
      {
        name: 'Cah Kangkung Saus Tiram', category: 'sayuran',
        description: 'Kangkung tumis saus tiram dan kecap asin.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 10, kalori: 70,
        tips_bekal: 'Masak kangkung sebentar agar tidak hitam.',
        ingredients: [
          { name: 'Kangkung', qty: 100, unit: 'gram' },
          { name: 'Bawang putih', qty: 4, unit: 'siung' },
          { name: 'Saus tiram', qty: 1, unit: 'sdm' },
          { name: 'Kecap asin', qty: 0.5, unit: 'sdt' },
          { name: 'Cabai merah keriting', qty: 1, unit: 'buah' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1.5, unit: 'sdm' },
        ],
        steps: [
          'Tumis bawang putih dan cabai sampai harum.',
          'Masukkan kangkung, aduk cepat api besar.',
          'Tambahkan saus tiram, kecap asin, dan gula.',
          'Aduk layu. Angkat segera.',
        ],
      },
      {
        name: 'Tumis Wortel Jagung Manis', category: 'sayuran',
        description: 'Wortel dan jagung tumis kecap asin.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 90,
        tips_bekal: 'Wortel sangat tahan lama.',
        ingredients: [
          { name: 'Wortel', qty: 80, unit: 'gram' },
          { name: 'Jagung manis', qty: 30, unit: 'gram' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Bawang bombay', qty: 0.25, unit: 'buah' },
          { name: 'Kecap asin', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Tumis bawang bombay dan bawang putih layu.',
          'Masukkan wortel, tumis lunak.',
          'Tambahkan jagung manis, beri kecap asin dan garam.',
          'Masak sebentar. Angkat.',
        ],
      },
      {
        name: 'Sup Bening Sayuran', category: 'sayuran',
        description: 'Sup bening tahu, wortel, buncis segar.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 20, kalori: 85,
        tips_bekal: 'Bawa kuah terpisah.',
        ingredients: [
          { name: 'Tahu', qty: 50, unit: 'gram' },
          { name: 'Wortel', qty: 40, unit: 'gram' },
          { name: 'Buncis', qty: 40, unit: 'gram' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Bawang merah', qty: 2, unit: 'siung' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Air', qty: 300, unit: 'ml' },
        ],
        steps: [
          'Didihkan air, masukkan bawang merah dan bawang putih.',
          'Masukkan wortel, masak lunak.',
          'Tambahkan tahu dan buncis.',
          'Beri garam. Angkat.',
        ],
      },
      {
        name: 'Tumis Kacang Panjang Telur', category: 'sayuran',
        description: 'Kacang panjang tumis telur.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 110,
        tips_bekal: 'Mengenyangkan.',
        ingredients: [
          { name: 'Kacang panjang', qty: 80, unit: 'gram' },
          { name: 'Telur ayam', qty: 1, unit: 'butir' },
          { name: 'Bawang merah', qty: 3, unit: 'siung' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Cabai rawit merah', qty: 2, unit: 'buah' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Tumis bawang dan cabai harum.',
          'Masukkan kacang panjang.',
          'Sisihkan kacang, orak-arik telur di pinggir.',
          'Aduk rata dengan garam. Angkat.',
        ],
      },
      {
        name: 'Tumis Tauge Tahu', category: 'sayuran',
        description: 'Tauge tumis tahu kecap asin.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 12, kalori: 95,
        tips_bekal: 'Masak sebentar agar renyah.',
        ingredients: [
          { name: 'Tauge', qty: 80, unit: 'gram' },
          { name: 'Tahu', qty: 50, unit: 'gram' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Kecap asin', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Goreng tahu sampai keemasan.',
          'Tumis bawang putih.',
          'Masukkan tahu dan tauge.',
          'Beri kecap asin dan garam. Angkat.',
        ],
      },
      {
        name: 'Oseng Tempe Cabai Hijau', category: 'sayuran',
        description: 'Tempe tumis cabai hijau besar.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 105,
        tips_bekal: 'Sangat awet.',
        ingredients: [
          { name: 'Tempe', qty: 80, unit: 'gram' },
          { name: 'Cabai hijau besar', qty: 3, unit: 'buah' },
          { name: 'Bawang merah', qty: 3, unit: 'siung' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Kecap manis', qty: 0.5, unit: 'sdm' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Goreng tempe sebentar.',
          'Tumis bawang harum, masukkan cabai hijau layu.',
          'Masukkan tempe, kecap, garam. Aduk.',
        ],
      },
      {
        name: 'Bening Bayam Jagung Manis', category: 'sayuran',
        description: 'Sayur bening segar bayam dan jagung manis.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 20, kalori: 75,
        tips_bekal: 'Sangat segar.',
        ingredients: [
          { name: 'Bayam', qty: 40, unit: 'gram' },
          { name: 'Jagung manis', qty: 30, unit: 'gram' },
          { name: 'Bawang merah', qty: 3, unit: 'siung' },
          { name: 'Bawang putih', qty: 2, unit: 'siung' },
          { name: 'Gula pasir', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Air', qty: 350, unit: 'ml' },
        ],
        steps: [
          'Didihkan air.',
          'Masukkan bawang, jagung manis, gula, garam.',
          'Setelah jagung matang, masukkan bayam.',
          'Angkat segera agar tetap hijau.',
        ],
      },
    ];

    // Insert all new recipes
    let added = 0;
    for (const recipe of newRecipes) {
      const { rows: recipeRows } = await client.query(
        `INSERT INTO bekal_recipe_pool (name, description, category, bumbu_dasar_id, estimasi_waktu, kalori_estimasi, tips_bekal, protein_type, is_bumbu_free)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [recipe.name, recipe.description, recipe.category, null, recipe.estimasi_waktu, recipe.kalori, recipe.tips_bekal, recipe.protein_type, recipe.is_bumbu_free]
      );

      if (recipeRows.length === 0) continue; // already exists
      const poolId = recipeRows[0].id;
      added++;

      // Bulk insert ingredients
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        const ingValues = [];
        const ingParams = [];
        let paramIdx = 1;
        recipe.ingredients.forEach((ing, j) => {
          ingValues.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
          ingParams.push(poolId, ing.name, ing.qty, ing.unit, false, j);
        });
        await client.query(
          `INSERT INTO bekal_pool_ingredients (pool_recipe_id, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order) VALUES ${ingValues.join(', ')}`,
          ingParams
        );
      }

      // Bulk insert steps
      if (recipe.steps && recipe.steps.length > 0) {
        const stepValues = [];
        const stepParams = [];
        let paramIdx = 1;
        recipe.steps.forEach((step, k) => {
          stepValues.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
          stepParams.push(poolId, k + 1, step);
        });
        await client.query(
          `INSERT INTO bekal_pool_steps (pool_recipe_id, step_number, instruction) VALUES ${stepValues.join(', ')}`,
          stepParams
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Bekal pool migration complete: ${added} refined recipes added.`);
    return added;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in appendBekalPool migration:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { appendBekalPool };
