"use client";

import { useMemo, type ReactElement } from "react";

import { SCENE_LABEL, capsuleScene, type CapsuleScene } from "@/lib/capsule-art";
import type { FacetId } from "@/lib/facets";
import { cn } from "@/lib/utils";

/**
 * The generated scene, drawn.
 *
 * Inline SVG rather than canvas: it renders on the server, it stays sharp at
 * any size, it costs no pixels of memory per card, and the whole picture is a
 * few hundred bytes of markup. `lib/capsule-art.ts` decides *what* the scene
 * is; this file is only the drawing.
 *
 * The state name over the top is the point as much as the scene is. A
 * generated landscape alone is decoration; a generated landscape with "QLD"
 * set 58px in Bricolage over it is a cover, and covers are identifiable at a
 * glance in a list of 413.
 */

/** The drawing surface. Everything below is in these units. */
const W = 400;
const H = 220;

interface CapsuleArtProps {
  /** Stable per entry — the Capsule or Catalog id. */
  seed: string;
  /** "QLD", "TAS", "Cross-state" — set large. */
  state: string;
  /** "Far North / Port Douglas" — the small line under it. */
  where?: string;
  tags: readonly string[];
  facets: readonly FacetId[];
  variant?: "hero" | "thumb";
  className?: string;
}

/** A scalloped ridge line, for canopy and cloud. */
function scallop(y: number, bumps: number, amp: number): string {
  const step = (W + 40) / bumps;
  let path = `M -20 ${H + 10} L -20 ${y}`;
  for (let i = 0; i < bumps; i++) {
    const x0 = -20 + i * step;
    path += ` Q ${x0 + step / 2} ${y - amp} ${x0 + step} ${y}`;
  }
  return `${path} L ${W + 20} ${H + 10} Z`;
}

function Reef({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      <rect x={0} y={hy - 40} width={W} height={H - hy + 40} fill={scene.landFar} opacity={0.4} />
      {scene.marks.map((mark, index) => {
        const x = mark.x * W;
        const width = 20 + mark.size * 46;
        const skew = 60 + mark.wobble * 60;
        return (
          <polygon
            key={`shaft-${index}`}
            points={`${x},-6 ${x + width},-6 ${x + width - skew},${hy + 26} ${x - skew},${hy + 26}`}
            fill={scene.glow}
            opacity={0.06 + mark.size * 0.07}
          />
        );
      })}
      {scene.marks.map((mark, index) => (
        <ellipse
          key={`bommie-${index}`}
          cx={(1 - mark.x) * W}
          cy={H + 10}
          rx={44 + mark.size * 76}
          ry={26 + mark.wobble * 46}
          fill={scene.landNear}
        />
      ))}
    </>
  );
}

function Coast({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      <rect x={0} y={hy} width={W} height={H - hy} fill={scene.landFar} opacity={0.55} />
      {scene.marks.map((mark, index) => {
        const y = hy + 10 + index * (10 + mark.size * 10);
        return (
          <path
            key={`wave-${index}`}
            d={`M -20 ${y} Q ${W * 0.22} ${y - 7 - mark.size * 5} ${W * 0.5} ${y} Q ${W * 0.78} ${y + 7} ${W + 20} ${y}`}
            fill="none"
            stroke={scene.glow}
            strokeWidth={1.2 + mark.size}
            opacity={0.14 + mark.wobble * 0.1}
          />
        );
      })}
      <polygon
        points={`${W + 20},${hy - 46} ${W + 20},${H + 10} ${W * 0.58},${H + 10} ${W * 0.72},${hy - 16}`}
        fill={scene.landNear}
      />
    </>
  );
}

function Ochre({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      {scene.marks.map((mark, index) => {
        const cx = mark.x * W;
        const half = 46 + mark.size * 62;
        const top = hy - (16 + mark.size * 48);
        return (
          <polygon
            key={`mesa-${index}`}
            points={`${cx - half},${hy + 2} ${cx - half * 0.66},${top} ${cx + half * 0.58},${top} ${cx + half},${hy + 2}`}
            fill={scene.landFar}
            opacity={0.55 + mark.wobble * 0.35}
          />
        );
      })}
      <rect x={0} y={hy} width={W} height={H - hy} fill={scene.landNear} />
      {/* The road that got you here. */}
      <polygon
        points={`${W * 0.5 - 5},${hy} ${W * 0.5 + 5},${hy} ${W * 0.86},${H + 10} ${W * 0.1},${H + 10}`}
        fill={scene.glow}
        opacity={0.1}
      />
    </>
  );
}

