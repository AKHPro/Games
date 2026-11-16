/* Englishia player identity (temporary local backend).
   Games should only use window.Englishia.* so a future Firebase
   login can replace this file without changing game code.
*/
(function (global) {
  "use strict";
  var KEY = "englishia.player.v1";
  var MAX_NAME = 20;
  var MAX_PROFILES = 24;
  var LB_MAX = 10;

  function nowISO() { return new Date().toISOString(); }

  function emptyState() {
    return { v: 1, activeId: "", profiles: [], leaderboards: {} };
  }

  function load() {
    try {
      var raw = global.localStorage && localStorage.getItem(KEY);
      if (!raw) return emptyState();
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object") return emptyState();
      // Older single-name shape (name + totals, no profiles list)
      if (!Array.isArray(d.profiles) && typeof d.name === "string") {
        var mid = "p-migrated";
        d = {
          v: 1,
          activeId: d.name ? mid : "",
          profiles: d.name ? [{
            id: mid,
            name: d.name,
            created: nowISO(),
            totalScore: +d.totalScore || 0,
            totalSeconds: +d.totalSeconds || 0,
            games: d.games && typeof d.games === "object" ? d.games : {}
          }] : [],
          leaderboards: d.leaderboards && typeof d.leaderboards === "object" ? d.leaderboards : {}
        };
      }
      d.v = 1;
      d.activeId = typeof d.activeId === "string" ? d.activeId : "";
      d.profiles = Array.isArray(d.profiles) ? d.profiles : [];
      d.leaderboards = d.leaderboards && typeof d.leaderboards === "object" ? d.leaderboards : {};
      return d;
    } catch (e) {
      return emptyState();
    }
  }

  function persist(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  function normalizeName(n) {
    n = String(n == null ? "" : n).replace(/\s+/g, " ").trim();
    if (n.length > MAX_NAME) n = n.slice(0, MAX_NAME).trim();
    return n;
  }

  function uid() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function active(d) {
    if (!d.activeId) return null;
    for (var i = 0; i < d.profiles.length; i++) if (d.profiles[i].id === d.activeId) return d.profiles[i];
    return null;
  }

  function ensureGame(p, gameId) {
    p.games = p.games || {};
    var g = p.games[gameId];
    if (!g || typeof g !== "object") {
      g = { best: 0, totalScore: 0, seconds: 0, plays: 0 };
      p.games[gameId] = g;
    }
    return g;
  }

  function slimGames(p) {
    var games = {}, src = (p && p.games) || {};
    Object.keys(src).forEach(function (id) {
      var g = src[id] || {};
      var prog = g.progress && g.progress.prog ? g.progress.prog : {};
      var stars = 0, stages = 0;
      Object.keys(prog).forEach(function (k) { stages++; stars += (+prog[k] || 0); });
      games[id] = {
        best: +g.best || 0,
        totalScore: +g.totalScore || 0,
        seconds: +g.seconds || 0,
        plays: +g.plays || 0,
        stages: stages,
        stars: stars
      };
    });
    return games;
  }

  function profileGamesForGet(p) {
    var games = {}, src = (p && p.games) || {};
    Object.keys(src).forEach(function (id) {
      var g = src[id] || {};
      games[id] = {
        best: +g.best || 0,
        totalScore: +g.totalScore || 0,
        seconds: +g.seconds || 0,
        plays: +g.plays || 0
      };
    });
    return games;
  }

  var api = {
    backend: "local",
    maxName: MAX_NAME,

    getName: function () {
      var p = active(load());
      return (p && p.name) || "";
    },

    setName: function (n) {
      n = normalizeName(n);
      if (!n) return false;
      var d = load();
      var p = active(d);
      if (!p) return !!api.createProfile(n);
      p.name = n;
      persist(d);
      return true;
    },

    clearName: function () {
      var d = load();
      d.activeId = "";
      persist(d);
    },

    listProfiles: function () {
      return load().profiles.map(function (p) {
        return {
          id: p.id,
          name: p.name,
          totalScore: +p.totalScore || 0,
          totalSeconds: +p.totalSeconds || 0,
          games: slimGames(p)
        };
      });
    },

    getActiveId: function () {
      return load().activeId || "";
    },

    switchProfile: function (id) {
      var d = load();
      var found = d.profiles.some(function (p) { return p.id === id; });
      if (!found) return false;
      d.activeId = id;
      persist(d);
      return true;
    },

    createProfile: function (name) {
      name = normalizeName(name);
      if (!name) return "";
      var d = load();
      if (d.profiles.length >= MAX_PROFILES) return "";
      var p = {
        id: uid(),
        name: name,
        created: nowISO(),
        totalScore: 0,
        totalSeconds: 0,
        games: {}
      };
      d.profiles.push(p);
      d.activeId = p.id;
      persist(d);
      return p.id;
    },

    deleteProfile: function (id) {
      var d = load();
      var i = -1;
      for (var k = 0; k < d.profiles.length; k++) if (d.profiles[k].id === id) i = k;
      if (i < 0) return false;
      d.profiles.splice(i, 1);
      if (d.activeId === id) d.activeId = d.profiles[0] ? d.profiles[0].id : "";
      persist(d);
      return true;
    },

    recordSession: function (gameId, score, seconds) {
      gameId = String(gameId || "");
      if (!gameId) return;
      score = Math.max(0, Math.round(+score || 0));
      seconds = Math.max(0, Math.round(+seconds || 0));
      var d = load();
      var p = active(d);
      if (!p) return;
      p.totalScore = (+p.totalScore || 0) + score;
      p.totalSeconds = (+p.totalSeconds || 0) + seconds;
      var g = ensureGame(p, gameId);
      g.totalScore = (+g.totalScore || 0) + score;
      g.seconds = (+g.seconds || 0) + seconds;
      g.plays = (+g.plays || 0) + 1;
      if (score > (+g.best || 0)) g.best = score;
      var lb = d.leaderboards[gameId] || [];
      lb.push({ name: p.name, score: score, date: nowISO() });
      lb.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return a.date < b.date ? 1 : -1;
      });
      d.leaderboards[gameId] = lb.slice(0, LB_MAX);
      persist(d);
    },

    getProfile: function () {
      var p = active(load());
      if (!p) return { name: "", totalScore: 0, totalSeconds: 0, games: {} };
      return {
        name: p.name || "",
        totalScore: +p.totalScore || 0,
        totalSeconds: +p.totalSeconds || 0,
        games: profileGamesForGet(p)
      };
    },

    getLeaderboard: function (gameId) {
      var d = load();
      var lb = (d.leaderboards && d.leaderboards[gameId]) || [];
      return lb.slice(0, LB_MAX).map(function (e) {
        return { name: e.name || "", score: +e.score || 0, date: e.date || "" };
      });
    },

    getProgress: function (gameId) {
      var p = active(load());
      if (!p || !gameId) return null;
      var g = p.games && p.games[gameId];
      if (!g || !g.progress) return null;
      try { return JSON.parse(JSON.stringify(g.progress)); }
      catch (e) { return null; }
    },

    setProgress: function (gameId, data) {
      gameId = String(gameId || "");
      if (!gameId) return false;
      var d = load();
      var p = active(d);
      if (!p) return false;
      var g = ensureGame(p, gameId);
      try { g.progress = data ? JSON.parse(JSON.stringify(data)) : {}; }
      catch (e) { g.progress = data || {}; }
      persist(d);
      return true;
    }
  };

  global.Englishia = api;
})(typeof window !== "undefined" ? window : this);
