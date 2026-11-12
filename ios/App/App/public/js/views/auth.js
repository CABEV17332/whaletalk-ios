import { h } from '../dom.js';
import { api, setToken } from '../api.js';
import { icon } from '../icons.js';
import { segmented, toast } from '../ui.js';

/**
 * 登录 / 注册
 */
export function renderAuth({ config, onSuccess }) {
  let mode = 'login';
  let busy = false;

  const error = h('div', { class: 'auth__error', role: 'alert' });

  const username = h('input', {
    type: 'text',
    name: 'username',
    placeholder: '用户名（3-24 位字母数字）',
    autocomplete: 'username',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: true,
  });
  const password = h('input', {
    type: 'password',
    name: 'password',
    placeholder: '密码（至少 6 位）',
    autocomplete: 'current-password',
    required: true,
  });
  const displayName = h('input', {
    type: 'text',
    name: 'displayName',
    placeholder: '昵称，比如：小鲸鱼',
    autocomplete: 'nickname',
    maxlength: '24',
  });
  const invite = h('input', {
    type: 'text',
    name: 'invite',
    placeholder: '邀请码',
    autocomplete: 'off',
  });

  const displayField = h(
    'label',
    { class: 'field stack', style: { display: 'none', height: 'auto', padding: '6px 16px' } },
    h('span', { class: 'text-xs faint', text: '昵称' }),
    displayName
  );
  displayField.style.flexDirection = 'column';
  displayField.style.alignItems = 'stretch';
  displayField.style.gap = '2px';

  const inviteField = h(
    'label',
    { class: 'field', style: { display: 'none' } },
    icon('shield', { size: 18 }),
    invite
  );

  const submit = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, '登录');

  const tab = segmented({
    options: [
      { label: '登录', value: 'login' },
      { label: '注册', value: 'register' },
    ],
    value: 'login',
    onChange: (value) => {
      mode = value;
      error.textContent = '';
      submit.textContent = value === 'login' ? '登录' : '创建账号';
      displayField.style.display = value === 'register' ? 'flex' : 'none';
      inviteField.style.display = value === 'register' && config?.inviteRequired ? 'flex' : 'none';
      password.autocomplete = value === 'login' ? 'current-password' : 'new-password';
      if (value === 'register' && !displayName.value) displayName.value = username.value;
    },
  });

  const form = h(
    'form',
    { class: 'auth__card glass', novalidate: true },
    tab,
    h('label', { class: 'field' }, icon('person', { size: 18 }), username),
    displayField,
    h('label', { class: 'field' }, icon('shield', { size: 18 }), password),
    inviteField,
    error,
    submit
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    error.textContent = '';
    busy = true;
    submit.disabled = true;
    submit.textContent = mode === 'login' ? '登录中…' : '创建中…';
    try {
      const payload = {
        username: username.value.trim(),
        password: password.value,
      };
      if (mode === 'register') {
        payload.displayName = (displayName.value || username.value).trim();
        if (config?.inviteRequired) payload.invite = invite.value.trim();
      }
      const result = mode === 'login' ? await api.login(payload) : await api.register(payload);
      setToken(result.token);
      toast(mode === 'login' ? `欢迎回来，${result.user.displayName}` : '账号创建好啦', {
        type: 'success',
      });
      onSuccess?.(result);
    } catch (err) {
      error.textContent = err.message || '出了点小问题';
      if (err.code === 'username_taken') username.focus();
      if (err.code === 'bad_credentials') password.select();
    } finally {
      busy = false;
      submit.disabled = false;
      submit.textContent = mode === 'login' ? '登录' : '创建账号';
    }
  });

  return h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'auth' },
      h(
        'div',
        { class: 'auth__brand' },
        h('div', { class: 'brand-orb', text: '🐳' }),
        h('div', null, h('h1', { class: 'title-xl', text: '鲸语' })),
        h('p', { class: 'text-sm muted', text: '住在服务器里的小鲸鱼，随时都在。' })
      ),
      form,
      h(
        'div',
        { class: 'auth__hint' },
        icon('sparkles', { size: 16 }),
        h('span', {
          text: `注册后会直接和「${config?.bot?.displayName || '大肥鱼'}」成为好友，不用再找人啦～`,
        })
      )
    )
  );
}
