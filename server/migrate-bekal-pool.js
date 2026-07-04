const { pool } = require('./db');

/**
 * Append new diverse recipes to bekal_recipe_pool.
 * Uses ON CONFLICT (name) DO NOTHING — fully idempotent.
 * Also backfills protein_type on existing records.
 */
async function appendBekalPool() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Backfill protein_type on existing records by name pattern
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

    // 2. New recipes list
    const newRecipes = [
      // ── FREE-FORM AYAM ───────────────────────────────────────────────
      {
        name: 'Ayam Kecap Sederhana', category: 'protein',
        description: 'Ayam paha fillet dimasak dengan kecap manis, bawang putih, dan jahe. Manis, gurih, sangat mudah dibuat.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 25, kalori: 240,
        tips_bekal: 'Ayam kecap tahan 6-8 jam di suhu ruang. Cocok dimakan dengan nasi putih hangat.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih (cincang)', qty: 3, unit: 'siung' },
          { name: 'Jahe (parut)', qty: 0.5, unit: 'ruas' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Merica bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
          { name: 'Air', qty: 50, unit: 'ml' },
        ],
        steps: [
          'Potong ayam fillet menjadi 4-5 potongan, marinasi dengan kecap, garam, dan merica 10 menit.',
          'Panaskan minyak, tumis bawang putih dan jahe sampai harum.',
          'Masukkan ayam beserta marinasi, aduk rata.',
          'Tambahkan air, masak api sedang sambil sesekali diaduk.',
          'Masak sampai air menyusut dan bumbu mengental melapisi ayam.',
          'Angkat dan sajikan.',
        ],
      },
      {
        name: 'Ayam Geprek Sambal Bawang', category: 'protein',
        description: 'Ayam goreng tepung yang digeprek lalu dilumuri sambal bawang. Renyah, pedas, dan sangat populer.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 290,
        tips_bekal: 'Bungkus ayam dan sambal terpisah agar ayam tetap renyah. Geprek saat akan dimakan.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Tepung terigu', qty: 3, unit: 'sdm' },
          { name: 'Tepung beras', qty: 1, unit: 'sdm' },
          { name: 'Bawang putih (untuk marinasi)', qty: 2, unit: 'siung' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Cabai rawit (sambal)', qty: 5, unit: 'buah' },
          { name: 'Bawang putih (sambal)', qty: 2, unit: 'siung' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Geprek bawang putih, marinasi ayam dengan bawang geprek dan garam 15 menit.',
          'Balut ayam dengan campuran tepung terigu dan tepung beras.',
          'Goreng ayam di minyak panas sedang sampai keemasan dan matang.',
          'Ulek kasar cabai rawit dan bawang putih untuk sambal bawang.',
          'Tumis sambal dengan sedikit minyak, beri garam dan gula.',
          'Geprek ayam goreng, lumuri dengan sambal bawang.',
        ],
      },
      {
        name: 'Ayam Semur Jawa', category: 'protein',
        description: 'Ayam dimasak dalam kuah semur kental berbumbu kecap, pala, dan cengkeh. Rasa manis-gurih khas Jawa.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 35, kalori: 250,
        tips_bekal: 'Semur makin enak setelah dingin dan bumbu meresap. Bawa kuah terpisah.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Bawang merah (iris)', qty: 3, unit: 'siung' },
          { name: 'Bawang putih (cincang)', qty: 2, unit: 'siung' },
          { name: 'Kecap manis', qty: 3, unit: 'sdm' },
          { name: 'Pala bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Cengkeh', qty: 2, unit: 'buah' },
          { name: 'Gula merah (sisir)', qty: 5, unit: 'gram' },
          { name: 'Air', qty: 100, unit: 'ml' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Goreng ayam sebentar sampai berkulit keemasan, angkat.',
          'Tumis bawang merah dan bawang putih sampai harum.',
          'Masukkan ayam, kecap, pala, cengkeh, dan gula merah.',
          'Tuang air, masak api kecil sambil diaduk hingga kuah mengental.',
          'Koreksi rasa. Angkat saat ayam empuk dan kuah kental.',
        ],
      },
      {
        name: 'Ayam Rica-Rica', category: 'protein',
        description: 'Ayam tumis pedas ala Manado dengan cabai merah, serai, dan daun jeruk. Harum dan sangat menggugah selera.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 265,
        tips_bekal: 'Rica-rica tahan cukup lama. Simpan dalam wadah tertutup rapat.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Cabai merah keriting', qty: 4, unit: 'buah' },
          { name: 'Cabai rawit merah', qty: 3, unit: 'buah' },
          { name: 'Bawang merah', qty: 4, unit: 'siung' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
          { name: 'Daun jeruk', qty: 3, unit: 'lembar' },
          { name: 'Tomat (potong)', qty: 50, unit: 'gram' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Potong ayam menjadi potongan kecil, goreng sebentar sampai setengah matang.',
          'Haluskan cabai, bawang merah, dan bawang putih.',
          'Tumis bumbu halus bersama serai dan daun jeruk sampai harum.',
          'Masukkan tomat, masak sampai layu.',
          'Tambahkan ayam, aduk rata dan masak sampai matang dan bumbu meresap.',
          'Koreksi garam, angkat.',
        ],
      },
      {
        name: 'Ayam Bakar Kecap Bawang', category: 'protein',
        description: 'Ayam yang diungkep bumbu bawang dan kecap lalu dibakar di teflon. Harum dengan rasa manis gurih.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 35, kalori: 230,
        tips_bekal: 'Ayam bakar tahan lama dan tidak mudah basi. Simpan terpisah dari nasi.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih (geprek)', qty: 3, unit: 'siung' },
          { name: 'Bawang merah (iris)', qty: 3, unit: 'siung' },
          { name: 'Ketumbar bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Margarin', qty: 0.5, unit: 'sdm' },
        ],
        steps: [
          'Campurkan kecap, bawang putih, bawang merah, ketumbar, dan garam. Marinasi ayam 20 menit.',
          'Rebus ayam beserta marinasi dengan sedikit air sampai matang dan air menyusut.',
          'Panaskan teflon dengan margarin.',
          'Bakar ayam sambil dioles sisa bumbu, balik hingga kecokelatan.',
          'Angkat dan sajikan.',
        ],
      },
      {
        name: 'Kalio Ayam Sederhana', category: 'protein',
        description: 'Ayam dimasak dalam santan dan rempah tanpa direndang penuh — kuah kuning kental, mirip rendang basah.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 40, kalori: 310,
        tips_bekal: 'Kalio sangat awet karena santan kental. Bekukan jika tidak langsung dimakan.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Santan kental', qty: 100, unit: 'ml' },
          { name: 'Bawang putih', qty: 3, unit: 'siung' },
          { name: 'Bawang merah', qty: 4, unit: 'siung' },
          { name: 'Kunyit bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Ketumbar bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Gula merah (sisir)', qty: 3, unit: 'gram' },
        ],
        steps: [
          'Haluskan bawang merah, bawang putih, kunyit, dan ketumbar.',
          'Tumis bumbu halus bersama serai dan daun salam sampai harum.',
          'Masukkan ayam, aduk rata dengan bumbu.',
          'Tuang santan, aduk perlahan. Masak api kecil sambil terus diaduk agar santan tidak pecah.',
          'Tambahkan garam dan gula merah. Masak sampai santan mengental dan ayam matang.',
          'Angkat saat kuah kental kekuningan.',
        ],
      },
      {
        name: 'Sate Ayam Kecap Teflon', category: 'protein',
        description: 'Sate ayam yang dimasak di teflon tanpa perlu arang. Bumbu kecap kacang sederhana dan lezat.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 30, kalori: 260,
        tips_bekal: 'Lepas dari tusuk sate untuk dikemas. Saus kacang kemas terpisah.',
        ingredients: [
          { name: 'Ayam paha fillet (potong dadu)', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih (geprek)', qty: 2, unit: 'siung' },
          { name: 'Selai kacang (untuk saus)', qty: 2, unit: 'sdm' },
          { name: 'Kecap manis (saus)', qty: 1, unit: 'sdm' },
          { name: 'Air panas (saus)', qty: 50, unit: 'ml' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Marinasi ayam dengan kecap manis, bawang putih geprek, dan garam selama 15 menit.',
          'Tusuk ayam ke tusuk sate (3-4 potong per tusuk).',
          'Panaskan teflon dengan sedikit minyak, bakar sate sambil dioles kecap.',
          'Balik dan oles kedua sisi sampai matang dan berwarna kecokelatan.',
          'Buat saus kacang: campurkan selai kacang, kecap, air panas. Aduk rata.',
          'Sajikan sate dengan saus kacang terpisah.',
        ],
      },
      {
        name: 'Ayam Crispy Saus Asam Manis', category: 'protein',
        description: 'Potongan ayam goreng tepung yang disiram saus asam manis tomat. Segar, gurih, dan menarik.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 35, kalori: 300,
        tips_bekal: 'Kemas ayam dan saus terpisah. Siram saus saat akan dimakan agar ayam tetap renyah.',
        ingredients: [
          { name: 'Ayam fillet (potong bite-size)', qty: 150, unit: 'gram' },
          { name: 'Tepung terigu', qty: 3, unit: 'sdm' },
          { name: 'Tepung maizena', qty: 1, unit: 'sdm' },
          { name: 'Telur (kocok)', qty: 0.5, unit: 'butir' },
          { name: 'Saus tomat', qty: 2, unit: 'sdm' },
          { name: 'Cuka masak', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 1, unit: 'sdt' },
          { name: 'Paprika/cabai merah (potong)', qty: 30, unit: 'gram' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Marinasi ayam dengan garam dan merica. Celup ke telur kocok, lalu balut dengan campuran tepung.',
          'Goreng ayam sampai keemasan dan matang. Angkat, tiriskan.',
          'Tumis paprika dengan sedikit minyak. Masukkan saus tomat, cuka, gula, dan sedikit air.',
          'Aduk sampai saus mendidih dan mengental.',
          'Masukkan ayam goreng, aduk cepat sampai terbalut saus. Angkat segera.',
        ],
      },
      {
        name: 'Ayam Cabai Hijau', category: 'protein',
        description: 'Ayam tumis dengan irisan cabai hijau besar dan bawang yang harum. Pedas segar dan menyegarkan selera.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 25, kalori: 245,
        tips_bekal: 'Cocok dibawa sebagai lauk bekal. Gunakan wadah kedap udara.',
        ingredients: [
          { name: 'Ayam paha fillet (iris tipis)', qty: 150, unit: 'gram' },
          { name: 'Cabai hijau besar (iris serong)', qty: 4, unit: 'buah' },
          { name: 'Bawang merah (iris)', qty: 4, unit: 'siung' },
          { name: 'Bawang putih (geprek)', qty: 3, unit: 'siung' },
          { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Tumis bawang merah, bawang putih, serai, dan daun salam sampai harum.',
          'Masukkan ayam, aduk dan masak sampai berubah warna.',
          'Tambahkan cabai hijau, aduk rata.',
          'Beri garam dan sedikit air jika perlu.',
          'Masak sampai ayam matang dan cabai layu. Koreksi rasa. Angkat.',
        ],
      },
      {
        name: 'Ayam Goreng Kalasan', category: 'protein',
        description: 'Ayam yang diungkep dengan air kelapa dan rempah lalu digoreng. Gurih dengan aroma harum khas.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 40, kalori: 270,
        tips_bekal: 'Ayam goreng Kalasan sangat tahan lama dan enak dimakan dingin pun.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Air kelapa (atau air biasa)', qty: 150, unit: 'ml' },
          { name: 'Bawang putih', qty: 4, unit: 'siung' },
          { name: 'Ketumbar bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Kunyit bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Lengkuas (geprek)', qty: 1, unit: 'ruas' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Haluskan bawang putih. Campurkan dengan ketumbar, kunyit, dan garam.',
          'Ungkep ayam dengan bumbu, air kelapa, salam, dan lengkuas sampai air habis.',
          'Dinginkan ayam sebentar sebelum digoreng.',
          'Goreng ayam di minyak panas sampai keemasan.',
          'Angkat, tiriskan. Sajikan.',
        ],
      },
      {
        name: 'Ayam Teriyaki Sederhana', category: 'protein',
        description: 'Ayam fillet dengan saus teriyaki ala rumahan — kecap asin, kecap manis, jahe, dan madu. Manis-gurih.',
        protein_type: 'ayam', is_bumbu_free: true, estimasi_waktu: 25, kalori: 250,
        tips_bekal: 'Saus teriyaki bisa meresap lebih baik setelah dingin. Cocok dengan nasi.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap asin', qty: 1, unit: 'sdm' },
          { name: 'Kecap manis', qty: 1, unit: 'sdm' },
          { name: 'Madu atau gula', qty: 1, unit: 'sdt' },
          { name: 'Jahe (parut)', qty: 0.5, unit: 'ruas' },
          { name: 'Bawang putih (parut/geprek)', qty: 2, unit: 'siung' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Campurkan kecap asin, kecap manis, madu, jahe, dan bawang putih jadi saus.',
          'Marinasi ayam dengan setengah saus selama 15 menit.',
          'Panggang/bakar ayam di teflon anti lengket sampai matang.',
          'Tuang sisa saus ke atas ayam, masak sampai saus mengental.',
          'Angkat dan sajikan.',
        ],
      },
      // ── FREE-FORM IKAN ───────────────────────────────────────────────
      {
        name: 'Ikan Kecap Manis', category: 'protein',
        description: 'Ikan fillet yang digoreng lalu dilumuri saus kecap manis bawang putih. Cepat, mudah, dan lezat.',
        protein_type: 'ikan', is_bumbu_free: true, estimasi_waktu: 20, kalori: 220,
        tips_bekal: 'Kemas ikan dan saus terpisah agar ikan tidak lembek.',
        ingredients: [
          { name: 'Ikan dori/kakap fillet', qty: 150, unit: 'gram' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang putih (cincang)', qty: 3, unit: 'siung' },
          { name: 'Jahe (geprek)', qty: 0.5, unit: 'ruas' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Lumuri ikan dengan garam, goreng di minyak panas sampai matang. Angkat.',
          'Sisakan sedikit minyak, tumis bawang putih dan jahe sampai harum.',
          'Masukkan kecap manis dan sedikit air, masak sampai mendidih.',
          'Siram saus kecap ke atas ikan goreng.',
        ],
      },
      {
        name: 'Ikan Asam Manis', category: 'protein',
        description: 'Ikan fillet goreng tepung dengan saus asam manis segar dari tomat dan nanas.',
        protein_type: 'ikan', is_bumbu_free: true, estimasi_waktu: 30, kalori: 240,
        tips_bekal: 'Bawa saus terpisah. Siram saat akan makan agar tepung tetap renyah.',
        ingredients: [
          { name: 'Ikan dori fillet', qty: 150, unit: 'gram' },
          { name: 'Tepung terigu', qty: 3, unit: 'sdm' },
          { name: 'Saus tomat', qty: 2, unit: 'sdm' },
          { name: 'Nanas (potong kecil)', qty: 30, unit: 'gram' },
          { name: 'Paprika merah (potong)', qty: 20, unit: 'gram' },
          { name: 'Gula', qty: 1, unit: 'sdt' },
          { name: 'Cuka masak', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 100, unit: 'ml' },
        ],
        steps: [
          'Lumuri ikan dengan garam, balut tepung, goreng sampai keemasan.',
          'Tumis paprika, masukkan saus tomat, nanas, gula, cuka, dan sedikit air.',
          'Masak saus sampai mengental, koreksi rasa.',
          'Taruh ikan di wadah, siram dengan saus asam manis.',
        ],
      },
      // ── FREE-FORM TELUR ──────────────────────────────────────────────
      {
        name: 'Telur Semur Kecap', category: 'protein',
        description: 'Telur rebus dalam kuah semur kecap yang manis dan gurih. Mudah dibuat dan sangat cocok untuk bekal.',
        protein_type: 'telur', is_bumbu_free: true, estimasi_waktu: 20, kalori: 180,
        tips_bekal: 'Semur telur makin enak setelah direndam semalaman. Bawa kuah semur sedikit.',
        ingredients: [
          { name: 'Telur ayam', qty: 2, unit: 'butir' },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Bawang merah (iris)', qty: 3, unit: 'siung' },
          { name: 'Bawang putih (geprek)', qty: 2, unit: 'siung' },
          { name: 'Pala bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Cengkeh', qty: 1, unit: 'buah' },
          { name: 'Gula merah', qty: 3, unit: 'gram' },
          { name: 'Air', qty: 100, unit: 'ml' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Rebus telur sampai matang, kupas. Goreng sebentar sampai berkulit.',
          'Tumis bawang merah dan bawang putih sampai harum.',
          'Masukkan kecap, pala, cengkeh, gula, dan air.',
          'Masukkan telur, masak api kecil sampai kuah mengental.',
          'Koreksi rasa. Angkat.',
        ],
      },
      // ── FREE-FORM SAYURAN ────────────────────────────────────────────
      {
        name: 'Tumis Buncis Bawang Putih', category: 'sayuran',
        description: 'Buncis segar yang ditumis dengan bawang putih dan minyak wijen. Simpel, renyah, dan sehat.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 80,
        tips_bekal: 'Masak buncis jangan terlalu lama agar tetap renyah dan hijau segar.',
        ingredients: [
          { name: 'Buncis (potong 3 cm)', qty: 100, unit: 'gram' },
          { name: 'Bawang putih (cincang)', qty: 3, unit: 'siung' },
          { name: 'Minyak wijen', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Merica bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Cuci bersih buncis, potong serong 3 cm.',
          'Panaskan minyak, tumis bawang putih hingga harum.',
          'Masukkan buncis, tumis dengan api besar selama 3-4 menit.',
          'Beri garam dan merica, aduk rata.',
          'Perciki minyak wijen, aduk sebentar. Angkat selagi masih hijau.',
        ],
      },
      {
        name: 'Cah Kangkung Saus Tiram', category: 'sayuran',
        description: 'Kangkung yang ditumis dengan bawang putih dan saus tiram. Cepat matang, segar, dan sangat lezat.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 10, kalori: 70,
        tips_bekal: 'Masak kangkung paling akhir dan tidak perlu lama. Hindari memasak ulang agar tidak hitam.',
        ingredients: [
          { name: 'Kangkung (siangi)', qty: 100, unit: 'gram' },
          { name: 'Bawang putih (geprek+iris)', qty: 4, unit: 'siung' },
          { name: 'Saus tiram', qty: 1, unit: 'sdm' },
          { name: 'Kecap asin', qty: 0.5, unit: 'sdt' },
          { name: 'Cabai merah (iris)', qty: 1, unit: 'buah' },
          { name: 'Gula', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1.5, unit: 'sdm' },
        ],
        steps: [
          'Siangi kangkung, cuci bersih.',
          'Panaskan minyak di api besar. Tumis bawang putih dan cabai sampai harum.',
          'Masukkan kangkung, aduk cepat dengan api besar.',
          'Tambahkan saus tiram, kecap asin, dan gula.',
          'Aduk 1-2 menit sampai kangkung layu tapi masih hijau. Angkat segera.',
        ],
      },
      {
        name: 'Tumis Wortel Kacang Polong', category: 'sayuran',
        description: 'Wortel dan kacang polong yang ditumis dengan bawang putih dan kecap asin. Manis alami dan kaya nutrisi.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 90,
        tips_bekal: 'Wortel sangat tahan lama di suhu ruang. Cocok untuk bekal yang dibawa jauh.',
        ingredients: [
          { name: 'Wortel (iris bulat tipis)', qty: 80, unit: 'gram' },
          { name: 'Kacang polong beku', qty: 30, unit: 'gram' },
          { name: 'Bawang putih (cincang)', qty: 2, unit: 'siung' },
          { name: 'Bawang bombay (iris)', qty: 0.25, unit: 'buah' },
          { name: 'Kecap asin', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Panaskan minyak, tumis bawang bombay dan bawang putih sampai layu.',
          'Masukkan wortel, tumis 3 menit sampai agak lunak.',
          'Tambahkan kacang polong beku, aduk rata.',
          'Beri kecap asin dan garam. Masak 2 menit lagi.',
          'Koreksi rasa. Angkat.',
        ],
      },
      {
        name: 'Sup Tahu Sayuran', category: 'sayuran',
        description: 'Sup bening dengan tahu, wortel, dan kol. Segar, ringan, dan menyehatkan.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 20, kalori: 85,
        tips_bekal: 'Bawa kuah dalam wadah terpisah. Minum kuahnya saat makan untuk menambah rasa kenyang.',
        ingredients: [
          { name: 'Tahu (potong dadu)', qty: 50, unit: 'gram' },
          { name: 'Wortel (potong)', qty: 40, unit: 'gram' },
          { name: 'Kol (iris kasar)', qty: 40, unit: 'gram' },
          { name: 'Bawang putih (geprek)', qty: 2, unit: 'siung' },
          { name: 'Bawang merah (iris)', qty: 2, unit: 'siung' },
          { name: 'Kaldu ayam bubuk', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Seledri (iris)', qty: 1, unit: 'batang' },
          { name: 'Air', qty: 300, unit: 'ml' },
        ],
        steps: [
          'Didihkan air, masukkan bawang merah dan bawang putih geprek.',
          'Masukkan wortel, masak 3 menit.',
          'Tambahkan tahu dan kol, masak 2 menit.',
          'Beri kaldu ayam bubuk dan garam. Koreksi rasa.',
          'Taburkan seledri, angkat.',
        ],
      },
      {
        name: 'Tumis Kacang Panjang Telur', category: 'sayuran',
        description: 'Kacang panjang yang ditumis dengan telur orak-arik dan bawang. Sederhana, mengenyangkan, dan bergizi.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 110,
        tips_bekal: 'Kombinasi kacang panjang dan telur membuat sayur ini juga menyumbang protein.',
        ingredients: [
          { name: 'Kacang panjang (potong 3 cm)', qty: 80, unit: 'gram' },
          { name: 'Telur ayam', qty: 1, unit: 'butir' },
          { name: 'Bawang merah (iris)', qty: 3, unit: 'siung' },
          { name: 'Bawang putih (geprek)', qty: 2, unit: 'siung' },
          { name: 'Cabai rawit (iris, optional)', qty: 2, unit: 'buah' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Panaskan minyak, tumis bawang merah, bawang putih, dan cabai sampai harum.',
          'Masukkan kacang panjang, tumis 3-4 menit.',
          'Sisihkan kacang panjang ke pinggir, kocok telur lalu tuang ke tengah wajan.',
          'Orak-arik telur, lalu aduk rata bersama kacang panjang.',
          'Beri garam. Koreksi rasa. Angkat.',
        ],
      },
      {
        name: 'Tumis Tauge Tahu', category: 'sayuran',
        description: 'Tauge segar yang ditumis bersama tahu goreng dan bawang putih. Cepat, renyah, dan bergizi.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 12, kalori: 95,
        tips_bekal: 'Masak tauge hanya sebentar agar tetap renyah.',
        ingredients: [
          { name: 'Tauge', qty: 80, unit: 'gram' },
          { name: 'Tahu (goreng, potong kotak)', qty: 50, unit: 'gram' },
          { name: 'Bawang putih (cincang)', qty: 3, unit: 'siung' },
          { name: 'Kecap asin', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Goreng tahu sampai keemasan. Angkat.',
          'Tumis bawang putih sampai harum.',
          'Masukkan tahu goreng, aduk sebentar.',
          'Tambahkan tauge, tumis dengan api besar 1-2 menit saja.',
          'Beri kecap asin dan garam. Aduk dan angkat segera.',
        ],
      },
      {
        name: 'Oseng Tempe Cabai Hijau', category: 'sayuran',
        description: 'Tempe yang dioseng dengan irisan cabai hijau besar dan bawang merah. Harum dan sedikit pedas.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 15, kalori: 105,
        tips_bekal: 'Oseng tempe cabai hijau sangat awet dan makin enak setelah dingin.',
        ingredients: [
          { name: 'Tempe (iris tipis)', qty: 80, unit: 'gram' },
          { name: 'Cabai hijau besar (iris serong)', qty: 3, unit: 'buah' },
          { name: 'Bawang merah (iris)', qty: 3, unit: 'siung' },
          { name: 'Bawang putih (geprek)', qty: 2, unit: 'siung' },
          { name: 'Kecap manis', qty: 0.5, unit: 'sdm' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Goreng tempe sebentar sampai berkulit. Angkat.',
          'Tumis bawang merah dan bawang putih sampai harum.',
          'Masukkan cabai hijau, aduk sampai layu.',
          'Masukkan tempe goreng, aduk rata.',
          'Beri kecap manis dan garam. Koreksi rasa. Angkat.',
        ],
      },
      {
        name: 'Sayur Asem Sederhana', category: 'sayuran',
        description: 'Sayur asem bening yang segar dengan kacang panjang, jagung, dan labu siam. Sangat mudah dan menyegarkan.',
        protein_type: null, is_bumbu_free: true, estimasi_waktu: 25, kalori: 75,
        tips_bekal: 'Bawa kuah asem dalam termos. Makin siang, rasa asem semakin meresap.',
        ingredients: [
          { name: 'Kacang panjang (potong 3 cm)', qty: 40, unit: 'gram' },
          { name: 'Labu siam (potong)', qty: 40, unit: 'gram' },
          { name: 'Jagung manis (potong)', qty: 30, unit: 'gram' },
          { name: 'Asam jawa', qty: 1, unit: 'sdt' },
          { name: 'Bawang merah (iris)', qty: 3, unit: 'siung' },
          { name: 'Gula merah', qty: 3, unit: 'gram' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Air', qty: 350, unit: 'ml' },
        ],
        steps: [
          'Didihkan air. Larutkan asam jawa.',
          'Masukkan bawang merah, gula merah, dan garam.',
          'Masukkan jagung, masak 5 menit.',
          'Tambahkan labu siam, masak 3 menit.',
          'Masukkan kacang panjang, masak 2 menit lagi.',
          'Koreksi rasa asam-manis-asin. Angkat.',
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
    console.log(`Bekal pool migration complete: ${added} new recipes added.`);
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
