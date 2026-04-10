import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@littlecolorbook/shared", "@littlecolorbook/db", "@littlecolorbook/pipeline"],
};

export default nextConfig;
