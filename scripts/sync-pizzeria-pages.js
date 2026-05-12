const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'pizzerior', 'pizzeria.html');
const outputDir = path.join(projectRoot, 'pizzerior');
const sitemapPath = path.join(projectRoot, 'sitemap.xml');
const supabaseConfigPath = path.join(projectRoot, 'js', 'supabase-config.js');
const siteUrl = 'https://billigapizzor.se';

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pizzerior', changefreq: 'weekly', priority: '0.9' },
  { path: '/karta', changefreq: 'monthly', priority: '0.8' },
  { path: '/statistik', changefreq: 'monthly', priority: '0.8' },
  { path: '/om-oss', changefreq: 'weekly', priority: '0.6' },
  { path: '/integritetspolicy', changefreq: 'yearly', priority: '0.4' },
];

function normalizePizzeriaName(name) {
  return String(name || '').toLowerCase().trim();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function sanitizeExternalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return '';
  }
}

function sanitizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function createGoogleMapsLink(name, address) {
  const query = [name, address].filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '#';
}

function formatPrice(price) {
  const numeric = Number(price);
  return Number.isFinite(numeric) && numeric > 0 ? `${numeric} kr` : 'Pris okänt';
}

function formatList(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} och ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} och ${list[list.length - 1]}`;
}

function hashText(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickVariant(variants, key, fallback = '') {
  if (!Array.isArray(variants) || variants.length === 0) return fallback;
  const index = hashText(key) % variants.length;
  return variants[index] || fallback;
}

function applyTemplate(template, replacements) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(replacements, key) ? replacements[key] : '';
  });
}

function escapeJsonForScript(value) {
  return String(value || '').replace(/<\//g, '<\\/');
}

function createPizzeriaSlug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(pizzeria|restaurang|resturang)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'pizzeria';
}

function createSlugCandidates(row) {
  const candidates = [
    row?.namn,
    [row?.namn, row?.stad].filter(Boolean).join(' '),
    [row?.namn, row?.omrade].filter(Boolean).join(' '),
    [row?.namn, row?.adress].filter(Boolean).join(' '),
  ];

  return candidates
    .map((candidate) => createPizzeriaSlug(candidate))
    .filter(Boolean);
}

function parseSupabaseConfig() {
  const fileContent = fs.readFileSync(supabaseConfigPath, 'utf8');
  const urlMatch = fileContent.match(/url:\s*'([^']+)'/);
  const keyMatch = fileContent.match(/anonKey:\s*'([^']+)'/);

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || (urlMatch ? urlMatch[1] : ''),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || (keyMatch ? keyMatch[1] : ''),
  };
}

async function fetchSupabaseRows(query) {
  const { url, anonKey } = parseSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error('Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or keep js/supabase-config.js up to date.');
  }

  const allRows = [];
  const batchSize = 1000;
  let offset = 0;

  while (true) {
    const separator = query.includes('?') ? '&' : '?';
    const pagedQuery = `${query}${separator}limit=${batchSize}&offset=${offset}`;
    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/${pagedQuery}`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Supabase rows (${response.status}) from ${endpoint}`);
    }

    const rows = await response.json();
    const list = Array.isArray(rows) ? rows : [];
    allRows.push(...list);

    if (list.length < batchSize) break;
    offset += batchSize;
  }

  return allRows;
}

function buildSitemapXml(pizzeriaEntries) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

  staticRoutes.forEach((route) => {
    lines.push(`  <url><loc>${siteUrl}${route.path}</loc><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`);
  });

  pizzeriaEntries.forEach((entry) => {
    lines.push(`  <url><loc>${siteUrl}${entry.routePath}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  });

  lines.push('</urlset>', '');
  return lines.join('\n');
}

