import { api } from '../api.js';
import { formatDuration, h, mount, pageHead } from '../dom.js';
import { confirmDialog, field, openDialog, run, toast } from '../ui.js';
import { openLessonForm } from './lesson-form.js';
import { openQuizEditor } from './quiz-editor.js';

let selectedCourseId = null;

function moved(ids, index, delta) {
  const next = [...ids];
  [next[index], next[index + delta]] = [next[index + delta], next[index]];
  return next;
}

function openTextForm({ title, initial = {}, submitText, onSubmit }) {
  const name = h('input', { required: true, maxlength: 120, value: initial.title ?? '' });
  const description = h('textarea', { maxlength: 1000 }, initial.description ?? '');
  openDialog({
    title,
    submitText,
    body: h('div', { class: 'form' }, field('Гарчиг', name), field('Тайлбар', description)),
    onSubmit: () => onSubmit({ title: name.value, description: description.value }),
  });
}

export async function contentView(el, ctx) {
  const { courses } = await api('/admin/courses');
  if (!ctx.isCurrent()) return;
  if (courses.length === 0) {
    mount(el, pageHead('Контент'), h('div', { class: 'card empty' }, 'Курс алга. JSON-оос импортлоно уу.'), importButton(() => contentView(el, ctx)));
    return;
  }
  if (!courses.some((c) => c.id === selectedCourseId)) selectedCourseId = courses[0].id;

  const course = await api(`/admin/courses/${encodeURIComponent(selectedCourseId)}`);
  if (!ctx.isCurrent()) return;

  const reload = async () => {
    const y = window.scrollY;
    await contentView(el, ctx);
    window.scrollTo(0, y);
  };

  const courseSelect =
    courses.length > 1 &&
    h(
      'select',
      { class: 'input', style: 'width:auto', onchange: (e) => { selectedCourseId = e.target.value; reload(); } },
      courses.map((c) => h('option', { value: c.id, selected: c.id === selectedCourseId }, c.title)),
    );

  const unitIds = course.units.map((u) => u.id);

  mount(
    el,
    pageHead(
      course.title,
      course.description || 'Курсын бүлэг, хичээл, шалгалтыг удирдах',
      courseSelect,
      h('button', {
        class: 'btn btn-ghost',
        onclick: () =>
          openTextForm({
            title: 'Курс засах',
            initial: course,
            submitText: 'Хадгалах',
            onSubmit: async (body) => {
              await api(`/admin/courses/${course.id}`, { method: 'PATCH', body });
              toast('Курс хадгалагдлаа');
              reload();
            },
          }),
      }, '✎ Курс'),
      h('button', { class: 'btn btn-ghost', onclick: () => exportCourse(course.id) }, '⤓ Экспорт'),
      importButton(reload),
      h('button', {
        class: 'btn',
        onclick: () =>
          openTextForm({
            title: 'Шинэ бүлэг',
            submitText: 'Нэмэх',
            onSubmit: async (body) => {
              await api(`/admin/courses/${course.id}/units`, { method: 'POST', body });
              toast('Бүлэг нэмэгдлээ (ноорог)');
              reload();
            },
          }),
      }, '+ Бүлэг'),
    ),
    course.units.length === 0
      ? h('div', { class: 'card empty' }, 'Бүлэг алга. "+ Бүлэг" товчоор эхний бүлгээ нэмнэ үү.')
      : course.units.map((unit, ui) => unitCard(unit, ui, unitIds, course.id, reload)),
  );

  watchEncoding(course, ctx, reload);
}

const ENCODING_POLL_MS = 10_000;

/**
 * While any Bunny lesson is still encoding, re-check it every few seconds
 * (works even without the webhook) and refresh the page when one changes.
 */
function watchEncoding(course, ctx, reload) {
  const pending = course.units.flatMap((u) => u.lessons).filter((l) => l.bunnyVideoId && l.videoStatus === 'processing');
  if (pending.length === 0) return;
  setTimeout(async () => {
    if (!ctx.isCurrent() || document.hidden) return ctx.isCurrent() && watchEncoding(course, ctx, reload);
    const results = await Promise.all(
      pending.map((l) => api(`/admin/lessons/${l.id}/sync-video`, { method: 'POST' }).catch(() => null)),
    );
    if (!ctx.isCurrent()) return;
    if (results.some((r) => r && r.status !== 'processing')) reload();
    else watchEncoding(course, ctx, reload);
  }, ENCODING_POLL_MS);
}

