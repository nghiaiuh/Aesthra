# Getting Started

## Prerequisites

- **Node.js** `>= 22.0.0`
- **pnpm** `>= 10.0.0`
- **Optional:** `ffmpeg` and `ffprobe` on `PATH` (for future/optional video stream metadata; not required for core installation, tests, or image/poster workflows)

## Installation

```bash
git clone <repository-url>
cd aesthra
pnpm install
pnpm build
pnpm brain doctor
```

Expected `doctor` behavior on a fresh clone:

- Required checks (`node-version`, directory permissions, `memory-schema`, `knowledge-schema`, `skills`) pass.
- Optional checks (`optional:ffmpeg`, `optional:vision-provider`) emit `[WARN]` if `ffmpeg` or a vision provider are not configured, without failing the workspace health check.

## Essential Commands

```bash
pnpm brain --help
pnpm brain profile
pnpm brain search "negative space"
pnpm brain learn --file ./examples/references/sample-poster.png --notes "Strong asymmetric framing"
pnpm brain analyze <reference-id> --import ./examples/analyses/sample-poster-analysis.json
pnpm brain propose <reference-id>
pnpm brain inbox
pnpm brain show <proposal-id>
pnpm brain approve <proposal-id> --yes
```

See [learning-workflow.md](learning-workflow.md) for a step-by-step walkthrough of every stage.