function Forest({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      <rect x={0} y={hy - 30} width={W} height={H - hy + 30} fill={scene.glow} opacity={0.05} />
      {[0, 1, 2].map((band) => {
        const mark = scene.marks[band % scene.marks.length];
        return (
          <path
            key={`canopy-${band}`}
            d={scallop(hy - 34 + band * 26, 5 + band * 2 + Math.round(mark.wobble * 2), 22 - band * 5)}
            fill={band === 2 ? scene.landNear : scene.landFar}
            opacity={band === 0 ? 0.7 : 1}
          />
        );
      })}
    </>
  );
}

function Alpine({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      {scene.marks.map((mark, index) => {
        const cx = mark.x * W;
        const half = 60 + mark.size * 70;
        const peak = hy - (34 + mark.size * 72);
        const capDrop = (hy - peak) * 0.26;
        return (
          <g key={`peak-${index}`}>
            <polygon
              points={`${cx - half},${hy + 2} ${cx},${peak} ${cx + half},${hy + 2}`}
              fill={index % 2 === 0 ? scene.landFar : scene.landNear}
              opacity={0.85 + mark.wobble * 0.15}
            />
            <polygon
              points={`${cx - half * (capDrop / (hy - peak))},${peak + capDrop} ${cx},${peak} ${cx + half * (capDrop / (hy - peak))},${peak + capDrop}`}
              fill={scene.glow}
              opacity={0.5}
            />
          </g>
        );
      })}
      <rect x={0} y={hy} width={W} height={H - hy} fill={scene.landNear} />
    </>
  );
}

