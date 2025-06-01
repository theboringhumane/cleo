/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tremor/react'],
  images: {
    domains: ['localhost', 'github.com'],
  },
};

module.exports = nextConfig; 