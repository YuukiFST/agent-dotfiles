// Notes per project, on the status board: write them, keep them, send them to an agent session.

import { div, image } from "gpui-kit";
import { v_flex, h_flex, Textarea, TextareaState } from "gpui-base";
import { agents, hc, knownAgents, pickFolder, run, theme, watchFolder } from "herdr";
import { SHARED_DIR, composeMessage, copyImage, folderName, imageAsset, isImagePath, isNotesFile, newId, openImage, pasteImage, readBook, removeImages, sessionsFor, updateBook } from "./store.js";

const NEW_SESSION = "new";
const PICKER_MAX_HEIGHT = 190;
const PROJECT_KEY = "notes.project";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const twoDigits = (value) => String(value).padStart(2, "0");
const clock = (ms) => {
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()]} ${date.getDate()} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
};

// The agent last active here, so notes follow whichever one is in use; else the first installed.
async function agentForNewSession() {
  const installed = (await knownAgents()).filter((a) => a.installed);
  const latest = agents().reduce((newest, a) => (a.seq > (newest?.seq ?? -1) ? a : newest), null);
  return installed.find((a) => a.key === latest?.program.key) ?? installed[0];
}

export class NotesPanel {
  constructor(cx) {
    this.book = null;
    this.projectId = localStorage.getItem(PROJECT_KEY);
    this.targetByProject = {};
    this.editingId = null;
    this.armedDeleteId = null;
    this.isPickerOpen = false;
    this.isBusy = false;
    this.feedback = null;
    this.draftImages = [];
    this.draft = TextareaState.new({ placeholder: "New note (Ctrl+Enter saves)", rows: 4 });
    this.draft.set_auto_grow(4, 10);
    this.draft.on("paste_other", (_e, cx) => this.attachPastedImage(cx));
    cx.spawn(async (cx) => {
      this.book = (await readBook()) ?? { projects: [] };
      cx.notify();
      for (;;) {
        const changed = await watchFolder(SHARED_DIR());
        if (!changed.some(isNotesFile) && !changed.includes(SHARED_DIR())) continue;
        this.book = (await readBook()) ?? this.book;
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

  say(text, isError = false) {
    this.feedback = { text, isError };
  }

  // Writes, redraws, and shows any error on the panel itself.
  save(cx, change, afterSave) {
    cx.spawn(async (cx) => {
      try {
        this.book = await updateBook(change);
        afterSave?.();
      } catch (error) {
        this.say(`Not saved: ${error?.message ?? error}`, true);
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
        this.say(`Image not pasted: ${error?.message ?? error}`, true);
      }
      cx.notify();
    });
  }

  attachDroppedFiles(paths, cx) {
    const images = paths.filter(isImagePath);
    if (images.length < paths.length) this.say("Only images can be attached.", true);
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        for (const path of images) this.draftImages.push(await copyImage(path));
      } catch (error) {
        this.say(`Image not attached: ${error?.message ?? error}`, true);
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

  // Picks on its own only a session in the project's folder: asking beats sending to the wrong one.
  target(project, sessions) {
    const chosen = this.targetByProject[project.id];
    if (chosen === NEW_SESSION) return NEW_SESSION;
    return sessions.find((s) => s.address === chosen) ?? sessions.find((s) => s.inProject) ?? null;
  }

  send(project, notes, cx) {
    const sessions = sessionsFor(project);
    const target = this.target(project, sessions);
    if (!target) {
      this.openPicker(cx);
      this.say("Choose the session that gets the note.", true);
      return cx.notify();
    }
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
        this.say(`Sent to ${destination}.`);
      } catch (error) {
        this.say(`Not sent: ${error?.message ?? error}`, true);
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
    const agent = await agentForNewSession();
    if (!agent) throw new Error("no agent installed");
    run("space.new", { name: project.name, folder: project.folder, argv: agent.run, task: composeMessage(project, notes, true) });
    return `new ${agent.name} session`;
  }

  chooseTarget(project, address, cx) {
    this.targetByProject[project.id] = address;
    this.isPickerOpen = false;
    this.feedback = null;
    cx.notify();
  }

  openPicker(cx) {
    this.isPickerOpen = true;
    cx.spawn(async (cx) => {
      this.newSessionAgent = (await agentForNewSession())?.name ?? null;
      cx.notify();
    });
  }

  togglePicker(cx) {
    if (this.isPickerOpen) this.isPickerOpen = false;
    else this.openPicker(cx);
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

  action(id, label, color, onClick) {
    const t = theme();
    return div().id(id).flex_none().px(6).h(22).flex().items_center().rounded(5).text_size(11.5).text_color(color).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click(onClick).child(label);
  }

  button(id, label, isPrimary, onClick) {
    const t = theme();
    return div().id(id).flex_none().px(10).h(26).flex().items_center().rounded(6).text_size(12).cursor_pointer()
      .bg(isPrimary ? t.solid : t.raised).text_color(isPrimary ? t.solid_foreground : t.foreground)
      .hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
  }

  projectChip(project, isActive) {
    const t = theme();
    const open = project.notes.filter((n) => !n.done_at).length;
    return h_flex().id(`project-${project.id}`).h(24).px(8).gap(6).items_center().rounded(6).cursor_pointer().text_size(12)
      .bg(isActive ? t.selected : t.raised).text_color(isActive ? t.foreground : t.muted).hover((s) => s.bg(t.hover))
      .tooltip(project.folder).on_click((_e, cx) => this.selectProject(project.id, cx))
      .child(project.name).child(div().text_size(11).text_color(t.dim).child(String(open)));
  }

  thumbnail(id, path, onRemove) {
    const t = theme();
    return h_flex().id(`thumb-${id}`).flex_none().relative().rounded(5).border_1().border_color(t.border).cursor_pointer()
      .tooltip("Open image").on_click(() => openImage(path))
      .child(image(imageAsset(path)).w(104).h(72).rounded(4))
      .when(Boolean(onRemove), (el) => el.child(div().id(`detach-${id}`).absolute().top(2).right(2).size(16).flex().items_center().justify_center()
        .rounded(4).bg(t.chrome).text_size(11).text_color(t.foreground).hover((s) => s.bg(t.hover))
        .on_click((e, cx) => { cx.stop_propagation(); onRemove(e, cx); }).child("×")));
  }

  noteState(note) {
    if (note.done_at) return `done ${clock(note.done_at)}`;
    if (note.sent) return `sent ${clock(note.sent.at)} · ${note.sent.to}`;
    return "";
  }

  noteCard(project, note) {
    const t = theme();
    const lines = note.text.split("\n").map((line, i) => div().id(`line-${note.id}-${i}`).min_h(16).whitespace_normal().child(line));
    const isArmed = this.armedDeleteId === note.id;
    return v_flex().id(`note-${note.id}`).flex_none().p(10).gap(6).rounded(8).bg(t.background).border_1()
      .border_color(this.editingId === note.id ? t.accent : t.border)
      .when(Boolean(note.done_at), (el) => el.opacity(0.55))
      .when(Boolean(note.text), (el) => el.child(v_flex().gap(2).text_size(12.5).text_color(t.foreground).children(lines)))
      .when(Boolean(note.images?.length), (el) => el.child(h_flex().flex_wrap().gap(6).children(note.images.map((path, i) => this.thumbnail(`${note.id}-${i}`, path, null)))))
      .child(h_flex().gap(2).items_center()
        .when(!note.done_at, (el) => el.child(this.action(`send-${note.id}`, note.sent ? "Resend" : "Send", t.accent, (_e, cx) => this.send(project, [note], cx))))
        .child(this.action(`edit-${note.id}`, "Edit", t.muted, (_e, cx) => this.startEdit(note, cx)))
        .child(this.action(`done-${note.id}`, note.done_at ? "Reopen" : "Done", t.muted, (_e, cx) => {
          this.changeNote(project, note.id, (n) => { n.done_at = n.done_at ? null : Date.now(); }, cx);
        }))
        .child(div().flex_1().min_w(0).px(6).truncate().text_size(11).text_color(t.dim).child(this.noteState(note)))
        .child(this.action(`del-${note.id}`, isArmed ? "Confirm" : "Delete", isArmed ? t.blocked : t.dim, (_e, cx) => this.deleteNote(project, note.id, cx))));
  }

  sessionRow(id, label, detail, isChosen, onClick) {
    const t = theme();
    return h_flex().id(id).h(28).flex_none().px(8).gap(8).items_center().rounded(6).cursor_pointer().text_size(12)
      .bg(isChosen ? t.selected : t.background).hover((s) => s.bg(t.hover)).on_click(onClick)
      .child(div().flex_none().text_color(t.foreground).child(label))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(detail));
  }

  sessionPicker(project, sessions, target) {
    const t = theme();
    const rows = sessions.map((s) => this.sessionRow(`session-${s.address}`, s.address,
      `${s.space_name} · ${s.status}${s.inProject ? " · in this folder" : ""}`, target?.address === s.address,
      (_e, cx) => this.chooseTarget(project, s.address, cx)));
    return v_flex().id("session-list").flex_none().max_h(PICKER_MAX_HEIGHT).gap(2).overflow_y_scrollbar()
      .children(rows)
      .when(Boolean(this.newSessionAgent), (el) => el.child(this.sessionRow("session-new", "New session",
        `${this.newSessionAgent} in ${folderName(project.folder)}`, target === NEW_SESSION,
        (_e, cx) => this.chooseTarget(project, NEW_SESSION, cx))))
      .when(!rows.length && !this.newSessionAgent, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child("No open sessions.")));
  }

  sendBar(project, pending) {
    const t = theme();
    const sessions = sessionsFor(project);
    const target = this.target(project, sessions);
    const targetLabel = target === NEW_SESSION ? "New session" : target ? `${target.address} · ${target.space_name}` : "Choose session";
    return v_flex().flex_none().p(10).gap(8).border_t(1).border_color(t.border)
      .when(Boolean(this.feedback), (el) => el.child(div().flex_none().text_size(11.5).whitespace_normal().text_color(this.feedback.isError ? t.blocked : t.muted).child(this.feedback.text)))
      .when(this.isPickerOpen, (el) => el.child(this.sessionPicker(project, sessions, target)))
      .child(h_flex().flex_none().gap(8).items_center()
        .child(h_flex().id("session-toggle").flex_1().min_w(0).h(26).px(8).gap(6).items_center().rounded(6).cursor_pointer()
          .bg(t.raised).hover((s) => s.bg(t.hover)).text_size(12).text_color(target ? t.foreground : t.muted)
          .on_click((_e, cx) => this.togglePicker(cx))
          .child(div().flex_1().min_w(0).truncate().child(targetLabel))
          .child(div().text_color(t.dim).child(this.isPickerOpen ? "▾" : "▴")))
        .when(pending.length > 0, (el) => el.child(this.button("send-pending", `Send ${pending.length}`, true, (_e, cx) => this.send(project, pending, cx)))));
  }

  composer() {
    const t = theme();
    return v_flex().id("composer").flex_none().p(10).gap(8).border_b(1).border_color(t.border).on_key_down((e, cx) => this.key(e, cx))
      .child(Textarea.new(this.draft).flex_none().px(8).py(6).rounded(6).border_1().border_color(t.input).bg(t.background).text_size(12.5).text_color(t.foreground))
      .when(this.draftImages.length > 0, (el) => el.child(h_flex().flex_none().flex_wrap().gap(6).children(this.draftImages.map((path, i) => this.thumbnail(`draft-${i}`, path, (_e, cx) => this.detachDraftImage(path, cx))))))
      .child(h_flex().flex_none().gap(6).items_center()
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child("Paste or drop images"))
        .when(Boolean(this.editingId), (el) => el.child(this.button("cancel-edit", "Cancel", false, (_e, cx) => { this.cancelEdit(); cx.notify(); })))
        .child(this.button("save-note", this.editingId ? "Save" : "Add", false, (_e, cx) => this.saveDraft(cx))));
  }

  noteList(project, open, done) {
    const t = theme();
    return v_flex().id("note-list").flex_1().min_h(0).p(10).gap(8).overflow_y_scrollbar()
      .when(!project.notes.length, (el) => el.child(div().p(8).text_size(12).text_color(t.dim).child("No notes in this project.")))
      .children([...open, ...done].map((note) => this.noteCard(project, note)));
  }

  header(project) {
    const t = theme();
    const isArmed = this.armedDeleteId === project?.id;
    return v_flex().flex_none().px(10).py(6).gap(4).border_b(1).border_color(t.border)
      .child(h_flex().gap(6).items_center().flex_wrap()
        .child(div().flex_none().pr(4).text_size(11).text_color(t.dim).child("Notes"))
        .children((this.book?.projects ?? []).map((p) => this.projectChip(p, p.id === project?.id)))
        .child(this.action("add-project", "+ Project", t.muted, (_e, cx) => this.addProject(cx))))
      .when(Boolean(project), (el) => el.child(h_flex().gap(6).items_center()
        .child(div().id("project-folder").flex_1().min_w(0).truncate().text_ellipsis_start().text_size(11).text_color(t.dim).tooltip(project.folder).child(project.folder))
        .child(this.action("del-project", isArmed ? "Delete project and notes?" : "Remove", isArmed ? t.blocked : t.dim, (_e, cx) => this.deleteProject(project, cx)))));
  }

  emptyState() {
    const t = theme();
    return v_flex().flex_1().items_center().justify_center().gap(10).p(20).text_size(12.5).text_color(t.dim)
      .child("Add a project's folder to start.")
      .child(this.button("first-project", "Add project", true, (_e, cx) => this.addProject(cx)));
  }

  render(t) {
    const project = this.project();
    const card = v_flex().id("notes").flex_1().min_h(0).min_w(0).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
      .on_drop((e, cx) => this.attachDroppedFiles(e.paths, cx)).child(this.header(project));
    if (!this.book) return card;
    if (!project) return card.child(this.emptyState());
    const open = project.notes.filter((n) => !n.done_at);
    const done = project.notes.filter((n) => n.done_at);
    return card.child(this.composer()).child(this.noteList(project, open, done)).child(this.sendBar(project, open.filter((n) => !n.sent)));
  }
}
