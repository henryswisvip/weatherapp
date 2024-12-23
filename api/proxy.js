import fetch from 'node-fetch';

export default async function handler(req, res) {
    const scriptURL = 'https://script.google.com/macros/s/AKfycbzQPjdY8g0ehiVzXJy-qA48Vlzr15gMh5hxb6962OxGx7dmCP0nRgU0njEZLzF8DnBILw/exec'; // Replace YOUR_SCRIPT_ID
    
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
