const apiRequest = async (endpoint: string, body: object) => {
    const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
        throw new Error(errorData.error || 'API request failed');
    }

    return response.json();
};

export const transcribeVideo = (params: any) => apiRequest('transcribe', params);
export const generateTimecodedCaptions = (params: any) => apiRequest('captions', params);
export const generateGuide = async (params: any) => {
    const data = await apiRequest('generate-guide', params);
    return data.content;
};
export const rewriteText = async (params: any) => {
    const data = await apiRequest('rewrite', params);
    return data.rewrittenText;
};
export const generateSummary = async (params: any) => {
    const data = await apiRequest('summarize', params);
    return data.summary;
};
