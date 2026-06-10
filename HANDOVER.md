# Session Handover

Notes for picking up work on this repo in a new Claude session.

## Current state

- **Branch:** `main`, pushed to origin
- **Issues:** all (#3–#15) closed
- **Last shipped feature:** deep linking from notifications (#15, commit `fa02ab7`)

## Uncommitted changes in working tree

Real source changes (the `ios/` directory is gitignored — ignore it):

```
M index.ts                       # adds `import 'react-native-get-random-values';`
M package.json                   # adds react-native-get-random-values dep
M package-lock.json              # lockfile update for the above
M src/screens/RegisterScreen.tsx # skip Confirm screen when no code was sent
M src/store/authStore.ts         # signUp() now returns { requiresConfirmation }
```

These are all logically one fix: **"make signup work in this Cognito environment"**.
Two bugs were hit during testing and both are addressed by these edits:

1. **`Property 'crypto' doesn't exist`** on Create Account — AWS SDK v3 needs a
   crypto polyfill in React Native. Fixed by installing
   `react-native-get-random-values` and importing it at the top of `index.ts`.
   *Requires a native rebuild* (`npx expo run:ios`) because it ships native code.
2. **Dead 6-digit verification screen** — the Cognito user pool has a PreSignUp
   Lambda (`shelflife-auto-confirm`) that auto-confirms users, so Cognito never
   sends a verification code. The app was routing to ConfirmScreen anyway and
   the user would wait forever. Fixed by checking
   `CodeDeliveryDetails` on the signup response and skipping Confirm when absent.

**Why not committed yet:** Metro kept hitting the harness's background-task
timeout before the user could finish end-to-end signin verification. Resume
checklist below.

## Resume checklist

1. **Run Metro in your own terminal** (Claude's background tasks max out at 10 min):
   ```
   npx expo start
   ```
2. **App is already installed on the iPhone 17 Pro simulator** with the rebuilt
   dev client that includes `react-native-get-random-values`. Just hit Cmd+R
   to pick up the latest JS bundle.
3. **Sign in** with the existing Cognito user: `huiliang@gmail.com` + the
   password you set during registration. Confirm Home renders.
4. **If sign-in works:** commit the auth fix as one commit:
   ```
   feat: fix signup flow for auto-confirm Cognito setup

   - Add react-native-get-random-values polyfill for AWS SDK v3 in RN
   - Skip 6-digit confirm screen when Cognito auto-confirms (no CodeDeliveryDetails)
   ```
5. **If sign-in fails:** check Metro logs for the actual error and iterate.

## Known dev-environment details

- **AWS profile:** `vsc-sso` (account 759650489076, region `ap-southeast-1`).
  Run `aws sso login --profile vsc-sso` if the session is stale.
- **Cognito user pool:** `ap-southeast-1_ZmO0zS0nM`
  - PreSignUp trigger: `shelflife-auto-confirm` Lambda (auto-confirms +
    auto-verifies email; no code ever sent)
  - `EmailSendingAccount: COGNITO_DEFAULT`, `AutoVerifiedAttributes: null`,
    `EmailVerificationMessage: null` — so the verification UX is by design dead
- **Existing test user:** `huiliang@gmail.com` (CONFIRMED, EmailVerified=true,
  sub `192af5bc-f031-70d3-e4c8-2cccc4c650d6`)
- **Dev build:** `expo-dev-client` is installed, so Expo Go won't work. Must
  use `npx expo run:ios` (or `--android`) for the first install; later you can
  just `npx expo start` and hit `i` to open on simulator.

## Potential follow-ups (not started)

- **Real email verification** — if you want the 6-digit flow to actually work,
  either (a) remove/disable the `shelflife-auto-confirm` Lambda and configure
  real email delivery (Cognito default has a 50/day cap + spam-folder issues;
  SES is production-grade but needs domain verification), or (b) leave auto-
  confirm as-is for dev and only enable real verification in production via env
  flag. Today the verification screen is unreachable after the fix, which is
  fine for now.
- **`shoppingStore.saveAndSync` version bump is fragile** — it mutates the
  `updatedList` object after `set()`. Works because Zustand stores the same
  object reference, but worth refactoring to bump version inside the `set()`
  call for safety. Not a known bug, just a smell.
- **`HomeScreen` low-stock quick-add UX** — currently adds *every* low-stock
  item to the active shopping list with no confirm. If that gets annoying,
  introduce a confirmation modal or a "select which to add" picker.
- **No tests** — there's no test suite in this repo. If the next session wants
  to add Jest + RN Testing Library, the sync conflict resolution logic in
  `src/services/conflictService.ts` is the highest-value place to start.

## File map for the recent feature work

- Sync conflict resolution: `src/services/conflictService.ts`,
  `src/store/conflictStore.ts`, `src/components/ConflictResolutionModal.tsx`,
  `src/services/syncService.ts` (`mergeWithConflicts`)
- Sync UI: `src/components/SyncStatusIndicator.tsx`,
  `src/components/OfflineBanner.tsx`, `src/store/syncStore.ts`,
  `src/hooks/useSync.ts`
- Low stock: `src/services/notificationService.ts` (`notifyLowStockItems`),
  `src/store/inventoryStore.ts` (`getLowStockItems`),
  `src/screens/HomeScreen.tsx` (Low Stock section),
  `backend/lambda/low-stock-notifier.ts`
- Deep linking: `src/navigation/linking.ts`, `src/navigation/navigationRef.ts`,
  `src/hooks/useNotifications.ts` (`handleNotificationPayload`),
  `app.json` (`"scheme": "shelflife"`)
