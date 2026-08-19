import { query, get, run, logActivity } from '../db/database.js';
import { deleteObjectFile } from './storageEngine.js';
import { triggerWebhooks } from './webhookDispatcher.js';

/**
 * Execute all active S3 lifecycle rules or a specific rule
 * @param {number|null} specificRuleId 
 * @returns {object} Execution summary
 */
export async function runLifecycleRules(specificRuleId = null) {
  try {
    let rules = await query(`SELECT * FROM LIFECYCLE_RULES`);
    
    if (specificRuleId) {
      rules = rules.filter(r => r.id === parseInt(specificRuleId, 10));
    } else {
      rules = rules.filter(r => r.is_active === 1 || r.is_active === true);
    }

    if (rules.length === 0) {
      return { success: true, processedRules: 0, affectedObjects: 0, details: [] };
    }

    const allObjects = await query(`SELECT * FROM OBJECTS WHERE is_deleted = 0`);
    let totalAffected = 0;
    const ruleReports = [];

    for (const rule of rules) {
      const now = Date.now();
      const requiredDays = rule.days_after_creation || 7;
      let ruleAffectedCount = 0;

      for (const obj of allObjects) {
        // 1. Bucket Match Check
        if (rule.bucket_name !== '*' && obj.bucket_name !== rule.bucket_name) {
          continue;
        }

        // 2. Prefix Match Check
        if (rule.prefix && !obj.object_key.startsWith(rule.prefix)) {
          continue;
        }

        // 3. Age in Days Check
        const createdAtTime = new Date(obj.created_at).getTime();
        const ageInDays = (now - createdAtTime) / (1000 * 60 * 60 * 24);

        if (ageInDays >= requiredDays) {
          // Rule action execution
          if (rule.action === 'EXPIRE_PERMANENT_DELETE') {
            deleteObjectFile(obj.file_path);
            await run(`DELETE FROM OBJECTS WHERE id = ?`, [obj.id]);
            await logActivity('LIFECYCLE_PERMANENT_DELETE', obj.bucket_name, obj.object_key, `Rule: ${rule.name} (Age: ${ageInDays.toFixed(1)} days)`);
            triggerWebhooks('s3:ObjectRemoved:PermanentDelete', {
              bucketName: obj.bucket_name,
              objectKey: obj.object_key,
              fileName: obj.file_name,
              sizeBytes: obj.size_bytes,
              userId: obj.user_id,
              etag: obj.etag
            });
          } else {
            // Default: EXPIRE_SOFT_DELETE (Move to Trash Bin)
            await run(`UPDATE OBJECTS SET is_deleted = 1 WHERE id = ?`, [obj.id]);
            await logActivity('LIFECYCLE_SOFT_DELETE', obj.bucket_name, obj.object_key, `Rule: ${rule.name} (Age: ${ageInDays.toFixed(1)} days)`);
            triggerWebhooks('s3:ObjectRemoved:SoftDelete', {
              bucketName: obj.bucket_name,
              objectKey: obj.object_key,
              fileName: obj.file_name,
              sizeBytes: obj.size_bytes,
              userId: obj.user_id,
              etag: obj.etag
            });
          }

          ruleAffectedCount++;
          totalAffected++;
        }
      }

      // Update rule execution state
      await run(
        `UPDATE LIFECYCLE_RULES SET last_run_at = ?, affected_objects_count = ? WHERE id = ?`,
        [new Date().toISOString(), (rule.affected_objects_count || 0) + ruleAffectedCount, rule.id]
      );

      ruleReports.push({
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.action,
        affectedCount: ruleAffectedCount
      });
    }

    return {
      success: true,
      processedRules: rules.length,
      affectedObjects: totalAffected,
      details: ruleReports,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('Lifecycle execution error:', err);
    throw err;
  }
}

/**
 * Start periodic automated lifecycle scheduler (runs every 1 hour)
 */
export function startLifecycleScheduler() {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  
  // Initial check after 30 seconds
  setTimeout(() => {
    runLifecycleRules().catch(err => console.error('Initial lifecycle check error:', err));
  }, 30000);

  // Periodic recurring check
  setInterval(() => {
    runLifecycleRules().catch(err => console.error('Scheduled lifecycle check error:', err));
  }, ONE_HOUR_MS);

  console.log('⏳ Automated S3 Lifecycle Rules background scheduler started.');
}
