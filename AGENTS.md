<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Folders: `src/design-system` (tokens/components), `src/modulos/<módulo>` (screens + data hooks), `src/regras` (pure calculation rules, tested in `regras.test.ts`), `src/integracoes` (interfaces + "manual" implementations). Why: integrations can be swapped without touching screens.
- All business limits are read from the `configuracoes_regras` table via `montarConfiguracao`; never hardcode thresholds in screens. Why: diretoria edits them.
- Company-owned data carries `empresa_id`, `created_at`, `origem` and (for demo-able data) `demo`; companies identify themselves by `id`. Access is enforced by RLS helpers `pode_ver_vendedor`/`tem_empresa`. Why: multi-company + role visibility.
- Authorization uses only protected company-scoped roles, never the deprecated user profile column; global director access is separate from administrative access, and full user updates use the checked administrative function. Why: prevent administrative access from exposing commercial portfolios or bypassing column restrictions.
- The signup trigger atomically claims an administrator-pre-registered user, consumes pending roles into the protected role table, and preserves existing company memberships. Why: new accounts must not receive implicit privileges or demo identities.
- Client reassignment uses the checked database function; an invoker trigger verifies privileged execution plus a transaction-local marker, and integration changes are also audited. Audit inserts are internal-only with actor identity derived from the session. Why: prevent forged history and direct portfolio reassignment.
- Holidays are stored in the audited company-aware calendar table; a null company makes a date global, and only directors can mutate it. Why: business-day calculations need an authoritative calendar without altering screens during schema-only work.
- Dashboard and header aggregate RPCs are STABLE SECURITY INVOKER, convert interaction dates to America/Maceio, and return data rather than business rules. Why: avoid API row-limit truncation while preserving caller RLS and tested application rules.
- Demo lifecycle uses authenticated, role-checked SECURITY DEFINER RPCs with a shared transaction lock; cleanup rejects real/demo dependency collisions and preserves signed-in identities, while audited seller references become null on identity deletion. Why: avoid cascading deletion of real data and retain audit history.
- Production bootstrap calls demo cleanup followed by the idempotent national-holiday loader; demo loading reuses companies and existing memberships and never overwrites real targets. Why: historical seed migrations remain immutable without forcing demo data into real use.
- Status is always icon + word (`SeloStatus`); charts always ship a text summary and a "Ver como tabela" toggle (`GraficoAnel`). Why: WCAG 2.2 AA requirement.
