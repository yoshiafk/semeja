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

// ── POST /api/trips — Create a new trip (Admin) ─────────────────────────
// NOTE: Slug is auto-generated server-side from the title using the same
// sanitization as the client to prevent mismatches.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, subtitle, start_date, end_date, participant_count, transport, pace, cover_city } = req.body;
  if (!title || !start_date || !end_date) return res.status(400).json({ error: 'Missing required fields' });

  // Generate slug — same pattern used on the frontend
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const timestamp = Date.now().toString().slice(-4);
  const slug = `${baseSlug}-${timestamp}`;

  try {
    const { rows } = await pool.query(`
      INSERT INTO trips (slug, title, subtitle, start_date, end_date, participant_count, transport, pace, cover_city, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'upcoming')
      RETURNING *
    `, [
      slug, title, subtitle || '', start_date, end_date,
      participant_count || 1,
      JSON.stringify(transport || []), pace || '', cover_city || ''
    ]);

    const trip = rows[0];
    trip.transport = (() => { try { return JSON.parse(trip.transport); } catch { return []; } })();

    // Create a ledger for this trip
    await pool.query(
      'INSERT INTO ledgers (type, reference_id, title) VALUES ($1, $2, $3)',
      ['trip', trip.id, `Trip ${title}`]
    );

    res.status(201).json(trip);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Trip slug already exists' });
    console.error('Error creating trip:', err);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// ── GET /api/trips/by-id/:id — Get a specific trip by its numeric ID ────
router.get('/by-id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: tripRows } = await pool.query(`
      SELECT id, slug, title, subtitle, start_date, end_date,
             participant_count, transport, pace, status, cover_city, created_at
      FROM trips WHERE id = $1
    `, [id]);

    if (tripRows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = {
      ...tripRows[0],
      transport: (() => { try { return JSON.parse(tripRows[0].transport); } catch { return []; } })(),
    };

    // Fetch everything else in parallel
    const [
      { rows: participants },
      { rows: hotels },
      { rows: distances },
      { rows: budget },
      { rows: packing },
      { rows: days },
      { rows: scheduleItems }
    ] = await Promise.all([
      pool.query(`
        SELECT m.id, m.name, tp.joined_at
        FROM trip_participations tp
        JOIN members m ON tp.member_id = m.id
        WHERE tp.trip_id = $1
      `, [id]),
      pool.query(`
        SELECT * FROM trip_hotels WHERE trip_id = $1 ORDER BY sort_order ASC, check_in ASC
      `, [id]),
      pool.query(`
        SELECT d.* FROM trip_hotel_distances d
        JOIN trip_hotels h ON d.hotel_id = h.id
        WHERE h.trip_id = $1 ORDER BY h.id, d.sort_order ASC
      `, [id]),
      pool.query(`
        SELECT * FROM trip_budget_rows WHERE trip_id = $1 ORDER BY is_total_row ASC, sort_order ASC, id ASC
      `, [id]),
      pool.query(`
        SELECT p.*, m.name as assignee_name 
        FROM trip_packing_items p
        LEFT JOIN members m ON p.assignee_id = m.id
        WHERE p.trip_id = $1 
        ORDER BY p.category, p.created_at ASC
      `, [id]),
      pool.query(`
        SELECT * FROM trip_days WHERE trip_id = $1 ORDER BY day_number ASC
      `, [id]),
      pool.query(`
        SELECT s.* FROM trip_schedule_items s
        JOIN trip_days d ON s.day_id = d.id
        WHERE d.trip_id = $1 ORDER BY d.day_number ASC, s.sort_order ASC, s.time_start ASC
      `, [id])
    ]);

    trip.participants = participants;
    trip.budget = budget;
    trip.packing_items = packing;

    trip.hotels = hotels.map(h => ({
      ...h,
      distances: distances.filter(d => d.hotel_id === h.id)
    }));

    trip.days = days.map(d => ({
      ...d,
      schedule: scheduleItems.filter(s => s.day_id === d.id)
    }));

    res.json(trip);
  } catch (err) {
    console.error('Error fetching trip by id:', err);
    res.status(500).json({ error: 'Failed to fetch trip' });
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

    // Fetch related models in parallel
    const [
      { rows: hotelRows },
      { rows: distRows },
      { rows: dayRows },
      { rows: itemRows },
      { rows: budgetRows },
      { rows: participantRows },
      { rows: packingRows }
    ] = await Promise.all([
      pool.query(`
        SELECT h.id, h.name, h.city, h.address, h.maps_url, h.check_in, h.check_out, h.sort_order
        FROM trip_hotels h
        WHERE h.trip_id = $1
        ORDER BY h.sort_order
      `, [tripId]),
      pool.query(`
        SELECT d.hotel_id, d.destination, d.distance_km, d.duration, d.sort_order
        FROM trip_hotel_distances d
        JOIN trip_hotels h ON d.hotel_id = h.id
        WHERE h.trip_id = $1
        ORDER BY d.hotel_id, d.sort_order
      `, [tripId]),
      pool.query(`
        SELECT id, day_number, date, label, city, area_note, warning_note
        FROM trip_days
        WHERE trip_id = $1
        ORDER BY day_number
      `, [tripId]),
      pool.query(`
        SELECT s.id, s.day_id, s.time_start, s.time_end, s.name, s.activity_type,
               s.location, s.area, s.maps_url, s.notes, s.opening_hours,
               s.is_highlight, s.is_cash_only, s.requires_booking, s.is_optional,
               s.sort_order, s.is_done, s.bill_total_rp, s.receipt_id
        FROM trip_schedule_items s
        JOIN trip_days d ON s.day_id = d.id
        WHERE d.trip_id = $1
        ORDER BY d.day_number, s.sort_order, s.time_start
      `, [tripId]),
      pool.query(`
        SELECT id, category, detail, amount_rp, actual_amount_rp, is_accommodation, is_total_row
        FROM trip_budget_rows
        WHERE trip_id = $1
        ORDER BY sort_order
      `, [tripId]),
      pool.query(`
        SELECT m.id, m.name, '' as avatar_url, tp.joined_at
        FROM trip_participations tp
        JOIN members m ON tp.member_id = m.id
        WHERE tp.trip_id = $1
        ORDER BY tp.joined_at ASC
      `, [tripId]),
      pool.query(`
        SELECT p.id, p.category, p.item_name, p.is_checked, p.assignee_id, m.name as assignee_name
        FROM trip_packing_items p
        LEFT JOIN members m ON p.assignee_id = m.id
        WHERE p.trip_id = $1
        ORDER BY p.id ASC
      `, [tripId])
    ]);

    const hotels = hotelRows.map(h => ({
      ...h,
      distances: distRows
        .filter(d => d.hotel_id === h.id)
        .map(d => ({ destination: d.destination, distance_km: d.distance_km, duration: d.duration })),
    }));

    const days = dayRows.map(d => ({
      ...d,
      schedule: itemRows.filter(i => i.day_id === d.id),
    }));

    res.json({
      ...trip,
      hotels,
      days,
      budget: budgetRows,
      participants: participantRows,
      packing: packingRows
    });
  } catch (err) {
    console.error('Error fetching trip detail:', err);
    res.status(500).json({ error: 'Failed to fetch trip detail' });
  }
});

// ── PUT /api/trips/:slug — update trip metadata (admin only) ─────────────
router.put('/:slug', requireAuth, requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const { title, subtitle, start_date, end_date, participant_count, transport, pace, cover_city, status } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE trips
      SET title             = COALESCE($1, title),
          subtitle          = COALESCE($2, subtitle),
          start_date        = COALESCE($3, start_date),
          end_date          = COALESCE($4, end_date),
          participant_count = COALESCE($5, participant_count),
          transport         = COALESCE($6, transport),
          pace              = COALESCE($7, pace),
          cover_city        = COALESCE($8, cover_city),
          status            = COALESCE($9, status)
      WHERE slug = $10
      RETURNING *
    `, [
      title, subtitle, start_date, end_date, participant_count,
      transport ? JSON.stringify(transport) : null,
      pace, cover_city, status, slug
    ]);

    if (rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    const trip = rows[0];
    trip.transport = (() => { try { return JSON.parse(trip.transport); } catch { return []; } })();
    res.json(trip);
  } catch (err) {
    console.error('Error updating trip:', err);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

// ── PATCH /api/trips/:slug/schedule/:itemId/toggle — toggle schedule item done status ─────────
router.patch('/:slug/schedule/:itemId/toggle', requireAuth, async (req, res) => {
  const { slug, itemId } = req.params;
  const { is_done } = req.body;
  
  if (typeof is_done !== 'boolean') {
    return res.status(400).json({ error: 'is_done boolean is required' });
  }

  try {
    // We optionally verify the trip matches the slug, but checking itemId is usually enough
    const { rows } = await pool.query(`
      UPDATE trip_schedule_items
      SET is_done = $1
      WHERE id = $2
      RETURNING *
    `, [is_done, itemId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Schedule item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error toggling schedule item:', err);
    res.status(500).json({ error: 'Failed to toggle schedule item' });
  }
});

// ── POST /api/trips/:slug/schedule — Add new schedule item ─────────
router.post('/:slug/schedule', requireAuth, requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const {
    day_id, time_start, time_end, name, activity_type, location, area,
    maps_url, notes, opening_hours, is_highlight, is_cash_only,
    requires_booking, is_optional
  } = req.body;

  if (!day_id || !time_start || !name || !activity_type) {
    return res.status(400).json({ error: 'day_id, time_start, name, and activity_type are required' });
  }

  try {
    const { rows: tripCheck } = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripCheck.length === 0) return res.status(404).json({ error: 'Trip not found' });

    // Auto-compute next sort_order for this day to preserve insertion order
    const sortRes = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort FROM trip_schedule_items WHERE day_id = $1',
      [day_id]
    );
    const nextSort = sortRes.rows[0].next_sort;

    const { rows } = await pool.query(
      `INSERT INTO trip_schedule_items (
        day_id, time_start, time_end, name, activity_type, location, area,
        maps_url, notes, opening_hours, is_highlight, is_cash_only,
        requires_booking, is_optional, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING *`,
      [
        day_id, time_start, time_end || '', name, activity_type, location || '', area || '',
        maps_url || '', notes || '', opening_hours || '', Boolean(is_highlight), Boolean(is_cash_only),
        Boolean(requires_booking), Boolean(is_optional), nextSort
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error adding schedule item:', err);
    res.status(500).json({ error: 'Failed to add schedule item' });
  }
});

// ── PUT /api/trips/:slug/schedule/:itemId — Update schedule item ─────────
router.put('/:slug/schedule/:itemId', requireAuth, requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  const {
    day_id, time_start, time_end, name, activity_type, location, area,
    maps_url, notes, opening_hours, is_highlight, is_cash_only,
    requires_booking, is_optional, sort_order, bill_total_rp, receipt_id
  } = req.body;

  if (!time_start || !name || !activity_type) {
    return res.status(400).json({ error: 'time_start, name, and activity_type are required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE trip_schedule_items
       SET day_id           = COALESCE($1, day_id),
           time_start       = $2,
           time_end         = $3,
           name             = $4,
           activity_type    = $5,
           location         = $6,
           area             = $7,
           maps_url         = $8,
           notes            = $9,
           opening_hours    = $10,
           is_highlight     = $11,
           is_cash_only     = $12,
           requires_booking = $13,
           is_optional      = $14,
           sort_order       = $15,
           bill_total_rp    = COALESCE($16, bill_total_rp),
           receipt_id       = COALESCE($17, receipt_id)
       WHERE id = $18
       RETURNING *`,
      [
        day_id || null,
        time_start, time_end || '', name, activity_type, location || '', area || '',
        maps_url || '', notes || '', opening_hours || '', Boolean(is_highlight), Boolean(is_cash_only),
        Boolean(requires_booking), Boolean(is_optional), sort_order || 0,
        bill_total_rp !== undefined ? bill_total_rp : null,
        receipt_id !== undefined ? receipt_id : null,
        itemId
      ]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Schedule item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating schedule item:', err);
    res.status(500).json({ error: 'Failed to update schedule item' });
  }
});

// ── DELETE /api/trips/:slug/schedule/:itemId — Delete schedule item ─────────
router.delete('/:slug/schedule/:itemId', requireAuth, requireAdmin, async (req, res) => {
  const { itemId } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM trip_schedule_items WHERE id = $1',
      [itemId]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'Schedule item not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting schedule item:', err);
    res.status(500).json({ error: 'Failed to delete schedule item' });
  }
});


// ── PATCH /api/trips/:slug/budget/:rowId — Update actual cost on a budget row ─────────
router.patch('/:slug/budget/:rowId', requireAuth, requireAdmin, async (req, res) => {
  const { slug, rowId } = req.params;
  const { actual_amount_rp } = req.body;

  if (typeof actual_amount_rp !== 'number') {
    return res.status(400).json({ error: 'actual_amount_rp number is required' });
  }

  try {
    // Resolve trip id from slug
    const tripRes = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRes.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRes.rows[0].id;

    const { rows } = await pool.query(`
      UPDATE trip_budget_rows
      SET actual_amount_rp = $1
      WHERE id = $2
      RETURNING *
    `, [actual_amount_rp, rowId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Budget row not found' });

    // Recalculate total rows' actual_amount_rp by summing all non-total rows
    const { rows: allRows } = await pool.query(
      'SELECT actual_amount_rp, is_accommodation FROM trip_budget_rows WHERE trip_id = $1 AND is_total_row = false',
      [tripId]
    );
    let actualWith = 0;
    let actualWithout = 0;
    allRows.forEach(r => {
      actualWith += (r.actual_amount_rp || 0);
      if (!r.is_accommodation) actualWithout += (r.actual_amount_rp || 0);
    });
    await pool.query(
      'UPDATE trip_budget_rows SET actual_amount_rp = $1 WHERE trip_id = $2 AND is_total_row = true AND is_accommodation = true',
      [actualWith, tripId]
    );
    await pool.query(
      'UPDATE trip_budget_rows SET actual_amount_rp = $1 WHERE trip_id = $2 AND is_total_row = true AND is_accommodation = false',
      [actualWithout, tripId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating budget actual:', err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// ── DELETE /api/trips/:slug/budget/:rowId — Remove a budget row ─────────
router.delete('/:slug/budget/:rowId', requireAuth, requireAdmin, async (req, res) => {
  const { slug, rowId } = req.params;

  try {
    const tripRes = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRes.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRes.rows[0].id;

    const { rowCount } = await pool.query(
      'DELETE FROM trip_budget_rows WHERE id = $1 AND trip_id = $2 AND is_total_row = false',
      [rowId, tripId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Budget row not found' });

    // Recalculate totals after deletion
    const { rows: allRows } = await pool.query(
      'SELECT amount_rp, actual_amount_rp, is_accommodation FROM trip_budget_rows WHERE trip_id = $1 AND is_total_row = false',
      [tripId]
    );
    let totalWith = 0, totalWithout = 0, actualWith = 0, actualWithout = 0;
    allRows.forEach(r => {
      totalWith += (r.amount_rp || 0);
      actualWith += (r.actual_amount_rp || 0);
      if (!r.is_accommodation) {
        totalWithout += (r.amount_rp || 0);
        actualWithout += (r.actual_amount_rp || 0);
      }
    });
    await pool.query(
      'UPDATE trip_budget_rows SET amount_rp = $1, actual_amount_rp = $2 WHERE trip_id = $3 AND is_total_row = true AND is_accommodation = true',
      [totalWith, actualWith, tripId]
    );
    await pool.query(
      'UPDATE trip_budget_rows SET amount_rp = $1, actual_amount_rp = $2 WHERE trip_id = $3 AND is_total_row = true AND is_accommodation = false',
      [totalWithout, actualWithout, tripId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting budget row:', err);
    res.status(500).json({ error: 'Failed to delete budget row' });
  }
});

// ── POST /api/trips/:slug/budget — Add new budget row ─────────
router.post('/:slug/budget', requireAuth, requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const { category, detail, amount_rp, is_accommodation } = req.body;

  if (!category) {
    return res.status(400).json({ error: 'category is required' });
  }

  try {
    // get trip id
    const tripRes = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRes.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRes.rows[0].id;

    // get max sort_order
    const sortRes = await pool.query('SELECT MAX(sort_order) as max_sort FROM trip_budget_rows WHERE trip_id = $1 AND is_total_row = false', [tripId]);
    const nextSort = (sortRes.rows[0].max_sort || 0) + 1;

    const { rows } = await pool.query(`
      INSERT INTO trip_budget_rows (trip_id, category, detail, amount_rp, is_accommodation, is_total_row, sort_order)
      VALUES ($1, $2, $3, $4, $5, false, $6)
      RETURNING *
    `, [tripId, category, detail || '', amount_rp || 0, is_accommodation || false, nextSort]);

    // Now recalculate total row
    // Get all current non-total rows
    const { rows: allRows } = await pool.query('SELECT amount_rp, is_accommodation FROM trip_budget_rows WHERE trip_id = $1 AND is_total_row = false', [tripId]);
    
    // We update both total rows: with accom and without accom
    let totalWith = 0;
    let totalWithout = 0;
    allRows.forEach(r => {
      totalWith += r.amount_rp;
      if (!r.is_accommodation) totalWithout += r.amount_rp;
    });

    await pool.query('UPDATE trip_budget_rows SET amount_rp = $1 WHERE trip_id = $2 AND is_total_row = true AND is_accommodation = true', [totalWith, tripId]);
    await pool.query('UPDATE trip_budget_rows SET amount_rp = $1 WHERE trip_id = $2 AND is_total_row = true AND is_accommodation = false', [totalWithout, tripId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding budget row:', err);
    res.status(500).json({ error: 'Failed to add budget' });
  }
});

// ── PACKING LIST ───────────────────────────────────────────────────────────────

router.post('/:slug/packing', requireAuth, requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const { category, item_name, assignee_id } = req.body;
  if (!item_name) return res.status(400).json({ error: 'item_name is required' });

  try {
    const { rows: tripRows } = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRows[0].id;

    const { rows } = await pool.query(`
      INSERT INTO trip_packing_items (trip_id, category, item_name, assignee_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [tripId, category || 'Pribadi', item_name, assignee_id || null]);

    res.json(rows[0]);
  } catch (err) {
    console.error('Error adding packing item:', err);
    res.status(500).json({ error: 'Failed to add packing item' });
  }
});

router.put('/:slug/packing/:itemId', requireAuth, async (req, res) => {
  const { itemId } = req.params;
  const { is_checked, assignee_id } = req.body;
  try {
    // If only one field is provided, COALESCE preserves the other
    const { rows } = await pool.query(`
      UPDATE trip_packing_items
      SET is_checked = COALESCE($1, is_checked),
          assignee_id = CASE WHEN $2::integer = -1 THEN NULL ELSE COALESCE($2, assignee_id) END
      WHERE id = $3
      RETURNING *
    `, [is_checked, assignee_id !== undefined ? (assignee_id === null ? -1 : assignee_id) : null, itemId]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating packing item:', err);
    res.status(500).json({ error: 'Failed to update packing item' });
  }
});

router.delete('/:slug/packing/:itemId', requireAuth, requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  try {
    await pool.query('DELETE FROM trip_packing_items WHERE id = $1', [itemId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting packing item:', err);
    res.status(500).json({ error: 'Failed to delete packing item' });
  }
});

// ── POST /api/trips/:slug/join — Join a trip ─────────
router.post('/:slug/join', requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { member_id } = req.body;
  
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  if (req.user.role !== 'admin' && req.user.id !== parseInt(member_id)) {
    return res.status(403).json({ error: 'Cannot join on behalf of another user' });
  }

  try {
    const { rows: tripRows } = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRows[0].id;

    await pool.query(
      'INSERT INTO trip_participations (trip_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tripId, member_id]
    );

    // Update participant_count cache
    await pool.query('UPDATE trips SET participant_count = (SELECT count(*) FROM trip_participations WHERE trip_id = $1) WHERE id = $1', [tripId]);

    res.json({ message: 'Joined trip successfully' });
  } catch (err) {
    console.error('Error joining trip:', err);
    res.status(500).json({ error: 'Failed to join trip' });
  }
});

// ── POST /api/trips/:slug/leave — Leave a trip ─────────
router.post('/:slug/leave', requireAuth, async (req, res) => {
  const { slug } = req.params;
  const { member_id } = req.body;
  
  if (!member_id) return res.status(400).json({ error: 'member_id required' });

  if (req.user.role !== 'admin' && req.user.id !== parseInt(member_id)) {
    return res.status(403).json({ error: 'Cannot leave on behalf of another user' });
  }

  try {
    const { rows: tripRows } = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRows[0].id;

    await pool.query(
      'DELETE FROM trip_participations WHERE trip_id = $1 AND member_id = $2',
      [tripId, member_id]
    );

    // Update participant_count cache
    await pool.query('UPDATE trips SET participant_count = (SELECT count(*) FROM trip_participations WHERE trip_id = $1) WHERE id = $1', [tripId]);

    res.json({ message: 'Left trip successfully' });
  } catch (err) {
    console.error('Error leaving trip:', err);
    res.status(500).json({ error: 'Failed to leave trip' });
  }
});

// ── PUT /api/trips/:slug/participants — Admin bulk update participants ─────────
router.put('/:slug/participants', requireAuth, requireAdmin, async (req, res) => {
  const { slug } = req.params;
  const { member_ids } = req.body;
  
  if (!Array.isArray(member_ids)) return res.status(400).json({ error: 'member_ids must be an array' });

  try {
    const { rows: tripRows } = await pool.query('SELECT id FROM trips WHERE slug = $1', [slug]);
    if (tripRows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    const tripId = tripRows[0].id;

    await pool.query('BEGIN');
    
    // Clear existing
    await pool.query('DELETE FROM trip_participations WHERE trip_id = $1', [tripId]);
    
    // Insert new
    for (const memberId of member_ids) {
      await pool.query(
        'INSERT INTO trip_participations (trip_id, member_id) VALUES ($1, $2)',
        [tripId, memberId]
      );
    }
    
    // Update participant_count cache
    await pool.query('UPDATE trips SET participant_count = $2 WHERE id = $1', [tripId, member_ids.length]);
    
    await pool.query('COMMIT');
    res.json({ message: 'Participants updated' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error updating participants:', err);
    res.status(500).json({ error: 'Failed to update participants' });
  }
});

module.exports = router;
