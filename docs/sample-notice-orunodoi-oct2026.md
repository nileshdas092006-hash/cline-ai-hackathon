# Sample input for the Rule Maintenance Agent: a temporary payment change (demo)

*Demo notice modelled on a reported October 2026 change (The Economic Times report of a one-time ₹1,500 Orunodoi payment for that month). Before quoting on slides, confirm against the official Government of Assam notification.*

---

Orunodoi: For the month of October 2026, eligible beneficiaries will receive a one-time amount of Rs. 1,500 instead of the regular Rs. 1,250. From November 2026, the regular monthly amount of Rs. 1,250 continues.

---

Expected agent behaviour: propose a new version of `orunodoi-3` with a time-bounded benefit override (effective 2026-10-01 to 2026-10-31, amount 1500), keep the recurring 1250, mark provenance as provisional until an official notice URL is added, write regression tests (October date → 1500, November date → 1250, eligibility checks unchanged), run all existing tests, and wait for human approval.
