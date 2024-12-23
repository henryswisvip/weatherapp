import fetch from 'node-fetch';

export default async function handler(req, res) {
    const scriptURL = 'https://script.google.com/macros/s/AKfycbwnIsmCBJnpEEA0sJZ6Gq7X1i5hBSp9fVE953KW2arZIVmKby7rduFNbmOh1wlYh9eNfQ/exec'; // Replace with your script URL

    try {
        console.log("Proxy Request - Method:", req.method);
        console.log("Proxy Request - Headers:", req.headers);
        console.log("Proxy Request - Body:", req.body);

        // Forward the request to Google Apps Script
        const response = await fetch(scriptURL, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
        });

        console.log("Google Apps Script Response Status:", response.status);

        // Check if response is JSON
        const responseText = await response.text();
        console.log("Google Apps Script Raw Response:", responseText);

        try {
            const responseData = JSON.parse(responseText);
            res.status(response.status).json(responseData); // Return parsed JSON
        } catch (jsonError) {
            console.error("Failed to parse response as JSON:", jsonError);
            res.status(response.status).send(responseText); // Return raw text if JSON parsing fails
        }
    } catch (error) {
        console.error("Proxy Server Error:", error);
        res.status(500).json({ status: 'error', message: 'Proxy error', details: error.message });
    }
}
