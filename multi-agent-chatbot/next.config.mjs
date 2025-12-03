/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: '/mnt/c/Users/karti/Multi-Agent-Chatbot-System/multi-agent-chatbot',
}

export default nextConfig
