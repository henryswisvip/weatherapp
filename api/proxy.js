import fetch from 'node-fetch';

export default async function handler(req, res) {
    const scriptURL = 'https://script.google.com/macros/s/AKfycbxmBAK_XcA0PGw3xR6Eh08_hNRrSYHmbadVyahfS4J7ZdOYt181yAIO8x86HOMNHcDgNA/exec'; // Replace YOUR_SCRIPT_ID
    
    try {
        // Forward the request to Google Apps Script
        const response = await fetch(scriptURL, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...(req.headers || {}) // Pass through any custom headers
            },
            body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
        });

        // Parse the response
        const data = await response.json();

        // Return the response to the client
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ status: 'error', message: 'Proxy error', error: error.message });
    }
}
