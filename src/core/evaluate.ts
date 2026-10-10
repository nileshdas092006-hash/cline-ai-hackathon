// The deterministic rule engine: evaluate(scheme, docs, answers, asOfDate) → Report. Pure.
// Two verdicts (eligibility, readiness). Provisional rules and external facts never decide; they
// return needs_verification. A fuzzy name score never becomes `ok`; only `same` does.
import { ageOn } from "./age";
import { benefitOn } from "./benefit";
import { assertIsoDate, isIsoDate } from "./dates";
import { DISCLAIMER, DOC_LABELS, FIX_WHERE_LABELS, type Bilingual } from "./labels";
import { bestNameMatch, normalizeName } from "./nameMatch";
import type {
  Answers,
  Check,
  DocType,
  Eligibility,
  ExtractedDoc,
  FieldName,
  FixWhere,
  NameCheckRule,
  NameMatchResult,
  Question,
  Readiness,
  Report,
  SchemeRule,
} from "./types";

/** A field read with confidence below this must be confirmed by the user. */
export const LOW_CONFIDENCE_THRESHOLD = 0.8;

const where = (w: FixWhere): Bilingual => FIX_WHERE_LABELS[w];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function findDoc(docs: readonly ExtractedDoc[], docType: DocType): ExtractedDoc | undefined {
  return docs.find((d) => d.docType === docType);
}

function isLowConfidence(doc: ExtractedDoc, field: FieldName): boolean {
  const c = doc.confidence[field];
  return c !== undefined && c < LOW_CONFIDENCE_THRESHOLD;
}

// ---------- documents ----------
function mandatoryDocChecks(scheme: SchemeRule, docs: readonly ExtractedDoc[]): Check[] {
  return scheme.mandatoryDocs.map((req): Check => {
    const label = DOC_LABELS[req.docType];
    const base = { id: `doc_${req.docType}`, kind: "document" as const, docType: req.docType, provenance: req.provenance };
    if (findDoc(docs, req.docType)) {
      return {
        ...base,
        result: "ok",
        messageEn: `${cap(label.en)} added.`,
        messageAs: `${label.as} যোগ কৰা হৈছে।`,
        fixWhere: "none",
      };
    }
    const commonly = req.provenance.status === "provisional";
    return {
      ...base,
      result: "action_required",
      messageEn:
        `Missing: ${label.en}. Get it from ${where(req.fixWhere).en} and add it before you apply.` +
        (commonly ? " (Commonly required; confirm locally.)" : ""),
      messageAs:
        `নাই: ${label.as}। আবেদন কৰাৰ আগতে ${where(req.fixWhere).as}ৰ পৰা লৈ যোগ কৰক।` +
        (commonly ? " (সাধাৰণতে লাগে; স্থানীয়ভাৱে নিশ্চিত কৰক।)" : ""),
      fixWhere: req.fixWhere,
    };
  });
}

