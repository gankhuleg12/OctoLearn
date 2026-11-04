import { api } from '../api.js';
import { h, mount, pageHead } from '../dom.js';
import { leaderboardTable } from './leaderboard.js';

function stat(label, value, hint) {
  return h(
    'div',
    { class: 'card stat' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value),
    hint && h('div', { class: 'hint' }, hint),
  );
}

export async function dashboardView(el, { isCurrent }) {
  const [o, board] = await Promise.all([api('/admin/overview'), api('/admin/leaderboard?limit=10')]);
  if (!isCurrent()) return;

  mount(
    el,
    pageHead('Хяналт', 'Платформын ерөнхий үзүүлэлт'),
    h(
      'div',
      { class: 'grid stats' },
      stat('Суралцагч', o.learners, `+${o.newLearners7d} сүүлийн 7 хоногт`),
      stat('Идэвхтэй (7 хоног)', o.activeLearners7d),
      stat('Дууссан хичээл', o.lessonCompletions),
      stat('Шалгалтын оролдлого', o.quizAttempts, o.quizPassRate == null ? null : `${o.quizPassRate}% тэнцсэн`),
    ),
    h(
      'div',
      { class: 'grid cols-2', style: 'margin-top:14px' },
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'row' }, h('h2', { class: 'spacer' }, '🏆 Топ 10'), h('a', { href: '#/leaderboard' }, 'Бүгдийг харах')),
        leaderboardTable(board.entries),
      ),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'row' }, h('h2', { class: 'spacer' }, '📚 Контент'), h('a', { href: '#/content' }, 'Засах')),
        h(
          'div',
          { class: 'grid stats', style: 'margin-top:12px' },
          stat('Бүлэг', o.units, `${o.publishedUnits} нийтлэгдсэн`),
          stat('Хичээл', o.lessons),
          stat('Шалгалт', o.quizzes),
        ),
      ),
    ),
  );
}
