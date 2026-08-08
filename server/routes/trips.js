const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/trips — list all trips (summary cards) ──────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, slug, title, subtitle, start_date, end_date,
             participant_count, transport, pace, status, cover_city, created_at
      FROM trips
      ORDER BY start_date DESC
    `);
    // Parse transport JSON string back to array
    const trips = rows.map(t => ({
      ...t,
      transport: (() => { try { return JSON.parse(t.transport); } catch { return []; } })(),
    }));
    res.json(trips);
  } catch (err) {
    console.error('Error fetching trips:', err);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// ── GET /api/trips/:slug — full trip detail ───────────────────────────────
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    // Trip header
    const { rows: tripRows } = await pool.query(`
      SELECT id, slug, title, subtitle, start_date, end_date,
             participant_count, transport, pace, status, cover_city, created_at
      FROM trips WHERE slug = $1
    `, [slug]);

    if (tripRows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = {
      ...tripRows[0],
      transport: (() => { try { return JSON.parse(tripRows[0].transport); } catch { return []; } })(),
    };
    const tripId = trip.id;

    // Hotels + distances
    const { rows: hotelRows } = await pool.query(`
      SELECT h.id, h.name, h.city, h.address, h.maps_url, h.check_in, h.check_out, h.sort_order
      FROM trip_hotels h
      WHERE h.trip_id = $1
      ORDER BY h.sort_order
    `, [tripId]);

    const { rows: distRows } = await pool.query(`
      SELECT d.hotel_id, d.destination, d.distance_km, d.duration, d.sort_order
      FROM trip_hotel_distances d
      JOIN trip_hotels h ON d.hotel_id = h.id
      WHERE h.trip_id = $1
      ORDER BY d.hotel_id, d.sort_order
    `, [tripId]);

    const hotels = hotelRows.map(h => ({
      ...h,
      distances: distRows
        .filter(d => d.hotel_id === h.id)
        .map(d => ({ destination: d.destination, distance_km: d.distance_km, duration: d.duration })),
    }));

    // Days + schedule items
    const { rows: dayRows } = await pool.query(`
      SELECT id, day_number, date, label, city, area_note, warning_note
      FROM trip_days
      WHERE trip_id = $1
      ORDER BY day_number
    `, [tripId]);

    const { rows: itemRows } = await pool.query(`
      SELECT s.id, s.day_id, s.time_start, s.time_end, s.name, s.activity_type,
             s.location, s.area, s.maps_url, s.notes, s.opening_hours,
             s.is_highlight, s.is_cash_only, s.requires_booking, s.is_optional, s.sort_order
      FROM trip_schedule_items s
      JOIN trip_days d ON s.day_id = d.id
      WHERE d.trip_id = $1
      ORDER BY d.day_number, s.sort_order
    `, [tripId]);

    const days = dayRows.map(d => ({
      ...d,
      schedule: itemRows.filter(i => i.day_id === d.id),
    }));

    // Budget rows
    const { rows: budgetRows } = await pool.query(`
      SELECT category, detail, amount_rp, is_accommodation, is_total_row
      FROM trip_budget_rows
      WHERE trip_id = $1
      ORDER BY sort_order
    `, [tripId]);

    res.json({ ...trip, hotels, days, budget: budgetRows });
  } catch (err) {
    console.error('Error fetching trip detail:', err);
    res.status(500).json({ error: 'Failed to fetch trip detail' });
  }
});

// ── POST /api/trips — create a new trip (admin only) ─────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { slug, title, subtitle, start_date, end_date, participant_count, transport, pace, cover_city } = req.body;
  if (!slug || !title || !start_date || !end_date) {
    return res.status(400).json({ error: 'slug, title, start_date, end_date are required' });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO trips (slug, title, subtitle, start_date, end_date, participant_count, transport, pace, cover_city)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      slug, title, subtitle || '', start_date, end_date,
      participant_count || 0,
      JSON.stringify(transport || []),
      pace || '',
      cover_city || '',
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Trip slug already exists' });
    console.error('Error creating trip:', err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// ── PUT /api/trips/:slug — update trip metadata (admin only) ─────────────
router.put('/:slug', requireAuth, requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const { title, subtitle, status, participant_count, pace } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE trips
      SET title             = COALESCE($1, title),
          subtitle          = COALESCE($2, subtitle),
          status            = COALESCE($3, status),
          participant_count = COALESCE($4, participant_count),
          pace              = COALESCE($5, pace)
      WHERE slug = $6
      RETURNING *
    `, [title, subtitle, status, participant_count, pace, slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating trip:', err);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

module.exports = router;
