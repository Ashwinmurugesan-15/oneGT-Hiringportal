
export interface ExternalApplication {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    resume_url: string;
    applied_at: string;
}

// Helper to get config lazily
const getConfig = () => {
    const useMockApi = false;
    const apiKey = process.env.GUHATEK_API_KEY;
    const apiUrl = process.env.GUHATEK_API_URL;

    // Log configuration status (once per request roughly)
    if (!apiKey) {
        console.error('❌ GUHATEK_API_KEY is missing in .env');
    }

    return { apiUrl, apiKey, useMockApi };
};

// Token caching variables
let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;
const TOKEN_LIFETIME_MS = 50 * 60 * 1000; // 50 minutes

export const guhatekApi = {
    /**
     * Clears the cached authentication token.
     */
    clearCache() {
        cachedToken = null;
        tokenExpiryTime = null;
    },

    /**
     * Fetches a short-lived authentication token using the API key.
     */
    async getAuthToken(): Promise<string> {
        const { apiUrl, apiKey, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Token');
            return 'mock-token-' + Date.now();
        }

        // Return cached token if valid
        if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
            return cachedToken;
        }

        if (!apiUrl || !apiKey) {
            throw new Error('GUHATEK_API_URL or GUHATEK_API_KEY is not configured');
        }

        try {
            console.log('Fetching new auth token from:', `${apiUrl}/api/token`);
            const response = await fetch(`${apiUrl}/api/token`, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Token verification failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText,
                    url: `${apiUrl}/api/token`,
                    apiKeyProvided: !!apiKey
                });

                // Check if it's a 404 (common if URL is wrong)
                if (response.status === 404) {
                    throw new Error(`Network Error: Endpoint not found (404) at ${apiUrl}/api/token. Check GUHATEK_API_URL.`);
                }
                throw new Error(`Failed to fetch token: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();

            // Update cache
            cachedToken = data.token;
            tokenExpiryTime = Date.now() + TOKEN_LIFETIME_MS;

            console.log('✅ Auth Token received and cached');
            return data.token;
        } catch (error: any) {
            console.error('❌ Auth Token Fetch Error:', error);
            throw new Error('API_CONNECTION_FAILED: Unable to reach Guhatek API. Check VPN/Proxy settings.');
        }
    },

    /**
     * Fetches the list of applications. 
     */
    async getApplications(): Promise<ExternalApplication[]> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Applications');
            return MOCK_APPLICATIONS;
        }

        if (!apiUrl) {
            console.warn('GUHATEK_API_URL missing.');
            return [];
        }

        let retries = 1;
        while (retries >= 0) {
            try {
                const token = await this.getAuthToken();

                const response = await fetch(`${apiUrl}/api/applications`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    if (response.status >= 500 && retries > 0) {
                        console.warn(`⚠️ Guhatek API 500 Error, retrying... (${retries} left)`);
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }

                    console.error(`❌ Guhatek API Error [${response.status}]:`, errorText);
                    const error: any = new Error(`Failed to fetch applications: ${response.status} ${response.statusText}`);
                    error.status = response.status;
                    throw error;
                }

                const data = await response.json();
                if (Array.isArray(data)) return data;
                if (data.data && Array.isArray(data.data)) return data.data;
                if (data.applications && Array.isArray(data.applications)) return data.applications;

                console.warn('Unexpected API response structure:', data);
                return [];
            } catch (error: any) {
                if (retries > 0 && (!error.status || error.status >= 500)) {
                    retries--;
                    continue;
                }
                console.error('API Error: Fetch applications failed.', error.message);
                throw error;
            }
        }
        return [];
    },

    /**
     * Inserts a new application with resume file.
     */
    async insertApplication(file: File, applicationData: ApplicationInsertData): Promise<ApplicationResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Insert Application');
            return { success: true, id: 'mock-id-' + Date.now() };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const formData = new FormData();
            formData.append('file', file);
            formData.append('applicationData', JSON.stringify(applicationData));

            const response = await fetch(`${apiUrl}/api/applications`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to insert application: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Insert Application Successful. Response:', JSON.stringify(data, null, 2));
            return data;
        } catch (error: any) {
            console.error('❌ Insert Application Error:', error);
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    },

    /**
     * Updates an existing application.
     */
    async updateApplication(id: string, updates: ApplicationUpdateData): Promise<ApplicationResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log(`⚠️ Using MOCK API for Update Application ${id}`);
            return { success: true };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/applications/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update application: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Update Application Successful. Response:', JSON.stringify(data, null, 2));
            return data;
        } catch (error: any) {
            console.error('❌ Update Application Error:', error);
            throw error; // Re-throw to allow fallback logic in routes to work
        }
    },

    /**
     * Deletes an application.
     */
    async deleteApplication(id: string): Promise<ApplicationResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log(`⚠️ Using MOCK API for Delete Application ${id}`);
            return { success: true };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/applications/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete application: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Delete Application Successful. Response:', JSON.stringify(data, null, 2));
            return data;
        } catch (error: any) {
            console.error('❌ Delete Application Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Creates a new job demand/opening.
     */
    async createDemand(jobOpening: JobOpeningData): Promise<DemandResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Create Demand');
            return { success: true, id: 'mock-demand-' + Date.now() };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            // The API expects jobOpening as a JSON string
            const response = await fetch(`${apiUrl}/api/applications/createDemand`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobOpening: JSON.stringify(jobOpening)
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error('❌ Create Demand Failed:', errorData);
                return {
                    success: false,
                    error: errorData.error || 'Bad Request',
                    message: errorData.message,
                    status: response.status
                };
            }

            const data = await response.json();
            console.log('✅ Create Demand Successful. Response:', JSON.stringify(data, null, 2));
            return { success: true, id: data.id };
        } catch (error: any) {
            console.error('❌ Create Demand Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Updates an existing job demand.
     */
    async updateDemand(id: string, updates: DemandUpdateData): Promise<DemandResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log(`⚠️ Using MOCK API for Update Demand ${id}`);
            return { success: true, updated: {} as any };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/applications/${id}/updateDemand`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error('❌ Update Demand Failed:', errorData);
                return {
                    success: false,
                    error: errorData.error,
                    message: errorData.message,
                    status: response.status
                };
            }

            const data = await response.json();
            console.log('✅ Update Demand Successful. Response:', JSON.stringify(data, null, 2));
            return { success: true, updated: data.updated };
        } catch (error: any) {
            console.error('❌ Update Demand Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Deletes a job demand.
     */
    async deleteDemand(id: string): Promise<DemandResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log(`⚠️ Using MOCK API for Delete Demand ${id}`);
            return { success: true };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/applications/${id}/deleteDemand`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error('❌ Delete Demand Failed:', errorData);
                return {
                    success: false,
                    error: errorData.error,
                    message: errorData.message,
                    status: response.status
                };
            }

            const data = await response.json();
            console.log('✅ Delete Demand Successful. Response:', JSON.stringify(data, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('❌ Delete Demand Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetches all job openings.
     */
    async getJobOpenings(): Promise<JobOpening[]> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Job Openings');
            return []; // Or return mock job openings if necessary
        }

        if (!apiUrl) {
            console.warn('GUHATEK_API_URL missing.');
            return [];
        }

        let retries = 1;
        while (retries >= 0) {
            try {
                const token = await this.getAuthToken();

                const response = await fetch(`${apiUrl}/api/applications/jobOpenings`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status >= 500 && retries > 0) {
                        console.warn(`⚠️ Guhatek API 500 Error (Job Openings), retrying... (${retries} left)`);
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }

                    const errorMsg = `Failed to fetch job openings: ${response.status} ${response.statusText}`;
                    const error: any = new Error(errorMsg);
                    error.status = response.status;
                    throw error;
                }

                const data = await response.json();
                if (Array.isArray(data)) return data;
                if (data.data && Array.isArray(data.data)) return data.data;
                if (data.jobOpenings && Array.isArray(data.jobOpenings)) return data.jobOpenings;

                console.warn('Unexpected API response structure:', data);
                return [];
            } catch (error: any) {
                if (retries > 0 && (!error.status || error.status >= 500)) {
                    retries--;
                    continue;
                }
                if (error.status === 404) {
                    console.warn(`⚠️ api/applications/jobOpenings 404 - Falling back to local DB`);
                } else {
                    console.error('❌ Fetch Job Openings Error:', error.message);
                }
                throw error;
            }
        }
        return [];
    },

    /**
     * Schedules an interview meeting.
     */
    async scheduleMeet(meetingData: ScheduleMeetingData): Promise<MeetingResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Schedule Meet');
            return { success: true, id: 'mock-meet-' + Date.now() };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/applications/scheduleMeet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    scheduleMeeting: JSON.stringify(meetingData)
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error('❌ Schedule Meeting Failed:', errorData);
                return {
                    success: false,
                    error: errorData.error || 'Bad Request',
                    message: errorData.message,
                    status: response.status
                };
            }

            const data = await response.json();
            console.log('✅ Schedule Meeting Successful. Response:', JSON.stringify(data, null, 2));
            return { success: true, id: data.id };
        } catch (error: any) {
            console.error('❌ Schedule Meeting Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Updates an existing scheduled meeting.
     */
    async updateMeet(id: string, updates: MeetingUpdateData): Promise<MeetingResponse> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log(`⚠️ Using MOCK API for Update Meet ${id}`);
            return { success: true, updated: {} as any };
        }

        if (!apiUrl) {
            return { success: false, error: 'API URL not configured' };
        }

        try {
            const token = await this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/applications/${id}/updateMeet`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error('❌ Update Meeting Failed:', errorData);
                return {
                    success: false,
                    error: errorData.error,
                    message: errorData.message,
                    status: response.status
                };
            }

            const data = await response.json();
            console.log('✅ Update Meeting Successful. Response:', JSON.stringify(data, null, 2));
            return { success: true, updated: data.updated };
        } catch (error: any) {
            console.error('❌ Update Meeting Error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Fetches all scheduled meetings.
     */
    async getScheduledMeetings(): Promise<ScheduledMeeting[]> {
        const { apiUrl, useMockApi } = getConfig();

        if (useMockApi) {
            console.log('⚠️ Using MOCK API for Get Scheduled Meetings');
            return [];
        }

        if (!apiUrl) {
            console.warn('GUHATEK_API_URL missing.');
            return [];
        }

        let retries = 1;
        while (retries >= 0) {
            try {
                const token = await this.getAuthToken();

                const response = await fetch(`${apiUrl}/api/applications/scheduleMeet`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    if (response.status >= 500 && retries > 0) {
                        console.warn(`⚠️ Guhatek API 500 Error (Schedule Meet), retrying... (${retries} left)`);
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }

                    const errorMsg = `Failed to fetch scheduled meetings: ${response.status} ${response.statusText}`;
                    const error: any = new Error(errorMsg);
                    error.status = response.status;
                    throw error;
                }

                const data = await response.json();
                if (Array.isArray(data)) return data;
                if (data.data && Array.isArray(data.data)) return data.data;
                if (data.meetings && Array.isArray(data.meetings)) return data.meetings;

                console.warn('Unexpected API response structure:', data);
                return [];
            } catch (error: any) {
                if (retries > 0 && (!error.status || error.status >= 500)) {
                    retries--;
                    continue;
                }
                if (error.status === 404) {
                    console.warn(`⚠️ api/applications/scheduleMeet 404 - Falling back to local DB`);
                } else {
                    console.error('❌ Fetch Scheduled Meetings Error:', error.message);
                }
                throw error;
            }
        }
        return [];
    }

};

const MOCK_APPLICATIONS: ExternalApplication[] = [
    { id: '1', name: 'Alice Mock', email: 'alice@example.com', phone: '1234567890', role: 'Frontend Dev', status: 'Applied', resume_url: '#', applied_at: new Date().toISOString() },
    { id: '2', name: 'Bob Mock', email: 'bob@example.com', phone: '0987654321', role: 'Backend Dev', status: 'Interviewing', resume_url: '#', applied_at: new Date().toISOString() },
];

export interface ApplicationInsertData {
    fullName: string;
    email: string;
    contactNumber: string;
    linkedinProfile?: string;
    interestedPosition: string;
    currentRole?: string;
    currentOrganization?: string;
    totalExperience?: number;
    currentLocation?: string;
    locationPreference?: string;
    currentCTC?: number;
    expectedCTC?: number;
    noticePeriod?: string;
    currentlyInNotice?: boolean;
    immediateJoiner?: boolean;
    otherOffersInHand?: boolean;
    certifications?: string;
    referredBy?: string;
    additionalInfo?: string;
    submittedAt?: string;

    initialScreening?: string;
    round1Dt?: string;
    round1Feedback?: string;
    round2Dt?: string;
    round2Feedback?: string;
    offeredPosition?: string;
    joiningDate?: string;
    rejectMailSent?: boolean;
    canAdminEdit?: boolean;
    screenedBy?: string;
    actions?: string;
}

export interface ApplicationUpdateData {
    initial_screening?: string;
    round1_dt?: string;
    round1_feedback?: string;
    round2_dt?: string;
    round2_feedback?: string;
    offered_position?: string;
    joining_date?: string;
    reject_mail_sent?: boolean;
    can_admin_edit?: boolean;
    screened_by?: string;
    actions?: string;
    application_status?: string;
    interview_status?: string;
    [key: string]: any; // Allow other fields for flexibility
}

export interface ApplicationResponse {
    success: boolean;
    id?: string;
    updated?: any;
    error?: string;
}

// Job Demand Interfaces
export interface JobOpeningData {
    jobTitle: string;
    role: string;
    experience: string;
    location: string;
    numberOfOpenings: number;
    requireSkill: string[];
}

export interface DemandUpdateData {
    jobStatus?: 'Open' | 'Closed' | 'On Hold';
    numberOfOpenings?: number;
    [key: string]: any;
}

export interface JobOpening {
    id: string;
    job_title: string;
    role: string;
    experience: string;
    location: string;
    number_of_openings: number;
    required_skills: string[];
    status: string;
    created_at: string;
    updated_at: string;
}

// Interview Scheduling Interfaces
export interface ScheduleMeetingData {
    position: string;
    interviewRound: string;
    interviewDate: string;
    interviewTime: string;
    interviewerName: string;
    meetLink: string;
}

export interface MeetingUpdateData {
    position?: string;
    interviewRound?: string;
    interviewDate?: string;
    interviewTime?: string;
    interviewerName?: string;
    meetLink?: string;
    [key: string]: any;
}

export interface ScheduledMeeting {
    id: string;
    position: string;
    interview_round: string;
    interview_date: string;
    interview_time: string;
    interviewer_name: string;
    meet_link: string;
    created_at: string;
    updated_at: string;
}

export interface DemandResponse {
    success: boolean;
    id?: string;
    updated?: JobOpening;
    error?: string;
    message?: string;
    status?: number;
}

export interface MeetingResponse {
    success: boolean;
    id?: string;
    updated?: ScheduledMeeting;
    error?: string;
    message?: string;
    status?: number;
}
