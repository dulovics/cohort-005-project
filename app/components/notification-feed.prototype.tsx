// PROTOTYPE (throwaway): Three Option-A variants of the in-app Notification Feed UI powered by @knocklabs/react (<KnockProvider>, <KnockFeedProvider>, <NotificationIconButton>, <NotificationFeedPopover>, <NotificationCell>), switchable via ?variant=A|B|C in app/routes/layout.app.tsx.

import { useState, useEffect, useRef } from "react";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationIconButton,
  NotificationFeedPopover,
  NotificationCell,
  Avatar,
  useKnockFeed,
  FilterStatus,
  type ColorMode,
} from "@knocklabs/react";
import { NetworkStatus, type FeedItem, type ActionButton } from "@knocklabs/client";
import "@knocklabs/react/dist/index.css";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";
import { Sidebar } from "~/components/sidebar";
import {
  MessageSquare,
  Receipt,
  ShoppingBag,
  Trophy,
  UsersRound,
  ShieldAlert,
  BarChart3,
  Star,
  ExternalLink,
  Circle,
  Reply,
  Send,
  CheckCircle2,
} from "lucide-react";

export type PrototypeRoleKey =
  | "student"
  | "team_admin"
  | "instructor"
  | "admin";

export type NotificationCategory =
  | "purchase"
  | "seat_claimed"
  | "refund"
  | "comment"
  | "completion"
  | "governance"
  | "digest_weekly"
  | "digest_rating";

export interface DigestMetrics {
  periodLabel: string;
  stats: { label: string; value: string; delta?: string }[];
  courseBreakdown?: {
    courseTitle: string;
    summary: string;
  }[];
}

export interface PrototypeNotification {
  id: string;
  role: PrototypeRoleKey;
  category: NotificationCategory;
  eventLabel: string;
  actorName: string;
  actorSeed?: string;
  title: string;
  courseTitle?: string;
  body: string;
  commentId?: number;
  repliedText?: string;
  quoteOrNote?: {
    label: string;
    text: string;
    tone?: "neutral" | "amber" | "green";
  };
  digestMetrics?: DigestMetrics;
  href: string;
  ctaLabel: string;
  createdAtLabel: string;
  minutesAgo: number;
  unread: boolean;
  deliveryBadge:
    | "Feed + Immediate Email"
    | "Feed + Unread Email"
    | "Feed Only"
    | "Scheduled Digest";
}

export const ROLE_LABELS: Record<PrototypeRoleKey, string> = {
  student: "Student",
  team_admin: "Team Admin",
  instructor: "Instructor",
  admin: "Platform Admin",
};

export const INITIAL_NOTIFICATIONS: Record<
  PrototypeRoleKey,
  PrototypeNotification[]
