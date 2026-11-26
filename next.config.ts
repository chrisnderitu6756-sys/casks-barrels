import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components / Partial Prerendering is off: every data page reads live
  // rows from Postgres per request (`export const dynamic = "force-dynamic"`),
  // which Cache Components disallows.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
