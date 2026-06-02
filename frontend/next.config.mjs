/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a minimal self-contained build under .next/standalone — required for Docker
  output: 'standalone',
}

export default nextConfig
