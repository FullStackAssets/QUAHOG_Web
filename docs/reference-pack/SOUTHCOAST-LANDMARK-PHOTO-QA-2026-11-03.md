# QUAHOG | SouthCoast landmark photographic acceptance — 2026-11-03

Scope: exclusively the FullStackAssets/QUAHOG_Web repository. This branch contains research QA metadata, read-only validators and tests. No photographs are imported, no existing geometry is changed, no frontage edge is asserted, and no deployment is authorized.

## Acceptance order
1. One full-width straight-on front photograph with every corner, base and roof visible has priority over any other single image. Partial and oblique views do not substitute.
2. Both sides, roofline, entrance, true signage, material and window close-ups.
3. Street context in both directions, with identifiable street names and facade orientation.
4. Confirm address/identity from contemporary exterior and authoritative records.
5. Tie the building to its exact game polygon and confirm which footprint edge is the front. Document edge index, facing direction, photo ID/date and street-facing evidence.
6. Validate physical envelope, height, window rhythm and roofline before changing the model.
7. Check each image's source-specific reproduction rights before game asset use.

## 2026-11-03 source branch reconciliation
Baseline checked: GitHub main 73450d2d7eed651f03db5d2fc1fa44c1425063bd (Oct 19, not necessarily live staging or production).

- 19 site records: ten Fall River, nine New Bedford.
- 13 exact named polygon candidates in checked-in tiles: Fall River City Hall, Portugalia, Tecumseh Mill, Bank Street Armory, Academy Building, Justice Center; New Bedford Whaling Museum, Cherry Building, Rodman Candleworks, Carter's Clothing, U.S. Custom House, Double Bank, YMCA.
- Four exact named map markers: Fall River City Hall; New Bedford Whaling Museum, Rodman Candleworks, Double Bank.
- Six unlinked sites: Fall River Plumbers' Supply, The Cove Restaurant & Marina, Riverview Towers, Ships' Cove; New Bedford The Cove and Andrew Robeson House.
- One separate, unverified New Bedford Andrew Robeson proximity polygon candidate in tile b_-1_-1, array index 42. A historical marker coordinate falls inside it, but marker location alone does not prove parcel 53 lot 147 or which building face is the front.
- Zero approved full-building fronts; zero verified frontal footprint edges; zero accepted photo-to-model matches; zero approved image reuse permissions; zero imported photos.
- Geometry heights currently in map tiles are source blockout values, not measured building heights.

## Identity and geometry pitfalls
- The Andrew Robeson House at 32 William Street in New Bedford is different from the Andrew Robeson Jr. House / Fall River Historical Society at 451 Rock Street. The Fall River record is a legitimate named polygon but must not be assigned to New Bedford.
- The unidentified New Bedford Cove cannot be mapped from a generic name, nor confused with the Fall River restaurant at 392 Davol Street.
- The Cherry Building in New Bedford at 800 Purchase Street must not be substituted with the Cherry & Webb Building in Fall River.
- Ships' Cove and Riverview Towers are different Fall River properties.

## Photo needs
- Whaling Museum: separate current full front for each extant wing; modern entrance; cupola and join details. Future expansion designs are not existing facades.
- Cherry: current full facade and corner, not only historic.
- Rodman: sign-bearing facade shot and full roofline, windows, entrance.
- Carter's: entire upper floors and both sides.
- New Bedford Cove: identify property and address before mesh or photo matching.
- Andrew Robeson: establish 32 William Street, Map 53 Lot 147, as the exact polygon before promoting the proximity candidate. Identifying photograph: https://www.loopnet.com/Listing/30-32-William-St-New-Bedford-MA/25103607/
- Custom House, Double Bank, YMCA: close-ups of columns, stone, brick, signage, entrances, windows.
- Fall River City Hall: full frontend and missing overpass void and flags. Portugalia: actual storefront. Tecumseh: actual roofline/gable. Other buildings: head-on and street-facing images. No invented signage.

## Read-only verification commands
node scripts/verify_landmark_reference_gates.mjs
node scripts/verify_landmark_reference_gates.mjs --json
node scripts/discover_landmark_geometry_candidates.mjs --json
npm test -- src/landmarkReferenceGates.test.ts

The validator checks the 19 records, 13 named source tile polygon candidates and tile blob identities, four map POIs, cross-city geometry boundaries, and full-frame/frontage/rights prerequisites. It exits nonzero for integrity regressions. A passing structural check is NOT a photorealism acceptance.

The discovery script enumerates candidate names across stored building tiles without assigning geometry. It does not automatically identify New Bedford's Cove.

The regression test asserts that the 19 photo gates remain blocked unless genuine reference evidence is added and reviewed; test expected values must be intentionally updated as verified milestones are completed.

Do not merge without reconciling current live source, and do not deploy from this reference-collection branch.
