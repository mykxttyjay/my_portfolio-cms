import 'croner';
import { sql } from 'kysely';

async function setCronTasksEnabled(db, pluginId, enabled) {
  try {
    await sql`
			UPDATE _emdash_cron_tasks
			SET enabled = ${enabled ? 1 : 0}
			WHERE plugin_id = ${pluginId}
		`.execute(db);
  } catch {
  }
}

export { setCronTasksEnabled as s };
