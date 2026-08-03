/* Your Fortnite tracker — logique principale. */
(function () {
  'use strict';

  const STORAGE_KEY = 'fortnite-tracker-matches';
  const GOALS_KEY = 'fortnite-tracker-goals';
  let matches = load();
  let goals = loadGoals();

  /* ---------- Stockage ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  }
  function loadGoals() {
    try {
      const raw = localStorage.getItem(GOALS_KEY);
      return raw ? JSON.parse(raw) : { kills: null, matches: null, wins: null, damage: null };
    } catch (e) {
      return { kills: null, matches: null, wins: null, damage: null };
    }
  }
  function saveGoals() {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  }

  /* Config Epic (clé API + pseudo) et point de départ de la synchro */
  const APIKEY_KEY = 'fortnite-tracker-apikey';
  const EPIC_KEY = 'fortnite-tracker-epic';
  const BASELINE_KEY = 'fortnite-tracker-baseline';
  function getEpicConfig() {
    const key = (localStorage.getItem(APIKEY_KEY) || '').trim();
    let epic = {};
    try { epic = JSON.parse(localStorage.getItem(EPIC_KEY) || '{}'); } catch (e) { epic = {}; }
    return { key, name: (epic.name || '').trim(), platform: epic.platform || 'epic' };
  }
  function getBaseline() {
    try { return JSON.parse(localStorage.getItem(BASELINE_KEY) || 'null'); } catch (e) { return null; }
  }
  function setBaseline(snap) {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(snap));
  }

  /* ---------- Utilitaires ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const round = (n, d = 2) => {
    const p = Math.pow(10, d);
    return Math.round((n + Number.EPSILON) * p) / p;
  };
  const isWin = (m) => Number(m.placement) === 1;
  const isTop = (m) => {
    const lobby = Number(m.lobbySize) || 100;
    return Number(m.placement) <= Math.max(1, Math.round(lobby * 0.1));
  };

  /* Normalise une entrée (match manuel OU session Epic synchronisée) en agrégats. */
  function norm(m) {
    if (m.source === 'epic') {
      return {
        matches: Number(m.matches) || 0,
        kills: Number(m.kills) || 0,
        wins: Number(m.wins) || 0,
        tops: Number(m.top10) || 0,
        damage: 0,
        dmgMatches: 0,
      };
    }
    return {
      matches: 1,
      kills: Number(m.kills) || 0,
      wins: isWin(m) ? 1 : 0,
      tops: isTop(m) ? 1 : 0,
      damage: Number(m.damage) || 0,
      dmgMatches: 1,
    };
  }
  const totalMatches = (list) => list.reduce((a, m) => a + norm(m).matches, 0);

  /* ---------- Semaines (ISO) ---------- */
  function isoWeek(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setHours(0, 0, 0, 0);
    // Jeudi de la semaine courante détermine l'année ISO
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    const week = 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return date.getFullYear() + '-W' + String(week).padStart(2, '0');
  }
  function weekRange(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = (d.getDay() + 6) % 7; // 0 = lundi
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  }
  function fmtDay(d) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  function currentWeekKey() {
    return isoWeek(new Date().toISOString().slice(0, 10));
  }
  function groupByWeek() {
    const groups = {};
    matches.forEach((m) => {
      const key = isoWeek(m.date);
      (groups[key] = groups[key] || []).push(m);
    });
    return groups; // { '2026-W31': [matches...] }
  }

  /* ---------- Filtrage ---------- */
  function filtered() {
    const mode = $('#filterMode').value;
    const period = $('#filterPeriod').value;
    let list = matches.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    if (mode !== 'all') list = list.filter((m) => m.mode === mode);

    if (period === '7' || period === '30') {
      const days = Number(period);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutStr = cutoff.toISOString().slice(0, 10);
      list = list.filter((m) => m.date >= cutStr);
    } else if (period === 'last20') {
      list = list.slice(-20);
    }
    return list;
  }

  /* ---------- Calcul des statistiques (compatible sessions Epic) ---------- */
  function computeStats(list) {
    if (!list.length) return null;
    let n = 0, kills = 0, wins = 0, tops = 0, damage = 0, dmgMatches = 0, assists = 0;
    list.forEach((m) => {
      const x = norm(m);
      n += x.matches;
      kills += x.kills;
      wins += x.wins;
      tops += x.tops;
      damage += x.damage;
      dmgMatches += x.dmgMatches;
      assists += Number(m.assists) || 0;
    });
    if (n === 0) return null;
    const deaths = Math.max(0, n - wins);
    const manualPlacements = list.filter((m) => m.source !== 'epic').map((m) => Number(m.placement) || 999);
    return {
      n,
      entries: list.length,
      kills,
      avgKills: round(kills / n),
      assists,
      avgAssists: round(assists / n),
      damage,
      avgDamage: dmgMatches ? round(damage / dmgMatches) : 0,
      wins,
      winRate: round((wins / n) * 100, 1),
      tops,
      topRate: round((tops / n) * 100, 1),
      kd: round(kills / Math.max(1, deaths)),
      bestKills: Math.max(0, ...list.map((m) => Number(m.kills) || 0)),
      bestPlacement: manualPlacements.length ? Math.min(...manualPlacements) : null,
    };
  }

  /* ---------- Rendu : cartes du tableau de bord ---------- */
  function renderCards(s) {
    const cards = [
      { label: 'Matchs', value: s.n, sub: '', cls: '' },
      { label: 'Kills / match', value: s.avgKills, sub: `${s.kills} kills au total`, cls: 'accent' },
      { label: 'K/D', value: s.kd, sub: 'ratio kills / morts', cls: 'accent' },
      { label: 'Victory Royale', value: s.wins, sub: `${s.winRate}% de victoires`, cls: 'gold' },
      { label: 'Top 10%', value: `${s.topRate}%`, sub: `${s.tops} matchs`, cls: '' },
      { label: 'Dégâts / match', value: s.avgDamage, sub: `record ${s.bestKills} kills`, cls: '' },
    ];
    $('#statCards').innerHTML = cards
      .map(
        (c) => `<div class="card ${c.cls}">
          <div class="label">${c.label}</div>
          <div class="value">${c.value}</div>
          <div class="sub">${c.sub}</div>
        </div>`
      )
      .join('');
  }

  /* ---------- Rendu : graphiques ---------- */
  function renderCharts(list, s) {
    // Kills par match (moyenne par entrée : match unitaire ou session Epic)
    MiniChart.line($('#chartKills'), {
      labels: list.map((_, i) => i + 1),
      values: list.map((m) => { const x = norm(m); return x.matches ? round(x.kills / x.matches) : 0; }),
    }, { average: s.avgKills });

    // Dégâts par match (uniquement les matchs saisis manuellement — Epic ne fournit pas les dégâts)
    const dmgList = list.filter((m) => m.source !== 'epic');
    MiniChart.line($('#chartDamage'), {
      labels: dmgList.map((_, i) => i + 1),
      values: dmgList.map((m) => Number(m.damage) || 0),
    }, { color: '#6c5ce7', average: s.avgDamage });

    // Répartition des classements
    const buckets = { 'Top 1': 0, 'Top 5': 0, 'Top 10': 0, 'Top 25': 0, 'Reste': 0 };
    list.forEach((m) => {
      if (m.source === 'epic') {
        const t1 = Number(m.top1) || Number(m.wins) || 0;
        const t10 = Number(m.top10) || 0;
        const t25 = Number(m.top25) || 0;
        const mt = Number(m.matches) || 0;
        buckets['Top 1'] += t1;
        buckets['Top 10'] += Math.max(0, t10 - t1);
        buckets['Top 25'] += Math.max(0, t25 - t10);
        buckets['Reste'] += Math.max(0, mt - t25);
      } else {
        const p = Number(m.placement);
        if (p === 1) buckets['Top 1']++;
        else if (p <= 5) buckets['Top 5']++;
        else if (p <= 10) buckets['Top 10']++;
        else if (p <= 25) buckets['Top 25']++;
        else buckets['Reste']++;
      }
    });
    MiniChart.bar($('#chartPlacement'), {
      labels: Object.keys(buckets),
      values: Object.values(buckets),
    }, { color: '#00cec9' });

    // Kills moyens par mode
    const modes = {};
    list.forEach((m) => {
      const x = norm(m);
      modes[m.mode] = modes[m.mode] || { k: 0, n: 0 };
      modes[m.mode].k += x.kills;
      modes[m.mode].n += x.matches;
    });
    const modeLabels = Object.keys(modes);
    MiniChart.bar($('#chartMode'), {
      labels: modeLabels,
      values: modeLabels.map((k) => (modes[k].n ? round(modes[k].k / modes[k].n) : 0)),
    }, { color: '#ffd43b' });
  }

  /* ---------- Rendu : tableau des matchs ---------- */
  function renderTable() {
    const tbody = $('#matchTable tbody');
    const list = matches.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const nMatches = totalMatches(matches);
    $('#matchCount').textContent = `${nMatches} partie${nMatches > 1 ? 's' : ''}`;
    $('#emptyMatches').classList.toggle('hidden', matches.length > 0);
    $('#matchTable').classList.toggle('hidden', matches.length === 0);

    tbody.innerHTML = list
      .map((m) => {
        if (m.source === 'epic') {
          // Session synchronisée depuis Epic (plusieurs parties agrégées)
          return `<tr>
            <td>${m.date}</td>
            <td>🔄 Auto · Epic</td>
            <td>${m.kills}</td>
            <td>—</td>
            <td><span class="badge top">${m.matches} parties</span></td>
            <td>—</td>
            <td>${m.wins || 0} 🏆</td>
            <td>Synchro Epic (${round((Number(m.kills) || 0) / Math.max(1, Number(m.matches) || 1))} kills/partie)</td>
            <td><button class="del-btn" data-id="${m.id}" title="Supprimer">✕</button></td>
          </tr>`;
        }
        let badge = `<span class="badge loss">#${m.placement}</span>`;
        if (isWin(m)) badge = `<span class="badge win">👑 #1</span>`;
        else if (isTop(m)) badge = `<span class="badge top">#${m.placement}</span>`;
        return `<tr>
          <td>${m.date}</td>
          <td>${m.mode}</td>
          <td>${m.kills}</td>
          <td>${m.assists || 0}</td>
          <td>${badge}</td>
          <td>${m.damage || 0}</td>
          <td>${isWin(m) ? '🏆 Victoire' : 'Défaite'}</td>
          <td>${m.notes ? escapeHtml(m.notes) : '—'}</td>
          <td><button class="del-btn" data-id="${m.id}" title="Supprimer">✕</button></td>
        </tr>`;
      })
      .join('');

    $$('.del-btn', tbody).forEach((btn) =>
      btn.addEventListener('click', () => {
        matches = matches.filter((m) => m.id !== btn.dataset.id);
        save();
        renderAll();
      })
    );
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Coach : génération de conseils ---------- */
  function renderCoach() {
    const box = $('#coachContent');
    const list = matches.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const s = computeStats(list);
    if (!s || s.n < 3) {
      box.innerHTML = `<div class="insight warn">
        <h4>Enregistre au moins 3 parties</h4>
        <p>Synchronise tes parties depuis Epic (onglet <strong>Synchro</strong>) pour que ton coach puisse analyser ta progression et te donner des conseils personnalisés.</p>
      </div>`;
      return;
    }
    const insights = [];

    // 1. Niveau de kills
    if (s.avgKills < 1) {
      insights.push(['bad', '🎯 Priorité : les duels', `Tu fais ${s.avgKills} kill/match en moyenne. Ton objectif n°1 : gagner des duels. Entraîne-toi 10 min/jour en <strong>Créatif</strong> (maps d'aim/édit) et privilégie des atterrissages plus calmes pour survivre et progresser.`]);
    } else if (s.avgKills < 3) {
      insights.push(['warn', '🎯 Kills en progression', `${s.avgKills} kills/match, c'est correct ! Pour passer un cap, cherche 1-2 duels supplémentaires par partie en milieu de zone plutôt que de camper.`]);
    } else {
      insights.push(['good', '🔥 Bon fragger', `${s.avgKills} kills/match, excellent ! Tu gagnes tes duels. Concentre-toi maintenant sur la survie en fin de partie pour convertir en Top 1.`]);
    }

    // 2. Kills vs survie
    if (s.avgKills >= 2 && s.winRate < 5) {
      insights.push(['warn', '⚖️ Bon en combat, faible en placement', `Tu fais des kills (${s.avgKills}/match) mais peu de victoires (${s.winRate}%). Tu meurs probablement trop tôt. Travaille la <strong>rotation</strong> : anticipe la zone, garde des matériaux (500+ à la zone 4).`]);
    }

    // 3. Taux de victoire
    if (s.winRate >= 8) {
      insights.push(['good', '👑 Excellent taux de victoire', `${s.winRate}% de Victory Royale, c'est très bon (moyenne joueur ≈ 3-5%). Continue et vise l'Arena/compétitif si ce n'est pas déjà fait.`]);
    } else if (s.winRate < 2) {
      insights.push(['bad', '🛡️ Survivre plus longtemps', `${s.winRate}% de victoires. Objectif concret : atteindre le Top 10 plus souvent. Évite les early fights inutiles et joue les bords de zone.`]);
    }

    // 4. Dégâts
    if (s.avgDamage > 0) {
      if (s.avgDamage < 300) {
        insights.push(['warn', '💥 Augmente tes dégâts', `${s.avgDamage} dégâts/match. Vise 500+. Prends plus d'engagements quand tu as l'avantage (hauteur, munitions, angle).`]);
      } else if (s.avgDamage >= 600) {
        insights.push(['good', '💥 Grosse pression', `${s.avgDamage} dégâts/match, tu mets beaucoup de pression. Assure-toi de finir tes duels (précision + edits rapides).`]);
      }
    }

    // 5. Tendance récente (10 derniers vs précédents)
    if (list.length >= 8) {
      const recent = list.slice(-Math.ceil(list.length / 2));
      const older = list.slice(0, Math.floor(list.length / 2));
      const rAvg = computeStats(recent).avgKills;
      const oAvg = computeStats(older).avgKills;
      const diff = round(rAvg - oAvg);
      if (diff >= 0.5) {
        insights.push(['good', '📈 Tu progresses !', `Ta moyenne de kills est passée de ${oAvg} à ${rAvg} récemment (+${diff}). Continue exactement ce que tu fais.`]);
      } else if (diff <= -0.5) {
        insights.push(['warn', '📉 Petite baisse de forme', `Ta moyenne de kills est passée de ${oAvg} à ${rAvg} (${diff}). Fatigue ? Change de rythme, fais une pause ou un échauffement Créatif avant de jouer.`]);
      }
    }

    // 6. Meilleur mode
    const modes = {};
    list.forEach((m) => {
      modes[m.mode] = modes[m.mode] || { k: 0, n: 0, w: 0 };
      modes[m.mode].k += Number(m.kills) || 0;
      modes[m.mode].n += 1;
      if (isWin(m)) modes[m.mode].w += 1;
    });
    let best = null;
    Object.entries(modes).forEach(([mode, d]) => {
      if (d.n >= 2) {
        const avg = d.k / d.n;
        if (!best || avg > best.avg) best = { mode, avg: round(avg), n: d.n };
      }
    });
    if (best) {
      insights.push(['good', '🏅 Ton meilleur mode', `C'est en <strong>${best.mode}</strong> que tu performes le mieux (${best.avg} kills/match sur ${best.n} parties). Joue-le quand tu veux monter en confiance.`]);
    }

    // 7. Objectif du moment
    const target = round(s.avgKills + 1);
    insights.push(['', '🎯 Ton prochain objectif', `Passe de <strong>${s.avgKills}</strong> à <strong>${target} kills/match</strong> de moyenne, et atteins le Top 10 dans au moins 1 partie sur 5. Ajoute tes prochains matchs pour suivre ta progression !`]);

    box.innerHTML = insights
      .map(([cls, title, text]) => `<div class="insight ${cls}"><h4>${title}</h4><p>${text}</p></div>`)
      .join('');
  }

  /* ---------- Rendu : suivi hebdomadaire ---------- */
  function deltaHtml(cur, prev, opts = {}) {
    if (prev == null) return '<div class="delta flat">—</div>';
    const diff = round(cur - prev, opts.d != null ? opts.d : 2);
    if (diff === 0) return '<div class="delta flat">= vs semaine dern.</div>';
    const up = diff > 0;
    const arrow = up ? '▲' : '▼';
    const cls = up ? 'up' : 'down';
    const sign = up ? '+' : '';
    return `<div class="delta ${cls}">${arrow} ${sign}${diff}${opts.suffix || ''} vs sem. dern.</div>`;
  }

  function renderWeekly() {
    const hasData = matches.length > 0;
    $('#emptyWeekly').classList.toggle('hidden', hasData);
    $('#weekCards').classList.toggle('hidden', !hasData);

    const groups = groupByWeek();
    const curKey = currentWeekKey();

    // clés triées chronologiquement
    const keys = Object.keys(groups).sort();
    const curIdx = keys.indexOf(curKey);

    // Stats de la semaine courante et de la précédente enregistrée
    const curList = groups[curKey] || [];
    const cur = curList.length ? computeStats(curList) : null;

    // semaine précédente = dernière clé avant curKey qui existe
    let prev = null;
    const prevKeys = keys.filter((k) => k < curKey);
    if (prevKeys.length) prev = computeStats(groups[prevKeys[prevKeys.length - 1]]);

    // Libellé de la semaine
    const range = weekRange(new Date().toISOString().slice(0, 10));
    $('#weekLabel').textContent = `Semaine du ${fmtDay(range.monday)} au ${fmtDay(range.sunday)}`;

    // Cartes
    const c = cur || { n: 0, avgKills: 0, wins: 0, avgDamage: 0, winRate: 0 };
    $('#weekCards').innerHTML = [
      { label: 'Matchs joués', value: c.n, delta: deltaHtml(c.n, prev ? prev.n : null, { d: 0 }), cls: '' },
      { label: 'Kills / match', value: c.avgKills, delta: deltaHtml(c.avgKills, prev ? prev.avgKills : null), cls: 'accent' },
      { label: 'Victoires', value: c.wins, delta: deltaHtml(c.wins, prev ? prev.wins : null, { d: 0 }), cls: 'gold' },
      { label: 'Dégâts / match', value: c.avgDamage, delta: deltaHtml(c.avgDamage, prev ? prev.avgDamage : null, { d: 0 }), cls: '' },
    ]
      .map(
        (card) => `<div class="card ${card.cls}">
          <div class="label">${card.label}</div>
          <div class="value">${card.value}</div>
          ${card.delta}
        </div>`
      )
      .join('');

    renderGoals(cur);
    renderWeeklyChart(groups, keys);
    renderWeekTable(groups, keys);
  }

  function renderGoals(cur) {
    const box = $('#goalProgress');
    const defined = ['kills', 'matches', 'wins', 'damage'].some((k) => goals[k] != null && goals[k] !== '');
    if (!defined) {
      box.innerHTML = '<p class="muted" style="margin-top:14px">Aucun objectif défini. Renseigne au moins une cible ci-dessus.</p>';
      return;
    }
    const c = cur || { n: 0, avgKills: 0, wins: 0, avgDamage: 0 };
    const rows = [];
    const add = (goal, current, label, unit) => {
      if (goal == null || goal === '' || Number(goal) <= 0) return;
      const g = Number(goal);
      const pct = Math.min(100, round((current / g) * 100, 0));
      const done = current >= g;
      rows.push(`<div class="goal">
        <div class="goal-head">
          <span>${label}</span>
          <span class="${done ? 'done' : ''}">${round(current, unit === 'kills' ? 2 : 0)} / ${g}${done ? ' ✅' : ''}</span>
        </div>
        <div class="bar"><span class="${done ? 'full' : ''}" style="width:${pct}%"></span></div>
      </div>`);
    };
    add(goals.kills, c.avgKills, '🎯 Kills / match', 'kills');
    add(goals.matches, c.n, '🎮 Matchs joués', 'int');
    add(goals.wins, c.wins, '👑 Victoires', 'int');
    add(goals.damage, c.avgDamage, '💥 Dégâts / match', 'int');
    box.innerHTML = rows.join('') || '';
  }

  function renderWeeklyChart(groups, keys) {
    const last = keys.slice(-8);
    const labels = last.map((k) => 'S' + k.split('-W')[1]);
    const values = last.map((k) => computeStats(groups[k]).avgKills);
    MiniChart.bar($('#chartWeekly'), { labels, values }, { color: '#00cec9' });
  }

  function renderWeekTable(groups, keys) {
    const tbody = $('#weekTable tbody');
    const rows = keys
      .slice()
      .reverse()
      .map((k) => {
        const s = computeStats(groups[k]);
        const sample = groups[k][0];
        const range = weekRange(sample.date);
        return `<tr>
          <td>${fmtDay(range.monday)} – ${fmtDay(range.sunday)}</td>
          <td>${s.n}</td>
          <td>${s.avgKills}</td>
          <td>${s.wins}</td>
          <td>${s.avgDamage}</td>
        </tr>`;
      });
    tbody.innerHTML = rows.join('');
  }

  /* ---------- Rendu global ---------- */
  function renderDashboard() {
    const list = filtered();
    const hasData = matches.length > 0;
    $('#emptyDashboard').classList.toggle('hidden', hasData);
    $('#statCards').classList.toggle('hidden', !hasData);
    $('.chart-grid').classList.toggle('hidden', !hasData);
    if (!hasData) return;

    const s = computeStats(list) || computeStats(matches);
    renderCards(s);
    renderCharts(list, s);
  }

  function renderAll() {
    renderDashboard();
    renderTable();
    renderWeekly();
    renderCoach();
  }

  /* ---------- Navigation par onglets ---------- */
  function switchTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
    if (name === 'dashboard') renderDashboard();
    if (name === 'weekly') renderWeekly();
    if (name === 'coach') renderCoach();
    if (name === 'live' && !liveLoaded && global.LiveData) {
      liveLoaded = true;
      global.LiveData.refresh();
    }
  }
  let liveLoaded = false;
  const global = window;

  /* ---------- Événements ---------- */
  function bind() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.goto)));
    $('#filterMode').addEventListener('change', renderDashboard);
    $('#filterPeriod').addEventListener('change', renderDashboard);

    // Objectifs hebdomadaires
    ['goalKills', 'goalMatches', 'goalWins', 'goalDamage'].forEach((id) => {
      const key = id.replace('goal', '').toLowerCase();
      const input = $('#' + id);
      if (goals[key] != null) input.value = goals[key];
    });
    $('#saveGoals').addEventListener('click', () => {
      goals = {
        kills: valOrNull('#goalKills'),
        matches: valOrNull('#goalMatches'),
        wins: valOrNull('#goalWins'),
        damage: valOrNull('#goalDamage'),
      };
      saveGoals();
      renderWeekly();
      $('#saveGoals').textContent = '✅ Objectifs enregistrés';
      setTimeout(() => ($('#saveGoals').textContent = 'Enregistrer mes objectifs'), 1800);
    });

    // Formulaire d'ajout
    $('#matchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const match = {
        id: 'm_' + Date.now() + '_' + Math.round(Math.random() * 1e6),
        date: fd.get('date'),
        mode: fd.get('mode'),
        kills: Number(fd.get('kills')) || 0,
        assists: Number(fd.get('assists')) || 0,
        placement: Number(fd.get('placement')) || 100,
        lobbySize: Number(fd.get('lobbySize')) || 100,
        damage: Number(fd.get('damage')) || 0,
        accuracy: fd.get('accuracy') ? Number(fd.get('accuracy')) : null,
        notes: fd.get('notes') || '',
      };
      matches.push(match);
      save();
      e.target.reset();
      setDefaultDate();
      renderAll();
      switchTab('dashboard');
    });

    // Export
    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(matches, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fortnite-stats.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data)) throw new Error('Format invalide');
          matches = data;
          save();
          renderAll();
          alert('Import réussi : ' + data.length + ' matchs.');
        } catch (err) {
          alert('Fichier invalide : ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Reset
    $('#resetBtn').addEventListener('click', () => {
      if (confirm('Supprimer TOUS tes matchs ? Cette action est irréversible.')) {
        matches = [];
        save();
        renderAll();
      }
    });

    // Synchronisation automatique
    if ($('#syncBtn')) $('#syncBtn').addEventListener('click', doSync);

    // Afficher / masquer la clé API
    if ($('#toggleKey')) {
      $('#toggleKey').addEventListener('change', (e) => {
        $('#apiKey').type = e.target.checked ? 'text' : 'password';
      });
    }
    // Copier la clé API
    if ($('#copyKey')) {
      $('#copyKey').addEventListener('click', async () => {
        const val = ($('#apiKey').value || '').trim();
        const btn = $('#copyKey');
        if (!val) { btn.textContent = 'Aucune clé'; setTimeout(() => (btn.textContent = '📋 Copier'), 1500); return; }
        try {
          await navigator.clipboard.writeText(val);
          btn.textContent = '✅ Copiée';
        } catch (err) {
          // Repli si le presse-papiers est indisponible : sélectionne le texte
          $('#apiKey').type = 'text';
          $('#apiKey').select();
          if ($('#toggleKey')) $('#toggleKey').checked = true;
          btn.textContent = 'Sélectionnée';
        }
        setTimeout(() => (btn.textContent = '📋 Copier'), 1500);
      });
    }

    // Pré-remplit la clé API et le pseudo mémorisés (partagés avec "En direct" et "Synchro")
    const storedKey = localStorage.getItem('fortnite-tracker-apikey');
    if (storedKey && $('#apiKey')) $('#apiKey').value = storedKey;
    const storedEpic = getEpicConfig();
    if (storedEpic.name && $('#apiName')) $('#apiName').value = storedEpic.name;
    if (storedEpic.platform && $('#apiPlatform')) $('#apiPlatform').value = storedEpic.platform;

    // API Fortnite
    $('#apiForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const result = $('#apiResult');
      const apiKey = $('#apiKey').value.trim();
      const apiName = $('#apiName').value.trim();
      const apiPlatform = $('#apiPlatform').value;
      // Mémorise la clé et le pseudo pour "En direct" et "Synchro"
      if (apiKey) localStorage.setItem('fortnite-tracker-apikey', apiKey);
      if (apiName) localStorage.setItem('fortnite-tracker-epic', JSON.stringify({ name: apiName, platform: apiPlatform }));
      result.innerHTML = '<p class="muted">Chargement…</p>';
      try {
        const stats = await FortniteAPI.fetchStats({
          apiKey: apiKey,
          name: apiName,
          platform: apiPlatform,
        });
        result.innerHTML = `
          <h3>Stats de ${escapeHtml(stats.name)}</h3>
          <div>
            <span class="api-stat">Matchs : <b>${stats.matches}</b></span>
            <span class="api-stat">Victoires : <b>${stats.top1}</b></span>
            <span class="api-stat">Taux de victoire : <b>${round(stats.winRate, 1)}%</b></span>
            <span class="api-stat">Kills : <b>${stats.kills}</b></span>
            <span class="api-stat">K/D : <b>${round(stats.kd, 2)}</b></span>
            <span class="api-stat">Kills/match : <b>${round(stats.killsPerMatch, 2)}</b></span>
            <span class="api-stat">Temps de jeu : <b>${Math.round(stats.minutesPlayed / 60)}h</b></span>
          </div>
          <p class="muted" style="margin-top:12px">Ce sont tes stats Epic cumulées. Continue d'ajouter tes matchs manuellement pour suivre ta progression au jour le jour et obtenir des conseils.</p>`;
      } catch (err) {
        result.innerHTML = `<div class="insight bad"><h4>Erreur</h4><p>${escapeHtml(err.message)}</p></div>`;
      }
    });
  }

  /* ---------- Synchronisation automatique depuis Epic ---------- */
  async function doSync() {
    const status = $('#syncStatus');
    const cfg = getEpicConfig();
    if (!cfg.key || !cfg.name) {
      $('#syncNeedsConfig').classList.remove('hidden');
      status.innerHTML = '';
      return;
    }
    $('#syncNeedsConfig').classList.add('hidden');
    const btn = $('#syncBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Synchronisation…';
    status.innerHTML = '<p class="muted">Récupération de tes stats Epic…</p>';
    try {
      const stats = await FortniteAPI.fetchStats({ apiKey: cfg.key, name: cfg.name, platform: cfg.platform });
      const snap = {
        matches: stats.matches || 0,
        kills: stats.kills || 0,
        wins: stats.top1 || stats.wins || 0,
        top1: stats.top1 || stats.wins || 0,
        top10: stats.top10 || 0,
        top25: stats.top25 || 0,
      };
      const base = getBaseline();
      if (!base) {
        setBaseline(snap);
        status.innerHTML = `<div class="insight good"><h4>✅ Point de départ enregistré</h4>
          <p>Compteur actuel : <strong>${snap.matches}</strong> parties au total sur ton compte. Joue quelques parties Fortnite, puis reviens cliquer sur « Synchroniser » : tes nouvelles parties s'ajouteront automatiquement.</p></div>`;
      } else {
        const dM = snap.matches - base.matches;
        const dK = Math.max(0, snap.kills - base.kills);
        const dW = Math.max(0, snap.wins - base.wins);
        const d10 = Math.max(0, (snap.top10 || 0) - (base.top10 || 0));
        const d25 = Math.max(0, (snap.top25 || 0) - (base.top25 || 0));
        if (dM <= 0) {
          setBaseline(snap);
          status.innerHTML = `<div class="insight warn"><h4>Aucune nouvelle partie</h4>
            <p>Aucune partie détectée depuis la dernière synchro. Rejoue puis resynchronise !</p></div>`;
        } else {
          matches.push({
            id: 'e_' + Date.now() + '_' + Math.round(Math.random() * 1e6),
            date: new Date().toISOString().slice(0, 10),
            mode: 'Auto (Epic)',
            source: 'epic',
            matches: dM,
            kills: dK,
            wins: dW,
            top1: dW,
            top10: d10,
            top25: d25,
          });
          save();
          setBaseline(snap);
          renderAll();
          status.innerHTML = `<div class="insight good"><h4>✅ ${dM} nouvelle(s) partie(s) ajoutée(s) !</h4>
            <p>${dK} kills, ${dW} victoire(s) — soit ${round(dK / dM)} kills/partie. Va voir ton tableau de bord et ton coach 💪</p></div>`;
        }
      }
    } catch (err) {
      status.innerHTML = `<div class="insight bad"><h4>Erreur</h4><p>${escapeHtml(err.message)}</p></div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Synchroniser depuis Epic';
    }
  }

  function valOrNull(sel) {
    const v = $(sel).value.trim();
    return v === '' ? null : Number(v);
  }

  function setDefaultDate() {
    const input = $('#matchForm input[name="date"]');
    if (input && !input.value) input.value = new Date().toISOString().slice(0, 10);
  }

  /* ---------- Init ---------- */
  bind();
  setDefaultDate();
  renderAll();
})();
