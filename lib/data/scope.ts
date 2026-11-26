// Role-based visibility. Managers see every account; a rep sees only the
// accounts they own (James: "reps see only their own customers"). Ownership is
// account.ownerId === the signed-in rep's id.
import { auth } from "@/auth";
import type { Account } from "@/lib/types";

export interface Viewer {
  repId: string;
  role: "manager" | "rep";
  isManager: boolean;
}

export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  const role = (session?.user?.role as "manager" | "rep") ?? "rep";
  const repId = session?.user?.id ?? "";
  return { repId, role, isManager: role === "manager" };
}

/** Whether the viewer may see this account. */
export function canSee(viewer: Viewer, account: Pick<Account, "ownerId">): boolean {
  return viewer.isManager || account.ownerId === viewer.repId;
}

/** The set of account ids the viewer may see, or null meaning "all" (manager). */
export function visibleAccountIds(viewer: Viewer, accounts: Account[]): Set<string> | null {
  if (viewer.isManager) return null;
  return new Set(accounts.filter((a) => a.ownerId === viewer.repId).map((a) => a.id));
}
