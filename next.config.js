/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@anthropic-ai/sdk', '@slack/web-api', 'sharp'],
}
module.exports = nextConfig
