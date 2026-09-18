import Link from "next/link";
import { DarkCard } from "@/components/brand";
import { DAILY_GAMES } from "@/lib/games/config";

export default function GamesIndex() {
  return (
    <div className="space-y-6">
      <h1 className="text-title font-extrabold">Games</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {DAILY_GAMES.map((g) => (
          <Link key={g.slug} href={`/games/${g.slug}`}>
            <DarkCard className="hover:bg-surface-raised transition-colors">
              <span className="text-lead font-bold">{g.name}</span>
              <p className="text-label text-muted mt-2">
                {g.direction === 1 ? "Higher is better" : "Lower is better"}
                {g.max ? ` · max ${g.max}` : ""}
                {g.transform === "log10" ? " · log scale" : ""}
              </p>
            </DarkCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