function videoBadge(lesson) {
  if (!lesson.bunnyVideoId) return null;
  const map = {
    ready: ['green', '☁️ Bunny'],
    processing: ['purple', '⏳ Encode хийж байна'],
    error: ['red', '⚠ Encode алдаа'],
  };
  const [cls, label] = map[lesson.videoStatus] ?? map.ready;
  return h('span', { class: `badge ${cls}`, style: 'margin-left:6px' }, label);
}

function unitCard(unit, ui, unitIds, courseId, reload) {
  const empty = unit.lessons.length === 0 && !unit.quiz;
  const lessonIds = unit.lessons.map((l) => l.id);

  const statusBadge = unit.published
    ? empty
      ? h('span', { class: 'badge red', title: 'Хоосон бүлэг апп-д харагдахгүй' }, 'Нийтлэгдсэн · хоосон')
      : h('span', { class: 'badge green' }, '● Нийтлэгдсэн')
    : h('span', { class: 'badge' }, '○ Ноорог');

  const unitActions = h(
    'div',
    { class: 'actions' },
    h('button', {
      class: `btn ${unit.published ? 'btn-ghost' : ''}`,
      onclick: () =>
        run(() => api(`/admin/units/${unit.id}`, { method: 'PATCH', body: { published: !unit.published } }),
          unit.published ? 'Ноорог болголоо' : 'Нийтэллээ').then(reload),
    }, unit.published ? 'Нуух' : 'Нийтлэх'),
    h('button', {
      class: 'icon-btn', title: 'Дээш', disabled: ui === 0,
      onclick: () => run(() => api(`/admin/courses/${courseId}/units/order`, { method: 'PUT', body: { ids: moved(unitIds, ui, -1) } })).then(reload),
    }, '↑'),
    h('button', {
      class: 'icon-btn', title: 'Доош', disabled: ui === unitIds.length - 1,
      onclick: () => run(() => api(`/admin/courses/${courseId}/units/order`, { method: 'PUT', body: { ids: moved(unitIds, ui, 1) } })).then(reload),
    }, '↓'),
    h('button', {
      class: 'icon-btn', title: 'Засах',
      onclick: () =>
        openTextForm({
          title: 'Бүлэг засах',
          initial: unit,
          submitText: 'Хадгалах',
          onSubmit: async (body) => {
            await api(`/admin/units/${unit.id}`, { method: 'PATCH', body });
            toast('Бүлэг хадгалагдлаа');
            reload();
          },
        }),
    }, '✎'),
    h('button', {
      class: 'icon-btn danger', title: 'Устгах',
      onclick: async () => {
        const msg = `"${unit.title}" бүлгийг ${unit.lessons.length} хичээл, шалгалттай нь устгах уу? Суралцагчдын энэ бүлгийн ахиц, XP мөн устна.`;
        if (await confirmDialog(msg)) run(() => api(`/admin/units/${unit.id}`, { method: 'DELETE' }), 'Бүлэг устгагдлаа').then(reload);
      },
    }, '🗑'),
  );

  const lessonRows = unit.lessons.map((lesson, li) =>
    h(
      'div',
      { class: 'lesson-row' },
      h('span', { class: 'idx' }, li + 1),
      h(
        'div',
        { class: 'spacer', style: 'min-width:0' },
        h('div', { class: 'title' }, lesson.title),
        h('div', { class: 'meta' }, `▶ ${formatDuration(lesson.durationSec)} · ⚡ ${lesson.xp} XP`, videoBadge(lesson)),
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', {
          class: 'icon-btn', title: 'Дээш', disabled: li === 0,
          onclick: () => run(() => api(`/admin/units/${unit.id}/lessons/order`, { method: 'PUT', body: { ids: moved(lessonIds, li, -1) } })).then(reload),
        }, '↑'),
        h('button', {
          class: 'icon-btn', title: 'Доош', disabled: li === lessonIds.length - 1,
          onclick: () => run(() => api(`/admin/units/${unit.id}/lessons/order`, { method: 'PUT', body: { ids: moved(lessonIds, li, 1) } })).then(reload),
        }, '↓'),
        h('button', { class: 'icon-btn', title: 'Засах', onclick: () => openLessonForm({ lesson, onSaved: reload }) }, '✎'),
        h('button', {
          class: 'icon-btn danger', title: 'Устгах',
          onclick: async () => {
            if (await confirmDialog(`"${lesson.title}" хичээлийг устгах уу? Үүнийг дуусгасан суралцагчдын XP хасагдана.`)) {
              run(() => api(`/admin/lessons/${lesson.id}`, { method: 'DELETE' }), 'Хичээл устгагдлаа').then(reload);
            }
          },
        }, '🗑'),
      ),
    ),
  );

  const quizBox = unit.quiz
    ? h(
        'div',
        { class: 'quiz-box' },
        h('span', { class: 'trophy' }, '🏆'),
        h(
          'div',
          { class: 'spacer' },
          h('strong', {}, unit.quiz.title),
          h('div', { class: 'muted', style: 'font-size:13px;font-weight:600' }, `${unit.quiz.questions.length} асуулт · тэнцэх ${unit.quiz.passPercent}%`),
        ),
        h('button', { class: 'btn btn-ghost', onclick: () => openQuizEditor({ unit, onSaved: reload }) }, '✎ Засах'),
        h('button', {
          class: 'icon-btn danger', title: 'Шалгалт устгах',
          onclick: async () => {
            if (await confirmDialog('Шалгалтыг устгах уу? Суралцагчдын оролдлого, XP мөн устна.')) {
              run(() => api(`/admin/units/${unit.id}/quiz`, { method: 'DELETE' }), 'Шалгалт устгагдлаа').then(reload);
            }
          },
        }, '🗑'),
      )
    : h(
        'div',
        { class: 'quiz-box' },
        h('span', { class: 'trophy', style: 'opacity:.4' }, '🏆'),
        h('span', { class: 'spacer muted' }, 'Энэ бүлэгт шалгалт алга.'),
        h('button', { class: 'btn', onclick: () => openQuizEditor({ unit, onSaved: reload }) }, '+ Шалгалт үүсгэх'),
      );

  return h(
    'div',
    { class: 'card unit-card' },
    h(
      'div',
      { class: 'unit-head' },
      h('span', { class: 'unit-num' }, ui + 1),
      h(
        'div',
        { class: 'spacer', style: 'min-width:200px' },
        h('div', { class: 'row' }, h('h3', {}, unit.title), statusBadge),
        unit.description && h('div', { class: 'muted', style: 'font-size:14px' }, unit.description),
      ),
      unitActions,
    ),
    h(
      'div',
      { class: 'unit-body' },
      lessonRows.length ? lessonRows : h('div', { class: 'empty', style: 'padding:16px' }, 'Хичээл алга.'),
      h('button', { class: 'btn btn-ghost', style: 'margin-top:8px', onclick: () => openLessonForm({ unitId: unit.id, onSaved: reload }) }, '+ Хичээл нэмэх'),
      quizBox,
    ),
  );
}

async function exportCourse(courseId) {
  const data = await run(() => api(`/admin/courses/${encodeURIComponent(courseId)}/export`));
  if (!data) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: `${courseId}.json` });
  a.click();
  URL.revokeObjectURL(url);
}

function importButton(onDone) {
  const input = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        toast('JSON файл уншигдсангүй.', 'error');
        return;
      }
      const ok = await confirmDialog(
        `"${data?.course?.title ?? file.name}" курсыг импортлох уу? Ижил id-тай бүлэг, хичээл, асуулт дарагдана.`,
        { title: 'Импорт', confirmText: 'Импортлох', danger: false },
      );
      if (!ok) return;
      const course = await run(() => api('/admin/courses/import', { method: 'POST', body: data }), 'Импорт амжилттай');
      if (course) {
        selectedCourseId = course.id;
        onDone();
      }
    },
  });
  return h('span', {}, input, h('button', { class: 'btn btn-ghost', onclick: () => input.click() }, '⤒ Импорт'));
}
