# Research: Web Push vs. Email Delivery in a React Router v7 Web App

**Ticket:** [#3 — Investigate Web Push vs. Email delivery in a React Router web app](https://github.com/dulovics/cohort-005-project/issues/3)  
**Map:** [#1 — In-app notifications & multi-channel notification specification](https://github.com/dulovics/cohort-005-project/issues/1)

## Executive Summary

For **Cadence**—a web-first course platform built on **React Router v7 (`8.3.0`) and Vite (`7.1.7`)** with no native mobile application—**Email (paired with an in-app feed using unread/unseen delay fallback for standard events and immediate delivery for high-urgency transactional events)** is significantly more reliable, higher-reach, and lower-overhead than **Browser Web Push** as the primary out-of-app notification channel:

1. **Web Push suffers from high UX friction and platform gaps:** It requires a custom root-scoped Service Worker build pipeline in Vite/React Router v7, server-side VAPID key and per-device subscription lifecycle management (`410 Gone` pruning), an explicit user-gesture permission prompt (`Notification.requestPermission()`), and on **iOS/iPadOS Safari**, mandatory manual installation to the Home Screen (`display: standalone` PWA) before Web Push is even exposed. Furthermore, on desktop operating systems (macOS/Windows/Linux), closing the browser application completely (rather than just the tab) prevents delivery until the browser process is relaunched.
2. **Email requires zero opt-in setup and reaches 100% of authenticated users across desktop and mobile:** Every enrolled learner, instructor, and admin in Cadence already has an account email (`users.email`). Modern third-party notification services (Knock, Novu, Courier) natively support pairing an **in-app feed** with **email** via two declarative patterns:
   - **Delayed Unread/Unseen Escalation:** Deliver to the in-app feed immediately, pause via a `Delay` step (e.g., 15–60 minutes) or `Digest` batching window, and evaluate a step condition on the in-app message (`read == false` or `seen == false`) before dispatching an email.
   - **Immediate Multi-Channel Routing:** For high-urgency, low-frequency transactional events (such as **Refund Request Approved / Rejected** or **Course Published / Rejected**), bypass or zero out the delay so both the in-app feed and transactional email fire immediately.

---

## 1. Browser Web Push Requirements & Constraints in React Router v7 / Vite

Browser Web Push relies on three W3C/IETF standards working together: the **Service Worker API**, the **W3C Push API** ([W3C Push API Specification](https://www.w3.org/TR/push-api/)), the **WHATWG Notifications API** ([MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)), and the **IETF Web Push Protocol & VAPID** ([RFC 8030](https://datatracker.ietf.org/doc/html/rfc8030), [RFC 8292](https://datatracker.ietf.org/doc/html/rfc8292)).

### 1.1 Service Worker Registration in Vite / React Router v7

- **Root Scope Requirement:** To receive push events and handle `notificationclick` navigation across all routes of a web application, a Service Worker script must be served from the origin root (`/sw.js`) so its default registration scope covers `/` ([MDN `ServiceWorkerContainer.register()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)).
- **React Router v7 / Vite Build Mechanics:** Cadence uses `@react-router/dev` with Vite (`vite.config.ts`). React Router v7 compiles the application into a server request handler (`build/server/`) and static client assets (`build/client/`), copying anything in `public/` directly to the root of `build/client/` ([React Router v7 Framework Conventions](https://reactrouter.com/explanation/special-files)).
  - Neither React Router v7 nor Vite bundles a root-scoped Service Worker entry point out of the box.
  - Developers must either maintain an unbundled vanilla JS file at `public/sw.js` or add a secondary build step (e.g., `esbuild` or `vite-plugin-pwa`) that compiles `app/sw.ts` into `build/client/sw.js`.
  - If a Service Worker also intercepts `fetch` events, extra care is required in React Router v7 not to cache `.data` single-fetch loader requests (`?_routes=...`), which can serve stale route loader state.
- **Event Handling Inside the Worker:** The Service Worker must listen for:
  - `push` (`ServiceWorkerGlobalScope.onpush`): Parses the encrypted Web Push payload and calls `self.registration.showNotification(title, options)` wrapped in `event.waitUntil(...)` ([MDN `PushEvent`](https://developer.mozilla.org/en-US/docs/Web/API/PushEvent)).
  - `notificationclick` (`ServiceWorkerGlobalScope.onnotificationclick`): Closes the OS notification banner and focuses an existing client window (`clients.matchAll({ type: "window" })`) or opens the target deep link (`clients.openWindow(url)`).

### 1.2 VAPID Keys & Subscription Management (`PushManager.subscribe()`)

- **VAPID Authentication ([RFC 8292](https://datatracker.ietf.org/doc/html/rfc8292)):** Application servers authenticate to browser push services (Google FCM for Chrome/Edge, Mozilla Autopush for Firefox, Apple APNs bridge for Safari) using **Voluntary Application Server Identification (VAPID)**—an ECDSA P-256 public/private key pair.
  - The client passes the public key (`applicationServerKey` as a 65-octet uncompressed P-256 `Uint8Array` or base64url string) when calling `serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` ([W3C Push API §7 `PushSubscriptionOptionsInit`](https://www.w3.org/TR/push-api/#pushsubscriptionoptionsinit-dictionary), [MDN `PushManager.subscribe()`](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)).
  - The server signs outbound HTTP POST requests ([RFC 8030](https://datatracker.ietf.org/doc/html/rfc8030)) to the browser's push endpoint using the private VAPID key and encrypts the message payload ([RFC 8291](https://datatracker.ietf.org/doc/html/rfc8291)) using the subscription's client-generated `p256dh` public key and `auth` secret.
- **Mandatory `userVisibleOnly: true`:** Major browsers (Chrome, Edge, Firefox, Safari) strictly require `userVisibleOnly: true` in `PushManager.subscribe()` and reject `false` with a `NotAllowedError` `DOMException` ([W3C Push API §6.1](https://www.w3.org/TR/push-api/#dom-pushmanager-subscribe)). Every incoming push event *must* display a visible user notification; silent background pushes are prohibited or penalized by browser engines.
- **1-to-N Device Storage & Stale Endpoint Pruning (`410 Gone`):** Unlike an email address (which is 1-to-1 with a user account), a `PushSubscription` (`{ endpoint, keys: { p256dh, auth } }`) is **per-browser, per-device, per-profile**.
  - A backend (or notification service) must store a one-to-many table of subscriptions per user.
  - Subscriptions frequently expire or become invalidated when users clear site data, revoke permissions, or when push services rotate tokens. While the W3C spec defines a `pushsubscriptionchange` event ([W3C Push API §9.4](https://www.w3.org/TR/push-api/#the-pushsubscriptionchange-event)), browser support is inconsistent ([MDN `pushsubscriptionchange`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event)). Consequently, the server must inspect every push delivery response and immediately delete endpoints returning HTTP `410 Gone` or `404 Not Found` ([web.dev Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol)).

### 1.3 Explicit User-Gesture Permission Prompt UX Requirements

- **Transient User Activation Required:** Both `Notification.requestPermission()` and `PushManager.subscribe()` require a secure context (`HTTPS`) and **must be invoked directly inside a short-lived user gesture handler** (such as a `click` event on an in-app button) ([MDN `Notification.requestPermission()`](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission), [WebKit Blog: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Quiet Prompts & Irreversible Blocks:** Calling `requestPermission()` on page load without a user gesture is blocked or collapsed into a muted/quiet URL-bar indicator in Chromium, Firefox, and Safari. Furthermore, if a user clicks "Block" / "Don't Allow" on the native browser prompt, `Notification.permission` becomes `"denied"` permanently for that origin; the web app **cannot re-prompt the user programmatically** and can only show static instructions asking the user to manually reset site permissions in their browser settings.
- **Two-Step "Soft Ask" UX Overhead:** Because native permission denial cannot be undone via code, best practice requires building custom in-app "soft prompt" UI (e.g., an opt-in banner or settings toggle explaining why push notifications are useful) that triggers the native browser prompt only after the user clicks "Enable".

### 1.4 Desktop vs. Mobile Browser Limitations

| Platform / Browser | Tab Closed, Browser Running | Browser Application Completely Quit | Prerequisite / Platform Constraints |
| :--- | :--- | :--- | :--- |
| **Desktop Chrome / Edge / Firefox (macOS, Windows, Linux)** | Delivered (Service Worker woken in background) | **Not delivered on macOS/Linux** until the browser app is reopened (Windows Chrome can only deliver if background apps stay enabled) | Requires explicit user-gesture opt-in (`Notification.requestPermission()`) and OS notification permissions for the browser app. |
| **Desktop Safari (macOS)** | Delivered | Delivered via macOS APNs system daemon | Requires user-gesture opt-in. |
| **Android Chrome / Firefox** | Delivered | Delivered via Google Play Services (FCM) / OS wake-up | Subject to Android Doze mode / OEM battery optimization delays. |
| **iOS & iPadOS Safari (16.4+)** | **Unsupported in browser tabs** (`Notification` API is undefined in regular Safari tabs) | Delivered **only** if installed as a Home Screen Web App | **Requires PWA Home Screen installation:** Site must serve a Web App Manifest with `"display": "standalone"` (or `"fullscreen"`), user must manually tap *Share → Add to Home Screen* in Safari, launch from the Home Screen icon, and then tap an in-app button to grant permission ([WebKit Blog #13878](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple Developer Documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)). |

---

## 2. Email Delivery & Fallback Patterns in Third-Party Notification Services

Managed notification services (such as **Knock**, **Novu**, and **Courier**) treat the **In-App Feed** and **Email** as complementary stateful channels inside a single workflow definition ([Knock Workflow Overview](https://docs.knock.app/concepts/workflows), [Novu Workflow Concepts](https://docs.novu.co/concepts/workflows)). Because the provider tracks message engagement state (`unseen`, `seen`, `unread`, `read`) in real time as the user interacts with the React in-app feed component, email delivery can be conditioned directly on whether the user already saw or read the notification in-app.

### 2.1 Pattern A: Delayed Unread/Unseen In-App-to-Email Fallback (Standard Events)

For routine interactive or collaborative events (e.g., *Q&A reply posted*, *Lesson comment added*, *New course announcement*), sending an immediate email alongside an in-app toast creates notification fatigue for users who are actively browsing the app or return shortly afterward.

Third-party notification workflows solve this with a 3-step pipeline ([Knock Delay Step](https://docs.knock.app/designing-workflows/delay-function), [Knock Step Conditions](https://docs.knock.app/designing-workflows/step-conditions), [Novu Step Conditions](https://docs.novu.co/workflow/step-conditions)):

1. **Step 1 — In-App Feed Channel:** Immediately persists the notification to the user's in-app feed and pushes it over WebSocket/SSE to any open Cadence browser tab.
2. **Step 2 — Delay (or Digest/Batch) Step:** Pauses the workflow execution for a configurable window (e.g., `15–60 minutes` via a `Delay` step, or batches bursty events like multiple Q&A replies on the same thread via a `Batch`/`Digest` step).
3. **Step 3 — Conditional Email Channel:** Evaluates a **Message Status Condition** referencing Step 1 before dispatching the email:
   - In **Knock**: `refs.<in_app_step>.engagement_status` does not contain `read` (or `seen`) ([Knock Message Status Conditions](https://docs.knock.app/designing-workflows/step-conditions#message-status-condition)).
   - In **Novu**: `steps.<in-app-step-id>.read == false` (or `steps.<in-app-step-id>.seen == false`) ([Novu Previous Step Results](https://docs.novu.co/workflow/step-conditions)).
   - **Outcome:** If the user opened the in-app feed or clicked the notification while in Cadence during the delay window, the email step is automatically marked `Skipped`. If the user's browser tab was closed (or they never opened the feed), the email is sent automatically when the timer expires.

### 2.2 Pattern B: Immediate Parallel Delivery (High-Urgency / Transactional Events)

For high-urgency, financial, or account-critical events—such as **Refund Request Approved / Rejected**, **Purchase Receipt / Enrollment Confirmation**, or **Course Review Decision (Approved / Changes Requested)**—users expect an immediate, durable record in their inbox even if they happen to have an active browser tab open:

- The workflow executes the **In-App Feed step** and the **Email step** sequentially without a delay (or in parallel branches), guaranteeing instant delivery to both channels.
- User notification preferences can still expose per-category or per-workflow channel toggles while keeping critical transactional emails mandatory or opted-in by default ([Knock Preferences](https://docs.knock.app/concepts/preferences)).

---

## 3. Trade-Offs for Cadence: Web Push vs. Email Alongside the In-App Feed

| Evaluation Axis | Browser Web Push | Email (+ Unread-In-App Fallback) |
| :--- | :--- | :--- |
| **User Reach (Opt-in Rate)** | **Low.** Requires explicit per-device permission prompt; industry opt-in rates are typically low, and once denied (`"denied"`), the app cannot re-prompt. | **100% of users.** Every Cadence user already has a verified email address on record; works immediately with zero client-side setup or prompts. |
| **Mobile Reach (Without a Native App)** | **Very Poor on iOS.** Completely unavailable in mobile Safari tabs unless the learner manually installs Cadence to their iOS Home Screen as a standalone PWA and then opts in. | **Universal.** Nearly all mobile users have push-enabled native email clients (Apple Mail, Gmail) installed on iOS and Android, giving Cadence reliable mobile lock-screen reach via email. |
| **Reach When Browser / Tab Is Closed** | **Partial.** Works on desktop only while the browser process remains running in the background; fails on macOS/Linux if the user quits the browser app. | **Complete.** Delivered to the user's mailbox regardless of whether their browser or device is powered on. |
| **React Router v7 / Vite Implementation Overhead** | **High.** Requires a root-scoped Service Worker (`/sw.js`) build pipeline, Web App Manifest (`display: standalone`), VAPID key config, soft-ask permission UI, and multi-device `PushSubscription` storage + `410 Gone` cleanup. | **Low.** Zero browser APIs, Service Workers, or device token tables required; uses the existing user `email` field and an email provider adapter (e.g., Resend, Postmark, SendGrid, or a sandbox/dev sink) wired into the notification service. |
| **Suitability for Course Platform Events** | Ephemeral OS banners vanish once dismissed and are ill-suited for durable records like Refund decisions or multi-reply Q&A digests. | Supports rich HTML templates, deep links back into Cadence routes, durable audit trails for Refund/Course decisions, and clean digest/unread-fallback batching. |

### Recommendation for Cadence

1. **Do not adopt Browser Web Push:** Given that Cadence has no native mobile app and runs on React Router v7, Browser Web Push introduces substantial frontend/build complexity (Service Worker bundling, VAPID keys, device subscription syncing, soft-prompt UX) while failing to reach iOS users who haven't manually installed a Home Screen PWA and desktop users who quit their browser.
2. **Adopt Email + In-App Feed as the Multi-Channel Architecture:**
   - **In-App Feed** serves as the primary real-time channel when the user is active in the web app.
   - **Email** serves as the universal out-of-app channel:
     - **Immediate Email + In-App** for high-urgency transactional decisions (e.g., Refund request outcomes, critical course status changes).
     - **Delayed Unread/Unseen Fallback Email** (or batched digest) for lower-urgency activity (e.g., Q&A thread replies, comments, announcements) so active in-app users are not spammed with duplicate emails.

---

## Primary Sources

1. **W3C Push API Specification:** <https://www.w3.org/TR/push-api/> (and Editor's Draft: <https://w3c.github.io/push-api/>)
2. **MDN Web Docs — Push API & `PushManager.subscribe()`:** <https://developer.mozilla.org/en-US/docs/Web/API/Push_API> & <https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe>
3. **MDN Web Docs — `Notification.requestPermission()`:** <https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission>
4. **MDN Web Docs — `ServiceWorkerGlobalScope: pushsubscriptionchange` event:** <https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event>
5. **IETF RFC 8030 — Generic Event Delivery Using HTTP Push:** <https://datatracker.ietf.org/doc/html/rfc8030>
6. **IETF RFC 8292 — Voluntary Application Server Identification (VAPID) for Web Push:** <https://datatracker.ietf.org/doc/html/rfc8292>
7. **WebKit Blog — Web Push for Web Apps on iOS and iPadOS:** <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>
8. **Apple Developer Documentation — Sending web push notifications in web apps and browsers:** <https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers>
9. **web.dev — The Web Push Protocol (`410 Gone` & subscription lifecycle):** <https://web.dev/articles/push-notifications-web-push-protocol>
10. **React Router v7 Documentation — Framework Conventions & Special Files (`public/` & `build/client`):** <https://reactrouter.com/explanation/special-files>
11. **Knock Documentation — Delay Step & Step Conditions (`engagement_status`):** <https://docs.knock.app/designing-workflows/delay-function> & <https://docs.knock.app/designing-workflows/step-conditions>
12. **Novu Documentation — Workflow Step Conditions & Previous Step Results (`read` / `seen`):** <https://docs.novu.co/workflow/step-conditions>
