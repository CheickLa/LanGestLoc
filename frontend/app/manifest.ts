import type { MetadataRoute } from "next";

import { HOME_PATH } from "@/lib/auth";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LanGestLoc",
    short_name: "LanGestLoc",
    start_url: HOME_PATH,
    theme_color: "#194FD6",
    background_color: "#ffffff",
    display: "standalone",
    icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}