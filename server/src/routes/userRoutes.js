import express from 'express';
import { query, get, run, logActivity } from '../db/database.js';

const router = express.Router();

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await query(`SELECT * FROM USERS`);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/users - Create a new user
router.post('/', async (req, res) => {
  try {
    const { username, full_name, role = 'DEVELOPER', status = 'ACTIVE' } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const existing = await get(`SELECT * FROM USERS WHERE username = ?`, [cleanUsername]);

    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already exists' });
    }

    const validRoles = ['ADMIN', 'DEVELOPER', 'VIEWER'];
    const assignedRole = validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'DEVELOPER';

    const result = await run(
      `INSERT INTO USERS (username, full_name, role, status) VALUES (?, ?, ?, ?)`,
      [cleanUsername, full_name ? full_name.trim() : cleanUsername, assignedRole, status]
    );

    await logActivity('CREATE_USER', null, null, `User created: ${cleanUsername} (Role: ${assignedRole})`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get(`SELECT * FROM USERS WHERE id = ?`, [id]);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { full_name, role, status } = req.body;

    const newFullName = full_name !== undefined ? full_name : existing.full_name;
    const newRole = role !== undefined ? role.toUpperCase() : existing.role;
    const newStatus = status !== undefined ? status.toUpperCase() : existing.status;

    await run(
      `UPDATE USERS SET full_name = ?, role = ?, status = ? WHERE id = ?`,
      [newFullName, newRole, newStatus, id]
    );

    await logActivity('UPDATE_USER', null, null, `User updated: ${existing.username} (Role: ${newRole})`);

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get(`SELECT * FROM USERS WHERE id = ?`, [id]);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (existing.username === 'admin') {
      return res.status(403).json({ success: false, error: 'Cannot delete the master admin user.' });
    }

    await run(`DELETE FROM USERS WHERE id = ?`, [id]);
    await logActivity('DELETE_USER', null, null, `User deleted: ${existing.username}`);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
