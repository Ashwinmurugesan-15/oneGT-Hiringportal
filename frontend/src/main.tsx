import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Providers } from '@/components/providers/Providers';

// Pages  
import IndexPage from '@/legacy-pages/Index';
import DashboardPage from '@/legacy-pages/Dashboard';
import CandidatesPage from '@/legacy-pages/Candidates';
import DemandsPage from '@/legacy-pages/Demands';
import InterviewsPage from '@/legacy-pages/Interviews';
import NotFoundPage from '@/legacy-pages/NotFound';

import '@/styles/globals.css';

// Global error handler so we can see errors even if React's error overlay is suppressed
window.addEventListener('error', (e) => {
    console.error('GLOBAL ERROR:', e.message, e.filename, e.lineno);
    const root = document.getElementById('root');
    if (root && !root.hasChildNodes()) {
        root.innerHTML = `<div style="background:#fee;color:#900;padding:24px;font-family:monospace;white-space:pre-wrap;">
<strong>React failed to mount</strong>\n\n${e.message}\n\n${e.filename}:${e.lineno}
    </div>`;
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('UNHANDLED PROMISE REJECTION:', e.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                <Providers>
                    <Routes>
                        <Route path="/" element={<IndexPage />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/candidates" element={<CandidatesPage />} />
                        <Route path="/demands" element={<DemandsPage />} />
                        <Route path="/interviews" element={<InterviewsPage />} />
                        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </Providers>
            </ThemeProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
