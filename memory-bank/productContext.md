# Product context: KaagazCheck (कागज़ चेक)

## Why it exists
Eligible people lose welfare benefits *after* applying: names that don't match across Aadhaar, bank and land records; Aadhaar not seeded to the bank; missing certificates; rejection reasons they cannot understand. Documented example: Rajasthan 2019, only about 23% of registered PM-KISAN farmers got the 3rd instalment, mostly because of Aadhaar name mismatches (sources in `docs/research.md`).

KaagazCheck checks the papers **before** the person applies, in Hindi (English toggle), and says exactly what to fix and where.

## Users
- **Citizen** (farmer, widow, woman of an Assam household) on a basic Android phone, often helped by a family member or a CSC/NGO helper.
- **Admin / helper organisation** that adds new schemes through the Scheme Onboarding Agent (Cline SDK).

## Schemes in scope
PM-KISAN (`pm-kisan`) · Orunodoi 3.0, Assam (`orunodoi-3`) · Widow Pension IGNWPS (`nsap-widow`). Rules are in `docs/schemes.md`.

## Main demo path (3 minutes)
1. Pick a scheme.
2. Add documents: upload a photo or tap "Use sample" (clean / name mismatch / missing document).
3. AI reads each document → fields + confidence; low confidence → the user confirms or edits.
4. Answer 3–5 yes/no exclusion questions.
5. Rule engine → readiness report: 🟢 ready / 🔴 fix first / ⚪ not eligible / 🟡 confirm at office, each check with a reason, where to fix it and its source.
6. Hindi report + printable cover sheet.

## Second mode
Rejection decoder (T4): rejection text → known reason code → fix steps + a drafted Hindi letter.

## Cline inside the product
Scheme Onboarding Agent (T3): guideline text → rule definition + test cases → run through the rule engine → **pending** proposal → a human approves.

## Trust rules
- The AI only reads and explains; the rule engine decides.
- Aadhaar is masked to the last 4 digits everywhere; uploaded images are processed in memory, never stored.
- When unsure, say "confirm at the office"; never guess.
- Demo uses fake sample documents only.
