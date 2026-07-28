import { Image } from '@briansunter/nib-images'
import { bitcoinQrCode } from '../../data/images'
import BitcoinCopyBehavior from '../../islands/bitcoin-copy-behavior'

export const meta = {
  title: 'Bitcoin Donation',
  description: 'Donate Bitcoin to Brian Sunter',
}

const bitcoinAddress = 'bc1qxnf3v8e9jfavfuyp2f70z03h7ncq8ju7efv3jm'

export default function BitcoinPage() {
  return (
    <div className="bitcoin-page page-container">
      <div className="header">
        <svg viewBox="0 0 64 64" className="btc-icon">
          <circle cx="32" cy="32" r="32" fill="#f7931a" />
          <text x="32" y="46" textAnchor="middle" fill="white" fontSize="38" fontWeight="bold" fontFamily="Inter, sans-serif">₿</text>
        </svg>
        <div className="header-text">
          <h1 className="page-title">Support with Bitcoin</h1>
          <p className="page-subtitle">Scan or copy address below</p>
        </div>
      </div>

      <div className="donation-card">
        <a href={`bitcoin:${bitcoinAddress}`} className="qr-link">
          <Image
            src={bitcoinQrCode}
            alt="Bitcoin QR Code"
            layout="fixed"
            width={160}
            priority
            className="qr-image"
          />
        </a>

        <div className="address-box">
          <code className="address-text">{bitcoinAddress}</code>
          <button
            className="copy-btn"
            id="copy-btn"
            data-copy-button
            data-copy-code={bitcoinAddress}
            data-copy-success-class="copied"
            aria-label="Copy Bitcoin address"
          >
            <svg
              className="copy-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <svg
              className="check-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>

        <a href={`bitcoin:${bitcoinAddress}`} className="wallet-btn">
          Open in Wallet
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      <p className="footer-note">Thank you for your support!</p>
      <BitcoinCopyBehavior hydrate="load" />
    </div>
  )
}
