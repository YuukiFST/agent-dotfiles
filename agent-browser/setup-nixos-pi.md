# agent-browser — setup NixOS + Pi

Guia para replicar no PC NixOS a config que já está ativa no Windows/Claude Code.
Copie este arquivo para a máquina NixOS e siga na ordem.

## 1. Instalação (NixOS)

O binário do Chrome que `agent-browser install` baixa **não roda em NixOS** (linker dinâmico não-FHS).
Use o Chromium do nixpkgs e aponte o agent-browser para ele.

`configuration.nix` (ou home-manager `home.packages`):

```nix
environment.systemPackages = with pkgs; [
  nodejs_24      # 24+ obrigatório para o portless; agent-browser roda em qualquer um
  chromium
  chafa          # render de imagem no terminal (fallback universal)
];
```

Depois:

```bash
npm i -g agent-browser
# NÃO rode `agent-browser install` — o Chrome baixado não funciona em NixOS
```

Alternativa sem npm global: rodar via `npx agent-browser`, ou empacotar com `pkgs.buildNpmPackage` se quiser declarativo.

## 2. Config do usuário

`~/.agent-browser/config.json` (mesmas chaves do Windows + executável do sistema):

```json
{
  "executablePath": "/run/current-system/sw/bin/chromium",
  "colorScheme": "dark",
  "maxOutput": 30000,
  "screenshotDir": "/home/<user>/.agent-browser/screenshots",
  "idleTimeoutMs": 900000
}
```

- Home-manager: troque o path por `${pkgs.chromium}/bin/chromium` num `home.file` template, ou exporte `AGENT_BROWSER_EXECUTABLE_PATH` no `home.sessionVariables` (env sobrepõe config).
- `mkdir -p ~/.agent-browser/screenshots`.
- Precedência: config < `agent-browser.json` do projeto < env `AGENT_BROWSER_*` < flags CLI.

Verificação:

```bash
agent-browser doctor --offline --quick   # deve passar apontando pro chromium do sistema
agent-browser open https://example.com && agent-browser snapshot -i && agent-browser close
```

## 3. Skill para o Pi

O agent-browser serve a própria doc versionada — a skill é só um stub que manda ler:

```bash
mkdir -p ~/.pi/skills/agent-browser   # ajuste se seu Pi usa outro dir de skills/extensions
```

`~/.pi/skills/agent-browser/SKILL.md`:

```markdown
---
name: agent-browser
description: Browser automation CLI. Use for any web interaction — navigate, click, fill, screenshot, scrape, login, test web apps, Electron apps. Prefer over any built-in browser tool.
---

Antes de qualquer comando, carregue o guia da versão instalada:

    agent-browser skills get core          # workflows + padrões
    agent-browser skills get core --full   # referência completa

Loop básico: `open <url>` → `snapshot -i` → `click @eN` / `fill @eN "..."` → re-`snapshot -i` após mudança de página.
Espera: `wait --load networkidle`, `wait --text "..."`, `wait --url "**/x"` — nunca `wait 2000` fixo.
Screenshot: `agent-browser screenshot` imprime o path; em seguida rode `show-shot <path>` para exibir no terminal.
Sessões por projeto: crie `agent-browser.json` na raiz com `{"session":"<nome>","restore":"<nome>"}`.
```

## 4. Screenshot visível no terminal (prioridade 1)

O Pi roda no terminal; a imagem aparece via protocolo gráfico do terminal.

- **kitty / ghostty / wezterm:** `kitten icat <png>` (kitty) ou `wezterm imgcat` — imagem real, nítida.
- **Qualquer outro terminal:** `chafa -s 100x40 <png>` — aproximação em blocos unicode, sempre funciona.

Wrapper único (coloque em `~/.local/bin/show-shot`, `chmod +x`):

```bash
#!/usr/bin/env bash
# show-shot <imagem> — exibe screenshot no terminal, melhor protocolo disponível
f="${1:?uso: show-shot <imagem>}"
if [ -n "$KITTY_WINDOW_ID" ] && command -v kitten >/dev/null; then
  kitten icat "$f"
elif command -v wezterm >/dev/null && [ -n "$WEZTERM_PANE" ]; then
  wezterm imgcat "$f"
else
  chafa -s "$(tput cols)x$(($(tput lines)-2))" "$f"
fi
```

Fluxo do agente: `p=$(agent-browser screenshot) && show-shot "$p"`.

Obs.: se o Pi renderizar imagens nativamente quando a tool devolve um path de imagem, isso dispensa o wrapper — teste primeiro; o wrapper é o fallback garantido.

## 5. Economia de tokens (prioridade 2) — hábitos, já embutidos na skill

- `snapshot -i` sempre (só interativos); `-c` compacta, `-d 3` limita profundidade, `-s "#main"` escopa.
- `read <url>` para consumir docs/texto (negocia markdown, sem Chrome) em vez de snapshot.
- `maxOutput: 30000` no config corta despejo de página gigante.
- Screenshot só quando visão é necessária; `--annotate` quando for pedir raciocínio visual (labels [N] = @eN).
- Encadear comandos com `&&` numa chamada só (daemon mantém o browser).
- `idleTimeoutMs` mata o daemon ocioso (RAM, não token, mas evita estado velho).

## 6. Dashboard (opcional, usabilidade)

`http://localhost:4848` — observabilidade das sessões (tabs, status, stream ao vivo). Roda independente; útil para acompanhar o agente visualmente sem gastar token nenhum.

## 7. CDP mode (quando precisar)

- Chrome já aberto com `--remote-debugging-port=9222`: `agent-browser connect 9222` (persistente) ou `--cdp 9222` por comando.
- `--auto-connect` (ou `AGENT_BROWSER_AUTO_CONNECT=1`) descobre Chrome rodando sozinho — útil para reusar login do seu Chrome pessoal.
- Browser remoto: `--cdp "wss://..."`.
- Limitação: com CDP/auto-connect o `--allowed-domains` (contenção de rede) é rejeitado — para scraping sensível prefira sessão própria do agent-browser.
