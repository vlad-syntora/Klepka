import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Star, ExternalLink, Package, Loader2 } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { productsListingIds } from '../../config/productsConfig';

// ---------------------------------------------------------------------------
// API types (AppExchange REST API)
// ---------------------------------------------------------------------------

interface AppExchangeListing {
  tzId: string;
  name: string;
  title: string;
  description: string;
  publisher: {
    name: string;
    website?: string;
  };
  extensions?: Array<{
    listingCategories?: string[];
  }>;
  reviewsSummary?: {
    averageRating: number;
    reviewCount: number;
  };
}

const LISTINGS_API = 'https://api.appexchange.salesforce.com/partners/experience/listings';
const APPEXCHANGE_URL = 'https://appexchange.salesforce.com/appxListingDetail?listingId=';

async function fetchListing(id: string): Promise<AppExchangeListing> {
  const res = await fetch(`${LISTINGS_API}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch listing ${id}: ${res.status}`);
  return res.json() as Promise<AppExchangeListing>;
}

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
    {Array.from({ length: 5 }).map((_, i) => {
      const fill = Math.min(1, Math.max(0, rating - i));
      if (fill >= 1) {
        return <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />;
      }
      if (fill > 0) {
        return (
          <span key={i} className="relative w-4 h-4 inline-block">
            <Star className="w-4 h-4 text-gray-300 absolute inset-0" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      }
      return <Star key={i} className="w-4 h-4 text-gray-300" />;
    })}
  </div>
);

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

const ProductCard: React.FC<{ listing: AppExchangeListing; index: number }> = ({
  listing,
  index,
}) => {
  const tags = listing.extensions?.[0]?.listingCategories ?? [];
  const rating = listing.reviewsSummary?.averageRating ?? 0;
  const reviewCount = listing.reviewsSummary?.reviewCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="bg-white border border-border-color rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col"
    >
      {/* Image placeholder */}
      <div className="w-full aspect-video bg-gradient-to-br from-violet/10 to-violet/5 flex items-center justify-center">
        <Package className="w-12 h-12 text-violet/25" />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        {/* Developer */}
        <p className="text-xs text-grey mb-1.5">By {listing.publisher.name}</p>

        {/* Name */}
        <h3 className="text-lg font-semibold text-gray-900 leading-snug mb-2 line-clamp-2">
          {listing.title || listing.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <StarRating rating={rating} />
          {hasRating ? (
            <>
              <span className="text-sm font-semibold text-gray-800">
                {rating.toFixed(2)}
              </span>
              <span className="text-sm text-grey">
                ({reviewCount.toLocaleString()})
              </span>
            </>
          ) : (
            <span className="text-xs text-grey">No reviews yet</span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-grey leading-relaxed flex-1 mb-4 line-clamp-3">
          {listing.description}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-violet/8 text-violet px-2.5 py-0.5 rounded-full border border-violet/15"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <a
          href={`${APPEXCHANGE_URL}${listing.tzId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto flex items-center justify-center gap-2 bg-violet text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet/90 active:scale-95 transition-all"
        >
          View on AppExchange
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </motion.article>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const Products: React.FC = () => {
  const [listings, setListings] = useState<AppExchangeListing[]>([]);
  const [loading, setLoading] = useState(productsListingIds.length > 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productsListingIds.length === 0) return;

    Promise.all(productsListingIds.map(fetchListing))
      .then(setListings)
      .catch(() => setError('Failed to load products. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': 'https://klepka.solutions/products#webpage',
    name: 'Our Products — Klepka',
    description:
      'Salesforce AppExchange products developed by Klepka — certified Salesforce consultants building tools for admins, developers, and business teams.',
    url: 'https://klepka.solutions/products',
    isPartOf: { '@id': 'https://klepka.solutions/#website' },
    about: { '@id': 'https://klepka.solutions/#organization' },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.products-intro'],
    },
  };

  return (
    <>
      <SEOHead
        title="Our Products — Klepka"
        description="Salesforce AppExchange products built by Klepka — certified administrators, consultants and architects."
        canonicalPath="/products"
        jsonLd={pageJsonLd}
      />

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <p className="text-sm font-medium text-violet uppercase tracking-widest mb-3">
              AppExchange
            </p>
            <h1 className="text-4xl sm:text-5xl font-light text-violet leading-tight mb-4">
              Our Products
            </h1>
            <p className="products-intro text-lg text-grey leading-relaxed">
              Tools we built for the Salesforce ecosystem — by certified admins, architects, and
              consultants who know the platform inside out.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products grid */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-24 gap-3 text-grey">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading products…</span>
            </div>
          )}

          {error && (
            <p className="text-center text-red-500 py-24">{error}</p>
          )}

          {!loading && !error && listings.length === 0 && (
            <p className="text-grey text-center py-24">No products available yet.</p>
          )}

          {!loading && !error && listings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing, index) => (
                <ProductCard key={listing.tzId} listing={listing} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-light text-accent-yellow mb-2">
              Have a product idea?
            </h2>
            <p className="text-off-white/70 max-w-lg">
              We turn Salesforce pain-points into polished AppExchange products. Let's talk about
              building something together.
            </p>
          </div>
          <a
            href="mailto:hello@klepka.solutions"
            className="flex-shrink-0 bg-white text-violet hover:bg-accent-yellow transition-colors font-medium px-6 py-3 rounded-xl"
          >
            Get in touch
          </a>
        </div>
      </section>
    </>
  );
};
