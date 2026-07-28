/**
 * automodStore.js - automodération par serveur : liste de mots interdits
 * (=mod, un mot à la fois) et interrupteur global (=automod).
 *
 * La détection résiste aux contournements courants : chaque lettre du mot
 * interdit accepte ses sosies (o/0/@, i/1/!, a/4/@...), les séparatifs
 * insérés entre les lettres sont ignorés ("v.i o-l"), les répétitions aussi
 * ("viiiool"), et la recherche se fait en sous-chaîne — bannir "viol"
 * attrape donc aussi "violer", "violence"...
 *
 * Structure : { "<guildId>": { enabled: bool, words: ["viol", ...] } }
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'automod.json');

function load() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

/**
 * Liste de départ : uniquement des mots réellement graves (insultes racistes,
 * homophobes, violences sexuelles). Volontairement PAS de "putain"/"ptn" et
 * consorts, qui relèvent de la frustration et pas de l'insulte.
 * Chaque entrée attrape aussi ses dérivés ("viol" -> "violer").
 */
const DEFAULT_WORDS = [
  // Racistes / antisémites
  'negre', 'negro', 'nigger', 'nigga', 'bougnoule', 'bicot', 'youpin', 'feuj', 'chintok', 'niakoue',
  // Homophobes
  'pede', 'tapette', 'tarlouze', 'faggot',
  // Violences sexuelles / pédocriminalité
  'viol', 'pedophile', 'pedo', 'zoophile',
  // Insultes sexistes lourdes
  'pute', 'salope', 'connasse',
];

function getConfig(guildId) {
  return load()[guildId] ?? { enabled: false, words: [] };
}

/**
 * Bascule l'automod. À la toute première activation d'un serveur, la liste de
 * mots par défaut est installée. Retourne { enabled, words, seeded }.
 */
function toggleEnabled(guildId) {
  const all = load();
  const current = all[guildId] ?? { enabled: false, words: [] };
  current.enabled = !current.enabled;

  let seeded = false;
  if (current.enabled && current.words.length === 0) {
    current.words = [...DEFAULT_WORDS];
    seeded = true;
  }

  all[guildId] = current;
  save(all);
  return { enabled: current.enabled, words: current.words, seeded };
}

// Traduction des sosies vers la lettre d'origine, pour que "=mod vi0l" ou
// "=mod b1tch" enregistrent bien "viol" et "bitch" (et pas "vil"/"btch").
const LOOKALIKE_TO_LETTER = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g',
  '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i',
  '+': 't', '(': 'c', ')': 'c', '[': 'c', '{': 'c', '<': 'c', '£': 'l',
  '€': 'e', '¥': 'y', '°': 'o', 'µ': 'u', '×': 'x',
};

/** Réduit un mot à ses lettres de base (minuscules, accents et sosies résolus). */
function baseForm(word) {
  const stripped = word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return [...stripped].map((c) => LOOKALIKE_TO_LETTER[c] ?? c).join('').replace(/[^a-z]/g, '');
}

/** Ajoute le mot s'il est absent, le retire s'il est déjà là. Retourne { added, word, words }. */
function toggleWord(guildId, rawWord) {
  const word = baseForm(rawWord);
  if (!word) return { added: null, word: null, words: getConfig(guildId).words };

  const all = load();
  const current = all[guildId] ?? { enabled: false, words: [] };
  const idx = current.words.indexOf(word);
  let added;
  if (idx === -1) {
    current.words.push(word);
    added = true;
  } else {
    current.words.splice(idx, 1);
    added = false;
  }
  all[guildId] = current;
  save(all);
  return { added, word, words: current.words };
}

// Sosies acceptés pour chaque lettre (le caractère lui-même + ses substituts
// habituels : chiffres, symboles, lettres accentuées).
const LETTER_VARIANTS = {
  a: 'a4@àáâãäå',
  b: 'b8ß',
  c: 'c(<[{ç¢',
  d: 'd',
  e: 'e3€èéêë',
  f: 'f',
  g: 'g69',
  h: 'h',
  i: 'i1!|ìíîï',
  j: 'j',
  k: 'k',
  l: 'l1|£',
  m: 'm',
  n: 'nñ',
  o: 'o0@°øòóôõö',
  p: 'p',
  q: 'q',
  r: 'r',
  s: 's5$§',
  t: 't7+',
  u: 'uvµùúûü',
  v: 'v',
  w: 'w',
  x: 'x×',
  y: 'y¥ÿ',
  z: 'z2',
};

/** Échappe les caractères qui ont un sens particulier dans une classe [...]. */
function escapeForCharClass(chars) {
  return chars.replace(/[\\\]^-]/g, '\\$&');
}

// Le motif d'un mot est coûteux à construire : on le garde en cache.
const patternCache = new Map();

function buildPattern(word) {
  if (patternCache.has(word)) return patternCache.get(word);

  // Entre deux lettres, on tolère n'importe quoi qui ne soit ni une lettre ni
  // un chiffre (espaces, points, tirets, emojis...) — c'est ce qui permet de
  // rattraper "v.i o-l". Le moteur revient en arrière si besoin, donc un "@"
  // sera essayé comme séparateur ET comme sosie de "o"/"a".
  const separator = '[^a-z0-9]*';
  const body = [...word]
    .map((letter) => {
      const variants = LETTER_VARIANTS[letter] ?? letter;
      return `[${escapeForCharClass(variants)}]+`;
    })
    .join(separator);

  const pattern = new RegExp(body, 'i');
  patternCache.set(word, pattern);
  return pattern;
}

/** Le premier mot interdit détecté dans ce texte, ou null. */
function findBannedWord(guildId, text) {
  const { enabled, words } = getConfig(guildId);
  if (!enabled || words.length === 0) return null;

  const haystack = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return words.find((word) => buildPattern(word).test(haystack)) ?? null;
}

module.exports = { getConfig, toggleEnabled, toggleWord, baseForm, findBannedWord };