// ---------- names ----------
function nameCheck(scheme: SchemeRule, rule: NameCheckRule, docs: readonly ExtractedDoc[], answers: Answers): Check {
  const target = findDoc(docs, rule.docType);
  const reference = findDoc(docs, scheme.nameReference);
  const t = DOC_LABELS[rule.docType];
  const r = DOC_LABELS[scheme.nameReference];
  const base = { id: `name_${rule.docType}`, kind: "name" as const, docType: rule.docType, provenance: rule.provenance };

  if (!target || !reference) {
    const missing = target ? r : t;
    return {
      ...base,
      result: "not_applicable",
      messageEn: `Name on the ${t.en} not compared: the ${missing.en} is not added.`,
      messageAs: `${t.as}ৰ নাম মিলোৱা হোৱা নাই: ${missing.as} যোগ কৰা হোৱা নাই।`,
      fixWhere: "none",
    };
  }

  const refName = reference.fields.name ?? "";
  const names = rule.field === "ownerNames" ? (target.fields.ownerNames ?? []) : [target.fields.name ?? ""];
  const readable = names.filter((n) => normalizeName(n) !== "");
  if (normalizeName(refName) === "" || readable.length === 0) {
    const which = normalizeName(refName) === "" ? r : t;
    return {
      ...base,
      result: "needs_verification",
      messageEn: `We could not read the name on the ${which.en}. Please type it exactly as printed.`,
      messageAs: `${which.as}ত থকা নামটো আমি পঢ়িব নোৱাৰিলোঁ। ছপা হোৱাৰ দৰে হুবহু লিখক।`,
      fixWhere: "applicant",
    };
  }

  const match = bestNameMatch(refName, readable);
  const score = match.score.toFixed(2);
  if (isLowConfidence(reference, "name") || isLowConfidence(target, rule.field)) {
    return {
      ...base,
      match,
      result: "needs_verification",
      messageEn: `We are not sure we read the name on the ${t.en} or ${r.en} correctly. Please check it and correct it if needed.`,
      messageAs: `${t.as} বা ${r.as}ত থকা নামটো আমি শুদ্ধকৈ পঢ়িছোঁ নে নাই নিশ্চিত নহয়। পৰীক্ষা কৰি প্ৰয়োজন হ'লে শুধৰাওক।`,
      fixWhere: "applicant",
    };
  }

  if (match.level === "same") {
    return {
      ...base,
      match,
      result: "ok",
      messageEn: `Name on the ${t.en} matches the ${r.en}.`,
      messageAs: `${t.as}ৰ নাম ${r.as}ৰ সৈতে মিলে।`,
      fixWhere: "none",
    };
  }
  if (match.level === "possible_match" || match.level === "initials_only") {
    const initials = match.level === "initials_only";
    return {
      ...base,
      match,
      result: "needs_verification",
      messageEn:
        (initials
          ? `The name on the ${t.en} uses initials instead of the full name on the ${r.en} (similarity ${score}). `
          : `The names on the ${t.en} and ${r.en} look like the same person written differently (similarity ${score}). `) +
        `Officials may still reject this. Ask ${where(rule.fixWhere).en} to make them identical.`,
      messageAs:
        (initials
          ? `${t.as}ত ${r.as}ৰ সম্পূৰ্ণ নামৰ সলনি আদ্যাক্ষৰ ব্যৱহাৰ কৰা হৈছে (মিল ${score})। `
          : `${t.as} আৰু ${r.as}ৰ নাম একেজন ব্যক্তিৰ বেলেগকৈ লিখা যেন লাগে (মিল ${score})। `) +
        `বিষয়াই তথাপিও নাকচ কৰিব পাৰে। দুয়োটা হুবহু একে কৰিবলৈ ${where(rule.fixWhere).as}ত কওক।`,
      fixWhere: rule.fixWhere,
    };
  }
  return mismatchCheck(base, rule, answers, match, t, r, score);
}

function mismatchCheck(
  base: Pick<Check, "id" | "kind" | "docType" | "provenance">,
  rule: NameCheckRule,
  answers: Answers,
  match: NameMatchResult,
  t: Bilingual,
  r: Bilingual,
  score: string,
): Check {
  const family = rule.familyOwnerQuestion;
  if (family && answers[family.id] === true) {
    // Land owned by a spouse/minor child is allowed, but we cannot prove the relationship from a photo.
    return {
      ...base,
      match,
      result: "needs_verification",
      messageEn: `The owner on the ${t.en} is not you; you said it is a family member. Take proof of the relationship to ${where(rule.fixWhere).en} and confirm it is accepted.`,
      messageAs: `${t.as}ত থকা গৰাকী আপুনি নহয়; আপুনি কৈছে যে তেওঁ পৰিয়ালৰ সদস্য। সম্পৰ্কৰ প্ৰমাণ লৈ ${where(rule.fixWhere).as}ত গ্ৰহণযোগ্য নেকি নিশ্চিত কৰক।`,
      fixWhere: rule.fixWhere,
    };
  }
  return {
    ...base,
    match,
    result: "action_required",
    messageEn: `The name on the ${t.en} does not match the ${r.en} (similarity ${score}). Correct the ${t.en} at ${where(rule.fixWhere).en} so it matches exactly.`,
    messageAs: `${t.as}ৰ নাম ${r.as}ৰ সৈতে মিল নাই (মিল ${score})। হুবহু মিলাবলৈ ${where(rule.fixWhere).as}ত ${t.as} শুধৰাওক।`,
    fixWhere: rule.fixWhere,
  };
}

