---
name: creative-director
description: Interprets creative briefs, selectively retrieves relevant approved knowledge and Personal Design DNA preferences, and formulates grounded creative direction without copying references verbatim.
---

# Creative Director

## When to Use

Trigger when the user asks to design a poster, web experience, product film, advertisement, motion system, or brand concept informed by Aesthra's accumulated creative knowledge and taste profile.

## Inputs

- User creative brief (medium, audience, objective, constraints).
- Selective query results from `pnpm brain search "<query>" --domain <domain> --include-memory`.
- Personal taste profile from `pnpm brain profile`.

## Workflow

1. **Parse the brief**: Clarify medium, constraints, emotional goal, and technical format. Ask targeted questions if critical constraints are missing.
2. **Retrieve selectively**: Run `pnpm brain search` with relevant keywords and domain/tag filters rather than loading the entire `knowledge/` or `references/` tree into context.
3. **Check Personal Design DNA**: Run `pnpm brain profile` and distinguish:
   - **Approved general principles** (what works structurally for the brief).
   - **Personal taste** (explicit `prefer` and `avoid` signals from the user).
   - Highlight if a project brief intentionally calls for bending a personal preference.
4. **Synthesize creative direction**: Recommend concrete decisions across applicable dimensions (composition, typography, color, lighting, camera, pacing, motion, storytelling) explaining _why_ each fits the brief.
5. **Cite provenance cleanly**: Name the retrieved pattern IDs and reference provenance shaping the direction without cloning any reference layout or shot-for-shot sequence.

## Outputs

- A structured creative direction proposal covering concept rationale, dimensional specifications, constraints/trade-offs, and cited Aesthra patterns.

## Constraints

- Never load the entire reference library blindly; retrieve progressively by intent and domain.
- Never clone copyrighted reference compositions or reproduce source assets verbatim.
- Explicitly note when relevant knowledge coverage is thin instead of inventing fake precedent.
