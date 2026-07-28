import { registerAstroLifecycle } from '../utils/astroLifecycle';
import { ANALYTICS_CONFIG, getUmamiScriptAttributes } from './analytics-config';

const UMAMI_SCRIPT_URL = ANALYTICS_CONFIG.umami.scriptUrl;

const ANALYTICS_HOSTNAMES = new Set<string>(
  ANALYTICS_CONFIG.productionHostnames,
);
const BLOCKED_EVENT_KEYS = new Set<string>(
  ANALYTICS_CONFIG.eventPrivacy.blockedKeys,
);
const SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 100] as const;
const OUTBOUND_DOMAIN_CATEGORIES: Record<string, readonly string[]> = {
  code: ['github.com', 'gitlab.com'],
  docs: ['developer.mozilla.org', 'docs.astro.build', 'docs.umami.is'],
  newsletter: ['substack.com'],
  social: [
    'bsky.app',
    'instagram.com',
    'linkedin.com',
    'mastodon.social',
    'threads.net',
    'twitter.com',
    'x.com',
    'youtube.com',
    'youtu.be',
  ],
  support: ['buymeacoffee.com', 'ko-fi.com', 'patreon.com'],
};

let scrollDepthFrame: number | null = null;
let trackedScrollDepths = new Set<number>();
let trackedScrollPagePath = '';

export type AnalyticsEventDataValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export type AnalyticsEventData = Record<string, AnalyticsEventDataValue>;

type SanitizedAnalyticsEventData = Record<string, string | number>;
type UmamiPayload = Record<string, unknown> & {
  data?: AnalyticsEventData;
  referrer?: string;
  title?: string;
  url?: string;
};

type AstroBeforeSwapEvent = Event & {
  newDocument?: Document;
};

declare global {
  interface Window {
    __bsBeforeUmamiSend?: (
      type: string,
      payload: UmamiPayload,
    ) => false | UmamiPayload;
    __siteAnalyticsInitialized?: boolean;
    __siteAnalyticsLoaded?: boolean;
    __siteAnalyticsOutboundClicksBound?: boolean;
    __siteAnalyticsPageviewsBound?: boolean;
    __siteAnalyticsScrollDepthBound?: boolean;
    __siteAnalyticsZarazGuardBound?: boolean;
    umami?: {
      track: (
        eventOrPayload: string | Record<string, unknown>,
        data?: SanitizedAnalyticsEventData,
      ) => void;
    };
  }
}

export function isAllowedAnalyticsHostname(hostname = getCurrentHostname()) {
  return ANALYTICS_HOSTNAMES.has(hostname);
}

