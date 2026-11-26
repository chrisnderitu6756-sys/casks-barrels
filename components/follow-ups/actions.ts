"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export async function addFollowUp(input: {
  accountId: string;
  action: string;
  ownerId: string;
  reviewDate: string;
  fromVisitId?: string;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(schema.followUps).values({
    id,
    accountId: input.accountId,
    action: input.action,
    ownerId: input.ownerId,
    reviewDate: new Date(input.reviewDate),
    status: "open",
    createdAt: new Date(),
    fromVisitId: input.fromVisitId ?? null,
  });
  revalidatePath("/follow-ups");
  return { id };
}

export async function assignFollowUp(id: string, ownerId: string, reviewDate: string): Promise<void> {
  await db
    .update(schema.followUps)
    .set({ ownerId, reviewDate: new Date(reviewDate) })
    .where(eq(schema.followUps.id, id));
  revalidatePath("/follow-ups");
}

export async function closeFollowUp(id: string, declineReason?: string): Promise<void> {
  await db
    .update(schema.followUps)
    .set({ status: "closed", declineReason: declineReason?.trim() || null })
    .where(eq(schema.followUps.id, id));
  revalidatePath("/follow-ups");
}

export async function reopenFollowUp(id: string): Promise<void> {
  await db
    .update(schema.followUps)
    .set({ status: "open", declineReason: null })
    .where(eq(schema.followUps.id, id));
  revalidatePath("/follow-ups");
}
