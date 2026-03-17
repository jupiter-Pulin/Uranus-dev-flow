# sd0x-dev-flow

**Idioma**: [English](README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Español

**El motor de workflow de desarrollo autónomo para [Claude Code](https://claude.com/claude-code).**

- **Cero gates manuales** — editar código, auto-review, auto-fix, entregar
- **Arquitectura dual-reviewer** — Codex MCP + reviewer secundario en paralelo, fail-closed
- **~4% de context footprint** — el 96% de la ventana de 200k de Claude queda para tu código

65 commands | 49 skills | 14 agents | 5 hooks | 12 rules | 11 scripts

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

El **motor auto-loop** aplica quality gates automáticamente — tras cualquier edición de código, Claude dispara **dual review** (Codex MCP + reviewer secundario en paralelo) en la misma respuesta. Los hallazgos se deduplican, normalizan por severidad y agregan en un único gate. Los hooks aplican semántica fail-closed: si el gate agregado está incompleto, stop-guard bloquea.

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

    Note over H: Fail-closed: incomplete gate → blocked
```

</details>

## Funcionalidad destacada: Arquitectura Dual-Reviewer

v2.0 despacha dos reviewers independientes en paralelo — cero punto único de fallo:

| Reviewer | Rol | Fallback |
|----------|-----|----------|
| Codex MCP | Primario (sandbox, diff completo) | Siempre disponible |
| Secundario (pr-review-toolkit) | Review con puntuación de confianza | strict-reviewer → modo single |

Los hallazgos se **normalizan por severidad** (P0-Nit), **deduplican** (archivo + clave de issue, tolerancia ±5 líneas) y se **atribuyen por fuente** (`codex` | `toolkit` | `both`).

Gate: `✅ Ready` o `⛔ Blocked` — fail-closed (gate incompleto = bloqueado).

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
| Instalar plugin | Claude Code | Completa (65 commands, hooks, rules, auto-loop) |
| `npx skills add` | Codex CLI, Cursor, Windsurf, Aider | Solo Skills (49 skills) |
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
| Commands | 65 | `/project-setup`, `/codex-review-fast`, `/verify`, `/smart-commit` |
| Skills | 49 | project-setup, code-explore, smart-commit, contract-decode |
| Agents | 14 | strict-reviewer, verify-app, coverage-analyst |
| Hooks | 5 | pre-edit-guard, auto-format, review state tracking, stop guard, namespace hint |
| Rules | 12 | auto-loop, auto-loop-project, codex-invocation, security, testing, git-workflow, self-improvement |
| Scripts | 11 | precommit runner, verify runner, dep audit, namespace hint, skill runner, commit-msg guard, pre-push gate, utils (shared lib), emit-review-gate, worktree-claude-sync, build-codex-artifacts |

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
<summary>Los 65 comandos</summary>

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
| `/seek-verdict` | Verificación ciega de dismiss P2 | - |

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

### Planificación

| Comando | Descripción |
|---------|-------------|
| `/codex-brainstorm` | Brainstorming adversarial (equilibrio de Nash) |
| `/feasibility-study` | Análisis de viabilidad |
| `/tech-spec` | Generar tech spec |
| `/review-spec` | Revisar tech spec |
| `/deep-analyze` | Análisis profundo + roadmap |
| `/project-brief` | Resumen ejecutivo para PM/CTO |

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
| `/skill-creator` | Crear nuevos skills (plugin externo) |
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

## Rules

| Rule | Descripción |
|------|-------------|
| `auto-loop` | Fix -> re-review -> fix -> ... -> Pass (ciclo automático) |
| `auto-loop-project` | Overrides de auto-loop específicos del proyecto (propiedad del usuario, no gestionado por plugin) |
| `codex-invocation` | Codex debe investigar independientemente, nunca alimentar conclusiones |
| `fix-all-issues` | Tolerancia cero: corregir todos los issues encontrados |
| `self-improvement` | Corrección → registrar lección → prevenir recurrencia |
| `framework` | Convenciones del framework (personalizables) |
| `testing` | Aislamiento Unit/Integration/E2E |
| `security` | Checklist OWASP Top 10 |
| `git-workflow` | Naming de branches, convenciones de commits |
| `docs-writing` | Tablas > párrafos, Mermaid > texto |
| `docs-numbering` | Prefijos de documentos (0-feasibility, 2-spec) |
| `logging` | JSON estructurado, sin secrets |

> **Personalización**: Edita `auto-loop-project.md` para sobrescribir el comportamiento de auto-loop por proyecto. Las actualizaciones del plugin no conflictuarán — ver [Rule Override Pattern](docs/features/rule-override-pattern/2-tech-spec.md).

## Hooks

| Hook | Trigger | Propósito |
|------|---------|-----------|
| `namespace-hint` | SessionStart | Inyectar guía de namespace de comandos del plugin en el contexto de Claude |
| `post-edit-format` | Después de Edit/Write | Auto prettier + invalidar estado de review al editar |
| `post-tool-review-state` | Después de Bash / herramientas MCP | Tracking de estado de review (sentinel routing, soporte de comandos con namespace) |
| `pre-edit-guard` | Antes de Edit/Write | Prevenir edición de .env/.git |
| `stop-guard` | Antes de detener | Bloquear o advertir si hay reviews incompletos + verificación stale-state git (strict tras instalar, warn en plugin runtime) |

Los hooks son seguros por defecto. Variables de entorno para personalizar:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `STOP_GUARD_MODE` | `strict` (instalado) / `warn` (plugin runtime) | `strict` bloquea stop si faltan pasos de review; `warn` solo advierte |
| `HOOK_NO_FORMAT` | (no definido) | `1` para desactivar auto-formateo |
| `HOOK_BYPASS` | (no definido) | `1` para saltar todos los checks de stop-guard |
| `HOOK_DEBUG` | (no definido) | `1` para mostrar info de debug |
| `GUARD_EXTRA_PATTERNS` | (no definido) | Regex para paths protegidos adicionales (ej. `src/locales/.*\.json$`) |

**Dependencias**: Los hooks requieren `jq`. El auto-formateo requiere `prettier`. Si faltan dependencias, se manejan de forma segura.

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

## Demostración: StatusLine Config

Personaliza la statusline de Claude Code — segmentos, temas y colores. Instalar como skill independiente:

```bash
npx skills add sd0xdev/sd0x-dev-flow --skill statusline-config
```

| Característica | Detalles |
|----------------|----------|
| Segments | Directory, Git branch, Model, Context %, Cost, >200k alert |
| Themes | ansi-default, catppuccin-mocha, dracula, nord, none |
| Engine | POSIX shell + JSON stdin + semantic color tokens |
| Accessibility | WCAG AA contrast, NO\_COLOR support |

[Documentación completa](docs/features/statusline-config/2-tech-spec.md)

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

[![Star History Chart](https://api.star-history.com/svg?repos=sd0xdev/sd0x-dev-flow&type=date&legend=top-left)](https://www.star-history.com/#sd0xdev/sd0x-dev-flow&type=date&legend=top-left)
