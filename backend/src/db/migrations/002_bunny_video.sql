-- Admin-editable settings (e.g. Bunny Stream credentials). Secret values are
-- stored encrypted by the application (see src/lib/crypto.ts).
CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lessons can now be hosted on Bunny Stream. `video_url` stays the playback
-- URL (HLS playlist for Bunny); `video_fallback_url` is an MP4 rendition for
-- players without HLS (web). Bunny encodes after upload, so a lesson can be
-- 'processing' for a few minutes.
ALTER TABLE lessons
  ADD COLUMN bunny_video_id     text,
  ADD COLUMN video_fallback_url text,
  ADD COLUMN video_status       text NOT NULL DEFAULT 'ready'
    CHECK (video_status IN ('ready', 'processing', 'error'));

CREATE INDEX lessons_bunny_video_idx ON lessons (bunny_video_id) WHERE bunny_video_id IS NOT NULL;
