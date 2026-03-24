/**
 * AppExchange listing IDs for published Klepka products.
 * All display data is fetched at runtime from:
 * GET https://api.appexchange.salesforce.com/partners/experience/listings/{id}
 */
export const productsListingIds: string[] = [];
import FlowEmailComposerLogo from '../assets/products/FlowEmailComposerLogo.png';
import RecordPhotoComponentLogo from '../assets/products/RecordPhotoComponent.png';
import URMLogo from '../assets/products/urmLogo.png';


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
     tags: ['Flow', 'Automation', 'Admin', 'Email', 'Email-to-Case'],
     status: 'In QA',
     haveDocumentation: true,
     documentationPageSrc: '/fec',
     image: FlowEmailComposerLogo,
     releaseDate: 'Q2 2026',
   },
   {
     id: 'Record-Photo-Logo-Component-for-Salesforce',
     name: 'Record Photo & Logo Component for Salesforce',
     shortDescription: 'Add profile photos and logos to any Salesforce record with a simple drag & drop component for Lightning App Builder.',
     tags: ['UI', 'Record Logo', 'Record Icon',  'Lightning App Builder', 'Admin' ],
     status: 'In QA',
     haveDocumentation: true,
     documentationPageSrc: '/rplc',
     image: RecordPhotoComponentLogo,
     releaseDate: 'Q2 2026',
   },
   {
     id: 'universal-record-merge',
     name: 'Universal Record Merge',
     shortDescription: '',
     tags: ['UI', 'De-Duplication', 'Data Quality', 'Admin' ],
     status: 'In Implementation',
     haveDocumentation: false,
     documentationPageSrc: '',
     image: URMLogo,
     releaseDate: 'Q2 2026',
   },
];
