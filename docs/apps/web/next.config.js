const { createContentlayerPlugin } = require('next-contentlayer2')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async redirects() {
    return [
      // {
      //   source: '/',
      //   destination: '/docs',
      //   permanent: true,
      // },
    ]
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
}

const withContentlayer = createContentlayerPlugin({})

const withNextIntl = require('next-intl/plugin')('./src/i18n')

module.exports = withNextIntl(withContentlayer(nextConfig))
