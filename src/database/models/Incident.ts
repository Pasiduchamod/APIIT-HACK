import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Incident extends Model {
  static table = 'incidents';

  @field('type') type!: string;
  @field('severity') severity!: number;
  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @date('timestamp') timestamp!: Date;
  @field('is_synced') isSynced!: boolean;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
