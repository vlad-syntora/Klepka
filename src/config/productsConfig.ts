import flowToolkitImg from '../assets/Optimisation.png';

/**
 * AppExchange listing IDs for published Klepka products.
 * All display data is fetched at runtime from:
 * GET https://api.appexchange.salesforce.com/partners/experience/listings/{id}
 */
export const productsListingIds: string[] = [
  'a0N3A00000EvaSKUAZ',
  'a0N30000004e3VUEAY',
  'a0N30000004gI1hEAE',
  '9bbf17ec-e4cb-4a4d-9273-a14a356a7d7c',
];

export interface ComingSoonProduct {
  id: string;
  name: string;
  shortDescription: string;
  tags: string[];
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
    id: 'flow-toolkit',
    name: 'Flow Toolkit',
    shortDescription: 'Reusable Flow components and templates for common Salesforce automation patterns.',
    tags: ['Flow', 'Automation', 'Admin'],
    image: flowToolkitImg,
    releaseDate: 'Q4 2026',
  },
];
