/**
 * Application configuration
 * Centralized place for environment variables and app settings
 */

/**
 * Page revalidation interval in seconds
 * Can be configured via NEXT_PUBLIC_REVALIDATE_INTERVAL env variable
 *
 * Default: 300 seconds (5 minutes)
 *
 * Recommended values:
 * - 300 (5 min): Development, frequent updates
 * - 600 (10 min): Production with moderate traffic
 * - 3600 (1 hour): Low-traffic sites, reduce database load
 */
export const REVALIDATE_INTERVAL =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_REVALIDATE_INTERVAL
    ? parseInt(process.env.NEXT_PUBLIC_REVALIDATE_INTERVAL, 10)
    : 300