> = {
  student: [
    {
      id: "stu-1",
      role: "student",
      category: "comment",
      eventLabel: "Reply posted to lesson comment",
      actorName: "Sarah Chen",
      actorSeed: "sarah",
      title: "Sarah Chen replied to your comment on Your First TypeScript Program",
      courseTitle: "Introduction to TypeScript",
      body: "Instructor Sarah Chen answered your question on running the TypeScript compiler step.",
      commentId: 1,
      quoteOrNote: {
        label: "Reply on Lesson 3 · Your First TypeScript Program",
        text: "That usually means TypeScript is installed locally but not on your PATH. Try `npx tsc` instead — that runs the copy in `node_modules/.bin`.",
        tone: "neutral",
      },
      href: "/courses/introduction-to-typescript/lessons/3?replyTo=1#comment-1",
      ctaLabel: "View reply in lesson",
      createdAtLabel: "4m ago",
      minutesAgo: 4,
      unread: true,
      deliveryBadge: "Feed + Unread Email",
    },
    {
      id: "stu-2",
      role: "student",
      category: "refund",
      eventLabel: "Refund Request approved",
      actorName: "Alex Rivera",
      actorSeed: "alex",
      title: "Your Refund Request for Design Systems with Tailwind was approved",
      courseTitle: "Design Systems with Tailwind",
      body: "$129.00, the full amount you paid, is on its way back to you. Your Enrollment on this course has ended.",
      quoteOrNote: {
        label: "Platform Admin note",
        text: "Approved! We've issued your full refund back to your original payment method.",
        tone: "green",
      },
      href: "/settings",
      ctaLabel: "View Refund Request in Settings",
      createdAtLabel: "28m ago",
      minutesAgo: 28,
      unread: true,
      deliveryBadge: "Feed + Immediate Email",
    },
    {
      id: "stu-3",
      role: "student",
      category: "refund",
      eventLabel: "Refund Request declined",
      actorName: "Alex Rivera",
      actorSeed: "alex",
      title:
        "Your Refund Request for Building REST APIs with Node.js was declined",
      courseTitle: "Building REST APIs with Node.js",
      body: "You still have your Enrollment on this course. Review the Platform Admin's note below.",
      quoteOrNote: {
        label: "Why it was declined (required note)",
        text: "You have watched 48 minutes of video across 4 lessons, which is past the 30-minute Watch Limit for a refund.",
        tone: "amber",
      },
      href: "/settings",
      ctaLabel: "Read decision in Settings",
      createdAtLabel: "2h ago",
      minutesAgo: 120,
      unread: true,
      deliveryBadge: "Feed + Immediate Email",
    },
    {
      id: "stu-4",
      role: "student",
      category: "completion",
      eventLabel: "Course completed",
      actorName: "Cadence",
      title: "Congratulations! You completed Introduction to TypeScript",
      courseTitle: "Introduction to TypeScript",
      body: "You finished 100% of lessons across all modules in Introduction to TypeScript.",
      href: "/courses/introduction-to-typescript",
      ctaLabel: "View completed course",
      createdAtLabel: "1d ago",
      minutesAgo: 1440,
      unread: false,
      deliveryBadge: "Feed Only",
    },
    {
      id: "stu-5",
      role: "student",
      category: "seat_claimed",
      eventLabel: "Seat claimed",
      actorName: "Bossy McBossface",
      actorSeed: "bossy",
      title: "Seat claimed on Practical Data Visualisation",
      courseTitle: "Practical Data Visualisation",
      body: "You claimed a Seat from your team's Team Licence and now have an active Enrollment.",
      href: "/courses/practical-data-visualisation/welcome",
      ctaLabel: "Start learning",
      createdAtLabel: "3d ago",
      minutesAgo: 4320,
      unread: false,
      deliveryBadge: "Feed Only",
    },
    {
      id: "stu-6",
      role: "student",
      category: "purchase",
      eventLabel: "Individual Purchase completed",
      actorName: "Cadence",
      title: "Enrollment confirmed: Introduction to TypeScript ($99.00)",
      courseTitle: "Introduction to TypeScript",
      body: "Your Individual Purchase is complete and your Enrollment is ready.",
      href: "/courses/introduction-to-typescript/welcome",
      ctaLabel: "Open course welcome",
      createdAtLabel: "5d ago",
      minutesAgo: 7200,
      unread: false,
      deliveryBadge: "Feed + Immediate Email",
    },
  ],
  team_admin: [
    {
      id: "team-1",
      role: "team_admin",
      category: "seat_claimed",
      eventLabel: "Seat claimed",
      actorName: "Emma Wilson",
      actorSeed: "emma",
      title: "Emma Wilson claimed a Seat on Introduction to TypeScript",
      courseTitle: "Introduction to TypeScript",
      body: "3 of 5 Seats on your Team Licence are now Claimed Seats (2 Unclaimed Seats remaining).",
      href: "/team",
      ctaLabel: "Manage Team Licence",
      createdAtLabel: "12m ago",
      minutesAgo: 12,
      unread: true,
      deliveryBadge: "Feed + Unread Email",
    },
    {
      id: "team-2",
      role: "team_admin",
      category: "completion",
      eventLabel: "Course completed",
      actorName: "James Park",
      actorSeed: "james",
      title: "James Park completed 100% of Introduction to TypeScript",
      courseTitle: "Introduction to TypeScript",
      body: "Enrolled via a Claimed Seat on your Team Licence · finished all lessons today.",
      href: "/team",
      ctaLabel: "View Team seats",
      createdAtLabel: "1h ago",
      minutesAgo: 60,
      unread: true,
      deliveryBadge: "Feed Only",
    },
    {
      id: "team-3",
      role: "team_admin",
      category: "refund",
      eventLabel: "Refund Request declined",
      actorName: "Alex Rivera",
      actorSeed: "alex",
      title:
        "Refund Request declined for Introduction to TypeScript Team Licence",
      courseTitle: "Introduction to TypeScript",
      body: "Your Team Licence ($495.00 for 5 Seats) remains active and Unclaimed Seats can be claimed again.",
      quoteOrNote: {
        label: "Why it was declined (required note)",
        text: "A Seat on this Team Licence has already been claimed by Emma Wilson, so this Team Licence cannot be refunded.",
        tone: "amber",
      },
      href: "/team",
      ctaLabel: "View Team Licence status",
      createdAtLabel: "4h ago",
      minutesAgo: 240,
      unread: true,
      deliveryBadge: "Feed + Immediate Email",
    },
    {
      id: "team-4",
      role: "team_admin",
      category: "purchase",
      eventLabel: "Team Licence bought",
      actorName: "Cadence",
      title:
        "Team Licence ready: 5 Seats for Building REST APIs with Node.js ($495.00)",
      courseTitle: "Building REST APIs with Node.js",
      body: "Share your Unclaimed Seat links with students from the Team page.",
      href: "/team",
      ctaLabel: "Copy Seat links",
      createdAtLabel: "2d ago",
      minutesAgo: 2880,
      unread: false,
      deliveryBadge: "Feed + Immediate Email",
    },
  ],
  instructor: [
    {
      id: "inst-1",
      role: "instructor",
      category: "comment",
      eventLabel: "Top-level lesson comment posted",
      actorName: "James Park",
      actorSeed: "james",
      title: "James Park asked a question on Primitive Types",
      courseTitle: "Introduction to TypeScript",
      body: "New top-level question on Module 1 · Lesson 4: Primitive Types.",
      commentId: 6,
      quoteOrNote: {
        label: "Student question",
        text: "Does strict mode change anything about how this example behaves?",
        tone: "neutral",
      },
      href: "/courses/introduction-to-typescript/lessons/4?replyTo=6#comment-6",
      ctaLabel: "Reply to student",
      createdAtLabel: "6m ago",
      minutesAgo: 6,
      unread: true,
      deliveryBadge: "Feed + Unread Email",
    },
    {
      id: "inst-2",
      role: "instructor",
      category: "digest_weekly",
      eventLabel: "Weekly Performance Digest",
      actorName: "Cadence Digest",
      title: "Weekly Performance Digest · Nov 8 – Nov 15",
      body: "Summary of Individual Purchases, Team Licences, Claimed Seats, Approved Refund Requests, Course Completions, and new Course Ratings across your 2 published courses.",
      digestMetrics: {
        periodLabel: "Past 7 days · 2 published courses",
        stats: [
          { label: "Net Revenue", value: "$1,680", delta: "+18% vs last wk" },
          {
            label: "Purchases",
            value: "14 indiv · 2 team",
            delta: "6 Seats claimed",
          },
          {
            label: "Completions",
            value: "9 students",
            delta: "1 Approved Refund",
          },
          { label: "New Ratings", value: "4.9★ (6 new)", delta: "4.8★ all-time" },
        ],
        courseBreakdown: [
          {
            courseTitle: "Introduction to TypeScript",
            summary:
              "$1,185 net · 10 Individual Purchases · 1 Team Licence (4/5 Claimed Seats) · 6 Completions · 4.9★ (4 new)",
          },
          {
            courseTitle: "Design Systems with Tailwind",
            summary:
              "$495 net · 4 Individual Purchases · 1 Approved Refund Request (-$129) · 3 Completions · 5.0★ (2 new)",
          },
        ],
      },
      href: "/instructor/analytics",
      ctaLabel: "Open Instructor Analytics",
      createdAtLabel: "1h ago",
      minutesAgo: 60,
      unread: true,
      deliveryBadge: "Scheduled Digest",
    },
    {
      id: "inst-3",
      role: "instructor",
      category: "comment",
      eventLabel: "Top-level lesson comment posted",
      actorName: "Sophia Davis",
      actorSeed: "sophia",
      title: "Sophia Davis asked a question on Arrays and Tuples",
      courseTitle: "Introduction to TypeScript",
      body: "Unanswered student question on Module 1 · Lesson 5: Arrays and Tuples.",
      commentId: 5,
      quoteOrNote: {
        label: "Question on Lesson 5 · Arrays and Tuples",
        text: "Is there a reason to prefer `interface` over `type` here, or is it purely style?",
        tone: "neutral",
      },
      href: "/courses/introduction-to-typescript/lessons/5?replyTo=5#comment-5",
      ctaLabel: "Reply to student",
      createdAtLabel: "3h ago",
      minutesAgo: 180,
      unread: false,
      deliveryBadge: "Feed + Unread Email",
    },
    {
      id: "inst-4",
      role: "instructor",
      category: "digest_rating",
      eventLabel: "Monthly Rating Digest",
      actorName: "Cadence Digest",
      title: "Monthly Rating Digest · October 2026 (4.9★ avg)",
      body: "Subscribed Monthly Rating Digest comparing this month's new Course Ratings against your all-time score.",
      digestMetrics: {
        periodLabel: "October 2026 · Subscribed Monthly Digest",
        stats: [
          { label: "Period Avg", value: "4.9★", delta: "+0.1★ vs all-time" },
          { label: "New Ratings", value: "18 ratings", delta: "15 five-star" },
          { label: "All-Time Avg", value: "4.8★", delta: "142 total ratings" },
        ],
      },
      href: "/instructor/analytics",
      ctaLabel: "View course ratings",
      createdAtLabel: "2d ago",
      minutesAgo: 2880,
      unread: false,
      deliveryBadge: "Scheduled Digest",
    },
    {
      id: "inst-5",
      role: "instructor",
      category: "governance",
      eventLabel: "Course status changed by Platform Admin",
      actorName: "Alex Rivera",
      actorSeed: "alex",
      title: "Alex Rivera published your course Design Systems with Tailwind",
      courseTitle: "Design Systems with Tailwind",
      body: "A Platform Admin changed the status of Design Systems with Tailwind from Draft to Published.",
      href: "/instructor",
      ctaLabel: "View My Courses",
      createdAtLabel: "4d ago",
      minutesAgo: 5760,
      unread: false,
      deliveryBadge: "Feed + Immediate Email",
    },
  ],
  admin: [
    {
      id: "adm-1",
      role: "admin",
      category: "refund",
      eventLabel: "Refund Request raised (Open)",
      actorName: "Emma Wilson",
      actorSeed: "emma",
      title: "New Open Refund Request · Emma Wilson ($99.00)",
      courseTitle: "Introduction to TypeScript",
      body: "Individual Purchase · raised within 14-day window · 12m Watched · 1/12 lessons completed (eligible to approve).",
      quoteOrNote: {
        label: "Buyer's reason",
        text: "I already know the fundamentals covered here and meant to buy the advanced Node.js API course instead.",
        tone: "neutral",
      },
      href: "/admin/refunds",
      ctaLabel: "Review at /admin/refunds",
      createdAtLabel: "2m ago",
      minutesAgo: 2,
      unread: true,
      deliveryBadge: "Feed + Unread Email",
    },
    {
      id: "adm-2",
      role: "admin",
      category: "refund",
      eventLabel: "Refund Request raised (Open)",
      actorName: "Bossy McBossface",
      actorSeed: "bossy",
      title:
        "New Open Refund Request · Bossy McBossface ($495.00 Team Licence)",
      courseTitle: "Building REST APIs with Node.js",
      body: "Team Licence (5 Seats) · Rule break flagged: 1 Claimed Seat (can only be declined).",
      quoteOrNote: {
        label: "Buyer's reason",
        text: "Our team reorganised this quarter and we won't be running the Node cohort after all.",
        tone: "amber",
      },
      href: "/admin/refunds",
      ctaLabel: "Decide at /admin/refunds",
      createdAtLabel: "35m ago",
      minutesAgo: 35,
      unread: true,
      deliveryBadge: "Feed + Unread Email",
    },
    {
      id: "adm-3",
      role: "admin",
      category: "governance",
      eventLabel: "User role changed by Platform Admin",
      actorName: "Alex Rivera",
      actorSeed: "alex",
      title: "Role updated: Priya Nair is now an Instructor",
      body: "Platform Admin audit notification for account role transition.",
      href: "/admin/users",
      ctaLabel: "Open Manage Users",
      createdAtLabel: "3d ago",
      minutesAgo: 4320,
      unread: false,
      deliveryBadge: "Feed + Immediate Email",
    },
  ],
};

