import express from 'express';
import { query, get, run, logActivity } from '../db/database.js';
import { runLifecycleRules } from '../services/lifecycleEngine.js';

const router = express.Router();

// GET /api/lifecycle - List all lifecycle rules
router.get('/', async (req, res) => {
  try {
    const rules = await query(`SELECT * FROM LIFECYCLE_RULES`);
    res.json({ success: true, rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lifecycle - Create a new lifecycle rule
router.post('/', async (req, res) => {
  try {
    const { name, bucket_name, prefix, action, days_after_creation, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Rule name is required' });
    }

    const days = parseInt(days_after_creation, 10);
    if (isNaN(days) || days < 1) {
      return res.status(400).json({ success: false, error: 'Days after creation must be a positive number' });
    }

    const result = await run(
      `INSERT INTO LIFECYCLE_RULES (name, bucket_name, prefix, action, days_after_creation, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        bucket_name || '*',
        prefix ? prefix.trim() : '',
        action || 'EXPIRE_SOFT_DELETE',
        days,
        is_active === undefined ? 1 : (is_active ? 1 : 0)
      ]
    );

    await logActivity('CREATE_LIFECYCLE_RULE', bucket_name, null, `Rule created: ${name} (${days} days)`);

    res.status(201).json({
      success: true,
      message: 'Lifecycle rule created successfully',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/lifecycle/:id - Update lifecycle rule
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get(`SELECT * FROM LIFECYCLE_RULES WHERE id = ?`, [id]);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const { name, bucket_name, prefix, action, days_after_creation, is_active } = req.body;

    const newName = name !== undefined ? name : existing.name;
    const newBucket = bucket_name !== undefined ? bucket_name : existing.bucket_name;
    const newPrefix = prefix !== undefined ? prefix : existing.prefix;
    const newAction = action !== undefined ? action : existing.action;
    const newDays = days_after_creation !== undefined ? parseInt(days_after_creation, 10) : existing.days_after_creation;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await run(
      `UPDATE LIFECYCLE_RULES SET name = ?, bucket_name = ?, prefix = ?, action = ?, days_after_creation = ?, is_active = ? WHERE id = ?`,
      [newName, newBucket, newPrefix, newAction, newDays, newActive, id]
    );

    await logActivity('UPDATE_LIFECYCLE_RULE', newBucket, null, `Rule updated: ${newName}`);

    res.json({ success: true, message: 'Lifecycle rule updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/lifecycle/:id - Delete lifecycle rule
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await run(`DELETE FROM LIFECYCLE_RULES WHERE id = ?`, [id]);
    await logActivity('DELETE_LIFECYCLE_RULE', null, null, `Rule ID ${id} deleted`);
    res.json({ success: true, message: 'Lifecycle rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/lifecycle/run - Manually trigger execution of all or a specific rule
router.post('/run', async (req, res) => {
  try {
    const { rule_id } = req.body || {};
    const report = await runLifecycleRules(rule_id || null);
    res.json(report);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
