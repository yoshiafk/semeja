#!/usr/bin/env node
/**
 * Seed script: Semarang–Yogyakarta trip (16–23 Agustus 2026)
 * Source: itinerary_semarang_jogja.md
 *
 * Idempotent: uses ON CONFLICT (slug) DO NOTHING for the trip row.
 * If trip already exists, all child rows are skipped too.
 * Safe to re-run.
 *
 * Usage: node server/scripts/seed-trip-semarang-jogja.js
 */

require('dotenv').config();
const { pool } = require('../db');

async function seedTripSemarangJogja() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Trip ──────────────────────────────────────────────────────────
    const { rows: tripRows } = await client.query(`
      INSERT INTO trips (slug, title, subtitle, start_date, end_date, participant_count, transport, pace, status, cover_city)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `, [
      'semarang-jogja-2026',
      'Semarang — Yogyakarta',
      'Trip 16–23 Agustus 2026',
      '2026-08-16',
      '2026-08-23',
      3,
      JSON.stringify(['Kereta', 'Travel', 'Gojek/Grab Car']),
      'Normal (4–5 spot/hari)',
      'upcoming',
      'semarang',
    ]);

    if (tripRows.length === 0) {
      console.log('ℹ️  Trip semarang-jogja-2026 already seeded. Skipping.');
      await client.query('ROLLBACK');
      return;
    }

    const tripId = tripRows[0].id;
    console.log(`✓ Trip inserted (id=${tripId})`);

    // ── 2. Hotels ────────────────────────────────────────────────────────

    // Hotel 1 — Djajanti House (Semarang)
    const { rows: h1 } = await client.query(`
      INSERT INTO trip_hotels (trip_id, name, city, address, maps_url, check_in, check_out, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      tripId,
      'Djajanti House',
      'semarang',
      'Jl. Semeru Raya No.4b, Karangrejo, Gajahmungkur, Semarang',
      'https://www.google.com/maps/search/?api=1&query=Djajanti+House+Semarang',
      '2026-08-16',
      '2026-08-19',
      1,
    ]);
    const h1id = h1[0].id;

    await client.query(`
      INSERT INTO trip_hotel_distances (hotel_id, destination, distance_km, duration, sort_order) VALUES
      ($1, 'Simpang Lima / Pusat Kota', '±2 km', '~7 menit', 1),
      ($1, 'Kota Lama', '±4 km', '~10 menit', 2),
      ($1, 'Pantai Barat (Marina/POJ City)', '±12 km', '~25 menit', 3)
    `, [h1id]);

    // Hotel 2 — Ndalem Cokro (Yogyakarta)
    const { rows: h2 } = await client.query(`
      INSERT INTO trip_hotels (trip_id, name, city, address, maps_url, check_in, check_out, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      tripId,
      'Ndalem Cokro',
      'yogyakarta',
      'JT II No.133, Cokrodiningratan, Jetis, Yogyakarta',
      'https://maps.app.goo.gl/yHaxCXpkmPkEhrdS8',
      '2026-08-19',
      '2026-08-23',
      2,
    ]);
    const h2id = h2[0].id;

    await client.query(`
      INSERT INTO trip_hotel_distances (hotel_id, destination, distance_km, duration, sort_order) VALUES
      ($1, 'Malioboro', '±1.5 km', '~5 menit', 1),
      ($1, 'Jl. Kaliurang (Toko Buku Akik)', '±12 km', '~25 menit', 2),
      ($1, 'Prambanan', '±17 km', '~35 menit', 3)
    `, [h2id]);

    console.log('✓ Hotels inserted');

    // ── 3. Days ──────────────────────────────────────────────────────────
    // Helper to insert a day and return its id
    async function insertDay({ dayNumber, date, label, city, areaNote, warningNote }) {
      const { rows } = await client.query(`
        INSERT INTO trip_days (trip_id, day_number, date, label, city, area_note, warning_note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [tripId, dayNumber, date, label, city, areaNote || '', warningNote || '']);
      return rows[0].id;
    }

    // Helper to insert schedule items for a day
    async function insertItems(dayId, items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO trip_schedule_items
            (day_id, time_start, time_end, name, activity_type, location, area, maps_url,
             notes, opening_hours, is_highlight, is_cash_only, requires_booking, is_optional, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [
          dayId,
          it.time_start,
          it.time_end || '',
          it.name,
          it.activity_type,
          it.location || '',
          it.area || '',
          it.maps_url || '',
          it.notes || '',
          it.opening_hours || '',
          it.is_highlight || false,
          it.is_cash_only || false,
          it.requires_booking || false,
          it.is_optional || false,
          i + 1,
        ]);
      }
    }

    // ── Day 1 — Minggu, 16 Agustus · Kedatangan & Kota Lama ─────────────
    const d1 = await insertDay({
      dayNumber: 1,
      date: '2026-08-16',
      label: 'Minggu, 16 Agustus',
      city: 'semarang',
      areaNote: 'Hotel (Gajahmungkur) → Kota Lama (4 km). Museum buka hari Minggu, Chinatown paling ramai Minggu malam.',
      warningNote: '',
    });
    await insertItems(d1, [
      {
        time_start: '09.00', time_end: '11.00',
        name: 'Tiba di Semarang, perjalanan ke hotel',
        activity_type: 'transit',
        location: 'Stasiun → Djajanti House', area: 'Transit',
        notes: 'Istirahat sejenak, titip koper jika kamar belum siap',
      },
      {
        time_start: '11.30',
        name: 'Sarapan: Soto Bokoran',
        activity_type: 'food',
        location: 'Jl. Plampitan No.55', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Soto+Bokoran/data=!4m2!3m1!1s0x2e708b54fea79601:0x70de81d1e30e49ae',
        opening_hours: 'Buka 06.00–14.00',
        notes: 'Singgah sebelum museum',
        is_highlight: true,
      },
      {
        time_start: '13.00',
        name: 'Museum Kota Lama',
        activity_type: 'attraction',
        location: 'Jl. K.H. Agus Salim No.1a', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Museum+Kota+Lama/data=!4m2!3m1!1s0x2e70f3440cad0335:0xeb5fca3a7a7dea9c',
        opening_hours: 'Buka Selasa-Minggu 09.00–15.30',
        notes: 'Tutup Senin',
        is_highlight: true,
      },
      {
        time_start: '15.00',
        name: 'Blenduk Church + Rumah Akar + Siwil Art',
        activity_type: 'attraction',
        location: 'Jl. Letjen Suprapto', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Blenduk+Church/data=!4m2!3m1!1s0x2e70f34349b8e345:0x8fd1c780aa92f074',
        notes: 'Semua berdekatan, jalan kaki',
      },
      {
        time_start: '16.00',
        name: 'Gedung Marba',
        activity_type: 'attraction',
        location: 'Jl. Letjen Suprapto', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Gedung+Marba+(+Martak+-+Bajunaid+)+-+History+of+Yemeni+Bussinesman+-+%D8%B1%D8%AC%D9%84+%0A%D8%A3%D8%B9%D9%85%D8%A7%D9%84+%D9%8A%D9%85%D9%86%D9%8A+-+in+Semarang%E2%80%AD/data=!4m2!3m1!1s0x2e70f3683fa0766b:0x677729a78e5c5ec5',
        notes: 'Persis di samping area Blenduk, foto-foto',
      },
      {
        time_start: '17.00',
        name: 'Pasar Barang Antik Kota Lama',
        activity_type: 'shopping',
        location: 'Jl. Letjen Suprapto No.32', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Pasar+Barang+Antik+Kota+Lama/data=!4m2!3m1!1s0x2e70f3564f4e21a7:0x23b629f6d552013d',
        notes: 'Sambil nunggu golden hour',
      },
      {
        time_start: '18.00',
        name: 'Makan malam: Spiegel All Day Bar & Dining',
        activity_type: 'food',
        location: 'Jl. Letjen Suprapto No.34', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Spiegel+All+Day+Bar+%26+Dining/data=!4m2!3m1!1s0x2e70f35645b5ee07:0xc16b477d1b7f7bd4',
        opening_hours: 'Buka 10.00–01.00',
        notes: 'Gedung kolonial estetik',
        is_highlight: true,
      },
      {
        time_start: '20.00',
        name: 'Semarang Chinatown / Pecinan',
        activity_type: 'leisure',
        location: 'Kauman, Semarang Tengah', area: 'Pusat Kota',
        maps_url: 'https://www.google.com/maps/place/Semarang+Chinatown/data=!4m2!3m1!1s0x2e70f4aab14d29ab:0xbe7ff6928f077887',
        notes: 'Ramai khas Minggu malam 18.00–22.00',
        is_highlight: true,
      },
      {
        time_start: '21.30',
        name: 'Es Teh Tik (nightcap santai)',
        activity_type: 'food',
        location: 'Taman Srigunting', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Es+Teh+Tik/data=!4m2!3m1!1s0x2e70f3e2d93d695f:0xccf043625b20db38',
        opening_hours: 'Buka dari 09.00 (Minggu)',
        notes: 'Kembali ke Kota Lama',
      },
      {
        time_start: '22.00',
        name: 'Kembali ke Djajanti House',
        activity_type: 'transit',
        area: 'Hotel',
        notes: '±4 km dari Kota Lama',
      },
    ]);

    // ── Day 2 — Senin, 17 Agustus · HUT RI ──────────────────────────────
    const d2 = await insertDay({
      dayNumber: 2,
      date: '2026-08-17',
      label: 'Senin, 17 Agustus 2026',
      city: 'semarang',
      areaNote: 'Hotel → Kota Lama → Pusat Kota (sirkuit 2–4 km)',
      warningNote: 'Hindari Simpang Lima & Jl. Pandanaran pagi (06.00–09.00) dan sore (16.00–18.00) karena upacara HUT RI.',
    });
    await insertItems(d2, [
      {
        time_start: '07.30',
        name: 'Sarapan: Soto Seger Old City',
        activity_type: 'food',
        location: 'Jl. Letjen Suprapto No.57', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Soto+Seger+Old+City+Semarang/data=!4m2!3m1!1s0x2e70f33de23c9bd1:0xa0c07872375deb7c',
        notes: 'Hindari rute Simpang Lima pagi ini',
      },
      {
        time_start: '09.30',
        name: 'Lawang Sewu',
        activity_type: 'attraction',
        location: 'Jl. Pemuda No.160', area: 'Pusat Kota',
        maps_url: 'https://www.google.com/maps/place/Lawang+Sewu/data=!4m2!3m1!1s0x2e708b4f19af0393:0x11304de4230ded0d',
        opening_hours: 'Buka s/d 17.00',
        notes: 'Upacara pagi biasanya selesai ~09.00',
        is_highlight: true,
      },
      {
        time_start: '11.30',
        name: 'Titik Nol KM Semarang',
        activity_type: 'attraction',
        location: 'Dadapsari', area: 'Pusat Kota',
        maps_url: 'https://www.google.com/maps/place/Titik+Nol+KM+Semarang/data=!4m2!3m1!1s0x2e70f4a993f779af:0x742971f6803ad9e',
        notes: 'Foto sebentar',
      },
      {
        time_start: '12.30',
        name: 'Makan siang: Ayam Goreng Pak Supar',
        activity_type: 'food',
        location: 'Jl. Moh. Suyudi No.48', area: 'Pusat Kota',
        maps_url: 'https://www.google.com/maps/place/Ayam+Goreng+Pak+Supar/data=!4m2!3m1!1s0x2e708b51228c5755:0xadb71ab2745e043f',
        notes: 'Legendaris',
        is_highlight: true,
        is_cash_only: true,
      },
      {
        time_start: '14.00',
        name: 'Lunpia Gang Lombok (oleh-oleh)',
        activity_type: 'shopping',
        location: 'Jl. Inspeksi No.11', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Lunpia+Gang+Lombok/data=!4m2!3m1!1s0x2e70f4aa7e3a8d9f:0x8d8d0da5ebb94c1b',
        opening_hours: 'Buka 07.00–16.00',
      },
      {
        time_start: '15.00',
        name: 'Kampung Batik Gedong',
        activity_type: 'leisure',
        location: 'Jl. Batik No.698A', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Kampung+Batik+Gedong+Semarang/data=!4m2!3m1!1s0x2e70f356bb103405:0x5be6eccb461174cf',
        notes: 'Jalan-jalan, lihat mural',
      },
      {
        time_start: '16.00',
        name: 'me.mo coffee (ngopi sore)',
        activity_type: 'food',
        location: 'Jl. Sayangan No.50', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/me.mo+coffee/data=!4m2!3m1!1s0x2e70f3794ba3cbef:0xf9dec690c346ba48',
        notes: 'Sengaja di Kota Lama, jauh dari Simpang Lima saat penurunan bendera',
      },
      {
        time_start: '17.30',
        name: 'Tahu Petis Gorengan Prasojo',
        activity_type: 'food',
        location: 'Jl. Pringgading', area: 'Pusat Kota',
        maps_url: 'https://www.google.com/maps/place/Tahu+Petis+Gorengan+PRASOJO+Pringgading/data=!4m2!3m1!1s0x2e708ca85802540f:0xd0e1669c269035ff',
        opening_hours: 'Buka 15.00–22.30',
        notes: 'Cocok untuk cemilan sore',
      },
      {
        time_start: '19.00',
        name: 'Lapangan Pancasila Simpang Lima',
        activity_type: 'leisure',
        location: 'Simpang Lima', area: 'Pusat Kota',
        maps_url: 'https://www.google.com/maps/place/Lapangan+Pancasila+Simpang+Lima+Semarang/data=!4m2!3m1!1s0x2e708b59293bdfe5:0x684ecd8ad245383a',
        notes: 'Suasana meriah setelah upacara sore selesai',
      },
      {
        time_start: '20.30',
        name: 'Makan malam: Sego Bancakan Pawonesimbah',
        activity_type: 'food',
        location: 'Jl. Letjen Suprapto No.22', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Sego+Bancakan+Pawonesimbah/data=!4m2!3m1!1s0x2e70f53b633770fd:0xc3e093f00e7e8243',
        notes: 'Nuansa Jawa klasik',
        is_highlight: true,
      },
      {
        time_start: '22.00',
        name: 'KOV KOFFIE HERITAGE (opsional)',
        activity_type: 'food',
        location: 'Jl. Letjen Suprapto No.3', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/KOV+KOFFIE+HERITAGE/data=!4m2!3m1!1s0x2e70f5b64fcf2f73:0x56cd9f3863ccc9eb',
        notes: 'Cafe 24 jam di gedung kolonial',
        is_optional: true,
      },
    ]);

    // ── Day 3 — Selasa, 18 Agustus · Pantai Barat & Sunset ──────────────
    const d3 = await insertDay({
      dayNumber: 3,
      date: '2026-08-18',
      label: 'Selasa, 18 Agustus 2026',
      city: 'semarang',
      areaNote: 'Hotel (Gajahmungkur) → Pantai Barat (12 km, ~25 menit) → kembali ke Pusat Kota. Efisien dibuat dalam 1 trip panjang.',
      warningNote: '',
    });
    await insertItems(d3, [
      {
        time_start: '09.00',
        name: 'Sarapan: Nasi Ayam Bu Pini',
        activity_type: 'food',
        location: 'Gg. Pinggir No.75', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Nasi+Ayam+Bu+Pini/data=!4m2!3m1!1s0x2e708caac1cd2b0d:0x2aadfd9f55274a39',
        opening_hours: 'Buka 05.30–21.30',
      },
      {
        time_start: '10.30',
        name: 'Marina Beach',
        activity_type: 'attraction',
        location: 'Tawangsari', area: 'Pantai Barat',
        maps_url: 'https://www.google.com/maps/place/Marina+Beach/data=!4m2!3m1!1s0x2e70f4e56e4f8ea1:0xcf2bee72d0606dd0',
        opening_hours: 'Buka 05.30–18.00',
        notes: '1 trip langsung',
        is_highlight: true,
      },
      {
        time_start: '12.30',
        name: 'Makan siang ringan di sekitar Marina',
        activity_type: 'food',
        location: 'POJ City', area: 'Pantai Barat',
        notes: 'Warung di area marina',
      },
      {
        time_start: '14.00',
        name: 'AWANNCOSTA',
        activity_type: 'leisure',
        location: 'POJ City', area: 'Pantai Barat',
        maps_url: 'https://www.google.com/maps/place/AWANNCOSTA/data=!4m2!3m1!1s0x2e708bfb78305e69:0x71ecdfa746cd3294',
        notes: 'Santai, ngafe, playground',
      },
      {
        time_start: '16.00',
        name: 'Costa Beach Club (sunset)',
        activity_type: 'event',
        location: 'Kawasan Bibir Pantai', area: 'Pantai Barat',
        maps_url: 'https://www.google.com/maps/place/Costa+Beach+Club/data=!4m2!3m1!1s0x2e70f59b4368ee27:0xa9b46356532dab2b',
        notes: 'Booking tempat duduk deck H-1',
        is_highlight: true,
        requires_booking: true,
      },
      {
        time_start: '18.00',
        name: 'Dinner: Costa Beach Club',
        activity_type: 'food',
        location: 'Pantai Barat', area: 'Pantai Barat',
        notes: 'Makan malam dengan view laut',
        is_highlight: true,
      },
      {
        time_start: '20.00',
        name: 'Kembali ke Djajanti House',
        activity_type: 'transit',
        area: 'Hotel',
        notes: '±12 km, ~25 menit',
      },
    ]);

    // ── Day 4 — Rabu, 19 Agustus · Santai & Berangkat ke Jogja ──────────
    const d4 = await insertDay({
      dayNumber: 4,
      date: '2026-08-19',
      label: 'Rabu, 19 Agustus 2026',
      city: 'transit',
      areaNote: 'Hotel → Kota Lama (oleh-oleh) → Jogja (Travel 14.00)',
      warningNote: '',
    });
    await insertItems(d4, [
      {
        time_start: '09.00',
        name: 'Sarapan & santai di Djajanti House',
        activity_type: 'leisure',
        area: 'Hotel',
        notes: 'Nikmati suasana rimbun villa sebelum check-out',
      },
      {
        time_start: '10.00',
        name: 'Check-out Djajanti House',
        activity_type: 'hotel',
        area: 'Hotel',
      },
      {
        time_start: '10.30',
        name: 'Toko OLA (belanja produk lokal)',
        activity_type: 'shopping',
        location: 'Jl. Cendrawasih No.25', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Toko+OLA/data=!4m2!3m1!1s0x2e70f30f4e53a541:0x21d538afdac70a0f',
        opening_hours: 'Buka 10.00–21.00',
      },
      {
        time_start: '11.00',
        name: 'Lekker Paimo (oleh-oleh cemilan)',
        activity_type: 'shopping',
        location: 'Jl. Karang Anyar No.37', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Lekker+Paimo/data=!4m2!3m1!1s0x2e708ca9de20d71f:0x4b14ec14a672c7d5',
        opening_hours: 'Buka Senin–Sabtu 09.00–17.00',
        notes: 'Rabu aman',
      },
      {
        time_start: '12.00',
        name: 'Makan siang terakhir di Semarang: Ayam Goreng Sayangan',
        activity_type: 'food',
        location: 'Jl. Mt. Haryono No.1B', area: 'Kota Lama',
        maps_url: 'https://www.google.com/maps/place/Ayam+Goreng+Sayangan/data=!4m2!3m1!1s0x2e70f356dc4760f5:0x876c0c89d6c0fd78',
        opening_hours: 'Buka 10.30–23.00',
      },
      {
        time_start: '13.30',
        name: 'Perjalanan menuju titik jemput Travel',
        activity_type: 'transit',
        area: 'Transit',
      },
      {
        time_start: '14.00',
        name: 'Berangkat ke Yogyakarta via Travel',
        activity_type: 'transit',
        area: 'Transit',
        notes: 'Estimasi tiba Jogja ~16.00',
        is_highlight: true,
      },
      {
        time_start: '16.00',
        name: 'Tiba di Yogyakarta, check-in Ndalem Cokro',
        activity_type: 'hotel',
        location: 'JT II No.133, Jetis', area: 'Hotel',
        maps_url: 'https://maps.app.goo.gl/yHaxCXpkmPkEhrdS8',
        is_highlight: true,
      },
      {
        time_start: '18.30',
        name: 'Jalan santai malam ke area Malioboro',
        activity_type: 'leisure',
        location: 'Malioboro', area: 'Kota',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Jalan+Malioboro+Yogyakarta',
        notes: 'Orientasi lingkungan',
      },
      {
        time_start: '19.30',
        name: 'Makan malam pertama: Bakmi Jawa Mbah Gito',
        activity_type: 'food',
        location: 'Area Kota', area: 'Kota',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Bakmi+Jawa+Mbah+Gito+Kotagede',
        notes: 'Nuansa warung artistik kayu khas Jawa, viral 2026',
        is_highlight: true,
      },
    ]);

    // ── Day 5 — Kamis, 20 Agustus · Literasi & Kaliurang ────────────────
    const d5 = await insertDay({
      dayNumber: 5,
      date: '2026-08-20',
      label: 'Kamis, 20 Agustus 2026',
      city: 'yogyakarta',
      areaNote: 'Ndalem Cokro → Toko Buku Akik: ±12 km ke utara via Jl. Kaliurang (satu jalur lurus)',
      warningNote: '',
    });
    await insertItems(d5, [
      {
        time_start: '09.00',
        name: 'Sarapan di area Ndalem Cokro',
        activity_type: 'food',
        location: 'Sekitar Jetis', area: 'Kota',
        notes: 'Banyak warung pagi di area Cokrodiningratan',
      },
      {
        time_start: '10.00',
        name: 'Toko Buku Akik',
        activity_type: 'attraction',
        location: 'Jl. Kaliurang Km 12', area: 'Sleman',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Toko+Buku+Akik+Sleman',
        opening_hours: 'Buka 10.00–16.30',
        notes: 'Homey, koleksi independen',
        is_highlight: true,
      },
      {
        time_start: '12.00',
        name: 'Makan siang: Warung Kopi Klotok',
        activity_type: 'food',
        location: 'Pakem, Kaliurang', area: 'Sleman',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Warung+Kopi+Klotok+Kaliurang',
        notes: '±7 km utara dari Buku Akik. Viral 2025–2026',
        is_highlight: true,
      },
      {
        time_start: '14.00',
        name: 'Jakal Bookshop Fest',
        activity_type: 'leisure',
        location: 'Sepanjang Jl. Kaliurang', area: 'Sleman',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Jalan+Kaliurang+Sleman',
        notes: 'Searah perjalanan pulang ke kota',
      },
      {
        time_start: '17.00',
        name: 'Kembali ke Ndalem Cokro',
        activity_type: 'transit',
        area: 'Hotel',
        notes: '±12 km ke selatan',
      },
      {
        time_start: '19.00',
        name: 'Makan malam: Gudeg Yu Djum',
        activity_type: 'food',
        location: 'Wijilan / Mbarek', area: 'Kota',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Gudeg+Yu+Djum+Wijilan',
        notes: 'Gudeg kering ikonik sejak 1950-an',
        is_highlight: true,
      },
    ]);

    // ── Day 6 — Jumat, 21 Agustus · Keraton & Raminten Cabaret ──────────
    const d6 = await insertDay({
      dayNumber: 6,
      date: '2026-08-21',
      label: 'Jumat, 21 Agustus 2026',
      city: 'yogyakarta',
      areaNote: 'Ndalem Cokro → Keraton: ±2.5 km. Semua titik hari ini dalam radius 3 km dari hotel.',
      warningNote: '',
    });
    await insertItems(d6, [
      {
        time_start: '09.00',
        name: 'Keraton Yogyakarta',
        activity_type: 'attraction',
        location: 'Jl. Rotowijayan', area: 'Keraton',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Keraton+Yogyakarta',
        opening_hours: 'Buka 08.00–14.00',
        is_highlight: true,
      },
      {
        time_start: '11.00',
        name: 'Taman Sari (Water Castle)',
        activity_type: 'attraction',
        location: 'Jl. Taman', area: 'Keraton',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Taman+Sari+Yogyakarta',
        notes: '±700 m jalan kaki dari Keraton',
        is_highlight: true,
      },
      {
        time_start: '12.30',
        name: 'Makan siang: The House of Raminten',
        activity_type: 'food',
        location: 'Jl. FM Noto, Kotabaru', area: 'Kota',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=The+House+of+Raminten+Kotabaru',
        notes: 'Suasana nyentrik khas Jawa',
        is_highlight: true,
      },
      {
        time_start: '14.30',
        name: 'Istirahat kembali ke Ndalem Cokro',
        activity_type: 'transit',
        area: 'Hotel',
        notes: '±2 km',
      },
      {
        time_start: '17.00',
        name: 'Jalan-jalan Malioboro',
        activity_type: 'shopping',
        location: 'Jl. Malioboro', area: 'Malioboro',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Jalan+Malioboro+Yogyakarta',
        notes: 'Belanja batik, pernak-pernik',
      },
      {
        time_start: '19.00', time_end: '20.30',
        name: 'Raminten Cabaret Show',
        activity_type: 'event',
        location: 'Lt. 3 Hamzah Batik, Malioboro', area: 'Malioboro',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Hamzah+Batik+Malioboro',
        notes: 'Rutin Jumat & Sabtu, 19.00–20.30',
        is_highlight: true,
        requires_booking: true,
      },
      {
        time_start: '21.00',
        name: 'Dinner setelah show: Angkringan Lik Man / Kopi Joss',
        activity_type: 'food',
        location: 'Area Stasiun Tugu', area: 'Malioboro',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Angkringan+Kopi+Joss+Lik+Man+Tugu',
        notes: '±1 km dari Hamzah Batik, suasana malam Jogja',
      },
    ]);

    // ── Day 7 — Sabtu, 22 Agustus · Keliling Kota & Kuliner ─────────────
    const d7 = await insertDay({
      dayNumber: 7,
      date: '2026-08-22',
      label: 'Sabtu, 22 Agustus 2026',
      city: 'yogyakarta',
      areaNote: 'Santai berkeliling kota, berburu makanan tradisional legendaris 2026. Semua titik dalam kota.',
      warningNote: '',
    });
    await insertItems(d7, [
      {
        time_start: '08.00',
        name: 'Sarapan: Soto Kadipiro',
        activity_type: 'food',
        location: 'Jl. Wahid Hasyim', area: 'Kota',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Soto+Kadipiro+Asli+Jalan+Wahid+Hasyim',
        notes: 'Soto ayam bening legendaris',
        is_highlight: true,
      },
      {
        time_start: '10.00',
        name: 'Berburu oleh-oleh khas Jogja',
        activity_type: 'shopping',
        location: 'Bakpia Pathok / Coklat Monggo', area: 'Kota',
        notes: 'Area Pathok ±2.5 km dari Ndalem Cokro',
      },
      {
        time_start: '12.30',
        name: 'Makan siang: Mangut Lele Mbah Marto',
        activity_type: 'food',
        location: 'Area Imogiri Barat', area: 'Kota Selatan',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Mangut+Lele+Mbah+Marto+Imogiri',
        notes: 'Sensasi makan langsung di dapur (pawon) berasap',
        is_highlight: true,
      },
      {
        time_start: '15.00',
        name: 'Kembali ke kota, istirahat sore di Ndalem Cokro',
        activity_type: 'transit',
        area: 'Hotel',
      },
      {
        time_start: '17.00',
        name: 'Ngopi sore estetik: Bura Bura Coffee',
        activity_type: 'food',
        location: 'Jl. HOS Cokroaminoto', area: 'Jetis',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Bura+Bura+Coffee+Jogja',
        notes: 'Japanese-industrial chic',
      },
      {
        time_start: '19.30',
        name: 'Makan malam: Sate Klathak Pak Bari',
        activity_type: 'food',
        location: 'Jl. Stadion, Bantul', area: 'Selatan',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Sate+Klathak+Pak+Bari+Pasar+Wonokromo',
        notes: 'Sate kambing dengan tusuk jeruji besi',
        is_highlight: true,
      },
    ]);

    // ── Day 8 — Minggu, 23 Agustus · Prambanan & Kepulangan ─────────────
    const d8 = await insertDay({
      dayNumber: 8,
      date: '2026-08-23',
      label: 'Minggu, 23 Agustus 2026',
      city: 'yogyakarta',
      areaNote: 'Ndalem Cokro → Prambanan: ±17 km ke timur (~35 menit)',
      warningNote: '',
    });
    await insertItems(d8, [
      {
        time_start: '09.00',
        name: 'Sarapan terakhir di area Ndalem Cokro',
        activity_type: 'food',
        location: 'Jetis', area: 'Kota',
      },
      {
        time_start: '10.00',
        name: 'Check-out Ndalem Cokro',
        activity_type: 'hotel',
        maps_url: 'https://maps.app.goo.gl/yHaxCXpkmPkEhrdS8',
        area: 'Hotel',
      },
      {
        time_start: '11.00',
        name: 'Titip koper / simpan barang, jalan-jalan ringan di Malioboro',
        activity_type: 'leisure',
        location: 'Area Malioboro', area: 'Kota',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Jalan+Malioboro+Yogyakarta',
      },
      {
        time_start: '13.00',
        name: 'Makan siang di warung sekitar jalan ke Prambanan',
        activity_type: 'food',
        location: 'Jl. Solo', area: 'Transit',
      },
      {
        time_start: '14.00',
        name: 'Berangkat menuju Prambanan',
        activity_type: 'transit',
        area: 'Transit',
        notes: '±35 menit dari kota',
      },
      {
        time_start: '16.00',
        name: 'Konser di Prambanan',
        activity_type: 'event',
        location: 'Candi Prambanan, Klaten', area: 'Sleman/Klaten',
        maps_url: 'https://www.google.com/maps/search/?api=1&query=Candi+Prambanan',
        notes: 'Nikmati konser berlatar Candi Prambanan yang ikonik',
        is_highlight: true,
      },
    ]);

    console.log('✓ All days and schedule items inserted');

    // ── 4. Budget Rows ────────────────────────────────────────────────────
    const budgetRows = [
      { category: 'Akomodasi Semarang', detail: 'Djajanti House, 3 malam', amount_rp: 2850000, is_accommodation: true, is_total_row: false, sort_order: 1 },
      { category: 'Akomodasi Yogyakarta', detail: 'Ndalem Cokro, 4 malam', amount_rp: 3200000, is_accommodation: true, is_total_row: false, sort_order: 2 },
      { category: 'Travel Semarang→Jogja', detail: '~Rp 100.000/orang × 3', amount_rp: 300000, is_accommodation: false, is_total_row: false, sort_order: 3 },
      { category: 'Transport lokal', detail: 'Grab Car / Gojek selama 8 hari', amount_rp: 810000, is_accommodation: false, is_total_row: false, sort_order: 4 },
      { category: 'Makan & kuliner', detail: 'Termasuk dinner sunset & jajanan', amount_rp: 3525000, is_accommodation: false, is_total_row: false, sort_order: 5 },
      { category: 'Tiket wisata', detail: 'Lawang Sewu, Keraton, Raminten Cabaret dll', amount_rp: 810000, is_accommodation: false, is_total_row: false, sort_order: 6 },
      { category: 'Oleh-oleh (3 orang)', detail: 'Perkiraan', amount_rp: 1050000, is_accommodation: false, is_total_row: false, sort_order: 7 },
      { category: 'Total Estimasi (3 orang)', detail: 'Di luar akomodasi & tiket konser', amount_rp: 6495000, is_accommodation: false, is_total_row: true, sort_order: 8 },
      { category: 'Total per orang (termasuk penginapan)', detail: 'Di luar tiket konser', amount_rp: 4841667, is_accommodation: true, is_total_row: true, sort_order: 9 },
    ];

    for (const row of budgetRows) {
      await client.query(`
        INSERT INTO trip_budget_rows (trip_id, category, detail, amount_rp, is_accommodation, is_total_row, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [tripId, row.category, row.detail, row.amount_rp, row.is_accommodation, row.is_total_row, row.sort_order]);
    }

    console.log('✓ Budget rows inserted');

    await client.query('COMMIT');
    console.log('\n✅ Trip semarang-jogja-2026 seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedTripSemarangJogja()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedTripSemarangJogja };
