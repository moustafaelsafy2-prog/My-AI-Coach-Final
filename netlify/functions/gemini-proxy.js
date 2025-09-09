// Netlify serverless function
// This code runs on Netlify's servers, not in the user's browser.

exports.handler = async function (event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Get the prompt from the request body sent by the front-end
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: 'Bad Request: Missing prompt.' };
        }

        // Securely get the API key from the environment variables set in Netlify UI
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { statusCode: 500, body: 'Server error: API key not configured.' };
        }
        
        const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            // Optional: Add safety settings if needed
            // safetySettings: [ ... ],
        };

        // Call the Google AI API
        const response = await fetch(googleApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Google AI API Error:', errorBody);
            return { statusCode: response.status, body: `Error from Google AI: ${errorBody}` };
        }

        const data = await response.json();
        
        // Extract the text from the response
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Send the AI's response back to the front-end
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text }),
        };

    } catch (error) {
        console.error('Proxy Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.' }),
        };
    }
};

