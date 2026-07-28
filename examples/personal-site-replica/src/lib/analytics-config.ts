export const ANALYTICS_CONFIG = {
  productionHostnames: ['briansunter.com', 'www.briansunter.com'],
  eventPrivacy: {
    blockedKeys: ['q', 'query', 'search', 'search_query', 'term', 'keyword'],
    maxValueLength: 160,
    sensitiveKeyPattern:
      /(^|_)(email|mail|token|secret|password|pass|message|raw_error|error_message)($|_)/i,
  },
  globals: {
    beforeUmamiSend: '__bsBeforeUmamiSend',
    initialized: '__siteAnalyticsInitialized',
    outboundClicksBound: '__siteAnalyticsOutboundClicksBound',
    pageviewsBound: '__siteAnalyticsPageviewsBound',
    scrollDepthBound: '__siteAnalyticsScrollDepthBound',
    scriptsLoaded: '__siteAnalyticsLoaded',
    zarazGuardBound: '__siteAnalyticsZarazGuardBound',
  },
  loading: {
    fallbackDelayMs: 2000,
    idleTimeoutMs: 3000,
  },
  umami: {
    scriptUrl: 'https://a.briansunter.com/t.js',
    websiteId: '6057e771-635b-44ae-aa82-a527ca44bab1',
  },
} as const;

export function getAnalyticsDomains() {
  return ANALYTICS_CONFIG.productionHostnames.join(',');
}

export function getUmamiScriptAttributes(): Record<string, string> {
  return {
    'data-before-send': ANALYTICS_CONFIG.globals.beforeUmamiSend,
    'data-domains': getAnalyticsDomains(),
    'data-exclude-hash': 'true',
    'data-performance': 'true',
    'data-website-id': ANALYTICS_CONFIG.umami.websiteId,
  };
}
