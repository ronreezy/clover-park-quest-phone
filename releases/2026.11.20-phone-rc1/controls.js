(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const rail = byId('touch-rail'), context = byId('context'), menu = byId('menu'), toggle = byId('menu-toggle');
  const directions = {down:0, left:1, right:2, up:3};
  const actions = {confirm:1, close:2, binder:3, map:4, save:5, load:6, restart:7};
  const enabled = navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
  let playing = false, held = null, pointer = null, nextDirection = -1, pending = 0, state = {};
  let previousMode = '', previousScene = '';
  const portrait = matchMedia('(orientation:portrait)');
  const inConversation = () => !!(state.node || state.plain || state.mapSequence);
  const canWalk = () => playing && menu.hidden && !portrait.matches && !inConversation() && !state.binder && !state.mapEnlarged && !state.catalog && !state.award;
  function endHold(discardTap = true) {
    const button = held, id = pointer;
    held = null; pointer = null;
    if (discardTap) nextDirection = -1;
    if (!button) return;
    button.classList.remove('held');
    if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
  }
  function resetInputs() { pending = 0; endHold(); }
  function send(action) {
    endHold();
    if (playing && !portrait.matches && !document.hidden && pending === 0) pending = action;
  }
  for (const button of document.querySelectorAll('[data-dir]')) {
    button.addEventListener('pointerdown', e => {
      if (!canWalk() || pointer !== null || e.button !== 0) return;
      e.preventDefault(); held = button; pointer = e.pointerId;
      nextDirection = directions[button.dataset.dir];
      button.classList.add('held'); button.setPointerCapture(pointer);
    });
    button.addEventListener('pointermove', e => {
      if (e.pointerId !== pointer) return;
      const r = button.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom) endHold();
    });
    button.addEventListener('pointerup', e => {if (pointer === e.pointerId) endHold(false);});
    for (const name of ['pointercancel','lostpointercapture'])
      button.addEventListener(name, e => {if (pointer === e.pointerId) endHold();});
    button.addEventListener('contextmenu', e => e.preventDefault());
  }
  function setMenu(open) {
    resetInputs(); menu.hidden = !open; toggle.textContent = open ? 'Back' : 'Menu';
    toggle.setAttribute('aria-expanded', String(open));
    byId('dpad').inert = !canWalk();
    if (open) menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    else byId('game').focus({preventScroll:true});
  }
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => {
    const action = e.target.closest('button')?.dataset.action;
    if (!action) return;
    setMenu(false);
    if (action === 'leave') {
      playing = false; rail.hidden = true; byId('dialogue').hidden = true;
      document.body.classList.remove('touch-play'); byId('cover').hidden = false;
      byId('play').disabled = false; byId('play').textContent = 'Resume'; byId('loading').textContent = '';
      byId('progress').hidden = true; byId('play').focus(); return;
    }
    if (action !== 'back') send(actions[action]);
  });
  context.addEventListener('click', () => send(context.dataset.action === 'close' ? actions.close : actions.confirm));
  byId('choices').addEventListener('click', e => {
    const button = e.target.closest('button[data-choice]');
    if (button) send(16 + Number(button.dataset.choice));
  });
  for (const event of ['blur','pagehide','orientationchange','resize']) window.addEventListener(event, resetInputs);
  document.addEventListener('visibilitychange', resetInputs);
  portrait.addEventListener('change', () => { resetInputs(); onState(state); });
  const drawDialogue = panel => {
    const dialogue = byId('dialogue');
    dialogue.hidden = !playing || !panel.text;
    byId('speaker').textContent = panel.speaker || '';
    byId('line').textContent = panel.text || '';
    const buttons = (panel.choices || []).map((label,i) => {
      const b = document.createElement('button'); b.type='button'; b.dataset.choice=String(i); b.textContent=label;return b;
    });
    byId('choices').replaceChildren(...buttons); dialogue.scrollTop = 0;
  };
  function onState(s) {
    state = s;
    const scene = s.scene || '';
    const mode = [s.node || '',!!s.binder,!!s.plain,!!s.mapSequence,!!s.mapEnlarged,!!s.catalog,!!s.award].join('|');
    if (scene !== previousScene || mode !== previousMode) { endHold(); previousMode = mode; previousScene = scene; }
    if (!enabled) return;
    const closing = s.binder || s.mapEnlarged || s.catalog;
    context.dataset.action = closing ? 'close' : 'confirm';
    context.textContent = closing ? 'Close' : (inConversation() || s.award) ? 'Continue' : 'Talk';
    context.disabled = !!(s.choices || (s.mapSequence && !s.mapMessage));
    const busy = !!(inConversation() || s.binder || s.catalog || s.award);
    byId('dpad').inert = !canWalk();
    for (const button of menu.querySelectorAll('[data-action]')) {
      const action = button.dataset.action;
      button.disabled = action !== 'back' && action !== 'leave' &&
        (busy || (action === 'map' && !(' '+(s.flags || '')+' ').includes(' hasCampusMap ')));
    }
  }
  let panel = {};
  window.cpqControls = {
    enabled,
    start() {
      if (!enabled) return;
      playing = true; rail.hidden = false; document.body.classList.add('touch-play');
      byId('cover').hidden = true; onState(state); drawDialogue(panel);
    },
    releaseMovement: () => endHold(),
    takeDirection() {
      if (!canWalk()) return -1;
      const direction = held ? directions[held.dataset.dir] : nextDirection;
      nextDirection = -1; return direction;
    },
    takeAction() { const action = pending; pending = 0; return action; },
    drawDialogue(data) {panel = data; drawDialogue(data);},
    onState
  };
})();
