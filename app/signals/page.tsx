import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AttentionSignals } from "@/components/AttentionSignals";
import { ensureBootstrapped } from "@/lib/ingestion";
import { repo } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  await ensureBootstrapped();
  const signals = [...repo.signals.all()].sort((a, b) => {
    const order = { risk: 0, watch: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  const byProject = new Map<string, number>();
  for (const s of signals) byProject.set(s.projectId, (byProject.get(s.projectId) ?? 0) + 1);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-[240px]">
        <TopBar />
        <div className="px-8 py-7 max-w-[1100px] mx-auto">
          <header className="mb-7">
            <p className="text-[12px] uppercase tracking-wider text-ink-dim font-semibold mb-1.5">Signals</p>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">
              {signals.length} active <span className="text-ink-muted font-normal">across {byProject.size} projects</span>
            </h1>
            <p className="mt-2 text-[13px] text-ink-muted max-w-xl">
              Every alert here was emitted by the signal engine. Click to expand evidence, suggested actions, and source links.
            </p>
          </header>

          <AttentionSignals signals={signals} />
        </div>
      </main>
    </div>
  );
}
