import { type ReactNode } from 'react';
import type { TeamColorSelection } from '@/types/squad';

interface FormationPitchProps {
  children: ReactNode;
  className?: string;
  /** Optional team colors to display on the pitch */
  teamColors?: TeamColorSelection | null;
}

/**
 * FIFA-regulation field marking constants.
 *
 * ViewBox is 680×1050 to match the 68m×105m pitch ratio exactly.
 * All markings are calculated from FIFA Law 1 dimensions at ~8.82 px/m scale.
 *
 * Pitch coordinate system:
 *   - Field outline: x=40, y=62, width=600, height=926
 *   - Top goal line: y=62, Bottom goal line: y=988
 *   - Left touchline: x=40, Right touchline: x=640
 *   - Center: (340, 525)
 */
const PITCH = {
  /** ViewBox dimensions */
  viewBoxW: 680,
  viewBoxH: 1050,
  /** Field outline (playing area) */
  fx: 40,
  fy: 62,
  fw: 600,
  fh: 926,
  /** Derived */
  get centerX() { return this.fx + this.fw / 2; },  // 340
  get centerY() { return this.fy + this.fh / 2; },  // 525
  get topGoalLine() { return this.fy; },              // 62
  get bottomGoalLine() { return this.fy + this.fh; }, // 988
  /** Center circle: 9.15m radius */
  centerCircleR: 80.7,
  /** Penalty area: 40.32m × 16.5m */
  penAreaW: 356,
  penAreaH: 146,
  get penAreaX() { return this.centerX - this.penAreaW / 2; }, // 162
  get topPenAreaBottom() { return this.fy + this.penAreaH; },  // 208
  get bottomPenAreaTop() { return this.bottomGoalLine - this.penAreaH; }, // 842
  /** Goal area: 18.32m × 5.5m */
  goalAreaW: 162,
  goalAreaH: 49,
  get goalAreaX() { return this.centerX - this.goalAreaW / 2; }, // 259
  /** Penalty spot: 11m from goal line */
  penaltySpotDist: 97,
  get topPenaltySpotY() { return this.fy + this.penaltySpotDist; },  // 159
  get bottomPenaltySpotY() { return this.bottomGoalLine - this.penaltySpotDist; }, // 891
  /** Penalty arc: r=9.15m, intersecting penalty area edge */
  penArcR: 80.7,
  get penArcDx() {
    // √(r² - dist²) where dist = penalty area height = 146
    return Math.sqrt(this.penArcR ** 2 - this.penAreaH ** 2); // ~64.12
  },
  /** Corner arc: 1m radius */
  cornerArcR: 9,
  /** Goal: 7.32m wide */
  goalW: 65,
  goalH: 15,
  get goalX() { return this.centerX - this.goalW / 2; }, // 308
} as const;

/** Pre-computed penalty arc intersection x-coordinates */
const PEN_ARC_DX = PITCH.penArcDx;
const PEN_ARC_X1 = Math.round(PITCH.centerX - PEN_ARC_DX); // ~276
const PEN_ARC_X2 = Math.round(PITCH.centerX + PEN_ARC_DX); // ~404

/** Stroke style for all field markings */
const MARKING_STROKE = 'rgba(255,255,255,0.7)';
const MARKING_STROKE_W = 2;
const MARKING_STROKE_W_THIN = 1.5;
const GOAL_STROKE = 'rgba(255,255,255,0.5)';

/** Grass stripe colors */
const GRASS_DARK = '#1a5c2a';
const GRASS_LIGHT = '#1e6630';

/**
 * SVG football pitch with FIFA-regulation accurate field markings.
 *
 * - Aspect ratio 68:105 (regulation pitch proportions)
 * - All markings proportionally correct per FIFA Law 1
 * - Responsive scaling via CSS aspect-ratio + viewBox
 * - Optional team color accent bars
 */
