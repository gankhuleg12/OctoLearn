/**
 * h('div', { class: 'x', onclick }, child, 'text')
 * Strings are inserted as text nodes, so user data is always escaped.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}

export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

export function avatar(user, size = '') {
  const initial = (user.name ?? '?').trim().charAt(0).toUpperCase();
  return h('span', { class: `avatar ${size}` }, user.avatarUrl ? h('img', { src: user.avatarUrl, alt: '' }) : initial);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('mn-MN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function progressBar(percent) {
  return h('div', { class: 'progress' }, h('span', { style: `width:${Math.max(0, Math.min(100, percent))}%` }));
}

export function loading() {
  return h('div', { class: 'loading' }, 'Ачаалж байна…');
}

export function pageHead(title, sub, ...actions) {
  return h(
    'div',
    { class: 'page-head' },
    h('div', {}, h('h1', {}, title), sub && h('div', { class: 'sub' }, sub)),
    actions.length ? h('div', { class: 'row' }, actions) : null,
  );
}
