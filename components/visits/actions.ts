"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { Visit } from "@/lib/types";

export interface LogVisitInput {
  accountId: string;
  repId: string;
  /** ISO timestamp */
  at: string;
  stockObs: string;
  displayObs: string;
  feedback: string;
  nextStep: string;
  createFollowUp: boolean;
}

const FOLLOW_UP_DAYS = 3;

export async function logVisit(input: LogVisitInput): Promise<Visit> {
  const id = crypto.randomUUID();
  const parsed = new Date(input.at);
  const at = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const nextStep = (input.nextStep ?? "").trim();

  const row = {
    id,
    accountId: input.accountId,
    repId: input.repId,
    at,
    stockObs: (input.stockObs ?? "").trim(),
    displayObs: (input.displayObs ?? "").trim(),
    feedback: (input.feedback ?? "").trim(),
    nextStep,
  };

  await db.insert(schema.visits).values(row);

  if (input.createFollowUp && nextStep) {
    await db.insert(schema.followUps).values({
      id: crypto.randomUUID(),
      accountId: input.accountId,
      action: nextStep,
      ownerId: input.repId,
      reviewDate: new Date(Date.now() + FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000),
      status: "open",
      fromVisitId: id,
    });
  }

  revalidatePath("/visits");
  revalidatePath("/follow-ups");

  return { ...row, at: at.toISOString() };
}
