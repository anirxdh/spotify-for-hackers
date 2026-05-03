/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  /** Next 16: production defaults to Turbopack; required alongside a custom `webpack` function. */
  turbopack: {},
  /** Avoid PackFileCacheStrategy / huge ArrayBuffers when dev machine is low on free RAM */
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
}

export default nextConfig
