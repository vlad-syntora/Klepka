import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Star, ExternalLink, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '../components/SEOHead';
import { Input, TextArea } from '../components/Input';
import { sendEmailJsForm } from '../lib/emailjs';
import { productsListingIds, comingSoonProducts, type ComingSoonProduct } from '../../config/productsConfig';

// ---------------------------------------------------------------------------
// API types (AppExchange REST API)
// ---------------------------------------------------------------------------

interface PricingPlan {
  price: number;
  currency_code: string;
  frequency: string;
  units: string;
  lowest_starting_price?: boolean;
}

interface Plugin {
  pluginType: string;
  data: {
    items?: Array<{
      mediaId?: string;
      logoType?: string;
      type?: string;
      data?: { mediaId?: string; altText?: string };
    }>;
  };
}

interface BusinessNeedSection {
  categories: string[];
  isSelected: boolean;
}

interface AppExchangeListing {
  tzId: string;
  name: string;
  title: string;
  description: string;
  publisher: {
    name: string;
    logoUrl?: string;
  };
  plugins?: Plugin[];
  businessNeeds?: Record<string, BusinessNeedSection>;
  reviewsSummary?: {
    averageRating: number;
    reviewCount: number;
  };
  pricing?: {
    price_model_type: string;
    model?: {
      plans?: PricingPlan[];
    };
  };
}

function extractLogoUrl(plugins?: Plugin[]): string | null {
  const logoSet = plugins?.find((p) => p.pluginType === 'listing/plugins/LogoSet');
  if (!logoSet?.data?.items) return null;
  const preferred = logoSet.data.items.find((i) => i.logoType === 'Logo');
  const fallback = logoSet.data.items.find((i) => i.mediaId?.startsWith('https'));
  return (preferred ?? fallback)?.mediaId ?? null;
}

/** camelCase → Title Case: "contractManagement" → "Contract Management" */
function formatCategory(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function extractCategories(businessNeeds?: Record<string, BusinessNeedSection>): string[] {
  if (!businessNeeds) return [];
  return Object.values(businessNeeds).flatMap((section) =>
    section.categories.map(formatCategory),
  );
}

const APPEXCHANGE_URL = 'https://appexchange.salesforce.com/appxListingDetail?listingId=';

async function fetchListing(id: string): Promise<AppExchangeListing> {
  const res = await fetch(`/api/listings/${id}`);
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
  const tags = extractCategories(listing.businessNeeds);
  const rating = listing.reviewsSummary?.averageRating ?? 0;
  const reviewCount = listing.reviewsSummary?.reviewCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;

  const logoUrl = extractLogoUrl(listing.plugins);

  const isFree = listing.pricing?.price_model_type === 'free';
  const startingPlan = listing.pricing?.model?.plans?.find((p) => p.lowest_starting_price)
    ?? listing.pricing?.model?.plans?.[0];
  const priceLabel = isFree
    ? 'Free'
    : startingPlan
      ? `From $${startingPlan.price} / ${startingPlan.units === 'user' ? 'user / ' : ''}${startingPlan.frequency === 'monthly' ? 'mo' : startingPlan.frequency}`
      : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="bg-white border border-border-color rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col"
    >
      {/* Logo / image */}
      <div className="w-full aspect-video bg-gradient-to-br from-violet/10 to-violet/5 flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={listing.title || listing.name}
            className="w-full h-full object-contain p-6"
            loading="lazy"
          />
        ) : (
          <Package className="w-12 h-12 text-violet/25" />
        )}
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

        {/* Price */}
        {priceLabel && (
          <p className={`text-sm font-semibold mb-3 ${isFree ? 'text-green-600' : 'text-violet'}`}>
            {priceLabel}
          </p>
        )}

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
// Coming soon card
// ---------------------------------------------------------------------------

