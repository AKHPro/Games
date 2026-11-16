/* Englishia accounts — one username for the whole platform and every game.
   Include in any page:  <script src="(path to repo root)/js/englishia-auth.js"></script>
   Then:  EnglishiaAuth.init({ gameId: "my-game", gameTitle: "My Game", mount: "#where" })
   Guest play keeps working if the student never logs in or Firebase cannot load.

   Public API (all async functions return Promises):
     init(opts) / ready()            -> user or null
     user, isAdmin                   -> current state (getters)
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
  var LONG_TYPES = ["name_change", "password_change", "username_change", "admin_edit", "admin_reset_progress", "admin_password_reset"];
  var GAME_TITLES = { "mila-quest": "מילה קווסט", "grammar-maze": "מבוך הדקדוק" };

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
  var state = { user: null, doc: null, admin: false, resolved: false };
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
      var auth = A.getAuth(app);
      var db = F.getFirestore(app);
      if (EMU) {
        try { A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); } catch (e) {}
        try { F.connectFirestoreEmulator(db, "127.0.0.1", 8085); } catch (e) {}
      }
      fb = { app: app, auth: auth, db: db, A: A, F: F, appM: appM, cfg: cfg };
      return fb;
    });
    return loading;
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

  /* ---------- helpers ---------- */
  function emit() {
    document.documentElement.classList.toggle("eng-signed-in", !!state.user);
    document.documentElement.classList.toggle("eng-admin", !!state.admin);
    listeners.slice().forEach(function (cb) { try { cb(publicUser()); } catch (e) { console.error(e); } });
    renderMenus();
  }
  function publicUser() {
    if (!state.user) return null;
    var d = state.doc || {};
    return { uid: state.user.uid, username: d.username || "", displayName: d.displayName || d.username || "", isAdmin: state.admin };
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
  function loadUserState(u) {
    if (!u) { state.user = null; state.doc = null; state.admin = false; return Promise.resolve(); }
    state.user = u;
    var F = fb.F;
    return Promise.all([
      F.getDoc(userRef(u.uid)).then(function (s) { return s.exists() ? s.data() : null; }),
      F.getDoc(F.doc(fb.db, "admins", u.uid)).then(function (s) { return s.exists(); }).catch(function () { return false; })
    ]).then(function (r) {
      state.doc = r[0];
      state.admin = !!r[1];
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
    var timer = setTimeout(function () { finishReady(); }, 7000);
    function finishReady() { clearTimeout(timer); if (!state.resolved) { state.resolved = true; readyResolve(publicUser()); } }
    loadFirebase().then(function () {
      var first = true;
      fb.A.onAuthStateChanged(fb.auth, function (u) {
        loadUserState(u).catch(function (e) { console.warn("englishia user", e); }).then(function () {
          if (first) {
            first = false;
            finishReady();
            if (state.user && opts.gameId) logEvent("game_start", opts.gameId, opts.gameTitle || "");
            if (state.user) touch();
          }
          emit();
        });
      });
    }).catch(function (e) {
      if (e && e.message !== "not-configured") console.warn("Englishia accounts offline:", e);
      finishReady();
    });
  }
  function touch() {
    if (!state.user) return;
    fb.F.updateDoc(userRef(state.user.uid), { lastSeen: fb.F.serverTimestamp() }).catch(function () {});
  }

  function register(username, password, displayName) {
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
      return loadUserState(cred.user);
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

  /* ---------- admin ---------- */
  function needAdmin() { if (!state.admin) throw { heb: "רק למנהל." }; }
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
        // remove the helper Google user from the Auth list (keeps the user list clean)
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
  var admin = {
    listUsers: function () {
      return Promise.resolve().then(needAdmin).then(function () {
        return fb.F.getDocs(fb.F.collection(fb.db, "users"));
      }).then(function (snap) {
        var out = [];
        snap.forEach(function (s) { out.push(Object.assign({ uid: s.id }, s.data())); });
        out.sort(function (a, b) { return String(a.displayName).localeCompare(String(b.displayName), "he"); });
        return out;
      });
    },
    getUser: function (uid) {
      return Promise.resolve().then(needAdmin).then(function () { return fb.F.getDoc(userRef(uid)); })
        .then(function (s) { return s.exists() ? Object.assign({ uid: uid }, s.data()) : null; });
    },
    loadProgress: function (uid, gameId) { needAdmin(); return loadProgress(gameId, uid); },
    setProgress: function (uid, gameId, data) {
      needAdmin();
      return admin.getUser(uid).then(function (u) {
        return saveProgress(gameId, data, uid).then(function (ok) {
          if (!ok) throw { heb: "השמירה נכשלה." };
          return logEvent("admin_edit", gameId, "המנהל ערך את ההתקדמות", { uid: uid, name: u.displayName });
        });
      });
    },
    setStats: function (uid, gameId, stats) {
      needAdmin();
      var F = fb.F;
      return admin.getUser(uid).then(function (u) {
        var games = Object.assign({}, u.games || {});
        var g = { best: num(stats.best), totalScore: num(stats.totalScore), seconds: num(stats.seconds), plays: num(stats.plays), lastPlayed: F.serverTimestamp() };
        games[gameId] = g;
        var t = recomputeTotals(games);
        return F.updateDoc(userRef(uid), new F.FieldPath("games", gameId), g, "totalScore", t.totalScore,
          "totalSeconds", t.totalSeconds, "plays", t.plays).then(function () {
          var lb = F.doc(fb.db, "leaderboards", gameId, "scores", uid);
          delete lbCache[gameId];
          return g.best > 0 ? F.setDoc(lb, { name: u.displayName, score: g.best, updatedAt: F.serverTimestamp() }) : F.deleteDoc(lb);
        }).then(function () {
          return logEvent("admin_edit", gameId, "ניקוד: שיא " + g.best + ", סה״כ " + g.totalScore + ", " + fmtTime(g.seconds) + ", " + g.plays + " משחקים",
            { uid: uid, name: u.displayName });
        });
      });
    },
    resetGame: function (uid, gameId) {
      needAdmin();
      var F = fb.F;
      return admin.getUser(uid).then(function (u) {
        var games = Object.assign({}, u.games || {});
        delete games[gameId];
        var t = recomputeTotals(games);
        return F.updateDoc(userRef(uid), new F.FieldPath("games", gameId), F.deleteField(), "totalScore", t.totalScore,
          "totalSeconds", t.totalSeconds, "plays", t.plays)
          .then(function () { return F.deleteDoc(F.doc(fb.db, "users", uid, "progress", gameId)); })
          .then(function () { delete lbCache[gameId]; return F.deleteDoc(F.doc(fb.db, "leaderboards", gameId, "scores", uid)); })
          .then(function () { return logEvent("admin_reset_progress", gameId, "המנהל איפס את ההתקדמות במשחק", { uid: uid, name: u.displayName }); });
      });
    },
    rename: function (uid, name) {
      needAdmin();
      name = cleanName(name);
      if (!name) return Promise.reject({ heb: "צריך לכתוב שם." });
      var F = fb.F;
      return admin.getUser(uid).then(function (u) {
        return F.updateDoc(userRef(uid), { displayName: name }).then(function () {
          return renameLeaderboards(uid, name, Object.keys(u.games || {}));
        }).then(function () {
          if (state.user && uid === state.user.uid) state.doc.displayName = name;
          return logEvent("name_change", "", "המנהל שינה שם: " + u.displayName + " ← " + name, { uid: uid, name: name });
        });
      });
    },
    resetPassword: function (uid, newPassword) {
      needAdmin();
      if (String(newPassword || "").length < 6) return Promise.reject({ heb: "הסיסמה החדשה קצרה מדי. צריך לפחות 6 תווים." });
      return admin.getUser(uid).then(function (u) {
        return getOwnerToken().then(function (t) {
          return idtk("accounts:update", { localId: uid, password: newPassword }, t);
        }).then(function () {
          return logEvent("admin_password_reset", "", "המנהל איפס סיסמה", { uid: uid, name: u.displayName });
        });
      });
    },
    changeUsername: function (uid, newUsername) {
      needAdmin();
      newUsername = normUsername(newUsername);
      var bad = checkUsername(newUsername);
      if (bad) return Promise.reject({ heb: bad });
      var F = fb.F, email = usernameToEmail(newUsername);
      return admin.getUser(uid).then(function (u) {
        return getOwnerToken().then(function (t) {
          return idtk("accounts:update", { localId: uid, email: email }, t);
        }).then(function () {
          return F.updateDoc(userRef(uid), { username: newUsername, email: email });
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
      needAdmin();
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
      needAdmin();
      var F = fb.F;
      var q = F.query(F.collection(fb.db, "activity"), F.where("uid", "==", uid), F.where("at", ">=", F.Timestamp.fromMillis(Date.now() - CHANGE_DAYS * 864e5)),
        F.orderBy("at", "desc"), F.limit(500));
      return F.getDocs(q).then(function (snap) {
        var out = []; snap.forEach(function (s) { var v = s.data(); if (LONG_TYPES.indexOf(v.type) >= 0) out.push(Object.assign({ id: s.id }, v)); }); return out;
      });
    },
    cleanupActivity: function () {
      // Backup for the TTL policy: delete short-lived events older than 7 days.
      needAdmin();
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
    ".eng-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,14,24,.72);display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:'Segoe UI',Arial,'Noto Sans Hebrew',sans-serif}" +
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
    ".eng-menu button.adm{background:#1d1a16;color:#ffd43b}" +
    ".eng-x{float:left;font-size:22px;min-height:44px;margin:0 !important}";
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
    var html = "<h2>👤 " + esc(d.displayName) + "</h2>" +
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
    html += '<div class="eng-row">' + (gameId ? '<button class="eng-btn" data-eng="lb">🏆 טבלת שיאים</button>' : "") +
      '<button class="eng-btn sec" data-eng="name">✏️ שינוי שם</button><button class="eng-btn sec" data-eng="pass">🔒 שינוי סיסמה</button>' +
      (state.admin ? '<button class="eng-btn sec" data-eng="adm">🛠️ ניהול</button>' : "") +
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
    var box = openBox("<h2>🏆 טבלת שיאים</h2><p class=\"eng-hint\" style=\"text-align:center\">" + esc(opts.gameTitle || GAME_TITLES[gameId] || gameId) + " · 10 השיאים הגבוהים</p><div class=\"eng-lbw\">טוען…</div>");
    getLeaderboard(gameId, 10).then(function (list) {
      var w = q(box, ".eng-lbw");
      if (!list.length) { w.innerHTML = "<p>עוד אין שיאים. היו הראשונים!</p>"; return; }
      w.innerHTML = '<ol class="eng-lb">' + list.map(function (e) {
        return '<li class="' + (e.rank === 1 ? "first " : "") + (e.isMe ? "me" : "") + '"><span>' + (e.rank === 1 ? "🥇 " : e.rank === 2 ? "🥈 " : e.rank === 3 ? "🥉 " : e.rank + ". ") +
          esc(e.name) + (e.isMe ? " (אני)" : "") + "</span><b>" + e.score + "</b></li>";
      }).join("") + "</ol>";
    });
  }

  /* in-game admin panel */
  function openAdmin(gameId) {
    gameId = gameId || opts.gameId;
    if (!state.admin) return;
    var title = opts.gameTitle || GAME_TITLES[gameId] || gameId || "אינגלישיה";
    var box = openBox("<h2>🛠️ ניהול · " + esc(title) + "</h2>" +
      '<div class="eng-row">' + (devTools ? '<button class="eng-btn" data-eng="dev">🧪 ' + esc(devTools.label) + "</button>" : "") +
      '<a class="eng-btn sec" style="text-decoration:none;display:inline-flex;align-items:center" href="' + esc(ROOT + "admin/") + '" target="_blank" rel="noopener">📋 עמוד ניהול מלא</a></div>' +
      (gameId ? "<h3>תלמידים במשחק הזה</h3><div class=\"eng-users\">טוען…</div>" : ""), true);
    if (q(box, '[data-eng="dev"]')) q(box, '[data-eng="dev"]').onclick = function () { closeBox(); devTools.fn(); };
    if (!gameId) return;
    admin.listUsers().then(function (users) {
      var w = q(box, ".eng-users");
      if (!users.length) { w.textContent = "אין עדיין משתמשים."; return; }
      w.innerHTML = '<table class="eng-tbl"><tr><th>שם</th><th>שם משתמש</th><th>שיא</th><th>ניקוד</th><th>זמן</th><th>פעמים</th><th></th></tr>' +
        users.map(function (u) {
          var s = statsOf((u.games || {})[gameId]);
          return "<tr><td><b>" + esc(u.displayName) + "</b></td><td>" + esc(u.username) + "</td><td>" + s.best + "</td><td>" + s.totalScore +
            "</td><td>" + esc(fmtTime(s.seconds)) + "</td><td>" + s.plays + '</td><td><button class="eng-btn sm" data-uid="' + esc(u.uid) + '">ניהול</button></td></tr>';
        }).join("") + "</table>";
      Array.prototype.forEach.call(w.querySelectorAll("[data-uid]"), function (b) {
        b.onclick = function () { openAdminUser(b.getAttribute("data-uid"), gameId); };
      });
    }).catch(function (e) { q(box, ".eng-users").textContent = errText(e); });
  }
  function openAdminUser(uid, gameId) {
    admin.getUser(uid).then(function (u) {
      var s = statsOf((u.games || {})[gameId]);
      var box = openBox("<h2>🛠️ " + esc(u.displayName) + "</h2><p class=\"eng-hint\" style=\"text-align:center\">שם משתמש: " + esc(u.username) + " · " + esc(opts.gameTitle || gameId) + "</p>" +
        "<h3>ניקוד וזמן במשחק הזה</h3>" +
        '<label>שיא</label><input id="eng-a-best" type="number" min="0" value="' + s.best + '">' +
        '<label>ניקוד כולל</label><input id="eng-a-total" type="number" min="0" value="' + s.totalScore + '">' +
        '<label>זמן משחק (דקות)</label><input id="eng-a-min" type="number" min="0" value="' + Math.round(s.seconds / 60) + '">' +
        '<label>כמה פעמים שיחק/ה</label><input id="eng-a-plays" type="number" min="0" value="' + s.plays + '">' +
        '<div class="eng-row"><button class="eng-btn green" data-eng="save">✓ שמירת ניקוד</button><button class="eng-btn red" data-eng="reset">איפוס התקדמות במשחק</button></div>' +
        "<h3>סיסמה</h3><label>סיסמה חדשה לתלמיד/ה</label><p class=\"eng-hint\">לפחות 6 תווים. בפעם הראשונה תתבקשו לאשר עם חשבון הגוגל של המורה.</p>" +
        '<input id="eng-a-pass" autocomplete="off"><div class="eng-row"><button class="eng-btn" data-eng="pass">🔑 איפוס סיסמה</button></div>' +
        "<h3>שם</h3><input id=\"eng-a-name\" maxlength=\"20\" value=\"" + esc(u.displayName) + '"><div class="eng-row"><button class="eng-btn sec" data-eng="name">✏️ שינוי שם</button></div>' +
        "<h3>התקדמות (מתקדם)</h3><p class=\"eng-hint\">הנתונים השמורים של המשחק, לעריכה זהירה.</p><textarea id=\"eng-a-json\">טוען…</textarea>" +
        '<div class="eng-row"><button class="eng-btn sec" data-eng="json">שמירת התקדמות</button><button class="eng-btn sec" data-eng="back">חזרה לרשימה</button></div>', true);
      admin.loadProgress(uid, gameId).then(function (p) { q(box, "#eng-a-json").value = p ? JSON.stringify(p, null, 1) : "{}"; });
      q(box, '[data-eng="back"]').onclick = function () { openAdmin(gameId); };
      function act(btn, fn, okText) {
        busy(btn, true);
        Promise.resolve().then(fn).then(function () { busy(btn, false); showMsg(box, okText, true); })
          .catch(function (e) { busy(btn, false); showMsg(box, errText(e)); });
      }
      q(box, '[data-eng="save"]').onclick = function () {
        act(this, function () {
          return admin.setStats(uid, gameId, { best: q(box, "#eng-a-best").value, totalScore: q(box, "#eng-a-total").value,
            seconds: (+q(box, "#eng-a-min").value || 0) * 60, plays: q(box, "#eng-a-plays").value });
        }, "הניקוד נשמר.");
      };
      q(box, '[data-eng="reset"]').onclick = function () {
        if (!confirm("לאפס את כל ההתקדמות והניקוד של " + u.displayName + " במשחק הזה?")) return;
        act(this, function () { return admin.resetGame(uid, gameId); }, "ההתקדמות אופסה.");
      };
      q(box, '[data-eng="pass"]').onclick = function () {
        var p = q(box, "#eng-a-pass").value;
        act(this, function () { return admin.resetPassword(uid, p); }, "הסיסמה החדשה נשמרה. תנו אותה לתלמיד/ה.");
      };
      q(box, '[data-eng="name"]').onclick = function () {
        act(this, function () { return admin.rename(uid, q(box, "#eng-a-name").value); }, "השם שונה.");
      };
      q(box, '[data-eng="json"]').onclick = function () {
        var data;
        try { data = JSON.parse(q(box, "#eng-a-json").value); } catch (e) { showMsg(box, "הטקסט לא תקין (JSON)."); return; }
        act(this, function () { return admin.setProgress(uid, gameId, data); }, "ההתקדמות נשמרה.");
      };
    });
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
        b.textContent = "👤 " + ((state.doc && state.doc.displayName) || "החשבון שלי");
        b.onclick = function () { openProfile(); };
      } else {
        b.textContent = "👤 התחברות";
        b.onclick = function () { openLogin(); };
      }
      el.appendChild(b);
      if (state.user && opts.gameId) {
        var lb = document.createElement("button");
        lb.type = "button"; lb.textContent = "🏆"; lb.title = "טבלת שיאים"; lb.setAttribute("aria-label", "טבלת שיאים");
        lb.onclick = function () { openLeaderboard(); };
        el.appendChild(lb);
      }
      if (state.admin) {
        var a = document.createElement("button");
        a.type = "button"; a.className = "adm eng-admin-btn"; a.textContent = "🛠️ ניהול";
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
    onChange(function (u) {
      if (!u) {
        var m = map();
        Object.keys(m).forEach(function (uid) { try { L.deleteProfile(m[uid]); } catch (e) {} });
        setMap({});
        try { L.clearName && orig.clearName.call(L); } catch (e) {}
      }
    });

    return ready().then(function (u) {
      if (!u) {
        // signed out on this device: drop any cached account profile
        var m0 = map();
        if (Object.keys(m0).length) {
          Object.keys(m0).forEach(function (k) { try { L.deleteProfile(m0[k]); } catch (e) {} });
          setMap({}); try { orig.clearName.call(L); } catch (e) {}
        }
        return;
      }
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
    });
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
})(window);
