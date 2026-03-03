import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://klepka.solutions';
const SITE_NAME = 'Klepka';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: object | object[];
  noindex?: boolean;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  canonicalPath = '/',
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  jsonLd,
  noindex = false,
}) => {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;

  const schemas = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD Structured Data */}
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};
