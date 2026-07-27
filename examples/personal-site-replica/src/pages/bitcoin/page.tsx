import CopyButton from '../../islands/copy-button'
import { Image } from '@briansunter/nib-images'
import { bitcoinQrCode } from '../../data/images'

export const meta = {
  title: 'Bitcoin Donation',
  description: 'Support Brian Sunter with Bitcoin.',
}

const bitcoinAddress = 'bc1qxnf3v8e9jfavfuyp2f70z03h7ncq8ju7efv3jm'

export default function BitcoinPage() {
  return (
    <div className="content-column bitcoin-page">
      <div className="bitcoin-header">
        <svg viewBox="0 0 64 64" className="bitcoin-icon" aria-hidden="true">
          <circle cx="32" cy="32" r="32" fill="#f7931a" />
          <text x="32" y="46" textAnchor="middle" fill="white" fontSize="38" fontWeight="bold" fontFamily="Inter, sans-serif">₿</text>
        </svg>
        <div>
          <h1>Support with Bitcoin</h1>
          <p className="bitcoin-subtitle">Scan or copy address below</p>
        </div>
      </div>
      <div className="bitcoin-card">
        <a href={`bitcoin:${bitcoinAddress}`} className="bitcoin-qr" aria-label={`Send Bitcoin to ${bitcoinAddress}`}>
          <Image src={bitcoinQrCode} alt="Bitcoin QR Code" layout="fixed" width={220} priority className="bitcoin-qr-image" />
        </a>
        <div className="bitcoin-address">
          <code>{bitcoinAddress}</code>
          <CopyButton value={bitcoinAddress} label="Copy address" hydrate="load" />
        </div>
      </div>
      <a className="button button--dark" href={`bitcoin:${bitcoinAddress}`}>Open in Wallet →</a>
      <p className="small-note">Open a wallet and scan or paste this address. This page is static; the copy control is the only island.</p>
    </div>
  )
}
