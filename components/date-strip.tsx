import {
  DEMO_PLAN,
  DEMO_WEEKS,
  TRIP_WINDOW_LABEL,
  formatEurCompact,
  type PlanWeek,
  type WeekDot,
} from "@/lib/demo-plan";
import { cn } from "@/lib/utils";

const DOT_COLOR: Record<WeekDot, string> = {
  event: "var(--sb-warn)",
  weather: "var(--sb-sea)",
  warning: "var(--sb-over)",
  good: "var(--sb-good)",
};

const DOT_LABEL: Record<WeekDot, string> = {
  event: "event",
  weather: "weather",
  warning: "warning",
  good: "on budget",
};

function WeekCell({ week }: { week: PlanWeek }) {
  return (
    <li
      className={cn(
        "flex min-w-[122px] flex-1 flex-col justify-between gap-1.5 rounded-lg border px-2.5 py-2 transition-colors lg:min-w-0",
        week.anchor
          ? "border-[color-mix(in_srgb,var(--sb-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_9%,var(--sb-panel-2))]"
          : "border-[var(--sb-line)] bg-[color-mix(in_srgb,var(--sb-panel-2)_65%,transparent)]",
        week.buffer && "border-dashed",
      )}
    >
      <div className="min-w-0">
        <p className="sb-num text-[10px] text-[var(--sb-faint)]">
          {week.startLabel}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-[12px] leading-tight font-semibold",
            week.buffer && "text-[var(--sb-dim)] italic",
          )}
        >
          {week.place}
          {week.anchor && (
            <span className="ml-1 text-[var(--sb-accent)]" aria-label="anchor">
              ✦
            </span>
          )}
        </p>
        <p className="mt-0.5 hidden truncate text-[10px] text-[var(--sb-faint)] xl:block">
          {week.detail}
        </p>
      </div>

      <div className="flex items-end justify-between gap-2">
        <span className="flex gap-1" aria-hidden={week.dots.length === 0}>
          {week.dots.map((dot) => (
            <span
              key={dot}
              title={DOT_LABEL[dot]}
              className="size-1.5 rounded-full"
              style={{ background: DOT_COLOR[dot] }}
            />
          ))}
        </span>
        <span className="sb-num text-[11px] font-medium">
          {formatEurCompact(week.costEur)}
        </span>
      </div>
    </li>
  );
}

function Legend() {
  return (
    <span className="hidden items-center gap-2.5 text-[10px] text-[var(--sb-faint)] sm:flex">
      {(["event", "weather", "warning"] as const).map((dot) => (
        <span key={dot} className="flex items-center gap-1">
          <span
            className="size-1.5 rounded-full"
            style={{ background: DOT_COLOR[dot] }}
          />
          {DOT_LABEL[dot]}
        </span>
      ))}
    </span>
  );
}

/**
 * The week strip docked at the bottom of the Globe stage.
 *
 * Static in this build. #27 makes it the place the leaving and return dates
 * are changed — there is no separate date form, by design — so the cells are
 * already sized for a drag handle at each end.
 */
export function DateStrip() {
  return (
    <section className="pointer-events-auto absolute right-4 bottom-4 left-4 z-20">
      <div className="sb-panel p-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="sb-label truncate">
            {TRIP_WINDOW_LABEL}
            <span className="ml-2 text-[var(--sb-faint)] normal-case">
              {DEMO_PLAN.dayCount} days · {DEMO_PLAN.freeLodgingNights} free-lodging
            </span>
          </p>
          <Legend />
        </div>

        {/* Horizontal scroll is the mobile degradation: ten weeks never fit a
            phone, and squeezing them would cost the place names. */}
        <ul className="sb-scroll mt-2.5 flex gap-1.5 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
          {DEMO_WEEKS.map((week) => (
            <WeekCell key={week.id} week={week} />
          ))}
        </ul>
      </div>
    </section>
  );
}
