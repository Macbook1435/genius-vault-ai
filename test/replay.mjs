// Replays saved live reads through pipeline v2 (no AI calls). Run: node test/replay.mjs
import fs from "fs";
import { runPipelineV2 } from "../api/_lib/pipeline-v2.js";
const dir = new URL("./fixtures/", import.meta.url).pathname;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const fx = JSON.parse(fs.readFileSync(dir + f, "utf8"));
  const r = await runPipelineV2({ scan: fx.scanV1, raw: fx.raw, verification: fx.verification, serialImage: fx.serialImage, tiebreak: null });
  const conf = Object.entries(r.pipeline.fields).filter(([, v]) => v.status === "confirmed").map(([k, v]) => `${k}=${v.value}`);
  console.log(f.padEnd(24), "number:", String(r.scan.cardNumber).padEnd(8), "| confirmed:", conf.join(", "), "| diff:", JSON.stringify(r.diff));
}
