CREATE TABLE "repo_context" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"overview" text DEFAULT '' NOT NULL,
	"stack" text DEFAULT '' NOT NULL,
	"tree" text DEFAULT '[]' NOT NULL,
	"summaries" text DEFAULT '{}' NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"last_sha" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repo_context_repository_id_unique" UNIQUE("repository_id")
);
--> statement-breakpoint
ALTER TABLE "repo_context" ADD CONSTRAINT "repo_context_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_context" ADD CONSTRAINT "repo_context_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;