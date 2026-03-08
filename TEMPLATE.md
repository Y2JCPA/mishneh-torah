# Mishneh Torah — Perek Slide Template

## Structure
Each perek gets 9 slides:
1. **Title Slide** — Sefer name, Hilchot name (Hebrew + English), chapter number, chapter theme
2. **Context** — Where this chapter fits in the Rambam's structure, what came before, what's coming
3-7. **Content Slides** — Key halachot from the chapter, grouped thematically (2-4 halachot per slide)
8. **Key Principles** — The main takeaways / chiddushim of the chapter
9. **Quiz** — 3 multiple-choice questions testing comprehension

## Design
- Dark theme: #1a1a1a background, #c9a84c gold accents
- All CSS inlined (no external stylesheets)
- Hebrew text in original + English translation
- RTL layout for Hebrew content
- Mobile-responsive
- Navigation arrows between slides
- Swipe support on mobile

## Sefaria API
- Endpoint: `https://www.sefaria.org/api/v3/texts/Mishneh_Torah,_{Section_Name}.{Chapter}?version=english`
- Returns `he` (Hebrew array) and `text` (English array) — one entry per halacha

## File Structure
```
{sefer-slug}/{section-slug}/{chapter}/index.html   — slides
{sefer-slug}/{section-slug}/{chapter}/quiz.html     — quiz page
```

## Slide Navigation
- Left/right arrow keys
- Swipe left/right on mobile
- Click arrows on screen
- Dot indicators at bottom

## Color Palette
- Background: #1a1a1a
- Card: #222
- Gold accent: #c9a84c
- Gold muted: #a89060
- Text: #e0d5c1
- Subtle: #888
- Border: #333
