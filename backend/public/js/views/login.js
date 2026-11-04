import { api, session } from '../api.js';
import { h } from '../dom.js';
import { themeSwitcher } from '../theme.js';
import { field } from '../ui.js';

export function loginView({ onLoggedIn }) {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const email = h('input', { name: 'email', type: 'email', required: true, autocomplete: 'username' });
  const password = h('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' });
  const submit = h('button', { class: 'btn btn-lg', type: 'submit' }, 'Нэвтрэх');

  const form = h(
    'form',
    {
      class: 'card login form',
      onsubmit: async (e) => {
        e.preventDefault();
        submit.disabled = true;
        error.textContent = '';
        try {
          const { token, user } = await api('/auth/login', {
            method: 'POST',
            body: { email: email.value, password: password.value },
          });
          if (user.role !== 'admin') throw new Error('Зөвхөн админ эрхтэй хэрэглэгч нэвтэрнэ.');
          session.token = token;
          onLoggedIn();
        } catch (err) {
          error.textContent = err.message;
        } finally {
          submit.disabled = false;
        }
      },
    },
    h('div', {}, h('div', { class: 'brand' }, '🐙 OctoLearn'), h('p', { class: 'muted' }, 'Админ панелд нэвтрэх')),
    field('Имэйл', email),
    field('Нууц үг', password),
    error,
    submit,
    h('div', { class: 'hint-box' }, 'Demo админ: admin@octolearn.mn / admin1234'),
    themeSwitcher(),
  );

  return h('div', { class: 'login-wrap' }, form);
}
