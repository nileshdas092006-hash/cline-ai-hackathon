// Basic Devanagari and Assamese/Bengali script → Latin transliteration for name matching. Pure.
// Deliberately simple (a lookup table plus word-final schwa deletion). It only feeds
// fuzzy matching, so any cross-script match is at best "possible_match".

type Table = Record<string, string>;

const DEVANAGARI_CONSONANTS: Table = {
  क: "K", ख: "KH", ग: "G", घ: "GH", ङ: "N",
  च: "CH", छ: "CHH", ज: "J", झ: "JH", ञ: "N",
  ट: "T", ठ: "TH", ड: "D", ढ: "DH", ण: "N",
  त: "T", थ: "TH", द: "D", ध: "DH", न: "N", ऩ: "N",
  प: "P", फ: "PH", ब: "B", भ: "BH", म: "M",
  य: "Y", र: "R", ऱ: "R", ल: "L", ळ: "L", ऴ: "L", व: "V",
  श: "SH", ष: "SH", स: "S", ह: "H",
};
const DEVANAGARI_VOWELS: Table = {
  अ: "A", आ: "A", इ: "I", ई: "I", उ: "U", ऊ: "U", ऋ: "RI",
  ए: "E", ऐ: "AI", ओ: "O", औ: "AU", ऍ: "E", ऑ: "O",
};
const DEVANAGARI_SIGNS: Table = {
  "\u093E": "A", "\u093F": "I", "\u0940": "I", "\u0941": "U", "\u0942": "U", "\u0943": "RI",
  "\u0945": "E", "\u0947": "E", "\u0948": "AI", "\u0949": "O", "\u094B": "O", "\u094C": "AU",
};

const BENGALI_CONSONANTS: Table = {
  ক: "K", খ: "KH", গ: "G", ঘ: "GH", ঙ: "NG",
  চ: "CH", ছ: "CHH", জ: "J", ঝ: "JH", ঞ: "N",
  ট: "T", ঠ: "TH", ড: "D", ঢ: "DH", ণ: "N",
  ত: "T", থ: "TH", দ: "D", ধ: "DH", ন: "N",
  প: "P", ফ: "PH", ব: "B", ভ: "BH", ম: "M",
  য: "J", র: "R", ৰ: "R", ল: "L", ৱ: "W",
  শ: "SH", ষ: "SH", স: "S", হ: "H",
};
const BENGALI_VOWELS: Table = {
  অ: "A", আ: "A", ই: "I", ঈ: "I", উ: "U", ঊ: "U", ঋ: "RI",
  এ: "E", ঐ: "OI", ও: "O", ঔ: "OU",
};
const BENGALI_SIGNS: Table = {
  "\u09BE": "A", "\u09BF": "I", "\u09C0": "I", "\u09C1": "U", "\u09C2": "U", "\u09C3": "RI",
  "\u09C7": "E", "\u09C8": "OI", "\u09CB": "O", "\u09CC": "OU",
};

/** Consonant + nukta (these letters are decomposed by NFC). */
const NUKTA_FORMS: Table = {
  "ज\u093C": "Z", "फ\u093C": "F", "ड\u093C": "R", "ढ\u093C": "RH", "क\u093C": "K", "ख\u093C": "KH", "ग\u093C": "G", "य\u093C": "Y",
  "ড\u09BC": "R", "ঢ\u09BC": "RH", "য\u09BC": "Y",
};

const VIRAMA = new Set(["\u094D", "\u09CD"]);
const NUKTA = new Set(["\u093C", "\u09BC"]);
/** Anusvara, chandrabindu, visarga. */
const MODIFIERS: Table = {
  "\u0901": "N", "\u0902": "N", "\u0903": "H",
  "\u0981": "N", "\u0982": "NG", "\u0983": "H",
};
const OTHER: Table = { "ৎ": "T", "ॐ": "OM" };

const CONSONANTS: Table = { ...DEVANAGARI_CONSONANTS, ...BENGALI_CONSONANTS };
const VOWELS: Table = { ...DEVANAGARI_VOWELS, ...BENGALI_VOWELS };
const SIGNS: Table = { ...DEVANAGARI_SIGNS, ...BENGALI_SIGNS };

function isConsonant(ch: string | undefined): boolean {
  return ch !== undefined && ch in CONSONANTS;
}

/**
 * Transliterates Devanagari and Assamese/Bengali script to uppercase Latin.
 * Other characters (Latin, digits, punctuation, unknown scripts) pass through, uppercased.
 */
export function transliterate(input: string): string {
  const chars = Array.from(input.normalize("NFC"));
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isConsonant(ch)) {
      let latin = CONSONANTS[ch];
      let j = i + 1;
      if (NUKTA.has(chars[j] ?? "")) {
        latin = NUKTA_FORMS[ch + chars[j]] ?? latin;
        j++;
      }
      out += latin;
      const next = chars[j];
      if (next !== undefined && next in SIGNS) {
        out += SIGNS[next];
        j++;
      } else if (next !== undefined && VIRAMA.has(next)) {
        j++; // no vowel
      } else if (isConsonant(next) || (next !== undefined && next in MODIFIERS)) {
        out += "A"; // inherent vowel inside a word
      } // else: word-final consonant, inherent vowel dropped (schwa deletion)
      i = j - 1;
    } else if (ch in VOWELS) {
      out += VOWELS[ch];
    } else if (ch in MODIFIERS) {
      out += MODIFIERS[ch];
    } else if (ch in OTHER) {
      out += OTHER[ch];
    } else if (ch in SIGNS || VIRAMA.has(ch) || NUKTA.has(ch)) {
      // a stray sign without a consonant: drop it
    } else {
      out += ch.toUpperCase();
    }
  }
  return out;
}
