type LogLevel = "silent" | "error" | "warn" | "info" | "debug"

const levelOrder: Record<Exclude<LogLevel, "silent">, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const configuredLevel = (
  process.env.NEXT_PUBLIC_LOG_LEVEL?.toLowerCase() as LogLevel | undefined
) ?? "warn"

const fallbackLevel: LogLevel = "warn"

const resolvedLevel: LogLevel =
  configuredLevel === "silent" || configuredLevel in levelOrder
    ? configuredLevel
    : fallbackLevel

const isDebugEnabled =
  process.env.NEXT_PUBLIC_ENABLE_VERBOSE_LOGS?.toLowerCase() === "true"

const getRank = (level: LogLevel): number => {
  if (level === "silent") {
    return Infinity
  }
  return levelOrder[level]
}

const shouldLog = (incoming: LogLevel): boolean => {
  if (resolvedLevel === "silent") {
    return false
  }

  if (incoming === "debug" && isDebugEnabled) {
    return true
  }

  const incomingRank = getRank(incoming)
  const currentRank = getRank(resolvedLevel)

  return incomingRank <= currentRank
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog("debug")) {
      console.debug(...args)
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog("info")) {
      console.info(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) {
      console.warn(...args)
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) {
      console.error(...args)
    }
  },
} as const
