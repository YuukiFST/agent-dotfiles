// The panel's words: dates, counts, error reasons and the notes location it copies.

import { SHARED_DIR } from "./store.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const ACCEPTED_IMAGES = "PNG, JPG, GIF, WebP and BMP";
// ": reason" from an error, or nothing when it carries no text.
export const because = (error) => {
  const reason = String(error?.message ?? error ?? "").trim();
  return reason ? `: ${reason}` : "";
};
export const plural = (n, noun) => `${n} ${n === 1 ? noun : `${noun}s`}`;
const twoDigits = (value) => String(value).padStart(2, "0");
const windowsPath = (path) => path.replace(/\//g, "\\");

// What the copy icon puts on the clipboard: where the notes live and how one reads, so the
// person's prompt says what to do with them (review them, check what is done, add one).
export const notesLocation = (project) => {
  const file = windowsPath(`${SHARED_DIR()}/notes.json`);
  const where = project
    ? `Herdr Notes for the project ${project.name} (${windowsPath(project.folder)}): the entry of "projects" in ${file} whose "folder" is that path.`
    : `Herdr Notes: ${file}, one entry per project in "projects".`;
  return [
    where,
    'Each note: {"id", "text", "images": [image paths], "created_at": ms, "done_at": ms when marked done or null while open, "sent": {"to", "at"} or null}.',
    'To add a note: reread the file, append to that project\'s "notes" with a new id, created_at = now in ms, images [], done_at null and sent null, keep the JSON valid and leave everything else untouched.',
  ].join("\n");
};
export const clock = (ms) => {
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()]} ${date.getDate()} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
};
