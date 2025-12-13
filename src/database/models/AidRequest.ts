// Aid Request interface for type safety
export interface AidRequest {
  id: string;
  aid_types: string; // Stored as JSON string array
  latitude: number;
  longitude: number;
  description: string | null; // Optional - can be empty
  priority_level: number; // 1-5
  status: 'pending' | 'synced' | 'failed';
  aidStatus: 'pending' | 'taking action' | 'completed'; // Status of aid delivery
  requester_name: string | null; // Name of person requesting aid
  contact_number: string | null; // Phone number for contact
  number_of_people: number | null; // How many people need aid
  created_at: number;
  updated_at: number;
}
