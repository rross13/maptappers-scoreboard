CREATE TYPE "public"."game_slug" AS ENUM('maptap', 'krillion', 'size_it_up', 'globle', 'fermi', 'krillion_infinite');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('web', 'slack_backfill', 'manual_admin');--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"handle" text NOT NULL,
	"slack_user_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_email_lowercase" CHECK ("players"."email" = lower("players"."email"))
);
--> statement-breakpoint
CREATE TABLE "score_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"score_id" uuid NOT NULL,
	"raw_score" double precision NOT NULL,
	"rounds" jsonb,
	"meta" jsonb,
	"source_text" text NOT NULL,
	"parser_version" integer NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"game" "game_slug" NOT NULL,
	"puzzle_date" date NOT NULL,
	"puzzle_number" integer,
	"raw_score" double precision NOT NULL,
	"rounds" jsonb,
	"meta" jsonb,
	"source_text" text NOT NULL,
	"source" "score_source" DEFAULT 'web' NOT NULL,
	"parser_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unparsed_pastes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_text" text NOT NULL,
	"slack_user_id" text,
	"slack_ts" text,
	"reason" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_revisions" ADD CONSTRAINT "score_revisions_score_id_scores_id_fk" FOREIGN KEY ("score_id") REFERENCES "public"."scores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_email_uniq" ON "players" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "players_handle_uniq" ON "players" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "players_slack_uniq" ON "players" USING btree ("slack_user_id");--> statement-breakpoint
CREATE INDEX "score_revisions_score_idx" ON "score_revisions" USING btree ("score_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_player_game_date_uniq" ON "scores" USING btree ("player_id","game","puzzle_date");--> statement-breakpoint
CREATE INDEX "scores_game_date_idx" ON "scores" USING btree ("game","puzzle_date");--> statement-breakpoint
CREATE INDEX "scores_player_date_idx" ON "scores" USING btree ("player_id","puzzle_date");