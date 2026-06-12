/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Customer document uploads (PDFs, images, emails) go through server
      // actions — raise the default 1MB body limit.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
