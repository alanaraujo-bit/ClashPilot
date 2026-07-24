import type { MetadataRoute } from "next";

const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://clashpilot.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: appUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
