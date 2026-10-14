# Epic of the Forsaken (버려진 자의 서사시)

**A swipe-card narrative RPG: an exiled fifteen-year-old prince, a prologue and
four acts, and almost thirty endings decided by what you kept and who stayed with you.**

> 별이 이름을 적으면, 양치기도 왕. ("When the stars write your name, even a
> shepherd is king.")

The old king of Arben is dead, and his illegitimate son flees a burning palace.
Each scene is a card: swipe left or right, fight duels by choosing when to
block and when to strike, explore a tower floor by floor, and decide whether
to retake the throne or to walk away from it.

One self-contained `index.html` (HTML/CSS/JS, no build, no server) plus
optional art in `assets/`. The UI and text are in Korean.

## Why I built it

I wanted to see how far a single static web page could carry a branching story
without it feeling like a menu of buttons. The design problem was making
**long-term consequences legible** in a format where each decision is just
left or right: a promise made in Act 1 should visibly come due in Act 4, and
the ending you get should feel earned rather than rolled.

## Design

- **Four stats, four bonds.** Military, people, legitimacy and gold are the
  public state. Bonds with four companions (Lien, Kane, Marta, Bernard) are the
  private state. The endings away from the throne are gated by *accumulated* bonds, so walking away has to be
  earned too.
- **Branches you can see.** Choices that fork the story are flagged before you
  commit, and branch scenes are guaranteed to appear. Earlier playtests showed
  that invisible branches felt random.
- **Endings as a collection.** An ending album, numbered endings,
  character epilogues and cross-run "deeds" give each playthrough something to
  carry into the next. A guidebook links every ending back to the route that
  reaches it, and each route forward to its endings.
- **Fail states with dignity.** Deaths and the "wounds" ending (HP persists
  across a run) are written scenes, not game-over screens.
- **Sound without files.** All effects (paper drag, blade, parry, bells) and a
  music-box lullaby are synthesized with the Web Audio API. Audio files dropped
  into `assets/` replace them automatically.
- **Art is optional.** Every image slot falls back to a line icon or an
  initial, so the game is fully playable before any art exists. Prompts for the
  generated art are in `docs/`.

It was refined over several rounds of playtest and external UI review. The
commit history records each round (consequence and route bugs, crisis
ordering, Korean line breaking, larger touch targets, first-run tips).

## Run it

Open `index.html` in a browser. A phone in portrait works best.

## Files

```text
index.html                    the whole game
assets/                       optional art (title video, item icons, portraits); see assets/README.md
docs/사운드-계획.md           sound design plan (Korean)
docs/이미지-에셋-요청서.md    image asset request sheet with generation prompts (Korean)
```

## How this was built

I wrote the story and game design and built the game up to v5.4. From there I
iterated with an AI coding assistant, using playtest critiques to drive each
round. The illustrations were generated with image models from the prompts in
`docs/`.
