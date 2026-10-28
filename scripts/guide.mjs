/**
 * Qawasha e Kupalué - modulo di esplorazione per Tomb of Annihilation.
 * Logica derivata dalla macro v8; le flag degli inventari e del Party rimangono compatibili.
 * Vedere README.md prima di attivare nel mondo di produzione.
 */
export async function activateGuide() {
  const MOD = "dnd-tomb-annihilation";
  const WORLD = "world";
  const STORE = "__toaQawashaCompleteV1";
  const OLD_STORE = "__toaQawashaNavigationBonusV1";
  const BACKUP_KEY = "toaQawashaPartyMembersBackupV1";
  const GUIDE_KEY = "toaQawashaGuidesActiveV1";
  const BONUS = 2;
  const UI_VERSION = 8; // compatibilità stato macro v8
  const TEST_BACKUP_KEY = "toaQawashaInventoryTestBackupV1";
  const FORAGE_DAY_KEY = "toaQawashaLastForageDayV1";
  const RESOURCE_FLAG = "toaQawashaForageResourceV1";
  const RAIN_DAY_KEY = "toaQawashaRainCatchDayV1";
  const PARTY_ID = "toaParty00000000";

  if (!game.user?.isGM) return;
  if (game.system?.id !== "dnd5e" || !game.modules.get(MOD)?.active) {
    ui.notifications.error("Qawasha: servono il sistema dnd5e e il modulo Tomb of Annihilation attivo.");
    return;
  }
  if (game.modules.get(MOD)?.version !== "1.2.1") {
    ui.notifications.warn("Qawasha: modulo ToA diverso da 1.2.1; controllare l'integrazione dopo aggiornamenti.");
  }

  const getTracker = () => [...(foundry.applications.instances?.values() ?? [])]
    .find(a => a?.constructor?.name === "TravelTracker");
  const tracker = getTracker();
  const party = tracker?.party ?? game.actors.get(PARTY_ID);
  if (!party || party.type !== "group") {
    ui.notifications.error("Qawasha: attore Party non trovato. Nessuna modifica eseguita.");
    return;
  }

  // Fase 1: ripulisci SOLO i riferimenti ad attori World inesistenti.
  // Usa il documento serializzato (non system.members, gia' filtrato in prepareBaseData).
  const raw = party.toObject()?.system?.members;
  let removed = [];
  if (!Array.isArray(raw)) {
    ui.notifications.error("Qawasha: formato dei membri Party inatteso; non modifico il gruppo.");
    return;
  }
  const valid = raw.filter(m => {
    const id = typeof m === "string" ? m : m?.actor;
    if (typeof id !== "string" || !id || game.actors.get(id)) return true;
    removed.push(id);
    return false;
  });
  if (removed.length) {
    // Un unico update: prima registra la fotografia originale, poi pulisce il gruppo.
    const updates = { "system.members": valid };
    if (!party.getFlag(WORLD, BACKUP_KEY)) {
      updates[`flags.${WORLD}.${BACKUP_KEY}`] = {
        timestamp: new Date().toISOString(),
        originalMembers: foundry.utils.deepClone(raw),
        firstRemoved: [...removed]
      };
    }
    try {
      await party.update(updates);
      ui.notifications.info(`Party ripulito: ${removed.length} riferimento/i inesistente/i. Backup salvato sul Party.`);
      console.info("[Qawasha] Riferimenti Party eliminati:", removed);
    } catch (err) {
      console.error("[Qawasha] Pulizia Party fallita", err);
      ui.notifications.error("Impossibile ripulire Party. Non attivo l'integrazione; controlla F12.");
      return;
    }
  }

  // Rimuove soltanto i listener diagnostici temporanei creati nei test precedenti.
  const oldDebug = globalThis.__toaMoveDebug;
  if (oldDebug?.pre && oldDebug?.post) {
    Hooks.off("preUpdateToken", oldDebug.pre);
    Hooks.off("updateToken", oldDebug.post);
    delete globalThis.__toaMoveDebug;
    console.info("[Qawasha] Monitor temporaneo movimento disattivato.");
  }

  // Fase 2: evita doppio +2 se era rimasta attiva la vecchia macro.
  const old = globalThis[OLD_STORE];
  if (old?.id !== undefined) {
    Hooks.off("dnd5e.preRollSkill", old.id);
    delete globalThis[OLD_STORE];
    console.info("[Qawasha] Listener della macro precedente disattivato.");
  }
  // L'upgrade v1 -> v2 rimuove i vecchi hook dalla sessione corrente,
  // evitando duplicazioni del +2 e del pannello. Non cambia i dati del Party.
  // La v2 impostava setPosition soltanto alla prima esecuzione: il modulo poteva
  // rifare automaticamente il fit della finestra, riportandola alta e stretta.
  // Ora ripristiniamo il layout del FRAME ApplicationV2 dopo OGNI render.
  function resizeTracker(app) {
    if (!app || app.constructor?.name !== "TravelTracker" || typeof window === "undefined") return;
    const root = app.element;
    if (!root?.style || typeof app.setPosition !== "function") return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const desiredWidth = Math.max(280, Math.min(720, vw - 64));
    const desiredHeight = Math.max(260, Math.min(790, vh - 90));
    const pos = app.position ?? {};
    const newLeft = Number.isFinite(pos.left)
      ? Math.max(16, Math.min(pos.left, vw - desiredWidth - 16))
      : Math.max(16, Math.floor((vw - desiredWidth) / 2));
    const newTop = Number.isFinite(pos.top)
      ? Math.max(16, Math.min(pos.top, vh - desiredHeight - 16))
      : 32;

    try {
      if (pos.width !== desiredWidth || pos.height !== desiredHeight ||
          pos.left !== newLeft || pos.top !== newTop) {
        app.setPosition({ width: desiredWidth, height: desiredHeight,
                          left: newLeft, top: newTop });
      }
    } catch (err) {
      console.warn("[Qawasha] setPosition non disponibile:", err);
    }

    // Le dimensioni inline del frame hanno priorita' sulle CSS del modulo.
    // Non tocchiamo il modulo né il sistema di navigazione.
    const set = (el, key, val) => el?.style?.setProperty?.(key, val, "important");
    set(root, "box-sizing", "border-box");
    set(root, "width", `${desiredWidth}px`);
    set(root, "min-width", `${desiredWidth}px`);
    set(root, "max-width", `${desiredWidth}px`);
    set(root, "height", `${desiredHeight}px`);
    set(root, "max-height", `${desiredHeight}px`);
    set(root, "min-height", "0");
    set(root, "overflow", "hidden");
    const content = app.window?.content ?? root.querySelector?.(".window-content");
    set(content, "box-sizing", "border-box");
    set(content, "min-width", "0");
    set(content, "max-width", "100%");
    set(content, "overflow-x", "hidden");
    set(content, "overflow-y", "auto");
    const form = content?.querySelector?.("form") ?? root.querySelector?.("form");
    set(form, "box-sizing", "border-box");
    set(form, "min-width", "0");
    set(form, "max-width", "100%");
    console.debug("[Qawasha] Tracker layout v3:", desiredWidth, "x", desiredHeight);
  }

  function scheduleResize(app) {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resizeTracker(app));
    } else {
      resizeTracker(app);
    }
  }

  const already = globalThis[STORE];
  if (already?.version === UI_VERSION && already?.hookIds?.length) {
    const app = getTracker();
    if (app) { await app.render(); scheduleResize(app); }
    ui.notifications.info("Qawasha e Kupalué: pannello e bonus gia' attivi.");
    return;
  }
  if (already?.hookIds?.length) {
    for (const entry of already.hookIds) {
      if (Array.isArray(entry) && entry.length === 2) Hooks.off(entry[0], entry[1]);
    }
    getTracker()?.element?.querySelector?.("[data-qawasha-extras]")?.remove();
    delete globalThis[STORE];
    console.info("[Qawasha] Versione precedente disattivata; aggiornamento v8.");
  }

  // Guide attive per impostazione iniziale; stato persistente sul Party.
  const isGuideActive = () => party.getFlag(WORLD, GUIDE_KEY) !== false;
  const getPace = () => party.getFlag(MOD, "travelPace") ?? "normal";
  const getMembers = () => (party.system?.members ?? [])
    .map(m => m?.actor)
    .filter(a => a?.type === "character" && game.actors.get(a.id));
  const getNavigator = () => game.actors.get(party.getFlag(MOD, "navigator"));
  const navFlavor = () => game.i18n.localize("ToA.Tracker.NavigationCheck");
  const paceName = p => ({slow: "Lenta", normal: "Normale", fast: "Veloce"}[p] ?? p);
  const passiveOf = a => {
    const skill = a.system?.skills?.prc;
    const fromSystem = Number(skill?.passive);
    if (Number.isFinite(fromSystem) && skill?.passive != null) return fromSystem;
    const total = Number(skill?.total);
    if (Number.isFinite(total) && skill?.total != null) return 10 + total;
    return null;
  };
  const passiveInfo = () => {
    const all = getMembers().map(a => ({ actor: a, score: passiveOf(a) }))
      .filter(x => x.score !== null)
      .sort((a, b) => b.score - a.score);
    if (!all.length) return null;
    const paceDelta = getPace() === "slow" ? 5 : getPace() === "fast" ? -5 : 0;
    return {
      name: all[0].actor.name,
      base: all[0].score,
      guides: isGuideActive() ? BONUS : 0,
      pace: paceDelta,
      total: all[0].score + (isGuideActive() ? BONUS : 0) + paceDelta
    };
  };

  // Navigazione: riutilizza il preRollSkill GIA' TESTATO nel mondo.
  // Non modifica la callback del Tracker e NON interferisce con i suoi spostamenti.
  const idNav = Hooks.on("dnd5e.preRollSkill", (config, dialog, message) => {
    if (!isGuideActive() || config?.skill !== "sur") return;
    if (foundry.utils.getProperty(message, "data.flavor") !== navFlavor()) return;
    if (!getTracker() || !getNavigator()) return;
    const pace = getPace();
    const normalPacePart = pace === "slow" ? "5" : pace === "fast" ? "-5" : "0";
    if (!Array.isArray(config.rolls) || config.rolls.length !== 1) return;
    const parts = config.rolls[0]?.parts;
    if (!Array.isArray(parts)) return;
    if (!parts.some(p => String(p).trim() === normalPacePart)) return;
    if (parts.some(p => String(p).trim() === String(BONUS))) return;
    parts.push(String(BONUS));
    console.info("[Qawasha] +2 navigazione applicato al Tracker.");
  });

  // Ricerca risorse: il Tracker 1.2.1 non ha un tiro nativo di foraggiamento.
  // In caso di successo, il DMG 2024 prevede due tiri INDIPENDENTI:
  // 1d6 + Saggezza in libbre di cibo e 1d6 + Saggezza in galloni d'acqua.
  // L'acqua naturale del Chult non viene etichettata come potabile prima della bollitura.
  // Gli oggetti sono due pile di tipo loot, identificate da flags della macro;
  // non vengono trasformati in Razioni o acqua bevibile in modo scorretto.
  const resourceDefinitions = {
    food: {
      name: "Cibo raccolto (1 libbra)",
      description: "Ogni unita' rappresenta 1 libbra di cibo trovato nella giungla. Non e' una razione conservata: la durata dipende dal tipo di alimento e dalle condizioni.",
      weight: 1
    },
    water: {
      name: "Acqua raccolta (1 gallone, da bollire)",
      description: "Ogni unita' rappresenta 1 gallone d'acqua trovata nella giungla del Chult. L'acqua naturale deve essere bollita o purificata prima di berla. Richiede contenitori sufficienti.",
      weight: 8.34
    }
  };
  // L'acqua potabile viene registrata in mezzi galloni (quantita' intere):
  // Foundry non deve supportare numeri decimali per la quantita' degli oggetti.
  resourceDefinitions.potable = {
    name: "Acqua potabile (0,5 galloni)",
    description: "Ogni unita' equivale a mezzo gallone (come un otre). Ottenuta da pioggia raccolta o da acqua purificata. Prevede contenitori adatti.",
    weight: 4.17
  };
  // Icone WebP incluse nel modulo; percorsi serviti da Foundry.
  // Oggetti delle macro precedenti vengono aggiornati senza alterare le quantità.
  const resourceIcons = {
    food: "modules/qawasha-kupalue-exploration/assets/icona_cibo_raccolto.webp",
    water: "modules/qawasha-kupalue-exploration/assets/icona_acqua_da_purificare.webp",
    potable: "modules/qawasha-kupalue-exploration/assets/icona_acqua_potabile.webp",
  };
  // Aggiorna SOLO gli oggetti marcati dalla macro (anche se già presenti).
  // Non modifica quantità, nome, descrizione, altri oggetti o token.
  async function refreshExistingResourceIcons() {
    let updated = 0;
    const characters = (party.system?.members ?? [])
      .map(m => m?.actor)
      .filter(a => a?.type === "character" && game.actors.get(a.id));
    for (const actor of characters) {
      const pending = [];
      for (const item of (actor.items?.contents ?? [])) {
        if (item.type !== "loot") continue;
        const kind = item.getFlag?.(WORLD, RESOURCE_FLAG);
        if (!(kind in resourceIcons)) continue;
        if (item.img === resourceIcons[kind]) continue;
        pending.push({ _id: item.id, img: resourceIcons[kind] });
      }
      if (pending.length) {
        await actor.updateEmbeddedDocuments("Item", pending);
        updated += pending.length;
      }
    }
    return updated;
  }
  const itemsOf = actor => Array.isArray(actor?.items?.contents) ? actor.items.contents
    : Array.isArray(actor?.items) ? actor.items : [];
  const ownedCatchers = () => {
    const holders = [...getMembers(), party];
    const matches = [];
    for (const holder of holders) {
      for (const item of itemsOf(holder)) {
        const label = String(item.name ?? "").toLocaleLowerCase("it");
        const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const recognized = /rain\s*-?\s*catcher|raccoglit.*piogg|raccogli.*piogg|collettor.*piogg/.test(normalized);
        if (!recognized) continue;
        const amount = Number(item.system?.quantity ?? 1);
        if (amount > 0 && Number.isFinite(amount)) matches.push({
          holder: holder.name, item: item.name, count: Math.floor(amount)
        });
      }
    }
    return { amount: matches.reduce((sum, m) => sum + m.count, 0), matches };
  };
  const getWeather = () => String(game.settings.get(MOD, "weather") ?? "");
  // Assunzioni HOMEBREW (pollici di pioggia caduti MENTRE i raccoglitori sono montati).
  // Il manuale definisce 2 galloni/pollice e capienza 8 galloni, NON i pollici per meteo.
  const defaultRainInches = weather => {
    const w = String(weather).toLowerCase().replace(/[\s_\-]/g, "");
    if (/storm|tempesta|tropical/.test(w)) return 2;
    if (/heavy|strong|intense|torrential|forte/.test(w)) return 1;
    if (/medium|moderate|moderata/.test(w)) return 0.5;
    if (/light|drizzle|leggera/.test(w)) return 0.25;
    if (/rain|piogg/.test(w)) return 0.5;
    return 0;
  };
  const getResource = (actor, kind) => itemsOf(actor).find(item =>
    item.getFlag?.(WORLD, RESOURCE_FLAG) === kind && item.type === "loot"
  );
  async function addPotable(actor, halfGallons) {
    if (!Number.isInteger(halfGallons) || halfGallons <= 0) return;
    const def = resourceDefinitions.potable;
    const existing = getResource(actor, "potable");
    if (existing) {
      const prev = Number(existing.system.quantity ?? 0);
      await actor.updateEmbeddedDocuments("Item", [{
        _id: existing.id,
        "system.quantity": (Number.isFinite(prev) ? prev : 0) + halfGallons,
        img: resourceIcons.potable
      }]);
    } else {
      await actor.createEmbeddedDocuments("Item", [{
        name: def.name, type: "loot", img: resourceIcons.potable,
        system: { quantity: halfGallons,
          weight: { value: def.weight, units: "lb" },
          description: { value: `<p>${def.description}</p>` } },
        flags: { [WORLD]: { [RESOURCE_FLAG]: "potable" } }
      }]);
    }
  }
  // Il TEST REALE resta recuperabile dopo F5: fotografia delle risorse nel Party.
  // Solo gli oggetti loot marcati dalla macro possono essere ripristinati/eliminati.
  // I tentativi giornalieri REALI esistenti NON sono modificati dal test.
  let testMode = !!party.getFlag(WORLD, TEST_BACKUP_KEY);
  let testBusy = false;

  function snapshotTestResources() {
    return {
      at: new Date().toISOString(),
      day: Number(game.settings.get(MOD, "day")),
      actors: getMembers().map(actor => ({
        id: actor.id, name: actor.name,
        resources: itemsOf(actor).filter(item => item.type === "loot" &&
          Object.hasOwn(resourceIcons, item.getFlag?.(WORLD, RESOURCE_FLAG))
        ).map(item => ({
          id: item.id,
          kind: item.getFlag(WORLD, RESOURCE_FLAG),
          quantity: Number(item.system?.quantity ?? 0)
        }))
      }))
    };
  }

  async function startInventoryTest() {
    if (testBusy || rolling || rainBusy || boilBusy) {
      ui.notifications.warn("Attendi il completamento dell'operazione in corso."); return;
    }
    testBusy = true;
    try {
      if (!party.getFlag(WORLD, TEST_BACKUP_KEY)) {
        // Scrive il backup PRIMA di qualunque accredito di prova.
        await party.setFlag(WORLD, TEST_BACKUP_KEY, snapshotTestResources());
      }
      testMode = true;
      ui.notifications.warn("TEST REALE: gli inventari cambieranno davvero. Alla fine premi RIPRISTINA.");
      await getTracker()?.render();
    } catch (err) {
      console.error("[Qawasha] Impossibile avviare test reale", err);
      ui.notifications.error("Backup inventario fallito: nessun test attivato.");
    } finally { testBusy = false; }
  }

  async function restoreInventoryTest() {
    if (testBusy || rolling || rainBusy || boilBusy) {
      ui.notifications.warn("Attendi il completamento dei tiri o delle operazioni in corso."); return;
    }
    const backup = party.getFlag(WORLD, TEST_BACKUP_KEY);
    if (!backup?.actors) {
      ui.notifications.warn("Nessun backup del test da ripristinare."); return;
    }
    testBusy = true;
    try {
      // Validazione completa prima di cancellare o modificare oggetti.
      const plans = [];
      for (const snap of backup.actors) {
        const actor = game.actors.get(snap.id);
        if (!actor) throw new Error(`Personaggio non trovato durante il ripristino: ${snap.name} (${snap.id})`);
        const originals = new Map(snap.resources.map(r => [r.id, r]));
        for (const old of snap.resources) {
          if (!itemsOf(actor).some(i => i.id === old.id &&
                i.type === "loot" && i.getFlag?.(WORLD, RESOURCE_FLAG) === old.kind)) {
            throw new Error(`Risorsa originale non più presente per ${actor.name}: ${old.kind} (${old.id}). Backup conservato.`);
          }
        }
        const added = itemsOf(actor).filter(i => i.type === "loot" &&
          Object.hasOwn(resourceIcons, i.getFlag?.(WORLD, RESOURCE_FLAG)) &&
          !originals.has(i.id));
        plans.push({actor, addedIds: added.map(i => i.id), originals: snap.resources});
      }
      // Ripristina solo le pile marcate dalla macro, mai il resto dell'inventario.
      for (const plan of plans) {
        if (plan.addedIds.length) {
          await plan.actor.deleteEmbeddedDocuments("Item", plan.addedIds);
        }
        const updates = plan.originals.map(old => ({
          _id: old.id, "system.quantity": old.quantity
        }));
        if (updates.length) await plan.actor.updateEmbeddedDocuments("Item", updates);
      }
      await party.unsetFlag(WORLD, TEST_BACKUP_KEY);
      testMode = false;
      ui.notifications.info("TEST concluso: quantità originarie ripristinate e nuovi oggetti di prova eliminati.");
      await getTracker()?.render();
    } catch (err) {
      console.error("[Qawasha] RIPRISTINO TEST NON COMPLETATO", err);
      ui.notifications.error("Ripristino incompleto: backup ancora salvato sul Party. Non eseguire altri test; controlla F12.");
    } finally { testBusy = false; }
  }
  let rainBusy = false;
  let rainfallWeather = null;
  let rainfallInches = null;
  let rainRecipientId = null;
  function getRainfallInches() {
    const weather = getWeather();
    if (rainfallWeather !== weather) {
      rainfallWeather = weather;
      rainfallInches = defaultRainInches(weather);
    }
    return rainfallInches;
  }
  async function catchRain(recipientId, mounted, inches) {
    const simulation = testMode; // TEST REALE: scrive inventario, ma non aggiorna i flag giornalieri.
    if (rainBusy) return;
    const actor = getMembers().find(a => a.id === recipientId);
    if (!actor) { ui.notifications.warn("Scegli un PG destinatario dell'acqua piovana."); return; }
    const stock = ownedCatchers();
    if (!Number.isInteger(mounted) || mounted < 1 || mounted > stock.amount) {
      ui.notifications.warn(`Raccoglitori montati non validi: ne risultano ${stock.amount} negli inventari del Party.`); return;
    }
    if (!Number.isFinite(inches) || inches < 0 || inches > 100) {
      ui.notifications.warn("Inserisci una quantita' valida di pioggia in pollici."); return;
    }
    const day = readForageDay();
    if (day === null) { ui.notifications.error("Impossibile leggere il giorno ToA: non accredito acqua."); return; }
    const prior = party.getFlag(WORLD, RAIN_DAY_KEY);
    if (!simulation && prior?.day === day) {
      ui.notifications.warn(`Raccolta del giorno ${day} gia' registrata (${prior.status ?? "completata"}). Non duplico l'acqua.`); return;
    }
    // 1/2 gallone e' l'unita' minima contabilizzata in questa semplificazione.
    // Capienza per raccoglitore = 8 galloni, a patto che sia stato svuotato
    // nei contenitori adatti prima di una raccolta successiva.
    const perDevice = Math.min(8, 2 * inches);
    const halfGallons = Math.floor(perDevice * mounted * 2 + 1e-8);
    if (halfGallons < 1) {
      ui.notifications.info("Pioggia insufficiente per raccogliere almeno mezzo gallone: nessun accredito."); return;
    }
    rainBusy = true;
    try {
      if (simulation) {
        await addPotable(actor, halfGallons); // STESSA funzione della modalità normale.
        const gallons = halfGallons / 2;
        await ChatMessage.create({
          speaker: { alias: "Qawasha · TEST REALE pioggia" },
          whisper: ChatMessage.getWhisperRecipients("GM"),
          content: `<h3>TEST REALE · Raccolta acqua piovana</h3>` +
            `<p>+${gallons} galloni potabili nell'inventario di ` +
            `${foundry.utils.escapeHTML?.(actor.name) ?? actor.name}. ` +
            `Puoi controllare quantità e icona; poi premi RIPRISTINA nel Tracker.</p>`
        });
        ui.notifications.info(`TEST REALE pioggia: +${gallons} galloni potabili nell'inventario. Premi RIPRISTINA.`);
        await getTracker()?.render();
        return;
      }
      const record = { day, status: "pending", weather: getWeather(),
        inches, mounted, recipientId, halfGallons, at: new Date().toISOString() };
      // Pending prima della creazione: anche se si verifica un errore, un secondo
      // click non ripete in silenzio l'accredito gia' effettuato.
      await party.setFlag(WORLD, RAIN_DAY_KEY, record);
      await addPotable(actor, halfGallons);
      await party.setFlag(WORLD, RAIN_DAY_KEY, { ...record, status: "done" });
      const gallons = halfGallons / 2;
      await ChatMessage.create({
        speaker: { alias: "Qawasha · Acqua piovana" },
        content: `<h3>Raccolta acqua piovana · giorno ${day}</h3>` +
          `<p>Meteo: ${foundry.utils.escapeHTML?.(getWeather()) ?? getWeather()}; ` +
          `${inches} pollici di pioggia; ${mounted} raccoglitore/i montato/i.</p>` +
          `<p><strong>${gallons} galloni di acqua potabile</strong> ` +
          `(${halfGallons} unita' da mezzo gallone) nell'inventario di ` +
          `${foundry.utils.escapeHTML?.(actor.name) ?? actor.name}.</p>` +
          `<p>Le quantita' di pioggia per intensita' sono stime homebrew. ` +
          `Assunti montaggio e contenitori sufficienti.</p>`
      });
      ui.notifications.info(`Pioggia: +${gallons} galloni potabili a ${actor.name} (giorno ${day}).`);
      getTracker()?.render();
    } catch (err) {
      console.error("[Qawasha] Errore raccolta acqua piovana", err);
      ui.notifications.error("Accredito pioggia interrotto: controlla F12 e il flag pending prima di ritentare.");
    } finally { rainBusy = false; }
  }
  let boilBusy = false;
  async function boilCollectedWater(recipientId) {
    const simulation = testMode; // TEST REALE: scrive inventario, ma non aggiorna i flag giornalieri.
    if (boilBusy) return;
    const actor = getMembers().find(a => a.id === recipientId);
    if (!actor) { ui.notifications.warn("Scegli un PG con acqua da bollire."); return; }
    const raw = getResource(actor, "water");
    const gallons = Number(raw?.system?.quantity ?? 0);
    if (!raw || !Number.isFinite(gallons) || gallons <= 0) {
      ui.notifications.warn(`${actor.name} non ha acqua naturale raccolta dalla macro da purificare.`); return;
    }
    if (!Number.isInteger(gallons)) {
      ui.notifications.warn("Quantita' d'acqua naturale non intera: correggere manualmente prima della bollitura."); return;
    }
    boilBusy = true;
    try {
      if (simulation) {
        await addPotable(actor, gallons * 2);
        await actor.updateEmbeddedDocuments("Item", [{ _id: raw.id, "system.quantity": 0 }]);
        await ChatMessage.create({
          speaker: { alias: "Qawasha · TEST REALE purificazione" },
          whisper: ChatMessage.getWhisperRecipients("GM"),
          content: `<h3>TEST REALE · Purificazione acqua</h3>` +
            `<p>${foundry.utils.escapeHTML?.(actor.name) ?? actor.name}: ` +
            `${gallons} galloni sono stati convertiti davvero nell'inventario. ` +
            `Controlla le icone e poi premi RIPRISTINA nel Tracker.</p>`
        });
        ui.notifications.info("TEST REALE purificazione: inventario aggiornato; ripristinabile.");
        await getTracker()?.render();
        return;
      }
      // Il DM preme soltanto dopo aver stabilito che hanno fuoco, tempo e contenitori.
      // Aggiungiamo prima acqua potabile; in caso di errore manuale e' visibile.
      await addPotable(actor, gallons * 2);
      await actor.updateEmbeddedDocuments("Item", [{ _id: raw.id, "system.quantity": 0 }]);
      await ChatMessage.create({
        speaker: { alias: "Qawasha · Acqua purificata" },
        content: `<p><strong>${foundry.utils.escapeHTML?.(actor.name) ?? actor.name}</strong>: ` +
          `${gallons} galloni d'acqua naturale bolliti/purificati e trasferiti ` +
          `all'acqua potabile. Nessun tiro richiesto.</p>`
      });
      ui.notifications.info(`${actor.name}: ${gallons} galloni convertiti in acqua potabile.`);
      getTracker()?.render();
    } catch (err) {
      console.error("[Qawasha] Errore conversione acqua", err);
      ui.notifications.error("Bollitura non completata: controlla la quantita' dei due oggetti prima di ripetere.");
    } finally { boilBusy = false; }
  }

  const readForageDay = () => {
    const n = Number(game.settings.get(MOD, "day"));
    return Number.isFinite(n) ? n : null;
  };
  async function grantResources(actor, food, water) {
    const updates = [];
    const creates = [];
    for (const [kind, count] of [["food", food], ["water", water]]) {
      if (!Number.isInteger(count) || count <= 0) continue;
      const def = resourceDefinitions[kind];
      // Identifichiamo solo le pile create da questa macro, mai oggetti manuali.
      const existing = actor.items.find(item =>
        item.getFlag(WORLD, RESOURCE_FLAG) === kind && item.type === "loot"
      );
      if (existing) {
        const prior = Number(existing.system.quantity ?? 0);
        updates.push({ _id: existing.id, "system.quantity": (Number.isFinite(prior) ? prior : 0) + count,
          img: resourceIcons[kind] });
      } else {
        creates.push({
          name: def.name,
          type: "loot",
          img: resourceIcons[kind],
          system: {
            quantity: count,
            weight: { value: def.weight, units: "lb" },
            description: { value: `<p>${def.description}</p>` }
          },
          flags: { [WORLD]: { [RESOURCE_FLAG]: kind } }
        });
      }
    }
    // Creare prima e aggiornare poi non tocca mai il resto dell'inventario.
    if (creates.length) await actor.createEmbeddedDocuments("Item", creates);
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }

  let foragerId = getNavigator()?.id ?? getMembers()[0]?.id ?? "";
  let forageDC = 15;
  let rolling = false;
  async function forage(actorId, dc) {
    const simulation = testMode; // TEST REALE: scrive inventario, ma non aggiorna i flag giornalieri.
    if (rolling) return;
    const actor = getMembers().find(a => a.id === actorId);
    if (!actor) {
      ui.notifications.warn("Seleziona un PG del gruppo per cercare risorse.");
      return;
    }
    // Un tentativo per giornata e per PG. Rende sicuro anche ripetere la macro o ricaricare.
    const currentDay = readForageDay();
    const previous = actor.getFlag(WORLD, FORAGE_DAY_KEY);
    if (!simulation && currentDay !== null && previous?.day === currentDay) {
      ui.notifications.warn(`${actor.name} ha gia' cercato risorse nel giorno ${currentDay}: non ripeto il tiro e non duplico l'inventario.`);
      return;
    }
    rolling = true;
    try {
      const pace = getPace();
      const guideBonus = isGuideActive() ? BONUS : 0;
      const cfg = {
        skill: "sur",
        target: dc,
        advantage: pace === "slow" ? true : undefined,
        disadvantage: pace === "fast" ? true : undefined,
        rolls: [{ parts: [String(guideBonus)] }]
      };
      const rolls = await actor.rollSkill(
        cfg,
        { options: { window: { title: simulation ? "TEST · Ricerca di cibo e acqua" : "Ricerca di cibo e acqua" } } },
        { data: { flavor: `${simulation ? "TEST · " : ""}Ricerca di cibo e acqua (CD ${dc}, ${paceName(pace)}; guide +${guideBonus})` },
          rollMode: simulation ? CONST.DICE_ROLL_MODES.BLIND : game.settings.get("core", "rollMode") }
      );
      if (!rolls?.[0]) return; // dialogo annullato: nessuna modifica
      const result = rolls[0];
      const success = typeof result.isSuccess === "boolean"
        ? result.isSuccess : Number(result.total) >= dc;
      let food = 0;
      let water = 0;
      let dice = null;
      if (success) {
        const wis = Number(actor.system?.abilities?.wis?.mod ?? 0);
        const wisMod = Number.isFinite(wis) ? wis : 0;
        const foodDie = await (new Roll("1d6")).evaluate();
        const waterDie = await (new Roll("1d6")).evaluate();
        food = Math.max(0, Math.floor(foodDie.total + wisMod));
        water = Math.max(0, Math.floor(waterDie.total + wisMod));
        dice = { food: foodDie.total, water: waterDie.total, wis: wisMod };
        // Anche il TEST REALE usa l'identica funzione di accredito della sessione.
        // Il backup consente il ripristino; non si toccano i flag giornalieri.
        await grantResources(actor, food, water);
      }
      if (!simulation && currentDay !== null) {
        await actor.setFlag(WORLD, FORAGE_DAY_KEY, {
          day: currentDay, success, food, water, dc,
          at: new Date().toISOString()
        });
      }
      const escaped = foundry.utils.escapeHTML?.(actor.name) ?? actor.name.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      const diceDescription = dice
        ? `<p>Cibo: d6 ${dice.food} ${dice.wis >= 0 ? "+" : "-"} ${Math.abs(dice.wis)} = <strong>${food} libbre</strong>.<br>` +
          `Acqua: d6 ${dice.water} ${dice.wis >= 0 ? "+" : "-"} ${Math.abs(dice.wis)} = <strong>${water} galloni</strong>.</p>`
        : "<p>Non sono state trovate risorse.</p>";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        ...(simulation ? { whisper: ChatMessage.getWhisperRecipients("GM") } : {}),
        content: `<h3>${simulation ? "TEST · " : ""}Ricerca risorse — ${escaped}</h3>` +
          `<p>Prova: <strong>${success ? "successo" : "fallimento"}</strong> (CD ${dc}).</p>` + diceDescription +
          (simulation
            ? `<p><strong>TEST REALE: inventario aggiornato, giorno di gioco non consumato. Usa RIPRISTINA nel Tracker.</strong></p>`
            : success ? `<p><strong>Inventario aggiornato automaticamente.</strong> L'acqua del Chult deve essere bollita prima di essere bevuta. Occorrono contenitori adatti.</p>` : "")
      });
      console.info("[Qawasha] Ricerca risorse", {
        attore: actor.name, totale: result.total, successo: success,
        ciboLibbre: food, acquaGalloni: water, giorno: currentDay, cd: dc, test: simulation
      });
      if (simulation) ui.notifications.info(`TEST REALE: +${food} libbre cibo e +${water} galloni acqua nell'inventario di ${actor.name}. Premi RIPRISTINA.`);
      else if (success) ui.notifications.info(`${actor.name}: +${food} libbre di cibo e +${water} galloni di acqua nell'inventario.`);
    } catch (err) {
      console.error("[Qawasha] Ricerca risorse fallita", err);
      ui.notifications.error("Errore nella ricerca o nell'aggiornamento dell'inventario: controlla F12 prima di ripetere il tiro.");
    } finally { rolling = false; }
  }

  function renderExtras(app, root) {
    if (app?.constructor?.name !== "TravelTracker" || !root?.querySelector) return;
    if (root.querySelector("[data-qawasha-extras]")) return;
    const container = root.querySelector("form") ?? root.querySelector(".window-content") ?? root;
    const block = document.createElement("section");
    block.dataset.qawashaExtras = "8";
    block.style.cssText = [
      "box-sizing:border-box", "grid-column:1 / -1", "width:100%", "max-width:100%", "min-width:0",
      "margin:12px 0 4px", "padding:12px", "border:1px solid #8c7751",
      "border-radius:8px", "background:rgba(14,34,27,.82)", "color:#f5e6c7",
      "font-size:13px", "line-height:1.4", "overflow-wrap:break-word"
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;min-width:0;margin-bottom:8px";
    const title = document.createElement("strong");
    title.textContent = "Qawasha e Kupalué · Guida v8";
    title.style.cssText = "flex:1 1 205px;min-width:0;font-size:14px;line-height:1.3";
    const active = document.createElement("label");
    active.style.cssText = "display:inline-flex;flex:0 1 auto;gap:6px;align-items:center;min-width:0;font-size:12px;white-space:normal";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = isGuideActive();
    check.style.cssText = "width:16px;height:16px;min-width:16px;flex:0 0 16px;margin:0";
    active.append(check, document.createTextNode("Guide presenti"));
    header.append(title, active);
    block.append(header);

    const testPanel = document.createElement("div");
    testPanel.style.cssText = "box-sizing:border-box;width:100%;min-width:0;margin:4px 0 8px;padding:8px;border:1px dashed #b59b60;border-radius:6px;font-size:12px";
    const testStatus = document.createElement("p");
    testStatus.style.cssText = "margin:0 0 6px;font-size:12px;font-weight:600";
    testStatus.textContent = testMode
      ? "TEST REALE ATTIVO: gli oggetti vengono aggiunti davvero. Ripristina alla fine!"
      : "TEST INVENTARIO: prova i veri accrediti senza consumare i tentativi giornalieri.";
    testPanel.append(testStatus);
    const testAction = document.createElement("button");
    testAction.type = "button";
    testAction.textContent = testMode
      ? "RIPRISTINA INVENTARI E TERMINA TEST"
      : "AVVIA TEST REALE (CON BACKUP)";
    testAction.style.cssText = "display:block;box-sizing:border-box;width:100%;min-width:0;white-space:normal;padding:7px;line-height:1.3";
    testAction.addEventListener("click", async () => {
      testAction.disabled = true;
      try {
        if (testMode) await restoreInventoryTest();
        else await startInventoryTest();
      } finally { testAction.disabled = false; }
    });
    testPanel.append(testAction);
    const testHint = document.createElement("small");
    testHint.style.cssText = "display:block;opacity:.85;margin-top:5px";
    testHint.textContent = "Il backup resta sul Party anche dopo F5. Il ripristino riguarda solo le tre risorse marcate dalla macro; non modificarle a mano durante il test.";
    testPanel.append(testHint);
    block.append(testPanel);

    const passive = document.createElement("p");
    passive.style.cssText = "margin:4px 0 9px;line-height:1.4;overflow-wrap:anywhere";
    const pi = passiveInfo();
    passive.textContent = pi
      ? `Percezione passiva: ${pi.total} (${pi.name}: ${pi.base}; guide +${pi.guides}; andatura ${pi.pace >= 0 ? "+" : ""}${pi.pace}).`
      : "Percezione passiva: nessun PG valido trovato nel Party.";
    block.append(passive);

    // Collassata per impostazione iniziale: il Tracker rimane compatto.
    const details = document.createElement("details");
    details.style.cssText = "border-top:1px solid rgba(245,230,199,.22);padding-top:8px;width:100%;min-width:0";
    const summary = document.createElement("summary");
    summary.textContent = "Ricerca cibo e acqua";
    summary.style.cssText = "cursor:pointer;font-weight:600;padding:2px 0 6px;line-height:1.4";
    details.append(summary);

    const row = document.createElement("div");
    row.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) 80px;gap:8px;align-items:center;min-width:0;width:100%;margin:6px 0 8px";
    const select = document.createElement("select");
    select.style.cssText = "box-sizing:border-box;width:100%;max-width:100%;min-width:0";
    select.setAttribute("aria-label", "Personaggio che cerca risorse");
    const members = getMembers();
    if (!members.some(a => a.id === foragerId)) foragerId = getNavigator()?.id ?? members[0]?.id ?? "";
    for (const member of members) {
      const opt = document.createElement("option");
      opt.value = member.id;
      opt.textContent = member.name;
      opt.selected = member.id === foragerId;
      select.append(opt);
    }
    select.addEventListener("change", () => { foragerId = select.value; });

    const dcLabel = document.createElement("label");
    dcLabel.textContent = "CD";
    dcLabel.style.cssText = "display:flex;gap:5px;align-items:center;justify-content:flex-end;min-width:0";
    const dcInput = document.createElement("input");
    dcInput.type = "number";
    dcInput.min = "1";
    dcInput.max = "30";
    dcInput.value = String(forageDC);
    dcInput.style.cssText = "box-sizing:border-box;width:48px;max-width:48px;min-width:0;text-align:center;padding:3px";
    dcInput.addEventListener("change", () => {
      forageDC = Math.max(1, Math.min(30, Number(dcInput.value) || 15));
      dcInput.value = String(forageDC);
    });
    dcLabel.append(dcInput);
    row.append(select, dcLabel);
    details.append(row);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = testMode ? "TEST REALE: cerca risorse e accredita" : "Cerca risorse e aggiorna inventario";
    btn.style.cssText = "display:block;box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:36px;padding:6px 8px;white-space:normal;overflow-wrap:anywhere;line-height:1.25";
    btn.addEventListener("click", () => forage(select.value, Math.max(1, Math.min(30, Number(dcInput.value) || 15))));
    details.append(btn);
    block.append(details);

    // Raccoglitori: richiudibile per non deformare il Tracker.
    const rainDetails = document.createElement("details");
    rainDetails.style.cssText = "border-top:1px solid rgba(245,230,199,.22);padding-top:8px;margin-top:10px;width:100%;min-width:0";
    const rainSummary = document.createElement("summary");
    rainSummary.textContent = "Pioggia, acqua potabile e bollitura";
    rainSummary.style.cssText = "cursor:pointer;font-weight:600;padding:2px 0 6px";
    rainDetails.append(rainSummary);
    const rainStock = ownedCatchers();
    const rainCaption = document.createElement("p");
    rainCaption.style.cssText = "margin:4px 0 8px;font-size:12px;opacity:.92";
    const recorded = party.getFlag(WORLD, RAIN_DAY_KEY);
    const today = readForageDay();
    rainCaption.textContent = `Meteo Tracker: ${getWeather() || "non definito"} · Raccoglitori nell'inventario: ${rainStock.amount}. ` +
      (recorded?.day === today ? `Raccolta giorno ${today}: ${recorded.status}.` : "Non ancora raccolta oggi.");
    rainDetails.append(rainCaption);

    const rainFields = document.createElement("div");
    rainFields.style.cssText = "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;min-width:0";
    const rainControls = [
      ["Raccoglitori montati", "number", String(rainStock.amount), "1"],
      ["Pioggia in pollici (stima)", "number", String(getRainfallInches()), "0.25"]
    ];
    const rainInputs = [];
    for (const [caption, typ, val, step] of rainControls) {
      const lbl = document.createElement("label");
      lbl.style.cssText = "display:flex;flex-direction:column;gap:4px;font-size:12px;min-width:0";
      lbl.append(document.createTextNode(caption));
      const inp = document.createElement("input");
      inp.type = typ; inp.min = "0"; inp.step = step; inp.value = val;
      inp.style.cssText = "box-sizing:border-box;width:100%;min-width:0";
      lbl.append(inp); rainFields.append(lbl); rainInputs.push(inp);
    }
    rainDetails.append(rainFields);
    const chooseRecipient = document.createElement("select");
    chooseRecipient.style.cssText = "box-sizing:border-box;display:block;width:100%;min-width:0;margin:8px 0";
    chooseRecipient.setAttribute("aria-label", "Destinatario dell'acqua piovana o da bollire");
    if (!members.some(a => a.id === rainRecipientId)) rainRecipientId = foragerId;
    for (const member of members) {
      const option = document.createElement("option");
      option.value = member.id; option.textContent = member.name;
      option.selected = member.id === rainRecipientId;
      chooseRecipient.append(option);
    }
    chooseRecipient.addEventListener("change", () => { rainRecipientId = chooseRecipient.value; });
    rainDetails.append(chooseRecipient);
    rainInputs[1].addEventListener("change", () => {
      const v = Number(rainInputs[1].value);
      if (Number.isFinite(v) && v >= 0) rainfallInches = v;
    });
    const rainButton = document.createElement("button");
    rainButton.type = "button";
    rainButton.textContent = testMode ? "TEST REALE: raccogli pioggia e accredita" : "Raccogli pioggia e accredita acqua potabile";
    rainButton.style.cssText = "display:block;width:100%;min-width:0;white-space:normal;padding:7px;margin:8px 0";
    rainButton.addEventListener("click", () => catchRain(
      chooseRecipient.value, Number(rainInputs[0].value), Number(rainInputs[1].value)
    ));
    rainDetails.append(rainButton);
    const boilButton = document.createElement("button");
    boilButton.type = "button";
    boilButton.textContent = testMode ? "TEST REALE: purifica e aggiorna inventario" : "Bolli / purifica tutta l'acqua naturale del PG";
    boilButton.style.cssText = "display:block;width:100%;min-width:0;white-space:normal;padding:7px;margin:8px 0";
    boilButton.addEventListener("click", () => boilCollectedWater(chooseRecipient.value));
    rainDetails.append(boilButton);
    const hint = document.createElement("p");
    hint.style.cssText = "font-size:11px;opacity:.8;margin:6px 0 0";
    hint.textContent = "La raccolta si fa all'accampamento con raccoglitori montati e contenitori adatti. " +
      "1 pollice di pioggia = 2 galloni per raccoglitore (massimo 8). " +
      "I pollici proposti dal meteo sono una stima homebrew modificabile. " +
      "La bollitura richiede fuoco/tempo oppure magia appropriata.";
    rainDetails.append(hint);
    block.append(rainDetails);

    const note = document.createElement("small");
    note.style.cssText = "display:block;opacity:.78;margin-top:8px;line-height:1.3;overflow-wrap:anywhere";
    note.textContent = isGuideActive()
      ? "Navigazione +2 automatica. Ricerca, acqua piovana e purificazione nell’inventario (raccolta pioggia: una volta al giorno)."
      : "Guide disattivate. La ricerca può comunque aggiungere risorse all’inventario.";
    block.append(note);

    check.addEventListener("change", async () => {
      check.disabled = true;
      try {
        await party.setFlag(WORLD, GUIDE_KEY, check.checked);
        getTracker()?.render();
      } catch (err) {
        console.error("[Qawasha] Errore cambio stato guide", err);
        ui.notifications.error("Impossibile salvare lo stato delle guide.");
        check.checked = !check.checked;
      } finally { check.disabled = false; }
    });
    container.append(block);
  }

  const idRender = Hooks.on("renderApplicationV2", (app, root) => {
    if (app?.constructor?.name !== "TravelTracker") return;
    renderExtras(app, root);
    scheduleResize(app);
  });
  globalThis[STORE] = { version: UI_VERSION, hookIds: [
    ["dnd5e.preRollSkill", idNav],
    ["renderApplicationV2", idRender]
  ], partyId: party.id, startedAt: new Date().toISOString() };
  if (tracker) { await tracker.render(); scheduleResize(tracker); }

  // Icone alle risorse create nelle versioni precedenti: avvio una sola volta
  // dopo l'inizializzazione dei listener; eventuali errori non bloccano la guida.
  try {
    const refreshed = await refreshExistingResourceIcons();
    console.info(`[Qawasha] Icone aggiornate sugli oggetti già esistenti: ${refreshed}`);
  } catch (err) {
    console.warn("[Qawasha] Icone esistenti: aggiornamento non riuscito", err);
    ui.notifications.warn("Guida attiva, ma non sono riuscito ad aggiornare alcune icone esistenti: verifica F12.");
  }

  const backup = party.getFlag(WORLD, BACKUP_KEY);
  ui.notifications.info(`Qawasha e Kupalué · modulo 1.0: guida attiva; test reale e icone disponibili. Party: ${removed.length ? removed.length + " riferimenti rimossi" : "nessun riferimento da rimuovere"}.`);
  console.info("[Qawasha] Integrazione attiva:", {
    Party: party.name, GuideAttive: isGuideActive(),
    BackupParty: !!backup, RiferimentiRimossi: removed,
    Nota: "Il modulo si inizializza automaticamente a ogni accesso del GM."
  });

}
