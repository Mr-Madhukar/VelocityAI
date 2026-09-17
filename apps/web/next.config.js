/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/services"],
  // @react-pdf/renderer ships wasm/native layout bits — keep it external so Next
  // requires it at runtime instead of bundling it.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [
      // Google OAuth avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GitHub OAuth avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Generic fallback for any https avatar URL
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