// ---------- field formats ----------
function fieldChecks(scheme: SchemeRule, docs: readonly ExtractedDoc[]): Check[] {
  const out: Check[] = [];
  for (const f of scheme.fieldChecks) {
    const doc = findDoc(docs, f.docType);
    if (!doc) continue; // the missing-document check already covers this
    const base = { id: `field_${f.id}`, kind: "field" as const, docType: f.docType, provenance: f.provenance };
    const raw = doc.fields[f.field];
    const value = (raw ?? "").replace(/[\s-]/g, "").toUpperCase();
    if (value === "" || isLowConfidence(doc, f.field)) {
      out.push({
        ...base,
        result: "needs_verification",
        messageEn: `Please type the ${f.labelEn} exactly as printed on the ${DOC_LABELS[f.docType].en}.`,
        messageAs: `${DOC_LABELS[f.docType].as}ত ছপা হোৱাৰ দৰে ${f.labelAs} হুবহু লিখক।`,
        fixWhere: "applicant",
      });
    } else if (new RegExp(f.pattern).test(value)) {
      out.push({ ...base, result: "ok", messageEn: `${cap(f.labelEn)} looks valid.`, messageAs: `${f.labelAs} সঠিক যেন লাগে।`, fixWhere: "none" });
    } else {
      out.push({
        ...base,
        result: "action_required",
        messageEn: `The ${f.labelEn} looks wrong. ${f.hintEn} Check it with ${where(f.fixWhere).en}.`,
        messageAs: `${f.labelAs} ভুল যেন লাগে। ${f.hintAs} ${where(f.fixWhere).as}ত পৰীক্ষা কৰক।`,
        fixWhere: f.fixWhere,
      });
    }
  }
  return out;
}


// ---------- eligibility ----------
function ageCheck(scheme: SchemeRule, docs: readonly ExtractedDoc[], asOfDate: string): Check | null {
  const range = scheme.ageRange;
  if (!range) return null;
  const base = { id: "age", kind: "eligibility" as const, provenance: range.provenance };
  const src = DOC_LABELS[range.dobFrom];
  const doc = findDoc(docs, range.dobFrom);
  const dob = doc?.fields.dob;
  const unsure = (en: string, as: string): Check => ({ ...base, result: "needs_verification", messageEn: en, messageAs: as, fixWhere: "applicant" });

  if (!doc || !dob) {
    return unsure(
      `We need the date of birth from the ${src.en} to check the age limit (${range.min}–${range.max}).`,
      `বয়সৰ সীমা (${range.min}–${range.max}) পৰীক্ষা কৰিবলৈ ${src.as}ৰ জন্মৰ তাৰিখ লাগিব।`,
    );
  }
  if (!isIsoDate(dob) || dob > asOfDate || isLowConfidence(doc, "dob")) {
    return unsure(
      `Please confirm the date of birth on the ${src.en} (we could not read it reliably).`,
      `${src.as}ত থকা জন্মৰ তাৰিখটো নিশ্চিত কৰক (আমি নিৰ্ভৰযোগ্যভাৱে পঢ়িব নোৱাৰিলোঁ)।`,
    );
  }
  const age = ageOn(dob, asOfDate);
  if (age >= range.min && age <= range.max) {
    return {
      ...base,
      result: "ok",
      messageEn: `Age ${age} on ${asOfDate} is within ${range.min}–${range.max}.`,
      messageAs: `${asOfDate} তাৰিখত বয়স ${age}, যি ${range.min}–${range.max}ৰ ভিতৰত।`,
      fixWhere: "none",
    };
  }
  const above = age > range.max;
  const verifiedRule = range.provenance.status === "verified";
  return {
    ...base,
    result: verifiedRule ? "action_required" : "needs_verification",
    messageEn:
      `Age ${age} on ${asOfDate} is outside the ${range.min}–${range.max} limit for this scheme.` +
      (above && range.aboveMaxHintEn ? ` ${range.aboveMaxHintEn}` : ""),
    messageAs:
      `${asOfDate} তাৰিখত বয়স ${age}, যি এই আঁচনিৰ ${range.min}–${range.max} সীমাৰ বাহিৰত।` +
      (above && range.aboveMaxHintAs ? ` ${range.aboveMaxHintAs}` : ""),
    fixWhere: verifiedRule ? "none" : scheme.confirmAt,
  };
}

