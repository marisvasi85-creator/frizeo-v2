import type { MetadataRoute } from "next";
import { buildWebManifest } from "@/lib/pwa/manifestContent";

export default function manifest(): MetadataRoute.Manifest {
  return buildWebManifest({
    startUrl: "/admin/dashboard",
    variant: "admin",
  });
}
