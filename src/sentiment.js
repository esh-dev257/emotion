// Tokenizer
export function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Lexicon Rulebook with negation + intensifiers
const LEX = {
  pos: {
    love: 2, like: 1, enjoy: 1, awesome: 2, great: 2, good: 1, fun: 1,
    fantastic: 2, amazing: 2, happy: 2, tasty: 1, cool: 1, nice: 1, yay: 1,
    wonderful: 2, delightful: 2, brilliant: 2, sweet: 1, cute: 1, win: 1
  },
  neg: {
    hate: 2, dislike: 1, awful: 2, bad: 1, boring: 1, terrible: 2, worst: 2,
    sad: 2, angry: 2, slow: 1, messy: 1, yuck: 1, ugh: 1, annoying: 1,
    horrible: 2, nasty: 2, ugly: 1
  },
  intens: { very: 1.5, super: 1.5, really: 1.2, extremely: 1.8, so: 1.2, mega: 1.4 },
  dampen: { slightly: 0.6, kinda: 0.7, somewhat: 0.7, a_little: 0.6 },
  negators: new Set(["not","no","never","isn't","wasn't","don't","didn't","can't","won't","n't"])
};

export function rulebook(sentence) {
  const t = tokenize(sentence);
  let score = 0;
  const explain = [];
  for (let i = 0; i < t.length; i++) {
    const w = t[i];
    const w2 = w.replace(/'/g, "");
    let weight = 0;
    if (LEX.pos[w2]) weight += LEX.pos[w2];
    if (LEX.neg[w2]) weight -= LEX.neg[w2];

    let mult = 1;
    const prev = t[i - 1] || "";
    const prev2 = t[i - 2] || "";
    if (LEX.intens[prev]) mult *= LEX.intens[prev];
    if (LEX.dampen[prev] || prev === "little") mult *= LEX.dampen[prev] || 0.6;
    if (LEX.intens[prev2]) mult *= LEX.intens[prev2] * 0.9;

    let negated = false;
    for (let j = 1; j <= 3; j++) {
      if (LEX.negators.has(t[i - j] || "")) { negated = true; break; }
    }

    if (weight !== 0) {
      const val = negated ? -weight * mult : weight * mult;
      score += val;
      explain.push(`${negated ? "NOT " : ""}${w}(${val > 0 ? "+" : ""}${val.toFixed(2)})`);
    }
  }

  let label = "Neutral";
  if (score > 1) label = "Positive";
  else if (score < -1) label = "Negative";
  return { score, label, explain };
}

// Baby Naive Bayes
const trainData = [
  // Positive
  ["I love this game it is awesome", "pos"],
  ["That cake was amazing and tasty", "pos"],
  ["We had a fantastic time", "pos"],
  ["The park is fun and cool", "pos"],
  ["I really like my teacher", "pos"],
  ["This book is great", "pos"],
  ["Yay we won the match", "pos"],
  ["What a wonderful day", "pos"],
  ["The puppy is so cute and sweet", "pos"],
  ["I enjoy science class", "pos"],
  ["Good job team", "pos"],
  // Neutral
  ["The book is on the table", "neu"],
  ["I have school at nine", "neu"],
  ["My cat is sleeping", "neu"],
  ["The weather is okay", "neu"],
  ["He lives on Maple Street", "neu"],
  ["It is Wednesday today", "neu"],
  ["We walked to the store", "neu"],
  ["Please pass the salt", "neu"],
  ["There are three apples", "neu"],
  ["The box is brown", "neu"],
  // Negative
  ["I hate getting up early", "neg"],
  ["This soup tastes awful", "neg"],
  ["The test was terrible", "neg"],
  ["That was the worst day", "neg"],
  ["My phone is boring me", "neg"],
  ["I feel sad today", "neg"],
  ["The bus is so slow", "neg"],
  ["This mess is annoying", "neg"],
  ["I dislike this level", "neg"],
  ["The noise makes me angry", "neg"]
];

function sumMap(m) { let s = 0; for (const v of m.values()) s += v; return s; }
function softmax(arr) {
  const m = Math.max(...arr);
  const ex = arr.map(x => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map(x => x / s);
}
function labName(k){ return k==="pos"?"Positive":k==="neg"?"Negative":"Neutral"; }

function trainNB(data) {
  const counts = { pos: 0, neu: 0, neg: 0 };
  const wc = { pos: new Map(), neu: new Map(), neg: new Map() };
  const vocab = new Map();

  for (const [txt, lab] of data) {
    counts[lab]++;
    const words = tokenize(txt);
    for (const w of new Set(words)) vocab.set(w, (vocab.get(w) || 0) + 1);
    for (const w of words) wc[lab].set(w, (wc[lab].get(w) || 0) + 1);
  }
  const totalDocs = counts.pos + counts.neu + counts.neg;
  const priors = { pos: counts.pos / totalDocs, neu: counts.neu / totalDocs, neg: counts.neg / totalDocs };
  const V = vocab.size;
  const totals = { pos: sumMap(wc.pos), neu: sumMap(wc.neu), neg: sumMap(wc.neg) };

  function predict(s) {
    const words = tokenize(s);
    const labs = ["pos", "neu", "neg"];
    const logs = {};
    for (const L of labs) {
      let logp = Math.log(priors[L] || 1e-9);
      for (const w of words) {
        const c = (wc[L].get(w) || 0) + 1; // Laplace smoothing
        const denom = totals[L] + V;
        logp += Math.log(c / denom);
      }
      logs[L] = logp;
    }
    const order = [["pos", logs.pos], ["neu", logs.neu], ["neg", logs.neg]].sort((a,b)=>b[1]-a[1]);
    const topLab = order[0][0];
    const probs = softmax([logs.pos, logs.neu, logs.neg]);
    return { label: labName(topLab), probs: { pos: probs[0], neu: probs[1], neg: probs[2] }, logs, words };
  }
  return { predict, priors, wc, vocab, totals };
}

export const NB = trainNB(trainData);