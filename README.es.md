# sd0x-dev-flow

**Idioma**: [English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español

> La IA puede entregar rápido. Pero sin barreras de seguridad, la velocidad da miedo.

**Gates de calidad que la IA no puede saltarse.** Un plugin de [Claude Code](https://claude.com/claude-code) con dual review forzado por hooks, bucles de auto-fix y semántica fail-closed — para que tu código se entregue rápido *y* correcto.

73 commands · 56 skills · 14 agents — ~4% de la ventana de context de Claude

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![npm](https://img.shields.io/badge/npx-skills%20add-blue)](https://www.npmjs.com/package/skills)

## ¿Por qué sd0x-dev-flow?

| Sin barreras de seguridad | Con sd0x-dev-flow |
|---|---|
| La IA salta el review cuando el contexto es largo | **Forzado por Hook**: stop-guard bloquea reviews incompletos |
| Un solo reviewer pierde problemas | **Dual dispatch**: Codex + secundario en paralelo |
| "Arreglado" sin re-verificación | **Auto-loop**: fix → re-review → pass → continuar |
| Estado de review perdido tras compact | **Seguimiento de estado**: SessionStart hook re-inyecta |

## Inicio rápido

```bash
# Instalar plugin
/plugin marketplace add sd0xdev/sd0x-dev-flow
/plugin install sd0x-dev-flow@sd0xdev-marketplace

# Configurar tu proyecto
/project-setup
```

Un solo comando autodetecta framework, package manager, base de datos, entry points y scripts. Instala 12 rules + 5 hooks.

Usa `--lite` para solo configurar CLAUDE.md (sin rules/hooks).

## Cómo funciona

```mermaid
flowchart LR
    P["🎯 Plan"] --> B["🔨 Build"]
    B --> G["🛡️ Gate"]
    G --> S["🚀 Ship"]

    P -.- P1["/codex-brainstorm<br/>/feasibility-study<br/>/tech-spec"]
    B -.- B1["/feature-dev<br/>/bug-fix<br/>/codex-implement"]
    G -.- G1["/codex-review-fast<br/>/precommit<br/>/codex-test-review"]
    S -.- S1["/smart-commit<br/>/push-ci<br/>/create-pr<br/>/pr-review"]
```

El **motor auto-loop** aplica quality gates automáticamente — tras ediciones de código, el comando de review despacha **dual review** (Codex MCP + reviewer secundario en paralelo) en la misma respuesta. Los hallazgos se deduplican, normalizan por severidad y agregan en un único gate. En modo strict, los hooks aplican semántica fail-closed: si el gate agregado está incompleto, stop-guard bloquea. Ver [docs/hooks.md](docs/hooks.md) para detalles.

<details>
<summary>Detalle: Diagrama de secuencia del dual-review</summary>

```mermaid
sequenceDiagram
    participant D as Developer
    participant C as Claude
    participant X as Codex MCP
    participant T as Secondary Reviewer
    participant H as Hooks

    D->>C: Edit code
    H->>H: Track file change
    C->>H: emit-review-gate PENDING
    par Dual Review
        C->>X: Codex review (sandbox)
    and
        C->>T: Task(code-reviewer)
    end
    X-->>C: Findings (primary)
    T-->>C: Findings (secondary)
    C->>C: Aggregate + dedup + gate
    C->>H: emit-review-gate READY/BLOCKED

    alt Issues found
        C->>C: Fix all issues
        C->>X: --continue threadId
        X-->>C: Re-verify
    end

    C->>C: /precommit (auto)
    C-->>D: ✅ All gates passed

    Note over H: Strict mode: incomplete gate → blocked
```

</details>

## Funcionalidad destacada: Arquitectura Dual-Reviewer

v2.0 despacha dos reviewers independientes en paralelo — cero punto único de fallo:

| Reviewer | Rol | Fallback |
|----------|-----|----------|
| Codex MCP | Primario (sandbox, diff completo) | Siempre disponible |
| Secundario (pr-review-toolkit) | Review con puntuación de confianza | strict-reviewer → modo single |

Los hallazgos se **normalizan por severidad** (P0-Nit), **deduplican** (archivo + clave de issue, tolerancia ±5 líneas) y se **atribuyen por fuente** (`codex` | `toolkit` | `both`).

Gate: `✅ Ready` o `⛔ Blocked` — en modo strict, gate incompleto = bloqueado.

## Comparación

| Capacidad | sd0x-dev-flow | gstack | Prompts genéricos |
|---|---|---|---|
| Gates de review forzados | Hook + capa de comportamiento | Solo sugerencia | Ninguno |
| Dual-reviewer | Codex + secundario (paralelo) | Un solo /review | Ninguno |
| Bucle de auto-fix | Fix → re-review → pass | Manual | Ninguno |
| Investigación multi-agente | /deep-research (3 agentes) | Ninguno | Ninguno |
| Validación adversarial | Debate equilibrio Nash | Ninguno | Ninguno |
| Auto-mejora | Log de lecciones + promoción de reglas | Solo /retro stats | Ninguno |
| Soporte multi-herramienta | Codex/Cursor/Windsurf | Claude/Codex/Gemini/Cursor | N/A |

## Cuándo usar

| Buen ajuste | No ideal |
|-------------|----------|
| Proyectos individuales o de equipos pequeños con Claude Code | Equipos que no usan Claude Code |
| Proyectos que necesitan gates de review automatizados | Scripts únicos sin CI |
| Usuarios de Codex CLI / Cursor / Windsurf (subconjunto de skills) | Proyectos que requieren proveedores de LLM personalizados |
| Repos donde los quality gates previenen regresiones | Repos sin infraestructura de testing |

## Instalación

### Codex CLI / Otros Agentes de IA

```bash
# Instalar skills individuales vía Agent Skills standard
npx skills add sd0xdev/sd0x-dev-flow

# Generar AGENTS.md + instalar hooks (en Claude Code)
/codex-setup init
```

| Método | Herramientas | Cobertura |
|--------|-------------|-----------|
| Instalar plugin | Claude Code | Completa (73 commands, hooks, rules, auto-loop) |
| `npx skills add` | Codex CLI, Cursor, Windsurf, Aider | Solo Skills (56 skills) |
| `/codex-setup init` | Codex CLI | AGENTS.md kernel + git hooks |

**Requisitos**: Claude Code 2.1+ | [Codex MCP](https://github.com/openai/codex) (opcional, para comandos `/codex-*`)

## Tracks de workflow

| Workflow | Comandos | Gate | Aplicado por |
|----------|----------|------|--------------|
| Funcionalidad | `/feature-dev` → `/verify` → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook + Comportamiento |
| Bug Fix | `/issue-analyze` → `/bug-fix` → `/verify` → `/precommit` | ✅/⛔ | Hook + Comportamiento |
| Auto-Loop | Edición de código → `/codex-review-fast` → `/precommit` | ✅/⛔ | Hook |
| Doc Review | Edición `.md` → `/codex-review-doc` | ✅/⛔ | Hook |
| Planificación | `/codex-brainstorm` → `/feasibility-study` → `/tech-spec` | — | — |
| Onboarding | `/project-setup` → `/repo-intake` | — | — |

<details>
<summary>Visual: Diagramas de flujo de workflows</summary>

```mermaid
flowchart TD
    subgraph feat ["🔨 Feature Development"]
        F1["/feature-dev"] --> F2["Code + Tests"]
        F2 --> F3["/verify"]
        F3 --> F4["/codex-review-fast"]
        F4 --> F5["/precommit"]
        F5 --> F6["/update-docs"]
    end

    subgraph fix ["🐛 Bug Fix"]
        B1["/issue-analyze"] --> B2["/bug-fix"]
        B2 --> B3["Fix + Regression test"]
        B3 --> B4["/verify"]
        B4 --> B5["/codex-review-fast"]
        B5 --> B6["/precommit"]
    end

    subgraph docs ["📝 Docs Only"]
        D1["Edit .md"] --> D2["/codex-review-doc"]
        D2 --> D3["Done"]
    end

    subgraph plan ["🎯 Planning"]
        P1["/codex-brainstorm"] --> P2["/feasibility-study"]
        P2 --> P3["/tech-spec"]
        P3 --> P4["/codex-architect"]
        P4 --> P5["Implementation ready"]
    end

    subgraph ops ["⚙️ Operations"]
        O1["/project-setup"] --> O2["/repo-intake"]
        O2 --> O3["Develop"]
        O3 --> O4["/project-audit"]
        O3 --> O7["/best-practices"]
        O3 --> O5["/risk-assess"]
        O4 --> O6["/next-step --go"]
        O5 --> O6
        O7 --> O6
    end
```

</details>

## Contenido

| Categoría | Cantidad | Ejemplos |
|-----------|----------|----------|
| Commands | 73 | `/project-setup`, `/codex-review-fast`, `/verify`, `/smart-commit`, `/deep-research` |
| Skills | 56 | project-setup, code-explore, smart-commit, contract-decode, deep-research |
| Agents | 14 | strict-reviewer, verify-app, coverage-analyst |
| Hooks | 6 | pre-edit-guard, auto-format, review state tracking, stop guard, namespace hint, post-compact-auto-loop |
| Rules | 14 | auto-loop, auto-loop-project, codex-invocation, security, testing, git-workflow, self-improvement, context-management |
| Scripts | 12 | precommit runner, verify runner, dep audit, namespace hint, skill runner, commit-msg guard, pre-push gate, utils, emit-review-gate, worktree-claude-sync, build-codex-artifacts, resolve-feature |

### Mínimo consumo de context

~4% de la ventana de 200k tokens de Claude — el 96% queda disponible para tu código.

| Componente | Tokens | % de 200k |
|------------|--------|-----------|
| Rules (carga permanente) | 5.1k | 2.6% |
| Skills (bajo demanda) | 1.9k | 1.0% |
| Agents | 791 | 0.4% |
| **Total** | **~8k** | **~4%** |

Los skills se cargan bajo demanda. Los skills inactivos no consumen tokens.

## Referencia de comandos

| Comando | Descripción |
|---------|-------------|
| `/project-setup` | Autodetección y configuración del proyecto |
| `/feature-dev` | Workflow de desarrollo de funcionalidades |
| `/bug-fix` | Workflow de corrección de bugs |
| `/codex-review-fast` | Review rápido (solo diff) |
| `/codex-review-doc` | Review de documentación |
| `/precommit` | lint:fix → build → test |
| `/precommit-fast` | lint:fix → test (sin build) |
| `/verify` | Cadena de verificación completa |
| `/smart-commit` | Commit inteligente por lotes |
| `/push-ci` | Push + monitoreo de CI |
| `/create-pr` | Crear GitHub PR |
| `/codex-brainstorm` | Brainstorming adversarial (equilibrio de Nash) |
| `/tech-spec` | Generar tech spec |
| `/pr-review` | Self-review de PR |
| `/codex-security` | Auditoría OWASP Top 10 |

<details>
<summary>Los 73 comandos</summary>

### Desarrollo

| Comando | Descripción |
|---------|-------------|
| `/project-setup` | Autodetección y configuración del proyecto |
| `/repo-intake` | Escaneo inicial del proyecto (una sola vez) |
| `/install-rules` | Instalar reglas del plugin en `.claude/rules/` |
| `/install-hooks` | Instalar hooks del plugin en `.claude/` |
| `/install-scripts` | Instalar scripts de ejecución del plugin |
| `/codex-setup` | Inicializar infraestructura Codex CLI (AGENTS.md + hooks) |
| `/bug-fix` | Workflow de corrección de bugs |
| `/codex-implement` | Codex escribe código |
| `/codex-architect` | Consultoría de arquitectura (tercer cerebro) |
| `/code-explore` | Exploración rápida del codebase |
| `/git-investigate` | Rastreo del historial de código |
| `/issue-analyze` | Análisis profundo de issues |
| `/post-dev-test` | Tests complementarios post-desarrollo |
| `/feature-dev` | Workflow de desarrollo (diseño → implementación → verificación → review) |
| `/feature-verify` | Diagnóstico de sistema (verificación de solo lectura, doble perspectiva) |
| `/load-pr-review` | Cargar comentarios de review de PR de GitHub en la sesión |
| `/pr-comment` | Publicar comentarios de review amigables en un PR de GitHub |
| `/code-investigate` | Investigación de código con doble perspectiva (Claude + Codex independientes) |
| `/next-step` | Asesor contextual de siguiente paso |
| `/smart-commit` | Commit inteligente por lotes (agrupar + mensaje + comandos) |
| `/git-profile` | Gestor de identidad Git y perfil de firma GPG |
| `/push-ci` | Push (con aprobación) + monitoreo de CI |
| `/create-pr` | Crear GitHub PR desde branch |
| `/git-worktree` | Gestionar git worktrees (sincronización automática de .claude/) |
| `/merge-prep` | Análisis y preparación pre-merge |
| `/smart-rebase` | Rebase parcial inteligente para repos con squash-merge |
| `/deep-explore` | Exploración de código paralela multi-onda |
| `/remind` | Corrección ligera de modelo (recarga de reglas) |
| `/bump-version` | Actualizar versión de paquete + plugin en sincronía |
| `/watch-ci` | Monitorear ejecuciones de GitHub Actions CI |
| `/jira` | Integración Jira (ver/crear rama/transición de estado) |

### Review (Codex MCP)

| Comando | Descripción | Loop support |
|---------|-------------|--------------|
| `/codex-review-fast` | Review rápido (solo diff) | `--continue <threadId>` |
| `/codex-review` | Review completo (lint + build) | `--continue <threadId>` |
| `/codex-review-branch` | Review de branch completo | - |
| `/codex-cli-review` | Review CLI (lectura completa de disco) | - |
| `/codex-review-doc` | Review de documentación | `--continue <threadId>` |
| `/codex-security` | Auditoría OWASP Top 10 | `--continue <threadId>` |
| `/codex-test-gen` | Generar tests unitarios | - |
| `/codex-test-review` | Review de test coverage | `--continue <threadId>` |
| `/codex-explain` | Explicar código complejo | - |
| `/seek-verdict` | Verificación independiente (dismiss/confirm/clarify) | - |

### Verificación

| Comando | Descripción |
|---------|-------------|
| `/verify` | lint -> typecheck -> unit -> integration -> e2e |
| `/precommit` | lint:fix -> build -> test:unit |
| `/precommit-fast` | lint:fix -> test:unit |
| `/dep-audit` | Auditoría de seguridad de dependencias |
| `/project-audit` | Auditoría de salud del proyecto (puntuación determinista) |
| `/best-practices` | Auditoría de mejores prácticas de la industria (con debate adversarial) |
| `/risk-assess` | Evaluación de riesgos de código no commiteado |
| `/pre-pr-audit` | Auditoría de confianza pre-PR (puntuación 5 dimensiones) |
| `/test-deep` | Orquestación de tests con contexto |

### Planificación

| Comando | Descripción |
|---------|-------------|
| `/codex-brainstorm` | Brainstorming adversarial (equilibrio de Nash) |
| `/feasibility-study` | Análisis de viabilidad |
| `/tech-spec` | Generar tech spec |
| `/review-spec` | Revisar tech spec |
| `/deep-analyze` | Análisis profundo + roadmap |
| `/project-brief` | Resumen ejecutivo para PM/CTO |
| `/deep-research` | Orquestación de investigación profunda multi-agente |

### Documentación y herramientas

| Comando | Descripción |
|---------|-------------|
| `/update-docs` | Sincronizar docs con código |
| `/check-coverage` | Análisis de test coverage |
| `/create-request` | Crear/actualizar docs de requisitos |
| `/doc-refactor` | Simplificar documentación |
| `/simplify` | Simplificar código |
| `/de-ai-flavor` | Eliminar artefactos generados por IA de documentos |
| `/safe-remove` | Eliminación segura de activos del plugin |

| `/pr-review` | Self-review de PR |
| `/pr-summary` | Resumen de estado de PRs (agrupados por ticket) |
| `/contract-decode` | Decodificador de errores/calldata de contratos EVM |
| `/skill-health-check` | Validar calidad y routing de skills |
| `/statusline-config` | Personalizar segmentos y temas de la línea de estado |
| `/claude-health` | Verificación de configuración de Claude Code |
| `/op-session` | Inicializar sesión de 1Password CLI (evita solicitudes biométricas repetidas) |
| `/obsidian-cli` | Integración con vault de Obsidian vía CLI oficial |
| `/zh-tw` | Reescribir en chino tradicional |

</details>

## Reglas & Hooks

14 reglas (convenciones siempre cargadas) + 6 hooks (guardrails automatizados).

> **Personalización**: Edita `auto-loop-project.md` para sobrescribir el comportamiento de auto-loop por proyecto. Las actualizaciones del plugin no conflictuarán — ver [Rule Override Pattern](docs/features/rule-override-pattern/2-tech-spec.md).

Para la referencia completa de reglas, hooks y variables de entorno, consulta [docs/rules.md](docs/rules.md) y [docs/hooks.md](docs/hooks.md).

## Personalización

Ejecuta `/project-setup` para autodetectar y configurar todos los placeholders, o edita `.claude/CLAUDE.md` manualmente:

| Placeholder | Descripción | Ejemplo |
|-------------|-------------|---------|
| `{PROJECT_NAME}` | Nombre del proyecto | my-app |
| `{FRAMEWORK}` | Framework | MidwayJS 3.x, NestJS, Express |
| `{CONFIG_FILE}` | Archivo de config principal | src/configuration.ts |
| `{BOOTSTRAP_FILE}` | Entry de bootstrap | bootstrap.js, main.ts |
| `{DATABASE}` | Base de datos | MongoDB, PostgreSQL |
| `{TEST_COMMAND}` | Comando de tests | yarn test:unit |
| `{LINT_FIX_COMMAND}` | Auto-fix de lint | yarn lint:fix |
| `{BUILD_COMMAND}` | Comando de build | yarn build |
| `{TYPECHECK_COMMAND}` | Type checking | yarn typecheck |

## Demostración: Investigación Multi-Agente

Ejecuta `/deep-research` para orquestar 2-3 agentes de investigación en paralelo a través de fuentes web, codebase y conocimiento de la comunidad — con síntesis de claim registry y debate adversarial condicional.

| Característica | Detalles |
|----------------|----------|
| Agentes | 2-3 en paralelo (web + code + community) |
| Síntesis | Claim registry con detección de consenso |
| Validación | Debate condicional /codex-brainstorm |
| Scoring | Modelo de completitud de 4 señales |

[Documentación completa](docs/features/deep-research/)

## Arquitectura

```
Command (entrada) → Skill (capacidad) → Agent (entorno)
```

- **Commands**: El usuario los ejecuta con `/...`
- **Skills**: Knowledge bases cargadas bajo demanda
- **Agents**: Subagentes aislados con herramientas específicas
- **Hooks**: Guardrails automatizados (formateo, estado de review, stop guard)
- **Rules**: Convenciones siempre activas (carga automática)

Para detalles avanzados de arquitectura (agentic control stack, teoría de bucle de control, reglas de sandbox), consulta [docs/architecture.md](docs/architecture.md).

## Contribuir

PRs bienvenidos. Por favor:

1. Seguir las convenciones de naming existentes (kebab-case)
2. Incluir `When to Use` / `When NOT to Use` en skills
3. Agregar `disable-model-invocation: true` para operaciones peligrosas
4. Testear con Claude Code antes de enviar

## Licencia

MIT

## Star History

<a href="https://www.star-history.com/?repos=sd0xdev%2Fsd0x-dev-flow&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left" />
 </picture>
</a>
