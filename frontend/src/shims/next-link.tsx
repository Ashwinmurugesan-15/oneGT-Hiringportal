/**
 * src/shims/next-link.tsx
 *
 * Provides a drop-in replacement for the Next.js `next/link` component
 * using react-router-dom's `Link`.
 */
import React from 'react';
import { Link as RRLink } from 'react-router-dom';

const Link = React.forwardRef(({ href, children, ...props }: any, ref: any) => {
    return (
        <RRLink to={href} {...props} ref={ref}>
            {children}
        </RRLink>
    );
});

Link.displayName = 'NextLinkShim';

export default Link;
