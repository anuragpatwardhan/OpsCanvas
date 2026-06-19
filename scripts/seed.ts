import { runIngestionCycle } from "../lib/ingestion";
import { resetStore } from "../lib/store";

async function main() {
  console.log("→ resetting store");
  resetStore();
  console.log("→ running ingestion cycle");
  const result = await runIngestionCycle();
  console.log("✓ done", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
