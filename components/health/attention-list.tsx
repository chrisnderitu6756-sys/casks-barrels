import Link from "next/link";
import { Avatar, Card, Trend } from "@/components/ui";
import { FLAG_LABEL } from "@/lib/health";
import type { Row } from "./portfolio";

export function AttentionList({ rows }: { rows: Row[] }) {
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {rows.map(({ account, health, headlineName }) => (
        <Link
          key={account.id}
          href={`/customers/${account.id}`}
          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
        >
          <Avatar name={account.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-ink">{account.name}</div>
            <div className="truncate text-sm text-muted">
              {health.flags[0] ? FLAG_LABEL[health.flags[0]] : "Worth a look"} · {account.area}
            </div>
          </div>
          {health.headline && headlineName ? (
            <div className="hidden text-right sm:block">
              <div className="text-sm text-muted">{headlineName}</div>
              <Trend pct={health.headline.pctChange} />
            </div>
          ) : null}
          <span aria-hidden className="text-faint">→</span>
        </Link>
      ))}
    </Card>
  );
}
