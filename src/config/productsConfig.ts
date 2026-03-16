/**
 * AppExchange listing IDs for published Klepka products.
 * All display data is fetched at runtime from:
 * GET https://api.appexchange.salesforce.com/partners/experience/listings/{id}
 */
export const productsListingIds: string[] = [];
import FlowEmailComposerLogo from '../assets/products/FlowEmailComposerLogo.png';

export interface ComingSoonProduct {
  id: string;
  name: string;
  shortDescription: string;
  tags: string[];
  /** Product lifecycle status, e.g.: 'Coming Soon' */
  status?: string;
  /** Show User Guide button on product card when true */
  haveDocumentation: boolean;
  /** User Guide URL opened from the card button */
  documentationPageSrc?: string;
  /** Imported asset, e.g.: import myImg from '../assets/myImg.png' */
  image?: string;
  /** Expected release date, e.g.: 'Q3 2025' or '2025-09-01' */
  releaseDate?: string;
}

/**
 * Products not yet published on AppExchange.
 * Data is stored here in the config (no API fetch).
 */
export const comingSoonProducts: ComingSoonProduct[] = [
  {
     id: 'flow-email-composer',
     name: 'Flow Email Composer',
     shortDescription: 'Compose and send guided emails inside Salesforce Flows with auto-filled recipients, templates, attachments, and activity logging.',
     tags: ['Flow', 'Automation', 'Admin'],
     status: 'In QA',
     haveDocumentation: true,
     documentationPageSrc: '/fec',
     image: FlowEmailComposerLogo,
     releaseDate: 'Q2 2026',
   },
];
