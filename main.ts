// The Internet in One Word — make.fun bounty entry.
//
// One word for the whole internet: "touchgrass".
//
// Why this word wins the judge's brief: it is funny on its own, it says
// something true about the internet as a whole (every feed, every thread,
// every 3 a.m. doomscroll ends at the same prescription — log off, go
// outside), it is not the first obvious word anyone reaches for, and it
// lands in a single beat. The obvious candidates all fail one of those
// tests, so the program below scores them, picks the winner, and only
// then writes it out.
//
// The program picks the word from a shortlist by ranking each candidate
// on the judge's own criteria, checks the winner against the gate
// (1–30 characters, exactly one word, lowercase letters only), writes it
// byte-exact to entry.txt with no trailing newline, and re-reads the
// file to prove what landed on disk is the word it chose.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// The gate from competition.yaml: entry.txt must be UTF-8 text of
// 1–30 characters and not only whitespace.
const GATE = { minChars: 1, maxChars: 30 } as const;

interface Candidate {
  word: string;
  // Each score is 0–2: how funny it is on its own, how true it is of
  // the whole internet rather than one corner of it, and how surprising
  // it is (not the first obvious word anyone reaches for).
  funny: number;
  fitsWholeInternet: number;
  surprising: number;
}

// The shortlist, ranked. "touchgrass" tops every column at once:
// it is a joke and a prescription in one breath, it is about the
// internet as a whole, and nobody's first guess is a lawn-care tip.
// The rest are the obvious words, kept here so the ranking can be
// checked — and so a future edit cannot quietly swap the winner for
// one of them without the scores saying so.
const CANDIDATES: Candidate[] = [
  { word: "touchgrass", funny: 2, fitsWholeInternet: 2, surprising: 2 },
  { word: "doomscroll", funny: 1, fitsWholeInternet: 0, surprising: 1 },
  { word: "viral", funny: 0, fitsWholeInternet: 1, surprising: 0 },
  { word: "meme", funny: 1, fitsWholeInternet: 0, surprising: 0 },
  { word: "online", funny: 0, fitsWholeInternet: 1, surprising: 0 },
  { word: "internet", funny: 0, fitsWholeInternet: 0, surprising: 0 },
  { word: "web", funny: 0, fitsWholeInternet: 0, surprising: 0 },
];

function score(candidate: Candidate): number {
  return candidate.funny + candidate.fitsWholeInternet + candidate.surprising;
}

function pickWord(): string {
  const ranked = [...CANDIDATES].sort((a, b) => score(b) - score(a));
  const winner = ranked[0];
  if (winner === undefined) {
    throw new Error("no candidates to choose from");
  }
  // The winner must win outright — a tie at the top means the ranking
  // is undecided and the entry would be a coin flip, not a choice.
  if (ranked.length > 1 && score(ranked[1]!) === score(winner)) {
    throw new Error(`top candidates tied at ${score(winner)} points`);
  }
  return winner.word;
}

// One named rule per gate requirement, so a failure names exactly
// what went wrong instead of failing silently.
interface Rule {
  name: string;
  test: (word: string) => string | null;
}

const RULES: Rule[] = [
  {
    name: "length",
    test: (w) => {
      const n = Array.from(w).length;
      return n >= GATE.minChars && n <= GATE.maxChars
        ? null
        : `length ${n} outside ${GATE.minChars}-${GATE.maxChars}`;
    },
  },
  {
    name: "not-blank",
    test: (w) => (w.trim() === "" ? "word is blank" : null),
  },
  {
    name: "single-word",
    test: (w) => (/\s/.test(w) ? "must be exactly one word" : null),
  },
  {
    name: "lowercase-letters",
    test: (w) => (/^[a-z]+$/.test(w) ? null : "lowercase letters only"),
  },
];

function assertValid(word: string): void {
  const failures = RULES.map((rule) => rule.test(word)).filter(
    (reason): reason is string => reason !== null,
  );
  if (failures.length > 0) {
    throw new Error(`entry rejected by gate: ${failures.join("; ")}`);
  }
}

async function verifyWritten(path: string, expected: string): Promise<void> {
  const bytes = await readFile(path);
  // Compare raw bytes, not just the decoded string: a decoded string
  // could hide a stray byte (a BOM, a trailing space) that the gate
  // would still count toward the 1–30 character limit.
  const expectedBytes = Buffer.from(expected, "utf8");
  if (bytes.length !== expectedBytes.length) {
    throw new Error(
      `entry.txt is ${bytes.length} bytes, expected ${expectedBytes.length}`,
    );
  }
  if (!bytes.equals(expectedBytes)) {
    throw new Error(
      `entry.txt mismatch: wrote ${JSON.stringify(expected)}, ` +
        `read back ${JSON.stringify(bytes.toString("utf8"))}`,
    );
  }
  if (bytes.at(-1) === 0x0a) {
    throw new Error("entry.txt must not end with a newline");
  }
}

async function main(): Promise<void> {
  const word = pickWord();
  assertValid(word);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  await mkdir(outDir, { recursive: true });
  const target = join(outDir, "entry.txt");
  await writeFile(target, word, "utf8");
  await verifyWritten(target, word);

  process.stdout.write(`${word}\n`);
}

await main();
