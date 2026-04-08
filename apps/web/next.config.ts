import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@littlecolorbook/shared", "@littlecolorbook/db"],
};

export default nextConfig;
