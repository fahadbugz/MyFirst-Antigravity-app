from flask import Flask, jsonify, request, render_template
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import datetime
import os

app = Flask(__name__)

# Simple in-memory cache
feed_cache = {
    "data": None,
    "last_updated": None
}

CACHE_EXPIRY_MINUTES = 10
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_feed():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
    except Exception as e:
        # Return none to signal failure, caller can decide to use expired cache or raise error
        print(f"Error fetching feed: {e}")
        return None

    try:
        xml_data = response.content
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(xml_data)
        entries = root.findall('atom:entry', namespaces)
        
        parsed_entries = []
        for entry in entries:
            title_el = entry.find('atom:title', namespaces)
            date_str = title_el.text if title_el is not None else "Unknown Date"
            
            updated_el = entry.find('atom:updated', namespaces)
            updated_time = updated_el.text if updated_el is not None else ""
            
            link_el = entry.find('atom:link[@rel="alternate"]', namespaces)
            if link_el is None:
                link_el = entry.find('atom:link', namespaces)
            link_href = link_el.attrib.get('href', '') if link_el is not None else ""
            
            content_el = entry.find('atom:content', namespaces)
            content_html = content_el.text if content_el is not None else ""
            
            # Parse individual updates from within the entry content
            # The HTML typically has structure like: <h3>Feature</h3> <p>...</p> <h3>Issue</h3> <p>...</p>
            soup = BeautifulSoup(content_html, 'html.parser')
            updates = []
            
            current_type = 'General'
            current_elements = []
            
            for child in soup.contents:
                if child.name == 'h3':
                    if current_elements:
                        html_str = "".join(str(el) for el in current_elements)
                        text_str = "".join(el.get_text() if hasattr(el, 'get_text') else str(el) for el in current_elements).strip()
                        if text_str:
                            updates.append({
                                'type': current_type,
                                'content_html': html_str,
                                'content_text': text_str
                            })
                        current_elements = []
                    current_type = child.get_text().strip()
                else:
                    if child.name or (isinstance(child, str) and child.strip()):
                        current_elements.append(child)
            
            # Save the last update segment
            if current_elements:
                html_str = "".join(str(el) for el in current_elements)
                text_str = "".join(el.get_text() if hasattr(el, 'get_text') else str(el) for el in current_elements).strip()
                if text_str:
                    updates.append({
                        'type': current_type,
                        'content_html': html_str,
                        'content_text': text_str
                    })
            
            # If no parsed updates were found, put the entire content as General
            if not updates and content_html.strip():
                updates.append({
                    'type': 'General',
                    'content_html': content_html,
                    'content_text': soup.get_text().strip()
                })
                
            parsed_entries.append({
                'date': date_str,
                'updated': updated_time,
                'link': link_href,
                'updates': updates
            })
            
        return parsed_entries
    except Exception as e:
        print(f"Error parsing feed: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
    now = datetime.datetime.now()
    
    # Check if cache is valid
    cache_valid = False
    if feed_cache["data"] is not None and feed_cache["last_updated"] is not None:
        elapsed = (now - feed_cache["last_updated"]).total_seconds() / 60.0
        if elapsed < CACHE_EXPIRY_MINUTES:
            cache_valid = True
            
    if not cache_valid or force_refresh:
        data = parse_release_feed()
        if data is not None:
            feed_cache["data"] = data
            feed_cache["last_updated"] = now
        else:
            # If fetch/parse failed, fallback to cache if available
            if feed_cache["data"] is not None:
                return jsonify({
                    "releases": feed_cache["data"],
                    "last_updated": feed_cache["last_updated"].isoformat(),
                    "warning": "Failed to fetch live feed. Serving cached data."
                })
            else:
                return jsonify({"error": "Failed to fetch and parse release notes feed."}), 500
                
    return jsonify({
        "releases": feed_cache["data"],
        "last_updated": feed_cache["last_updated"].isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
