/* Word Detective – live team game. The teacher's browser is the host.
   Transport per student, in order: 1) PeerJS WebRTC data channel (public PeerJS cloud signaling, wss:443);
   2) if WebRTC can't connect (school Wi-Fi often blocks it) – small messages relayed through the same PeerJS
   signaling websocket; 3) if the PeerJS server is unreachable – ntfy.sh public pub/sub over HTTPS. © 2026 Amir · Englishia */
(function () {
"use strict";
var A = window.WDApp, $ = A.$, $$ = A.$$, esc = A.esc, LS = A.LS, icon = A.icon;
var NS = "englishia-wdet-v1-", NTFY = "https://ntfy.sh/", TEAM_PTS = 100;
var TCOL = ["#2f63c9", "#c43b32", "#23874f", "#d9731f", "#6b46c1", "#c23a7a"];
var TNAME = ["הכחולים", "האדומים", "הירוקים", "הכתומים", "הסגולים", "הוורודים"];
var URLP = new URLSearchParams(location.search), FORCE_NTFY = URLP.get("relay") === "ntfy";
var RULE = "<b>איך זוכים בנקודות?</b><br>• בכל שאלה, <b>הקבוצה הראשונה שעונה נכון</b> מקבלת <b>" + TEAM_PTS + " נקודות</b>.<br>• מספיק שתלמיד/ה אחד/ת מהקבוצה יענה נכון ראשון.<br>• לכל תלמיד <b>ניסיון אחד</b> בכל שאלה. תשובה שגויה לא חוסמת את חברי הקבוצה.<br>• תשובה עם טעות איות לא מזכה בנקודות.";
$$(".tRule").forEach(function (e) { e.innerHTML = RULE; });
function rid(n) { var s = "", c = "abcdefghjkmnpqrstuvwxyz23456789"; for (var i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function cid() { var c = LS.get("wd-cid", null); if (!c) { c = rid(10); LS.set("wd-cid", c); } return c; }
function shortPath() { var h = location.hostname; if (h !== "englishia.app" && h !== "www.englishia.app") return location.pathname; return (/\/demo\//.test(location.pathname) ? "/demo/" : "/") + "word-detective/"; }
function joinLink(room) { return location.origin + shortPath() + "?room=" + room; }
function ntfyPub(topic, m) { try { fetch(NTFY + topic, { method: "POST", body: JSON.stringify(m) }).catch(function () {}); } catch (e) {} }
function ntfySub(topic, cb) { var es; try { es = new EventSource(NTFY + topic + "/sse"); es.onmessage = function (e) { try { var d = JSON.parse(e.data); if (d.event === "message" && d.message) cb(JSON.parse(d.message)); } catch (_) {} }; } catch (e) {} return es; }
var RELAY_ID = "wdrelay";
function sigPack(dst, m) { return { type: "CANDIDATE", dst: dst, payload: { type: "data", connectionId: RELAY_ID, candidate: { candidate: "", sdpMid: "0", sdpMLineIndex: 0, wd: m } } }; }
function sigHook(p, cb) { if (!p.socket || p._wdHooked) return; p._wdHooked = 1; p.socket.on("message", function (m) { if (m && m.type === "CANDIDATE" && m.payload && m.payload.connectionId === RELAY_ID && m.payload.candidate) { setTimeout(function () { try { p._lostMessages && p._lostMessages.delete && p._lostMessages.delete(RELAY_ID); } catch (e) {} }, 0); cb(m.payload.candidate.wd, m.src); } }); }
function sigSend(p, dst, m) { try { if (p && p.socket && !p.disconnected) { p.socket.send(sigPack(dst, m)); return true; } } catch (e) {} return false; }
function teamsStrip(teams, mine) { return teams.map(function (t, i) { return '<span class="tscore" style="background:' + t[1] + (i === mine ? ";outline:3px solid #ffd34d" : "") + '">' + esc(t[0]) + " · " + t[2] + "</span>"; }).join(""); }
function podiumHTML(teams) {
  var order = teams.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return b.t[2] - a.t[2]; });
  var top = order.slice(0, 3), arr = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top, hs = { 0: 170, 1: 120, 2: 90 };
  return arr.map(function (o) { var place = order.indexOf(o); return '<div class="pc" style="background:' + o.t[1] + ";height:" + hs[place] + 'px"><div class="pl">' + (place + 1) + "</div>" + esc(o.t[0]) + "<br>" + o.t[2] + "</div>"; }).join("");
}

/* ======================= HOST ======================= */
var H = null, net = null;
function poolFor(topic, lv) {
  if (topic === "exam") return [A.EXAM_ITEMS];
  var ids = topic === "pos" ? [1, 2, 3, 4] : topic === "forms" ? [5, 6, 7] : topic === "tenses" ? [8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return ids.map(function (sid) { var l = A.ITEMS.filter(function (it) { return it.sec === sid; }); return A.levelPool ? A.levelPool(l, lv, 4) : l.filter(function (it) { return it.lv <= lv; }); });
}
function poolSize(topic, lv) { return poolFor(topic, lv).reduce(function (a, p) { return a + p.length; }, 0); }
function renderHostSetup() {
  var sv = LS.get("wd-host", null);
  $("#hsResume").innerHTML = sv && sv.phase !== "end" && Date.now() - sv.created < 4 * 3600e3 ? '<div class="box yellow"><b>יש חדר פתוח (קוד ' + sv.room + ').</b><div class="row" style="margin-top:8px"><button class="btn" id="hsRes">חזרה לחדר</button><button class="btn sec" id="hsDrop">חדר חדש</button></div></div>' : "";
  if ($("#hsRes")) { $("#hsRes").onclick = function () { hostStart(sv); }; $("#hsDrop").onclick = function () { LS.set("wd-host", null); renderHostSetup(); }; }
  var n = +$("#hsN").value, old = $$("#hsTeams input").map(function (i) { return i.value; });
  $("#hsTeams").innerHTML = Array.from({ length: n }, function (_, i) { return '<label class="field"><span style="color:' + TCOL[i] + '">קבוצה ' + (i + 1) + '</span><input maxlength="14" value="' + esc(old[i] || TNAME[i]) + '"></label>'; }).join("");
  hsNote();
}
function hsNote() { var n = poolSize($("#hsTopic").value, +$("#hsLv").value); $("#hsNote").textContent = "במאגר: " + n + " שאלות לנושא ולרמה שנבחרו."; $$("#hsQ option").forEach(function (o) { o.disabled = +o.value > n; }); }
$("#hsN").onchange = renderHostSetup; $("#hsTopic").onchange = hsNote; $("#hsLv").onchange = hsNote;
A.HOOKS.hostSetup = renderHostSetup;
$("#hsOpen").onclick = function () {
  var topic = $("#hsTopic").value, lv = +$("#hsLv").value, nQ = Math.min(+$("#hsQ").value, poolSize(topic, lv));
  if (nQ < 1) { $("#hsErr").textContent = "אין שאלות לבחירה הזו"; return; }
  var teams = $$("#hsTeams input").map(function (inp, i) { return { n: A.normName(inp.value) || TNAME[i], c: TCOL[i], score: 0 }; });
  var qs = A.mixed(poolFor(topic, lv), nQ, Math.random).map(function (it) { return it.id; });
  hostStart({ room: String(10000 + Math.floor(Math.random() * 90000)), created: Date.now(), teams: teams, qs: qs, dur: +$("#hsT").value, topic: topic, lv: lv, phase: "lobby", qi: -1, players: {}, ans: {}, winner: -1 });
};
function hSave() { if (!H) return; var c = JSON.parse(JSON.stringify(H, function (k, v) { return k === "conn" ? undefined : v; })); LS.set("wd-host", c); }
function hostStart(h) {
  H = h; H.players = H.players || {}; Object.keys(H.players).forEach(function (k) { H.players[k].conn = null; }); hSave();
  if (net) net.close(); net = { peer: null, ntfy: null, ntfyPlayers: false, close: function () { try { this.peer && this.peer.destroy(); } catch (e) {} try { this.ntfy && this.ntfy.close(); } catch (e) {} } };
  net.ntfy = ntfySub(NS + H.room + "-h", function (m) { hostRecv(m, "n", null); });
  connectPeer(0);
  renderLobby(); A.show(H.phase === "lobby" ? "hostLobby" : H.phase === "end" ? "hostEnd" : "hostQ");
  if (H.phase === "q") renderHostQ(); else if (H.phase === "rev") renderHostRev(); else if (H.phase === "end") renderHostEnd();
  clearInterval(net.hb); net.hb = setInterval(function () { broadcast(false); }, 4000);
}
function connectPeer(tries) {
  if (typeof Peer === "undefined") { hostConn("ntfy"); return; }
  var p = new Peer(NS + H.room, { debug: 0 }); net.peer = p;
  sigHook(p, function (m, src) { if (m) hostRecv(m, "s", null, src); });
  p.on("open", function () { hostConn("peer"); });
  p.on("connection", function (c) { c.on("data", function (m) { if (typeof m === "string") try { m = JSON.parse(m); } catch (e) { return; } hostRecv(m, "p", c); }); c.on("close", function () { Object.keys(H.players).forEach(function (k) { if (H.players[k].conn === c) H.players[k].conn = null; }); }); });
  p.on("error", function (e) { if (e.type === "unavailable-id" && tries < 8) { try { p.destroy(); } catch (_) {} setTimeout(function () { if (H) connectPeer(tries + 1); }, 2500); } else hostConn("ntfy"); });
  p.on("disconnected", function () { try { p.reconnect(); } catch (e) {} });
}
function hostConn(kind) { var t = kind === "peer" ? "מחובר (PeerJS)" : "חיבור גיבוי (ntfy)"; $("#hlConn").textContent = t; }
function stateMsg() {
  var it = H.qi >= 0 ? A.itemById(H.qs[H.qi]) : null, cnt = H.teams.map(function () { return 0; }), pl = {};
  Object.keys(H.players).forEach(function (k) { var P = H.players[k]; if (P.team != null && cnt[P.team] != null) cnt[P.team]++; var a = H.ans[k]; pl[k] = [P.team == null ? -1 : P.team, a ? a.st : 0]; });
  return { t: "state", phase: H.phase, qi: H.qi, n: H.qs.length, id: it ? it.id : null, left: H.phase === "q" ? Math.max(0, Math.round(H.dur - (Date.now() - H.qStart) / 1000)) : 0, dur: H.dur,
    teams: H.teams.map(function (t, i) { return [t.n, t.c, t.score, cnt[i]]; }), pl: pl, win: H.winner, winBy: H.winBy || "" };
}
function send(P, m) { if (P.conn && P.conn.open) { try { P.conn.send(m); return; } catch (e) {} } if (P.via === "s" && P.sig && sigSend(net.peer, P.sig, m)) return; if (P.via === "n") ntfyPub(NS + H.room + "-s", m); }
function broadcast(force) {
  if (!H) return; var m = stateMsg(), viaN = false;
  Object.keys(H.players).forEach(function (k) { var P = H.players[k]; if (P.conn && P.conn.open) { try { P.conn.send(m); } catch (e) {} } else if (P.via === "s" && P.sig) sigSend(net.peer, P.sig, m); else if (P.via === "n") viaN = true; });
  if (viaN && force !== false) ntfyPub(NS + H.room + "-s", m);
}
function hostRecv(m, via, conn, src) {
  if (!H || !m || !m.cid) return; var P = H.players[m.cid];
  if (m.t === "hello") {
    if (!P) P = H.players[m.cid] = { name: A.normName(m.name).slice(0, 20) || "?", team: null, correct: 0 };
    P.name = A.normName(m.name).slice(0, 20) || P.name; P.via = via; if (conn) P.conn = conn; else if (via !== "p") P.conn = null; if (src) P.sig = src;
    if (m.team != null && H.teams[m.team] && P.team == null) P.team = m.team;
    hSave(); renderLobby(); send(P, stateMsg()); broadcast(); return;
  }
  if (!P) return; if (conn) P.conn = conn; P.via = via; if (src) P.sig = src;
  if (m.t === "team" && H.phase === "lobby" && H.teams[m.team]) { P.team = m.team; hSave(); renderLobby(); broadcast(); }
  else if (m.t === "team" && P.team == null && H.teams[m.team]) { P.team = m.team; hSave(); broadcast(); }
  else if (m.t === "ans" && H.phase === "q" && m.qi === H.qi && !H.ans[m.cid] && P.team != null) {
    var it = A.itemById(H.qs[H.qi]), ev = A.evaluate(it, it.t === "mc" ? +m.a : m.a), ok = ev.status === "ok";
    H.ans[m.cid] = { st: ok ? 2 : 1, a: m.a, t: Date.now() };
    if (ok) { P.correct = (P.correct || 0) + 1; if (H.winner < 0) { H.winner = P.team; H.winBy = P.name; H.teams[P.team].score += TEAM_PTS; A.beep("ok"); } }
    hSave(); renderHostQ(); broadcast();
    var n = Object.keys(H.players).filter(function (k) { return H.players[k].team != null; }).length;
    if (Object.keys(H.ans).length >= n) setTimeout(function () { if (H && H.phase === "q" && m.qi === H.qi) reveal(); }, 1200);
  }
  else if (m.t === "bye") { delete H.players[m.cid]; hSave(); renderLobby(); broadcast(); }
}
function renderLobby() {
  if (!H) return; $("#hlCode").textContent = H.room; var link = joinLink(H.room); $("#hlLink").textContent = link;
  try { var q = qrcode(0, "M"); q.addData(link); q.make(); $("#hlQR").innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { $("#hlQR").textContent = ""; }
  var ps = Object.keys(H.players).map(function (k) { return H.players[k]; }), nIn = ps.filter(function (p) { return p.team != null; }).length;
  $("#hlCount").textContent = ps.length + " תלמידים מחוברים" + (ps.length - nIn ? " (" + (ps.length - nIn) + " עוד לא בחרו קבוצה)" : "");
  $("#hlTeams").innerHTML = H.teams.map(function (t, i) { var mem = ps.filter(function (p) { return p.team === i; }).map(function (p) { return esc(p.name); }); return '<div class="tcol" style="background:' + t.c + '"><b>' + esc(t.n) + " (" + mem.length + ')</b><div class="ppl">' + (mem.join(" · ") || "—") + "</div></div>"; }).join("");
  $("#hlStart").disabled = !nIn;
}
$("#hlStart").onclick = function () { H.qi = -1; nextHostQ(); };
function nextHostQ() {
  H.qi++; if (H.qi >= H.qs.length) return hostEndGame();
  H.phase = "q"; H.ans = {}; H.winner = -1; H.winBy = ""; H.qStart = Date.now(); hSave(); A.show("hostQ"); renderHostQ(); broadcast();
  clearInterval(net.qt); net.qt = setInterval(hostTick, 250); hostTick();
}
function hostTick() {
  if (!H || H.phase !== "q") { clearInterval(net.qt); return; }
  var left = Math.max(0, Math.ceil(H.dur - (Date.now() - H.qStart) / 1000)), el = $("#hqTimer");
  el.innerHTML = icon("clock") + " " + left; el.classList.toggle("low", left <= 5);
  if (left !== net.lastLeft && left <= 5 && left > 0) A.beep("tick"); net.lastLeft = left;
  if (left <= 0) reveal();
}
function optsPreview(it) {
  if (it.t === "type") return '<div class="muted" style="font-size:20px;margin-top:8px">התלמידים מקלידים את התשובה בטלפון.</div>';
  var opts = it.t === "pos" ? it.opts.map(function (k) { return WD.POS[k].en + " · " + WD.POS[k].he; }) : it.t === "tense" ? WD.TENSE_ORDER.map(function (k) { return WD.TENSE[k].en; }) : it.o;
  return '<div class="opts">' + opts.map(function (o) { return '<div class="opt"><span class="en">' + esc(o) + "</span></div>"; }).join("") + "</div>";
}
function renderHostQ() {
  if (!H || H.phase !== "q") return; var it = A.itemById(H.qs[H.qi]);
  $("#hqLbl").textContent = "שאלה " + (H.qi + 1) + " מתוך " + H.qs.length; $("#hqProg").style.width = (H.qi / H.qs.length * 100) + "%";
  $("#hqPrompt").textContent = A.promptOf(it); $("#hqSent").innerHTML = A.sentHTML(it); $("#hqOpts").innerHTML = optsPreview(it);
  var n = Object.keys(H.players).filter(function (k) { return H.players[k].team != null; }).length;
  $("#hqAnswered").textContent = "ענו " + Object.keys(H.ans).length + " מתוך " + n;
  $("#hqFirst").innerHTML = H.winner >= 0 ? '<div class="winner" style="background:' + H.teams[H.winner].c + '">' + icon("medal") + " " + esc(H.teams[H.winner].n) + " ענו נכון ראשונים! (" + esc(H.winBy) + ")</div>" : "";
  $("#hqBoard").innerHTML = teamsStrip(H.teams.map(function (t) { return [t.n, t.c, t.score]; }));
}
function reveal() {
  if (!H || H.phase !== "q") return; clearInterval(net.qt); H.phase = "rev"; hSave(); renderHostRev(); A.show("hostRev"); broadcast();
}
$("#hqReveal").onclick = reveal;
function renderHostRev() {
  var it = A.itemById(H.qs[H.qi]); $("#hrLbl").textContent = "שאלה " + (H.qi + 1) + " מתוך " + H.qs.length + " – התשובה";
  $("#hrWin").innerHTML = H.winner >= 0 ? '<div class="winner" style="background:' + H.teams[H.winner].c + '">' + icon("medal") + " " + esc(H.teams[H.winner].n) + " +" + TEAM_PTS + " (" + esc(H.winBy) + ")</div>" : '<div class="winner" style="background:#5a6585">אף קבוצה לא ענתה נכון הפעם</div>';
  $("#hrSent").innerHTML = A.sentHTML(it, it.t === "type" || it.t === "mc" ? A.answerText(it) : null); $("#hrAns").innerHTML = A.answerHTML(it); $("#hrWhy").innerHTML = A.explain(it);
  $("#hrBoard").innerHTML = teamsStrip(H.teams.map(function (t) { return [t.n, t.c, t.score]; }));
  $("#hrNext").innerHTML = (H.qi + 1 >= H.qs.length ? "לתוצאות" : "שאלה הבאה") + " " + icon("arrow");
}
$("#hrNext").onclick = nextHostQ;
function hostEndGame() { H.phase = "end"; hSave(); renderHostEnd(); A.show("hostEnd"); A.beep("win"); broadcast(); }
function renderHostEnd() { var T = H.teams.map(function (t) { return [t.n, t.c, t.score]; }); $("#heCols").innerHTML = podiumHTML(T); $("#heBoard").innerHTML = teamsStrip(T); }
function hostQuit() { if (!confirm("לסגור את החדר? התלמידים יתנתקו.")) return; closeRoom(); A.show("home"); }
function closeRoom() { if (H) { var m = { t: "closed" }; Object.keys(H.players).forEach(function (k) { var P = H.players[k]; if (P.conn && P.conn.open) try { P.conn.send(m); } catch (e) {} }); ntfyPub(NS + H.room + "-s", m); } setTimeout(function () { if (net) { clearInterval(net.hb); clearInterval(net.qt); net.close(); } net = null; }, 400); LS.set("wd-host", null); H = null; }
$("#hlClose").onclick = hostQuit; $("#hqClose").onclick = hostQuit; $("#hrClose").onclick = hostQuit;
$("#heNew").onclick = function () { closeRoom(); A.show("hostSetup"); };
$("#heHome").onclick = function () { closeRoom(); A.show("home"); };

/* ======================= STUDENT ======================= */
var S = null;
$("#tjCode").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5); });
A.HOOKS.tJoin = function () { var me = LS.get("wd-me", {}); if (!$("#tjName").value) $("#tjName").value = me.name || A.accountName() || ""; $("#tjGo").disabled = false; $("#tjStatus").textContent = ""; };
$("#tjGo").onclick = function () {
  var room = $("#tjCode").value.trim(), name = A.normName($("#tjName").value);
  if (!/^\d{5}$/.test(room)) { $("#tjErr").textContent = "קוד החדר הוא 5 ספרות"; return; }
  if (name.length < 2) { $("#tjErr").textContent = "הקלידו שם"; return; }
  $("#tjErr").textContent = ""; LS.set("wd-me", { name: name }); stuStart(room, name, null);
};
function stuSave() { if (S) LS.set("wd-tjoin", { room: S.room, name: S.name, team: S.team, at: Date.now() }); }
function stuStart(room, name, team) {
  if (S && S.net) S.net.close();
  S = { room: room, name: name, id: cid(), team: team, st: null, qi: -1, answered: false, correct: 0, start: Date.now() }; stuSave();
  try { history.replaceState(null, "", shortPath() + "?room=" + room); } catch (e) {}
  $("#tjGo").disabled = true; $("#tjStatus").textContent = "מתחברים לחדר…";
  var n = { via: null, peer: null, conn: null, ntfy: null, close: function () { try { this.conn && this.conn.close(); } catch (e) {} try { this.peer && this.peer.destroy(); } catch (e) {} try { this.ntfy && this.ntfy.close(); } catch (e) {} } };
  S.net = n;
  var useNtfy = function () { if (n.via) return; n.via = "n"; try { n.peer && n.peer.destroy(); } catch (e) {} n.ntfy = ntfySub(NS + room + "-s", stuRecv); setTimeout(function () { stuSend({ t: "hello", name: S.name, team: S.team }); }, 900); connLbl(); };
  var useSig = function () { if (n.via) return; n.via = "s"; try { n.conn && n.conn.close(); } catch (e) {} connLbl(); stuSend({ t: "hello", name: S.name, team: S.team }); };
  if (FORCE_NTFY || typeof Peer === "undefined") { useNtfy(); }
  else {
    var boot = setTimeout(useNtfy, 12000), t2 = null;
    var p = new Peer({ debug: 0 }); n.peer = p;
    p.on("open", function () {
      clearTimeout(boot); sigHook(p, function (m) { if (n.via === "s") stuRecv(m); });
      if (URLP.get("relay") === "sig") { useSig(); return; }
      t2 = setTimeout(useSig, 6000);   // WebRTC didn't open in time -> relay through the signaling socket
      var c = p.connect(NS + room, { reliable: true }); n.conn = c;
      c.on("open", function () { if (n.via) return; clearTimeout(t2); n.via = "p"; connLbl(); stuSend({ t: "hello", name: S.name, team: S.team }); });
      c.on("data", function (m) { if (n.via !== "p") return; if (typeof m === "string") try { m = JSON.parse(m); } catch (e) { return; } stuRecv(m); });
      c.on("close", function () { if (S && S.net === n && n.via === "p") { connLbl("נותק – מתחברים מחדש…"); setTimeout(function () { if (S && S.net === n) stuStart(S.room, S.name, S.team); }, 1500); } });
    });
    p.on("disconnected", function () { try { p.reconnect(); } catch (e) {} });
    p.on("error", function (e) {
      if (e.type === "peer-unavailable") { if (!S.st) { clearTimeout(t2); clearTimeout(boot); $("#tjStatus").textContent = ""; $("#tjErr").textContent = "לא נמצא חדר עם הקוד הזה. בדקו את הקוד."; $("#tjGo").disabled = false; n.close(); S.net = null; A.show("tJoin"); } }
      else if (["network", "server-error", "socket-error", "socket-closed", "browser-incompatible", "ssl-unavailable"].indexOf(e.type) >= 0 && !n.via) { clearTimeout(t2); clearTimeout(boot); useNtfy(); }
    });
  }
}
function connLbl(t) { var el = $("#twConn"); if (el) el.textContent = t || (S && S.net ? (S.net.via === "n" ? "מחובר (גיבוי ntfy)" : S.net.via === "s" ? "מחובר (ממסר)" : "מחובר") : ""); }
function stuSend(m) { if (!S || !S.net) return; m.cid = S.id; var n = S.net; if (n.via === "p" && n.conn && n.conn.open) { try { n.conn.send(m); } catch (e) {} } else if (n.via === "s") { if (n.peer && n.peer.disconnected) try { n.peer.reconnect(); } catch (e) {} sigSend(n.peer, NS + S.room, m); } else if (n.via === "n") ntfyPub(NS + S.room + "-h", m); }
function stuRecv(m) {
  if (!S || !m) return;
  if (m.t === "closed") { var nn = S.net; S = null; LS.set("wd-tjoin", null); nn && nn.close(); A.toast("המורה סגר/ה את החדר"); A.show("home"); return; }
  if (m.t !== "state") return;
  var first = !S.st; S.st = m; var me = m.pl[S.id];
  if (!me) { if (first || Date.now() - (S.helloAt || 0) > 5000) { S.helloAt = Date.now(); stuSend({ t: "hello", name: S.name, team: S.team }); } return; }
  S.team = me[0] >= 0 ? me[0] : null; stuSave();
  if (m.phase === "end") return stuEnd(m);
  if (S.team == null) { renderPick(m); if (A.cur.screen !== "tPick") A.show("tPick"); return; }
  if (m.phase === "lobby") { renderWait(m); if (A.cur.screen !== "tWait") A.show("tWait"); return; }
  if (m.phase === "q" || m.phase === "rev") renderStuQ(m, me);
}
function renderPick(m) {
  $("#tpHello").textContent = "שלום " + S.name;
  $("#tpTeams").innerHTML = m.teams.map(function (t, i) { return '<button class="tbtn' + (i === S.team ? " me" : "") + '" style="background:' + t[1] + '" data-t="' + i + '">' + esc(t[0]) + "<small>" + t[3] + " תלמידים</small></button>"; }).join("");
  $$("#tpTeams .tbtn").forEach(function (b) { b.onclick = function () { S.team = +b.dataset.t; stuSend({ t: "team", team: S.team }); $$("#tpTeams .tbtn").forEach(function (x) { x.classList.toggle("me", x === b); }); }; });
}
function renderWait(m) {
  var t = m.teams[S.team]; $("#twHello").textContent = S.name; connLbl();
  $("#twTeam").style.background = t[1]; $("#twTeam").textContent = "הקבוצה שלך: " + t[0];
  $("#twMsg").textContent = "מחכים שהמורה יתחיל…"; $("#twTeams").innerHTML = teamsStrip(m.teams.map(function (x) { return [x[0], x[1], x[3] + " תלמידים"]; }), S.team);
  $("#twSwitch").hidden = false;
}
$("#twSwitch").onclick = function () { if (S && S.st) { S.team = null; renderPick(S.st); A.show("tPick"); } };
function stuTimer() {
  clearInterval(S.tick); var end = Date.now() + S.st.left * 1000;
  var f = function () { var l = Math.max(0, Math.ceil((end - Date.now()) / 1000)); $("#timerPill").innerHTML = icon("clock") + " " + l; if (!S || !S.st || S.st.phase !== "q") clearInterval(S && S.tick); };
  $("#timerPill").hidden = false; f(); S.tick = setInterval(f, 250);
}
function renderStuQ(m, me) {
  var it = A.itemById(m.id); if (!it) return; var team = m.teams[S.team];
  $("#scorePill").innerHTML = '<span style="color:' + team[1] + '">' + esc(team[0]) + "</span> " + team[2];
  if (m.qi !== S.qi) {
    S.qi = m.qi; S.answered = false; S.shownRes = 0; S.revShown = false;
    A.setGame({ mode: "team", it: it, lv: 5, answered: false });
    $("#playLbl").textContent = "משחק קבוצות · שאלה " + (m.qi + 1) + "/" + m.n; $("#progBar").style.width = (m.qi / m.n * 100) + "%";
    $("#qTag").innerHTML = ""; $("#qPrompt").textContent = A.promptOf(it); $("#qSent").innerHTML = A.sentHTML(it); $("#fbArea").innerHTML = ""; $("#nextArea").hidden = true;
    if (m.phase === "q" && !me[1]) A.renderAnswer(it, $("#answerArea"), { hint: false, onAnswer: function (v) { if (S.answered) return; S.answered = true; S.myAns = v; stuSend({ t: "ans", qi: m.qi, a: v }); $("#fbArea").innerHTML = '<div class="fb partial"><h3>התשובה נשלחה…</h3></div>'; } });
    else $("#answerArea").innerHTML = "";
    if (m.phase === "q") stuTimer(); A.show("play");
  }
  if (me[1] && me[1] !== S.shownRes) { S.shownRes = me[1]; var ok = me[1] === 2; if (ok) S.correct++; A.beep(ok ? "ok" : "wrong");
    $("#fbArea").innerHTML = '<div class="fb ' + (ok ? "ok" : "wrong") + '"><h3>' + icon(ok ? "check" : "x") + (ok ? " נכון!" : " לא נכון") + "</h3><div>" + (ok ? (m.win === S.team ? "הקבוצה שלך קיבלה את הנקודות!" : "") : "חברי הקבוצה עדיין יכולים לענות.") + "</div></div>"; }
  var wn = $("#stuWin"); if (m.win >= 0) { if (!wn) { $("#fbArea").insertAdjacentHTML("beforeend", '<div class="winner" id="stuWin"></div>'); wn = $("#stuWin"); } wn.style.background = m.teams[m.win][1]; wn.textContent = m.teams[m.win][0] + " ענו נכון ראשונים (" + m.winBy + ")"; }
  if (m.phase === "rev" && !S.revShown) {
    S.revShown = true; clearInterval(S.tick); $("#timerPill").hidden = true;
    if (it.t !== "type" && document.getElementById("opts")) A.markOpts(it, S.answered ? (it.t === "mc" ? +S.myAns : S.myAns) : null);
    var kb = document.getElementById("kb"); if (kb) kb.remove(); var act = document.querySelector("#answerArea .actions"); if (act) act.remove();
    $("#qSent").innerHTML = A.sentHTML(it, it.t === "type" || it.t === "mc" ? A.answerText(it) : null);
    $("#fbArea").insertAdjacentHTML("beforeend", '<div class="fb ok" style="background:#fff"><div class="cmp"><span>התשובה:</span>' + A.answerHTML(it) + '</div><div class="why">' + A.explain(it) + '</div><div class="muted center">מחכים לשאלה הבאה…</div></div>');
  }
}
function stuEnd(m) {
  if (!S) return; clearInterval(S.tick); $("#timerPill").hidden = true;
  if (!S.ended) { S.ended = true; try { if (window.EnglishiaAuth && EnglishiaAuth.user) EnglishiaAuth.recordSession(A.GAME_ID, S.correct * 10, Math.round((Date.now() - S.start) / 1000)); } catch (e) {} A.beep("win"); }
  $("#teCols").innerHTML = podiumHTML(m.teams);
  var t = m.teams[S.team] || ["", "#5a6585", 0];
  $("#teMine").innerHTML = '<span style="color:' + t[1] + '">' + esc(t[0]) + "</span> – " + t[2] + " נקודות · ענית נכון על " + S.correct + " שאלות";
  LS.set("wd-tjoin", null); A.show("tEnd");
}
function teamLeave() { if (S) { stuSend({ t: "bye" }); var nn = S.net; setTimeout(function () { nn && nn.close(); }, 300); clearInterval(S.tick); } LS.set("wd-tjoin", null); S = null; A.show("home"); }
$("#tpLeave").onclick = teamLeave; $("#twLeave").onclick = teamLeave;
$("#teHome").onclick = function () { if (S && S.net) S.net.close(); S = null; A.show("home"); };
var _quit = $("#quitBtn").onclick; $("#quitBtn").onclick = function () { if (A.G && A.G.mode === "team") { if (confirm("לצאת מהמשחק הקבוצתי?")) teamLeave(); return; } _quit(); };

/* deep link ?room=12345 */
(function () {
  var room = (URLP.get("room") || "").replace(/\D/g, "").slice(0, 5); if (!room) return;
  $("#tjCode").value = room; var sv = LS.get("wd-tjoin", null);
  if (sv && sv.room === room && sv.name && Date.now() - sv.at < 4 * 3600e3) { $("#tjName").value = sv.name; A.show("tJoin"); stuStart(room, sv.name, sv.team); }
  else A.show("tJoin");
})();
window.WDTeams = { get H() { return H; }, get S() { return S; } };
})();
