import { useEffect, useState } from 'react'
import { api, errorMessage } from './api'
import type { User, UserPage } from './types'

export function useAllUsers() {
  const [data, setData] = useState<User[]>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const users = new Map<string, User>()
        let page = 1
        while (active) {
          const result = await api<UserPage>('/users?page=' + page + '&per_page=100')
          if (!active) return
          for (const user of result.items) users.set(user.id, user)
          if (page >= result.total_pages) break
          page++
        }
        if (active) setData([...users.values()])
      } catch (error) {
        if (active) setError(errorMessage(error))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [revision])
  return { data, error, loading, refresh: () => setRevision((value) => value + 1) }
}
