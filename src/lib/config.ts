/**
 * Application configuration for Video Za Wakubwa Tu Admin Panel.
 * Prepared for future connection with the public website API.
 */
export const config = {
  app: {
    name: "Video Za Wakubwa Tu Admin",
    version: "1.0.0",
  },
  api: {
    // Public website API (future connection)
    publicWebsiteUrl: process.env.NEXT_PUBLIC_PUBLIC_WEBSITE_URL || "https://video-za-wakubwa-tu.vercel.app",
    publicApiUrl: process.env.NEXT_PUBLIC_PUBLIC_API_URL || "https://video-za-wakubwa-tu.vercel.app/api",
    // Admin API (internal)
    adminApiUrl: process.env.NEXT_PUBLIC_ADMIN_API_URL || "/api",
  },
  auth: {
    sessionDuration: 60 * 60 * 24, // 24 hours
  },
} as const;
