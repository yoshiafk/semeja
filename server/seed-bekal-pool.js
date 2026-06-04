const { pool } = require('./db');

/**
 * Seed 42 recipe templates into bekal_recipe_pool.
 * 21 protein + 21 sayuran, balanced 7 per bumbu type.
 * No shellfish (udang, cumi, kerang). Fish is OK.
 */
async function seedBekalPool() {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query('SELECT id FROM bekal_recipe_pool LIMIT 1');
    if (existing.length > 0) {
      console.log('Bekal recipe pool already seeded, skipping.');
      return;
    }

    // Get bumbu IDs
    const { rows: bumbuRows } = await client.query('SELECT id, color FROM bekal_bumbu_dasar');
    const bumbuIds = {};
    bumbuRows.forEach(b => { bumbuIds[b.color] = b.id; });

    if (!bumbuIds.merah || !bumbuIds.putih || !bumbuIds.kuning) {
      console.log('Bumbu dasar not found. Run seed-bekal.js first.');
      return;
    }

    await client.query('BEGIN');

    // ═══════════════════════════════════════════════════════════════════
    // PROTEIN RECIPES (21 total: 7 merah, 7 putih, 7 kuning)
    // ═══════════════════════════════════════════════════════════════════
    const proteinRecipes = [
      // ── MERAH (7) ──────────────────────────────────────────────────
      {
        name: 'Telur Balado',
        description: 'Telur rebus yang digoreng sebentar lalu dilumuri bumbu balado pedas dari bumbu dasar merah.',
        bumbu: 'merah', estimasi_waktu: 25, kalori: 220,
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
      {
        name: 'Tempe Orek Kering',
        description: 'Tempe yang diiris tipis lalu diorek dengan bumbu dasar merah dan kecap, manis gurih.',
        bumbu: 'merah', estimasi_waktu: 25, kalori: 200,
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
      {
        name: 'Ikan Bumbu Merah',
        description: 'Ikan yang dimasak dengan bumbu dasar merah yang pedas dan gurih, kaya protein dan omega-3.',
        bumbu: 'merah', estimasi_waktu: 30, kalori: 250,
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
      {
        name: 'Semur Telur Puyuh',
        description: 'Telur puyuh yang disemur dengan bumbu dasar merah dan kecap manis, gurih dan manis.',
        bumbu: 'merah', estimasi_waktu: 30, kalori: 210,
        tips_bekal: 'Semur telur puyuh awet untuk bekal. Buat porsi besar sekaligus, simpan di kulkas 3 hari.',
        ingredients: [
          { name: 'Telur puyuh', qty: 10, unit: 'butir' },
          { name: 'Bumbu Dasar Merah', qty: 2, unit: 'sdm', is_bumbu: true },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Pala bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Air', qty: 100, unit: 'ml' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Rebus telur puyuh sampai matang, kupas kulitnya.',
          'Goreng telur puyuh sebentar sampai kecokelatan, tiriskan.',
          'Tumis bumbu dasar merah dan daun salam sampai harum.',
          'Tambahkan kecap manis, air, garam, dan pala.',
          'Masukkan telur puyuh, masak api kecil 10-15 menit sampai bumbu meresap.',
          'Angkat saat kuah menyusut dan telur berwarna cokelat tua.',
        ],
      },
      {
        name: 'Dendeng Tempe',
        description: 'Tempe yang diiris tipis, digoreng kering lalu dibalur bumbu dasar merah pedas manis.',
        bumbu: 'merah', estimasi_waktu: 30, kalori: 230,
        tips_bekal: 'Dendeng tempe sangat awet dan tahan berjam-jam di suhu ruang. Ideal untuk bekal.',
        ingredients: [
          { name: 'Tempe', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Kecap manis', qty: 1, unit: 'sdm' },
          { name: 'Gula merah (sisir)', qty: 8, unit: 'gram' },
          { name: 'Air asam jawa', qty: 1, unit: 'sdm' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
        ],
        steps: [
          'Iris tempe tipis-tipis (3mm), goreng kering sampai renyah. Tiriskan.',
          'Sisakan 1 sdm minyak, tumis bumbu dasar merah sampai harum.',
          'Tambahkan kecap manis, gula merah, air asam jawa, dan garam.',
          'Masak sampai bumbu mengental.',
          'Masukkan tempe goreng, aduk rata sampai bumbu menyelimuti.',
          'Angkat dan biarkan dingin. Dendeng tempe siap dikemas.',
        ],
      },
      {
        name: 'Telur Bumbu Rujak',
        description: 'Telur ceplok yang dimasak dengan bumbu rujak dari bumbu dasar merah, pedas manis segar.',
        bumbu: 'merah', estimasi_waktu: 20, kalori: 200,
        tips_bekal: 'Masak telur setengah matang, lalu siram bumbu. Kemas bumbu terpisah untuk bekal.',
        ingredients: [
          { name: 'Telur ayam', qty: 2, unit: 'butir' },
          { name: 'Bumbu Dasar Merah', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Petis udang', qty: 0.5, unit: 'sdt' },
          { name: 'Gula merah (sisir)', qty: 8, unit: 'gram' },
          { name: 'Air asam jawa', qty: 1, unit: 'sdm' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Ceplok telur, goreng sampai pinggiran garing. Angkat.',
          'Tumis bumbu dasar merah sampai harum.',
          'Tambahkan petis, gula merah, air asam jawa, dan garam.',
          'Masak sampai bumbu kental dan berminyak.',
          'Siram bumbu rujak di atas telur ceplok.',
          'Sajikan atau kemas untuk bekal.',
        ],
      },
      {
        name: 'Tahu Goreng Bumbu Merah',
        description: 'Tahu yang digoreng kering lalu dimasak dengan bumbu dasar merah pedas gurih.',
        bumbu: 'merah', estimasi_waktu: 25, kalori: 190,
        tips_bekal: 'Goreng tahu sampai benar-benar kering agar tekstur tahan lama untuk bekal.',
        ingredients: [
          { name: 'Tahu putih', qty: 200, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 2, unit: 'sdm', is_bumbu: true },
          { name: 'Kecap manis', qty: 1, unit: 'sdm' },
          { name: 'Daun jeruk', qty: 2, unit: 'lembar' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
        ],
        steps: [
          'Potong tahu menjadi segitiga atau dadu, goreng sampai kuning kering. Tiriskan.',
          'Sisakan 1 sdm minyak, tumis bumbu dasar merah dan daun jeruk.',
          'Tambahkan kecap manis, garam, dan gula pasir.',
          'Masukkan tahu goreng, aduk pelan agar tidak hancur.',
          'Masak 3-5 menit sampai bumbu meresap.',
          'Angkat dan biarkan dingin sebelum dikemas.',
        ],
      },

      // ── PUTIH (7) ──────────────────────────────────────────────────
      {
        name: 'Ayam Goreng Bumbu Putih',
        description: 'Ayam yang diungkep dengan bumbu dasar putih lalu digoreng kering, gurih dan harum.',
        bumbu: 'putih', estimasi_waktu: 40, kalori: 310,
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
      {
        name: 'Ayam Pop',
        description: 'Ayam rebus bumbu putih ala Padang yang lembut dan gurih tanpa digoreng, rendah lemak.',
        bumbu: 'putih', estimasi_waktu: 35, kalori: 240,
        tips_bekal: 'Ayam pop rendah minyak sehingga aman untuk bekal. Pisahkan dari sambal hijau.',
        ingredients: [
          { name: 'Ayam paha fillet', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 2, unit: 'sdm', is_bumbu: true },
          { name: 'Santan encer', qty: 100, unit: 'ml' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Daun jeruk', qty: 2, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
        ],
        steps: [
          'Potong ayam paha menjadi 2-3 bagian.',
          'Campur santan, bumbu dasar putih, daun salam, daun jeruk, dan garam.',
          'Masukkan ayam, masak di api kecil selama 25-30 menit.',
          'Jangan diaduk terlalu sering agar ayam tetap utuh.',
          'Masak sampai kuah menyusut dan ayam berwarna pucat kekuningan.',
          'Angkat dan sajikan. Bisa ditambah sambal hijau terpisah.',
        ],
      },
      {
        name: 'Telur Dadar Padang',
        description: 'Telur dadar tebal ala Padang dengan bumbu dasar putih, renyah di luar dan lembut di dalam.',
        bumbu: 'putih', estimasi_waktu: 15, kalori: 250,
        tips_bekal: 'Telur dadar tebal sangat cocok untuk bekal karena tidak mudah hancur.',
        ingredients: [
          { name: 'Telur ayam', qty: 2, unit: 'butir' },
          { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Daun bawang (iris)', qty: 10, unit: 'gram' },
          { name: 'Cabai hijau (iris)', qty: 10, unit: 'gram' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
        ],
        steps: [
          'Kocok telur bersama bumbu dasar putih, garam, daun bawang, dan cabai hijau.',
          'Panaskan banyak minyak (minyak harus cukup tebal agar dadar mengembang).',
          'Tuang adonan telur, goreng api sedang sampai mengembang dan pinggiran garing.',
          'Balik dan goreng sisi lainnya sampai kecokelatan.',
          'Angkat, tiriskan di kertas minyak.',
          'Potong-potong sesuai ukuran bekal.',
        ],
      },
      {
        name: 'Pepes Tahu Jamur',
        description: 'Tahu dan jamur yang dibumbui bumbu dasar putih lalu dikukus dalam daun pisang, harum dan sehat.',
        bumbu: 'putih', estimasi_waktu: 35, kalori: 160,
        tips_bekal: 'Pepes tahan cukup lama dan aromanya makin enak saat dingin. Ideal untuk bekal.',
        ingredients: [
          { name: 'Tahu putih', qty: 150, unit: 'gram' },
          { name: 'Jamur tiram', qty: 50, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Daun bawang (iris)', qty: 10, unit: 'gram' },
          { name: 'Kemangi', qty: 5, unit: 'lembar' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Daun pisang', qty: 2, unit: 'lembar' },
        ],
        steps: [
          'Hancurkan tahu dengan garpu, peras airnya. Suwir-suwir jamur tiram.',
          'Campurkan tahu, jamur, bumbu dasar putih, daun bawang, dan garam.',
          'Letakkan adonan di atas daun pisang, tambahkan kemangi.',
          'Bungkus rapat, semat dengan tusuk gigi.',
          'Kukus selama 20-25 menit sampai matang.',
          'Angkat, biarkan dingin sebelum dikemas untuk bekal.',
        ],
      },
      {
        name: 'Bakso Tempe Kukus',
        description: 'Bakso sehat dari tempe dengan bumbu dasar putih, dikukus tanpa minyak. Tinggi protein nabati.',
        bumbu: 'putih', estimasi_waktu: 30, kalori: 180,
        tips_bekal: 'Bakso tempe kukus bisa dimakan langsung atau dicelup saus sambal. Sangat portable.',
        ingredients: [
          { name: 'Tempe', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Tepung tapioka', qty: 20, unit: 'gram' },
          { name: 'Telur (kocok)', qty: 0.5, unit: 'butir' },
          { name: 'Daun bawang (iris halus)', qty: 5, unit: 'gram' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Merica bubuk', qty: 0.25, unit: 'sdt' },
        ],
        steps: [
          'Kukus tempe 10 menit, lalu hancurkan halus dengan garpu.',
          'Campurkan tempe dengan bumbu dasar putih, tepung tapioka, telur, daun bawang, garam, merica.',
          'Aduk rata sampai adonan bisa dibentuk.',
          'Bentuk bulatan kecil sebesar bakso (diameter ±3 cm).',
          'Kukus bakso tempe selama 15 menit sampai matang dan padat.',
          'Angkat, dinginkan. Sajikan dengan saus sambal atau kecap.',
        ],
      },
      {
        name: 'Ikan Goreng Tepung Bumbu Putih',
        description: 'Ikan fillet yang dimarinasi bumbu putih lalu dibalut tepung dan digoreng renyah.',
        bumbu: 'putih', estimasi_waktu: 25, kalori: 270,
        tips_bekal: 'Ikan goreng tepung tetap renyah berjam-jam. Bungkus terpisah dari nasi.',
        ingredients: [
          { name: 'Ikan dori fillet', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Tepung terigu', qty: 30, unit: 'gram' },
          { name: 'Tepung beras', qty: 15, unit: 'gram' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Air es', qty: 30, unit: 'ml' },
          { name: 'Minyak goreng', qty: 4, unit: 'sdm' },
        ],
        steps: [
          'Potong ikan fillet menjadi strip atau potongan bekal, marinasi dengan bumbu dasar putih 15 menit.',
          'Campur tepung terigu, tepung beras, garam, dan air es menjadi adonan basah.',
          'Celupkan ikan ke adonan tepung.',
          'Goreng di minyak panas api sedang sampai kuning keemasan dan renyah.',
          'Angkat, tiriskan di atas kertas minyak.',
          'Dinginkan sebelum dikemas. Sajikan dengan saus sambal.',
        ],
      },

      // ── KUNING (7) ─────────────────────────────────────────────────
      {
        name: 'Ayam Bumbu Kuning',
        description: 'Ayam yang dimasak dengan bumbu dasar kuning, harum kunyit dan rempah. Cocok untuk bekal karena tahan lama.',
        bumbu: 'kuning', estimasi_waktu: 35, kalori: 280,
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
      {
        name: 'Tahu Bumbu Kuning',
        description: 'Tahu yang dimasak dengan bumbu dasar kuning dan santan, lembut dan gurih.',
        bumbu: 'kuning', estimasi_waktu: 25, kalori: 180,
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
      {
        name: 'Perkedel Tahu Wortel',
        description: 'Perkedel dari tahu dan wortel parut dengan bumbu dasar kuning, kaya serat dan protein nabati.',
        bumbu: 'kuning', estimasi_waktu: 30, kalori: 190,
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
      {
        name: 'Opor Telur',
        description: 'Telur rebus yang dimasak dalam kuah opor kuning santan, gurih dan creamy.',
        bumbu: 'kuning', estimasi_waktu: 30, kalori: 260,
        tips_bekal: 'Kemas kuah opor terpisah. Bisa dimakan dengan lontong atau nasi.',
        ingredients: [
          { name: 'Telur ayam', qty: 2, unit: 'butir' },
          { name: 'Bumbu Dasar Kuning', qty: 2, unit: 'sdm', is_bumbu: true },
          { name: 'Santan', qty: 100, unit: 'ml' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
        ],
        steps: [
          'Rebus telur sampai matang, kupas.',
          'Tumis bumbu dasar kuning, daun salam, dan serai sampai harum.',
          'Tuang santan, aduk rata. Masak api kecil jangan sampai pecah.',
          'Tambahkan garam dan gula.',
          'Masukkan telur rebus, masak 10-15 menit sampai kuah mengental.',
          'Angkat. Sajikan dengan kuah opor.',
        ],
      },
      {
        name: 'Gulai Tahu Telur',
        description: 'Tahu dan telur dalam kuah gulai kuning yang kaya rempah, cocok dengan nasi hangat.',
        bumbu: 'kuning', estimasi_waktu: 30, kalori: 240,
        tips_bekal: 'Gulai makin enak jika dibiarkan meresap. Buat malam, bawa pagi.',
        ingredients: [
          { name: 'Tahu putih (potong)', qty: 100, unit: 'gram' },
          { name: 'Telur ayam', qty: 1, unit: 'butir' },
          { name: 'Bumbu Dasar Kuning', qty: 2, unit: 'sdm', is_bumbu: true },
          { name: 'Santan', qty: 100, unit: 'ml' },
          { name: 'Daun kunyit', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Goreng tahu sebentar sampai berkulit. Rebus telur, kupas.',
          'Tumis bumbu dasar kuning dan daun kunyit sampai harum.',
          'Tuang santan, masak api kecil sambil diaduk.',
          'Tambahkan garam, masukkan tahu dan telur.',
          'Masak 10-15 menit sampai kuah mengental dan bumbu meresap.',
          'Angkat dan sajikan dengan nasi.',
        ],
      },
      {
        name: 'Tempe Bacem',
        description: 'Tempe yang dibacem dengan bumbu dasar kuning, kecap, dan gula merah lalu digoreng.',
        bumbu: 'kuning', estimasi_waktu: 40, kalori: 220,
        tips_bekal: 'Tempe bacem sangat awet dan makin enak saat dingin. Ideal bekal kerja.',
        ingredients: [
          { name: 'Tempe', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Kuning', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Kecap manis', qty: 2, unit: 'sdm' },
          { name: 'Gula merah (sisir)', qty: 10, unit: 'gram' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Air', qty: 150, unit: 'ml' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Potong tempe menjadi segitiga atau persegi.',
          'Campur air, bumbu dasar kuning, kecap manis, gula merah, daun salam, dan garam.',
          'Masukkan tempe, masak api kecil 20-25 menit sampai air menyusut.',
          'Angkat tempe dari sisa bumbu, tiriskan.',
          'Goreng tempe bacem dengan api sedang sampai kecokelatan.',
          'Tiriskan di kertas minyak. Dinginkan sebelum dikemas.',
        ],
      },
      {
        name: 'Ayam Ungkep Kunyit',
        description: 'Ayam yang diungkep dengan bumbu dasar kuning dan kunyit segar, lalu digoreng renyah.',
        bumbu: 'kuning', estimasi_waktu: 45, kalori: 300,
        tips_bekal: 'Ungkep malam sebelumnya, goreng pagi hari. Hasilnya gurih dan renyah.',
        ingredients: [
          { name: 'Ayam sayap/paha', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Kuning', qty: 2, unit: 'sdm', is_bumbu: true },
          { name: 'Air', qty: 100, unit: 'ml' },
          { name: 'Daun salam', qty: 2, unit: 'lembar' },
          { name: 'Serai (geprek)', qty: 1, unit: 'batang' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
        ],
        steps: [
          'Cuci bersih ayam, lumuri dengan bumbu dasar kuning dan garam.',
          'Tambahkan air, daun salam, serai. Ungkep api kecil 25-30 menit.',
          'Masak sampai air benar-benar menyusut dan bumbu menempel.',
          'Angkat ayam, tiriskan.',
          'Goreng ayam ungkep di minyak panas sampai kuning keemasan.',
          'Tiriskan, dinginkan sebelum dikemas.',
        ],
      },
    ];

    // ═══════════════════════════════════════════════════════════════════
    // SAYURAN RECIPES (21 total: 7 merah, 7 putih, 7 kuning)
    // ═══════════════════════════════════════════════════════════════════
    const sayuranRecipes = [
      // ── MERAH (7) ──────────────────────────────────────────────────
      {
        name: 'Tumis Kangkung Terasi',
        description: 'Kangkung segar yang ditumis pedas dengan bumbu dasar merah dan terasi, favorit anak kost.',
        bumbu: 'merah', estimasi_waktu: 12, kalori: 75,
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
      {
        name: 'Tumis Terong Balado',
        description: 'Terong ungu yang ditumis dengan bumbu dasar merah pedas, cocok sebagai pelengkap nasi.',
        bumbu: 'merah', estimasi_waktu: 15, kalori: 80,
        tips_bekal: 'Iris terong agak tebal agar tidak terlalu lembek saat dimakan siang.',
        ingredients: [
          { name: 'Terong ungu', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Tomat (iris)', qty: 30, unit: 'gram' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 2, unit: 'sdm' },
        ],
        steps: [
          'Iris terong serong tebal 1 cm, rendam air garam 5 menit, tiriskan.',
          'Goreng terong sebentar sampai layu, angkat.',
          'Tumis bumbu dasar merah sampai harum, masukkan tomat.',
          'Tambahkan garam dan gula.',
          'Masukkan terong goreng, aduk pelan.',
          'Masak 2-3 menit sampai bumbu meresap. Angkat.',
        ],
      },
      {
        name: 'Sambal Goreng Labu Siam',
        description: 'Labu siam yang ditumis pedas dengan bumbu dasar merah, gurih dan sedikit pedas.',
        bumbu: 'merah', estimasi_waktu: 20, kalori: 70,
        tips_bekal: 'Labu siam tahan lama dan tidak mudah basi. Sangat cocok untuk bekal.',
        ingredients: [
          { name: 'Labu siam', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Lengkuas (geprek)', qty: 1, unit: 'ruas' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Air', qty: 30, unit: 'ml' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Kupas labu siam, potong korek api atau dadu kecil.',
          'Tumis bumbu dasar merah, daun salam, dan lengkuas sampai harum.',
          'Masukkan labu siam, aduk rata.',
          'Tambahkan sedikit air, garam, dan gula.',
          'Masak api sedang 10-12 menit sampai labu empuk tapi tidak lembek.',
          'Angkat saat air sudah menyusut.',
        ],
      },
      {
        name: 'Tumis Kacang Panjang Merah',
        description: 'Kacang panjang yang ditumis pedas dengan bumbu dasar merah, simpel dan bergizi.',
        bumbu: 'merah', estimasi_waktu: 12, kalori: 65,
        tips_bekal: 'Potong kacang panjang pendek-pendek agar mudah dimakan dari kotak bekal.',
        ingredients: [
          { name: 'Kacang panjang', qty: 100, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Tempe (dadu kecil)', qty: 30, unit: 'gram' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Kecap manis', qty: 0.5, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Potong kacang panjang 2-3 cm. Potong tempe dadu kecil.',
          'Goreng tempe sebentar sampai agak kering, angkat.',
          'Tumis bumbu dasar merah sampai harum.',
          'Masukkan kacang panjang, tumis api besar 3-4 menit.',
          'Tambahkan tempe goreng, garam, dan kecap manis.',
          'Aduk rata, angkat saat kacang panjang masih renyah.',
        ],
      },
      {
        name: 'Oseng Wortel Merah',
        description: 'Wortel dan buncis yang dioseng dengan bumbu dasar merah, warna-warni dan kaya vitamin.',
        bumbu: 'merah', estimasi_waktu: 15, kalori: 70,
        tips_bekal: 'Masak sayuran al dente agar tetap renyah sampai jam makan siang.',
        ingredients: [
          { name: 'Wortel', qty: 80, unit: 'gram' },
          { name: 'Buncis', qty: 50, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Kecap manis', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Potong wortel korek api, buncis iris serong 3 cm.',
          'Tumis bumbu dasar merah sampai harum.',
          'Masukkan wortel dulu, tumis 2 menit.',
          'Tambahkan buncis, tumis 2-3 menit lagi.',
          'Bumbui dengan kecap manis dan garam.',
          'Angkat saat sayuran masih sedikit renyah.',
        ],
      },
      {
        name: 'Tumis Tahu Sawi Merah',
        description: 'Sawi hijau dan tahu yang ditumis dengan bumbu dasar merah, pedas dan segar.',
        bumbu: 'merah', estimasi_waktu: 15, kalori: 85,
        tips_bekal: 'Pisahkan tahu dari sawi saat mengemas agar sawi tidak terlalu lembek.',
        ingredients: [
          { name: 'Sawi hijau', qty: 100, unit: 'gram' },
          { name: 'Tahu putih (potong)', qty: 50, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Saus tiram', qty: 0.5, unit: 'sdm' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Potong sawi hijau 4-5 cm. Potong tahu dadu, goreng sebentar.',
          'Tumis bumbu dasar merah sampai harum.',
          'Masukkan batang sawi dulu, tumis 1 menit.',
          'Tambahkan daun sawi dan tahu goreng.',
          'Bumbui dengan saus tiram dan garam.',
          'Tumis api besar 2 menit, angkat.',
        ],
      },
      {
        name: 'Balado Kentang',
        description: 'Kentang goreng kecil yang dibalut bumbu balado merah pedas, renyah dan nendang.',
        bumbu: 'merah', estimasi_waktu: 25, kalori: 120,
        tips_bekal: 'Goreng kentang sampai benar-benar kering agar tetap renyah di bekal.',
        ingredients: [
          { name: 'Kentang', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Merah', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Daun jeruk', qty: 2, unit: 'lembar' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 3, unit: 'sdm' },
        ],
        steps: [
          'Kupas kentang, potong dadu kecil 1 cm.',
          'Goreng kentang sampai kuning kering, tiriskan.',
          'Tumis bumbu dasar merah dan daun jeruk sampai harum.',
          'Tambahkan garam dan gula.',
          'Masukkan kentang goreng, aduk rata sampai bumbu menyelimuti.',
          'Angkat, biarkan dingin.',
        ],
      },

      // ── PUTIH (7) ──────────────────────────────────────────────────
      {
        name: 'Tumis Buncis Bawang Putih',
        description: 'Buncis segar yang ditumis sederhana dengan bumbu dasar putih, renyah dan sehat.',
        bumbu: 'putih', estimasi_waktu: 15, kalori: 85,
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
      {
        name: 'Sayur Bayam Bening',
        description: 'Sayur bayam bening yang segar dan ringan dengan bumbu dasar putih, kaya zat besi.',
        bumbu: 'putih', estimasi_waktu: 15, kalori: 60,
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
      {
        name: 'Urap Sayuran',
        description: 'Campuran sayuran rebus dengan kelapa parut berbumbu dasar putih, khas Jawa yang sehat.',
        bumbu: 'putih', estimasi_waktu: 25, kalori: 110,
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
      {
        name: 'Sop Sayuran Bening',
        description: 'Sop sayuran bening yang hangat dan menyehatkan dengan bumbu dasar putih.',
        bumbu: 'putih', estimasi_waktu: 20, kalori: 65,
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
      {
        name: 'Tumis Labu Siam Putih',
        description: 'Labu siam yang ditumis lembut dengan bumbu dasar putih, sederhana dan menyehatkan.',
        bumbu: 'putih', estimasi_waktu: 15, kalori: 55,
        tips_bekal: 'Labu siam tidak mudah basi, cocok untuk bekal sepanjang hari.',
        ingredients: [
          { name: 'Labu siam', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Wortel (iris)', qty: 30, unit: 'gram' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Merica bubuk', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Kupas labu siam, potong korek api.',
          'Tumis bumbu dasar putih sampai harum.',
          'Masukkan wortel, tumis 2 menit.',
          'Tambahkan labu siam, aduk rata.',
          'Bumbui dengan garam dan merica, tumis 5-7 menit.',
          'Angkat saat labu empuk tapi tidak lembek.',
        ],
      },
      {
        name: 'Sayur Lodeh Sederhana',
        description: 'Sayur lodeh dengan bumbu dasar putih dan santan ringan, hangat dan bergizi.',
        bumbu: 'putih', estimasi_waktu: 25, kalori: 90,
        tips_bekal: 'Bawa kuah terpisah dalam wadah anti tumpah.',
        ingredients: [
          { name: 'Labu siam', qty: 50, unit: 'gram' },
          { name: 'Kacang panjang', qty: 40, unit: 'gram' },
          { name: 'Tahu (potong)', qty: 50, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Santan encer', qty: 100, unit: 'ml' },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
        ],
        steps: [
          'Potong labu siam, kacang panjang, dan tahu.',
          'Tumis bumbu dasar putih dan daun salam sampai harum.',
          'Tuang santan, masak api kecil.',
          'Masukkan labu siam dan kacang panjang.',
          'Tambahkan tahu, garam, gula. Masak 10-15 menit.',
          'Angkat saat sayuran empuk.',
        ],
      },
      {
        name: 'Tumis Toge Bawang',
        description: 'Tauge segar yang ditumis cepat dengan bumbu dasar putih, renyah dan menyegarkan.',
        bumbu: 'putih', estimasi_waktu: 10, kalori: 50,
        tips_bekal: 'Tumis sebentar saja agar toge tetap renyah. Masak pagi hari.',
        ingredients: [
          { name: 'Tauge', qty: 120, unit: 'gram' },
          { name: 'Bumbu Dasar Putih', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Daun bawang (iris)', qty: 10, unit: 'gram' },
          { name: 'Kecap manis', qty: 0.5, unit: 'sdt' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Cuci bersih tauge, buang ekornya jika ingin rapi.',
          'Tumis bumbu dasar putih sampai harum.',
          'Masukkan tauge dan daun bawang.',
          'Tumis api besar 1-2 menit saja (jangan terlalu lama).',
          'Tambahkan kecap manis dan garam.',
          'Angkat segera agar tauge tetap renyah.',
        ],
      },

      // ── KUNING (7) ─────────────────────────────────────────────────
      {
        name: 'Capcay Sayuran',
        description: 'Campuran sayuran segar yang ditumis dengan bumbu dasar kuning, penuh warna dan nutrisi.',
        bumbu: 'kuning', estimasi_waktu: 20, kalori: 95,
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
          'Masukkan wortel dan baby corn terlebih dahulu, tumis 2 menit.',
          'Tambahkan kembang kol dan brokoli, tumis 2-3 menit.',
          'Tuang sedikit air, tambahkan saus tiram dan garam.',
          'Masak 2-3 menit sampai sayuran matang tapi masih renyah. Angkat.',
        ],
      },
      {
        name: 'Sayur Asem Sederhana',
        description: 'Sayur asem segar dengan bumbu dasar kuning dan asam jawa, menyegarkan untuk makan siang.',
        bumbu: 'kuning', estimasi_waktu: 25, kalori: 70,
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
      {
        name: 'Sayur Nangka Kuning',
        description: 'Nangka muda yang dimasak dalam kuah kuning santan, lembut dan gurih.',
        bumbu: 'kuning', estimasi_waktu: 30, kalori: 85,
        tips_bekal: 'Nangka muda awet dan makin enak saat dingin. Kemas kuah terpisah.',
        ingredients: [
          { name: 'Nangka muda (potong)', qty: 100, unit: 'gram' },
          { name: 'Bumbu Dasar Kuning', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Santan encer', qty: 100, unit: 'ml' },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Lengkuas (geprek)', qty: 1, unit: 'ruas' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
        ],
        steps: [
          'Potong nangka muda seukuran gigitan, rebus 10 menit.',
          'Tumis bumbu dasar kuning, daun salam, lengkuas sampai harum.',
          'Tuang santan, masak api kecil.',
          'Masukkan nangka muda rebus.',
          'Tambahkan garam dan gula, masak 10-15 menit.',
          'Angkat saat nangka empuk dan kuah mengental.',
        ],
      },
      {
        name: 'Tumis Labu Kuning',
        description: 'Labu kuning yang ditumis dengan bumbu dasar kuning, manis alami dan kaya beta karoten.',
        bumbu: 'kuning', estimasi_waktu: 15, kalori: 75,
        tips_bekal: 'Potong labu agak tebal agar tidak hancur saat dikemas.',
        ingredients: [
          { name: 'Labu kuning', qty: 150, unit: 'gram' },
          { name: 'Bumbu Dasar Kuning', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Kupas labu kuning, potong dadu 2 cm.',
          'Tumis bumbu dasar kuning dan daun salam sampai harum.',
          'Masukkan labu kuning, aduk pelan.',
          'Tambahkan sedikit air, garam, gula.',
          'Masak api kecil 8-10 menit sampai labu empuk.',
          'Angkat pelan-pelan agar labu tidak hancur.',
        ],
      },
      {
        name: 'Sayur Kare Sayuran',
        description: 'Sayuran campur dalam kuah kare kuning yang creamy dan harum rempah.',
        bumbu: 'kuning', estimasi_waktu: 25, kalori: 100,
        tips_bekal: 'Kare makin enak saat hangat. Bawa dalam termos jika memungkinkan.',
        ingredients: [
          { name: 'Kentang', qty: 50, unit: 'gram' },
          { name: 'Wortel', qty: 40, unit: 'gram' },
          { name: 'Buncis', qty: 30, unit: 'gram' },
          { name: 'Bumbu Dasar Kuning', qty: 1.5, unit: 'sdm', is_bumbu: true },
          { name: 'Santan', qty: 100, unit: 'ml' },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
        ],
        steps: [
          'Potong kentang, wortel dadu. Buncis iris serong.',
          'Tumis bumbu dasar kuning dan daun salam sampai harum.',
          'Tuang santan, masak api kecil.',
          'Masukkan kentang dan wortel, masak 7-8 menit.',
          'Tambahkan buncis, garam, gula. Masak 3-4 menit.',
          'Angkat saat kuah mengental dan sayuran empuk.',
        ],
      },
      {
        name: 'Bobor Bayam',
        description: 'Bayam yang dimasak dalam kuah santan kuning, creamy dan bergizi tinggi.',
        bumbu: 'kuning', estimasi_waktu: 15, kalori: 80,
        tips_bekal: 'Bawa kuah terpisah, tambahkan bayam saat akan dimakan agar tetap hijau.',
        ingredients: [
          { name: 'Bayam segar', qty: 80, unit: 'gram' },
          { name: 'Bumbu Dasar Kuning', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Santan encer', qty: 100, unit: 'ml' },
          { name: 'Jagung manis (iris)', qty: 30, unit: 'gram' },
          { name: 'Daun salam', qty: 1, unit: 'lembar' },
          { name: 'Garam', qty: 0.25, unit: 'sdt' },
        ],
        steps: [
          'Petik daun bayam, cuci bersih.',
          'Tumis bumbu dasar kuning dan daun salam sampai harum.',
          'Tuang santan, masak api kecil.',
          'Masukkan jagung, masak 3-4 menit.',
          'Tambahkan bayam dan garam, masak 1-2 menit saja.',
          'Angkat segera agar bayam tetap segar.',
        ],
      },
      {
        name: 'Tumis Pare Kuning',
        description: 'Pare yang ditumis dengan bumbu dasar kuning dan telur, rasa pahit yang berkurang dan menyehatkan.',
        bumbu: 'kuning', estimasi_waktu: 15, kalori: 70,
        tips_bekal: 'Rendam pare dengan garam sebelum dimasak untuk mengurangi rasa pahit.',
        ingredients: [
          { name: 'Pare', qty: 100, unit: 'gram' },
          { name: 'Telur ayam', qty: 1, unit: 'butir' },
          { name: 'Bumbu Dasar Kuning', qty: 1, unit: 'sdm', is_bumbu: true },
          { name: 'Garam', qty: 0.5, unit: 'sdt' },
          { name: 'Gula pasir', qty: 0.25, unit: 'sdt' },
          { name: 'Minyak goreng', qty: 1, unit: 'sdm' },
        ],
        steps: [
          'Belah pare, buang biji, iris tipis. Rendam di air garam 15 menit, remas, bilas.',
          'Tumis bumbu dasar kuning sampai harum.',
          'Masukkan pare, tumis 3-4 menit.',
          'Tambahkan garam dan gula.',
          'Masukkan telur, orak-arik bersama pare.',
          'Masak sampai telur matang. Angkat.',
        ],
      },
    ];

    // ═══════════════════════════════════════════════════════════════════
    // INSERT ALL RECIPES INTO POOL
    // ═══════════════════════════════════════════════════════════════════
    const allRecipes = [
      ...proteinRecipes.map(r => ({ ...r, category: 'protein' })),
      ...sayuranRecipes.map(r => ({ ...r, category: 'sayuran' })),
    ];

    for (const recipe of allRecipes) {
      const bumbuId = bumbuIds[recipe.bumbu];
      const { rows: recipeRows } = await client.query(
        `INSERT INTO bekal_recipe_pool (name, description, category, bumbu_dasar_id, estimasi_waktu, kalori_estimasi, tips_bekal)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [recipe.name, recipe.description, recipe.category, bumbuId, recipe.estimasi_waktu, recipe.kalori, recipe.tips_bekal]
      );
      const poolId = recipeRows[0].id;

      // Insert ingredients
      for (let j = 0; j < recipe.ingredients.length; j++) {
        const ing = recipe.ingredients[j];
        await client.query(
          `INSERT INTO bekal_pool_ingredients (pool_recipe_id, name, quantity_per_portion, unit, is_bumbu_dasar, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [poolId, ing.name, ing.qty, ing.unit, ing.is_bumbu || false, j]
        );
      }

      // Insert steps
      for (let k = 0; k < recipe.steps.length; k++) {
        await client.query(
          `INSERT INTO bekal_pool_steps (pool_recipe_id, step_number, instruction) VALUES ($1, $2, $3)`,
          [poolId, k + 1, recipe.steps[k]]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Bekal recipe pool seeded: ${allRecipes.length} templates (${proteinRecipes.length} protein, ${sayuranRecipes.length} sayuran).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding bekal recipe pool:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seedBekalPool };