// Respect the Global Privacy Control signal: when the visitor's browser opts
// out, suppress analytics loading and every send. https://globalprivacycontrol.org/
export function isGlobalPrivacyControlEnabled(): boolean {
  return (
    isBrowser() &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

export function sanitizeUrlForAnalytics(rawUrl: string): string {
  if (!isBrowser()) return '/';

  const parsedUrl = safeParseUrl(rawUrl);
  if (!parsedUrl) return window.location.pathname || '/';

  return formatTrackedUrl(parsedUrl);
}

export function sanitizeEventData(
  data: AnalyticsEventData = {},
): SanitizedAnalyticsEventData {
  const sanitized: SanitizedAnalyticsEventData = {};

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.trim();
    if (!normalizedKey || isSensitiveEventKey(normalizedKey)) continue;
    if (value === null || value === undefined) continue;

    if (typeof value === 'string') {
      const normalizedValue = value.trim();
      if (!normalizedValue) continue;
      sanitized[normalizedKey] = normalizedValue.slice(
        0,
        ANALYTICS_CONFIG.eventPrivacy.maxValueLength,
      );
      continue;
    }

    if (typeof value === 'number') {
      if (Number.isFinite(value)) sanitized[normalizedKey] = value;
      continue;
    }

    if (typeof value === 'boolean') {
      sanitized[normalizedKey] = value ? 'true' : 'false';
    }
  }

  return sanitized;
}

export function beforeUmamiSend(
  _type: string,
  payload: UmamiPayload,
): false | UmamiPayload {
  if (!isAllowedAnalyticsHostname() || isGlobalPrivacyControlEnabled()) {
    return false;
  }

  const sanitizedPayload: UmamiPayload = { ...payload };

  if (typeof payload.url === 'string') {
    sanitizedPayload.url = sanitizeUrlForAnalytics(payload.url);
  }

  if (typeof payload.referrer === 'string') {
    sanitizedPayload.referrer = sanitizeReferrerForAnalytics(payload.referrer);
  }

  if (payload.data && typeof payload.data === 'object') {
    sanitizedPayload.data = sanitizeEventData(payload.data);
  }

  return sanitizedPayload;
}

export function trackEvent(name: string, data?: AnalyticsEventData): boolean {
  if (
    !isBrowser() ||
    !isAllowedAnalyticsHostname() ||
    isGlobalPrivacyControlEnabled()
  ) {
    return false;
  }

  const tracker = window.umami;
  if (!tracker || typeof tracker.track !== 'function') return false;

  const sanitizedData = sanitizeEventData(data);
  if (Object.keys(sanitizedData).length > 0) {
    tracker.track(name, sanitizedData);
  } else {
    tracker.track(name);
  }

  return true;
}

export function initSiteAnalytics() {
  if (!isBrowser()) return;

  window[ANALYTICS_CONFIG.globals.beforeUmamiSend] = beforeUmamiSend;

  if (!isAllowedAnalyticsHostname() || isGlobalPrivacyControlEnabled()) return;

  installZarazClientRouterGuard();
  installEngagementEventTracking();

  if (!window[ANALYTICS_CONFIG.globals.initialized]) {
    window[ANALYTICS_CONFIG.globals.initialized] = true;
  }

  if (window[ANALYTICS_CONFIG.globals.scriptsLoaded]) return;
  window[ANALYTICS_CONFIG.globals.scriptsLoaded] = true;

  scheduleAnalyticsLoad(loadAnalyticsScripts);
}

function loadAnalyticsScripts() {
  const script = appendScript(UMAMI_SCRIPT_URL, getUmamiScriptAttributes());
  script.addEventListener('load', evaluateScrollDepth, { once: true });
}

function installEngagementEventTracking() {
  installScrollDepthTracking();
  installOutboundClickTracking();
}

function installScrollDepthTracking() {
  if (window[ANALYTICS_CONFIG.globals.scrollDepthBound]) return;
  window[ANALYTICS_CONFIG.globals.scrollDepthBound] = true;

  const scheduleScrollDepthCheck = () => {
    if (scrollDepthFrame !== null) return;

    scrollDepthFrame = scheduleAnimationFrame(() => {
      scrollDepthFrame = null;
      evaluateScrollDepth();
    });
  };

  window.addEventListener('scroll', scheduleScrollDepthCheck, {
    passive: true,
  });
  window.addEventListener('resize', scheduleScrollDepthCheck);

  registerAstroLifecycle({
    mount: () => {
      resetScrollDepthForCurrentPage();
      scheduleScrollDepthCheck();
    },
    runImmediately: true,
  });
}

function installOutboundClickTracking() {
  if (window[ANALYTICS_CONFIG.globals.outboundClicksBound]) return;
  window[ANALYTICS_CONFIG.globals.outboundClicksBound] = true;

  document.addEventListener(
    'click',
    (event) => {
      const link = getClickedLink(event);
      if (!link) return;

      const targetUrl = safeParseUrl(link.href);
      if (!targetUrl || !isTrackableOutboundUrl(targetUrl)) return;

      trackEvent(
        'outbound_link_click',
        getOutboundLinkEventData(link, targetUrl),
      );
    },
    { capture: true },
  );
}

function evaluateScrollDepth() {
  const pagePath = getCurrentPagePath();
  if (trackedScrollPagePath !== pagePath) {
    trackedScrollPagePath = pagePath;
    trackedScrollDepths.clear();
  }

  const currentDepth = getCurrentScrollDepthPercent();
  for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
    if (currentDepth < threshold || trackedScrollDepths.has(threshold)) {
      continue;
    }

    if (
      trackEvent('scroll_depth', {
        depth: threshold,
        path: pagePath,
      })
    ) {
      trackedScrollDepths.add(threshold);
    }
  }
}

function resetScrollDepthForCurrentPage() {
  trackedScrollPagePath = getCurrentPagePath();
  trackedScrollDepths = new Set<number>();
}

function getCurrentScrollDepthPercent() {
  const documentElement = document.documentElement;
  const scrollHeight = Math.max(
    documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0,
  );
  const viewportHeight =
    window.innerHeight || documentElement.clientHeight || 0;
  if (scrollHeight <= viewportHeight) return 100;

  const scrollTop =
    window.scrollY ||
    documentElement.scrollTop ||
    document.body?.scrollTop ||
    0;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(((scrollTop + viewportHeight) / scrollHeight) * 100),
    ),
  );
}

function getClickedLink(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return null;

  return target.closest<HTMLAnchorElement>('a[href]');
}

function isTrackableOutboundUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.hostname === window.location.hostname) return false;
  if (isAllowedAnalyticsHostname(url.hostname)) return false;

  return true;
}

