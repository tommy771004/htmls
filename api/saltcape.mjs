import { createSaltServer } from '../server/saltcape/server.mjs';
// Vercel's WebSocket function transport. Matches live in this instance's memory only (see games/199-saltcape/README.md).
export default createSaltServer({ origins: ['https://htmls-ruddy.vercel.app'] }).server;
