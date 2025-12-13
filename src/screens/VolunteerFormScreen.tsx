import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../database';
import { Volunteer } from '../database/db';
import { cloudSyncService } from '../services/cloudSyncService';

// Sri Lankan Districts
const SRI_LANKA_DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
];

// Predefined options
const SKILLS_OPTIONS = [
  'Medical/First Aid',
  'Food Distribution',
  'Shelter Setup',
  'Search & Rescue',
  'Transportation',
  'Communication',
  'Child Care',
  'Counseling',
  'Administration',
  'Technical Support',
];

const AVAILABILITY_OPTIONS = [
  'Full Time (8+ hrs/day)',
  'Part Time (4-8 hrs/day)',
  'Weekends Only',
  'On-Call/Emergency',
  'Night Shifts',
];

const TASK_OPTIONS = [
  'Emergency Response',
  'Camp Management',
  'Medical Support',
  'Food & Water Distribution',
  'Shelter Construction',
  'Transport Services',
  'Communication & Coordination',
  'Data Collection',
  'Community Support',
  'Training Others',
];

export default function VolunteerFormScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Check if user is logged in (allow offline user to register)
  const isOfflineUser = user?.username === 'offline';
  if (!user || isOfflineUser) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>🔒</Text>
          <Text style={styles.errorTitle}>Login Required</Text>
          <Text style={styles.errorText}>
            You must be logged in with an account to register as a volunteer. Offline users cannot register.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const toggleTask = (task: string) => {
    if (selectedTasks.includes(task)) {
      setSelectedTasks(selectedTasks.filter(t => t !== task));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const validateForm = (): boolean => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return false;
    }
    if (!phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return false;
    }
    if (!district) {
      Alert.alert('Validation Error', 'Please select your district');
      return false;
    }
    if (selectedSkills.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one skill');
      return false;
    }
    if (!selectedAvailability) {
      Alert.alert('Validation Error', 'Please select your availability');
      return false;
    }
    if (selectedTasks.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one preferred task');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Check if user already registered
      const existing = await dbService.getVolunteerByEmail(user.username);
      if (existing) {
        Alert.alert(
          'Already Registered',
          'You have already registered as a volunteer. Your registration is pending approval.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // Create volunteer registration
      const volunteer: Omit<Volunteer, 'created_at' | 'updated_at'> = {
        id: `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_email: user.username,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        district: district,
        skills: JSON.stringify(selectedSkills),
        availability: selectedAvailability,
        preferred_tasks: JSON.stringify(selectedTasks),
        emergency_contact: emergencyContact.trim() || undefined,
        emergency_phone: emergencyPhone.trim() || undefined,
        status: 'pending',
        approved: false,
      };

      await dbService.createVolunteer(volunteer);

      // Trigger immediate sync to Firebase
      console.log('📤 Syncing volunteer registration to Firebase...');
      cloudSyncService.syncToCloud().then((result) => {
        console.log(`✓ Volunteer sync complete: ${result.synced} uploaded`);
      }).catch((err) => {
        console.error('Volunteer sync error:', err);
      });

      Alert.alert(
        'Registration Successful',
        'Thank you for volunteering! Your registration has been submitted and is pending admin approval. You will be notified once approved.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error submitting volunteer registration:', error);
      Alert.alert('Error', 'Failed to submit registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Volunteer Registration</Text>
          <Text style={styles.headerSubtitle}>
            Help those in need during emergencies
          </Text>
          <Text style={styles.userEmail}>Registering as: {user.username}</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>District *</Text>
          <View style={styles.chipsContainer}>
            {SRI_LANKA_DISTRICTS.map(dist => (
              <TouchableOpacity
                key={dist}
                style={[
                  styles.chip,
                  district === dist && styles.chipSelected,
                ]}
                onPress={() => setDistrict(dist)}
              >
                <Text
                  style={[
                    styles.chipText,
                    district === dist && styles.chipTextSelected,
                  ]}
                >
                  {dist}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills * (Select all that apply)</Text>
          <View style={styles.chipsContainer}>
            {SKILLS_OPTIONS.map(skill => (
              <TouchableOpacity
                key={skill}
                style={[
                  styles.chip,
                  selectedSkills.includes(skill) && styles.chipSelected,
                ]}
                onPress={() => toggleSkill(skill)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSkills.includes(skill) && styles.chipTextSelected,
                  ]}
                >
                  {skill}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability *</Text>
          <View style={styles.chipsContainer}>
            {AVAILABILITY_OPTIONS.map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.chip,
                  selectedAvailability === option && styles.chipSelected,
                ]}
                onPress={() => setSelectedAvailability(option)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedAvailability === option && styles.chipTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preferred Tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Tasks * (Select all that apply)</Text>
          <View style={styles.chipsContainer}>
            {TASK_OPTIONS.map(task => (
              <TouchableOpacity
                key={task}
                style={[
                  styles.chip,
                  selectedTasks.includes(task) && styles.chipSelected,
                ]}
                onPress={() => toggleTask(task)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedTasks.includes(task) && styles.chipTextSelected,
                  ]}
                >
                  {task}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact (Optional)</Text>
          
          <Text style={styles.label}>Emergency Contact Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Name of emergency contact person"
            value={emergencyContact}
            onChangeText={setEmergencyContact}
          />

          <Text style={styles.label}>Emergency Contact Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number of emergency contact"
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Registration</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            * Required fields
          </Text>
          <Text style={styles.footerNote}>
            Your registration will be reviewed by administrators. You will be notified once approved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    fontSize: 14,
    color: '#555',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  backButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
