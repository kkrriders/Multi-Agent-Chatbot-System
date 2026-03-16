/**
 * Central config for client-side environment variables.
 * Set NEXT_PUBLIC_API_URL in .env.local to point to your backend.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
