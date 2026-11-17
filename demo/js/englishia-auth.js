/* Englishia accounts — one username for the whole platform and every game.
   Include in any page:  <script src="(path to repo root)/js/englishia-auth.js"></script>
   Then:  EnglishiaAuth.init({ gameId: "my-game", gameTitle: "My Game", mount: "#where" })
   Guest play keeps working if the student never logs in or Firebase cannot load.

   Public API (all async functions return Promises):
     init(opts) / ready()            -> user or null
     user, isAdmin                   -> current state (getters)
     isOwner                         -> true only for the site owner (admins/{uid}), never managers
     onChange(cb)                    -> cb(user) after login/logout
     openLogin(), openProfile(gameId), openLeaderboard(gameId), openAdmin(), logout()
     recordSession(gameId, score, seconds, progress?)
     saveProgress(gameId, data), saveProgressSoon(gameId, data), loadProgress(gameId)
     getGameProfile(gameId), getPlatformProfile(), getLeaderboard(gameId, n)
     logEvent(type, gameId, detail)
     changeDisplayName(name), changePassword(oldPass, newPass)
     registerDevTools(fn, label)     -> adds the game's developer tools to the admin panel
     bridgeLocal(localApi, gameId)   -> makes the old local window.Englishia API use the account
     admin.*                         -> admin-only tools (see bottom)
*/
(function (global) {
  "use strict";
  if (global.EnglishiaAuth) return;

  // Public web config (not a secret). Filled in after the Firebase project exists.
  var CONFIG = global.ENGLISHIA_FIREBASE_CONFIG || {
    apiKey: "AIzaSyA38gQO5qAOlApqcEYiyssa2MCJKJbyjJ0",
    authDomain: "englishia-amirk.firebaseapp.com",
    projectId: "englishia-amirk",
    storageBucket: "englishia-amirk.firebasestorage.app",
    messagingSenderId: "62739653603",
    appId: "1:62739653603:web:bb5d73d2a343357aa536d6"
  };
  var SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
  var EMAIL_DOMAIN = "englishia.app";
  var ACTIVITY_DAYS = 7;
  var CHANGE_DAYS = 365;
  var LONG_TYPES = ["name_change", "password_change", "username_change", "admin_edit", "admin_reset_progress", "admin_password_reset", "admin_points", "admin_rank", "admin_perms", "admin_delete", "admin_restore", "admin_rankdefs"];
  var GAME_TITLES = { "mila-quest": "מילה קווסט", "grammar-maze": "מבוך הדקדוק", "word-detective": "בלש המילים" };

  var script = document.currentScript;
  var ROOT = (function () {
    try { return new URL("../", script && script.src ? script.src : location.href).href; }
    catch (e) { return "/"; }
  })();

  // Local emulator mode (tests only): http://localhost...?emu=1
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  try {
    if (local && /[?&]emu=1\b/.test(location.search)) sessionStorage.setItem("englishia.emu", "1");
  } catch (e) {}
  var EMU = local && (function () { try { return sessionStorage.getItem("englishia.emu") === "1"; } catch (e) { return false; } })();

  var fb = null;          // { app, auth, db, A, F }
  var loading = null;
  var state = { user: null, doc: null, admin: false, resolved: false, restoring: false };
  var listeners = [];
  var devTools = null;
  var opts = { gameId: "", gameTitle: "" };
  var readyResolve, readyPromise = new Promise(function (r) { readyResolve = r; });
  var lbCache = {};
  var hooks = {};

  function configured() { return CONFIG && CONFIG.apiKey && CONFIG.apiKey.indexOf("YOUR_") !== 0; }

  function loadFirebase() {
    if (loading) return loading;
    if (!configured() && !EMU) {
      loading = Promise.reject(new Error("not-configured"));
      loading.catch(function () {});
      return loading;
    }
    var cfg = configured() ? CONFIG : { apiKey: "emu-key", projectId: CONFIG.projectId, authDomain: "localhost", appId: "emu" };
    loading = Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js"),
      import(SDK + "firebase-firestore.js")
    ]).then(function (m) {
      var appM = m[0], A = m[1], F = m[2];
      var app = appM.getApps().filter(function (a) { return a.name === "englishia"; })[0] || appM.initializeApp(cfg, "englishia");
      var auth = createAuth(A, app);
      var db;
      try { db = F.initializeFirestore(app, { experimentalForceLongPolling: true }); } catch (e) { db = F.getFirestore(app); }
      if (EMU) {
        try { A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); } catch (e) {}
        try { F.connectFirestoreEmulator(db, "127.0.0.1", 8085); } catch (e) {}
      }
      fb = { app: app, auth: auth, db: db, A: A, F: guardReads(F, db), appM: appM, cfg: cfg };
      return fb;
    });
    return loading;
  }

  /* ---------- network guard (v12.1) ----------
     Every Firestore read gets a time limit and retries. On iPhone Safari the
     long-polling channel can drop or stall; a stalled read used to wait forever
     ("טוען…") and a dropped one made the admin check fail silently. On a stall we
     also restart the Firestore connection (disable + enable network). */
  var READ_MS = 9000, READ_TRIES = 3;
  function netErr(e) {
    var c = e && e.code;
    return c === "unavailable" || c === "deadline-exceeded" || c === "timeout" || c === "aborted" ||
      /offline|network|timed? ?out/i.test((e && e.message) || "");
  }
  var kickAt = 0;
  function kickNetwork(F, db) {
    if (Date.now() - kickAt < 4000) return Promise.resolve();
    kickAt = Date.now();
    try { console.warn("englishia: restarting the Firestore connection"); } catch (e) {}
    return F.disableNetwork(db).then(function () { return F.enableNetwork(db); }).catch(function () {});
  }
  function guardReads(F, db) {
    function guarded(fn) {
      return function () {
        var args = arguments, left = READ_TRIES;
        function attempt() {
          var timer;
          var t = new Promise(function (_, rej) { timer = setTimeout(function () { rej({ code: "timeout", message: "timeout" }); }, READ_MS); });
          return Promise.race([fn.apply(null, args), t]).then(function (v) { clearTimeout(timer); return v; }, function (e) {
            clearTimeout(timer);
            if (!netErr(e)) throw e;
            if (--left <= 0) throw { code: e.code || "unavailable", heb: "אין חיבור לשרת כרגע (" + (e.code === "timeout" ? "השרת לא ענה בזמן" : "החיבור נותק") + "). בדקו את האינטרנט ונסו שוב.", cause: e };
            return (e.code === "timeout" ? kickNetwork(F, db) : Promise.resolve())
              .then(function () { return new Promise(function (r) { setTimeout(r, 600 * (READ_TRIES - left)); }); }).then(attempt);
          });
        }
        return attempt();
      };
    }
    var G = Object.assign({}, F);
    G.getDoc = guarded(F.getDoc);
    G.getDocs = guarded(F.getDocs);
    return G;
  }

  /* ---------- usernames ---------- */
  function normUsername(u) { return String(u == null ? "" : u).trim().toLowerCase().replace(/\s+/g, ""); }
  function checkUsername(u) {
    if (u.length < 3) return "שם המשתמש קצר מדי. צריך לפחות 3 אותיות.";
    if (u.length > 15) return "שם המשתמש ארוך מדי. עד 15 אותיות.";
    if (!/^[a-z0-9._\-\u05d0-\u05ea]+$/.test(u)) return "בשם המשתמש אפשר אותיות, מספרים, נקודה, מקף וקו תחתון. בלי רווחים.";
    if (/^x-/.test(u)) return "שם משתמש לא יכול להתחיל ב-x-";
    return "";
  }
  function usernameToEmail(u) {
    if (/^[a-z0-9._\-]+$/.test(u) && !/^[.]|[.]$|\.\./.test(u)) return u + "@" + EMAIL_DOMAIN;
    var bytes = new TextEncoder().encode(u), hex = "";
    for (var i = 0; i < bytes.length; i++) hex += ("0" + bytes[i].toString(16)).slice(-2);
    return "x-" + hex + "@" + EMAIL_DOMAIN;
  }
  function cleanName(n) {
    n = String(n == null ? "" : n).replace(/\s+/g, " ").trim();
    return n.length > 20 ? n.slice(0, 20).trim() : n;
  }
  // free-text rank label: Hebrew/English letters, digits, spaces and a few punctuation marks, up to 24 chars
  function cleanCustomName(n) {
    n = String(n == null ? "" : n).replace(/\s+/g, " ").trim();
    n = n.replace(/[^\u0590-\u05FFa-zA-Z0-9 \-'׳״·.]/g, "");
    n = n.replace(/\s+/g, " ").trim();
    return n.length > 24 ? n.slice(0, 24).trim() : n;
  }
  function rankFields(rankDoc, total, manual, customName) {
    var man = manual != null ? String(manual) : ((rankDoc && rankDoc.manual) || "");
    var custom = customName != null ? cleanCustomName(customName) : cleanCustomName(rankDoc && rankDoc.customName);
    return { total: num(total), manual: man, customName: custom, updatedAt: fb.F.serverTimestamp() };
  }
  function rankLabel(r) { return (r && r.customName) || (r && r.tier && r.tier.name) || ""; }

  /* ---------- helpers ---------- */
  var HINTKEY = "englishia.session.v1";
  function readHint() {
    try { return JSON.parse(localStorage.getItem(HINTKEY) || "null"); } catch (e) { return null; }
  }
  function writeHint() {
    try {
      if (state.user) {
        var d = state.doc || {}, h = readHint() || {};
        localStorage.setItem(HINTKEY, JSON.stringify({
          uid: state.user.uid,
          username: d.username || h.username || "",
          displayName: d.displayName || d.username || h.displayName || "",
          at: Date.now()
        }));
      } else if (!state.restoring) {
        localStorage.removeItem(HINTKEY);
      }
    } catch (e) {}
  }
  function webkitAuth() {
    try {
      var ua = navigator.userAgent || "";
      if (/iP(hone|ad|od)/.test(ua)) return true;
      if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
      if (/Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android|OPR|Firefox|FxiOS/i.test(ua)) return true;
    } catch (e) {}
    return false;
  }
  function createAuth(A, app) {
    // Default: same cascade the task asked for. On WebKit/iOS, localStorage is tried first
    // because IndexedDB often reports "available" but then fails to restore the session.
    var persist = [A.indexedDBLocalPersistence, A.browserLocalPersistence];
    if (webkitAuth()) persist = [A.browserLocalPersistence, A.indexedDBLocalPersistence];
    try {
      if (typeof A.initializeAuth === "function") {
        return A.initializeAuth(app, {
          persistence: persist,
          popupRedirectResolver: A.browserPopupRedirectResolver
        });
      }
    } catch (e) {
      if (!(e && e.code === "auth/already-initialized")) console.warn("englishia auth init", e);
    }
    return A.getAuth(app);
  }
  function emit(silent) {
    document.documentElement.classList.toggle("eng-signed-in", !!state.user);
    document.documentElement.classList.toggle("eng-admin", !!state.admin);
    document.documentElement.classList.toggle("eng-restoring", !!state.restoring);
    if (!silent) {
      listeners.slice().forEach(function (cb) { try { cb(publicUser()); } catch (e) { console.error(e); } });
    }
    renderMenus();
    writeHint();
  }
  function publicUser() {
    if (!state.user) return null;
    var d = state.doc || {}, h = readHint() || {};
    if (h.uid && h.uid !== state.user.uid) h = {};
    return {
      uid: state.user.uid,
      username: d.username || h.username || "",
      displayName: d.displayName || d.username || h.displayName || h.username || "",
      isAdmin: state.admin
    };
  }
  function num(v) { v = +v; return isFinite(v) && v > 0 ? Math.round(v) : 0; }
  function expireFor(type) {
    var days = LONG_TYPES.indexOf(type) >= 0 ? CHANGE_DAYS : ACTIVITY_DAYS;
    return fb.F.Timestamp.fromMillis(Date.now() + days * 864e5);
  }
  function userRef(uid) { return fb.F.doc(fb.db, "users", uid); }
  function fmtTime(sec) {
    sec = num(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    var mm = m === 1 ? "דקה אחת" : m + " דקות";
    if (h) return (h === 1 ? "שעה" : h + " שעות") + (m ? " ו-" + mm : "");
    if (m) return mm;
    return sec + " שניות";
  }
  function fmtDate(ts) {
    try {
      var d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      if (!d) return "";
      return d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function authError(e) {
    var c = (e && e.code) || "";
    if (c === "auth/email-already-in-use") return "שם המשתמש הזה כבר תפוס. נסו שם אחר.";
    if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found" || c === "auth/invalid-email")
      return "שם המשתמש או הסיסמה לא נכונים.";
    if (c === "auth/weak-password" || c === "auth/password-does-not-meet-requirements") return "הסיסמה קצרה מדי. צריך לפחות 6 תווים.";
    if (c === "auth/too-many-requests") return "יותר מדי ניסיונות. חכו כמה דקות ונסו שוב.";
    if (c === "auth/network-request-failed") return "אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב.";
    if (c === "auth/requires-recent-login") return "צריך להתחבר מחדש ואז לנסות שוב.";
    if (c === "auth/popup-blocked") return "הדפדפן חסם את החלון. אפשרו חלונות קופצים ונסו שוב.";
    if (c === "auth/popup-closed-by-user") return "החלון נסגר לפני האישור.";
    if (e && e.message === "not-configured") return "החשבונות עוד לא מוכנים. אפשר לשחק כאורחים.";
    return "משהו השתבש. נסו שוב. (" + (c || (e && e.message) || "error") + ")";
  }

  /* ---------- auth state ---------- */
  function retryGet(ref, n) {
    return fb.F.getDoc(ref).catch(function (e) {
      if (n > 0 && e && !e.heb && (e.code === "unavailable" || e.code === "deadline-exceeded")) {
        return new Promise(function (r) { setTimeout(r, 900); }).then(function () { return retryGet(ref, n - 1); });
      }
      throw e;
    });
  }
  function loadUserState(u) {
    if (!u) { state.user = null; state.doc = null; state.admin = false; return Promise.resolve(); }
    state.user = u;
    var F = fb.F;
    return Promise.all([
      retryGet(userRef(u.uid), 3).then(function (s) { return s.exists() ? s.data() : null; }),
      retryGet(F.doc(fb.db, "admins", u.uid), 3).then(function (s) { return s.exists(); }).catch(function () { return false; })
    ]).then(function (r) {
      state.doc = r[0];
      if (r[1] && staff.uid === u.uid) staff.owner = true;
      state.admin = !!r[1] || (typeof isStaff === "function" && isStaff());
      if (!state.doc) return ensureUserDoc(u, null, null);
    });
  }
  function ensureUserDoc(u, username, displayName) {
    var F = fb.F;
    if (!username) {
      var em = (u.email || "").split("@")[0];
      username = em;
      if (/^x-([0-9a-f]+)$/.test(em)) {
        try {
          var hex = em.slice(2), arr = new Uint8Array(hex.length / 2);
          for (var i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
          username = new TextDecoder().decode(arr);
        } catch (e) {}
      }
    }
    var d = {
      username: username, email: u.email, displayName: cleanName(displayName || username) || username,
      createdAt: F.serverTimestamp(), lastSeen: F.serverTimestamp(),
      totalScore: 0, totalSeconds: 0, plays: 0, games: {}
    };
    return F.setDoc(userRef(u.uid), d).then(function () {
      state.doc = Object.assign({}, d, { createdAt: new Date(), lastSeen: new Date() });
    });
  }

  function start() {
    // Until Auth reports the persisted user, show "מתחבר..." instead of a fake logout.
    state.restoring = true;
    renderMenus();
    var timer = setTimeout(function () { finishReady(true); }, 20000);
    function finishReady(fromTimeout) {
      clearTimeout(timer);
      if (state.resolved) return;
      state.resolved = true;
      if (fromTimeout && !state.user && (state.restoring || readHint())) {
        state.restoring = true;
        readyResolve(publicUser());
        renderMenus();
        return;
      }
      if (!fromTimeout) state.restoring = false;
      readyResolve(publicUser());
    }
    loadFirebase().then(function () {
      var first = true;
      fb.A.onAuthStateChanged(fb.auth, function (u) {
        if (u) state.user = u;
        else { state.user = null; state.doc = null; state.admin = false; }
        state.restoring = false;
        var isFirst = first;
        if (first) { first = false; finishReady(false); }
        // Paint the session immediately — do not wait for Firestore, which can hang.
        emit();
        loadUserState(u).catch(function (e) {
          console.warn("englishia user", e);
          if (u) state.user = u;
        }).then(function () {
          if (isFirst && state.user && opts.gameId) logEvent("game_start", opts.gameId, opts.gameTitle || "");
          if (isFirst && state.user) touch();
          emit();
        });
      });
    }).catch(function (e) {
      if (e && e.message !== "not-configured") console.warn("Englishia accounts offline:", e);
      // A missing SDK is not a logout. Keep a stored hint and do not notify
      // listeners with null (that would drop a game's cloud profile map).
      if (readHint()) {
        state.restoring = false;
        finishReady(false);
        emit(true);
      } else {
        state.restoring = false;
        finishReady(false);
        emit();
      }
    });
  }
  function touch() {
    if (!state.user) return;
    fb.F.updateDoc(userRef(state.user.uid), { lastSeen: fb.F.serverTimestamp() }).catch(function () {});
  }

  function register(username, password, displayName) {
    if (!displayName) displayName = String(username == null ? "" : username).trim();
    username = normUsername(username);
    var bad = checkUsername(username);
    if (bad) return Promise.reject({ heb: bad });
    if (String(password || "").length < 6) return Promise.reject({ heb: "הסיסמה קצרה מדי. צריך לפחות 6 תווים." });
    return loadFirebase().then(function () {
      return fb.A.createUserWithEmailAndPassword(fb.auth, usernameToEmail(username), password);
    }).then(function (cred) {
      return ensureUserDoc(cred.user, username, displayName).then(function () {
        state.user = cred.user; state.admin = false;
        return logEvent("register", opts.gameId || "", "נרשם/ה");
      }).then(function () {
        // keep what a guest already did on this device
        if (hooks.register) return Promise.resolve().then(hooks.register).catch(function () {});
      });
    }).then(function () { emit(); return publicUser(); });
  }
  function login(username, password) {
    username = normUsername(username);
    if (!username || !password) return Promise.reject({ heb: "צריך לכתוב שם משתמש וסיסמה." });
    return loadFirebase().then(function () {
      return fb.A.signInWithEmailAndPassword(fb.auth, usernameToEmail(username), password);
    }).then(function (cred) {
      // a slow/blocked network must not block a correct login; profile data loads again on the next auth event
      return loadUserState(cred.user).catch(function (e) { console.warn("englishia user", e); state.user = cred.user; });
    }).then(function () {
      touch();
      return logEvent("login", opts.gameId || "", "");
    }).then(function () { emit(); return publicUser(); });
  }
  function logout() {
    if (!fb || !state.user) return Promise.resolve();
    return logEvent("logout", opts.gameId || "", "").catch(function () {}).then(function () {
      return fb.A.signOut(fb.auth);
    }).then(function () { state.user = null; state.doc = null; state.admin = false; emit(); });
  }

  /* ---------- data ---------- */
  function logEvent(type, gameId, detail, target) {
    if (!fb || !state.user) return Promise.resolve(false);
    var t = target || { uid: state.user.uid, name: (state.doc && state.doc.displayName) || "?" };
    return fb.F.addDoc(fb.F.collection(fb.db, "activity"), {
      uid: t.uid, name: cleanName(t.name) || "?", type: type, gameId: gameId || "",
      detail: String(detail == null ? "" : detail).slice(0, 200),
      at: fb.F.serverTimestamp(), expireAt: expireFor(type), by: state.user.uid
    }).then(function () { return true; }).catch(function (e) { console.warn("englishia log", e); return false; });
  }

  function recordSession(gameId, score, seconds, progress) {
    if (!fb || !state.user || !gameId) return Promise.resolve(false);
    score = num(score); seconds = num(seconds);
    var F = fb.F, uid = state.user.uid, d = state.doc || (state.doc = {});
    var games = d.games || (d.games = {});
    var g = games[gameId] || {};
    var ng = {
      best: Math.max(num(g.best), score), totalScore: num(g.totalScore) + score,
      seconds: num(g.seconds) + seconds, plays: num(g.plays) + 1, lastPlayed: F.serverTimestamp()
    };
    var isBest = score > 0 && score >= num(g.best);
    games[gameId] = Object.assign({}, ng, { lastPlayed: new Date() });
    d.totalScore = num(d.totalScore) + score; d.totalSeconds = num(d.totalSeconds) + seconds; d.plays = num(d.plays) + 1;
    var p = F.updateDoc(userRef(uid), new F.FieldPath("games", gameId), ng,
      "totalScore", F.increment(score), "totalSeconds", F.increment(seconds), "plays", F.increment(1),
      "lastSeen", F.serverTimestamp());
    return p.then(function () {
      var jobs = [logEvent("score", gameId, "ניקוד " + score + " · " + fmtTime(seconds))];
      if (isBest) jobs.push(F.setDoc(F.doc(fb.db, "leaderboards", gameId, "scores", uid),
        { name: cleanName(d.displayName) || "?", score: ng.best, updatedAt: F.serverTimestamp() }).then(function () { delete lbCache[gameId]; }));
      if (progress !== undefined && progress !== null) jobs.push(saveProgress(gameId, progress));
      return Promise.all(jobs);
    }).then(function () { return true; }).catch(function (e) { console.warn("englishia record", e); return false; });
  }

  function saveProgress(gameId, data, uidOverride) {
    if (!fb || !state.user || !gameId) return Promise.resolve(false);
    var uid = uidOverride || state.user.uid;
    var json;
    try { json = JSON.stringify(data == null ? {} : data); } catch (e) { return Promise.resolve(false); }
    if (json.length > 300000) { console.warn("englishia progress too big"); return Promise.resolve(false); }
    return fb.F.setDoc(fb.F.doc(fb.db, "users", uid, "progress", gameId),
      { json: json, updatedAt: fb.F.serverTimestamp(), by: state.user.uid })
      .then(function () { return true; }).catch(function (e) { console.warn("englishia save", e); return false; });
  }
  var pending = {};
  function saveProgressSoon(gameId, data) {
    pending[gameId] = data;
    if (pending["_t" + gameId]) clearTimeout(pending["_t" + gameId]);
    pending["_t" + gameId] = setTimeout(function () { flush(gameId); }, 2500);
  }
  function flush(gameId) {
    if (!(gameId in pending)) return;
    var d = pending[gameId]; delete pending[gameId];
    clearTimeout(pending["_t" + gameId]); delete pending["_t" + gameId];
    saveProgress(gameId, d);
  }
  global.addEventListener("pagehide", function () { Object.keys(pending).forEach(function (k) { if (k.indexOf("_t") !== 0) flush(k); }); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") Object.keys(pending).forEach(function (k) { if (k.indexOf("_t") !== 0) flush(k); });
  });

  function loadProgress(gameId, uidOverride) {
    if (!fb || !state.user || !gameId) return Promise.resolve(null);
    var uid = uidOverride || state.user.uid;
    return fb.F.getDoc(fb.F.doc(fb.db, "users", uid, "progress", gameId)).then(function (s) {
      if (!s.exists()) return null;
      try { return JSON.parse(s.data().json); } catch (e) { return null; }
    }).catch(function (e) { console.warn("englishia load", e); return null; });
  }

  function statsOf(g) { g = g || {}; return { best: num(g.best), totalScore: num(g.totalScore), seconds: num(g.seconds), plays: num(g.plays) }; }
  function getGameProfile(gameId) {
    if (!state.user) return Promise.resolve(null);
    var d = state.doc || {};
    return Promise.resolve(Object.assign({ name: d.displayName || "", username: d.username || "" }, statsOf((d.games || {})[gameId])));
  }
  function getPlatformProfile() {
    if (!state.user) return Promise.resolve(null);
    var d = state.doc || {}, games = {};
    Object.keys(d.games || {}).forEach(function (k) { games[k] = statsOf(d.games[k]); });
    return Promise.resolve({ name: d.displayName || "", username: d.username || "", totalScore: num(d.totalScore),
      totalSeconds: num(d.totalSeconds), plays: num(d.plays), games: games });
  }
  function getLeaderboard(gameId, n) {
    n = n || 10;
    return loadFirebase().then(function () {
      var F = fb.F;
      return F.getDocs(F.query(F.collection(fb.db, "leaderboards", gameId, "scores"), F.orderBy("score", "desc"), F.limit(n)));
    }).then(function (snap) {
      var me = state.user && state.user.uid, out = [];
      snap.forEach(function (s) { var v = s.data(); out.push({ rank: out.length + 1, name: v.name, score: v.score, isMe: s.id === me }); });
      lbCache[gameId] = out;
      return out;
    }).catch(function (e) { console.warn("englishia leaderboard", e); return lbCache[gameId] || []; });
  }

  function changeDisplayName(name) {
    name = cleanName(name);
    if (!state.user) return Promise.reject({ heb: "צריך להתחבר קודם." });
    if (!name) return Promise.reject({ heb: "צריך לכתוב שם." });
    var F = fb.F, uid = state.user.uid, old = state.doc.displayName;
    return F.updateDoc(userRef(uid), { displayName: name, lastSeen: F.serverTimestamp() }).then(function () {
      state.doc.displayName = name;
      return renameLeaderboards(uid, name, Object.keys(state.doc.games || {}));
    }).then(function () {
      return logEvent("name_change", opts.gameId || "", old + " ← " + name);
    }).then(function () { emit(); });
  }
  function renameLeaderboards(uid, name, gameIds) {
    var F = fb.F;
    return Promise.all(gameIds.map(function (gid) {
      var ref = F.doc(fb.db, "leaderboards", gid, "scores", uid);
      return F.getDoc(ref).then(function (s) {
        if (s.exists()) return F.setDoc(ref, { name: name, score: s.data().score, updatedAt: F.serverTimestamp() });
      }).catch(function () {});
    }));
  }
  function changePassword(oldPass, newPass) {
    if (!state.user) return Promise.reject({ heb: "צריך להתחבר קודם." });
    if (String(newPass || "").length < 6) return Promise.reject({ heb: "הסיסמה החדשה קצרה מדי. צריך לפחות 6 תווים." });
    var A = fb.A, u = fb.auth.currentUser;
    return A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, oldPass))
      .then(function () { return A.updatePassword(u, newPass); })
      .then(function () { return logEvent("password_change", opts.gameId || "", "התלמיד/ה שינה/תה סיסמה"); });
  }

  /* ---------- admin, managers, ranks, audit ---------- */
  // Roles: owner = admins/{uid} (set in the Firebase console, irrevocable from the site).
  // Managers = managers/{uid} {perms}. Every permission is enforced by firestore.rules too.
  var PERMS = ["view", "points", "names", "ranks", "rankdefs", "delete", "managers", "audit"];
  var PERM_HE = {
    view: "צפייה בתלמידים, בהתקדמות ובפעילות",
    points: "עריכת נקודות והתקדמות (הוספה, שינוי, מחיקה)",
    names: "שינוי שם תצוגה של תלמידים",
    ranks: "קביעת דרגה ידנית לתלמיד",
    rankdefs: "עריכת הדרגות (שמות וניקוד נדרש)",
    "delete": "מחיקת תלמידים ושחזור",
    managers: "מינוי מנהלים (רק בהרשאות שיש לו)",
    audit: "צפייה ביומן הביקורת של כל המנהלים"
  };
  var ACTION_HE = {
    points: "עריכת נקודות", reset_game: "מחיקת ניקוד במשחק", rename: "שינוי שם", rank: "שינוי דרגה",
    rankdefs: "עריכת הדרגות", delete_user: "מחיקת תלמיד", restore_user: "שחזור תלמיד", perms: "הרשאות מנהל",
    password_reset: "איפוס סיסמה", username_change: "שינוי שם משתמש", tester: "הרשאת בודק"
  };
  var staff = { uid: null, owner: false, perms: null, loading: null };
  function isOwner() { return !!(state.user && staff.uid === state.user.uid && staff.owner); }
  function isTester() { return !!(state.user && staff.uid === state.user.uid && staff.tester); }
  // owner always sees the official-hub Demo button; testers do too. Testers are not staff.
  function canSeeDemo() { return isOwner() || isTester(); }
  function can(p) {
    if (!state.user || staff.uid !== state.user.uid) return false;
    return staff.owner || !!(staff.perms && staff.perms[p] === true);
  }
  function isStaff() { return isOwner() || PERMS.some(function (p) { return can(p); }); }
  function needPerm(p) { if (!can(p)) throw { heb: "אין לך הרשאה לפעולה הזאת." }; }
  function needAdmin() { if (!isStaff()) throw { heb: "רק למנהל." }; }
  function needOwner() { if (!isOwner()) throw { heb: "רק בעל האתר (amir) יכול לעשות את זה." }; }
  function loadStaff() {
    if (!fb || !state.user) { staff = { uid: null, owner: false, perms: null, loading: null }; return Promise.resolve(); }
    var uid = state.user.uid;
    if (staff.uid === uid && staff.loading && !staff.failed) return staff.loading;
    var F = fb.F;
    var s = { uid: uid, owner: false, perms: null, loading: null, done: false, failed: false, error: null };
    function soft(e) { if (netErr(e) || (e && e.heb)) { s.failed = true; s.error = e; } }
    s.loading = Promise.all([
      F.getDoc(F.doc(fb.db, "admins", uid)).then(function (x) { return x.exists(); }).catch(function (e) { soft(e); return false; }),
      F.getDoc(F.doc(fb.db, "managers", uid)).then(function (x) { return x.exists() ? x.data() : null; }).catch(function (e) { soft(e); return null; }),
      F.getDoc(F.doc(fb.db, "ranks", uid)).then(function (x) { return x.exists() ? x.data() : null; }).catch(function () { return null; }),
      getTiers(),
      F.getDoc(F.doc(fb.db, "tombstones", uid)).then(function (x) { return x.exists(); }).catch(function () { return false; }),
      F.getDoc(F.doc(fb.db, "testers", uid)).then(function (x) { return x.exists(); }).catch(function () { return false; })
    ]).then(function (r) {
      s.deleted = !!r[4];
      s.tester = !!r[5];
      s.owner = !!r[0];
      s.done = true;
      if (s.failed) console.warn("englishia role check failed", s.error);
      var p = {};
      if (r[1] && r[1].perms) PERMS.forEach(function (k) { p[k] = r[1].perms[k] === true; });
      s.perms = r[1] ? p : null;
      s.rank = r[2];
      if (state.user && state.user.uid === uid) {
        staff = s;
        state.admin = isStaff();
      }
    });
    staff = s;
    return s.loading;
  }
  // keep state.admin = owner OR manager with a permission, after every auth/profile event
  var roleSig = "";
  function roleSignature() { return [staff.uid, staff.done, staff.failed, staff.owner, staff.tester, JSON.stringify(staff.perms), state.admin].join("|"); }
  function afterStaff() {
    var want = isStaff();
    if (want || !staff.failed) state.admin = want || (state.admin && staff.failed);
    var sig = roleSignature();
    if (sig !== roleSig) { roleSig = sig; setTimeout(function () { emit(); }, 0); }
  }
  listeners.push(function (u) {
    if (!u) { if (staff.uid) staff = { uid: null, owner: false, perms: null, loading: null }; return; }
    if (staff.uid !== u.uid) {
      loadStaff().then(afterStaff);
    } else if (staff.loading) {
      staff.loading.then(afterStaff);
    }
  });
  // "loading" until the role is known, "error" if it could not be checked (network), else "ok"
  function roleState() {
    if (state.restoring) return "loading";
    if (!state.user) return "ok";
    if (staff.uid !== state.user.uid || !staff.done) return "loading";
    if (staff.failed && !isStaff()) return "error";
    return "ok";
  }
  function retryRole() {
    if (!state.user) return Promise.resolve();
    staff.failed = true;
    var p = loadStaff().then(afterStaff);
    roleSig = ""; setTimeout(function () { emit(); }, 0);
    return p;
  }
  // ready() resolves after the role is known (games read isAdmin once on start)
  readyPromise = readyPromise.then(function () { return loadStaff().catch(function () {}); }).then(function () { return publicUser(); });

  /* ranks */
  var DEFAULT_TIERS = [
    { id: "t1", name: "מתחיל", min: 0, color: "#7c8a96" },
    { id: "t2", name: "מתקדם", min: 500, color: "#2f9e44" },
    { id: "t3", name: "ותיק", min: 2000, color: "#1c7ed6" },
    { id: "t4", name: "מקצוען", min: 5000, color: "#7048e8" },
    { id: "t5", name: "אלוף", min: 10000, color: "#e8890c" },
    { id: "t6", name: "אגדה", min: 25000, color: "#c92a2a" }
  ];
  var TIER_COLORS = ["#7c8a96", "#2f9e44", "#1c7ed6", "#7048e8", "#e8890c", "#c92a2a", "#0b7285", "#a61e4d", "#5c940d", "#495057", "#d6336c", "#364fc7"];
  var tiersCache = null, tiersAt = 0;
  function cleanTiers(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).slice(0, 12).forEach(function (t, i) {
      if (!t) return;
      var name = cleanName(t.name);
      if (!name) return;
      var id = String(t.id || "").replace(/[^a-z0-9_]/gi, "").slice(0, 20) || ("t" + Date.now().toString(36) + i);
      while (seen[id]) id += "x";
      seen[id] = 1;
      var color = /^#[0-9a-f]{6}$/i.test(t.color || "") ? t.color : TIER_COLORS[i % TIER_COLORS.length];
      out.push({ id: id, name: name, min: Math.min(1000000000, num(t.min)), color: color });
    });
    out.sort(function (a, b) { return a.min - b.min; });
    if (out.length) out[0].min = 0;
    return out;
  }
  function getTiers(force) {
    if (!force && tiersCache && Date.now() - tiersAt < 60e3) return Promise.resolve(tiersCache);
    return loadFirebase().then(function () {
      return fb.F.getDoc(fb.F.doc(fb.db, "config", "ranks"));
    }).then(function (s) {
      var t = s.exists() ? cleanTiers(s.data().tiers) : [];
      tiersCache = t.length ? t : DEFAULT_TIERS.slice(); tiersAt = Date.now();
      return tiersCache;
    }).catch(function () { return tiersCache || DEFAULT_TIERS.slice(); });
  }
  function rankOf(total, manual, tiers, customName) {
    tiers = tiers || tiersCache || DEFAULT_TIERS;
    total = num(total);
    if (manual && typeof manual === "object") {
      if (customName == null) customName = manual.customName;
      manual = manual.manual;
    }
    var idx = 0;
    tiers.forEach(function (t, i) { if (total >= t.min) idx = i; });
    var auto = idx, isManual = false;
    if (manual) {
      for (var i = 0; i < tiers.length; i++) if (tiers[i].id === manual) { idx = i; isManual = true; break; }
    }
    var next = auto + 1 < tiers.length ? tiers[auto + 1] : null;
    return { tier: tiers[idx], index: idx, level: idx + 1, manual: isManual, auto: tiers[auto], next: next, toNext: next ? next.min - total : 0, total: total, customName: cleanCustomName(customName) };
  }
  // drawn badge (SVG shield with a star and the level number); no emoji
  function badgeSVG(tier, level, size) {
    size = size || 28;
    var c = (tier && tier.color) || "#7c8a96";
    var n = Math.max(1, Math.min(12, level || 1));
    return '<svg class="eng-badge" width="' + size + '" height="' + Math.round(size * 1.15) + '" viewBox="0 0 40 46" aria-hidden="true" focusable="false">' +
      '<path d="M20 1.5 37 7.5v13c0 11.5-7.4 19.6-17 23.5C10.4 40.1 3 32 3 20.5v-13z" fill="' + c + '" stroke="#1d1a16" stroke-width="2.2"/>' +
      '<path d="M20 6 32.5 10.4v9.9c0 8.6-5.3 14.8-12.5 18-7.2-3.2-12.5-9.4-12.5-18v-9.9z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/>' +
      '<path d="M20 9.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L20 24.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" fill="#fff6d5" stroke="#1d1a16" stroke-width="1.1"/>' +
      '<text x="20" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="9.5" fill="#fff">' + n + "</text></svg>";
  }
  function rankChip(r, size) {
    if (!r || !r.tier) return "";
    var title = r.customName
      ? ("דרגה מותאמת: " + r.customName + (r.manual ? " · תג " + r.tier.name : " · תג לפי ניקוד (" + r.tier.name + ")"))
      : ("דרגה " + r.level + (r.manual ? " (נקבעה ע״י המנהל)" : ""));
    return '<span class="eng-rank" title="' + esc(title) + '">' + badgeSVG(r.tier, r.level, size) +
      "<span>" + esc(rankLabel(r)) + "</span></span>";
  }
  function readRank(uid) {
    return fb.F.getDoc(fb.F.doc(fb.db, "ranks", uid)).then(function (s) { return s.exists() ? s.data() : null; }).catch(function () { return null; });
  }
  // public ranks/{uid} = {total, manual, customName}; total always equals the profile's totalScore
  function syncRank(uid) {
    if (!fb || !state.user) return Promise.resolve();
    uid = uid || state.user.uid;
    var F = fb.F;
    return Promise.all([F.getDoc(userRef(uid)), readRank(uid)]).then(function (r) {
      if (!r[0].exists()) return;
      var total = num(r[0].data().totalScore);
      if (r[1] && r[1].total === total) return;
      return F.setDoc(F.doc(fb.db, "ranks", uid), rankFields(r[1], total));
    }).catch(function (e) { console.warn("englishia rank", e); });
  }
  var origRecordSession = recordSession;
  recordSession = function (gameId, score, seconds, progress) {
    return origRecordSession(gameId, score, seconds, progress).then(function (ok) {
      if (ok) return syncRank().then(function () { if (staff.uid && state.user && staff.uid === state.user.uid) return readRank(staff.uid).then(function (x) { staff.rank = x; }); }).then(function () { return ok; });
      return ok;
    });
  };
  function myRank() {
    var d = state.doc || {};
    return rankOf(d.totalScore, staff.rank && staff.rank.manual, null, staff.rank && staff.rank.customName);
  }
  function ranksFor(uids) {
    return Promise.all(uids.map(function (u) { return readRank(u); }));
  }

  /* audit */
  var ownerToken = null;
  function getOwnerToken() {
    // Password reset / username change need the project owner's Google sign-in.
    // A second Firebase app opens a Google popup; its OAuth token can call the
    // Identity Toolkit admin API. Nothing secret is stored in the site.
    if (EMU) return Promise.resolve("owner");
    if (ownerToken && ownerToken.exp > Date.now()) return Promise.resolve(ownerToken.t);
    var A = fb.A;
    var app2 = fb.appM.getApps().filter(function (a) { return a.name === "englishia-owner"; })[0] || fb.appM.initializeApp(fb.cfg, "englishia-owner");
    var auth2 = A.getAuth(app2);
    var prov = new A.GoogleAuthProvider();
    prov.addScope("https://www.googleapis.com/auth/identitytoolkit");
    prov.setCustomParameters({ prompt: "select_account" });
    return A.signInWithPopup(auth2, prov).then(function (res) {
      var c = A.GoogleAuthProvider.credentialFromResult(res);
      var t = c && c.accessToken;
      var googleUid = res.user && res.user.uid;
      return A.signOut(auth2).then(function () {
        if (!t) throw { heb: "לא התקבל אישור מגוגל." };
        ownerToken = { t: t, exp: Date.now() + 50 * 60e3 };
        if (googleUid) idtk("accounts:delete", { localId: googleUid }, t).catch(function () {});
        return t;
      });
    });
  }
  function idtk(method, body, token) {
    var base = EMU ? "http://127.0.0.1:9099/identitytoolkit.googleapis.com" : "https://identitytoolkit.googleapis.com";
    return fetch(base + "/v1/projects/" + fb.cfg.projectId + "/" + method, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var m = (j && j.error && j.error.message) || r.status;
          if (/PERMISSION|403/.test(String(m)) || r.status === 403) throw { heb: "לחשבון הגוגל הזה אין הרשאת בעלים בפרויקט Englishia. (" + m + ")" };
          throw { heb: "הפעולה נכשלה: " + m };
        }
        return j;
      });
    });
  }
  function recomputeTotals(games) {
    var t = { totalScore: 0, totalSeconds: 0, plays: 0 };
    Object.keys(games || {}).forEach(function (k) {
      var g = games[k] || {}; t.totalScore += num(g.totalScore); t.totalSeconds += num(g.seconds); t.plays += num(g.plays);
    });
    return t;
  }
  function str(v, max) {
    if (v == null) v = "";
    if (typeof v !== "string") { try { v = JSON.stringify(v); } catch (e) { v = String(v); } }
    return v.length > max ? v.slice(0, max - 1) + "…" : v;
  }
  // a batch that starts with the audit entry + pointer; the rules require both for every manager change
  function auditBatch(action, target, targetName, before, after, detail) {
    var F = fb.F, b = F.writeBatch(fb.db), me = state.user.uid;
    var ref = F.doc(F.collection(fb.db, "audit"));
    b.set(ref, {
      actor: me, actorName: cleanName((state.doc && state.doc.displayName) || (state.doc && state.doc.username) || "?") || "?",
      action: action, target: String(target || ""), targetName: str(targetName, 40),
      before: str(before, 2000), after: str(after, 2000), detail: str(detail, 300), at: F.serverTimestamp()
    });
    b.set(F.doc(fb.db, "auditptr", me), { id: ref.id, at: F.serverTimestamp() });
    return b;
  }
  function statsTxt(g, gameId) {
    g = statsOf(g);
    return (GAME_TITLES[gameId] || gameId) + ": שיא " + g.best + ", ניקוד " + g.totalScore + ", " + fmtTime(g.seconds) + ", " + g.plays + " משחקים";
  }
  function knownGames(u) {
    var ids = {};
    Object.keys(GAME_TITLES).forEach(function (k) { ids[k] = 1; });
    Object.keys((u && u.games) || {}).forEach(function (k) { if (/^[a-z0-9-]{1,40}$/.test(k)) ids[k] = 1; });
    return Object.keys(ids);
  }
  function permList(p) { return PERMS.filter(function (k) { return p && p[k] === true; }); }
  function permTxt(p) { var l = permList(p); return l.length ? l.map(function (k) { return PERM_HE[k]; }).join(" · ") : "ללא הרשאות"; }

  var admin = {
    PERMS: PERMS, PERM_HE: PERM_HE, ACTION_HE: ACTION_HE,
    listUsers: function () {
      return Promise.resolve().then(function () { needPerm("view"); }).then(function () {
        return fb.F.getDocs(fb.F.collection(fb.db, "users"));
      }).then(function (snap) {
        var out = [];
        snap.forEach(function (s) { out.push(Object.assign({ uid: s.id }, s.data())); });
        out.sort(function (a, b) { return String(a.displayName).localeCompare(String(b.displayName), "he"); });
        var uids = out.map(function (u) { return u.uid; });
        var rk = fb.F.getDocs(fb.F.collection(fb.db, "ranks")).then(function (rs) {
          var m = {}; rs.forEach(function (x) { m[x.id] = x.data(); });
          return uids.map(function (id) { return m[id] || null; });
        }).catch(function () { return ranksFor(uids); });
        var testers = fb.F.getDocs(fb.F.collection(fb.db, "testers")).then(function (ts) {
          var m = {}; ts.forEach(function (x) { m[x.id] = true; }); return m;
        }).catch(function () { return {}; });
        return Promise.all([rk, getTiers(),
          can("managers") ? admin.listManagers().catch(function () { return []; }) : Promise.resolve([]), testers]).then(function (r) {
          var mg = {}; r[2].forEach(function (m) { mg[m.uid] = m; });
          out.forEach(function (u, i) {
            u.rankDoc = r[0][i]; u.rank = rankOf(u.totalScore, r[0][i] && r[0][i].manual, r[1], r[0][i] && r[0][i].customName);
            u.manager = mg[u.uid] || null;
            u.tester = !!r[3][u.uid];
          });
          return out;
        });
      });
    },
    getUser: function (uid) {
      return Promise.resolve().then(function () { needPerm("view"); }).then(function () {
        return Promise.all([fb.F.getDoc(userRef(uid)), readRank(uid), getTiers(),
          fb.F.getDoc(fb.F.doc(fb.db, "testers", uid)).then(function (x) { return x.exists(); }).catch(function () { return false; })]);
      }).then(function (r) {
          if (!r[0].exists()) return null;
          var u = Object.assign({ uid: uid }, r[0].data());
          u.rankDoc = r[1]; u.rank = rankOf(u.totalScore, r[1] && r[1].manual, r[2], r[1] && r[1].customName);
          u.tester = !!r[3];
          return u;
        });
    },
    loadProgress: function (uid, gameId) { needPerm("view"); return loadProgress(gameId, uid); },
    setProgress: function (uid, gameId, data) {
      needPerm("points");
      var json;
      try { json = JSON.stringify(data == null ? {} : data); } catch (e) { return Promise.reject({ heb: "הטקסט לא תקין." }); }
      if (json.length > 300000) return Promise.reject({ heb: "ההתקדמות גדולה מדי." });
      var F = fb.F;
      return Promise.all([admin.getUser(uid), loadProgress(gameId, uid)]).then(function (r) {
        var u = r[0]; if (!u) throw { heb: "התלמיד לא נמצא." };
        var b = auditBatch("points", uid, u.displayName, r[1], json, "עריכת התקדמות · " + (GAME_TITLES[gameId] || gameId));
        b.set(F.doc(fb.db, "users", uid, "progress", gameId), { json: json, updatedAt: F.serverTimestamp(), by: state.user.uid });
        return b.commit().then(function () {
          return logEvent("admin_edit", gameId, "המנהל ערך את ההתקדמות", { uid: uid, name: u.displayName });
        });
      });
    },
    // edit one game's numbers; totals and leaderboard follow
    setStats: function (uid, gameId, stats) {
      needPerm("points");
      var F = fb.F;
      return admin.getUser(uid).then(function (u) {
        if (!u) throw { heb: "התלמיד לא נמצא." };
        var games = Object.assign({}, u.games || {}), old = games[gameId];
        var g = { best: num(stats.best), totalScore: num(stats.totalScore), seconds: num(stats.seconds), plays: num(stats.plays), lastPlayed: F.serverTimestamp() };
        games[gameId] = g;
        var t = recomputeTotals(games);
        var before = statsTxt(old, gameId) + " · סה״כ " + num(u.totalScore);
        var after = statsTxt(g, gameId) + " · סה״כ " + t.totalScore;
        var b = auditBatch("points", uid, u.displayName, before, after, GAME_TITLES[gameId] || gameId);
        b.update(userRef(uid), new F.FieldPath("games", gameId), g, "totalScore", t.totalScore, "totalSeconds", t.totalSeconds, "plays", t.plays);
        var lb = F.doc(fb.db, "leaderboards", gameId, "scores", uid);
        if (g.best > 0) b.set(lb, { name: cleanName(u.displayName) || "?", score: g.best, updatedAt: F.serverTimestamp() }); else b.delete(lb);
        b.set(F.doc(fb.db, "ranks", uid), rankFields(u.rankDoc, t.totalScore));
        delete lbCache[gameId];
        return b.commit().then(function () {
          if (state.user && uid === state.user.uid && state.doc) { state.doc.games = games; Object.assign(state.doc, t); }
          return logEvent("admin_points", gameId, "ניקוד: " + after, { uid: uid, name: u.displayName });
        });
      });
    },
    // add (or remove, with a negative number) points to one game's total score
    addPoints: function (uid, gameId, delta) {
      delta = Math.round(+delta || 0);
      if (!delta) return Promise.reject({ heb: "צריך לכתוב כמה נקודות." });
      return admin.getUser(uid).then(function (u) {
        if (!u) throw { heb: "התלמיד לא נמצא." };
        var g = statsOf((u.games || {})[gameId]);
        g.totalScore = Math.max(0, g.totalScore + delta);
        return admin.setStats(uid, gameId, g);
      });
    },
    resetGame: function (uid, gameId) {
      needPerm("points");
      var F = fb.F;
      return admin.getUser(uid).then(function (u) {
        if (!u) throw { heb: "התלמיד לא נמצא." };
        var games = Object.assign({}, u.games || {}), old = games[gameId];
        delete games[gameId];
        var t = recomputeTotals(games);
        var b = auditBatch("reset_game", uid, u.displayName, statsTxt(old, gameId) + " · סה״כ " + num(u.totalScore), "נמחק · סה״כ " + t.totalScore, GAME_TITLES[gameId] || gameId);
        b.update(userRef(uid), new F.FieldPath("games", gameId), F.deleteField(), "totalScore", t.totalScore, "totalSeconds", t.totalSeconds, "plays", t.plays);
        b.delete(F.doc(fb.db, "users", uid, "progress", gameId));
        b.delete(F.doc(fb.db, "leaderboards", gameId, "scores", uid));
        b.set(F.doc(fb.db, "ranks", uid), rankFields(u.rankDoc, t.totalScore));
        delete lbCache[gameId];
        return b.commit().then(function () {
          return logEvent("admin_reset_progress", gameId, "המנהל מחק את הניקוד וההתקדמות במשחק", { uid: uid, name: u.displayName });
        });
      });
    },
    rename: function (uid, name) {
      needPerm("names");
      name = cleanName(name);
      if (!name) return Promise.reject({ heb: "צריך לכתוב שם." });
      var F = fb.F;
      var statDocs = [];
      return admin.getUser(uid).then(function (u) {
        if (!u) return u;
        var scopes = ["all"].concat(Object.keys(u.games || {})).filter(function (g) { return /^[a-z0-9-]{1,40}$/.test(g); });
        return Promise.all(scopes.map(function (g) {
          var ref = F.doc(fb.db, "gstats", g, "players", uid);
          return F.getDoc(ref).then(function (x) { if (x.exists()) statDocs.push(ref); }).catch(function () {});
        })).then(function () { return u; });
      }).then(function (u) {
        if (!u) throw { heb: "התלמיד לא נמצא." };
        var b = auditBatch("rename", uid, name, u.displayName, name, "");
        statDocs.forEach(function (ref) { b.update(ref, { name: name, updatedAt: F.serverTimestamp() }); });
        b.update(userRef(uid), { displayName: name });
        Object.keys(u.games || {}).forEach(function (g) {
          var best = num(u.games[g] && u.games[g].best);
          if (best > 0 && /^[a-z0-9-]{1,40}$/.test(g)) { b.set(F.doc(fb.db, "leaderboards", g, "scores", uid), { name: name, score: best, updatedAt: F.serverTimestamp() }); delete lbCache[g]; }
        });
        return b.commit().then(function () {
          if (state.user && uid === state.user.uid && state.doc) state.doc.displayName = name;
          return logEvent("name_change", "", "המנהל שינה שם: " + u.displayName + " ← " + name, { uid: uid, name: name });
        });
      });
    },
    // tierId '' = back to automatic (by score). customName is optional free text; '' clears it.
    // if the 3rd argument is omitted, an existing custom name is kept (old callers).
    setRank: function (uid, tierId, customName) {
      needPerm("ranks");
      var F = fb.F;
      var keepCustom = arguments.length < 3;
      return Promise.all([admin.getUser(uid), getTiers(true)]).then(function (r) {
        var u = r[0], tiers = r[1];
        if (!u) throw { heb: "התלמיד לא נמצא." };
        tierId = String(tierId || "");
        if (tierId && !tiers.some(function (t) { return t.id === tierId; })) throw { heb: "הדרגה לא קיימת." };
        var raw = keepCustom ? ((u.rankDoc && u.rankDoc.customName) || "") : String(customName == null ? "" : customName).replace(/\s+/g, " ").trim();
        var custom = keepCustom ? cleanCustomName(u.rankDoc && u.rankDoc.customName) : cleanCustomName(raw);
        if (!keepCustom && raw && !custom) throw { heb: "אפשר לכתוב רק אותיות בעברית או באנגלית, מספרים ורווחים (עד 24 תווים)." };
        var oldR = u.rank, newR = rankOf(u.totalScore, tierId, tiers, custom);
        var label = function (x) {
          var s = (x.customName || x.tier.name) + (x.manual ? " (ידני)" : " (לפי ניקוד)");
          if (x.customName) s += " · תג " + x.tier.name;
          return s;
        };
        var b = auditBatch("rank", uid, u.displayName, label(oldR), label(newR), custom ? custom : "בלי שם חופשי");
        b.set(F.doc(fb.db, "ranks", uid), rankFields(null, num(u.totalScore), tierId, custom));
        return b.commit().then(function () {
          if (state.user && uid === state.user.uid) staff.rank = { total: num(u.totalScore), manual: tierId, customName: custom };
          return logEvent("admin_rank", "", "דרגה: " + label(oldR) + " ← " + label(newR), { uid: uid, name: u.displayName });
        });
      });
    },
    getTiers: function () { return getTiers(true); },
    setTiers: function (list) {
      needPerm("rankdefs");
      var tiers = cleanTiers(list);
      if (!tiers.length) return Promise.reject({ heb: "צריך לפחות דרגה אחת." });
      var F = fb.F;
      return getTiers(true).then(function (old) {
        var fmt = function (l) { return l.map(function (t) { return t.name + " " + t.min; }).join(" · "); };
        var b = auditBatch("rankdefs", "config", "דרגות", fmt(old), fmt(tiers), tiers.length + " דרגות");
        b.set(F.doc(fb.db, "config", "ranks"), { tiers: tiers, updatedAt: F.serverTimestamp(), by: state.user.uid });
        return b.commit().then(function () { tiersCache = tiers; tiersAt = Date.now(); return tiers; });
      });
    },
    // removes the profile, progress, scores and rank; the account cannot create a new profile until restored
    deleteUser: function (uid) {
      needPerm("delete");
      if (state.user && uid === state.user.uid) return Promise.reject({ heb: "אי אפשר למחוק את החשבון של עצמך." });
      var F = fb.F;
      return admin.getUser(uid).then(function (u) {
        if (!u) throw { heb: "התלמיד לא נמצא." };
        var b = auditBatch("delete_user", uid, u.displayName, u.username + " · ניקוד " + num(u.totalScore) + " · " + Object.keys(u.games || {}).map(function (g) { return statsTxt(u.games[g], g); }).join(" | "), "נמחק", "");
        b.delete(userRef(uid));
        knownGames(u).forEach(function (g) {
          b.delete(F.doc(fb.db, "users", uid, "progress", g));
          b.delete(F.doc(fb.db, "leaderboards", g, "scores", uid));
          delete lbCache[g];
        });
        b.delete(F.doc(fb.db, "ranks", uid));
        b.delete(F.doc(fb.db, "testers", uid));
        ["all"].concat(knownGames(u)).forEach(function (g) { if (/^[a-z0-9-]{1,40}$/.test(g)) b.delete(F.doc(fb.db, "gstats", g, "players", uid)); });
        b.set(F.doc(fb.db, "tombstones", uid), { by: state.user.uid, at: F.serverTimestamp(), name: cleanName(u.displayName) || "?", username: String(u.username || "").slice(0, 15) });
        return b.commit().then(function () {
          return logEvent("admin_delete", "", "המנהל מחק את התלמיד", { uid: uid, name: u.displayName });
        });
      });
    },
    listDeleted: function () {
      needPerm("view");
      return fb.F.getDocs(fb.F.collection(fb.db, "tombstones")).then(function (snap) {
        var out = []; snap.forEach(function (s) { out.push(Object.assign({ uid: s.id }, s.data())); }); return out;
      });
    },
    restoreUser: function (uid) {
      needPerm("delete");
      var F = fb.F;
      return F.getDoc(F.doc(fb.db, "tombstones", uid)).then(function (s) {
        if (!s.exists()) throw { heb: "לא נמצא." };
        var t = s.data();
        var b = auditBatch("restore_user", uid, t.name, "נמחק", "שוחזר (יתחיל מאפס בכניסה הבאה)", t.username || "");
        b.delete(F.doc(fb.db, "tombstones", uid));
        return b.commit().then(function () {
          return logEvent("admin_restore", "", "המנהל שחזר את החשבון", { uid: uid, name: t.name || "?" });
        });
      });
    },
    listManagers: function () {
      return Promise.resolve().then(function () { needPerm("managers"); }).then(function () {
        return fb.F.getDocs(fb.F.collection(fb.db, "managers"));
      }).then(function (snap) {
        var out = []; snap.forEach(function (s) { var d = s.data(); out.push({ uid: s.id, name: d.name, perms: d.perms || {}, grantedBy: d.grantedBy, updatedAt: d.updatedAt }); });
        return out;
      });
    },
    // perms: {view:true, points:false, ...}; an empty set removes the manager
    setManager: function (uid, perms, name) {
      needPerm("managers");
      if (state.user && uid === state.user.uid) return Promise.reject({ heb: "אי אפשר לשנות הרשאות לעצמך." });
      var p = {}; PERMS.forEach(function (k) { p[k] = !!(perms && perms[k]); });
      var lacking = PERMS.filter(function (k) { return p[k] && !can(k); });
      if (lacking.length) return Promise.reject({ heb: "אפשר לתת רק הרשאות שיש לך: " + lacking.map(function (k) { return PERM_HE[k]; }).join(", ") });
      var F = fb.F, ref = F.doc(fb.db, "managers", uid);
      return Promise.all([F.getDoc(ref), admin.getUser(uid).catch(function () { return null; })]).then(function (r) {
        var old = r[0].exists() ? r[0].data().perms : null;
        var u = r[1], nm = cleanName(name || (u && u.displayName) || (r[0].exists() && r[0].data().name) || "") || "?";
        if (old && PERMS.some(function (k) { return old[k] === true && !can(k); }))
          throw { heb: "למנהל הזה יש הרשאות שאין לך, ולכן רק בעל האתר יכול לשנות אותו." };
        var none = !permList(p).length;
        if (!old && none) return;
        var b = auditBatch("perms", uid, nm, old ? permTxt(old) : "לא מנהל", none ? "לא מנהל" : permTxt(p), none ? "הסרת מנהל" : (old ? "שינוי הרשאות" : "מינוי מנהל"));
        if (none) b.delete(ref);
        else b.set(ref, { perms: p, name: nm.slice(0, 20), grantedBy: state.user.uid, updatedAt: F.serverTimestamp() });
        return b.commit().then(function () {
          return logEvent("admin_perms", "", none ? "הוסר/ה מניהול" : "הרשאות: " + permList(p).join(", "), { uid: uid, name: nm });
        });
      });
    },
    removeManager: function (uid) { return admin.setManager(uid, {}); },
    // Tester flag: sees the official-hub "דמו" button. Not a manager permission; not self-assignable.
    setTester: function (uid, on) {
      needPerm("managers");
      if (state.user && uid === state.user.uid) return Promise.reject({ heb: "אי אפשר לתת או להסיר לעצמך את הרשאת הבודק." });
      var F = fb.F, ref = F.doc(fb.db, "testers", uid);
      return Promise.all([F.getDoc(ref), admin.getUser(uid).catch(function () { return null; })]).then(function (r) {
        var was = r[0].exists(), u = r[1];
        if (!u) throw { heb: "התלמיד לא נמצא." };
        if (!!on === was) return;
        var nm = cleanName(u.displayName) || "?";
        var b = auditBatch("tester", uid, nm, was ? "בודק" : "לא בודק", on ? "בודק" : "לא בודק", on ? "מינוי בודק" : "הסרת בודק");
        if (on) b.set(ref, { name: nm.slice(0, 20), grantedBy: state.user.uid, updatedAt: F.serverTimestamp() });
        else b.delete(ref);
        return b.commit().then(function () {
          if (state.user && uid === state.user.uid) staff.tester = !!on;
          return logEvent("admin_tester", "", on ? "מונה/תה כבודק/ת" : "הוסר/ה מהרשאת בודק", { uid: uid, name: nm });
        });
      });
    },
    // owner / audit permission: everything; other managers: their own entries only
    listAudit: function (o) {
      o = o || {};
      needAdmin();
      var F = fb.F, col = F.collection(fb.db, "audit"), q;
      var all = can("audit");
      var actor = all ? o.actor : state.user.uid;
      if (actor && o.target) q = F.query(col, F.where("actor", "==", actor), F.where("target", "==", o.target), F.limit(o.limit || 500));
      else if (actor) q = F.query(col, F.where("actor", "==", actor), F.limit(o.limit || 1000));
      else if (o.target) q = F.query(col, F.where("target", "==", o.target), F.limit(o.limit || 1000));
      else q = F.query(col, F.orderBy("at", "desc"), F.limit(o.limit || 500));
      return F.getDocs(q).then(function (snap) {
        var out = []; snap.forEach(function (s) { out.push(Object.assign({ id: s.id }, s.data())); });
        out.sort(function (a, b) { return ((b.at && b.at.toMillis && b.at.toMillis()) || 0) - ((a.at && a.at.toMillis && a.at.toMillis()) || 0); });
        return out;
      });
    },
    resetPassword: function (uid, newPassword) {
      needOwner();
      if (String(newPassword || "").length < 6) return Promise.reject({ heb: "הסיסמה החדשה קצרה מדי. צריך לפחות 6 תווים." });
      return admin.getUser(uid).then(function (u) {
        return getOwnerToken().then(function (t) {
          return idtk("accounts:update", { localId: uid, password: newPassword }, t);
        }).then(function () {
          return auditBatch("password_reset", uid, u.displayName, "", "סיסמה חדשה נקבעה", u.username).commit().catch(function (e) { console.warn("englishia audit", e); });
        }).then(function () {
          return logEvent("admin_password_reset", "", "המנהל איפס סיסמה", { uid: uid, name: u.displayName });
        });
      });
    },
    changeUsername: function (uid, newUsername) {
      needOwner();
      newUsername = normUsername(newUsername);
      var bad = checkUsername(newUsername);
      if (bad) return Promise.reject({ heb: bad });
      var F = fb.F, email = usernameToEmail(newUsername);
      return admin.getUser(uid).then(function (u) {
        return getOwnerToken().then(function (t) {
          return idtk("accounts:update", { localId: uid, email: email }, t);
        }).then(function () {
          var b = auditBatch("username_change", uid, u.displayName, u.username, newUsername, "");
          b.update(userRef(uid), { username: newUsername, email: email });
          return b.commit();
        }).then(function () {
          return logEvent("username_change", "", "שם משתמש לכניסה: " + u.username + " ← " + newUsername, { uid: uid, name: u.displayName });
        });
      }).catch(function (e) {
        if (e && e.heb && /EMAIL_EXISTS/.test(e.heb)) throw { heb: "שם המשתמש הזה כבר תפוס." };
        throw e;
      });
    },
    listActivity: function (o) {
      o = o || {};
      needPerm("view");
      var F = fb.F, days = o.days || ACTIVITY_DAYS;
      var since = F.Timestamp.fromMillis(Date.now() - days * 864e5);
      var col = F.collection(fb.db, "activity");
      var q = o.uid
        ? F.query(col, F.where("uid", "==", o.uid), F.where("at", ">=", since), F.orderBy("at", "desc"), F.limit(o.limit || 300))
        : F.query(col, F.where("at", ">=", since), F.orderBy("at", "desc"), F.limit(o.limit || 500));
      return F.getDocs(q).then(function (snap) {
        var out = []; snap.forEach(function (s) { out.push(Object.assign({ id: s.id }, s.data())); }); return out;
      });
    },
    listChanges: function (uid) {
      needPerm("view");
      var F = fb.F;
      var q = F.query(F.collection(fb.db, "activity"), F.where("uid", "==", uid), F.where("at", ">=", F.Timestamp.fromMillis(Date.now() - CHANGE_DAYS * 864e5)),
        F.orderBy("at", "desc"), F.limit(500));
      return F.getDocs(q).then(function (snap) {
        var out = []; snap.forEach(function (s) { var v = s.data(); if (LONG_TYPES.indexOf(v.type) >= 0) out.push(Object.assign({ id: s.id }, v)); }); return out;
      });
    },
    cleanupActivity: function () {
      // Backup for the TTL policy: delete short-lived events older than 7 days (owner only).
      if (!isOwner()) return Promise.resolve(0);
      var F = fb.F, cutoff = F.Timestamp.fromMillis(Date.now() - ACTIVITY_DAYS * 864e5);
      return F.getDocs(F.query(F.collection(fb.db, "activity"), F.where("at", "<", cutoff), F.orderBy("at", "asc"), F.limit(300))).then(function (snap) {
        var jobs = [];
        snap.forEach(function (s) {
          var v = s.data();
          if (v.expireAt && v.expireAt.toMillis() < Date.now()) jobs.push(F.deleteDoc(s.ref));
        });
        return Promise.all(jobs).then(function () { return jobs.length; });
      });
    }
  };

  /* ---------- UI ---------- */
  var CSS = "" +
    ".eng-login-btn.eng-restoring{opacity:.85;cursor:progress}.eng-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,14,24,.72);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:'Segoe UI',Arial,'Noto Sans Hebrew',sans-serif}" +
    ".eng-box{background:#fffaf0;color:#1d1a16;border-radius:24px;max-width:640px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:24px 26px;box-shadow:0 18px 60px rgba(0,0,0,.45);font-size:22px;line-height:1.45;text-align:right}" +
    ".eng-box.wide{max-width:1000px}" +
    ".eng-box h2{margin:0 0 12px;font-size:30px;text-align:center;color:#1d1a16;font-family:inherit}" +
    ".eng-box h3{margin:16px 0 8px;font-size:24px;color:#1d1a16;font-family:inherit}" +
    ".eng-box label{display:block;font-weight:700;margin:12px 0 4px}" +
    ".eng-box .eng-hint{font-size:18px;font-weight:500;color:#5b5348;margin:2px 0 0}" +
    ".eng-box input,.eng-box textarea{width:100%;box-sizing:border-box;font-size:24px;padding:12px 14px;border:3px solid #d9c9a8;border-radius:14px;background:#fff;color:#111;direction:rtl}" +
    ".eng-box input:focus,.eng-box textarea:focus{outline:none;border-color:#ef8f1e}" +
    ".eng-box textarea{font:16px/1.4 monospace;direction:ltr;text-align:left;min-height:180px}" +
    ".eng-btn{font:700 22px/1.2 'Segoe UI',Arial,sans-serif;min-height:56px;padding:12px 22px;border:0;border-radius:16px;background:#ef8f1e;color:#fff;cursor:pointer;box-shadow:0 4px 0 #a85d0b;margin:6px 0 6px 8px}" +
    ".eng-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #a85d0b}" +
    ".eng-btn.sec{background:#e8dcc4;color:#2b2418;box-shadow:0 4px 0 #b9a782}" +
    ".eng-btn.red{background:#c9372c;box-shadow:0 4px 0 #7d1f18}" +
    ".eng-btn.green{background:#2f9e44;box-shadow:0 4px 0 #1b6b2b}" +
    ".eng-btn.sm{font-size:18px;min-height:44px;padding:8px 14px}" +
    ".eng-btn[disabled]{opacity:.55;cursor:wait}" +
    ".eng-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:10px}" +
    ".eng-tabs{display:flex;gap:8px;margin-bottom:8px}.eng-tabs button{flex:1;margin:0}" +
    ".eng-err{background:#ffe1dc;color:#8a1c12;border-radius:12px;padding:10px 14px;margin-top:12px;font-weight:700}" +
    ".eng-ok{background:#ddf5e1;color:#14532d;border-radius:12px;padding:10px 14px;margin-top:12px;font-weight:700}" +
    ".eng-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:8px 0}" +
    ".eng-stat{background:#fff;border:2px solid #eadcbf;border-radius:16px;padding:10px;text-align:center}" +
    ".eng-stat b{display:block;font-size:30px;color:#c56a00}.eng-stat span{font-size:17px;color:#5b5348}" +
    ".eng-lb{list-style:none;padding:0;margin:8px 0}.eng-lb li{display:flex;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:14px;margin:6px 0;background:#fff;border:2px solid #eadcbf;font-size:24px}" +
    ".eng-lb li.first{background:linear-gradient(90deg,#ffe066,#ffd43b);border-color:#e0a800;font-size:28px;font-weight:800}" +
    ".eng-lb li.me{outline:3px solid #ef8f1e}" +
    ".eng-tbl{width:100%;border-collapse:collapse;font-size:18px}.eng-tbl th,.eng-tbl td{border-bottom:1px solid #eadcbf;padding:8px 6px;text-align:right;vertical-align:top}.eng-tbl th{background:#f3e8d2}" +
    ".eng-menu{display:inline-flex;gap:8px;align-items:center;direction:rtl;z-index:2147482000}" +
    ".eng-menu.float{position:fixed;top:10px;left:10px}" +
    ".eng-menu button{font:700 20px/1.1 'Segoe UI',Arial,sans-serif;min-height:48px;padding:10px 16px;border-radius:999px;border:0;cursor:pointer;background:#fffaf0;color:#1d1a16;box-shadow:0 3px 0 rgba(0,0,0,.25)}" +
    ".eng-menu button.adm{background:#1d1a16;color:#ffd43b}" +    ".eng-menu button{display:inline-flex;align-items:center;justify-content:center;gap:.35em}" +    ".eng-ico{width:1.15em;height:1.15em;display:inline-block;vertical-align:-.2em;flex:none}" +    ".eng-has-ico{display:inline-flex;align-items:center;justify-content:center;gap:.35em}" +
    ".eng-x{float:left;font-size:22px;min-height:44px;margin:0 !important}" +
    // v12.2: the in-game students table fits narrow phones (iPhone portrait): scrolls inside the box, never cut off
    ".eng-users{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}" +
    ".eng-users .eng-tbl td:last-child{white-space:nowrap}" +
    "@media (max-width:560px){.eng-ov{padding:8px}.eng-box{padding:16px 12px;font-size:18px}.eng-box h2{font-size:22px}.eng-box h3{font-size:19px}" +
    ".eng-btn{font-size:17px;min-height:48px;padding:10px 14px}.eng-btn.sm{font-size:16px;min-height:44px;padding:8px 10px;margin:0}" +
    ".eng-tbl{font-size:15px}.eng-tbl th,.eng-tbl td{padding:6px 4px}.eng-users .eng-opt{display:none}}";
  function injectCSS() {
    if (document.getElementById("eng-css")) return;
    var s = document.createElement("style"); s.id = "eng-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  var ov = null;
  function openBox(html, wide) {
    injectCSS();
    closeBox();
    ov = document.createElement("div");
    ov.className = "eng-ov";
    ov.innerHTML = '<div class="eng-box' + (wide ? " wide" : "") + '" role="dialog" aria-modal="true">' +
      '<button class="eng-btn sec sm eng-x" data-eng="close" aria-label="סגירה">✕ סגירה</button>' + html + "</div>";
    ov.addEventListener("click", function (e) { if (e.target === ov) closeBox(); });
    ov.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") closeBox(); });
    ov.addEventListener("keyup", function (e) { e.stopPropagation(); });
    document.body.appendChild(ov);
    ov.querySelector('[data-eng="close"]').onclick = closeBox;
    var f = ov.querySelector("input"); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
    return ov.querySelector(".eng-box");
  }
  function closeBox() { if (ov) { ov.remove(); ov = null; } }
  function q(box, sel) { return box.querySelector(sel); }
  function showMsg(box, text, ok) {
    var m = q(box, ".eng-msg");
    if (!m) { m = document.createElement("div"); box.appendChild(m); }
    m.className = "eng-msg " + (ok ? "eng-ok" : "eng-err");
    m.textContent = text;
  }
  function busy(btn, on) { if (btn) btn.disabled = !!on; }
  function errText(e) { return (e && e.heb) || authError(e); }

  /* ui icons (no emoji — classroom PCs render them as squares).
     used by the login/account button and the profile-box actions. */
  function ico(name) {
    var p = {
      user: '<circle cx="12" cy="8" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 19.2c.4-3.2 3.2-5.2 7-5.2s6.6 2 7 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      trophy: '<path d="M8 4h8v3a4 4 0 0 1-8 0V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 6.5H5.5A2.5 2.5 0 0 0 8 9M16 6.5h2.5A2.5 2.5 0 0 1 16 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 11v3M9 20h6M10.5 20l.5-6h2l.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      tools: '<path d="M15.2 14.2 20 19a1.4 1.4 0 0 1-2 2l-4.8-4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.2 4.5 7 6.7l2.8 2.8-2.1 2.1 1.7 1.7 2.1-2.1 2.8 2.8 2.2-2.2-5.3-7.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      pencil: '<path d="M4 20l1.2-5.2L16.5 3.5a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9.2 18.8 4 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.8 5.2l4 4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      lock: '<rect x="6" y="11" width="12" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 11V8.2a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.1" fill="currentColor"/>'
    };
    return '<svg class="eng-ico" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (p[name] || "") + "</svg>";
  }
  function icoLabel(name, text) { return ico(name) + esc(text); }
  function setIcoBtn(el, name, text) { el.innerHTML = text ? icoLabel(name, text) : ico(name); }

  function openLogin(mode) {
    mode = mode || "login";
    var reg = mode === "register";
    var box = openBox(
      "<h2>👤 חשבון אינגלישיה</h2>" +
      '<p class="eng-hint" style="text-align:center">חשבון אחד לכל המשחקים. כך ממשיכים מאיפה שעצרתם, בכל מחשב.</p>' +
      '<div class="eng-tabs"><button class="eng-btn ' + (reg ? "sec" : "") + '" data-eng="tab-login">כניסה</button>' +
      '<button class="eng-btn ' + (reg ? "" : "sec") + '" data-eng="tab-reg">הרשמה חדשה</button></div>' +
      "<label for=\"eng-user\">שם משתמש</label>" +
      '<p class="eng-hint">' + (reg ? "בחרו שם לכניסה, 3 עד 15 אותיות, בלי רווחים. אפשר בעברית או באנגלית." : "השם שבחרתם כשנרשמתם.") + "</p>" +
      '<input id="eng-user" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="15">' +
      "<label for=\"eng-pass\">סיסמה</label>" +
      '<p class="eng-hint">' + (reg ? "לפחות 6 תווים. אל תספרו לאף אחד את הסיסמה." : "הסיסמה הסודית שלכם.") + "</p>" +
      '<input id="eng-pass" type="password" autocomplete="' + (reg ? "new-password" : "current-password") + '" maxlength="60">' +
      '<label style="font-weight:500;font-size:18px"><input type="checkbox" id="eng-show" style="width:auto;margin-left:8px"> להציג את הסיסמה</label>' +
      (reg ? "<label for=\"eng-name\">השם שיופיע במשחק ובטבלת השיאים</label>" +
        '<p class="eng-hint">שם פרטי או כינוי בלבד, בלי שם משפחה (טבלת השיאים גלויה לכולם). אפשר להשאיר ריק.</p><input id="eng-name" maxlength="20" autocomplete="nickname">' : "") +
      '<div class="eng-row"><button class="eng-btn green" data-eng="go">' + (reg ? "✓ להירשם" : "✓ להיכנס") + "</button>" +
      '<button class="eng-btn sec" data-eng="guest">לשחק בלי חשבון</button></div>' +
      (reg ? "" : '<p class="eng-hint">שכחתם סיסמה? בקשו מהמורה לאפס לכם אותה.</p>'));
    q(box, '[data-eng="tab-login"]').onclick = function () { openLogin("login"); };
    q(box, '[data-eng="tab-reg"]').onclick = function () { openLogin("register"); };
    q(box, '[data-eng="guest"]').onclick = closeBox;
    q(box, "#eng-show").onchange = function () { q(box, "#eng-pass").type = this.checked ? "text" : "password"; };
    var go = q(box, '[data-eng="go"]');
    function submit() {
      var u = q(box, "#eng-user").value, p = q(box, "#eng-pass").value;
      busy(go, true);
      (reg ? register(u, p, q(box, "#eng-name").value) : login(u, p)).then(function (user) {
        showMsg(box, (reg ? "נרשמתם! " : "") + "שלום, " + user.displayName + "!", true);
        setTimeout(function () { closeBox(); afterChange(); }, 700);
      }).catch(function (e) { busy(go, false); showMsg(box, errText(e)); });
    }
    go.onclick = submit;
    box.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  function afterChange() { if (opts.reloadOnChange) setTimeout(function () { location.reload(); }, 150); }

  function statBox(v, label) { return '<div class="eng-stat"><b>' + esc(v) + "</b><span>" + esc(label) + "</span></div>"; }

  function openProfile(gameId) {
    gameId = gameId || opts.gameId;
    if (!state.user) return openLogin();
    var d = state.doc || {}, g = statsOf((d.games || {})[gameId]);
    var html = "<h2>" + ico("user") + " " + esc(d.displayName) + "</h2>" +
      '<p class="eng-hint" style="text-align:center">שם משתמש: ' + esc(d.username) + "</p>";
    if (gameId) {
      html += "<h3>🎮 " + esc(opts.gameTitle || GAME_TITLES[gameId] || gameId) + "</h3><div class=\"eng-stats\">" +
        statBox(g.best, "השיא שלי") + statBox(g.totalScore, "ניקוד כולל") + statBox(fmtTime(g.seconds), "זמן משחק") + statBox(g.plays, "פעמים ששיחקתי") + "</div>";
    }
    html += "<h3>🌍 כל אינגלישיה</h3><div class=\"eng-stats\">" +
      statBox(num(d.totalScore), "ניקוד בכל המשחקים") + statBox(fmtTime(d.totalSeconds), "זמן משחק כולל") + statBox(num(d.plays), "משחקים") + "</div>";
    var others = Object.keys(d.games || {}).filter(function (k) { return k !== gameId; });
    if (others.length) {
      html += '<table class="eng-tbl"><tr><th>משחק</th><th>שיא</th><th>ניקוד</th><th>זמן</th></tr>' + others.map(function (k) {
        var s = statsOf(d.games[k]);
        return "<tr><td>" + esc(GAME_TITLES[k] || k) + "</td><td>" + s.best + "</td><td>" + s.totalScore + "</td><td>" + esc(fmtTime(s.seconds)) + "</td></tr>";
      }).join("") + "</table>";
    }
    html += '<div class="eng-row">' + ('<button class="eng-btn eng-has-ico" data-eng="lb">' + icoLabel("trophy", "טבלת דירוג") + "</button>") +
      '<button class="eng-btn sec eng-has-ico" data-eng="name">' + icoLabel("pencil", "שינוי שם") + "</button>" +
      '<button class="eng-btn sec eng-has-ico" data-eng="pass">' + icoLabel("lock", "שינוי סיסמה") + "</button>" +
      (state.admin ? '<button class="eng-btn sec eng-has-ico" data-eng="adm">' + icoLabel("tools", "ניהול") + "</button>" : "") +
      '<button class="eng-btn red" data-eng="out">יציאה מהחשבון</button></div>';
    var box = openBox(html);
    if (q(box, '[data-eng="lb"]')) q(box, '[data-eng="lb"]').onclick = function () { openLeaderboard(gameId); };
    q(box, '[data-eng="name"]').onclick = openChangeName;
    q(box, '[data-eng="pass"]').onclick = openChangePass;
    if (q(box, '[data-eng="adm"]')) q(box, '[data-eng="adm"]').onclick = function () { openAdmin(); };
    q(box, '[data-eng="out"]').onclick = function () {
      busy(this, true);
      logout().then(function () { closeBox(); afterChange(); });
    };
  }
  function openChangeName() {
    var box = openBox('<h2>✏️ שינוי שם</h2><label for="eng-nn">השם החדש שיופיע במשחקים</label><p class="eng-hint">עד 20 אותיות. שם המשתמש לכניסה לא משתנה.</p>' +
      '<input id="eng-nn" maxlength="20" value="' + esc(state.doc && state.doc.displayName) + '"><div class="eng-row"><button class="eng-btn green" data-eng="go">✓ שמירה</button><button class="eng-btn sec" data-eng="back">חזרה</button></div>');
    q(box, '[data-eng="back"]').onclick = function () { openProfile(); };
    q(box, '[data-eng="go"]').onclick = function () {
      var b = this; busy(b, true);
      changeDisplayName(q(box, "#eng-nn").value).then(function () { showMsg(box, "השם נשמר!", true); setTimeout(function () { openProfile(); }, 700); })
        .catch(function (e) { busy(b, false); showMsg(box, errText(e)); });
    };
  }
  function openChangePass() {
    var box = openBox('<h2>🔒 שינוי סיסמה</h2><label for="eng-op">הסיסמה הנוכחית</label><input id="eng-op" type="password" autocomplete="current-password">' +
      '<label for="eng-np">סיסמה חדשה</label><p class="eng-hint">לפחות 6 תווים.</p><input id="eng-np" type="password" autocomplete="new-password">' +
      '<div class="eng-row"><button class="eng-btn green" data-eng="go">✓ שמירה</button><button class="eng-btn sec" data-eng="back">חזרה</button></div>');
    q(box, '[data-eng="back"]').onclick = function () { openProfile(); };
    q(box, '[data-eng="go"]').onclick = function () {
      var b = this; busy(b, true);
      changePassword(q(box, "#eng-op").value, q(box, "#eng-np").value).then(function () { showMsg(box, "הסיסמה שונתה!", true); })
        .catch(function (e) { busy(b, false); showMsg(box, errText(e)); });
    };
  }
  function openLeaderboard(gameId) {
    gameId = gameId || opts.gameId;
    var box = openBox("<h2>" + ico("trophy") + " טבלת שיאים</h2><p class=\"eng-hint\" style=\"text-align:center\">" + esc(opts.gameTitle || GAME_TITLES[gameId] || gameId) + " · 10 השיאים הגבוהים</p><div class=\"eng-lbw\">טוען…</div>");
    getLeaderboard(gameId, 10).then(function (list) {
      var w = q(box, ".eng-lbw");
      if (!list.length) { w.innerHTML = "<p>עוד אין שיאים. היו הראשונים!</p>"; return; }
      w.innerHTML = '<ol class="eng-lb">' + list.map(function (e) {
        return '<li class="' + (e.rank === 1 ? "first " : "") + (e.isMe ? "me" : "") + '"><span>' + (e.rank + ". ") +
          esc(e.name) + (e.isMe ? " (אני)" : "") + "</span><b>" + e.score + "</b></li>";
      }).join("") + "</ol>";
    });
  }

  /* in-game admin panel (owner and managers; each part shows only with its permission) */
  var CSS2 = "" +
    ".eng-rank{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;font-weight:700;white-space:normal;max-width:100%}" +
    ".eng-badge{flex:none;filter:drop-shadow(0 1px 0 rgba(0,0,0,.25))}" +
    ".eng-rankbar{background:#fff;border:2px solid #eadcbf;border-radius:16px;padding:12px 14px;margin:8px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}" +
    ".eng-rankbar .big{font-size:28px;font-weight:800}.eng-prog{flex:1;min-width:160px;height:16px;background:#f1e6cf;border-radius:999px;overflow:hidden}" +
    ".eng-prog i{display:block;height:100%;background:linear-gradient(90deg,#ffb84d,#ef8f1e)}" +
    ".eng-perm{display:flex !important;align-items:flex-start;gap:10px;font-weight:600 !important;font-size:20px;margin:8px 0 !important;cursor:pointer}" +
    ".eng-perm input{width:26px !important;height:26px;flex:none;margin-top:3px}" +
    ".eng-perm.off{opacity:.45;cursor:not-allowed}" +
    ".eng-tag{display:inline-block;border-radius:999px;padding:2px 10px;font-size:15px;font-weight:700;background:#1d1a16;color:#ffd43b;margin-inline-start:6px}" +
    ".eng-sec{border-top:2px dashed #eadcbf;margin-top:14px;padding-top:4px}" +
    ".eng-pe select,.eng-pe-raw select{font-size:20px;padding:10px 12px;border:3px solid #d9c9a8;border-radius:14px;background:#fff;color:#111;max-width:100%}.eng-pe>select{width:100%}" +
    ".eng-pe select:disabled{opacity:.5}.eng-pe-stars{margin:8px 0 0;font-weight:700}" +
    ".eng-pe-per,.eng-pe-raw{margin-top:10px;background:#fff;border:2px solid #eadcbf;border-radius:14px;padding:6px 12px}" +
    ".eng-pe-per summary,.eng-pe-raw summary{cursor:pointer;font-weight:700;min-height:40px;display:flex;align-items:center;font-size:18px}" +
    ".eng-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.eng-inline input,.eng-inline select{width:auto;flex:1;min-width:120px}" +
    ".eng-box select{font-size:22px;padding:10px 12px;border:3px solid #d9c9a8;border-radius:14px;background:#fff;color:#111}" +
    ".eng-lb li .eng-rank{font-size:17px;color:#5b5348;margin-inline-start:8px}";
  function injectCSS2() {
    injectCSS();
    if (document.getElementById("eng-css2")) return;
    var s = document.createElement("style"); s.id = "eng-css2"; s.textContent = CSS2; document.head.appendChild(s);
  }
  function deletedNotice() {
    openBox("<h2>החשבון הוסר</h2><p style=\"text-align:center\">המורה הסיר/ה את החשבון הזה. אפשר לבקש מהמורה לשחזר אותו, או לשחק בלי חשבון.</p>" +
      '<div class="eng-row" style="justify-content:center"><button class="eng-btn red" data-eng="out">יציאה מהחשבון</button></div>');
    q(ov, '[data-eng="out"]').onclick = function () { logout().then(function () { closeBox(); afterChange(); }); };
  }
  // profile: add the rank card
  var origOpenProfile = openProfile;
  openProfile = function (gameId) {
    if (state.user && staff.deleted && !state.doc) return deletedNotice();
    origOpenProfile(gameId);
    if (!state.user || !ov) return;
    injectCSS2();
    var box = q(ov, ".eng-box"), h = box && box.querySelector("h2");
    if (!h) return;
    var card = document.createElement("div");
    card.className = "eng-rankbar";
    function paint() {
      var r = myRank();
      var pct = r.next ? Math.max(0, Math.min(100, Math.round(100 * (r.total - r.auto.min) / Math.max(1, r.next.min - r.auto.min)))) : 100;
      card.innerHTML = badgeSVG(r.tier, r.level, 54) + '<div><div class="big">' + esc(rankLabel(r)) + "</div><div class=\"eng-hint\">" +
        (r.customName ? "שם דרגה שנקבע ע״י המורה · תג " + esc(r.tier.name) : ("דרגה " + r.level + (r.manual ? " · נקבעה ע״י המורה" : ""))) + "</div></div>" +
        (r.manual ? "" : '<div style="flex:1;min-width:180px"><div class="eng-prog"><i style="width:' + pct + '%"></i></div><div class="eng-hint">' +
          (r.next ? "עוד " + r.toNext + " נקודות לדרגה " + esc(r.next.name) : "הגעת לדרגה הגבוהה ביותר!") + "</div></div>");
    }
    paint();
    var after = h.nextElementSibling || h;
    after.parentNode.insertBefore(card, after.nextSibling);
    getTiers().then(paint);
  };
  // leaderboard with rank badges
  openLeaderboard = function (gameId) {
    gameId = gameId || opts.gameId;
    injectCSS2();
    var box = openBox("<h2>" + ico("trophy") + " טבלת שיאים</h2><p class=\"eng-hint\" style=\"text-align:center\">" + esc(opts.gameTitle || GAME_TITLES[gameId] || gameId) + " · 10 השיאים הגבוהים</p><div class=\"eng-lbw\">טוען…</div>");
    loadFirebase().then(function () {
      var F = fb.F;
      return F.getDocs(F.query(F.collection(fb.db, "leaderboards", gameId, "scores"), F.orderBy("score", "desc"), F.limit(10)));
    }).then(function (snap) {
      var me = state.user && state.user.uid, list = [];
      snap.forEach(function (s) { var v = s.data(); list.push({ uid: s.id, rank: list.length + 1, name: v.name, score: v.score, isMe: s.id === me }); });
      lbCache[gameId] = list.map(function (e) { return { rank: e.rank, name: e.name, score: e.score, isMe: e.isMe }; });
      return Promise.all([ranksFor(list.map(function (e) { return e.uid; })), getTiers()]).then(function (r) {
        list.forEach(function (e, i) { e.r = r[0][i] ? rankOf(r[0][i].total, r[0][i].manual, r[1], r[0][i].customName) : null; });
        return list;
      });
    }).catch(function (e) {
      console.warn("englishia leaderboard", e);
      return (lbCache[gameId] || []).map(function (e) { return Object.assign({}, e); });
    }).then(function (list) {
      var w = q(box, ".eng-lbw");
      if (!w) return;
      if (!list.length) { w.innerHTML = "<p>עוד אין שיאים. היו הראשונים!</p>"; return; }
      w.innerHTML = '<ol class="eng-lb">' + list.map(function (e) {
        return '<li class="' + (e.rank === 1 ? "first " : "") + (e.isMe ? "me" : "") + '"><span>' + (e.rank + ". ") +
          esc(e.name) + (e.isMe ? " (אני)" : "") + (e.r ? rankChip(e.r, 24) : "") + "</span><b>" + e.score + "</b></li>";
      }).join("") + "</ol>";
    });
  };

  function openAdmin(gameId) {
    gameId = gameId || opts.gameId;
    if (!isStaff()) return;
    injectCSS2();
    var title = opts.gameTitle || GAME_TITLES[gameId] || gameId || "אינגלישיה";
    var role = isOwner() ? "בעל האתר" : "מנהל · " + permList(staff.perms).length + " הרשאות";
    var box = openBox("<h2>🛠️ ניהול · " + esc(title) + '<span class="eng-tag">' + esc(role) + "</span></h2>" +
      '<div class="eng-row">' + (devTools && isOwner() ? '<button class="eng-btn" data-eng="dev">🧪 ' + esc(devTools.label) + "</button>" : "") +
      '<a class="eng-btn sec" style="text-decoration:none;display:inline-flex;align-items:center" href="' + esc(ROOT + "admin/") + '" target="_blank" rel="noopener">📋 עמוד ניהול מלא</a></div>' +
      (gameId ? (can("view") ? "<h3>תלמידים במשחק הזה</h3><div class=\"eng-users\">טוען…</div>" : '<p class="eng-hint">אין לך הרשאת צפייה בתלמידים.</p>') : ""), true);
    if (q(box, '[data-eng="dev"]')) q(box, '[data-eng="dev"]').onclick = function () { closeBox(); if (isOwner()) devTools.fn(); };
    if (!gameId || !can("view")) return;
    admin.listUsers().then(function (users) {
      var w = q(box, ".eng-users");
      if (!w) return;
      if (!users.length) { w.textContent = "אין עדיין משתמשים."; return; }
      w.innerHTML = '<table class="eng-tbl"><tr><th>שם</th><th>דרגה</th><th>שיא</th><th>ניקוד</th><th class="eng-opt">זמן</th><th class="eng-opt">פעמים</th><th></th></tr>' +
        users.map(function (u) {
          var s = statsOf((u.games || {})[gameId]);
          return "<tr><td><b>" + esc(u.displayName) + "</b><br><small>" + esc(u.username) + "</small></td><td>" + rankChip(u.rank, 22) + "</td><td>" + s.best + "</td><td>" + s.totalScore +
            "</td><td class=\"eng-opt\">" + esc(fmtTime(s.seconds)) + "</td><td class=\"eng-opt\">" + s.plays + '</td><td><button class="eng-btn sm" data-uid="' + esc(u.uid) + '">ניהול</button></td></tr>';
        }).join("") + "</table>";
      Array.prototype.forEach.call(w.querySelectorAll("[data-uid]"), function (b) {
        b.onclick = function () { openAdminUser(b.getAttribute("data-uid"), gameId); };
      });
    }).catch(function (e) { var w = q(box, ".eng-users"); if (w) w.textContent = errText(e); });
  }
  /* v12.2: friendly progress editor (in-game admin + /admin/ page). Saves through admin.setProgress
     = "points" permission + audit entry, same as before. Raw JSON only behind a collapsed toggle. */
  var MILA = {
    worlds: ["אי הג'ונגל", "אוקיינוס הפיראטים", "העיר הקסומה", "גלקסיית החלל", "ממלכת הקרח", "מדבר הפירמידות", "מעמקי הים", "ארץ הר הגעש"],
    heroes: ["ליאם", "מאיה", "נובה"], stages: 7, boss: 6
  };
  function milaStageName(t) { return t === MILA.boss ? "בוס" : "שלב " + (t + 1); }
  // highest stage done, in play order: -1 = nothing yet, else world*7+stage
  function milaReached(prog) {
    var best = -1;
    Object.keys(prog || {}).forEach(function (k) {
      var m = /^(\d+)-(\d+)$/.exec(k); if (!m || !(prog[k] > 0)) return;
      var w = +m[1] - 1, t = +m[2]; if (w < 0 || w >= MILA.worlds.length || t < 0 || t >= MILA.stages) return;
      best = Math.max(best, w * MILA.stages + t);
    });
    return best;
  }
  function milaApplyReached(prog, reached) {
    var out = {};
    for (var w = 0; w < MILA.worlds.length; w++) for (var t = 0; t < MILA.stages; t++) {
      var key = (w + 1) + "-" + t, idx = w * MILA.stages + t;
      if (idx <= reached) out[key] = Math.min(3, Math.max(1, +(prog || {})[key] || 0));
    }
    return out;
  }
  function starSum(prog) { var n = 0; Object.keys(prog || {}).forEach(function (k) { n += +prog[k] || 0; }); return n; }
  function progressEditor(host, uid, gameId, onSaved) {
    injectCSS(); injectCSS2();
    host.textContent = "טוען…";
    return admin.loadProgress(uid, gameId).then(function (p) {
      p = p && typeof p === "object" ? p : {};
      var mila = gameId === "mila-quest";
      var html = "";
      var reached = -1;
      if (mila) {
        reached = milaReached(p.prog);
        var rw = reached < 0 ? -1 : Math.floor(reached / MILA.stages), rt = reached < 0 ? 0 : reached % MILA.stages;
        var per = MILA.worlds.map(function (n, i) {
          var s = 0; for (var t = 0; t < MILA.stages; t++) s += +((p.prog || {})[(i + 1) + "-" + t]) || 0;
          return "<tr><td>" + esc(n) + "</td><td>" + s + " / " + MILA.stages * 3 + "</td></tr>";
        }).join("");
        html += '<div class="eng-pe">' +
          '<label for="eng-pe-coins">מטבעות</label><input id="eng-pe-coins" type="number" min="0" inputmode="numeric" value="' + num(p.coins) + '">' +
          '<label for="eng-pe-hero">דמות</label><select id="eng-pe-hero">' + MILA.heroes.map(function (h, i) { return '<option value="' + i + '"' + ((+p.hero || 0) === i ? " selected" : "") + ">" + esc(h) + "</option>"; }).join("") + "</select>" +
          '<label for="eng-pe-world">עד איפה הגיע/ה (השלב האחרון שהושלם)</label>' +
          '<div class="eng-inline"><select id="eng-pe-world"><option value="-1"' + (rw < 0 ? " selected" : "") + ">עוד לא סיים/ה אף שלב</option>" +
          MILA.worlds.map(function (n, i) { return '<option value="' + i + '"' + (rw === i ? " selected" : "") + ">עולם " + (i + 1) + " · " + esc(n) + "</option>"; }).join("") + "</select>" +
          '<select id="eng-pe-stage">' + [0, 1, 2, 3, 4, 5, 6].map(function (t) { return '<option value="' + t + '"' + (rt === t ? " selected" : "") + ">" + milaStageName(t) + "</option>"; }).join("") + "</select></div>" +
          '<p class="eng-hint">שלבים עד השלב שבחרתם יסומנו כהושלמו (עם הכוכבים שכבר היו, לפחות כוכב אחד), ושלבים אחריו יינעלו שוב. אם לא משנים את הבחירה, השלבים לא משתנים.</p>' +
          '<p class="eng-pe-stars">כוכבים: <b id="eng-pe-stars">' + starSum(p.prog) + "</b> <span class=\"eng-hint\">(מחושב לבד מהשלבים)</span></p>" +
          '<details class="eng-pe-per"><summary>כוכבים לפי עולם</summary><table class="eng-tbl">' + per + "</table></details>" +
          '<div class="eng-row"><button class="eng-btn green" data-pe="save">שמירת התקדמות</button><button class="eng-btn red" data-pe="reset">איפוס התקדמות</button></div></div>';
      } else {
        html += '<p class="eng-hint">למשחק הזה אין טופס מיוחד. את הניקוד והזמן עורכים בשדות הניקוד.</p>';
      }
      html += '<details class="eng-pe-raw"><summary>עריכה מתקדמת (למומחים)</summary><p class="eng-hint">הנתונים השמורים של המשחק כטקסט (JSON). לשנות רק אם יודעים מה עושים.</p>' +
        '<textarea id="eng-pe-json"></textarea><div class="eng-row"><button class="eng-btn sec" data-pe="json">שמירת הטקסט</button></div></details>';
      host.innerHTML = html;
      q(host, "#eng-pe-json").value = JSON.stringify(p, null, 1);
      var msgBox = host;
      function save(btn, data, okText) {
        busy(btn, true);
        return admin.setProgress(uid, gameId, data).then(function () {
          busy(btn, false);
          if (onSaved) onSaved(okText);
          return progressEditor(host, uid, gameId, onSaved).then(function () { showMsg(host, okText, true); });
        }).catch(function (e) { busy(btn, false); showMsg(msgBox, errText(e)); });
      }
      function on(k, fn) { var el = q(host, '[data-pe="' + k + '"]'); if (el) el.onclick = fn; }
      on("json", function () {
        var data;
        try { data = JSON.parse(q(host, "#eng-pe-json").value); } catch (e) { showMsg(msgBox, "הטקסט לא תקין (JSON)."); return; }
        if (!data || typeof data !== "object" || Array.isArray(data)) { showMsg(msgBox, "הטקסט צריך להיות אובייקט JSON."); return; }
        save(this, data, "ההתקדמות נשמרה.");
      });
      if (!mila) return;
      function chosen() { var w = +q(host, "#eng-pe-world").value; return w < 0 ? -1 : w * MILA.stages + (+q(host, "#eng-pe-stage").value); }
      var stageSel = q(host, "#eng-pe-stage");
      function syncStage() { stageSel.disabled = +q(host, "#eng-pe-world").value < 0; }
      q(host, "#eng-pe-world").onchange = syncStage; syncStage();
      on("save", function () {
        var coins = q(host, "#eng-pe-coins").value;
        if (coins === "" || !(+coins >= 0)) { showMsg(msgBox, "מספר המטבעות צריך להיות 0 או יותר."); return; }
        var out = JSON.parse(JSON.stringify(p));
        out.stagesV = 2;
        out.coins = num(coins);
        out.hero = Math.max(0, Math.min(MILA.heroes.length - 1, +q(host, "#eng-pe-hero").value || 0));
        var c = chosen();
        if (c !== reached) out.prog = milaApplyReached(p.prog, c);
        else out.prog = p.prog || {};
        out.stars = starSum(out.prog);
        save(this, out, "ההתקדמות נשמרה.");
      });
      on("reset", function () {
        if (!confirm("לאפס את ההתקדמות במשחק? כל השלבים, הכוכבים והמטבעות יתאפסו (הניקוד בטבלאות לא משתנה).")) return;
        var out = { stagesV: 2, prog: {}, coins: 0, stars: 0, hero: +p.hero || 0, notebook: {}, known: {}, best: 0, runs: 0, ach: [] };
        if (p.age) out.age = p.age;
        save(this, out, "ההתקדמות אופסה.");
      });
    }).catch(function (e) { host.textContent = errText(e); });
  }

  function openAdminUser(uid, gameId) {
    Promise.all([admin.getUser(uid), getTiers()]).then(function (r) {
      var u = r[0], tiers = r[1];
      if (!u) { openBox("<p>התלמיד לא נמצא.</p>"); return; }
      var s = statsOf((u.games || {})[gameId]);
      var html = "<h2>🛠️ " + esc(u.displayName) + "</h2><p class=\"eng-hint\" style=\"text-align:center\">שם משתמש: " + esc(u.username) + " · " + esc(opts.gameTitle || gameId) + "</p>" +
        '<div class="eng-rankbar">' + badgeSVG(u.rank.tier, u.rank.level, 44) + '<div><div class="big">' + esc(rankLabel(u.rank)) + '</div><div class="eng-hint">' +
        (u.rank.customName ? "שם דרגה מותאם · תג " + esc(u.rank.tier.name) : (u.rank.manual ? "דרגה ידנית" : "לפי ניקוד")) + " · ניקוד כולל באינגלישיה: " + num(u.totalScore) + "</div></div></div>";
      if (can("points")) {
        html += '<div class="eng-sec"><h3>ניקוד וזמן במשחק הזה</h3>' +
          '<label>הוספת נקודות (מספר שלילי מוריד)</label><div class="eng-inline"><input id="eng-a-add" type="number" placeholder="למשל 100"><button class="eng-btn green" data-eng="add">➕ הוספה</button></div>' +
          '<label>שיא</label><input id="eng-a-best" type="number" min="0" value="' + s.best + '">' +
          '<label>ניקוד כולל במשחק</label><input id="eng-a-total" type="number" min="0" value="' + s.totalScore + '">' +
          '<label>זמן משחק (דקות)</label><input id="eng-a-min" type="number" min="0" value="' + Math.round(s.seconds / 60) + '">' +
          '<label>כמה פעמים שיחק/ה</label><input id="eng-a-plays" type="number" min="0" value="' + s.plays + '">' +
          '<div class="eng-row"><button class="eng-btn green" data-eng="save">✓ שמירת ניקוד</button><button class="eng-btn red" data-eng="reset">מחיקת הניקוד וההתקדמות במשחק</button></div></div>';
      }
      if (can("ranks")) {
        html += '<div class="eng-sec"><h3>דרגה</h3><p class="eng-hint">דרגה ידנית נשארת עד שמחזירים ל"לפי ניקוד". אפשר גם לכתוב שם דרגה חופשי שיופיע בכל המקומות. צבע התג לפי הדרגה שנבחרה (או לפי הניקוד).</p><div class="eng-inline"><select id="eng-a-rank"><option value="">לפי ניקוד (אוטומטי)</option>' +
          tiers.map(function (t, i) { return '<option value="' + esc(t.id) + '"' + (u.rankDoc && u.rankDoc.manual === t.id ? " selected" : "") + ">" + (i + 1) + ". " + esc(t.name) + "</option>"; }).join("") +
          '</select></div><label>דרגה בכתב חופשי (לא חובה)</label><div class="eng-inline"><input id="eng-a-rank-custom" maxlength="24" placeholder="למשל מלך המילים" value="' +
          esc((u.rankDoc && u.rankDoc.customName) || "") + '"><button class="eng-btn" data-eng="rank">שמירת דרגה</button></div></div>';
      }
      if (isOwner()) {
        html += "<div class=\"eng-sec\"><h3>סיסמה</h3><label>סיסמה חדשה לתלמיד/ה</label><p class=\"eng-hint\">לפחות 6 תווים. בפעם הראשונה תתבקשו לאשר עם חשבון הגוגל של המורה.</p>" +
          '<input id="eng-a-pass" autocomplete="off"><div class="eng-row"><button class="eng-btn" data-eng="pass">🔑 איפוס סיסמה</button></div></div>';
      }
      if (can("names")) {
        html += "<div class=\"eng-sec\"><h3>שם</h3><input id=\"eng-a-name\" maxlength=\"20\" value=\"" + esc(u.displayName) + '"><div class="eng-row"><button class="eng-btn sec" data-eng="name">✏️ שינוי שם</button></div></div>';
      }
      if (can("points")) {
        html += '<div class="eng-sec"><h3>התקדמות במשחק</h3><div class="eng-pe-host">טוען…</div></div>';
      }
      html += '<div class="eng-row"><button class="eng-btn sec" data-eng="back">חזרה לרשימה</button></div>';
      var box = openBox(html, true);
      if (q(box, ".eng-pe-host")) progressEditor(q(box, ".eng-pe-host"), uid, gameId);
      q(box, '[data-eng="back"]').onclick = function () { openAdmin(gameId); };
      function act(btn, fn, okText, reopen) {
        busy(btn, true);
        Promise.resolve().then(fn).then(function () {
          busy(btn, false);
          if (reopen) { openAdminUser(uid, gameId); setTimeout(function () { if (ov) showMsg(q(ov, ".eng-box"), okText, true); }, 400); }
          else showMsg(box, okText, true);
        }).catch(function (e) { busy(btn, false); showMsg(box, errText(e)); });
      }
      function on(sel, fn) { var el = q(box, '[data-eng="' + sel + '"]'); if (el) el.onclick = fn; }
      on("add", function () { var v = q(box, "#eng-a-add").value; act(this, function () { return admin.addPoints(uid, gameId, v); }, "הנקודות נוספו.", true); });
      on("save", function () {
        act(this, function () {
          return admin.setStats(uid, gameId, { best: q(box, "#eng-a-best").value, totalScore: q(box, "#eng-a-total").value,
            seconds: (+q(box, "#eng-a-min").value || 0) * 60, plays: q(box, "#eng-a-plays").value });
        }, "הניקוד נשמר.", true);
      });
      on("reset", function () {
        if (!confirm("למחוק את כל הניקוד וההתקדמות של " + u.displayName + " במשחק הזה?")) return;
        act(this, function () { return admin.resetGame(uid, gameId); }, "הניקוד וההתקדמות נמחקו.", true);
      });
      on("rank", function () { var v = q(box, "#eng-a-rank").value, c = q(box, "#eng-a-rank-custom") ? q(box, "#eng-a-rank-custom").value : ""; act(this, function () { return admin.setRank(uid, v, c); }, "הדרגה נשמרה.", true); });
      on("pass", function () { var p = q(box, "#eng-a-pass").value; act(this, function () { return admin.resetPassword(uid, p); }, "הסיסמה החדשה נשמרה. תנו אותה לתלמיד/ה."); });
      on("name", function () { act(this, function () { return admin.rename(uid, q(box, "#eng-a-name").value); }, "השם שונה."); });
    }).catch(function (e) { openBox("<p>" + esc(errText(e)) + "</p>"); });
  }

  /* menu button(s) */
  var menus = [];
  function mountMenu(target) {
    injectCSS();
    var el = document.createElement("div");
    el.className = "eng-menu";
    if (target) {
      var t = typeof target === "string" ? document.querySelector(target) : target;
      if (t) t.appendChild(el); else { el.classList.add("float"); document.body.appendChild(el); }
    } else { el.classList.add("float"); document.body.appendChild(el); }
    menus.push(el);
    renderMenus();
    return el;
  }
  function renderMenus() {
    menus.forEach(function (el) {
      el.innerHTML = "";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "eng-login-btn";
      if (state.user) {
        var hintName = (function () { var h = readHint(); return h && (h.displayName || h.username) || ""; })();
        setIcoBtn(b, "user", (state.doc && state.doc.displayName) || hintName || "החשבון שלי");
        b.onclick = function () { openProfile(); };
      } else if (state.restoring) {
        setIcoBtn(b, "user", "מתחבר...");
        b.className = "eng-login-btn eng-restoring";
        b.setAttribute("aria-busy", "true");
        b.onclick = function () { if (state.resolved) openLogin(); };
      } else {
        setIcoBtn(b, "user", "התחברות");
        b.onclick = function () { openLogin(); };
      }
      el.appendChild(b);
      el.appendChild(lbButton());
      if (state.admin) {
        var a = document.createElement("button");
        a.type = "button"; a.className = "adm eng-admin-btn"; setIcoBtn(a, "tools", "ניהול");
        a.onclick = function () { opts.gameId ? openAdmin() : (location.href = ROOT + "admin/"); };
        el.appendChild(a);
      }
    });
  }

  /* bridge for the older local API (window.Englishia from englishia-player.js) */
  function bridgeLocal(L, gameId) {
    if (!L || L.__engBridged) return Promise.resolve();
    L.__engBridged = true;
    var orig = {};
    ["setProgress", "recordSession", "getProfile", "getLeaderboard", "clearName"].forEach(function (k) { orig[k] = L[k]; });
    var MAPKEY = "englishia.cloudmap";
    function map() { try { return JSON.parse(localStorage.getItem(MAPKEY) || "{}"); } catch (e) { return {}; } }
    function setMap(m) { try { localStorage.setItem(MAPKEY, JSON.stringify(m)); } catch (e) {} }
    var lastStages = -1;
    function stageCount(d) { return d && d.prog ? Object.keys(d.prog).length : 0; }

    L.setProgress = function (gid, data) {
      var r = orig.setProgress.call(L, gid, data);
      if (state.user && gid === gameId) {
        saveProgressSoon(gid, data);
        var n = stageCount(data);
        if (lastStages >= 0 && n > lastStages) logEvent("stage_completed", gid, "שלבים שהושלמו: " + n);
        lastStages = n;
      }
      return r;
    };
    L.recordSession = function (gid, score, seconds) {
      var r = orig.recordSession.call(L, gid, score, seconds);
      if (state.user) recordSession(gid, score, seconds);
      return r;
    };
    hooks.register = function () {
      var p = L.getName() ? L.getProgress(gameId) : null;
      if (p && p.prog && Object.keys(p.prog).length) return saveProgress(gameId, p);
    };
    L.getProfile = function () {
      if (!state.user) return orig.getProfile.call(L);
      var d = state.doc || {}, games = {};
      Object.keys(d.games || {}).forEach(function (k) { games[k] = statsOf(d.games[k]); });
      return { name: d.displayName || "", totalScore: num(d.totalScore), totalSeconds: num(d.totalSeconds), games: games };
    };
    L.getLeaderboard = function (gid) {
      var c = lbCache[gid];
      if (c) { getLeaderboard(gid, 10); return c.map(function (e) { return { name: e.name, score: e.score, date: "" }; }); }
      return orig.getLeaderboard.call(L, gid);
    };
    L.clearName = function () {
      if (state.user) {
        logout().then(function () { location.reload(); });
        return;
      }
      return orig.clearName.call(L);
    };
    function applyCloudProfile(u) {
      if (!u) return Promise.resolve();
      getLeaderboard(gameId, 10);
      return loadProgress(gameId).then(function (cloud) {
        var m = map(), lid = m[u.uid];
        var exists = lid && L.listProfiles().some(function (p) { return p.id === lid; });
        if (!exists) {
          lid = L.createProfile(u.displayName);
          if (!lid) {
            // device full: reuse the active profile slot
            lid = L.getActiveId();
          }
          m = {}; m[u.uid] = lid; setMap(m);
        }
        L.switchProfile(lid);
        L.setName(u.displayName);
        if (cloud) orig.setProgress.call(L, gameId, cloud);
        else orig.setProgress.call(L, gameId, null);
        lastStages = stageCount(cloud);
      });
    }
    onChange(function (u) {
      if (!u) {
        if (state.restoring) return;
        var m = map();
        var hadCloud = Object.keys(m).length > 0;
        Object.keys(m).forEach(function (uid) { try { L.deleteProfile(m[uid]); } catch (e) {} });
        setMap({});
        // Only drop the active local name after a real account logout.
        // Guests must keep their device profile across reloads.
        if (hadCloud) {
          try { L.clearName && orig.clearName.call(L); } catch (e) {}
        }
      } else {
        applyCloudProfile(u);
      }
    });

    return ready().then(function (u) {
      if (!u) {
        // Auth may still be restoring after a slow reload; wait for onChange.
        if (state.restoring) return;
        // signed out on this device: drop any cached account profile
        var m0 = map();
        if (Object.keys(m0).length) {
          Object.keys(m0).forEach(function (k) { try { L.deleteProfile(m0[k]); } catch (e) {} });
          setMap({}); try { orig.clearName.call(L); } catch (e) {}
        }
        return;
      }
      return applyCloudProfile(u);
    });
  }


  /* ---------- period leaderboards (v12.4) ----------
     gstats/{scope}/players/{uid}, scope = "all" or a game id:
       {name, dK, wK, mK, d, dt, w, wt, m, mt, t, tt, updatedAt}
     d/w/m = points today / this week / this month (Israel time, week starts Sunday),
     dt/wt/mt = seconds, t/tt = all-time totals (= the profile totals).
     Written right after the profile update (recordSession) as a separate transaction, so the
     old profile path never depends on it. Growth since the last write is credited to the
     current periods; the Firestore rules check every number against the profile. */
  var IL_FMT = null;
  function ilParts(ms) {
    try {
      IL_FMT = IL_FMT || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
      var a = IL_FMT.format(new Date(ms)).split("-").map(Number);
      if (a.length === 3 && a[0] > 2000) return { y: a[0], m: a[1], d: a[2] };
    } catch (e) {}
    var t = new Date(ms + 2 * 3600e3); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function periodKeys(ms) {
    var p = ilParts(ms == null ? Date.now() : ms);
    var dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    var s = new Date(Date.UTC(p.y, p.m - 1, p.d - dow));
    return { dK: p.y * 10000 + p.m * 100 + p.d, wK: s.getUTCFullYear() * 10000 + (s.getUTCMonth() + 1) * 100 + s.getUTCDate(), mK: p.y * 100 + p.m };
  }
  var STAT_MAX_PTS = 100000, STAT_MAX_SEC = 21600;
  function scopeTotals(u, scope) {
    if (scope === "all") return { t: num(u.totalScore), tt: num(u.totalSeconds), plays: num(u.plays) };
    var g = (u.games || {})[scope] || {};
    return { t: num(g.totalScore), tt: num(g.seconds), plays: num(g.plays) };
  }
  function statsDoc(old, u, scope, k, F) {
    var x = scopeTotals(u, scope), o = old && typeof old.t === "number" ? old : null;
    var da = o ? x.t - o.t : (x.plays <= 1 ? x.t : 0), db = o ? x.tt - o.tt : (x.plays <= 1 ? x.tt : 0);
    if (!(da >= 0 && db >= 0 && da <= STAT_MAX_PTS && db <= STAT_MAX_SEC)) { da = 0; db = 0; }
    var sd = o && o.dK === k.dK, sw = o && o.wK === k.wK, sm = o && o.mK === k.mK;
    return { name: u.displayName, dK: k.dK, wK: k.wK, mK: k.mK,
      d: (sd ? o.d : 0) + da, dt: (sd ? o.dt : 0) + db, w: (sw ? o.w : 0) + da, wt: (sw ? o.wt : 0) + db,
      m: (sm ? o.m : 0) + da, mt: (sm ? o.mt : 0) + db, t: x.t, tt: x.tt, updatedAt: F.serverTimestamp() };
  }
  function statRef(scope, uid) { return fb.F.doc(fb.db, "gstats", scope, "players", uid); }
  var statsBusy = Promise.resolve();
  // one transaction per (at most 2) scopes; writes only what changed. Never throws.
  function syncStats(scopes) {
    if (!fb || !state.user) return Promise.resolve(false);
    var uid = state.user.uid, F = fb.F;
    scopes = scopes.filter(function (s, i) { return s && /^[a-z0-9-]{1,40}$/.test(s) && scopes.indexOf(s) === i; });
    var chunks = [];
    for (var i = 0; i < scopes.length; i += 2) chunks.push(scopes.slice(i, i + 2));
    var run = function () {
      return chunks.reduce(function (p, chunk) {
        return p.then(function () {
          return F.runTransaction(fb.db, function (tx) {
            var k = periodKeys();
            return tx.get(userRef(uid)).then(function (us) {
              if (!us.exists()) return;
              var u = us.data();
              return Promise.all(chunk.map(function (s) { return tx.get(statRef(s, uid)); })).then(function (olds) {
                chunk.forEach(function (s, j) {
                  var o = olds[j].exists() ? olds[j].data() : null;
                  var n = statsDoc(o, u, s, k, F);
                  if (o && o.name === n.name && o.dK === n.dK && o.wK === n.wK && o.mK === n.mK && o.t === n.t && o.tt === n.tt) return;
                  tx.set(statRef(s, uid), n);
                });
              });
            });
          });
        }).catch(function (e) { console.warn("englishia stats", e && (e.code || e.message)); });
      }, Promise.resolve()).then(function () { lbData = {}; return true; });
    };
    statsBusy = statsBusy.then(run, run);
    return statsBusy;
  }
  var recordWithRank = recordSession;
  recordSession = function (gameId, score, seconds, progress) {
    return recordWithRank(gameId, score, seconds, progress).then(function (ok) {
      if (ok) return syncStats(["all", gameId]).then(function () { return ok; });
      return ok;
    });
  };
  var renameBase = changeDisplayName;
  changeDisplayName = function (name) {
    return renameBase(name).then(function (r) {
      return syncStats(["all"].concat(Object.keys((state.doc && state.doc.games) || {}))).then(function () { return r; });
    });
  };
  // after sign-in: make sure this player's docs exist and roll over to today (cheap no-op otherwise)
  var statsSeen = "";
  listeners.push(function (u) {
    if (!u || statsSeen === u.uid) return;
    statsSeen = u.uid;
    setTimeout(function () { if (state.doc) syncStats(["all"].concat(opts.gameId ? [opts.gameId] : [])); }, 1500);
  });

  /* reading the boards */
  var lbData = {};
  var PERIODS = [["d", "היום"], ["w", "השבוע"], ["m", "החודש"], ["t", "כל הזמנים"]];
  var LB_TOP = 20;
  function fieldFor(period, metric) { return period === "t" ? (metric === "time" ? "tt" : "t") : period + (metric === "time" ? "t" : ""); }
  function keyFor(period) { return period === "t" ? "" : period + "K"; }
  function fetchBoard(scope, period, metric) {
    var id = [scope, period, metric].join("|"), c = lbData[id];
    if (c && Date.now() - c.at < 60e3) return Promise.resolve(c.v);
    return loadFirebase().then(function () {
      var F = fb.F, k = periodKeys(), field = fieldFor(period, metric), key = keyFor(period);
      var col = F.collection(fb.db, "gstats", scope, "players");
      var parts = key ? [F.where(key, "==", k[key])] : [];
      return F.getDocs(F.query.apply(null, [col].concat(parts, [F.orderBy(field, "desc"), F.limit(LB_TOP)]))).then(function (snap) {
        var me = state.user && state.user.uid, list = [];
        snap.forEach(function (s) { var v = s.data(); if (num(v[field]) > 0) list.push({ uid: s.id, name: v.name, value: num(v[field]), isMe: s.id === me }); });
        list.forEach(function (e, i) { e.rank = i + 1; if (i && e.value === list[i - 1].value) e.rank = list[i - 1].rank; });
        var mine = null;
        var mineP = Promise.resolve();
        if (me && !list.some(function (e) { return e.isMe; })) {
          mineP = F.getDoc(statRef(scope, me)).then(function (s) {
            if (!s.exists()) return;
            var v = s.data(), val = num(v[field]);
            if (!val || (key && v[key] !== k[key])) return;
            return F.getCountFromServer(F.query.apply(null, [col].concat(parts, [F.where(field, ">", val), F.orderBy(field, "desc")]))).then(function (cnt) {
              mine = { uid: me, name: v.name, value: val, isMe: true, rank: cnt.data().count + 1 };
            }).catch(function () { mine = { uid: me, name: v.name, value: val, isMe: true, rank: 0 }; });
          }).catch(function () {});
        }
        return mineP.then(function () {
          var all = list.concat(mine ? [mine] : []);
          return Promise.all([ranksFor(all.map(function (e) { return e.uid; })), getTiers()]).then(function (r) {
            all.forEach(function (e, i) { var x = r[0][i]; e.r = x ? rankOf(x.total, x.manual, r[1], x.customName) : null; });
            var out = { list: list, mine: mine };
            lbData[id] = { at: Date.now(), v: out };
            return out;
          });
        });
      });
    });
  }
  function fmtClock(sec) {
    sec = num(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + ":" + (m < 10 ? "0" : "") + m + " שע׳";
    if (m) return m + ":" + (s < 10 ? "0" : "") + s + " דק׳";
    return s + " שנ׳";
  }
  // drawn medal: ribbon + disc with the place number (no emoji)
  function medalSVG(place, size) {
    var c = [["#ffd43b", "#e0a800", "#7a5200"], ["#e9ecef", "#adb5bd", "#495057"], ["#f4a261", "#c26a2c", "#5c2e0b"]][place - 1] || ["#fff", "#ccc", "#333"];
    size = size || 44;
    return '<svg class="eng-medal" width="' + size + '" height="' + Math.round(size * 1.25) + '" viewBox="0 0 40 50" aria-hidden="true" focusable="false">' +
      '<path d="M10 0h8l6 16h-8z" fill="#c92a2a"/><path d="M30 0h-8l-6 16h8z" fill="#1c7ed6"/>' +
      '<circle cx="20" cy="31" r="16" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="3"/>' +
      '<circle cx="20" cy="31" r="11.5" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.5"/>' +
      '<text x="20" y="37" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="16" fill="' + c[2] + '">' + place + "</text></svg>";
  }
  var CSS_LB = "" +
    ".eng-box.eng-lbbox{max-width:760px;padding:18px 18px 20px}" +
    ".eng-lbbox h2{display:flex;align-items:center;justify-content:center;gap:10px}" +
    ".eng-lbbox h2 .eng-ico{width:34px;height:34px;color:#e0a800}" +
    ".eng-seg{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}" +
    ".eng-seg button{font:700 18px/1.15 'Segoe UI',Arial,sans-serif;min-height:44px;padding:8px 14px;border-radius:999px;border:2px solid #d9c9a8;background:#fff;color:#2b2418;cursor:pointer}" +
    ".eng-seg button.on{background:#ef8f1e;border-color:#a85d0b;color:#fff}" +
    ".eng-seg.sm button{font-size:16px;min-height:40px;padding:6px 12px}" +
    ".eng-seg.metric button.on{background:#1c7ed6;border-color:#0b4a8a}" +
    ".eng-podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:14px 0 6px;direction:rtl}" +
    ".eng-pod{flex:1 1 0;max-width:210px;display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}" +
    ".eng-pod .nm{font-weight:800;font-size:20px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".eng-pod .val{font-weight:800;font-size:19px;color:#1d1a16}" +
    ".eng-pod .eng-rank{font-size:14px;margin:2px 0 4px;max-width:100%;overflow:hidden}" +
    ".eng-pod .base{width:100%;border-radius:14px 14px 4px 4px;border:3px solid #1d1a16;display:flex;align-items:flex-start;justify-content:center;font:800 26px/1 Arial,sans-serif;color:#1d1a16;padding-top:8px;box-sizing:border-box}" +
    ".eng-pod.p1 .base{height:96px;background:linear-gradient(#ffe066,#fab005)}" +
    ".eng-pod.p2 .base{height:70px;background:linear-gradient(#f1f3f5,#ced4da)}" +
    ".eng-pod.p3 .base{height:52px;background:linear-gradient(#ffc078,#e8890c)}" +
    ".eng-pod.me .nm{color:#c2410c;text-decoration:underline}" +
    ".eng-pod.empty{visibility:hidden}" +
    ".eng-lbl{list-style:none;padding:0;margin:8px 0}" +
    ".eng-lbl li{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;margin:5px 0;background:#fff;border:2px solid #eadcbf;font-size:20px}" +
    ".eng-lbl li .pl{flex:none;min-width:2.2em;font-weight:800;color:#5b5348;text-align:center}" +
    ".eng-lbl li .who{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".eng-lbl li .who b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}" +
    ".eng-lbl li .who .eng-rank{font-size:14px;color:#5b5348}" +
    ".eng-lbl li .v{flex:none;font-weight:800}" +
    ".eng-lbl li.me,.eng-lbl li.mine{background:#fff3bf;border-color:#ef8f1e;box-shadow:0 0 0 2px #ef8f1e inset}" +
    ".eng-lbl li.mine{margin-top:12px}" +
    ".eng-lbsep{text-align:center;color:#8a7f70;font-size:16px;margin:6px 0 0}" +
    ".eng-lbnote{text-align:center;font-size:15px;color:#6b6255;margin:10px 0 0}" +
    "@media (max-width:520px){.eng-box.eng-lbbox{padding:14px 10px 16px;border-radius:18px}.eng-lbbox h2{font-size:24px;margin-top:34px}" +
    ".eng-seg button{font-size:15px;min-height:40px;padding:6px 10px}.eng-seg.sm button{font-size:14px;padding:5px 9px;min-height:38px}" +
    ".eng-pod .nm{font-size:15px}.eng-pod .val{font-size:15px}.eng-pod .eng-rank{font-size:12px}.eng-pod .eng-rank .eng-badge{width:18px;height:21px}.eng-podium{gap:6px}" +
    ".eng-pod.p1 .base{height:70px}.eng-pod.p2 .base{height:52px}.eng-pod.p3 .base{height:38px}.eng-pod .base{font-size:20px}" +
    ".eng-lbl li{font-size:16px;padding:7px 8px;gap:6px}.eng-lbl li .who .eng-rank{font-size:12px}.eng-lbl li .who .eng-rank .eng-badge{width:18px;height:21px}}" +
    ".eng-menu button.eng-lbbtn{background:#ffd43b;color:#1d1a16}";
  var lbCssDone = false;
  function injectLbCSS() {
    injectCSS(); injectCSS2();
    if (lbCssDone) return; lbCssDone = true;
    var st = document.createElement("style"); st.textContent = CSS_LB; document.head.appendChild(st);
  }
  function lbScopes() {
    var s = [["all", "כל אינגלישיה"]];
    Object.keys(GAME_TITLES).forEach(function (g) { s.push([g, GAME_TITLES[g]]); });
    return s;
  }
  var lbView = null;
  openLeaderboard = function (gameId, o) {
    o = o || {};
    injectLbCSS();
    var scope = gameId || opts.gameId || "all";
    if (!GAME_TITLES[scope] && scope !== "all") scope = "all";
    lbView = { scope: scope, period: o.period || (lbView && lbView.period) || "d", metric: o.metric || (lbView && lbView.metric) || "score" };
    var box = openBox('<h2>' + ico("trophy") + "טבלת דירוג</h2>" +
      '<div class="eng-seg sm" data-eng="scopes" role="tablist" aria-label="משחק"></div>' +
      '<div class="eng-seg" data-eng="periods" role="tablist" aria-label="תקופה"></div>' +
      '<div class="eng-seg sm metric" data-eng="metrics" role="tablist" aria-label="מדד"></div>' +
      '<div class="eng-lbw" aria-live="polite"></div>' +
      '<p class="eng-lbnote">לפי שעון ישראל · השבוע מתחיל ביום ראשון</p>');
    box.parentNode.querySelector(".eng-box").classList.add("eng-lbbox");
    function seg(sel, items, cur, key) {
      var w = q(box, sel);
      w.innerHTML = items.map(function (it) {
        return '<button type="button" role="tab" aria-selected="' + (it[0] === cur) + '" class="' + (it[0] === cur ? "on" : "") + '" data-v="' + esc(it[0]) + '">' + esc(it[1]) + "</button>";
      }).join("");
      w.onclick = function (e) { var b = e.target.closest("button[data-v]"); if (!b) return; lbView[key] = b.getAttribute("data-v"); paint(); };
    }
    function row(e, cls) {
      return '<li class="' + (cls || "") + (e.isMe ? " me" : "") + '"><span class="pl">' + (e.rank ? e.rank : "–") + '</span><span class="who"><b>' + esc(e.name) +
        (e.isMe ? " (אני)" : "") + "</b>" + (e.r ? rankChip(e.r, 20) : "") + '</span><span class="v">' + valTxt(e.value) + "</span></li>";
    }
    function valTxt(v) { return lbView.metric === "time" ? esc(fmtClock(v)) : String(v); }
    function pod(e, place) {
      if (!e) return '<div class="eng-pod empty p' + place + '"><div class="base"></div></div>';
      return '<div class="eng-pod p' + place + (e.isMe ? " me" : "") + '">' + medalSVG(e.rank <= 3 ? e.rank : place, place === 1 ? 50 : 42) +
        '<div class="nm" title="' + esc(e.name) + '">' + esc(e.name) + (e.isMe ? " (אני)" : "") + "</div>" + (e.r ? rankChip(e.r, 20) : "") +
        '<div class="val">' + valTxt(e.value) + '</div><div class="base">' + place + "</div></div>";
    }
    var seq = 0;
    function paint() {
      seg('[data-eng="scopes"]', lbScopes(), lbView.scope, "scope");
      seg('[data-eng="periods"]', PERIODS, lbView.period, "period");
      seg('[data-eng="metrics"]', [["score", "לפי ניקוד"], ["time", "לפי זמן משחק"]], lbView.metric, "metric");
      var w = q(box, ".eng-lbw"), my = ++seq;
      w.innerHTML = '<p style="text-align:center">טוען…</p>';
      fetchBoard(lbView.scope, lbView.period, lbView.metric).then(function (res) {
        if (my !== seq || !box.isConnected) return;
        var list = res.list;
        if (!list.length) {
          w.innerHTML = '<p style="text-align:center;font-weight:700">עוד אין כאן שחקנים ' + esc(PERIODS.filter(function (p) { return p[0] === lbView.period; })[0][1]) + ". שחקו וזכו במקום הראשון!</p>";
          return;
        }
        var html = '<div class="eng-podium">' + pod(list[1], 2) + pod(list[0], 1) + pod(list[2], 3) + "</div>";
        if (list.length > 3) html += '<ol class="eng-lbl">' + list.slice(3).map(function (e) { return row(e); }).join("") + "</ol>";
        if (res.mine) html += '<p class="eng-lbsep">המקום שלי</p><ol class="eng-lbl">' + row(res.mine, "mine") + "</ol>";
        else if (!state.user) html += '<p class="eng-lbnote">התחברו לחשבון כדי להופיע בטבלה.</p>';
        w.innerHTML = html;
      }).catch(function (e) {
        if (my !== seq) return;
        console.warn("englishia leaderboard", e);
        w.innerHTML = "<p style=\"text-align:center\">" + esc((e && e.heb) || "לא הצלחנו לטעון את הטבלה. נסו שוב בעוד רגע.") + "</p>";
      });
    }
    paint();
    return box;
  };
  function lbButton(cls) {
    var lb = document.createElement("button");
    lb.type = "button"; lb.className = "eng-lbbtn" + (cls ? " " + cls : "");
    setIcoBtn(lb, "trophy", "טבלת דירוג");
    lb.setAttribute("aria-label", "טבלת דירוג");
    lb.onclick = function () { openLeaderboard(); };
    return lb;
  }

  /* ---------- public ---------- */
  var started = false;
  function init(o) {
    o = o || {};
    if (o.gameId) opts.gameId = o.gameId;
    if (o.gameTitle) opts.gameTitle = o.gameTitle;
    if ("reloadOnChange" in o) opts.reloadOnChange = !!o.reloadOnChange;
    if (o.devTools) registerDevTools(o.devTools, o.devToolsLabel);
    if (!started) { started = true; start(); }
    if (o.mount !== false) {
      var mountIt = function () { mountMenu(o.mount); };
      if (document.body) mountIt(); else document.addEventListener("DOMContentLoaded", mountIt);
    }
    return readyPromise;
  }
  function ready() { if (!started) { started = true; start(); } return readyPromise; }
  function onChange(cb) { listeners.push(cb); }
  function registerDevTools(fn, label) { devTools = { fn: fn, label: label || "כלי מפתחים (קפיצה לשלבים)" }; renderMenus(); }

  global.EnglishiaAuth = {
    init: init, ready: ready, onChange: onChange,
    get user() { return publicUser(); },
    get isAdmin() { return !!state.admin; },
    get restoring() { return !!state.restoring; },
    get emulator() { return EMU; },
    root: ROOT,
    register: register, login: login, logout: logout,
    openLogin: openLogin, openProfile: openProfile, openLeaderboard: openLeaderboard, openAdmin: openAdmin, close: closeBox,
    mountMenu: mountMenu,
    recordSession: recordSession, saveProgress: saveProgress, saveProgressSoon: saveProgressSoon, loadProgress: loadProgress,
    getGameProfile: getGameProfile, getPlatformProfile: getPlatformProfile, getLeaderboard: getLeaderboard,
    logEvent: logEvent, changeDisplayName: changeDisplayName, changePassword: changePassword,
    registerDevTools: registerDevTools, bridgeLocal: bridgeLocal,
    usernameToEmail: function (u) { return usernameToEmail(normUsername(u)); },
    formatTime: fmtTime, formatDate: fmtDate, gameTitles: GAME_TITLES,
    admin: admin
  };
  /* roles + ranks API (v12) */
  Object.defineProperty(global.EnglishiaAuth, "isOwner", { get: function () { return isOwner(); } });
  Object.defineProperty(global.EnglishiaAuth, "isTester", { get: function () { return isTester(); } });
  Object.defineProperty(global.EnglishiaAuth, "canSeeDemo", { get: function () { return canSeeDemo(); } });
  Object.defineProperty(global.EnglishiaAuth, "perms", { get: function () { var o = {}; PERMS.forEach(function (k) { o[k] = can(k); }); return o; } });
  global.EnglishiaAuth.can = can;
  Object.defineProperty(global.EnglishiaAuth, "roleState", { get: function () { return roleState(); } });
  global.EnglishiaAuth.retryRole = retryRole;
  global.EnglishiaAuth.progressEditor = progressEditor;
  global.EnglishiaAuth.ranks = { tiers: getTiers, of: rankOf, badge: badgeSVG, chip: rankChip, defaults: DEFAULT_TIERS, mine: function () { return state.user ? myRank() : null; } };
})(window);