const confirmPlace = (scheme: SchemeRule, q: Question): FixWhere => q.fixWhere ?? scheme.confirmAt;

function notAnswered(scheme: SchemeRule, id: string, q: Question): Check {
  const w = where(confirmPlace(scheme, q));
  return {
    id,
    kind: "eligibility",
    result: "needs_verification",
    messageEn: `Please answer: ${q.textEn} (If unsure, ask at ${w.en}.)`,
    messageAs: `অনুগ্ৰহ কৰি উত্তৰ দিয়ক: ${q.textAs} (নিশ্চিত নহ'লে ${w.as}ত সোধক।)`,
    fixWhere: confirmPlace(scheme, q),
    provenance: q.provenance,
  };
}

/** A criterion that went against the applicant: definitive only if the rule is verified. */
function failed(scheme: SchemeRule, id: string, q: Question, en: string, as: string): Check {
  if (q.provenance.status === "verified") {
    return {
      id,
      kind: "eligibility",
      result: "action_required",
      messageEn: `${en} This makes you not eligible for ${scheme.nameEn}.`,
      messageAs: `${as} ইয়াৰ বাবে আপুনি ${scheme.nameAs}ৰ বাবে যোগ্য নহয়।`,
      fixWhere: "none",
      provenance: q.provenance,
    };
  }
  const w = where(confirmPlace(scheme, q));
  return {
    id,
    kind: "eligibility",
    result: "needs_verification",
    messageEn: `${en} This may make you ineligible. Confirm at ${w.en}. Ask whether "${q.labelEn}" still applies under the current rules.`,
    messageAs: `${as} ইয়াৰ বাবে আপুনি অযোগ্য হ'ব পাৰে। ${w.as}ত নিশ্চিত কৰক। বৰ্তমানৰ নিয়মত "${q.labelAs}" এতিয়াও প্ৰযোজ্য নেকি সোধক।`,
    fixWhere: confirmPlace(scheme, q),
    provenance: q.provenance,
  };
}

function passed(id: string, q: Question, en = q.labelEn, as = q.labelAs): Check {
  return {
    id,
    kind: "eligibility",
    result: "ok",
    messageEn: `Checked: ${en}.`,
    messageAs: `পৰীক্ষা কৰা হ'ল: ${as}।`,
    fixWhere: "none",
    provenance: q.provenance,
  };
}


