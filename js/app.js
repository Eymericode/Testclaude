/* Fortnite Stats Tracker — logique principale. */
(function () {
  'use strict';

  const STORAGE_KEY = 'fortnite-tracker-matches';
  let matches = load();

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

  /* ---------- Calcul des statistiques ---------- */
  function computeStats(list) {
    const n = list.length;
    if (!n) return null;
    const sum = (f) => list.reduce((a, m) => a + (Number(m[f]) || 0), 0);
    const kills = sum('kills');
    const assists = sum('assists');
    const damage = sum('damage');
    const wins = list.filter(isWin).length;
    const tops = list.filter(isTop).length;
    // K/D en battle royale : morts ≈ matchs non gagnés
    const deaths = n - wins;
    return {
      n,
      kills,
      avgKills: round(kills / n),
      assists,
      avgAssists: round(assists / n),
      damage,
      avgDamage: round(damage / n),
      wins,
      winRate: round((wins / n) * 100, 1),
      tops,
      topRate: round((tops / n) * 100, 1),
      kd: round(kills / Math.max(1, deaths)),
      bestKills: Math.max(...list.map((m) => Number(m.kills) || 0)),
      bestPlacement: Math.min(...list.map((m) => Number(m.placement) || 999)),
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
    // Kills par match
    MiniChart.line($('#chartKills'), {
      labels: list.map((_, i) => i + 1),
      values: list.map((m) => Number(m.kills) || 0),
    }, { average: s.avgKills });

    // Dégâts par match
    MiniChart.line($('#chartDamage'), {
      labels: list.map((_, i) => i + 1),
      values: list.map((m) => Number(m.damage) || 0),
    }, { color: '#6c5ce7', average: s.avgDamage });

    // Répartition des classements
    const buckets = { 'Top 1': 0, 'Top 5': 0, 'Top 10': 0, 'Top 25': 0, 'Reste': 0 };
    list.forEach((m) => {
      const p = Number(m.placement);
      if (p === 1) buckets['Top 1']++;
      else if (p <= 5) buckets['Top 5']++;
      else if (p <= 10) buckets['Top 10']++;
      else if (p <= 25) buckets['Top 25']++;
      else buckets['Reste']++;
    });
    MiniChart.bar($('#chartPlacement'), {
      labels: Object.keys(buckets),
      values: Object.values(buckets),
    }, { color: '#00cec9' });

    // Kills moyens par mode
    const modes = {};
    list.forEach((m) => {
      modes[m.mode] = modes[m.mode] || { k: 0, n: 0 };
      modes[m.mode].k += Number(m.kills) || 0;
      modes[m.mode].n += 1;
    });
    const modeLabels = Object.keys(modes);
    MiniChart.bar($('#chartMode'), {
      labels: modeLabels,
      values: modeLabels.map((k) => round(modes[k].k / modes[k].n)),
    }, { color: '#ffd43b' });
  }

  /* ---------- Rendu : tableau des matchs ---------- */
  function renderTable() {
    const tbody = $('#matchTable tbody');
    const list = matches.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    $('#matchCount').textContent = `${matches.length} match${matches.length > 1 ? 's' : ''}`;
    $('#emptyMatches').classList.toggle('hidden', matches.length > 0);
    $('#matchTable').classList.toggle('hidden', matches.length === 0);

    tbody.innerHTML = list
      .map((m) => {
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
    if (list.length < 3) {
      box.innerHTML = `<div class="insight warn">
        <h4>Enregistre au moins 3 matchs</h4>
        <p>Ajoute quelques matchs pour que ton coach puisse analyser ta progression et te donner des conseils personnalisés.</p>
      </div>`;
      return;
    }

    const s = computeStats(list);
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
    renderCoach();
  }

  /* ---------- Navigation par onglets ---------- */
  function switchTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === name));
    if (name === 'dashboard') renderDashboard();
    if (name === 'coach') renderCoach();
  }

  /* ---------- Événements ---------- */
  function bind() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.goto)));
    $('#filterMode').addEventListener('change', renderDashboard);
    $('#filterPeriod').addEventListener('change', renderDashboard);

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

    // API Fortnite
    $('#apiForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const result = $('#apiResult');
      result.innerHTML = '<p class="muted">Chargement…</p>';
      try {
        const stats = await FortniteAPI.fetchStats({
          apiKey: $('#apiKey').value.trim(),
          name: $('#apiName').value.trim(),
          platform: $('#apiPlatform').value,
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

  function setDefaultDate() {
    const input = $('#matchForm input[name="date"]');
    if (input && !input.value) input.value = new Date().toISOString().slice(0, 10);
  }

  /* ---------- Init ---------- */
  bind();
  setDefaultDate();
  renderAll();
})();
