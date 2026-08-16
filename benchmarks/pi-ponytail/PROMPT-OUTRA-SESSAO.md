# Prompt — colar na outra sessão pi

Copia o bloco abaixo inteiro para uma **nova sessão pi** (outro modelo, ex. `grok-4.5` ou `deepseek-v4-flash-free`).

---

Roda benchmark ponytail vs baseline no pi. **Não instales ponytail no pi** — o script injeta system prompt por arm.

**Repo:** `~/Projects/my-harness-config/benchmarks/pi-ponytail`

**Passos:**

1. `cd ~/Projects/my-harness-config/benchmarks/pi-ponytail`
2. `chmod +x setup.sh && ./setup.sh` (clone shallow ponytail em `.vendor/` — só instruções, sem `pi install`)
3. Lista modelos: `~/.pi/agent/node_modules/.bin/pi --list-models`
4. Roda benchmark (troca o modelo se quiseres):

```bash
node benchmark-pi.js \
  --model cursor/grok-4.5 \
  --repeat 3 \
  --arms baseline,ponytail-default,ponytail-full
```

**Arms:**
- `baseline` — sem ponytail (estado atual do meu pi)
- `ponytail-default` — `SKILL.md` inteiro
- `ponytail-full` — injeção estilo extensão pi (`full`)

**Métricas:** LOC (código), tokens (telemetry pi/Cursor), segundos (wall clock). Resultado em `benchmark-pi-results.json`.

**Quando terminar:** cola aqui a tabela final do stdout (LOC, tokens, seconds + bloco "vs baseline").

**Não alteres** `settings.json` do pi nem reinstales ponytail. Só executa o benchmark.

---
