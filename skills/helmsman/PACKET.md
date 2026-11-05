# Decision packets

A **packet** is one page holding one round of decisions, answered once.
Every recommendation arrives selected, so accepting all of it costs one send.
`assets/packet.js` renders the page and selects each recommendation; hand-written option markup loses that guarantee, so every packet goes through it.

Under firstmate, [FIRSTMATE.md](FIRSTMATE.md) replaces steps 3 and 4.

## Items

Write the items in the human's language, from the ask test in [SKILL.md](SKILL.md#the-ask-test).

| ID | Track | Shape | Shown |
|---|---|---|---|
| `P-nn` | `product` | question | open |
| `V-nn` | `visual` | question | open |
| `O-nn` | `operations` | question: an [escalation](SKILL.md#the-three-escalations), or a deploy or support choice that reaches the human | open |
| `T-nn` | `technical` | a decision already made since the last packet: the choice and its best rejected alternative | collapsed |
| `A-nn` | `assumed` | one statement, kept unless vetoed | collapsed |

IDs stay stable for the whole effort, so an answer, a pin and a ticket all name the same item.
An open track holds **at most twelve** items per packet; the next packet takes the rest, unblocking questions first.
The collapsed tracks have no cap, because they cost nothing unless opened.

## Steps

1. **Copy the engine.** Copy `assets/packet.html` and `assets/packet.js` into `<plan>/packets/`, naming the page `R<n>.html`. A blueprint or prototype page instead holds the `#helmsman-packet` div, the JSON script and the `packet.js` script below its drawing. Done when the page and `packet.js` sit in one directory.
2. **Fill the JSON.** Replace the sample in `#helmsman-packet-data`, escaping `</` as `<\/`. Set `<html lang>`, and set `labels` to the human's language: `product`, `visual`, `operations`, `technical`, `assumed`, `recommended`, `note`, `keep`, `submit`, `changed`, `queued`, `copied`, `copyFailed`. Open with what the page changes and how to send it. Done when the page renders with no `Packet error` line.

   ```json
   { "round": "R1", "title": "...", "intro": "...", "labels": {},
     "items": [
       { "id": "P-01", "track": "product", "question": "...", "context": "only when it would be misread without it",
         "options": [ { "value": "a", "label": "...", "detail": "what it means for them" }, { "value": "b", "label": "..." } ],
         "recommended": "a" },
       { "id": "A-01", "track": "assumed", "statement": "..." }
     ] }
   ```

3. **Open it**, taking the first surface that works.
   - **Lavish:** `lavish-axi <file>`, then follow its `next_step`, which keeps `lavish-axi poll <file>` running in the foreground until feedback arrives. Consult `lavish-axi --help` for flags. The human presses **Send answers**, then **Send to Agent**, and can pin any element of the page as extra feedback.
   - **Browser:** open the file directly. **Send answers** copies the answers, and the human pastes them into the chat.
   - **Chat:** with no browser on the machine, send the open items as a numbered list, each with its recommendation, and accept "ok" for all of them or the numbers that differ.
4. **Bank the answers.** Write every returned line and pin verbatim to `<plan>/packets/R<n>.answers.md`, then commit, before acting on any of them. A session that dies after this point loses nothing. Done when the file is committed.
5. **Apply and account.** Apply each ID: an answer per [Resolving a `po` ticket](SKILL.md#resolving-a-po-ticket), a vetoed `A-` line per [The ask test](SKILL.md#the-ask-test), a changed `T-` item per [Overriding a technical decision](SKILL.md#overriding-a-technical-decision), and each pin or visual comment into [`FEEDBACK.md`](VISUAL.md#the-feedback-ledger). A line with a `note:` is read as the human's own answer and outranks the option it sits on. Reply with a receipt naming every ID that changed anything. Done when every ID in the packet appears in the map, a ledger or the receipt.
