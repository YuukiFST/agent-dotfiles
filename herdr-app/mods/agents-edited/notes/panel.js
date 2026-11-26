// Notes per project, on the status board: write them, keep them, send them to an agent session.

import { div, image, svg } from "gpui-kit";
import { v_flex, h_flex, Textarea, TextareaState } from "gpui-base";
import { agents, hc, notify, pickFolder, run, theme, watchFolder } from "herdr";
import { harnessSwitch, loadHarnesses } from "../harness-switch.js";
import { SHARED_DIR, composeMessage, copyImage, folderName, imageAsset, isImagePath, isNotesFile, newId, openImage, pasteImage, readBook, removeImages, sessionsFor, updateBook } from "./store.js";
import { ACCEPTED_IMAGES, because, clock, notesLocation, plural } from "./words.js";

const NEW_SESSION = "new";
const PICKER_MAX_HEIGHT = 190;
const PROJECT_KEY = "notes.project";
const HARNESS_KEY = "notes.harness";
const SWITCH_TILE_SIZE = 22;
const COPIED_TOAST_MS = 5000;
// Wide enough for a note's actions and the send bar on one line: the board's side columns give way first.
const NOTES_MIN_WIDTH = 320;

export class NotesPanel {
  constructor(cx) {
    this.book = null;
    this.projectId = localStorage.getItem(PROJECT_KEY);
    this.harnessKey = localStorage.getItem(HARNESS_KEY);
    this.harnesses = [];
    this.targetByProject = {};
    this.editingId = null;
    this.armedDeleteId = null;
    this.isPickerOpen = false;
    this.isBusy = false;
    this.feedback = null;
    this.draftImages = [];
    this.draft = TextareaState.new({ placeholder: "New note", rows: 4 });
    this.draft.set_auto_grow(4, 10);
    this.draft.on("paste_other", (_e, cx) => this.attachPastedImage(cx));
    cx.spawn(async (cx) => {
      const book = await readBook();
      this.isUnreadable = !book;
      this.book = book ?? { projects: [] };
      cx.notify();
      this.harnesses = await loadHarnesses().catch(() => []);
      cx.notify();
      for (;;) {
        const changed = await watchFolder(SHARED_DIR());
        if (!changed.some(isNotesFile) && !changed.includes(SHARED_DIR())) continue;
        const book = await readBook();
        this.isUnreadable = !book;
        this.book = book ?? this.book;
        cx.notify();
      }
    });
  }

  project() {
    const projects = this.book?.projects ?? [];
    return projects.find((p) => p.id === this.projectId) ?? projects[0] ?? null;
  }

  selectProject(id, cx) {
    this.cancelEdit();
    this.projectId = id;
    localStorage.setItem(PROJECT_KEY, id);
    this.isPickerOpen = false;
    this.armedDeleteId = null;
    this.feedback = null;
    cx.notify();
  }

  // at: "compose" shows it under the note being written, "send" in the send bar.
  say(text, isError = false, at = "send") {
    this.feedback = { text, isError, at };
  }

  // Writes, redraws, and shows any error on the panel itself.
  save(cx, change, afterSave) {
    cx.spawn(async (cx) => {
      try {
        this.book = await updateBook(change);
        afterSave?.();
      } catch (error) {
        this.say(`Not saved${because(error)}. Try again, or fix notes.json in .config\\herdr-app-shared if it repeats`, true, "compose");
      }
      cx.notify();
    });
  }

  addProject(cx) {
    cx.spawn(async (cx) => {
      const folder = await pickFolder({ prompt: "Use this folder" });
      if (!folder) return;
      const existing = this.book.projects.find((p) => p.folder.toLowerCase() === folder.toLowerCase());
      if (existing) return this.selectProject(existing.id, cx);
      const project = { id: newId(), name: folderName(folder), folder, notes: [] };
      this.save(cx, (book) => book.projects.push(project), () => {
        this.projectId = project.id;
        localStorage.setItem(PROJECT_KEY, project.id);
      });
    });
  }

