// Renders a helmsman decision packet from the JSON in #helmsman-packet-data into
// #helmsman-packet, with every recommendation already selected. PACKET.md owns the schema.
(function () {
  "use strict";

  var DEFAULT_LABELS = {
    product: "Product",
    visual: "Look and feel",
    operations: "Operations and costs",
    technical: "Technical decisions (already made; open only to change one)",
    assumed: "Assumed without asking (untick to veto)",
    recommended: "Recommended",
    note: "Another answer, or an adjustment",
    keep: "Keep",
    submit: "Send answers",
    changed: "changed from the recommendation",
    queued: "Queued. Press Send to Agent in the Lavish panel.",
    copied: "Copied. Paste it into the chat.",
    copyFailed: "Copy failed. Select the text below and copy it.",
  };
  var TRACK_ORDER = ["product", "visual", "operations", "technical", "assumed"];
  var COLLAPSED_TRACKS = { technical: true, assumed: true };

  var STYLE = [
    ".hp{--hp-ink:#1c1c1e;--hp-soft:#5f5f66;--hp-line:#d9d9de;--hp-bg:Canvas;--hp-tint:#f1f1f4;--hp-mark:#0b5fff;",
    "color:var(--hp-ink);background:var(--hp-bg);font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
    "max-width:760px;margin:0 auto;padding:24px 16px 96px}",
    "@media (prefers-color-scheme:dark){.hp{--hp-ink:#f2f2f4;--hp-soft:#a8a8b0;--hp-line:#3a3a40;--hp-tint:#26262b;--hp-mark:#7aa7ff}}",
    ".hp h1{font-size:24px;line-height:1.25;margin:0 0 8px;text-wrap:balance}",
    ".hp h2,.hp summary{font-size:17px;font-weight:600;margin:32px 0 8px}",
    ".hp summary{cursor:pointer}",
    ".hp-intro{color:var(--hp-soft);margin:0 0 16px}",
    ".hp-item{border:0;border-bottom:1px solid var(--hp-line);margin:0;padding:12px 0 16px;min-width:0}",
    ".hp-item legend{padding:0;font-weight:600;margin-bottom:4px}",
    ".hp-id{color:var(--hp-soft);font-weight:400;font-variant-numeric:tabular-nums;margin-right:8px}",
    ".hp-context{color:var(--hp-soft);margin:0 0 8px}",
    ".hp-option{display:flex;gap:10px;align-items:flex-start;padding:8px;border-radius:8px;cursor:pointer}",
    ".hp-option:has(input:checked){background:var(--hp-tint)}",
    ".hp-option input{margin:4px 0 0;flex:none;width:16px;height:16px;accent-color:var(--hp-mark)}",
    ".hp-option small{display:block;color:var(--hp-soft);font-size:13px}",
    ".hp-badge{color:var(--hp-mark);font-size:13px;margin-left:8px}",
    ".hp-note{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:8px;font:inherit;color:inherit;",
    "background:transparent;border:1px solid var(--hp-line);border-radius:8px}",
    ".hp :focus-visible{outline:2px solid var(--hp-mark);outline-offset:2px}",
    ".hp-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--hp-line);margin-top:24px}",
    ".hp-bar button{font:inherit;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid var(--hp-mark);background:var(--hp-mark);color:var(--hp-bg);cursor:pointer}",
    ".hp-status{color:var(--hp-soft);font-size:13px;font-variant-numeric:tabular-nums}",
    ".hp-manual{width:100%;box-sizing:border-box;min-height:160px;margin-top:8px;font:13px/1.4 ui-monospace,Consolas,monospace;color:inherit;background:var(--hp-tint);border:0;border-radius:8px;padding:8px}",
    ".hp-error{color:#c62828;font-weight:600}",
  ].join("");

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function findPacketProblems(packet) {
    var problems = [];
    var seenIds = {};
    if (!packet.items || !packet.items.length) problems.push("packet has no items");
    (packet.items || []).forEach(function (item) {
      if (!item.id) problems.push("item without id: " + JSON.stringify(item));
      if (seenIds[item.id]) problems.push("duplicate id " + item.id);
      seenIds[item.id] = true;
      if (TRACK_ORDER.indexOf(item.track) === -1) problems.push(item.id + ": unknown track " + item.track);
      if (item.track === "assumed") return;
      var values = (item.options || []).map(function (option) { return option.value; });
      if (values.length < 2) problems.push(item.id + ": needs at least two options");
      if (values.indexOf(item.recommended) === -1) problems.push(item.id + ": recommended is not one of its options");
    });
    return problems;
  }

  function renderOption(item, option, labels) {
    var row = createElement("label", "hp-option");
    var input = createElement("input");
    input.type = "radio";
    input.name = item.id;
    input.value = option.value;
    input.checked = option.value === item.recommended;
    var body = createElement("span");
    body.appendChild(createElement("span", "", option.label));
    if (option.value === item.recommended) body.appendChild(createElement("span", "hp-badge", labels.recommended));
    if (option.detail) body.appendChild(createElement("small", "", option.detail));
    row.appendChild(input);
    row.appendChild(body);
    return row;
  }

  function renderDecisionItem(item, labels) {
    var fieldset = createElement("fieldset", "hp-item");
    fieldset.dataset.itemId = item.id;
    var legend = createElement("legend");
    legend.appendChild(createElement("span", "hp-id", item.id));
    legend.appendChild(document.createTextNode(item.question));
    fieldset.appendChild(legend);
    if (item.context) fieldset.appendChild(createElement("p", "hp-context", item.context));
    item.options.forEach(function (option) {
      fieldset.appendChild(renderOption(item, option, labels));
    });
    var note = createElement("input", "hp-note");
    note.type = "text";
    note.name = item.id + "-note";
    note.setAttribute("aria-label", item.id + ": " + labels.note);
    note.placeholder = labels.note;
    fieldset.appendChild(note);
    return fieldset;
  }

  function renderAssumedItem(item, labels) {
    var fieldset = createElement("fieldset", "hp-item");
    fieldset.dataset.itemId = item.id;
    var row = createElement("label", "hp-option");
    var input = createElement("input");
    input.type = "checkbox";
    input.name = item.id;
    input.checked = true;
    input.setAttribute("aria-label", labels.keep + " " + item.id);
    var body = createElement("span");
    body.appendChild(createElement("span", "hp-id", item.id));
    body.appendChild(document.createTextNode(item.statement));
    row.appendChild(input);
    row.appendChild(body);
    fieldset.appendChild(row);
    return fieldset;
  }

  function renderTrack(track, items, labels) {
    var section;
    if (COLLAPSED_TRACKS[track]) {
      section = createElement("details");
      section.appendChild(createElement("summary", "", labels[track] + " (" + items.length + ")"));
    } else {
      section = createElement("section");
      section.appendChild(createElement("h2", "", labels[track]));
    }
    items.forEach(function (item) {
      section.appendChild(item.track === "assumed" ? renderAssumedItem(item, labels) : renderDecisionItem(item, labels));
    });
    return section;
  }

  function collectAnswers(form, packet) {
    return packet.items.map(function (item) {
      if (item.track === "assumed") {
        var kept = form.elements[item.id].checked;
        return { id: item.id, track: item.track, answer: kept ? "keep" : "veto", recommended: kept, note: "" };
      }
      var answer = form.elements[item.id].value;
      var note = form.elements[item.id + "-note"].value.trim();
      return { id: item.id, track: item.track, answer: answer, recommended: answer === item.recommended && !note, note: note };
    });
  }

  function formatAnswers(packet, answers) {
    var lines = answers.map(function (entry) {
      var suffix = entry.recommended ? " (recommended)" : "";
      return entry.id + " = " + entry.answer + suffix + (entry.note ? " | note: " + entry.note : "");
    });
    return [
      "Helmsman packet " + packet.round + ": apply every answer below and account for each ID in your receipt.",
    ].concat(lines).join("\n");
  }

  function showManualCopy(status, text) {
    var manual = createElement("textarea", "hp-manual");
    manual.readOnly = true;
    manual.value = text;
    status.parentElement.appendChild(manual);
    manual.select();
  }

  function deliverAnswers(form, packet, labels, status) {
    var answers = collectAnswers(form, packet);
    var text = formatAnswers(packet, answers);
    if (window.lavish && window.lavish.queuePrompt) {
      window.lavish.queuePrompt(text, {
        tag: "tracked-batch",
        text: "Packet " + packet.round + ": " + answers.length + " answers",
        element: form,
        data: { round: packet.round },
      });
      status.textContent = labels.queued;
      return;
    }
    var clipboard = navigator.clipboard;
    if (!clipboard) {
      status.textContent = labels.copyFailed;
      showManualCopy(status, text);
      return;
    }
    clipboard.writeText(text).then(
      function () { status.textContent = labels.copied; },
      function () {
        status.textContent = labels.copyFailed;
        showManualCopy(status, text);
      },
    );
  }

  function renderPacket(root, packet) {
    var labels = Object.assign({}, DEFAULT_LABELS, packet.labels || {});
    var form = createElement("form", "hp");
    form.dataset.lavishQuestion = "helmsman-packet-" + packet.round;
    form.appendChild(createElement("h1", "", packet.title));
    if (packet.intro) form.appendChild(createElement("p", "hp-intro", packet.intro));

    TRACK_ORDER.forEach(function (track) {
      var items = packet.items.filter(function (item) { return item.track === track; });
      if (items.length) form.appendChild(renderTrack(track, items, labels));
    });

    var bar = createElement("div", "hp-bar");
    var submit = createElement("button", "", labels.submit);
    submit.type = "submit";
    var status = createElement("span", "hp-status");
    status.setAttribute("aria-live", "polite");
    bar.appendChild(submit);
    bar.appendChild(status);
    form.appendChild(bar);

    function refreshChangedCount() {
      var changed = collectAnswers(form, packet).filter(function (entry) { return !entry.recommended; }).length;
      status.textContent = changed + " " + labels.changed;
    }
    form.addEventListener("change", refreshChangedCount);
    form.addEventListener("input", refreshChangedCount);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      deliverAnswers(form, packet, labels, status);
    });
    root.appendChild(form);
    refreshChangedCount();
  }

  function renderProblems(root, problems) {
    var list = createElement("div", "hp");
    problems.forEach(function (problem) {
      list.appendChild(createElement("p", "hp-error", "Packet error: " + problem));
    });
    root.appendChild(list);
  }

  var root = document.getElementById("helmsman-packet");
  var source = document.getElementById("helmsman-packet-data");
  var style = createElement("style", "", STYLE);
  document.head.appendChild(style);
  try {
    var packet = JSON.parse(source.textContent);
    var problems = findPacketProblems(packet);
    if (problems.length) renderProblems(root, problems);
    else renderPacket(root, packet);
  } catch (parseError) {
    renderProblems(root, [String(parseError)]);
  }
})();
