import { createJadeServer } from '../server/jade-table/server.mjs';
// Vercel's WebSocket function transport; Neon PostgreSQL owns the shared room state.
export default createJadeServer({ origins: ['https://htmls-ruddy.vercel.app'] }).server;