export default function FormationPitch({ children, className = '', teamColors }: FormationPitchProps) {
  const primaryColor = teamColors?.primary;
  const secondaryColor = teamColors?.secondary;

  return (
    <div
      className={`relative w-full mx-auto formation-pitch-container ${className}`}
      style={{
        aspectRatio: `${PITCH.viewBoxW} / ${PITCH.viewBoxH}`,
        touchAction: 'manipulation',
      }}
      role="region"
      aria-label="Football pitch formation"
    >
      <svg
        viewBox={`0 0 ${PITCH.viewBoxW} ${PITCH.viewBoxH}`}
        className="w-full h-auto rounded-xl overflow-hidden"
        style={{ willChange: 'transform' }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Football pitch formation view"
      >
        <defs>
          {/* Clip path to restrict grass stripes to field outline */}
          <clipPath id="field-clip">
            <rect x={PITCH.fx} y={PITCH.fy} width={PITCH.fw} height={PITCH.fh} />
          </clipPath>

          {/* Team color gradient overlays */}
          {primaryColor && (
            <>
              <linearGradient id="team-color-top" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primaryColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="team-color-bottom" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={secondaryColor || primaryColor} stopOpacity="0" />
                <stop offset="100%" stopColor={secondaryColor || primaryColor} stopOpacity="0.3" />
              </linearGradient>
            </>
          )}
        </defs>

        {/* ==================== Pitch background ==================== */}
        <rect
          x="0" y="0" width={PITCH.viewBoxW} height={PITCH.viewBoxH}
          rx="12" fill={GRASS_DARK}
        />

        {/* ==================== Grass stripe pattern ==================== */}
        {/* 10 alternating stripes clipped to field area */}
        <g clipPath="url(#field-clip)">
          {Array.from({ length: 10 }, (_, i) => {
            const stripeH = PITCH.fh / 10;
            const y = PITCH.fy + i * stripeH;
            return (
              <rect
                key={`stripe-${i}`}
                x={PITCH.fx}
                y={y}
                width={PITCH.fw}
                height={stripeH}
                fill={i % 2 === 0 ? GRASS_DARK : GRASS_LIGHT}
                opacity="0.45"
              />
            );
          })}
        </g>

        {/* ==================== Team color accent bars ==================== */}
        {primaryColor && (
          <>
            <rect
              x={PITCH.fx} y={PITCH.fy}
              width={PITCH.fw} height={PITCH.fh * 0.22}
              fill="url(#team-color-top)"
            />
            <rect
              x={PITCH.fx}
              y={PITCH.bottomGoalLine - PITCH.fh * 0.22}
              width={PITCH.fw} height={PITCH.fh * 0.22}
              fill="url(#team-color-bottom)"
            />
            {/* Top goal tinted with primary color */}
            <rect
              x={PITCH.goalX} y={PITCH.topGoalLine - PITCH.goalH}
              width={PITCH.goalW} height={PITCH.goalH} rx="2"
              fill={primaryColor} opacity="0.3"
            />
            {/* Bottom goal tinted with secondary color */}
            <rect
              x={PITCH.goalX} y={PITCH.bottomGoalLine}
              width={PITCH.goalW} height={PITCH.goalH} rx="2"
              fill={secondaryColor || primaryColor} opacity="0.3"
            />
          </>
        )}

        {/* ==================== Field outline ==================== */}
        <rect
          x={PITCH.fx} y={PITCH.fy}
          width={PITCH.fw} height={PITCH.fh}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* ==================== Halfway line ==================== */}
        <line
          x1={PITCH.fx} y1={PITCH.centerY}
          x2={PITCH.fx + PITCH.fw} y2={PITCH.centerY}
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* ==================== Center circle ==================== */}
        <circle
          cx={PITCH.centerX} cy={PITCH.centerY}
          r={PITCH.centerCircleR}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Center spot */}
        <circle
          cx={PITCH.centerX} cy={PITCH.centerY}
          r="4" fill="rgba(255,255,255,0.8)"
        />

        {/* ==================== Top penalty area ==================== */}
        <rect
          x={PITCH.penAreaX} y={PITCH.topGoalLine}
          width={PITCH.penAreaW} height={PITCH.penAreaH}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Top goal area */}
        <rect
          x={PITCH.goalAreaX} y={PITCH.topGoalLine}
          width={PITCH.goalAreaW} height={PITCH.goalAreaH}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Top penalty spot */}
        <circle
          cx={PITCH.centerX} cy={PITCH.topPenaltySpotY}
          r="3" fill="rgba(255,255,255,0.8)"
        />

        {/* Top penalty arc — portion of r=80.7 circle from penalty spot,
            outside the penalty area, curving toward center field */}
        <path
          d={`M ${PEN_ARC_X1} ${PITCH.topPenAreaBottom} A ${PITCH.penArcR} ${PITCH.penArcR} 0 0 1 ${PEN_ARC_X2} ${PITCH.topPenAreaBottom}`}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Top goal */}
        <rect
          x={PITCH.goalX} y={PITCH.topGoalLine - PITCH.goalH}
          width={PITCH.goalW} height={PITCH.goalH}
          fill="none"
          stroke={GOAL_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* ==================== Bottom penalty area ==================== */}
        <rect
          x={PITCH.penAreaX} y={PITCH.bottomPenAreaTop}
          width={PITCH.penAreaW} height={PITCH.penAreaH}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Bottom goal area */}
        <rect
          x={PITCH.goalAreaX} y={PITCH.bottomGoalLine - PITCH.goalAreaH}
          width={PITCH.goalAreaW} height={PITCH.goalAreaH}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Bottom penalty spot */}
        <circle
          cx={PITCH.centerX} cy={PITCH.bottomPenaltySpotY}
          r="3" fill="rgba(255,255,255,0.8)"
        />

        {/* Bottom penalty arc — portion of r=80.7 circle from penalty spot,
            outside the penalty area, curving toward center field */}
        <path
          d={`M ${PEN_ARC_X1} ${PITCH.bottomPenAreaTop} A ${PITCH.penArcR} ${PITCH.penArcR} 0 0 0 ${PEN_ARC_X2} ${PITCH.bottomPenAreaTop}`}
          fill="none"
          stroke={MARKING_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* Bottom goal */}
        <rect
          x={PITCH.goalX} y={PITCH.bottomGoalLine}
          width={PITCH.goalW} height={PITCH.goalH}
          fill="none"
          stroke={GOAL_STROKE}
          strokeWidth={MARKING_STROKE_W}
        />

        {/* ==================== Corner arcs (1m radius) ==================== */}
        {/* Top-left */}
        <path
          d={`M ${PITCH.fx} ${PITCH.fy + PITCH.cornerArcR} A ${PITCH.cornerArcR} ${PITCH.cornerArcR} 0 0 1 ${PITCH.fx + PITCH.cornerArcR} ${PITCH.fy}`}
          fill="none" stroke={MARKING_STROKE} strokeWidth={MARKING_STROKE_W_THIN}
        />
        {/* Top-right */}
        <path
          d={`M ${PITCH.fx + PITCH.fw - PITCH.cornerArcR} ${PITCH.fy} A ${PITCH.cornerArcR} ${PITCH.cornerArcR} 0 0 1 ${PITCH.fx + PITCH.fw} ${PITCH.fy + PITCH.cornerArcR}`}
          fill="none" stroke={MARKING_STROKE} strokeWidth={MARKING_STROKE_W_THIN}
        />
        {/* Bottom-left */}
        <path
          d={`M ${PITCH.fx + PITCH.cornerArcR} ${PITCH.bottomGoalLine} A ${PITCH.cornerArcR} ${PITCH.cornerArcR} 0 0 1 ${PITCH.fx} ${PITCH.bottomGoalLine - PITCH.cornerArcR}`}
          fill="none" stroke={MARKING_STROKE} strokeWidth={MARKING_STROKE_W_THIN}
        />
        {/* Bottom-right */}
        <path
          d={`M ${PITCH.fx + PITCH.fw} ${PITCH.bottomGoalLine - PITCH.cornerArcR} A ${PITCH.cornerArcR} ${PITCH.cornerArcR} 0 0 1 ${PITCH.fx + PITCH.fw - PITCH.cornerArcR} ${PITCH.bottomGoalLine}`}
          fill="none" stroke={MARKING_STROKE} strokeWidth={MARKING_STROKE_W_THIN}
        />
      </svg>

      {/* Player slots overlay — positioned absolutely to match SVG area */}
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  );
}
