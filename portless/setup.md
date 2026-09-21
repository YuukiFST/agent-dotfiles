# portless — setup e uso

Named `.localhost` URLs em vez de portas. Proxy HTTPS local na 443; cada dev server
ganha URL estável (`https://iptu.localhost`) e porta aleatória via env `PORT`.

**Por que no meu fluxo:** agentes (chrome-devtools-axi, webapp-testing) abrem URL fixa em vez
de adivinhar porta; worktrees ganham subdomínio por branch (`fix-ui.iptu.localhost`) com
cookies/storage isolados — dois agentes em worktrees paralelos não se pisam.

**Requisito duro: Node 24+.** Com Node ≤22 o CLI instala mas falha no doctor.
Já instalado pelos setup scripts (`npm i -g portless`); só falta o Node e o bootstrap.

## Bootstrap (uma vez por máquina)

```bash
portless doctor            # confere Node, proxy, CA, DNS
portless service install   # proxy sobe junto com o OS (443, daemon)
portless trust             # CA local no trust store (HTTPS sem aviso)
```

Windows: rodar num terminal admin na primeira vez (bind da 443 + trust da CA).
NixOS: `nodejs_24` no systemPackages; bind da 443 como usuário exige
`security.wrappers` com `cap_net_bind_service` no node do proxy, ou rodar
`portless service install` (systemd user unit) e liberar a porta:

```nix
boot.kernel.sysctl."net.ipv4.ip_unprivileged_port_start" = 443;
```

## Uso diário

```bash
portless                      # roda o script "dev" do package.json → https://<pasta>.localhost
portless iptu pnpm dev        # nome explícito → https://iptu.localhost
portless run next dev         # em worktree → https://<branch>.<projeto>.localhost
portless get iptu             # imprime a URL (para outro serviço/agente referenciar)
portless alias api 8080       # rota estática (Docker, serviço fora do portless)
portless list                 # rotas ativas
portless prune                # mata dev servers órfãos de sessões que crasharam
```

`portless.json` opcional na raiz do projeto: `{ "name": "iptu" }` fixa o nome
independente da pasta. Monorepo: `{ "apps": { "apps/web": { "name": "iptu" } } }`.

## Gotchas

- TLD: ficar no `.localhost` (default) ou `.test`. Nunca `.local` (mDNS) nem `.dev` (HSTS do Google).
- Proxy escuta só loopback; LAN é opt-in explícito.
- Pre-1.0 — formato do state dir pode mudar entre releases; `portless clean` reseta.
- Frameworks que ignoram `PORT` (Vite, Astro, Angular, Expo) recebem `--port`/`--host` injetados automaticamente.
- Exposição externa quando precisar: `--tailscale` (tailnet), `--funnel`/`--ngrok` (público — cuidado).

## Agentes

Convenção: se o projeto tem rota portless registrada, o agente usa
`https://<nome>.localhost` (descoberta via `portless list` / `portless get <nome>`)
em vez de `http://localhost:<porta>`. Fallback para porta direta quando o proxy
não está de pé (`portless doctor` falhou).
