/** Site constants. Pending items in the UI spec stay placeholders or flags. */
export const CODE_PLAYGROUND_URL = ''
export const ORGANISER_LINE = 'ARIESxROBOTICSxEES'
export const ORGANISER_SUBLINE = 'Fresher Tech GC, IIT Delhi'
export const TAGLINE = '[Tagline placeholder]'
export const EVENT_DATE = '[Event date placeholder]'
export const FEATURES = {
  stagedReveal: false,
  publicTop10OnLogin: false,
  auditLogTab: true,
} as const
export const UPLOAD_MAX_BYTES = 262_144
export const PY_EXT = /\.py$/
export const STEP_CAP = 15_000
export const RUN_TIMEOUT_MS = 10_000
export const PASSWORD_MIN = 8
export const GRID_SIZES = [5, 6, 7, 8] as const
export const DEFAULT_GRID = 6
export const SPEEDS = [1, 4, 16, 64] as const
export const SPEED_STEPS_PER_S = { 1: 8, 4: 32, 16: 128, 64: 512 } as const
export const LIVE_ANNOUNCE_THROTTLE_MS = 5_000
export const PYODIDE_VERSION = '314.0.7'
export const PYODIDE_INDEX_URL = `${import.meta.env.BASE_URL}pyodide/${PYODIDE_VERSION}/`
export const PYODIDE_TOTAL_BYTES = 13_500_000
export const AVATAR_MAX_BYTES = 2_097_152
export const AVATAR_FILE = 'avatar.webp'
