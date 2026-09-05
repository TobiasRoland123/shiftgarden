CREATE TYPE "public"."planning_draft_state" AS ENUM('preparation', 'generating', 'failed', 'editing', 'reviewing', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."planning_exception_owner_type" AS ENUM('institution', 'group', 'staff');--> statement-breakpoint
CREATE TYPE "public"."planning_exception_type" AS ENUM('closed_date', 'opening_replacement', 'leave', 'sickness', 'partial_unavailability', 'meeting', 'training', 'staffing_replacement');--> statement-breakpoint
CREATE TYPE "public"."planning_generation_status" AS ENUM('pending', 'running', 'validation_failed', 'accepted', 'failed', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."planning_period_lifecycle" AS ENUM('preparation', 'generating', 'editing', 'published', 'discarded', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."planning_proposal_operation_type" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."planning_proposal_state" AS ENUM('pending', 'applied', 'discarded', 'superseded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."planning_source_type" AS ENUM('institution_settings', 'institution_opening_hours', 'group', 'group_staff_rules', 'staff', 'staff_availability', 'staff_membership', 'exception', 'event', 'published_version');--> statement-breakpoint
CREATE TABLE "institution_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Europe/Copenhagen' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institution_settings_singleton_check" CHECK ("institution_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "planning_coordination" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_coordination_singleton_check" CHECK ("planning_coordination"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "planning_draft_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"actual_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_draft_shifts_time_order_check" CHECK ("planning_draft_shifts"."end_time" > "planning_draft_shifts"."start_time")
);
--> statement-breakpoint
CREATE TABLE "planning_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"base_published_version_id" uuid,
	"revision" integer DEFAULT 1 NOT NULL,
	"state" "planning_draft_state" DEFAULT 'preparation' NOT NULL,
	"input_snapshot" jsonb,
	"input_fingerprint" text,
	"last_validation" jsonb,
	"ai_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"undo_snapshot" jsonb,
	"undo_actor_id" uuid,
	"undo_revision" integer,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discarded_at" timestamp with time zone,
	CONSTRAINT "planning_drafts_revision_check" CHECK ("planning_drafts"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "planning_exception_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exception_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "planning_exception_intervals_time_order_check" CHECK ("planning_exception_intervals"."end_time" > "planning_exception_intervals"."start_time")
);
--> statement-breakpoint
CREATE TABLE "planning_exception_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exception_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "planning_exception_owner_type" NOT NULL,
	"institution_id" integer,
	"group_id" uuid,
	"staff_member_id" uuid,
	"type" "planning_exception_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"reason" text,
	"min_staff" integer,
	"min_pedagogs" integer,
	"counts_toward_weekly_hours" boolean DEFAULT true NOT NULL,
	"source_revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_exceptions_date_order_check" CHECK ("planning_exceptions"."end_date" >= "planning_exceptions"."start_date"),
	CONSTRAINT "planning_exceptions_owner_check" CHECK ((
        ("planning_exceptions"."owner_type" = 'institution' AND "planning_exceptions"."institution_id" IS NOT NULL AND "planning_exceptions"."group_id" IS NULL AND "planning_exceptions"."staff_member_id" IS NULL)
        OR ("planning_exceptions"."owner_type" = 'group' AND "planning_exceptions"."institution_id" IS NULL AND "planning_exceptions"."group_id" IS NOT NULL AND "planning_exceptions"."staff_member_id" IS NULL)
        OR ("planning_exceptions"."owner_type" = 'staff' AND "planning_exceptions"."institution_id" IS NULL AND "planning_exceptions"."group_id" IS NULL AND "planning_exceptions"."staff_member_id" IS NOT NULL)
      )),
	CONSTRAINT "planning_exceptions_time_pair_check" CHECK (("planning_exceptions"."start_time" IS NULL AND "planning_exceptions"."end_time" IS NULL) OR ("planning_exceptions"."start_time" IS NOT NULL AND "planning_exceptions"."end_time" IS NOT NULL AND "planning_exceptions"."end_time" > "planning_exceptions"."start_time")),
	CONSTRAINT "planning_exceptions_minima_check" CHECK (("planning_exceptions"."min_staff" IS NULL AND "planning_exceptions"."min_pedagogs" IS NULL) OR ("planning_exceptions"."min_staff" IS NOT NULL AND "planning_exceptions"."min_pedagogs" IS NOT NULL AND "planning_exceptions"."min_staff" >= 0 AND "planning_exceptions"."min_pedagogs" >= 0)),
	CONSTRAINT "planning_exceptions_owner_type_check" CHECK ((
        ("planning_exceptions"."owner_type" = 'institution' AND "planning_exceptions"."type" IN ('closed_date', 'opening_replacement', 'meeting', 'training'))
        OR ("planning_exceptions"."owner_type" = 'group' AND "planning_exceptions"."type" IN ('staffing_replacement', 'meeting', 'training'))
        OR ("planning_exceptions"."owner_type" = 'staff' AND "planning_exceptions"."type" IN ('leave', 'sickness', 'partial_unavailability', 'meeting', 'training'))
      )),
	CONSTRAINT "planning_exceptions_type_fields_check" CHECK ((
        ("planning_exceptions"."type" = 'closed_date' AND "planning_exceptions"."start_time" IS NULL AND "planning_exceptions"."end_time" IS NULL AND "planning_exceptions"."min_staff" IS NULL AND "planning_exceptions"."min_pedagogs" IS NULL)
        OR ("planning_exceptions"."type" = 'opening_replacement' AND "planning_exceptions"."min_staff" IS NULL AND "planning_exceptions"."min_pedagogs" IS NULL)
        OR ("planning_exceptions"."type" = 'staffing_replacement' AND "planning_exceptions"."start_time" IS NOT NULL AND "planning_exceptions"."end_time" IS NOT NULL AND "planning_exceptions"."min_staff" IS NOT NULL AND "planning_exceptions"."min_pedagogs" IS NOT NULL)
        OR ("planning_exceptions"."type" IN ('leave', 'sickness') AND "planning_exceptions"."min_staff" IS NULL AND "planning_exceptions"."min_pedagogs" IS NULL)
        OR ("planning_exceptions"."type" = 'partial_unavailability' AND "planning_exceptions"."start_time" IS NOT NULL AND "planning_exceptions"."end_time" IS NOT NULL AND "planning_exceptions"."min_staff" IS NULL AND "planning_exceptions"."min_pedagogs" IS NULL)
        OR ("planning_exceptions"."type" IN ('meeting', 'training') AND "planning_exceptions"."start_time" IS NOT NULL AND "planning_exceptions"."end_time" IS NOT NULL AND "planning_exceptions"."min_staff" IS NULL AND "planning_exceptions"."min_pedagogs" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "planning_generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"slice_start_date" date,
	"slice_end_date" date,
	"model" text NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"output_snapshot" jsonb,
	"validation_snapshot" jsonb,
	"status" "planning_generation_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_generation_attempts_number_check" CHECK ("planning_generation_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "planning_generation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"expected_draft_revision" integer NOT NULL,
	"input_fingerprint" text NOT NULL,
	"scope" jsonb NOT NULL,
	"model" text NOT NULL,
	"status" "planning_generation_status" DEFAULT 'pending' NOT NULL,
	"outcome_draft_revision" integer,
	"outcome_json" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "planning_generation_requests_expected_revision_check" CHECK ("planning_generation_requests"."expected_draft_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "planning_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" text DEFAULT 'Europe/Copenhagen' NOT NULL,
	"lifecycle" "planning_period_lifecycle" DEFAULT 'preparation' NOT NULL,
	"current_published_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discarded_at" timestamp with time zone,
	CONSTRAINT "planning_periods_date_order_check" CHECK ("planning_periods"."end_date" >= "planning_periods"."start_date")
);
--> statement-breakpoint
CREATE TABLE "planning_proposal_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"operation_index" integer NOT NULL,
	"operation" "planning_proposal_operation_type" NOT NULL,
	"target_shift_id" uuid,
	"actual_date" date,
	"staff_member_id" uuid,
	"start_time" time,
	"end_time" time,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	CONSTRAINT "planning_proposal_operations_index_check" CHECK ("planning_proposal_operations"."operation_index" >= 0)
);
--> statement-breakpoint
CREATE TABLE "planning_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_revision" integer NOT NULL,
	"input_fingerprint" text NOT NULL,
	"scope" jsonb NOT NULL,
	"request_text" text NOT NULL,
	"before_validation" jsonb NOT NULL,
	"after_validation" jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "planning_proposal_state" DEFAULT 'pending' NOT NULL,
	"application_outcome" jsonb,
	"application_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "planning_proposals_revision_check" CHECK ("planning_proposals"."draft_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "planning_published_version_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"staff_member_id" uuid,
	"staff_first_name" text NOT NULL,
	"staff_last_name" text NOT NULL,
	"staff_role" "staff_role" NOT NULL,
	"actual_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "planning_published_version_shifts_time_order_check" CHECK ("planning_published_version_shifts"."end_time" > "planning_published_version_shifts"."start_time")
);
--> statement-breakpoint
CREATE TABLE "planning_published_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"prior_version_id" uuid,
	"input_snapshot" jsonb NOT NULL,
	"input_fingerprint" text NOT NULL,
	"validation_snapshot" jsonb NOT NULL,
	"display_snapshot" jsonb NOT NULL,
	"publication_request_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_source_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "planning_source_type" NOT NULL,
	"source_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_source_revisions_revision_check" CHECK ("planning_source_revisions"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "planning_draft_shifts" ADD CONSTRAINT "planning_draft_shifts_draft_id_planning_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."planning_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_draft_shifts" ADD CONSTRAINT "planning_draft_shifts_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_drafts" ADD CONSTRAINT "planning_drafts_period_id_planning_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."planning_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_exception_intervals" ADD CONSTRAINT "planning_exception_intervals_exception_id_planning_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."planning_exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_exception_participants" ADD CONSTRAINT "planning_exception_participants_exception_id_planning_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."planning_exceptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_exception_participants" ADD CONSTRAINT "planning_exception_participants_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_exceptions" ADD CONSTRAINT "planning_exceptions_institution_id_institution_settings_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_exceptions" ADD CONSTRAINT "planning_exceptions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_exceptions" ADD CONSTRAINT "planning_exceptions_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "planning_generation_requests_request_id_idx" ON "planning_generation_requests" USING btree ("request_id");--> statement-breakpoint
ALTER TABLE "planning_generation_attempts" ADD CONSTRAINT "planning_generation_attempts_request_id_planning_generation_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."planning_generation_requests"("request_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_generation_requests" ADD CONSTRAINT "planning_generation_requests_period_id_planning_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."planning_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_generation_requests" ADD CONSTRAINT "planning_generation_requests_draft_id_planning_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."planning_drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_periods" ADD CONSTRAINT "planning_periods_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_proposal_operations" ADD CONSTRAINT "planning_proposal_operations_proposal_id_planning_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."planning_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_proposals" ADD CONSTRAINT "planning_proposals_draft_id_planning_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."planning_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_published_version_shifts" ADD CONSTRAINT "planning_published_version_shifts_version_id_planning_published_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."planning_published_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_published_version_shifts" ADD CONSTRAINT "planning_published_version_shifts_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_published_versions" ADD CONSTRAINT "planning_published_versions_period_id_planning_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."planning_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planning_draft_shifts_draft_id_idx" ON "planning_draft_shifts" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "planning_draft_shifts_staff_date_idx" ON "planning_draft_shifts" USING btree ("staff_member_id","actual_date");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_drafts_active_period_idx" ON "planning_drafts" USING btree ("period_id") WHERE "planning_drafts"."discarded_at" IS NULL;--> statement-breakpoint
CREATE INDEX "planning_drafts_period_id_idx" ON "planning_drafts" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "planning_exception_intervals_exception_idx" ON "planning_exception_intervals" USING btree ("exception_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_exception_participants_exception_staff_idx" ON "planning_exception_participants" USING btree ("exception_id","staff_member_id");--> statement-breakpoint
CREATE INDEX "planning_exception_participants_staff_idx" ON "planning_exception_participants" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "planning_exceptions_group_dates_idx" ON "planning_exceptions" USING btree ("group_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "planning_exceptions_staff_dates_idx" ON "planning_exceptions" USING btree ("staff_member_id","start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_generation_attempts_request_number_idx" ON "planning_generation_attempts" USING btree ("request_id","attempt_number");--> statement-breakpoint
CREATE INDEX "planning_generation_requests_draft_id_idx" ON "planning_generation_requests" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "planning_periods_group_id_idx" ON "planning_periods" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "planning_periods_dates_idx" ON "planning_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "planning_periods_current_version_idx" ON "planning_periods" USING btree ("current_published_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_proposal_operations_order_idx" ON "planning_proposal_operations" USING btree ("proposal_id","operation_index");--> statement-breakpoint
CREATE INDEX "planning_proposal_operations_target_idx" ON "planning_proposal_operations" USING btree ("target_shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_proposals_request_id_idx" ON "planning_proposals" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "planning_proposals_draft_id_idx" ON "planning_proposals" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_proposals_application_request_idx" ON "planning_proposals" USING btree ("application_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_published_version_shifts_stable_shift_idx" ON "planning_published_version_shifts" USING btree ("version_id","shift_id");--> statement-breakpoint
CREATE INDEX "planning_published_version_shifts_staff_date_idx" ON "planning_published_version_shifts" USING btree ("staff_member_id","actual_date");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_published_versions_period_number_idx" ON "planning_published_versions" USING btree ("period_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_published_versions_publication_request_idx" ON "planning_published_versions" USING btree ("publication_request_id");--> statement-breakpoint
CREATE INDEX "planning_published_versions_period_id_idx" ON "planning_published_versions" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_source_revisions_source_idx" ON "planning_source_revisions" USING btree ("source_type","source_id");--> statement-breakpoint
INSERT INTO "institution_settings" ("id", "timezone", "revision") VALUES (1, 'Europe/Copenhagen', 0) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_coordination" ("id", "revision") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "planning_drafts" ADD CONSTRAINT "planning_drafts_base_version_fk" FOREIGN KEY ("base_published_version_id") REFERENCES "public"."planning_published_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "planning_periods" ADD CONSTRAINT "planning_periods_current_version_fk" FOREIGN KEY ("current_published_version_id") REFERENCES "public"."planning_published_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "planning_published_versions" ADD CONSTRAINT "planning_published_versions_prior_version_fk" FOREIGN KEY ("prior_version_id") REFERENCES "public"."planning_published_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "planning_periods" ADD CONSTRAINT "planning_periods_group_date_overlap_excl" EXCLUDE USING gist ("group_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&) WHERE ("lifecycle" NOT IN ('discarded', 'abandoned'));--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'institution_settings', '1', 1 ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'institution_opening_hours', '1', 1 WHERE EXISTS (SELECT 1 FROM "institution_opening_hours") ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'group', "id"::text, 1 FROM "groups" ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'group_staff_rules', "group_id"::text, 1 FROM "group_staff_rules" GROUP BY "group_id" ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'staff', "id"::text, 1 FROM "staff_members" ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'staff_availability', "staff_member_id"::text, 1 FROM "staff_member_availability" GROUP BY "staff_member_id" ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "planning_source_revisions" ("source_type", "source_id", "revision") SELECT 'staff_membership', "staff_member_id"::text || ':' || "group_id"::text, 1 FROM "staff_member_groups" ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_planning_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Published planning history is immutable'; END; $$;--> statement-breakpoint
CREATE TRIGGER planning_published_versions_immutable BEFORE UPDATE OR DELETE ON "planning_published_versions" FOR EACH ROW EXECUTE FUNCTION prevent_planning_history_mutation();--> statement-breakpoint
CREATE TRIGGER planning_published_version_shifts_immutable BEFORE UPDATE OR DELETE ON "planning_published_version_shifts" FOR EACH ROW EXECUTE FUNCTION prevent_planning_history_mutation();--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_planning_exception_owner_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ROW(NEW.owner_type, NEW.institution_id, NEW.group_id, NEW.staff_member_id) IS DISTINCT FROM ROW(OLD.owner_type, OLD.institution_id, OLD.group_id, OLD.staff_member_id) THEN RAISE EXCEPTION 'Planning exception owners are immutable'; END IF; RETURN NEW; END; $$;--> statement-breakpoint
CREATE TRIGGER planning_exceptions_owner_immutable BEFORE UPDATE OF "owner_type", "institution_id", "group_id", "staff_member_id" ON "planning_exceptions" FOR EACH ROW EXECUTE FUNCTION prevent_planning_exception_owner_change();
