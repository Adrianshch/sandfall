// Cat Emotions v6: cubbies in Firebase (Realtime Database, no sign-in).
//   cubbies/<id>       {made}: one entry per cubby; the wall watches this list
//   drops/<id>/<drop>  the cubby's drops and pops, the same records as v5
//   snaps/<id>         a saved picture of the cubby, so screens don't replay every drop
// <id> is a one-way hash of the username, so the database never holds anyone's name.
(() => {
  const CW = window.CatWorld;
  const cfg = window.SANDFALL_CONFIG || {};
  const fbConfig = cfg.firebase || {};

  // Returns the database, or null with a reason a person can act on.
  function connect() {
    if (!(window.firebase && fbConfig.databaseURL && !/your-project/i.test(fbConfig.databaseURL))) {
      return { db: null, problem: 'Sharing is off: add your Firebase settings to config.js.' };
    }
    try {
      firebase.initializeApp(fbConfig);
      const db = firebase.database();
      db.ref('.info/serverTimeOffset').on('value', s => CW.setClockOffset(Number(s.val()) || 0));
      return { db, problem: '' };
    } catch (_) {
      return { db: null, problem: 'Firebase settings in config.js could not be read. Copy them again from the Firebase console.' };
    }
  }

  // Usernames ignore capitals and extra spaces: "Maya  Lee" and "maya lee" are the same cubby.
  const tidyName = name => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  async function cubbyId(name) {
    const bytes = new TextEncoder().encode('sandfall-cubby:' + tidyName(name));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(hash, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fills `world` with cubby `id` and keeps it up to date: the saved picture first (read once),
  // then every drop after it. onReady runs once the drops so far are in.
  function follow(db, id, world, onReady, onError) {
    let stopped = false, q = null;
    (async () => {
      let fromK = null;
      if (CW.canPack) {
        try {
          const v = (await db.ref('snaps/' + id).once('value')).val();
          const st = v ? await CW.unpackState(v) : null;
          if (st && !stopped) { world.startFrom(st); fromK = st.upto.k; }
        } catch (_) { /* unreadable picture: replay every drop instead */ }
      }
      if (stopped) return;
      q = fromK === null ? db.ref('drops/' + id) : db.ref('drops/' + id).orderByChild('k').startAt(fromK);
      q.on('child_added', snap => {
        const raw = snap.val();
        if (!raw || typeof raw.p !== 'string') return;
        raw.p = raw.p.split(',').map(Number);
        const ch = CW.valid(raw);
        if (ch) world.addChunk(ch, true);
      }, e => onError && onError(e));
      q.once('value', () => { if (!stopped && onReady) onReady(); }, () => {});
    })();
    return () => { stopped = true; if (q) q.off(); };
  }

  function sendDrop(db, id, ch) {
    return db.ref('drops/' + id + '/' + ch.i)
      .set(Object.assign({ i: ch.i, k: ch.k, c: ch.c, r: ch.r, s: ch.s, l: ch.l, p: ch.p.join(',') }, ch.t ? { t: ch.t } : {}));
  }

  // Saves a picture of the cubby now and then: once 40 more drops have settled, at most every 30 s,
  // and only from drops at least 10 s old (so a late drop from a second screen can't be missed).
  function makeSaver(db, id, world) {
    let savedCount = world.dropCount(), lastTry = 0, busy = false;
    return function maybeSave(force) {
      const now = Date.now();
      if (!CW.canPack || busy || world.waiting() > 2 || (!force && now - lastTry < 30000)) return;
      const st = world.savedState(CW.now() - 10000);
      if (!st || st.count - savedCount < (force ? 10 : 40)) return;
      busy = true; lastTry = now;
      CW.packState(st)
        .then(o => db.ref('snaps/' + id).set(o))
        .then(() => { savedCount = st.count; })
        .catch(() => {})
        .finally(() => { busy = false; });
    };
  }

  // Deletes a cubby: its entry, its drops and its saved picture, all at once.
  function removeCubby(db, id) {
    return db.ref().update({ ['cubbies/' + id]: null, ['drops/' + id]: null, ['snaps/' + id]: null });
  }

  window.Cubbies = { connect, tidyName, cubbyId, follow, sendDrop, makeSaver, removeCubby };
})();
