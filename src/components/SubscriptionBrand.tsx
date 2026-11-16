import { DementiaMark } from './Logo'
import type { SubscriptionBranding } from '../lib/types'

export function SubscriptionBrand({ branding }: { branding: SubscriptionBranding }) {
  return (
    <div className="subscription-brand">
      <span className="subscription-brand-mark">
        {branding.logo ? <img src={branding.logo} alt="" /> : <DementiaMark />}
      </span>
      <span>{branding.name}</span>
    </div>
  )
}