function buildPizzeriaEntries(rows) {
  const usedSlugs = new Set();

  return rows
    .filter((row) => row && row.id !== null && row.id !== undefined && String(row.namn || '').trim())
    .map((row) => {
      const candidates = createSlugCandidates(row);
      let slug = candidates.find((candidate) => candidate && !usedSlugs.has(candidate));

      if (!slug) {
        const baseSlug = createPizzeriaSlug(row.namn);
        let suffix = 2;
        slug = `${baseSlug}-${suffix}`;
        while (usedSlugs.has(slug)) {
          suffix += 1;
          slug = `${baseSlug}-${suffix}`;
        }
      }

      usedSlugs.add(slug);

      return {
        id: Number(row.id),
        name: String(row.namn || '').trim(),
        slug,
        fileName: `${slug}.html`,
        routePath: `/pizzerior/${slug}`,
        adress: String(row.adress || '').trim(),
        stad: String(row.stad || '').trim(),
        omrade: String(row.omrade || '').trim(),
        telefon: String(row.telefon || '').trim(),
        hemsida: sanitizeExternalUrl(row.hemsida),
        oppettider: row.oppettider && typeof row.oppettider === 'object' ? row.oppettider : null,
        lat: Number(row.lat),
        lng: Number(row.lng),
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
      };
    });
}

function buildLocality(entry) {
  return [entry.omrade, entry.stad].filter(Boolean).join(', ');
}

function buildTitle(entry) {
  return entry.stad
    ? `${entry.name} i ${entry.stad} – Meny, priser & öppettider | Billiga Pizzor`
    : `${entry.name} – Meny, priser & öppettider | Billiga Pizzor`;
}

function buildMetaDescription(entry) {
  return entry.stad
    ? `Se meny, pizzapriser, öppettider och populära pizzor hos ${entry.name} i ${entry.stad}. Jämför priser och hitta billigaste pizzorna hos Billiga Pizzor.`
    : `Se meny, pizzapriser och öppettider hos ${entry.name}. Jämför pizzor och priser hos Billiga Pizzor.`;
}

function buildOgTitle(entry) {
  return entry.stad
    ? `${entry.name} i ${entry.stad} – Meny & priser`
    : `${entry.name} – Meny & priser`;
}

function buildOgDescription(entry) {
  return `Se meny, priser och öppettider hos ${entry.name}.`;
}

function buildTwitterDescription(entry) {
  return `Se pizzor, priser och öppettider hos ${entry.name}.`;
}

function sortRowsByName(rows, fieldName) {
  return [...rows].sort((a, b) => String(a?.[fieldName] || '').localeCompare(String(b?.[fieldName] || ''), 'sv'));
}

function buildOpeningHoursRows(oppettider) {
  if (!oppettider || typeof oppettider !== 'object') return [];

  const dayOrder = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
  const dayAliases = {
    'mån': 'måndag', 'man': 'måndag', 'måndag': 'måndag', 'mon': 'måndag',
    'tis': 'tisdag', 'tisdag': 'tisdag', 'tue': 'tisdag',
    'ons': 'onsdag', 'onsdag': 'onsdag', 'wed': 'onsdag',
    'tor': 'torsdag', 'tors': 'torsdag', 'torsdag': 'torsdag', 'thu': 'torsdag',
    'fre': 'fredag', 'fredag': 'fredag', 'fri': 'fredag',
    'lör': 'lördag', 'lor': 'lördag', 'lördag': 'lördag', 'sat': 'lördag',
    'sön': 'söndag', 'son': 'söndag', 'söndag': 'söndag', 'sun': 'söndag',
  };
  const dayLabels = {
    'måndag': 'Måndag', 'tisdag': 'Tisdag', 'onsdag': 'Onsdag', 'torsdag': 'Torsdag',
    'fredag': 'Fredag', 'lördag': 'Lördag', 'söndag': 'Söndag',
  };

  function normalizeDay(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-zåäö]/g, '');
  }

  function expandDays(key, time) {
    const parts = String(key || '').split(/[-–—]/).map((item) => normalizeDay(item)).filter(Boolean);
    if (parts.length === 2) {
      const start = dayAliases[parts[0]];
      const end = dayAliases[parts[1]];
      const startIndex = dayOrder.indexOf(start);
      const endIndex = dayOrder.indexOf(end);
      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        return dayOrder.slice(startIndex, endIndex + 1).map((day) => ({ day, label: dayLabels[day], time }));
      }
    }

    const singleDay = dayAliases[normalizeDay(key)];
    return singleDay ? [{ day: singleDay, label: dayLabels[singleDay], time }] : [];
  }

  const expanded = new Map();
  Object.entries(oppettider).forEach(([key, time]) => {
    expandDays(key, String(time || '').trim()).forEach((entry) => {
      expanded.set(entry.day, entry);
    });
  });

  return dayOrder.map((day) => expanded.get(day) || { day, label: dayLabels[day], time: 'Stängt' });
}

