'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Demand } from '@/types/recruitment';
import { useAuth } from './AuthContext';

interface DemandsContextType {
    demands: Demand[];
    addDemand: (newDemand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers' | 'rejected'>) => void;
    updateDemand: (updatedDemand: Demand) => void;
    closeDemand: (id: string) => void;
    reopenDemand: (id: string) => void;
    deleteDemand: (id: string) => void;
}

const DemandsContext = createContext<DemandsContextType | undefined>(undefined);

export const DemandsProvider = ({ children }: { children: ReactNode }) => {
    const [demands, setDemands] = useState<Demand[]>([]);
    const { isAuthenticated, getAuthHeader } = useAuth();

    useEffect(() => {
        const fetchDemands = async () => {
            if (!isAuthenticated) {
                return;
            }

            try {
                const res = await fetch('/api/talent/demands', {
                    headers: getAuthHeader()
                });

                if (!res.ok) throw new Error(`API error: ${res.status}`);

                const data = await res.json();

                setDemands(data.map((d: any) => ({
                    ...d,
                    skills: Array.isArray(d.skills) ? d.skills : [],
                    createdAt: new Date(d.createdAt),
                    reopenedAt: d.reopenedAt ? new Date(d.reopenedAt) : undefined
                })));
            } catch (error) {
                console.error('Failed to fetch demands:', error);
            }
        };
        fetchDemands();
    }, [isAuthenticated]);

    const addDemand = async (demand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers' | 'rejected'>) => {
        const newDemandData = {
            ...demand,
            id: String(Date.now()),
            createdAt: new Date().toISOString(),
            applicants: 0,
            interviewed: 0,
            offers: 0,
            rejected: 0,
        };

        try {
            const res = await fetch('/api/talent/demands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(newDemandData),
            });
            const savedDemand = await res.json();
            setDemands((prev) => [{ ...savedDemand, createdAt: new Date(savedDemand.createdAt) }, ...prev]);
        } catch (error) {
            console.error('Failed to add demand:', error);
        }
    };

    const updateDemand = async (updatedDemand: Demand) => {
        try {
            const res = await fetch('/api/talent/demands/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(updatedDemand),
            });
            const data = await res.json();
            setDemands((prev) =>
                prev.map((d) => (d.id === updatedDemand.id ? { ...data, createdAt: new Date(data.createdAt) } : d))
            );
        } catch (error) {
            console.error('Failed to update demand:', error);
        }
    };

    const closeDemand = async (id: string) => {
        const demand = demands.find((d) => d.id === id);
        if (demand) {
            await updateDemand({
                ...demand,
                status: 'closed',
            });
        }
    };

    const reopenDemand = (id: string) => {
        const demand = demands.find((d) => d.id === id);
        if (demand) {
            updateDemand({
                ...demand,
                status: 'open',
                reopenedAt: new Date(),
            });
        }
    };

    const deleteDemand = async (id: string) => {
        const demand = demands.find((d) => d.id === id);
        if (!demand) return;
        // Soft-delete: mark status as 'deleted'
        await updateDemand({ ...demand, status: 'deleted' });
    };


    return (
        <DemandsContext.Provider value={{ demands, addDemand, updateDemand, closeDemand, reopenDemand, deleteDemand }}>
            {children}
        </DemandsContext.Provider>
    );
};

export const useDemands = () => {
    const context = useContext(DemandsContext);
    if (context === undefined) {
        throw new Error('useDemands must be used within a DemandsProvider');
    }
    return context;
};
