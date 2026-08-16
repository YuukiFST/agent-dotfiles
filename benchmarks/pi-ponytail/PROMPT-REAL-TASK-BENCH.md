# Prompt — implementar + rodar real-task bench (colar em nova sessão)

Copia o bloco abaixo inteiro para uma **nova sessão**.

---

Implementa e roda o benchmark real de ponytail vs baseline no pi, conforme o design aprovado.

**Spec (fonte da verdade):**
`~/Projects/my-harness-config/docs/superpowers/specs/2026-07-25-pi-ponytail-real-task-bench-design.md`

**Repo do bench:**
`~/Projects/my-harness-config/benchmarks/pi-ponytail`

## Regras

- Segue a spec. Não inventa métricas novas.
- **Não** instales ponytail no `~/.pi/agent` — arms injetam system prompt.
- Não alteres `settings.json` do pi.
- Mantém `benchmark-pi.js` (toy) intacto; cria `benchmark-pi-real.js` + fixture/oracle/references.
- Antes de gastar tokens de modelo: `node benchmark-pi-real.js --selftest` deve passar (good passa, bad falha).

## Passos

1. Lê a spec completa.
2. Se precisares de plan detalhado, usa skill `writing-plans`; senão implementa direto pela spec.
3. Implementa:
   - `fixtures/url-shortener/`
   - `oracle/url-shortener/`
   - `references/url-shortener/{good,bad}/`
   - `benchmark-pi-real.js`
   - atualiza `README.md` com o runner novo
4. Roda selftest até verde.
5. Roda o bench:

```bash
cd ~/Projects/my-harness-config/benchmarks/pi-ponytail
chmod +x setup.sh && ./setup.sh
node benchmark-pi-real.js \
  --model cursor/grok-4.5 \
  --repeat 3 \
  --arms baseline,ponytail-default,ponytail-full
```

6. Quando terminar, cola:
   - tabela final (pass%, tokens condicionais a pass, src_loc, seconds, vs baseline)
   - path do JSON (`benchmark-pi-real-results.json`)
   - veredicto em uma linha: ponytail ajuda / empata / piora (pela regra da spec: pass% ≥ baseline **e** tokens↓)

## Decisão (da spec)

- pass% cai → piora (ignora economia de LOC/tokens)
- pass% ok e tokens↓ → ajuda
- pass% ok e tokens↑ → compressão não paga neste tamanho/modelo

---
