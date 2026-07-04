import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "frizeo.ro" }],
        destination: "https://www.frizeo.ro/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
