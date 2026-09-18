import Link from "next/link";

export function Toggles({
  options,
  active,
  hrefFor,
}: {
  options: { key: string; label: string }[];
  active: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Link
          key={o.key}
          href={hrefFor(o.key)}
          className={
            o.key === active
              ? "rounded-pill bg-accent text-ink text-label font-bold px-3.5 py-1.5"
              : "rounded-pill bg-surface-raised text-muted text-label px-3.5 py-1.5 hover:text-paper"
          }
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
