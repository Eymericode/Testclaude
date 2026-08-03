/* Mini librairie de graphiques sur <canvas> — aucune dépendance externe. */
(function (global) {
  const COLORS = {
    accent: '#6c5ce7',
    accent2: '#00cec9',
    gold: '#ffd43b',
    grid: '#2c3168',
    text: '#9aa0c8',
  };

  function setupCanvas(canvas) {
    const dpr = global.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth || 400;
    const cssHeight = canvas.getAttribute('height') ? parseInt(canvas.getAttribute('height'), 10) : 220;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  /* Graphique en courbe : { labels: [], values: [] } */
  function line(canvas, data, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { l: 34, r: 12, t: 12, b: 24 };
    const values = data.values;
    if (!values.length) return emptyMsg(ctx, w, h);
    const max = niceMax(Math.max(...values, 1));
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const color = opts.color || COLORS.accent2;

    // grille horizontale
    ctx.strokeStyle = COLORS.grid;
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px system-ui';
    ctx.lineWidth = 1;
    const lines = 4;
    for (let i = 0; i <= lines; i++) {
      const y = pad.t + (plotH * i) / lines;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      const val = Math.round(max - (max * i) / lines);
      ctx.fillText(val, 4, y + 3);
    }

    const stepX = values.length > 1 ? plotW / (values.length - 1) : 0;
    const xy = (i, v) => [pad.l + stepX * i, pad.t + plotH - (v / max) * plotH];

    // aire
    ctx.beginPath();
    values.forEach((v, i) => { const [x, y] = xy(i, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineTo(pad.l + stepX * (values.length - 1), pad.t + plotH);
    ctx.lineTo(pad.l, pad.t + plotH);
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();

    // courbe
    ctx.beginPath();
    values.forEach((v, i) => { const [x, y] = xy(i, v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // points
    ctx.fillStyle = color;
    values.forEach((v, i) => { const [x, y] = xy(i, v); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });

    // ligne de moyenne
    if (opts.average != null) {
      const [, ya] = xy(0, opts.average);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = COLORS.gold;
      ctx.beginPath(); ctx.moveTo(pad.l, ya); ctx.lineTo(w - pad.r, ya); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* Graphique en barres : { labels: [], values: [] } */
  function bar(canvas, data, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { l: 34, r: 12, t: 12, b: 30 };
    const values = data.values;
    if (!values.length || values.every((v) => v === 0)) return emptyMsg(ctx, w, h);
    const max = niceMax(Math.max(...values, 1));
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const color = opts.color || COLORS.accent;

    ctx.strokeStyle = COLORS.grid;
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px system-ui';
    const lines = 4;
    for (let i = 0; i <= lines; i++) {
      const y = pad.t + (plotH * i) / lines;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillText(Math.round(max - (max * i) / lines), 4, y + 3);
    }

    const n = values.length;
    const slot = plotW / n;
    const bw = Math.min(slot * 0.6, 46);
    values.forEach((v, i) => {
      const bh = (v / max) * plotH;
      const x = pad.l + slot * i + (slot - bw) / 2;
      const y = pad.t + plotH - bh;
      const grad = ctx.createLinearGradient(0, y, 0, pad.t + plotH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '55');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, bw, bh, 5);
      ctx.fill();
      // valeur
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'center';
      ctx.fillText(data.display ? data.display[i] : v, x + bw / 2, y - 4);
      // label
      ctx.fillText(data.labels[i], x + bw / 2, h - 10);
      ctx.textAlign = 'left';
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (h <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function emptyMsg(ctx, w, h) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Pas assez de données', w / 2, h / 2);
    ctx.textAlign = 'left';
  }

  global.MiniChart = { line, bar };
})(window);
