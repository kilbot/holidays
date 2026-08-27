import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      {
        source: "/capsules",
        destination: "/adventures",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
