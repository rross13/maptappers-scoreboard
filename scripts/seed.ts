/**
 * Seeds the seven Real Maptappers.
 *
 * Players exist before anyone opens the app so the Slack backfill has real
 * player ids to attach historical scores to. Idempotent: re-running updates
 * names and Slack ids without creating duplicates.
 */
import { db } from "@/db";
import { players } from "@/db/schema";


const SEED = [
  { email: "riley@halda.ai", displayName: "Riley Ross", handle: "riley", slackUserId: "U02K55E4FU3" },
  { email: "jackson@halda.ai", displayName: "Jackson", handle: "jackson", slackUserId: "U04J4651KFU" },
  { email: "zach.waldrip@halda.ai", displayName: "Zach Waldrip", handle: "zach", slackUserId: "U09QN7A2LCX" },
  { email: "sara@halda.ai", displayName: "Sara Mathew", handle: "sara", slackUserId: "U0AS5DS4W23" },
  { email: "jarom@halda.ai", displayName: "Jarom", handle: "jarom", slackUserId: null },
  { email: "owen@halda.ai", displayName: "Owen", handle: "owen", slackUserId: null },
  { email: "weston@halda.ai", displayName: "Weston Watson", handle: "weston", slackUserId: null },
];

async function main() {
  for (const p of SEED) {
    await db
      .insert(players)
      .values(p)
      .onConflictDoUpdate({
        target: players.email,
        set: {
          displayName: p.displayName,
          handle: p.handle,
          slackUserId: p.slackUserId,
        },
      });
  }
  const rows = await db.select().from(players);
  console.log(`seeded ${rows.length} players:`);
  for (const r of rows.sort((a, b) => a.handle.localeCompare(b.handle))) {
    console.log(`  ${r.handle.padEnd(9)} ${r.email.padEnd(24)} ${r.slackUserId ?? "-"}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
