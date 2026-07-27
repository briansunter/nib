<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes" />
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title><xsl:value-of select="/rss/channel/title" /> &#8211; RSS Feed</title>
        <style>
          :root {
            color-scheme: light dark;
            --bg: #f5f1ea;
            --surface: #fff;
            --ink: #1c1c1c;
            --ink-secondary: #5a5a5a;
            --accent: #b85c3a;
            --border: #e2dccf;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #1a1815;
              --surface: #221f1b;
              --ink: #f0ebe2;
              --ink-secondary: #b9b3a6;
              --accent: #d97a55;
              --border: #3a3530;
            }
          }
          html, body {
            margin: 0;
            padding: 0;
            background: var(--bg);
            color: var(--ink);
            font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          }
          a { color: var(--accent); text-decoration: none; }
          a:hover { text-decoration: underline; }
          .wrap { max-width: 720px; margin: 0 auto; padding: 3rem 1.5rem 4rem; }
          .banner {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
            margin-bottom: 2rem;
            color: var(--ink-secondary);
            font-size: 0.875rem;
          }
          .banner strong { color: var(--ink); }
          .subscribe {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.75rem;
          }
          .subscribe a {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.4rem 0.75rem;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            background: var(--bg);
            color: var(--ink);
            font-size: 0.8rem;
            text-decoration: none;
          }
          .subscribe a:hover {
            border-color: var(--accent);
            color: var(--accent);
          }
          .subscribe code {
            display: block;
            margin-top: 0.6rem;
            padding: 0.4rem 0.6rem;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 0.4rem;
            font-size: 0.75rem;
            word-break: break-all;
            color: var(--ink-secondary);
          }
          h1 {
            font-family: "Lora", Georgia, serif;
            font-size: 2.25rem;
            line-height: 1.15;
            margin: 0 0 0.5rem;
          }
          .desc { color: var(--ink-secondary); margin: 0 0 0.5rem; }
          .meta { color: var(--ink-secondary); font-size: 0.85rem; margin: 0 0 2rem; }
          .meta a { color: var(--ink-secondary); text-decoration: underline; }
          ul.items { list-style: none; padding: 0; margin: 0; }
          li.item {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.25rem 1.5rem;
            margin-bottom: 1rem;
            transition: transform 120ms ease, box-shadow 120ms ease;
          }
          li.item:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          }
          .item-title {
            font-family: "Lora", Georgia, serif;
            font-size: 1.25rem;
            line-height: 1.3;
            margin: 0 0 0.35rem;
          }
          .item-meta {
            color: var(--ink-secondary);
            font-size: 0.8rem;
            margin: 0 0 0.6rem;
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          .item-desc { margin: 0; color: var(--ink); }
          .cat {
            display: inline-block;
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--accent);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0.05rem 0.55rem;
          }
        </style>
      </head>
      <body>
        <main class="wrap">
          <div class="banner">
            <strong>This is an RSS feed.</strong> Subscribe in your reader of choice:
            <div class="subscribe">
              <a href="feed://briansunter.com/index.xml">Open in default reader</a>
              <a href="https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fbriansunter.com%2Findex.xml" rel="noopener">Add to Feedly</a>
              <a href="https://www.inoreader.com/?add_feed=https%3A%2F%2Fbriansunter.com%2Findex.xml" rel="noopener">Add to Inoreader</a>
            </div>
            <code>https://briansunter.com/index.xml</code>
          </div>
          <h1><xsl:value-of select="/rss/channel/title" /></h1>
          <p class="desc"><xsl:value-of select="/rss/channel/description" /></p>
          <p class="meta">
            <a><xsl:attribute name="href"><xsl:value-of select="/rss/channel/link" /></xsl:attribute>Visit website</a>
          </p>
          <ul class="items">
            <xsl:for-each select="/rss/channel/item">
              <li class="item">
                <h2 class="item-title">
                  <a>
                    <xsl:attribute name="href"><xsl:value-of select="link" /></xsl:attribute>
                    <xsl:value-of select="title" />
                  </a>
                </h2>
                <p class="item-meta">
                  <span><xsl:value-of select="pubDate" /></span>
                  <xsl:for-each select="category">
                    <span class="cat"><xsl:value-of select="." /></span>
                  </xsl:for-each>
                </p>
                <p class="item-desc"><xsl:value-of select="description" /></p>
              </li>
            </xsl:for-each>
          </ul>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
