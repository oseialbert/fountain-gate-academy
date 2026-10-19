# Fountain Gate Academy Mobile App

This is the official mobile companion for the Fountain Gate Academy school portal. It's built with Expo (React Native) and connects to the live API.

## Live API
`https://fountain-gate-academy.onrender.com`

## Quick start

1. Install dependencies
   ```bash
   cd mobile
   npm install
   ```

2. Run in Expo
   ```bash
   npx expo start
   ```
   - Press `a` for Android (emulator), `i` for iOS (simulator), or scan the QR code with Expo Go on your phone.

## Features
- Auth: Login, Register, Two-factor verification
- Dashboard: counts + recent attendance
- Students: list, add/edit (admin), delete with safeguards (admin/staff policy reflected)
- Classes: list, add, delete (staff+admin rules)
- Attendance: record per student by date
- Grades: view/add, admin-only deletion
- Profile: change password, setup/disable 2FA, sign out

## Build for distribution

**Android AAB (recommended for Play Store):**
```bash
cd mobile
npx eas-cli@latest build --profile production --platform android
```

**Android APK (direct install):**
```bash
cd mobile
npx eas-cli@latest build --profile preview --platform android
```

**iOS:** requires Apple Developer account & macOS/Xcode.
```bash
cd mobile
npx eas-cli@latest build --profile production --platform ios
```

## Web export
Already exported at `/mobile/index.html`. To re-export:
```bash
cd mobile
npx expo export --platform web
```

## PWA
The web export works as a PWA if served over HTTPS. The current GitHub export allows opening in browser and installing on mobile (Add to Home Screen).

## Important notes
- The API is the live Render app. The mobile app stores the session cookie in AsyncStorage.
- Cookies are HttpOnly+Secure+SameSite on production.
- 2FA setup shows a QR code; enabling/disabling requires valid codes.
- Deletions respect backend constraints (staff cannot delete students/classes with related records).

## Assets
Icons/splash are from Expo defaults. You can replace them in `assets/` if desired.
