// PROTOTYPE (throwaway): Three variants of the in-app Notification Feed UI, switchable via ?variant=A|B|C, mounted in the existing app/routes/layout.app.tsx shell.
import { useState, useEffect } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/layout.app";
import { DevUI } from "~/components/dev-ui";
import { PrototypeSwitcher } from "~/components/prototype-switcher";
import {
  VariantA,
  VariantB,
  VariantC,
  INITIAL_NOTIFICATIONS,
  ROLE_LABELS,
  deriveDefaultRoleKey,
  triggerSimulatedIncomingToast,
  type PrototypeRoleKey,
  type PrototypeNotification,
} from "~/components/notification-feed.prototype";
import { Toaster, toast } from "sonner";
import { Sparkles, RotateCcw } from "lucide-react";
import { getCurrentUserId, getDevCountry } from "~/lib/session";
import { getCountryTierInfo, COUNTRIES } from "~/lib/ppp";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { db } from "~/db";
import {
  users,
  courses,
  modules,
  lessons,
  lessonProgress,
  teams,
  teamMembers,
  TeamMemberRole,
  LessonProgressStatus,
} from "~/db/schema";

function getAllUsers() {
  return db.select().from(users).all();
}

function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

function getTeamForAdmin(userId: number) {
  const membership = db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, TeamMemberRole.Admin)
      )
    )
    .get();

  if (!membership) return undefined;

  return db.select().from(teams).where(eq(teams.id, membership.teamId)).get();
}

function isTeamAdmin(userId: number) {
  return !!getTeamForAdmin(userId);
}

function getCourseLessonIds(courseId: number): number[] {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  const courseLessons = db
    .select({ id: lessons.id })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id)))!)
    .all();

  return courseLessons.map((l) => l.id);
}

function calculateProgress(
  userId: number,
  courseId: number,
  weightByDuration: boolean
) {
  const lessonIds = getCourseLessonIds(courseId);

  if (lessonIds.length === 0) return 0;

  if (weightByDuration) {
    const courseLessons = db
      .select({
        id: lessons.id,
        durationMinutes: lessons.durationMinutes,
      })
      .from(lessons)
      .where(or(...lessonIds.map((id) => eq(lessons.id, id)))!)
      .all();

    const totalDuration = courseLessons.reduce(
      (sum, l) => sum + (l.durationMinutes ?? 1),
      0
    );

    if (totalDuration === 0) return 0;

    const completed = db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.status, LessonProgressStatus.Completed),
          or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))!
        )
      )
      .all();

    const completedIds = new Set(completed.map((p) => p.lessonId));

    const completedDuration = courseLessons
      .filter((l) => completedIds.has(l.id))
      .reduce((sum, l) => sum + (l.durationMinutes ?? 1), 0);

    return Math.round((completedDuration / totalDuration) * 100);
  }

  const completedCount = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))!
      )
    )
    .get();

  return Math.round(((completedCount?.count ?? 0) / lessonIds.length) * 100);
}

function getCompletedLessonCount(userId: number, courseId: number) {
  const lessonIds = getCourseLessonIds(courseId);
  if (lessonIds.length === 0) return 0;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        or(...lessonIds.map((id) => eq(lessonProgress.lessonId, id)))!
      )
    )
    .get();

  return result?.count ?? 0;
}

function getTotalLessonCount(courseId: number) {
  return getCourseLessonIds(courseId).length;
}

function getRecentlyProgressedCourses(userId: number, limit: number = 3) {
  return db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      coverImageUrl: courses.coverImageUrl,
      lastActivityId: sql<number>`max(${lessonProgress.id})`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessonProgress.userId, userId))
    .groupBy(courses.id)
    .orderBy(desc(sql`max(${lessonProgress.id})`))
    .limit(limit)
    .all();
}

export async function loader({ request }: Route.LoaderArgs) {
  const users = getAllUsers();
  const currentUserId = await getCurrentUserId(request);
  const currentUser = currentUserId ? getUserById(currentUserId) : null;
  const devCountry = await getDevCountry(request);
  const countryTierInfo = getCountryTierInfo(devCountry);

  const recentCourses = currentUserId
    ? getRecentlyProgressedCourses(currentUserId).map((course) => {
        const completedLessons = getCompletedLessonCount(
          currentUserId,
          course.courseId
        );
        const totalLessons = getTotalLessonCount(course.courseId);
        const progress = calculateProgress(currentUserId, course.courseId, false);
        return {
          courseId: course.courseId,
          title: course.courseTitle,
          slug: course.courseSlug,
          coverImageUrl: course.coverImageUrl,
          completedLessons,
          totalLessons,
          progress,
        };
      })
    : [];

  return {
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    currentUser: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          avatarUrl: currentUser.avatarUrl ?? null,
        }
      : null,
    recentCourses,
    devCountry,
    countryTierInfo,
    countries: COUNTRIES,
    isTeamAdmin: currentUserId ? isTeamAdmin(currentUserId) : false,
    knockPublicApiKey: process.env.KNOCK_PUBLIC_API_KEY ?? "",
    knockFeedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? "",
  };
}

