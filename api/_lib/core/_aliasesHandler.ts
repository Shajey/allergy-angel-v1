import type { VercelRequest, VercelResponse } from "@vercel/node";
import { DRUGS } from "../knowledge/drugs.registry.js";
import { SUPPLEMENTS } from "../knowledge/supplements.registry.js";
import { FOODS } from "../knowledge/foods.registry.js";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const aliasMap: Record<string, string> = {};

  for (const entity of [...DRUGS, ...SUPPLEMENTS, ...FOODS]) {
    for (const alias of entity.aliases) {
      const key = normalize(alias);
      if (!aliasMap[key]) {
        aliasMap[key] = entity.id;
      }
    }
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).json(aliasMap);
}
