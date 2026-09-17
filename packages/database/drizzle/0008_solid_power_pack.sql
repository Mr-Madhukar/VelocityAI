CREATE TABLE "processed_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "ai_review_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "credits_reset_at" timestamp;