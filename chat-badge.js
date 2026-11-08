/* Klepet — značka neprebranih na gumbu v glavi plošče.
   Šteje tuja sporočila po chat_reads.last_read_at in v živo prišteva nova. */
(function () {
  "use strict";

  var badge = document.getElementById("chatBadge");
  if (!badge) return;

  var uid = null;
  var count = 0;
  var channel = null;

  function sb() { return window.sb; }

  function show() {
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.hidden = count === 0;
  }

  function recount() {
    if (!uid) return;
    var me = uid;
    sb().from("chat_reads").select("last_read_at").eq("user_id", me).maybeSingle()
      .then(function (res) {
        if (res.error) return null; // tabela še ne obstaja → tiho
        // še nikoli odprto → štej zadnjih 7 dni
        var since = (res.data && res.data.last_read_at) || new Date(Date.now() - 7 * 86400000).toISOString();
        return sb().from("chat_messages").select("id", { count: "exact", head: true })
          .gt("created_at", since).neq("sender_id", me);
      })
      .then(function (res) {
        if (!res || res.error || uid !== me) return;
        count = res.count || 0;
        show();
      });
  }

  function start(session) {
    if (!session || !session.user || !window.sb) return;
    if (uid === session.user.id) return;
    stop();
    uid = session.user.id;
    recount();
    channel = sb().channel("chat-badge-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, function (p) {
        if (!p.new || p.new.sender_id === uid) return;
        count++;
        show();
      })
      .subscribe();
  }

  function stop() {
    if (channel && window.sb) window.sb.removeChannel(channel);
    channel = null;
    uid = null;
    count = 0;
    show();
  }

  // ob vrnitvi s klepeta (bfcache ali preklop zavihka) preštej znova
  window.addEventListener("pageshow", function (e) { if (e.persisted) recount(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) recount(); });

  document.addEventListener("ptomsetu:signed-in", function (e) { start(e.detail && e.detail.session); });
  document.addEventListener("ptomsetu:signed-out", stop);
  if (window.PTOMSETU_SESSION) start(window.PTOMSETU_SESSION);
})();
