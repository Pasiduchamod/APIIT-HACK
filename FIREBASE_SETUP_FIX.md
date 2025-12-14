# Firebase Setup Fix - Email & Login Issues

## Why Email Sending and Login Are Not Working

The code is correct, but Firebase Console needs to be configured properly. Here's what to fix:

---

## ✅ Step 1: Enable Email/Password Authentication

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **project-aegis-ce5a8**
3. Click **Authentication** in left sidebar
4. Click **Sign-in method** tab
5. Click **Email/Password**
6. **Enable** the toggle switch
7. ✅ Enable "Email/Password"
8. ❌ You can leave "Email link (passwordless sign-in)" disabled
9. Click **Save**

---

## ✅ Step 2: Configure Email Verification Settings

### Option A: Use Firebase Default Email (Easiest)

1. In Firebase Console → Authentication → Templates
2. Click **Email address verification**
3. The default template should work out of the box
4. ✅ No changes needed

### Option B: Customize Email Template (Optional)

1. Edit the subject line: "Verify your email for LankaSafe"
2. Customize the message body with your app branding
3. Click **Save**

---

## ✅ Step 3: Fix Firestore Security Rules

The app needs to read/write user data. Update your rules:

1. Go to Firebase Console → **Firestore Database**
2. Click **Rules** tab
3. Replace with these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - allow read/write for authenticated users
    match /users/{userId} {
      allow read: if true; // Allow anyone to read user profiles
      allow create: if true; // Allow registration
      allow update: if request.auth != null && request.auth.uid != null;
      allow delete: if false; // Prevent deletion
    }
    
    // Incidents collection
    match /incidents/{incidentId} {
      allow read: if true;
      allow create: if true;
      allow update: if request.auth != null;
      allow delete: if false;
    }
    
    // Aid Requests collection
    match /aidRequests/{requestId} {
      allow read: if true;
      allow create: if true;
      allow update: if request.auth != null;
      allow delete: if false;
    }
    
    // Detention Camps collection
    match /detentionCamps/{campId} {
      allow read: if true;
      allow create: if true;
      allow update: if request.auth != null;
      allow delete: if false;
    }
    
    // Volunteers collection
    match /volunteers/{volunteerId} {
      allow read: if true;
      allow create: if true;
      allow update: if request.auth != null;
      allow delete: if false;
    }
  }
}
```

4. Click **Publish**

---

## ✅ Step 4: Enable Firebase Storage

For image uploads to work:

1. Go to Firebase Console → **Storage**
2. Click **Get Started**
3. Use these security rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /incident-images/{imageId} {
      allow read: if true;
      allow write: if true;
      allow delete: if request.auth != null;
    }
  }
}
```

4. Click **Done**

---

## ✅ Step 5: Test Login Flow

### Test with Demo Account (No Firebase Needed)
- Username: `demo`
- Password: `demo`
- This bypasses Firebase completely

### Test Registration

1. Open the app
2. Tap "Create New Account"
3. Fill in all fields with a **real email address**
4. Tap "Register"
5. **Check your email** (including spam folder)
6. Click the verification link
7. Return to app and login

---

## 🐛 Common Issues & Fixes

### Issue 1: "Invalid username or password"

**Cause:** User doesn't exist or email not verified

**Fix:**
- Make sure you registered first
- Check email verification link was clicked
- Try demo login: `demo` / `demo`

### Issue 2: "Please verify your email"

**Cause:** Email verification link not clicked

**Fix:**
1. Check your email inbox (and spam)
2. Look for email from `noreply@project-aegis-ce5a8.firebaseapp.com`
3. Click the verification link
4. Try login again

### Issue 3: No verification email received

**Possible causes:**
- Email provider blocking Firebase emails
- Wrong email address entered
- Firebase quota exceeded

**Fix:**
1. Check spam/junk folder
2. Try registering with a different email (Gmail recommended)
3. Check Firebase Console → Authentication → Users to see if user was created
4. If user exists, you can manually verify:
   - Firebase Console → Authentication → Users
   - Click the user
   - Click menu (⋮) → "Set email as verified"

### Issue 4: "Too many requests"

**Cause:** Multiple failed login attempts

**Fix:**
- Wait 15 minutes before trying again
- Use demo login in the meantime
- Firebase Console → Authentication → Users → Enable user if disabled

### Issue 5: "Network error" or "Connection failed"

**Cause:** 
- No internet connection
- Firebase service down
- Firewall blocking Firebase

**Fix:**
- Check internet connection
- Try using mobile data instead of WiFi
- Disable VPN if using one
- Check Firebase status: https://status.firebase.google.com

---

## 🧪 Testing Checklist

Use this to verify everything works:

- [ ] Firebase Authentication enabled (Email/Password)
- [ ] Firestore rules published
- [ ] Storage rules published
- [ ] Demo login works (`demo` / `demo`)
- [ ] Registration creates user in Firebase Console
- [ ] Verification email received
- [ ] Email verification link works
- [ ] Login works after verification
- [ ] Can report incident while online
- [ ] Can request aid while online

---

## 📱 App Testing Steps

### 1. Test Demo Login (Should Always Work)
```
Username: demo
Password: demo
```
✅ If this works, your app code is fine. Issue is with Firebase setup.

### 2. Test Registration
1. Use a real email you can access
2. Username: `testuser1`
3. Password: `test123`
4. Fill in all other fields
5. Tap Register
6. Check email for verification link

### 3. Test Login After Verification
1. Username: `testuser1`
2. Password: `test123`
3. Should login successfully

---

## 🔍 Debug Information

### Check Firebase Console

**Authentication → Users**
- Should see registered users
- Email column shows verification status
- Click user to see full details

**Firestore Database → Data**
- Should see `users` collection
- Each document should have: id, username, email, etc.

**Storage**
- Should see `incident-images` folder
- Images appear after incidents with photos are reported

### Enable Debug Logging

In `src/config/firebase.ts`, change line 8:

```typescript
// Before:
setLogLevel('error');

// After (for debugging):
setLogLevel('debug');
```

Then check terminal/console for detailed Firebase logs.

---

## 📧 Email Configuration (Advanced)

If verification emails are not sending, check:

### Firebase Email Quota
- Free tier: 100 emails/day
- Check: Firebase Console → Usage
- Upgrade to Blaze plan if needed

### Custom Email Domain (Optional)
1. Firebase Console → Authentication → Templates
2. Click "Customize domain"
3. Add your domain (requires DNS configuration)

---

## ✅ Verification Complete

Once you've completed all steps:

1. ✅ Authentication enabled
2. ✅ Firestore rules set
3. ✅ Storage rules set  
4. ✅ Demo login works
5. ✅ Registration + verification works
6. ✅ Real login works

Your app should now be fully functional!

---

## 🆘 Still Not Working?

1. **Clear app data** and try again
2. **Uninstall and reinstall** the app
3. Try a different email provider (Gmail recommended)
4. Check Firebase Console → Authentication → Settings → Authorized domains
   - Make sure `project-aegis-ce5a8.firebaseapp.com` is listed

---

## 📞 Support

If issues persist after following all steps:
1. Check Firebase Console for error messages
2. Enable debug logging (see above)
3. Share specific error messages for troubleshooting