function questionChecks(scheme: SchemeRule, answers: Answers): Check[] {
  const out: Check[] = [];
  for (const q of scheme.requirements) {
    const id = `req_${q.id}`;
    const a = answers[q.id];
    if (a === undefined) out.push(notAnswered(scheme, id, q));
    else if (a) out.push(passed(id, q));
    else out.push(failed(scheme, id, q, `You answered no to: ${q.textEn}`, `আপুনি "নহয়" উত্তৰ দিছে: ${q.textAs}`));
  }

  const anyOf = scheme.eligibilityAnyOf;
  if (anyOf.length > 0) {
    const yes = anyOf.find((q) => answers[q.id] === true);
    const unanswered = anyOf.find((q) => answers[q.id] === undefined);
    if (yes) out.push(passed("anyof", yes));
    else if (unanswered) out.push(notAnswered(scheme, "anyof", unanswered));
    else {
      const listEn = anyOf.map((q) => q.labelEn).join("; ");
      const listAs = anyOf.map((q) => q.labelAs).join("; ");
      // Definitive only if every any-of criterion is verified.
      const allVerified = anyOf.every((q) => q.provenance.status === "verified");
      const rep = allVerified ? anyOf[0] : (anyOf.find((q) => q.provenance.status === "provisional") ?? anyOf[0]);
      out.push(failed(scheme, "anyof", rep, `None of these applies to you: ${listEn}.`, `এইবোৰৰ এটাও আপোনাৰ ক্ষেত্ৰত প্ৰযোজ্য নহয়: ${listAs}।`));
    }
  }

  for (const q of scheme.exclusions) {
    const id = `excl_${q.id}`;
    const a = answers[q.id];
    if (a === undefined) out.push(notAnswered(scheme, id, q));
    else if (!a) out.push(passed(id, q, `not ${q.labelEn}`, `${q.labelAs}: নহয়`));
    else out.push(failed(scheme, id, q, `You answered yes: ${q.labelEn}.`, `আপুনি "হয়" উত্তৰ দিছে: ${q.labelAs}।`));
  }
  return out;
}

// ---------- external facts (never provable from a photo) ----------
function externalChecks(scheme: SchemeRule): Check[] {
  return scheme.externalChecks.map((e) => ({
    id: `ext_${e.id}`,
    kind: "external",
    result: "needs_verification",
    messageEn: `We cannot see this from a photo: ${e.labelEn}. ${e.howEn}`,
    messageAs: `ফটোৰ পৰা আমি এইটো চাব নোৱাৰোঁ: ${e.labelAs}। ${e.howAs}`,
    fixWhere: e.fixWhere,
    provenance: e.provenance,
  }));
}

// ---------- verdicts ----------
function eligibilityOf(checks: readonly Check[]): Eligibility {
  const elig = checks.filter((c) => c.kind === "eligibility");
  if (elig.some((c) => c.result === "action_required" && c.provenance.status === "verified")) return "not_eligible";
  if (elig.some((c) => c.result !== "ok" && c.result !== "not_applicable")) return "needs_verification";
  return "likely_eligible";
}

function readinessOf(checks: readonly Check[]): Readiness {
  if (checks.some((c) => c.result === "action_required")) return "action_required";
  // External facts are always "confirm", so on their own they never block ready_for_review.
  if (checks.some((c) => c.kind !== "external" && c.result === "needs_verification")) return "needs_verification";
  return "ready_for_review";
}

/**
 * Evaluates a scheme against the extracted documents and yes/no answers on an explicit date.
 * Deterministic: the same inputs always give the same report.
 */
export function evaluate(scheme: SchemeRule, docs: readonly ExtractedDoc[], answers: Answers, asOfDate: string): Report {
  assertIsoDate(asOfDate, "asOfDate");
  const age = ageCheck(scheme, docs, asOfDate);
  const checks: Check[] = [
    ...mandatoryDocChecks(scheme, docs),
    ...scheme.nameChecks.map((rule) => nameCheck(scheme, rule, docs, answers)),
    ...fieldChecks(scheme, docs),
    ...(age ? [age] : []),
    ...questionChecks(scheme, answers),
    ...externalChecks(scheme),
  ];

  return {
    schemeId: scheme.id,
    schemeVersion: scheme.version,
    asOfDate,
    eligibility: eligibilityOf(checks),
    readiness: readinessOf(checks),
    checks,
    benefit: benefitOn(scheme, asOfDate),
    supportingDocs: scheme.supportingDocs.map((d) => ({
      docType: d.docType,
      labelEn: DOC_LABELS[d.docType].en,
      labelAs: DOC_LABELS[d.docType].as,
      present: findDoc(docs, d.docType) !== undefined,
      provenance: d.provenance,
    })),
    supportingDocsNoteEn: scheme.supportingDocsNoteEn,
    supportingDocsNoteAs: scheme.supportingDocsNoteAs,
    disclaimerEn: DISCLAIMER.en,
    disclaimerAs: DISCLAIMER.as,
  };
}

