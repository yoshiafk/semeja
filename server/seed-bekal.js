const { pool } = require('./db');

async function seedBekalSehat() {
  const client = await pool.connect();
  try {
    // Check if bumbu dasar already seeded
    const { rows: existing } = await client.query('SELECT id FROM bekal_bumbu_dasar LIMIT 1');
    if (existing.length > 0) {
      console.log('Bekal Sehat data already seeded, skipping.');
      return;
    }

    await client.query('BEGIN');

    // ── 1. Bumbu Dasar ─────────────────────────────────────────────

    const bumbuData = [
      {
        name: 'Bumbu Dasar Merah',
        color: 'merah',
        description: 'Bumbu dasar dengan rasa pedas dan gurih, cocok untuk masakan tumis, balado, dan rendang sederhana.',
        cara_membuat: 'Haluskan semua bahan menggunakan blender atau ulekan hingga halus. Tumis bumbu halus dengan 2 sdm minyak goreng di api kecil selama 15-20 menit sampai harum dan minyak terpisah. Angkat dan dinginkan.',
        tips_penyimpanan: 'Simpan dalam wadah kedap udara di kulkas (tahan 1 minggu) atau freezer (tahan 1 bulan). Bagi ke dalam porsi kecil agar mudah diambil saat diperlukan.',
        ingredients: [
          { name: 'Bawang merah', qty: 30, unit: 'gram' },
          { name: 'Bawang putih', qty: 10, unit: 'gram' },
          { name: 'Cabai merah keriting', qty: 15, unit: 'gram' },
          { name: 'Cabai merah besar', qty: 20, unit: 'gram' },
          { name: 'Kemiri', qty: 5, unit: 'gram' },
          { name: 'Tomat', qty: 25, unit: 'gram' },
          { name: 'Garam', qty: 2, unit: 'gram' },
          { name: 'Gula merah', qty: 3, unit: 'gram' },
        ],
      },
      {
        name: 'Bumbu Dasar Putih',
        color: 'putih',
        description: 'Bumbu dasar ringan dan serbaguna, cocok untuk sop, sayur bening, tumis sederhana, dan masakan berkuah.',
        cara_membuat: 'Haluskan semua bahan menggunakan blender atau ulekan hingga halus. Tumis bumbu halus dengan 1 sdm minyak goreng di api kecil selama 10-15 menit sampai harum. Bumbu ini lebih ringan dan tidak perlu ditumis sampai minyak terpisah.',
        tips_penyimpanan: 'Simpan dalam wadah kedap udara di kulkas (tahan 1 minggu) atau freezer (tahan 1 bulan). Cocok untuk prep di akhir pekan.',
        ingredients: [
          { name: 'Bawang merah', qty: 25, unit: 'gram' },
          { name: 'Bawang putih', qty: 15, unit: 'gram' },
          { name: 'Kemiri', qty: 8, unit: 'gram' },
          { name: 'Merica butir', qty: 2, unit: 'gram' },
          { name: 'Ketumbar bubuk', qty: 2, unit: 'gram' },
          { name: 'Garam', qty: 2, unit: 'gram' },
        ],
      },
      {
        name: 'Bumbu Dasar Kuning',
        color: 'kuning',
        description: 'Bumbu dasar dengan kunyit yang memberi warna kuning cantik dan rasa hangat, cocok untuk opor, gulai, dan tumis kuning.',
        cara_membuat: 'Haluskan semua bahan menggunakan blender atau ulekan hingga halus. Tumis bumbu halus dengan 2 sdm minyak goreng dan 1 lembar daun salam di api kecil selama 15 menit sampai harum dan berwarna kuning keemasan.',
        tips_penyimpanan: 'Simpan dalam wadah kedap udara di kulkas (tahan 1 minggu) atau freezer (tahan 1 bulan). Kunyit akan memberi warna pada wadah, gunakan wadah kaca jika memungkinkan.',
        ingredients: [
          { name: 'Bawang merah', qty: 25, unit: 'gram' },
          { name: 'Bawang putih', qty: 10, unit: 'gram' },
          { name: 'Kunyit segar', qty: 15, unit: 'gram' },
          { name: 'Kemiri', qty: 8, unit: 'gram' },
          { name: 'Ketumbar bubuk', qty: 2, unit: 'gram' },
          { name: 'Jahe', qty: 8, unit: 'gram' },
          { name: 'Garam', qty: 2, unit: 'gram' },
        ],
      },
    ];

    // Insert bumbu dasar
    const bumbuIds = {};
    for (const bumbu of bumbuData) {
      const { rows } = await client.query(
        `INSERT INTO bekal_bumbu_dasar (name, color, description, cara_membuat, tips_penyimpanan) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [bumbu.name, bumbu.color, bumbu.description, bumbu.cara_membuat, bumbu.tips_penyimpanan]
      );
      bumbuIds[bumbu.color] = rows[0].id;

      for (let i = 0; i < bumbu.ingredients.length; i++) {
        const ing = bumbu.ingredients[i];
        await client.query(
          `INSERT INTO bekal_bumbu_ingredients (bumbu_id, name, quantity_per_portion, unit, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [rows[0].id, ing.name, ing.qty, ing.unit, i]
        );
      }
    }

    // Calculate next Monday for start_date
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    const startDateString = nextMonday.toISOString().split('T')[0];

    const { rows: planRows } = await client.query(
      `INSERT INTO bekal_plans (title, description, start_date, week_label, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        'Menu Bekal Sehat Minggu Pertama',
        'Menu masakan sehat dengan sayuran dan protein untuk bekal kerja anak kost. Menggunakan bumbu dasar merah, putih, dan kuning yang saling terkait agar hemat dan praktis.',
        startDateString,
        'Minggu 1',
        'active',
      ]
    );
    const planId = planRows[0].id;

    // ── 3. Days + Recipes ──────────────────────────────────────────

    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    const weeklyMenu = [
      // ── SENIN ──
      {
        protein: {
          name: 'Ayam Bumbu Kuning',
          description: 'Ayam yang dimasak dengan bumbu dasar kuning, harum kunyit dan rempah. Cocok untuk bekal karena tahan lama.',
          bumbu: 'kuning',
          estimasi_waktu: 35,
          kalori: 280,
          tips_bekal: 'Simpan terpisah dari nasi. Panaskan dengan microwave 2 menit sebelum dimakan.',
          ingredients: [
            { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
            { name: 'Bumbu Dasar Kuning', qty: 2, unit: 'sdm', is_bumbu: true },
            { name: 'Santan encer', qty: 50, unit: 'ml' },
            { name: 'Daun salam', qty: 1, unit: 'lembar' },
            { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
            { name: 'Garam', qty: 0.5, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
          ],
          steps: [
            'Potong ayam paha fillet menjadi 3-4 bagian, cuci bersih.',
            'Panaskan minyak goreng, tumis bumbu dasar kuning bersama daun salam dan serai sampai harum.',
            'Masukkan potongan ayam, aduk rata dengan bumbu.',
            'Tuang santan encer, tambahkan garam dan gula pasir.',
            'Masak dengan api kecil selama 20-25 menit hingga ayam matang dan bumbu meresap.',
            'Koreksi rasa, angkat dan tiriskan. Biarkan dingin sebelum dikemas untuk bekal.',
          ],
        },
        sayuran: {
          name: 'Tumis Buncis Bawang Putih',
          description: 'Buncis segar yang ditumis sederhana dengan bumbu dasar putih, renyah dan sehat.',
          bumbu: 'putih',
          estimasi_waktu: 15,
          kalori: 85,
          tips_bekal: 'Jangan terlalu matang agar tetap renyah saat dimakan siang.',
          ingredients: [
            { name: 'Buncis', qty: 100, unit: 'gram' },
            { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
            { name: 'Wortel (iris tipis)', qty: 30, unit: 'gram' },
            { name: 'Kecap manis', qty: 0.5, unit: 'sdt' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
          ],
          steps: [
            'Siangi buncis, potong serong sepanjang 3-4 cm. Iris wortel tipis.',
            'Panaskan minyak goreng, tumis bumbu dasar putih sampai harum.',
            'Masukkan wortel terlebih dahulu, tumis 2 menit.',
            'Tambahkan buncis, aduk rata. Masak dengan api besar 3-4 menit.',
            'Bumbui dengan kecap manis dan garam. Aduk cepat.',
            'Angkat saat buncis masih agak renyah (al dente).',
          ],
        },
      },
      // ── SELASA ──
      {
        protein: {
          name: 'Telur Balado',
          description: 'Telur rebus yang digoreng sebentar lalu dilumuri bumbu balado pedas dari bumbu dasar merah.',
          bumbu: 'merah',
          estimasi_waktu: 25,
          kalori: 220,
          tips_bekal: 'Telur balado tahan baik di suhu ruang 4-5 jam. Kemas bumbu terpisah agar tidak lembek.',
          ingredients: [
            { name: 'Telur ayam', qty: 2, unit: 'butir' },
            { name: 'Bumbu Dasar Merah', qty: 2, unit: 'sdm', is_bumbu: true },
            { name: 'Tomat (iris)', qty: 30, unit: 'gram' },
            { name: 'Daun jeruk', qty: 2, unit: 'lembar' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.5, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
          ],
          steps: [
            'Rebus telur hingga matang (10 menit), kupas kulitnya.',
            'Goreng telur rebus sebentar sampai kulitnya bergelembung, angkat.',
            'Sisakan 1 sdm minyak, tumis bumbu dasar merah dan daun jeruk sampai harum.',
            'Masukkan irisan tomat, masak hingga layu.',
            'Tambahkan garam dan gula, aduk rata.',
            'Masukkan telur goreng, aduk pelan sampai bumbu melapisi telur. Angkat.',
          ],
        },
        sayuran: {
          name: 'Sayur Bayam Bening',
          description: 'Sayur bayam bening yang segar dan ringan dengan bumbu dasar putih, kaya zat besi.',
          bumbu: 'putih',
          estimasi_waktu: 15,
          kalori: 60,
          tips_bekal: 'Bawa kuah dan bayam terpisah, campurkan saat akan dimakan agar bayam tidak hitam.',
          ingredients: [
            { name: 'Bayam segar', qty: 80, unit: 'gram' },
            { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
            { name: 'Jagung manis (iris)', qty: 30, unit: 'gram' },
            { name: 'Wortel (iris)', qty: 20, unit: 'gram' },
            { name: 'Air', qty: 200, unit: 'ml' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          ],
          steps: [
            'Petik daun bayam, cuci bersih. Iris jagung dan wortel.',
            'Didihkan air, masukkan bumbu dasar putih. Aduk rata.',
            'Masukkan wortel dan jagung, masak 3-4 menit.',
            'Masukkan bayam, masak sebentar (1-2 menit) sampai layu.',
            'Tambahkan garam dan gula, koreksi rasa.',
            'Angkat segera agar bayam tetap hijau segar.',
          ],
        },
      },
      // ── RABU ──
      {
        protein: {
          name: 'Tempe Orek Kering',
          description: 'Tempe yang diiris tipis lalu diorek dengan bumbu dasar merah dan kecap, manis gurih.',
          bumbu: 'merah',
          estimasi_waktu: 25,
          kalori: 200,
          tips_bekal: 'Tempe orek kering tahan sangat baik untuk bekal, bisa dibuat malam sebelumnya.',
          ingredients: [
            { name: 'Tempe', qty: 100, unit: 'gram' },
            { name: 'Bumbu Dasar Merah', qty: 1.5, unit: 'sdm', is_bumbu: true },
            { name: 'Kecap manis', qty: 1, unit: 'sdm' },
            { name: 'Daun salam', qty: 1, unit: 'lembar' },
            { name: 'Lengkuas (geprek)', qty: 1, unit: 'ruas' },
            { name: 'Gula merah (sisir)', qty: 5, unit: 'gram' },
            { name: 'Air', qty: 30, unit: 'ml' },
            { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
          ],
          steps: [
            'Potong tempe dadu kecil (1x1 cm), goreng setengah kering. Tiriskan.',
            'Sisakan 1 sdm minyak, tumis bumbu dasar merah, daun salam, dan lengkuas.',
            'Tumis sampai harum dan minyak mulai terpisah.',
            'Masukkan tempe goreng, aduk rata.',
            'Tambahkan kecap manis, gula merah, dan sedikit air.',
            'Masak dengan api kecil sambil diaduk sampai air menyusut dan bumbu kering menyelimuti tempe.',
          ],
        },
        sayuran: {
          name: 'Capcay Sayuran',
          description: 'Campuran sayuran segar yang ditumis dengan bumbu dasar kuning, penuh warna dan nutrisi.',
          bumbu: 'kuning',
          estimasi_waktu: 20,
          kalori: 95,
          tips_bekal: 'Masak sayuran setengah matang agar tidak terlalu lembek saat dimakan siang.',
          ingredients: [
            { name: 'Wortel', qty: 30, unit: 'gram' },
            { name: 'Kembang kol', qty: 40, unit: 'gram' },
            { name: 'Brokoli', qty: 40, unit: 'gram' },
            { name: 'Baby corn', qty: 30, unit: 'gram' },
            { name: 'Bumbu Dasar Kuning', qty: 1.5, unit: 'sdm', is_bumbu: true },
            { name: 'Saus tiram', qty: 1, unit: 'sdm' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Air', qty: 30, unit: 'ml' },
            { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
          ],
          steps: [
            'Potong semua sayuran seukuran gigitan. Cuci bersih.',
            'Panaskan minyak, tumis bumbu dasar kuning sampai harum.',
            'Masukkan wortel dan baby corn terlebih dahulu (sayuran yang lebih keras), tumis 2 menit.',
            'Tambahkan kembang kol dan brokoli, tumis 2-3 menit.',
            'Tuang sedikit air, tambahkan saus tiram dan garam.',
            'Masak 2-3 menit sampai sayuran matang tapi masih renyah. Angkat.',
          ],
        },
      },
      // ── KAMIS ──
      {
        protein: {
          name: 'Ayam Goreng Bumbu Putih',
          description: 'Ayam yang diungkep dengan bumbu dasar putih lalu digoreng kering, gurih dan harum.',
          bumbu: 'putih',
          estimasi_waktu: 40,
          kalori: 310,
          tips_bekal: 'Ayam goreng tahan baik untuk bekal. Goreng sampai kering agar tidak mudah bau.',
          ingredients: [
            { name: 'Ayam dada fillet', qty: 150, unit: 'gram' },
            { name: 'Bumbu Dasar Putih', qty: 2, unit: 'sdm', is_bumbu: true },
            { name: 'Daun salam', qty: 1, unit: 'lembar' },
            { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
            { name: 'Air', qty: 100, unit: 'ml' },
            { name: 'Garam', qty: 0.5, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
          ],
          steps: [
            'Potong ayam dada menjadi 2-3 bagian, cuci bersih.',
            'Ungkep ayam: campur ayam dengan bumbu dasar putih, daun salam, serai, garam, dan air.',
            'Masak ungkepan di api kecil selama 20-25 menit sampai air menyusut dan ayam matang.',
            'Angkat ayam, tiriskan dari sisa kuah.',
            'Panaskan minyak goreng, goreng ayam ungkep sampai kuning keemasan dan kering.',
            'Angkat, tiriskan di atas kertas minyak. Dinginkan sebelum dikemas.',
          ],
        },
        sayuran: {
          name: 'Tumis Kangkung Terasi',
          description: 'Kangkung segar yang ditumis pedas dengan bumbu dasar merah dan terasi, favorit anak kost.',
          bumbu: 'merah',
          estimasi_waktu: 12,
          kalori: 75,
          tips_bekal: 'Masak tepat sebelum berangkat kerja agar kangkung tetap segar dan hijau.',
          ingredients: [
            { name: 'Kangkung', qty: 100, unit: 'gram' },
            { name: 'Bumbu Dasar Merah', qty: 1, unit: 'sdm', is_bumbu: true },
            { name: 'Terasi matang', qty: 3, unit: 'gram' },
            { name: 'Tomat (iris)', qty: 20, unit: 'gram' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
          ],
          steps: [
            'Petik daun kangkung, potong batangnya. Cuci bersih, tiriskan.',
            'Panaskan minyak, tumis bumbu dasar merah dan terasi sampai harum.',
            'Masukkan irisan tomat, aduk sebentar.',
            'Masukkan batang kangkung terlebih dahulu, tumis 1 menit.',
            'Tambahkan daun kangkung, garam, dan gula. Tumis api besar 2-3 menit.',
            'Angkat segera saat kangkung baru layu (jangan terlalu lama agar tidak hitam).',
          ],
        },
      },
      // ── JUMAT ──
      {
        protein: {
          name: 'Tahu Bumbu Kuning',
          description: 'Tahu yang dimasak dengan bumbu dasar kuning dan santan, lembut dan gurih.',
          bumbu: 'kuning',
          estimasi_waktu: 25,
          kalori: 180,
          tips_bekal: 'Goreng tahu dulu agar lebih tahan dan teksturnya mantap untuk bekal.',
          ingredients: [
            { name: 'Tahu putih (potong dadu)', qty: 150, unit: 'gram' },
            { name: 'Bumbu Dasar Kuning', qty: 2, unit: 'sdm', is_bumbu: true },
            { name: 'Santan encer', qty: 50, unit: 'ml' },
            { name: 'Daun salam', qty: 1, unit: 'lembar' },
            { name: 'Daun jeruk', qty: 2, unit: 'lembar' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
          ],
          steps: [
            'Potong tahu menjadi dadu berukuran 2x2 cm.',
            'Goreng tahu setengah kering sampai berkulit, angkat dan tiriskan.',
            'Sisakan 1 sdm minyak, tumis bumbu dasar kuning, daun salam, dan daun jeruk.',
            'Tuang santan encer, tambahkan garam dan gula.',
            'Masukkan tahu goreng, aduk pelan agar tidak hancur.',
            'Masak api kecil 5-7 menit sampai bumbu meresap. Angkat.',
          ],
        },
        sayuran: {
          name: 'Sayur Asem Sederhana',
          description: 'Sayur asem segar dengan bumbu dasar kuning dan asam jawa, menyegarkan untuk makan siang.',
          bumbu: 'kuning',
          estimasi_waktu: 25,
          kalori: 70,
          tips_bekal: 'Bawa kuah terpisah dalam termos kecil agar tetap hangat.',
          ingredients: [
            { name: 'Labu siam (potong)', qty: 50, unit: 'gram' },
            { name: 'Kacang panjang', qty: 40, unit: 'gram' },
            { name: 'Jagung manis', qty: 40, unit: 'gram' },
            { name: 'Bumbu Dasar Kuning', qty: 1, unit: 'sdm', is_bumbu: true },
            { name: 'Asam jawa', qty: 5, unit: 'gram' },
            { name: 'Gula merah', qty: 8, unit: 'gram' },
            { name: 'Air', qty: 300, unit: 'ml' },
            { name: 'Garam', qty: 0.5, unit: 'sdt' },
          ],
          steps: [
            'Potong labu siam, kacang panjang (3 cm), dan jagung.',
            'Didihkan air, masukkan bumbu dasar kuning. Aduk rata.',
            'Masukkan jagung dan labu siam, masak 5 menit.',
            'Tambahkan kacang panjang, masak 3 menit lagi.',
            'Larutkan asam jawa dengan sedikit air, saring dan masukkan ke dalam sayur.',
            'Tambahkan gula merah dan garam. Koreksi rasa asam-manis. Angkat.',
          ],
        },
      },
      // ── SABTU ──
      {
        protein: {
          name: 'Ikan Bumbu Merah',
          description: 'Ikan yang dimasak dengan bumbu dasar merah yang pedas dan gurih, kaya protein dan omega-3.',
          bumbu: 'merah',
          estimasi_waktu: 30,
          kalori: 250,
          tips_bekal: 'Pilih ikan yang tidak terlalu amis (nila/kakap). Bungkus rapat agar aroma tidak menyebar.',
          ingredients: [
            { name: 'Ikan nila/kakap fillet', qty: 150, unit: 'gram' },
            { name: 'Bumbu Dasar Merah', qty: 2, unit: 'sdm', is_bumbu: true },
            { name: 'Tomat (iris)', qty: 30, unit: 'gram' },
            { name: 'Daun kemangi', qty: 5, unit: 'lembar' },
            { name: 'Air jeruk limau', qty: 1, unit: 'sdm' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
          ],
          steps: [
            'Lumuri ikan fillet dengan air jeruk limau dan garam, diamkan 10 menit.',
            'Goreng ikan sebentar di kedua sisi sampai setengah matang, angkat.',
            'Sisakan 1 sdm minyak, tumis bumbu dasar merah sampai harum.',
            'Masukkan irisan tomat, masak sebentar sampai layu.',
            'Tambahkan gula pasir, koreksi rasa.',
            'Letakkan ikan goreng di atas bumbu, taburi daun kemangi. Masak 3-5 menit. Angkat.',
          ],
        },
        sayuran: {
          name: 'Urap Sayuran',
          description: 'Campuran sayuran rebus dengan kelapa parut berbumbu dasar putih, khas Jawa yang sehat.',
          bumbu: 'putih',
          estimasi_waktu: 25,
          kalori: 110,
          tips_bekal: 'Urap tahan baik untuk bekal. Pisahkan bumbu kelapa dari sayuran, campurkan saat makan.',
          ingredients: [
            { name: 'Kacang panjang', qty: 50, unit: 'gram' },
            { name: 'Tauge', qty: 40, unit: 'gram' },
            { name: 'Bayam', qty: 40, unit: 'gram' },
            { name: 'Kelapa parut', qty: 40, unit: 'gram' },
            { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
            { name: 'Daun jeruk (iris halus)', qty: 2, unit: 'lembar' },
            { name: 'Kencur (parut)', qty: 3, unit: 'gram' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          ],
          steps: [
            'Rebus kacang panjang (potong 3 cm), tauge, dan bayam secara terpisah, masing-masing sebentar saja. Tiriskan.',
            'Campur kelapa parut dengan bumbu dasar putih, kencur parut, daun jeruk iris.',
            'Kukus campuran kelapa berbumbu selama 10-15 menit sampai matang.',
            'Tambahkan garam dan gula ke kelapa kukus, aduk rata.',
            'Campurkan sayuran rebus dengan kelapa berbumbu.',
            'Aduk rata dengan tangan atau sendok. Urap siap dikemas untuk bekal.',
          ],
        },
      },
      // ── MINGGU ──
      {
        protein: {
          name: 'Perkedel Tahu Wortel',
          description: 'Perkedel dari tahu dan wortel parut dengan bumbu dasar kuning, kaya serat dan protein nabati.',
          bumbu: 'kuning',
          estimasi_waktu: 30,
          kalori: 190,
          tips_bekal: 'Perkedel sangat cocok untuk bekal. Buat batch besar di hari Minggu untuk stok seminggu.',
          ingredients: [
            { name: 'Tahu putih', qty: 100, unit: 'gram' },
            { name: 'Wortel (parut)', qty: 50, unit: 'gram' },
            { name: 'Bumbu Dasar Kuning', qty: 1, unit: 'sdm', is_bumbu: true },
            { name: 'Telur (untuk adonan)', qty: 0.5, unit: 'butir' },
            { name: 'Tepung terigu', qty: 15, unit: 'gram' },
            { name: 'Daun bawang (iris)', qty: 5, unit: 'gram' },
            { name: 'Garam', qty: 0.25, unit: 'sdt' },
            { name: 'Merica bubuk', qty: 0.25, unit: 'sdt' },
            { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
          ],
          steps: [
            'Hancurkan tahu dengan garpu, peras airnya.',
            'Campurkan tahu dengan wortel parut, bumbu dasar kuning, telur, tepung terigu, daun bawang.',
            'Tambahkan garam dan merica, aduk rata sampai adonan bisa dibentuk.',
            'Bentuk adonan menjadi bulat pipih (diameter ±5 cm).',
            'Panaskan minyak dengan api sedang, goreng perkedel sampai kuning keemasan di kedua sisi.',
            'Angkat dan tiriskan di atas kertas minyak. Dinginkan sebelum dikemas.',
          ],
        },
        sayuran: {
          name: 'Sop Sayuran Bening',
          description: 'Sop sayuran bening yang hangat dan menyehatkan dengan bumbu dasar putih, sempurna untuk hari Minggu.',
          bumbu: 'putih',
          estimasi_waktu: 20,
          kalori: 65,
          tips_bekal: 'Simpan di termos untuk menjaga kehangatan. Bisa juga dimakan dingin.',
          ingredients: [
            { name: 'Wortel', qty: 40, unit: 'gram' },
            { name: 'Kentang', qty: 40, unit: 'gram' },
            { name: 'Buncis', qty: 30, unit: 'gram' },
            { name: 'Kol', qty: 30, unit: 'gram' },
            { name: 'Bumbu Dasar Putih', qty: 1.5, unit: 'sdm', is_bumbu: true },
            { name: 'Daun bawang (iris)', qty: 5, unit: 'gram' },
            { name: 'Seledri (iris)', qty: 3, unit: 'gram' },
            { name: 'Air', qty: 300, unit: 'ml' },
            { name: 'Garam', qty: 0.5, unit: 'sdt' },
            { name: 'Merica bubuk', qty: 0.25, unit: 'sdt' },
          ],
          steps: [
            'Potong wortel dan kentang menjadi dadu kecil, buncis iris serong, kol potong kasar.',
            'Didihkan air, masukkan bumbu dasar putih. Aduk rata.',
            'Masukkan kentang dan wortel terlebih dahulu, masak 5-7 menit.',
            'Tambahkan buncis dan kol, masak 3-4 menit.',
            'Bumbui dengan garam dan merica bubuk.',
            'Taburi daun bawang dan seledri. Angkat dan sajikan.',
          ],
        },
      },
    ];

    for (let i = 0; i < weeklyMenu.length; i++) {
      const dayNum = i + 1;
      const dayName = dayNames[i];
      const { protein, sayuran } = weeklyMenu[i];

      // Insert day
      const { rows: dayRows } = await client.query(
        `INSERT INTO bekal_days (plan_id, day_number, day_name) VALUES ($1, $2, $3) RETURNING id`,
        [planId, dayNum, dayName]
      );
      const dayId = dayRows[0].id;

      // Insert both recipes for this day
      for (const [idx, recipe] of [protein, sayuran].entries()) {
        const category = idx === 0 ? 'protein' : 'sayuran';
        const { rows: recipeRows } = await client.query(
          `INSERT INTO bekal_recipes (day_id, name, description, category, bumbu_dasar_id, estimasi_waktu, kalori_estimasi, tips_bekal, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [dayId, recipe.name, recipe.description, category, bumbuIds[recipe.bumbu], recipe.estimasi_waktu, recipe.kalori, recipe.tips_bekal, idx]
        );
        const recipeId = recipeRows[0].id;

        // Insert ingredients
        for (let j = 0; j < recipe.ingredients.length; j++) {
          const ing = recipe.ingredients[j];
          await client.query(
            `INSERT INTO bekal_recipe_ingredients (recipe_id, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [recipeId, ing.name, ing.qty, ing.unit, ing.is_bumbu || false, j]
          );
        }

        // Insert steps
        for (let k = 0; k < recipe.steps.length; k++) {
          await client.query(
            `INSERT INTO bekal_recipe_steps (recipe_id, step_number, instruction)
             VALUES ($1, $2, $3)`,
            [recipeId, k + 1, recipe.steps[k]]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('Bekal Sehat seed data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding Bekal Sehat data:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { seedBekalSehat };
