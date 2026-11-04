import { api } from '../api.js';
import { avatar, h, mount, pageHead } from '../dom.js';

export function leaderboardTable(entries) {
  if (entries.length === 0) return h('div', { class: 'empty' }, 'Одоогоор суралцагч алга.');
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Суралцагч'), h('th', { class: 'num' }, 'XP'))),
      h(
        'tbody',
        {},
        entries.map((e) =>
          h(
            'tr',
            { class: 'clickable', onclick: () => (location.hash = `#/users/${e.userId}`) },
            h('td', {}, h('span', { class: `rank ${e.rank <= 3 ? `r${e.rank}` : ''}` }, e.rank)),
            h('td', {}, h('div', { class: 'user-cell' }, avatar(e), e.name)),
            h('td', { class: 'num xp' }, `⚡ ${e.totalXp}`),
          ),
        ),
      ),
    ),
  );
}

export async function leaderboardView(el, { isCurrent }) {
  const { entries } = await api('/admin/leaderboard?limit=100');
  if (!isCurrent()) return;
  mount(el, pageHead('XP чансаа', 'Суралцагчдыг нийт XP-ээр эрэмбэлэв (топ 100)'), h('div', { class: 'card' }, leaderboardTable(entries)));
}
