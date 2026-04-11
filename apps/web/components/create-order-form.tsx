"use client";

import {
  defaultCoverStyle,
  defaultPrintBundleCode,
  type CoverStyleCode,
  getOfferByCode,
  getOfferSubtotalForQuantity,
  offers,
  printBundleOptions,
  type Offer,
  type OfferCode,
  type PrintBundleCode,
} from "@littlecolorbook/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getConsumerOffer } from "../lib/consumer-content";
import { trackEvent } from "./analytics-provider";

type DeliveryMode = "pdf" | "print";
type BuilderStep = "format" | "pages" | "pack" | "cover" | "details" | "review";
type CoverNameMode = "same" | "different";

type CreateOrderResponse = {
  id: string;
  selectedOffer: string;
};

type CreateOrderFormProps = {
  initialOffer?: string;
};

const offerOptions: Record<DeliveryMode, Offer[]> = {
  pdf: offers.filter((offer) => offer.format === "pdf"),
  print: offers.filter((offer) => offer.format === "print"),
};

const formatCards: Record<
  DeliveryMode,
  {
    description: string;
    label: string;
    title: string;
  }
> = {
  pdf: {
    label: "Print Tonight PDF",
    title: "Fastest path",
    description: "Best when you want the pages today and already have a printer at home.",
  },
  print: {
    label: "Giftable Spiral Book + PDF",
    title: "Keepsake path",
    description: "Best when you want the bound version shipped to you and the PDF included too.",
  },
};

const printBundleCards: Record<
  PrintBundleCode,
  {
    description: string;
    label: string;
    title: string;
  }
> = {
  single: {
    label: "Single keepsake",
    title: "One printed copy",
    description: "Best when you want one spiral book and the PDF handles any future reprints.",
  },
  "set-of-2": {
    label: "Sibling pack",
    title: "Two printed copies",
    description: "Great for siblings, one home plus one grandparent gift, or one clean copy and one everyday copy.",
  },
  "set-of-3": {
    label: "Three-pack",
    title: "Three printed copies",
    description: "Best for bigger families, birthday gifting, or a copy for grandma without reordering later.",
  },
  "set-of-5": {
    label: "Grandparent pack",
    title: "Five printed copies",
    description: "Best when you want enough copies for both households, grandparents, and a keep-safe shelf copy.",
  },
};

const coverStyleCards: Record<
  CoverStyleCode,
  {
    description: string;
    label: string;
    title: string;
    toneClass: string;
  }
> = {
  storybook: {
    label: "Warm + classic",
    title: "Storybook cover",
    description: "Soft paper tones and a keepsake feel that works for everyday family memories.",
    toneClass: "cover-style-storybook",
  },
  sunshine: {
    label: "Bright + playful",
    title: "Sunshine cover",
    description: "A cheerier, more activity-first cover direction for kids who love color and energy.",
    toneClass: "cover-style-sunshine",
  },
  adventure: {
    label: "Bold + outdoorsy",
    title: "Adventure cover",
    description: "A more energetic look for vacations, pets, birthdays, and big-memory photo sets.",
    toneClass: "cover-style-adventure",
  },
};