function parseTimeToHourMinute(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;

  return {
    hour: hour === 24 ? 0 : hour,
    minute,
  };
}

function formatSchemaTime(parsedTime) {
  if (!parsedTime) return null;
  return `${String(parsedTime.hour).padStart(2, '0')}:${String(parsedTime.minute).padStart(2, '0')}`;
}

function buildOpeningHoursSpecification(rows) {
  const dayToSchema = {
    'Måndag': 'Monday',
    'Tisdag': 'Tuesday',
    'Onsdag': 'Wednesday',
    'Torsdag': 'Thursday',
    'Fredag': 'Friday',
    'Lördag': 'Saturday',
    'Söndag': 'Sunday',
  };

  const specs = [];

  rows.forEach((row) => {
    const schemaDay = dayToSchema[row?.label];
    if (!schemaDay) return;

    const timeText = String(row?.time || '').trim();
    if (!timeText || /st[aä]ngt|closed/i.test(timeText)) return;

    const ranges = timeText.split(/[,;]|\s+och\s+/i).map((part) => part.trim()).filter(Boolean);
    ranges.forEach((rangeText) => {
      const [fromText, toText] = rangeText.split(/[-–—]/).map((part) => part.trim());
      if (!fromText || !toText) return;
      const from = parseTimeToHourMinute(fromText);
      const to = parseTimeToHourMinute(toText);
      const opens = formatSchemaTime(from);
      const closes = formatSchemaTime(to);
      if (!opens || !closes) return;

      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: `https://schema.org/${schemaDay}`,
        opens,
        closes,
      });
    });
  });

  return specs;
}

function buildOpeningHoursHtml(entry) {
  const rows = buildOpeningHoursRows(entry.oppettider);
  if (!rows.length) {
    return {
      boxAttr: 'style="display:none"',
      statusHtml: '',
      listHtml: '',
      schemaHours: null,
    };
  }

  const listHtml = rows
    .map((row) => `<div class="oppettider-rad"><span class="opp-dag">${escapeHtml(row.label)}</span><span class="opp-tid">${escapeHtml(row.time)}</span></div>`)
    .join('');

  const statusHtml = '<p class="oppettider-meta oppettider-meta--oppet">Se aktuella öppettider för veckan.</p>';
  const schemaHours = rows;

  return {
    boxAttr: '',
    statusHtml,
    listHtml,
    schemaHours,
  };
}

