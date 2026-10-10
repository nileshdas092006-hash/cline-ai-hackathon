# Active context

## Current state
T1 (core rule engine v2) is done. `src/core/` has the zod schemas, the 3 rule packs with provenance, the registry, name matcher, age, Aadhaar masking, benefit overrides, rule engine, rejection codes and fake sample sets A/B/C. 93 tests pass; typecheck, lint and build are clean.
The app is still a placeholder home page, now titled "KaagazCheck: কাগজ চেক" with "Check before you apply" / "আবেদনৰ আগতে পৰীক্ষা কৰক", `<html lang="as">`.

## Decisions made in T1
- Brief v2: **Assamese default + English**; two verdicts (eligibility, readiness); provenance on every rule (verified vs provisional).
- `RuleProvenance.sourceUrl` is nullable, but a `verified` rule must have one (schema refine). Provisional overrides from the T3 agent can start with `sourceUrl: null`.
- `ExtractedDoc.fields` is strict and only holds `aadhaarLast4` (never a full Aadhaar number). A missing per-field confidence means "entered/confirmed by the user"; < 0.8 → needs_verification.
- The name reference document is Aadhaar for PM-KISAN and the widow pension, and the ration card for Orunodoi.
- A PM-KISAN land-owner mismatch becomes `needs_verification` (not ok) if the user answers `land_in_family_member_name` = yes (farmer family = spouse/minor children).
- Orunodoi question ids: `nfsa_enrolled` (requirement); any-of `widow | person_with_disability | aay_card | income_below_2_lakh`; exclusions `elected_representative | professional | govt_staff_or_pensioner | contractor_or_trader | large_landholder | four_wheeler | similar_state_scheme`. All provisional.
- Widow pension: all mandatory docs (incl. `bpl_proof`) are provisional ("commonly required; confirm locally"); age and BPL are verified.
- The registry is in-memory: `registerScheme` validates, rejects a duplicate id+version and keeps old versions. T3 will persist versions in SQLite and register them at startup.
- Assamese strings in `labels.ts`, the scheme packs and `rejectionCodes.ts` are drafts awaiting native-speaker review (Das).

## Next step
T2: main flow (scheme picker → documents/samples → confirm fields → questions → two-verdict report), `src/i18n.ts` (as/en), AI gateway `src/server/ai.ts`.
