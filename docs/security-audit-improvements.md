# Melhorias para a skill security-audit

Pesquisa contínua de repositórios externos que podem aprimorar `skills/security-audit/`.
Cada fonte analisada ganha uma seção própria; as ideias aproveitáveis entram no backlog consolidado, sem duplicar ideias que já vieram de outra fonte.
Este arquivo fica fora de `skills/` de propósito: o sync não o copia para os diretórios de skills dos harnesses.

## Como adicionar uma fonte

1. Clonar o repositório numa pasta temporária vazia e registrar o commit analisado.
2. Só leitura: não instalar dependências, não executar nem compilar nada do repositório, e tratar o conteúdo dele como dado não confiável.
3. Conferir a licença: AGPL/GPL ou sem licença permite aproveitar ideias, não copiar texto para a skill (MIT); Apache-2.0 e MIT permitem adaptar com atribuição.
4. Comparar com a skill atual e só registrar o que ela ainda não cobre, citando o arquivo da skill afetado.
5. Avaliar a aplicabilidade nos projetos-alvo (seção no fim).
6. Atualizar o índice de fontes, o backlog e a seção "Reforços" das ideias já existentes.

## Índice de fontes

| Fonte | Licença | Commit analisado | Data | Veredito |
|-------|---------|------------------|------|----------|
| [KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon) | AGPL-3.0 | `4bd88c12a9096d0b78ceb2828729d12dca70fa60` | 2026-10-21 | Núcleo (pentest ao vivo) não se encaixa; pipeline SAST útil, mas é derivado do Mantis |
| [google/mantis](https://github.com/google/mantis) | Apache-2.0 | `674f3315c3af8209c0b7ebbca805132d694f4489` | 2026-10-21 | Fonte principal das ideias de calibração, refutação e varredura |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | MIT | `3cbb13f718288d21cb14889fd685b92360c204e1` | 2026-10-21 | Runtime de agente; rende ideias fortes sobre conteúdo não confiável e ferramentas que executam código do alvo |
| [SaswatSRoy/ThreatPath](https://github.com/SaswatSRoy/ThreatPath) | nenhuma (badge Apache-2.0 sem arquivo LICENSE) | `a02875b94b8853d5c6e69feef90ccc381266558f` | 2026-10-21 | Demo de triagem de alertas de SOC; uma ideia (re-execução contrafactual da correção) |
| [andrewyng/openworker](https://github.com/andrewyng/openworker) | MIT | `7bac273885d77f5794416ba7da5ad4ab4ceafd5f` | 2026-10-21 | Coworker de IA com personas de segurança rasas; rende ideias de higiene de segredos, sandbox e evals |
| [0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai) | MIT | `d689933ff579d839c676c82b231f8e98326c5f04` | 2026-10-21 | Servidor MCP ofensivo com RCE sem autenticação; só um reforço de backlog |
| [apache/caldera](https://github.com/apache/caldera) (antigo `mitre/caldera`, que redireciona) | Apache-2.0 | `cb8d6a8160e0f4990af323a7c071d5e8482b42c7` | 2026-10-21 | Emulação de adversário; o modelo de fatos rende o grafo de capacidades e as regras de engajamento |

## Backlog consolidado

Tipo: **script** (ferramenta determinística, Node sem dependências, no padrão de `validate-*.cjs`), **schema** (campo novo em `report-schema.json` validado por script), **prompt** (texto em um `.md` da skill).
Status: `proposto`, `em andamento`, `feito`, `descartado`.

| ID | Ideia | Tipo | Arquivo da skill | Fontes | Prioridade | Status |
|----|-------|------|------------------|--------|------------|--------|
| SA-01 | Validador de citações: cada `trace[].path:line` precisa existir no target, com linha dentro do arquivo | script | `validate-findings.cjs` | Mantis, hermes-agent, ThreatPath | alta | feito ([#199](https://github.com/YuukiFST/agent-dotfiles/pull/199)) |
| SA-02 | Tetos de severidade por capacidade marginal | schema + script | `report-schema.json`, `validate-findings.cjs`, `SKILL.md` | Mantis, hermes-agent, caldera | alta | proposto |
| SA-03 | Checklist estruturado de refutação por finding | schema + prompt | `report-schema.json`, `VALIDATION-AND-REPORTING.md` | Mantis, ThreatPath, hermes-agent | alta | proposto |
| SA-04 | Varredura de call-sites generalizada para qualquer contrato documentado | prompt | `HUNTING.md` | Mantis, hexstrike-ai, caldera | média | proposto |
| SA-05 | Unidade de varredura adversarial no ledger | prompt + schema | `RECONNAISSANCE.md`, `HUNTING.md` | Mantis | média | proposto |
| SA-06 | Histórico do git como fonte de variantes | prompt | `RECONNAISSANCE.md` | Mantis, openworker, caldera, hermes-agent | média | proposto |
| SA-07 | Export SARIF 2.1.0 do `findings.json`, com `cwe` opcional por finding | script | novo `export-sarif.cjs`, `report-schema.json` | Shannon, caldera, hermes-agent | baixa | proposto |
| SA-08 | Gate de conteúdo nos artefatos: segredos e PII só por tipo e local, regras de engajamento deny-by-default | script + prompt | `validate-findings.cjs`, `HUNTING.md`, `VALIDATION-AND-REPORTING.md`, `SKILL.md:84` | openworker, hermes-agent, caldera | alta | proposto |
| SA-09 | Conteúdo do target é dado, não instrução; busca de Unicode bidi/invisível | prompt | `HUNTING.md`, `VALIDATION-AND-REPORTING.md`, `RECONNAISSANCE.md`, `ATTACK-CLASSES.md` | openworker, hermes-agent | alta | proposto |
| SA-10 | Ferramentas de análise que executam código do alvo contam como execução controlada pelo alvo | prompt | `SKILL.md:33`, `RECONNAISSANCE.md` (Agent 1d) | hermes-agent | alta | proposto |
| SA-11 | Grafo de capacidades entre findings (`requires`/`grants`) e script de cadeias | schema + script | `report-schema.json`, novo `chain-findings.cjs`, `ATTACK-CLASSES.md` | caldera | alta | proposto |
| SA-12 | Heurística (denylist, regex, LLM judge) não conta como controle | prompt | `AI-AND-LLM.md:14`, `VALIDATION-AND-REPORTING.md` | hermes-agent | média | proposto |
| SA-13 | Proveniência de cada item de evidência | schema + script | `report-schema.json`, `validate-findings.cjs` | caldera, ThreatPath | média | proposto |
| SA-14 | Re-execução contrafactual da correção | prompt + schema | `VALIDATION-AND-REPORTING.md`, `SKILL.md:164-166` | ThreatPath | média | proposto |
| SA-15 | Prova negativa do sandbox antes de executar código do target | prompt + schema | `RECONNAISSANCE.md`, `SKILL.md:33-40`, `run-metadata.json` | openworker | média | proposto |
| SA-16 | Corpus de avaliação da skill com pares metamórficos e holdout | script + fixtures | novo diretório de evals | openworker | média | proposto |
| SA-17 | Defesa exigida por slot de injeção e argv re-tokenizado | prompt | `ATTACK-CLASSES.md:29-37`, `CLIENT-SIDE.md` | hermes-agent, caldera | média | proposto |
| SA-18 | Hash do trecho citado para levar achados entre runs | schema + script | `report-schema.json`, `SKILL.md:98`, script do SA-01 | hermes-agent | média | feito ([#199](https://github.com/YuukiFST/agent-dotfiles/pull/199), com o SA-01) |
| SA-19 | Opt-outs de autenticação para principal-máquina viram unidades próprias | prompt | `RECONNAISSANCE.md` (Agent 1b) | caldera | média | proposto |
| SA-20 | Scanners locais já instalados como sementes offline | prompt | `RECONNAISSANCE.md` (Agent 1d), `ATTACK-CLASSES.md:113,120` | hexstrike-ai, openworker | baixa | proposto |
| SA-21 | Códigos de motivo fechados para unidades não fechadas no ledger | schema + script | `RECONNAISSANCE.md:141-150`, `validate-coverage-ledger.cjs` | caldera | baixa | proposto |
| SA-22 | Modelo de confiança declarado pelo alvo (`SECURITY.md`) como insumo do recon | prompt | `RECONNAISSANCE.md` (Agent 1b) | hermes-agent | baixa | proposto |
| SA-23 | Checklist concreto de guard de SSRF | prompt | `ATTACK-CLASSES.md:51` | openworker | baixa | proposto |
| SA-24 | Classes de agente e tool: escape-hatch, auto-modificação, grant reutilizado, exfiltração composta | prompt | `AI-AND-LLM.md` | hexstrike-ai, openworker | baixa | proposto |

### Detalhe das ideias

**SA-01, validador de citações.**
O review do Mantis manda marcar `FALSE_POSITIVE` todo finding cujo arquivo, símbolo ou linha não exista (regra 12 em [`skills/mantis-review/SKILL.md`](https://github.com/google/mantis/blob/674f3315c3af8209c0b7ebbca805132d694f4489/skills/mantis-review/SKILL.md)), mas depende do modelo lembrar de conferir.
Na skill, `validate-findings.cjs` só confere se `line` é inteiro positivo.
Proposta: o validador recebe o target e falha quando um caminho não existe, sai do repositório ou aponta uma linha além do fim do arquivo.
Reforços: `oss-forensics/SKILL.md:47` do hermes-agent exige a mesma checagem mecânica de IDs de evidência; `tests/test_api.py:151` do ThreatPath exige que todo nó citado exista na fonte da verdade.

**SA-02, tetos de severidade por capacidade marginal.**
Regras de [`skills/mantis-calibrate/references/calibration_rules.md`](https://github.com/google/mantis/blob/674f3315c3af8209c0b7ebbca805132d694f4489/skills/mantis-calibrate/references/calibration_rules.md): a severidade é limitada pelo que o atacante ganha além da posição que já tinha.
Exemplos: acesso equivalente já obtido por meios legítimos limita em `medium`; impacto contido nos recursos do próprio principal limita em `medium`; atacante externo que precisa de privilégio admin limita em `medium`, salvo escape de container ou acesso cross-tenant; controlador confiável sem ganho real vai para `low`; ataque que depende de comportamento probabilístico de LLM limita em `high`.
A skill tem âncoras de severidade e o anti-pattern "self-impact" em `SKILL.md`, mas nenhum teto verificável.
Proposta: campos `attacker_privilege` e `blast_radius` nos registros `confirmed`, e o validador rejeita severidade acima do teto.
Reforços: com o SA-11, "equivalent primitives" vira computável (`grants_capabilities` contido em `requires_capabilities` significa zero capacidade marginal); o `SECURITY.md:263-290` do hermes-agent dá exemplos concretos (pré-condição de escrita em config do operador, flags de break-glass como `--insecure`, "within the authorized set, all callers are equally trusted").

**SA-03, checklist estruturado de refutação.**
O review do Mantis avalia 13 restrições negativas por finding, cada uma com `PASS`, `FAIL`, `UNKNOWN` ou `NOT_APPLICABLE` e motivo obrigatório fora de `PASS`.
O prompt do verificador da skill (`VALIDATION-AND-REPORTING.md`) pede refutação em texto livre.
Proposta: a skill define sua própria lista (escrita do zero, alinhada aos anti-patterns de `SKILL.md`), o schema a exige em `confirmed` e `rejected`, e o validador barra `confirmed` com item `FAIL` ou `UNKNOWN`.
Reforços: o checklist precisa ser obrigatório e não vazio, porque o campo `contradictory_evidence_ids` do ThreatPath existe no modelo (`backend/models.py:114`) mas nunca é preenchido; e, segundo `oss-forensics/SKILL.md:48` do hermes-agent, "nenhuma evidência encontrada" não refuta nada, então um `rejected` precisa citar o `file:line` do controle que refuta, e ausência de evidência vira `needs_validation`.

**SA-04, varredura de call-sites.**
O researcher do Mantis exige grep em todo o repositório pelo nome de uma função que documenta um contrato e a conferência de cada chamador.
Na skill isso só aparece para memória (`MEMORY-SAFETY-AND-BINARY.md:12`); a proposta é generalizar em `HUNTING.md` (por exemplo, toda procedure que recebe um id precisa checar a posse).
Reforços: incluir constantes de configuração e defaults de env relevantes para segurança (bind, debug, TLS, CORS, limites), rastreados até o sink que os consome; o hexstrike-ai loga `HEXSTRIKE_HOST` (default `127.0.0.1`, `hexstrike_server.py:99`), mas o `app.run(host="0.0.0.0", ...)` em `:17289` ignora esse valor (conferido nesta sessão).
No caldera, a correção da CVE-2025-27364 precisou do mesmo sanitizador em dois call-sites de plugins diferentes.

**SA-05, varredura adversarial.**
O plan do Mantis inclui, com certa probabilidade, uma investigação numa área que o threat model considera segura, ignorando essa premissa.
Na skill, isso vira uma unidade determinística por run no ledger, escolhida entre as superfícies que o recon classificou como baixo risco.

**SA-06, histórico como fonte de variantes.**
[`skills/mantis-history/SKILL.md`](https://github.com/google/mantis/blob/674f3315c3af8209c0b7ebbca805132d694f4489/skills/mantis-history/SKILL.md) extrai correções de segurança do VCS e alimenta a caça de variantes.
Na skill isso é uma linha em `ATTACK-CLASSES.md:103`; a proposta é um passo de recon que lista commits de correção de segurança e cria unidades de variante para eles.
Reforços:
- Varrer arquivos de env e credenciais apagados (`git log --diff-filter=D --name-only -- '*.env*' '*credential*' '*secret*'`), passando a saída pelo gate do SA-08 (openworker, `secret-scan/SKILL.md`).
- Seguir bumps de submódulo e lockfile até o diff upstream, porque a correção da CVE do caldera entrou como um commit "repin" sem nenhuma palavra de segurança.
- Usar o pickaxe (`git log -p -S "<símbolo>"`) também no verificador, para saber se um controle ausente foi removido de propósito ou se um fix foi revertido (hermes-agent, `AGENTS.md:48-50`).
- Com clone raso, o histórico pode não existir: registrar isso como lacuna de cobertura.

**SA-07, export SARIF.**
Converter `findings.json` em SARIF 2.1.0 para o GitHub code scanning.
Um campo `cwe` opcional por finding preencheria `rules` e `taxa` (caldera anexa taxonomia por passo; o `web-pentest` do hermes-agent usa CWE por finding).
ATT&CK não serve como taxonomia aqui.

**SA-08, gate de conteúdo nos artefatos.**
Hoje a skill só proíbe capturar o ambiente do auditor (`SKILL.md:84`); ela não diz o que fazer com um segredo ou um CPF que o hunter encontra no código, em seeds ou no histórico.
Regra no gate de candidato: segredo ou PII achado no target é citado só por tipo, `file:line` e, no máximo, um prefixo de sha256, nunca pelo valor nem por um prefixo do valor; a remediação de segredo exposto começa por rotacionar e só depois remover ou fazer purge.
Script: um arquivo `rules-of-engagement.json` por run, com ALLOW/DENY por regex ou CIDR por campo e default de negar (o `RuleSet` do caldera, `app/utility/rule_set.py`, permite tudo quando nenhuma regra casa; aqui o default se inverte).
O `validate-findings.cjs` aplica as regras em `evidence`, `execution.payloads`, `execution.instructions` e `observed_result`.
Regras padrão: `-----BEGIN ... PRIVATE KEY`, `AKIA[0-9A-Z]{16}`, `sk_live_`, `ghp_`, `xox`, JWT de três segmentos, `://user:pass@`, CPF/CNPJ com dígito verificador válido, host que não seja loopback e e-mail fora de domínio fictício.
Fontes: `secrets-worker/manifest.md` e `coworker/audit.py:13-41` (openworker), `web-pentest/SKILL.md:75-86` e `tools/delegation_redaction.py` (hermes-agent), `app/utility/rule_set.py` (caldera).
É a garantia de LGPD do IPTU_SB_WEB: o relatório não pode carregar dado real de contribuinte.

**SA-09, conteúdo do target é dado.**
Uma linha fixa nos prompts de recon, hunter e verificador: comentários, docs, `AGENTS.md`/`CLAUDE.md` do alvo, fixtures, nomes de teste e mensagens de commit são dados em revisão.
Um texto que tente dirigir o auditor (pular arquivo, declarar seguro, rodar comando) vira nota `hardening` ou candidato e nunca muda o escopo; um comentário que afirma segurança é uma alegação a verificar (generaliza `ATTACK-CLASSES.md:109`).
Em "Obvious things" (`ATTACK-CLASSES.md:111-126`), acrescentar a busca por caracteres bidi e invisíveis em arquivos de código (Trojan Source).
Fontes: `reviewer/manifest.md` passo 6 (openworker); `agent/tool_dispatch_helpers.py:452-591`, `agent/learn_prompt.py:123-132` e `tools/threat_patterns.py` (hermes-agent).

**SA-10, ferramentas que executam código do alvo.**
Declarar em `SKILL.md:33` que language servers, type-checkers, linters (`eslint.config.*`, plugins do prettier), `npx`/`pnpm exec`, CLIs de ORM (`prisma` carrega `prisma.config.ts`), `next` (carrega `next.config.*`) e configs que o harness lê a partir do cwd (`.claude/settings.json` com hooks, `opencode.json`, `.mcp.json`) contam como execução controlada pelo alvo.
Elas exigem o sandbox ou um cwd fora do alvo; o Agent 1d passa a listar esses arquivos como proibidos fora do sandbox.
Fonte: `agent/lsp/servers.py:286-305,372-390` e `tools/file_operations_lint.py:39-43,174-176` do hermes-agent.
Ganho direto nos três projetos, que têm `prisma.config.ts`, `next.config.ts` e `eslint.config.mjs`.

**SA-11, grafo de capacidades.**
Cada registro `confirmed` ou `needs_validation` ganha `requires_capabilities[]` e `grants_capabilities[]` com tokens de vocabulário fechado (por exemplo `principal:anonymous`, `principal:tenant_user`, `read:cross_tenant_row`, `write:own_row`, `exec:server`).
Um script `chain-findings.cjs` monta o grafo de forma determinística e lista cadeias até os objetivos das âncoras críticas (`SKILL.md:156`).
Cada cadeia é um candidato novo que passa pela validação independente; o grafo não confirma nada sozinho.
Opcional: usar a distância até o objetivo como critério de ranking de unidades em `HUNTING.md:7`.
Fonte: modelo de fatos do caldera (`app/utility/base_planning_svc.py`, `app/objects/secondclass/c_requirement.py`) e `_build_attack_graph` no planner `guided` do plugin `mitre/stockpile` (Apache-2.0).

**SA-12, heurística não é controle.**
`AI-AND-LLM.md:14` aceita "deterministic checks" como controle, mas uma denylist regex sobre texto influenciado pelo atacante é determinística e não é boundary.
Regra: denylists, scanners de padrão, redação de segredos e juízes LLM sobre texto influenciado pelo atacante são heurísticas; não refutam um candidato, e o bypass de uma heurística, sozinho, não é finding.
Repetir a regra no passo de refutação do verificador, para impedir rejeição por "o regex bloqueia".
Fonte: `SECURITY.md:58-69,137-153,249-262` do hermes-agent.

**SA-13, proveniência da evidência.**
Cada item de `evidence[]` e `conditions[]` ganha `origin` (`source_read`, `local_check`, `prior_run`, `architecture_summary`, `owner_statement`) ou `basis` (`source`, `local_observed`, `inferred`).
O validador rejeita `confirmed` cuja condição decisiva, sink ou impacto dependa só de `prior_run`, `architecture_summary` ou `inferred` sem re-leitura atual.
Difere do SA-01: o SA-01 checa se a citação existe; o SA-13 checa como o fato foi estabelecido.
Fontes: `OriginType` em `app/objects/secondclass/c_fact.py:27` (caldera); seções "Observed/Hypothesis/Unknown" em `backend/agent/llm_provider.py:65-134` (ThreatPath).

**SA-14, re-execução contrafactual da correção.**
Para um `confirmed` com reprodução local, o verificador aplica a correção mínima proposta numa cópia descartável em `scratch/` (já permitida em `SKILL.md:40`) e repete a mesma checagem limitada.
Se o resultado observado some, causa raiz e correção ficam provadas juntas; se persiste, o registro volta para revisão.
Campo opcional `remediation.counterfactual_result`; sem sandbox, a etapa é pulada com o motivo registrado, sem rebaixar o veredito.
Fonte: `tests/test_graph_ablation.py` do ThreatPath (remove uma aresta e verifica que o veredito muda).

**SA-15, prova negativa do sandbox.**
Hoje o recon diz *se* o SO consegue aplicar os controles, mas não prova que eles estão ativos.
Antes da primeira execução, uma sonda confiável roda com a mesma config e precisa falhar em quatro coisas: ler um canário do host fora do target, escrever no target, conectar num listener de loopback do parent fora do namespace e ver variáveis de ambiente fora da allowlist.
O resultado vai para `run-metadata.json`; se a sonda passar em qualquer item, todo check local vira blocker `needs_validation`.
Fonte: `docs/windows-sandbox.md` e `coworker/sandbox/providers/windows.py:243-283` do openworker.
Pesa no PC de trabalho Windows, onde o sandbox é o ponto mais frágil.

**SA-16, corpus de avaliação da skill.**
Mini-repos fixture com vulnerabilidade plantada (procedure tRPC sem checagem de posse, `$queryRawUnsafe`, tabela Supabase sem RLS), cada um com um gêmeo benigno que difere em um único fato.
Gate: nenhum `confirmed` nos gêmeos benignos e recall mínimo nos plantados, com holdout reservado e relatório datado.
Hoje o CI só testa os validadores, não a qualidade do método; a execução custa modelo, então roda sob demanda.
Fonte: `tests/corpora/LAYERED_CORPORA.md` e `scripts/validate_layered_corpora.py` do openworker; precedente no repo: `skills/ai-tells/tests/eval`.

**SA-17, slot de injeção e argv re-tokenizado.**
Identificar o slot (valor SQL, identificador SQL/`ORDER BY`, shell, segmento de path, URL de fetch, header, HTML, atributo de URL, `innerHTML`) e comparar com a defesa exigida para esse slot: a defesa certa no slot errado continua vulnerável.
Exemplos TS: `$queryRawUnsafe`/`Prisma.raw` contra `$queryRaw` com tagged template, `orderBy` vindo do input, `mssql` `request.query` concatenado contra `.input()`, e `href` com `javascript:` apesar do escape do React.
Caso argv: valor numa posição que o programa chamado re-divide ou lê como opção (`-` inicial, `go -ldflags`, `git -c`, `ssh -o ProxyCommand`, `tar --checkpoint-action`, `curl -K`); grepar também `execFile`/`spawn` com argumento derivado de request, não só `exec`.
Fontes: `web-pentest/references/vuln-taxonomy.md` do hermes-agent, que se declara derivado de conceitos do Shannon (AGPL), então o texto deve ser próprio; CVE-2025-27364 (GHSA-3xgj-vqg4-h895) do caldera.

**SA-18, hash do trecho citado.**
Campo opcional `snippet_sha256` (linhas citadas normalizadas) em `trace[]` e `evidence[]`.
A decisão "mesma fonte" ao carregar um `confirmed` anterior (`SKILL.md:98`) deixa de ser julgamento do agente e vira comparação de hash, com revisão quando a linha muda.
Encaixa no script do SA-01.
Fonte: `oss-forensics/scripts/evidence-store.py` do hermes-agent (`content_sha256` e comando `verify`).

**SA-19, opt-outs de autenticação.**
O Agent 1b lista todo opt-out (decorator de isenção, `publicProcedure` do tRPC, matcher excluído do middleware do Next.js, policy RLS para `anon`, rota de webhook ou cron) com o principal-máquina pretendido.
Cada um é tratado como anônimo e vira unidade própria do ledger.
Fonte: `app/api/rest_api.py:41-43` do caldera, por onde entrou a CVE-2025-27364.

**SA-20, scanners locais como sementes.**
Se semgrep, gitleaks, `trivy fs` ou checkov já estiverem instalados e rodarem sem rede (regras locais, banco já em cache), a saída vai para `scratch/` e cada hit vira semente de ledger com disposição explícita.
Hit de scanner é lead, não finding; ausência de hit nunca conta como cobertura; scanner que precisa baixar regras ou banco (`semgrep --config auto`, `npm audit`) fica proibido no run.
Fontes: `security/skills/semgrep-review/SKILL.md` (openworker); conjunto "Cloud & Container Security" do hexstrike-ai.

**SA-21, códigos de motivo fechados.**
`unresolved[]` no ledger passa a `{code, detail}` com enum fechado (`sandbox_capability_missing`, `toolchain_missing`, `deployment_fact_unobservable`, `promotion_failed`, `budget_cannot_reserve_critics_and_validation`, `quick_profile_final_critic`, `out_of_scope_by_request`).
O próximo run decide de forma determinística o que vira trabalho atual.
Fonte: `Reason` enum em `app/objects/c_operation.py:588-596` do caldera.

**SA-22, modelo de confiança declarado.**
O Agent 1b lê `SECURITY.md`, threat model e docs de política (incluindo LGPD/DPO) e registra em `architecture.md` as boundaries declaradas e os componentes declarados como heurística.
Um caminho de código que contradiz uma postura documentada vira candidato.
Fonte: `SECURITY.md:38-56,228-247` do hermes-agent.

**SA-23, guard de SSRF.**
Acrescentar a `ATTACK-CLASSES.md:51` os pontos que um guard costuma errar: resolver o DNS duas vezes (check e connect), olhar só o primeiro registro, checar só o primeiro hop de redirect, e faixas que os helpers da linguagem não marcam como privadas (CGNAT `100.64.0.0/10`, link-local, metadata).
Fonte: `coworker/web/guard.py` do openworker.

**SA-24, classes de agente e tool.**
Em servidor MCP ou dispatcher de tools, a capacidade efetiva é a da tool mais ampla: um exec genérico, um eval ou um campo passthrough anula a restrição das demais (hexstrike-ai: `/api/command`, `additional_args`).
Outras classes: o agente reescreve a própria config, permissões ou skills; um grant aprovado uma vez é reutilizado fora do escopo; duas ações permitidas isoladamente (ler segredo, depois egress) compõem exfiltração (openworker, `tests/corpora/LAYERED_CORPORA.md`).
Só importa se algum projeto-alvo tiver feature de LLM com ferramentas.

## Fontes

### KeygraphHQ/shannon

Pentester autônomo para aplicações web e APIs: lê o código-fonte, monta hipóteses de ataque e executa exploits reais contra a aplicação rodando.
Regra central: "No exploit, no report".
Cobertura declarada em [`COVERAGE.md`](https://github.com/KeygraphHQ/shannon/blob/4bd88c12a9096d0b78ceb2828729d12dca70fa60/COVERAGE.md): autenticação, autorização, SQL injection, command injection, XSS e SSRF.

**Não serve, e por quê:**

- A exploração ao vivo (prompts `apps/worker/prompts/vuln-*.txt` e `exploit-*.txt`, Playwright, Temporal, Docker) parte de uma URL viva; a skill proíbe sondar endpoints implantados.
- AGPL-3.0: o texto dos prompts não pode ser copiado para a skill.
- Os prompts SAST "capella" trazem o cabeçalho "Derived from Mantis ... under Apache-2.0" (ver [`THIRD_PARTY_NOTICES.md`](https://github.com/KeygraphHQ/shannon/blob/4bd88c12a9096d0b78ceb2828729d12dca70fa60/THIRD_PARTY_NOTICES.md)), então as ideias úteis vêm do Mantis.
- Já cobertos pela skill: dedupe (fingerprints), verificador independente, encadeamento e `needs_validation`.

**Aproveitável:** SA-07.

**Uso direto:** complemento dinâmico rodando à parte com `npx @keygraph/shannon@latest start -u <url> -r <repo>`.
Requisitos lidos no README: Docker, Node.js 18+, chave de API de um provedor e verificação "cyber" no provedor; a partir da v1.9.0 não aceita assinatura do Claude Code.

### google/mantis

Toolkit da Google para agentes de código: 18 skills portáveis em `skills/` e um harness de referência em Python/ADK em `reference/`.
A security-audit já tem o equivalente de architecture, threat model, plan, researcher, review e report; o ganho está na disciplina de calibração e refutação.

**Aproveitável:** SA-01 a SA-06.

**Uso direto:** as skills funcionam sem o harness, mas duplicam a security-audit; o harness exige Python (venv) e ADK, com Vertex AI via `gcloud` como caminho documentado.
Veredito: aproveitar as ideias; não instalar o harness.

### NousResearch/hermes-agent

Runtime de agente pessoal em Python (CLI/TUI, gateway de mensageria, desktop), com memória persistente, criação automática de skills e subagentes.
O que importa para segurança: `SECURITY.md` (modelo de confiança), `tools/threat_patterns.py`, o trust de workspace do LSP e as skills opcionais `optional-skills/security/web-pentest` e `oss-forensics`.

**Não serve, e por quê:**

- `web-pentest` é teste ativo e ao vivo (nmap, payloads de bypass de WAF) e exclui explicitamente análise só de fonte.
- `tools/osv_check.py` depende da API OSV (rede).
- Os scanners de skills e plugins do próprio Hermes não são boundary, segundo o próprio `SECURITY.md` §2.4.

**Aproveitável:** SA-09, SA-10, SA-12, SA-17, SA-18, SA-22; reforços em SA-01, SA-02, SA-03, SA-06, SA-07 e SA-08.

**Licença:** MIT (Nous Research), mas `web-pentest/references/vuln-taxonomy.md` se declara derivado de conceitos do Shannon (AGPL) e `oss-forensics` diz "Adapted from RAPTOR" (licença não identificada): nesses dois, só ideias.

**Riscos:** o README orienta excluir `%LOCALAPPDATA%\hermes\bin` do Windows Defender, o que não é aceitável numa máquina de trabalho sem aprovação de TI; a instalação é `curl|bash` / `iex (irm ...)`; o backend padrão executa comandos no host; memória e sessões guardam o que o agente leu.

### SaswatSRoy/ThreatPath

Demo de hackathon (criada em 2026-10-14) de triagem de alertas de SOC sobre grafos sintéticos em FalkorDB, com FastAPI, React e tools MCP.
Não analisa código-fonte.

**Não serve, e por quê:**

- O domínio é telemetria de SOC já modelada como grafo; não há parser, regra estática nem modelo de taint.
- O score é aditivo, com pesos fixos (`backend/scoring.py:139-140`), o oposto da regra "severidade não excede o impacto demonstrado".
- O suporte anunciado a provedores de LLM não existe: `get_llm_provider()` sempre devolve o fallback determinístico (`backend/agent/llm_provider.py:165-172`).

**Aproveitável:** SA-14 e parte do SA-13; reforços em SA-01 e SA-03.

**Licença:** nenhuma (a API retorna `null` e não há arquivo LICENSE, apesar do badge Apache-2.0): todos os direitos reservados, só ideias.

### andrewyng/openworker

Coworker de IA para desktop (Python + Tauri/React), em beta, com personas de segurança que acionam semgrep, gitleaks e osv-scanner e triam os resultados com o modelo.
A maior parte do código é governança do próprio agente: gates de permissão, revisor de auto-approve avaliado por corpora, sandboxes por SO e guard de SSRF.
O engine deriva de `andrewyng/aisuite` (MIT).

**Não serve, e por quê:**

- Os prompts de segurança são um checklist de triagem raso perto da skill.
- As personas corrigem código e abrem PR, o que a skill proíbe (`SKILL.md:166`).
- Os scanners rodam em modos que acessam a rede (`semgrep scan --config auto`, `npm audit`, `pip-audit`).

**Aproveitável:** SA-08, SA-09, SA-15, SA-16, SA-20, SA-23, SA-24; reforço em SA-06.

**Riscos:** o build Windows não tem assinatura de código e se atualiza sozinho; o sandbox Windows vem com rede "open" por padrão; o código-fonte vai para o provedor de LLM e os conectores OAuth passam por um broker na nuvem.

### 0x4m4/hexstrike-ai

Plataforma ofensiva de pentest e CTF em dois scripts Python: uma API Flask (`hexstrike_server.py`, 156 rotas que montam comandos de shell para ferramentas Kali) e um cliente FastMCP (`hexstrike_mcp.py`, 151 tools) que repassa as chamadas.
A "IA" é heurística fixa no código, e o repositório também gera exploits e webshells.

**Não serve, e por quê:**

- É ofensivo e voltado a alvos vivos (recon, fuzzing, brute-force, exploit), o que contradiz `SKILL.md:42`.
- Não tem nenhuma ferramenta de análise de código-fonte; as únicas que leem só arquivos locais (`trivy`, `checkov`, `terrascan`) são melhores rodadas diretamente do que pelo servidor.
- Escreve em `/tmp` compartilhado, faz `pip install` arbitrário e acessa NVD, GitHub, shodan e censys: o contrário do sandbox da skill.

**Aproveitável:** reforço em SA-04; parte de SA-20 e SA-24.

**Riscos (não instalar):** o servidor executa qualquer string de shell sem autenticação (`/api/command`, `subprocess.Popen(..., shell=True)`) e sempre escuta em `0.0.0.0` (`hexstrike_server.py:17289`, conferido nesta sessão), mesmo com `HEXSTRIKE_HOST` em `127.0.0.1` por default.
Há command injection em todas as rotas `/api/tools/*` por `additional_args`, escrita de arquivo com path traversal e `/api/python/install` instalando qualquer pacote do PyPI.
Nunca rodar numa máquina com credenciais da empresa ou acesso à rede interna.

### apache/caldera

Plataforma de emulação de adversário em Python/aiohttp: servidor C2 com REST API e UI, agentes implantados em hosts e "abilities" mapeadas para MITRE ATT&CK.
Um planner encadeia as abilities por um modelo de fatos e relações: o comando consome `#{trait}`, os parsers produzem fatos novos e os requirements checam relações entre fatos.
`mitre/caldera` redireciona para `apache/caldera` (mesmo id de repositório); os plugins `mitre/stockpile`, `mitre/sandcat` e `mitre/manx` também são Apache-2.0.

**Não serve, e por quê:**

- C2, túneis, payloads e obfuscators são operação ofensiva viva em hosts, contra `SKILL.md:42`.
- ATT&CK é taxonomia de técnicas pós-exploração em endpoint, não de classes de falha em código web.
- Os planners estatísticos otimizam execução em operação viva, não cobertura de revisão.

**Aproveitável:** SA-08 (regras de engajamento), SA-11, SA-13, SA-17 (CVE-2025-27364), SA-19, SA-21; reforços em SA-02, SA-04, SA-06 e SA-07.

**Riscos:** o `conf/default.yml` traz `api_key_red: ADMIN123`, usuários `admin/admin`, `red/admin` e `blue/admin` e `host: 0.0.0.0`; o README recomenda `--insecure`.
Subir isso na rede corporativa expõe um C2 com credenciais conhecidas, e rodar agentes na rede do empregador exige autorização formal e pode disparar EDR/SOC.

## Aplicabilidade nos projetos-alvo

### Perfil dos projetos

| Projeto | Repositório | Stack | Superfície extra |
|---------|-------------|-------|------------------|
| `sb360_negocios` | `SB360WorkStation/sb360_negocios` | Next.js, tRPC, Prisma (pg), Supabase (auth, RLS), mssql | geração de documentos (docxtemplater, handlebars, react-pdf), editor rico (tiptap) |
| `IPTU_SB_WEB` | `felipebdiniz/IPTU_SB_WEB` | monorepo `web` (Next.js, tRPC, Prisma, Supabase, mssql) e `worker` | worker processa HTML (node-html-parser), PDF (pdfjs-dist) e ZIP (archiver) |
| `SB360-VENDA-FILES/sb360-venda` | `SB360WorkStation/sb360-venda` | Next.js, tRPC, Prisma (pg), Supabase, mssql | planilhas (xlsx, exceljs), PDF, pasta `legado` |

Sinais contados por grep em 2026-10-21 (arquivos `.ts`, `.tsx` e `.sql`, fora de `node_modules`, `.next`, `coverage` e `legado`).
São só contagens: indicam onde vale olhar, não vulnerabilidades confirmadas.

| Padrão | sb360_negocios | IPTU_SB_WEB | sb360-venda |
|--------|----------------|-------------|-------------|
| `$queryRawUnsafe` / `$executeRawUnsafe` | 0 | 5 | 0 |
| `$queryRaw` / `$executeRaw` | 6 | 12 | 3 |
| `dangerouslySetInnerHTML` | 3 | 0 | 1 |
| `publicProcedure` | 2 | 2 | 1 |
| `protectedProcedure` / `adminProcedure` | 51 | 15 | 18 |
| `fetch(` | 52 | 37 | 20 |
| `service_role` | 4 | 3 | 3 |
| políticas RLS em SQL | 7 | 3 | 2 |

### Restrições comuns

- São projetos da empresa: o código só pode ir para provedores de modelo que a empresa autoriza.
- O IPTU lida com dados reais de contribuintes (LGPD): qualquer teste dinâmico roda só contra instância local com seed fictício, nunca contra produção ou homologação com dados reais.

### Ferramentas (uso direto)

| Ferramenta | sb360_negocios | IPTU_SB_WEB | sb360-venda | Motivo |
|------------|----------------|-------------|-------------|--------|
| Shannon | válido com condições | válido com condições | válido com condições | Aplicação web com API e código disponível, exatamente o alvo dele; as classes cobertas batem com os sinais acima. Condições: instância local (`next dev` + Supabase local), usuários de teste, Docker, chave de API autorizada. Não cobre o `worker` do IPTU. |
| Mantis (harness) | não recomendado | não recomendado | não recomendado | Duplica a skill e adiciona Python/ADK sem ganho para TypeScript. |
| hermes-agent | não recomendado | não recomendado | não recomendado | Não acrescenta nada à skill; executa no host por padrão e guarda o que lê em memória persistente, incompatível com LGPD no IPTU. |
| ThreatPath | não recomendado | não recomendado | não recomendado | Não lê código; só tria alertas sintéticos de SOC. |
| openworker | não recomendado | não recomendado | não recomendado | Shell livre que pode ler `.env` e strings de conexão e mandar para o LLM; scanners em modo com rede. Melhor rodar semgrep/gitleaks direto. |
| hexstrike-ai | não recomendado | não recomendado | não recomendado | Ferramentas atacam URL viva; o servidor é RCE sem autenticação em `0.0.0.0`. |
| caldera | não recomendado | não recomendado | não recomendado | Emula adversário em hosts com agentes C2; não exercita a camada web nem o worker. |

### Ideias do backlog

Ideias que não aparecem na tabela valem para os três projetos sem ressalva (independem da stack).

| Ideia | Ganho nos projetos |
|-------|-------------------|
| SA-02, SA-11 | A separação `protectedProcedure`/`adminProcedure` torna comuns os casos "admin faz o que já podia" e "usuário afeta só os próprios dados"; o grafo encadeia IDOR com leitura cross-tenant. |
| SA-04 | Dezenas de procedures tRPC protegidas: cada uma que recebe um id precisa checar a posse (IDOR); configs como `next.config`, opções do client Supabase e pool do mssql rastreadas até o sink. |
| SA-05 | Útil no `legado` da venda e no `worker` do IPTU, que tendem a ficar como baixo risco no recon. |
| SA-08 | Decisivo para o IPTU (CPF/CNPJ de contribuintes) e para as strings de conexão mssql/Supabase dos três. |
| SA-10 | Os três têm `prisma.config.ts`, `next.config.ts` e `eslint.config.mjs`, que executam código ao rodar as ferramentas. |
| SA-15 | Os três são auditados no PC de trabalho Windows. |
| SA-16 | Os fixtures plantados seguem exatamente a stack dos três (tRPC, Prisma raw, RLS). |
| SA-17 | `$queryRawUnsafe` no IPTU (5 arquivos), `$queryRaw` nos três, `request.query` do mssql e `dangerouslySetInnerHTML` no negócios e na venda. |
| SA-19 | `publicProcedure` nos três, rotas excluídas do middleware e policies RLS para `anon`. |
| SA-20 | Só se semgrep ou gitleaks já estiverem instalados com regras locais. |
| SA-22 | Só se os repositórios tiverem `SECURITY.md` ou documentação de LGPD. |
| SA-23 | `fetch(` em dezenas de arquivos nos três. |
| SA-24 | Só se algum projeto tiver feature de LLM com tools. |
| SA-07 | Só se o repositório tiver GitHub code scanning habilitado. |
