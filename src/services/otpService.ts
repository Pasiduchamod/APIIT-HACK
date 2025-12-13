import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP to email by storing in Firebase for dashboard to process
 * The dashboard will monitor this collection and send emails
 */
export async function sendOTPEmail(email: string, otp: string, name: string): Promise<boolean> {
  try {
    // Store OTP request in Firebase for dashboard to process
    await addDoc(collection(db, 'otpRequests'), {
      email,
      name,
      otp,
      createdAt: new Date().toISOString(),
      status: 'pending',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });
    
    // For now, just log the OTP for testing
    console.log('='.repeat(50));
    console.log('OTP VERIFICATION CODE');
    console.log('='.repeat(50));
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`OTP Code: ${otp}`);
    console.log('='.repeat(50));
    console.log('Note: In production, this will be sent via email');
    console.log('='.repeat(50));
    
    return true;
  } catch (error) {
    console.error('Error storing OTP request:', error);
    return false;
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Store OTP temporarily (in memory - valid for 10 minutes)
 */
interface OTPData {
  otp: string;
  timestamp: number;
  email: string;
}

const otpStore: Map<string, OTPData> = new Map();

export function storeOTP(email: string, otp: string): void {
  otpStore.set(email, {
    otp,
    timestamp: Date.now(),
    email,
  });
}

export function verifyOTP(email: string, otp: string): boolean {
  const stored = otpStore.get(email);
  
  if (!stored) {
    return false;
  }

  // Check if OTP is expired (10 minutes)
  const isExpired = Date.now() - stored.timestamp > 10 * 60 * 1000;
  if (isExpired) {
    otpStore.delete(email);
    return false;
  }

  // Check if OTP matches
  if (stored.otp === otp) {
    otpStore.delete(email); // Remove after successful verification
    return true;
  }

  return false;
}

export function clearOTP(email: string): void {
  otpStore.delete(email);
}
