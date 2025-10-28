/*
  Refresh snapshots for all active projects.
  Usage: ts-node scripts/refreshSnapshotsForAllProjects.ts (or npm script)
*/
import { prisma } from "@/server/db";
import { refreshSnapshotsForProject } from "@/server/services/snapshotOrchestrator";
import type { ProjectContext } from "@/server/services/metricAssembler";

async function main() {
  const projects = await prisma.project.findMany({ where: { isActive: true } });
  const results: Array<{ projectId: string; ok: boolean }> = [];
  for (const p of projects) {
    const ctx: ProjectContext = { id: p.id, contractAddress: p.contractAddress, chain: p.chain };
    try {
      const res = await refreshSnapshotsForProject(ctx, { force: true });
      console.log(`[snapshots] ${p.name} (${p.chain}:${p.contractAddress}) ->`, res.outcomes.map(o => `${o.metric}:${o.refreshed ? 'ok' : 'skip'}`).join(", "));
      results.push({ projectId: p.id, ok: true });
    } catch (e) {
      console.error(`[snapshots] failed for ${p.name} (${p.id}):`, e);
      results.push({ projectId: p.id, ok: false });
    }
  }
  const ok = results.filter(r => r.ok).length;
  console.log(`[snapshots] Completed. Success: ${ok}/${results.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
