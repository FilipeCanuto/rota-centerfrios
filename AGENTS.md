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
- Administrative user updates accept only editable business fields, never login identity, creation time or demo flags; email changes require an unclaimed invitation and successful calls are audited atomically. Why: prevent identity reassignment from bypassing commercial RLS.
- The signup trigger atomically claims an administrator-pre-registered user, consumes pending roles into the protected role table, and preserves existing company memberships. Why: new accounts must not receive implicit privileges or demo identities.
- Client reassignment uses the checked database function; an invoker trigger verifies privileged execution plus a transaction-local marker, and integration changes are also audited. Audit inserts are internal-only with actor identity derived from the session. Why: prevent forged history and direct portfolio reassignment.
- Holidays are stored in the audited company-aware calendar table; a null company makes a date global, and only directors can mutate it. Annual copying uses a SECURITY INVOKER function and the existing audit trigger. Why: preserve caller RLS and authoritative calendar history without changing screens.
- Dashboard and header aggregate RPCs are STABLE SECURITY INVOKER, convert interaction dates to America/Maceio, and return data rather than business rules. Why: avoid API row-limit truncation while preserving caller RLS and tested application rules.
- Demo lifecycle uses authenticated, role-checked SECURITY DEFINER RPCs with a shared transaction lock; cleanup rejects real/demo dependency collisions and preserves signed-in identities, while audited seller references become null on identity deletion. Why: avoid cascading deletion of real data and retain audit history.
- Production bootstrap calls demo cleanup followed by the idempotent national-holiday loader; demo loading reuses companies and existing memberships and never overwrites real targets. Why: historical seed migrations remain immutable without forcing demo data into real use.
- Status is always icon + word (`SeloStatus`); charts always ship a text summary and a "Ver como tabela" toggle (`GraficoAnel`). Why: WCAG 2.2 AA requirement.
- Gamification points and badges are written only by role-checked SECURITY DEFINER functions with idempotent upserts; weights and campaign text live in company-scoped configuration tables. Why: prevent self-awarded points and let diretoria tune rules.
- Links carry `publico` (`interno` default | `cliente`); only `cliente` links may be sent to customers (WhatsApp hidden for internal ones), checked via `podeEnviarAoCliente`. Why: avoid leaking internal material.
- Notice-board and login media: `pode_publicar_avisos()` (admin or `usuarios.pode_publicar_avisos`) gates `avisos` and its private bucket; non-admin publishers edit/delete only their own rows. `midia_login` and its bucket are admin-write only, anon-readable only for active rows. Type and size limits are enforced by the database as well. Why: restrict who can publish content shown to everyone, including the public login page.
- Commercial data access requires both the existing role policies and an active `comercial` sector (RESTRICTIVE `setor_comercial` policies plus a check in commercial SECURITY DEFINER RPCs); sectors, roles and memberships are written only by checked admin functions, and inactive accounts lose every sector. Why: add departments without rewriting role-based RLS.
- The sector catalog lives in `setores`; authenticated users only read it, only admin RPCs `admin_criar_setor`/`admin_atualizar_setor` write name/icon/active (audited, no deletion), and `disponivel` changes only via migration. Deactivating a sector never touches granted `usuario_setores` rows. Why: admins manage departments without a deploy while module availability stays tied to releases.
