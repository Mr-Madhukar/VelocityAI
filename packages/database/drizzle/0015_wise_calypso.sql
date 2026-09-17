ALTER TABLE "pull_request" ADD COLUMN "linked_head_sha" text;--> statement-breakpoint
ALTER TABLE "pull_request" ADD COLUMN "linked_at" timestamp;