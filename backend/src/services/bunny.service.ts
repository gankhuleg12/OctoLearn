import type { Db, Queryable } from '../db/index.js';
import { HttpError, badRequest, notFound } from '../http/errors.js';
import { decryptSecret, encryptSecret, sha256Hex } from '../lib/crypto.js';
import { getSettings, setSettings } from '../repositories/settings.repo.js';

/**
 * Bunny Stream integration. Credentials live in app_settings (editable from the
 * admin "Тохиргоо" page); the API key is encrypted at rest and never returned.
 *
 * Upload flow: admin panel asks for an upload ticket → we create the video in
 * the library and sign a TUS upload → the browser uploads straight to Bunny →
 * Bunny encodes → webhook / polling calls syncLessonVideo to store the HLS URL,
 * MP4 fallback, duration and status on the lesson.
 */

const KEYS = {
  libraryId: 'bunny.libraryId',
  apiKey: 'bunny.apiKey',
  cdnHostname: 'bunny.cdnHostname',
  apiBaseUrl: 'bunny.apiBaseUrl',
} as const;

export const DEFAULT_BUNNY_API = 'https://video.bunnycdn.com';
/** TUS upload signatures are valid this long. */
const UPLOAD_TTL_SEC = 6 * 3600;

export interface BunnyConfig {
  libraryId: string;
  apiKey: string;
  cdnHostname: string;
  apiBaseUrl: string;
}

export interface BunnyConfigInput {
  libraryId: string;
  /** Empty / omitted keeps the stored key. */
  apiKey?: string;
  cdnHostname: string;
  apiBaseUrl?: string;
}

export type VideoStatus = 'processing' | 'ready' | 'error';

export interface BunnyVideoInfo {
  videoId: string;
  title: string;
  status: VideoStatus;
  /** Raw Bunny status code (0 Created … 4 Finished, 5 Error, 6 UploadFailed). */
  bunnyStatus: number;
  encodeProgress: number;
  lengthSec: number;
  playbackUrl: string;
  fallbackUrl: string | null;
  thumbnailUrl: string;
}

interface BunnyVideoModel {
  guid: string;
  title: string;
  status: number;
  encodeProgress: number;
  length: number;
  availableResolutions: string | null;
  hasMP4Fallback?: boolean;
}

