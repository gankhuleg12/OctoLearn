import { api, session } from '../api.js';
import { avatar, formatDate, h, mount, progressBar } from '../dom.js';
import { confirmDialog, run } from '../ui.js';

const WEEKDAYS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
const STATE_LABEL = { completed: 'Дууссан', active: 'Идэвхтэй', locked: 'Түгжээтэй' };

function stat(label, value) {
  return h('div', { class: 'card stat' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value));
}

function weeklyChart(days) {
  const max = Math.max(10, ...days.map((d) => d.xp));
  return h(
    'div',
    { class: 'week', role: 'img', 'aria-label': 'Сүүлийн 7 хоногийн XP' },
    days.map((d) =>
      h(
        'div',
        { class: 'bar', title: `${d.date}: ${d.xp} XP` },
        h('span', {}, d.xp || ''),
        h('i', { style: `height:${Math.round((d.xp / max) * 80)}px` }),
        h('span', {}, WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()]),
      ),
    ),
  );
}

function pathwayCard(p) {
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'row' }, h('h3', { class: 'spacer' }, p.course.title), h('span', { class: 'muted' }, `${p.summary.percent}%`)),
    h('div', { style: 'margin:10px 0 4px' }, progressBar(p.summary.percent)),
    p.units.map((u) =>
      h(
        'div',
        { style: 'margin-top:14px' },
        h('div', { class: 'row' }, h('strong', {}, u.title), h('span', { class: `badge ${u.state === 'completed' ? 'green' : u.state === 'active' ? 'purple' : ''}` }, STATE_LABEL[u.state])),
        h(
          'div',
          { class: 'path-nodes' },
          u.lessons.map((l, i) => h('span', { class: `path-node ${l.state}`, title: `${l.title} — ${STATE_LABEL[l.state]}` }, l.state === 'completed' ? '✓' : i + 1)),
          u.quiz &&
            h(
              'span',
              { class: `path-node quiz ${u.quiz.state}`, title: `${u.quiz.title}${u.quiz.bestScore != null ? ` — шилдэг ${u.quiz.bestScore}%` : ''}` },
              '★',
            ),
        ),
      ),
    ),
  );
}

function simpleTable(headers, rows, emptyText) {
  if (rows.length === 0) return h('div', { class: 'empty' }, emptyText);
  return h(
    'div',
    { class: 'table-wrap' },
    h('table', {}, h('thead', {}, h('tr', {}, headers.map(([t, cls]) => h('th', { class: cls }, t)))), h('tbody', {}, rows)),
  );
}

export async function userDetailView(el, { params: [userId], isCurrent }) {
  const data = await api(`/admin/users/${encodeURIComponent(userId)}`);
  if (!isCurrent()) return;
  const { user, stats: s } = data;
  const isSelf = session.user?.id === user.id;

  const resetBtn = h(
    'button',
    {
      class: 'btn btn-ghost',
      onclick: async () => {
        if (!(await confirmDialog(`${user.name}-ийн бүх ахиц (хичээл, шалгалт, XP) устгагдана.`, { confirmText: 'Тэглэх' }))) return;
        if ((await run(() => api(`/admin/users/${user.id}/reset-progress`, { method: 'POST' }), 'Ахиц тэглэгдлээ')) !== undefined) {
          userDetailView(el, { params: [userId], isCurrent });
        }
      },
    },
    '↺ Ахиц тэглэх',
  );
  const deleteBtn =
    !isSelf &&
    h(
      'button',
      {
        class: 'btn btn-soft-danger',
        onclick: async () => {
          if (!(await confirmDialog(`${user.name} (${user.email}) хэрэглэгчийг бүх өгөгдөлтэй нь устгах уу? Буцаах боломжгүй.`))) return;
          if ((await run(() => api(`/admin/users/${user.id}`, { method: 'DELETE' }), 'Хэрэглэгч устгагдлаа')) !== undefined) {
            location.hash = '#/users';
          }
        },
      },
      'Устгах',
    );

  mount(
    el,
    h('a', { href: '#/users', class: 'muted' }, '← Хэрэглэгчид'),
    h(
      'div',
      { class: 'page-head', style: 'margin-top:12px' },
      h(
        'div',
        { class: 'user-cell' },
        avatar(user, 'lg'),
        h(
          'div',
          {},
          h('h1', {}, user.name),
          h('div', { class: 'sub muted' }, `${user.email} · ${user.role === 'admin' ? 'Админ' : 'Суралцагч'} · бүртгүүлсэн ${formatDate(user.createdAt)}`),
        ),
      ),
      h('div', { class: 'row' }, resetBtn, deleteBtn),
    ),
    h(
      'div',
      { class: 'grid stats' },
      stat('Нийт XP', h('span', { class: 'xp' }, `⚡ ${s.totalXp}`)),
      stat('Түвшин', `${s.level} (${s.levelInfo.xpIntoLevel}/${s.levelInfo.xpForNextLevel})`),
      stat('Streak', `🔥 ${s.streak}`),
      stat('Хичээл', `${s.completedLessons} / ${s.totalLessons}`),
      stat('Шалгалт', `${s.passedQuizzes} / ${s.totalQuizzes}`),
      stat('Дундаж оноо', s.averageQuizScore == null ? '—' : `${s.averageQuizScore}%`),
    ),
    h(
      'div',
      { class: 'grid cols-2', style: 'margin-top:14px' },
      h('div', {}, data.pathways.map(pathwayCard)),
      h('div', { class: 'card' }, h('h3', {}, 'Сүүлийн 7 хоног'), h('div', { style: 'margin-top:12px' }, weeklyChart(s.weeklyActivity))),
    ),
    h('h2', { class: 'section-title' }, 'Шалгалтын оролдлогууд'),
    h(
      'div',
      { class: 'card' },
      simpleTable(
        [['Шалгалт'], ['Оноо', 'num'], ['Үр дүн'], ['XP', 'num'], ['Огноо']],
        data.recentQuizAttempts.map((a) =>
          h(
            'tr',
            {},
            h('td', {}, a.quizTitle),
            h('td', { class: 'num' }, `${a.correctCount}/${a.totalCount} (${a.scorePercent}%)`),
            h('td', {}, h('span', { class: `badge ${a.passed ? 'green' : 'red'}` }, a.passed ? 'Тэнцсэн' : 'Тэнцээгүй')),
            h('td', { class: 'num xp' }, a.xpEarned),
            h('td', {}, formatDate(a.createdAt)),
          ),
        ),
        'Шалгалт өгөөгүй байна.',
      ),
    ),
    h('h2', { class: 'section-title' }, 'Сүүлд дуусгасан хичээлүүд'),
    h(
      'div',
      { class: 'card' },
      simpleTable(
        [['Хичээл'], ['Бүлэг'], ['XP', 'num'], ['Огноо']],
        data.recentLessons.map((l) =>
          h('tr', {}, h('td', {}, l.lessonTitle), h('td', {}, l.unitTitle), h('td', { class: 'num xp' }, l.xpEarned), h('td', {}, formatDate(l.completedAt))),
        ),
        'Хичээл дуусгаагүй байна.',
      ),
    ),
  );
}
