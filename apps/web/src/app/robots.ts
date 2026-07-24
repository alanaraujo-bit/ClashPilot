import type { MetadataRoute } from "next";

const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://clashpilot.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Área logada não tem valor de busca e não deve ser indexada.
        disallow: ["/api/", "/dashboard", "/plano", "/advisor", "/vila", "/config"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
