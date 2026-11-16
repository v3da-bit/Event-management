import { MongoMemoryServer } from "mongodb-memory-server";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const dbPath = resolve(".local/mongo");
mkdirSync(dbPath, { recursive: true });
const mongo = await MongoMemoryServer.create({
  instance: { port: 27017, dbPath, storageEngine: "wiredTiger" },
});
console.log(
  `Development MongoDB listening at ${mongo.getUri("everafter")}. Data persists in .local/mongo.`,
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await mongo.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