  saveDraft(cx) {
    const project = this.project();
    const text = this.draft.value().trim();
    const images = [...this.draftImages];
    if (!project || (!text && !images.length)) return;
    const editingId = this.editingId;
    const dropped = (this.editedNote(project)?.images ?? []).filter((path) => !images.includes(path));
    this.save(cx, (book) => {
      const notes = book.projects.find((p) => p.id === project.id).notes;
      if (!editingId) return notes.push({ id: newId(), text, images, created_at: Date.now(), done_at: null, sent: null });
      Object.assign(notes.find((n) => n.id === editingId), { text, images });
    }, () => {
      this.resetDraft();
      removeImages(dropped);
    });
  }

  editedNote(project) {
    return project?.notes.find((n) => n.id === this.editingId) ?? null;
  }

  attachPastedImage(cx) {
    cx.spawn(async (cx) => {
      try {
        const path = await pasteImage();
        if (path) this.draftImages.push(path);
      } catch (error) {
        this.say(`Image not pasted${because(error)}. Copy it again, or drop the file instead`, true, "compose");
      }
      cx.notify();
    });
  }

  attachDroppedFiles(paths, cx) {
    const images = paths.filter(isImagePath);
    const skipped = paths.length - images.length;
    if (skipped) this.say(`Skipped ${plural(skipped, "file")}: only ${ACCEPTED_IMAGES} images attach`, true, "compose");
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        for (const path of images) this.draftImages.push(await copyImage(path));
      } catch (error) {
        this.say(`Image not attached${because(error)}. Check the file still exists and drop it again`, true, "compose");
      }
      cx.notify();
    });
  }

  detachDraftImage(path, cx) {
    this.draftImages = this.draftImages.filter((p) => p !== path);
    const isSaved = (this.editedNote(this.project())?.images ?? []).includes(path);
    if (!isSaved) removeImages([path]);
    cx.notify();
  }

  startEdit(note, cx) {
    this.editingId = note.id;
    this.draft.set_value(note.text);
    this.draftImages = [...(note.images ?? [])];
    this.draft.focus();
    cx.notify();
  }

  resetDraft() {
    this.editingId = null;
    this.draftImages = [];
    this.draft.set_value("");
  }

  cancelEdit() {
    const saved = this.editedNote(this.project())?.images ?? [];
    removeImages(this.draftImages.filter((path) => !saved.includes(path)));
    this.resetDraft();
  }

  changeNote(project, noteId, change, cx) {
    this.save(cx, (book) => change(book.projects.find((p) => p.id === project.id).notes.find((n) => n.id === noteId)));
  }

  deleteNote(project, noteId, cx) {
    if (this.armedDeleteId !== noteId) {
      this.armedDeleteId = noteId;
      return cx.notify();
    }
    this.armedDeleteId = null;
    const images = project.notes.find((n) => n.id === noteId)?.images ?? [];
    this.save(cx, (book) => {
      const owner = book.projects.find((p) => p.id === project.id);
      owner.notes = owner.notes.filter((n) => n.id !== noteId);
    }, () => removeImages(images));
  }

  deleteProject(project, cx) {
    if (this.armedDeleteId !== project.id) {
      this.armedDeleteId = project.id;
      return cx.notify();
    }
    this.armedDeleteId = null;
    const images = project.notes.flatMap((n) => n.images ?? []);
    this.cancelEdit();
    this.save(cx, (book) => {
      book.projects = book.projects.filter((p) => p.id !== project.id);
    }, () => removeImages(images));
  }

  // The switch's pick; before the first click, the agent last active here, else the first installed.
  harness() {
    const installed = this.harnesses.filter((a) => a.installed);
    const latest = agents().reduce((newest, a) => (a.seq > (newest?.seq ?? -1) ? a : newest), null);
    return installed.find((a) => a.key === this.harnessKey) ?? installed.find((a) => a.key === latest?.program.key) ?? installed[0] ?? null;
  }

  // Using the switch means the next send opens a new session with that agent.
  chooseHarness(project, key, cx) {
    this.harnessKey = key;
    localStorage.setItem(HARNESS_KEY, key);
    this.chooseTarget(project, NEW_SESSION, cx);
  }

  // A new session, unless the person picked one that is still alive.
  target(project, sessions) {
    return sessions.find((s) => s.address === this.targetByProject[project.id]) ?? NEW_SESSION;
  }

  send(project, notes, cx) {
    const target = this.target(project, sessionsFor(project));
    if (this.isBusy || !notes.length) return;
    this.isBusy = true;
    this.say("Sending…");
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const destination = target === NEW_SESSION ? await this.startSession(project, notes) : await this.sendToSession(project, notes, target);
        const ids = new Set(notes.map((n) => n.id));
        const sent = { to: destination, at: Date.now() };
        this.book = await updateBook((book) => {
          for (const note of book.projects.find((p) => p.id === project.id).notes) if (ids.has(note.id)) note.sent = sent;
        });
        this.say(`Sent to ${destination}`);
      } catch (error) {
        this.say(`Not sent${because(error)}. Pick another session or try again`, true);
      }
      this.isBusy = false;
      cx.notify();
    });
  }

  async sendToSession(project, notes, session) {
    const result = await hc(["send", "--json", session.address, composeMessage(project, notes, session.inProject)]);
    if (result.code === 0) return `${session.address} (${session.space_name})`;
    let message = result.stderr.trim() || result.stdout.trim();
    try {
      message = JSON.parse(result.stdout).error?.message ?? message;
    } catch {}
    throw new Error(message);
  }

  async startSession(project, notes) {
    const agent = this.harness();
    if (!agent) throw new Error("install Claude Code or OpenCode to start a session");
    run("space.new", { name: project.name, folder: project.folder, argv: agent.run, task: composeMessage(project, notes, true) });
    return `new ${agent.name} session`;
  }

  chooseTarget(project, address, cx) {
    this.targetByProject[project.id] = address;
    this.isPickerOpen = false;
    this.feedback = null;
    cx.notify();
  }

  togglePicker(cx) {
    this.isPickerOpen = !this.isPickerOpen;
    cx.notify();
  }

  key(e, cx) {
    if (e.key === "enter" && e.modifiers.control) {
      this.saveDraft(cx);
      cx.stop_propagation();
    }
    if (e.key === "escape" && this.editingId) {
      this.cancelEdit();
      cx.notify();
    }
  }

  // edge: "first" or "last" when the action starts or ends a row, so its glyphs sit on the inset line (ALIGNMENT.md).
  action(id, label, color, onClick, edge = null) {
    const t = theme();
    return div().id(id).flex_none().px(6).h(22).flex().items_center().rounded(5).text_size(11.5).text_color(color).cursor_pointer()
      .when(edge === "first", (el) => el.ml_neg_1p5()).when(edge === "last", (el) => el.mr_neg_1p5())
      .hover((s) => s.bg(t.hover)).on_click(onClick).child(label);
  }

  copyLocationButton(project) {
    const t = theme();
    const label = "Copy where these notes live, to paste into an agent's prompt";
    return h_flex().id("copy-notes-location").flex_none().size(22).items_center().justify_center().rounded(5).cursor_pointer()
      .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(label).accessibility_label(label)
      .on_click((_e, cx) => {
        cx.write_to_clipboard(notesLocation(project));
        notify({ title: "Notes location copied", level: "success", timeout: COPIED_TOAST_MS });
      })
      .child(svg("mods/agents-edited/notes/copy.svg").size(12));
  }

  button(id, label, isPrimary, onClick) {
    const t = theme();
    return div().id(id).flex_none().px(10).h(26).flex().items_center().rounded(6).text_size(12).cursor_pointer()
      .bg(isPrimary ? t.solid : t.raised).text_color(isPrimary ? t.solid_foreground : t.foreground)
      .hover((s) => (isPrimary ? s.opacity(0.88) : s.bg(t.hover))).on_click(onClick).child(label);
  }

  projectChip(project, isActive) {
    const t = theme();
    const open = project.notes.filter((n) => !n.done_at).length;
    return h_flex().id(`project-${project.id}`).max_w_full().min_w(0).h(24).px(8).gap(6).items_center().rounded(6).cursor_pointer().text_size(12)
      .text_color(isActive ? t.foreground : t.muted).when(isActive, (el) => el.bg(t.selected)).when(!isActive, (el) => el.hover((s) => s.bg(t.hover)))
      .aria_selected(isActive).tooltip(project.folder).on_click((_e, cx) => this.selectProject(project.id, cx))
      .child(div().min_w(0).truncate().child(project.name)).child(div().flex_none().text_size(11).text_color(t.muted).child(String(open)));
  }

  thumbnail(id, path, onRemove) {
    const t = theme();
    return h_flex().id(`thumb-${id}`).flex_none().max_w_full().overflow_hidden().relative().rounded(5).border_1().border_color(t.border).cursor_pointer()
      .tooltip("Open image").accessibility_label("Open image").on_click(() => openImage(path))
      .child(image(imageAsset(path)).w(104).h(72).rounded(4))
      .when(Boolean(onRemove), (el) => el.child(div().id(`detach-${id}`).absolute().top(2).left(2).size(24).flex().items_center().justify_center()
        .rounded(4).bg(t.chrome).text_color(t.foreground).hover((s) => s.bg(t.hover))
        .tooltip("Remove image").accessibility_label("Remove image")
        .on_click((e, cx) => { cx.stop_propagation(); onRemove(e, cx); }).child(svg("mods/workspace-chrome/x.svg").size(12))));
  }

  noteState(note) {
    if (note.done_at) return `done ${clock(note.done_at)}`;
    if (note.sent) return `sent ${clock(note.sent.at)} · ${note.sent.to}`;
    return "";
  }

  // A row between dividers, like the board's other lists; the note being edited takes the selected fill.
  noteRow(project, note) {
    const t = theme();
    const lines = note.text.split("\n").map((line, i) => div().id(`line-${note.id}-${i}`).min_h(16).whitespace_normal().child(line));
    const isArmed = this.armedDeleteId === note.id;
    const state = this.noteState(note);
    return v_flex().id(`note-${note.id}`).flex_none().px(12).py(10).gap(6).border_b(1).border_color(t.border)
      .when(this.editingId === note.id, (el) => el.bg(t.selected))
      .when(Boolean(note.text), (el) => el.child(v_flex().gap(2).text_size(12.5).text_color(note.done_at ? t.muted : t.foreground).children(lines)))
      .when(Boolean(note.images?.length), (el) => el.child(h_flex().flex_wrap().gap(6).children(note.images.map((path, i) => this.thumbnail(`${note.id}-${i}`, path, null)))))
      .child(h_flex().flex_wrap().items_center()
        .when(!note.done_at, (el) => el.child(this.action(`send-${note.id}`, note.sent ? "Resend" : "Send", t.accent, (_e, cx) => this.send(project, [note], cx), "first")))
        .child(this.action(`edit-${note.id}`, "Edit", t.muted, (_e, cx) => this.startEdit(note, cx), note.done_at ? "first" : null))
        .child(this.action(`done-${note.id}`, note.done_at ? "Reopen" : "Done", t.muted, (_e, cx) => {
          this.changeNote(project, note.id, (n) => { n.done_at = n.done_at ? null : Date.now(); }, cx);
        }))
        .child(div().id(`state-${note.id}`).flex_1().min_w(0).px(6).truncate().text_size(11).text_color(t.muted).when(Boolean(state), (el) => el.tooltip(state)).child(state))
        .child(this.action(`del-${note.id}`, isArmed ? "Delete note" : "Delete", isArmed ? t.blocked : t.muted, (_e, cx) => this.deleteNote(project, note.id, cx), "last")));
  }

  sessionRow(id, label, detail, isChosen, onClick) {
    const t = theme();
    return h_flex().id(id).h(28).flex_none().px(8).gap(8).items_center().rounded(6).cursor_pointer().text_size(12)
      .bg(isChosen ? t.selected : t.background).when(!isChosen, (el) => el.hover((s) => s.bg(t.hover)))
      .aria_selected(isChosen).tooltip(`${label} · ${detail}`).on_click(onClick)
      .child(div().flex_none().text_color(t.foreground).child(label))
      .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(detail));
  }

  sessionPicker(project, sessions, target) {
    const t = theme();
    const rows = sessions.map((s) => this.sessionRow(`session-${s.address}`, s.address,
      `${s.space_name} · ${s.status}${s.inProject ? " · in this folder" : ""}`, target?.address === s.address,
      (_e, cx) => this.chooseTarget(project, s.address, cx)));
    const harness = this.harness();
    return v_flex().id("session-list").flex_none().max_h(PICKER_MAX_HEIGHT).gap(2).overflow_y_scrollbar()
      .when(Boolean(harness), (el) => el.child(this.sessionRow("session-new", "New session",
        `${harness.name} in ${folderName(project.folder)}`, target === NEW_SESSION,
        (_e, cx) => this.chooseTarget(project, NEW_SESSION, cx))))
      .children(rows)
      .when(!rows.length && !harness, (el) => el.child(div().p(8).text_size(12).text_color(t.muted).whitespace_normal()
        .child("No open sessions. Install Claude Code or OpenCode to start one")));
  }

  // Lit only while a send would really start that agent.
  harnessSwitch(project, target) {
    const lit = target === NEW_SESSION ? this.harness()?.key : null;
    return harnessSwitch(theme(), "harness-switch", this.harnesses, lit, SWITCH_TILE_SIZE, (key, cx) => this.chooseHarness(project, key, cx));
  }

  // The last message, where its action happened: under the note being written, or in the send bar.
  feedbackLine(at) {
    const t = theme();
    if (this.feedback?.at !== at) return null;
    return div().flex_none().text_size(11.5).whitespace_normal().text_color(this.feedback.isError ? t.blocked : t.muted).child(this.feedback.text);
  }

  sendBar(project, pending) {
    const t = theme();
    const sessions = sessionsFor(project);
    const target = this.target(project, sessions);
    const harness = this.harness();
    const newSessionLabel = harness ? `New ${harness.name} session` : "New session";
    const targetLabel = target === NEW_SESSION ? newSessionLabel : `${target.address} · ${target.space_name}`;
    const feedback = this.feedbackLine("send");
    return v_flex().flex_none().px(12).py(10).gap(8).border_t(1).border_color(t.border)
      .when(Boolean(feedback), (el) => el.child(feedback))
      .when(this.isPickerOpen, (el) => el.child(this.sessionPicker(project, sessions, target)))
      .child(h_flex().flex_none().flex_wrap().gap(8).items_center()
        .child(this.harnessSwitch(project, target))
        .child(h_flex().id("session-toggle").flex_1().min_w(80).h(26).px(8).gap(6).items_center().rounded(6).cursor_pointer()
          .bg(t.raised).hover((s) => s.bg(t.hover)).text_size(12).text_color(t.foreground)
          .tooltip(`Send to ${targetLabel}`).accessibility_label(`Send to ${targetLabel}`)
          .on_click((_e, cx) => this.togglePicker(cx))
          .child(div().flex_1().min_w(0).truncate().child(targetLabel))
          .child(svg(`mods/workspace-chrome/chevron-${this.isPickerOpen ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.muted)))
        .when(pending.length > 0, (el) => el.child(this.button("send-pending", `Send ${plural(pending.length, "note")}`, true, (_e, cx) => this.send(project, pending, cx)))));
  }

  composer() {
    const t = theme();
    const feedback = this.feedbackLine("compose");
    return v_flex().id("composer").flex_none().px(12).py(10).gap(8).border_b(1).border_color(t.border).on_key_down((e, cx) => this.key(e, cx))
      .child(Textarea.new(this.draft).accessibility_label("New note").flex_none().px(8).py(6).rounded(6).border_1().border_color(t.input).bg(t.background).text_size(12.5).text_color(t.foreground))
      .when(this.draftImages.length > 0, (el) => el.child(h_flex().flex_none().flex_wrap().gap(6).children(this.draftImages.map((path, i) => this.thumbnail(`draft-${i}`, path, (_e, cx) => this.detachDraftImage(path, cx))))))
      .when(Boolean(feedback), (el) => el.child(feedback))
      .child(h_flex().flex_none().gap(6).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child(`Paste or drop images · Ctrl+Enter ${this.editingId ? "saves" : "adds"}`))
        .when(Boolean(this.editingId), (el) => el.child(this.button("cancel-edit", "Cancel", false, (_e, cx) => { this.cancelEdit(); cx.notify(); })))
        .child(this.button("save-note", this.editingId ? "Save" : "Add", false, (_e, cx) => this.saveDraft(cx))));
  }

  noteList(project, open, done) {
    const t = theme();
    return v_flex().id("note-list").flex_1().min_h(0).overflow_y_scrollbar()
      .when(!project.notes.length, (el) => el.child(div().px(12).py(18).text_size(12).text_color(t.muted).child("No notes yet. Write one above and press Ctrl+Enter")))
      .children([...open, ...done].map((note) => this.noteRow(project, note)));
  }

  header(project) {
    const t = theme();
    const isArmed = this.armedDeleteId === project?.id;
    const noteCount = project?.notes.length ?? 0;
    // The first row is as tall as the summary strip beside it, so both read on one line.
    return v_flex().flex_none().px(12).pb(6).gap(4).border_b(1).border_color(t.border)
      .child(h_flex().id("project-tabs").min_h(30).max_h(84).overflow_y_scrollbar().gap(6).items_center().flex_wrap()
        .child(div().flex_none().text_size(11).text_color(t.muted).child("Notes"))
        .child(this.copyLocationButton(project))
        .children((this.book?.projects ?? []).map((p) => this.projectChip(p, p.id === project?.id)))
        .child(this.action("add-project", "Add project", t.muted, (_e, cx) => this.addProject(cx))))
      .when(Boolean(project), (el) => el.child(h_flex().gap(6).items_center()
        .child(div().id("project-folder").flex_1().min_w(0).truncate().text_ellipsis_start().text_size(11).text_color(t.muted).tooltip(project.folder).child(project.folder))
        .child(this.action("del-project", isArmed ? `Delete project and ${plural(noteCount, "note")}` : "Delete project", isArmed ? t.blocked : t.muted,
          (_e, cx) => this.deleteProject(project, cx), "last"))));
  }

  emptyState() {
    const t = theme();
    const box = v_flex().flex_1().items_center().justify_center().gap(10).p(20).text_size(12.5).text_color(t.muted);
    if (this.isUnreadable) return box.child(div().whitespace_normal().child("notes.json in .config\\herdr-app-shared could not be read. Fix the file and the notes come back"));
    return box.child("Add a project's folder to start")
      .child(this.button("first-project", "Add project", true, (_e, cx) => this.addProject(cx)));
  }

  render(t) {
    const project = this.project();
    const card = v_flex().id("notes").flex_1().min_h(0).min_w(NOTES_MIN_WIDTH).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
      .on_drop((e, cx) => this.attachDroppedFiles(e.paths, cx)).child(this.header(project));
    if (!this.book) return card;
    if (!project) return card.child(this.emptyState());
    const open = project.notes.filter((n) => !n.done_at);
    const done = project.notes.filter((n) => n.done_at);
    return card.child(this.composer()).child(this.noteList(project, open, done)).child(this.sendBar(project, open.filter((n) => !n.sent)));
  }
}