const PROTOTYPE_VARIANTS = [
  { key: "A", name: "Stock @knocklabs/react Popover & Cells" },
  { key: "B", name: "Knock Popover + Rich <NotificationCell> Children" },
  { key: "C", name: "Knock Popover + Custom Cadence renderItem" },
];

function resolveCanonicalUserIdForRole(
  roleKey: PrototypeRoleKey,
  users: { id: number; name: string; role: string }[]
): number | null {
  if (roleKey === "instructor") {
    return (
      users.find((u) => u.name === "Sarah Chen")?.id ??
      users.find((u) => u.role === "instructor")?.id ??
      null
    );
  }
  if (roleKey === "admin") {
    return users.find((u) => u.role === "admin")?.id ?? null;
  }
  if (roleKey === "team_admin") {
    return users.find((u) => u.name === "Bossy McBossface")?.id ?? null;
  }
  return (
    users.find((u) => u.name === "Emma Wilson")?.id ??
    users.find((u) => u.role === "student")?.id ??
    null
  );
}

function appendVariantToHref(href: string, variant: string): string {
  const [beforeHash, hash] = href.split("#");
  const separator = beforeHash.includes("?") ? "&" : "?";
  const withVariant = beforeHash.includes("variant=")
    ? beforeHash
    : `${beforeHash}${separator}variant=${encodeURIComponent(variant)}`;
  return hash ? `${withVariant}#${hash}` : withVariant;
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const {
    users,
    currentUser,
    recentCourses,
    devCountry,
    countryTierInfo,
    countries,
    isTeamAdmin: userIsTeamAdmin,
    knockPublicApiKey,
    knockFeedChannelId,
  } = loaderData;

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const rawVariant = (searchParams.get("variant") ?? "C").toUpperCase();
  const variant =
    rawVariant === "A" || rawVariant === "B" ? rawVariant : "C";

  const defaultRoleKey = deriveDefaultRoleKey(
    currentUser?.role,
    userIsTeamAdmin
  );
  const [roleKey, setRoleKey] = useState<PrototypeRoleKey>(defaultRoleKey);
  const [feedByRole, setFeedByRole] =
    useState<Record<PrototypeRoleKey, PrototypeNotification[]>>(
      INITIAL_NOTIFICATIONS
    );
  const [feedOpen, setFeedOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Ready");

  useEffect(() => {
    setRoleKey(deriveDefaultRoleKey(currentUser?.role, userIsTeamAdmin));
  }, [currentUser?.id, currentUser?.role, userIsTeamAdmin]);

  const notifications = feedByRole[roleKey] ?? [];
  const unreadCount = notifications.filter((n) => n.unread).length;
  const readCount = notifications.length - unreadCount;

  async function ensureSessionMatchesRole(targetRole: PrototypeRoleKey) {
    const activeRole = deriveDefaultRoleKey(
      currentUser?.role,
      userIsTeamAdmin
    );
    const needsSwitch =
      !currentUser ||
      activeRole !== targetRole ||
      (targetRole === "instructor" && currentUser.name !== "Sarah Chen");
    if (!needsSwitch) return;

    const targetUserId = resolveCanonicalUserIdForRole(targetRole, users);
    if (!targetUserId) return;

    const formData = new FormData();
    formData.set("userId", String(targetUserId));
    await fetch(
      `/api/switch-user?redirectTo=${encodeURIComponent(
        location.pathname + location.search
      )}`,
      {
        method: "POST",
        body: formData,
      }
    );
  }

  function handleToggleRead(id: string) {
    setFeedByRole((prev) => ({
      ...prev,
      [roleKey]: prev[roleKey].map((item) =>
        item.id === id ? { ...item, unread: !item.unread } : item
      ),
    }));
    const target = notifications.find((n) => n.id === id);
    if (target) {
      setLastAction(
        `Marked "${target.eventLabel}" as ${target.unread ? "Read Notification" : "Unread Notification"}`
      );
    }
  }

  function handleMarkAllRead() {
    setFeedByRole((prev) => ({
      ...prev,
      [roleKey]: prev[roleKey].map((item) => ({ ...item, unread: false })),
    }));
    setLastAction(`Marked all ${ROLE_LABELS[roleKey]} notifications as Read`);
  }

  function handleArchive(id: string) {
    setFeedByRole((prev) => ({
      ...prev,
      [roleKey]: prev[roleKey].filter((item) => item.id !== id),
    }));
    setLastAction(`Archived notification (${id})`);
  }

  async function handleOpenNotification(item: PrototypeNotification) {
    setFeedByRole((prev) => ({
      ...prev,
      [roleKey]: prev[roleKey].map((n) =>
        n.id === item.id ? { ...n, unread: false } : n
      ),
    }));
    setFeedOpen(false);
    const dest = appendVariantToHref(item.href, variant);
    setLastAction(`Opened "${item.eventLabel}" → ${dest}`);
    await ensureSessionMatchesRole(item.role);
    navigate(dest);
  }

  async function handleReplyToStudent(
    item: PrototypeNotification,
    replyText: string
  ) {
    await ensureSessionMatchesRole("instructor");
    if (item.commentId) {
      const formData = new FormData();
      formData.set("intent", "reply");
      formData.set("commentId", String(item.commentId));
      formData.set("body", replyText);
      await fetch("/instructor/questions", {
        method: "POST",
        body: formData,
      });
    }
    setFeedByRole((prev) => ({
      ...prev,
      [item.role]: prev[item.role].map((n) =>
        n.id === item.id
          ? { ...n, unread: false, repliedText: replyText }
          : n
      ),
    }));
    setLastAction(`Replied to ${item.actorName}: "${replyText}"`);
    toast.success(`Reply posted to ${item.actorName}!`);
    revalidator.revalidate();
  }

  function handleSimulateIncoming() {
    triggerSimulatedIncomingToast(
      roleKey,
      (created) => {
        setFeedByRole((prev) => ({
          ...prev,
          [roleKey]: [created, ...prev[roleKey]],
        }));
        setLastAction(`Simulated incoming: "${created.eventLabel}"`);
      },
      (created) => {
        setFeedOpen(true);
        void handleOpenNotification(created);
      }
    );
  }

  function handleReset() {
    setFeedByRole(INITIAL_NOTIFICATIONS);
    setLastAction("Reset in-memory Notification Feed state");
  }

  const sharedProps = {
    knockPublicApiKey,
    knockFeedChannelId,
    currentUser,
    recentCourses,
    isTeamAdmin: userIsTeamAdmin,
    roleKey,
    notifications,
    feedOpen,
    setFeedOpen,
    onToggleRead: handleToggleRead,
    onMarkAllRead: handleMarkAllRead,
    onArchive: handleArchive,
    onOpenNotification: handleOpenNotification,
    onReplyToStudent: handleReplyToStudent,
    children: <Outlet />,
  };

  return (
    <>
      {variant === "A" && <VariantA {...sharedProps} />}
      {variant === "B" && <VariantB {...sharedProps} />}
      {variant === "C" && <VariantC {...sharedProps} />}

      <PrototypeSwitcher
        variants={PROTOTYPE_VARIANTS}
        current={variant}
        stateSummary={
          <>
            <span>
              Role:{" "}
              <strong className="text-white">{ROLE_LABELS[roleKey]}</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              Feed:{" "}
              <strong className="text-amber-300">{unreadCount} Unread</strong> /{" "}
              <strong className="text-emerald-300">{readCount} Read</strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span>
              Panel:{" "}
              <strong className="text-violet-300">
                {feedOpen ? "Open" : "Closed"}
              </strong>
            </span>
            <span className="text-zinc-600">·</span>
            <span className="max-w-[260px] truncate text-zinc-400">
              {lastAction}
            </span>
          </>
        }
        extraControls={
          <>
            <select
              value={roleKey}
              onChange={async (e) => {
                const nextRole = e.target.value as PrototypeRoleKey;
                setRoleKey(nextRole);
                setLastAction(`Switched preview role to ${ROLE_LABELS[nextRole]}`);
                await ensureSessionMatchesRole(nextRole);
                revalidator.revalidate();
              }}
              aria-label="Preview role notifications"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
            >
              <option value="student">Role: Student</option>
              <option value="team_admin">Role: Team Admin</option>
              <option value="instructor">Role: Instructor</option>
              <option value="admin">Role: Platform Admin</option>
            </select>
            <button
              type="button"
              onClick={() => setFeedOpen(!feedOpen)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
            >
              {feedOpen ? "Close Feed" : "Open Feed"}
            </button>
            <button
              type="button"
              onClick={handleSimulateIncoming}
              className="inline-flex items-center gap-1 rounded bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500"
            >
              <Sparkles className="size-3" />
              Simulate Incoming
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Reset in-memory notifications"
              className="rounded border border-zinc-700 bg-zinc-900 p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <RotateCcw className="size-3" />
            </button>
          </>
        }
      />

      <DevUI
        users={users}
        currentUser={currentUser}
        devCountry={devCountry}
        countryTierInfo={countryTierInfo}
        countries={countries}
      />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
