const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET all activities
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, 
        CAST(count(distinct p.member_id) AS INTEGER) as participant_count,
        CAST(sum(p.guests_count) AS INTEGER) as guests_count_total
      FROM activities a
      LEFT JOIN activity_participations p ON a.id = p.activity_id
      WHERE a.status != 'archived' OR a.status IS NULL
      GROUP BY a.id
      ORDER BY a.date DESC, a.time DESC
    `);
    
    // Normalize sum(guests_count) which can be NULL if no participants
    const mappedRows = rows.map(r => ({
      ...r,
      guests_count_total: r.guests_count_total || 0
    }));
    
    res.json(mappedRows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// GET activity details and its participants
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: activityRows } = await pool.query('SELECT * FROM activities WHERE id = $1', [id]);
    if (activityRows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    
    const { rows: participantRows } = await pool.query(`
      SELECT p.*, m.name as member_name 
      FROM activity_participations p
      JOIN members m ON p.member_id = m.id
      WHERE p.activity_id = $1
    `, [id]);
    
    res.json({
      ...activityRows[0],
      participants: participantRows
    });
  } catch (error) {
    console.error('Error fetching activity details:', error);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
});

// POST to create a new activity
router.post('/', async (req, res) => {
  const { title, description, date, time, location, cost_type, cost_amount, max_participants, created_by, receipt_id } = req.body;
  if (!title || !date || !time) {
    return res.status(400).json({ error: 'title, date, and time are required' });
  }
  
  try {
    const { rows } = await pool.query(`
      INSERT INTO activities (title, description, date, time, location, cost_type, cost_amount, max_participants, created_by, receipt_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [title, description || '', date, time, location || '', cost_type || 'free', cost_amount || 0, max_participants || null, created_by, receipt_id || null]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// PUT to update activity
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, date, time, location, cost_type, cost_amount, max_participants, status, receipt_id } = req.body;
  
  try {
    const { rows } = await pool.query(`
      UPDATE activities 
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          date = COALESCE($3, date),
          time = COALESCE($4, time),
          location = COALESCE($5, location),
          cost_type = COALESCE($6, cost_type),
          cost_amount = COALESCE($7, cost_amount),
          max_participants = COALESCE($8, max_participants),
          status = COALESCE($9, status),
          receipt_id = COALESCE($10, receipt_id)
      WHERE id = $11
      RETURNING *
    `, [title, description, date, time, location, cost_type, cost_amount, max_participants, status, receipt_id, id]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// POST to join an activity
router.post('/:id/join', async (req, res) => {
  const { id } = req.params;
  const { member_id, guests_count } = req.body;
  
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });
  
  try {
    const { rows: activityRows } = await pool.query('SELECT max_participants FROM activities WHERE id = $1', [id]);
    if (activityRows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    
    const max_participants = activityRows[0].max_participants;
    
    if (max_participants) {
      const { rows: countRows } = await pool.query('SELECT count(*) as count FROM activity_participations WHERE activity_id = $1', [id]);
      if (parseInt(countRows[0].count) >= max_participants) {
        // Technically we should check if this specific member is already joined so they can just update the guest count.
        // But for simplicity, we first check if they exist.
        const { rows: existingRows } = await pool.query('SELECT id FROM activity_participations WHERE activity_id = $1 AND member_id = $2', [id, member_id]);
        if (existingRows.length === 0) {
          return res.status(400).json({ error: 'Activity is full' });
        }
      }
    }

    const { rows } = await pool.query(`
      INSERT INTO activity_participations (activity_id, member_id, guests_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (activity_id, member_id) 
      DO UPDATE SET guests_count = $3
      RETURNING *
    `, [id, member_id, guests_count || 0]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error joining activity:', error);
    res.status(500).json({ error: 'Failed to join activity' });
  }
});

// POST to leave an activity
router.post('/:id/leave', async (req, res) => {
  const { id } = req.params;
  const { member_id } = req.body;
  
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });
  
  try {
    await pool.query('DELETE FROM activity_participations WHERE activity_id = $1 AND member_id = $2', [id, member_id]);
    res.json({ message: 'Successfully left the activity' });
  } catch (error) {
    console.error('Error leaving activity:', error);
    res.status(500).json({ error: 'Failed to leave activity' });
  }
});

// DELETE an activity
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM activities WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json({ message: 'Activity deleted successfully', activity: rows[0] });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

module.exports = router;
