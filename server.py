import http.server
import json
import urllib.request
import urllib.error
import os
import mimetypes

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching so the browser always gets the latest files
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/api/fetch-image'):
            import urllib.parse
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            image_url = query_params.get('url', [None])[0]
            
            if not image_url:
                self.send_error_response(400, "URL query parameter is required.")
                return
                
            try:
                # Fetch image from URL
                req = urllib.request.Request(
                    image_url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                )
                with urllib.request.urlopen(req) as response:
                    content_type = response.headers.get('Content-Type', 'image/jpeg')
                    image_data = response.read()
                    
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(image_data)
            except Exception as e:
                self.send_error_response(500, f"Failed to fetch image: {str(e)}")
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/edit-image':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                # Parse request data
                req_data = json.loads(post_data.decode('utf-8'))
                prompt = req_data.get('prompt')
                image_data_url = req_data.get('image') # base64 data url or raw base64
                
                if not prompt:
                    self.send_error_response(400, "Prompt is required.")
                    return
                if not image_data_url:
                    self.send_error_response(400, "Image data is required.")
                    return
                
                # Extract raw base64 data and mime type from data URL if present
                mime_type = "image/jpeg"
                base64_data = image_data_url
                if "," in image_data_url:
                    header, base64_data = image_data_url.split(",", 1)
                    if "data:" in header and ";base64" in header:
                        mime_type = header.split(";")[0].replace("data:", "")
                
                # Retrieve Gemini API key from env or .env file
                gemini_api_key = os.environ.get('GEMINI_API_KEY')
                if not gemini_api_key and os.path.exists('.env'):
                    with open('.env', 'r', encoding='utf-8') as f:
                        for line in f:
                            cleaned = line.strip()
                            if cleaned.startswith('GEMINI_API_KEY='):
                                gemini_api_key = cleaned.split('=', 1)[1].strip('"').strip("'").strip()
                                break
                
                if not gemini_api_key:
                    print("Error: GEMINI_API_KEY not found in environment variables or .env file.")
                    self.send_error_response(500, "GEMINI_API_KEY environment variable is not configured on the server. Please check the README.")
                    return
                
                # Use gemini-3.1-flash-image which supports native image generation and editing
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key={gemini_api_key}"
                
                payload = {
                    "contents": [{
                        "parts": [
                            {"text": f"Edit this image as requested. Return ONLY the edited image: {prompt}"},
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": base64_data
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "responseModalities": ["TEXT", "IMAGE"]
                    }
                }
                
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                
                try:
                    with urllib.request.urlopen(req) as response:
                        res_data = json.loads(response.read().decode('utf-8'))
                        
                        candidates = res_data.get('candidates', [])
                        if not candidates:
                            raise ValueError("Gemini returned an empty response. The prompt may have violated safety policies.")
                        
                        content = candidates[0].get('content', {})
                        parts = content.get('parts', [])
                        if not parts:
                            # Check for safety rating blocking
                            finish_reason = candidates[0].get('finishReason')
                            if finish_reason == 'SAFETY':
                                raise ValueError("Gemini blocked the request due to safety concerns. Please modify your prompt.")
                            raise ValueError(f"Gemini did not return any content parts. Finish reason: {finish_reason}")
                        
                        # Find the inline image in the response parts
                        edited_image_base64 = None
                        result_mime = 'image/jpeg'
                        for part in parts:
                            if 'inlineData' in part:
                                edited_image_base64 = part['inlineData'].get('data')
                                result_mime = part['inlineData'].get('mimeType', 'image/jpeg')
                                break
                        
                        if not edited_image_base64:
                            # Check if the model returned text instead of an image
                            if len(parts) > 0 and 'text' in parts[0]:
                                raise ValueError(f"Gemini returned text feedback instead of an image: {parts[0]['text']}")
                            raise ValueError("No image data was found in the Gemini response.")
                        
                        # Return base64 image back to client
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'image': f"data:{result_mime};base64,{edited_image_base64}",
                            'mimeType': result_mime
                        }).encode('utf-8'))
                        
                except urllib.error.HTTPError as e:
                    err_msg = e.read().decode('utf-8')
                    try:
                        err_json = json.loads(err_msg)
                        err_detail = err_json.get('error', {}).get('message', err_msg)
                    except:
                        err_detail = err_msg
                    print(f"Gemini API HTTP Error: {err_detail}")
                    self.send_error_response(500, f"Gemini API Error: {err_detail}")
                    
            except Exception as e:
                print(f"Error handling /api/edit-image: {str(e)}")
                self.send_error_response(500, str(e))
        else:
            self.send_response(404)
            self.end_headers()

    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': message}).encode('utf-8'))

def run(server_class=http.server.HTTPServer, handler_class=CustomHandler):
    server_address = ('', PORT)
    httpd = server_class(server_address, handler_class)
    print(f"Secure dev server running at http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
