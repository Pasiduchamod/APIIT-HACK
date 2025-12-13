// Aid Request interface for type safety
export interface AidRequest {
  id: string;
  aid_types: string; // Stored as JSON string array
  latitude: number;
  longitude: number;
  description: string | null; // Optional - can be empty
  priority_level: number; // 1-5
  status: 'pending' | 'synced' | 'failed';
  created_at: number;
  updated_at: number;
}
