import { createRoLife } from '../server/ro-life/server.mjs';
// 282 仙境人生的帳號（Google／LINE）與雲端存檔；vercel.json 把 /api/ro/* 改寫到這裡，資料在 Neon（server/ro-life/schema.sql）。
const app = createRoLife();
export default async function handler(req, res) {
  if (!(await app.handle(req, res))) { res.statusCode = 404; res.end(); }
}
