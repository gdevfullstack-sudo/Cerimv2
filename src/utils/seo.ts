import { useEffect } from 'react';
import { Bien, LegalTab, ReviewRecord, SearchFilters } from '../types';
import { CERIM_WHATSAPP_DISPLAY } from '../data/biens';
import { getBienUrl } from './dataHelpers';

const DEFAULT_OG_IMAGE = '/src/assets/images/hero_brazza_terrace_1794704003927.jpg';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl: string;
  ogType?: 'website' | 'product';
  ogImage?: string;
  robots?: string;
  geoPlacename?: string;
  geoPosition?: string;
  schemaGraph: Record<string, unknown>;
}

export function getBaseUrl(): string {
  if (typeof window === 'undefined' || !window.location) {
    return '/';
  }
  return `${window.location.origin}${window.location.pathname}`;
}

export function resolveAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  if (typeof window !== 'undefined' && window.location) {
    try {
      return new URL(pathOrUrl, window.location.origin).href;
    } catch {
      return pathOrUrl;
    }
  }
  return pathOrUrl;
}

function buildOrganizationNode(baseUrl: string): Record<string, unknown> {
  return {
    '@type': ['RealEstateAgent', 'LocalBusiness'],
    '@id': `${baseUrl}#organization`,
    name: 'CERIM',
    url: baseUrl,
    logo: resolveAbsoluteUrl(DEFAULT_OG_IMAGE),
    image: resolveAbsoluteUrl(DEFAULT_OG_IMAGE),
    description:
      "Plateforme congolaise de location d'appartements meublés et de voitures à Brazzaville et Pointe-Noire. Réservation sans paiement en ligne : vous payez à votre arrivée.",
    telephone: CERIM_WHATSAPP_DISPLAY.replace(/\s+/g, ''),
    currenciesAccepted: 'XAF',
    priceRange: '40 000 - 450 000 FCFA',
    availableLanguage: ['fr'],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brazzaville',
      addressRegion: 'Brazzaville',
      addressCountry: 'CG',
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Brazzaville',
        geo: {
          '@type': 'GeoCoordinates',
          latitude: -4.2634,
          longitude: 15.2429,
        },
      },
      {
        '@type': 'City',
        name: 'Pointe-Noire',
        geo: {
          '@type': 'GeoCoordinates',
          latitude: -4.7761,
          longitude: 11.8635,
        },
      },
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'reservations',
      telephone: CERIM_WHATSAPP_DISPLAY.replace(/\s+/g, ''),
      availableLanguage: ['French'],
      areaServed: 'CG',
    },
  };
}

function truncateSeoText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(schemaGraph: Record<string, unknown>) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('cerim-schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'cerim-schema-jsonld';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schemaGraph);
}

export function applySeoConfig(config: SeoConfig) {
  if (typeof document === 'undefined') return;

  const absoluteImage = resolveAbsoluteUrl(config.ogImage || DEFAULT_OG_IMAGE);
  const ogType = config.ogType || 'website';
  const robots = config.robots || 'index, follow';

  document.title = config.title;

  upsertMeta('name', 'description', config.description);
  upsertMeta('name', 'robots', robots);
  if (config.keywords) {
    upsertMeta('name', 'keywords', config.keywords);
  }
  if (config.geoPlacename) {
    upsertMeta('name', 'geo.placename', config.geoPlacename);
  }
  if (config.geoPosition) {
    upsertMeta('name', 'geo.position', config.geoPosition);
    upsertMeta('name', 'ICBM', config.geoPosition.replace(';', ', '));
  }

  upsertMeta('property', 'og:type', ogType);
  upsertMeta('property', 'og:locale', 'fr_CG');
  upsertMeta('property', 'og:site_name', 'CERIM');
  upsertMeta('property', 'og:title', config.title);
  upsertMeta('property', 'og:description', config.description);
  upsertMeta('property', 'og:url', config.canonicalUrl);
  upsertMeta('property', 'og:image', absoluteImage);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', config.title);
  upsertMeta('name', 'twitter:description', config.description);
  upsertMeta('name', 'twitter:image', absoluteImage);

  upsertCanonical(config.canonicalUrl);
  upsertJsonLd(config.schemaGraph);
}

export function usePageSeo(config: SeoConfig) {
  useEffect(() => {
    applySeoConfig(config);
  }, [config]);
}

