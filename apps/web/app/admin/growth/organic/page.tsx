import { listOrganicPosts } from "@littlecolorbook/db";
import type { OrganicPost } from "@littlecolorbook/db";
import { formatDateTime } from "../../../../lib/growth-format";

export const dynamic = "force-dynamic";

// ─── Helper: build 14-day window ────────────────────────────────────────────

function build14DayWindow(): { dateStr: string; label: string }[] {
  const days: { dateStr: string; label: string }[] = [];
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({ dateStr: d.toISOString().slice(0, 10), label: fmt.format(d) });
  }
  return days;
}

// ─── Status / platform badges ─────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    scheduled:   { bg: "#DDF5FF", color: "#175B77" },
    published:   { bg: "#DDF4EA", color: "#1E5E45" },
    publishing:  { bg: "#FFD65A40", color: "#7D4D3B" },
    draft:       { bg: "#F4E7DA", color: "#7D4D3B" },
    failed:      { bg: "#c85a4a20", color: "#c85a4a" },
    canceled:    { bg: "#F4E7DA", color: "#7D4D3B" },
  };
  const c = colors[status] ?? { bg: "#F4E7DA", color: "#7D4D3B" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "999px",
        fontSize: "0.7rem",
        fontWeight: 600,
        background: c.bg,
        color: c.color,
      }}
    >
      {status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    fb:    "FB",
    ig:    "IG",
    fb_ig: "FB+IG",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "4px",
        fontSize: "0.7rem",
        fontWeight: 700,
        background: "#241813",
        color: "#FFF8F2",
      }}
    >
      {labels[platform] ?? platform}
    </span>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: OrganicPost }) {
  return (
    <article
      style={{
        background: "var(--color-paper)",
        border: "1px solid var(--line)",
        borderRadius: "8px",
        padding: "8px 10px",
        display: "grid",
        gap: "4px",
        fontSize: "0.82rem",
      }}
    >
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
        <PlatformBadge platform={post.platform} />
        <span style={{ color: "#7D4D3B", fontSize: "0.75rem" }}>{post.format.replace(/_/g, " ")}</span>
        <StatusPill status={post.status} />
      </div>
      {post.scheduledAt && (
        <time style={{ color: "#7D4D3B", fontSize: "0.75rem" }} dateTime={post.scheduledAt.toISOString()}>
          {formatDateTime(post.scheduledAt)}
        </time>
      )}
      <p style={{ margin: 0, lineHeight: 1.4, wordBreak: "break-word" }}>
        {post.caption ? post.caption.slice(0, 60) + (post.caption.length > 60 ? "…" : "") : "—"}
      </p>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GrowthOrganicPage() {
  const posts = await listOrganicPosts({ limit: 100 });

  const days = build14DayWindow();

  // Group posts by their scheduled/published date (UTC)
  const postsByDay = new Map<string, OrganicPost[]>();
  for (const day of days) {
    postsByDay.set(day.dateStr, []);
  }

  for (const post of posts) {
    const anchor = post.scheduledAt ?? post.publishedAt;
    if (!anchor) continue;
    const dayStr = new Date(anchor).toISOString().slice(0, 10);
    if (postsByDay.has(dayStr)) {
      postsByDay.get(dayStr)!.push(post);
    }
  }

  const totalInWindow = [...postsByDay.values()].flat().length;

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Organic posts — 14-day calendar</h1>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.875rem" }}>
            {totalInWindow} post{totalInWindow !== 1 ? "s" : ""} in the next 14 days · scheduled or published
          </p>
        </div>
      </div>

      {/* Calendar grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "8px",
          overflowX: "auto",
        }}
      >
        {days.map(({ dateStr, label }) => {
          const dayPosts = postsByDay.get(dateStr) ?? [];
          const isToday = dateStr === new Date().toISOString().slice(0, 10);
          return (
            <div key={dateStr} style={{ display: "grid", gap: "6px", alignContent: "start" }}>
              <div
                style={{
                  padding: "6px 8px",
                  borderRadius: "6px",
                  background: isToday ? "#241813" : "var(--color-paper)",
                  color: isToday ? "#FFF8F2" : "var(--color-ink)",
                  border: "1px solid var(--line)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {label}
              </div>
              {dayPosts.length === 0 ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.75rem",
                    color: "#7D4D3B",
                    textAlign: "center",
                    padding: "8px 0",
                  }}
                >
                  —
                </p>
              ) : (
                dayPosts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>
          );
        })}
      </div>

      {/* Posts outside the 14-day window */}
      {posts.filter((p) => {
        const anchor = p.scheduledAt ?? p.publishedAt;
        if (!anchor) return true;
        const dayStr = new Date(anchor).toISOString().slice(0, 10);
        return !postsByDay.has(dayStr);
      }).length > 0 && (
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Outside window</h2>
          <p className="muted" style={{ fontSize: "0.875rem", margin: 0 }}>
            {posts.filter((p) => {
              const anchor = p.scheduledAt ?? p.publishedAt;
              if (!anchor) return true;
              const dayStr = new Date(anchor).toISOString().slice(0, 10);
              return !postsByDay.has(dayStr);
            }).length} post(s) are outside the 14-day window (past or unscheduled).
          </p>
        </section>
      )}
    </div>
  );
}
