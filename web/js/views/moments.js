import { h, clear } from '../dom.js';
import { state } from '../store.js';
import { api, compressImage } from '../api.js';
import { avatar, toast, haptic, confirmSheet } from '../ui.js';
import { icon } from '../icons.js';
import { openImageSheet } from './sheets.js';

/** 朋友圈：发布文字/图片，浏览好友和大肥鱼的动态 */
export function renderMoments() {
  const body = h('div');
  let moments = [];
  let pendingImage = '';
  let posting = false;

  const nav = h(
    'header',
    { class: 'nav' },
    h(
      'div',
      { class: 'nav__bar' },
      h('div', { class: 'nav__leading' }),
      h('div', { class: 'nav__compact', text: '朋友圈' }),
      h('div', { class: 'nav__trailing' })
    ),
    h('div', { class: 'nav__large' }, h('h1', { class: 'title-xl', text: '朋友圈' }))
  );

  const scroll = h('div', { class: 'scroll' }, h('div', { class: 'scroll__inner' }, body));
  scroll.addEventListener('scroll', () => nav.classList.toggle('is-scrolled', scroll.scrollTop > 16));

  const textarea = h('textarea', {
    rows: '2',
    placeholder: '这一刻的想法…',
    maxlength: '500',
    'aria-label': '朋友圈内容',
  });
  const preview = h('div', { class: 'moment-preview', hidden: true });
  const imageInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
  const imageBtn = h('button', { class: 'composer__btn', type: 'button', 'aria-label': '添加图片' }, icon('image', { size: 20 }));
  const postBtn = h('button', { class: 'btn btn--primary btn--sm', type: 'button' }, '发布');

  imageBtn.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    try {
      toast('图片上传中…', { duration: 1200 });
      const blob = await compressImage(file, 1280, 0.85);
      const uploaded = await api.upload(blob);
      pendingImage = uploaded.url;
      clear(preview).append(
        h('img', { src: pendingImage, alt: '配图' }),
        h('button', { class: 'chip chip--muted', type: 'button', onclick: () => { pendingImage = ''; preview.hidden = true; clear(preview); } }, '移除')
      );
      preview.hidden = false;
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      imageInput.value = '';
    }
  });

  async function publish() {
    const text = textarea.value.trim();
    if (!text && !pendingImage) {
      toast('写点什么再发吧');
      return;
    }
    if (posting) return;
    posting = true;
    postBtn.disabled = true;
    postBtn.textContent = '发布中…';
    try {
      const data = await api.createMoment({ body: text, imageUrl: pendingImage });
      moments.unshift(data.moment);
      textarea.value = '';
      pendingImage = '';
      preview.hidden = true;
      clear(preview);
      haptic(8);
      toast('已发布', { type: 'success' });
      render();
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      posting = false;
      postBtn.disabled = false;
      postBtn.textContent = '发布';
    }
  }

  postBtn.addEventListener('click', publish);

  function composer() {
    return h(
      'div',
      { class: 'moment-composer glass', style: { padding: '12px' } },
      h(
        'div',
        { class: 'row', style: { alignItems: 'flex-start', gap: '10px' } },
        avatar(state.me, { size: 'sm' }),
        h('div', { class: 'grow' }, textarea, preview)
      ),
      h(
        'div',
        { class: 'row', style: { justifyContent: 'flex-end', gap: '8px', marginTop: '8px' } },
        imageBtn,
        imageInput,
        postBtn
      )
    );
  }

  function momentCard(moment) {
    const mine = moment.author?.id === state.me?.id;
    return h(
      'article',
      { class: 'moment-item glass' },
      h(
        'div',
        { class: 'moment-head' },
        avatar(moment.author, { size: 'sm' }),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'moment-name', text: moment.author?.displayName || '?' }),
          h('div', { class: 'moment-time', text: new Date(moment.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })
        ),
        mine
          ? h(
              'button',
              {
                class: 'icon-btn icon-btn--plain',
                'aria-label': '删除',
                onclick: async () => {
                  try {
                    await api.deleteMoment(moment.id);
                    moments = moments.filter((item) => item.id !== moment.id);
                    render();
                    toast('已删除');
                  } catch (err) {
                    toast(err.message, { type: 'error' });
                  }
                },
              },
              icon('xmark', { size: 16 })
            )
          : null
      ),
      moment.body ? h('p', { class: 'moment-body', text: moment.body }) : null,
      moment.shared
        ? h(
            'div',
            { class: 'moment-quote' },
            h('div', { class: 'moment-quote__name', text: `@${moment.shared.author?.displayName || '好友'}` }),
            moment.shared.body ? h('p', { class: 'moment-quote__body', text: moment.shared.body }) : null,
            moment.shared.imageUrl
              ? h('img', { class: 'moment-quote__image', src: moment.shared.imageUrl, alt: '转发图片', loading: 'lazy' })
              : null
          )
        : moment.sharedFrom
          ? h('div', { class: 'moment-quote moment-quote--gone', text: '原动态已删除' })
          : null,
      moment.imageUrl
        ? h('img', {
            class: 'moment-image',
            src: moment.imageUrl,
            alt: '朋友圈图片',
            loading: 'lazy',
            onclick: () => openImageSheet(moment.imageUrl),
          })
        : null,
      h(
        'div',
        { class: 'moment-actions' },
        h(
          'button',
          {
            class: `moment-action${moment.likedByMe ? ' is-active' : ''}`,
            type: 'button',
            'aria-label': '点赞',
            onclick: () => toggleLike(moment),
          },
          icon('heart', { size: 17 }),
          h('span', { text: moment.likes ? String(moment.likes) : '赞' })
        ),
        h(
          'button',
          {
            class: 'moment-action',
            type: 'button',
            'aria-label': '转发',
            onclick: () => shareMoment(moment),
          },
          icon('link', { size: 16 }),
          h('span', { text: '转发' })
        )
      )
    );
  }

  async function toggleLike(moment) {
    try {
      const res = await api.likeMoment(moment.id);
      moment.likedByMe = res.liked;
      moment.likes = res.likes;
      render();
      haptic(4);
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  }

  async function shareMoment(moment) {
    const preview = (moment.body || moment.shared?.body || '这条动态').slice(0, 60);
    const ok = await confirmSheet({
      title: '转发到朋友圈',
      message: `「${preview}」`,
      confirmText: '转发',
    });
    if (!ok) return;
    try {
      await api.shareMoment(moment.id);
      toast('已转发', { type: 'success' });
      await load();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  }

  function render() {
    clear(body);
    body.append(composer());
    if (!moments.length) {
      body.append(
        h(
          'div',
          { class: 'empty', style: { paddingTop: '40px' } },
          h('div', { class: 'empty__orb', text: '🫧' }),
          h('div', { class: 'empty__title', text: '朋友圈还很安静' }),
          h('div', { class: 'text-sm faint', text: '发一条，或者等大肥鱼冒泡' })
        )
      );
      return;
    }
    for (const moment of moments) body.append(momentCard(moment));
  }

  async function load() {
    try {
      const data = await api.moments();
      moments = data.moments || [];
      render();
    } catch (err) {
      toast(err.message, { type: 'error' });
      render();
    }
  }

  render();
  load();

  return {
    el: h('div', { class: 'screen screen--push' }, nav, scroll),
    destroy() {},
    refresh: load,
  };
}
