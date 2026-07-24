import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClashPilot — copiloto de evolução da vila",
    short_name: "ClashPilot",
    description:
      "Análise, histórico e recomendações para evoluir sua vila de Clash of Clans com eficiência.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    // Ícone vetorial na Fase 0. Os PNG 192/512 + maskable e as splash screens de iOS entram
    // na Fase 4, junto com o resto do PWA (docs/09-roadmap.md).
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Plano de evolução", url: "/plano" },
      { name: "Advisor", url: "/advisor" },
    ],
  };
}
