export async function onRequest(context) {
    const { request, env } = context;
    
    // Check CORS preflight (OPTIONS)
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Only POST requests are allowed." }), {
            status: 405,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    try {
        const reqData = await request.json();
        const { prompt, image } = reqData;

        if (!prompt || !image) {
            return new Response(JSON.stringify({ error: "Prompt and image are required." }), {
                status: 400,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // Retrieve the API key from environment variables
        const geminiApiKey = env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured on Cloudflare Pages settings. Please add it to your environment variables." }), {
                status: 500,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // Extract raw base64 data and mime type from data URL if present
        let mimeType = "image/jpeg";
        let base64Data = image;
        if (image.includes(",")) {
            const parts = image.split(",", 2);
            base64Data = parts[1];
            const header = parts[0];
            if (header.includes("data:") && header.includes(";base64")) {
                mimeType = header.split(";")[0].replace("data:", "");
            }
        }

        // Call Gemini API (using gemini-3.1-flash-image which supports native image editing/generation)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${geminiApiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"]
            }
        };

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            return new Response(JSON.stringify({ error: `Gemini API error: ${errText}` }), {
                status: response.status,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const resData = await response.json();
        const candidates = resData.candidates || [];
        if (candidates.length === 0) {
            throw new Error("Gemini returned an empty response. The prompt may have violated safety policies.");
        }

        const content = candidates[0].content || {};
        const parts = content.parts || [];
        if (parts.length === 0) {
            const finishReason = candidates[0].finishReason;
            if (finishReason === "SAFETY") {
                throw new Error("Gemini blocked the request due to safety concerns. Please try a different image or prompt.");
            }
            throw new Error(`Gemini did not return any content parts. Finish reason: ${finishReason}`);
        }

        // Find inline image in the response parts
        let editedImageBase64 = null;
        let resultMime = "image/jpeg";
        for (const part of parts) {
            if (part.inlineData) {
                editedImageBase64 = part.inlineData.data;
                resultMime = part.inlineData.mimeType || "image/jpeg";
                break;
            }
        }

        if (!editedImageBase64) {
            if (parts.length > 0 && parts[0].text) {
                throw new Error(`Gemini returned text feedback instead of an image: ${parts[0].text}`);
            }
            throw new Error("No image data was found in the Gemini response.");
        }

        return new Response(JSON.stringify({
            image: `data:${resultMime};base64,${editedImageBase64}`,
            mimeType: resultMime
        }), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
