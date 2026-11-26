ALTER TABLE "import_runs" ADD COLUMN "poll_seconds" integer;--> statement-breakpoint
ALTER TABLE "sync_sessions" ADD COLUMN "poll_seconds" integer;