import { Helmet } from 'react-helmet-async';

/*
 * Shared marketing SEO tags: title, description, canonical, and Open Graph.
 * Canonical/OG URLs resolve against VITE_SITE_URL so they stay absolute in
 * production; the localhost fallback keeps dev links working.
 */

const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  'http://localhost:5173'
).replace(/\/$/, '');

type SeoProps = {
  title: string;
  description: string;
  /** Site-root-relative path for this page, e.g. `/` or `/about`. */
  path: string;
  ogImage?: string;
};

export function Seo({ title, description, path, ogImage }: SeoProps) {
  const canonical = `${SITE_URL}${path}`;
  const image = ogImage ? `${SITE_URL}${ogImage}` : undefined;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Marty Global LLC" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      {image && <meta property="og:image" content={image} />}
    </Helmet>
  );
}
