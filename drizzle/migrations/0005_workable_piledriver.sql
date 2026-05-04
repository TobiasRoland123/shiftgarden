ALTER TABLE "groups" ADD COLUMN "uniform_week" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staffing_rules" ADD COLUMN "template_id" uuid;