export type PricingSpotlightCardContent = {
  title: string;
  subtitle: string;
  whatsIncluded: string[];
  whatYouGet: string[];
  whoThisIsFor: string;
  whoThisIsNotFor: string;
  buttonLabel: string;
};

export const pricingSpotlightConfig: PricingSpotlightCardContent[] = [
  {
    title: "Not sure what’s wrong with your Salesforce? Let’s talk.",
    subtitle:
      "Book a 30-minute call to clarify your problem and define the next steps.",
    whatsIncluded: [
      "Review your current setup (high-level)",
      "Identify key risks and blockers",
      "Get a clear direction forward",
    ],
    whatYouGet: [
      "Clear problem definition",
      "Identified risks (high-level)",
      "Recommended direction",
      "Short written summary after the call",
      "No generic advice",
      "Discount if you proceed with us",
    ],
    whoThisIsFor:
      "You already use Salesforce but something doesn’t feel right.",
    whoThisIsNotFor:
      "You expect a full system audit or deep technical analysis.",
    buttonLabel: "Book a free 30-minute consultation",
  },
  {
    title: "Not sure what’s wrong with your Salesforce? Let’s talk.",
    subtitle:
      "Understand your next steps in 30 minutes.",
    whatsIncluded: [
      "Review your current setup (high-level)",
      "Identify key risks and blockers",
      "Get a clear direction forward",
    ],
    whatYouGet: [
      "Clear problem definition",
      "Identified risks (high-level)",
      "Recommended direction",
      "Short written summary after the call",
      "No generic advice",
      "Discount if you proceed with us",
    ],
    whoThisIsFor:
      "You’re unsure what the actual problem is.",
    whoThisIsNotFor:
      "You want immediate implementation or development work.",
    buttonLabel: "Talk to an expert",
  },
  {
    title: "Get clarity before making changes.",
    subtitle:
      "No sales pitch - just a structured look at your system.",
    whatsIncluded: [
      "Review your current setup (high-level)",
      "Identify key risks and blockers",
      "Get a clear direction forward",
    ],
    whatYouGet: [
      "Clear problem definition",
      "Identified risks (high-level)",
      "Recommended direction",
      "Short written summary after the call",
      "No generic advice",
      "Discount if you proceed with us",
    ],
    whoThisIsFor:
      "You want a second opinion before making changes.",
    whoThisIsNotFor:
      "You’re looking for a detailed solution during the call.",
    buttonLabel: "Book a free 30-minute consultation",
  },
  {
    title: "Discuss your Salesforce challenges with an expert.",
    subtitle:
      "This is a focused 30-minute call, not a full audit.",
    whatsIncluded: [
      "Review your current setup (high-level)",
      "Identify key risks and blockers",
      "Get a clear direction forward",
    ],
    whatYouGet: [
      "Clear problem definition",
      "Identified risks (high-level)",
      "Recommended direction",
      "Short written summary after the call",
      "No generic advice",
      "Discount if you proceed with us",
    ],
    whoThisIsFor:
      "You need help understanding where to focus next.",
    whoThisIsNotFor:
      "You expect guarantees or exact estimates on the spot.",
    buttonLabel: "Talk to an expert",
  },
];