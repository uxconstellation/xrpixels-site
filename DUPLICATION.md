# Duplication manifest — XR Pixels website (deployed copy)

Required before any build UI code is written (enforced by the duplication-gate hook).
Both references must be REAL captures in `_refs/design-library/reference-sites/<slug>/`
(teardown + blueprint), not "inspired by". Naming a site is not duplicating it.

content-ref: XR Pixels -> reference-sites/xrpixels/   (sections, copy, IA we replicate)
craft-ref:   Indigo Laboratory (5 tales of being) -> reference-sites/awwwards-indigo-laboratory/   (layout, motion language, scroll choreography, type we replicate)
skills-run:  none

<!--
This folder is the deployed static copy of ../build/ and duplicates the SAME pair that
../build/DUPLICATION.md declared first. This file exists so the gate can resolve the pair from
inside site/ without walking up to a parent that covers unrelated work (legal/, deck/, media/).

Both captures VERIFIED present on disk at the time of writing:
  content-ref: C:\Dev\_refs\design-library\reference-sites\xrpixels\
    index.html (240K) + blueprint.md + blueprint.json + screenshot-full.png (6.1M)
  craft-ref:   C:\Dev\_refs\design-library\reference-sites\awwwards-indigo-laboratory\
    index.html (345K) + blueprint.md + teardown.md + screenshot-full.png (10M) + _motion/

The numbered chapter markers, the mono micro-UI and the single accent on near-black are all
duplicated from the Indigo Laboratory capture. The node-spine engine, the cyan accent, the
product-card morph interaction and all copy are the deviation.

The threshold gate (button#enter, "Enter the experience" / "Continue without sound") was also
duplicated from Indigo, but it NO LONGER EXISTS. It was removed on 2026-08-13 at Aldo's request:
the monogram intro now opens the world itself on completion. Nothing in the build matches
`id="enter"` any more.

On skills-run: NO skill was invoked for the RoboXperience addition. It adds a tile to the work
grid introduced earlier the same day (the grid now carries SIX tiles, not the five stated here
before) and changes that grid's column count; it introduces no new component, page or motion
language. build-brief was judged not to apply for that reason. If the view is that any new
content block counts as a build, this was a miss and should be logged.

**Logged as a miss, 2026-08-13**, per the Deliverable Governance Law: a new tile plus a grid
column-count change is a build change and should have run build-brief. Note also that the tiles
ship as "Robotics" and "Merch"; "RoboXperience" and "Scannable Merch" appear nowhere in the build.
-->
