ALTER TABLE "channels" ADD COLUMN "orders_baseline_run_id" uuid;--> statement-breakpoint
ALTER TABLE "orders_raw" ADD COLUMN "first_run_id" uuid;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_orders_baseline_run_id_runs_run_id_fk" FOREIGN KEY ("orders_baseline_run_id") REFERENCES "public"."runs"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders_raw" ADD CONSTRAINT "orders_raw_first_run_id_runs_run_id_fk" FOREIGN KEY ("first_run_id") REFERENCES "public"."runs"("run_id") ON DELETE no action ON UPDATE no action;