function normalizeHost(host: string) {
  return host.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function playbackUrls(cdnHostname: string, videoId: string) {
  const base = `https://${normalizeHost(cdnHostname)}/${videoId}`;
  return { playlist: `${base}/playlist.m3u8`, thumbnail: `${base}/thumbnail.jpg`, mp4: (res: number) => `${base}/play_${res}p.mp4` };
}

/** Prefer 720p for the MP4 fallback (good quality / size balance on mobile web). */
export function pickFallbackResolution(available: string | null): number | null {
  const heights = (available ?? '')
    .split(',')
    .map((r) => Number.parseInt(r, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (heights.length === 0) return null;
  if (heights.includes(720)) return 720;
  const atMost720 = heights.filter((h) => h <= 720);
  return atMost720.length ? atMost720.at(-1)! : heights[0]!;
}

export function toVideoStatus(bunnyStatus: number): VideoStatus {
  if (bunnyStatus === 4) return 'ready';
  if (bunnyStatus === 5 || bunnyStatus === 6) return 'error';
  return 'processing';
}

export function createBunnyService(db: Db) {
  async function readConfig(q: Queryable = db): Promise<BunnyConfig | null> {
    const s = await getSettings(q, 'bunny.');
    const apiKey = s[KEYS.apiKey] ? decryptSecret(s[KEYS.apiKey]!) : null;
    if (!s[KEYS.libraryId] || !apiKey || !s[KEYS.cdnHostname]) return null;
    return {
      libraryId: s[KEYS.libraryId]!,
      apiKey,
      cdnHostname: s[KEYS.cdnHostname]!,
      apiBaseUrl: s[KEYS.apiBaseUrl] || DEFAULT_BUNNY_API,
    };
  }

  async function requireConfig(): Promise<BunnyConfig> {
    const cfg = await readConfig();
    if (!cfg) {
      throw new HttpError(409, 'BUNNY_NOT_CONFIGURED', 'Bunny Stream тохируулаагүй байна. Тохиргоо цэснээс оруулна уу.');
    }
    return cfg;
  }

  async function bunnyFetch<T>(cfg: BunnyConfig, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${cfg.apiBaseUrl.replace(/\/+$/, '')}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          AccessKey: cfg.apiKey,
          Accept: 'application/json',
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HttpError(502, 'BUNNY_UNREACHABLE', 'Bunny Stream API-тай холбогдож чадсангүй. API хаягаа шалгана уу.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(502, 'BUNNY_AUTH', 'Bunny API key буруу эсвэл энэ library-д эрхгүй байна.');
    }
    if (res.status === 404) throw new HttpError(502, 'BUNNY_NOT_FOUND', 'Bunny дээр library эсвэл видео олдсонгүй.');
    if (!res.ok) throw new HttpError(502, 'BUNNY_ERROR', `Bunny Stream алдаа буцаалаа (${res.status}).`);
    return (await res.json()) as T;
  }

  function toInfo(cfg: BunnyConfig, v: BunnyVideoModel): BunnyVideoInfo {
    const urls = playbackUrls(cfg.cdnHostname, v.guid);
    const fallbackRes = v.hasMP4Fallback === false ? null : pickFallbackResolution(v.availableResolutions);
    return {
      videoId: v.guid,
      title: v.title,
      status: toVideoStatus(v.status),
      bunnyStatus: v.status,
      encodeProgress: v.encodeProgress ?? 0,
      lengthSec: Math.round(v.length ?? 0),
      playbackUrl: urls.playlist,
      fallbackUrl: fallbackRes ? urls.mp4(fallbackRes) : null,
      thumbnailUrl: urls.thumbnail,
    };
  }

  async function getVideo(videoId: string): Promise<BunnyVideoInfo> {
    const cfg = await requireConfig();
    const v = await bunnyFetch<BunnyVideoModel>(cfg, `/library/${encodeURIComponent(cfg.libraryId)}/videos/${encodeURIComponent(videoId)}`);
    return toInfo(cfg, v);
  }

  /** Copies the Bunny video's current state onto every lesson that uses it. */
  async function applyToLessons(info: BunnyVideoInfo) {
    await db.query(
      `UPDATE lessons SET video_url = $2, video_fallback_url = $3, video_status = $4,
              duration_sec = CASE WHEN $5::int > 0 THEN $5::int ELSE duration_sec END
        WHERE bunny_video_id = $1`,
      [info.videoId, info.playbackUrl, info.fallbackUrl, info.status, info.lengthSec],
    );
  }

  return {
    readConfig,

    /** Safe to send to the admin UI: the API key is reduced to a hint. */
    async getPublicConfig() {
      const s = await getSettings(db, 'bunny.');
      const key = s[KEYS.apiKey] ? decryptSecret(s[KEYS.apiKey]!) : null;
      return {
        configured: Boolean(s[KEYS.libraryId] && key && s[KEYS.cdnHostname]),
        libraryId: s[KEYS.libraryId] ?? '',
        cdnHostname: s[KEYS.cdnHostname] ?? '',
        apiBaseUrl: s[KEYS.apiBaseUrl] || DEFAULT_BUNNY_API,
        apiKeySet: Boolean(key),
        apiKeyHint: key ? `••••${key.slice(-4)}` : null,
      };
    },

    async saveConfig(input: BunnyConfigInput) {
      const current = await getSettings(db, 'bunny.');
      if (!input.apiKey && !current[KEYS.apiKey]) throw badRequest('API key оруулна уу.');
      await db.tx((q) =>
        setSettings(q, {
          [KEYS.libraryId]: input.libraryId.trim(),
          [KEYS.cdnHostname]: normalizeHost(input.cdnHostname),
          [KEYS.apiBaseUrl]: (input.apiBaseUrl?.trim() || DEFAULT_BUNNY_API).replace(/\/+$/, ''),
          ...(input.apiKey ? { [KEYS.apiKey]: encryptSecret(input.apiKey.trim()) } : {}),
        }),
      );
    },

    async clearConfig() {
      await setSettings(db, Object.fromEntries(Object.values(KEYS).map((k) => [k, null])));
    },

    /** Lists one video to prove the library id + key work. */
    async testConnection() {
      const cfg = await requireConfig();
      const res = await bunnyFetch<{ totalItems: number }>(
        cfg,
        `/library/${encodeURIComponent(cfg.libraryId)}/videos?page=1&itemsPerPage=1`,
      );
      return { ok: true as const, totalVideos: res.totalItems ?? 0 };
    },

    /**
     * Creates the video object and returns a signed TUS ticket so the browser
     * can upload directly to Bunny without ever seeing the API key.
     */
    async createUpload(title: string) {
      const cfg = await requireConfig();
      const video = await bunnyFetch<BunnyVideoModel>(cfg, `/library/${encodeURIComponent(cfg.libraryId)}/videos`, {
        method: 'POST',
        body: { title },
      });
      const expire = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SEC;
      return {
        videoId: video.guid,
        libraryId: cfg.libraryId,
        endpoint: `${cfg.apiBaseUrl.replace(/\/+$/, '')}/tusupload`,
        signature: sha256Hex(`${cfg.libraryId}${cfg.apiKey}${expire}${video.guid}`),
        expire,
      };
    },

    getVideo,

    /** Pulls the latest state for a video and updates the lessons using it. */
    async syncVideo(videoId: string) {
      const info = await getVideo(videoId);
      await applyToLessons(info);
      return info;
    },

    async syncLesson(lessonId: string) {
      const [row] = await db.query<{ videoId: string | null }>('SELECT bunny_video_id AS "videoId" FROM lessons WHERE id = $1', [
        lessonId,
      ]);
      if (!row) throw notFound('Хичээл олдсонгүй.');
      if (!row.videoId) throw badRequest('Энэ хичээл Bunny видео ашиглаагүй байна.');
      const info = await getVideo(row.videoId);
      await applyToLessons(info);
      return info;
    },

    /** Bunny webhook: only acts on our own library, then re-reads the video from the API. */
    async handleWebhook(payload: { VideoLibraryId?: number | string; VideoGuid?: string }) {
      const cfg = await readConfig();
      if (!cfg || !payload.VideoGuid || String(payload.VideoLibraryId) !== cfg.libraryId) return { handled: false };
      const [row] = await db.query('SELECT 1 FROM lessons WHERE bunny_video_id = $1 LIMIT 1', [payload.VideoGuid]);
      if (!row) return { handled: false };
      const info = await getVideo(payload.VideoGuid);
      await applyToLessons(info);
      return { handled: true, status: info.status };
    },
  };
}

export type BunnyService = ReturnType<typeof createBunnyService>;
