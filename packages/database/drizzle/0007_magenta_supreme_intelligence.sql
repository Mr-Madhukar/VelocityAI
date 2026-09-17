ALTER TABLE "prd" ADD COLUMN "required_disciplines" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "estimated_hours" integer;