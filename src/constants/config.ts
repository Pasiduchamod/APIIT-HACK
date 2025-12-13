// API Configuration
export const API_BASE_URL = 'http://localhost:3000/api';

// Change this to your computer's IP address for testing on physical devices
// Example: export const API_BASE_URL = 'http://192.168.1.100:3000/api';

export const INCIDENT_TYPES = [
  'Landslide',
  'Flood',
  'Road Block',
  'Power Line Down',
  'Trapped Civilians',
] as const;

export type IncidentType = typeof INCIDENT_TYPES[number];

// Aid Request Types
export const AID_TYPES = [
  'Food',
  'Drinking Water',
  'Clothing',
  'Medical Aid',
  'Shelter',
  'Rescue / Evacuation',
  'Elderly / Child Assistance',
  'Emergency Supplies',
] as const;

export type AidType = typeof AID_TYPES[number];