function buildSeoParagraphs(entry, pizzas, extras) {
  const locality = buildLocality(entry);
  const localPhrase = entry.stad ? ` i ${entry.stad}` : '';
  const areaPhrase = locality ? ` i ${locality}` : localPhrase;
  const menuRows = pizzas.length + extras.length;
  const namedPizzas = sortRowsByName(pizzas, 'pizza_namn')
    .map((row) => String(row?.pizza_namn || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  const priceValues = pizzas.map((row) => Number(row?.pris)).filter((value) => Number.isFinite(value) && value > 0);
  const minPrice = priceValues.length ? Math.min(...priceValues) : null;
  const maxPrice = priceValues.length ? Math.max(...priceValues) : null;
  const avgPrice = priceValues.length ? Math.round(priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length) : null;
  const openingRows = buildOpeningHoursRows(entry.oppettider);
  const openingSummary = openingRows.filter((row) => row.time && row.time !== 'Stängt').slice(0, 2).map((row) => `${row.label} ${row.time}`);
  const introTemplates = [
    `${entry.name}${areaPhrase} har en meny med ${menuRows} rätter hos Billiga Pizzor. Här kan du snabbt se meny, pizzor, priser${entry.oppettider ? ' och öppettider' : ''} för att jämföra med andra alternativ${localPhrase}.`,
    `Hos ${entry.name}${areaPhrase} hittar du just nu ${menuRows} rätter. Den här sidan samlar meny, pizzor, priser${entry.oppettider ? ' och öppettider' : ''} på ett ställe för enklare jämförelse${localPhrase}.`,
    `Den här landningssidan för ${entry.name}${areaPhrase} visar meny, pizzor, prisnivåer${entry.oppettider ? ' och öppettider' : ''}. Målet är att göra det lätt att hitta rätt pizza${localPhrase}.`,
  ];

  const menuTemplates = namedPizzas.length ? [
    `På menyn hos ${entry.name} finns bland annat ${formatList(namedPizzas)}. Sidan är optimerad för sökningar som "${entry.name} meny" och "${entry.name} priser".`,
    `Exempel från ${entry.name} meny är ${formatList(namedPizzas)}. Innehållet är strukturerat för lokala sökningar som "pizza${localPhrase}" och "billig pizza${localPhrase}".`,
    `${entry.name} erbjuder bland annat ${formatList(namedPizzas)}. Det gör sidan relevant för den som vill jämföra både klassiker och specialpizzor i området.`,
  ] : [];

  const priceTemplates = (minPrice !== null && maxPrice !== null && avgPrice !== null) ? [
    `Prisbilden hos ${entry.name} ligger mellan ${minPrice} och ${maxPrice} kr, med ett snitt på cirka ${avgPrice} kr. Bra underlag för dig som vill jämföra prisvärd pizza${localPhrase}.`,
    `Pizzapriserna hos ${entry.name} varierar från ${minPrice} till ${maxPrice} kr och snittar runt ${avgPrice} kr. Här kan du därför snabbt bedöma prisnivån innan beställning.`,
    `Hos ${entry.name} ligger pizzorna i spannet ${minPrice}-${maxPrice} kr, med snittpris omkring ${avgPrice} kr. Det hjälper vid jämförelser mellan flera pizzerior${localPhrase}.`,
  ] : [];

  const localDetailsTemplates = [
    `${entry.name} ligger${entry.adress ? ` på ${entry.adress}` : ''}${areaPhrase}.${openingSummary.length ? ` Exempel på öppettider: ${openingSummary.join(', ')}.` : ''}`.trim(),
    `${entry.adress ? `Adress: ${entry.adress}. ` : ''}${entry.omrade ? `Område: ${entry.omrade}. ` : ''}${entry.stad ? `Stad: ${entry.stad}. ` : ''}${openingSummary.length ? `Öppettider i urval: ${openingSummary.join(', ')}.` : ''}`.trim(),
    `${entry.name} är verksam${entry.omrade || entry.stad ? ` i ${[entry.omrade, entry.stad].filter(Boolean).join(', ')}` : ''}${entry.adress ? ` med adress ${entry.adress}` : ''}.${openingSummary.length ? ` Veckans tider inkluderar ${openingSummary.join(', ')}.` : ''}`.trim(),
  ];

  const key = `${entry.slug}|${entry.name}|${entry.stad}`;
  const sections = [
    {
      heading: 'Meny och priser',
      body: pickVariant(introTemplates, `${key}|intro`, introTemplates[0]),
    },
    {
      heading: 'Populära val',
      body: pickVariant(menuTemplates, `${key}|menu`, menuTemplates[0] || ''),
    },
    {
      heading: 'Prisnivå',
      body: pickVariant(priceTemplates, `${key}|price`, priceTemplates[0] || ''),
    },
    {
      heading: 'Lokal information',
      body: pickVariant(localDetailsTemplates, `${key}|local`, localDetailsTemplates[0]),
    },
  ].filter((section) => section.body);

  return sections;
}

function renderItemRow(item, options) {
  const title = escapeHtml(String(item?.title || '').trim());
  const description = escapeHtml(String(item?.description || '').trim());
  const price = escapeHtml(formatPrice(item?.price));
  const icon = options.icon || '🍕';

  return `
    <div class="pizzeria-item-rad${options.compact ? ' pizzeria-item-rad--compact' : ''}">
      <div class="pizzeria-item-bild" aria-hidden="true">${icon}</div>
      <div class="pizzeria-item-info">
        <span class="pizzeria-item-namn">${title}</span>
        ${description ? `<span class="pizzeria-item-ingredienser">${description}</span>` : ''}
      </div>
      <span class="pizzeria-item-pris">${price}</span>
    </div>`;
}

function renderMenuSection(title, emoji, items, compact) {
  if (!items.length) return '';

  const itemHtml = items.join('');
  return `
    <div class="pizzeria-sektion${compact ? ' pizzeria-sektion--compact' : ''}">
      <div class="pizzeria-sektion-header">
        <span class="pizzeria-sektion-titel">${emoji} ${escapeHtml(title)}</span>
        <span class="pizzeria-sektion-antal">${items.length} st</span>
      </div>
      <div class="pizzeria-sektion-items">${itemHtml}</div>
    </div>`;
}

function renderExtraSection(extras) {
  if (!extras.length) return '';

  const grouped = new Map();
  extras.forEach((row) => {
    const key = String(row?.kategori || 'Tillbehör').trim() || 'Tillbehör';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  const cards = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'sv'))
    .map(([groupName, rows]) => {
      const itemsHtml = sortRowsByName(rows, 'namn').map((row) => renderItemRow({
        title: row.namn,
        description: row.beskrivning,
        price: row.pris,
      }, { icon: '🥤', compact: true })).join('');

      return `
        <div class="pizzeria-extra-card">
          <div class="pizzeria-extra-card-head">
            <span class="pizzeria-extra-card-title">🥤 ${escapeHtml(groupName)}</span>
          </div>
          <div class="pizzeria-extra-items">${itemsHtml}</div>
        </div>`;
    })
    .join('');

  return `
    <section class="pizzeria-extra-wrap">
      <div class="pizzeria-extra-head">
        <h3 class="pizzeria-extra-title">🍟 Tillbehör & Dryck</h3>
      </div>
      <div class="pizzeria-extra-grid">${cards}</div>
    </section>`;
}

function renderStaticMenu(entry, pizzas, extras) {
  const pizzaItems = sortRowsByName(pizzas, 'pizza_namn').map((row) => renderItemRow({
    title: row.pizza_namn,
    description: Array.isArray(row.ingredienser) ? row.ingredienser.join(', ') : '',
    price: row.pris,
  }, { icon: '🍕', compact: false }));

  const menuSection = renderMenuSection('Meny & pizzor', '🍕', pizzaItems, false);
  const extraSection = renderExtraSection(extras);

  if (!menuSection && !extraSection) {
    return '<div class="ingen-traff"><h3>Mamma Mia! 🍕</h3><p>Menyn uppdateras just nu för den här pizzerian.</p></div>';
  }

  return `<div class="pizzeria-sektion-grid">${menuSection}</div>${extraSection}`;
}

function buildStructuredData(entry, canonicalUrl, schemaHours, pizzas, extras) {
  const openingHoursSpecification = buildOpeningHoursSpecification(schemaHours || []);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: entry.name,
    servesCuisine: 'Pizza',
    url: canonicalUrl,
    inLanguage: 'sv-SE',
  };

  if (entry.telefon) schema.telephone = entry.telefon;
  if (entry.hemsida) schema.sameAs = [entry.hemsida];
  if (entry.lat && entry.lng) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: entry.lat,
      longitude: entry.lng,
    };
  }

  if (entry.adress || entry.stad) {
    schema.address = {
      '@type': 'PostalAddress',
      addressCountry: 'SE',
    };
    if (entry.adress) schema.address.streetAddress = entry.adress;
    if (entry.stad) schema.address.addressLocality = entry.stad;
    if (entry.omrade) schema.address.addressRegion = entry.omrade;
  }

  if (schemaHours && schemaHours.length) {
    schema.openingHours = schemaHours.map((row) => `${row.label} ${row.time}`);
  }

  if (openingHoursSpecification.length) {
    schema.openingHoursSpecification = openingHoursSpecification;
  }

  if (entry.adress) {
    schema.hasMap = createGoogleMapsLink(entry.name, entry.adress);
  }

  if (entry.stad || entry.omrade) {
    schema.areaServed = {
      '@type': 'Place',
      name: [entry.omrade, entry.stad].filter(Boolean).join(', '),
    };
  }

  const priceValues = pizzas.map((row) => Number(row?.pris)).filter((value) => Number.isFinite(value) && value > 0);
  if (priceValues.length) {
    schema.priceRange = `${Math.min(...priceValues)}-${Math.max(...priceValues)} SEK`;
  }

  if (pizzas.length || extras.length) {
    const menuUrl = `${canonicalUrl}#resultat-lista`;
    schema.hasMenu = menuUrl;
    const bestPrice = priceValues.length ? Math.min(...priceValues) : null;
    if (bestPrice !== null) {
      schema.makesOffer = {
        '@type': 'Offer',
        priceCurrency: 'SEK',
        price: String(bestPrice),
        availability: 'https://schema.org/InStock',
        url: menuUrl,
      };
    }
  }

  return JSON.stringify(schema, null, 2);
}