const SIMULATED_INCOMING: Record<
  PrototypeRoleKey,
  Omit<PrototypeNotification, "id" | "createdAtLabel" | "minutesAgo" | "unread">
> = {
  student: {
    role: "student",
    category: "comment",
    eventLabel: "Reply posted to lesson comment",
    actorName: "Sarah Chen",
    actorSeed: "sarah",
    title:
      "Sarah Chen replied to your comment on What is TypeScript?",
    courseTitle: "Introduction to TypeScript",
    body: "New reply in your lesson thread while you are browsing Cadence.",
    commentId: 8,
    quoteOrNote: {
      label: "Live reply on Lesson 1",
      text: "Most of it. If you've written JSDoc types you already understand the mental model.",
      tone: "neutral",
    },
    href: "/courses/introduction-to-typescript/lessons/1?replyTo=8#comment-8",
    ctaLabel: "Jump to lesson reply",
    deliveryBadge: "Feed + Unread Email",
  },
  team_admin: {
    role: "team_admin",
    category: "seat_claimed",
    eventLabel: "Seat claimed",
    actorName: "Olivia Martinez",
    actorSeed: "olivia",
    title: "Olivia Martinez claimed a Seat on Introduction to TypeScript",
    courseTitle: "Introduction to TypeScript",
    body: "4 of 5 Seats on your Team Licence are now Claimed Seats (1 Unclaimed Seat left).",
    href: "/team",
    ctaLabel: "Open Team Licence",
    deliveryBadge: "Feed + Unread Email",
  },
  instructor: {
    role: "instructor",
    category: "comment",
    eventLabel: "Top-level lesson comment posted",
    actorName: "Olivia Martinez",
    actorSeed: "olivia",
    title:
      "Olivia Martinez asked a question on Function Types",
    courseTitle: "Introduction to TypeScript",
    body: "New student question waiting for your answer in Module 2 · Lesson 8.",
    commentId: 4,
    quoteOrNote: {
      label: "Student question",
      text: "Why does this fail to infer? I expected `T` to come out as `string`.",
      tone: "neutral",
    },
    href: "/courses/introduction-to-typescript/lessons/8?replyTo=4#comment-4",
    ctaLabel: "Reply to student",
    deliveryBadge: "Feed + Unread Email",
  },
  admin: {
    role: "admin",
    category: "refund",
    eventLabel: "Refund Request raised (Open)",
    actorName: "Sophia Davis",
    actorSeed: "sophia",
    title: "New Open Refund Request · Sophia Davis ($129.00)",
    courseTitle: "Design Systems with Tailwind",
    body: "Individual Purchase · raised 2 days after purchase · 5m Watched (eligible to approve).",
    quoteOrNote: {
      label: "Buyer's reason",
      text: "My employer just gave me a Seat on our company Team Licence for this same course.",
      tone: "neutral",
    },
    href: "/admin/refunds",
    ctaLabel: "Review Refund Request",
    deliveryBadge: "Feed + Unread Email",
  },
};

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case "comment":
      return <MessageSquare className="size-3.5 text-sky-500" />;
    case "refund":
      return <Receipt className="size-3.5 text-amber-500" />;
    case "purchase":
      return <ShoppingBag className="size-3.5 text-emerald-500" />;
    case "seat_claimed":
      return <UsersRound className="size-3.5 text-indigo-500" />;
    case "completion":
      return <Trophy className="size-3.5 text-yellow-500" />;
    case "digest_weekly":
      return <BarChart3 className="size-3.5 text-violet-500" />;
    case "digest_rating":
      return <Star className="size-3.5 text-amber-400" />;
    case "governance":
      return <ShieldAlert className="size-3.5 text-rose-500" />;
  }
}

