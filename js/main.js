/* Boot: load or create state, launch screen, offline progress, start the loop. */
(function (TE) {
  'use strict';
  const U = TE.U, UI = TE.UI;

  function bootLines(el, lines, done) {
    let i = 0;
    const next = () => {
      if (i >= lines.length) { done && done(); return; }
      const row = document.createElement('div');
      row.className = 'boot-line';
      row.innerHTML = '<span class="dim">' + new Date().toLocaleTimeString() + '</span> ' + lines[i] + ' <span class="ok">OK</span>';
      el.appendChild(row);
      i++;
      setTimeout(next, 70 + Math.random() * 90);
    };
    next();
  }

  function welcomeBack(res) {
    if (!res || res.cash <= 0 && res.rp <= 0) return;
    const capped = res.away > res.counted + 1;
    UI.modal({
      title: '<span class="up">BON RETOUR</span>', cls: 'modal-sm modal-welcome',
      body: '<div class="wb"><div class="dim">Absence</div><div class="wb-time">' + U.dur(res.away) + '</div>' +
        '<div class="dim">Votre empire a généré</div><div class="wb-cash">+' + U.money(res.cash) + '</div>' +
        (res.rp > 1 ? '<div class="wb-rp">+' + U.fmt(res.rp, { dec: 0 }) + ' RP</div>' : '') +
        '<div class="wb-note dim">Efficacité hors ligne : ' + U.pct(res.eff, 0, false) + (capped ? ' · plafonnée à ' + U.dur(res.counted) + ' (à étendre via la recherche et les avantages)' : '') + '. Les marchés étaient en pause pendant votre absence.</div></div>',
      buttons: [{ label: 'Retour au desk', cls: 'btn-primary' }],
    });
    TE.Audio.play('milestone');
  }

  function start(isNew, offlineRes) {
    TE.Audio.init();
    TE.Audio.resume();
    document.getElementById('boot').classList.add('out');
    setTimeout(() => { document.getElementById('boot').remove(); }, 600);
    document.getElementById('app').hidden = false;
    UI.init();
    TE.Loop.start();
    if (isNew) {
      setTimeout(() => UI.toast({ title: 'VOS PREMIERS 100 $', text: 'NOVA est en tendance. Ouvrez un LONG, suivez le mouvement, clôturez en profit. Tout le reste viendra ensuite.', kind: 'info', icon: '◢', dur: 7000 }), 900);
    } else if (offlineRes) welcomeBack(offlineRes);
  }

  function boot() {
    TE.Mods.init();
    let loaded = null;
    try { loaded = TE.Save.load(); } catch (e) { console.error(e); }
    const isNew = !loaded;
    TE.state = loaded || TE.State.create();
    U.notation = TE.state.settings.notation || 'standard';
    TE.Mods.rebuild();
    TE.Market.init();
    TE.Empire.initRivals();
    TE.Events.init();
    if (TE.World) TE.World.init();
    if (isNew) TE.Market.scriptStart('NOVA');
    if (TE.Mods.dirty) TE.Mods.rebuild();
    // boot screen
    const lines = document.getElementById('boot-lines');
    const btn = document.getElementById('boot-enter');
    const sub = document.getElementById('boot-sub');
    if (!isNew) {
      const era = TE.Data.ERAS[TE.state.run.era - 1];
      sub.innerHTML = 'Bon retour. Valeur nette <b>' + U.money(TE.Economy.netWorth()) + '</b> · Ère ' + era.roman + ' — ' + era.name;
      btn.textContent = '[ REPRENDRE LE TRADING ]';
    }
    bootLines(lines, ['Connexion à la bourse simulée', 'Chargement de ' + TE.Data.ASSETS.length + ' marchés fictifs', 'Calibrage des régimes de volatilité', 'Démarrage du moteur d’appariement', 'Préchauffage de la machine à café'], () => {
      btn.disabled = false;
      btn.classList.add('ready');
      btn.focus();
    });
    let started = false;
    const go = () => {
      if (started || btn.disabled) return;
      started = true;
      document.removeEventListener('keydown', onKey);
      const launch = () => {
        const res = isNew ? null : TE.Offline.onBoot();
        start(isNew, res);
      };
      // 2.1: with cloud sync enabled, local and cloud saves are compared before the game starts (never merged)
      if (TE.Cloud && TE.Cloud.gate) TE.Cloud.gate(launch);
      else launch();
    };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    btn.addEventListener('click', go);
    document.addEventListener('keydown', onKey);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // console helper
  window.addEventListener('error', (e) => { console.error('[TE] runtime error', e.message); });
})(window.TE);
