import { SITE } from '../data/site';

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function serviceSchema(opts: { name: string; description: string; path: string; serviceType?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType ?? opts.name,
    description: opts.description,
    url: new URL(opts.path, SITE.url).href,
    provider: { '@id': `${SITE.url}/#negocio` },
    areaServed: [
      { '@type': 'City', name: 'Mérida, Venezuela' },
      { '@type': 'Country', name: 'Venezuela' },
    ],
  };
}
