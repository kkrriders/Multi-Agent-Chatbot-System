import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone is for Docker self-hosting; Vercel handles its own optimisation
  ...(process.env.VERCEL ? {} : {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, "../"),
  }),
}

export default nextConfig
