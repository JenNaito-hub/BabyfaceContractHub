/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Domain logic sống ở packages/* dưới dạng TypeScript nguồn, không build sẵn
  transpilePackages: [
    "@aescentic/database",
    "@aescentic/permissions",
    "@aescentic/auth",
    "@aescentic/config",
    "@aescentic/events",
    "@aescentic/integrations",
    "@aescentic/shared",
  ],
};
