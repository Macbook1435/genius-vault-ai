// Generic player-name normalization and agreement across independent reads.
// Nothing here knows about any specific player.

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const APOSTROPHES = /[\u2018\u2019\u201B\u2032\u0060\u00B4']/g;

function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Split a raw name into { base, suffix } with unified punctuation. */
function parts(raw) {
  const t = stripAccents(String(raw || "")).replace(APOSTROPHES, "'").replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean);
  let suffix = null;
  if (words.length > 1) {
    const last = words[words.length - 1].toLowerCase().replace(/[.,]/g, "");
    if (SUFFIXES.has(last)) {
      suffix = last;
      words.pop();
    }
  }
  return { base: words.join(" ").replace(/,$/, ""), suffix };
}

/** Comparison key: letters only, lowercase, no accents/punctuation/spaces; suffix kept separately. */
export function nameKey(raw) {
  const { base, suffix } = parts(raw);
  const k = base.toLowerCase().replace(/[^a-z]/g, "");
  return k ? { key: k, suffix } : null;
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Punctuation/space layout of a name, ignoring letter case: "o'brien" vs "obrien".
const layout = (raw) => parts(raw).base.toLowerCase();

/**
 * Settle the player name from several independent reads.
 * @returns {{ value, status, agreeing, notes }}
 *   status: "agreed" | "majority" | "one_letter_majority" | "no_agreement" | "single_read" | "unreadable"
 */
export function resolvePlayerNameReads(reads) {
  const notes = [];
  const items = reads.map((r) => ({ raw: String(r || "").trim(), nk: nameKey(r) })).filter((x) => x.raw && x.nk);
  if (!items.length) return { value: null, status: "unreadable", agreeing: 0, notes };
  if (items.length === 1) return { value: display([items[0]]), status: "single_read", agreeing: 1, notes };

  const groups = {};
  for (const it of items) (groups[it.nk.key] = groups[it.nk.key] || []).push(it);
  let ranked = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  let status = ranked.length === 1 ? "agreed" : "majority";
  let winner = ranked[0][1].length >= 2 && (!ranked[1] || ranked[1][1].length < ranked[0][1].length) ? ranked[0] : null;

  if (!winner) {
    // No exact majority: allow a single-letter slip (longer names only) to count toward a group.
    for (const [k, list] of ranked) {
      const near = items.filter((it) => it.nk.key === k || (k.length >= 6 && editDistance(it.nk.key, k) <= 1));
      if (near.length >= 2 && near.length > items.length / 2) {
        winner = [k, list];
        status = "one_letter_majority";
        notes.push("Reads differed by one letter; used the spelling most reads gave.");
        break;
      }
    }
  }
  if (!winner) {
    notes.push(`Name reads disagree: ${items.map((i) => `"${i.raw}"`).join(", ")}.`);
    return { value: null, status: "no_agreement", agreeing: 0, notes };
  }

  const list = winner[1];
  const suffixes = new Set(items.filter((i) => i.nk.key === winner[0]).map((i) => i.nk.suffix).filter(Boolean));
  const value = display(list, suffixes.size === 1 ? [...suffixes][0] : null);
  if (new Set(list.map((i) => layout(i.raw))).size > 1) notes.push("Punctuation differed between reads; kept only what most reads saw.");
  return { value, status, agreeing: list.length, notes };
}

// Pick how to show the name: the punctuation layout most reads saw (an apostrophe or
// space only one read saw is dropped) and the letter case as printed by most reads.
function display(list, suffix = null) {
  const byLayout = {};
  for (const it of list) (byLayout[layout(it.raw)] = byLayout[layout(it.raw)] || []).push(it);
  const ranked = Object.entries(byLayout).sort((a, b) => b[1].length - a[1].length || punct(a[0]) - punct(b[0]));
  const chosen = ranked[0][1];
  const caseCounts = {};
  for (const it of chosen) caseCounts[parts(it.raw).base] = (caseCounts[parts(it.raw).base] || 0) + 1;
  let base = Object.entries(caseCounts).sort((a, b) => b[1] - a[1])[0][0];
  if (suffix) base += " " + ({ jr: "Jr.", sr: "Sr." }[suffix] || suffix.toUpperCase());
  return base;
}

function punct(s) {
  return (s.match(/[^a-z ]/g) || []).length; // apostrophes, hyphens, periods (not spaces)
}

/** Same player? (accent/case/punctuation-insensitive; suffix must not conflict). */
export function samePlayer(a, b) {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return false;
  return x.key === y.key && (!x.suffix || !y.suffix || x.suffix === y.suffix);
}
