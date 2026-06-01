require("dotenv").config();
const GeminiWeb2ApiSystem = require("./src/core/GeminiWeb2ApiSystem");

async function main() {
  const system = new GeminiWeb2ApiSystem();
  await system.start();

  async function shutdown(signal) {
    console.log(`[System] Received ${signal}, shutting down...`);
    await system.stop();
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[System] Fatal error:", error);
  process.exit(1);
});
