import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LanGestLoc",
    short_name: "LanGestLoc",
    theme_color: "#194FD6",
    background_color: "#ffffff",
    display: "standalone",
    icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}