function buildPropertySchemaNode(
  bien: Bien,
  baseUrl: string,
  availableToday: boolean,
  _publishedReviews: ReviewRecord[]
): Record<string, unknown> {
  const bienUrl = getBienUrl(bien.matricule);
  const images = bien.photos.map((p) => resolveAbsoluteUrl(p));
  const availability = availableToday
    ? 'https://schema.org/InStock'
    : 'https://schema.org/LimitedAvailability';

  const addressNode = {
    '@type': 'PostalAddress',
    streetAddress: bien.quartier,
    addressLocality: bien.ville,
    addressRegion: bien.ville,
    addressCountry: 'CG',
  };

  const geoNode = {
    '@type': 'GeoCoordinates',
    latitude: bien.localisation.lat,
    longitude: bien.localisation.lng,
  };

  const offerNode: Record<string, unknown> = {
    '@type': 'Offer',
    url: bienUrl,
    price: bien.prix,
    priceCurrency: 'XAF',
    availability,
    itemCondition: 'https://schema.org/UsedCondition',
    seller: { '@id': `${baseUrl}#organization` },
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: bien.prix,
      priceCurrency: 'XAF',
      unitText: bien.periode,
    },
    availableAtOrFrom: {
      '@type': 'Place',
      name: `${bien.quartier}, ${bien.ville}`,
      address: addressNode,
      geo: geoNode,
    },
  };

  if (bien.type === 'Appartement') {
    return {
      '@type': ['Apartment', 'Product'],
      '@id': `${bienUrl}#bien`,
      name: bien.titre,
      sku: bien.matricule,
      productID: bien.matricule,
      category: `Appartement à louer à ${bien.ville}`,
      description: bien.description,
      image: images,
      url: bienUrl,
      numberOfRooms: bien.chambres,
      floorSize: {
        '@type': 'QuantitativeValue',
        value: bien.surface,
        unitCode: 'MTK',
      },
      address: addressNode,
      geo: geoNode,
      offers: offerNode,
    };
  }

  return {
    '@type': ['Car', 'Product'],
    '@id': `${bienUrl}#bien`,
    name: bien.titre,
    sku: bien.matricule,
    productID: bien.matricule,
    category: `Voiture à louer à ${bien.ville}`,
    description: bien.description,
    image: images,
    url: bienUrl,
    brand: {
      '@type': 'Brand',
      name: bien.marque,
    },
    model: bien.modele,
    vehicleModelDate: String(bien.annee),
    vehicleTransmission: bien.boite,
    fuelType: bien.carburant,
    seatingCapacity: bien.places,
    areaServed: {
      '@type': 'City',
      name: bien.ville,
    },
    offers: offerNode,
  };
}

export function buildHomeSeoConfig(allBiens: Bien[]): SeoConfig {
  const baseUrl = getBaseUrl();
  const title = 'CERIM — Appartements & Voitures Brazzaville, Pointe-Noire';
  const description =
    'Louez un appartement meublé ou une voiture à Brazzaville et Pointe-Noire avec CERIM. Réservation sans paiement en ligne : vous payez à votre arrivée.';

  return {
    title,
    description,
    keywords:
      'location appartement Brazzaville, location voiture Brazzaville, location appartement Pointe-Noire, location 4x4 Pointe-Noire, paiement sur place Congo, CERIM',
    canonicalUrl: baseUrl,
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    geoPlacename: 'Brazzaville, Pointe-Noire',
    geoPosition: '-4.2634;15.2429',
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'WebSite',
          '@id': `${baseUrl}#website`,
          url: baseUrl,
          name: 'CERIM',
          inLanguage: 'fr-CG',
          publisher: { '@id': `${baseUrl}#organization` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${baseUrl}#/recherche?type={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'WebPage',
          '@id': `${baseUrl}#webpage`,
          url: baseUrl,
          name: title,
          description,
          inLanguage: 'fr-CG',
          isPartOf: { '@id': `${baseUrl}#website` },
        },
        {
          '@type': 'ItemList',
          name: 'Sélection d’appartements et voitures à louer à Brazzaville et Pointe-Noire',
          numberOfItems: allBiens.slice(0, 8).length,
          itemListElement: allBiens.slice(0, 8).map((b, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: `${b.titre} — ${b.quartier}, ${b.ville}`,
            url: getBienUrl(b.matricule),
          })),
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Faut-il payer en ligne pour réserver sur CERIM ?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Non. Réservation sans paiement en ligne : vous payez à votre arrivée, après vérification du bien géré par CERIM.',
              },
            },
            {
              '@type': 'Question',
              name: 'Quels types de biens peut-on louer sur CERIM ?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'CERIM propose exclusivement des appartements meublés et des voitures vérifiées (berlines et SUV 4x4) à Brazzaville et Pointe-Noire.',
              },
            },
            {
              '@type': 'Question',
              name: 'Comment suivre ma réservation et obtenir l’adresse exacte ?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Rendez-vous sur la page de suivi avec votre code CER et les 4 derniers chiffres de votre téléphone. L’adresse exacte et votre QR code d’arrivée y apparaissent dès confirmation.',
              },
            },
          ],
        },
      ],
    },
  };
}

