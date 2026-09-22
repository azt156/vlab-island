/* 科學探險島 · 互動引擎 v3.0.2（暫存制：作答手動暫存／全完成自動存）（功能同 v2；v2.5.1 僅角色圖修正） */
(function () {
  'use strict';

  var LAB = document.body.getAttribute('data-lab') || 'page';
  var PREFIX = 'vlab:' + LAB + ':';

  function lsGet(k, dflt) {
    try {
      var v = localStorage.getItem(PREFIX + k);
      return v === null ? dflt : JSON.parse(v);
    } catch (e) { return dflt; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {}
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initQuests() {
    $$('.quest input[type="checkbox"]').forEach(function (inp) {
      var key = 'quest:' + inp.getAttribute('data-k');
      inp.checked = !!lsGet(key, false);
      inp.addEventListener('change', function () { lsSet(key, inp.checked); });
    });
  }

  function initGoals() {
    var goals = $$('input[data-goal]');
    if (!goals.length) return;
    var banner = $('.loop-done');
    var loopCelebrated = false;
    function check() {
      var all = goals.every(function (g) { return g.checked; });
      if (banner) banner.classList.toggle('show', all);
      if (all && !loopCelebrated) {
        loopCelebrated = true;
        if (!reducedMotion) burst();
      }
      if (!all) loopCelebrated = false;
    }
    goals.forEach(function (g) { g.addEventListener('change', check); });
    check();
  }

  function initTables() {
    $$('table.tbl').forEach(function (tbl) {
      $$('input.cell-in', tbl).forEach(function (inp) {
        var key = 'cell:' + inp.getAttribute('data-k');
        inp.value = lsGet(key, '');
        rangeCheck(inp);
        inp.addEventListener('input', function () {
          lsSet(key, inp.value);
          rangeCheck(inp);
          updateAvgs(tbl);
        });
      });
      updateAvgs(tbl);
    });
  }
  function rangeCheck(inp) {
    var min = parseFloat(inp.getAttribute('data-min'));
    var max = parseFloat(inp.getAttribute('data-max'));
    if (isNaN(min) || isNaN(max)) return;
    var raw = inp.value.trim();
    var v = parseFloat(raw);
    var bad = raw !== '' && (isNaN(v) || v < min || v > max);
    inp.classList.toggle('range-warn', bad);
  }
  function updateAvgs(tbl) {
    if (!tbl.hasAttribute('data-avg')) return;
    $$('tr', tbl).forEach(function (tr) {
      var ins = $$('input.cell-in', tr);
      var avg = $('[data-avg-cell]', tr);
      if (!avg || ins.length < 2) return;
      var a = parseFloat(ins[0].value), b = parseFloat(ins[1].value);
      if (!isNaN(a) && !isNaN(b)) {
        var m = Math.round((a + b) / 2);
        avg.textContent = String(m);
        avg.setAttribute('data-v', String(m));
      } else {
        avg.textContent = '—';
        avg.removeAttribute('data-v');
      }
    });
  }

  function initSampleFill() {
    $$('.sample-fill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var data = {};
        try { data = JSON.parse(btn.getAttribute('data-sample') || '{}'); } catch (e) {}
        Object.keys(data).forEach(function (k) {
          var inp = document.querySelector('input.cell-in[data-k="' + k + '"]');
          if (inp) {
            inp.value = data[k];
            inp.dispatchEvent(new Event('input'));
          }
        });
        btn.textContent = '✅ 範例填好了！換你改成自己的數據';
      });
    });
  }

  function initClearFill() {
    $$('.clear-fill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var scope = btn.closest('.card') || document;
        $$('input.cell-in', scope).forEach(function (inp) {
          inp.value = '';
          lsSet('cell:' + inp.getAttribute('data-k'), '');
          inp.classList.remove('range-warn');
        });
        $$('table.tbl', scope).forEach(function (t) { updateAvgs(t); });
        var sf = scope.querySelector('.sample-fill');
        if (sf) sf.textContent = '✨ 填入範例數據看看';
        var cb = scope.querySelector('.chart-box');
        if (cb) cb.classList.remove('show');
      });
    });
  }

  function initChart() {
    var btn = $('#draw-chart');
    var box = $('#chart-box');
    var canvas = $('#chart');
    if (!btn || !box || !canvas) return;
    btn.addEventListener('click', function () {
      box.classList.add('show');
      drawChart(canvas);
      box.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
    });
  }
  function drawChart(canvas) {
    var labels = ['靜息', '運動後', '1分後', '2分後', '3分後'];
    var vals = labels.map(function (_, i) {
      var cell = document.querySelector('[data-avg-cell][data-row="' + i + '"]');
      var v = cell && cell.getAttribute('data-v');
      return v === null || v === undefined || v === '' ? null : parseFloat(v);
    });
    var dpr = window.devicePixelRatio || 1;
    var W = 680, H = 340;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = 'auto';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    var have = vals.filter(function (v) { return v !== null; });
    var padL = 52, padR = 24, padT = 26, padB = 44;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    if (have.length < 2) {
      ctx.fillStyle = '#8A8474';
      ctx.font = '800 17px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('先把上面表格填滿至少兩列（兩次都填），就能畫出曲線！', W / 2, H / 2);
      return;
    }
    var lo = Math.floor((Math.min.apply(null, have) - 8) / 10) * 10;
    var hi = Math.ceil((Math.max.apply(null, have) + 8) / 10) * 10;
    if (hi - lo < 20) hi = lo + 20;

    function x(i) { return padL + plotW * (i / (labels.length - 1)); }
    function y(v) { return padT + plotH * (1 - (v - lo) / (hi - lo)); }

    ctx.font = '700 13px "Noto Sans TC", sans-serif';
    ctx.strokeStyle = '#E3D9C2'; ctx.lineWidth = 1.5;
    ctx.fillStyle = '#8A8474'; ctx.textAlign = 'right';
    var step = (hi - lo) / 4;
    for (var g = 0; g <= 4; g++) {
      var gv = lo + step * g;
      ctx.beginPath(); ctx.moveTo(padL, y(gv)); ctx.lineTo(W - padR, y(gv)); ctx.stroke();
      ctx.fillText(String(Math.round(gv)), padL - 8, y(gv) + 4);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#2D3142';
    labels.forEach(function (lb, i) { ctx.fillText(lb, x(i), H - padB + 22); });
    ctx.fillStyle = '#8A8474'; ctx.font = '700 12px "Noto Sans TC", sans-serif';
    ctx.fillText('心率（次/分）', padL + 34, padT - 10);

    ctx.strokeStyle = '#4D96FF'; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    var started = false;
    vals.forEach(function (v, i) {
      if (v === null) return;
      if (!started) { ctx.moveTo(x(i), y(v)); started = true; }
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();

    vals.forEach(function (v, i) {
      if (v === null) return;
      ctx.beginPath(); ctx.arc(x(i), y(v), 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FF6B6B'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#2D3142'; ctx.stroke();
      ctx.fillStyle = '#2D3142'; ctx.font = '800 13px "Noto Sans TC", sans-serif';
      ctx.fillText(String(v), x(i), y(v) - 13);
    });
  }

  function initQCards() {
    $$('.qcard').forEach(function (card) {
      var id = card.getAttribute('data-q');
      var ta = $('textarea', card);
      var openBtn = $('.ans-open', card);
      var panel = $('.ans-panel', card);
      var locked = $('.locked', card);

      $$('.hint-btn', card).forEach(function (hb) {
        hb.addEventListener('click', function () {
          var t = document.getElementById(hb.getAttribute('data-target'));
          if (!t) return;
          var show = !t.classList.contains('show');
          t.classList.toggle('show', show);
          hb.setAttribute('aria-expanded', show ? 'true' : 'false');
          hb.textContent = (show ? '🙈 收起提示 ' : '💡 提示 ') + hb.getAttribute('data-n');
        });
      });

      function refreshUnlock() {
        var len = ta && ta.value ? ta.value.trim().length : 0;
        var ok = len >= 5;
        if (openBtn) openBtn.disabled = !ok;
        if (locked) locked.style.display = ok ? 'none' : 'flex';
      }
      if (ta) {
        // v3.0.2：改為「手動暫存制」——作答不再即時寫入瀏覽器；
        // 只還原「已暫存」的內容，沒暫存的重新整理後就消失。
        ta.value = lsGet('ans:' + id, '');
        ta.insertAdjacentHTML('afterend', '<div class="draft-row"><button type="button" class="btn btn-white btn-sm draft-save">💾 暫時儲存</button><span class="draft-ok">✅ 已暫存，下次回來還在</span><span class="draft-dirty">✏️ 有還沒儲存的修改</span></div>');
        var dBtn = $('.draft-save', card), dOk = $('.draft-ok', card), dDirty = $('.draft-dirty', card);
        card._saveDraft = function () {
          lsSet('ans:' + id, ta.value);
          if (dOk) { dOk.classList.add('on'); setTimeout(function () { dOk.classList.remove('on'); }, 1800); }
          if (dDirty) dDirty.classList.remove('on');
        };
        if (dBtn) dBtn.addEventListener('click', card._saveDraft);
        ta.addEventListener('input', function () {
          refreshUnlock();
          if (dDirty) dDirty.classList.toggle('on', ta.value !== lsGet('ans:' + id, ''));
        });
      }

      if (openBtn && panel) {
        if (lsGet('open:' + id, false)) {
          panel.classList.add('open');
          openBtn.textContent = '🙈 收起參考答案';
          openBtn.setAttribute('aria-expanded', 'true');
        }
        openBtn.addEventListener('click', function () {
          var willOpen = !panel.classList.contains('open');
          panel.classList.toggle('open', willOpen);
          openBtn.textContent = willOpen ? '🙈 收起參考答案' : '🔓 看看參考答案';
          openBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          lsSet('open:' + id, willOpen);
        });
      }

      $$('.chip', card).forEach(function (chip, i) {
        var key = 'chip:' + id + ':' + i;
        if (lsGet(key, false)) chip.classList.add('on');
        chip.addEventListener('click', function () {
          chip.classList.toggle('on');
          chip.setAttribute('aria-pressed', chip.classList.contains('on') ? 'true' : 'false');
          lsSet(key, chip.classList.contains('on'));
        });
      });

      $$('.assess .btn', card).forEach(function (b) {
        if (lsGet('state:' + id, '') === b.getAttribute('data-v')) b.classList.add('sel');
        b.addEventListener('click', function () {
          $$('.assess .btn', card).forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel');
          card.setAttribute('data-state', b.getAttribute('data-v'));
          lsSet('state:' + id, b.getAttribute('data-v'));
          if (card._saveDraft) card._saveDraft();
          updateProgress();
        });
      });
      var st = lsGet('state:' + id, '');
      if (st) card.setAttribute('data-state', st);
      refreshUnlock();
    });
  }

  var celebrated = false;
  function updateProgress() {
    var cards = $$('.qcard');
    if (!cards.length) return;
    var done = cards.filter(function (c) {
      var s = c.getAttribute('data-state');
      return s === 'good' || s === 'again';
    }).length;
    var pct = Math.round(done / cards.length * 100);
    var fill = $('.meter-fill');
    var txt = $('.meter-txt');
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = '⭐ ' + done + '/' + cards.length;
    if (done === cards.length && !celebrated) {
      celebrated = true;
      cards.forEach(function (c) { if (c._saveDraft) c._saveDraft(); });
      if (!reducedMotion) burst();
    }
  }
  function burst() {
    var box = document.createElement('div');
    box.className = 'confetti';
    var icons = ['⭐', '🎉', '✨', '🧪', '🔬', '🚀', '💡'];
    for (var i = 0; i < 28; i++) {
      var s = document.createElement('span');
      s.textContent = icons[i % icons.length];
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      s.style.animationDelay = (Math.random() * 0.5) + 's';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3600);
  }

  function initFilters() {
    var chips = $$('.fchip');
    if (!chips.length) return;
    var cards = $$('.wcard');
    var empty = $('.empty-note');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        var f = chip.getAttribute('data-f');
        var shown = 0;
        cards.forEach(function (card) {
          var ok = f === 'all' || card.getAttribute('data-grade') === f || (card.getAttribute('data-platform') || '').indexOf(f) !== -1;
          card.style.display = ok ? '' : 'none';
          if (ok) shown++;
        });
        if (empty) empty.style.display = shown ? 'none' : 'block';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initQuests();
    initGoals();
    initTables();
    initSampleFill();
    initClearFill();
    initChart();
    initQCards();
    initFilters();
    updateProgress();
  });
})();
