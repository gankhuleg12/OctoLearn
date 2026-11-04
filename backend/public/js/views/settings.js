import { api } from '../api.js';
import { h, mount, pageHead } from '../dom.js';
import { themeSwitcher } from '../theme.js';
import { confirmDialog, field, run, toast } from '../ui.js';

function statusBadge(cfg) {
  return cfg.configured
    ? h('span', { class: 'badge green' }, '● Холбогдсон')
    : h('span', { class: 'badge' }, '○ Тохируулаагүй');
}

function bunnyCard(cfg, rerender) {
  const libraryId = h('input', { required: true, inputmode: 'numeric', placeholder: '123456', value: cfg.libraryId });
  const apiKey = h('input', {
    type: 'password',
    autocomplete: 'off',
    placeholder: cfg.apiKeySet ? `Хадгалсан: ${cfg.apiKeyHint} — солих бол шинээр оруулна` : 'Library-ийн API key',
    required: !cfg.apiKeySet,
  });
  const cdnHostname = h('input', { required: true, placeholder: 'vz-xxxxxxxx-xxx.b-cdn.net', value: cfg.cdnHostname });
  const apiBaseUrl = h('input', { type: 'url', placeholder: 'https://video.bunnycdn.com', value: cfg.apiBaseUrl });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const result = h('p', { class: 'muted', role: 'status' });

  const save = h('button', { class: 'btn', type: 'submit' }, 'Хадгалах');
  const test = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost',
      disabled: !cfg.configured,
      onclick: async () => {
        test.disabled = true;
        result.textContent = 'Шалгаж байна…';
        try {
          const r = await api('/admin/settings/bunny/test', { method: 'POST' });
          result.textContent = `✓ Холболт амжилттай — library-д ${r.totalVideos} видео байна.`;
        } catch (err) {
          result.textContent = `✕ ${err.message}`;
        } finally {
          test.disabled = false;
        }
      },
    },
    'Холболт шалгах',
  );
  const clear =
    cfg.configured &&
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-soft-danger',
        onclick: async () => {
          const ok = await confirmDialog(
            'Bunny тохиргоог устгах уу? Шинэ видео upload хийх боломжгүй болно. Аль хэдийн upload хийсэн хичээлүүд тоглогдсоор байна.',
            { confirmText: 'Устгах' },
          );
          if (ok && (await run(() => api('/admin/settings/bunny', { method: 'DELETE' }), 'Тохиргоо устгагдлаа')) !== undefined) {
            rerender();
          }
        },
      },
      'Устгах',
    );

  const form = h(
    'form',
    {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        save.disabled = true;
        error.textContent = '';
        try {
          await api('/admin/settings/bunny', {
            method: 'PUT',
            body: {
              libraryId: libraryId.value,
              apiKey: apiKey.value,
              cdnHostname: cdnHostname.value,
              apiBaseUrl: apiBaseUrl.value,
            },
          });
          toast('Bunny тохиргоо хадгалагдлаа');
          rerender();
        } catch (err) {
          error.textContent = err.message;
          save.disabled = false;
        }
      },
    },
    field('Video Library ID', libraryId, 'Stream → Library → API хэсэгт байгаа тоо'),
    field('API key', apiKey, 'Library-ийн API key. Сервер дээр шифрлэгдэж хадгалагдах ба буцаж харагдахгүй.'),
    field('CDN hostname', cdnHostname, 'Stream → Library → API → CDN Hostname (жишээ: vz-abc123.b-cdn.net)'),
    field('Bunny Stream API хаяг', apiBaseUrl, 'Ихэвчлэн өөрчлөх шаардлагагүй.'),
    error,
    h('div', { class: 'row' }, save, test, h('span', { class: 'spacer' }), clear),
    result,
  );

  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'row' }, h('h2', { class: 'spacer' }, '☁️ Bunny Stream'), statusBadge(cfg)),
    h('p', { class: 'muted' }, 'Хичээлийн бичлэгийг Bunny Stream-д upload хийж, HLS-ээр (сүлжээнд тохирох чанартай) тоглуулна.'),
    form,
  );
}

function webhookCard() {
  const url = `${location.origin}/api/webhooks/bunny`;
  const input = h('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Webhook URL' });
  return h(
    'div',
    { class: 'card' },
    h('h2', {}, '🔔 Webhook'),
    h(
      'p',
      { class: 'muted' },
      'Bunny encode дуусмагц хичээлийн төлөв, үргэлжлэх хугацаа автоматаар шинэчлэгдэнэ. Library → Webhook хэсэгт энэ хаягийг оруулна уу. ',
      'Webhook тохируулаагүй ч Контент хуудас нээлттэй үед төлөвийг өөрөө шалгадаг.',
    ),
    h(
      'div',
      { class: 'copy-field' },
      input,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast('Хуулагдлаа');
            } catch {
              input.select();
            }
          },
        },
        'Хуулах',
      ),
    ),
  );
}

function appearanceCard() {
  return h(
    'div',
    { class: 'card' },
    h('h2', {}, '🎨 Харагдах байдал'),
    h('p', { class: 'muted' }, 'Админ панелийн өнгөний горим. Энэ төхөөрөмж дээр хадгалагдана.'),
    themeSwitcher(),
  );
}

export async function settingsView(el, { isCurrent }) {
  const cfg = await api('/admin/settings/bunny');
  if (!isCurrent()) return;
  const rerender = () => settingsView(el, { isCurrent });
  mount(
    el,
    pageHead('Тохиргоо', 'Видео хадгалалт ба панелийн тохиргоо'),
    h('div', { class: 'settings-grid' }, bunnyCard(cfg, rerender), h('div', { class: 'grid' }, webhookCard(), appearanceCard())),
  );
}
