import { Picker } from '@react-native-picker/picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { generateOTP, sendOTPEmail, storeOTP, validateEmail, verifyOTP } from '../services/otpService';

const SRI_LANKA_DISTRICTS = [
  'Select District',
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

interface RegisterScreenProps {
  navigation: any;
}

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [district, setDistrict] = useState('Select District');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sentOTP, setSentOTP] = useState('');
  const { register } = useAuth();

  const handleSendOTP = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (!contactNumber.trim()) {
      Alert.alert('Error', 'Please enter your contact number');
      return;
    }
    if (district === 'Select District') {
      Alert.alert('Error', 'Please select your district');
      return;
    }

    setIsLoading(true);
    try {
      // Generate and send OTP
      const otp = generateOTP();
      const sent = await sendOTPEmail(email, otp, name);
      
      if (sent) {
        storeOTP(email, otp);
        setSentOTP(otp);
        setShowOTPInput(true);
        Alert.alert(
          'OTP Sent',
          `A verification code has been sent to ${email}. Please check your email and enter the code below.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Failed to send verification email. Please check your email address and try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Verification code must be 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      // Verify OTP
      const isValid = verifyOTP(email, otpCode);
      
      if (!isValid) {
        Alert.alert('Error', 'Invalid or expired verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      // OTP verified, proceed with registration
      await register({
        name,
        email,
        username,
        password,
        contactNumber,
        district,
      });
      
      Alert.alert('Success', 'Registration successful! You can now login with your credentials.');
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      const otp = generateOTP();
      const sent = await sendOTPEmail(email, otp, name);
      
      if (sent) {
        storeOTP(email, otp);
        setSentOTP(otp);
        Alert.alert('Success', 'A new verification code has been sent to your email');
      } else {
        Alert.alert('Error', 'Failed to resend verification email');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join LankaSafe</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!isLoading && !showOTPInput}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading && !showOTPInput}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading && !showOTPInput}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading && !showOTPInput}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#666"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!isLoading && !showOTPInput}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Contact Number"
            placeholderTextColor="#666"
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
            editable={!isLoading && !showOTPInput}
          />
          
          <View style={styles.pickerWrapper}>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={district}
                onValueChange={(itemValue) => setDistrict(itemValue)}
                style={styles.picker}
                enabled={!isLoading && !showOTPInput}
              >
                {SRI_LANKA_DISTRICTS.map((dist) => (
                  <Picker.Item 
                    key={dist} 
                    label={dist} 
                    value={dist}
                    color="#333"
                  />
                ))}
              </Picker>
            </View>
          </View>

          {showOTPInput && (
            <View style={styles.otpContainer}>
              <Text style={styles.otpLabel}>Enter Verification Code</Text>
              <Text style={styles.otpSubtext}>We've sent a 6-digit code to {email}</Text>
              <TextInput
                style={styles.otpInput}
                placeholder="000000"
                placeholderTextColor="#666"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResendOTP}
                disabled={isLoading}
              >
                <Text style={styles.resendButtonText}>Resend Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showOTPInput ? (
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSendOTP}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleVerifyOTP}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Register</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.backButtonText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e94560',
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  pickerWrapper: {
    marginBottom: 15,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'ios' ? 200 : 55,
    width: '100%',
  },
  button: {
    backgroundColor: '#e94560',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#e94560',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  otpContainer: {
    backgroundColor: '#2a2a40',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#e94560',
  },
  otpLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  otpSubtext: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
    textAlign: 'center',
  },
  otpInput: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 10,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resendButtonText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