const stepLabels: Record<BuilderStep, string> = {
  format: "Format",
  pages: "Pages",
  pack: "Copies",
  cover: "Cover",
  details: "Details",
  review: "Review",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function findOfferForMode(mode: DeliveryMode, designs: number) {
  return offerOptions[mode].find((offer) => offer.designs === designs) ?? offerOptions[mode][0];
}

async function readApiPayload<T>(response: Response) {
  const raw = await response.text();

  if (!raw) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

export function CreateOrderForm({ initialOffer }: CreateOrderFormProps) {
  const router = useRouter();
  const formId = "create-order-form";
  const resolvedInitialOffer = getOfferByCode(initialOffer ?? "pdf-30");
  const initialDeliveryMode: DeliveryMode = resolvedInitialOffer.format === "print" ? "print" : "pdf";
  const initialOfferCode = (resolvedInitialOffer.format === "sample" ? "pdf-30" : resolvedInitialOffer.code) as OfferCode;

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(initialDeliveryMode);
  const [selectedOfferCode, setSelectedOfferCode] = useState<OfferCode>(initialOfferCode);
  const [printBundleCode, setPrintBundleCode] = useState<PrintBundleCode>(defaultPrintBundleCode);
  const [coverStyle, setCoverStyle] = useState<CoverStyleCode>(defaultCoverStyle);
  const [email, setEmail] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [coverNameMode, setCoverNameMode] = useState<CoverNameMode>("same");
  const [copyNames, setCopyNames] = useState<string[]>([]);
  const [dedicationText, setDedicationText] = useState("");
  const [currentStep, setCurrentStep] = useState<BuilderStep>("format");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedOffer = useMemo(
    () => offerOptions[deliveryMode].find((offer) => offer.code === selectedOfferCode) ?? findOfferForMode(deliveryMode, 30),
    [deliveryMode, selectedOfferCode],
  );

  const selectedMerchOffer = getConsumerOffer(
    selectedOffer.format === "print" ? (`pdf-${selectedOffer.designs}` as OfferCode) : selectedOffer.code,
  );
  const selectedPrintBundleOption = printBundleOptions.find((option) => option.code === printBundleCode) ?? printBundleOptions[0];
  const selectedPrintBundle = {
    ...selectedPrintBundleOption,
    ...printBundleCards[selectedPrintBundleOption.code],
  };
  const computedSubtotalCents =
    deliveryMode === "print"
      ? getOfferSubtotalForQuantity(selectedOffer, {
          quantity: selectedPrintBundleOption.quantity,
          bundleSelection: printBundleCode,
        })
      : selectedOffer.subtotalCents;

  const steps = useMemo<BuilderStep[]>(
    () => (deliveryMode === "print" ? ["format", "pages", "pack", "cover", "details", "review"] : ["format", "pages", "cover", "details", "review"]),
    [deliveryMode],
  );

  useEffect(() => {
    if (!steps.includes(currentStep)) {
      setCurrentStep("format");
    }
  }, [currentStep, steps]);

  useEffect(() => {
    setCopyNames((previous) => Array.from({ length: selectedPrintBundle.quantity }, (_, index) => previous[index] ?? ""));
  }, [selectedPrintBundle.quantity]);

  useEffect(() => {
    if (coverNameMode !== "different") {
      return;
    }

    setCopyNames((previous) =>
      Array.from({ length: selectedPrintBundle.quantity }, (_, index) => {
        if (previous[index]) {
          return previous[index]!;
        }

        return index === 0 && childFirstName.trim() ? childFirstName.trim() : "";
      }),
    );
  }, [childFirstName, coverNameMode, selectedPrintBundle.quantity]);

  const currentStepIndex = Math.max(0, steps.indexOf(currentStep));

  const resolvedCopyNames =
    deliveryMode === "print" && selectedPrintBundle.quantity > 1
      ? coverNameMode === "different"
        ? Array.from({ length: selectedPrintBundle.quantity }, (_, index) => {
            const value = copyNames[index]?.trim();
            return value ? value : null;
          })
        : Array.from({ length: selectedPrintBundle.quantity }, () => {
            const value = childFirstName.trim();
            return value ? value : null;
          })
      : null;

  function goToStep(step: BuilderStep) {
    if (steps.includes(step)) {
      setCurrentStep(step);
      setErrorMessage(null);
    }
  }

  function goToPreviousStep() {
    const previousStep = steps[currentStepIndex - 1];

    if (previousStep) {
      setCurrentStep(previousStep);
      setErrorMessage(null);
    }
  }

  function handleModeSelect(nextMode: DeliveryMode) {
    const mappedOffer = findOfferForMode(nextMode, selectedOffer.designs);
    setDeliveryMode(nextMode);
    setSelectedOfferCode(mappedOffer.code);
    setErrorMessage(null);
    trackEvent("builder_mode_selected", {
      deliveryMode: nextMode,
      selectedOffer: mappedOffer.code,
      designCount: mappedOffer.designs,
    });
    goToStep("pages");
  }

  function handlePageSelect(nextOfferCode: OfferCode) {
    const nextOffer = getOfferByCode(nextOfferCode);
    setSelectedOfferCode(nextOffer.code as OfferCode);
    setErrorMessage(null);
    trackEvent("builder_offer_selected", {
      deliveryMode,
      selectedOffer: nextOffer.code,
      designCount: nextOffer.designs,
    });
    goToStep(deliveryMode === "print" ? "pack" : "cover");
  }

  function handleBundleSelect(nextBundleCode: PrintBundleCode) {
    const nextBundle = printBundleOptions.find((option) => option.code === nextBundleCode) ?? printBundleOptions[0];
    setPrintBundleCode(nextBundleCode);
    setCoverNameMode("same");
    setErrorMessage(null);
    trackEvent("builder_bundle_selected", {
      selectedOffer: selectedOffer.code,
      bundleSelection: nextBundleCode,
      quantity: nextBundle.quantity,
    });
    goToStep("cover");
  }

  function handleCoverStyleSelect(nextCoverStyle: CoverStyleCode) {
    setCoverStyle(nextCoverStyle);
    setErrorMessage(null);
    trackEvent("builder_cover_style_selected", {
      selectedOffer: selectedOffer.code,
      deliveryMode,
      coverStyle: nextCoverStyle,
    });
    goToStep("details");
  }

  function handleDetailsContinue() {
    if (!email.trim()) {
      setErrorMessage("Enter your email so we can keep the book and the uploads tied to the right inbox.");
      return;
    }

    goToStep("review");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (currentStep !== "review") {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          orderType: deliveryMode,
          deliveryMode,
          selectedOffer: selectedOffer.code,
          designCount: selectedOffer.designs,
          bundleSelection: deliveryMode === "print" ? printBundleCode : null,
          quantity: deliveryMode === "print" ? selectedPrintBundle.quantity : 1,
          coverStyle,
          copyNames: resolvedCopyNames,
          childFirstName,
          dedicationText,
        }),
      });

      const payload = await readApiPayload<CreateOrderResponse & { error?: string }>(response);

      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "We couldn't save your book yet. Please try again.");
      }

      trackEvent("order_draft_created", {
        deliveryMode,
        selectedOffer: selectedOffer.code,
        designCount: selectedOffer.designs,
        coverStyle,
      });

      const nextUrl = new URL("/create/uploads", window.location.origin);
      nextUrl.searchParams.set("orderId", payload.id);
      nextUrl.searchParams.set("deliveryMode", deliveryMode);
      nextUrl.searchParams.set("selectedOffer", selectedOffer.code);
      router.push(nextUrl.pathname + "?" + nextUrl.searchParams.toString());
    } catch (error) {
      trackEvent("order_draft_failed", {
        deliveryMode,
        selectedOffer: selectedOffer.code,
        coverStyle,
      });
      setErrorMessage(error instanceof Error ? error.message : "We couldn't start your book. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const coverStyleCard = coverStyleCards[coverStyle];
  const summaryItems = [
    {
      label: "Format",
      value: formatCards[deliveryMode].label,
    },
    {
      label: "Pages",
      value: `${selectedOffer.designs} pages`,
    },
    ...(deliveryMode === "print"
      ? [
          {
            label: "Pack",
            value: `${selectedPrintBundle.quantity} printed ${selectedPrintBundle.quantity === 1 ? "copy" : "copies"}`,
          },
        ]
      : []),
    {
      label: "Cover",
      value: coverStyleCard.title,
    },
  ];
  const previousStep = steps[currentStepIndex - 1] ?? null;
  const nextStep = steps[currentStepIndex + 1] ?? null;

  const stepContent: Record<
    BuilderStep,
    {
      description: string;
      title: string;
    }
  > = {
    format: {
      title: "First, how do you want it to arrive?",
      description: "Pick the version that fits tonight. The rest of the builder will adapt around that choice.",
    },
    pages: {
      title: "How many pages do you want in the book?",
      description: "Choose the size that fits your camera roll. You will upload that many photos on the next step.",
    },
    pack: {
      title: "Do you want just one printed copy or a bigger pack?",
      description: "If you want sibling copies or grandparent gifts, lock them in now while the pages only need to be made once.",
    },
    cover: {
      title: "Which cover mood fits this book best?",
      description: "Pick the cover mood that fits the memories inside.",
    },
    details: {
      title: "Who is this book for?",
      description: "Add the email we should keep the order under, plus the cover name and optional dedication.",
    },
    review: {
      title: "Quick review before photo upload.",
      description: "Make sure the format, size, pack, and cover direction all feel right before you move into the photo step.",
    },
  };

  return (
    <section className="builder-card">
      <div className="builder-progress-shell">
        <div className="builder-progress-top">
          <div className="builder-progress-side builder-progress-side-left">
            {previousStep ? (
              <button className="builder-progress-link" type="button" onClick={goToPreviousStep}>
                <span aria-hidden="true">←</span>
                <strong>{stepLabels[previousStep]}</strong>
              </button>
            ) : (
              <span className="builder-progress-placeholder builder-progress-placeholder-left">
                <strong>Free sample</strong>
              </span>
            )}
          </div>
          <div className="builder-progress-current">
            <span className="builder-progress-count">
              {currentStepIndex + 1}/{steps.length}
            </span>
            <strong>{stepLabels[currentStep]}</strong>
          </div>
          <div className="builder-progress-side builder-progress-side-right">
            {currentStep === "details" ? (
              <button className="builder-progress-action" type="button" onClick={handleDetailsContinue}>
                <strong>Review</strong>
                <span aria-hidden="true">→</span>
              </button>
            ) : currentStep === "review" ? (
              <button className="builder-progress-action" disabled={isSubmitting} form={formId} type="submit">
                <strong>{isSubmitting ? "Saving..." : "Uploads"}</strong>
                <span aria-hidden="true">→</span>
              </button>
            ) : nextStep ? (
              <span className="builder-progress-placeholder">
                <strong>{stepLabels[nextStep]}</strong>
                <span aria-hidden="true">→</span>
              </span>
            ) : (
              <span className="builder-progress-placeholder" />
            )}
          </div>
        </div>
        <div aria-hidden="true" className="builder-progress-track">
          <span style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <form className="upload-stack" id={formId} onSubmit={handleSubmit}>
        <div className="builder-step-intro">
          <h1>{stepContent[currentStep].title}</h1>
          <p className="lede">{stepContent[currentStep].description}</p>
        </div>

        {currentStep === "format" ? (
          <div className="toggle-row toggle-row-rich">
            {(["pdf", "print"] as const).map((mode) => {
              const card = formatCards[mode];
              const isActive = deliveryMode === mode;
              return (
                <button className={isActive ? "active" : undefined} key={mode} type="button" onClick={() => handleModeSelect(mode)}>
                  <span className={`pill ${mode === "pdf" ? "pill-sky" : "pill-coral"}`}>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                </button>
              );
            })}
          </div>
        ) : null}

        {currentStep === "pages" ? (
          <div className={`offer-switch offer-switch-rich ${deliveryMode === "pdf" ? "offer-switch-products-pdf" : "offer-switch-products-print"}`}>
            {offerOptions[deliveryMode].map((offer) => {
              const merchOffer = getConsumerOffer(offer.format === "print" ? (`pdf-${offer.designs}` as OfferCode) : offer.code);
              const isActive = offer.code === selectedOffer.code;

              return (
                <button key={offer.code} className={isActive ? "active" : undefined} type="button" onClick={() => handlePageSelect(offer.code as OfferCode)}>
                  {merchOffer.badge ? <span className={`pill pill-${merchOffer.badgeTone ?? "sun"}`}>{merchOffer.badge}</span> : null}
                  <strong>{merchOffer.title}</strong>
                  <p>{deliveryMode === "print" ? `Spiral Book $${offer.subtotalCents / 100}` : `PDF $${offer.subtotalCents / 100}`}</p>
                  <p>{merchOffer.description}</p>
                  <p className="offer-meta">
                    Upload {offer.designs} photos
                    {merchOffer.comparisonNote ? ` · ${merchOffer.comparisonNote}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        ) : null}

        {currentStep === "pack" && deliveryMode === "print" ? (
          <div className="offer-switch offer-switch-rich offer-switch-bundles">
            {printBundleOptions.map((bundleOption) => {
              const bundle = {
                ...bundleOption,
                ...printBundleCards[bundleOption.code],
              };
              const isActive = printBundleCode === bundleOption.code;
              const bundleSubtotal = getOfferSubtotalForQuantity(selectedOffer, {
                quantity: bundleOption.quantity,
                bundleSelection: bundleOption.code,
              });

              return (
                <button key={bundleOption.code} className={isActive ? "active" : undefined} type="button" onClick={() => handleBundleSelect(bundleOption.code)}>
                  <span className="pill pill-mint">{bundle.label}</span>
                  <strong>{bundle.title}</strong>
                  <p>{bundle.description}</p>
                  <p className="offer-meta">{formatMoney(bundleSubtotal)} before shipping</p>
                </button>
              );
            })}
          </div>
        ) : null}

        {currentStep === "cover" ? (
          <div className="cover-style-grid">
            {(Object.entries(coverStyleCards) as Array<[CoverStyleCode, (typeof coverStyleCards)[CoverStyleCode]]>).map(([styleCode, style]) => {
              const isActive = coverStyle === styleCode;

              return (
                <button
                  key={styleCode}
                  className={`cover-style-card ${style.toneClass}${isActive ? " active" : ""}`}
                  type="button"
                  onClick={() => handleCoverStyleSelect(styleCode)}
                >
                  <span className="pill pill-sun">{style.label}</span>
                  <strong>{style.title}</strong>
                  <p>{style.description}</p>
                </button>
              );
            })}
          </div>
        ) : null}

        {currentStep === "details" ? (
          <div className="upload-stack">
            <div className="surface selection-summary">
              <span className="pill pill-coral">{coverStyleCard.title}</span>
              <h3>{selectedMerchOffer.title}</h3>
              <p className="muted">
                {deliveryMode === "print"
                  ? `${selectedPrintBundle.quantity} printed ${selectedPrintBundle.quantity === 1 ? "copy" : "copies"} plus the PDF download`
                  : "Printable PDF ready as soon as the pages are finished"}
              </p>
              <p className="mini-note">You will upload {selectedOffer.designs} photos right after this step.</p>
            </div>

            {deliveryMode === "print" && selectedPrintBundle.quantity > 1 ? (
              <div className="upload-stack">
                <div className="stack-tight">
                  <strong>Do you want the same cover name on every copy?</strong>
                  <p className="muted">Use one name on every book, or personalize each printed copy separately.</p>
                </div>
                <div className="toggle-row">
                  <button
                    className={coverNameMode === "same" ? "active" : undefined}
                    type="button"
                    onClick={() => setCoverNameMode("same")}
                  >
                    <span className="pill pill-sky">Same on every copy</span>
                    <strong>One cover name</strong>
                    <p>Best when every printed book should match.</p>
                  </button>
                  <button
                    className={coverNameMode === "different" ? "active" : undefined}
                    type="button"
                    onClick={() => setCoverNameMode("different")}
                  >
                    <span className="pill pill-coral">Different names</span>
                    <strong>Personalize each copy</strong>
                    <p>Useful for siblings, grandparents, or gifting multiple versions.</p>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="form-grid">
              <label>
                <span className="muted">Email</span>
                <input
                  autoComplete="email"
                  className="input"
                  name="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {!(deliveryMode === "print" && selectedPrintBundle.quantity > 1 && coverNameMode === "different") ? (
                <label>
                  <span className="muted">
                    {deliveryMode === "print" && selectedPrintBundle.quantity > 1 && coverNameMode === "same"
                      ? "Name on every cover"
                      : "Name on the cover"}
                  </span>
                  <input
                    autoComplete="given-name"
                    className="input"
                    name="childFirstName"
                    placeholder="Mila"
                    value={childFirstName}
                    onChange={(event) => setChildFirstName(event.target.value)}
                  />
                </label>
              ) : null}
            </div>

            {deliveryMode === "print" && selectedPrintBundle.quantity > 1 && coverNameMode === "different" ? (
              <div className="form-grid">
                {Array.from({ length: selectedPrintBundle.quantity }, (_, index) => (
                  <label key={`copy-name-${index + 1}`}>
                    <span className="muted">Copy {index + 1} cover name</span>
                    <input
                      autoComplete="given-name"
                      className="input"
                      placeholder={index === 0 ? "Mila" : `Copy ${index + 1} name`}
                      value={copyNames[index] ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCopyNames((previous) => {
                          const next = [...previous];
                          next[index] = nextValue;
                          return next;
                        });

                        if (index === 0) {
                          setChildFirstName(nextValue);
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
            ) : null}

            <label>
              <span className="muted">Dedication (optional)</span>
              <textarea
                className="textarea"
                name="dedicationText"
                placeholder="For rainy afternoons, birthday mornings, and grandma visits."
                value={dedicationText}
                onChange={(event) => setDedicationText(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {currentStep === "review" ? (
          <div className="builder-review-grid">
            <div className="surface selection-summary">
              <span className={`pill ${deliveryMode === "print" ? "pill-coral" : "pill-sky"}`}>{formatCards[deliveryMode].label}</span>
              <h3>{selectedMerchOffer.title}</h3>
              <p className="muted">{selectedMerchOffer.description}</p>
              <ul className="feature-list">
                <li>{deliveryMode === "print" ? `${selectedPrintBundle.quantity} printed ${selectedPrintBundle.quantity === 1 ? "copy" : "copies"} plus the PDF download` : "Printable PDF ready as soon as the pages are finished"}</li>
                <li>{coverStyleCard.title} selected for the cover direction</li>
                <li>
                  {deliveryMode === "print" && resolvedCopyNames?.some((value) => value)
                    ? `Cover names: ${resolvedCopyNames.map((value, index) => value ?? `Copy ${index + 1} left blank`).join(" • ")}`
                    : childFirstName
                      ? `${childFirstName}'s name appears on the cover`
                      : "You can still leave the cover name blank"}
                </li>
                <li>{email || "Your email will be attached to this order"}</li>
              </ul>
              <p className="offer-meta">{deliveryMode === "print" ? `${formatMoney(computedSubtotalCents)} before shipping` : selectedOffer.priceLabel}</p>
            </div>

            <div className="surface builder-review-note">
              <span className="pill pill-mint">What happens next</span>
              <h3>Next comes photo upload.</h3>
              <p className="muted">
                After you confirm this setup, you will upload the photos for the book. PDF orders move straight into page-making. Spiral books move into delivery and checkout after upload.
              </p>
              <div className="builder-review-list">
                {summaryItems.map((item) => (
                  <div className="builder-review-line" key={item.label}>
                    <span className="muted">{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
                {childFirstName && !(deliveryMode === "print" && coverNameMode === "different" && selectedPrintBundle.quantity > 1) ? (
                  <div className="builder-review-line">
                    <span className="muted">Cover name</span>
                    <strong>{childFirstName}</strong>
                  </div>
                ) : null}
                {deliveryMode === "print" && resolvedCopyNames?.some((value, index) => value && value !== resolvedCopyNames[0] && index > 0)
                  ? resolvedCopyNames.map((value, index) => (
                      <div className="builder-review-line" key={`review-copy-${index + 1}`}>
                        <span className="muted">Copy {index + 1}</span>
                        <strong>{value ?? "Blank cover name"}</strong>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </div>
        ) : null}

        {errorMessage ? <div className="status-banner status-banner-warning">{errorMessage}</div> : null}
      </form>
    </section>
  );
}
