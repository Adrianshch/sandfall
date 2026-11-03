// Sand Emotions: the class wall. The class colab picture (a bit bigger) beside every student's
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
    if (admin) { el.type = 'button'; el.dataset.act = 'Refresh'; el.addEventListener('click', () => ask(C.COLAB_ID)); }
    const canvas = document.createElement('canvas');
    canvas.className = 'art';
    el.appendChild(canvas);
    $('colabTile').appendChild(el);
    const world = CW.createWorld({ canvas, checkpoints: 2 });
    return { id: C.COLAB_ID, el, world, stop: null };
  })();
  // Each time someone refreshes the colab, it clears here too and follows the new picture.
  watchHover(colab.world);
  function followColab(made) {
    if (colab.stop) colab.stop();
    colab.stop = null;
    colab.world.resetLog();
    if (made) colab.stop = C.follow(db, C.COLAB_ID, colab.world, null, () => {}, made);
  }

  // ---- student cubbies ----
  // A refreshed cubby is deleted and made again at once: its tile keeps its place and starts over.
  function addTile(id, made) {
    if (id === C.COLAB_ID) return;
    const old = tiles.get(id);
    if (old) {
      clearTimeout(old.going);
      old.going = 0;
      old.stop();
      old.world.resetLog();
      old.stop = C.follow(db, id, old.world, null, () => {}, Number(made) || 0);
      return;
    }
    const el = document.createElement(admin ? 'button' : 'div');
    el.className = 'tile';
    if (admin) { el.type = 'button'; el.dataset.act = 'Remove'; el.addEventListener('click', () => ask(id)); }
    const canvas = document.createElement('canvas');
    canvas.className = 'art';
    el.appendChild(canvas);
    const t = { id, made: Number(made) || 0, el, world: CW.createWorld({ canvas, checkpoints: 2 }) };
    watchHover(t.world);
    t.stop = C.follow(db, id, t.world, null, () => {}, t.made);
    tiles.set(id, t);
    // oldest cubbies first
    const after = [...tiles.values()].filter(o => o !== t && (o.made > t.made || (o.made === t.made && o.id > t.id)))
      .sort((p, q) => p.made - q.made || (p.id < q.id ? -1 : 1))[0];
    $('grid').insertBefore(el, after ? after.el : null);
    layout();
  }
  function removeTile(id) {
    const t = tiles.get(id);
    if (!t || t.going) return;
    t.going = setTimeout(() => dropTile(id), 2500);   // unless it comes straight back (a refresh)
  }
  function dropTile(id) {
    const t = tiles.get(id);
    if (!t) return;
    t.stop();
    t.el.remove();
    tiles.delete(id);
    if (asking === id) closeAsk();
    layout();
  }

  // ---- layout ----
  // Every picture keeps the same 8:5 shape. The colab is COLAB_SCALE times a student tile (or as big as
  // fits) and sits either beside the students' grid or above it, whichever lets the cubbies be biggest
  // in this window (beside on a wide screen, above on a tall or narrow one), with the grid's columns
  // chosen the same way.
  function layout() {
    const n = tiles.size;
    const r = $('stage').getBoundingClientRect();
    const capH = $('colabCap').offsetHeight + 6;
    const W = r.width - 2, H = r.height - 2, A = GW / GH, S = COLAB_SCALE;
    const gap = n > 16 ? 8 : 14, gap2 = gap * 2;
    let best = { h: 0, cols: 1, side: true };
    for (let c = 1; c <= Math.max(1, n); c++) {
      const rows = Math.ceil(n / c);
      // beside: colab | grid
      let h1 = Math.min((H - gap * (rows - 1)) / rows, (W - gap2 - gap * (c - 1)) / (A * (S + c)));
      if (h1 * S > H - capH) h1 = Math.min((H - gap * (rows - 1)) / rows, (W - A * (H - capH) - gap2 - gap * (c - 1)) / (A * c));
      if (h1 > best.h) best = { h: h1, cols: c, side: true };
      // above: colab over the grid
      let h2 = Math.min((W - gap * (c - 1)) / (c * A), (H - capH - gap2 - gap * (rows - 1)) / (S + rows));
      if (h2 * S * A > W) h2 = Math.min((W - gap * (c - 1)) / (c * A), (H - capH - gap2 - W / A - gap * (rows - 1)) / rows);
      if (h2 > best.h) best = { h: h2, cols: c, side: false };
    }
    let h, ch;
    if (!n) { h = 0; ch = Math.min(H - capH, W / A); best.side = true; }
    else {
      h = Math.max(56, Math.floor(best.h));
      ch = best.side ? Math.min(h * S, H - capH) : Math.min(h * S, W / A);
    }
    // widths in steps of 8 so heights come out exact (the picture is 8:5) and nothing is cut off
    const w = Math.floor(h * A / 8) * 8;
    const cw = Math.floor(ch * A / 8) * 8; ch = cw / A;
    const grid = $('grid');
    grid.style.gap = gap + 'px';
    grid.style.gridTemplateColumns = n ? 'repeat(' + best.cols + ', ' + w + 'px)' : '';
    $('stageRow').style.gap = gap2 + 'px';
    $('stageRow').style.flexDirection = best.side ? 'row' : 'column';
    colab.world.setSize(cw, ch, asking === C.COLAB_ID ? 960 : 0);
    // the cubby open in the admin dialog is drawn sharp enough for the bigger preview
    for (const t of tiles.values()) t.world.setSize(w, w / A, t.id === asking ? 960 : 0);
    renderEmpty();
  }
  new ResizeObserver(layout).observe($('stage'));

  // ---- the class emotions bar ----
  // One thick bar across the top, left to right 0 to 100%: one solid block per cat, sized by how often
  // the class used it (each marble dropped, each press of sand, in every cubby and the colab). Blocks
  // sit in the mood meter's energy order: blue and green (calm) first, then yellow and red (energetic),
  // so each cat keeps its place. Pointing at a block shows that cat's face and name.
  const STACK = [];
  for (const title of ['Blue', 'Green', 'Yellow', 'Red']) STACK.push(...CW.MORE_GROUPS.find(g => g.title === title).ids);
  CW.MOODS.forEach((m, i) => { if (!STACK.includes(i)) STACK.push(i); });   // retired cats, if old drops used them
  const bar = { canvas: $('classMix'), w: 0, h: 0, shown: new Array(CW.MOODS.length).fill(0), key: '', at: 0, blocks: [] };
  function layoutBar() {
    const box = $('classBox').getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bar.w = Math.floor(box.width); bar.h = Math.floor(box.height);
    const c = bar.canvas;
    c.style.width = bar.w + 'px';
    c.style.height = bar.h + 'px';
    c.width = Math.max(1, Math.round(bar.w * dpr));
    c.height = Math.max(1, Math.round(bar.h * dpr));
    drawBar(true);
  }
  new ResizeObserver(layoutBar).observe($('classBox'));
  const classUses = () => {
    const u = colab.world.uses().slice();
    for (const t of tiles.values()) t.world.uses().forEach((n, i) => { u[i] += n; });
    return u;
  };
  function drawBar(force) {
    if (!bar.w || !bar.h) return;
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
    if (!force && !moving && !bar.moving && key === bar.key) return;   // (one more draw once the easing ends)
    bar.key = key; bar.at = now; bar.moving = moving;
    const c = bar.canvas, g = c.getContext('2d'), k = c.width / bar.w, W = bar.w, H = bar.h;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, W, H);
    const track = () => { g.beginPath(); if (g.roundRect) g.roundRect(0, 0, W, H, H / 2); else g.rect(0, 0, W, H); };
    track();
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || 'rgba(0,0,0,0.12)';
    g.fill();
    bar.blocks = [];
    let x = 0;
    g.save();
    track();
    g.clip();
    for (const i of STACK) {
      const wid = bar.shown[i] * W;
      if (wid <= 0.01) continue;
      g.fillStyle = CW.MOODS[i].hex;
      g.fillRect(x, 0, wid, H);
      if (x > 0) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 0.5, 0, 1, H); }   // a hairline between blocks
      if (uses[i]) bar.blocks.push({ i, x0: x, x1: x + wid });
      x += wid;
    }
    g.restore();
  }
  bar.canvas.addEventListener('pointermove', e => {
    const r = bar.canvas.getBoundingClientRect(), x = e.clientX - r.left;
    const b = bar.blocks.find(o => x >= o.x0 && x < o.x1);
    if (b) showName(e, b.i); else hideName();
  });
  bar.canvas.addEventListener('pointerleave', hideName);

  // ---- hover names: the class bar, and the sand or balls in any picture ----
  function showName(e, c) {
    const el = $('hoverName');
    if (el.dataset.c !== String(c)) {
      el.dataset.c = c;
      $('hoverText').textContent = CW.MOODS[c].name;
      const f = $('hoverFace'), g = f.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, f.width, f.height);
      g.translate(f.width / 2, f.height / 2);
      CW.paintMarble(g, c, f.width / 2, 0);
    }
    el.style.left = e.clientX + 'px';
    el.style.top = e.clientY + 'px';
    el.hidden = false;
  }
  function hideName() { $('hoverName').hidden = true; }
  CW.onImages(() => { $('hoverName').dataset.c = ''; drawBar(true); });
  // Pointing at a picture: a ball shows its emotion; so does an area that is mostly one cat's sand.
  function hoverPicture(e, world) {
    if (e.pointerType === 'touch') return hideName();
    const r = world.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * GW, y = (e.clientY - r.top) / r.height * GH;
    const ball = world.marbleOnScreen(x, y);
    if (ball) return showName(e, ball.c);
    const h = world.sandCatAt(x, y, 10);
    if (h && h.n >= h.area * 0.4 && h.share >= 0.6) showName(e, h.c); else hideName();
  }
  function watchHover(world) {
    world.canvas.addEventListener('pointermove', e => hoverPicture(e, world));
    world.canvas.addEventListener('pointerleave', hideName);
  }

  function renderEmpty() {
    $('empty').hidden = tiles.size > 0 || !db;
    $('empty').textContent = !loaded ? 'Connecting…'
      : 'No student cubbies yet. Students open the Sand Emotions link on their tablets and choose "My own cubby".';
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
      $('askTitle').textContent = 'Refresh the class colab?';
      $('askText').textContent = 'The colab picture clears on every screen, and the class starts a new one together. ' + count;
      $('remove').textContent = 'Refresh';
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
