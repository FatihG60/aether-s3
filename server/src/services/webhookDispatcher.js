import { query, logActivity } from '../db/database.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Dispatch webhooks to all subscribed endpoints
 * @param {string} eventName - e.g. 's3:ObjectCreated:Put', 's3:ObjectRemoved:Delete', 's3:ObjectRestored', 's3:ObjectMoved'
 * @param {object} eventData - { bucketName, objectKey, fileName, sizeBytes, userId, etag, details }
 */
export async function triggerWebhooks(eventName, eventData) {
  try {
    const webhooks = await query(`SELECT * FROM WEBHOOKS`);
    const activeWebhooks = webhooks.filter(w => w.is_active === 1 || w.is_active === true);

    if (activeWebhooks.length === 0) return;

    for (const webhook of activeWebhooks) {
      const subscribedEvents = (webhook.events || '').split(',').map(e => e.trim());
      const isSubscribed = subscribedEvents.some(pattern => {
        if (pattern === '*' || pattern === 'all') return true;
        if (pattern === eventName) return true;
        if (pattern.endsWith('*') && eventName.startsWith(pattern.slice(0, -1))) return true;
        return false;
      });

      if (!isSubscribed) continue;

      dispatchSingleWebhook(webhook, eventName, eventData).catch(err => {
        console.error(`Webhook error (${webhook.name} - ${webhook.target_url}):`, err.message);
      });
    }
  } catch (err) {
    console.error('Failed to query webhooks:', err);
  }
}

/**
 * Send a single webhook payload
 */
export async function dispatchSingleWebhook(webhook, eventName, eventData) {
  const isDiscord = webhook.format === 'discord' || (webhook.target_url && webhook.target_url.includes('discord.com/api/webhooks'));
  const timestamp = new Date().toISOString();

  let bodyPayload;

  if (isDiscord) {
    let color = 0x6366f1; // Indigo default
    let actionTitle = '📦 S3 Olay Bildirimi';

    if (eventName.includes('ObjectCreated')) {
      color = 0x6366f1; // Indigo
      actionTitle = '📤 Yeni Dosya Yüklendi (S3 Object Created)';
    } else if (eventName.includes('ObjectRemoved') || eventName.includes('Delete')) {
      color = 0xf43f5e; // Rose
      actionTitle = '🗑️ Dosya Silindi (S3 Object Removed)';
    } else if (eventName.includes('Restored')) {
      color = 0x10b981; // Emerald
      actionTitle = '♻️ Dosya Geri Yüklendi (S3 Object Restored)';
    } else if (eventName.includes('Moved')) {
      color = 0x8b5cf6; // Purple
      actionTitle = '🚚 Dosya Taşındı / Yeniden Adlandırıldı (S3 Object Moved)';
    } else if (eventName === 's3:TestEvent') {
      color = 0x06b6d4; // Cyan
      actionTitle = '🔔 AETHER S3 Webhook Test Bildirimi';
    }

    bodyPayload = {
      username: 'AETHER S3 Engine',
      avatar_url: 'https://raw.githubusercontent.com/FatihG60/aether-s3/main/assets/logo.png',
      embeds: [
        {
          title: actionTitle,
          description: `**Bucket:** \`${eventData.bucketName || 'general-storage'}\`\n**Nesne:** \`${eventData.objectKey || 'dosya'}\``,
          color: color,
          fields: [
            {
              name: '📊 Boyut',
              value: formatBytes(eventData.sizeBytes || 0),
              inline: true
            },
            {
              name: '👤 Kullanıcı',
              value: `\`${eventData.userId || 'user_default'}\``,
              inline: true
            },
            {
              name: '⚡ Olay',
              value: `\`${eventName}\``,
              inline: true
            }
          ],
          footer: {
            text: `AETHER S3 Event Notification • ${new Date().toLocaleTimeString('tr-TR')}`
          },
          timestamp: timestamp
        }
      ]
    };
  } else {
    // Standard AWS S3 Event Records JSON Schema
    bodyPayload = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aether:s3',
          awsRegion: 'eu-central-1',
          eventTime: timestamp,
          eventName: eventName,
          userIdentity: {
            principalId: eventData.userId || 'user_default'
          },
          s3: {
            s3SchemaVersion: '1.0',
            configurationId: `webhook-${webhook.id}`,
            bucket: {
              name: eventData.bucketName || 'general-storage',
              arn: `arn:aws:s3:::${eventData.bucketName || 'general-storage'}`
            },
            object: {
              key: eventData.objectKey,
              size: eventData.sizeBytes || 0,
              eTag: eventData.etag || null,
              sequencer: Date.now().toString(16).toUpperCase()
            }
          }
        }
      ]
    };
  }

  const response = await fetch(webhook.target_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AetherS3-Webhook-Dispatcher/1.0'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  return { success: true, status: response.status };
}
