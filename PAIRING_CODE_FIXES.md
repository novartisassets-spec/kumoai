# Pairing Code Bug Fixes - Summary

## Issues Fixed

### 1. **Auto-Reconnect Switches to QR Mode** ✅
**Problem:** When connection closed, auto-reconnect would always use QR mode instead of maintaining pairing code mode.

**Solution:** 
- Added `connectionPreferences` map to store connection mode and phone number
- Modified reconnect logic to check stored preferences and maintain pairing mode
- Added 2-second delay for pairing mode reconnects to avoid rate limiting

### 2. **Pairing Codes Don't Refresh** ✅
**Problem:** Once a pairing code was generated, it wouldn't refresh if it expired or if Baileys generated a new one.

**Solution:**
- Added `pairingCodeAttempts` tracking (separate from QR attempts)
- On reconnect in pairing mode, automatically requests new pairing code
- Frontend now shows expiration timer (2 minutes)
- Added "New Code" button when code expires

### 3. **QR Lock Applied to Pairing Codes** ✅
**Problem:** QR refresh limit (3 attempts) was being applied to pairing codes.

**Solution:**
- Separated QR attempts (`qrAttempts`) from pairing code attempts (`pairingCodeAttempts`)
- QR limit: 3 attempts, then 5-minute lock
- Pairing code limit: 5 attempts, no time lock (just count)
- Only QR mode checks the database lock

### 4. **"Start Fresh" Button Errors** ✅
**Problem:** Clicking "Start Fresh" only cleared local state, not backend socket.

**Solution:**
- Updated "Start Fresh" button to call `/whatsapp/disconnect/:schoolId` API first
- Clears connection preferences on backend
- Resets both QR and pairing code attempts
- Properly closes EventSource
- Refreshes status after disconnect

### 5. **No Expiration Indication** ✅
**Problem:** Users didn't know when pairing code expired.

**Solution:**
- Added 2-minute expiration timer on frontend
- Visual indication when code expires (red styling, strikethrough)
- "Request New Code" button appears when expired
- Auto-clears expiration when new code received

## Backend Changes (`multi-socket-manager.ts`)

### New Properties
```typescript
private pairingCodeAttempts: Map<string, number> = new Map();
private connectionPreferences: Map<string, { mode: 'qr' | 'pairing'; phoneNumber?: string }> = new Map();
```

### Modified `connect()`
- Detects reconnects and uses stored phone number
- Stores connection preferences at start
- Separate limit checks for QR vs pairing mode
- Pairing mode: 5 attempts max, no time lock
- QR mode: 3 attempts max, 5-minute lock

### Modified Reconnect Logic
- Checks `connectionPreferences` for mode
- Maintains pairing mode on reconnect
- Adds 2-second delay for pairing reconnects

### Modified `disconnect()`
- Clears `connectionPreferences`
- Resets both `pairingCodeAttempts` and `qrAttempts`

### Connection Success Handler
- Resets `pairingCodeAttempts` on successful connection

## Frontend Changes (`ConnectAI.tsx`)

### New State
```typescript
const [pairingCodeExpired, setPairingCodeExpired] = useState(false);
```

### New Effects
- Expiration timer: 2 minutes after receiving pairing code
- Auto-clears when new code received

### Updated UI
- Shows expiration status visually
- "New Code" button when expired
- Disabled copy button when expired

### Updated "Start Fresh" Button
```typescript
onClick={async () => {
    // Disconnect from backend first
    await fetch(`${API_URL}/whatsapp/disconnect/${schoolId}`, ...);
    
    // Then clear local state
    setQrCode(null);
    setPairingCode(null);
    setConnectionMode('qr');
    setError(null);
    eventSourceRef.current?.close();
    await fetchStatus();
}}
```

## Testing Instructions

1. **Test Pairing Code Flow:**
   - Select "Pairing Code" mode
   - Click "Get Pairing Code"
   - Note the code displayed
   - Wait 2 minutes without entering it
   - Verify it shows as expired with "New Code" button
   - Click "New Code" and verify new code generated

2. **Test Auto-Reconnect:**
   - Generate pairing code
   - Trigger connection close (restart server or wait for timeout)
   - Verify it reconnects in pairing mode (check logs)
   - Verify new pairing code is generated automatically

3. **Test QR vs Pairing Limits:**
   - Generate 3 QR codes (should lock)
   - Switch to pairing mode
   - Generate pairing code (should work, separate limit)
   - Generate up to 5 pairing codes

4. **Test Start Fresh:**
   - Generate pairing code
   - Click "Start Fresh"
   - Verify no errors
   - Verify can generate new code immediately

## Log Messages to Watch For

```
[WhatsApp] 🔌 connect() called for school: XXX, method: pairing, isReconnect: true
[WhatsApp] 🔄 Reconnect detected, using stored phone: 2347040522085
[WhatsApp] 🔄 Reconnecting in PAIRING mode for XXX...
[WhatsApp] ✅ Pairing code attempt 1/5
[WhatsApp] 🔐 Pairing code generated: XXXXXXXX
[WhatsApp] ✅ Pairing code attempt 2/5
```

## Success Criteria

✅ Pairing code mode persists through reconnects
✅ New pairing codes generated on reconnect (not QR)
✅ Separate attempt limits for QR vs pairing
✅ "Start Fresh" works without errors
✅ Expiration clearly indicated to users
✅ Can request new code when expired

All fixes implemented and ready for testing! 🎉
