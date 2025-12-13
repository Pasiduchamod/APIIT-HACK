import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpModal({ visible, onClose }: HelpModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Help & Instructions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
            {/* How to Report */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to Report an Incident</Text>
              <Text style={styles.text}>
                1. Select the incident type from the dropdown{'\n'}
                2. Set the severity level (1-5){'\n'}
                3. Wait for GPS location to be acquired{'\n'}
                4. Optionally capture up to 3 photos{'\n'}
                5. Fill any required additional fields{'\n'}
                6. Tap "Submit Incident" to report
              </Text>
            </View>

            {/* Incident Types */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Incident Types</Text>
              
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Landslide</Text>
                <Text style={styles.text}>
                  Report landslides blocking roads or threatening property.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Flood</Text>
                <Text style={styles.text}>
                  Report flooding in roads, buildings, or residential areas.
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Road Block</Text>
                <Text style={styles.text}>
                  Report blocked roads due to any reason. You can optionally specify the route (e.g., "Kandy to Kurunegala road").
                </Text>
              </View>

              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Power Line Down</Text>
                <Text style={styles.text}>
                  Report fallen power lines. Keep safe distance and warn others.
                </Text>
              </View>

              <View style={[styles.subsection, styles.criticalSection]}>
                <Text style={styles.subsectionTitleCritical}>Trapped Civilians (CRITICAL)</Text>
                <Text style={styles.textCritical}>
                  Use ONLY for life-threatening situations where people are trapped.
                  {'\n\n'}You MUST provide:{'\n'}
                  • Number of trapped people{'\n'}
                  • Detailed situation description{'\n'}
                  • Any injuries or medical needs{'\n'}
                  {'\n'}This automatically sets severity to maximum (5).
                </Text>
              </View>
            </View>

            {/* Severity Levels */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Severity Levels</Text>
              <View style={styles.severityItem}>
                <Text style={[styles.severityBadge, { backgroundColor: '#4caf50' }]}>1</Text>
                <Text style={styles.text}>Low - Minor issue, no immediate danger</Text>
              </View>
              <View style={styles.severityItem}>
                <Text style={[styles.severityBadge, { backgroundColor: '#8bc34a' }]}>2</Text>
                <Text style={styles.text}>Minor - Small problem, limited impact</Text>
              </View>
              <View style={styles.severityItem}>
                <Text style={[styles.severityBadge, { backgroundColor: '#ffc107' }]}>3</Text>
                <Text style={styles.text}>Medium - Moderate issue, needs attention</Text>
              </View>
              <View style={styles.severityItem}>
                <Text style={[styles.severityBadge, { backgroundColor: '#ff9800' }]}>4</Text>
                <Text style={styles.text}>High - Serious problem, urgent response needed</Text>
              </View>
              <View style={styles.severityItem}>
                <Text style={[styles.severityBadge, { backgroundColor: '#f44336' }]}>5</Text>
                <Text style={styles.text}>Critical - Life-threatening, immediate action required</Text>
              </View>
            </View>

            {/* Photos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photo Guidelines</Text>
              <Text style={styles.text}>
                • Capture clear photos showing the incident{'\n'}
                • Take photos from multiple angles if possible{'\n'}
                • Include landmarks for better location context{'\n'}
                • Up to 3 photos can be attached{'\n'}
                • Photos are compressed and uploaded automatically{'\n'}
                • Works offline - photos sync when connection restored
              </Text>
            </View>

            {/* Offline Mode */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Offline Mode</Text>
              <Text style={styles.text}>
                • Reports are saved locally when offline{'\n'}
                • Automatic sync when internet connection restored{'\n'}
                • Check status badge in header (Online/Offline){'\n'}
                • All data is preserved until successfully synced
              </Text>
            </View>

            {/* Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location Services</Text>
              <Text style={styles.text}>
                • GPS must be enabled to report incidents{'\n'}
                • Location is automatically captured{'\n'}
                • Use "Refresh" button if location is not accurate{'\n'}
                • For Android: Wait for satellite fix (may take 30-60 seconds){'\n'}
                • Location data helps responders find the incident quickly
              </Text>
            </View>

            {/* Emergency Contacts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Emergency Contacts</Text>
              <Text style={styles.text}>
                In case of immediate life-threatening emergency:{'\n\n'}
                • Police Emergency: 119{'\n'}
                • Fire & Rescue: 110{'\n'}
                • Ambulance: 1990{'\n'}
                • Disaster Management: 117{'\n'}
                {'\n'}Report through this app for coordination and tracking.
              </Text>
            </View>

            {/* Tips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Important Tips</Text>
              <Text style={styles.text}>
                ✓ Ensure your safety first before reporting{'\n'}
                ✓ Provide accurate information{'\n'}
                ✓ Include as much detail as possible{'\n'}
                ✓ Take clear photos when safe to do so{'\n'}
                ✓ Report only genuine incidents{'\n'}
                ✓ Keep the app updated for latest features
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.gotItButton}>
              <Text style={styles.gotItButtonText}>Got It!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  subsection: {
    marginBottom: 16,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 6,
  },
  criticalSection: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    borderLeftColor: '#f44336',
  },
  subsectionTitleCritical: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  textCritical: {
    fontSize: 14,
    color: '#c62828',
    lineHeight: 22,
  },
  severityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  severityBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 12,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  gotItButton: {
    backgroundColor: '#e94560',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  gotItButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