export function buildSearchSeoConfig(filters: SearchFilters, results: Bien[]): SeoConfig {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();
  if (filters.type !== 'Tous') params.set('type', filters.type);
  if (filters.ville !== 'Toutes') params.set('ville', filters.ville);
  const query = params.toString();
  const canonicalUrl = query ? `${baseUrl}#/recherche?${query}` : `${baseUrl}#/recherche`;

  const villeLabel =
    filters.ville === 'Toutes' ? 'Brazzaville et Pointe-Noire' : filters.ville;
  const typeLabel =
    filters.type === 'Appartement'
      ? 'Appartements meublés'
      : filters.type === 'Voiture'
        ? 'Voitures et 4x4'
        : 'Appartements & Voitures';

  const title = truncateSeoText(`${typeLabel} à louer à ${villeLabel} | CERIM`, 62);
  const description = truncateSeoText(
    `${results.length} bien${results.length > 1 ? 's' : ''} géré${results.length > 1 ? 's' : ''} par CERIM (${typeLabel.toLowerCase()}) à ${villeLabel}. Disponibilité temps réel et paiement sur place à votre arrivée.`,
    158
  );

  const geoPosition =
    filters.ville === 'Pointe-Noire' ? '-4.7761;11.8635' : '-4.2634;15.2429';

  return {
    title,
    description,
    keywords: `${typeLabel.toLowerCase()} ${villeLabel}, location paiement sur place ${villeLabel}, CERIM ${villeLabel}`,
    canonicalUrl,
    ogType: 'website',
    ogImage: results[0]?.photos[0] || DEFAULT_OG_IMAGE,
    geoPlacename: villeLabel,
    geoPosition,
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'CollectionPage',
          '@id': `${canonicalUrl}#collection`,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: 'fr-CG',
          isPartOf: { '@id': `${baseUrl}#website` },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Accueil',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: `${typeLabel} — ${villeLabel}`,
              item: canonicalUrl,
            },
          ],
        },
        {
          '@type': 'ItemList',
          name: `${typeLabel} à louer à ${villeLabel}`,
          numberOfItems: results.length,
          itemListElement: results.map((b, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: getBienUrl(b.matricule),
            item: {
              '@type': b.type === 'Appartement' ? 'Apartment' : 'Car',
              name: b.titre,
              sku: b.matricule,
              image: resolveAbsoluteUrl(b.photos[0]),
              offers: {
                '@type': 'Offer',
                price: b.prix,
                priceCurrency: 'XAF',
                url: getBienUrl(b.matricule),
              },
            },
          })),
        },
      ],
    },
  };
}

export function buildBienSeoConfig(
  bien: Bien,
  availableToday: boolean,
  publishedReviews: ReviewRecord[]
): SeoConfig {
  const baseUrl = getBaseUrl();
  const canonicalUrl = getBienUrl(bien.matricule);

  const title = truncateSeoText(`${bien.titre} (${bien.ville}) | CERIM`, 62);
  const rawDescription =
    bien.type === 'Appartement'
      ? `Réservez ${bien.titre} à ${bien.quartier}, ${bien.ville} (${bien.chambres} ch., ${bien.surface} m²) dès ${bien.prix.toLocaleString('fr-FR')} FCFA/${bien.periode}. Paiement sur place, géré par CERIM.`
      : `Réservez ${bien.marque} ${bien.modele} (${bien.boite}, ${bien.carburant}) à ${bien.quartier}, ${bien.ville} dès ${bien.prix.toLocaleString('fr-FR')} FCFA/${bien.periode}. Paiement sur place, géré par CERIM.`;
  const description = truncateSeoText(rawDescription, 158);

  const keywords =
    bien.type === 'Appartement'
      ? `location appartement ${bien.quartier}, appartement ${bien.ville}, ${bien.chambres} chambres ${bien.ville}, CERIM ${bien.matricule}`
      : `location voiture ${bien.ville}, location ${bien.marque} ${bien.modele} ${bien.ville}, ${bien.quartier} ${bien.ville}, CERIM ${bien.matricule}`;

  const citySearchUrl = `${baseUrl}#/recherche?ville=${encodeURIComponent(bien.ville)}&type=${encodeURIComponent(bien.type)}`;

  return {
    title,
    description,
    keywords,
    canonicalUrl,
    ogType: 'product',
    ogImage: bien.photos[0] || DEFAULT_OG_IMAGE,
    geoPlacename: `${bien.quartier}, ${bien.ville}`,
    geoPosition: `${bien.localisation.lat};${bien.localisation.lng}`,
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Accueil',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: `${bien.type === 'Appartement' ? 'Appartements' : 'Voitures'} à ${bien.ville}`,
              item: citySearchUrl,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: `${bien.titre} (${bien.matricule})`,
              item: canonicalUrl,
            },
          ],
        },
        buildPropertySchemaNode(bien, baseUrl, availableToday, publishedReviews),
      ],
    },
  };
}

