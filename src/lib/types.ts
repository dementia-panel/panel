export interface User {
  id: string
  username: string
  subscription_plan_id: string | null
  telegram_id: number | null
  enabled: boolean
  created_at: string
  updated_at: string
  last_connected_at: string | null
  online: boolean
  device_limit: number | null
  device_count: number
  online_device_count: number
}
export interface Node {
  online_device_count: number
  id: string
  name: string
  ip: string
  ssh_port: number
  vpn_port: number
  status: 'installing' | 'ready' | 'failed'
  enabled: boolean
  online: boolean
  last_seen_at: string | null
  connection_ok: boolean | null
  connection_checked_at: string | null
  revision: number
  applied_revision: number
  restart_revision: number
  restarted_revision: number
  error: string | null
  retired_at: string | null
  operation_stage?: string
  endpoint_host: string | null
  endpoint_port: number | null
}
export interface Subscription {
  id: string
  name: string
  user_id: string
  enabled: boolean
  expires_at: string | null
  plan_id?: string
  node_ids: string[]
  traffic_limit_bytes: number | null
  traffic_used_bytes: number
  traffic_reset_days: number | null
  traffic_reset_at: string | null
}
export interface APIToken {
  id: string
  name: string
  created_at: string
}
export interface Traffic {
  day: string
  received_bytes: number
  sent_bytes: number
}
export interface Session {
  password_change_required?: boolean
  username: string
}
export interface Setup {
  setup_required: boolean
  setup_available: boolean
}

export interface IntegrationStatus {
  enabled: boolean
  state: 'disabled' | 'pending' | 'connected' | 'error'
  checked_at?: string
  last_success_at?: string
}
export interface Integrations {
  telegram: IntegrationStatus
  webhook: IntegrationStatus
}

export interface SubscriptionPlan {
  id: string
  name: string
  node_ids: string[]
}

export interface SubscriptionBranding {
  default_language?: 'en' | 'ru'
  name: string
  logo: string
}

export interface UserDevice {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  last_connected_at: string | null
  online: boolean
}

export type UserPage = {
  items: User[]
  total: number
  online_total: number
  page: number
  per_page: number
  total_pages: number
}
