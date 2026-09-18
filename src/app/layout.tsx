import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maptappers Scoreboard",
  description: "Daily puzzle scores for the Real Maptappers.",
};

const NAV = [
  { href: "/", label: "Submit" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/games", label: "Games" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://assets.halda.ai" />
      </head>
      {/* Blue is the default accent; game pages override via data-accent. */}
      <body className="min-h-full flex flex-col bg-ink text-paper">
        <header className="border-b border-surface-raised">
          <nav className="mx-auto w-full max-w-5xl px-4 py-4 flex items-center gap-6">
            <Link href="/" className="shrink-0">
              {/* Official asset. The wordmark is never typeset as text. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://assets.halda.ai/brand/HaldaWordmark-White.png"
                alt="Halda"
                height={24}
                className="h-6 w-auto"
              />
            </Link>
            <div className="flex items-center gap-5 text-label">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted hover:text-paper transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
