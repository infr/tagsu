import type { NextConfig } from "next";

/** Static site at the root; BASE_PATH=/tagsu builds it for serving from a /tagsu/ subfolder of another site. */
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.BASE_PATH ?? "",
  trailingSlash: true,
};

export default nextConfig;
