/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@anthropic-ai/sdk', '@slack/web-api'],
}
module.exports = nextConfig
