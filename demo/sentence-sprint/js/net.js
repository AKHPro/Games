/* Sentence Sprint 1.0 — room transport (copied from Word Race 1.0) (same proven stack as the Word Detective team game):
   1) PeerJS WebRTC data channel (PeerJS cloud signaling over wss:443);
   2) if WebRTC can't connect (school Wi-Fi often blocks it): small messages relayed through the same
      PeerJS signaling websocket;
   3) if the PeerJS server is unreachable: ntfy.sh public pub/sub over HTTPS.
   The host (teacher / room creator) is authoritative: it holds the questions and answers and decides
   every move. Players only send "hello" and "ans". © 2026 Amir · Englishia */
(function () {
"use strict";
var NS = "englishia-ssprint-v1-", NTFY = "https://ntfy.sh/", RELAY_ID = "ssrelay";
var URLP = new URLSearchParams(location.search), FORCE = URLP.get("relay") || "";
function ntfyPub(topic, m) { try { fetch(NTFY + topic, { method: "POST", body: JSON.stringify(m) }).catch(function () {}); } catch (e) {} }
function ntfySub(topic, cb) { var es; try { es = new EventSource(NTFY + topic + "/sse"); es.onmessage = function (e) { try { var d = JSON.parse(e.data); if (d.event === "message" && d.message) cb(JSON.parse(d.message)); } catch (_) {} }; } catch (e) {} return es; }
function sigPack(dst, m) { return { type: "CANDIDATE", dst: dst, payload: { type: "data", connectionId: RELAY_ID, candidate: { candidate: "", sdpMid: "0", sdpMLineIndex: 0, wr: m } } }; }
function sigHook(p, cb) { if (!p.socket || p._ssHooked) return; p._ssHooked = 1; p.socket.on("message", function (m) { if (m && m.type === "CANDIDATE" && m.payload && m.payload.connectionId === RELAY_ID && m.payload.candidate) { setTimeout(function () { try { p._lostMessages && p._lostMessages.delete && p._lostMessages.delete(RELAY_ID); } catch (e) {} }, 0); cb(m.payload.candidate.wr, m.src); } }); }
function sigSend(p, dst, m) { try { if (p && p.socket && !p.disconnected) { p.socket.send(sigPack(dst, m)); return true; } } catch (e) {} return false; }
function parse(m) { if (typeof m === "string") { try { return JSON.parse(m); } catch (e) { return null; } } return m; }

/* ---------- HOST ---------- */
function host(code, onMsg, onStatus) {
  var H = { code: code, peer: null, ntfy: null, links: {}, closed: false, kind: "" };
  function status(k) { H.kind = k; onStatus && onStatus(k); }
  H.ntfy = ntfySub(NS + code + "-h", function (m) { if (m && m.cid) { link(m.cid).via = "n"; onMsg(m, m.cid); } });
  function link(cid) { return H.links[cid] || (H.links[cid] = { conn: null, via: "", sig: null }); }
  function connect(tries) {
    if (H.closed) return;
    if (typeof Peer === "undefined" || FORCE === "ntfy") { status("ntfy"); return; }
    var p = new Peer(NS + code, { debug: 0 }); H.peer = p;
    p.on("open", function () { sigHook(p, function (m, src) { m = parse(m); if (m && m.cid) { var L = link(m.cid); L.via = "s"; L.sig = src; onMsg(m, m.cid); } }); status("peer"); });
    p.on("connection", function (c) {
      c.on("data", function (m) { m = parse(m); if (!m || !m.cid) return; var L = link(m.cid); L.conn = c; L.via = "p"; onMsg(m, m.cid); });
      c.on("close", function () { Object.keys(H.links).forEach(function (k) { if (H.links[k].conn === c) { H.links[k].conn = null; onMsg({ t: "_drop", cid: k }, k); } }); });
    });
    p.on("error", function (e) {
      if (e.type === "unavailable-id") { try { p.destroy(); } catch (_) {} if (tries < 1) setTimeout(function () { connect(tries + 1); }, 2500); else status("taken"); }
      else if (e.type !== "peer-unavailable" && H.kind !== "peer") status("ntfy");
    });
    p.on("disconnected", function () { if (!H.closed) try { p.reconnect(); } catch (e) {} });
  }
  H.send = function (cid, m) {
    var L = H.links[cid]; if (!L) return;
    if (L.conn && L.conn.open) { try { L.conn.send(m); return; } catch (e) {} }
    if (L.via === "s" && L.sig && sigSend(H.peer, L.sig, m)) return;
    if (L.via === "n") ntfyPub(NS + code + "-s", m);
  };
  H.broadcast = function (m, viaNtfy) {
    var n = false;
    Object.keys(H.links).forEach(function (k) { var L = H.links[k]; if (L.conn && L.conn.open) { try { L.conn.send(m); } catch (e) {} } else if (L.via === "s" && L.sig) sigSend(H.peer, L.sig, m); else if (L.via === "n") n = true; });
    if (n && viaNtfy !== false) ntfyPub(NS + code + "-s", m);
  };
  H.forget = function (cid) { delete H.links[cid]; };
  H.close = function () { H.closed = true; try { H.peer && H.peer.destroy(); } catch (e) {} try { H.ntfy && H.ntfy.close(); } catch (e) {} };
  connect(0);
  return H;
}

/* ---------- PLAYER ---------- */
function join(code, cid, onMsg, onStatus) {
  var N = { via: null, peer: null, conn: null, ntfy: null, closed: false, gotHost: false };
  var st = function (k) { onStatus && onStatus(k); };
  N.close = function () { N.closed = true; try { N.conn && N.conn.close(); } catch (e) {} try { N.peer && N.peer.destroy(); } catch (e) {} try { N.ntfy && N.ntfy.close(); } catch (e) {} };
  N.send = function (m) {
    if (N.closed) return; m.cid = cid;
    if (N.via === "p" && N.conn && N.conn.open) { try { N.conn.send(m); } catch (e) {} }
    else if (N.via === "s") { if (N.peer && N.peer.disconnected) try { N.peer.reconnect(); } catch (e) {} sigSend(N.peer, NS + code, m); }
    else if (N.via === "n") ntfyPub(NS + code + "-h", m);
  };
  var recv = function (m) { m = parse(m); if (!m || N.closed) return; N.gotHost = true; onMsg(m); };
  var useNtfy = function () { if (N.via || N.closed) return; N.via = "n"; try { N.peer && N.peer.destroy(); } catch (e) {} N.ntfy = ntfySub(NS + code + "-s", recv); st("ntfy"); setTimeout(function () { st("ready"); }, 900); };
  var useSig = function () { if (N.via || N.closed) return; N.via = "s"; try { N.conn && N.conn.close(); } catch (e) {} st("sig"); st("ready"); };
  if (FORCE === "ntfy" || typeof Peer === "undefined") { useNtfy(); return N; }
  var boot = setTimeout(useNtfy, 12000), t2 = null;
  var p = new Peer({ debug: 0 }); N.peer = p;
  p.on("open", function () {
    clearTimeout(boot); sigHook(p, function (m) { if (N.via === "s") recv(m); });
    if (FORCE === "sig") { useSig(); return; }
    t2 = setTimeout(useSig, 6000);
    var c = p.connect(NS + code, { reliable: true }); N.conn = c;
    c.on("open", function () { if (N.via) return; clearTimeout(t2); N.via = "p"; st("peer"); st("ready"); });
    c.on("data", function (m) { if (N.via === "p") recv(m); });
    c.on("close", function () { if (!N.closed && N.via === "p") st("lost"); });
  });
  p.on("disconnected", function () { if (!N.closed) try { p.reconnect(); } catch (e) {} });
  p.on("error", function (e) {
    if (e.type === "peer-unavailable") { if (!N.gotHost) { clearTimeout(t2); clearTimeout(boot); st("noroom"); } }
    else if (["network", "server-error", "socket-error", "socket-closed", "browser-incompatible", "ssl-unavailable"].indexOf(e.type) >= 0 && !N.via) { clearTimeout(t2); clearTimeout(boot); useNtfy(); }
  });
  return N;
}
window.SSNet = { host: host, join: join, NS: NS };
})();
