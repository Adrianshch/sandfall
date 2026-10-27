// Cat Emotions v6: the class wall. Every cubby at once, live, with no names.
// display/ shows it; admin-cappy/ (body data-wall="admin") also lets the teacher remove a cubby.
(() => {
  const CW = window.CatWorld, C = window.Cubbies;
  const { GW, GH } = CW;
  const $ = id => document.getElementById(id);
  const admin = document.body.dataset.wall === 'admin';
  const tiles = new Map();         // cubby id -> {id, made, el, world, stop}
  let db = null, connected = false, loaded = false, catchingUp = 0;
  let asking = null;                // admin: the cubby in the remove dialog

  function showNotice(text) {
    const n = $('notice');
    n.textContent = text;
    n.hidden = !text;
  }

  // ---- tiles ----
  function addTile(id, made) {
    if (tiles.has(id)) return;
    const el = document.createElement(admin ? 'button' : 'div');
    el.className = 'tile';
    if (admin) { el.type = 'button'; el.addEventListener('click', () => askRemove(id)); }
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    const t = { id, made: Number(made) || 0, el, world: CW.createWorld({ canvas, checkpoints: 2 }) };
    t.stop = C.follow(db, id, t.world, null, () => {});
    tiles.set(id, t);
    // oldest cubbies first
    const after = [...tiles.values()].filter(o => o !== t && (o.made > t.made || (o.made === t.made && o.id > t.id)))
      .sort((p, q) => p.made - q.made || (p.id < q.id ? -1 : 1))[0];
    $('grid').insertBefore(el, after ? after.el : null);
    layout();
  }
  function removeTile(id) {
    const t = tiles.get(id);
    if (!t) return;
    t.stop();
    t.el.remove();
    tiles.delete(id);
    if (asking === id) closeAsk();
    layout();
  }

  // Biggest tiles that fit every cubby on screen (scrolls only past about 90px wide).
  function layout() {
    const n = tiles.size;
    const r = $('wall').getBoundingClientRect();
    const gap = n > 16 ? 8 : 14;
    let best = 0, cols = 1;
    for (let c = 1; c <= Math.max(1, n); c++) {
      const rows = Math.ceil(n / c);
      const w = Math.min((r.width - gap * (c - 1)) / c, (r.height - gap * (rows - 1)) / rows * GW / GH);
      if (w > best) { best = w; cols = c; }
    }
    const w = Math.max(90, Math.floor(best)), h = Math.floor(w * GH / GW);
    const grid = $('grid');
    grid.style.gap = gap + 'px';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + w + 'px)';
    // the cubby open in the remove dialog is drawn sharp enough for the bigger preview
    for (const t of tiles.values()) t.world.setSize(w, h, t.id === asking ? 960 : 0);
    renderEmpty();
  }
  new ResizeObserver(layout).observe($('wall'));

  function renderEmpty() {
    $('empty').hidden = tiles.size > 0;
    $('emptyText').textContent = !db ? '' : !loaded ? 'Connecting…'
      : 'No cubbies yet. Students open the Cat Emotions link on their tablets to make one.';
  }
  function renderStatus() {
    const el = $('status'), txt = $('statusText');
    el.classList.toggle('live', !!db && connected);
    if (!db) { txt.textContent = 'Not connected'; return; }
    if (!connected) { txt.textContent = 'Connecting…'; return; }
    txt.textContent = (catchingUp ? 'Catching up… · ' : 'Live · ') + tiles.size + (tiles.size === 1 ? ' cubby' : ' cubbies');
  }

  // ---- admin: remove a cubby ----
  function askRemove(id) {
    const t = tiles.get(id);
    if (!t) return;
    asking = id;
    layout();
    const when = t.made ? new Date(t.made).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const n = t.world.memories();
    $('askText').textContent = 'This deletes the student\'s art for good, and their username stops working. ' +
      (when ? 'Made ' + when + '. ' : '') + n.toLocaleString() + (n === 1 ? ' memory.' : ' memories.');
    $('ask').hidden = false;
    $('cancel').focus();
  }
  function closeAsk() {
    asking = null;
    $('ask').hidden = true;
    layout();
  }
  if (admin) {
    $('cancel').addEventListener('click', closeAsk);
    $('remove').addEventListener('click', () => {
      const id = asking;
      closeAsk();
      if (!id || !db) return;
      C.removeCubby(db, id).catch(() => showNotice('Could not remove that cubby. Check the database rules in the setup guide.'));
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeAsk(); });
  }

  $('fs').addEventListener('click', () => {
    const el = document.documentElement;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => { $('fs').hidden = true; });
    else $('fs').hidden = true;
  });

  // ---- each frame: catch up on drops (8 ms shared, cubbies taking turns), then draw ----
  let turn = 0, lastCount = -1;
  function tick() {
    const now = performance.now();
    const list = [...tiles.values()];
    for (let j = 0; j < list.length; j++) list[(j + turn) % list.length].world.commit(now);
    turn++;
    for (const t of list) t.world.render(now);
    if (asking && tiles.has(asking)) {
      const p = $('preview'), src = tiles.get(asking).world.canvas;
      if (p.width !== src.width || p.height !== src.height) { p.width = src.width; p.height = src.height; }
      const g = p.getContext('2d');
      g.clearRect(0, 0, p.width, p.height);
      g.drawImage(src, 0, 0, p.width, p.height);
    }
    // cubbies still replaying older drops (more than a couple waiting: live taps always wait a moment)
    let behind = 0;
    for (const t of list) if (t.world.waiting() > 2) behind++;
    if (tiles.size !== lastCount || behind !== catchingUp) { lastCount = tiles.size; catchingUp = behind; renderStatus(); }
    requestAnimationFrame(tick);
  }

  const link = C.connect();
  db = link.db;
  if (!db) {
    showNotice(link.problem);
  } else {
    db.ref('.info/connected').on('value', s => { connected = !!s.val(); renderStatus(); });
    const list = db.ref('cubbies');
    list.on('child_added', s => addTile(s.key, (s.val() || {}).made),
      () => showNotice('Could not read the cubbies. Check the database rules in the setup guide.'));
    list.on('child_removed', s => removeTile(s.key));
    list.once('value', () => { loaded = true; renderEmpty(); }, () => {});
  }
  renderEmpty();
  renderStatus();
  requestAnimationFrame(tick);
})();
