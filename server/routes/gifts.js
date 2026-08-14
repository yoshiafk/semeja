const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET all gifts
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*, 
        (SELECT CAST(count(*) AS INTEGER) FROM gift_participants WHERE gift_id = g.id) as participant_count,
        (SELECT CAST(COALESCE(sum(estimated_price), 0) AS INTEGER) FROM gift_items WHERE gift_id = g.id) as total_estimated_price,
        m.name as creator_name
      FROM gifts g
      LEFT JOIN members m ON g.created_by = m.id
      WHERE g.status != 'archived' OR g.status IS NULL
      ORDER BY g.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching gifts:', error);
    res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

// GET gift details, items, and participants
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: giftRows } = await pool.query(`
      SELECT g.*, m.name as creator_name 
      FROM gifts g 
      LEFT JOIN members m ON g.created_by = m.id 
      WHERE g.id = $1
    `, [id]);
    
    if (giftRows.length === 0) return res.status(404).json({ error: 'Gift not found' });
    
    const { rows: itemRows } = await pool.query('SELECT * FROM gift_items WHERE gift_id = $1 ORDER BY created_at ASC', [id]);
    const { rows: participantRows } = await pool.query(`
      SELECT p.*, m.name as member_name 
      FROM gift_participants p
      JOIN members m ON p.member_id = m.id
      WHERE p.gift_id = $1
    `, [id]);
    
    res.json({
      ...giftRows[0],
      items: itemRows,
      participants: participantRows
    });
  } catch (error) {
    console.error('Error fetching gift details:', error);
    res.status(500).json({ error: 'Failed to fetch gift details' });
  }
});

// POST to create a new gift
router.post('/', requireAuth, async (req, res) => {
  const { title, description, event_date, created_by } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  
  try {
    const { rows } = await pool.query(`
      INSERT INTO gifts (title, description, event_date, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, description || '', event_date || null, created_by]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating gift:', error);
    res.status(500).json({ error: 'Failed to create gift' });
  }
});

// PUT to update gift
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, event_date, status } = req.body;
  
  try {
    const { rows } = await pool.query(`
      UPDATE gifts 
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          event_date = COALESCE($3, event_date),
          status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [title, description, event_date, status, id]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Gift not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating gift:', error);
    res.status(500).json({ error: 'Failed to update gift' });
  }
});

// POST to add item to gift
router.post('/:id/items', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, estimated_price, url, receipt_id } = req.body;
  if (!name) return res.status(400).json({ error: 'item name is required' });

  try {
    const { rows } = await pool.query(`
      INSERT INTO gift_items (gift_id, name, estimated_price, url, receipt_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, name, estimated_price || 0, url || '', receipt_id || null]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error adding gift item:', error);
    res.status(500).json({ error: 'Failed to add gift item' });
  }
});

// PUT to update gift item
router.put('/:id/items/:itemId', requireAuth, async (req, res) => {
  const { itemId } = req.params;
  const { name, estimated_price, actual_price, url, status, receipt_id } = req.body;
  
  try {
    const { rows } = await pool.query(`
      UPDATE gift_items 
      SET name = COALESCE($1, name),
          estimated_price = COALESCE($2, estimated_price),
          actual_price = COALESCE($3, actual_price),
          url = COALESCE($4, url),
          status = COALESCE($5, status),
          receipt_id = COALESCE($6, receipt_id)
      WHERE id = $7
      RETURNING *
    `, [name, estimated_price, actual_price, url, status, receipt_id, itemId]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating gift item:', error);
    res.status(500).json({ error: 'Failed to update gift item' });
  }
});

// DELETE gift item
router.delete('/:id/items/:itemId', requireAuth, async (req, res) => {
  const { itemId } = req.params;
  try {
    await pool.query('DELETE FROM gift_items WHERE id = $1', [itemId]);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting gift item:', error);
    res.status(500).json({ error: 'Failed to delete gift item' });
  }
});

// POST to join gift pooling
router.post('/:id/join', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { member_id, contribution_amount } = req.body;
  
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });
  
  if (req.user.role !== 'admin' && req.user.id !== parseInt(member_id)) {
    return res.status(403).json({ error: 'Cannot join on behalf of another user' });
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO gift_participants (gift_id, member_id, contribution_amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (gift_id, member_id) 
      DO UPDATE SET contribution_amount = $3
      RETURNING *
    `, [id, member_id, contribution_amount || 0]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error joining gift:', error);
    res.status(500).json({ error: 'Failed to join gift' });
  }
});

// POST to leave gift pooling
router.post('/:id/leave', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { member_id } = req.body;
  
  if (!member_id) return res.status(400).json({ error: 'member_id is required' });
  
  if (req.user.role !== 'admin' && req.user.id !== parseInt(member_id)) {
    return res.status(403).json({ error: 'Cannot leave on behalf of another user' });
  }

  try {
    await pool.query('DELETE FROM gift_participants WHERE gift_id = $1 AND member_id = $2', [id, member_id]);
    res.json({ message: 'Successfully left the gift pooling' });
  } catch (error) {
    console.error('Error leaving gift:', error);
    res.status(500).json({ error: 'Failed to leave gift' });
  }
});

// DELETE a gift
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM gifts WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Gift not found' });
    res.json({ message: 'Gift deleted successfully', gift: rows[0] });
  } catch (error) {
    console.error('Error deleting gift:', error);
    res.status(500).json({ error: 'Failed to delete gift' });
  }
});

module.exports = router;
