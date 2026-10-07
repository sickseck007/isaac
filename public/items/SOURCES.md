# Item catalogue and sprite provenance

This is an unofficial fan project for The Binding of Isaac: Repentance. Names and sprites refer to the original game; game artwork belongs to its respective rights holders, including Edmund McMillen and Nicalis. This project is not affiliated with or endorsed by them.

## Included catalogue

`src/data/items.json` contains 718 distinct standalone Repentance collectible entries, IDs 1–732 with the game's gaps. Trinkets, cards, consumables and Repentance+ additions are excluded. The catalogue includes quest items such as both Broken Shovel pieces, both Knife Pieces and Dad's Note. Familiar/orbital items are classified as `familiar`; hybrid active items are classified as `active`.

IDs 43, 61, 235, 587, 613, 620, 630, 648, 662, 666 and 718 are unused. Internal alternate states 59 (Book of Belial granted by Judas's Birthright), 656 (passive Damocles effect), and 474 (Broken Glass Cannon transformed state) are excluded. This avoids presenting duplicate effects as separately drawable items.

## Sources and revisions

- **English names, item IDs, quality and type:** [Isaac Codex](https://github.com/ceressa/isaac-codex), `assets/data/items.json`, revision `eb4fcc4b476c6b8ac2d34308ea2bdd767d753904`. The source identifies [Platinum God — Repentance](https://platinumgod.co.uk/repentance) as its data source. Only the basic factual catalogue fields were retained. Its MIT license covers application code, **not bundled game content**; no application code from this source was copied.
- **717 item sprites:** [NafzorOB/IsaacWallpaper](https://github.com/NafzorOB/IsaacWallpaper/tree/3d76ae7b18f8e57328a3d1619b3255ba07303bb8/assets), revision `3d76ae7b18f8e57328a3d1619b3255ba07303bb8`. The source credits [The Binding of Isaac: Rebirth Wiki](https://bindingofisaacrebirth.fandom.com/wiki/Binding_of_Isaac:_Rebirth_Wiki) and states that the content and materials are the intellectual property of their respective owners. No separate sprite redistribution license is stated.
- **1 item sprite (Undefined):** Isaac Codex at the revision above. These are game sprites sourced by that project from Platinum God. Per-item origins are recorded in `manifest.json`.
- **Russian item names:** [External Item Descriptions](https://github.com/wofsauge/External-Item-Descriptions), `descriptions/ab+/ru.lua` and `descriptions/rep/ru.lua`, revision `4a55dc567e701c3afe15acaf57da17841703da3a`. Russian translation contributors credited by the source: hell2Pay, fly_6, Dezzelshipc and Sekaz. Only item names were retained, with English fallback if a Russian name is absent.
- **ID coverage cross-check:** [IsaacScript collectibleNames.ts](https://github.com/IsaacScript/isaacscript/blob/428232c3d2cae4c422bb4c360b96b15fde37b79c/packages/isaacscript-common/src/objects/collectibleNames.ts). Used to check canonical IDs and identify alternate states; no library code was copied.

The user-supplied [Reddit 512×512 PNG collection post](https://www.reddit.com/r/bindingofisaac/comments/14la4cn/made_a_user_friendly_512x512_png_set_of_all/) could not be fetched because Reddit is outside this cloud environment's allowed network destinations. That archive was **not** used or independently verified. The bundled original pixel sprites render sharply with CSS `image-rendering: pixelated` and do not require 512×512 upscales.

## Rights and reproducibility

Public availability of a repository or image does not itself grant redistribution permission. Upstream code licenses do not relicense third-party game artwork. No broader ownership or asset license is claimed here. The assets are included as references for this fan game; retain these source notices and obtain any additional permission required for your intended use. Replace or remove affected assets if requested by a rights holder.

`manifest.json` records the original repository/path and SHA-256 for every copied PNG. The sprites are copied unchanged. All assets are served locally; the app does not depend on remote image hotlinks. Metadata is a source snapshot, so later game balancing patches may change quality values.
