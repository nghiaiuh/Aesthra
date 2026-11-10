# Security Policy

## Scope and Design Posture

Aesthra handles local media files, external source URLs, structured analysis JSON imports, and filesystem writes across `knowledge/`, `memory/`, `references/`, and `learning/inbox/`.

Because external references may contain untrusted text, metadata, or crafted file paths, Aesthra enforces strict local boundaries:

1. **Path Traversal Protection**: All proposal targets (`knowledge/`, `memory/`, `skills/`) are validated with `resolveSafeTargetPath`, blocking absolute paths, `..` traversal, null bytes, and symlink escapes outside the workspace root.
2. **Atomic & Conflict-Checked Writes**: Approved proposals verify expected file existence (`create` vs `update`) and `baseFileHash` integrity before writing via temporary files and atomic rename.
3. **SSRF-Safe URL Registration**: URL ingestion validates `http:` / `https:` schemes only, rejects embedded credentials, blocks loopback/private/link-local/metadata IP ranges, and does **not** automatically fetch or scrape remote URLs.
4. **Prompt Injection Defense**: Reference notes, URLs, captions, and analysis metadata are strictly untrusted data objects for inspection—never executable instructions, agent policies, or shell commands.
5. **No Automatic Privilege Escalation**: Agents may analyze and generate pending proposals, but must never silently modify `skills/*/SKILL.md`, approved `knowledge/`, `memory/design-dna.yaml`, or repository configuration without explicit human approval.
6. **Secret Handling**: Never place API keys, tokens, or credentials in committed files, fixtures, logs, or reference metadata. Use local environment variables documented in `.env.example`.

## Supported Versions

Aesthra is currently in initial `0.1.x` developer preview. Security fixes target the `main` branch.

## Reporting a Vulnerability

If you discover a vulnerability in Aesthra (such as path traversal, unsafe command execution, SSRF bypass, or schema validation gaps):

- Prefer reporting privately via the repository hosting platform's private vulnerability disclosure / Security Advisories feature if enabled on your fork or upstream repository.
- If private advisories are unavailable and the issue does not expose active credentials or user data, open a concise issue describing the affected component and wait for maintainer coordination before posting exploit payloads.
- Do not include live secrets, personal reference files, or third-party copyrighted media in any report.

