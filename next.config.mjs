/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/baby-feed',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
