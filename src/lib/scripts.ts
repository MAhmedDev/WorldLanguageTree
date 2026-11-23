/** ISO 15924 script code -> Google Fonts family (Noto), direction and orientation. Fonts load on demand. */

const FONTS: Record<string, string> = {
  Latn: "Noto Serif",
  Grek: "Noto Serif",
  Cyrl: "Noto Serif",
  Arab: "Noto Naskh Arabic",
  Aran: "Noto Nastaliq Urdu",
  Hebr: "Noto Serif Hebrew",
  Syrc: "Noto Sans Syriac",
  Deva: "Noto Serif Devanagari",
  Beng: "Noto Serif Bengali",
  Guru: "Noto Serif Gurmukhi",
  Gujr: "Noto Serif Gujarati",
  Orya: "Noto Serif Oriya",
  Taml: "Noto Serif Tamil",
  Telu: "Noto Serif Telugu",
  Knda: "Noto Serif Kannada",
  Mlym: "Noto Serif Malayalam",
  Sinh: "Noto Serif Sinhala",
  Tibt: "Noto Serif Tibetan",
  Mymr: "Noto Serif Myanmar",
  Khmr: "Noto Serif Khmer",
  Thai: "Noto Serif Thai",
  Laoo: "Noto Serif Lao",
  Hans: "Noto Serif SC",
  Hant: "Noto Serif TC",
  Hani: "Noto Serif TC",
  Jpan: "Noto Serif JP",
  Hira: "Noto Serif JP",
  Kana: "Noto Serif JP",
  Kore: "Noto Serif KR",
  Hang: "Noto Serif KR",
  Armn: "Noto Serif Armenian",
  Geor: "Noto Serif Georgian",
  Ethi: "Noto Serif Ethiopic",
  Copt: "Noto Sans Coptic",
  Xsux: "Noto Sans Cuneiform",
  Egyp: "Noto Sans Egyptian Hieroglyphs",
  Phnx: "Noto Sans Phoenician",
  Ugar: "Noto Sans Ugaritic",
  Xpeo: "Noto Sans Old Persian",
  Avst: "Noto Sans Avestan",
  Brah: "Noto Sans Brahmi",
  Khar: "Noto Sans Kharoshthi",
  Linb: "Noto Sans Linear B",
  Runr: "Noto Sans Runic",
  Goth: "Noto Sans Gothic",
  Ogam: "Noto Sans Ogham",
  Glag: "Noto Sans Glagolitic",
  Orkh: "Noto Sans Old Turkic",
  Mong: "Noto Sans Mongolian",
  Tang: "Noto Serif Tangut",
  Tfng: "Noto Sans Tifinagh",
  Cher: "Noto Sans Cherokee",
  Cans: "Noto Sans Canadian Aboriginal",
  Sogd: "Noto Sans Sogdian",
  Armi: "Noto Sans Imperial Aramaic",
  Phli: "Noto Sans Inscriptional Pahlavi",
  Hluw: "Noto Sans Anatolian Hieroglyphs",
  Lyci: "Noto Sans Lycian",
  Lydi: "Noto Sans Lydian",
  Ital: "Noto Sans Old Italic",
  Newa: "Noto Sans Newa",
  Olck: "Noto Sans Ol Chiki",
  Mand: "Noto Sans Mandaic",
  Samr: "Noto Sans Samaritan",
  Nkoo: "Noto Sans NKo",
  Vaii: "Noto Sans Vai",
  Bali: "Noto Sans Balinese",
  Java: "Noto Sans Javanese",
  Tglg: "Noto Sans Tagalog",
  Mroo: "Noto Sans Mro",
  Maya: "Noto Sans Mayan Numerals",
  Elym: "Noto Sans Elymaic"
};

const RTL = new Set(["Arab", "Aran", "Hebr", "Syrc", "Phnx", "Avst", "Armi", "Phli", "Sogd", "Mand", "Samr", "Nkoo", "Khar", "Lydi", "Thaa"]);

const loaded = new Set<string>();

/** Inject the Google Fonts stylesheet for a script once. Returns the CSS font-family stack. */
export function fontFor(script: string | undefined): string {
  const family = script ? FONTS[script] : undefined;
  if (!family) return `"Noto Serif", "Cormorant Garamond", serif`;
  if (!loaded.has(family) && typeof document !== "undefined") {
    loaded.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;600&display=swap`;
    document.head.appendChild(link);
  }
  return `"${family}", "Noto Serif", serif`;
}

export function dirFor(script: string | undefined): "rtl" | "ltr" {
  return script && RTL.has(script) ? "rtl" : "ltr";
}

export function isVertical(script: string | undefined): boolean {
  return script === "Mong";
}
