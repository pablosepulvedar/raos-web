import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El distintivo de desarrollo de Next tapa una esquina, y las capturas y los
  // clips del manual se graban contra local
  devIndicators: false,
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
