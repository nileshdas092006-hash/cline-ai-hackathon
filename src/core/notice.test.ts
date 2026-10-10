import { describe, expect, it } from "vitest";
import { MAX_NOTICE_CHARS, noticeFromDemoFile, normalizeNotice } from "./notice";

const ORUNODOI_MD = `# Sample input for the Rule Maintenance Agent: a temporary payment change (demo)

*Demo notice modelled on a reported October 2026 change. Before quoting on slides, confirm.*

---

Orunodoi: For the month of October 2026, eligible beneficiaries will receive a one-time amount of Rs. 1,500 instead of the regular Rs. 1,250.

---

Expected agent behaviour: propose a new version of \`orunodoi-3\` with a time-bounded benefit override.`;

const IGNOAPS_MD = `# Sample input for the Scheme Onboarding Agent (demo)

*Paste this text into the admin "Add a scheme" page. Source: https://en.vikaspedia.in/viewcontent/x?lgn=en*

---

Indira Gandhi National Old Age Pension Scheme (IGNOAPS).

Eligibility: aged 60 years or above.`;

describe("noticeFromDemoFile", () => {
  it("keeps the notice and the source line, and drops the title and the 'expected behaviour' answer key", () => {
    const n = noticeFromDemoFile(ORUNODOI_MD);
    expect(n).toContain("one-time amount of Rs. 1,500");
    expect(n).not.toMatch(/Expected agent behaviour/);
    expect(n).not.toMatch(/^# /m);
  });

  it("keeps the source URL from the intro line", () => {
    const n = noticeFromDemoFile(IGNOAPS_MD);
    expect(n).toContain("https://en.vikaspedia.in/viewcontent/x?lgn=en");
    expect(n).toContain("aged 60 years or above");
    expect(n).not.toMatch(/Paste this text/);
  });
});

describe("normalizeNotice", () => {
  it("trims, normalises line endings and collapses blank runs", () => {
    expect(normalizeNotice("  a\r\n\r\n\r\n\r\nb  ")).toBe("a\n\nb");
  });
  it("caps the length", () => {
    expect(normalizeNotice("x".repeat(MAX_NOTICE_CHARS + 50)).length).toBe(MAX_NOTICE_CHARS);
  });
});
