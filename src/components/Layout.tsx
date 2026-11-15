import { t } from '../lib/i18n'
import { useState } from 'react'
import { DementiaLogo } from './Logo'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Server,
  Settings2,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { errorMessage } from '../lib/api'
import { useFeedback } from './ui'

function getLinks() {
  return [
    { to: '/', title: t('Обзор'), icon: LayoutDashboard },
    { to: '/users', title: t('Пользователи'), icon: Users },
    { to: '/subscriptions', title: t('Подписки'), icon: Network },
    { to: '/nodes', title: t('Ноды'), icon: Server },
    { to: '/traffic', title: t('Трафик'), icon: Activity },
    { to: '/tokens', title: t('API-токены'), icon: KeyRound },
    { to: '/settings', title: t('Настройки'), icon: Settings2 },
  ]
}

export default function Layout() {
  const links = getLinks()
  const auth = useAuth()
  const location = useLocation()
  const feedback = useFeedback()
  const [open, setOpen] = useState(false)
  const current = links.find((link) => link.to === location.pathname)?.title || t('Страница')
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label={t('Закрыть меню')}
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={'sidebar ' + (open ? 'sidebar-open' : '')}>
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <DementiaLogo />
        </NavLink>
        <span className="nav-caption">{t('РАБОЧЕЕ ПРОСТРАНСТВО')}</span>
        <nav aria-label={t('Основная навигация')}>
          {links.map(({ to, title, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
            >
              <Icon size={18} strokeWidth={1.7} />
              <span>{title}</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-breadcrumbs">
            <button
              className="mobile-menu"
              aria-label={open ? t('Закрыть меню') : t('Открыть меню')}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="breadcrumb-root">{t('Рабочее пространство')}</span>
            <ChevronRight size={13} className="muted" />
            <span>{current}</span>
          </div>
          <button
            className="logout-button"
            aria-label={t('Выйти')}
            title={t('Выйти')}
            onClick={() =>
              feedback.confirm(
                t('Выйти из панели?'),
                t('Активная сессия на этом устройстве будет завершена.'),
                async () => {
                  try {
                    await auth.signOut()
                  } catch (e) {
                    throw new Error(errorMessage(e))
                  }
                },
              )
            }
          >
            <LogOut size={17} />
          </button>
        </header>
        <main id="main-content" className="page">
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>dementia Control Panel</span>
          <span>
            {t('Ваш часовой пояс · ')}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
        </footer>
      </div>
    </div>
  )
}