const ComingSoonCard: React.FC<{ product: ComingSoonProduct; index: number }> = ({
  product,
  index,
}) => (
  <motion.article
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay: index * 0.08 }}
    className="bg-white border border-dashed border-border-color rounded-2xl overflow-hidden flex flex-col opacity-75"
  >
    {/* Image area */}
    <div className="w-full aspect-video bg-gradient-to-br from-grey/8 to-grey/4 flex items-center justify-center overflow-hidden">
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-contain p-6 grayscale opacity-60"
          loading="lazy"
        />
      ) : (
        <Package className="w-12 h-12 text-grey/30" />
      )}
    </div>

    {/* Content */}
    <div className="flex flex-col flex-1 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold bg-grey/10 text-grey px-2.5 py-1 rounded-full uppercase tracking-wide">
          Coming Soon
        </span>
        {product.releaseDate && (
          <span className="text-xs text-grey">{product.releaseDate}</span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-700 leading-snug mb-2">
        {product.name}
      </h3>

      <p className="text-sm text-grey leading-relaxed flex-1 mb-4 line-clamp-3">
        {product.shortDescription}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {product.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs bg-grey/8 text-grey px-2.5 py-0.5 rounded-full border border-grey/15"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  </motion.article>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const Products: React.FC = () => {
  const [listings, setListings] = useState<AppExchangeListing[]>([]);
  const [loading, setLoading] = useState(productsListingIds.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await sendEmailJsForm(e.currentTarget);
      toast.success('Message sent!', { description: 'We will get back to you shortly.' });
      e.currentTarget.reset();
      setFormSent(true);
    } catch {
      toast.error("Couldn't send the message", { description: 'Please try again in a moment.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (productsListingIds.length === 0) return;

    Promise.all(productsListingIds.map(fetchListing))
      .then(setListings)
      .catch(() => setError('Failed to load products. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

  const softwareSchemas = listings.map((l) => {
    const isFree = l.pricing?.price_model_type === 'free';
    const plan = l.pricing?.model?.plans?.find((p) => p.lowest_starting_price)
      ?? l.pricing?.model?.plans?.[0];
    const categories = extractCategories(l.businessNeeds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `https://klepka.solutions/products#${l.tzId}`,
      name: l.title || l.name,
      description: l.description,
      url: `${APPEXCHANGE_URL}${l.tzId}`,
      applicationCategory: categories[0] ?? 'BusinessApplication',
      operatingSystem: 'Salesforce',
      author: {
        '@type': 'Organization',
        '@id': 'https://klepka.solutions/#organization',
        name: l.publisher.name,
      },
      offers: isFree
        ? { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        : plan
          ? {
              '@type': 'Offer',
              price: String(plan.price),
              priceCurrency: plan.currency_code,
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: plan.price,
                priceCurrency: plan.currency_code,
                unitText: plan.frequency === 'monthly' ? 'MON' : plan.frequency.toUpperCase(),
                referenceQuantity: { '@type': 'QuantitativeValue', value: '1', unitText: plan.units },
              },
            }
          : undefined,
    };

    if (l.reviewsSummary && l.reviewsSummary.reviewCount > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: l.reviewsSummary.averageRating,
        reviewCount: l.reviewsSummary.reviewCount,
        bestRating: '5',
        worstRating: '1',
      };
    }

    return schema;
  });

  const itemListSchema = listings.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': 'https://klepka.solutions/products#list',
    name: 'Klepka Salesforce AppExchange Products',
    description: 'Salesforce tools built by Klepka — certified administrators, consultants and architects.',
    numberOfItems: listings.length,
    itemListElement: listings.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${APPEXCHANGE_URL}${l.tzId}`,
      name: l.title || l.name,
    })),
  } : null;

  const pageJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': 'https://klepka.solutions/products#webpage',
      name: 'Our Products — Klepka',
      description:
        'Salesforce AppExchange products developed by Klepka — certified Salesforce consultants building tools for admins, developers, and business teams.',
      url: 'https://klepka.solutions/products',
      isPartOf: { '@id': 'https://klepka.solutions/#website' },
      about: { '@id': 'https://klepka.solutions/#organization' },
      mainEntity: itemListSchema ? { '@id': 'https://klepka.solutions/products#list' } : undefined,
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['h1', '.products-intro'],
      },
    },
    ...(itemListSchema ? [itemListSchema] : []),
    ...softwareSchemas,
  ];

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

      {/* Coming Soon */}
      {comingSoonProducts.length > 0 && (
        <section className="pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-light text-violet mb-8">Coming Soon</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {comingSoonProducts.map((product, index) => (
                <ComingSoonCard key={product.id} product={product} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left — text */}
          <div>
            <h2 className="text-2xl font-light text-accent-yellow mb-2">
              Have a product idea?
            </h2>
            <p className="text-off-white/70 max-w-lg">
              We turn Salesforce pain-points into polished AppExchange products. Let's talk about
              building something together.
            </p>
          </div>

          {/* Right — form */}
          {formSent ? (
            <div className="rounded-xl border border-white/20 bg-white/10 px-6 py-8 text-center">
              <p className="text-accent-yellow font-medium text-lg mb-1">Thank you!</p>
              <p className="text-off-white/70 text-sm">We'll be in touch soon.</p>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
              <input type="hidden" name="form_name" value="Product Idea" />
              <Input
                required
                name="full_name"
                placeholder="Name"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <Input
                required
                type="email"
                name="reply_to"
                placeholder="Email"
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <TextArea
                required
                name="message"
                placeholder="Your idea"
                rows={4}
                className="bg-card-foreground/10 text-off-white border-border-color/30"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-violet hover:bg-accent-yellow hover:text-violet transition-colors font-medium px-6 py-3 rounded-xl ring-2 ring-white/40 ring-offset-2 ring-offset-violet disabled:opacity-60"
              >
                {isSubmitting ? 'Sending…' : 'Get in touch'}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
};
