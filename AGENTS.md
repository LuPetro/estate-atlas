# EstateAtlas engineering instructions

Work only inside this repository. Never use playground or change global software, SSH, firewall, AppArmor, or user accounts. Toolchains, caches and local PostgreSQL live under ignored `.local/`. Use `./scripts/pnpm`.

The owner's default for all app/server operation is Docker Compose, including development previews. Use `./scripts/docker` and compose.yaml; do not offer direct-host app launchers as the normal workflow. Existing host PostgreSQL is retained only as a migration source. If daemon access is blocked, prepare and validate the container configuration, explain the access block, and wait for the necessary server access rather than silently reverting to host operation. Isolated test/toolchain checks may run locally without changing system configuration.

The owner explicitly authorized Docker-group membership and granted it on 11 October 2026. If this long-lived session has stale supplementary groups, run authorized Docker commands with `sg docker -c './scripts/docker …'` (or the import command inside `sg`). New login sessions inherit the membership; do not request the same grant again.

On 15 October 2026 the owner explicitly authorized adding the dedicated GitHub deployment public key to `codexdev`'s `authorized_keys` with `restrict` (no forwarding or PTY). This narrow exception does not authorize changes to the SSH daemon, firewall or user accounts. Dev at `dev.estateatlas.app` is a private password-protected preview with SMTP deferred; keep production launch requirements separate. See docs/development-deployment.md.

After Dev adoption, use `EA_ENVIRONMENT=development ./scripts/docker …` or `EA_ENVIRONMENT=production ./scripts/docker …`. The retired legacy stack must never start a second PostgreSQL process on Dev's adopted data volume; the wrapper refuses its `up` commands.

On 11 October 2026 the owner also authorized removing both OpenAI research daily quotas for this private test deployment. Controlled user-started requests and sparing, targeted agent diagnostics are approved with GPT-6 Luna, at most four web tool calls and two model responses per job, and no automatic paid retries or bulk runs. Keep explicit app consent, ownership checks, duplicate-job protection and per-request bounds. This is not approval for other paid services or more expensive models. See docs/ai-research.md; do not ask again for costs already covered by this authorization.

Web (Next.js) and native mobile (Expo / React Native) are equal deliverables; never substitute a PWA. Shared Zod schemas and business rules belong in `packages/shared`, HTTP handling in `packages/api-client`. Check ownership on every private resource, including attachments and jobs. Preserve explicit currency groups; never add different currencies without a verified exchange rate. Never fabricate prices, research results, sources, users or authentication. Test data must be labeled and created only for the authenticated user's portfolio.

Run type checks, meaningful real-PostgreSQL API tests, Next production build and Android/iOS JS exports. Document device checks that cannot run on this VPS. Keep credentials and private files out of Git. Local commits are authorized; repository creation and pushes need the owner's explicit approval. No paid services without approval.