function buildPageHtml(templateContent, entry, pizzas, extras) {
  const canonicalUrl = `${siteUrl}${entry.routePath}`;
  const heroSubline = buildLocality(entry) || entry.adress || 'Meny, pizzor och priser';
  const phoneSanitized = sanitizePhone(entry.telefon);
  const phoneLink = phoneSanitized ? `tel:${phoneSanitized}` : 'tel:';
  const mapLink = createGoogleMapsLink(entry.name, entry.adress);
  const openingHours = buildOpeningHoursHtml(entry);
  const seoParagraphs = buildSeoParagraphs(entry, pizzas, extras);
  const replacements = {
    SEO_TITLE: escapeAttribute(buildTitle(entry)),
    SEO_DESCRIPTION: escapeAttribute(buildMetaDescription(entry)),
    SEO_CANONICAL: escapeAttribute(canonicalUrl),
    OG_TITLE: escapeAttribute(buildOgTitle(entry)),
    OG_DESCRIPTION: escapeAttribute(buildOgDescription(entry)),
    TWITTER_TITLE: escapeAttribute(`${entry.name} – Meny & priser`),
    TWITTER_DESCRIPTION: escapeAttribute(buildTwitterDescription(entry)),
    STRUCTURED_DATA_JSON: escapeJsonForScript(buildStructuredData(entry, canonicalUrl, openingHours.schemaHours, pizzas, extras)),
    HERO_TITLE: escapeHtml(entry.name),
    HERO_SUBLINE: escapeHtml(heroSubline),
    H1_TITLE: escapeHtml(entry.name),
    ADDRESS_ITEM_ATTR: entry.adress ? '' : 'style="display:none"',
    ADDRESS_TEXT: escapeHtml(entry.adress),
    MAP_LINK: escapeAttribute(mapLink),
    LOCALITY_ITEM_ATTR: buildLocality(entry) ? '' : 'style="display:none"',
    LOCALITY_TEXT: escapeHtml(buildLocality(entry)),
    PHONE_ITEM_ATTR: entry.telefon ? '' : 'style="display:none"',
    PHONE_LINK: escapeAttribute(phoneLink),
    PHONE_TEXT: escapeHtml(entry.telefon),
    WEBSITE_ITEM_ATTR: entry.hemsida ? '' : 'style="display:none"',
    WEBSITE_LINK: escapeAttribute(entry.hemsida || '#'),
    WEBSITE_TEXT: escapeHtml((entry.hemsida || '').replace(/^https?:\/\//, '').replace(/\/$/, '')),
    SEO_BODY_HTML: seoParagraphs
      .map((section) => `<section class="pizzeria-seo-block"><h3>${escapeHtml(section.heading)}</h3><p>${escapeHtml(section.body)}</p></section>`)
      .join(''),
    OPENING_HOURS_BOX_ATTR: openingHours.boxAttr,
    OPENING_HOURS_STATUS_HTML: openingHours.statusHtml,
    OPENING_HOURS_HTML: openingHours.listHtml,
    MENU_COUNT_TEXT: escapeHtml(`Visar ${pizzas.length + extras.length} rätter hos ${entry.name}.`),
    PIZZERIA_NAME_ATTR: escapeAttribute(entry.name),
    PIZZERIA_SLUG_ATTR: escapeAttribute(entry.slug),
    STATIC_MENU_HTML: renderStaticMenu(entry, pizzas, extras),
  };

  return applyTemplate(templateContent, replacements);
}

async function main() {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing template file: ${templatePath}`);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const [pizzeriaRows, pizzaRows, extraRows] = await Promise.all([
    fetchSupabaseRows('pizzerior?select=id,namn,adress,stad,omrade,telefon,hemsida,oppettider,lat,lng,created_at&order=id.asc'),
    fetchSupabaseRows('pizzor?select=pizzeria_id,pizza_namn,pris,ingredienser&order=id.asc'),
    fetchSupabaseRows('extras?select=pizzeria_id,kategori,namn,pris,beskrivning&order=id.asc'),
  ]);
  const uniquePizzerias = buildPizzeriaEntries(pizzeriaRows);
  const templateContent = fs.readFileSync(templatePath, 'utf8');

  let createdCount = 0;
  let updatedCount = 0;
  let removedCount = 0;

  const pizzasByPizzeriaId = new Map();
  pizzaRows.forEach((row) => {
    const key = Number(row?.pizzeria_id);
    if (!Number.isFinite(key)) return;
    if (!pizzasByPizzeriaId.has(key)) pizzasByPizzeriaId.set(key, []);
    pizzasByPizzeriaId.get(key).push({
      pizza_namn: String(row?.pizza_namn || '').trim(),
      pris: row?.pris,
      ingredienser: Array.isArray(row?.ingredienser) ? row.ingredienser : [],
    });
  });

  const extrasByPizzeriaId = new Map();
  extraRows.forEach((row) => {
    const key = Number(row?.pizzeria_id);
    if (!Number.isFinite(key)) return;
    if (!extrasByPizzeriaId.has(key)) extrasByPizzeriaId.set(key, []);
    extrasByPizzeriaId.get(key).push({
      kategori: String(row?.kategori || '').trim(),
      namn: String(row?.namn || '').trim(),
      pris: row?.pris,
      beskrivning: String(row?.beskrivning || '').trim(),
    });
  });

  uniquePizzerias.forEach((entry) => {
    const filePath = path.join(outputDir, entry.fileName);
    const pizzas = pizzasByPizzeriaId.get(entry.id) || [];
    const extras = extrasByPizzeriaId.get(entry.id) || [];
    const html = buildPageHtml(templateContent, entry, pizzas, extras);
    const existed = fs.existsSync(filePath);
    fs.writeFileSync(filePath, html, 'utf8');
    if (existed) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  });

  const expectedFiles = new Set(uniquePizzerias.map((entry) => entry.fileName));
  const existingFiles = fs.readdirSync(outputDir, { withFileTypes: true });
  existingFiles.forEach((item) => {
    if (!item.isFile()) return;
    if (!item.name.endsWith('.html')) return;
    if (item.name === path.basename(templatePath)) return;
    if (expectedFiles.has(item.name)) return;

    fs.unlinkSync(path.join(outputDir, item.name));
    removedCount += 1;
  });

  fs.writeFileSync(sitemapPath, buildSitemapXml(uniquePizzerias), 'utf8');

  console.log(`Pizzeria pages sync complete. Unique pizzerias: ${uniquePizzerias.length}. Created: ${createdCount}. Updated: ${updatedCount}. Removed legacy: ${removedCount}. Sitemap updated.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
