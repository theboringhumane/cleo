import { useEffect, useRef, useState } from 'react'
import * as d3Geo from 'd3-geo'
import * as d3Zoom from 'd3-zoom'
import * as d3Sel from 'd3-selection'
import { useNavigate } from '@tanstack/react-router'

export interface MapQueue {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

interface MapSceneProps {
  queues: MapQueue[]
}

interface IPLocation {
  latitude: number
  longitude: number
  city: string
  region: string
  country_name: string
  country_code: string
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NS = 'http://www.w3.org/2000/svg'

export function MapScene({ queues }: MapSceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [location, setLocation] = useState<IPLocation | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const navigate = useNavigate()

  /* fetch user's IP location (falls back to SF) */
  useEffect(() => {
    let cancelled = false
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setLocation(
          j?.latitude && j?.longitude
            ? (j as IPLocation)
            : { latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', region: 'California', country_name: 'United States', country_code: 'US' }
        )
      })
      .catch(() => {
        if (cancelled) return
        setLocation({ latitude: 37.7749, longitude: -122.4194, city: 'San Francisco', region: 'California', country_name: 'United States', country_code: 'US' })
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!location || !svgRef.current) return
    const svg = svgRef.current
    const width = svg.clientWidth || 1200
    const height = svg.clientHeight || 800

    let raf = 0
    let cancelledCleanups: (() => void)[] = []

    async function render() {
      const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      if (!res.ok) { setMapError('failed to load map data'); return }
      const topo = await res.json()
      const countrySet = (topo.objects && (topo.objects.countries || topo.objects.land)) || null
      if (!countrySet) { setMapError('unexpected map data'); return }

      const { feature, mesh } = await import('topojson-client')
      const countries = feature(topo as any, countrySet as any) as any
      const borders = mesh(topo as any, countrySet as any, (a: any, b: any) => a !== b)

      while (svg.firstChild) svg.removeChild(svg.firstChild)

      const isUS = location!.country_code === 'US'
      const projection = isUS
        ? d3Geo.geoAlbersUsa().fitExtent([[40, 40], [width - 40, height - 40]], countries)
        : d3Geo.geoMercator().fitExtent([[40, 40], [width - 40, height - 40]], countries)
      const path = d3Geo.geoPath(projection as any) as any

      /* zoomable map group */
      const zoomLayer = document.createElementNS(NS, 'g')
      svg.appendChild(zoomLayer)

      const land = document.createElementNS(NS, 'path')
      land.setAttribute('d', path(countries) || '')
      land.setAttribute('fill', '#0a1522')
      zoomLayer.appendChild(land)

      const borderPath = document.createElementNS(NS, 'path')
      borderPath.setAttribute('d', path(borders) || '')
      borderPath.setAttribute('fill', 'none')
      borderPath.setAttribute('stroke', '#16324a')
      borderPath.setAttribute('stroke-width', '0.5')
      zoomLayer.appendChild(borderPath)

      const grat = document.createElementNS(NS, 'path')
      grat.setAttribute('d', path(d3Geo.geoGraticule10()) || '')
      grat.setAttribute('fill', 'none')
      grat.setAttribute('stroke', '#0e2235')
      grat.setAttribute('stroke-width', '0.4')
      grat.setAttribute('stroke-opacity', '0.5')
      zoomLayer.appendChild(grat)

      /* frames / regions / queues group (stays under zoom) */
      const markersLayer = document.createElementNS(NS, 'g')
      zoomLayer.appendChild(markersLayer)

      /* user location */
      const [ux, uy] = projection([location!.longitude, location!.latitude]) || [0, 0]
      const markerPulse = document.createElementNS(NS, 'circle')
      markerPulse.setAttribute('cx', String(ux))
      markerPulse.setAttribute('cy', String(uy))
      markerPulse.setAttribute('r', '8')
      markerPulse.setAttribute('fill', 'rgba(47,214,199,0.25)')
      markerPulse.setAttribute('pointer-events', 'none')
      markersLayer.appendChild(markerPulse)

      const userDot = document.createElementNS(NS, 'circle')
      userDot.setAttribute('cx', String(ux))
      userDot.setAttribute('cy', String(uy))
      userDot.setAttribute('r', '3.5')
      userDot.setAttribute('fill', '#2fd6c7')
      userDot.setAttribute('pointer-events', 'none')
      markersLayer.appendChild(userDot)

      const userLabel = document.createElementNS(NS, 'text')
      userLabel.setAttribute('x', String(ux + 10))
      userLabel.setAttribute('y', String(uy - 8))
      userLabel.setAttribute('fill', '#8fb2c9')
      userLabel.setAttribute('font-size', '11')
      userLabel.setAttribute('font-family', "'JetBrains Mono', monospace")
      userLabel.setAttribute('pointer-events', 'none')
      userLabel.textContent = `YOU · ${location!.city}, ${location!.country_code}`
      markersLayer.appendChild(userLabel)

      /* queue markers */
      const errored: { ring: SVGCircleElement; phase: number }[] = []
      queues.forEach((q) => {
        const rand = rng(hashString(q.name) + 7)
        const spreadX = isUS ? 480 : 320
        const spreadY = isUS ? 320 : 240
        const qx = ux + (rand() - 0.5) * spreadX
        const qy = uy + (rand() - 0.5) * spreadY
        const total = q.waiting + q.active + q.completed + q.failed + q.delayed
        const color = q.failed > 0 ? '#f43f5e' : q.active > 0 ? '#2fd6c7' : total > 0 ? '#f0b429' : '#4a6b85'

        const g = document.createElementNS(NS, 'g')
        g.setAttribute('transform', `translate(${qx},${qy})`)
        g.style.cursor = 'pointer'
        g.addEventListener('click', (e) => {
          e.stopPropagation()
          navigate({ to: '/queues/$queueName', params: { queueName: q.name } })
        })

        const size = 5 + Math.min(total, 14)
        const sq = document.createElementNS(NS, 'rect')
        sq.setAttribute('x', String(-size / 2))
        sq.setAttribute('y', String(-size / 2))
        sq.setAttribute('width', String(size))
        sq.setAttribute('height', String(size))
        sq.setAttribute('rx', '2')
        sq.setAttribute('fill', color)
        sq.setAttribute('fill-opacity', '0.9')
        sq.setAttribute('stroke', '#0a121e')
        sq.setAttribute('stroke-width', '1')
        g.appendChild(sq)

        const lbl = document.createElementNS(NS, 'text')
        lbl.setAttribute('x', String(size / 2 + 5))
        lbl.setAttribute('y', '4')
        lbl.setAttribute('fill', '#a8c4d8')
        lbl.setAttribute('font-size', '10')
        lbl.setAttribute('font-family', "'JetBrains Mono', monospace")
        lbl.setAttribute('pointer-events', 'none')
        lbl.textContent = q.name
        g.appendChild(lbl)

        const title = document.createElementNS(NS, 'title')
        title.textContent = `${q.name} — Active:${q.active} Waiting:${q.waiting} Failed:${q.failed} Delayed:${q.delayed}`
        g.appendChild(title)

        if (q.failed > 0) {
          const errRing = document.createElementNS(NS, 'circle')
          errRing.setAttribute('r', String(size + 6))
          errRing.setAttribute('fill', 'none')
          errRing.setAttribute('stroke', '#ff2244')
          errRing.setAttribute('stroke-width', '2')
          errRing.setAttribute('pointer-events', 'none')
          g.appendChild(errRing)
          errored.push({ ring: errRing, phase: rand() * Math.PI * 2 })
        }

        markersLayer.appendChild(g)
      })

      /* animation loop */
      let t = 0
      const animate = () => {
        raf = requestAnimationFrame(animate)
        t += 0.016
        const ringSize = 8 + 5 * Math.abs(Math.sin(t * 2))
        markerPulse.setAttribute('r', String(ringSize))
        markerPulse.setAttribute('fill', `rgba(47,214,199,${0.35 - 0.2 * (ringSize / 13)})`)
        for (const { ring, phase } of errored) {
          ring.setAttribute('stroke-opacity', String(0.3 + 0.7 * Math.abs(Math.sin(t * 2.5 + phase))))
          ring.setAttribute('r', String(parseFloat(ring.getAttribute('r') || '10') * (1 + 0.002 * Math.sin(t * 2.5 + phase))))
        }
      }
      animate()

      /* zoom + pan */
      const sel = d3Sel.select(svg as any)
      const zoomBehavior = d3Zoom
        .zoom()
        .scaleExtent([0.4, 12])
        .on('zoom', (event: any) => {
          zoomLayer.setAttribute('transform', event.transform.toString())
        })

      sel.call(zoomBehavior as any)

      /* center on user location at start */
      const startTx = width / 2 - ux
      const startTy = height / 2 - uy
      sel.call(zoomBehavior.transform as any, d3Zoom.zoomIdentity.translate(startTx, startTy).scale(1.4))

      /* zoom hint (static) */
      const hint = document.createElementNS(NS, 'text')
      hint.setAttribute('x', String(width / 2))
      hint.setAttribute('y', String(height - 20))
      hint.setAttribute('fill', '#5b7a92')
      hint.setAttribute('font-size', '10')
      hint.setAttribute('font-family', "'JetBrains Mono', monospace")
      hint.setAttribute('text-anchor', 'middle')
      hint.textContent = 'SCROLL TO ZOOM · DRAG TO PAN · CLICK MARKERS FOR DETAIL'
      svg.appendChild(hint)

      cancelledCleanups.push(() => {
        cancelAnimationFrame(raf)
        sel.on('.zoom', null)
      })
    }

    render()
    return () => {
      cancelledCleanups.forEach((c) => c())
      cancelledCleanups = []
    }
  }, [location, queues, navigate])

  return (
    <div className="absolute inset-0 bg-[#04080f] overflow-hidden">
      <svg ref={svgRef} className="block h-full w-full cursor-grab active:cursor-grabbing" />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono-data text-xs">
          {mapError}
        </div>
      )}
      {location && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-[#16324a] bg-black/40 backdrop-blur-sm px-4 py-1.5 text-[10px] font-mono-data tracking-widest text-slate-400 pointer-events-none">
          {location.city?.toUpperCase()}, {location.region?.toUpperCase()} · {location.country_name?.toUpperCase()} · IP GEOLOCATED
        </div>
      )}
    </div>
  )
}
