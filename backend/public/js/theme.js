import { h } from './dom.js';

const KEY = 'octolearn.admin.theme';
const MODES = [
  { value: 'light', icon: '☀️', label: 'Цайвар' },
  { value: 'dark', icon: '🌙', label: 'Бараан' },
  { value: 'system', icon: '💻', label: 'Систем' },
];

export function getThemeMode() {
  try {
    return localStorage.getItem(KEY) || 'light';
  } catch {
    return 'light';
  }
}

export function setThemeMode(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* storage blocked: applies for this page view only */
  }
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

/** Segmented light / dark / system switch. `compact` shows icons only. */
export function themeSwitcher({ compact = false } = {}) {
  const buttons = MODES.map((m) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg-btn',
        role: 'radio',
        title: m.label,
        'aria-label': m.label,
        onclick: () => {
          setThemeMode(m.value);
          sync();
        },
      },
      h('span', { 'aria-hidden': 'true' }, m.icon),
      !compact && m.label,
    ),
  );
  function sync() {
    const mode = getThemeMode();
    buttons.forEach((b, i) => {
      const on = MODES[i].value === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
  }
  sync();
  return h('div', { class: `seg ${compact ? 'compact' : ''}`, role: 'radiogroup', 'aria-label': 'Өнгөний горим' }, buttons);
}
