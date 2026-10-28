// Cat Emotions v6: the class wall. Every cubby at once, live, with no names.
// display/ shows it; admin-cappy/ (body data-wall="admin") also lets the teacher remove a cubby.
(() => {
  const CW = window.CatWorld, C = window.Cubbies;
  const { GW, GH } = CW;
  const $ = id => document.getElementById(id);
  const admin = document.body.dataset.wall === 'admin';
  const tiles = new Map();         // cubby id -> {id, made, el, world, stop, mix, shown, mixKey}
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
    canvas.className = 'art';
    const mix = document.createElement('canvas');
    mix.className = 'mix';
    mix.setAttribute('aria-hidden', 'true');
    el.append(canvas, mix);
    const t = { id, made: Number(made) || 0, el, mix, shown: new Array(CW.MOODS.length).fill(0), mixKey: '',
      world: CW.createWorld({ canvas, checkpoints: 2 }) };
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

  // ---- the cat mix bar beside each picture ----
  // A thick bar, bottom to top 0 to 100%: one solid block per cat, sized by how often that cat was
  // used (each marble dropped, each press of sand). Blocks stack like the mood meter's energy:
  // blue and green (calm) at the bottom, yellow and red (energetic) on top. Each block has a little
  // cat-ball flag on a stem beside it.
  const FAMILY_ORDER = ['Blue', 'Green', 'Yellow', 'Red'];
  const STACK = [];
  for (const title of FAMILY_ORDER) STACK.push(...CW.MORE_GROUPS.find(g => g.title === title).ids);
  CW.MOODS.forEach((m, i) => { if (!STACK.includes(i)) STACK.push(i); });   // retired cats, if old drops used them
  const MIX_GAP = 6;                // between the picture and its bar
  const sides = h => {
    const bar = Math.max(6, Math.round(h * 0.075)), stem = Math.max(3, Math.round(h * 0.03));
    const flag = Math.min(36, Math.max(10, Math.round(h * 0.12)));
    return { bar, stem, flag, width: bar + stem + flag + 3 };   // the canvas beside the picture (plus MIX_GAP)
  };
  // Flag marbles, painted once per size and reused (painting a marble is slow).
  const flagCache = new Map();
  function flagSprite(i, px) {
    const key = i + ':' + px;
    let c = flagCache.get(key);
    if (!c) {
      if (flagCache.size > 400) flagCache.clear();
      c = document.createElement('canvas');
      c.width = c.height = px;
      const g = c.getContext('2d');
      g.translate(px / 2, px / 2);
      CW.paintMarble(g, i, px / 2, 0);
      flagCache.set(key, c);
    }
    return c;
  }
  function drawMix(t, force) {
    // a cubby still catching up changes on almost every frame: redraw its bar a few times a second
    const now = performance.now();
    if (!force && t.world.waiting() > 2 && now - (t.mixAt || 0) < 300) return;
    const uses = t.world.uses();
    let total = 0;
    for (const n of uses) total += n;
    // ease the blocks toward their new sizes
    let moving = false;
    for (let i = 0; i < uses.length; i++) {
      const want = total ? uses[i] / total : 0, d = want - t.shown[i];
      if (Math.abs(d) > 0.002) { t.shown[i] += d * 0.2; moving = true; } else t.shown[i] = want;
    }
    const key = uses.join() + '|' + t.mix.width + 'x' + t.mix.height;
    if (!force && !moving && key === t.mixKey) return;
    t.mixKey = key;
    t.mixAt = now;
    const c = t.mix, g = c.getContext('2d'), k = c.width / t.mixW;
    const H = t.mixH, sz = sides(H);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, t.mixW, H);
    const css = getComputedStyle(document.documentElement);
    const R = sz.bar / 2;
    const track = () => { g.beginPath(); if (g.roundRect) g.roundRect(0, 0, sz.bar, H, R); else g.rect(0, 0, sz.bar, H); };
    track();
    g.fillStyle = css.getPropertyValue('--line').trim() || 'rgba(0,0,0,0.12)';
    g.fill();
    // blocks, bottom up
    const blocks = [];
    let y = H;
    g.save();
    track();
    g.clip();
    for (const i of STACK) {
      const hgt = t.shown[i] * H;
      if (hgt <= 0.01) continue;
      g.fillStyle = CW.MOODS[i].hex;
      g.fillRect(0, y - hgt, sz.bar, hgt);
      if (y < H) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(0, y - 0.5, sz.bar, 1); }   // a hairline between blocks
      if (uses[i]) blocks.push({ i, mid: y - hgt / 2 });
      y -= hgt;
    }
    g.restore();
    // flags: at each block's middle, spread apart so none overlap, shrunk if there are too many
    let d = sz.flag;
    if (blocks.length * (d + 1) > H) d = Math.max(4, H / blocks.length - 1);
    const fr = d / 2, pos = blocks.map(b => b.mid).reverse();    // top to bottom
    for (let j = 0; j < pos.length; j++) pos[j] = Math.max(pos[j], j ? pos[j - 1] + d + 1 : fr);
    for (let j = pos.length - 1; j >= 0; j--) pos[j] = Math.min(pos[j], j < pos.length - 1 ? pos[j + 1] - d - 1 : H - fr);
    const fx = sz.bar + sz.stem + fr;
    [...blocks].reverse().forEach((b, j) => {
      g.strokeStyle = CW.MOODS[b.i].hex;
      g.lineWidth = Math.max(1, H / 160);
      g.beginPath(); g.moveTo(sz.bar, b.mid); g.lineTo(fx - fr, pos[j]); g.stroke();
      const px = Math.max(8, Math.round(d * k));      // sprite in device pixels
      g.drawImage(flagSprite(b.i, px), fx - fr, pos[j] - fr, d, d);
    });
    t.el.title = total ? STACK.filter(i => uses[i]).reverse()
      .map(i => CW.MOODS[i].name + ' ' + Math.round(uses[i] / total * 100) + '%').join(', ') : 'No cats yet';
  }
  CW.onImages(() => { flagCache.clear(); for (const t of tiles.values()) drawMix(t, true); });

  // Biggest tiles that fit every cubby on screen, picture plus its bar (scrolls only past about 90px wide).
  function layout() {
    const n = tiles.size;
    const r = $('wall').getBoundingClientRect();
    const gap = n > 16 ? 8 : 14;
    const A = GW / GH, K = 0.26;                 // picture shape; the bar side takes about a quarter of the height
    let best = 0, cols = 1;
    for (let c = 1; c <= Math.max(1, n); c++) {
      const rows = Math.ceil(n / c);
      const h = Math.min((r.width - gap * (c - 1)) / c / (A + K), (r.height - gap * (rows - 1)) / rows);
      if (h > best) { best = h; cols = c; }
    }
    const w = Math.max(90, Math.floor(best * A)), h = Math.floor(w / A);
    const side = sides(h).width;
    const grid = $('grid');
    grid.style.gap = gap + 'px';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + (w + MIX_GAP + side) + 'px)';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const t of tiles.values()) {
      // the cubby open in the remove dialog is drawn sharp enough for the bigger preview
      t.world.setSize(w, h, t.id === asking ? 960 : 0);
      t.mixW = side; t.mixH = h;
      t.mix.style.width = side + 'px';
      t.mix.style.marginLeft = MIX_GAP + 'px';
      t.mix.style.height = h + 'px';
      t.mix.width = Math.round(side * dpr);
      t.mix.height = Math.round(h * dpr);
      drawMix(t, true);
    }
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
    for (const t of list) { t.world.render(now); drawMix(t, false); }
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
