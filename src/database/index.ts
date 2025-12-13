import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import Incident from './models/Incident';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'ProjectAegis',
  jsi: false, // Set to true if using JSI (recommended for performance)
});

export const database = new Database({
  adapter,
  modelClasses: [Incident],
});