function getOutboundLinkEventData(
  link: HTMLAnchorElement,
  url: URL,
): AnalyticsEventData {
  const eventData: AnalyticsEventData = {
    category: getOutboundLinkCategory(link, url),
    domain: normalizeDomain(url.hostname),
    path: getCurrentPagePath(),
  };

  const sourceEvent = link.dataset.umamiEvent?.trim();
  if (sourceEvent) eventData.source_event = sourceEvent;

  const target = link.dataset.umamiEventTarget?.trim();
  if (target) eventData.target = target;

  const platform = link.dataset.umamiEventPlatform?.trim();
  if (platform) eventData.platform = platform;

  const slug = link.dataset.umamiEventSlug?.trim();
  if (slug) eventData.slug = slug;

  return eventData;
}

function getOutboundLinkCategory(link: HTMLAnchorElement, url: URL) {
  const explicitCategory = link.dataset.outboundCategory?.trim();
  if (explicitCategory) return explicitCategory;

  const hostname = normalizeDomain(url.hostname);
  for (const [category, domains] of Object.entries(
    OUTBOUND_DOMAIN_CATEGORIES,
  )) {
    if (domains.some((domain) => hostnameMatches(hostname, domain))) {
      return category;
    }
  }

  return 'external';
}

function hostnameMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeDomain(hostname: string) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

export function removeZarazScriptsFromDocument(doc: Document) {
  let removedCount = 0;

  for (const script of Array.from(doc.querySelectorAll('script'))) {
    if (!isCloudflareZarazScript(script)) continue;
    script.remove();
    removedCount += 1;
  }

  return removedCount;
}

export function markZarazScriptsAsAstroExecuted(doc: Document) {
  let markedCount = 0;

  for (const script of Array.from(doc.querySelectorAll('script'))) {
    if (!isCloudflareZarazScript(script)) continue;
    script.dataset.astroExec = '';
    markedCount += 1;
  }

  return markedCount;
}

function installZarazClientRouterGuard() {
  if (window[ANALYTICS_CONFIG.globals.zarazGuardBound]) return;
  window[ANALYTICS_CONFIG.globals.zarazGuardBound] = true;
  markZarazScriptsAsAstroExecuted(document);

  document.addEventListener('astro:before-swap', (event) => {
    markZarazScriptsAsAstroExecuted(document);

    const newDocument = (event as AstroBeforeSwapEvent).newDocument;
    if (!newDocument) return;

    removeZarazScriptsFromDocument(newDocument);
  });

  document.addEventListener('astro:after-swap', () => {
    markZarazScriptsAsAstroExecuted(document);
  });
}

function isCloudflareZarazScript(script: HTMLScriptElement) {
  const src = script.getAttribute('src') ?? '';
  if (src.includes('/cdn-cgi/zaraz/')) return true;

  const text = script.textContent ?? '';
  return text.includes('zaraz is loaded twice') || text.includes('zarazData');
}

function appendScript(src: string, attributes: Record<string, string> = {}) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;

  for (const [key, value] of Object.entries(attributes)) {
    script.setAttribute(key, value);
  }

  document.head.appendChild(script);
  return script;
}

function scheduleAnalyticsLoad(callback: () => void) {
  const requestIdleCallback =
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback.bind(window)
      : undefined;

  if (requestIdleCallback) {
    requestIdleCallback(callback, {
      timeout: ANALYTICS_CONFIG.loading.idleTimeoutMs,
    });
    return;
  }

  globalThis.setTimeout(callback, ANALYTICS_CONFIG.loading.fallbackDelayMs);
}

function sanitizeReferrerForAnalytics(referrer: string) {
  const parsedUrl = safeParseUrl(referrer);
  if (!parsedUrl) return '';

  return `${parsedUrl.origin}${formatTrackedUrl(parsedUrl)}`;
}

function formatTrackedUrl(url: URL) {
  const params = new URLSearchParams(url.search);
  for (const key of [...params.keys()]) {
    if (isSensitiveEventKey(key)) params.delete(key);
  }
  const query = params.toString();
  return `${url.pathname || '/'}${query ? `?${query}` : ''}`;
}

function scheduleAnimationFrame(callback: FrameRequestCallback) {
  if (typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(Date.now()), 100);
}

function isSensitiveEventKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return (
    BLOCKED_EVENT_KEYS.has(normalizedKey) ||
    ANALYTICS_CONFIG.eventPrivacy.sensitiveKeyPattern.test(normalizedKey)
  );
}

function getCurrentHostname() {
  if (!isBrowser()) return '';
  return window.location.hostname;
}

function getCurrentPagePath() {
  return sanitizeUrlForAnalytics(window.location.href);
}

function safeParseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl, window.location.origin);
  } catch {
    return null;
  }
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
