import { api, session, setUnauthorizedHandler } from './api.js';
import { avatar, h, loading, mount } from './dom.js';
import { themeSwitcher } from './theme.js';
import { toast } from './ui.js';
import { contentView } from './views/content.js';
import { dashboardView } from './views/dashboard.js';
import { leaderboardView } from './views/leaderboard.js';
import { loginView } from './views/login.js';
import { settingsView } from './views/settings.js';
import { userDetailView } from './views/user-detail.js';
import { usersView } from './views/users.js';

const app = document.getElementById('app');

const NAV = [
  { href: '#/', label: 'Хяналт', icon: '📊' },
  { href: '#/users', label: 'Хэрэглэгчид', icon: '👥' },
  { href: '#/leaderboard', label: 'XP чансаа', icon: '🏆' },
  { href: '#/content', label: 'Контент', icon: '📚' },
  { href: '#/settings', label: 'Тохиргоо', icon: '⚙️' },
];

const ROUTES = [
  { pattern: /^#\/?$/, view: dashboardView, nav: '#/' },
  { pattern: /^#\/users$/, view: usersView, nav: '#/users' },
  { pattern: /^#\/users\/([^/]+)$/, view: userDetailView, nav: '#/users' },
  { pattern: /^#\/leaderboard$/, view: leaderboardView, nav: '#/leaderboard' },
  { pattern: /^#\/content$/, view: contentView, nav: '#/content' },
  { pattern: /^#\/settings$/, view: settingsView, nav: '#/settings' },
];

function logout(message) {
  session.token = null;
  session.user = null;
  if (message) toast(message, 'error');
  showLogin();
}

setUnauthorizedHandler((err) => logout(err.message));

function showLogin() {
  mount(app, loginView({ onLoggedIn: start }));
}

let mainEl;
let navEls = [];

function renderShell() {
  const user = session.user;
  navEls = NAV.map((n) => h('a', { class: 'nav-link', href: n.href }, h('span', {}, n.icon), n.label));
  mainEl = h('main', { class: 'main' });
  mount(
    app,
    h(
      'div',
      { class: 'shell' },
      h(
        'aside',
        { class: 'sidebar' },
        h('div', { class: 'brand' }, '🐙 OctoLearn', h('small', {}, 'Админ панел')),
        h('nav', { class: 'row', style: 'display:contents' }, navEls),
        h(
          'div',
          { class: 'sidebar-foot' },
          themeSwitcher({ compact: true }),
          h('div', { class: 'user-cell who' }, avatar(user), h('div', {}, user.name, h('small', {}, user.email))),
          h('button', { class: 'btn btn-ghost', onclick: () => logout() }, 'Гарах'),
        ),
      ),
      mainEl,
    ),
  );
}

async function route() {
  if (!session.user) return;
  const hash = location.hash || '#/';
  const match = ROUTES.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) {
    location.hash = '#/';
    return;
  }
  navEls.forEach((el) => el.classList.toggle('active', el.getAttribute('href') === match.r.nav));
  mount(mainEl, loading());
  const token = Symbol();
  route.current = token;
  try {
    // Views render into mainEl; `isCurrent` lets slow loads bail out after navigation.
    await match.r.view(mainEl, { params: match.m.slice(1), isCurrent: () => route.current === token });
  } catch (err) {
    if (route.current !== token) return;
    mount(
      mainEl,
      h(
        'div',
        { class: 'card empty' },
        h('p', {}, err.message),
        h('button', { class: 'btn', onclick: route }, 'Дахин оролдох'),
      ),
    );
  }
}

async function start() {
  if (!session.token) return showLogin();
  mount(app, loading());
  try {
    const { user } = await api('/me');
    if (user.role !== 'admin') return logout('Зөвхөн админ нэвтрэх боломжтой.');
    session.user = user;
    renderShell();
    route();
  } catch (err) {
    if (err.status === 401) return; // handled by unauthorized handler
    mount(app, h('div', { class: 'login-wrap' }, h('div', { class: 'card center' }, h('p', {}, err.message),
      h('button', { class: 'btn', onclick: start }, 'Дахин оролдох'))));
  }
}

window.addEventListener('hashchange', route);
start();
