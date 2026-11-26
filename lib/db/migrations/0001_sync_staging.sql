CREATE TABLE "sync_batches" (
	"sync_id" text NOT NULL,
	"entity" text NOT NULL,
	"seq" integer NOT NULL,
	"records" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_batches_sync_id_entity_seq_pk" PRIMARY KEY("sync_id","entity","seq")
);
--> statement-breakpoint
CREATE TABLE "sync_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"sync_type" text NOT NULL,
	"since" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb
);
