import type { CampaignTaxonomy } from "./brief-generator";

// Machine-readable mirror of ../../../campaign-taxonomy.yaml. Bundled at
// build time so the deployed ads cron path doesn't need to read the
// filesystem. Keep in sync with the yaml; the invariant test in
// __tests__/campaign-taxonomy.test.ts enforces the link.
export const bundledCampaignTaxonomy: CampaignTaxonomy = {
  personas: [
    // AGENTS.md approved "start with" set (6)
    { id: "warm_millennial_mom", name: "Warm Millennial Mom" },
    { id: "organized_practical_mom", name: "Organized Practical Mom" },
    { id: "emotional_keepsake_mom", name: "Emotional Keepsake Mom" },
    { id: "grandma_gift_buyer", name: "Grandma Gift Buyer" },
    { id: "homeschool_screenfree_mom", name: "Homeschool or Screen-Free Mom" },
    { id: "lifestyle_gift_creator", name: "Lifestyle Creator or Gift Recommender" },
    // Extensions: dads
    { id: "dad_primary_shopper", name: "Dad Primary Shopper" },
    { id: "military_dad_keepsake", name: "Military / Deployed Parent Keepsake" },
    // Extensions: grandparents + extended family
    { id: "grandpa_gift_buyer", name: "Grandpa Gift Buyer" },
    { id: "aunt_uncle_gifter", name: "Aunt / Uncle Gift Giver" },
    { id: "godparent_gifter", name: "Godparent Gift Giver" },
    // Extensions: special-occasion gift mindsets
    { id: "birthday_party_host", name: "Birthday Party Host (kids' party parent)" },
    { id: "holiday_gifter", name: "Holiday Gift Giver (Xmas/Hanukkah/etc.)" },
    { id: "teacher_end_of_year_gifter", name: "Teacher End-of-Year Gift Giver" },
    // Extensions: adult self-purchase
    { id: "adult_self_reward", name: "Adult Self-Reward Colorer (stress-relief)" },
  ],
  formats: [
    "before_after",
    "talking_head",
    "family_photos_reveal",
    "screen_free_mom_pov",
    "sibling_angle",
    "grandparent_gift",
    "birthday_angle",
    "vacation_angle",
    "print_flipthrough",
    "slideshow_narration",
    "proof_montage",
    "faq_objection",
    "comparison_generic_books",
  ],
  occasions: [
    "evergreen",
    "birthday",
    "holiday",
    "vacation",
    "rainy_day",
    "travel_activity",
    "grandparent_gift",
    "sibling_conflict",
    "sibling_set",
    "back_to_school",
    "mothers_day",
    "fathers_day",
    "pet_book",
    "memorial_keepsake",
    "new_sibling_arrival",
    "adoption_day",
    "deployment_keepsake",
    "wedding_favor",
    "first_day_of_school",
    "in_memory_pet",
  ],
  offers: [
    { id: "free_sample", name: "Free Sample Page" },
    { id: "pdf_30", name: "30-Design PDF" },
    { id: "pdf_50", name: "50-Design PDF" },
    { id: "pdf_100", name: "100-Design PDF" },
    { id: "print_solo", name: "Solo Keepsake" },
    { id: "print_sibling_set", name: "Sibling Set" },
    { id: "print_sibling_trio", name: "Sibling Trio" },
  ],
};
