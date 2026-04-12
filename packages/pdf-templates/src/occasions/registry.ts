import type { OccasionModule, OccasionId } from "../types.js";
import { everydayOccasion } from "./everyday.js";
import { birthdayOccasion } from "./birthday.js";
import { vacationOccasion } from "./vacation.js";
import { petKeepsakeOccasion } from "./pet-keepsake.js";
import { christmasOccasion } from "./christmas.js";
import { grandparentsKeepsakeOccasion } from "./grandparents-keepsake.js";

// ---------------------------------------------------------------------------
// Stub factory — produces a placeholder OccasionModule whose runtime methods
// throw if called. Used for occasions that are defined in the type system but
// not yet built out.
// ---------------------------------------------------------------------------

function stub(id: OccasionId): OccasionModule {
  const notImplemented = (): never => {
    throw new Error(`Occasion "${id}" is not yet implemented.`);
  };

  // Return a Proxy so that any property access beyond what TypeScript exposes
  // also throws, while still satisfying the OccasionModule shape at compile time.
  return new Proxy(
    {
      id,
      category: "everyday", // placeholder — never used at runtime
      label: id,
      titleTemplate: "",
      subtitleTemplate: "",
      requiredContext: [],
      styleConstraints: null,
      dedicationPrompt: "",
      captionPrompt: "",
      backMatter: "",
    } satisfies OccasionModule,
    {
      get(target, prop) {
        // Allow id through so the registry can index/display stubs safely.
        if (prop === "id") return target.id;
        // Any functional use of the stub throws.
        if (typeof prop === "string" && prop !== "id") {
          notImplemented();
        }
        return Reflect.get(target, prop);
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Fully implemented occasions
// ---------------------------------------------------------------------------

const implemented: OccasionModule[] = [
  everydayOccasion,
  birthdayOccasion,
  vacationOccasion,
  petKeepsakeOccasion,
  christmasOccasion,
  grandparentsKeepsakeOccasion,
];

// ---------------------------------------------------------------------------
// Stub occasions — all OccasionId values not yet implemented
// ---------------------------------------------------------------------------

const stubIds: OccasionId[] = [
  "milestone-birthday",
  "first-birthday",
  "graduation",
  "wedding-day",
  "quinceañera-bar-bat-mitzvah",
  "gotcha-day",
  "new-pet",
  "pet-memorial",
  "road-trip",
  "national-park",
  "disney-parks",
  "beach-trip",
  "hanukkah",
  "halloween",
  "thanksgiving",
  "easter",
  "valentines",
  "lunar-new-year",
  "diwali",
  "new-baby",
  "big-sibling",
  "family-reunion",
  "adoption-day",
  "school-year",
  "first-day-of-school",
  "sports-season",
  "dance-recital",
  "in-memory",
  "moving-new-home",
];

// ---------------------------------------------------------------------------
// Registry — only populated (non-stub) entries are in this record.
// ---------------------------------------------------------------------------

export const occasions: Record<string, OccasionModule> = Object.fromEntries(
  implemented.map((m) => [m.id, m]),
);

// All stubs are registered in a separate internal map so getOccasion can
// resolve any valid OccasionId without exposing unimplemented modules to
// callers who enumerate `occasions`.
const allOccasions: Record<string, OccasionModule> = {
  ...occasions,
  ...Object.fromEntries(stubIds.map((id) => [id, stub(id)])),
};

/**
 * Returns the OccasionModule for the given id.
 *
 * Throws with a clear "not yet implemented" message if the occasion exists in
 * the type system but has not been built out yet.
 *
 * Throws with an "unknown occasion" message if the id is not recognized at all
 * (which should be impossible when callers are type-safe, but guarded for
 * runtime safety).
 */
export function getOccasion(id: OccasionId): OccasionModule {
  const module = allOccasions[id];
  if (module === undefined) {
    throw new Error(`Unknown occasion id: "${id}".`);
  }
  return module;
}
