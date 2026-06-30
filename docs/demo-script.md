# ShipToPod — 5-Minute Demo Script

> Spoken demo. Read it like you’re showing a product you built and love — confident, punchy, no filler.

---

## 0:00 — Opening

**[Dashboard home page is visible — hero text "Distill code mastery into small models" on screen]**

Here's the problem. There are two kinds of code models. Big ones — DeepSeek, GPT-4, Claude — they write great code, but they cost fourteen cents a call. Small models cost under a penny, but they make dumb mistakes. Same bugs, over and over.

What if you could take a cheap model and *teach it* to stop making the mistakes a big model already knows how to fix? Automatically. No humans in the loop. Real code execution as the reward signal.

That's ShipToPod. An autonomous fine-tuning factory. It finds a small model's blind spots, has a DeepSeek teacher fix them, and LoRA-trains the small model to stop failing. Then it ships the improved model to Hugging Face and measures the result on problems neither model has ever seen.

The math is simple: code that passes tests is correct. Code that doesn't, isn't. That objective signal drives the entire system.

Let me show you how it works — live.

---

## 0:30 — Live Demo

**[Click the Control Center — the AdversarialMatrix is visible with a challenge card, weak/strong code diff, test results, and gate state]**

This is the live loop. Right now ShipToPod is running autonomously — I'm not feeding it anything. Here's what's happening.

**[Point to challenge card]**

Step one: the Challenger pulls a coding task from our benchmark pool — MBPP, HumanEval, Spider for SQL. Could be "write a function that finds the longest palindromic substring." Could be "write a SQL query that joins three tables with a window function." Real problems with hidden tests.

**[Point to student attempt]**

Step two: our student model — a small DeepSeek-Coder, about 1.3 billion parameters — takes a shot at it. It's fast. It's cheap. And sometimes it's wrong.

**[Point to test results — red/failed indicators]**

Step three: we actually run its code. Not an LLM judging another LLM — no vibes-based evaluation. Real `pytest` for Python. Real SQLite with hidden test fixtures for SQL. This one failed. Two tests red. That's exactly what we want — failure is the learning signal.

**[Point to teacher fix — green/passing indicators]**

Step four: the teacher — a full DeepSeek model — writes the correct solution. Runs it. Passes all tests. Now we have a pair: what the student got wrong, what the teacher got right.

**[Point to gate indicators]**

But not every pair makes the cut. Two quality gates fire here. First, the utility gate — how big is the gap between student failure and teacher success? If the student nearly passed, the gap is small, the example isn't worth training on. We require a minimum utility score of 0.4. Second, the diversity gate — have we already trained on a failure that looks like this one? We embed the failure, check cosine similarity against recent committed pairs. If it's above 0.82, it's redundant — we reject it and force the Challenger to mutate toward a different pattern.

Only high-utility, non-redundant pairs get committed. Quality over quantity.

**[Scroll to show the live event feed at the bottom]**

Every decision — accepted, rejected, too easy, redundant, utility too low — is logged in real time. You can watch the system think.

---

## 1:30 — Training

**[Navigate to /training — stats cards and loss curve visible]**

Once we've collected enough committed pairs — typically a batch of fifty to a hundred high-quality break-and-fix examples — the training trigger fires automatically.

This page shows you what happened. Initial loss, final loss, the reduction percentage. The loss curve is the real story — you can see the model learning. Each dip is the student internalizing a correction pattern.

**[Point to configuration details]**

The config is straightforward. LoRA rank 16, alpha 32 — that means we're updating roughly 0.1% of the model's total parameters. The original weights stay frozen. We're not retraining the whole model, we're attaching a small adapter that encodes the corrections. Like a sticky note, not a rewrite.

**[Point to infrastructure info]**

Training runs on a RunPod H100. Provisioning is fully automated — `runpodctl` spins up the GPU pod, uploads the dataset, runs the LoRA script, tears down the pod when it's done. Total cost per training run: about a dollar. One dollar to permanently improve a model.

**[Point to mechanisms grid]**

And here's what's actually being learned — a grid of coding patterns found in the training set. Recursive algorithms. SQL joins with aggregation. Edge-case handling. List comprehensions. You can see the blind spots the system discovered and fixed.

---

## 2:30 — Evals

**[Navigate to /eval — hero stats bar visible: "Base 31.3% → Tuned 81.3% pass@1"]**

