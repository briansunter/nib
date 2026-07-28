import { trackEvent } from '../lib/analytics';

const DEFAULT_API_URL = 'https://subs.briansunter.com/api/signup';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorReason(message: string): string {
  if (/valid email/i.test(message)) return 'invalid_email';
  if (/network/i.test(message)) return 'network';
  return 'service';
}

export function initNewsletterForms(): void {
  document
    .querySelectorAll<HTMLElement>('.newsletter-signup')
    .forEach((root) => {
      if (root.dataset.initialized === 'true') return;

      const form = root.querySelector<HTMLFormElement>(
        '[data-newsletter-form]',
      );
      const email = root.querySelector<HTMLInputElement>(
        '[data-newsletter-email]',
      );
      const submit = root.querySelector<HTMLButtonElement>(
        '[data-newsletter-submit]',
      );
      const buttonText = root.querySelector<HTMLElement>(
        '[data-newsletter-button-text]',
      );
      const spinner = root.querySelector<HTMLElement>(
        '[data-newsletter-button-spinner]',
      );
      const success = root.querySelector<HTMLElement>(
        '[data-newsletter-success]',
      );
      const error = root.querySelector<HTMLElement>('[data-newsletter-error]');
      const errorMessage = root.querySelector<HTMLElement>(
        '[data-newsletter-error-message]',
      );
      if (!form || !email || !submit) return;

      root.dataset.initialized = 'true';
      const apiUrl = form.dataset.apiUrl || DEFAULT_API_URL;
      const site = form.dataset.site || 'newsletter';

      const setLoading = (loading: boolean) => {
        submit.disabled = loading;
        email.disabled = loading;
        form.setAttribute('aria-busy', String(loading));
        if (buttonText)
          buttonText.textContent = loading ? 'Subscribing…' : 'Subscribe';
        spinner?.classList.toggle('hidden', !loading);
      };

      const hideMessages = () => {
        success?.classList.add('hidden');
        error?.classList.add('hidden');
        email.classList.remove('!border-danger');
        email.removeAttribute('aria-invalid');
      };

      const showError = (message: string) => {
        error?.classList.remove('hidden');
        success?.classList.add('hidden');
        email.classList.add('!border-danger');
        email.setAttribute('aria-invalid', 'true');
        if (errorMessage)
          errorMessage.textContent = message || 'Please try again.';
        trackEvent('newsletter-signup-error', {
          reason: getErrorReason(message),
          site,
        });
      };

      email.addEventListener('input', hideMessages);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessages();

        const emailAddress = email.value.trim();
        if (!emailAddress) return;
        if (!isValidEmail(emailAddress)) {
          showError('Please enter a valid email address.');
          return;
        }

        trackEvent('newsletter-subscribe-click', { site });
        setLoading(true);
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailAddress, site }),
          });
          const data = (await response.json()) as {
            success?: boolean;
            error?: string;
          };
          if (!response.ok || !data.success) {
            showError(data.error || 'Something went wrong. Please try again.');
            return;
          }

          success?.classList.remove('hidden');
          error?.classList.add('hidden');
          form.reset();
          trackEvent('newsletter-signup-success', { site });
        } catch {
          showError(
            'Network error. Please check your connection and try again.',
          );
        } finally {
          setLoading(false);
        }
      });
    });
}
