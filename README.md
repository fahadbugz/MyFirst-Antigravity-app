# BigQuery Release Insights Web Application

A sleek, responsive, single-page web application that fetches, parses, and formats the official Google BigQuery release notes. It enables developers to stay updated and easily tweet about specific updates using customizable style templates and an accurate Twitter-compliant character counter.

---

## 🚀 Key Features

*   **Atom Feed Integration**: Connects to the official Google Cloud BigQuery release feed and parses updates in real-time.
*   **Granular Update Segmenter**: Splits grouped daily releases into atomic cards categorized as **Features**, **Issues**, or **Deprecations**.
*   **In-Memory Caching**: Automatically caches feed content locally for 10 minutes to minimize network latency and prevent rate-limiting, with support for manual, force-refresh triggers.
*   **Interactive Toolbar**: Enables instant keyword searching and tag filtering.
*   **Multi-Select Selector**: Supports checking multiple updates across dates to compile them into a unified tweet summary.
*   **Stylized Tweet Composer**: Pre-formats drafts with four template styles (🔥 *Hype*, 💻 *Developer*, 📝 *Minimal*, 👔 *Corporate*).
*   **t.co Compliant Counter**: Accurately computes remaining characters by treating all web links as exactly 23 characters, mirroring Twitter/X's official behavior.

---

## 🛠 Tech Stack

*   **Backend**: Python Flask (version 3)
*   **HTML**: Vanilla HTML5 structure with native inline SVG graphics
*   **CSS**: Vanilla CSS3 featuring glassmorphism cards, blur spheres, animations, and responsive breakpoints
*   **JavaScript**: Vanilla ES6 controller (event listeners, state objects, relative time trackers)
*   **Parsing**: Python `xml.etree.ElementTree` & `BeautifulSoup` (bs4)

---

## 📁 Project Directory Structure

```
bq-releases-notes/
├── app.py                # Flask server, Atom XML parser, and caching logic
├── templates/
│   └── index.html        # HTML layout, filter widgets, drawer, and modal markup
├── static/
│   ├── css/
│   │   └── style.css     # CSS style tokens, layouts, transitions, and theme variables
│   └── js/
│       └── main.js       # JS app controller, state manager, search engine, and tweet logic
├── .gitignore            # Excludes python cache, virtual environments, and IDE layouts
└── README.md             # Project documentation (this file)
```

---

## 🏃 Quick Start Guide

### 1. Prerequisites
Make sure Python 3 is installed. You will need `Flask`, `requests`, and `beautifulsoup4` libraries.

If you don't have them installed, install them via `pip`:
```bash
pip install Flask requests beautifulsoup4
```

### 2. Run the Application
From the project root directory, launch the Flask server:
```bash
python app.py
```

### 3. Open in Browser
Once running, open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🔍 How the Twitter URL Length Logic Works
Twitter automatically shortens all URLs using its `t.co` service. This means a link counts as exactly **23 characters**, regardless of its actual length.

To prevent tweets from being blocked or cut off when posted, the frontend calculates text length using this custom character counter inside [main.js](file:///D:/MyProject/Kaggle/Day2/agy-cli-projects/bq-releases-notes/static/js/main.js):

```javascript
function calculateTwitterLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let length = text.length;
    const urls = text.match(urlRegex);
    if (urls) {
        for (const url of urls) {
            length = length - url.length + 23;
        }
    }
    return length;
}
```
If the adjusted character length exceeds **280 characters**, the text box highlights in red and the "Post to X" action is safely disabled.
