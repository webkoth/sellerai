CREATE TABLE "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"write_mode" text DEFAULT 'off' NOT NULL,
	"warehouse_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_code_check" CHECK ("channels"."code" in ('wb', 'ozon', 'ym', 'kit', 'site')),
	CONSTRAINT "channels_write_mode_check" CHECK ("channels"."write_mode" in ('off', 'dry-run', 'apply'))
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"external_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"content_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"line" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"quantity" integer NOT NULL,
	"lifecycle" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_raw_lifecycle_check" CHECK ("orders_raw"."lifecycle" in ('open', 'shipped', 'cancelled_before_ship', 'returned')),
	CONSTRAINT "orders_raw_quantity_check" CHECK ("orders_raw"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "pool_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"barcode" text NOT NULL,
	"kind" text NOT NULL,
	"delta" integer NOT NULL,
	"base_before" integer NOT NULL,
	"base_after" integer NOT NULL,
	"channel_id" integer,
	"order_id" bigint,
	"snapshot_at" timestamp with time zone,
	"occurred_at" timestamp with time zone NOT NULL,
	"run_id" uuid NOT NULL,
	"detail" jsonb,
	CONSTRAINT "pool_events_kind_check" CHECK ("pool_events"."kind" in ('order', 'cancel', 'wb_signal', 'cold_start', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "pool_items" (
	"barcode" text PRIMARY KEY NOT NULL,
	"base" integer NOT NULL,
	"wb_expected" integer NOT NULL,
	"expected_at" timestamp with time zone,
	"wb_snapshot_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"barcode" text PRIMARY KEY NOT NULL,
	"vendor_code" text,
	"nm_id" bigint,
	"title" text DEFAULT '' NOT NULL,
	"wb_subject" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"write_mode" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"counters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	CONSTRAINT "runs_status_check" CHECK ("runs"."status" in ('running', 'ok', 'partial', 'failed')),
	CONSTRAINT "runs_write_mode_check" CHECK ("runs"."write_mode" in ('off', 'dry-run', 'apply'))
);
--> statement-breakpoint
CREATE TABLE "stock_snapshots_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"run_id" uuid NOT NULL,
	"stocks" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "writes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"channel_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"field" text NOT NULL,
	"before" integer,
	"after" integer NOT NULL,
	"mode" text NOT NULL,
	"applied" boolean NOT NULL,
	"response" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "writes_field_check" CHECK ("writes"."field" in ('stock', 'price')),
	CONSTRAINT "writes_mode_check" CHECK ("writes"."mode" in ('off', 'dry-run', 'apply'))
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_barcode_products_barcode_fk" FOREIGN KEY ("barcode") REFERENCES "public"."products"("barcode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders_raw" ADD CONSTRAINT "orders_raw_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_events" ADD CONSTRAINT "pool_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_events" ADD CONSTRAINT "pool_events_order_id_orders_raw_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders_raw"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_items" ADD CONSTRAINT "pool_items_barcode_products_barcode_fk" FOREIGN KEY ("barcode") REFERENCES "public"."products"("barcode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_snapshots_raw" ADD CONSTRAINT "stock_snapshots_raw_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writes" ADD CONSTRAINT "writes_run_id_runs_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writes" ADD CONSTRAINT "writes_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_code_idx" ON "channels" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_channel_barcode_idx" ON "listings" USING btree ("channel_id","barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_raw_channel_ext_line_idx" ON "orders_raw" USING btree ("channel_id","external_id","line");--> statement-breakpoint
CREATE INDEX "orders_raw_barcode_idx" ON "orders_raw" USING btree ("barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "pool_events_order_kind_idx" ON "pool_events" USING btree ("order_id","kind") WHERE "pool_events"."order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pool_events_snapshot_kind_idx" ON "pool_events" USING btree ("barcode","kind","snapshot_at") WHERE "pool_events"."snapshot_at" is not null;--> statement-breakpoint
CREATE INDEX "runs_job_started_idx" ON "runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_snapshots_channel_taken_idx" ON "stock_snapshots_raw" USING btree ("channel_id","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "writes_run_channel_barcode_field_idx" ON "writes" USING btree ("run_id","channel_id","barcode","field");