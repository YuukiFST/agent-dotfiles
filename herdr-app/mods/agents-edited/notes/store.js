// The notebook: projects and their notes, in one file both windows share.

import { agents, appHome, exec, home, panes, readTextFile, writeTextFile } from "herdr";

const slash = (path) => path.replace(/\\/g, "/").replace(/\/+$/, "");
export const SHARED_DIR = () => `${slash(home())}/.config/herdr-app-shared`;
const NOTES_FILE = () => `${SHARED_DIR()}/notes.json`;
// image() only reads inside the app's home; herdr-app-2 reaches this folder through a junction.
const IMAGES_FOLDER = "notes-images";
const IMAGES_DIR = () => `${slash(home())}/.config/herdr-app/${IMAGES_FOLDER}`;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|bmp)$/i;
const NO_CLIPBOARD_IMAGE = 2;
const WRITE_ATTEMPTS = 3;

export const isNotesFile = (path) => slash(path).toLowerCase() === NOTES_FILE().toLowerCase();
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const folderName = (folder) => slash(folder).split("/").pop();

function parseBook(text) {
  const book = JSON.parse(text ?? '{"projects":[]}');
  if (!Array.isArray(book.projects)) throw new Error("notes.json has no project list");
  return book;
}

// Null when the file can't be read: the screen keeps what it shows.
export async function readBook() {
  try {
    return parseBook(await readTextFile(NOTES_FILE()));
  } catch {
    return null;
  }
}

// Rereads before writing, so what the other window saved survives; unreadable JSON rejects here
// and is never overwritten.
export async function updateBook(change) {
  for (let attempt = 1; ; attempt++) {
    const text = await readTextFile(NOTES_FILE());
    const book = parseBook(text);
    change(book);
    try {
      await writeTextFile(NOTES_FILE(), `${JSON.stringify(book, null, 2)}\n`, text);
      return book;
    } catch (error) {
      if (attempt === WRITE_ATTEMPTS) throw error;
    }
  }
}

const imageFile = (...args) => exec("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-STA", "-File", `${slash(appHome())}/mods/agents-edited/notes/image-file.ps1`, ...args]);

export const imageAsset = (path) => `${IMAGES_FOLDER}/${path.split("/").pop()}`;
export const isImagePath = (path) => IMAGE_EXTENSION.test(path);
export const openImage = (path) => exec("explorer.exe", [path.replace(/\//g, "\\")]);

// The notebook keeps a copy: a note survives its original screenshot being deleted.
export async function copyImage(source) {
  const target = `${IMAGES_DIR()}/${newId()}${source.match(IMAGE_EXTENSION)[0].toLowerCase()}`;
  const result = await imageFile("copy", target, source);
  if (result.code !== 0) throw new Error(result.stderr.trim());
  return target;
}

// Null when what was pasted is not an image.
export async function pasteImage() {
  const target = `${IMAGES_DIR()}/${newId()}.png`;
  const result = await imageFile("paste", target);
  if (result.code === NO_CLIPBOARD_IMAGE) return null;
  if (result.code !== 0) throw new Error(result.stderr.trim());
  return target;
}

export async function removeImages(paths) {
  for (const path of paths) await imageFile("remove", path);
}

const isInside = (cwd, folder) => {
  if (!cwd) return false;
  const child = slash(cwd).toLowerCase();
  const parent = slash(folder).toLowerCase();
  return child === parent || child.startsWith(`${parent}/`);
};

// Live sessions, those in the project's folder first.
export function sessionsFor(project) {
  const cwdByPane = new Map(panes().map((pane) => [pane.pane, pane.cwd]));
  const sessions = agents().map((agent) => {
    const cwd = cwdByPane.get(agent.pane) ?? null;
    return { ...agent, cwd, inProject: isInside(cwd, project.folder) };
  });
  return [...sessions.filter((s) => s.inProject), ...sessions.filter((s) => !s.inProject)];
}

const noteBody = (note) => {
  const images = note.images ?? [];
  return [note.text, images.length ? `Attached images:\n${images.join("\n")}` : ""].filter(Boolean).join("\n\n");
};

export function composeMessage(project, notes, inProject) {
  const where = inProject ? project.name : `${project.name} (${project.folder})`;
  const body = notes.length === 1 ? noteBody(notes[0]) : notes.map((note, i) => `${i + 1}. ${noteBody(note)}`).join("\n\n");
  return `Notes for project ${where}:\n\n${body}`;
}
