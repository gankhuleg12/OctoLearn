import { api } from '../api.js';
import { avatar, formatDate, h, mount, pageHead } from '../dom.js';

export async function usersView(el, { isCurrent }) {
  const { users } = await api('/admin/users');
  if (!isCurrent()) return;

  const tbody = h('tbody');
  const search = h('input', {
    class: 'input',
    type: 'search',
    placeholder: 'Нэр эсвэл имэйлээр хайх…',
    style: 'max-width:320px',
    oninput: () => renderRows(search.value),
  });

  function renderRows(query = '') {
    const q = query.trim().toLowerCase();
    const rows = users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q));
    mount(
      tbody,
      rows.length === 0
        ? h('tr', {}, h('td', { colspan: 7, class: 'empty' }, 'Хэрэглэгч олдсонгүй.'))
        : rows.map((u) =>
            h(
              'tr',
              { class: 'clickable', onclick: () => (location.hash = `#/users/${u.id}`) },
              h('td', {}, h('div', { class: 'user-cell' }, avatar(u), h('div', {}, u.name, h('small', {}, u.email)))),
              h('td', {}, u.role === 'admin' ? h('span', { class: 'badge purple' }, 'Админ') : h('span', { class: 'badge' }, 'Суралцагч')),
              h('td', { class: 'num xp' }, u.totalXp),
              h('td', { class: 'num' }, u.completedLessons),
              h('td', { class: 'num' }, u.passedQuizzes),
              h('td', {}, formatDate(u.lastActivityAt)),
              h('td', {}, formatDate(u.createdAt)),
            ),
          ),
    );
  }
  renderRows();

  mount(
    el,
    pageHead('Хэрэглэгчид', `Нийт ${users.length} бүртгэл`, search),
    h(
      'div',
      { class: 'card table-wrap' },
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', {}, 'Хэрэглэгч'),
            h('th', {}, 'Эрх'),
            h('th', { class: 'num' }, 'XP'),
            h('th', { class: 'num' }, 'Хичээл'),
            h('th', { class: 'num' }, 'Шалгалт'),
            h('th', {}, 'Сүүлийн идэвх'),
            h('th', {}, 'Бүртгүүлсэн'),
          ),
        ),
        tbody,
      ),
    ),
  );
}
