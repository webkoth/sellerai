ALTER TABLE "products" ADD COLUMN "wb_chrt_id" bigint;--> statement-breakpoint
ALTER TABLE "writes" ADD COLUMN "uncertain" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "writes" ADD COLUMN "external_sku" text;