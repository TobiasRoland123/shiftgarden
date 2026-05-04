ALTER TABLE "staffing_rules" ADD COLUMN "weekday" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "staffing_rules_group_weekday_idx" ON "staffing_rules" USING btree ("group_id","weekday");