export function buildSuiviSeoConfig(): SeoConfig {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}#/suivi`;
  const title = 'Suivi de réservation — CERIM';
  const description =
    'Consultez en temps réel l’avancement de votre réservation CERIM, vos consignes d’accès et votre QR code d’arrivée.';

  return {
    title,
    description,
    canonicalUrl,
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'WebPage',
          '@id': `${canonicalUrl}#suivi`,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: 'fr-CG',
        },
      ],
    },
  };
}

export function buildContactSeoConfig(): SeoConfig {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}#/contact`;
  const title = 'Contacter notre équipe CERIM — Brazzaville & Pointe-Noire';
  const description =
    'Échangez avec notre équipe CERIM, votre interlocuteur unique pour la réservation et le séjour à Brazzaville et Pointe-Noire.';

  return {
    title,
    description,
    keywords:
      'contact CERIM, assistance réservation Brazzaville, support location Pointe-Noire',
    canonicalUrl,
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    geoPlacename: 'Brazzaville, Pointe-Noire',
    geoPosition: '-4.2634;15.2429',
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'ContactPage',
          '@id': `${canonicalUrl}#contact`,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: 'fr-CG',
          mainEntity: { '@id': `${baseUrl}#organization` },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Accueil',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Contact CERIM',
              item: canonicalUrl,
            },
          ],
        },
      ],
    },
  };
}

export function buildDashboardSeoConfig(): SeoConfig {
  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}#/admin`;
  const title = 'Administration & Opérations — CERIM';
  const description =
    'Espace d’administration interne CERIM pour la gestion des réservations, du check-in et du catalogue.';

  return {
    title,
    description,
    canonicalUrl,
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'WebPage',
          '@id': `${canonicalUrl}#admin`,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: 'fr-CG',
        },
      ],
    },
  };
}

export const buildAdminSeoConfig = buildDashboardSeoConfig;

const LEGAL_SEO_MAP: Record<
  LegalTab,
  { hash: string; title: string; label: string; description: string }
> = {
  cgv: {
    hash: '#/cgv',
    label: 'Conditions Générales (CGV)',
    title: 'CGV & Politique d’annulation — CERIM Congo',
    description:
      'Consultez les conditions générales de réservation sans paiement en ligne et la politique d’annulation de CERIM à Brazzaville et Pointe-Noire.',
  },
  cgu: {
    hash: '#/cgv',
    label: 'Conditions Générales (CGV)',
    title: 'CGV & Politique d’annulation — CERIM Congo',
    description:
      'Consultez les conditions générales de réservation sans paiement en ligne et la politique d’annulation de CERIM à Brazzaville et Pointe-Noire.',
  },
  confidentialite: {
    hash: '#/confidentialite',
    label: 'Politique de confidentialité',
    title: 'Politique de confidentialité — CERIM Congo',
    description:
      'Découvrez comment CERIM protège vos données personnelles et applique le principe de minimisation lors de vos réservations.',
  },
  cookies: {
    hash: '#/cookies',
    label: 'Politique des cookies',
    title: 'Gestion des cookies & stockage local — CERIM',
    description:
      'Paramétrez vos préférences de cookies et consultez les traceurs techniques utilisés sur CERIM.',
  },
  mentions: {
    hash: '#/mentions-legales',
    label: 'Mentions légales',
    title: 'Mentions légales — CERIM',
    description:
      'Informations légales de CERIM et règles de sécurité pour les réservations avec paiement sur place.',
  },
};

export function buildLegalSeoConfig(tab: LegalTab): SeoConfig {
  const baseUrl = getBaseUrl();
  const meta = LEGAL_SEO_MAP[tab] || LEGAL_SEO_MAP.cgv;
  const canonicalUrl = `${baseUrl}${meta.hash}`;

  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl,
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    geoPlacename: 'Brazzaville, Pointe-Noire',
    geoPosition: '-4.2634;15.2429',
    schemaGraph: {
      '@context': 'https://schema.org',
      '@graph': [
        buildOrganizationNode(baseUrl),
        {
          '@type': 'WebPage',
          '@id': `${canonicalUrl}#legal`,
          url: canonicalUrl,
          name: meta.title,
          description: meta.description,
          inLanguage: 'fr-CG',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Accueil',
              item: baseUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: meta.label,
              item: canonicalUrl,
            },
          ],
        },
      ],
    },
  };
}
