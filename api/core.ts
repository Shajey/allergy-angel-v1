import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Consolidated Core API – single serverless function for trajectory, insights,
 * knowledge, vigilance, and history. Routes via ?action= to reduce Vercel
 * Hobby plan function count.
 *
 * Rewrites:
 *   /api/trajectory         -> /api/core?action=trajectory
 *   /api/insights/feed      -> /api/core?action=insights-feed
 *   /api/insights/feedback  -> /api/core?action=insights-feedback
 *   /api/knowledge/aliases  -> /api/core?action=aliases
 *   /api/vigilance          -> /api/core?action=vigilance
 *   /api/vigilance/recent   -> /api/core?action=vigilance-recent
 *   /api/history            -> /api/core?action=history-list
 *   /api/history/:id        -> /api/core?action=history-detail&id=:id
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === "string" ? req.query.action : "";

  switch (action) {
    case "trajectory": {
      const { default: h } = await import("./_lib/core/_trajectoryHandler.js");
      return h(req, res);
    }
    case "insights-feed": {
      const { default: h } = await import("./_lib/core/_insightsFeedHandler.js");
      return h(req, res);
    }
    case "insights-feedback": {
      const { default: h } = await import("./_lib/core/_insightsFeedbackHandler.js");
      return h(req, res);
    }
    case "aliases": {
      const { default: h } = await import("./_lib/core/_aliasesHandler.js");
      return h(req, res);
    }
    case "vigilance": {
      const { default: h } = await import("./_lib/core/_vigilanceHandler.js");
      return h(req, res);
    }
    case "vigilance-recent": {
      const { default: h } = await import("./_lib/core/_vigilanceRecentHandler.js");
      return h(req, res);
    }
    case "history-list": {
      const { default: h } = await import("./_lib/core/_historyListHandler.js");
      return h(req, res);
    }
    case "history-detail": {
      const { default: h } = await import("./_lib/core/_historyDetailHandler.js");
      return h(req, res);
    }
    default:
      return res.status(400).json({
        error: "Missing or invalid action",
        details:
          "Use ?action=trajectory|insights-feed|insights-feedback|aliases|vigilance|vigilance-recent|history-list|history-detail",
      });
  }
}