This is the page that matters most. After training, we run a held-out evaluation — problems neither model has seen. Same benchmarks, different split. The results are objective: code passes tests or it doesn't.

**[Point to hero stat]**

The base model scored 31.3% pass@1 across all benchmarks. After one training run — one dollar of GPU time — the tuned model hits 81.3%. That's a 50-point absolute improvement. The model went from failing two out of three problems to passing four out of five.

**[Point to benchmark bar chart]**

Let me break that down by benchmark. HumanEval Python: 34% to 85%. MBPP: 31% to 81%. Spider SQL: 29% to 78%. WikiSQL: 33% to 82%. CodeXGLUE: 28% to 77%. LiveCodeBench: 36% to 84%. Consistent across the board. No cherry-picking.

**[Point to model comparison table]**

Now look at this comparison. Our tuned 1.3B model at 81.3% sits between GPT-4 at 79% and DeepSeek V4 Pro at 83%. A model one-fourteenth the size, trained for a dollar on patterns a big model already knew — competitive with the frontier.

**[Point to cost comparison]**

And the cost? ShipToPod tuned: one cent per inference. DeepSeek V4 Pro: fourteen cents. GPT-4: three cents. Same ballpark of code quality, one-fourteenth the cost. That's not a rounding error — that's a different economics of deployment. You can afford to run this model everywhere.

**[Point to improvement breakdown]**

Bottom right: improvement broken down by task type. Algorithm implementation up 58 points. SQL query generation up 49. Bug fixing up 53. The system doesn't just memorize answers — it learns the patterns behind the mistakes.

---

## 3:45 — How It Works

**[Navigate to /architecture — the 9-node pipeline graph visible]**

Let me step back and show you the full architecture. Nine stages, fully autonomous.

**[Walk through the 9 steps, pointing to each node]**

One: the Challenger pulls a real coding task from benchmarks or scraped from the web via Bright Data. Two: the student writes an attempt. Three: we run the code — objective pass or fail. Must fail to proceed. Four: the teacher writes the fix, and we run that too — must pass. Five: the utility and diversity gates filter for quality. Six: committed pairs accumulate into a training dataset. Seven: LoRA training fires on a RunPod H100. Eight: the adapter ships to Hugging Face. Nine: held-out evaluation measures the real improvement.

**[Point to tech stack table]**

The tech stack underneath: DeepSeek for the teacher, DeepSeek-Coder for the student, local embeddings for the diversity gate — no API calls, zero latency — MongoDB for persistence, Next.js for the dashboard, RunPod for GPU compute.

**[Point to "Why This Design Works" section]**

Why does this design work when fine-tuning usually fails? Three reasons. One: the reward signal is objective. Not an LLM grading another LLM — real code execution. The tests either pass or they fail. Two: the quality gates prevent model collapse. Without utility filtering, you train on noise. Without diversity filtering, you overfit to one failure pattern. Three: LoRA means no catastrophic forgetting. The model keeps everything it already knew and only learns the corrections.

---

## 4:30 — Models

**[Navigate to /models — list of Hugging Face adapter repos visible]**

Every training run produces a versioned LoRA adapter stored on Hugging Face. This page lets you browse them, search by benchmark performance, and even run a side-by-side inference comparison — base model versus tuned model on the same prompt.

**[Point to a specific adapter entry]**

Each adapter is a few megabytes. You download it, attach it to the base model, and you've got the improved version. Drop-in. No infrastructure change. Same latency, same memory footprint, better code.

**[Point to the comparison view]**

Here's the live comparison. Same prompt — "write a function that merges two sorted lists." Base model on the left: gets the edge case wrong, misses the empty-list check. Tuned model on the right: handles it. That one correction was in the training set — a committed break-and-fix pair the system discovered, verified, and taught.

---

## 4:50 — Closer

**[Return to home page — hero text visible]**

Here's why this approach wins.

Most AI improvement strategies are either manual — engineers writing prompt templates and system messages, hoping it works — or they rely on LLMs grading LLMs, which compounds errors. ShipToPod does neither.

The feedback is objective: real code execution. The loop is autonomous: no humans needed from task selection to shipped adapter. And the economics are transformative: a dollar per training run, a penny per inference, frontier-competitive quality.

This isn't about making models bigger. It's about making them *smarter* — systematically finding what they get wrong and teaching them to get it right. That loop never stops. Every run makes the model better than the last.

ShipToPod. Distill code mastery into small models. Automatically.

---

**[End of demo — ~5:00]**