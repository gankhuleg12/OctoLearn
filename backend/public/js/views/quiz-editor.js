import { api } from '../api.js';
import { h, mount } from '../dom.js';
import { field, openDialog, toast } from '../ui.js';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const blankQuestion = () => ({ text: '', options: ['', '', ''], answerIndex: 0 });

/** Create / edit the single quiz of a unit, including its question list. */
export function openQuizEditor({ unit, onSaved }) {
  const existing = unit.quiz;
  const state = {
    title: existing?.title ?? `${unit.title} — шалгалт`,
    passPercent: existing?.passPercent ?? 60,
    questions: existing
      ? existing.questions.map((q) => ({ id: q.id, text: q.text, options: [...q.options], answerIndex: q.answerIndex }))
      : [blankQuestion(), blankQuestion(), blankQuestion()],
  };

  const list = h('div', { class: 'grid' });

  function renderQuestions() {
    mount(
      list,
      state.questions.map((q, qi) => {
        const radioName = `answer-${qi}-${Math.random().toString(36).slice(2, 7)}`;
        return h(
          'div',
          { class: 'question' },
          h(
            'div',
            { class: 'question-head' },
            h('span', { class: 'spacer' }, `Асуулт ${qi + 1}`),
            h('button', {
              type: 'button', class: 'icon-btn', title: 'Дээш', disabled: qi === 0,
              onclick: () => { swap(state.questions, qi, qi - 1); renderQuestions(); },
            }, '↑'),
            h('button', {
              type: 'button', class: 'icon-btn', title: 'Доош', disabled: qi === state.questions.length - 1,
              onclick: () => { swap(state.questions, qi, qi + 1); renderQuestions(); },
            }, '↓'),
            h('button', {
              type: 'button', class: 'icon-btn danger', title: 'Асуулт устгах', disabled: state.questions.length === 1,
              onclick: () => { state.questions.splice(qi, 1); renderQuestions(); },
            }, '🗑'),
          ),
          h('input', {
            class: 'input', required: true, maxlength: 300, placeholder: 'Асуултын текст', value: q.text,
            oninput: (e) => (q.text = e.target.value),
          }),
          h('div', { class: 'help muted', style: 'font-size:12px;font-weight:700' }, 'Зөв хариултыг тойргоор тэмдэглэнэ үү'),
          q.options.map((opt, oi) =>
            h(
              'div',
              { class: `option ${q.answerIndex === oi ? 'correct' : ''}` },
              h('input', {
                type: 'radio', name: radioName, checked: q.answerIndex === oi, 'aria-label': `Зөв хариулт: сонголт ${oi + 1}`,
                onchange: () => { q.answerIndex = oi; renderQuestions(); },
              }),
              h('input', {
                class: 'input', required: true, maxlength: 150, placeholder: `Сонголт ${oi + 1}`, value: opt,
                oninput: (e) => (q.options[oi] = e.target.value),
              }),
              h('button', {
                type: 'button', class: 'icon-btn', title: 'Сонголт устгах', disabled: q.options.length <= MIN_OPTIONS,
                onclick: () => {
                  q.options.splice(oi, 1);
                  if (q.answerIndex >= oi && q.answerIndex > 0) q.answerIndex--;
                  renderQuestions();
                },
              }, '✕'),
            ),
          ),
          q.options.length < MAX_OPTIONS &&
            h('button', {
              type: 'button', class: 'btn btn-ghost', style: 'justify-self:start',
              onclick: () => { q.options.push(''); renderQuestions(); },
            }, '+ Сонголт'),
        );
      }),
    );
  }
  renderQuestions();

  const title = h('input', { required: true, maxlength: 120, value: state.title, oninput: (e) => (state.title = e.target.value) });
  const pass = h('input', {
    type: 'number', min: 1, max: 100, required: true, value: state.passPercent,
    oninput: (e) => (state.passPercent = Number(e.target.value)),
  });

  openDialog({
    title: existing ? 'Шалгалт засах' : 'Шалгалт үүсгэх',
    body: h(
      'div',
      { class: 'form' },
      h('div', { class: 'form-row' }, field('Гарчиг', title), field('Тэнцэх босго (%)', pass, 'Энэ хувиас дээш зөв бол тэнцэнэ')),
      list,
      h('button', {
        type: 'button', class: 'btn btn-ghost',
        onclick: () => { state.questions.push(blankQuestion()); renderQuestions(); },
      }, '+ Асуулт нэмэх'),
    ),
    async onSubmit() {
      await api(`/admin/units/${unit.id}/quiz`, { method: 'PUT', body: state });
      toast('Шалгалт хадгалагдлаа');
      onSaved();
    },
  });
}

function swap(arr, i, j) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
