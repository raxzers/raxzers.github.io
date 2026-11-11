(function () {
  'use strict';

  /* ========== Constantes ========== */
  var LETTERS = ['B', 'I', 'N', 'G', 'O'];
  var RANGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  var FREE = 12; // casilla central (fila 2, columna 2)
  var STORAGE_KEY = 'bingoControl.v1';

  /* ========== Figuras (índices 0-24, por filas) ========== */
  function idx(r, c) { return r * 5 + c; }
  var rows = [0, 1, 2, 3, 4].map(function (r) {
    return [0, 1, 2, 3, 4].map(function (c) { return idx(r, c); });
  });
  var cols = [0, 1, 2, 3, 4].map(function (c) {
    return [0, 1, 2, 3, 4].map(function (r) { return idx(r, c); });
  });
  function union() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      arguments[i].forEach(function (v) { if (out.indexOf(v) === -1) out.push(v); });
    }
    return out;
  }

  // L: una columna del borde + una fila del borde que se unen en una esquina (4 orientaciones)
  var Ls = [];
  [0, 4].forEach(function (c) {
    [0, 4].forEach(function (r) { Ls.push(union(cols[c], rows[r])); });
  });
  // T: una línea del borde + la línea central perpendicular (4 orientaciones)
  var Ts = [
    union(rows[0], cols[2]),
    union(rows[4], cols[2]),
    union(cols[0], rows[2]),
    union(cols[4], rows[2])
  ];
  var ALL = [];
  for (var k = 0; k < 25; k++) ALL.push(k);

  var CONDITIONS = [
    { id: 'esquinas',   name: '4 esquinas',  shapes: [[0, 4, 20, 24]] },
    { id: 'horizontal', name: 'Horizontal',  shapes: rows },
    { id: 'vertical',   name: 'Vertical',    shapes: cols },
    { id: 'diagonal',   name: 'Diagonales',  shapes: [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]] },
    { id: 'L',          name: 'L',           shapes: Ls },
    { id: 'T',          name: 'T',           shapes: Ts },
    { id: 'lleno',      name: 'Cartón lleno', shapes: [ALL] }
  ];

  function condById(id) {
    for (var i = 0; i < CONDITIONS.length; i++) if (CONDITIONS[i].id === id) return CONDITIONS[i];
    return null;
  }

  /* ========== Estado ========== */
  function allActive() {
    var a = {};
    CONDITIONS.forEach(function (c) { a[c.id] = true; });
    return a;
  }
  function defaultState() {
    return { cards: [], called: [], active: allActive(), log: [], nextId: 1 };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && Array.isArray(s.cards) && Array.isArray(s.called)) {
        var d = defaultState();
        d.cards = s.cards;
        d.called = s.called;
        d.log = Array.isArray(s.log) ? s.log : [];
        d.nextId = s.nextId || (s.cards.length + 1);
        if (s.active) CONDITIONS.forEach(function (c) { if (s.active[c.id] === false) d.active[c.id] = false; });
        return d;
      }
    } catch (e) { /* ignorar */ }
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  }

  var state = load();
  var alerts = []; // victorias nuevas de la última acción (no se guardan)

  /* ========== Utilidades ========== */
  function $(id) { return document.getElementById(id); }
  function letterFor(n) { return LETTERS[Math.min(4, Math.floor((n - 1) / 15))]; }
  function label(n) { return letterFor(n) + '-' + n; }
  function cardName(id) { return 'Cartón ' + id; }
  function calledSet() {
    var s = {};
    state.called.forEach(function (n) { s[n] = true; });
    return s;
  }
  function lastBall() { return state.called.length ? state.called[state.called.length - 1] : null; }
  function cardById(id) {
    for (var i = 0; i < state.cards.length; i++) if (state.cards[i].id === id) return state.cards[i];
    return null;
  }
  function setMsg(el, text, type) {
    el.textContent = text;
    el.className = 'msg' + (type ? ' ' + type : '');
  }

  /* ========== Lógica de victoria ========== */
  function isComplete(card, cond, called) {
    return cond.shapes.some(function (shape) {
      return shape.every(function (i) { return i === FREE || called[card.cells[i]]; });
    });
  }
  function alreadyLogged(condId, cardId) {
    return state.log.some(function (e) { return e.cond === condId && e.cardId === cardId; });
  }
  // Revisa condiciones activas; registra y devuelve las victorias nuevas.
  function evaluate(ball) {
    var called = calledSet();
    var wins = [];
    CONDITIONS.forEach(function (cond) {
      if (!state.active[cond.id]) return;
      state.cards.forEach(function (card) {
        if (!alreadyLogged(cond.id, card.id) && isComplete(card, cond, called)) {
          state.log.push({ cond: cond.id, cardId: card.id, ball: ball });
          wins.push({ cond: cond.id, cardId: card.id });
        }
      });
    });
    return wins;
  }

  /* ========== Render ========== */
  function renderBoard() {
    var called = calledSet();
    var last = lastBall();
    var html = '';
    for (var r = 0; r < 5; r++) {
      html += '<div class="board-row"><span class="letter">' + LETTERS[r] + '</span>';
      for (var n = RANGES[r][0]; n <= RANGES[r][1]; n++) {
        var cls = 'num' + (called[n] ? ' called' : '') + (n === last ? ' last' : '');
        html += '<span class="' + cls + '">' + n + '</span>';
      }
      html += '</div>';
    }
    $('board').innerHTML = html;
  }

  function renderConds() {
    var html = '';
    CONDITIONS.forEach(function (c) {
      var on = state.active[c.id];
      html += '<label class="' + (on ? 'on' : '') + '">' +
        '<input type="checkbox" data-cond="' + c.id + '"' + (on ? ' checked' : '') + '> ' +
        c.name + '</label>';
    });
    $('conds').innerHTML = html;
  }

  function renderAlerts() {
    var html = '';
    CONDITIONS.forEach(function (cond) {
      var ids = alerts.filter(function (w) { return w.cond === cond.id; })
                      .map(function (w) { return cardName(w.cardId); });
      if (ids.length) {
        html += '<div class="alert-win">¡' + cond.name + '! → ' + ids.join(', ') + '</div>';
      }
    });
    $('alerts').innerHTML = html;
  }

  function renderLog() {
    if (!state.log.length) {
      $('winnersLog').innerHTML = '<li class="empty">Aún no hay ganadores.</li>';
      return;
    }
    var html = '';
    for (var i = state.log.length - 1; i >= 0; i--) {
      var e = state.log[i];
      html += '<li><strong>' + condById(e.cond).name + '</strong> — ' +
        cardName(e.cardId) + ' (bolita ' + label(e.ball) + ')</li>';
    }
    $('winnersLog').innerHTML = html;
  }

  function renderCards() {
    var called = calledSet();
    var last = lastBall();
    $('cardCount').textContent = state.cards.length;
    if (!state.cards.length) {
      $('cards').innerHTML = '<p class="empty-cards">Aún no hay cartones registrados.</p>';
      return;
    }
    var html = '';
    state.cards.forEach(function (card) {
      var wins = state.log.filter(function (e) { return e.cardId === card.id; });
      html += '<div class="card' + (wins.length ? ' has-win' : '') + '">';
      html += '<div class="card-head"><strong>' + cardName(card.id) + '</strong>' +
        '<button class="small danger" data-del="' + card.id + '">Eliminar</button></div>';
      html += '<div class="grid5 card-grid">';
      LETTERS.forEach(function (L) { html += '<div class="letter">' + L + '</div>'; });
      for (var i = 0; i < 25; i++) {
        var n = card.cells[i];
        var cls = 'cell';
        var txt;
        if (i === FREE) { cls += ' free marked'; txt = '★'; }
        else {
          txt = n;
          if (called[n]) cls += ' marked';
          if (n === last) cls += ' last';
        }
        html += '<div class="' + cls + '">' + txt + '</div>';
      }
      html += '</div>';
      if (wins.length) {
        html += '<div class="chips">';
        wins.forEach(function (w) { html += '<span class="chip">' + condById(w.cond).name + '</span>'; });
        html += '</div>';
      }
      html += '</div>';
    });
    $('cards').innerHTML = html;
  }

  function renderAll() {
    renderBoard();
    renderConds();
    renderAlerts();
    renderLog();
    renderCards();
  }

  /* ========== Bolitas ========== */
  var ballInput = $('ballInput');
  var ballMsg = $('ballMsg');

  function addBall() {
    var v = ballInput.value.trim();
    var n = parseInt(v, 10);
    if (!/^\d+$/.test(v) || n < 1 || n > 75) {
      setMsg(ballMsg, 'Digita un número entre 1 y 75.', 'error');
      ballInput.select();
      return;
    }
    if (calledSet()[n]) {
      setMsg(ballMsg, label(n) + ' ya había salido.', 'error');
      ballInput.select();
      return;
    }
    state.called.push(n);
    var holders = state.cards.filter(function (c) { return c.cells.indexOf(n) !== -1; })
                             .map(function (c) { return cardName(c.id); });
    alerts = evaluate(n);
    save();
    setMsg(ballMsg, label(n) + (holders.length ? ' está en: ' + holders.join(', ') : ' no está en ningún cartón'), 'ok');
    ballInput.value = '';
    renderAll();
    ballInput.focus();
  }

  function undoBall() {
    if (!state.called.length) {
      setMsg(ballMsg, 'No hay bolitas para deshacer.', 'error');
      return;
    }
    var n = state.called.pop();
    state.log = state.log.filter(function (e) { return e.ball !== n; });
    alerts = [];
    save();
    setMsg(ballMsg, 'Se deshizo la bolita ' + label(n) + '.', 'ok');
    renderAll();
    ballInput.focus();
  }

  function resetBalls() {
    if (!confirm('¿Reiniciar los números jugados? Los cartones se conservan y todas las condiciones se vuelven a activar.')) return;
    state.called = [];
    state.log = [];
    state.active = allActive();
    alerts = [];
    save();
    setMsg(ballMsg, 'Números reiniciados.', 'ok');
    renderAll();
    ballInput.focus();
  }

  $('ballBtn').addEventListener('click', addBall);
  $('undoBtn').addEventListener('click', undoBall);
  $('resetBtn').addEventListener('click', resetBalls);
  ballInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') addBall(); });
  ballInput.addEventListener('input', function () {
    ballInput.value = ballInput.value.replace(/\D/g, '');
  });

  /* ========== Condiciones ========== */
  $('conds').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-cond');
    if (!id) return;
    state.active[id] = e.target.checked;
    alerts = [];
    if (e.target.checked && state.called.length) {
      // Al reactivar, revisar de inmediato si algún cartón ya la cumple
      alerts = evaluate(lastBall());
    }
    save();
    renderAll();
  });

  /* ========== Formulario de cartón ========== */
  var formGrid = $('cardForm');
  var formMsg = $('formMsg');
  var inputs = []; // 25 posiciones; null en la casilla libre

  function buildForm() {
    var html = '';
    LETTERS.forEach(function (L) { html += '<div class="letter">' + L + '</div>'; });
    formGrid.innerHTML = html;
    inputs = [];
    for (var i = 0; i < 25; i++) {
      if (i === FREE) {
        var f = document.createElement('div');
        f.className = 'free';
        f.textContent = 'LIBRE';
        formGrid.appendChild(f);
        inputs.push(null);
        continue;
      }
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.inputMode = 'numeric';
      inp.maxLength = 2;
      inp.autocomplete = 'off';
      inp.setAttribute('aria-label', LETTERS[i % 5] + ', fila ' + (Math.floor(i / 5) + 1));
      inp.addEventListener('input', onFormInput.bind(null, i));
      inp.addEventListener('keydown', onFormKey.bind(null, i));
      formGrid.appendChild(inp);
      inputs.push(inp);
    }
  }

  function focusNext(i) {
    for (var j = i + 1; j < 25; j++) {
      if (inputs[j]) { inputs[j].focus(); inputs[j].select(); return; }
    }
    $('addCardBtn').focus();
  }
  function focusPrev(i) {
    for (var j = i - 1; j >= 0; j--) {
      if (inputs[j]) { inputs[j].focus(); inputs[j].select(); return; }
    }
  }
  function onFormInput(i) {
    var inp = inputs[i];
    inp.value = inp.value.replace(/\D/g, '');
    inp.classList.remove('invalid');
    // Un dígito 8 o 9 no puede ser inicio de un número válido de 2 cifras (máx. 75)
    if (inp.value.length === 2 || (inp.value.length === 1 && Number(inp.value) >= 8)) focusNext(i);
  }
  function onFormKey(i, e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i === 24) addCard(); else focusNext(i);
    } else if (e.key === 'Backspace' && inputs[i].value === '') {
      focusPrev(i);
    }
  }

  function clearForm() {
    inputs.forEach(function (inp) { if (inp) { inp.value = ''; inp.classList.remove('invalid'); } });
    setMsg(formMsg, '', '');
    for (var j = 0; j < 25; j++) if (inputs[j]) { inputs[j].focus(); break; }
  }

  function addCard() {
    var cells = [];
    var seen = {};
    var errors = [];
    var outOfColumn = [];
    inputs.forEach(function (inp) { if (inp) inp.classList.remove('invalid'); });

    for (var i = 0; i < 25; i++) {
      if (i === FREE) { cells.push(0); continue; }
      var v = inputs[i].value.trim();
      var n = parseInt(v, 10);
      if (!/^\d+$/.test(v) || n < 1 || n > 75) {
        inputs[i].classList.add('invalid');
        errors.push('Hay casillas vacías o fuera del rango 1-75.');
        cells.push(0);
        continue;
      }
      if (seen[n] !== undefined) {
        inputs[i].classList.add('invalid');
        inputs[seen[n]].classList.add('invalid');
        errors.push('Hay números repetidos en el cartón.');
      } else {
        seen[n] = i;
      }
      var col = i % 5;
      if (n < RANGES[col][0] || n > RANGES[col][1]) outOfColumn.push(n);
      cells.push(n);
    }

    if (errors.length) {
      var uniq = errors.filter(function (e, p) { return errors.indexOf(e) === p; });
      setMsg(formMsg, uniq.join(' '), 'error');
      return;
    }
    if (outOfColumn.length) {
      var ok = confirm('Estos números no corresponden al rango de su columna: ' + outOfColumn.join(', ') +
        '.\n\n¿Guardar el cartón de todos modos?');
      if (!ok) return;
    }

    var card = { id: state.nextId++, cells: cells };
    state.cards.push(card);
    var last = lastBall();
    alerts = last !== null ? evaluate(last) : [];
    save();
    renderAll();
    clearForm();
    setMsg(formMsg, cardName(card.id) + ' agregado.', 'ok');
  }

  $('addCardBtn').addEventListener('click', addCard);
  $('clearFormBtn').addEventListener('click', clearForm);

  /* ========== Lista de cartones ========== */
  $('cards').addEventListener('click', function (e) {
    var id = e.target.getAttribute('data-del');
    if (!id) return;
    id = parseInt(id, 10);
    if (!confirm('¿Eliminar ' + cardName(id) + '?')) return;
    state.cards = state.cards.filter(function (c) { return c.id !== id; });
    state.log = state.log.filter(function (en) { return en.cardId !== id; });
    alerts = [];
    save();
    renderAll();
  });

  $('clearCardsBtn').addEventListener('click', function () {
    if (!state.cards.length) return;
    if (!confirm('¿Borrar TODOS los cartones? Esta acción no se puede deshacer.')) return;
    state.cards = [];
    state.log = [];
    state.nextId = 1;
    alerts = [];
    save();
    renderAll();
  });

  /* ========== Inicio ========== */
  buildForm();
  renderAll();
})();
