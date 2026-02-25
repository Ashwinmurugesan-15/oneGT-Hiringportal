/**
 * src/shims/next-navigation.tsx
 *
 * Provides drop-in replacements for the Next.js `next/navigation` hooks
 * so the existing legacy-pages work inside a Vite + react-router-dom app
 * without any modifications to the page components.
 */
import { useNavigate, useSearchParams as useRRSearchParams, useLocation } from 'react-router-dom';

/** Mimics Next.js useRouter() */
export function useRouter() {
    const navigate = useNavigate();
    const location = useLocation();

    const prefixPath = (href: string) => {
        if (href.startsWith('/') && !href.startsWith('/talent')) {
            return `/talent${href}`;
        }
        return href;
    };

    return {
        push: (href: string) => navigate(prefixPath(href)),
        replace: (href: string) => navigate(prefixPath(href), { replace: true }),
        back: () => navigate(-1),
        forward: () => navigate(1),
        refresh: () => window.location.reload(),
        pathname: location.pathname,
        query: Object.fromEntries(new URLSearchParams(location.search)),
    };
}

/** Mimics Next.js useSearchParams() – returns a URLSearchParams-like object */
export function useSearchParams() {
    const [searchParams] = useRRSearchParams();
    return searchParams;
}

/** Mimics Next.js usePathname() */
export function usePathname() {
    return useLocation().pathname;
}

export function notFound() {
    throw new Response('Not Found', { status: 404 });
}
