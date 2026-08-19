import express from 'express';
import { query, get, run, logActivity } from '../db/database.js';
import { dispatchSingleWebhook } from '../services/webhookDispatcher.js';

const router = express.Router();

// GET /api/webhooks - List all configured webhooks
router.get('/', async (req, res) => {
  try {
    const webhooks = await query(`SELECT * FROM WEBHOOKS`);
    res.json({ success: true, webhooks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks - Create a new webhook
router.post('/', async (req, res) => {
  try {
    const { name, target_url, events, format, is_active } = req.body;

    if (!target_url || !target_url.trim()) {
      return res.status(400).json({ success: false, error: 'Target URL is required' });
    }

    const webhookName = name && name.trim() ? name.trim() : 'Webhook Endpoint';
    const eventList = events && events.trim() ? events.trim() : 's3:ObjectCreated:*';
    const webhookFormat = format || (target_url.includes('discord.com/api/webhooks') ? 'discord' : 'standard_s3_json');
    const active = is_active === undefined ? 1 : (is_active ? 1 : 0);

    const result = await run(
      `INSERT INTO WEBHOOKS (name, target_url, events, format, is_active) VALUES (?, ?, ?, ?, ?)`,
      [webhookName, target_url.trim(), eventList, webhookFormat, active]
    );

    await logActivity('CREATE_WEBHOOK', null, null, `Webhook created: ${webhookName} -> ${target_url}`);

    res.status(201).json({
      success: true,
      message: 'Webhook created successfully',
      id: result.lastID
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/webhooks/:id - Update webhook
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await get(`SELECT * FROM WEBHOOKS WHERE id = ?`, [id]);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const { name, target_url, events, format, is_active } = req.body;

    const newName = name !== undefined ? name : existing.name;
    const newUrl = target_url !== undefined ? target_url : existing.target_url;
    const newEvents = events !== undefined ? events : existing.events;
    const newFormat = format !== undefined ? format : existing.format;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await run(
      `UPDATE WEBHOOKS SET name = ?, target_url = ?, events = ?, format = ?, is_active = ? WHERE id = ?`,
      [newName, newUrl, newEvents, newFormat, newActive, id]
    );

    await logActivity('UPDATE_WEBHOOK', null, null, `Webhook updated: ${newName}`);

    res.json({ success: true, message: 'Webhook updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/webhooks/:id - Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await run(`DELETE FROM WEBHOOKS WHERE id = ?`, [id]);
    await logActivity('DELETE_WEBHOOK', null, null, `Webhook ID ${id} deleted`);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks/:id/test - Send test event to configured webhook
router.post('/:id/test', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const webhook = await get(`SELECT * FROM WEBHOOKS WHERE id = ?`, [id]);

    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }

    const testEventData = {
      bucketName: 'general-storage',
      objectKey: 'test/sample-image.png',
      fileName: 'sample-image.png',
      sizeBytes: 10485760, // 10 MB
      userId: 'test_admin_user',
      etag: '"d41d8cd98f00b204e9800998ecf8427e"'
    };

    await dispatchSingleWebhook(webhook, 's3:TestEvent', testEventData);

    res.json({
      success: true,
      message: `Test event sent successfully to ${webhook.target_url}!`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Webhook test failed: ${err.message}`
    });
  }
});

// POST /api/webhooks/test-url - Send test event to arbitrary URL
router.post('/test-url', async (req, res) => {
  try {
    const { target_url, format = 'discord' } = req.body;

    if (!target_url) {
      return res.status(400).json({ success: false, error: 'target_url is required' });
    }

    const fakeWebhook = {
      id: 999,
      name: 'Direct URL Test',
      target_url,
      format
    };

    const testEventData = {
      bucketName: 'general-storage',
      objectKey: 'test/sample-image.png',
      fileName: 'sample-image.png',
      sizeBytes: 10485760,
      userId: 'test_admin_user',
      etag: '"d41d8cd98f00b204e9800998ecf8427e"'
    };

    await dispatchSingleWebhook(fakeWebhook, 's3:TestEvent', testEventData);

    res.json({
      success: true,
      message: `Test event sent successfully to ${target_url}!`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Webhook test failed: ${err.message}`
    });
  }
});

export default router;
