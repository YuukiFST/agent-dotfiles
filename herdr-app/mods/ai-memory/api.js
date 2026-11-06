// Talks to the local ai-memory server (HTTP API, root bearer token) and its CLI.
import { exec, home, readTextFile } from "herdr";

// The server's built-in address; its root token sits in the data dir.
const SERVER = "http://127.0.0.1:49374/api/v1";
const TOKEN_FILE = "/AppData/Local/ai-memory/auth-token";

export const enc = (path) => path.split("/").map(encodeURIComponent).join("/");

export class MemoryApi {
  constructor() { this.token = null; }

  async connect() {
    this.token = (await readTextFile(home() + TOKEN_FILE))?.trim() || null;
    return Boolean(this.token);
  }

  async get(path) {
    const r = await fetch(`${SERVER}${path}`, { headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" } });
    if (!r.ok) throw new Error(`ai-memory responded ${r.status}`);
    return r.json();
  }

  scope(p) { return `/workspaces/${encodeURIComponent(p.workspace_name)}/projects/${encodeURIComponent(p.project_name)}`; }

  projects() { return this.get("/projects"); }
  overview(workspace) { return this.get(`/workspaces/${encodeURIComponent(workspace)}/overview?limit=5`); }
  pages(p) { return this.get(`${this.scope(p)}/pages`); }
  page(p, path) { return this.get(`${this.scope(p)}/pages/${enc(path)}`); }
  sessions(p) { return this.get(`${this.scope(p)}/sessions?limit=30&include_open=true`).then((r) => r.sessions); }
  observations(p, id) {
    return this.get(`${this.scope(p)}/sessions/${encodeURIComponent(id)}/observations?limit=200&order=asc&body_max_chars=600`)
      .then((r) => r.observations);
  }
  search(q, p) {
    const scope = p ? `&workspace=${encodeURIComponent(p.workspace_name)}&project=${encodeURIComponent(p.project_name)}` : "";
    return this.get(`/search?q=${encodeURIComponent(q)}&limit=40${scope}`);
  }

  // Hook capture counters only exist in `ai-memory status` (since the server started).
  async capture() {
    const r = await exec("ai-memory", ["status"]);
    if (r.code !== 0) return null;
    const num = (re) => Number(r.stdout.match(re)?.[1] ?? NaN);
    return {
      accepted: num(/accepted:\s+(\d+)/),
      dropped: num(/dropped:\s+(\d+)/),
      saturated: num(/shed:\s+(\d+) saturated/),
      rateLimited: num(/(\d+) rate-limited/),
      lastWrite: r.stdout.match(/last write:\s+(.+)/)?.[1]?.trim() ?? null,
      spoolPending: num(/pending:\s+(\d+)/),
    };
  }
}
