import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { createSocketServer, seedDefaultRooms } from "./lib/socketManager";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

// Attach Socket.io
createSocketServer(httpServer);

httpServer.listen(port, async () => {
  logger.info({ port }, "Server listening");

  try {
    await seedDefaultRooms();
    logger.info("Default rooms seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed default rooms");
  }
});
