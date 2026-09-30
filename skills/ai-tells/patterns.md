# AI tells catalogue

Every tell below is one form of the default choice: the phrasing that fits the widest range of readers and subjects, where a person would choose for one reader and one subject.

Each heading is a stable id.
The lint script prints the same ids, and other skills cite them as `ai-tells#not-x-but-y`.
`bash skills/ai-tells/tests/run.sh` fails when a lint id or a citation points at a missing heading, so rename an id together with its citations.

Each entry opens with its tag line:

- **Strong** tells justify an edit on one sighting.
  **Weak alone** tells need company from other tells in the same passage before you act.
- **Linted** means `scripts/ai_tells_lint.py` flags the lexical form.
  The lint catches phrasings, not the structure; the structural forms stay a reading job.
- A register note (technical, personal, copy) appears only where the tell applies differently by register.
  See the register table in `SKILL.md`.

## Staging instead of stating

The sentence signals importance instead of adding a fact.
These are the strongest and most frequent tells in current model prose.

### not-x-but-y

*Strong. Linted.*

Watch for: not X but Y; not just, not only, not merely X, but Y; it's not X, it's Y; X rather than Y used for weight; the contrast split across sentences ("This does not mean X.
It means Y."); a negative list ("Not a tool.
Not a framework.
A platform."); a clipped negative tail (", no guessing").
The formula exists in every language; treat the equivalent construction the same way.

The negative half names something no one claimed, so the positive half sounds larger.
State the positive half directly.
Keep a contrast only when the negative half corrects a belief the reader actually holds, or when both halves carry information.

> Before: It's not just about the beat riding under the vocals; it's part of the aggression and atmosphere.
> After: The heavy beat adds to the aggressive tone.

> Before: This does not mean every choice is equal. It means there is no external system that confirms which choice is right.
> After: No external system confirms which choice is right, although the choices still have different consequences.

### one-line-closer

*Strong. Linted (stock phrases only).*

Watch for: a one-sentence paragraph that restates the paragraph before it; "That is the real win."; the same closer after several sections; a row of fragments ("No aesthetic prior.
No nostalgia."); a final line that turns the point into a cute metaphor or mic drop; one word in ALL CAPS or split by periods ("every. single. day.").

The line asks the reader to pause on a claim instead of adding to it.
Delete a closer that repeats; do not rewrite it into a better metaphor, and do not keep its rhythm.
End on the clearest concrete sentence already in the text.
Merge a row of fragments into one sentence with a specific claim.
One short sentence that carries a new fact is fine.

Copy register: a headline or a LinkedIn line break is format, not a tell, while each line still carries information.

> Before: Then AlphaEvolve arrived. It had no preference for symmetry. No aesthetic prior. No nostalgia for human taste. The old rules were gone.
> After: AlphaEvolve changed the search because it did not favor symmetry or human-looking designs. That made some older assumptions less useful.

### mannered-prose

*Strong.*

Watch for: sayings dressed as hidden truth (the real question is, at its core, what really matters, the heart of the matter); aphorism formulas (X is the Y of Z, X becomes a trap, not a tool but a mirror, the language of, the currency of); personified code ("the plan holds it", "the parser wants"); figurative verbs ("rides along", "stands on", "lives in" for plain placement).

The flourish stands where a literal phrase exists and adds no detail.
Write the literal claim.
`metaphor-jargon` covers the metaphor nouns.

> Before: Symmetry is the language of trust. Efficiency becomes a trap when teams forget the human layer.
> After: Symmetric layouts often feel more predictable to users. Teams can over-optimize workflows and miss how people actually use them.

### staged-opener

*Strong. Linted.*

Watch for: run-ups (let's dive in, let's break this down, here's what you need to know, without further ado, quick note); staged candor (Honestly?, Look, Here's the thing, Real talk, Let me be clear, The uncomfortable truth is); faux insight that casts the writer as the lone expert (what most people get wrong, here's what nobody tells you, the part everyone misses); rhetorical setups (What if I told you, Think about it, Plot twist, a question the next sentence answers).

The writer announces the point instead of making it.
Remove the run-up and let the claim stand.
"Honestly" or "look" inside an ordinary casual sentence is fine; the tell is the standalone opener before a routine claim.

> Before: Is it worth the price? Honestly? It depends on how often you'll use it.
> After: Whether it's worth the price depends on how often you'll use it.

> Before: The part everyone misses: distribution is the real moat.
> After: Distribution is the moat.

### colon-reveal

*Strong.*

Watch for: a noun phrase, a colon, then a dramatic reveal ("The best part: it learns."); a colon as a mid-sentence connector that stages a comparison.

Rewrite as a plain sentence.
Colons belong before a list, an example, a label, or a quote.
After a colon, use sentence case unless a proper noun, a title, or code requires otherwise.

> Before: The detail that makes it work: a separate agent grades every draft.
> After: A separate agent grades every draft, and that is what makes it work.

### straw-objection

*Strong.*

Watch for: This isn't about, I'm not saying, To be clear, Don't get me wrong, Some might say... but, A tempting approach would be, You might think... but, It would be easy to just.

The text answers an objection or rejects an option that appears nowhere else, usually a leftover from an earlier draft.
Remove the defense; if it holds a real claim, state the claim.
Keep an objection the text attributes or answers in full, and an option a reader would actually weigh.

> Before: Session tokens rotate every 24 hours. A tempting approach would be to restart the auth service on a cron job, but that would drop every session. Rotation happens in place.
> After: Session tokens rotate every 24 hours, in place, and clients refresh transparently.

### metadiscourse

*Strong. Linted.*

Watch for: lines that step outside the subject to tell the reader what to notice or how much weight to give it (That last part matters more than it sounds, The key point is, This distinction matters, As you can see, Let that sink in, Read that again, a redundant "In other words").

If the point is clear, delete the aside.
If it is not, replace the aside with the fact or example that shows why the point matters.

> Before: The cache keys on the user id, not the session. That distinction matters more than it sounds.
> After: The cache keys on the user id, so two tabs from one user share entries.

## Rhythm by rule

A device applied everywhere, whether or not the meaning asks for it.
A person may use any one of these on purpose, so most need company.

### forced-triad

*Weak alone.*

Ideas arrive in threes to sound complete: three adjectives, three parallel examples, three short facts and a lesson.
Check that each item adds a distinct idea.
Use the natural number: merge items, develop the strongest one, or vary the structure.
Keep three when the meaning has three parts.

> Before: The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights.
> After: The event includes talks and panels, with time for informal networking between sessions.

### robotic-rhythm

*Weak alone.*

Several sentences in a row share a subject or opening, paragraphs share one shape, or every sentence runs the same length.
Merge sentences, change the subject, or open with the action.
Writers repeat an opening on purpose for rhythm ("She came.
She saw.
She conquered."), so act only when the repetition carries nothing.

> Before: She noted the door. She noted the lock on it. She filed both away.
> After: She noted the door and its lock, then filed both away.

### dash

*Hard rule. Linted.*

The final text contains no em dash (—), no en dash (–), and no spaced double hyphen used as a dash, in every register, with or without a voice sample.
Number ranges included: write "2010 to 2020".
Replace each dash with a period, a comma, or a colon before a list, or rewrite the sentence; use parentheses only for a true aside.
Leave code blocks, inline code, commands, paths, and URLs alone.

A dash lets the writer skip choosing how two clauses relate, which is why a model reaches for it everywhere.

> Before: The new policy — announced without warning — affects thousands of workers.
> After: The new policy, announced without warning, affects thousands of workers.

### stacked-hedges

*Weak alone. Linted.*

Watch for: could potentially, might arguably, it's also possible, in some cases it may, one qualifier after another.

Repeated editing piles qualifiers onto a claim, usually to repair an earlier overstatement rather than to report real doubt.
Keep one qualifier when the source supports it.
Keep scope statements, legal and safety notices, and real corrections.
A single "perhaps" or "tends to" is a human habit.

Personal register: keep hedges that express the writer's real uncertainty ("I think", "maybe").

> Before: It could potentially possibly be argued that the policy might have some effect on outcomes.
> After: The policy may affect outcomes.

### passive-voice

*Weak alone.*

The text hides who acts or drops the subject ("No configuration needed.").
Name the actor: "queries are validated" becomes "the compiler validates queries".
Passive is fine when the actor is unknown or does not matter.
Give human verbs to people, not to decisions or documents ("the decision emerged" hides who decided).

> Before: No configuration file needed. The results are preserved automatically.
> After: You do not need a configuration file. The system preserves the results automatically.

### synonym-cycling

*Weak alone.*

The text rotates terms for one thing (protagonist, main character, central figure) to avoid repetition.
Pick the clearest word and repeat it.
In technical text one term per concept is a requirement, since a new word implies a new thing.

> Before: The agent reviews the draft. The assistant scores the piece. The tool suggests fixes.
> After: The agent reviews the draft, scores it, and suggests fixes.

### false-range

*Weak alone.*

"From X to Y" where X and Y are not ends of a real scale ("from startups to governments, from art to engineering").
List the items directly, or name the one that matters.

### hyphen-pairs

*Weak alone.*

Watch for: third-party, cross-functional, data-driven, high-quality, real-time, long-term, end-to-end hyphenated in every position.
Keep the hyphen before a noun (a high-quality report); drop it after the noun (the report is high quality).

## Inflation and borrowed authority

The fact underneath is usually sound.
Keep it and remove the dressing.

### ai-vocabulary

*Weak alone, strong in clusters. Linted.*

Watch for: additionally, align with, bolstered, crucial, delve, embark, elevate, enduring, enhance, ever-evolving, foster, garner, interplay, intricate, meticulous, multifaceted, paramount, pivotal, realm, seamless, showcase, supercharge, tapestry, testament, transformative, underscore, vibrant, game changer, cutting-edge, paradigm shift.
Not linted because the technical sense is legitimate: robust, key (adjective), landscape, highlight, gate, valuable, quietly.

Models use these far more often than people, especially several in one paragraph.
Replace each with the plain word or cut it.
A formal word outside this list is not a tell by itself: do not flatten "ostensibly" or "constituent".

> Before: Additionally, an enduring testament to Italian colonial influence is the widespread adoption of pasta in the local culinary landscape.
> After: Pasta dishes, introduced during Italian colonization, remain common, especially in the south.

### fancy-word

*Weak alone. Linted.*

A longer synonym where a plain word works: utilize (use), leverage as a verb (use), facilitate (help), numerous (many), commence (start), endeavor (try), in the event that (if), empower (let), streamline (simplify, or say what got removed).
The lint prints the plain swap.

### inflated-significance

*Strong. Linted.*

Watch for: stands as a testament, a pivotal moment, plays a key role, marks a milestone, reflects a broader, lasting legacy, setting the stage for, evolving landscape, indelible mark; a stock "Challenges and Future Outlook" section; a send-off (the future looks bright, exciting times ahead, a step in the right direction).

An ordinary detail is said to mark a change, prove a legacy, or promise a future.
Keep the fact and drop the significance.
End on the last concrete fact; if the source states real plans, use those.

> Before: The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment in the evolution of regional statistics in Spain.
> After: The Statistical Institute of Catalonia was established in 1989.

### recap-ending

*Strong. Linted.*

"In conclusion", "In summary", "Ultimately", "Overall", or a final paragraph that restates the piece.
The reader was just there.
End on the last concrete point, takeaway, or next action.

### vague-association

*Weak alone.*

Watch for: associated with, in connection with, linked to, tied to.
The text says two things are connected without saying how.
Name the relationship the source gives (founded, chairs, funded).
If the source does not say, keep the vague wording rather than invent a role.

> Before: He is associated with the Rajhans Orchestra, which he founded and conducts.
> After: He founded and conducts the Rajhans Orchestra.

### ing-rider

*Strong. Linted.*

Watch for: a trailing clause with highlighting, underscoring, emphasizing, ensuring, reflecting, symbolizing, showcasing, fostering, contributing to, cementing.

The clause bolts a claimed meaning onto a simple fact.
Keep the fact.
Replace the rider with the real consequence, or delete it; keep it only when the source supports what it claims.

> Before: The launch adds file search, highlighting the team's commitment to better workflows.
> After: The launch adds file search, so users find old drafts without leaving the editor.

### sales-language

*Strong. Linted.*

Watch for: nestled, in the heart of, breathtaking, stunning, must-visit, renowned, world-class, boasts, rich cultural heritage, diverse array, groundbreaking.
The text reads like an advertisement for a place, product, or organization.
State what the thing is.

Copy register: copy may sell, but it sells with specifics; these words are exactly what makes copy sound machine written.

> Before: Nestled within the breathtaking region of Gonder, Alamata Raya Kobo stands as a vibrant town with a rich cultural heritage.
> After: Alamata Raya Kobo is a town in the Gonder region of Ethiopia.

### borrowed-authority

*Strong. Linted.*

Watch for: experts believe, studies show, industry reports suggest, many argue, widely regarded as, some critics say; a list of prestige outlets ("cited in The New York Times, BBC, Financial Times"); follower counts.

An unnamed authority or a name list stands in for what was said.
Name the source and what it said, or cut the claim.
Never invent a source; if the user has none, ask.
A missing citation alone is not a tell.

> Before: Experts believe the river plays a crucial role in the regional ecosystem.
> After: Researchers study the river for its unusual characteristics.

### copula-avoidance

*Weak alone. Linted.*

Watch for: serves as, stands as, functions as, boasts, features, represents.
Simple verbs replaced with longer ones.
Use is, are, and has.

> Before: Gallery 825 serves as LAAA's exhibition space. The gallery features four separate spaces and boasts over 3,000 square feet.
> After: Gallery 825 is LAAA's exhibition space. It has four rooms totaling 3,000 square feet.

## Formatting by rule

Templates and editors also produce clean formatting.
The tell is decoration on every item.

### decorative-bold

*Weak alone. Linted (bold label lists).*

Bold sprinkled on terms mid-sentence, and lists where each item opens with a bold label and a colon that the line then restates ("**Performance:** Performance improved").
Remove the bold.
Turn a labeled list into prose when the labels carry nothing of their own.
A bold lead-in that ends in a period, names the item, and is followed by new detail is fine.
Use prose where two sentences read better than bullets.

> Before:
> - **Performance:** Performance has been enhanced through optimized algorithms.
> - **Security:** Security has been strengthened with end-to-end encryption.
>
> After: The update speeds up load times and adds end-to-end encryption.

### decorative-heading

*Weak alone. Linted (title case, emoji).*

Headings in title case, emojis or arrows on headings and bullets, a horizontal rule between every section, a top heading that repeats the title, headers over two-sentence sections.
Use sentence case, remove the decoration, and drop headers the section length does not need.

> Before: ## 🚀 Strategic Negotiations And Global Partnerships
> After: ## Strategic negotiations and global partnerships

### curly-quotes

*Weak alone. Linted.*

Curly quotes where the target format uses straight quotes.
Most editors auto-curl, so this counts only next to other tells, or when the target format (Markdown, code, config) wants straight quotes.

## Leftovers from the chat and the draft

Text never meant for the reader.
Remove it outright.

### chatbot-residue

*Strong. Linted.*

Watch for: I hope this helps, Great question, Certainly!, Of course!, You're absolutely right, Let me know if, Would you like me to, Want me to, here is a.
The most certain tell and the easiest to miss when it wraps real content.
Remove the wrapper, keep the content.
Salutations and sign-offs on a letter or comment predate chatbots.

> Before: Great question! The French Revolution began in 1789 amid a financial crisis. I hope this helps!
> After: The French Revolution began in 1789 amid a financial crisis.

### knowledge-limit

*Strong. Linted.*

Watch for: as of my last training update, while specific details are limited, based on available information, not publicly documented, maintains a low profile, likely grew up, it is believed that.
The text marks where the model's knowledge ends, or admits a gap and fills it with a plausible guess.
State what the source does not show, or cut the sentence.
Never present a guess as a fact.

> Before: Information about her early life is not publicly available, suggesting she maintains a low profile. She likely grew up in a middle-class household.
> After: Her early life is not documented in the available sources.

### heading-echo

*Strong.*

A heading followed by a one-line paragraph that restates it before the real content ("## Performance / Speed matters.").
Delete the echo.

### previous-version

*Strong. Technical register.*

Docs and comments describe what the text replaced instead of current behavior ("This function was added to replace the previous approach").
Describe the thing as it is.
Mention the old version only in changelogs, release notes, and migration guides.

> Before: This function was added to replace the previous approach of iterating through all items, which caused O(n²) performance.
> After: This function uses a hash map for O(1) lookups.

## Plain speech

Strongest in the technical register; apply with a lighter hand to personal writing, where voice outranks them.

### portable-sentence

*Strong.*

A sentence that could move unchanged into another project's docs, another company's post, or another person's essay says nothing about this one.
Sentences that name a feeling ("SQL you can read", "the database stays close at hand") usually fail.
Ask what the reader should do or know after the sentence, then write that as a mechanism, a number, a name, or a consequence ("`.toSQL()` returns the exact string sent to the database").
If you cannot restate it concretely from the source, cut it; never invent the specifics.

> Before: The tool significantly improves engineering productivity.
> After: The tool cut review time from 30 minutes to 8. (Only when the source gives both numbers.)

### metaphor-jargon

*Weak alone. Linted.*

Abstract metaphor nouns that read as technical: substrate (base), wedge in (add), vector (way), locus, nexus, bedrock, scaffolding as metaphor, surface for an API, north star, flywheel, endgame (last phase), gold-plating (more than the job needs), paradigm, primitive as a noun, harness as metaphor.
Pick the concrete word.
Keep the literal technical sense (a math vector, a test harness).

### filler-phrase

*Weak alone. Linted.*

Watch for: in order to (to), due to the fact that (because), it's worth noting, it is important to note, at the end of the day, when it comes to, in today's world, in terms of, with regard to, going forward, made a decision (decided), has the ability to (can).
Cut the phrase or swap the short form.

Personal register: keep an occasional phrase that belongs to the writer's recognizable voice when the sentence still earns its place.

### adverb-crutch

*Weak alone. Linted (intensifiers only).*

Watch for: just, really, simply, actually, truly, fundamentally, crucially, and the intensifiers the lint flags (significantly, dramatically, overwhelmingly, incredibly, tremendously, extremely).
An adverb propping up a weak verb means the verb is wrong: "runs quickly" becomes "is fast" or the number, "significantly improves" becomes the measured delta.

Personal register: keep adverbs that carry emphasis, contrast, uncertainty, or the writer's spoken rhythm.

### dense-sentence

*Weak alone.*

The reader has to backtrack to parse the sentence.
Split it or drop clauses: one idea per sentence.
Personal register: keep long spoken sentences that stay clear.

### over-compression

*Strong. Linted (arrows).*

Dropped articles, verbless fragments, arrows, and invented abbreviations that make the reader decode instead of read.
Write whole sentences with their articles and verbs; spell out arrows and abbreviations.
Terse chat modes do not apply to text persisted for other readers.

> Before: Parser rejects bad date → exit 2, no write.
> After: The parser rejects a bad date, exits with code 2, and writes nothing.