function City({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      {scene.marks.map((mark, index) => {
        const width = 18 + mark.size * 26;
        const x = mark.x * W - width / 2;
        const top = hy - (10 + mark.size * 96);
        const lit = Math.round(mark.wobble * 3) + 1;
        return (
          <g key={`tower-${index}`}>
            <rect
              x={x}
              y={top}
              width={width}
              height={H - top + 10}
              fill={index % 2 === 0 ? scene.landNear : scene.landFar}
            />
            {Array.from({ length: lit }, (_, row) => (
              <rect
                key={row}
                x={x + width * 0.24}
                y={top + 12 + row * 16 + mark.wobble * 8}
                width={width * 0.5}
                height={4}
                fill={scene.glow}
                opacity={0.55}
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

function Night({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  return (
    <>
      {[0, 1, 2].map((ring) => (
        <ellipse
          key={`pulse-${ring}`}
          cx={W / 2}
          cy={H + 16}
          rx={78 + ring * 72}
          ry={30 + ring * 26}
          fill="none"
          stroke={scene.glow}
          strokeWidth={1.5}
          opacity={0.16 - ring * 0.04}
        />
      ))}
      <path
        d={scallop(hy + 14, 4, 16)}
        fill={scene.landNear}
      />
    </>
  );
}

function Harvest({ scene, hy }: { scene: CapsuleScene; hy: number }) {
  const vanish = W * 0.5 + (scene.marks[0].wobble - 0.5) * W * 0.4;
  return (
    <>
      <path d={scallop(hy - 6, 3, 26)} fill={scene.landFar} />
      <rect x={0} y={hy} width={W} height={H - hy} fill={scene.landNear} />
      {Array.from({ length: 9 }, (_, row) => (
        <line
          key={`row-${row}`}
          x1={(row / 8) * W * 1.7 - W * 0.35}
          y1={H + 10}
          x2={vanish}
          y2={hy}
          stroke={scene.glow}
          strokeWidth={1.1}
          opacity={0.16}
        />
      ))}
    </>
  );
}

const MOTIFS: Record<
  CapsuleScene["id"],
  (props: { scene: CapsuleScene; hy: number }) => ReactElement
> = {
  reef: Reef,
  coast: Coast,
  ochre: Ochre,
  forest: Forest,
  alpine: Alpine,
  city: City,
  night: Night,
  harvest: Harvest,
};

export function CapsuleArt({
  seed,
  state,
  where,
  tags,
  facets,
  variant = "hero",
  className,
}: CapsuleArtProps) {
  const scene = useMemo(
    () => capsuleScene({ seed, state, tags, facets }),
    [seed, state, tags, facets],
  );

  const hy = scene.horizon * H;
  const Motif = MOTIFS[scene.id];
  // Gradient ids have to be unique per instance: several scenes can be on
  // screen at once and SVG resolves `url(#…)` document-wide, not per-svg.
  const uid = `art-${seed.replace(/[^a-z0-9-]/gi, "")}-${scene.id}`;
  const hero = variant === "hero";

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      role="img"
      aria-label={`${state}${where ? ` — ${where}` : ""}: generated placeholder, ${SCENE_LABEL[scene.id]}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0%" stopColor={scene.skyTop} />
            <stop offset="100%" stopColor={scene.skyBottom} />
          </linearGradient>
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0%" stopColor={scene.glow} stopOpacity="0.55" />
            <stop offset="100%" stopColor={scene.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-scrim`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="rgb(6 10 16)" stopOpacity="0" />
            <stop offset="55%" stopColor="rgb(6 10 16)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(6 10 16)" stopOpacity="0.68" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#${uid}-sky)`} />

        {/* Sun, moon or glare. The city keeps its light low and behind. */}
        <circle
          cx={scene.disc.x * W}
          cy={scene.disc.y * H}
          r={scene.disc.r * W * 2.6}
          fill={`url(#${uid}-halo)`}
        />
        {scene.id !== "city" && (
          <circle
            cx={scene.disc.x * W}
            cy={scene.disc.y * H}
            r={scene.disc.r * W * 0.5}
            fill={scene.glow}
            opacity={scene.id === "reef" ? 0.4 : 0.85}
          />
        )}

        {scene.specks.map((speck, index) => (
          <circle
            key={`speck-${index}`}
            cx={speck.x * W}
            cy={speck.y * H}
            r={speck.r}
            fill={scene.glow}
            opacity={0.45}
          />
        ))}

        <Motif scene={scene} hy={hy} />

        <rect width={W} height={H} fill={`url(#${uid}-scrim)`} />
      </svg>

      {/* Type layer in HTML, not SVG: it inherits the Bricolage variable and
          the tracking behaves the same as everywhere else in the app. */}
      <div
        className={cn(
          "relative flex size-full flex-col justify-end",
          hero ? "p-4" : "p-2",
        )}
      >
        <span
          className={cn(
            "font-display font-extrabold text-[rgb(255_253_248/0.94)] [text-shadow:0_2px_18px_rgb(6_10_16/0.6)]",
            hero
              ? "text-[52px] leading-[0.82] tracking-[-0.03em]"
              : "text-[21px] leading-[0.85] tracking-[-0.03em]",
          )}
        >
          {state}
        </span>
        {where && hero && (
          <span className="mt-1.5 text-[10px] font-semibold tracking-[0.16em] text-[rgb(255_253_248/0.72)] uppercase [text-shadow:0_1px_10px_rgb(6_10_16/0.7)]">
            {where}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Real photography, when the Plan has any.
 *
 * The contract with the card is deliberately blunt: an entry either has
 * `images` and gets this, or it doesn't and gets the generated scene. There is
 * no half state where a photo is layered over a gradient, because that always
 * looks like a loading bug.
 */
export function CapsuleImageStrip({
  images,
  alt,
  className,
}: {
  images: readonly string[];
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sb-scroll flex snap-x snap-mandatory gap-1 overflow-x-auto",
        className,
      )}
    >
      {images.map((src, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- sources are
        // arbitrary remote URLs; next/image would need a host allowlist per
        // photo, and there is no photography in the Plan yet to configure for.
        <img
          key={src}
          src={src}
          alt={index === 0 ? alt : ""}
          loading="lazy"
          className="h-full w-[82%] shrink-0 snap-start object-cover first:w-full"
        />
      ))}
    </div>
  );
}
