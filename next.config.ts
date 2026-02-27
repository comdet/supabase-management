import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dockerode", "ssh2", "sqlite3"],
};

export default nextConfig;
