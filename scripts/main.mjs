import { activateGuide } from "./guide.mjs";

const MODULE_ID = "qawasha-kupalue-exploration";

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  // Non attiva la guida sui mondi privi del modulo ToA.
  if (!game.modules.get("dnd-tomb-annihilation")?.active) {
    console.warn(`[${MODULE_ID}] Tomb of Annihilation non attivo: inizializzazione ignorata.`);
    return;
  }
  void activateGuide().catch(err => {
    console.error(`[${MODULE_ID}] Avvio non riuscito`, err);
    ui.notifications?.error("Qawasha: inizializzazione del modulo non riuscita. Controlla F12.");
  });
});
