import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      {
        source: "/capsules",
        destination: "/adventures",
        permanent: true,
      },
      {
        source: "/scenarios/plan-d",
        destination: "/scenarios/adeline-west-to-east",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
