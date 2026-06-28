import type { MetadataRoute } from "next";
import { LEGAL_COMPANY } from "@/lib/legal/company";

const publicPaths = [
  "",
  "/pricing",
  "/contact",
  "/signup",
  "/login",
  "/privacy",
  "/terms",
  "/cookies",
  "/barbers",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = LEGAL_COMPANY.website.replace(/\/$/, "");
  const lastModified = new Date();

  return publicPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.6,
  }));
}
