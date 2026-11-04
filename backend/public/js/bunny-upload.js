import { api } from './api.js';

// tus-js-client is only needed for uploads, so it is loaded on first use.
const TUS_SRC = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js';
let tusPromise;

function loadTus() {
  if (window.tus) return Promise.resolve(window.tus);
  tusPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TUS_SRC;
    s.onload = () => resolve(window.tus);
    s.onerror = () => {
      tusPromise = undefined;
      reject(new Error('Upload сан ачаалагдсангүй. Интернэт холболтоо шалгана уу.'));
    };
    document.head.append(s);
  });
  return tusPromise;
}

/**
 * Uploads a file straight to Bunny Stream (resumable TUS). The server only
 * creates the video and signs the upload, so the API key never reaches the
 * browser. Returns { videoId, done, abort }.
 */
export async function uploadToBunny(file, title, { onProgress } = {}) {
  const [ticket, tus] = await Promise.all([
    api('/admin/bunny/uploads', { method: 'POST', body: { title } }),
    loadTus(),
  ]);

  let upload;
  const done = new Promise((resolve, reject) => {
    upload = new tus.Upload(file, {
      endpoint: ticket.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        AuthorizationSignature: ticket.signature,
        AuthorizationExpire: String(ticket.expire),
        VideoId: ticket.videoId,
        LibraryId: String(ticket.libraryId),
      },
      metadata: { filetype: file.type || 'video/mp4', title },
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onError: (err) => reject(new Error(`Upload амжилтгүй: ${err?.message ?? err}`)),
      onSuccess: () => resolve(ticket.videoId),
    });
    upload.start();
  });

  return { videoId: ticket.videoId, done, abort: () => upload?.abort(true).catch(() => {}) };
}

const STATUS_TEXT = {
  ready: '✓ Бэлэн',
  processing: '⏳ Bunny encode хийж байна',
  error: '⚠ Encode амжилтгүй',
};

export function videoStatusText(status, progress) {
  if (status === 'processing' && progress) return `${STATUS_TEXT.processing} (${progress}%)`;
  return STATUS_TEXT[status] ?? status;
}

export function formatBytes(n) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
