import { api } from '../api.js';
import { formatBytes, uploadToBunny, videoStatusText } from '../bunny-upload.js';
import { h, mount, progressBar } from '../dom.js';
import { field, openDialog, toast } from '../ui.js';

/**
 * Create (unitId) or edit (lesson) dialog. The video is either a plain URL
 * (metadata is read to fill in the duration) or a file uploaded to Bunny Stream.
 */
export async function openLessonForm({ unitId, lesson, onSaved }) {
  const isEdit = Boolean(lesson);
  // Load Bunny status first so the dialog opens on the right tab.
  const bunnyCfg = await api('/admin/settings/bunny').catch(() => ({ configured: false }));
  let mode = lesson?.bunnyVideoId ? 'bunny' : 'url';

  const title = h('input', { required: true, maxlength: 120, value: lesson?.title ?? '' });
  const description = h('textarea', { maxlength: 1000 }, lesson?.description ?? '');
  const xp = h('input', { type: 'number', min: 0, max: 1000, required: true, value: lesson?.xp ?? 10 });

  // ---- URL source ---------------------------------------------------------
  const videoUrl = h('input', {
    type: 'url',
    placeholder: 'https://…/lesson.mp4',
    value: lesson && !lesson.bunnyVideoId ? lesson.videoUrl : '',
  });
  const duration = h('input', { type: 'number', min: 1, value: lesson?.durationSec ?? '' });
  const urlStatus = h('span', { class: 'help' });
  const preview = h('video', { controls: true, preload: 'metadata', style: 'width:100%;border-radius:10px;background:#000;max-height:220px', hidden: true });
  let durationTouched = isEdit;
  duration.addEventListener('input', () => (durationTouched = true));

  function loadPreview() {
    const url = videoUrl.value.trim();
    if (!url || !videoUrl.checkValidity()) {
      preview.hidden = true;
      urlStatus.textContent = '';
      return;
    }
    urlStatus.textContent = 'Видеог шалгаж байна…';
    preview.hidden = false;
    preview.src = url;
  }
  preview.addEventListener('loadedmetadata', () => {
    const sec = Math.round(preview.duration);
    urlStatus.textContent = Number.isFinite(sec) ? `✓ Видео ажиллаж байна (${sec} сек)` : '✓ Видео ажиллаж байна';
    if (!durationTouched && Number.isFinite(sec) && sec > 0) duration.value = sec;
  });
  preview.addEventListener('error', () => {
    urlStatus.textContent = '⚠ Видео ачаалагдсангүй — URL-ээ шалгана уу.';
  });
  videoUrl.addEventListener('change', loadPreview);
  if (mode === 'url' && isEdit) queueMicrotask(loadPreview);

  const urlPanel = h(
    'div',
    { class: 'form' },
    field('Видеоны URL (mp4)', videoUrl, urlStatus),
    preview,
    field('Үргэлжлэх хугацаа (сек)', duration),
  );

  // ---- Bunny source -------------------------------------------------------
  /** State of the Bunny side: the video that will be saved on submit. */
  const bunny = { videoId: lesson?.bunnyVideoId ?? null, uploading: null, changed: false };
  const fileInput = h('input', { type: 'file', accept: 'video/*', hidden: true });
  const uploadBox = h('div', { class: 'upload-status', hidden: true });
  const currentBox = h('div', { class: 'upload-status', hidden: !lesson?.bunnyVideoId });

  function renderCurrent(status, progress, lengthSec) {
    mount(
      currentBox,
      h(
        'div',
        { class: 'row' },
        h('strong', {}, bunny.changed ? 'Шинэ бичлэг' : 'Одоогийн видео'),
        h('span', { class: 'muted' }, videoStatusText(status, progress), lengthSec ? ` · ${lengthSec} сек` : ''),
      ),
      h('code', { class: 'muted', style: 'font-size:12px;word-break:break-all' }, bunny.videoId),
      isEdit &&
        !bunny.changed &&
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-ghost',
            style: 'justify-self:start',
            onclick: async (e) => {
              e.target.disabled = true;
              try {
                const info = await api(`/admin/lessons/${lesson.id}/sync-video`, { method: 'POST' });
                renderCurrent(info.status, info.encodeProgress, info.lengthSec);
              } catch (err) {
                toast(err.message, 'error');
              } finally {
                e.target.disabled = false;
              }
            },
          },
          '↻ Төлөв шалгах',
        ),
    );
  }
  if (lesson?.bunnyVideoId) renderCurrent(lesson.videoStatus);

  async function startUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) return toast('Видео файл сонгоно уу.', 'error');
    bunny.uploading?.abort();
    uploadBox.hidden = false;
    const bar = progressBar(0);
    bar.classList.add('purple');
    const label = h('span', { class: 'muted' }, 'Бэлтгэж байна…');
    const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Цуцлах');
    mount(uploadBox, h('div', { class: 'row' }, h('strong', {}, `${file.name} · ${formatBytes(file.size)}`), cancel), bar, label);

    try {
      const job = await uploadToBunny(file, title.value.trim() || file.name, {
        onProgress: (p) => {
          bar.firstElementChild.style.width = `${Math.round(p * 100)}%`;
          label.textContent = `Upload хийж байна… ${Math.round(p * 100)}%`;
        },
      });
      bunny.uploading = job;
      cancel.onclick = () => {
        job.abort();
        bunny.uploading = null;
        uploadBox.hidden = true;
        toast('Upload цуцлагдлаа');
      };
      await job.done;
      if (bunny.uploading !== job) return; // cancelled or replaced
      bunny.uploading = null;
      bunny.videoId = job.videoId;
      bunny.changed = true;
      label.textContent = '✓ Upload дууслаа. Bunny encode хийж эхэллээ — хичээлээ хадгална уу.';
      cancel.remove();
      currentBox.hidden = false;
      renderCurrent('processing');
    } catch (err) {
      bunny.uploading = null;
      label.textContent = `✕ ${err.message}`;
      cancel.remove();
    }
  }

  fileInput.addEventListener('change', () => startUpload(fileInput.files?.[0]));
  const dropzone = h(
    'div',
    {
      class: 'dropzone',
      role: 'button',
      tabindex: 0,
      onclick: () => fileInput.click(),
      onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()),
      ondragover: (e) => (e.preventDefault(), dropzone.classList.add('drag')),
      ondragleave: () => dropzone.classList.remove('drag'),
      ondrop: (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag');
        startUpload(e.dataTransfer?.files?.[0]);
      },
    },
    h('span', { style: 'font-size:28px' }, '☁️'),
    lesson?.bunnyVideoId ? 'Шинэ бичлэгээр солих: файл чирж оруулах эсвэл сонгох' : 'Бичлэгээ энд чирж оруулах эсвэл дарж сонгох',
    h('span', { class: 'help muted' }, 'mp4, mov, webm… Bunny Stream руу шууд upload хийгдэнэ'),
  );

  const bunnyPanel = bunnyCfg.configured
    ? h(
        'div',
        { class: 'form' },
        currentBox,
        dropzone,
        fileInput,
        uploadBox,
        h('span', { class: 'help muted' }, 'Үргэлжлэх хугацааг Bunny encode дуусахад автоматаар авна.'),
      )
    : h(
        'div',
        { class: 'upload-status' },
        h('strong', {}, 'Bunny Stream тохируулаагүй байна'),
        h('span', { class: 'muted' }, 'Upload хийхийн тулд эхлээд Library ID, API key, CDN hostname-аа оруулна уу.'),
        h('a', { href: '#/settings', onclick: () => dialog.close() }, '⚙️ Тохиргоо руу очих'),
      );

  // ---- tabs ---------------------------------------------------------------
  const sourceHost = h('div');
  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Видеоны эх сурвалж' });
  function renderSource() {
    mount(sourceHost, mode === 'url' ? urlPanel : bunnyPanel);
    videoUrl.required = mode === 'url';
    duration.required = mode === 'url';
    mount(
      tabs,
      [
        ['url', '🔗 URL'],
        ['bunny', '☁️ Bunny upload'],
      ].map(([value, label]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: `seg-btn ${mode === value ? 'active' : ''}`,
            'aria-selected': String(mode === value),
            onclick: () => {
              mode = value;
              renderSource();
            },
          },
          label,
        ),
      ),
    );
  }
  renderSource();

  const dialog = openDialog({
    title: isEdit ? 'Хичээл засах' : 'Шинэ хичээл',
    submitText: isEdit ? 'Хадгалах' : 'Нэмэх',
    body: h(
      'div',
      { class: 'form' },
      field('Гарчиг', title),
      field('Тайлбар', description),
      h('div', { class: 'field' }, 'Видео', tabs),
      sourceHost,
      field('XP', xp),
    ),
    async onSubmit() {
      const body = { title: title.value, description: description.value, xp: Number(xp.value) };
      if (mode === 'url') {
        body.videoUrl = videoUrl.value.trim();
        body.durationSec = Number(duration.value);
      } else {
        if (bunny.uploading) throw new Error('Upload дуусахыг хүлээнэ үү.');
        if (!bunny.videoId) throw new Error('Бичлэгээ upload хийнэ үү.');
        // Re-sending an unchanged video would reset its status, so only send a new one.
        if (bunny.changed || !lesson?.bunnyVideoId) body.bunnyVideoId = bunny.videoId;
      }
      if (isEdit) await api(`/admin/lessons/${lesson.id}`, { method: 'PATCH', body });
      else await api(`/admin/units/${unitId}/lessons`, { method: 'POST', body });
      toast(isEdit ? 'Хичээл хадгалагдлаа' : 'Хичээл нэмэгдлээ');
      onSaved();
    },
  });
  // Closing the dialog mid-upload stops the transfer.
  dialog.addEventListener('close', () => bunny.uploading?.abort());
}
