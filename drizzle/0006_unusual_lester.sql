CREATE TABLE "institution_opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
CREATE INDEX "institution_opening_hours_day_of_week_idx" ON "institution_opening_hours" USING btree ("day_of_week");
--> statement-breakpoint
INSERT INTO "institution_opening_hours" ("day_of_week", "start_time", "end_time") VALUES
	('monday', '00:00', '23:59'),
	('tuesday', '00:00', '23:59'),
	('wednesday', '00:00', '23:59'),
	('thursday', '00:00', '23:59'),
	('friday', '00:00', '23:59'),
	('saturday', '00:00', '23:59'),
	('sunday', '00:00', '23:59');
