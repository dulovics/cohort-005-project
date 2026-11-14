# Third-Party Multi-Channel Notification Services for Cadence

**Ticket:** [dulovics/cohort-005-project#2](https://github.com/dulovics/cohort-005-project/issues/2)  
**Map:** [dulovics/cohort-005-project#1](https://github.com/dulovics/cohort-005-project/issues/1)  
**Target Stack:** React `^19.2.7`, React Router `8.3.0` (SSR + client), Tailwind CSS `^4.1.13`, `radix-ui` `^1.4.3`, `sonner` `^2.0.3`, Node.js / TypeScript (`^5.9.2`).

---

## Executive Summary & Comparison Matrix

| Criterion | **Knock** | **Novu** | **Courier** | **SuprSend** | **OneSignal** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Focus** | Developer-first product & transactional notifications, in-app feeds, and workflows | Open-source / cloud developer notification infrastructure & code-first workflows (`@novu/framework`) | Multi-channel notification router, visual Journeys, and drop-in/custom inbox | Multi-channel transactional & product notifications with Smart Channel Routing | Mobile/Web Push, marketing journeys, and ephemeral In-App modal/banner messages |
| **React 19 Support** | **Native** (`@knocklabs/react` `v0.6.0+` / `@knocklabs/react-core` `v0.5.0+` declare React 19 in `peerDependencies`) | **Native** (`@novu/react` explicitly supports `"react": "^18.0.0 \|\| ^19.0.0"` in `peerDependencies`) | **Partial / Workaround** (`@trycourier/courier-react` targets React 18+; web components `@trycourier/courier-ui-inbox` bypass React peer deps) | **Compatible via `>= 16.8.0`** (`@suprsend/react` & `@suprsend/react-core` declare `"react": ">= 16.8.0"`) | **Compatible** (`react-onesignal` has 0 runtime dependencies and loads Web SDK in browser `useEffect`) |
| **React Router SSR Safety** | Client context/hooks safely hydrate; feed socket connects client-side (`useKnockFeed`) | `<Inbox />` and hooks (`useNotifications`, `useCounts`) are SSR-safe; underlying `@novu/js` runs client-side | Web Components / `<CourierInbox />` require browser DOM APIs (`window`/`customElements`), requiring client-only guard in SSR | `<SuprSendProvider>` & `<SuprSendFeedProvider>` initialize browser sockets/push on mount (`useEffect`) | Browser-only singleton (`OneSignal.init` must run inside client `useEffect` and requires root service worker) |
| **In-App UI: Drop-In vs. Headless** | Both `<NotificationFeedPopover />` drop-in and headless `useKnockFeed` / `useNotifications` + Zustand store | Both `<Inbox />` drop-in (with `appearance` / Tailwind overrides) and headless `useNotifications`, `useCounts`, `usePreferences` hooks | `<CourierInbox />` / `<CourierToast />` drop-in + `useCourier()` hook exposing client state | `<Inbox />` drop-in (`@suprsend/react`) + headless `<SuprSendFeedProvider>` & `useFeedClient` / `useSuprSendClient` (`@suprsend/react-core`) | **No persistent In-App Inbox feed.** Provides only modal/banner In-App Messages (IAM); persistent feeds require custom backend + DB |
| **In-App + Web Push + Email Orchestration** | Single workflow handles `in-app` feed, `batch` (digest), `delay`, and `email`/`push` with step conditions (`read_at` is null) | Single code-first or visual workflow with `step.inApp()`, `step.digest()`, `step.delay()`, and `step.email({ skip: () => inApp.read })` | Visual Journeys with `Send (Inbox)` -> `Delay` -> `Branch (unread)` -> `Send (Email)` + cross-channel read sync | Built-in **Smart Channel Routing** (delivers In-App at `T+0` and automatically halts delayed Email/Push if read) + `Delay`/`Batch` nodes | Visual Journeys support Push, Email, and modal IAM, but cannot orchestrate an unread persistent In-App Inbox fallback without external webhooks/DB |
| **Local Dev & Workflow-as-Code** | **Knock CLI** (`knock pull` / `knock push`), JSON workflow definitions in git, isolated `development` environment | **Novu Framework** (`@novu/framework` TypeScript workflows in repo + local Dev Studio `npx novu@latest dev`), 2 environments on free tier | Dashboard-centric visual designer & Journeys; `test` vs `production` API keys | **SuprSend CLI** (`suprsend sync` for JSON/YAML workflows & templates), isolated `staging` and `production` workspaces | Dashboard-centric UI + REST API; `allowLocalhostAsSecureOrigin: true` for local Web Push testing |
| **Free Tier Limits** | **10,000 messages/mo**, unlimited environments, unlimited workflows & team seats ($0/mo, next tier $250/mo) | **10,000 workflow runs (events)/mo** on Cloud (2 environments, 20 workflows) OR **100% free self-hosted** (MIT open-source) | **10,000 sends/mo** across all channels (Developer plan $0/mo, pay-as-you-go $0.005/send after) | **10,000 notifications/mo** ($0/mo Free plan, includes SuprSend branding on Inbox; paid starts ~$99/mo) | **Unlimited Web Push** (up to 10k/batch), **10,000 emails/mo**, **1,000 MAU** for In-App modals, max 3 Journeys ($0/mo; Growth from $19/mo) |

---

## 1. React 19 & React Router (SSR / Client) Compatibility

Cadence runs on **React `^19.2.7`** and **React Router `8.3.0`** in full-stack SSR mode (`@react-router/node` + `@react-router/serve`). Notification SDKs must install cleanly under npm's strict peer-dependency resolver for React 19 and must not crash Node SSR rendering by accessing `window`, `document`, or `navigator.serviceWorker` at module evaluation time.

### Knock (`@knocklabs/react`, `@knocklabs/client`, `@knocklabs/node`)
- **React 19 Peer Dependencies:** Knock officially added native React 19 support in `@knocklabs/react-core` `v0.5.0` and `@knocklabs/react` `v0.6.0+`, declaring React 17, 18, and 19 in `peerDependencies` without needing `--legacy-peer-deps` or npm `overrides`.
  - *Primary sources:* [Knock React SDK Overview](https://docs.knock.app/in-app-ui/react/overview), [`knocklabs/javascript` GitHub Repository](https://github.com/knocklabs/javascript), [`@knocklabs/react` on npm](https://www.npmjs.com/package/@knocklabs/react).
- **SSR & React Router Compatibility:** `<KnockProvider>` and `<KnockFeedProvider>` initialize the real-time WebSocket feed client inside client lifecycle hooks. They render cleanly during SSR and establish real-time feed connections on client hydration. Server loaders/actions in React Router can trigger workflows directly via `@knocklabs/node`.

### Novu (`@novu/react`, `@novu/js`, `@novu/api`, `@novu/framework`)
- **React 19 Peer Dependencies:** `@novu/react` explicitly lists `"react": "^18.0.0 || ^19.0.0"` and `"react-dom": "^18.0.0 || ^19.0.0"` in its `peerDependencies`, installing cleanly in React 19 projects.
  - *Primary sources:* [Novu React Inbox Docs](https://docs.novu.co/platform/inbox/react/get-started), [`novuhq/novu` `packages/react` on GitHub](https://github.com/novuhq/novu/tree/next/packages/react), [`@novu/react` on npm](https://www.npmjs.com/package/@novu/react).
- **SSR & React Router Compatibility:** Novu redesigned its frontend SDK around `@novu/js` and `@novu/react` with explicit SSR compatibility for modern React frameworks (React Router / Remix / Next.js). Providers (`<NovuProvider>`) and hooks (`useNotifications`, `useCounts`) safely no-op on the server and hydrate on the client without window/document reference errors.

### Courier (`@trycourier/courier-react`, `@trycourier/courier-ui-inbox`, `@trycourier/courier`)
- **React 19 Peer Dependencies:** Courier deprecated its older `@trycourier/react-provider` / `@trycourier/react-inbox` packages in favor of `@trycourier/courier-react` (built on Courier's Web Components `@trycourier/courier-ui-inbox` and `@trycourier/courier-js`). While `@trycourier/courier-react` targets React 18+, using the underlying custom elements in `@trycourier/courier-ui-inbox` (which has zero React peer dependencies) or React 19's native Custom Elements support avoids peer-dependency friction.
  - *Primary sources:* [Courier React Inbox SDK Docs](https://www.courier.com/docs/sdk-libraries/courier-react-18), [`trycourier/courier-web` GitHub Repository](https://github.com/trycourier/courier-web), [`@trycourier/courier-react` on npm](https://www.npmjs.com/package/@trycourier/courier-react).
- **SSR & React Router Compatibility:** Because `@trycourier/courier-react` wraps Web Components (`customElements.define`), importing or rendering Inbox components during Node SSR requires either lazy client-only rendering or checking for a browser environment before mounting.

### SuprSend (`@suprsend/react`, `@suprsend/react-core`, `@suprsend/node-sdk`)
- **React 19 Peer Dependencies:** SuprSend deprecated `@suprsend/react-inbox` in favor of `@suprsend/react-core` (headless) and `@suprsend/react` (drop-in UI). Both declare `"react": ">= 16.8.0"` in `peerDependencies`, which satisfies npm's peer dependency check for React `19.2.7`.
  - *Primary sources:* [SuprSend React SDK Docs](https://docs.suprsend.com/docs/react-sdk), [`suprsend/suprsend-react-sdk` GitHub Repository](https://github.com/suprsend/suprsend-react-sdk), [`@suprsend/react-core` on npm](https://www.npmjs.com/package/@suprsend/react-core).
- **SSR & React Router Compatibility:** `<SuprSendProvider>` and `<SuprSendFeedProvider>` instantiate the browser client and socket listeners inside React effects, making headless hooks safe to include in a React Router layout route.

### OneSignal (`react-onesignal`, `@onesignal/node-onesignal`)
- **React 19 Peer Dependencies:** `react-onesignal` has zero production dependencies and injects `https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js` on the client. Its permissive peer configuration installs without issue on React 19.
  - *Primary sources:* [OneSignal React NPM Docs](https://documentation.onesignal.com/docs/react-js-setup), [`OneSignal/react-onesignal` GitHub Repository](https://github.com/OneSignal/react-onesignal).
- **SSR & React Router Compatibility:** `OneSignal.init()` must only be invoked inside a client-side `useEffect` hook. Additionally, Web Push requires serving `OneSignalSDKWorker.js` from Cadence's `public/` root directory.

---

## 2. In-App Notification UI Options (Drop-In vs. Headless for Tailwind v4 + Radix UI + Sonner)

Cadence uses a bespoke design system built on **Tailwind CSS v4**, **`radix-ui` primitives** (`Popover`, `DropdownMenu`, `Dialog`, `Tabs`), **`lucide-react` icons**, and **`sonner` toasts**.

| Provider | Pre-Built Drop-In UI | Headless Hooks & Custom UI Fit with Cadence (`radix-ui` + `sonner`) |
| :--- | :--- | :--- |
| **Knock** | `<NotificationIconButton />`, `<NotificationFeedPopover />`, `<NotificationFeed />` (`@knocklabs/react`). Ships with default CSS (`@knocklabs/react/dist/index.css`) customizable via CSS variables. | **Excellent (`useKnockFeed`, `useNotifications`, `useNotificationStore`).** Exposes a Zustand store (`items`, `metadata.unread_count`, `loading`) and `feedClient` (`markAsRead`, `markAllAsRead`, `markAsArchived`) plus real-time socket events (`items.received.realtime`) that can directly trigger a `sonner` `toast()` and populate a Radix `<Popover>`. |
| **Novu** | `<Inbox />` (`@novu/react`) with built-in bell, popover, tabs, and preferences. Supports an `appearance` prop (`variables`, `elements` classNames where Tailwind v4 utilities can be passed) and render props (`renderNotification`, `renderBell`). | **Excellent (`useNotifications`, `useCounts`, `usePreferences`, `useNovu`).** `<NovuProvider>` + `useNotifications()` / `useCounts()` give clean headless pagination, filterable unread/severity counts, and real-time WebSocket event listeners (`novu.on("notifications.notification_received", ...)` -> `sonner` toast). |
| **Courier** | `<CourierInbox />`, `<CourierInboxPopupMenu />`, `<CourierToast />`, `<CourierPreferences />` (`@trycourier/courier-react`). Styled via theme objects / Shadow DOM CSS variables. | **Moderate (`useCourier()`).** `useCourier()` provides programmatic access to `inbox` state (`feeds`, `unreadCount`, `markAsRead`, `fetchNextPageOfMessages`) and toast listeners, though Courier's primary investment is its Web Component UI. |
| **SuprSend** | `<Inbox />`, `<NotificationFeed />`, `<ToastNotification />` (`@suprsend/react`). Free tier displays a "Powered by SuprSend" badge in the pre-built component. | **Good (`@suprsend/react-core`).** `<SuprSendFeedProvider>` + `useFeedClient()` / `useFeedData()` expose notification list state, unread counter, `markAsRead`, and `new_notification` event hooks for custom Radix UI + `sonner` rendering without free-tier UI branding. |
| **OneSignal** | **None for persistent feeds.** Supports only ephemeral In-App Messages (modals, banners, carousels configured in OneSignal dashboard) and a Web Push subscription bell (`notifyButton`). | **Not supported natively.** OneSignal does not store or serve a per-user persistent notification inbox feed with `read`/`unread`/`archive` state. Building a persistent inbox with OneSignal requires storing notifications in Cadence's own SQLite/Drizzle database and building custom API endpoints and polling/SSE. |

** Primary Sources:**
- Knock Custom UI & Hooks: [Building custom notification UI in React](https://docs.knock.app/in-app-ui/react/custom-notifications-ui), [Knock React SDK Reference](https://docs.knock.app/in-app-ui/react/reference)
- Novu Headless Hooks & Appearance: [Novu React Hooks (`useNotifications`, `useCounts`)](https://docs.novu.co/platform/inbox/react/hooks), [Novu Inbox Styling & Appearance](https://docs.novu.co/platform/inbox/react/styling)
- Courier Custom Inbox & Hooks: [Courier React Hooks & Customization](https://www.courier.com/docs/sdk-libraries/courier-react-18)
- SuprSend Headless React Core: [SuprSend Headless Feed (`@suprsend/react-core`)](https://docs.suprsend.com/docs/headless-in-app-feed)
- OneSignal In-App Messages Architecture: [OneSignal In-App Messaging Overview](https://documentation.onesignal.com/docs/in-app-quickstart)

---

## 3. Multi-Channel Orchestration (In-App Feed + Web Push + Email Digest/Fallback)

A core requirement for Cadence is coordinating **In-App Feed** notifications alongside **Browser Web Push** and **Transactional Email**, specifically supporting **"unread-in-app-to-email" fallback/digest** workflows (e.g., deliver immediately to the In-App Feed, batch rapid events, wait $N$ minutes/hours, and send an Email only if the user has not read or seen the in-app notification).

### Knock
- **Workflow Primitives:** Visual or CLI-defined workflows support `In-App Feed`, `Push` (Web Push via VAPID / FCM), `Email`, `Batch` (sliding or fixed window aggregation), `Delay`, and `Branch`.
- **Unread-In-App-to-Email Fallback:** Native first-class pattern. A workflow places an **In-App Feed** step -> **Delay** step (e.g., 30m) -> **Email** step guarded by a **Step Condition** (`Message status`: previous in-app step `has not been read` / `is not seen`). Because Knock's React SDK automatically syncs `read_at` and `seen_at` back to Knock when a user interacts with the feed, Knock skips the email automatically if the user already read it in-app.
- **Batching / Digests:** A **Batch** step before the In-App or Email step groups multiple triggers by a batch key (or per recipient) into an `activities` array so templates can render *"3 new replies in Cohort 005"*.
- *Primary sources:* [Knock Delay Function](https://docs.knock.app/designing-workflows/delay-function), [Knock Batch Function](https://docs.knock.app/designing-workflows/batch-function), [Knock Step Conditions (Message Status)](https://docs.knock.app/designing-workflows/step-conditions).

### Novu
- **Workflow Primitives:** Both code-first TypeScript workflows (`@novu/framework`) and Dashboard workflows support `inApp`, `push`, `email`, `digest`, and `delay` steps.
- **Unread-In-App-to-Email Fallback:** In `@novu/framework`, `await step.inApp(...)` returns a result object containing live `{ seen, read, lastSeenDate, lastReadDate }` properties evaluated after a subsequent `await step.delay(...)` finishes. The downstream `step.email(...)` simply uses `{ skip: () => inAppResult.read }`:
  ```ts
  const inApp = await step.inApp("inbox-alert", async () => ({ body: "..." }));
  await step.delay("wait-before-email", async () => ({ amount: 30, unit: "minutes" }));
  await step.email("fallback-email", async () => ({ subject: "...", body: "..." }), {
    skip: () => inApp.read,
  });
  ```
- **Batching / Digests:** `await step.digest("digest-step", async () => ({ amount: 1, unit: "hours" }))` collects all triggers during the window and exposes `events` to downstream steps.
- *Primary sources:* [Novu Framework In-App Step & Previous Step Conditions](https://docs.novu.co/framework/steps/in-app), [Novu Digest Step](https://docs.novu.co/framework/steps/digest), [Novu Delay Step](https://docs.novu.co/framework/steps/delay).

### Courier
- **Workflow Primitives:** Courier Automations / Journeys provide `Send`, `Delay`, `Batch`/`Digest`, and `Branch` nodes across Inbox, Email, and Web Push.
- **Unread-In-App-to-Email Fallback & Cross-Channel Sync:** Supports sending to Courier Inbox, waiting on a `Delay` node, and branching on whether the Inbox message was read before sending an Email. Courier also supports bidirectional read-state synchronization (opening an email can mark the linked In-App inbox item as read).
- *Primary sources:* [Courier Automations & Digest Docs](https://www.courier.com/docs/platform/automations/digest), [Courier Journeys Docs](https://www.courier.com/docs/platform/journeys).

### SuprSend
- **Workflow Primitives:** Workflows include `Batch`, `Delay`, `Wait Until`, `Branch`, and a dedicated **Smart Channel Routing** node.
- **Unread-In-App-to-Email Fallback:** SuprSend's **Smart Channel Routing** is purpose-built for this exact pattern: you configure an ordered channel list (e.g., `In-App Inbox` + `Web Push` -> wait `15m` -> `Email`) and a halt condition (`Seen` or `Interacted`). As soon as the user views or clicks the In-App or Web Push notification, SuprSend halts downstream Email delivery.
- *Primary sources:* [SuprSend Smart Channel Routing](https://docs.suprsend.com/docs/smart-channel-routing), [SuprSend Batch / Digest Node](https://docs.suprsend.com/docs/batch), [SuprSend Delay Node](https://docs.suprsend.com/docs/delay).

### OneSignal
- **Workflow Primitives:** Visual **Journeys** orchestrate Web Push, Mobile Push, Email, and SMS with Wait/Delay and Yes/No Engagement branches (e.g., "Send Email if Web Push was not clicked within 2 hours").
- **Limitation for Cadence:** Because OneSignal lacks a persistent In-App Inbox channel, it **cannot** natively orchestrate an "In-App Feed -> Delay -> Email if unread in feed" workflow. It can only branch on Web Push / Email engagement or display ephemeral modals while a user happens to be online.
- *Primary sources:* [OneSignal Journeys Documentation](https://documentation.onesignal.com/docs/journeys).

---

## 4. Developer Experience, Environment Isolation & Free/Sandbox Tier

### Knock
- **Developer Experience:** Best-in-class CLI (`@knocklabs/cli`) and management API. Workflows, email layouts, and translations can be pulled to local JSON/Liquid files, committed to git, and pushed in CI. Every account includes isolated `development` and `production` environments out of the box.
- **Free Tier (`Developer` Plan):**
  - **$0/month**, no credit card required.
  - **10,000 messages sent/month** (failed/bounced deliveries don't count).
  - Unlimited environments, unlimited workflows, unlimited team members, unlimited stored user profiles.
  - *Caveat:* First paid tier (`Starter`) jumps to **$250/month** (for 50,000 messages/month).
- *Primary sources:* [Knock Pricing](https://knock.app/pricing), [Knock CLI Overview](https://docs.knock.app/cli/overview).

### Novu
- **Developer Experience:** Offers `@novu/framework` where notification workflows are written in **TypeScript inside your application repository** (validated with Zod schemas and previewed locally via `npx novu@latest dev` Studio UI), plus UI-defined workflows in the Novu dashboard. Also 100% open-source (MIT core) if self-hosting via Docker is ever desired.
- **Free Tier (`Free` Cloud Plan):**
  - **$0/month**, no credit card required.
  - **10,000 workflow runs (events)/month** (note: a single workflow run that delivers both an In-App item and an Email counts as **1 event**, making 10k workflow runs very generous).
  - 2 environments (`Development` and `Production`), up to 20 workflows, 3 team members.
  - Paid `Pro` tier starts at **$30/month** (for 30,000 events/month) — a much smoother price ramp than Knock.
- *Primary sources:* [Novu Pricing](https://novu.co/pricing), [Novu Framework Docs](https://docs.novu.co/framework/overview).

### Courier
- **Developer Experience:** Strong visual template and Journey designer with `test` vs. `production` environment toggle and JWT-based client authentication. Less git/code-first than Novu Framework or Knock CLI.
- **Free Tier (`Developer` Plan):**
  - **$0/month**, **10,000 messages/month** across all channels (In-App, Email, Push, SMS).
  - Includes Inbox, Journeys, and Preferences.
  - Pay-as-you-go `Business` plan scales at **$0.005 per message** above the free tier without a high base platform fee.
- *Primary sources:* [Courier Pricing](https://www.courier.com/pricing).

### SuprSend
- **Developer Experience:** Provides a `suprsend` CLI to sync workflows and templates as JSON/YAML, plus isolated `staging` and `production` workspaces. Good documentation and clean separation between `@suprsend/react-core` and `@suprsend/react`.
- **Free Tier (`Free` Plan):**
  - **$0/month**, **10,000 notifications/month**, 2 workspaces (`staging` + `production`).
  - *Caveat:* Pre-built Inbox UI includes SuprSend branding on the free tier, and paid plans start around **$99/month**.
- *Primary sources:* [SuprSend Pricing](https://www.suprsend.com/pricing), [SuprSend CLI Docs](https://docs.suprsend.com/docs/cli-overview).

### OneSignal
- **Developer Experience:** Fast setup for browser Web Push (`allowLocalhostAsSecureOrigin: true`), but poor fit for an application notification center because there is no persistent In-App Inbox API or SDK.
- **Free Tier (`Free` Plan):**
  - **$0/month**, unlimited Web Push subscribers (up to 10,000 per send), 10,000 emails/month, 1,000 MAU for In-App modal messages, capped at 3 Journeys.
  - Paid `Growth` plan starts at **$19/month** + usage.
- *Primary sources:* [OneSignal Pricing](https://onesignal.com/pricing).

---

## 5. Synthesis & Recommendation for Cadence

1. **Top Pick — Novu (`@novu/react` + `@novu/framework` / `@novu/api`):**
   - **Why it fits Cadence best:** Explicit `"react": "^18.0.0 || ^19.0.0"` peer dependency support and SSR-safe hooks; headless `useNotifications` and `useCounts` hooks pair cleanly with Cadence's Tailwind v4 + `radix-ui` (`Popover` / `Tabs`) + `sonner` toast stack (while also offering a drop-in `<Inbox />` customizable with Tailwind classes); code-first TypeScript workflows (`@novu/framework`) with Zod validation fit directly into Cadence's TypeScript + Zod repo and support `step.inApp()` -> `step.delay()` -> `step.email({ skip: () => inApp.read })` and `step.digest()`; and its free tier counts **10,000 workflow runs/month** (with a $30/mo Pro ramp and MIT self-host option).
2. **Strong Runner-Up — Knock (`@knocklabs/react` + `@knocklabs/node`):**
   - **Why it's close:** Native React 19 support, polished headless Zustand-backed hooks (`useKnockFeed`), first-class CLI workflow-as-code, and clean step conditions for unread-in-app-to-email fallbacks. Main drawback compared to Novu is the steep pricing cliff after the 10k message free tier ($250/mo Starter vs. Novu's $30/mo Pro) and workflow logic living in Knock's DSL rather than TypeScript.
3. **Viable Alternative — SuprSend (`@suprsend/react-core`):**
   - Smart Channel Routing makes unread-in-app-to-email fallbacks trivial, and `@suprsend/react-core` provides a clean headless feed hook layer, though its ecosystem and TypeScript DX are smaller than Novu and Knock.
4. **Not Recommended for Cadence — Courier & OneSignal:**
   - **Courier's** React SDK wraps Web Components targeting React 18+ (requiring SSR workarounds and less ergonomic headless state than Knock/Novu).
   - **OneSignal** does not provide a persistent In-App Notification Inbox/Feed at all (only ephemeral modal/banner In-App Messages), which would force Cadence to build and maintain its own inbox storage, read-state sync, and digest/fallback orchestration from scratch.
