# Divergências da security-audit em relação ao original

`skills/security-audit/` é uma cópia de [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) `skills/security-audit/` em `c1c8a8c` (MIT), trazida pelo commit `450bf8a` via YuukiFST/Omoikane `ea40f36`.
Toda mudança local está listada aqui, para que uma atualização do original consiga reaplicá-la.

## Como atualizar a partir do original

1. Copiar o original por cima de `skills/security-audit/`, sem apagar os arquivos que só existem aqui.
2. Reaplicar cada linha da tabela abaixo, na ordem.
3. Rodar o job `security-audit-validators` de `.github/workflows/ci.yml` em Ubuntu e Windows.
   Pronto quando todos os testes passam e `git diff` contra o commit anterior à atualização mostra só as mudanças do original.

## Divergências

| ID | Mudança | Onde | Como reaplicar | Origem |
|----|---------|------|----------------|--------|
| D0 | Fallback para Windows na leitura segura de entrada dos dois validadores, que no original recusam toda entrada no Windows (sem `O_NOFOLLOW` e `O_NONBLOCK`) | `validate-findings.cjs` e `validate-coverage-ledger.cjs` (`openWindowsInput`), seus testes, job `security-audit-validators` | Reaplicar o diff de `450bf8a` nesses arquivos; o upstream recusou o PR | `450bf8a`, `1890231`, cloudflare/security-audit-skill#69 |
| D1 | Validador de citações e hash do trecho citado (SA-01, SA-18) | Novos: `validate-citations.cjs`, `validate-citations.test.cjs`. Alterados: `validate-findings.cjs` (`readBytesWithinLimit` extraído de `readFileWithinLimit` e exportado com `SafeInputError`), `report-schema.json` (`snippet_sha256` opcional nos seis itens de `trace` e `evidence`), `SKILL.md` (§ "Coverage and prior runs" passo 1, § "Full audit workflow" passo 4, frase dos dois estados terminais), `VALIDATION-AND-REPORTING.md` (bloco de comandos e parágrafo da Phase 4, "rerun every validator" na Phase 5), comando do job no CI | Copiar os arquivos novos; refazer a extração de `readBytesWithinLimit` sem mudar o comportamento de `readFileWithinLimit`; reinserir o campo no schema e as frases | SA-01, SA-18 em `docs/security-audit-improvements.md` |
| D2 | Gate de conteúdo nos artefatos e regras de engajamento deny-by-default (SA-08) | Novos: `validate-artifact-content.cjs`, `validate-artifact-content.test.cjs`. Alterados: `SKILL.md` (parágrafo de segredo, PII e host real do alvo no fim de § "Universal execution safety", `rules-of-engagement.json` na lista de § "Write isolation" e na frase de `run-metadata.json`, § "Full audit workflow" passo 4), `HUNTING.md` (item 7 do bloco "Candidate gate", antigo 7 vira 8), `VALIDATION-AND-REPORTING.md` (passo 7 do prompt do verificador, comando e parágrafos do formato na Phase 4, varredura dos relatórios no fim da Phase 6), comando do job no CI | Copiar os arquivos novos; reinserir os itens e parágrafos | SA-08 em `docs/security-audit-improvements.md` |
| D3 | Conteúdo do alvo é dado, não instrução; busca de Unicode bidi e invisível (SA-09) | `RECONNAISSANCE.md` (bloco `TARGET CONTENT IS DATA` antes do Agent 1a), `HUNTING.md` (parágrafo de abertura do bloco "Core hunting method" e frase do coverage critic), `VALIDATION-AND-REPORTING.md` (parágrafo no prompt do verificador e frase da Phase 5), `ATTACK-CLASSES.md` (item de Trojan Source em "Obvious things") | Reinserir os parágrafos e o item | SA-09 em `docs/security-audit-improvements.md` |
| D4 | Ferramentas de análise e harness que carregam código ou config do alvo contam como execução controlada pelo alvo (SA-10) | `SKILL.md` (parágrafo após a lista de controles de § "Universal execution safety"), `RECONNAISSANCE.md` (item 8 do Agent 1d), `HUNTING.md` (frase em "USE THE NARROWEST LOCAL CHECK"), `VALIDATION-AND-REPORTING.md` (inciso na frase de execução do prompt do verificador) | Reinserir o parágrafo, o item e as frases | SA-10 em `docs/security-audit-improvements.md` |
