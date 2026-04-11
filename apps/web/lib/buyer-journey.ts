export const buyerJourneyStageMeta = {
  proof_viewed: {
    order: 1,
    phase: "awareness",
    label: "Proof viewed",
    expectedBelief: "I see what this is.",
  },
  free_sample_started: {
    order: 2,
    phase: "consideration",
    label: "Free sample started",
    expectedBelief: "Trying one photo feels easy enough to start.",
  },
  sample_photo_uploaded: {
    order: 3,
    phase: "consideration",
    label: "Sample photo uploaded",
    expectedBelief: "This is now my photo, not just a demo.",
  },
  sample_ready_viewed: {
    order: 4,
    phase: "consideration",
    label: "Sample ready viewed",
    expectedBelief: "I can picture my kid using this.",
  },
  builder_started: {
    order: 5,
    phase: "decision",
    label: "Builder started",
    expectedBelief: "I am ready to turn this into the full book.",
  },
  offer_selected: {
    order: 6,
    phase: "decision",
    label: "Offer selected",
    expectedBelief: "I know which size/version fits us.",
  },
  bundle_selected: {
    order: 7,
    phase: "decision",
    label: "Bundle selected",
    expectedBelief: "This could also be for siblings, grandparents, or gifts.",
  },
  order_draft_created: {
    order: 8,
    phase: "decision",
    label: "Order draft created",
    expectedBelief: "The real book is started.",
  },
  full_upload_completed: {
    order: 9,
    phase: "conversion",
    label: "Full upload completed",
    expectedBelief: "The book has everything it needs to get made.",
  },
  shipping_started: {
    order: 10,
    phase: "conversion",
    label: "Shipping started",
    expectedBelief: "The printed version is moving toward delivery.",
  },
  checkout_started: {
    order: 11,
    phase: "conversion",
    label: "Checkout started",
    expectedBelief: "I am finishing the purchase now.",
  },
  purchase_confirmed: {
    order: 12,
    phase: "activation",
    label: "Purchase confirmed",
    expectedBelief: "I already have something real in motion.",
  },
  pdf_accessed: {
    order: 13,
    phase: "activation",
    label: "PDF accessed",
    expectedBelief: "I got a usable win from the order quickly.",
  },
  post_purchase_upsell_clicked: {
    order: 14,
    phase: "expansion",
    label: "Post-purchase upsell clicked",
    expectedBelief: "I want more value from the same book.",
  },
} as const;

export type BuyerJourneyStage = keyof typeof buyerJourneyStageMeta;
export type BuyerJourneyPhase = (typeof buyerJourneyStageMeta)[BuyerJourneyStage]["phase"];
