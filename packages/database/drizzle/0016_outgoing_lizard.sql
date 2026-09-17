CREATE TABLE "agent_provider_key" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text,
	"default_model" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_provider_key" ADD CONSTRAINT "agent_provider_key_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_provider_key" ADD CONSTRAINT "agent_provider_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_provider_key_org_provider_unique" ON "agent_provider_key" USING btree ("organization_id","provider");