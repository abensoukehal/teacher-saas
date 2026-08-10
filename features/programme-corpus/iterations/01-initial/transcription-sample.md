# Transcription sample — method proof

**Source:** `tadarroj-3as-math-2022.pdf` · شعبة الرياضيات · وزارة التربية الوطنية · سبتمبر 2022
**Method:** `pdftoppm -r 150 -png`, read page by page. Dense mathematics re-rendered at 300 dpi
and cropped. **Arabic verbatim. Mathematics as LaTeX in `$…$`.**
**Rendered pages:** `/private/tmp/claude-501/-Users-lablabee-workspace-teacher-saas/f58aeed8-6a8a-4580-a372-b20bc0d1e9c5/scratchpad/png/`

> This is a *sample*, produced to prove the method before committing 73 pages to it. It is not
> the corpus. Three pages of nineteen, from one document of five.

---

## PDF page 5 (document page 4) — the summary table

| المادّة: رياضيات | المستوى: السنة الثالثة ثانوي رياضيات | عدد الأسابيع | الحجم الساعي |
|---|---|---|---|
| **الفصول** | تقويم تشخيصي لمكتسبات التلاميذ | أسبوع | 7 ساعات |
| | الدوال العددية (الاشتقاقية والاستمرارية) | أسبوعان | 14 ساعة |
| | الدالتان الأسية واللوغاريتمية | أسبوعان | 14 ساعة |
| | الدوال العددية (النهايات) | أسبوع | 7 ساعات |
| | التزايد المقارن ودراسة الدوال | أسبوعان | 14 ساعة |
| | المــتتاليــات العدديــــة | أسبوعان | 14 ساعة |
| | معالجة | أسبوع | 7 ساعات |
| | الدوال الأصلية والحساب التكاملي | 3 أسابيع | 21 ساعة |
| | الأعداد والحساب | 3 أسابيع | 21 ساعة |
| | الإحصاء والاحتمالات | أسبوعان | 14 ساعة |
| | معالجة | أسبوع | 7 ساعات |
| | الأعداد المركبة والتحويلات النقطية | 3 أسابيع | 21 ساعة |
| | الهندسة في الفضاء | 3 أسابيع | 21 ساعة |
| | معالجة | أسبوع | 7 ساعات |
| **المجموع** | | **27 أسبوع** | **189 ساعة** |

**Oracles:** weeks `1+2+2+1+2+2+1+3+3+2+1+3+3+1 = 27` ✓ ·
hours `7+14+14+7+14+14+7+21+21+14+7+21+21+7 = 189` ✓ · `189 = 7 × 27` ✓

`pdftotext` reported this total as **181**.

---

## PDF page 6 (document page 5) — main table, first page

**Title:** التدرج السنوي لبناء التعلمات في السنة الثالثة رياضيات
**Columns (RTL):** `الأسبوع · المحور · الكفاءات المستهدفة · المحتويات المعرفية · السير المنهجي لتدرج التعلمات · الحجم الساعي`

### الأسبوع 1
Full-width merged row: **تقويم تشخيصي للمكتسبات التلاميذ** — الحجم الساعي **7**

### الأسبوع 2 · المحور: الدوال العددية (الاشتقاقية والاستمرارية)
*(the محور cell is rotated and spans into week 3)*

| الكفاءات المستهدفة | المحتويات المعرفية | السير المنهجي لتدرج التعلمات | ح.س |
|---|---|---|---|
| *(فارغ)* | الاشتقاقية والاستمرارية: التذكير بالنتائج المحصل عليها في السنة الثانية<br>العدد المشتق والمماس<br>تعريف استمرار دالة على مجال | التذكير بالنتائج المحصل عليها في السنة الثانية، من خلال أنشطة وتمارين هادفة مختارة بعناية.<br>من خلال دوال مثل: $x \mapsto x^{2}$ ، $x \mapsto \lvert x \rvert$ و $x \mapsto \sqrt{x}$ نجعل التلاميذ يلاحظون أنّ الدالة تكون مستمرة على مجال، عندما يمكن رسم منحنيها البياني على هذا المجال دون رفع القلم.<br>كل الدوال المألوفة المقرّرة في هذا المستوى مستمرة على كل مجال من مجموعة تعريفها.<br>**لا تثار مسألة البحث في إثبات استمرارية دالة** | 2 |
| إثبات وجود حلول للمعادلة $f(x) = k$ ، $k$ عدد حقيقي. | مبرهنة القيم المتوسطة واستعمالها في إثبات وجود حلول للمعادلة $f(x) = k$ ، $k$ عدد حقيقي. | *(فارغ)* | 2 |
| حساب مشتق دالة مركّبة. | المشتقات المتتابعة | *(فارغ)* | 1 |
| استعمال المشتقات لدراسة خواص دالة والمنحنى الممثل لها (اتجاه تغيّر دالة على مجال، التقريب الخطي، نقطة الانعطاف، ...). | *(فارغ)* | *(فارغ)* | 2 |

**Week 2 hours:** `2+2+1+2 = 7` ✓

### [الأسبوع 3 — the number is NOT printed in the cell]

| الكفاءات المستهدفة | ح.س |
|---|---|
| **تابع** استعمال المشتقات لدراسة خواص دالة والمنحنى الممثل لها (اتجاه تغيّر دالة على مجال، التقريب الخطي، نقطة الانعطاف، ...). | 2 |
| توظيف المشتقات لحل مشكلات. (دراسة اتجاه تغيّر دوال كثيرات حدود، ناطقة، صماء) | 2 |

