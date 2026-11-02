/* WebHarbor project page: photo wall, environment explorer, trajectory player. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  // url() inside a custom property resolves against the stylesheet, so hand CSS absolute URLs
  var abs = function (p) { return 'url("' + new URL(p, document.baseURI).href + '")'; };

  /* ---------------- nav ---------------- */
  var nav = $(".nav");
  var hero = $(".hero");
  $(".nav-toggle").addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    this.setAttribute("aria-expanded", String(open));
  });
  $$(".nav-links a").forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("is-open"); }); });

  /* ---------------- reveal on scroll ---------------- */
  if ("IntersectionObserver" in window && !reduceMotion) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); rio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    $$(".reveal").forEach(function (el) { rio.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------------- photo wall ----------------
     A tile's background is its 6-frame strip, fetched when the tile first
     drifts into view; only tiles currently in view step through frames
     (class is-live). The drift pauses whenever the hero is off-screen, the
     player is open, or the tab is hidden. */
  var wall = $(".wall");
  if (wall) {
    // second copy of each row makes the drift loop seamless
    $$(".track", wall).forEach(function (tr) {
      $$(".tile", tr).forEach(function (t) {
        var c = t.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        c.removeAttribute("aria-label");
        c.tabIndex = -1;
        c.style.backgroundImage = "";
        tr.appendChild(c);
      });
    });
    var tiles = $$(".tile", wall);
    var live = new Set();
    // Step a few visible tiles per tick instead of animating every tile with
    // CSS: style work then happens only when a frame actually changes.
    var hovered = null;
    wall.addEventListener("pointerover", function (e) { hovered = e.target.closest && e.target.closest(".tile"); });
    wall.addEventListener("pointerleave", function () { hovered = null; });
    (function tick() {
      if (!reduceMotion && !hero.classList.contains("is-paused") && live.size) {
        var arr = Array.from(live), n = Math.max(1, Math.round(arr.length / 12));
        for (var k = 0; k < n; k++) {
          var t = arr[(Math.random() * arr.length) | 0];
          if (t === hovered || document.activeElement === t) continue;
          t._f = ((t._f || 0) + 1) % 6;
          t.style.backgroundPosition = t._f * 20 + "% 0";
        }
      }
      setTimeout(tick, 200);
    })();
    if ("IntersectionObserver" in window) {
      var tio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var t = e.target;
          if (e.isIntersecting) {
            if (!t.style.backgroundImage) t.style.backgroundImage = abs(t.dataset.strip);
            live.add(t);
          } else {
            live.delete(t);
          }
        });
      }, { root: hero, rootMargin: "0px 40px" });
      tiles.forEach(function (t) { tio.observe(t); });

      var hio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { hero.classList.toggle("is-offscreen", !e.isIntersecting); syncPause(); });
      });
      hio.observe(hero);
    } else {
      tiles.forEach(function (t) { t.style.backgroundImage = abs(t.dataset.strip); });
    }
    document.addEventListener("visibilitychange", syncPause);

    // hold the hovered tile's row so the tile stays under the pointer
    wall.addEventListener("pointerover", function (e) {
      var t = e.target.closest && e.target.closest(".tile");
      if (!t) return;
      var row = t.parentNode.parentNode;
      if (row !== wall._hot) {
        if (wall._hot) wall._hot.classList.remove("is-hot");
        row.classList.add("is-hot");
        wall._hot = row;
      }
    });
    wall.addEventListener("pointerleave", function () {
      if (wall._hot) { wall._hot.classList.remove("is-hot"); wall._hot = null; }
    });
    wall.addEventListener("focusin", function (e) {
      var t = e.target.closest(".tile");
      if (t) t.parentNode.parentNode.classList.add("is-hot");
    });
    wall.addEventListener("focusout", function (e) {
      var t = e.target.closest(".tile");
      if (t) t.parentNode.parentNode.classList.remove("is-hot");
    });

    var toggle = $(".wall-toggle");
    toggle.addEventListener("click", function () {
      var paused = hero.classList.toggle("is-user-paused");
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.setAttribute("aria-label", paused ? "Resume the website wall" : "Pause the website wall");
      syncPause();
    });
    if (reduceMotion) hero.classList.add("is-user-paused");
  }
  function syncPause() {
    if (!hero) return;
    var paused = document.hidden || hero.classList.contains("is-offscreen") || hero.classList.contains("is-user-paused") || (player && player.isOpen());
    hero.classList.toggle("is-paused", paused);
    wall.classList.toggle("is-frozen", paused);
  }

  /* ---------------- hero stats count-up ---------------- */
  if (!reduceMotion) {
    $$(".hero-stats b[data-count]").forEach(function (el, i) {
      var to = +el.dataset.count, t0 = null, dur = 1400 + i * 120;
      var fmt = function (v) { return Math.round(v).toLocaleString("en-US"); };
      el.textContent = "0";
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      setTimeout(function () { requestAnimationFrame(tick); }, 250);
    });
  }

  /* ---------------- wall parallax (fine pointers only) ---------------- */
  if (wall && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var px = 0, py = 0, raf = 0;
    hero.addEventListener("pointermove", function (e) {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = 0;
        wall.style.translate = (px * -26).toFixed(1) + "px " + (py * -18).toFixed(1) + "px";
      });
    });
  }

  /* ---------------- explorer ---------------- */
  var grid = $(".grid");
  if (grid) {
    var cards = $$(".card", grid);
    var search = $("#site-search");
    var chips = $$(".chip");
    var empty = $(".grid-empty");
    var count = $("#grid-count");
    var cat = "all";
    var more = $(".grid-more");
    var moreBtn = $("button", more);
    var expanded = false; // only the "Show all" button expands the unfiltered grid
    moreBtn.addEventListener("click", function () {
      expanded = !expanded;
      filter();
      if (!expanded) grid.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    });
    function filter() {
      var q = (search.value || "").trim().toLowerCase();
      var filtering = !!q || cat !== "all";
      grid.classList.toggle("is-collapsed", !filtering && !expanded);
      more.hidden = filtering;
      moreBtn.textContent = expanded ? "Show fewer" : "Show all " + cards.length + " websites";
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (cat === "all" || c.dataset.cat === cat) && (!q || c.dataset.q.indexOf(q) !== -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      empty.hidden = shown !== 0;
      count.textContent = filtering ? shown + " of " + cards.length + " websites match"
        : expanded ? "All " + cards.length + " websites" : "Showing 12 of " + cards.length + " websites";
    }
    search.addEventListener("input", filter);
    chips.forEach(function (ch) {
      ch.addEventListener("click", function () {
        chips.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        ch.setAttribute("aria-pressed", "true");
        cat = ch.dataset.cat;
        filter();
      });
    });
    // Cards play only while they are on screen: a card's frame strip is fetched
    // the first time it scrolls into view, and one scheduler advances a few
    // visible cards per tick (the hovered card every tick).
    if (!reduceMotion && "IntersectionObserver" in window) {
      var liveCards = new Set();
      var hotCard = null;
      var cio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var c = e.target;
          if (e.isIntersecting) {
            if (!c.style.getPropertyValue("--strip")) c.style.setProperty("--strip", abs(c.dataset.strip));
            c.classList.add("is-live");
            liveCards.add(c);
          } else {
            c.classList.remove("is-live");
            liveCards.delete(c);
          }
        });
      }, { threshold: 0.5 });
      cards.forEach(function (c) { cio.observe(c); });
      grid.addEventListener("pointerover", function (e) { hotCard = e.target.closest && e.target.closest(".card"); });
      grid.addEventListener("pointerleave", function () { hotCard = null; });
      var advance = function (c) {
        c._f = ((c._f || 0) + 1) % 6;
        c.style.setProperty("--f", c._f);
      };
      (function tickCards() {
        if (!document.hidden && !(player && player.isOpen()) && liveCards.size) {
          var arr = Array.from(liveCards), n = Math.max(1, Math.round(arr.length / 7));
          for (var k = 0; k < n; k++) {
            var c = arr[(Math.random() * arr.length) | 0];
            if (c !== hotCard) advance(c);
          }
          if (hotCard && liveCards.has(hotCard)) advance(hotCard);
        }
        setTimeout(tickCards, 320);
      })();
    }
  }

  /* ---------------- trajectory player ---------------- */
  var player = (function () {
    var root = $(".player");
    var els = {
      box: $(".player-box", root),
      stage: $(".stage", root),
      a: $(".frame-a", root),
      b: $(".frame-b", root),
      loading: $(".loading", root),
      cursor: $(".cursor", root),
      ripple: $(".ripple", root),
      target: $(".target", root),
      bubble: $(".bubble", root),
      answer: $(".answer", root),
      url: $(".urlbar .u", root),
      mirror: $(".mirror-of", root),
      site: $(".side-head .site", root),
      meta: $(".side-head .meta", root),
      task: $(".task p", root),
      steps: $(".side-steps ol", root),
      segs: $(".segs", root),
      play: $(".ctl.play", root),
      speed: $(".speed", root),
    };
    var S = { open: false, site: null, data: null, i: 0, phase: 0, timer: null, paused: false, speed: 1, token: 0, front: "a", lastFocus: null, frames: [] };
    var order = [];

    function isOpen() { return S.open; }
    function frameUrl(n) { return S.base + String(n).padStart(2, "0") + ".webp"; }
    function pct(v, total) { return (100 * v / total) + "%"; }

    function wait(ms) {
      var tok = S.token;
      return new Promise(function (res, rej) {
        S.timer = setTimeout(function () { tok === S.token ? res() : rej("stale"); }, ms / S.speed);
      });
    }
    function gate() { // resolves when not paused
      var tok = S.token;
      return new Promise(function (res, rej) {
        (function check() {
          if (tok !== S.token) return rej("stale");
          if (!S.paused) return res();
          S.timer = setTimeout(check, 120);
        })();
      });
    }
    function preload(n) {
      if (S.frames[n]) return S.frames[n];
      var img = new Image();
      img.decoding = "async";
      S.frames[n] = new Promise(function (res) { img.onload = img.onerror = function () { res(img); }; });
      img.src = frameUrl(n);
      return S.frames[n];
    }
    function show(n, instant) {
      var back = S.front === "a" ? els.b : els.a;
      var front = S.front === "a" ? els.a : els.b;
      return preload(n).then(function () {
        back.src = frameUrl(n);
        var swap = function () {
          back.style.transition = instant ? "none" : "";
          front.style.transition = instant ? "none" : "";
          back.classList.remove("is-hidden");
          front.classList.add("is-hidden");
          back.style.zIndex = 1; front.style.zIndex = 0;
          S.front = S.front === "a" ? "b" : "a";
        };
        return (back.decode ? back.decode().catch(function () {}) : Promise.resolve()).then(swap);
      });
    }
    function setUrl(u) {
      try {
        var x = new URL(u);
        els.url.innerHTML = "";
        var host = document.createElement("b");
        host.textContent = x.host;
        els.url.appendChild(host);
        els.url.appendChild(document.createTextNode(x.pathname + x.search));
      } catch (e) { els.url.textContent = u || ""; }
    }
    function placeAt(el, box, W, H) {
      el.style.left = pct(box.x, W); el.style.top = pct(box.y, H);
      el.style.width = pct(box.w, W); el.style.height = pct(box.h, H);
    }
    function cursorTo(x, y, W, H) {
      els.cursor.style.left = pct(x, W);
      els.cursor.style.top = pct(y, H);
    }
    function bubbleAt(box, W, H, html) {
      els.bubble.innerHTML = html;
      var x = box ? box.x : W * 0.5, y = box ? box.y + box.h + 10 : H * 0.12;
      if (y > H * 0.8) y = Math.max(8, (box ? box.y : H) - 56);
      els.bubble.style.left = pct(Math.min(x, W * 0.62), W);
      els.bubble.style.top = pct(y, H);
      els.bubble.classList.add("is-on");
    }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function highlight(i) {
      $$("li", els.steps).forEach(function (li, k) {
        li.classList.toggle("is-now", k === i);
        li.classList.toggle("is-past", k < i);
      });
      var cur = els.steps.children[i];
      if (cur) {
        var box = els.steps.parentNode;
        var top = cur.offsetTop - box.clientHeight / 2 + cur.offsetHeight / 2;
        box.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
      }
      $$(".seg", els.segs).forEach(function (s, k) {
        s.classList.toggle("done", k < i);
        s.style.setProperty("--p", "0%");
      });
    }
    function progress(i, p) {
      var s = els.segs.children[i];
      if (s) s.style.setProperty("--p", Math.round(p * 100) + "%");
    }
    function clearOverlays() {
      els.target.classList.remove("is-on");
      els.bubble.classList.remove("is-on");
      els.answer.classList.remove("is-on");
    }

    async function playFrom(i) {
      S.token++;
      clearTimeout(S.timer);
      var d = S.data, W = d.viewport[0], H = d.viewport[1];
      var steps = d.steps;
      clearOverlays();
      try {
        await show(steps[i] ? steps[i].before : d.final_frame, true);
        for (var k = i; k < steps.length; k++) {
          var st = steps[k];
          S.i = k;
          highlight(k);
          setUrl(st.url);
          preload(st.after);
          if (steps[k + 1]) preload(steps[k + 1].after);
          await gate();
          progress(k, 0.15);
          var b = st.box;
          if (b) {
            cursorTo(b.x + Math.min(b.w * 0.5, 60), b.y + b.h * 0.5, W, H);
            placeAt(els.target, b, W, H);
            els.target.classList.add("is-on");
            await wait(760);
          } else {
            await wait(260);
          }
          await gate();
          progress(k, 0.45);
          if (st.action === "type") {
            var txt = st.text || "";
            for (var c = 1; c <= txt.length; c += Math.max(1, Math.ceil(txt.length / 24))) {
              bubbleAt(b, W, H, '<span class="tag">type</span>' + esc(txt.slice(0, c)) + '<span class="caret"></span>');
              await wait(38);
            }
            bubbleAt(b, W, H, '<span class="tag">type</span>' + esc(txt) + (st.submit ? ' <span class="tag">⏎</span>' : ""));
            await wait(650);
          } else if (st.action === "click" && b) {
            els.ripple.style.left = els.cursor.style.left;
            els.ripple.style.top = els.cursor.style.top;
            els.ripple.classList.remove("is-go"); void els.ripple.offsetWidth; els.ripple.classList.add("is-go");
            await wait(380);
          } else if (st.action === "select") {
            bubbleAt(b, W, H, '<span class="tag">select</span>' + esc(st.option));
            await wait(900);
          } else if (st.action === "scroll") {
            cursorTo(W * 0.5, H * 0.55, W, H);
            bubbleAt(null, W, H, '<span class="tag">scroll</span>' + (st.dir === "up" ? "↑ up" : "↓ down"));
            await wait(650);
          } else if (st.action === "back") {
            bubbleAt(null, W, H, '<span class="tag">navigate</span>← back');
            await wait(700);
          } else if (st.action === "goto") {
            bubbleAt(null, W, H, '<span class="tag">open</span>' + esc(st.path));
            await wait(800);
          } else if (st.action === "press") {
            bubbleAt(b, W, H, '<span class="tag">key</span>' + esc(st.key));
            await wait(700);
          }
          await gate();
          progress(k, 0.75);
          els.target.classList.remove("is-on");
          els.bubble.classList.remove("is-on");
          if (st.after !== st.before) await show(st.after);
          setUrl(st.url_after || st.url);
          progress(k, 1);
          await wait(st.action === "scroll" ? 900 : 1250);
        }
        // final answer
        S.i = steps.length;
        highlight(steps.length);
        setUrl(d.final_url || (steps.length ? steps[steps.length - 1].url_after : d.start_url));
        els.answer.classList.add("is-on");
        await wait(9000);
        await gate();
        els.answer.classList.remove("is-on");
        await wait(500);
        playFrom(0);
      } catch (e) { if (e !== "stale") throw e; }
    }

    function buildSide(d) {
      els.site.textContent = d.name;
      els.meta.innerHTML =
        "<span>mirror of <b>" + esc(d.upstream_host) + "</b></span>" +
        "<span>port <b>" + d.port + "</b></span>" +
        "<span><b>" + d.tasks + "</b> tasks</span>" +
        "<span>task <b>" + esc(d.task_id) + "</b></span>";
      els.mirror.innerHTML = "WebHarbor mirror of <b>" + esc(d.upstream_host) + "</b>";
      els.task.textContent = d.task;
      els.steps.innerHTML = "";
      els.segs.innerHTML = "";
      d.steps.forEach(function (st, k) {
        var li = document.createElement("li");
        li.innerHTML = '<span class="cap">' + esc(st.caption) + '<span class="act">' + esc(st.label) + "</span></span>";
        li.addEventListener("click", function () { S.paused = false; root.classList.remove("is-paused"); playFrom(k); });
        els.steps.appendChild(li);
        var sg = document.createElement("button");
        sg.className = "seg";
        sg.setAttribute("aria-label", "Jump to step " + (k + 1));
        sg.addEventListener("click", function () { S.paused = false; root.classList.remove("is-paused"); playFrom(k); });
        els.segs.appendChild(sg);
      });
      var li = document.createElement("li");
      li.innerHTML = '<span class="cap">Report the answer<span class="act">done</span></span>';
      els.steps.appendChild(li);
      els.answer.innerHTML =
        '<div class="h">Final answer</div>' +
        '<div class="answer-text">' + esc(d.answer) + "</div>";
    }

    function zoomFrom(trigger) {
      if (reduceMotion || !trigger || !trigger.getBoundingClientRect) return;
      var from = trigger.getBoundingClientRect();
      var box = els.box;
      box.style.transition = "none";
      box.style.transform = "none";
      var to = box.getBoundingClientRect();
      if (!to.width || !from.width) { box.style.transition = ""; return; }
      var sx = from.width / to.width, sy = from.height / to.height;
      var dx = from.left + from.width / 2 - (to.left + to.width / 2);
      var dy = from.top + from.height / 2 - (to.top + to.height / 2);
      box.style.transformOrigin = "50% 50%";
      box.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
      box.style.opacity = "0.4";
      void box.offsetWidth;
      box.style.transition = "transform .55s cubic-bezier(.2,.8,.2,1), opacity .35s ease";
      box.style.transform = "none";
      box.style.opacity = "";
      setTimeout(function () { box.style.transition = ""; box.style.transform = ""; }, 600);
    }
    function open(slug, trigger) {
      S.lastFocus = trigger || document.activeElement;
      S.open = true;
      root.classList.add("is-open");
      zoomFrom(trigger);
      root.setAttribute("aria-hidden", "false");
      document.documentElement.style.overflow = "hidden";
      syncPause();
      load(slug);
      setTimeout(function () { $(".close", root).focus({ preventScroll: true }); }, 50);
    }
    function load(slug) {
      S.token++;
      clearTimeout(S.timer);
      S.site = slug;
      S.frames = [];
      S.base = "assets/traj/" + slug + "/";
      els.loading.classList.remove("is-gone");
      els.a.classList.add("is-hidden"); els.b.classList.add("is-hidden");
      clearOverlays();
      var tok = S.token;
      fetch(S.base + "traj.json").then(function (r) { return r.json(); }).then(function (d) {
        if (tok !== S.token) return;
        S.data = d;
        buildSide(d);
        setUrl(d.start_url);
        els.cursor.style.transition = "none";
        cursorTo(d.viewport[0] * 0.5, d.viewport[1] * 0.4, d.viewport[0], d.viewport[1]);
        void els.cursor.offsetWidth;
        els.cursor.style.transition = "";
        return preload(d.steps.length ? d.steps[0].before : d.final_frame).then(function () {
          if (tok !== S.token) return;
          els.loading.classList.add("is-gone");
          playFrom(0);
        });
      }).catch(function () { els.loading.textContent = "Could not load this trajectory."; });
    }
    function close() {
      S.token++;
      clearTimeout(S.timer);
      S.open = false;
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      document.documentElement.style.overflow = "";
      syncPause();
      if (S.lastFocus && S.lastFocus.focus) S.lastFocus.focus({ preventScroll: true });
    }
    function step(delta) {
      if (!S.data) return;
      var n = Math.max(0, Math.min(S.data.steps.length - 1, S.i + delta));
      playFrom(n);
    }
    function neighbor(delta) {
      var k = order.indexOf(S.site);
      var next = order[(k + delta + order.length) % order.length];
      load(next);
    }
    function togglePause() {
      S.paused = !S.paused;
      root.classList.toggle("is-paused", S.paused);
      els.play.setAttribute("aria-label", S.paused ? "Play" : "Pause");
    }

    if (root) {
      order = $$(".card").map(function (c) { return c.dataset.slug; });
      $(".close", root).addEventListener("click", close);
      root.addEventListener("click", function (e) { if (e.target === root) close(); });
      els.play.addEventListener("click", togglePause);
      $(".ctl.prev", root).addEventListener("click", function () { step(-1); });
      $(".ctl.next", root).addEventListener("click", function () { step(1); });
      els.speed.addEventListener("click", function () {
        S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 0.5 : 1;
        els.speed.textContent = S.speed + "×";
      });
      $(".prev-site", root).addEventListener("click", function () { neighbor(-1); });
      $(".next-site", root).addEventListener("click", function () { neighbor(1); });
      document.addEventListener("keydown", function (e) {
        if (!S.open) return;
        if (e.key === "Escape") close();
        else if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); togglePause(); }
        else if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "Tab") { // keep focus inside the dialog
          var f = $$("button, [href]", root).filter(function (x) { return x.offsetParent !== null; });
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      });
      document.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-slug]");
        if (t && !root.contains(t)) { e.preventDefault(); open(t.dataset.slug, t); }
      });
    }
    return { isOpen: isOpen, open: open };
  })();

  /* ---------------- copy buttons ---------------- */
  $$(".copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var src = document.getElementById(b.dataset.target);
      var text = src ? src.innerText : "";
      var done = function () { var o = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = o; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  syncPause();
})();
