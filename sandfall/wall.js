// Cat Emotions: the class wall. The class colab picture (a bit bigger) beside every student's
// cubby, live, with no names, and one bar showing which cats the whole class has used.
// display/ shows it; admin-cappy/ (body data-wall="admin") also lets the teacher remove a cubby
// or start the colab fresh.
(() => {
  const CW = window.CatWorld, C = window.Cubbies;
  const { GW, GH } = CW;
  const $ = id => document.getElementById(id);
  const admin = document.body.dataset.wall === 'admin';
  const tiles = new Map();         // student cubby id -> {id, made, el, world, stop}
  let db = null, connected = false, loaded = false, catchingUp = 0;
  let asking = null;                // admin: the cubby in the dialog (C.COLAB_ID for the colab)
  const COLAB_SCALE = 1.5;          // the colab picture is this much bigger than a student's cubby

  function showNotice(text) {
    const n = $('notice');
    n.textContent = text;
    n.hidden = !text;
  }

  // ---- the class colab picture ----
  const colab = (() => {
    const el = document.createElement(admin ? 'button' : 'div');
    el.className = 'tile';
    if (admin) { el.type = 'button'; el.dataset.act = 'Start fresh'; el.addEventListener('click', () => ask(C.COLAB_ID)); }
    const canvas = document.createElement('canvas');
    canvas.className = 'art';
    el.appendChild(canvas);
    $('colabTile').appendChild(el);
    return { id: C.COLAB_ID, el, world: CW.createWorld({ canvas, checkpoints: 2 }), stop: null };
  })();
  // Each time someone starts the colab fresh, it clears here too and follows the new picture.
  function followColab(made) {
    if (colab.stop) colab.stop();
    colab.stop = null;
    colab.world.resetLog();
    if (made) colab.stop = C.follow(db, C.COLAB_ID, colab.world, null, () => {}, made);
  }

  // ---- student cubbies ----
  function addTile(id, made) {
    if (id === C.COLAB_ID || tiles.has(id)) return;
    const el = document.createElement(admin ? 'button' : 'div');
    el.className = 'tile';
    if (admin) { el.type = 'button'; el.dataset.act = 'Remove'; el.addEventListener('click', () => ask(id)); }
    const canvas = document.createElement('canvas');
    canvas.className = 'art';
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

  // ---- layout ----
  // The colab picture on the left, COLAB_SCALE times a student tile (or as big as fits), and the
  // students' tiles in a grid beside it, all as big as fits on screen. The class bar has its own column.
  function layout() {
    const n = tiles.size;
    const r = $('stage').getBoundingClientRect();
    const capH = $('colabCap').offsetHeight + 6;
    const W = r.width, H = r.height, A = GW / GH;
    const gap = n > 16 ? 8 : 14;
    let h = 0, cols = 1, ch;
    if (!n) ch = Math.min(H - capH, W * 0.6 / A);
    else {
      for (let c = 1; c <= n; c++) {
        const rows = Math.ceil(n / c);
        const byRows = (H - gap * (rows - 1)) / rows;
        let hh = Math.min(byRows, (W - gap * (c + 1)) / (A * (COLAB_SCALE + c)));
        if (hh * COLAB_SCALE > H - capH) hh = Math.min(byRows, (W - A * (H - capH) - gap * (c + 1)) / (A * c));
        if (hh > h) { h = hh; cols = c; }
      }
      h = Math.max(56, Math.floor(h));
      ch = Math.min(h * COLAB_SCALE, H - capH);
    }
    // widths in steps of 8 so heights come out exact (the picture is 8:5) and nothing is cut off
    const w = Math.floor(h * A / 8) * 8;
    const cw = Math.floor(ch * A / 8) * 8; ch = cw / A;
    const grid = $('grid');
    grid.style.gap = gap + 'px';
    grid.style.gridTemplateColumns = n ? 'repeat(' + cols + ', ' + w + 'px)' : '';
    $('stageRow').style.gap = (gap * 2) + 'px';
    colab.world.setSize(cw, ch, asking === C.COLAB_ID ? 960 : 0);
    // the cubby open in the admin dialog is drawn sharp enough for the bigger preview
    for (const t of tiles.values()) t.world.setSize(w, w / A, t.id === asking ? 960 : 0);
    layoutBar();
    renderEmpty();
  }
  new ResizeObserver(layout).observe($('stage'));

  // ---- the whole class's cat bar ----
  // A thick bar, bottom to top 0 to 100%: one solid block per cat, sized by how often the class used
  // it (each marble dropped, each press of sand, in every cubby and the colab). Blocks stack like
  // the mood meter's energy: blue and green (calm) at the bottom, yellow and red (energetic) on top,
  // so each cat keeps its place. Each block has a little cat-ball flag on a stem beside it.
  const STACK = [];
  for (const title of ['Blue', 'Green', 'Yellow', 'Red']) STACK.push(...CW.MORE_GROUPS.find(g => g.title === title).ids);
  CW.MOODS.forEach((m, i) => { if (!STACK.includes(i)) STACK.push(i); });   // retired cats, if old drops used them
  const bar = { canvas: $('classMix'), w: 0, h: 0, shown: new Array(CW.MOODS.length).fill(0), key: '', at: 0, sz: null };
  const barSizes = h => {
    const b = Math.min(40, Math.max(14, Math.round(h * 0.032)));
    const flag = Math.min(46, Math.max(18, Math.round(h * 0.048)));
    const stem = Math.max(6, Math.round(flag * 0.35));
    return { bar: b, stem, flag, width: b + stem + flag + 2 };
  };
  function layoutBar() {
    const box = $('classBox').getBoundingClientRect();
    const sz = barSizes(box.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bar.sz = sz; bar.w = sz.width; bar.h = Math.floor(box.height);
    const c = bar.canvas;
    c.style.width = bar.w + 'px';
    c.style.height = bar.h + 'px';
    c.width = Math.round(bar.w * dpr);
    c.height = Math.round(bar.h * dpr);
    drawBar(true);
  }
  new ResizeObserver(layoutBar).observe($('classBox'));

  // Flag marbles, painted once per size and reused (painting a marble is slow).
  const flagCache = new Map();
  function flagSprite(i, px) {
    const key = i + ':' + px;
    let c = flagCache.get(key);
    if (!c) {
      if (flagCache.size > 200) flagCache.clear();
      c = document.createElement('canvas');
      c.width = c.height = px;
      const g = c.getContext('2d');
      g.translate(px / 2, px / 2);
      CW.paintMarble(g, i, px / 2, 0);
      flagCache.set(key, c);
    }
    return c;
  }
  const classUses = () => {
    const u = colab.world.uses().slice();
    for (const t of tiles.values()) t.world.uses().forEach((n, i) => { u[i] += n; });
    return u;
  };
  function drawBar(force) {
    if (!bar.sz || !bar.h) return;
    // while screens are catching up the numbers change on almost every frame: redraw a few times a second
    const now = performance.now();
    if (!force && catchingUp && now - bar.at < 300) return;
    const uses = classUses();
    let total = 0;
    for (const n of uses) total += n;
    let moving = false;                          // ease the blocks toward their new sizes
    for (let i = 0; i < uses.length; i++) {
      const want = total ? uses[i] / total : 0, d = want - bar.shown[i];
      if (Math.abs(d) > 0.002) { bar.shown[i] += d * 0.2; moving = true; } else bar.shown[i] = want;
    }
    const key = uses.join() + '|' + bar.canvas.width + 'x' + bar.canvas.height;
    if (!force && !moving && key === bar.key) return;
    bar.key = key; bar.at = now;
    const c = bar.canvas, g = c.getContext('2d'), k = c.width / bar.w, H = bar.h, sz = bar.sz;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, bar.w, H);
    const track = () => { g.beginPath(); if (g.roundRect) g.roundRect(0, 0, sz.bar, H, sz.bar / 2); else g.rect(0, 0, sz.bar, H); };
    track();
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || 'rgba(0,0,0,0.12)';
    g.fill();
    const blocks = [];
    let y = H;
    g.save();
    track();
    g.clip();
    for (const i of STACK) {
      const hgt = bar.shown[i] * H;
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
    if (blocks.length * (d + 2) > H) d = Math.max(6, H / blocks.length - 2);
    const fr = d / 2, pos = blocks.map(b => b.mid).reverse();    // top to bottom
    for (let j = 0; j < pos.length; j++) pos[j] = Math.max(pos[j], j ? pos[j - 1] + d + 2 : fr);
    for (let j = pos.length - 1; j >= 0; j--) pos[j] = Math.min(pos[j], j < pos.length - 1 ? pos[j + 1] - d - 2 : H - fr);
    const fx = sz.bar + sz.stem + fr;
    [...blocks].reverse().forEach((b, j) => {
      g.strokeStyle = CW.MOODS[b.i].hex;
      g.lineWidth = Math.max(1.5, H / 300);
      g.beginPath(); g.moveTo(sz.bar, b.mid); g.lineTo(fx - fr, pos[j]); g.stroke();
      g.drawImage(flagSprite(b.i, Math.max(8, Math.round(d * k))), fx - fr, pos[j] - fr, d, d);
    });
    $('classMixBox').title = total ? STACK.filter(i => uses[i]).reverse()
      .map(i => CW.MOODS[i].name + ' ' + Math.round(uses[i] / total * 100) + '%').join(', ') : 'No cats yet';
  }
  CW.onImages(() => { flagCache.clear(); drawBar(true); });

  function renderEmpty() {
    $('empty').hidden = tiles.size > 0 || !db;
    $('empty').textContent = !loaded ? 'Connecting…'
      : 'No student cubbies yet. Students open the Cat Emotions link on their tablets and choose "My own cubby".';
  }
  function renderStatus() {
    const el = $('status'), txt = $('statusText');
    el.classList.toggle('live', !!db && connected);
    if (!db) { txt.textContent = 'Not connected'; return; }
    if (!connected) { txt.textContent = 'Connecting…'; return; }
    txt.textContent = (catchingUp ? 'Catching up… · ' : 'Live · ') + tiles.size + (tiles.size === 1 ? ' cubby' : ' cubbies') + ' + colab';
  }

  // ---- admin: remove a cubby, or start the colab fresh ----
  function ask(id) {
    const isColab = id === C.COLAB_ID, t = isColab ? colab : tiles.get(id);
    if (!t) return;
    asking = id;
    layout();
    const n = t.world.memories();
    const count = n.toLocaleString() + (n === 1 ? ' memory.' : ' memories.');
    if (isColab) {
      $('askTitle').textContent = 'Start the class colab fresh?';
      $('askText').textContent = 'The colab picture clears on every screen, and the class starts a new one together. ' + count;
      $('remove').textContent = 'Start fresh';
    } else {
      const when = t.made ? new Date(t.made).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
      $('askTitle').textContent = 'Remove this cubby?';
      $('askText').textContent = 'This deletes the student\'s art for good, and their username stops working. ' +
        (when ? 'Made ' + when + '. ' : '') + count;
      $('remove').textContent = 'Remove';
    }
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
      const done = id === C.COLAB_ID ? C.clearColab(db) : C.removeCubby(db, id);
      done.catch(() => showNotice('Could not change that cubby. Check the database rules in the setup guide.'));
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
    const list = [colab, ...tiles.values()];
    for (let j = 0; j < list.length; j++) list[(j + turn) % list.length].world.commit(now);
    turn++;
    for (const t of list) t.world.render(now);
    drawBar(false);
    const shown = asking === C.COLAB_ID ? colab : tiles.get(asking);
    if (shown) {
      const p = $('preview'), src = shown.world.canvas;
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
    C.watchColab(db, followColab, false);
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