Only 4 hours on this page — **week 3 continues onto the next page.**

---

## PDF page 7 (document page 6) — main table, dense page

### الأسبوع 3 *(continued; the number IS printed here)* · same المحور

| الكفاءات المستهدفة | المحتويات | السير المنهجي لتدرج التعلمات | ح.س |
|---|---|---|---|
| توظيف المشتقات لدراسة الدوال المثلثية: $x \mapsto \cos x$ ، $x \mapsto \sin x$ ، $t \mapsto a\sin(\omega t + \varphi)$<br>—<br>توظيف المشتقات لحل مشكلات<br>—<br>حل معادلات تفاضلية من الشكل: $y'' = f(x)$ ، $y' = f(x)$ حيث $f$ دالة مألوفة. | *(فارغ)* | ندرس أمثلة حول دوال من مثل:<br>الدوال الناطقة (حاصل قسمة كثير حدود من الدرجة 2 أو 3 على كثير حدود من الدرجة 1 أو 2).<br>الدوال الصماء $x \mapsto \sqrt{f(x)}$ ، حيث $f$ دالة موجبة وقابلة للاشتقاق.<br>الدوال المثلثية: $x \mapsto \sin(ax+b)$ ، $x \mapsto \cos(ax+b)$ ، $x \mapsto \tan x$.<br>فيما يخص الدوال الصماء نتطرّق إلى المماس الموازي لحامل محور التراتيب.<br>يمكن الملاحظة أنّ كل دالة قابلة للاشتقاق على مجال هي دالة مستمرة على هذا المجال.<br>——<br>نشرح الكتابات $\dfrac{df}{dx}$ ، $\dfrac{d^{2}f}{dx^{2}}$ (المستعملة في الفيزياء) والكتابة $dy = f'(x).dx$.<br>يمكن توظيف العلاقة: $\Delta y \approx f'(x).\Delta x$ باستعمال مجدول لتقريب دالة تكون حلا لإحدى المعادلات التفاضلية: $y' = y$ ، $y' = \dfrac{1}{x}$. | **3** |

**Week 3 hours:** `4` (page 6) `+ 3` (page 7) `= 7` ✓

### الأسبوع 4 · المحور: الدالتان الأسية واللوغاريتمية

**الكفاءات المستهدفة** *(merged over the whole block)*:
دراسة الدالة الأسّية النيبيرية وتوظيف خواصها في حل معادلات ومتراجحات ·
توظيف خواص الدالة الأسية النيبيرية لحل مشكلات.

| المحتويات المعرفية | السير المنهجي | ح.س |
|---|---|---|
| الدالة الأسية: نشاط، تعريف وخواص الدالة $x \mapsto \exp(x)$. | تُعرف الدالة الأسية كحل خاص للمعادلة التفاضلية $y' = y$ التي تحقّق $y(0) = 1$.<br>نبدأ بإنشاء حل تقريبي لهذه المعادلة باستخدام مجدول (بتطبيق طريقة أويلر) ثمّ بعدها نقبل بوجود هذا الحل.<br>نقدّم هذه الدالة في مرحلة مبكرة من السنة الدراسية قصد توظيفها في العلوم الفيزيائية.<br>نستنتج من التعريف خواص الدالة الأسية: $\exp(x) > 0$ ، $\exp(x+y) = \exp(x) \times \exp(y)$. الترميز $e^{x}$، النهايات والمنحنى الممثل لها. | 2 |
| حل معادلات و متراجحات باستعمال خواص الدالة الأسية | *(فارغ)* | 2 |
| توظيف خواص دوال أسية $x \mapsto e^{kx}$. | *(فارغ)* | 2 |
| دراسة الدالة $\exp \circ u$. | *(فارغ)* | 1 |

**Week 4 hours:** `2+2+2+1 = 7` ✓

---

## What this sample establishes

**It works.** Arabic is verbatim and legible, mathematics converts cleanly to KaTeX-safe LaTeX
(`\mapsto`, `\dfrac`, `\sqrt`, `\varphi`, `\Delta`, `\circ`), and every week's hours sum to the
stream's constant 7.

**It also shows the three ways it can fail silently:**

1. **Week boundaries are not on the page.** Week 3's number is missing on page 6 and printed on
   page 7; week 3's rows straddle the page break. PDF page 11 carries two rows and no week
   number at all. The only reliable signal is the hours-per-week invariant.
2. **Merged cells make row correspondence a judgement call.** On page 7 a single `ح.س` of 3
   covers two `السير` paragraphs and three `كفاءات` lines. Attaching a paragraph to the wrong
   competency yields a record that reads perfectly and is wrong — **and no arithmetic oracle
   detects it.**
3. **Empty cells are everywhere** (`فارغ` above) and are indistinguishable from omitted cells
   in the output.

**Not visible in this sample and not yet handled: red text.** Two of the five documents carry a
legend saying red marks content not covered in 2021-2022. The maths document has red blocks
with no legend on the page. Plain text destroys the distinction.

**Cost:** ~8–12 k tokens per dense page, ~2 k for front matter. **6–8 pages per pass → 73 pages
is 11–13 passes**, each handing off running state (last week, last محور, hours accumulated in
the open week).
