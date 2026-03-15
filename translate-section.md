# Translation Task Instructions

You are translating Hebrew structural elements in Mishneh Torah chapter HTML files to English.

## What to translate
The chapter pages have Hebrew text in these structural elements that should be English:
1. **Chapter description** — the `<div style="color:#e0d5c1;font-size:1.1rem...">` line
2. **Group slide h2 titles** — `<h2 style="text-align:center;color:#c9a84c;margin-bottom:.3rem">` 
3. **Callout labels** — `<div class="label">🔥 Hebrew text</div>` (keep emoji, translate text)
4. **Callout body text** — the paragraph after the label div inside `<div class="callout">`
5. **Key Principle titles** — `<strong>Hebrew title</strong>` inside principle boxes
6. **Key Principle descriptions** — `<span>Hebrew description</span>` in principle boxes
7. **Quiz questions, options, and explanations** — in the quiz.html file

## What NOT to translate
- The h1 title (הלכות ...) — this is the Hebrew section name, it's fine
- The halacha text (halacha-he divs) — those ARE the source text
- Hebrew ranges like הלכות א׳–ד׳ — keep these
- Navigation elements
- Book/section identifiers like ספר עבודה · Sefer Avodah

## Translation Style
- Clear, academic English appropriate for Torah study
- Group titles should be descriptive and distinctive (not generic like "More Laws")
- Callout bodies should use `<strong>` tags for key terms
- Callout labels should have format: emoji + short English phrase
- Principle titles: concise 3-6 word English titles
- Principle descriptions: 1-2 sentence clear English
- Quiz: straightforward English, keep halachic terms transliterated

## How to do it
For each chapter path given:
1. Read the index.html file
2. Find all Hebrew structural elements listed above
3. Translate them to English
4. Write the modified file back
5. Do the same for quiz.html if it has Hebrew questions/options/explanations
6. Print a summary of what you changed

Keep the HTML structure exactly the same — only change the text content.
