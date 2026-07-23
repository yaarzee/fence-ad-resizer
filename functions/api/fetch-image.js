export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: "URL query parameter is required." }), {
            status: 400,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    try {
        // Fetch the image from target URL
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ error: `Failed to fetch image: ${response.statusText}` }), {
                status: response.status,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // Return the image directly
        const headers = new Headers(response.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        
        return new Response(response.body, {
            status: 200,
            headers: headers
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: `Fetch failed: ${err.message}` }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
