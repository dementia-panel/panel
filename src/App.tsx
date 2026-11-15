import { t, useLanguage } from './lib/i18n'
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { FeedbackProvider, Loading, Button } from './components/ui'
import Layout from './components/Layout'
import AuthPage from './pages/Auth'
import Overview from './pages/Overview'
import Users from './pages/Users'
import Nodes from './pages/Nodes'
import Subscriptions from './pages/Subscriptions'
import Tokens from './pages/Tokens'
import Traffic from './pages/Traffic'
import Settings from './pages/Settings'
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="fatal">
        <h1>{t('Не удалось открыть страницу')}</h1>
        <p>{t('Обновите приложение, чтобы восстановить работу.')}</p>
        <Button onClick={() => window.location.reload()}>{t('Обновить страницу')}</Button>
      </div>
    ) : (
      this.props.children
    )
  }
}
function Protected() {
  const auth = useAuth()
  const location = useLocation()
  return auth.loading ? (
    <Loading />
  ) : auth.session?.password_change_required ? (
    <Navigate to="/login" replace />
  ) : auth.session ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  )
}
export function App() {
  useLanguage()
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <FeedbackProvider>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route element={<Protected />}>
                <Route element={<Layout />}>
                  <Route index element={<Overview />} />
                  <Route path="users" element={<Users />} />
                  <Route path="nodes" element={<Nodes />} />
                  <Route path="subscriptions" element={<Subscriptions />} />
                  <Route path="tokens" element={<Tokens />} />
                  <Route path="traffic" element={<Traffic />} />
                  <Route path="settings" element={<Settings />} />
                  <Route
                    path="*"
                    element={
                      <div className="empty">
                        <h1>{t('Страница не найдена')}</h1>
                        <Link className="btn btn-primary" to="/">
                          {t('На главную')}
                        </Link>
                      </div>
                    }
                  />
                </Route>
              </Route>
            </Routes>
          </FeedbackProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
