# SNS Push Notifications Integration Design Spec

**Date:** 2026-04-06
**Scope:** Issue #6 — Integrate cloud-based push notifications for expiring items and household actions
**Approach:** Expo push API via scheduled Lambda, device token stored in Users table

---

## Architecture

```
EventBridge (daily 8am SGT)
    → ExpirationNotifier Lambda
        → Scan Users table (users with pushToken)
        → Scan Inventory table (expiring items per user)
        → Send push via Expo Push API (https://exp.host/--/api/v2/push/send)

Mobile App
    → On login: POST /notifications/register { userId, pushToken }
        → Lambda → Update Users table with pushToken
```

Uses Expo's push service (not raw SNS) to avoid FCM/APNs platform application setup. Expo handles the translation to native push services. Local notifications remain for in-app use; cloud push handles notifications when the app is closed.

---

## CDK Stack Changes

**Modified:** `backend/lib/shelflife-stack.ts`

### New Resources

- **ExpirationNotifier Lambda** (Node.js 20.x, 256MB, 60s timeout)
  - Environment: `USERS_TABLE`, `INVENTORY_TABLE`
  - Read access to both tables
  - Triggered by EventBridge rule: `cron(0 0 * * ? *)` (midnight UTC = 8am SGT)

- **NotificationRegister Lambda** (Node.js 20.x, 128MB, 10s timeout)
  - Environment: `USERS_TABLE`
  - Write access to Users table

- **API Route:** `POST /notifications/register`

---

## Lambda Handlers

### `backend/lambda/expiration-notifier.ts` — Scheduled Daily Push

1. Scan Users table for records with `pushToken` attribute
2. For each user, query Inventory table by userId for items with expiration dates
3. Calculate days until expiration for each item
4. Match against default warning thresholds (1, 3, 7 days)
5. Batch-send push notifications via Expo push API (up to 100 per request)
6. Log total notifications sent

**Push payload:**
```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "Expiring Soon: Milk",
  "body": "Milk expires in 3 days. Location: fridge",
  "data": { "type": "expiration-warning", "itemId": "abc123" }
}
```

### `backend/lambda/notification-register.ts` — Token Registration

- Receives `{ userId, pushToken }` from request body
- Updates Users table: sets `pushToken` field on the user record
- Returns 200 on success

### Dependencies
- No new SDK packages — uses `fetch` for Expo push API + existing `@aws-sdk/client-dynamodb`

---

## Client-Side Changes

### Modified: `src/services/notificationService.ts`

New function:
- `registerPushToken(userId: string)` — gets Expo push token via `Notifications.getExpoPushTokenAsync()`, sends to `POST /notifications/register`
- Falls back to console.log when `API_BASE_URL` is not set

All existing local notification functions kept intact.

### Modified: `src/hooks/useNotifications.ts`

- After permissions granted, call `registerPushToken(user.sub)` to register with backend
- Guard with ref to only register once per session

---

## Files Summary

### New Files (Backend)
- `backend/lambda/expiration-notifier.ts` — Daily push notification sender
- `backend/lambda/notification-register.ts` — Device token registration

### Modified Files (Backend)
- `backend/lib/shelflife-stack.ts` — Lambdas, EventBridge rule, API route

### Modified Files (App)
- `src/services/notificationService.ts` — Add `registerPushToken`
- `src/hooks/useNotifications.ts` — Call registration on login
