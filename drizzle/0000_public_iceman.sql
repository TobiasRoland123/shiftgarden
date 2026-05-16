    CREATE TABLE "health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text DEFAULT 'database' NOT NULL,
	"is_healthy" boolean DEFAULT true NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
