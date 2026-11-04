/* WebHarbor project page: interactive charts (no library).
   Every chart renders the first time it scrolls into view; switching a
   control animates bar widths and re-sorts rows with transforms only. */
(function () {
  "use strict";

  var dataEl = document.getElementById("chart-data");
  if (!dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (v, d) { return Number(v).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------------- shared tooltip ---------------- */
  var tip = document.createElement("div");
  tip.className = "tip";
  tip.setAttribute("role", "status");
  document.body.appendChild(tip);
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("is-on");
    var r = tip.getBoundingClientRect();
    var left = Math.min(window.innerWidth - r.width - 10, Math.max(10, x - r.width / 2));
    var top = y - r.height - 14;
    if (top < 8) top = y + 18;
    tip.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
  }
  function hideTip() { tip.classList.remove("is-on"); }
  function bindTip(el, html) {
    el.addEventListener("pointermove", function (e) { showTip(typeof html === "function" ? html() : html, e.clientX, e.clientY); });
    el.addEventListener("pointerleave", hideTip);
    el.addEventListener("focus", function () { var r = el.getBoundingClientRect(); showTip(typeof html === "function" ? html() : html, r.left + r.width / 2, r.top); });
    el.addEventListener("blur", hideTip);
  }
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------------- segmented controls ---------------- */
  // seg(container, [{key,label}], initialKey, onChange)
  function seg(host, options, initial, onChange, label) {
    var g = document.createElement("div");
    g.className = "segctl";
    g.setAttribute("role", "group");
    if (label) g.setAttribute("aria-label", label);
    options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.setAttribute("aria-pressed", String(o.key === initial));
      b.addEventListener("click", function () {
        $$("button", g).forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        onChange(o.key);
      });
      g.appendChild(b);
    });
    host.appendChild(g);
    return g;
  }

  /* ---------------- sortable bar chart ----------------
     rows: [{id, label, value, max?, tip, cls}] — rows keep their DOM node and
     move with translateY, widths transition, so switches animate smoothly. */
  function BarChart(host, opts) {
    this.host = host;
    this.opts = opts || {};
    this.rowH = this.opts.rowH || 34;
    this.nodes = {};
    host.classList.add("bchart");
  }
  BarChart.prototype.update = function (rows, max, valueFmt) {
    var self = this, host = this.host, visible = rows.filter(function (r) { return !r.hidden; });
    if (this.opts.sort !== false) visible.sort(function (a, b) { return b.value - a.value; });
    var order = {};
    visible.forEach(function (r, i) { order[r.id] = i; });
    rows.forEach(function (r) {
      var n = self.nodes[r.id];
      if (!n) {
        n = document.createElement("div");
        n.className = "brow" + (r.cls ? " " + r.cls : "");
        n.tabIndex = 0;
        n.innerHTML = '<span class="blabel"></span><span class="btrack"><span class="bfill"></span></span><span class="bval"></span>';
        $(".blabel", n).textContent = r.label;
        host.appendChild(n);
        self.nodes[r.id] = n;
        bindTip(n, function () { return n._tip; });
      }
      n._tip = r.tip;
      var i = order[r.id];
      var shown = i !== undefined;
      n.classList.toggle("is-out", !shown);
      n.style.transform = "translateY(" + ((shown ? i : visible.length) * self.rowH) + "px)";
      $(".bfill", n).style.width = shown ? Math.max(0.4, 100 * r.value / max) + "%" : "0%";
      $(".bval", n).textContent = valueFmt(r.value, r);
      n.setAttribute("aria-label", r.label + ": " + valueFmt(r.value, r));
    });
    host.style.height = visible.length * this.rowH + "px";
  };

  /* ---------------- render-on-view ---------------- */
  var pending = [];
  function onView(el, fn) {
    if (!el) return;
    if (!("IntersectionObserver" in window) || reduceMotion) { fn(); return; }
    var job = { el: el, done: false, run: function () { if (job.done) return; job.done = true; io.disconnect(); fn(); } };
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); requestAnimationFrame(job.run); }
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    pending.push(job);
  }
  // An unrendered chart is only a few pixels tall and grows when it renders. A jump to an anchor
  // further down would scroll past such charts, render them on the way and push the target out of
  // place, so every pending chart before the target is rendered before the browser scrolls.
  function renderBefore(target) {
    pending.forEach(function (job) {
      if (!job.done && (job.el === target || target.contains(job.el) ||
          (job.el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING))) job.run();
    });
  }
  function anchorTarget(hash) {
    if (!hash || hash.length < 2) return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    var t = a && anchorTarget(a.getAttribute("href"));
    if (t) renderBefore(t);
  }, true);

  /* ---------------- 1. task coverage ---------------- */
  onView($("#ch-coverage"), function () {
    var host = $("#ch-coverage"), C = D.coverage;
    var a = new BarChart($(".bc-a", host)), b = new BarChart($(".bc-b", host));
    function draw(metric) {
      var maxOf = { tasks: 3518, share: 100, sites: 153 };
      var f = function (v) { return metric === "share" ? fmt(v, 1) + "%" : fmt(v); };
      var rows = function (list, cls) {
        return list.map(function (r) {
          return { id: r.label, label: r.label, value: r[metric], cls: cls,
            tip: "<b>" + esc(r.label) + "</b><br>" + fmt(r.tasks) + " tasks · " + fmt(r.share, 1) + "% of 3,518<br>on " + r.sites + " of 153 websites" };
        });
      };
      a.update(rows(C.categories, ""), metric === "tasks" ? 2400 : maxOf[metric], f);
      b.update(rows(C.properties, "alt"), metric === "tasks" ? 2400 : maxOf[metric], f);
    }
    seg($(".panel-ctl", host.closest(".panel")), [{ key: "tasks", label: "Tasks" }, { key: "share", label: "Share" }, { key: "sites", label: "Websites" }], "tasks", draw, "Task coverage metric");
    draw("tasks");
  });

  /* ---------------- 2. environment complexity ---------------- */
  onView($("#ch-complexity"), function () {
    var host = $("#ch-complexity"), C = D.complexity, st = { metric: "images", scope: "mean" };
    var chart = new BarChart(host, { sort: false, rowH: 40 });
    var meta = { pages: ["Pages (routes)", 1], images: ["Bundled images", 1], assets: ["Image assets (MiB)", 1], lines: ["Source lines", 1] };
    function draw() {
      var vals = C.map(function (s) { return s[st.scope][st.metric]; });
      var max = Math.max.apply(null, vals);
      var dec = st.scope === "mean" || st.metric === "assets" ? 1 : 0;
      chart.update(C.map(function (s) {
        var t = s.total, m = s.mean;
        return { id: s.name, label: s.name, value: s[st.scope][st.metric], cls: s.ours ? "ours" : "",
          tip: "<b>" + esc(s.name) + "</b><br>" + fmt(t.pages) + " pages · " + fmt(t.images) + " images<br>" + fmt(t.assets, 1) + " MiB images · " + fmt(t.lines) + " lines" +
            "<br><span class='tip-dim'>per environment: " + fmt(m.pages, 1) + " pages, " + fmt(m.images, 1) + " images</span>" };
      }), max * 1.04, function (v) { return fmt(v, dec); });
      $(".chart-cap", host.closest(".panel")).textContent = meta[st.metric][0] + (st.scope === "mean" ? ", average per environment" : ", total across the suite");
    }
    var ctl = $(".panel-ctl", host.closest(".panel"));
    seg(ctl, [{ key: "pages", label: "Pages" }, { key: "images", label: "Images" }, { key: "assets", label: "MiB" }, { key: "lines", label: "Code" }], st.metric, function (k) { st.metric = k; draw(); }, "Complexity metric");
    seg(ctl, [{ key: "mean", label: "Per env." }, { key: "total", label: "Total" }], st.scope, function (k) { st.scope = k; draw(); }, "Scope");
    draw();
  });

  /* ---------------- 3. train/test donut ---------------- */
  onView($("#ch-donut"), function () {
    var host = $("#ch-donut"), svg = $("svg", host), center = $(".donut-center", host);
    var rings = D.split.rings, legend = $(".legend", host.closest(".panel"));
    var arcs = [];
    function arcPath(cx, cy, r, a0, a1) {
      var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      return "M" + x0.toFixed(2) + " " + y0.toFixed(2) + " A" + r + " " + r + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2);
    }
    rings.forEach(function (ring) {
      var total = ring.parts.reduce(function (s, p) { return s + p.value; }, 0), a = -Math.PI / 2;
      ring.parts.forEach(function (p) {
        var span = 2 * Math.PI * p.value / total;
        var path = document.createElementNS(SVGNS, "path");
        path.setAttribute("d", arcPath(100, 100, ring.r, a + 0.012, a + span - 0.012));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", p.color);
        path.setAttribute("stroke-width", ring.w);
        path.setAttribute("class", "arc");
        path.setAttribute("tabindex", "0");
        path.dataset.key = p.key;
        var pct = (100 * p.value / total).toFixed(1);
        path._info = { label: p.label, value: p.value, pct: pct, unit: ring.unit, of: total };
        if (!reduceMotion) {
          var len = 2 * Math.PI * ring.r * (span / (2 * Math.PI));
          path.style.strokeDasharray = len + " " + len;
          path.style.strokeDashoffset = len;
          path.getBoundingClientRect();
          path.style.transition = "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1), stroke-width .2s, opacity .2s";
          requestAnimationFrame(function () { path.style.strokeDashoffset = 0; });
        }
        svg.insertBefore(path, svg.firstChild);
        arcs.push(path);
        a += span;
      });
    });
    var base = center.innerHTML;
    function focus(key) {
      arcs.forEach(function (p) { p.classList.toggle("is-dim", !!key && p.dataset.key !== key); p.classList.toggle("is-hot", p.dataset.key === key); });
      $$("li[data-key]", legend).forEach(function (li) { li.classList.toggle("is-hot", li.dataset.key === key); });
      var hit = arcs.filter(function (p) { return p.dataset.key === key; })[0];
      center.innerHTML = hit ? "<b>" + fmt(hit._info.value) + "</b><span>" + esc(hit._info.label) + "</span><span>" + hit._info.pct + "% of " + fmt(hit._info.of) + " " + hit._info.unit + "</span>" : base;
    }
    arcs.forEach(function (p) {
      p.addEventListener("pointerenter", function () { focus(p.dataset.key); });
      p.addEventListener("pointerleave", function () { focus(null); });
      p.addEventListener("focus", function () { focus(p.dataset.key); });
      p.addEventListener("blur", function () { focus(null); });
    });
    $$("li[data-key]", legend).forEach(function (li) {
      li.addEventListener("pointerenter", function () { focus(li.dataset.key); });
      li.addEventListener("pointerleave", function () { focus(null); });
    });
  });

  /* ---------------- 4. latency ---------------- */
  onView($("#ch-latency"), function () {
    var host = $("#ch-latency"), L = D.latency;
    var chart = new BarChart(host, { sort: false });
    function draw(stat) {
      chart.update(L.map(function (r) {
        return { id: r.label, label: r.label, value: r[stat], cls: r.cls || "",
          tip: "<b>" + esc(r.label) + "</b><br>mean " + r.mean + " s · median " + r.median + " s · P90 " + r.p90 + " s" };
      }), 10, function (v) { return v.toFixed(2) + " s"; });
    }
    seg($(".panel-ctl", host.closest(".panel")), [{ key: "mean", label: "Mean" }, { key: "median", label: "Median" }, { key: "p90", label: "P90" }], "mean", draw, "Latency statistic");
    draw("mean");
  });

  /* ---------------- 5. live web ---------------- */
  onView($("#ch-live"), function () {
    var host = $("#ch-live"), M = D.live, st = { metric: "avg", group: "all" };
    var chart = new BarChart(host, { rowH: 30 });
    var names = { avg: "Average", wv: "WebVoyager", om2w: "Online-Mind2Web" };
    function draw() {
      chart.update(M.map(function (m) {
        return { id: m.name, label: m.name, value: m[st.metric], hidden: st.group !== "all" && m.group !== st.group,
          cls: m.ours ? "ours" : m.group === "4b" ? "ref" : "",
          tip: "<b>" + esc(m.name) + "</b><br>WebVoyager " + fmt(m.wv, 1) + " · Online-Mind2Web " + fmt(m.om2w, 1) + "<br>average " + fmt(m.avg, 1) +
            (m.reported ? "<br><span class='tip-dim'>reported by OpenWebRL</span>" : "") };
      }), 100, function (v) { return fmt(v, 1); });
      $(".chart-cap", host.closest(".panel")).textContent = names[st.metric] + " success rate (%)";
    }
    var ctl = $(".panel-ctl", host.closest(".panel"));
    seg(ctl, [{ key: "avg", label: "Average" }, { key: "wv", label: "WebVoyager" }, { key: "om2w", label: "Online-M2W" }], "avg", function (k) { st.metric = k; draw(); }, "Benchmark");
    seg(ctl, [{ key: "all", label: "All" }, { key: "prop", label: "Proprietary" }, { key: "open", label: "Open" }, { key: "4b", label: "4B" }], "all", function (k) { st.group = k; draw(); }, "Model group");
    draw();
  });

  /* ---------------- 6. ranking slope ---------------- */
  onView($("#ch-slope"), function () {
    var host = $("#ch-slope"), S = D.slope, svg = $("svg", host);
    var x0 = 210, x1 = 350, y = function (v) { return 262 - (v - 50) / 30 * 220; };
    function spread(ys) {
      var idx = ys.map(function (_, i) { return i; }).sort(function (a, b) { return ys[a] - ys[b]; }), out = ys.slice();
      for (var k = 1; k < idx.length; k++) if (out[idx[k]] - out[idx[k - 1]] < 17) out[idx[k]] = out[idx[k - 1]] + 17;
      return out;
    }
    var l0 = spread(S.map(function (s) { return y(s.live); })), l1 = spread(S.map(function (s) { return y(s.wh); }));
    var h = '<line x1="' + x0 + '" y1="24" x2="' + x0 + '" y2="268" class="axis"/><line x1="' + x1 + '" y1="24" x2="' + x1 + '" y2="268" class="axis"/>' +
      '<text x="' + x0 + '" y="290" text-anchor="middle" class="ax-label">Live WebVoyager</text><text x="' + x1 + '" y="290" text-anchor="middle" class="ax-label">WebHarbor, same 15 sites</text>';
    S.forEach(function (s, i) {
      h += '<g class="sl" tabindex="0" data-i="' + i + '" style="--c:' + s.color + '">' +
        '<line x1="' + x0 + '" y1="' + y(s.live).toFixed(1) + '" x2="' + x1 + '" y2="' + y(s.wh).toFixed(1) + '" class="sl-line"/>' +
        '<line x1="' + x0 + '" y1="' + y(s.live).toFixed(1) + '" x2="' + x1 + '" y2="' + y(s.wh).toFixed(1) + '" class="sl-hit"/>' +
        '<circle cx="' + x0 + '" cy="' + y(s.live).toFixed(1) + '" r="5"/><circle cx="' + x1 + '" cy="' + y(s.wh).toFixed(1) + '" r="5"/>' +
        '<text x="' + (x0 - 14) + '" y="' + (l0[i] + 4.5).toFixed(1) + '" text-anchor="end" class="sl-name">' + esc(s.name) + '<tspan dx="8" class="num">' + s.live + '</tspan></text>' +
        '<text x="' + (x1 + 14) + '" y="' + (l1[i] + 4.5).toFixed(1) + '" class="num">' + s.wh + '<tspan dx="8" class="gain">+' + (s.wh - s.live).toFixed(1) + '</tspan></text></g>';
    });
    svg.innerHTML = h;
    $$(".sl", svg).forEach(function (g) {
      var s = S[+g.dataset.i];
      var on = function () { svg.classList.add("has-hot"); g.classList.add("is-hot"); };
      var off = function () { svg.classList.remove("has-hot"); g.classList.remove("is-hot"); };
      g.addEventListener("pointerenter", on); g.addEventListener("pointerleave", off);
      g.addEventListener("focus", on); g.addEventListener("blur", off);
      bindTip(g, "<b>" + esc(s.name) + "</b><br>live " + s.live + " → WebHarbor " + s.wh + " (+" + (s.wh - s.live).toFixed(1) + ")<br>rank #" + s.rank + " on both");
    });
  });

  /* ---------------- 7. WebHarbor test set ---------------- */
  onView($("#ch-testset"), function () {
    var host = $("#ch-testset"), T = D.testset, st = { metric: "verifier", harness: "GUI" };
    var chart = new BarChart(host, { rowH: 32 });
    var names = { verifier: "Verifier pass rate (%)", judge: "Agent-judge pass rate (%)", agree: "Verifier–judge agreement (%)" };
    function draw() {
      chart.update(T.map(function (r) {
        return { id: r.model + "|" + r.harness, label: r.model, value: r[st.metric], hidden: r.harness !== st.harness,
          cls: r.ours ? "ours" : r.small ? "ref" : "",
          tip: "<b>" + esc(r.model) + "</b> · " + r.harness + "<br>verifier " + fmt(r.verifier, 1) + " · judge " + fmt(r.judge, 1) + "<br>agreement " + fmt(r.agree, 1) };
      }), 100, function (v) { return fmt(v, 1); });
      $(".chart-cap", host.closest(".panel")).textContent = names[st.metric] + ", " + (st.harness === "GUI" ? "ReAct-style GUI harness" : "OpenCode with GUI tools (4B agents run GUI only)");
    }
    var ctl = $(".panel-ctl", host.closest(".panel"));
    seg(ctl, [{ key: "verifier", label: "Verifier" }, { key: "judge", label: "Judge" }, { key: "agree", label: "Agreement" }], st.metric, function (k) { st.metric = k; draw(); }, "Test-set metric");
    seg(ctl, [{ key: "GUI", label: "GUI" }, { key: "OpenCode", label: "OpenCode" }], st.harness, function (k) { st.harness = k; draw(); }, "Harness");
    draw();
  });

  /* ---------------- 8. WebArena ---------------- */
  onView($("#ch-webarena"), function () {
    var host = $("#ch-webarena"), W = D.webarena;
    var chart = new BarChart(host, { rowH: 34 });
    function draw(k) {
      chart.update(W.map(function (r) {
        return { id: r.model, label: r.model, value: r[k], cls: r.ours ? "ours" : "",
          tip: "<b>" + esc(r.model) + "</b><br>auto-login " + r.auto + " · no auto-login " + r.nl + "<br>drop " + (r.nl - r.auto).toFixed(1) };
      }), 40, function (v, r) { return fmt(v, 1) + (k === "nl" ? "  (" + (r.nl - r.auto).toFixed(1) + ")" : ""); });
    }
    seg($(".panel-ctl", host.closest(".panel")), [{ key: "auto", label: "Auto-login" }, { key: "nl", label: "No auto-login" }], "auto", draw, "WebArena setting");
    draw("auto");
  });

  /* ---------------- 9. RL gains by capability (dumbbell) ---------------- */
  onView($("#ch-rl"), function () {
    var host = $("#ch-rl"), R = D.rl, series = R.series;
    var rows = R.groups.map(function (g, i) {
      var row = document.createElement("div");
      row.className = "dumb";
      row.innerHTML = '<span class="dlabel">' + esc(g) + '</span><span class="dtrack"><span class="dspan"></span>' +
        series.map(function (s) { return '<span class="dot ' + s.key + '" tabindex="0"></span>'; }).join("") + '</span><span class="dgain"></span>';
      host.appendChild(row);
      return row;
    });
    host.insertAdjacentHTML("beforeend", '<div class="daxis"><span></span><span class="ticks"><i>0</i><i>10</i><i>20</i><i>30</i><i>40</i><i>50</i></span><span></span></div>');
    var cur = "wh";
    function draw(bench) {
      cur = bench;
      var B = R[bench];
      rows.forEach(function (row, i) {
        var v = B[i], lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
        var sp = $(".dspan", row);
        sp.style.left = lo * 2 + "%"; sp.style.width = (hi - lo) * 2 + "%";
        series.forEach(function (s, k) {
          var d = $(".dot." + s.key, row);
          d.style.left = v[k] * 2 + "%";
          d._tip = "<b>" + esc(s.label) + "</b><br>" + esc(R.groups[i]) + ": " + v[k].toFixed(1) + "%";
          if (!d._bound) { bindTip(d, function () { return d._tip; }); d._bound = true; }
        });
        var gain = v[2] - v[1];
        $(".dgain", row).textContent = (gain >= 0 ? "+" : "") + gain.toFixed(1);
      });
    }
    seg($(".panel-ctl", host.closest(".panel")), [{ key: "wh", label: "WebHarbor test" }, { key: "wa", label: "WebArena" }], "wh", draw, "Benchmark");
    draw("wh");
  });

  /* ---------------- comparison table crosshair ---------------- */
  var cmp = $(".cmp table");
  if (cmp) {
    cmp.addEventListener("pointerover", function (e) {
      var td = e.target.closest("td, th");
      if (!td) return;
      var col = td.cellIndex;
      $$("tr", cmp).forEach(function (tr) {
        Array.prototype.forEach.call(tr.cells, function (c) { c.classList.toggle("is-col", c.cellIndex === col && col > 0 && tr.cells.length > 1); });
      });
    });
    cmp.addEventListener("pointerleave", function () { $$(".is-col", cmp).forEach(function (c) { c.classList.remove("is-col"); }); });
  }

  /* ---------------- method figure zoom ---------------- */
  var fig = $(".method-figure");
  if (fig) {
    var img = $("img", fig);
    var box = document.createElement("div");
    box.className = "zoom";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "WebHarbor pipeline figure");
    box.innerHTML = '<div class="zoom-inner"><img alt="" src="' + img.getAttribute("src") + '"><button class="close" aria-label="Close"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l10 10M12 2 2 12"/></svg></button></div>';
    document.body.appendChild(box);
    var openZoom = function () { box.classList.add("is-open"); document.documentElement.style.overflow = "hidden"; $(".close", box).focus({ preventScroll: true }); };
    var closeZoom = function () { box.classList.remove("is-open"); document.documentElement.style.overflow = ""; img.focus({ preventScroll: true }); };
    img.tabIndex = 0;
    img.addEventListener("click", openZoom);
    img.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openZoom(); } });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.closest(".close")) closeZoom(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("is-open")) closeZoom(); });
  }
})();
