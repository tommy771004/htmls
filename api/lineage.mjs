import { createLineageServer } from '../server/lineage-web/server.mjs';
// 286 天堂人生 · 1.63 獨立運作平台 API（/api/lineage/*）；vercel.json 把 /api/lineage/* 改寫到這裡，支援 Neon PostgreSQL（server/lineage-web/schema.sql）與記憶體模式。
const app = createLineageServer();
export default async function handler(req, res) {
  if (!(await app.handle(req, res))) { res.statusCode = 404; res.end(); }
}
