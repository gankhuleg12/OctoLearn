import { h } from './dom.js';

export function toast(message, type = 'info') {
  const el = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), type === 'error' ? 5000 : 2500);
}

/**
 * Opens a modal dialog. `onSubmit` may throw to keep the dialog open — its
 * message is shown inside the dialog.
 */
export function openDialog({ title, body, submitText = 'Хадгалах', danger = false, onSubmit }) {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: `btn ${danger ? 'btn-danger' : ''}`, type: 'submit' }, submitText);
  const dialog = h(
    'dialog',
    {},
    h(
      'form',
      {
        method: 'dialog',
        onsubmit: async (e) => {
          e.preventDefault();
          submit.disabled = true;
          error.textContent = '';
          try {
            await onSubmit?.();
            dialog.close();
          } catch (err) {
            error.textContent = err.message;
          } finally {
            submit.disabled = false;
          }
        },
      },
      h(
        'div',
        { class: 'dialog-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Хаах', onclick: () => dialog.close() }, '✕'),
      ),
      h('div', { class: 'dialog-body' }, body, error),
      h(
        'div',
        { class: 'dialog-foot' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dialog.close() }, 'Болих'),
        submit,
      ),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

export function confirmDialog(message, { title = 'Баталгаажуулах', confirmText = 'Устгах', danger = true } = {}) {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = openDialog({
      title,
      body: h('p', {}, message),
      submitText: confirmText,
      danger,
      onSubmit: () => {
        confirmed = true;
      },
    });
    dialog.addEventListener('close', () => resolve(confirmed));
  });
}

/** Runs an async action, shows a success toast or an error toast. */
export async function run(action, successMessage) {
  try {
    const result = await action();
    if (successMessage) toast(successMessage);
    return result;
  } catch (err) {
    toast(err.message, 'error');
    return undefined;
  }
}

export function field(label, input, help) {
  return h('label', { class: 'field' }, label, input, help && h('span', { class: 'help' }, help));
}