function getCategoryBadgeStyle(category: NotificationCategory) {
  switch (category) {
    case "comment":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20";
    case "refund":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20";
    case "purchase":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "seat_claimed":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20";
    case "completion":
      return "bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border-yellow-500/20";
    case "digest_weekly":
    case "digest_rating":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20";
    case "governance":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
  }
}

export function deriveDefaultRoleKey(
  userRole: UserRole | null | undefined,
  isTeamAdmin: boolean
): PrototypeRoleKey {
  if (userRole === UserRole.Admin) return "admin";
  if (userRole === UserRole.Instructor) return "instructor";
  if (isTeamAdmin) return "team_admin";
  return "student";
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Converts our prototype Notification into a real `@knocklabs/client` FeedItem
 * so `<NotificationFeedPopover />` and `<NotificationCell />` render it natively.
 */
export function toKnockFeedItem(
  item: PrototypeNotification,
  includeActionButtons: boolean
): FeedItem<PrototypeNotification> {
  const insertedIso = new Date(
    Date.now() - item.minutesAgo * 60_000
  ).toISOString();

  const quoteBlockHtml = item.quoteOrNote
    ? `<blockquote style="margin:6px 0 0;padding-left:8px;border-left:2px solid #cbd5e1;color:#64748b;font-size:12px;">${escapeHtml(
        item.quoteOrNote.text
      )}</blockquote>`
    : "";

  const digestBlockHtml = item.digestMetrics
    ? `<p style="margin:6px 0 0;font-size:12px;color:#475569;">${escapeHtml(
        item.digestMetrics.stats
          .map((s) => `${s.label}: ${s.value}`)
          .join(" · ")
      )}</p>`
    : "";

  const renderedHtml = `<p><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(
    item.body
  )}</p>${quoteBlockHtml}${digestBlockHtml}`;

  return {
    __cursor: item.id,
    id: item.id,
    actors: [
      {
        id: item.actorSeed ?? "cadence",
        name: item.actorName,
        avatar: item.actorSeed
          ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${item.actorSeed}`
          : null,
      } as unknown as FeedItem["actors"][number],
    ],
    blocks: [
      {
        name: "body",
        type: "markdown",
        content: `${item.title} — ${item.body}`,
        rendered: renderedHtml,
      },
      {
        name: "action_url",
        type: "text",
        content: item.href,
        rendered: item.href,
      },
      ...(includeActionButtons
        ? [
            {
              name: "actions",
              type: "button_set" as const,
              buttons: [
                {
                  name: "primary",
                  label: item.ctaLabel,
                  action: item.href,
                },
              ],
            },
          ]
        : []),
    ],
    inserted_at: insertedIso,
    updated_at: insertedIso,
    read_at: item.unread ? null : insertedIso,
    seen_at: item.unread ? null : insertedIso,
    clicked_at: null,
    interacted_at: null,
    link_clicked_at: null,
    archived_at: null,
    total_activities: 1,
    total_actors: 1,
    data: item,
    source: {
      key: item.category,
      version_id: "prototype-v1",
      categories: [item.category],
    },
    tenant: null,
  };
}

/**
 * Synchronizes the in-memory PrototypeNotification list into Knock's live
 * `feedClient.store` (`useKnockFeed()`) so `@knocklabs/react`'s
 * `<NotificationIconButton />`, `<UnseenBadge />`, `<NotificationFeedPopover />`,
 * `<NotificationFeedHeader />`, and `<NotificationCell />` work seamlessly!
 */
function KnockStoreBridge({
  notifications,
  includeActionButtons,
  onMarkAllRead,
  onArchive,
  onToggleRead,
}: {
  notifications: PrototypeNotification[];
  includeActionButtons: boolean;
  onMarkAllRead: () => void;
  onArchive: (id: string) => void;
  onToggleRead: (id: string) => void;
}) {
  const { feedClient } = useKnockFeed();
  const filterStatusRef = useRef<string>(FilterStatus.All);
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  function syncStore(statusFilter: string) {
    const allItems = notificationsRef.current.map((n) =>
      toKnockFeedItem(n, includeActionButtons)
    );
    const unreadCount = notificationsRef.current.filter((n) => n.unread).length;
    const filteredEntries =
      statusFilter === FilterStatus.Unread
        ? allItems.filter((item) => !item.read_at)
        : allItems;

    const state = feedClient.store.getState();
    state.setNetworkStatus(NetworkStatus.ready);
    state.setResult({
      entries: filteredEntries,
      meta: {
        total_count: allItems.length,
        unread_count: unreadCount,
        unseen_count: unreadCount,
      },
      page_info: {
        before: null,
        after: null,
        page_size: 50,
      },
    });
  }

  useEffect(() => {
    const origFetch = feedClient.fetch.bind(feedClient);
    const origMarkAllAsRead = feedClient.markAllAsRead.bind(feedClient);
    const origMarkAllAsSeen = feedClient.markAllAsSeen.bind(feedClient);
    const origMarkAsArchived = feedClient.markAsArchived.bind(feedClient);
    const origMarkAsInteracted = feedClient.markAsInteracted.bind(feedClient);

    feedClient.fetch = async (options?: { status?: string }) => {
      if (options?.status) {
        filterStatusRef.current = options.status;
      }
      syncStore(filterStatusRef.current);
      return { status: "ok", data: feedClient.store.getState() } as never;
    };

    feedClient.markAllAsRead = async () => {
      onMarkAllRead();
      return undefined as never;
    };

    feedClient.markAllAsSeen = async () => {
      return undefined as never;
    };

    feedClient.markAsArchived = async (itemOrItems) => {
      const list = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      for (const item of list) {
        onArchive(item.id);
      }
      return undefined as never;
    };

    feedClient.markAsInteracted = async (itemOrItems) => {
      const list = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      for (const item of list) {
        if (!item.read_at) {
          onToggleRead(item.id);
        }
      }
      return undefined as never;
    };

    syncStore(filterStatusRef.current);

    return () => {
      feedClient.fetch = origFetch;
      feedClient.markAllAsRead = origMarkAllAsRead;
      feedClient.markAllAsSeen = origMarkAllAsSeen;
      feedClient.markAsArchived = origMarkAsArchived;
      feedClient.markAsInteracted = origMarkAsInteracted;
    };
  }, [feedClient, includeActionButtons]);

  useEffect(() => {
    syncStore(filterStatusRef.current);
  }, [notifications, includeActionButtons]);

  return null;
}

export interface SharedVariantProps {
  knockPublicApiKey: string;
  knockFeedChannelId: string;
  currentUser: {
    id: number;
    name: string;
    role: UserRole;
    avatarUrl: string | null;
  } | null;
  recentCourses: {
    courseId: number;
    title: string;
    slug: string;
    coverImageUrl: string | null;
    completedLessons: number;
    totalLessons: number;
    progress: number;
  }[];
  isTeamAdmin: boolean;
  roleKey: PrototypeRoleKey;
  notifications: PrototypeNotification[];
  feedOpen: boolean;
  setFeedOpen: (open: boolean) => void;
  onToggleRead: (id: string) => void;
  onMarkAllRead: () => void;
  onArchive: (id: string) => void;
  onOpenNotification: (n: PrototypeNotification) => void;
  onReplyToStudent: (
    n: PrototypeNotification,
    replyText: string
  ) => Promise<void>;
  children: React.ReactNode;
}

function useDocumentColorMode(): ColorMode {
  const [colorMode, setColorMode] = useState<ColorMode>("light");

  useEffect(() => {
    const check = () => {
      setColorMode(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colorMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A: Stock `@knocklabs/react` (<NotificationIconButton /> + <NotificationFeedPopover /> + default <NotificationCell />)
// ─────────────────────────────────────────────────────────────────────────────
export function VariantA(props: SharedVariantProps) {
  const {
    knockPublicApiKey,
    knockFeedChannelId,
    currentUser,
    recentCourses,
    isTeamAdmin,
    roleKey,
    notifications,
    feedOpen,
    setFeedOpen,
    onToggleRead,
    onMarkAllRead,
    onArchive,
    onOpenNotification,
    children,
  } = props;

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const colorMode = useDocumentColorMode();

  function handleItemClick(item: FeedItem) {
    const domainItem = item.data as PrototypeNotification | null;
    if (domainItem) {
      onOpenNotification(domainItem);
    }
  }

  function handleButtonClick(item: FeedItem, _action: ActionButton) {
    const domainItem = item.data as PrototypeNotification | null;
    if (domainItem) {
      onOpenNotification(domainItem);
    }
  }

  return (
    <KnockProvider
      apiKey={knockPublicApiKey}
      user={{
        id: `cadence-${roleKey}-${currentUser?.id ?? 1}`,
        name: currentUser?.name ?? ROLE_LABELS[roleKey],
      }}
    >
      <KnockFeedProvider feedId={knockFeedChannelId} colorMode={colorMode}>
        <KnockStoreBridge
          notifications={notifications}
          includeActionButtons={true}
          onMarkAllRead={onMarkAllRead}
          onArchive={onArchive}
          onToggleRead={onToggleRead}
        />

        <div className="flex h-screen overflow-hidden">
          <Sidebar
            currentUser={currentUser}
            recentCourses={recentCourses}
            isTeamAdmin={isTeamAdmin}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  Variant A · Stock `@knocklabs/react`
                </span>
                <span>
                  {"`<NotificationIconButton />` + `<NotificationFeedPopover />` + default `<NotificationCell />`"} ({ROLE_LABELS[roleKey]})
                </span>
              </div>

              <div className="flex items-center gap-3">
                <NotificationIconButton
                  ref={buttonRef}
                  badgeCountType="unread"
                  onClick={() => setFeedOpen(!feedOpen)}
                />
                <NotificationFeedPopover
                  buttonRef={buttonRef}
                  isVisible={feedOpen}
                  onClose={() => setFeedOpen(false)}
                  onNotificationClick={handleItemClick}
                  onNotificationButtonClick={handleButtonClick}
                  onMarkAllAsReadClick={() => onMarkAllRead()}
                />
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B: `@knocklabs/react` <NotificationFeedPopover /> + Enhanced <NotificationCell> children (Digest grids & Refund notes)
// ─────────────────────────────────────────────────────────────────────────────
export function VariantB(props: SharedVariantProps) {
  const {
    knockPublicApiKey,
    knockFeedChannelId,
    currentUser,
    recentCourses,
    isTeamAdmin,
    roleKey,
    notifications,
    feedOpen,
    setFeedOpen,
    onToggleRead,
    onMarkAllRead,
    onArchive,
    onOpenNotification,
    children,
  } = props;

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const colorMode = useDocumentColorMode();

  return (
    <KnockProvider
      apiKey={knockPublicApiKey}
      user={{
        id: `cadence-${roleKey}-${currentUser?.id ?? 1}`,
        name: currentUser?.name ?? ROLE_LABELS[roleKey],
      }}
    >
      <KnockFeedProvider feedId={knockFeedChannelId} colorMode={colorMode}>
        <KnockStoreBridge
          notifications={notifications}
          includeActionButtons={false}
          onMarkAllRead={onMarkAllRead}
          onArchive={onArchive}
          onToggleRead={onToggleRead}
        />

        <div className="flex h-screen overflow-hidden">
          <Sidebar
            currentUser={currentUser}
            recentCourses={recentCourses}
            isTeamAdmin={isTeamAdmin}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  {"Variant B · Knock Popover + Rich <NotificationCell> Children"}
                </span>
                <span>
                  {"Uses Knock's <NotificationCell> with custom child blocks for Digest scorecards & Refund notes"} ({ROLE_LABELS[roleKey]})
                </span>
              </div>

              <div className="flex items-center gap-3">
                <NotificationIconButton
                  ref={buttonRef}
                  badgeCountType="unread"
                  onClick={() => setFeedOpen(!feedOpen)}
                />
                <NotificationFeedPopover
                  buttonRef={buttonRef}
                  isVisible={feedOpen}
                  onClose={() => setFeedOpen(false)}
                  onMarkAllAsReadClick={() => onMarkAllRead()}
                  renderItem={({ item }) => {
                    const domain = item.data as PrototypeNotification | null;
                    if (!domain) {
                      return <NotificationCell key={item.id} item={item} />;
                    }
                    return (
                      <NotificationCell
                        key={item.id}
                        item={item}
                        avatar={
                          <Avatar
                            name={domain.actorName}
                            src={
                              domain.actorSeed
                                ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${domain.actorSeed}`
                                : undefined
                            }
                          />
                        }
                        onItemClick={() => onOpenNotification(domain)}
                      >
                        <div className="mt-1.5 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                                getCategoryBadgeStyle(domain.category)
                              )}
                            >
                              {getCategoryIcon(domain.category)}
                              {domain.eventLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {domain.deliveryBadge}
                            </span>
                          </div>

                          {domain.quoteOrNote && (
                            <div
                              className={cn(
                                "rounded-md border p-2 text-xs",
                                domain.quoteOrNote.tone === "amber"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                                  : domain.quoteOrNote.tone === "green"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
                                    : "bg-muted/60 text-foreground"
                              )}
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
                                {domain.quoteOrNote.label}
                              </div>
                              <p className="mt-0.5 leading-snug">
                                "{domain.quoteOrNote.text}"
                              </p>
                            </div>
                          )}

                          {domain.digestMetrics && (
                            <div className="grid grid-cols-2 gap-1.5 rounded-md border bg-muted/40 p-2">
                              {domain.digestMetrics.stats.map((stat) => (
                                <div
                                  key={stat.label}
                                  className="rounded border bg-background px-2 py-1"
                                >
                                  <div className="text-[10px] text-muted-foreground">
                                    {stat.label}
                                  </div>
                                  <div className="text-xs font-bold text-foreground">
                                    {stat.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </NotificationCell>
                    );
                  }}
                />
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C: `@knocklabs/react` <NotificationFeedPopover /> + Custom Cadence `renderItem` Cell
// ─────────────────────────────────────────────────────────────────────────────
export function VariantC(props: SharedVariantProps) {
  const {
    knockPublicApiKey,
    knockFeedChannelId,
    currentUser,
    recentCourses,
    isTeamAdmin,
    roleKey,
    notifications,
    feedOpen,
    setFeedOpen,
    onToggleRead,
    onMarkAllRead,
    onArchive,
    onOpenNotification,
    onReplyToStudent,
    children,
  } = props;

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const colorMode = useDocumentColorMode();
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  async function handleSubmitInlineReply(domain: PrototypeNotification) {
    const text = (replyDrafts[domain.id] ?? "").trim();
    if (!text) return;
    setSendingReplyId(domain.id);
    try {
      await onReplyToStudent(domain, text);
      setReplyingId(null);
      setReplyDrafts((prev) => ({ ...prev, [domain.id]: "" }));
    } finally {
      setSendingReplyId(null);
    }
  }

  return (
    <KnockProvider
      apiKey={knockPublicApiKey}
      user={{
        id: `cadence-${roleKey}-${currentUser?.id ?? 1}`,
        name: currentUser?.name ?? ROLE_LABELS[roleKey],
      }}
    >
      <KnockFeedProvider feedId={knockFeedChannelId} colorMode={colorMode}>
        <KnockStoreBridge
          notifications={notifications}
          includeActionButtons={false}
          onMarkAllRead={onMarkAllRead}
          onArchive={onArchive}
          onToggleRead={onToggleRead}
        />

        <div className="flex h-screen overflow-hidden">
          <Sidebar
            currentUser={currentUser}
            recentCourses={recentCourses}
            isTeamAdmin={isTeamAdmin}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  Variant C · Knock Popover Shell + Custom Cadence `renderItem`
                </span>
                <span>
                  {"Knock <NotificationIconButton /> & <NotificationFeedPopover /> with custom shadcn cell + explicit Read/Unread toggle"} ({ROLE_LABELS[roleKey]})
                </span>
              </div>

              <div className="flex items-center gap-3">
                <NotificationIconButton
                  ref={buttonRef}
                  badgeCountType="unread"
                  onClick={() => setFeedOpen(!feedOpen)}
                />
                <NotificationFeedPopover
                  buttonRef={buttonRef}
                  isVisible={feedOpen}
                  onClose={() => setFeedOpen(false)}
                  onMarkAllAsReadClick={() => onMarkAllRead()}
                  renderItem={({ item }) => {
                    const domain = item.data as PrototypeNotification | null;
                    if (!domain) {
                      return <NotificationCell key={item.id} item={item} />;
                    }
                    const isReplyingHere = replyingId === domain.id;
                    const draft = replyDrafts[domain.id] ?? "";
                    const isSending = sendingReplyId === domain.id;
                    const canInlineReply =
                      domain.role === "instructor" &&
                      domain.category === "comment";

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "border-b border-border/60 p-3.5 transition-colors hover:bg-accent/40",
                          domain.unread && "bg-primary/[0.05]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                            {getCategoryIcon(domain.category)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
                                  getCategoryBadgeStyle(domain.category)
                                )}
                              >
                                {domain.eventLabel}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  {domain.createdAtLabel}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleRead(domain.id);
                                  }}
                                  title={
                                    domain.unread
                                      ? "Mark as Read Notification"
                                      : "Mark as Unread Notification"
                                  }
                                  className="flex size-5 items-center justify-center rounded-full hover:bg-accent"
                                >
                                  {domain.unread ? (
                                    <span className="size-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
                                  ) : (
                                    <Circle className="size-2.5 text-muted-foreground/40" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onOpenNotification(domain)}
                              className={cn(
                                "mt-1 block text-left text-xs leading-snug hover:underline",
                                domain.unread
                                  ? "font-semibold text-foreground"
                                  : "font-medium text-foreground/80"
                              )}
                            >
                              {domain.title}
                            </button>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                              {domain.body}
                            </p>

                            {domain.quoteOrNote && (
                              <div className="mt-2 rounded border bg-muted/50 p-2 text-[11px]">
                                <span className="font-semibold">
                                  {domain.quoteOrNote.label}:{" "}
                                </span>
                                "{domain.quoteOrNote.text}"
                              </div>
                            )}

                            {domain.repliedText && (
                              <div className="mt-2 flex items-start gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-900 dark:text-emerald-200">
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                  <span className="font-semibold">
                                    Your reply to {domain.actorName}:{" "}
                                  </span>
                                  "{domain.repliedText}"
                                </div>
                              </div>
                            )}

                            {domain.digestMetrics && (
                              <div className="mt-2 grid grid-cols-2 gap-1.5">
                                {domain.digestMetrics.stats.map((stat) => (
                                  <div
                                    key={stat.label}
                                    className="rounded border bg-background px-2 py-1 text-[11px]"
                                  >
                                    <span className="text-muted-foreground">
                                      {stat.label}:{" "}
                                    </span>
                                    <strong className="text-foreground">
                                      {stat.value}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isReplyingHere && (
                              <div
                                className="mt-2.5 space-y-2 rounded-md border bg-background p-2.5 shadow-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <textarea
                                  value={draft}
                                  onChange={(e) =>
                                    setReplyDrafts((prev) => ({
                                      ...prev,
                                      [domain.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={`Write a reply to ${domain.actorName}...`}
                                  rows={3}
                                  autoFocus
                                  className="w-full rounded border bg-background p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onOpenNotification(domain)}
                                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                  >
                                    Open full thread in lesson
                                    <ExternalLink className="size-3" />
                                  </button>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setReplyingId(null)}
                                      className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!draft.trim() || isSending}
                                      onClick={() =>
                                        handleSubmitInlineReply(domain)
                                      }
                                      className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      <Send className="size-3" />
                                      {isSending ? "Posting..." : "Post reply"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                {domain.deliveryBadge}
                              </span>
                              <div className="flex items-center gap-2.5">
                                {canInlineReply && !isReplyingHere && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setReplyingId(domain.id);
                                    }}
                                    className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                                  >
                                    <Reply className="size-3" />
                                    {domain.repliedText
                                      ? "Reply again"
                                      : "Reply to student"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenNotification(domain);
                                  }}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                >
                                  {canInlineReply
                                    ? "Open in lesson"
                                    : domain.ctaLabel}
                                  <ExternalLink className="size-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </KnockFeedProvider>
    </KnockProvider>
  );
}

export function triggerSimulatedIncomingToast(
  roleKey: PrototypeRoleKey,
  onAdd: (n: PrototypeNotification) => void,
  onView: (n: PrototypeNotification) => void
) {
  const template = SIMULATED_INCOMING[roleKey];
  const created: PrototypeNotification = {
    ...template,
    id: `sim-${Date.now()}`,
    createdAtLabel: "Just now",
    minutesAgo: 0,
    unread: true,
  };
  onAdd(created);
  toast(created.title, {
    description: `${created.eventLabel} · ${created.body}`,
    action: {
      label: "View",
      onClick: () => onView(created),
    },
  });
}
