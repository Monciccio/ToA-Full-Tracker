# ToA Full Tracker

## Qawasha e Kupalué — Esplorazione del Chult

Versione **1.0.0** (conversione della macro v8).

## Compatibilità prevista
- Foundry VTT **V13** (test non eseguito dentro Foundry)
- Sistema **dnd5e 5.3.3**
- Modulo **Tomb of Annihilation 1.2.1** attivo
- Attore del gruppo ufficiale **Party** (`toaParty00000000`)

Il codice della macro v8 viene attivato **automaticamente dal client del Master** dopo l'evento `ready` di Foundry. Non è necessario eseguire macro a ogni login/F5. Il modulo non esegue nulla nel client dei giocatori.

## Cosa mantiene
- +2 di Qawasha nella navigazione originale dell'Adventure Tracker.
- Smarrimento e movimento del token gestiti dal modulo ToA (non sostituiti).
- Percezione passiva del viaggio con +2 guide.
- Ricerca di cibo e acqua con accredito degli oggetti nell'inventario.
- Acqua piovana dai raccoglitori, purificazione, capacità e registri giornalieri.
- Modalità TEST REALE: backup inventari, prove ripetibili, tasto di ripristino.
- Immagini WebP interne al modulo: nessun caricamento nel File Picker SQYRE.
- Flag precedenti salvati sul Party e sugli oggetti della v8 (non vengono azzerati).

## Prima di installare
1. Fai un backup del mondo e in particolare dell'attore Party e degli inventari.
2. Se un TEST REALE v8 è in corso, usa prima **RIPRISTINA INVENTARI E TERMINA TEST** oppure lascialo intenzionalmente in corso: il modulo eredita il backup, ma evita altri accrediti finché non hai verificato lo stato.
3. Disattiva dalla barra e NON eseguire più la macro v8 (o precedenti): il modulo fa già tutto; altrimenti potresti introdurre doppi hook e anomalie.
4. **Non** abilitare il modulo in altri mondi: è personalizzato per l'attore Party di questa campagna.

## Installazione da cartella (Foundry con accesso ai file)
Decomprimi questa distribuzione in `{Foundry UserData}/Data/modules/qawasha-kupalue-exploration/`, in modo che `module.json` si trovi direttamente in questa cartella. Riavvia Foundry e attiva **Qawasha e Kupalué — Esplorazione del Chult** nelle impostazioni del mondo.

## Installazione tramite Manifest URL (Foundry / SQYRE)
1. Apri il gestore dei moduli di Foundry e scegli **Install Module**.
2. Incolla questo URL nel campo **Manifest URL**:

   ```text
   https://github.com/Monciccio/ToA-Full-Tracker/releases/latest/download/module.json
   ```

3. Installa il modulo e abilitalo nelle impostazioni del mondo.
4. Segui le verifiche del primo avvio riportate qui sotto.

Foundry scarica automaticamente il pacchetto e le immagini incluse. Non occorre caricare file manualmente su SQYRE.

La [release v1.0.0](https://github.com/Monciccio/ToA-Full-Tracker/releases/tag/v1.0.0) contiene:
- `module.json`: manifest per il gestore dei moduli;
- `qawasha-kupalue.zip`: distribuzione completa, con `module.json` alla radice.

Il repository si chiama **ToA-Full-Tracker**; l'identificatore Foundry resta `qawasha-kupalue-exploration`, per mantenere coerenti i percorsi delle immagini e l'installazione del modulo.

## Verifica sicura al primo avvio
- Apri F12 e controlla che non ci siano errori `[qawasha-kupalue-exploration]`.
- Apri l'Adventure Tracker: la sezione delle guide deve apparire automaticamente.
- Verifica Percezione passiva e icone degli oggetti già presenti.
- Esegui un test reale con backup; controlla quantità e icone, poi ripristina.
- Solo in una copia di test del mondo, verifica una navigazione fallita: l'Adventure Tracker può spostare davvero il token Party.

## Note tecniche
- Il modulo riutilizza i nomi delle flag `world.toaQawasha*` già introdotte dalla macro v8: nessuna migrazione automatica dei dati è necessaria.
- La pulizia dei riferimenti obsoleti al Party della macro v8 è ancora presente, protetta da backup sul Party.
- Le stime di pioggia per intensità meteo sono **homebrew**.
- Non è un modulo WotC ufficiale; dipende dalle implementazioni interne dell'Adventure Tracker 1.2.1.
- Se il modulo ToA o il sistema dnd5e cambiano versione, riesegui i test prima di usare in sessione.
- L'installazione del modulo non abilita automaticamente il controllo del consumo dell'acqua dal pulsante originale **Handle Dehydration**.
