import type { MetadataRoute } from 'next';

const SITE_URL = 'https://billigapizzor.se';

const STATIC_ROUTES: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
    priority: number;
}> = [
    { path: '/', changeFrequency: 'daily', priority: 1.0 },
    { path: '/pizzor', changeFrequency: 'daily', priority: 0.9 },
    { path: '/pizzerior', changeFrequency: 'daily', priority: 0.9 },
    { path: '/karta', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/statistik', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/statestik', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/om-oss', changeFrequency: 'monthly', priority: 0.6 }
];

type PizzeriaRow = {
    slug?: string | null;
    url?: string | null;
    länk?: string | null;
    lank?: string | null;
    namn?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
};

function sanitizeSlug(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[åä]/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toPizzeriaPath(row: PizzeriaRow): string | null {
    const rawUrl = row.url ?? row.lank ?? row.länk;

    if (rawUrl && rawUrl.trim()) {
        const normalized = rawUrl.trim();

        if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
            try {
                const parsed = new URL(normalized);
                return parsed.pathname;
            } catch {
                return null;
            }
        }

        return normalized.startsWith('/') ? normalized : `/${normalized}`;
    }

    if (row.slug && row.slug.trim()) {
        const cleaned = sanitizeSlug(row.slug);
        return cleaned ? `/${cleaned}.html` : null;
    }

    if (row.namn && row.namn.trim()) {
        const generated = sanitizeSlug(row.namn);
        return generated ? `/${generated}.html` : null;
    }

    return null;
}

async function fetchPizzerior(): Promise<PizzeriaRow[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    const endpoint = new URL('/rest/v1/pizzerior', supabaseUrl);
    endpoint.searchParams.set('select', 'slug,url,lank,namn,updated_at,created_at');
    endpoint.searchParams.set('order', 'id.asc');

    const response = await fetch(endpoint.toString(), {
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`
        },
        next: { revalidate: 3600 }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch pizzerior from Supabase: ${response.status}`);
    }

    const data = (await response.json()) as PizzeriaRow[];
    return Array.isArray(data) ? data : [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
        url: `${SITE_URL}${route.path}`,
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority
    }));

    const pizzerior = await fetchPizzerior();
    const seen = new Set<string>();

    const dynamicEntries: MetadataRoute.Sitemap = pizzerior
        .map((row) => {
            const path = toPizzeriaPath(row);
            if (!path) return null;

            const url = `${SITE_URL}${path}`;
            if (seen.has(url)) return null;
            seen.add(url);

            const lastModified = row.updated_at ?? row.created_at ?? now.toISOString();

            return {
                url,
                lastModified: new Date(lastModified),
                changeFrequency: 'weekly',
                priority: 0.7
            } satisfies MetadataRoute.Sitemap[number];
        })
        .filter((entry): entry is MetadataRoute.Sitemap[number] => Boolean(entry));

    return [...staticEntries, ...dynamicEntries];
}
