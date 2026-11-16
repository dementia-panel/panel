import { useId, useState } from 'react'
import type { PointerEvent, KeyboardEvent } from 'react'
import { bytes } from '../lib/api'
import { t, getLocale } from '../lib/i18n'
import type { Traffic } from '../lib/types'

export function TrafficTrend({ data }: { data: Traffic[] }) {
  const gradient = useId()
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [interacting, setInteracting] = useState(false)
  const [focused, setFocused] = useState(false)
  const history = [...data].sort((a, b) => a.day.localeCompare(b.day))
  if (!history.length) {
    return (
      <div className="traffic-trend-empty">{t('История появится после первых отчётов нод.')}</div>
    )
  }

  const maximum = Math.max(1, ...history.flatMap((item) => [item.received_bytes, item.sent_bytes]))
  const first = Date.parse(history[0].day)
  const span = Date.parse(history[history.length - 1].day) - first
  const xPosition = (item: Traffic) => (span ? ((Date.parse(item.day) - first) / span) * 1000 : 500)
  const yPosition = (value: number) => 220 - (value / maximum) * 200
  const activeIndex = history.findIndex((item) => item.day === activeDay)
  const index = activeIndex < 0 ? history.length - 1 : activeIndex
  const active = history[index]
  const activeX = xPosition(active)
  const showDetail = interacting || focused
  const label = (item: Traffic) =>
    new Date(item.day).toLocaleDateString(getLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  const received = history
    .map((item) => xPosition(item) + ',' + yPosition(item.received_bytes))
    .join(' ')
  const sent = history.map((item) => xPosition(item) + ',' + yPosition(item.sent_bytes)).join(' ')
  const tickStep = Math.max(1, Math.ceil((history.length - 1) / 5))
  const ticks = history.filter(
    (_, tick) => tick === 0 || tick === history.length - 1 || tick % tickStep === 0,
  )

  function selectAtPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const position = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * 1000
    const nearest = history.reduce((best, item) =>
      Math.abs(xPosition(item) - position) < Math.abs(xPosition(best) - position) ? item : best,
    )
    setActiveDay(nearest.day)
    setInteracting(true)
  }
  function selectWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const offsets: Record<string, number> = {
      ArrowLeft: Math.max(0, index - 1),
      ArrowRight: Math.min(history.length - 1, index + 1),
      Home: 0,
      End: history.length - 1,
    }
    if (!(event.key in offsets)) return
    event.preventDefault()
    setActiveDay(history[offsets[event.key]].day)
  }

  return (
    <div className="traffic-trend" role="group" aria-label={t('Общий трафик по дням')}>
      <div className="traffic-trend-header">
        <div className="traffic-trend-legend">
          <span>
            <i className="traffic-line-received" />
            {t('Получено')}
          </span>
          <span>
            <i className="traffic-line-sent" />
            {t('Отправлено')}
          </span>
        </div>
        <span className="traffic-trend-timezone">{t('Объём за день')} · UTC</span>
      </div>
      <div className="traffic-trend-canvas">
        <div className="traffic-trend-axis" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
            <span key={ratio}>{bytes(maximum * ratio)}</span>
          ))}
        </div>
        <div
          className="traffic-trend-plot"
          role="slider"
          tabIndex={0}
          aria-label={t('Дневной трафик · стрелками выберите дату')}
          aria-valuemin={0}
          aria-valuemax={history.length - 1}
          aria-valuenow={index}
          aria-valuetext={
            label(active) +
            ' · ' +
            t('Получено') +
            ' ' +
            bytes(active.received_bytes) +
            ' · ' +
            t('Отправлено') +
            ' ' +
            bytes(active.sent_bytes)
          }
          onPointerMove={selectAtPointer}
          onPointerDown={selectAtPointer}
          onPointerLeave={() => setInteracting(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={selectWithKeyboard}
        >
          <svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity=".1" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20, 70, 120, 170, 220].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="1000"
                y2={y}
                stroke="#ffffff0b"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <polygon
              points={
                xPosition(history[0]) +
                ',220 ' +
                received +
                ' ' +
                xPosition(history[history.length - 1]) +
                ',220'
              }
              fill={'url(#' + gradient + ')'}
            />
            <polyline
              points={received}
              fill="none"
              stroke="#eeeeF2"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={sent}
              fill="none"
              stroke="#85858e"
              strokeWidth="2"
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
            {showDetail && (
              <line
                x1={activeX}
                y1="10"
                x2={activeX}
                y2="230"
                stroke="#c1c1cb"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {(showDetail || history.length === 1) && (
            <>
              <span
                className="traffic-trend-point"
                style={{
                  left: activeX / 10 + '%',
                  top: (yPosition(active.received_bytes) / 240) * 100 + '%',
                }}
              />
              <span
                className="traffic-trend-point sent"
                style={{
                  left: activeX / 10 + '%',
                  top: (yPosition(active.sent_bytes) / 240) * 100 + '%',
                }}
              />
            </>
          )}
          {showDetail && (
            <div
              className="traffic-trend-tooltip"
              style={{ left: 'clamp(90px, ' + activeX / 10 + '%, calc(100% - 90px))' }}
            >
              <strong>{label(active)} · UTC</strong>
              <dl>
                <div>
                  <dt>{t('Получено')}</dt>
                  <dd>{bytes(active.received_bytes)}</dd>
                </div>
                <div>
                  <dt>{t('Отправлено')}</dt>
                  <dd>{bytes(active.sent_bytes)}</dd>
                </div>
                <div>
                  <dt>{t('Всего')}</dt>
                  <dd>{bytes(active.received_bytes + active.sent_bytes)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
        <div className="traffic-trend-dates" aria-hidden="true">
          {ticks.map((item) => (
            <span key={item.day}>
              {new Date(item.day).toLocaleDateString(getLocale(), {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}
            </span>
          ))}
        </div>
      </div>
      <div className="traffic-trend-detail" aria-live="polite">
        <span>{label(active)}</span>
        <span>
          {t('Получено')} <strong>{bytes(active.received_bytes)}</strong>
        </span>
        <span>
          {t('Отправлено')} <strong>{bytes(active.sent_bytes)}</strong>
        </span>
        <span>
          {t('Всего')} <strong>{bytes(active.received_bytes + active.sent_bytes)}</strong>
        </span>
      </div>
    </div>
  )
}
