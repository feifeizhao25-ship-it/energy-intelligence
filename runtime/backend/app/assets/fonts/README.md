# Bundled report font

`NotoSansSC-Regular-subset.ttf` is Noto Sans SC (Regular, wght 400) from
https://github.com/notofonts/noto-cjk (SIL Open Font License 1.1, see `OFL.txt`), subset to GB2312 plus
Latin, Greek, Cyrillic, general punctuation, currency, arrows, math, enclosed digits, box/geometric
symbols, CJK punctuation and full-width forms (including U+00B7 "·"), with TrueType outlines so ReportLab
can embed it. Regenerate with `fontTools.varLib.instancer` (wght=400) + `fontTools.subset`.
