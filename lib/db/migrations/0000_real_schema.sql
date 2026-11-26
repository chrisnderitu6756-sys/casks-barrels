CREATE TYPE "public"."doc_type" AS ENUM('invoice', 'sales-receipt', 'credit-note');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('manager', 'rep');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"area" text,
	"route" text,
	"owner_id" text,
	"parent_id" text,
	"cycle_days" integer NOT NULL,
	"known_service_issue" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"action" text NOT NULL,
	"owner_id" text NOT NULL,
	"review_date" timestamp with time zone NOT NULL,
	"status" "follow_up_status" DEFAULT 'open' NOT NULL,
	"decline_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_visit_id" text
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"orders_imported" integer DEFAULT 0 NOT NULL,
	"source" text,
	"message" text
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"net_amount" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"account_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"doc_type" "doc_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"supplier" text NOT NULL,
	"unit_price_net" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password_hash" text,
	"role" "role" NOT NULL,
	CONSTRAINT "reps_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" integer PRIMARY KEY NOT NULL,
	"stopped_days" integer NOT NULL,
	"changed_cycle_multiplier" double precision NOT NULL,
	"reduced_drop_pct" double precision NOT NULL,
	"min_orders_to_assess" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"rep_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"stock_obs" text DEFAULT '' NOT NULL,
	"display_obs" text DEFAULT '' NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"next_step" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_id_reps_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."reps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;