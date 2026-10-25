import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Compass,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Globe2,
  Layers,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SunMoon,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type HazardCategory =
  | 'Earthquake'
  | 'Cyclone'
  | 'Flood'
  | 'Wildfire'
  | 'Volcano'
  | 'Tsunami'
  | 'Drought'
  | 'Storm'
  | 'Landslide'
  | 'Extreme Temperature';

export type Severity = 'Low' | 'Moderate' | 'Severe' | 'Critical';

export interface EventRecord {
  id: string;
  sourceEventId?: string;
  title: string;
  hazardCategory: HazardCategory;
  severity: Severity;
  officialAlertLevel?: string;
  latitude: number;
  longitude: number;
  location: string;
  country: string;
  source: string;
  status: 'Observed' | 'Monitoring' | 'Alert' | 'Recovered';
  isCurrent?: boolean;
  eventTime: string;
  pubDate?: string;
  updatedAt: string;
  retrievedAt?: string;
  sourceUrl: string;
  description: string;
  impact: number;
  dataType?: 'live' | 'cached' | 'demo';
}

export interface SourceHealth {
  name: string;
  status: 'Healthy' | 'Delayed' | 'Unavailable' | 'Unconfigured' | 'Not refreshed' | 'Configured';
  latency: string;
  lastRefresh: string;
  coverage: string;
}

export interface Scenario {
  hazard: HazardCategory;
  country: string;
  location: string;
  disruption: string;
  severity: Severity;
  duration: string;
  infrastructure: string;
  populationExposure: string;
  assumptions: string;
}

export interface ApiSummary {
  events: EventRecord[];
  sourceHealth?: SourceHealth[];
  totalRecords?: number;
  uniqueEvents?: number;
  highSeverity?: number;
}

export interface SecondaryIntelItem {
  id: string;
  title: string;
  hazardCategory: string;
  severity: string;
  location: string;
  country: string;
  latitude: number;
  longitude: number;
  source: string;
  sourceUrl: string;
  eventTime: string;
  updatedAt: string;
  retrievedAt?: string;
  description: string;
  impact: number;
  status: string;
}

export interface DailyBriefing {
  id: string;
  dateStr: string;
  heroEventId?: string;
  headline: string;
  summary: string;
  whatHappened: string;
  whatIsChanging: string;
  areasAffected: string;
  officialGuidance: string;
  credibilityScore: string;
  verificationStatus: string;
  secondaryItems: SecondaryIntelItem[];
  createdAt: string;
  heroEvent?: EventRecord;
}

export interface DbNotification {
  id: string;
  eventId?: string;
  headline: string;
  changeType: string;
  hazardCategory: string;
  country?: string;
  location?: string;
  severity: string;
  changeSummary: string;
  source: string;
  sourceUrl?: string;
  createdAt: string;
  isRead: boolean;
}

export interface StructuredAnalysis {
  summary?: string;
  content?: string;
  primary_hazard?: string;
  cascade_vectors?: string[];
  timeline?: {
    immediate?: string;
    intermediate?: string;
    extended?: string;
  };
  recommendations?: string[];
  limitations?: string;
}

export interface AiResult {
  status: 'success' | 'config_missing' | 'error';
  engine?: string;
  model?: string;
  message?: string;
  response?: {
    content?: string;
    summary?: string;
    assumptions?: string[];
    confidence?: string;
    structured?: StructuredAnalysis;
  };
}

interface CountryGeo {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
}

// ---------------------------------------------------------------------------
// Geographic Centroids & Bounding Boxes for Global Country Zooming
// ---------------------------------------------------------------------------

const COUNTRY_GEO_DATA: Record<string, CountryGeo> = {
  Japan: { center: [36.2048, 138.2529], zoom: 5, bounds: [[30.0, 128.0], [45.5, 146.0]] },
  'United States': { center: [37.0902, -95.7129], zoom: 4, bounds: [[24.5, -125.0], [49.5, -66.9]] },
  India: { center: [20.5937, 78.9629], zoom: 5, bounds: [[8.0, 68.0], [35.5, 97.5]] },
  Australia: { center: [-25.2744, 133.7751], zoom: 4, bounds: [[-44.0, 112.0], [-10.0, 154.0]] },
  'New Zealand': { center: [-40.9006, 174.8860], zoom: 5, bounds: [[-47.5, 166.0], [-34.0, 179.0]] },
  Indonesia: { center: [-0.7893, 113.9213], zoom: 5, bounds: [[-11.0, 95.0], [6.0, 141.0]] },
  Philippines: { center: [12.8797, 121.7740], zoom: 6, bounds: [[4.5, 116.5], [21.5, 127.0]] },
  Italy: { center: [41.8719, 12.5674], zoom: 6, bounds: [[36.5, 6.5], [47.1, 18.5]] },
  Greece: { center: [39.0742, 21.8243], zoom: 6, bounds: [[34.8, 19.3], [41.8, 28.5]] },
  Turkey: { center: [38.9637, 35.2433], zoom: 5, bounds: [[35.8, 25.6], [42.1, 44.8]] },
  Chile: { center: [-35.6751, -71.5430], zoom: 4, bounds: [[-56.0, -76.0], [-17.5, -66.0]] },
  Mexico: { center: [23.6345, -102.5528], zoom: 5, bounds: [[14.5, -118.5], [32.8, -86.7]] },
  Canada: { center: [56.1304, -106.3468], zoom: 3, bounds: [[41.7, -141.0], [83.1, -52.6]] },
  China: { center: [35.8617, 104.1954], zoom: 4, bounds: [[18.0, 73.5], [53.6, 135.0]] },
  'United Kingdom': { center: [55.3781, -3.4360], zoom: 6, bounds: [[49.8, -8.6], [60.9, 1.8]] },
  France: { center: [46.2276, 2.2137], zoom: 5, bounds: [[41.3, -5.2], [51.1, 9.6]] },
  Germany: { center: [51.1657, 10.4515], zoom: 6, bounds: [[47.2, 5.8], [55.1, 15.1]] },
  Spain: { center: [40.4637, -3.7492], zoom: 5, bounds: [[36.0, -9.3], [43.8, 4.4]] },
  Brazil: { center: [-14.2350, -51.9253], zoom: 4, bounds: [[-33.8, -73.9], [5.3, -34.7]] },
  'South Africa': { center: [-30.5595, 22.9375], zoom: 5, bounds: [[-34.9, 16.4], [-22.1, 32.9]] },
  Vanuatu: { center: [-15.3767, 166.9592], zoom: 6, bounds: [[-20.3, 166.5], [-13.0, 170.5]] },
  'Papua New Guinea': { center: [-6.3150, 143.9555], zoom: 5, bounds: [[-11.7, 140.8], [-1.0, 156.0]] },
  Iceland: { center: [64.9631, -19.0208], zoom: 6, bounds: [[63.3, -24.6], [66.6, -13.5]] },
  Peru: { center: [-9.1900, -75.0152], zoom: 5, bounds: [[-18.4, -81.4], [-0.03, -68.6]] },
  Argentina: { center: [-38.4161, -63.6167], zoom: 4, bounds: [[-55.1, -73.6], [-21.8, -53.6]] },
  Colombia: { center: [4.5709, -74.2973], zoom: 5, bounds: [[-4.3, -79.1], [12.5, -66.8]] },
  Vietnam: { center: [14.0583, 108.2772], zoom: 5, bounds: [[8.5, 102.1], [23.4, 109.5]] },
  Thailand: { center: [15.8700, 100.9925], zoom: 5, bounds: [[5.6, 97.3], [20.5, 105.7]] },
  Bangladesh: { center: [23.6850, 90.3563], zoom: 6, bounds: [[20.7, 88.0], [26.7, 92.7]] },
  Pakistan: { center: [30.3753, 69.3451], zoom: 5, bounds: [[23.7, 60.8], [37.1, 77.8]] },
  Iran: { center: [32.4279, 53.6880], zoom: 5, bounds: [[25.0, 44.0], [39.8, 63.4]] },
  Egypt: { center: [26.8206, 30.8025], zoom: 5, bounds: [[22.0, 24.7], [31.7, 36.9]] },
  Nigeria: { center: [9.0820, 8.6753], zoom: 5, bounds: [[4.2, 2.6], [13.9, 14.7]] },
};

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------

const _rawApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL: string = (
  (_rawApiBase && _rawApiBase.replace(/\/$/, '')) ||
  (import.meta.env.DEV ? '' : 'http://localhost:8000')
);

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Formatting & Colors
// ---------------------------------------------------------------------------

function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'Critical':
      return '#ef4444';
    case 'Severe':
      return '#f97316';
    case 'Moderate':
      return '#eab308';
    case 'Low':
      return '#10b981';
    default:
      return '#38bdf8';
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const time = new Date(isoString).getTime();
    if (isNaN(time)) return 'Recently';
    const now = Date.now();
    const diffSec = Math.floor((now - time) / 1000);
    if (diffSec < 0) return 'Just now';
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(isoString);
  } catch {
    return 'Recently';
  }
}

// ---------------------------------------------------------------------------
// Hazard SVG Symbols (Accessible & Color-blind compliant)
// ---------------------------------------------------------------------------

function getHazardSvgString(hazard: HazardCategory): string {
  switch (hazard) {
    case 'Earthquake':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l3-7 4 14 3-7h3l3-3 3 3"/></svg>`;
    case 'Cyclone':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-7 17l2-2a7 7 0 0 1 5-13V2z"/><path d="M12 22a10 10 0 0 0 7-17l-2 2a7 7 0 0 1-5 13v2z"/><circle cx="12" cy="12" r="2"/></svg>`;
    case 'Flood':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7 0"/><path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7 0"/><path d="M12 3v4m-4-2l2 2m6-2l-2 2"/></svg>`;
    case 'Wildfire':
      return `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2c-.5 3-3.5 5.5-3.5 9 0 3.6 2.9 6.5 6.5 6.5 1.2 0 2.3-.3 3.3-1-.5-2.2-.2-4.5.7-6.5-1.5 2-3 2.5-3 4.5 0 1-.5 1.5-1 1.5s-1-.5-1-1.5c0-3 3-5 3-9-2.5 1.5-4 4-4 7 0 1-.5 1.5-1 1.5s-1-.5-1-1.5c0-3.5 2.5-6.5 3-10z"/></svg>`;
    case 'Volcano':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l6-13h6l6 13H3z"/><path d="M9 8l3-5 3 5"/><path d="M12 3v-2m-3 1l1 2m5-2l-1 2"/></svg>`;
    case 'Tsunami':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20c4-4 8-16 14-16 3 0 5 3 2 6-2 2-5 3-5 6 3 0 6 2 9 4"/><path d="M2 15c3-2 6-4 9-2"/></svg>`;
    case 'Drought':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"/></svg>`;
    case 'Storm':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M13 13l-3 5h4l-2 5"/></svg>`;
    case 'Landslide':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20L18 4h4v16H2z"/><circle cx="10" cy="9" r="1.5" fill="currentColor"/><circle cx="13" cy="13" r="1.5" fill="currentColor"/><circle cx="7" cy="14" r="1.5" fill="currentColor"/></svg>`;
    case 'Extreme Temperature':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M18 7c1 1 1 3 0 4m2-6c2 2 2 6 0 8"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>`;
  }
}

function HazardSymbol({ hazard }: { hazard: HazardCategory }) {
  const svgHtml = useMemo(() => getHazardSvgString(hazard), [hazard]);
  return <span className="legend-symbol" dangerouslySetInnerHTML={{ __html: svgHtml }} />;
}

const createHazardMarkerIcon = (
  event: EventRecord,
  isSelected: boolean,
  animationsPaused: boolean = false
) => {
  const color = getSeverityColor(event.severity);
  const svg = getHazardSvgString(event.hazardCategory);

  let pulseClass = '';
  if (!animationsPaused) {
    if (event.severity === 'Critical') {
      pulseClass = 'pulse-critical';
    } else if (event.severity === 'Severe') {
      pulseClass = 'pulse-severe';
    } else if (event.hazardCategory === 'Flood') {
      pulseClass = 'pulse-flood';
    } else if (event.hazardCategory === 'Wildfire') {
      pulseClass = 'pulse-wildfire';
    } else if (event.hazardCategory === 'Tsunami') {
      pulseClass = 'pulse-tsunami';
    }
  }

  const selectedClass = isSelected ? 'marker-selected' : '';
  const pausedClass = animationsPaused ? 'animations-paused' : '';

  // Magnitude-proportional scaling for earthquakes when magnitude data exists
  let size = 32;
  if (event.hazardCategory === 'Earthquake') {
    const magMatch = event.title.match(/M(?:w)?\s*([0-9.]+)/i);
    if (magMatch) {
      const mag = parseFloat(magMatch[1]);
      if (!isNaN(mag)) {
        size = Math.min(48, Math.max(28, Math.round(18 + mag * 3.4)));
      }
    } else if (event.severity === 'Critical') {
      size = 40;
    }
  } else if (event.severity === 'Critical') {
    size = 38;
  } else if (event.severity === 'Severe') {
    size = 34;
  }

  const anchor = Math.round(size / 2);

  return L.divIcon({
    className: 'hazard-div-icon',
    html: `
      <div class="hazard-marker-wrapper ${pulseClass} ${selectedClass} ${pausedClass}" style="--marker-color: ${color}; width: ${size}px; height: ${size}px;">
        <div class="hazard-marker-badge" style="width: ${size}px; height: ${size}px;">
          ${svg}
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor - 4],
  });
};

// ---------------------------------------------------------------------------
// Animated Numerical Counter Hook & Component
// ---------------------------------------------------------------------------

function useAnimatedCount(target: number, duration: number = 650): number {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = currentRef.current;
    const change = target - startValue;

    if (change === 0) return;

    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out quad
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const nextVal = Math.round(startValue + change * easeProgress);
      currentRef.current = nextVal;
      setCurrent(nextVal);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setCurrent(target);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return current;
}

function AnimatedCounter({ value, className = '' }: { value: number; className?: string }) {
  const count = useAnimatedCount(value);
  return <span className={`animated-counter-value ${className}`}>{count.toLocaleString()}</span>;
}

// ---------------------------------------------------------------------------
// Custom Accessible Dropdown Component
// ---------------------------------------------------------------------------

export interface CustomSelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

export interface CustomSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  id,
  ariaLabel,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      } else {
        setIsOpen((prev) => !prev);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(options.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef} id={id}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className="custom-select-value">
          {selectedOption ? (
            <>
              {selectedOption.icon}
              <span>{selectedOption.label}</span>
              {selectedOption.badge && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: selectedOption.badgeColor
                      ? `${selectedOption.badgeColor}22`
                      : 'var(--primary-soft)',
                    color: selectedOption.badgeColor || 'var(--primary)',
                    fontWeight: 700,
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className="custom-select-chevron" />
      </button>

      {isOpen && (
        <div className="custom-select-menu" role="listbox">
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                type="button"
                key={opt.value}
                className={`custom-select-option ${isSelected ? 'selected' : ''} ${
                  isHighlighted ? 'highlighted' : ''
                }`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: opt.badgeColor ? `${opt.badgeColor}22` : 'var(--primary-soft)',
                        color: opt.badgeColor || 'var(--primary)',
                        fontWeight: 700,
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Authoritative Source Resolution (USGS for Earthquakes, GDACS for Multi-Hazards)
// ---------------------------------------------------------------------------

function getAuthoritativeSourceInfo(event?: {
  hazardCategory?: string;
  source?: string;
  sourceUrl?: string;
  sourceEventId?: string;
  id?: string;
}): { sourceName: string; sourceUrl: string } {
  if (!event) {
    return { sourceName: 'GDACS', sourceUrl: 'https://www.gdacs.org/' };
  }
  const isEarthquake =
    event.hazardCategory === 'Earthquake' ||
    event.source === 'USGS' ||
    (typeof event.id === 'string' && event.id.startsWith('usgs-'));

  if (isEarthquake) {
    let url = event.sourceUrl;
    if (!url || !url.includes('earthquake.usgs.gov')) {
      const cleanId = event.sourceEventId || (typeof event.id === 'string' ? event.id.replace('usgs-', '') : '');
      url = cleanId
        ? `https://earthquake.usgs.gov/earthquakes/eventpage/${cleanId}`
        : 'https://earthquake.usgs.gov/';
    }
    return {
      sourceName: 'USGS',
      sourceUrl: url,
    };
  }

  // All multi-hazard international disasters (Cyclone, Flood, Volcano, Drought, Wildfire, Storm, Tsunami, etc.)
  let url = event.sourceUrl;
  if (!url || !url.includes('gdacs.org')) {
    url = 'https://www.gdacs.org/';
  }
  return {
    sourceName: 'GDACS',
    sourceUrl: url,
  };
}

// ---------------------------------------------------------------------------
// Seed Data (10 Hazard Categories Represented)
// ---------------------------------------------------------------------------

const seededEvents: EventRecord[] = ([
  {
    id: 'eq-japan-1',
    title: 'Mw 7.4 offshore earthquake',
    hazardCategory: 'Earthquake',
    severity: 'Critical',
    latitude: 38.32,
    longitude: 142.36,
    location: 'Offshore Honshu, Japan',
    country: 'Japan',
    source: 'Demo scenario',
    status: 'Alert',
    eventTime: '2026-10-18T06:14:00Z',
    updatedAt: '2026-10-18T08:32:00Z',
    sourceUrl: 'https://earthquake.usgs.gov/',
    description: 'Strong offshore earthquake causing shaking across the Tohoku corridor and potential tsunami alert.',
    impact: 92,
    dataType: 'demo',
  },
  {
    id: 'flood-india-1',
    title: 'Monsoon flood surge',
    hazardCategory: 'Flood',
    severity: 'Severe',
    latitude: 23.18,
    longitude: 85.82,
    location: 'Bihar floodplain, India',
    country: 'India',
    source: 'Demo scenario',
    status: 'Monitoring',
    eventTime: '2026-10-17T18:00:00Z',
    updatedAt: '2026-10-18T09:05:00Z',
    sourceUrl: 'https://www.gdacs.org/',
    description: 'Persistent rainfall and riverine flooding affecting villages, roads, and river embankments.',
    impact: 81,
    dataType: 'demo',
  },
  {
    id: 'storm-philippines-1',
    title: 'Tropical cyclonic storm',
    hazardCategory: 'Cyclone',
    severity: 'Severe',
    latitude: 12.87,
    longitude: 121.48,
    location: 'West Philippine Sea',
    country: 'Philippines',
    source: 'Demo scenario',
    status: 'Alert',
    eventTime: '2026-10-16T12:00:00Z',
    updatedAt: '2026-10-18T07:00:00Z',
    sourceUrl: 'https://www.nhc.noaa.gov/',
    description: 'Cyclone track intersects the archipelago with sustained winds and rainfall risk for coastal communities.',
    impact: 76,
    dataType: 'demo',
  },
  {
    id: 'fire-california-1',
    title: 'Wildfire near forest edge',
    hazardCategory: 'Wildfire',
    severity: 'Moderate',
    latitude: 34.21,
    longitude: -118.54,
    location: 'Los Angeles foothills, United States',
    country: 'United States',
    source: 'Demo scenario',
    status: 'Monitoring',
    eventTime: '2026-10-15T22:40:00Z',
    updatedAt: '2026-10-18T02:20:00Z',
    sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
    description: 'Dry vegetation and strong winds create active fire behavior and smoke exposure concerns.',
    impact: 64,
    dataType: 'demo',
  },
  {
    id: 'volcano-indonesia-1',
    title: 'Volcanic ash plume',
    hazardCategory: 'Volcano',
    severity: 'Moderate',
    latitude: -8.12,
    longitude: 112.92,
    location: 'East Java, Indonesia',
    country: 'Indonesia',
    source: 'Demo scenario',
    status: 'Observed',
    eventTime: '2026-10-14T13:12:00Z',
    updatedAt: '2026-10-18T01:15:00Z',
    sourceUrl: 'https://www.ssd.noaa.gov/VAAC/vaac.html',
    description: 'Ash plume affects air routes and local communities with moderate aviation risk.',
    impact: 58,
    dataType: 'demo',
  },
  {
    id: 'storm-nz-1',
    title: 'Severe coastal storm',
    hazardCategory: 'Storm',
    severity: 'Severe',
    latitude: -43.53,
    longitude: 172.63,
    location: 'Canterbury coast, New Zealand',
    country: 'New Zealand',
    source: 'Demo scenario',
    status: 'Alert',
    eventTime: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T09:45:00Z',
    sourceUrl: 'https://www.metservice.com/',
    description: 'Gale-force coastal winds and squalls causing localized transport delays and power interruptions.',
    impact: 73,
    dataType: 'demo',
  },
  {
    id: 'drought-australia-1',
    title: 'Extended drought stress',
    hazardCategory: 'Drought',
    severity: 'Low',
    latitude: -25.27,
    longitude: 133.77,
    location: 'Outback region, Australia',
    country: 'Australia',
    source: 'Demo scenario',
    status: 'Monitoring',
    eventTime: '2026-10-03T00:00:00Z',
    updatedAt: '2026-10-18T06:45:00Z',
    sourceUrl: 'http://www.bom.gov.au/',
    description: 'Multi-month rainfall deficit reducing soil moisture and surface reservoir levels across pastoral zones.',
    impact: 47,
    dataType: 'demo',
  },
  {
    id: 'tsunami-pacific-1',
    title: 'Pacific tsunami watch',
    hazardCategory: 'Tsunami',
    severity: 'Critical',
    latitude: 20.5,
    longitude: -156.89,
    location: 'Hawaii, United States',
    country: 'United States',
    source: 'Demo scenario',
    status: 'Alert',
    eventTime: '2026-10-17T09:09:00Z',
    updatedAt: '2026-10-17T09:50:00Z',
    sourceUrl: 'https://www.tsunami.gov/',
    description: 'Deep-ocean sea-level anomaly detected triggering automated coastal evacuation notifications.',
    impact: 89,
    dataType: 'demo',
  },
  {
    id: 'landslide-brazil-1',
    title: 'Slope failure and landslide alert',
    hazardCategory: 'Landslide',
    severity: 'Severe',
    latitude: -22.9068,
    longitude: -43.1729,
    location: 'Rio de Janeiro slope corridor, Brazil',
    country: 'Brazil',
    source: 'Demo scenario',
    status: 'Alert',
    eventTime: '2026-10-18T04:20:00Z',
    updatedAt: '2026-10-18T08:15:00Z',
    sourceUrl: 'https://www.cemaden.gov.br/',
    description: 'Heavy precipitation triggers slope saturation and debris flow risk in steep hillside urban sectors.',
    impact: 78,
    dataType: 'demo',
  },
  {
    id: 'heat-spain-1',
    title: 'Extreme heatwave thermal anomaly',
    hazardCategory: 'Extreme Temperature',
    severity: 'Severe',
    latitude: 37.3891,
    longitude: -5.9845,
    location: 'Andalusia heat corridor, Spain',
    country: 'Spain',
    source: 'Demo scenario',
    status: 'Monitoring',
    eventTime: '2026-10-17T11:00:00Z',
    updatedAt: '2026-10-18T07:30:00Z',
    sourceUrl: 'https://www.aemet.es/',
    description: 'Persistent atmospheric heat dome elevating daytime temperatures above 42°C with high health advisories.',
    impact: 72,
    dataType: 'demo',
  },
] as EventRecord[]).map((e): EventRecord => ({
  ...e,
  sourceEventId: e.sourceEventId || e.id,
  officialAlertLevel: e.officialAlertLevel || 'Demonstration Scenario',
  pubDate: e.pubDate || e.eventTime,
  isCurrent: e.isCurrent ?? true,
}));

const initialSourceHealth: SourceHealth[] = [
  {
    name: 'USGS Earthquakes',
    status: 'Healthy',
    latency: 'Live',
    lastRefresh: 'Active feed',
    coverage: 'Global earthquakes M4.5+ (past 7 days)',
  },
  {
    name: 'GDACS Multi-Hazard',
    status: 'Healthy',
    latency: 'Live',
    lastRefresh: 'Active feed',
    coverage: 'Global floods, cyclones, volcanoes, and droughts',
  },
  {
    name: 'NASA EONET Feed',
    status: 'Healthy',
    latency: 'Live',
    lastRefresh: 'Active feed',
    coverage: 'Satellite-detected wildfires, storms, and natural events',
  },
  {
    name: 'Demo scenarios',
    status: 'Healthy',
    latency: 'Local',
    lastRefresh: 'Built-in examples',
    coverage: 'Multi-hazard scenarios across 10 global threat categories',
  },
  {
    name: 'Nebius AI (Token Factory)',
    status: 'Unconfigured',
    latency: '—',
    lastRefresh: 'Not configured',
    coverage: 'Optional AI-assisted hazard analysis (requires Nebius provider credentials)',
  },
];

const navigation = [
  { label: 'Home / Overview', icon: Globe2 },
  { label: 'Daily Intelligence', icon: ShieldAlert },
  { label: 'Global Monitor', icon: MapIcon },
  { label: 'Incident Explorer', icon: Search },
  { label: 'Scenario Builder', icon: Target },
  { label: 'Cascade Simulator', icon: Zap },
  { label: 'Impact Assessment', icon: TrendingUp },
  { label: 'Recommendations', icon: ShieldCheck },
  { label: 'Compare Scenarios', icon: Activity },
  { label: 'Reports', icon: Download },
  { label: 'Data Sources and System Health', icon: Database },
  { label: 'Settings and About', icon: Cpu },
] as const;

// ---------------------------------------------------------------------------
// Map Controller Component
// ---------------------------------------------------------------------------

function MapController({
  selectedCountry,
  selectedEvent,
  resetKey,
}: {
  selectedCountry: string;
  selectedEvent?: EventRecord | null;
  resetKey: number;
}) {
  const map = useMap();

  // Fix map sizing, container visibility changes, and window resizing
  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    map.invalidateSize();
    const t1 = setTimeout(handleResize, 150);
    const t2 = setTimeout(handleResize, 500);

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  // Reset to global world view
  useEffect(() => {
    if (resetKey > 0) {
      map.setView([20, 10], 2, { animate: true });
      map.invalidateSize();
    }
  }, [map, resetKey]);

  // Zoom to country bounding box or centroid when selected
  useEffect(() => {
    if (selectedCountry && selectedCountry !== 'All') {
      const geo = COUNTRY_GEO_DATA[selectedCountry];
      if (geo) {
        if (geo.bounds) {
          map.fitBounds(geo.bounds, { padding: [30, 30], maxZoom: 6, animate: true });
        } else {
          map.setView(geo.center, geo.zoom, { animate: true });
        }
      }
    }
  }, [map, selectedCountry]);

  // Smoothly pan to selected event
  useEffect(() => {
    if (
      selectedEvent &&
      typeof selectedEvent.latitude === 'number' &&
      typeof selectedEvent.longitude === 'number' &&
      !isNaN(selectedEvent.latitude) &&
      !isNaN(selectedEvent.longitude)
    ) {
      const currentZoom = map.getZoom();
      map.flyTo([selectedEvent.latitude, selectedEvent.longitude], Math.max(currentZoom, 5), {
        duration: 0.8,
      });
    }
  }, [map, selectedEvent]);

  return null;
}

// ---------------------------------------------------------------------------
// Page: Home / Overview
// ---------------------------------------------------------------------------

function OverviewPage({
  events,
  onSelectEvent,
  onNavigateToPage,
}: {
  events: EventRecord[];
  onSelectEvent: (id: string) => void;
  onNavigateToPage?: (page: string) => void;
}) {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [recentChanges, setRecentChanges] = useState<DbNotification[]>([]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      apiRequest<{ status: string; briefing: DailyBriefing }>('/api/intelligence/daily').catch(() => null),
      apiRequest<{ notifications: DbNotification[] }>('/api/notifications?limit=5').catch(() => null),
    ]).then(([briefRes, notifRes]) => {
      if (!isMounted) return;
      if (briefRes && briefRes.briefing) setBriefing(briefRes.briefing);
      if (notifRes && notifRes.notifications) setRecentChanges(notifRes.notifications);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const hazardCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      map[e.hazardCategory] = (map[e.hazardCategory] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [events]);

  const severityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      map[e.severity] = (map[e.severity] || 0) + 1;
    }
    return ['Critical', 'Severe', 'Moderate', 'Low'].map((sev) => ({
      name: sev,
      value: map[sev] || 0,
      color: getSeverityColor(sev as Severity),
    }));
  }, [events]);

  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      if (e.country && e.country !== 'Unknown') {
        map[e.country] = (map[e.country] || 0) + 1;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, value]) => ({ name, value }));
  }, [events]);

  const criticalCount = events.filter((e) => e.severity === 'Critical').length;
  const severeCount = events.filter((e) => e.severity === 'Severe').length;
  const activeHazards = new Set(events.map((e) => e.hazardCategory)).size;
  const countriesCount = new Set(events.map((e) => e.country).filter((c) => c && c !== 'Unknown')).size;

  return (
    <div className="page-content">
      {/* Prominent Daily Global Intelligence Card */}
      {briefing && (
        <section className="intel-hero-card animate-fade-in" style={{ marginBottom: '24px' }}>
          <div className="intel-hero-meta">
            <span className="intel-label">🛰️ Daily Global Intelligence</span>
            <span className="intel-label">📅 {briefing.dateStr}</span>
            <span className="intel-label" style={{ color: '#10b981' }}>✅ {briefing.verificationStatus}</span>
            <span className="intel-label">🎯 Credibility: {briefing.credibilityScore}</span>
            <span className="intel-label">🕐 Generated: {formatRelativeTime(briefing.createdAt)}</span>
          </div>

          <h2 className="intel-hero-headline">{briefing.headline}</h2>
          <p className="intel-hero-summary">{briefing.summary}</p>

          <div className="intel-hero-grid">
            <div className="intel-detail-block">
              <div className="intel-detail-label">📰 What Happened</div>
              <div className="intel-detail-text">{briefing.whatHappened}</div>
            </div>
            <div className="intel-detail-block">
              <div className="intel-detail-label">🔄 What Is Changing</div>
              <div className="intel-detail-text">{briefing.whatIsChanging}</div>
            </div>
            <div className="intel-detail-block">
              <div className="intel-detail-label">📍 Areas Affected</div>
              <div className="intel-detail-text">{briefing.areasAffected}</div>
            </div>
            <div className="intel-detail-block">
              <div className="intel-detail-label">🛡️ Official Guidance</div>
              <div className="intel-detail-text">{briefing.officialGuidance}</div>
            </div>
          </div>

          <div className="intel-hero-actions">
            {briefing.heroEvent && (
              <button
                className="action-button"
                onClick={() => briefing.heroEvent && onSelectEvent(briefing.heroEvent.id)}
              >
                <MapIcon size={14} />
                Inspect on World Map
              </button>
            )}
            {briefing.heroEvent?.sourceUrl && (
              <a
                href={briefing.heroEvent.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ghost-button"
              >
                <ExternalLink size={14} />
                Official Source ({briefing.heroEvent.source})
              </a>
            )}
            {onNavigateToPage && (
              <button
                className="ghost-button"
                onClick={() => onNavigateToPage('Daily Intelligence')}
                style={{ marginLeft: 'auto' }}
              >
                <ShieldAlert size={14} />
                Open Full Daily Intelligence Dossier &rarr;
              </button>
            )}
          </div>
        </section>
      )}

      {/* Primary Metrics Grid */}
      <section className="summary-grid">
        <div className="panel metric-card card-interactive animate-fade-in stagger-1">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Active Disasters Tracked</span>
            <span className="live-beacon"><span className="live-beacon-dot" /> LIVE</span>
          </div>
          <div className="metric-value">
            <AnimatedCounter value={events.length} />
          </div>
          <p>Global real-time and scenario records</p>
        </div>
        <div className="panel metric-card card-interactive animate-fade-in stagger-2">
          <div className="metric-label">Critical Alerts</div>
          <div className="metric-value" style={{ color: '#ef4444' }}>
            <AnimatedCounter value={criticalCount} />
          </div>
          <p>Highest severity emergencies</p>
        </div>
        <div className="panel metric-card card-interactive animate-fade-in stagger-3">
          <div className="metric-label">Severe Threat Events</div>
          <div className="metric-value" style={{ color: '#f97316' }}>
            <AnimatedCounter value={severeCount} />
          </div>
          <p>Elevated response advisories</p>
        </div>
        <div className="panel metric-card card-interactive animate-fade-in stagger-4">
          <div className="metric-label">Hazard Classes Active</div>
          <div className="metric-value">
            <AnimatedCounter value={activeHazards} /> / 10
          </div>
          <p>Earthquake, Flood, Cyclone, Fire, etc.</p>
        </div>
        <div className="panel metric-card card-interactive animate-fade-in stagger-5">
          <div className="metric-label">Countries & Territories</div>
          <div className="metric-value">
            <AnimatedCounter value={countriesCount} />
          </div>
          <p>Geolocated impact zones</p>
        </div>
      </section>

      <section className="chart-grid">
        <div className="panel animate-fade-in stagger-3">
          <h3>Hazard Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hazardCounts} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis dataKey="name" stroke="var(--muted)" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0b1329',
                  borderColor: '#334155',
                  color: '#ffffff',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  padding: '8px 12px',
                }}
                itemStyle={{ color: '#38bdf8', fontWeight: 600 }}
                labelStyle={{ color: '#ffffff', fontWeight: 700 }}
              />
              <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel animate-fade-in stagger-4">
          <h3>Severity Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={severityCounts}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={75}
                label={({ name, value, percent }: any) => {
                  if (!percent || percent < 0.05) return '';
                  return `${name}: ${value}`;
                }}
                labelLine={false}
                isAnimationActive={true}
                animationDuration={800}
              >
                {severityCounts.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    const item = payload[0];
                    return (
                      <div
                        style={{
                          backgroundColor: '#0b1329',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.7)',
                          color: '#ffffff',
                          minWidth: '150px',
                        }}
                      >
                        <div style={{ color: item.payload?.color || '#38bdf8', fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                          {item.name} Severity
                        </div>
                        <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>
                          {item.value} <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>active events</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                formatter={(val) => <span style={{ color: '#e2e8f0', fontWeight: 500, fontSize: '12px' }}>{val}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel narrow-panel animate-fade-in stagger-5">
          <h3>Top Affected Regions</h3>
          <div className="stack-list">
            {countryCounts.map((item) => (
              <div className="stack-row" key={item.name}>
                <span>{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Incident Alerts */}
      <section className="panel">
        <div className="map-toolbar">
          <h3>Latest Incident Alerts</h3>
          <span className="eyebrow">Showing 6 newest events</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Category</th>
                <th>Location</th>
                <th>Time</th>
                <th>Source</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 6).map((event) => (
                <tr key={event.id}>
                  <td><strong>{event.title}</strong></td>
                  <td>
                    <span className="hazard-badge">
                      <HazardSymbol hazard={event.hazardCategory} />
                      {event.hazardCategory}
                    </span>
                  </td>
                  <td>{event.location}</td>
                  <td>{formatDate(event.eventTime)}</td>
                  <td>{event.source}</td>
                  <td>
                    <span
                      className="severity-badge"
                      style={{
                        background: `${getSeverityColor(event.severity)}22`,
                        color: getSeverityColor(event.severity),
                        border: `1px solid ${getSeverityColor(event.severity)}44`,
                      }}
                    >
                      {event.severity}
                    </span>
                  </td>
                  <td>
                    <span className={`data-type-pill ${event.dataType || 'live'}`}>
                      {event.dataType || 'live'}
                    </span>
                  </td>
                  <td>
                    <button className="ghost-button" onClick={() => onSelectEvent(event.id)}>
                      Inspect on Map
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Change Detection Timeline */}
      {recentChanges.length > 0 && (
        <section className="panel animate-fade-in" style={{ marginTop: '20px' }}>
          <div className="map-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="live-beacon-dot" />
              <h3>Recent Updates & Change Detection Timeline</h3>
            </div>
            <span className="eyebrow">Real-time change analysis from authoritative networks</span>
          </div>

          <div className="intel-notif-list">
            {recentChanges.map((change) => (
              <div
                key={change.id}
                className="intel-notif-item animate-fade-in"
                onClick={() => change.eventId && onSelectEvent(change.eventId)}
                style={{ cursor: change.eventId ? 'pointer' : 'default' }}
              >
                <div className="intel-notif-icon">🔄</div>
                <div className="intel-notif-body">
                  <div className="intel-notif-headline">{change.headline}</div>
                  <div className="intel-notif-change">{change.changeSummary}</div>
                  <div className="intel-notif-meta">
                    <span>📍 {change.location}, {change.country}</span>
                    <span>·</span>
                    <span>⚠️ {change.severity}</span>
                    <span>·</span>
                    <span>🕐 Detected {formatRelativeTime(change.createdAt)}</span>
                    <span>·</span>
                    <span>📡 {change.source}</span>
                    {change.sourceUrl && (
                      <a
                        href={change.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px' }}
                      >
                        Source <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Global Monitor (Interactive World Map & GDACS-style Intelligence)
// ---------------------------------------------------------------------------

function GlobalMonitorPage({
  events,
  selectedEventId,
  setSelectedEventId,
  setActivePage,
  theme,
  onPreloadScenario,
  refreshing = false,
}: {
  events: EventRecord[];
  selectedEventId: string;
  setSelectedEventId: (value: string) => void;
  setActivePage: (page: string) => void;
  theme: 'dark' | 'light';
  onPreloadScenario: (event: EventRecord) => void;
  refreshing?: boolean;
}) {
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [countrySearch, setCountrySearch] = useState('');
  const [hazard, setHazard] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [timeRange, setTimeRange] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [mapResetKey, setMapResetKey] = useState(0);

  // Available countries derived from all ingested events and standard geo keys
  const allCountries = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.country && e.country !== 'Unknown' && e.country !== 'International' && e.country !== 'Global Waters / Territory') {
        set.add(e.country);
      }
    }
    for (const c of Object.keys(COUNTRY_GEO_DATA)) {
      set.add(c);
    }
    return ['All', ...Array.from(set).sort()];
  }, [events]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return allCountries;
    const q = countrySearch.toLowerCase();
    return allCountries.filter((c) => c.toLowerCase().includes(q));
  }, [allCountries, countrySearch]);

  const hazardFilterOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: 'All', label: 'All Hazard Classes' },
      { value: 'Earthquake', label: 'Earthquake', icon: <HazardSymbol hazard="Earthquake" /> },
      { value: 'Cyclone', label: 'Cyclone / Typhoon', icon: <HazardSymbol hazard="Cyclone" /> },
      { value: 'Flood', label: 'Flood Emergency', icon: <HazardSymbol hazard="Flood" /> },
      { value: 'Wildfire', label: 'Wildfire / Bushfire', icon: <HazardSymbol hazard="Wildfire" /> },
      { value: 'Volcano', label: 'Volcanic Eruption', icon: <HazardSymbol hazard="Volcano" /> },
      { value: 'Tsunami', label: 'Tsunami Threat', icon: <HazardSymbol hazard="Tsunami" /> },
      { value: 'Drought', label: 'Severe Drought', icon: <HazardSymbol hazard="Drought" /> },
      { value: 'Storm', label: 'Severe Storm', icon: <HazardSymbol hazard="Storm" /> },
      { value: 'Landslide', label: 'Landslide / Mudflow', icon: <HazardSymbol hazard="Landslide" /> },
      { value: 'Extreme Temperature', label: 'Extreme Temp', icon: <HazardSymbol hazard="Extreme Temperature" /> },
    ],
    []
  );

  const severityFilterOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: 'All', label: 'All Severity Levels' },
      { value: 'Critical', label: 'Critical', badge: 'Tier 4', badgeColor: '#ef4444' },
      { value: 'Severe', label: 'Severe', badge: 'Tier 3', badgeColor: '#f97316' },
      { value: 'Moderate', label: 'Moderate', badge: 'Tier 2', badgeColor: '#eab308' },
      { value: 'Low', label: 'Low', badge: 'Tier 1', badgeColor: '#10b981' },
    ],
    []
  );

  const timeRangeFilterOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: 'All', label: 'All Timestamps' },
      { value: '24h', label: 'Past 24 Hours' },
      { value: '7d', label: 'Past 7 Days' },
      { value: '30d', label: 'Past 30 Days' },
    ],
    []
  );

  const sortByFilterOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: 'latest', label: 'Event Time (Newest)' },
      { value: 'oldest', label: 'Event Time (Oldest)' },
      { value: 'severity', label: 'Severity (Critical First)' },
      { value: 'impact', label: 'Impact Score (High to Low)' },
    ],
    []
  );

  const countryFilterOptions = useMemo<CustomSelectOption[]>(
    () => filteredCountries.map((c) => ({ value: c, label: c === 'All' ? 'All Countries / Regions' : c })),
    [filteredCountries]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();

    return events
      .filter((event) => {
        // Country filter
        const matchesCountry = selectedCountry === 'All' || event.country === selectedCountry;

        // Hazard filter
        const matchesHazard = hazard === 'All' || event.hazardCategory === hazard;

        // Severity filter
        const matchesSeverity = severity === 'All' || event.severity === severity;

        // Time range filter
        let matchesTime = true;
        if (timeRange !== 'All') {
          const evTime = new Date(event.eventTime).getTime();
          const ageHours = (now - evTime) / (1000 * 60 * 60);
          if (timeRange === '24h') matchesTime = ageHours <= 24;
          else if (timeRange === '7d') matchesTime = ageHours <= 24 * 7;
          else if (timeRange === '30d') matchesTime = ageHours <= 24 * 30;
        }

        // Text search
        const matchesSearch =
          q.length === 0 ||
          event.title.toLowerCase().includes(q) ||
          event.location.toLowerCase().includes(q) ||
          event.country.toLowerCase().includes(q) ||
          event.hazardCategory.toLowerCase().includes(q) ||
          event.description.toLowerCase().includes(q);

        return matchesCountry && matchesHazard && matchesSeverity && matchesTime && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const rank = { Critical: 4, Severe: 3, Moderate: 2, Low: 1 };
          return (rank[b.severity] || 0) - (rank[a.severity] || 0);
        }
        if (sortBy === 'impact') {
          return (b.impact || 0) - (a.impact || 0);
        }
        if (sortBy === 'oldest') {
          return new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
        }
        // latest (default)
        return new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime();
      });
  }, [events, selectedCountry, hazard, severity, timeRange, search, sortBy]);

  const selectedEvent = filtered.find((e) => e.id === selectedEventId) || filtered[0] || events[0];

  const clearAllFilters = () => {
    setSelectedCountry('All');
    setCountrySearch('');
    setHazard('All');
    setSeverity('All');
    setTimeRange('All');
    setSearch('');
    setSortBy('latest');
    setMapResetKey((k) => k + 1);
  };

  // Reliable, publicly accessible basemaps (100% free, no API key required)
  type BasemapKey = 'dark' | 'osm' | 'satellite' | 'topo';

  const BASEMAP_OPTIONS: Record<
    BasemapKey,
    { key: BasemapKey; label: string; url: string; attribution: string; maxZoom: number }
  > = {
    dark: {
      key: 'dark',
      label: 'Dark Tactical Canvas (Esri)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16,
    },
    osm: {
      key: 'osm',
      label: 'OpenStreetMap Standard',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    satellite: {
      key: 'satellite',
      label: 'Satellite Telemetry (Esri)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid',
      maxZoom: 18,
    },
    topo: {
      key: 'topo',
      label: 'Topographic Terrain (Esri)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, USGS, FAO, NPS, NRCAN, GeoBase',
      maxZoom: 18,
    },
  };

  const [basemapKey, setBasemapKey] = useState<BasemapKey>(() => (theme === 'dark' ? 'dark' : 'osm'));
  const [tileLoadError, setTileLoadError] = useState(false);
  const [animationsPaused, setAnimationsPaused] = useState(false);

  useEffect(() => {
    setBasemapKey(theme === 'dark' ? 'dark' : 'osm');
    setTileLoadError(false);
  }, [theme]);

  const activeBasemap = tileLoadError ? BASEMAP_OPTIONS.osm : (BASEMAP_OPTIONS[basemapKey] || BASEMAP_OPTIONS.osm);

  // Filter only events with valid geographical coordinates
  const plottableEvents = useMemo(() => {
    return filtered.filter(
      (e) =>
        typeof e.latitude === 'number' &&
        typeof e.longitude === 'number' &&
        !isNaN(e.latitude) &&
        !isNaN(e.longitude) &&
        e.latitude >= -90 &&
        e.latitude <= 90 &&
        e.longitude >= -180 &&
        e.longitude <= 180
    );
  }, [filtered]);

  const liveCount = filtered.filter((e) => (e.dataType || 'live') === 'live').length;
  const criticalCount = filtered.filter((e) => e.severity === 'Critical').length;
  const severeCount = filtered.filter((e) => e.severity === 'Severe').length;

  return (
    <div className="page-content animate-fade-in">
      {/* Filter Toolbar */}
      <section className="controls-panel panel">
        <div className="control-grid">
          <label>
            Country / Region
            <CustomSelect
              value={selectedCountry}
              onChange={(val) => setSelectedCountry(val)}
              options={countryFilterOptions}
              ariaLabel="Country / Region"
            />
          </label>

          <label>
            Hazard Class
            <CustomSelect
              value={hazard}
              onChange={(val) => setHazard(val)}
              options={hazardFilterOptions}
              ariaLabel="Hazard Class"
            />
          </label>

          <label>
            Severity Level
            <CustomSelect
              value={severity}
              onChange={(val) => setSeverity(val)}
              options={severityFilterOptions}
              ariaLabel="Severity Level"
            />
          </label>

          <label>
            Time Horizon
            <CustomSelect
              value={timeRange}
              onChange={(val) => setTimeRange(val)}
              options={timeRangeFilterOptions}
              ariaLabel="Time Horizon"
            />
          </label>
        </div>

        <div className="control-grid" style={{ marginTop: '12px' }}>
          <label className="search-field" style={{ gridColumn: 'span 2' }}>
            Search Multi-Hazard Stream
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title, place, country, description, or keyword..."
            />
          </label>

          <label>
            Sort By
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={sortByFilterOptions}
              ariaLabel="Sort By"
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="ghost-button" onClick={clearAllFilters} style={{ width: '100%', height: '42px' }}>
              <RotateCcw size={15} style={{ marginRight: '6px' }} /> Clear Filters
            </button>
          </div>
        </div>
      </section>

      {/* Map & Detail Layout */}
      <section className="map-layout">
        <div className="panel map-panel" style={{ position: 'relative' }}>
          {refreshing && (
            <div className="map-loading-overlay">
              <div className="loading-spinner" />
              <span>Synchronizing Live Global Hazard Telemetry...</span>
            </div>
          )}
          <div className="map-toolbar">
            <div className="map-stats-strip">
              <span className="stat-pill">
                <strong><AnimatedCounter value={filtered.length} /></strong> of {events.length} shown
              </span>
              <span className="stat-pill">
                Live: <strong><AnimatedCounter value={liveCount} /></strong>
              </span>
              <span className="stat-pill" style={{ color: '#ef4444' }}>
                Critical: <strong><AnimatedCounter value={criticalCount} /></strong>
              </span>
              <span className="stat-pill" style={{ color: '#f97316' }}>
                Severe: <strong><AnimatedCounter value={severeCount} /></strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <label style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                <Layers size={14} style={{ color: 'var(--primary)' }} />
                <span>Basemap:</span>
                <select
                  value={basemapKey}
                  onChange={(e) => {
                    setBasemapKey(e.target.value as BasemapKey);
                    setTileLoadError(false);
                  }}
                  style={{ padding: '4px 28px 4px 8px', fontSize: '0.78rem', height: '32px' }}
                >
                  <option value="dark">Dark Tactical Canvas (Esri)</option>
                  <option value="osm">OpenStreetMap Standard</option>
                  <option value="satellite">Satellite Telemetry (Esri)</option>
                  <option value="topo">Topographic Terrain (Esri)</option>
                </select>
              </label>

              <button
                className={`ghost-button ${animationsPaused ? 'active' : ''}`}
                style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem' }}
                onClick={() => setAnimationsPaused((p) => !p)}
                title={animationsPaused ? 'Resume pulsing animations' : 'Pause marker animations'}
              >
                {animationsPaused ? <Play size={13} style={{ marginRight: '4px' }} /> : <Pause size={13} style={{ marginRight: '4px' }} />}
                {animationsPaused ? 'Animations: Paused' : 'Animations: Active'}
              </button>

              <button
                className="ghost-button"
                style={{ height: '32px', padding: '0 10px', fontSize: '0.78rem' }}
                onClick={() => setMapResetKey((k) => k + 1)}
              >
                <Compass size={13} style={{ marginRight: '4px' }} /> Reset to World
              </button>
            </div>
          </div>

          <MapContainer center={[20, 10]} zoom={2} minZoom={1.8} scrollWheelZoom className="leaflet-map">
            <MapController
              selectedCountry={selectedCountry}
              selectedEvent={selectedEvent}
              resetKey={mapResetKey}
            />
            <TileLayer
              key={`${activeBasemap.key}-${tileLoadError ? 'fallback' : 'primary'}`}
              attribution={activeBasemap.attribution}
              url={activeBasemap.url}
              maxZoom={activeBasemap.maxZoom}
              eventHandlers={{
                tileerror: () => {
                  if (!tileLoadError && basemapKey !== 'osm') {
                    console.warn('Basemap tile failed to load; gracefully falling back to OpenStreetMap standard.');
                    setTileLoadError(true);
                  }
                },
              }}
            />

            {plottableEvents.map((event) => {
              const isSelected = selectedEvent?.id === event.id;
              const icon = createHazardMarkerIcon(event, isSelected, animationsPaused);

              return (
                <Marker
                  key={event.id}
                  position={[event.latitude, event.longitude]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setSelectedEventId(event.id),
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -18]} opacity={0.95}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: getSeverityColor(event.severity), fontWeight: 700 }}>
                          [{event.severity}]
                        </span>
                        <strong>{event.hazardCategory}</strong>
                      </div>
                      <div>{event.title}</div>
                      <small style={{ color: 'var(--muted)' }}>{event.location}</small>
                    </div>
                  </LeafletTooltip>

                  <Popup>
                    <div className="popup-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span className="popup-tag">
                          <HazardSymbol hazard={event.hazardCategory} />
                          {event.hazardCategory}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: getSeverityColor(event.severity),
                            background: `${getSeverityColor(event.severity)}22`,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${getSeverityColor(event.severity)}44`,
                          }}
                        >
                          {event.severity}
                        </span>
                      </div>
                      <strong style={{ fontSize: '0.9rem', marginTop: '4px' }}>{event.title}</strong>
                      <small style={{ color: 'var(--text-secondary)' }}>
                        <strong>Location:</strong> {event.location || event.country || 'Unknown'}
                      </small>
                      <small style={{ color: 'var(--text-secondary)' }}>
                        <strong>Recorded:</strong> {formatDate(event.eventTime)}
                      </small>
                      <small style={{ color: 'var(--text-secondary)' }}>
                        <strong>Source:</strong> {getAuthoritativeSourceInfo(event).sourceName} · <strong>Status:</strong> {event.status || 'Active'}
                      </small>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          className="action-button"
                          style={{ padding: '5px 8px', fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                          onClick={() => setSelectedEventId(event.id)}
                        >
                          Inspect Dossier
                        </button>
                        <a
                          href={getAuthoritativeSourceInfo(event).sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ghost-button"
                          style={{ padding: '5px 8px', fontSize: '0.75rem', flex: 1, justifyContent: 'center', textDecoration: 'none' }}
                          title={`Open official ${getAuthoritativeSourceInfo(event).sourceName} record: ${getAuthoritativeSourceInfo(event).sourceUrl}`}
                        >
                          <ExternalLink size={12} style={{ marginRight: '4px' }} />
                          Source Record
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map Legend */}
          <div className="map-legend-box">
            <div className="legend-section">
              <h4>Multi-Hazard Symbols</h4>
              <div className="legend-items">
                {(
                  [
                    'Earthquake',
                    'Cyclone',
                    'Flood',
                    'Wildfire',
                    'Volcano',
                    'Tsunami',
                    'Drought',
                    'Storm',
                    'Landslide',
                    'Extreme Temperature',
                  ] as HazardCategory[]
                ).map((hz) => (
                  <span className="legend-item" key={hz}>
                    <HazardSymbol hazard={hz} /> {hz}
                  </span>
                ))}
              </div>
            </div>

            <div className="legend-section" style={{ marginTop: '8px' }}>
              <h4>Threat Severity Tiers</h4>
              <div className="legend-items">
                <span>
                  <i style={{ background: '#ef4444' }} /> Critical (Immediate Life / Infrastructure Threat)
                </span>
                <span>
                  <i style={{ background: '#f97316' }} /> Severe (Major Warning & Advisory)
                </span>
                <span>
                  <i style={{ background: '#eab308' }} /> Moderate (Watch & Active Monitoring)
                </span>
                <span>
                  <i style={{ background: '#10b981' }} /> Low (Recorded Baseline)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Incident Detail Panel */}
        <div className="panel detail-panel enter" key={selectedEvent?.id || 'none'}>
          {selectedEvent ? (
            <>
              <div className="detail-header">
                <div>
                  <span className="eyebrow">Dossier · ID: {selectedEvent.id}</span>
                  <h3 style={{ margin: '4px 0 6px' }}>{selectedEvent.title}</h3>
                </div>
                <span
                  className="severity-badge"
                  style={{
                    background: `${getSeverityColor(selectedEvent.severity)}22`,
                    color: getSeverityColor(selectedEvent.severity),
                    border: `1px solid ${getSeverityColor(selectedEvent.severity)}55`,
                  }}
                >
                  {selectedEvent.severity}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="hazard-badge">
                  <HazardSymbol hazard={selectedEvent.hazardCategory} />
                  {selectedEvent.hazardCategory}
                </span>
                <span className={`data-type-pill ${selectedEvent.dataType || 'live'}`}>
                  {selectedEvent.dataType || 'live'} record
                </span>
                <span className="stat-pill">Status: {selectedEvent.status}</span>
              </div>

              <div className="metadata-grid">
                <div>
                  <label>Country / Sovereignty</label>
                  <p><strong>{selectedEvent.country || 'Global Territory'}</strong></p>
                </div>
                <div>
                  <label>Region / Zone</label>
                  <p>{selectedEvent.location}</p>
                </div>
                <div>
                  <label>Coordinates</label>
                  <p>{selectedEvent.latitude.toFixed(4)}°, {selectedEvent.longitude.toFixed(4)}°</p>
                </div>
                <div>
                  <label>Authoritative Provider</label>
                  <p><strong>{selectedEvent.source}</strong></p>
                </div>
                <div>
                  <label>Official Alert Level</label>
                  <p>
                    <span style={{ fontWeight: 700, color: getSeverityColor(selectedEvent.severity) }}>
                      {selectedEvent.officialAlertLevel || selectedEvent.severity}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '4px' }}>
                      (via {selectedEvent.source})
                    </span>
                  </p>
                </div>
                <div>
                  <label>Source Event ID</label>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{selectedEvent.sourceEventId || selectedEvent.id}</p>
                </div>
                <div>
                  <label>Publication Date</label>
                  <p>{selectedEvent.pubDate ? formatDate(selectedEvent.pubDate) : 'Not specified by source'}</p>
                </div>
                <div>
                  <label>Event Origin Time</label>
                  <p>{formatDate(selectedEvent.eventTime)}</p>
                </div>
                <div>
                  <label>Last Source Update</label>
                  <p>{formatDate(selectedEvent.updatedAt)}</p>
                </div>
              </div>

              <div className="impact-bar-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span>Estimated Severity / Impact Index</span>
                  <strong>{selectedEvent.impact} / 100</strong>
                </div>
                <div className="impact-bar-track">
                  <div
                    className="impact-bar-fill"
                    style={{
                      width: `${selectedEvent.impact}%`,
                      background: getSeverityColor(selectedEvent.severity),
                    }}
                  />
                </div>
                <small style={{ color: 'var(--muted)', fontSize: '0.72rem', display: 'block', marginTop: '5px', lineHeight: 1.4 }}>
                  Estimated Impact Index (Algorithmic Multi-Vector Assessment): Derived from hazard classification, reported intensity metrics, and regional exposure. Not an official agency casualty figure.
                </small>
              </div>

              <p style={{ lineHeight: 1.5, fontSize: '0.9rem' }}>{selectedEvent.description}</p>

              <div className="inline-actions">
                <a
                  href={getAuthoritativeSourceInfo(selectedEvent).sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-button"
                  title={`Open verified official record at ${getAuthoritativeSourceInfo(selectedEvent).sourceName}: ${getAuthoritativeSourceInfo(selectedEvent).sourceUrl}`}
                  id="btn-official-source-record"
                >
                  <ExternalLink size={15} style={{ marginRight: '6px' }} /> Official Source Record ({getAuthoritativeSourceInfo(selectedEvent).sourceName})
                </a>
                <button
                  className="ghost-button"
                  onClick={() => {
                    onPreloadScenario(selectedEvent);
                    setActivePage('Scenario Builder');
                  }}
                >
                  <Target size={15} style={{ marginRight: '6px' }} /> Simulate Cascades
                </button>
                <button className="ghost-button" onClick={() => setActivePage('Incident Explorer')}>
                  Open Table View
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--muted)' }}>
              <p>No disaster incidents match your current filter criteria.</p>
              <button className="action-button" onClick={clearAllFilters} style={{ marginTop: '10px' }}>
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Incident Explorer
// ---------------------------------------------------------------------------

function IncidentExplorerPage({
  events,
  selectedEventId,
  setSelectedEventId,
  setActivePage,
}: {
  events: EventRecord[];
  selectedEventId: string;
  setSelectedEventId: (value: string) => void;
  setActivePage: (page: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHazard, setFilterHazard] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return events.filter((e) => {
      const matchHz = filterHazard === 'All' || e.hazardCategory === filterHazard;
      const matchSev = filterSeverity === 'All' || e.severity === filterSeverity;
      const matchQ =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q);
      return matchHz && matchSev && matchQ;
    });
  }, [events, searchTerm, filterHazard, filterSeverity]);

  const hazardFilterOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: 'All', label: 'All Hazard Types' },
      { value: 'Earthquake', label: 'Earthquake', icon: <HazardSymbol hazard="Earthquake" /> },
      { value: 'Cyclone', label: 'Cyclone / Typhoon', icon: <HazardSymbol hazard="Cyclone" /> },
      { value: 'Flood', label: 'Flood Emergency', icon: <HazardSymbol hazard="Flood" /> },
      { value: 'Wildfire', label: 'Wildfire', icon: <HazardSymbol hazard="Wildfire" /> },
      { value: 'Volcano', label: 'Volcano', icon: <HazardSymbol hazard="Volcano" /> },
      { value: 'Tsunami', label: 'Tsunami', icon: <HazardSymbol hazard="Tsunami" /> },
      { value: 'Drought', label: 'Drought', icon: <HazardSymbol hazard="Drought" /> },
      { value: 'Storm', label: 'Severe Storm', icon: <HazardSymbol hazard="Storm" /> },
      { value: 'Landslide', label: 'Landslide', icon: <HazardSymbol hazard="Landslide" /> },
      { value: 'Extreme Temperature', label: 'Extreme Temp', icon: <HazardSymbol hazard="Extreme Temperature" /> },
    ],
    []
  );

  const severityFilterOptions = useMemo<CustomSelectOption[]>(
    () => [
      { value: 'All', label: 'All Severities' },
      { value: 'Critical', label: 'Critical', badge: 'Tier 4', badgeColor: '#ef4444' },
      { value: 'Severe', label: 'Severe', badge: 'Tier 3', badgeColor: '#f97316' },
      { value: 'Moderate', label: 'Moderate', badge: 'Tier 2', badgeColor: '#eab308' },
      { value: 'Low', label: 'Low', badge: 'Tier 1', badgeColor: '#10b981' },
    ],
    []
  );

  return (
    <div className="page-content animate-fade-in">
      <section className="panel controls-panel">
        <div className="control-grid">
          <label style={{ gridColumn: 'span 2' }}>
            Filter Directory
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by event title, location, country, or agency..."
            />
          </label>
          <label>
            Hazard Type
            <CustomSelect
              value={filterHazard}
              onChange={(val) => setFilterHazard(val)}
              options={hazardFilterOptions}
              ariaLabel="Filter by Hazard Type"
            />
          </label>
          <label>
            Severity
            <CustomSelect
              value={filterSeverity}
              onChange={(val) => setFilterSeverity(val)}
              options={severityFilterOptions}
              ariaLabel="Filter by Severity"
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="map-toolbar">
          <h3>Incident Records ({filtered.length} total)</h3>
          <span className="eyebrow">Real-time normalized stream</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event Title</th>
                <th>Category</th>
                <th>Location / Country</th>
                <th>Time (UTC)</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr
                  key={event.id}
                  className={`table-row-interactive ${selectedEventId === event.id ? 'selected-row' : ''}`}
                  onClick={() => setSelectedEventId(event.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><strong>{event.title}</strong></td>
                  <td>
                    <span className="hazard-badge">
                      <HazardSymbol hazard={event.hazardCategory} />
                      {event.hazardCategory}
                    </span>
                  </td>
                  <td>{event.location}</td>
                  <td>{formatDate(event.eventTime)}</td>
                  <td>
                    <span
                      className="severity-badge"
                      style={{
                        background: `${getSeverityColor(event.severity)}22`,
                        color: getSeverityColor(event.severity),
                        border: `1px solid ${getSeverityColor(event.severity)}44`,
                      }}
                    >
                      {event.severity}
                    </span>
                  </td>
                  <td>{event.source}</td>
                  <td>
                    <span className={`data-type-pill ${event.dataType || 'live'}`}>
                      {event.dataType || 'live'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        className="ghost-button"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                          setActivePage('Global Monitor');
                        }}
                      >
                        Inspect Map
                      </button>
                      <a
                        href={getAuthoritativeSourceInfo(event).sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ghost-button"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                        title={`Open official ${getAuthoritativeSourceInfo(event).sourceName} record: ${getAuthoritativeSourceInfo(event).sourceUrl}`}
                      >
                        <ExternalLink size={12} style={{ marginRight: '3px' }} /> {getAuthoritativeSourceInfo(event).sourceName}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Scenario Builder (with AI Explain via Nebius)
// ---------------------------------------------------------------------------

function ScenarioBuilderPage({
  scenario,
  setScenario,
  selectedEvent,
}: {
  scenario: Scenario;
  setScenario: React.Dispatch<React.SetStateAction<Scenario>>;
  selectedEvent: EventRecord;
}) {
  const [analysis, setAnalysis] = useState<AiResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const scenarioSummary = useMemo(() => {
    return `Scenario: ${scenario.severity} ${scenario.hazard} impacting ${
      scenario.location || 'designated corridor'
    } (${scenario.country || 'Global'}). Secondary disruption: ${
      scenario.disruption || 'critical utility outage'
    }. Assumed duration: ${scenario.duration}. Vulnerable sector: ${
      scenario.infrastructure
    }. Population density: ${scenario.populationExposure}.`;
  }, [scenario]);

  const hazardOptions: CustomSelectOption<HazardCategory>[] = useMemo(
    () => [
      { value: 'Earthquake', label: 'Earthquake', icon: <HazardSymbol hazard="Earthquake" /> },
      { value: 'Flood', label: 'Flood', icon: <HazardSymbol hazard="Flood" /> },
      { value: 'Cyclone', label: 'Tropical Cyclone', icon: <HazardSymbol hazard="Cyclone" /> },
      { value: 'Wildfire', label: 'Wildfire', icon: <HazardSymbol hazard="Wildfire" /> },
      { value: 'Volcano', label: 'Volcanic Eruption', icon: <HazardSymbol hazard="Volcano" /> },
      { value: 'Tsunami', label: 'Tsunami', icon: <HazardSymbol hazard="Tsunami" /> },
      { value: 'Drought', label: 'Drought', icon: <HazardSymbol hazard="Drought" /> },
      { value: 'Storm', label: 'Severe Storm', icon: <HazardSymbol hazard="Storm" /> },
      { value: 'Landslide', label: 'Landslide', icon: <HazardSymbol hazard="Landslide" /> },
      { value: 'Extreme Temperature', label: 'Extreme Temperature', icon: <HazardSymbol hazard="Extreme Temperature" /> },
    ],
    []
  );

  const severityOptions: CustomSelectOption<Severity>[] = useMemo(
    () => [
      { value: 'Low', label: 'Low', badge: 'Tier 1', badgeColor: '#10b981' },
      { value: 'Moderate', label: 'Moderate', badge: 'Tier 2', badgeColor: '#eab308' },
      { value: 'Severe', label: 'Severe', badge: 'Tier 3', badgeColor: '#f97316' },
      { value: 'Critical', label: 'Critical', badge: 'Tier 4', badgeColor: '#ef4444' },
    ],
    []
  );

  const durationOptions: CustomSelectOption[] = useMemo(
    () => [
      { value: '6 to 12 hours (Acute shock)', label: '6 to 12 hours (Acute shock)' },
      { value: '24 to 48 hours (Intermediate disruption)', label: '24 to 48 hours (Intermediate disruption)' },
      { value: '3 to 7 days (Compounding crisis)', label: '3 to 7 days (Compounding crisis)' },
      { value: 'Multi-week (Catastrophic reconstruction)', label: 'Multi-week (Catastrophic reconstruction)' },
    ],
    []
  );

  const infrastructureOptions: CustomSelectOption[] = useMemo(
    () => [
      { value: 'Power Transmission & Substations', label: 'Power Transmission & Substations' },
      { value: 'Potable Water & Municipal Treatment', label: 'Potable Water & Municipal Treatment' },
      { value: 'Transport: Rail, Highways & Marine Ports', label: 'Transport: Rail, Highways & Marine Ports' },
      { value: 'Telecommunications & Cellular Networks', label: 'Telecommunications & Cellular Networks' },
      { value: 'Healthcare Facilities & Emergency Lifelines', label: 'Healthcare Facilities & Emergency Lifelines' },
    ],
    []
  );

  const exposureOptions: CustomSelectOption[] = useMemo(
    () => [
      { value: 'High-Density Metropolitan Core (>5,000/km²)', label: 'High-Density Metropolitan Core (>5,000/km²)' },
      { value: 'Suburban Mixed-Density Corridor (1,000–5,000/km²)', label: 'Suburban Mixed-Density Corridor (1,000–5,000/km²)' },
      { value: 'Rural Agricultural / River Basin (<1,000/km²)', label: 'Rural Agricultural / River Basin (<1,000/km²)' },
      { value: 'Coastal Lowland & Island Territory', label: 'Coastal Lowland & Island Territory' },
    ],
    []
  );

  const countryOptions: CustomSelectOption[] = useMemo(
    () => [
      { value: 'Japan', label: 'Japan' },
      { value: 'United States', label: 'United States' },
      { value: 'India', label: 'India' },
      { value: 'Australia', label: 'Australia' },
      { value: 'New Zealand', label: 'New Zealand' },
      { value: 'Indonesia', label: 'Indonesia' },
      { value: 'Philippines', label: 'Philippines' },
      { value: 'Italy', label: 'Italy' },
      { value: 'Greece', label: 'Greece' },
      { value: 'Turkey', label: 'Turkey' },
      { value: 'Chile', label: 'Chile' },
      { value: 'Mexico', label: 'Mexico' },
      { value: 'Canada', label: 'Canada' },
      { value: 'China', label: 'China' },
      { value: 'United Kingdom', label: 'United Kingdom' },
      { value: 'France', label: 'France' },
      { value: 'Germany', label: 'Germany' },
      { value: 'Spain', label: 'Spain' },
      { value: 'Brazil', label: 'Brazil' },
      { value: 'South Africa', label: 'South Africa' },
      { value: 'Peru', label: 'Peru' },
      { value: 'Argentina', label: 'Argentina' },
      { value: 'Vietnam', label: 'Vietnam' },
      { value: 'Thailand', label: 'Thailand' },
      { value: 'Bangladesh', label: 'Bangladesh' },
      { value: 'Pakistan', label: 'Pakistan' },
      { value: 'Global Territory', label: 'Global Territory (Other)' },
    ],
    []
  );

  const runAnalysis = async () => {
    if (!scenario.location.trim() || !scenario.disruption.trim()) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await apiRequest<AiResult>('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEvent?.id || 'scenario-custom',
          hazard_type: scenario.hazard,
          country: scenario.country,
          location: scenario.location,
          disruption: scenario.disruption,
          severity: scenario.severity,
          duration: scenario.duration,
          infrastructure: scenario.infrastructure,
          population_exposure: scenario.populationExposure,
          assumptions: scenario.assumptions || scenarioSummary,
          prompt: scenarioSummary,
        }),
      });
      setAnalysis(result);
    } catch (error) {
      setAnalysis({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to complete scenario analysis.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const isAiMode = analysis?.status === 'success';
  const isRuleFallback =
    analysis?.status === 'config_missing' || analysis?.engine === 'rule_based_fallback';
  const structuredData = analysis?.response?.structured;

  return (
    <div className="page-content">
      <section className="panel scenario-builder">
        <div className="map-toolbar">
          <h3>Scenario Builder & Resilience Intelligence</h3>
          <span className="eyebrow">Simulated Decision Support</span>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
          Formulate multi-hazard scenario assumptions across 10 threat categories to evaluate secondary cascading disruptions, critical infrastructure interdependencies, and prioritized tactical responses.
        </p>

        {/* Input Form Matrix */}
        <div className="scenario-form-grid">
          <label>
            Primary Hazard Type
            <CustomSelect
              value={scenario.hazard}
              onChange={(val) => setScenario((cur) => ({ ...cur, hazard: val as HazardCategory }))}
              options={hazardOptions}
              ariaLabel="Primary Hazard Type"
            />
          </label>

          <label>
            Country / Sovereignty
            <CustomSelect
              value={scenario.country}
              onChange={(val) => setScenario((cur) => ({ ...cur, country: val }))}
              options={countryOptions}
              ariaLabel="Country / Sovereignty"
            />
          </label>

          <label>
            Target Zone / Metro Corridor
            <input
              value={scenario.location}
              onChange={(e) => setScenario((cur) => ({ ...cur, location: e.target.value }))}
              maxLength={200}
              placeholder="e.g. Tokyo Bay, San Francisco, Sendai, Rhine Basin"
            />
          </label>

          <label>
            Severity Assumption Tier
            <CustomSelect
              value={scenario.severity}
              onChange={(val) => setScenario((cur) => ({ ...cur, severity: val as Severity }))}
              options={severityOptions}
              ariaLabel="Severity Assumption Tier"
            />
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Secondary Disruption Vector
            <input
              value={scenario.disruption}
              onChange={(e) => setScenario((cur) => ({ ...cur, disruption: e.target.value }))}
              maxLength={200}
              placeholder="e.g. Substation busbar failure, port container terminal shutdown, bridge severance"
            />
          </label>

          <label>
            Assumed Event Duration
            <CustomSelect
              value={scenario.duration}
              onChange={(val) => setScenario((cur) => ({ ...cur, duration: val }))}
              options={durationOptions}
              ariaLabel="Assumed Event Duration"
            />
          </label>

          <label>
            Vulnerable Infrastructure Sector
            <CustomSelect
              value={scenario.infrastructure}
              onChange={(val) => setScenario((cur) => ({ ...cur, infrastructure: val }))}
              options={infrastructureOptions}
              ariaLabel="Vulnerable Infrastructure Sector"
            />
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Population Exposure Density Tier
            <CustomSelect
              value={scenario.populationExposure}
              onChange={(val) => setScenario((cur) => ({ ...cur, populationExposure: val }))}
              options={exposureOptions}
              ariaLabel="Population Exposure Density Tier"
            />
          </label>

          <label style={{ gridColumn: 'span 2' }}>
            Additional Scenario Assumptions & Contingencies
            <input
              value={scenario.assumptions}
              onChange={(e) => setScenario((cur) => ({ ...cur, assumptions: e.target.value }))}
              maxLength={500}
              placeholder="e.g. Coincides with peak winter heating demand; auxiliary diesel generators limited to 36 hours"
            />
          </label>
        </div>

        {/* Action Panel */}
        <div className="insight-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong>Prepared Scenario Hypothesis</strong>
              <span className="muted-inline" style={{ marginLeft: '8px' }}>
                · Simulation parameter set (Not an official emergency broadcast)
              </span>
            </div>
            <span
              className="severity-badge"
              style={{
                background: `${getSeverityColor(scenario.severity)}22`,
                color: getSeverityColor(scenario.severity),
                border: `1px solid ${getSeverityColor(scenario.severity)}55`,
              }}
            >
              {scenario.severity} Severity
            </span>
          </div>

          <p style={{ margin: '10px 0 16px', fontSize: '0.88rem', lineHeight: 1.5 }}>
            {scenarioSummary}
          </p>

          <button
            className="action-button"
            onClick={runAnalysis}
            disabled={analyzing || !scenario.location.trim() || !scenario.disruption.trim()}
            style={{ minWidth: '220px' }}
          >
            {analyzing ? (
              <>
                <Clock size={16} className="spin-icon" style={{ marginRight: '8px' }} />
                Synthesizing Decision Support Intelligence…
              </>
            ) : (
              <>
                <Target size={16} style={{ marginRight: '8px' }} />
                Run Comprehensive Scenario Analysis
              </>
            )}
          </button>
        </div>

        {/* Structured Results Display */}
        {analysis && (
          <div className="decision-support-card">
            {/* Status Banner */}
            {isAiMode ? (
              <div className="analysis-status-banner ai-mode">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} />
                  <strong>AI-Powered Scenario Assessment</strong>
                </div>
                <span>
                  Provider: <strong>Nebius Token Factory</strong> ({analysis.model})
                </span>
              </div>
            ) : isRuleFallback ? (
              <div className="analysis-status-banner rule-mode">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} />
                  <strong>Rule-Based Heuristic Decision Support (Offline Fallback Engine)</strong>
                </div>
                <small>Nebius API key unconfigured · Deterministic civil protection model active</small>
              </div>
            ) : (
              <div className="analysis-status-banner error-mode">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <strong>Analysis Service Error</strong>
                </div>
                <small>{analysis.message}</small>
              </div>
            )}

            {/* Meta Strip */}
            <div className="analysis-meta-strip">
              <span className="hazard-badge">
                <HazardSymbol hazard={scenario.hazard} />
                {scenario.hazard}
              </span>
              <span className="stat-pill">Scope: {scenario.country} ({scenario.location})</span>
              <span className="stat-pill">Vulnerable Sector: {scenario.infrastructure}</span>
              <span className="stat-pill">Duration: {scenario.duration}</span>
            </div>

            {/* Section 1: Executive Summary */}
            <div className="analysis-section">
              <div className="analysis-section-title">
                <Layers size={17} style={{ color: 'var(--primary)' }} />
                1. Executive Scenario Summary
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>
                {analysis.response?.summary || scenarioSummary}
              </p>
            </div>

            {/* Section 2 & 3: Primary Dynamics & Secondary Cascade Vectors */}
            <div className="analysis-grid-2col">
              <div className="analysis-card-sub">
                <h5>2. Primary Hazard Dynamics</h5>
                <p>
                  {structuredData?.primary_hazard ||
                    `Physical excitation from ${scenario.severity.toLowerCase()} ${scenario.hazard.toLowerCase()} impacting ${scenario.location}. Telemetry baseline active.`}
                </p>
              </div>

              <div className="analysis-card-sub">
                <h5>3. Secondary Cascading Vectors</h5>
                {structuredData?.cascade_vectors ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {structuredData.cascade_vectors.map((vec, i) => (
                      <li key={i}>{vec}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{scenario.disruption} propagating along interdependent utility networks.</p>
                )}
              </div>
            </div>

            {/* Section 4: Propagation Timeline */}
            <div className="analysis-section">
              <div className="analysis-section-title">
                <Clock size={17} style={{ color: 'var(--warning)' }} />
                4. Compounding Propagation Timeline
              </div>
              <div className="analysis-grid-2col">
                <div className="analysis-card-sub">
                  <h5>Immediate Phase (0 to 6 Hours)</h5>
                  <p>
                    {structuredData?.timeline?.immediate ||
                      'Automated breaker trips, localized sirens, rapid cordon of transit corridors, emergency operation center activation.'}
                  </p>
                </div>
                <div className="analysis-card-sub">
                  <h5>Intermediate Phase (6 to 24 Hours)</h5>
                  <p>
                    {structuredData?.timeline?.intermediate ||
                      'Auxiliary generator fuel distribution, potable water supply rationing, critical transport artery clearance.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 5: Population Exposure & Demographic Context */}
            <div className="analysis-section">
              <div className="analysis-section-title">
                <Users size={17} style={{ color: 'var(--primary)' }} />
                5. Population Exposure & Demographic Sensitivity
              </div>
              <div className="analysis-card-sub">
                <p>
                  Assessed within <strong>{scenario.populationExposure}</strong>. Vulnerability is elevated among dependent populations, medical facilities, and transit nodes.
                </p>
                <small style={{ color: 'var(--muted)', display: 'block', marginTop: '6px' }}>
                  * Methodological Notice: Precise numerical casualties and exact financial losses are intentionally omitted in accordance with disaster-intelligence standards to prevent fabricated counts without validated municipal censuses.
                </small>
              </div>
            </div>

            {/* Section 6: Tactical Directives & Preparedness Recommendations */}
            <div className="analysis-section">
              <div className="analysis-section-title">
                <ShieldCheck size={17} style={{ color: 'var(--success)' }} />
                6. Tactical Contingency Directives
              </div>
              {structuredData?.recommendations ? (
                structuredData.recommendations.map((rec, i) => (
                  <div key={i} className="tactical-directive-card">
                    <span className="step-index">{i + 1}</span>
                    <div>
                      <strong>Contingency Action Priority {i + 1}</strong>
                      <p>{rec}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="tactical-directive-card">
                  <span className="step-index">1</span>
                  <div>
                    <strong>Isolate Vulnerable Infrastructure</strong>
                    <p>Deploy emergency bypass routes for {scenario.infrastructure} in {scenario.location}.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Full Formatted AI / Rule Output (if available) */}
            {analysis.response?.content && (
              <div className="analysis-section">
                <div className="analysis-section-title">
                  <Activity size={17} style={{ color: 'var(--primary)' }} />
                  Complete Narrative Dossier
                </div>
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '10px',
                    padding: '16px',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {analysis.response.content}
                </div>
              </div>
            )}

            {/* Section 7: Uncertainties, Assumptions & Limitations */}
            <div className="uncertainty-box">
              <strong>Uncertainties, Assumptions & Regulatory Limitations:</strong>
              <p style={{ margin: '6px 0 0' }}>
                {structuredData?.limitations ||
                  'Simulated decision support for training, planning, and civil protection resilience assessment. Does not replace live field reconnaissance or official emergency declarations issued by civil authorities.'}
              </p>
              {analysis.response?.assumptions?.map((note, idx) => (
                <small key={idx} style={{ display: 'block', marginTop: '4px' }}>
                  • {note}
                </small>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Cascade Simulator
// ---------------------------------------------------------------------------

function CascadeSimulatorPage({ scenario }: { scenario: Scenario }) {
  const cascade = [
    {
      label: `Trigger Event: ${scenario.severity} ${scenario.hazard} in ${scenario.location || 'designated region'} (${scenario.country})`,
      status: 'Primary physical excitation · Authoritative baseline monitoring active',
      detail: 'Initiating hazard triggers localized mechanical, thermal, or hydrological strain on territorial boundaries.',
    },
    {
      label: `Immediate Vector: ${scenario.infrastructure} compromised by ${scenario.disruption}`,
      status: 'Direct asset damage (0–6 Hours) · First-order disruption',
      detail: 'Direct failure points trigger automated circuit isolation, valve closures, or emergency terminal shutdowns.',
    },
    {
      label: `Systemic Spread: Network degradation across ${scenario.duration}`,
      status: 'Second-order cascading propagation (6–24 Hours)',
      detail: 'Secondary power drops and transport bottlenecks constrain supply chain continuity and municipal utility pumping.',
    },
    {
      label: `Human Systems Stress: Compounding impact across ${scenario.populationExposure}`,
      status: 'Tertiary societal impact (24–72 Hours) · Civil protection surge',
      detail: 'Vulnerable demographics require localized cooling/heating, clean water distribution, and emergency triage.',
    },
    {
      label: 'Containment Protocol: Multi-agency mutual aid and backup lifeline activation',
      status: 'Mitigation Directive · Coordinated unified command',
      detail: 'Deployment of mobile auxiliary generators, emergency inter-agency radio bypasses, and temporary relief corridors.',
    },
  ];

  return (
    <div className="page-content">
      <section className="panel">
        <div className="map-toolbar">
          <h3>Cascade Failure Simulator</h3>
          <span className="eyebrow">Sequential Interdependency Modeling</span>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
          Simulates propagation across connected networks when primary natural hazards trigger compounding infrastructure disruptions.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span className="hazard-badge">
            <HazardSymbol hazard={scenario.hazard} />
            {scenario.hazard}
          </span>
          <span className="stat-pill">Region: {scenario.location}, {scenario.country}</span>
          <span className="stat-pill">Vulnerable Sector: {scenario.infrastructure}</span>
          <span className="stat-pill">Horizon: {scenario.duration}</span>
        </div>

        <div className="timeline-list">
          {cascade.map((node, index) => (
            <div key={node.label} className="timeline-node">
              <span className="step-index">{index + 1}</span>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <strong>{node.label}</strong>
                  <small style={{ color: 'var(--primary)', fontWeight: 600 }}>{node.status}</small>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {node.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Impact Assessment
// ---------------------------------------------------------------------------

function ImpactAssessmentPage({ scenario }: { scenario: Scenario }) {
  const impactScore = { Low: 28, Moderate: 54, Severe: 79, Critical: 96 }[scenario.severity];

  const lifelines = [
    {
      sector: 'Power Grid & Transmission',
      status: scenario.infrastructure.includes('Power') ? 'Critical Disruption' : 'Elevated Strain',
      statusColor: scenario.infrastructure.includes('Power') ? '#ef4444' : '#f59e0b',
      vulnerability: 'High',
      contingency: 'Deploy mobile substation trailers and prioritize hospital feeder circuits.',
    },
    {
      sector: 'Potable Water & Sanitation',
      status: scenario.infrastructure.includes('Water') ? 'Inundation / Contamination' : 'Pressure Drop Risk',
      statusColor: scenario.infrastructure.includes('Water') ? '#ef4444' : '#eab308',
      vulnerability: 'Moderate to High',
      contingency: 'Enforce boil-water advisory; activate auxiliary diesel pumps at treatment plant.',
    },
    {
      sector: 'Transport Arteries (Road & Rail)',
      status: scenario.infrastructure.includes('Transport') ? 'Arterial Severance' : 'Traffic Re-routing',
      statusColor: scenario.infrastructure.includes('Transport') ? '#ef4444' : '#10b981',
      vulnerability: 'Severe',
      contingency: 'Designate primary emergency egress routes for first-responder convoys.',
    },
    {
      sector: 'Telecommunications & Cellular',
      status: scenario.infrastructure.includes('Telecom') ? 'Tower Blackout' : 'Cell Congestion',
      statusColor: scenario.infrastructure.includes('Telecom') ? '#ef4444' : '#38bdf8',
      vulnerability: 'Moderate',
      contingency: 'Mobilize satellite transportable antennas (COWs) and reserve spectrum.',
    },
    {
      sector: 'Healthcare & Acute Facilities',
      status: scenario.severity === 'Critical' ? 'Surge Capacity Exhaustion' : 'Standard Response Surge',
      statusColor: scenario.severity === 'Critical' ? '#ef4444' : '#22c55e',
      vulnerability: 'High',
      contingency: 'Establish auxiliary field triage units and verify generator fuel reserve >72h.',
    },
  ];

  const assessment = [
    {
      title: 'Scenario Impact Index',
      value: `${impactScore} / 100`,
      detail: `Synthesized index based on ${scenario.severity.toLowerCase()} severity assumption and typical asset vulnerability.`,
    },
    {
      title: 'Population Exposure Model',
      value: scenario.populationExposure.split('(')[0].trim(),
      detail: `Contextualized for ${scenario.populationExposure}. Avoids fabricated synthetic counts without municipal census link.`,
    },
    {
      title: 'Primary Vulnerable Sector',
      value: scenario.infrastructure.split('&')[0].trim(),
      detail: `Directly exposed to ${scenario.disruption} across an assumed duration of ${scenario.duration}.`,
    },
  ];

  return (
    <div className="page-content">
      <section className="metric-grid">
        {assessment.map((item) => (
          <div className="panel metric-card" key={item.title}>
            <div className="metric-label">{item.title}</div>
            <div className="metric-value">{item.value}</div>
            <p>{item.detail}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="map-toolbar">
          <h3>Critical Infrastructure & Essential Services Lifeline Matrix</h3>
          <span className="eyebrow">Interdependency Vulnerability Grid</span>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          Monitors operational status and contingency safeguards across 5 foundational urban lifelines under the active {scenario.severity.toLowerCase()} {scenario.hazard.toLowerCase()} scenario in {scenario.location || 'designated region'}.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lifeline Sector</th>
                <th>Scenario Status</th>
                <th>Vulnerability Tier</th>
                <th>Contingency Safeguard Directive</th>
              </tr>
            </thead>
            <tbody>
              {lifelines.map((l) => (
                <tr key={l.sector}>
                  <td><strong>{l.sector}</strong></td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: `${l.statusColor}22`,
                        color: l.statusColor,
                        border: `1px solid ${l.statusColor}55`,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                      }}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td>{l.vulnerability}</td>
                  <td style={{ fontSize: '0.84rem' }}>{l.contingency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Recommendations
// ---------------------------------------------------------------------------

function RecommendationsPage({ scenario }: { scenario: Scenario }) {
  const recommendations = [
    {
      priority: 'Priority 1',
      title: `Confirm ${scenario.hazard.toLowerCase()} parameters with authoritative sirens & feeds`,
      reason: 'Validate seismic, meteorological, or hydrological readings with official authorities before tactical deployment.',
      owner: 'Disaster Operations Lead',
    },
    {
      priority: 'Priority 2',
      title: `Mitigate secondary vector: ${scenario.disruption.toLowerCase() || 'critical network failure'}`,
      reason: 'Activate auxiliary fuel systems, bypass routes, and alternate microwave communications.',
      owner: 'Infrastructure Resilience Team',
    },
    {
      priority: 'Priority 3',
      title: `Issue localized multilingual public advisory for ${scenario.location || 'impact corridor'}`,
      reason: 'Deliver unambiguous shelter-in-place or evacuation guidance via broadcast and SMS cells.',
      owner: 'Emergency Public Information Officer',
    },
  ];

  return (
    <div className="page-content">
      <section className="panel">
        <div className="map-toolbar">
          <h3>Priority Tactical Recommendations</h3>
          <span className="eyebrow">Contingency Action Matrix</span>
        </div>
        <div className="recommendation-list">
          {recommendations.map((item) => (
            <div className="recommendation-item" key={item.title}>
              <div className="priority-pill">{item.priority}</div>
              <div>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <small>{item.owner}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Compare Scenarios
// ---------------------------------------------------------------------------

function CompareScenariosPage({ scenario }: { scenario: Scenario }) {
  const [comparisonSeverity, setComparisonSeverity] = useState<Severity>('Severe');
  const severityScores: Record<Severity, number> = { Low: 25, Moderate: 50, Severe: 75, Critical: 95 };

  const scenarioData = [
    {
      name: scenario.disruption || scenario.hazard,
      current: severityScores[scenario.severity],
      comparison: severityScores[comparisonSeverity],
    },
  ];

  const severityOptions: CustomSelectOption<Severity>[] = useMemo(
    () => [
      { value: 'Low', label: 'Low', badge: 'Tier 1', badgeColor: '#10b981' },
      { value: 'Moderate', label: 'Moderate', badge: 'Tier 2', badgeColor: '#eab308' },
      { value: 'Severe', label: 'Severe', badge: 'Tier 3', badgeColor: '#f97316' },
      { value: 'Critical', label: 'Critical', badge: 'Tier 4', badgeColor: '#ef4444' },
    ],
    []
  );

  return (
    <div className="page-content">
      <section className="panel">
        <div className="map-toolbar">
          <h3>Scenario Impact Matrix Comparison</h3>
          <span className="eyebrow">Multi-Variate Analysis</span>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>
          Evaluate divergent resource requirements by comparing current scenario assumptions against a baseline or escalated contingency.
        </p>
        <label className="comparison-control">
          Comparison Severity Assumption
          <CustomSelect
            value={comparisonSeverity}
            onChange={(val) => setComparisonSeverity(val as Severity)}
            options={severityOptions}
            ariaLabel="Comparison Severity Assumption"
          />
        </label>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={scenarioData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
            <XAxis dataKey="name" stroke="var(--muted)" />
            <YAxis stroke="var(--muted)" domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="current" name={`Current (${scenario.severity})`} fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="comparison" name={`Comparison (${comparisonSeverity})`} fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Reports
// ---------------------------------------------------------------------------

function ReportsPage({ events, scenario }: { events: EventRecord[]; scenario: Scenario }) {
  const report = {
    title: 'CASCADE ZERO · Multi-Hazard Intelligence Briefing',
    generatedAt: new Date().toISOString(),
    classification: 'Civil Protection Decision Support (Open Intelligence)',
    disclaimer: 'Planning and simulation aid only. Not an official disaster declaration or substitute for local emergency authorities.',
    scenario,
    incidentCount: events.length,
    incidents: events.map(({ id, title, hazardCategory, severity, location, country, source, eventTime, sourceUrl }) => ({
      id,
      title,
      hazardCategory,
      severity,
      location,
      country,
      source,
      eventTime,
      sourceUrl,
    })),
  };

  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cascade-zero-intel-briefing-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-content">
      <section className="panel report-box">
        <div className="map-toolbar">
          <h3>Incident Briefing & Resilience Dossier</h3>
          <span className="eyebrow">Exportable Package</span>
        </div>
        <p>
          This briefing captures <strong>{events.length} tracked incidents</strong> across all global providers, contextualized by the active {scenario.severity.toLowerCase()} {scenario.hazard.toLowerCase()} scenario in {scenario.location || 'designated region'}.
        </p>
        <ul>
          <li>Primary Cascade Chain: {scenario.hazard} → {scenario.disruption || 'service disruption'} → critical dependency vulnerability.</li>
          <li>All real-world items are normalized from USGS, GDACS, and NASA EONET feeds.</li>
          <li>Verify all field operations with designated incident commanders and national disaster authorities.</li>
        </ul>
        <button className="action-button" onClick={downloadReport}>
          <Download size={16} style={{ marginRight: '6px' }} /> Download Complete JSON Intelligence Dossier
        </button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Data Sources & System Health
// ---------------------------------------------------------------------------

function DataSourcesPage({ sources }: { sources: SourceHealth[] }) {
  const sourceCadenceInfo: Record<string, { frequency: string; delay: string; url: string }> = {
    'USGS Earthquakes': {
      frequency: 'Every 1 to 5 minutes (continuous seismic sensor stream)',
      delay: '5 to 15 minutes post-rupture (automatic algorithmic triangulation)',
      url: 'https://earthquake.usgs.gov/',
    },
    'GDACS Multi-Hazard': {
      frequency: 'Hourly and on event bulletin escalation',
      delay: '15 to 60 minutes (depends on satellite pass & joint agency verification)',
      url: 'https://www.gdacs.org/',
    },
    'NASA EONET Feed': {
      frequency: 'Multiple cycles daily as orbital passes are processed',
      delay: '1 to 4 hours (MODIS/VIIRS thermal anomaly detection)',
      url: 'https://eonet.gsfc.nasa.gov/',
    },
    'Demo scenarios': {
      frequency: 'Built-in illustrative scenarios across 10 threat categories',
      delay: 'None (local deterministic evaluation)',
      url: 'https://github.com/',
    },
  };

  return (
    <div className="page-content">
      <section className="panel">
        <div className="map-toolbar">
          <h3>Global Ingestion Streams & Provider Health</h3>
          <span className="eyebrow">Central Telemetry</span>
        </div>
        <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
          Continuously verifies the operational status, latency, and refresh timestamps of connected disaster-monitoring services.
        </p>
        <div className="source-grid">
          {sources.map((source) => {
            const cadence = sourceCadenceInfo[source.name];
            return (
              <div className="source-card" key={source.name}>
                <div className="source-head">
                  <strong>{source.name}</strong>
                  <span className={`status-pill ${source.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {source.status}
                  </span>
                </div>
                <p><strong>Latency / Mode:</strong> {source.latency}</p>
                <p><strong>Last Sync:</strong> {source.lastRefresh}</p>
                <p><strong>Coverage:</strong> {source.coverage}</p>
                {cadence && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--muted)' }}>
                    <div><strong>Update Cadence:</strong> {cadence.frequency}</div>
                    <div style={{ marginTop: '3px' }}><strong>Upstream Delay:</strong> {cadence.delay}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', background: 'var(--panel-bg-subtle, rgba(255,255,255,0.03))', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.88rem' }}>Fair-Use Scheduling & Data Integrity Policy</h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            To protect upstream international humanitarian infrastructure and observe fair-use rate limits, CASCADE ZERO gathers data on a scheduled 600-second (10-minute) automated cycle with instant change detection. When an upstream service is unreachable, previously retrieved records remain intact and are clearly labeled as cached/delayed until connectivity resumes.
          </p>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Settings & About
// ---------------------------------------------------------------------------

function SettingsPage({
  theme,
  setTheme,
}: {
  theme: 'dark' | 'light';
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
}) {
  return (
    <div className="page-content">
      <section className="panel settings-grid">
        <div>
          <h3>Display & Cartography</h3>
          <label className="toggle-row">
            <span>Dark Threat-Intelligence Theme</span>
            <input
              type="checkbox"
              checked={theme === 'dark'}
              onChange={() => setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'))}
            />
          </label>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '10px' }}>
            Dark mode uses high-contrast CartoDB Dark Matter tiles; light mode uses crisp CartoDB Voyager cartography. Preference is saved in browser storage.
          </p>
        </div>

        <div>
          <h3>System Architecture</h3>
          <ul style={{ paddingLeft: '18px', color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <li><strong>Ingestion Engines:</strong> USGS FDSN, GDACS RSS/GeoJSON, NASA EONET v3.</li>
            <li><strong>Geospatial Resolvers:</strong> Coordinate boundary matching & localized geocoding.</li>
            <li><strong>AI Decision Engine:</strong> Nebius Token Factory (Nemotron / Llama-3.1).</li>
            <li><strong>Fallback Guarantee:</strong> In-memory resilience caching ensures dashboard stability even during upstream network dropouts.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component: NotificationPanel (Disaster Intelligence Notification Drawer)
// ---------------------------------------------------------------------------

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events: EventRecord[];
  readIds: Set<string>;
  newUpdateIds: Set<string>;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onRestoreCleared: () => void;
  hasCleared: boolean;
  onSelectNotification: (event: EventRecord) => void;
  selectedEventId: string;
  dbNotifications?: DbNotification[];
  onMarkDbRead?: (id: string) => void;
  onMarkAllDbRead?: () => void;
  onClearDb?: () => void;
  onSelectEventId?: (id: string) => void;
}

function NotificationPanel({
  onClose,
  events,
  readIds,
  newUpdateIds,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onRestoreCleared,
  hasCleared,
  onSelectNotification,
  selectedEventId,
  dbNotifications = [],
  onMarkDbRead,
  onMarkAllDbRead,
  onClearDb,
  onSelectEventId,
}: NotificationPanelProps) {
  const [filterTab, setFilterTab] = useState<'changes' | 'all' | 'critical'>('changes');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const dbUnreadCount = useMemo(
    () => dbNotifications.filter((n) => !n.isRead).length,
    [dbNotifications]
  );

  const unreadCount = useMemo(
    () => events.filter((e) => !readIds.has(e.id)).length,
    [events, readIds]
  );

  const criticalCount = useMemo(
    () => events.filter((e) => e.severity === 'Critical').length,
    [events]
  );

  const filteredDbNotifications = useMemo(() => {
    let list = dbNotifications;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.headline.toLowerCase().includes(q) ||
          (n.location && n.location.toLowerCase().includes(q)) ||
          (n.country && n.country.toLowerCase().includes(q)) ||
          n.hazardCategory.toLowerCase().includes(q) ||
          n.changeSummary.toLowerCase().includes(q) ||
          n.source.toLowerCase().includes(q)
      );
    }
    return list;
  }, [dbNotifications, searchQuery]);

  const filteredEvents = useMemo(() => {
    let list = events;
    if (filterTab === 'critical') {
      list = list.filter((e) => e.severity === 'Critical');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.country.toLowerCase().includes(q) ||
          e.hazardCategory.toLowerCase().includes(q) ||
          e.source.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, filterTab, searchQuery]);

  return (
    <div
      className="notification-panel"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Disaster Intelligence Alerts"
    >
      {/* Header */}
      <div className="notification-panel-header">
        <div className="notification-panel-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-beacon-dot" />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Disaster Intelligence Alerts
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="notification-pill-count">
              {dbUnreadCount > 0
                ? `${dbUnreadCount} new change update${dbUnreadCount === 1 ? '' : 's'}`
                : unreadCount > 0
                ? `${unreadCount} unread incident${unreadCount === 1 ? '' : 's'}`
                : 'All alerts reviewed'}
            </span>
          </div>
        </div>

        <div className="notification-panel-actions">
          {(dbUnreadCount > 0 || unreadCount > 0) && (
            <button
              className="notification-action-btn"
              onClick={() => {
                onMarkAllAsRead();
                onMarkAllDbRead?.();
              }}
              title="Mark all notifications as read"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}

          {(dbNotifications.length > 0 || events.length > 0) && !showClearConfirm && (
            <button
              className="notification-action-btn"
              onClick={() => setShowClearConfirm(true)}
              title="Clear all alerts from feed"
            >
              <Trash2 size={14} />
            </button>
          )}

          <button
            className="notification-action-btn close-btn"
            onClick={onClose}
            aria-label="Close notification panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Confirmation Banner for Clear All */}
      {showClearConfirm && (
        <div className="notification-confirm-banner">
          <span>Clear all notifications?</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="notification-confirm-btn danger"
              onClick={() => {
                onClearAll();
                onClearDb?.();
                setShowClearConfirm(false);
              }}
            >
              Confirm Clear
            </button>
            <button
              className="notification-confirm-btn"
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="notification-filter-strip">
        <div className="notification-tabs">
          <button
            className={`notification-tab ${filterTab === 'changes' ? 'active' : ''}`}
            onClick={() => setFilterTab('changes')}
          >
            Change Updates{' '}
            <span className="tab-count">
              ({dbUnreadCount > 0 ? `${dbUnreadCount} new` : dbNotifications.length})
            </span>
          </button>
          <button
            className={`notification-tab ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All Hazards <span className="tab-count">({events.length})</span>
          </button>
          <button
            className={`notification-tab ${filterTab === 'critical' ? 'active' : ''}`}
            onClick={() => setFilterTab('critical')}
          >
            Critical <span className="tab-count">({criticalCount})</span>
          </button>
        </div>

        <div className="notification-search-box">
          <Search size={13} className="notification-search-icon" />
          <input
            type="text"
            placeholder={
              filterTab === 'changes'
                ? 'Search change updates...'
                : 'Search alerts by title, hazard, or country...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="notification-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Notification Cards List */}
      <div className="notification-list">
        {filterTab === 'changes' ? (
          filteredDbNotifications.length === 0 ? (
            <div className="notification-empty-state">
              <div className="empty-icon-wrap">
                <ShieldCheck size={32} style={{ color: 'var(--success)' }} />
              </div>
              <h5>No change updates recorded</h5>
              <p>
                Authoritative feeds from USGS, GDACS, and NASA EONET are continuously monitored.
                Meaningful revisions, upgrades, or location corrections will appear here in real time.
              </p>
            </div>
          ) : (
            filteredDbNotifications.map((notif) => {
              const isRead = notif.isRead;
              const sevColor = getSeverityColor(notif.severity as Severity);

              return (
                <div
                  key={notif.id}
                  className={`notification-card ${isRead ? 'is-read' : 'is-unread'}`}
                  onClick={() => {
                    onMarkDbRead?.(notif.id);
                    if (notif.eventId) {
                      onSelectEventId?.(notif.eventId);
                      onClose();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMarkDbRead?.(notif.id);
                      if (notif.eventId) {
                        onSelectEventId?.(notif.eventId);
                        onClose();
                      }
                    }
                  }}
                >
                  <div className="notification-card-top">
                    <div className="notification-hazard-badge">
                      <HazardSymbol hazard={notif.hazardCategory as HazardCategory} />
                      <span>{notif.hazardCategory}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="live-update-badge">
                        <Zap size={10} /> {notif.changeType || 'UPDATE'}
                      </span>

                      <span
                        className="notification-sev-badge"
                        style={{
                          color: sevColor,
                          background: `${sevColor}1a`,
                          borderColor: `${sevColor}44`,
                        }}
                      >
                        {notif.severity}
                      </span>
                    </div>

                    <div className="notification-card-top-right">
                      {!isRead ? (
                        <span className="unread-dot" title="Unread update" />
                      ) : (
                        <span className="read-indicator" title="Reviewed">
                          <Check size={12} />
                        </span>
                      )}

                      <button
                        className="notification-item-check"
                        title={isRead ? 'Marked as read' : 'Mark as read'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkDbRead?.(notif.id);
                        }}
                        aria-label="Mark as read"
                      >
                        <Check size={13} style={{ opacity: isRead ? 0.35 : 0.95 }} />
                      </button>
                    </div>
                  </div>

                  <div className="notification-card-title">{notif.headline}</div>

                  <div className="notification-card-location">
                    <strong>Location:</strong> {notif.location || notif.country || 'Global Coordinates'} (
                    {notif.country || 'International'})
                  </div>

                  <div
                    style={{
                      margin: '6px 0',
                      fontSize: '0.78rem',
                      lineHeight: '1.4',
                      color: 'var(--text-secondary)',
                      background: 'rgba(56, 189, 248, 0.08)',
                      padding: '6px 9px',
                      borderRadius: '6px',
                      borderLeft: '3px solid var(--primary)',
                    }}
                  >
                    🔄 <strong>Detected Change:</strong> {notif.changeSummary}
                  </div>

                  <div className="notification-card-meta">
                    <div className="notification-meta-item">
                      <Clock size={11} />
                      <span>Detected: {formatRelativeTime(notif.createdAt)}</span>
                    </div>

                    <span className="meta-separator">·</span>

                    <span className="notification-source-tag">{notif.source}</span>
                  </div>

                  <div className="notification-card-footer">
                    <span className="notification-click-hint">
                      {notif.eventId
                        ? 'Click to inspect on World Map & Dossier →'
                        : 'Verified intelligence update'}
                    </span>
                    {(() => {
                      const auth = getAuthoritativeSourceInfo({
                        hazardCategory: notif.hazardCategory,
                        source: notif.source,
                        sourceUrl: notif.sourceUrl,
                        id: notif.eventId || notif.id,
                      });
                      return (
                        <a
                          href={auth.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="notification-source-link"
                          onClick={(e) => e.stopPropagation()}
                          title={`Open verified ${auth.sourceName} record: ${auth.sourceUrl}`}
                        >
                          <span>{auth.sourceName} Report</span>
                          <ExternalLink size={10} />
                        </a>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          )
        ) : filteredEvents.length === 0 ? (
          <div className="notification-empty-state">
            <div className="empty-icon-wrap">
              <BellOff size={32} style={{ color: 'var(--muted)' }} />
            </div>
            <h5>{searchQuery ? 'No matching alerts' : 'No alerts available'}</h5>
            <p>
              {searchQuery
                ? `No alerts match "${searchQuery}". Try a different keyword.`
                : 'Live feeds will populate this stream as soon as new hazard alerts occur.'}
            </p>
            {hasCleared && (
              <button
                className="action-button"
                style={{ marginTop: '12px', fontSize: '0.78rem', padding: '6px 12px' }}
                onClick={onRestoreCleared}
              >
                Restore Cleared Notifications
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((event) => {
            const isRead = readIds.has(event.id);
            const isSelected = event.id === selectedEventId;
            const sevColor = getSeverityColor(event.severity);

            return (
              <div
                key={event.id}
                className={`notification-card ${isRead ? 'is-read' : 'is-unread'} ${
                  isSelected ? 'is-selected' : ''
                }`}
                onClick={() => onSelectNotification(event)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNotification(event);
                  }
                }}
              >
                <div className="notification-card-top">
                  <div className="notification-hazard-badge">
                    <HazardSymbol hazard={event.hazardCategory} />
                    <span>{event.hazardCategory}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {newUpdateIds.has(event.id) && (
                      <span className="live-update-badge">
                        <Zap size={10} /> Live Update
                      </span>
                    )}

                    <span
                      className="notification-sev-badge"
                      style={{
                        color: sevColor,
                        background: `${sevColor}1a`,
                        borderColor: `${sevColor}44`,
                      }}
                    >
                      {event.severity}
                    </span>
                  </div>

                  <div className="notification-card-top-right">
                    {!isRead ? (
                      <span className="unread-dot" title="Unread alert" />
                    ) : (
                      <span className="read-indicator" title="Reviewed">
                        <Check size={12} />
                      </span>
                    )}

                    <button
                      className="notification-item-check"
                      title={isRead ? 'Marked as read' : 'Mark as read'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(event.id);
                      }}
                      aria-label="Mark as read"
                    >
                      <Check size={13} style={{ opacity: isRead ? 0.35 : 0.95 }} />
                    </button>
                  </div>
                </div>

                <div className="notification-card-title">{event.title}</div>

                <div className="notification-card-location">
                  <strong>Location:</strong> {event.location || event.country || 'Global Coordinates'} (
                  {event.country || 'International'})
                </div>

                <p className="notification-card-desc">{event.description}</p>

                <div className="notification-card-meta">
                  <div className="notification-meta-item">
                    <Clock size={11} />
                    <span title={formatDate(event.eventTime)}>
                      Event: {formatRelativeTime(event.eventTime)}
                    </span>
                  </div>

                  <span className="meta-separator">·</span>

                  <div className="notification-meta-item">
                    <span>Sync: {formatRelativeTime(event.updatedAt)}</span>
                  </div>

                  <span className="meta-separator">·</span>

                  <span className="notification-source-tag">{event.source}</span>

                  <span
                    className={`notification-status-tag ${event.status.toLowerCase()}`}
                  >
                    {event.status}
                  </span>
                </div>

                <div className="notification-card-footer">
                  <span className="notification-click-hint">
                    Click to inspect on World Map & Dossier &rarr;
                  </span>
                    {(() => {
                      const auth = getAuthoritativeSourceInfo(event);
                      return (
                        <a
                          href={auth.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="notification-source-link"
                          onClick={(e) => e.stopPropagation()}
                          title={`Open verified ${auth.sourceName} record: ${auth.sourceUrl}`}
                        >
                          <span>{auth.sourceName} Source</span>
                          <ExternalLink size={10} />
                        </a>
                      );
                    })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Summary */}
      <div className="notification-panel-footer">
        <span>Verified feeds: USGS · GDACS · NASA EONET</span>
        <span>
          {filterTab === 'changes'
            ? `${filteredDbNotifications.length} change update${filteredDbNotifications.length === 1 ? '' : 's'}`
            : `${filteredEvents.length} alert${filteredEvents.length === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: Daily Global Intelligence
// ---------------------------------------------------------------------------

function DailyIntelligencePage({ onSelectEvent }: { onSelectEvent: (id: string) => void }) {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filterHazard, setFilterHazard] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  const fetchBriefing = async () => {
    try {
      const res = await apiRequest<{ status: string; briefing: DailyBriefing }>('/api/intelligence/daily');
      if (res.briefing) setBriefing(res.briefing);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Daily Intelligence briefing.');
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest<{ notifications: DbNotification[]; unreadCount: number }>(
        '/api/notifications?limit=50'
      );
      setDbNotifications(res.notifications ?? []);
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // Graceful fail — notifications are supplementary
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchBriefing(), fetchNotifications()]).finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await apiRequest<{ status: string; briefing: DailyBriefing }>(
        '/api/intelligence/daily/refresh',
        { method: 'POST' }
      );
      if (res.briefing) setBriefing(res.briefing);
      await fetchNotifications();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setDbNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const SEVERITY_COLOR: Record<string, string> = {
    Critical: '#ef4444',
    Severe: '#f97316',
    Moderate: '#eab308',
    Low: '#10b981',
    Unknown: '#94a3b8',
  };

  const CHANGE_ICONS: Record<string, string> = {
    severity_escalation: '⚠️',
    status_update: '🔄',
    impact_increase: '📈',
    impact_decrease: '📉',
    location_update: '📍',
    new_event: '🆕',
    general: '📡',
  };

  const filteredSecondary = (briefing?.secondaryItems ?? []).filter((item) => {
    if (filterHazard !== 'All' && item.hazardCategory !== filterHazard) return false;
    if (filterSeverity !== 'All' && item.severity !== filterSeverity) return false;
    return true;
  });

  const visibleNotifications = dbNotifications.filter((n) => {
    if (notifFilter === 'unread') return !n.isRead;
    return true;
  });

  if (loading) {
    return (
      <div className="intel-loading">
        <div className="intel-spinner" />
        <span>Retrieving Daily Intelligence Briefing…</span>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="intel-page-header">
        <div>
          <div className="eyebrow">🛰️ Automated Intelligence • Verified Sources</div>
          <h2 className="intel-page-title">Daily Global Hazard Intelligence</h2>
          <p className="intel-page-subtitle">
            Live synthesis from USGS, GDACS, and NASA EONET — updated continuously.
          </p>
        </div>
        <button className="action-button" onClick={handleRefresh} disabled={refreshing}>
          <RotateCcw size={15} />
          {refreshing ? 'Synthesizing…' : 'Refresh Intelligence'}
        </button>
      </div>

      {error && (
        <div className="toast-banner info" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Briefing Card */}
      {briefing ? (
        <section className="intel-hero-card animate-fade-in">
          <div className="intel-hero-meta">
            <span className="intel-label">📅 {briefing.dateStr}</span>
            <span className="intel-label" style={{ color: '#10b981' }}>✅ {briefing.verificationStatus}</span>
            <span className="intel-label">🎯 Credibility: {briefing.credibilityScore}</span>
            <span className="intel-label">🕐 Generated: {formatRelativeTime(briefing.createdAt)}</span>
          </div>

          <h2 className="intel-hero-headline">{briefing.headline}</h2>
          <p className="intel-hero-summary">{briefing.summary}</p>

          <div className="intel-hero-grid">
            <div className="intel-detail-block">
              <div className="intel-detail-label">📰 What Happened</div>
              <div className="intel-detail-text">{briefing.whatHappened}</div>
            </div>
            <div className="intel-detail-block">
              <div className="intel-detail-label">🔄 What Is Changing</div>
              <div className="intel-detail-text">{briefing.whatIsChanging}</div>
            </div>
            <div className="intel-detail-block">
              <div className="intel-detail-label">📍 Areas Affected</div>
              <div className="intel-detail-text">{briefing.areasAffected}</div>
            </div>
            <div className="intel-detail-block">
              <div className="intel-detail-label">🛡️ Official Guidance</div>
              <div className="intel-detail-text">{briefing.officialGuidance}</div>
            </div>
          </div>

          {briefing.heroEvent && (
            <div className="intel-hero-actions">
              <button
                className="ghost-button"
                onClick={() => briefing.heroEvent && onSelectEvent(briefing.heroEvent.id)}
              >
                <MapIcon size={14} />
                View on Map
              </button>
              {briefing.heroEvent.sourceUrl && (
                <a
                  href={briefing.heroEvent.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ghost-button"
                >
                  <ExternalLink size={14} />
                  Official Source
                </a>
              )}
              <span className="intel-source-badge">
                <Database size={12} />
                {briefing.heroEvent.source}
              </span>
            </div>
          )}
        </section>
      ) : (
        <section className="panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          <Globe2 size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p>No intelligence briefing available yet. Click "Refresh Intelligence" to synthesize from live feeds.</p>
        </section>
      )}

      {/* Secondary Significant Events */}
      {briefing && briefing.secondaryItems && briefing.secondaryItems.length > 0 && (
        <section className="panel animate-fade-in stagger-1">
          <div className="intel-section-header">
            <h3>Additional Significant Events</h3>
            <div className="intel-filters">
              <select
                className="intel-select"
                value={filterHazard}
                onChange={(e) => setFilterHazard(e.target.value)}
              >
                <option value="All">All Hazards</option>
                {['Earthquake', 'Cyclone', 'Flood', 'Wildfire', 'Volcano', 'Tsunami', 'Drought', 'Storm', 'Landslide', 'Extreme Temperature'].map(
                  (h) => <option key={h} value={h}>{h}</option>
                )}
              </select>
              <select
                className="intel-select"
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
              >
                <option value="All">All Severities</option>
                {['Critical', 'Severe', 'Moderate', 'Low'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="intel-secondary-grid">
            {filteredSecondary.map((item) => (
              <div key={item.id} className="intel-event-card animate-fade-in">
                <div className="intel-event-card-top">
                  <span
                    className="severity-badge"
                    style={{
                      background: `${SEVERITY_COLOR[item.severity] ?? '#94a3b8'}22`,
                      color: SEVERITY_COLOR[item.severity] ?? '#94a3b8',
                      border: `1px solid ${SEVERITY_COLOR[item.severity] ?? '#94a3b8'}44`,
                    }}
                  >
                    {item.severity}
                  </span>
                  <span className="hazard-badge">
                    <HazardSymbol hazard={item.hazardCategory as HazardCategory} />
                    {item.hazardCategory}
                  </span>
                </div>
                <h4 className="intel-event-title">{item.title}</h4>
                <p className="intel-event-location">
                  <span>📍</span> {item.location}, {item.country}
                </p>
                <p className="intel-event-desc">{item.description}</p>
                <div className="intel-event-footer">
                  <span className="intel-label">🕐 {formatRelativeTime(item.eventTime)}</span>
                  <span className="intel-label">📡 {item.source}</span>
                </div>
                <div className="intel-event-actions">
                  <button className="ghost-button" onClick={() => onSelectEvent(item.id)}>
                    <MapIcon size={12} /> Map
                  </button>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="ghost-button">
                      <ExternalLink size={12} /> Source
                    </a>
                  )}
                </div>
              </div>
            ))}
            {filteredSecondary.length === 0 && (
              <p style={{ color: 'var(--muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>
                No events match the current filter.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Real-Time Change Notifications */}
      <section className="panel animate-fade-in stagger-2">
        <div className="intel-section-header">
          <h3>
            <Bell size={16} />
            Change Notifications
            {unreadCount > 0 && (
              <span className="badge-counter" style={{ position: 'static', marginLeft: '6px' }}>
                {unreadCount}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`ghost-button ${notifFilter === 'all' ? 'active' : ''}`}
              onClick={() => setNotifFilter('all')}
              style={{ fontSize: '0.75rem' }}
            >
              All
            </button>
            <button
              className={`ghost-button ${notifFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setNotifFilter('unread')}
              style={{ fontSize: '0.75rem' }}
            >
              Unread
            </button>
            {unreadCount > 0 && (
              <button className="ghost-button" onClick={handleMarkAllRead} style={{ fontSize: '0.75rem' }}>
                <CheckCheck size={12} /> Mark All Read
              </button>
            )}
          </div>
        </div>

        {visibleNotifications.length === 0 ? (
          <div className="intel-empty-state">
            <BellOff size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <p>
              {dbNotifications.length === 0
                ? 'No change notifications yet. Trigger a data refresh to populate change detection.'
                : 'All notifications have been read.'}
            </p>
          </div>
        ) : (
          <div className="intel-notif-list">
            {visibleNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`intel-notif-item ${notif.isRead ? 'read' : 'unread'}`}
                onClick={() => {
                  handleMarkRead(notif.id);
                  if (notif.eventId) onSelectEvent(notif.eventId);
                }}
              >
                <div className="intel-notif-icon">
                  {CHANGE_ICONS[notif.changeType] ?? '📡'}
                </div>
                <div className="intel-notif-body">
                  <div className="intel-notif-headline">{notif.headline}</div>
                  <div className="intel-notif-meta">
                    <span className="hazard-badge" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                      {notif.hazardCategory}
                    </span>
                    {notif.country && <span className="intel-label">📍 {notif.country}</span>}
                    <span className="intel-label">🕐 {formatRelativeTime(notif.createdAt)}</span>
                    <span
                      className="severity-badge"
                      style={{
                        background: `${SEVERITY_COLOR[notif.severity] ?? '#94a3b8'}22`,
                        color: SEVERITY_COLOR[notif.severity] ?? '#94a3b8',
                        border: `1px solid ${SEVERITY_COLOR[notif.severity] ?? '#94a3b8'}44`,
                        fontSize: '0.7rem',
                      }}
                    >
                      {notif.severity}
                    </span>
                  </div>
                  <div className="intel-notif-change">{notif.changeSummary}</div>
                  {notif.sourceUrl && (
                    <a
                      href={notif.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ghost-button"
                      style={{ fontSize: '0.72rem', marginTop: '4px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={11} /> Official Source
                    </a>
                  )}
                </div>
                {!notif.isRead && <div className="intel-notif-unread-dot" />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Application Component
// ---------------------------------------------------------------------------

export default function App() {

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('cascade-theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  const [activePage, setActivePage] = useState<string>('Home / Overview');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [events, setEvents] = useState<EventRecord[]>(seededEvents);
  const [sources, setSources] = useState<SourceHealth[]>(initialSourceHealth);
  const [apiStatus, setApiStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [notice, setNotice] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Bootstrapping...');
  const [refreshing, setRefreshing] = useState(false);
  const [scenario, setScenario] = useState<Scenario>({
    hazard: 'Earthquake',
    country: 'Japan',
    location: 'Tokyo metropolitan corridor',
    disruption: 'Power grid substation trips and port terminal outages',
    severity: 'Severe',
    duration: '24 to 48 hours (Intermediate disruption)',
    infrastructure: 'Power Transmission & Substations',
    populationExposure: 'High-Density Metropolitan Core (>5,000/km²)',
    assumptions: 'Compounding secondary fires, aftershock risk within 72h',
  });

  useEffect(() => {
    localStorage.setItem('cascade-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    document.body.dataset.theme = theme;
    document.body.style.colorScheme = theme;
  }, [theme]);

  // Notification panel state & persistence
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<DbNotification[]>([]);
  const [dbNotifUnreadCount, setDbNotifUnreadCount] = useState(0);

  const fetchDbNotifications = async () => {
    if (apiStatus !== 'online') return;
    try {
      const res = await apiRequest<{ notifications: DbNotification[]; unreadCount: number }>(
        '/api/notifications?limit=50'
      );
      if (res.notifications) setDbNotifications(res.notifications);
      setDbNotifUnreadCount(res.unreadCount ?? 0);
    } catch {}
  };

  const handleMarkDbRead = async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      setDbNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setDbNotifUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllDbRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setDbNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setDbNotifUnreadCount(0);
    } catch {}
  };

  const handleClearDb = async () => {
    try {
      await apiRequest('/api/notifications/clear', { method: 'POST' });
      setDbNotifications([]);
      setDbNotifUnreadCount(0);
    } catch {}
  };

  // Real-time SSE stream — receives backend change notifications instantly
  useEffect(() => {
    if (apiStatus === 'offline') return;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        es = new EventSource(`${API_BASE_URL}/api/notifications/stream`);
        es.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'notification' && msg.notification) {
              const notif = msg.notification as DbNotification;
              setDbNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
              setDbNotifUnreadCount((prev) => prev + 1);
              setNewUpdateIds((prev) => {
                const next = new Set(prev);
                if (notif.eventId) next.add(notif.eventId);
                return next;
              });
              setNotice(`🔔 Alert: ${notif.headline}`);
            }
          } catch {}
        };
        es.onerror = () => {
          es?.close();
          es = null;
          // Reconnect after 15s on error
          retryTimer = setTimeout(connect, 15000);
        };
      } catch {
        // SSE not available (e.g. offline demo mode) — silent
      }
    };

    // Small delay to let backend start properly
    retryTimer = setTimeout(connect, 2000);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [apiStatus]);

  // Fetch initial DB notification count on load
  useEffect(() => {
    fetchDbNotifications();
  }, [apiStatus]);


  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cascade_read_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (err) {
      console.warn('Failed to parse saved read notifications:', err);
    }
    return new Set<string>();
  });
  const [clearedNotificationIds, setClearedNotificationIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cascade_cleared_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (err) {
      console.warn('Failed to parse saved cleared notifications:', err);
    }
    return new Set<string>();
  });

  // Track known event IDs to recognize brand new real-time updates and prevent 99+ baseline bug
  const [, setKnownEventIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cascade_known_event_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.warn(e);
    }
    return new Set<string>();
  });

  // Track real-time update IDs that arrived live and have not yet been viewed
  const [newUpdateIds, setNewUpdateIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('cascade_realtime_updates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch (e) {
      console.warn(e);
    }
    return new Set<string>();
  });

  // Persist read notification IDs
  useEffect(() => {
    try {
      localStorage.setItem('cascade_read_notifications', JSON.stringify(Array.from(readNotificationIds)));
    } catch (err) {
      console.warn('Failed to save read notifications to localStorage:', err);
    }
  }, [readNotificationIds]);

  // Persist cleared notification IDs
  useEffect(() => {
    try {
      localStorage.setItem('cascade_cleared_notifications', JSON.stringify(Array.from(clearedNotificationIds)));
    } catch (err) {
      console.warn('Failed to save cleared notifications to localStorage:', err);
    }
  }, [clearedNotificationIds]);

  // Initial dashboard load with baseline establishment
  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiRequest<ApiSummary>('/api/summary');
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);

        // Auto-select the top live event so dashboard never defaults to demo eq-japan-1
        const topLive = data.events.find((e) => e.dataType === 'live') || data.events[0];
        if (topLive) {
          setSelectedEventId((prev) => {
            // Only override if still empty or pointing to a demo/seed event
            if (!prev || prev.startsWith('eq-') || prev.startsWith('flood-') || prev.startsWith('storm-') || prev.startsWith('wildfire-') || prev.startsWith('volcano-') || prev.startsWith('tsunami-') || prev.startsWith('drought-') || prev.startsWith('landslide-') || prev.startsWith('heat-')) {
              return topLive.id;
            }
            return prev;
          });
        }

        // Check if baseline is already established in this browser
        const hasBaseline = localStorage.getItem('cascade_baseline_established');
        if (!hasBaseline) {
          // Establish initial baseline: mark all current catalog items as known baseline!
          // This PREVENTS the 99+ badge bug on initial startup!
          const currentIds = new Set(data.events.map((e) => e.id));
          setKnownEventIds(currentIds);
          localStorage.setItem('cascade_known_event_ids', JSON.stringify(Array.from(currentIds)));
          localStorage.setItem('cascade_baseline_established', 'true');

          // Initial unread real-time updates start at 0
          setNewUpdateIds(new Set<string>());
          localStorage.removeItem('cascade_realtime_updates');
        } else {
          // Subsequent load: detect genuine fresh updates since last session
          const savedKnownRaw = localStorage.getItem('cascade_known_event_ids');
          const savedKnown = savedKnownRaw ? new Set<string>(JSON.parse(savedKnownRaw)) : new Set<string>();
          const freshUpdates = data.events.filter((e) => !savedKnown.has(e.id));
          if (freshUpdates.length > 0) {
            setNewUpdateIds((prev) => {
              const updated = new Set(prev);
              for (const ev of freshUpdates) {
                updated.add(ev.id);
              }
              localStorage.setItem('cascade_realtime_updates', JSON.stringify(Array.from(updated)));
              return updated;
            });
          }
        }
      }
      if (data.sourceHealth) setSources(data.sourceHealth);
      setApiStatus('online');
      setNotice('');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (error) {
      setApiStatus('offline');
      const message = error instanceof Error ? error.message : 'Backend unavailable.';
      const isConnectionError =
        message.startsWith('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('ERR_CONNECTION');
      setNotice(
        isConnectionError
          ? `Cannot reach the backend (${API_BASE_URL || 'http://localhost:8000'}). Start with: python server.py`
          : `Backend error: ${message}`
      );
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Automated background polling every 45s for genuine real-time disaster updates
  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const data = await apiRequest<ApiSummary>('/api/summary');
        if (Array.isArray(data.events) && data.events.length > 0) {
          setEvents((prevEvents) => {
            const prevIds = new Set(prevEvents.map((e) => e.id));
            const newlyArrived = data.events.filter((e) => !prevIds.has(e.id));

            if (newlyArrived.length > 0) {
              setNewUpdateIds((prevUpdates) => {
                const updated = new Set(prevUpdates);
                for (const ev of newlyArrived) {
                  updated.add(ev.id);
                }
                localStorage.setItem('cascade_realtime_updates', JSON.stringify(Array.from(updated)));
                return updated;
              });

              const top = newlyArrived[0];
              setNotice(`⚡ Live Feed Alert: ${top.hazardCategory} in ${top.location || top.country} detected.`);
            }

            return data.events;
          });

          if (data.sourceHealth) setSources(data.sourceHealth);
          setLastSyncTime(new Date().toLocaleTimeString());
          setApiStatus('online');
        }
      } catch (err) {
        console.warn('Background sync status:', err);
      }
    }, 45000);

    return () => window.clearInterval(timer);
  }, []);

  // Refresh all live feeds (USGS, GDACS, NASA)
  const refreshAllFeeds = async () => {
    setRefreshing(true);
    setNotice('');
    try {
      const data = await apiRequest<{
        events: EventRecord[];
        sourceHealth?: SourceHealth[];
        source?: string;
        retrieved?: number;
      }>('/api/refresh', { method: 'POST' });

      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents((prevEvents) => {
          const prevIds = new Set(prevEvents.map((e) => e.id));
          const newlyArrived = data.events.filter((e) => !prevIds.has(e.id));

          if (newlyArrived.length > 0) {
            setNewUpdateIds((prevUpdates) => {
              const updated = new Set(prevUpdates);
              for (const ev of newlyArrived) {
                updated.add(ev.id);
              }
              localStorage.setItem('cascade_realtime_updates', JSON.stringify(Array.from(updated)));
              return updated;
            });
          }

          return data.events;
        });

        if (data.sourceHealth) setSources(data.sourceHealth);
        setApiStatus('online');
        setLastSyncTime(new Date().toLocaleTimeString());
        setNotice(`Multi-hazard stream synchronized: ${data.retrieved ?? data.events.length} active global incidents.`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to refresh global hazard feeds.');
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-dismiss notice banner after 4.5s
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice('');
    }, 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const openEventOnMap = (id: string) => {
    setSelectedEventId(id);
    setActivePage('Global Monitor');
  };

  const preloadScenarioFromEvent = (event: EventRecord) => {
    setScenario({
      hazard: event.hazardCategory,
      country: event.country || 'Japan',
      location: event.location,
      disruption: `${event.hazardCategory} cascading supply & utility outage`,
      severity: event.severity,
      duration: '24 to 48 hours (Intermediate disruption)',
      infrastructure: 'Power Transmission & Substations',
      populationExposure: 'High-Density Metropolitan Core (>5,000/km²)',
      assumptions: `Derived from ${event.source} event record ${event.id}; localized infrastructure contingencies.`,
    });
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? events[0];

  // Memoized deduplication of real events for notifications
  const notifications = useMemo(() => {
    const seenIds = new Set<string>();
    const list: EventRecord[] = [];

    for (const ev of events) {
      if (!ev || !ev.id) continue;
      if (clearedNotificationIds.has(ev.id)) continue;
      if (seenIds.has(ev.id)) continue;
      seenIds.add(ev.id);
      list.push(ev);
    }

    list.sort((a, b) => {
      const timeA = new Date(a.eventTime).getTime() || 0;
      const timeB = new Date(b.eventTime).getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [events, clearedNotificationIds]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((ev) => !readNotificationIds.has(ev.id)).length;
  }, [notifications, readNotificationIds]);

  const markNotificationAsRead = useCallback((id: string) => {
    setReadNotificationIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      for (const ev of notifications) {
        next.add(ev.id);
      }
      return next;
    });
  }, [notifications]);

  const clearAllNotifications = useCallback(() => {
    setClearedNotificationIds((prev) => {
      const next = new Set(prev);
      for (const ev of events) {
        next.add(ev.id);
      }
      return next;
    });
  }, [events]);

  const restoreClearedNotifications = useCallback(() => {
    setClearedNotificationIds(new Set());
  }, []);

  const handleToggleNotificationPanel = useCallback(() => {
    setNotificationPanelOpen((prev) => {
      const willOpen = !prev;
      if (willOpen) {
        // User viewed notifications: clear badge counter immediately
        setNewUpdateIds(new Set());
        localStorage.removeItem('cascade_realtime_updates');
        const currentIds = new Set(events.map((e) => e.id));
        setKnownEventIds(currentIds);
        localStorage.setItem('cascade_known_event_ids', JSON.stringify(Array.from(currentIds)));
        // Mark all DB notifications as read so badge resets to 0
        handleMarkAllDbRead();
      }
      return willOpen;
    });
  }, [events, handleMarkAllDbRead]);

  const renderActivePage = () => {
    switch (activePage) {
      case 'Home / Overview':
        return <OverviewPage events={events} onSelectEvent={openEventOnMap} onNavigateToPage={setActivePage} />;
      case 'Daily Intelligence':
        return <DailyIntelligencePage onSelectEvent={openEventOnMap} />;
      case 'Global Monitor':
        return (
          <GlobalMonitorPage
            events={events}
            selectedEventId={selectedEventId}
            setSelectedEventId={setSelectedEventId}
            setActivePage={setActivePage}
            theme={theme}
            onPreloadScenario={preloadScenarioFromEvent}
            refreshing={refreshing}
          />
        );
      case 'Incident Explorer':
        return (
          <IncidentExplorerPage
            events={events}
            selectedEventId={selectedEventId}
            setSelectedEventId={setSelectedEventId}
            setActivePage={setActivePage}
          />
        );
      case 'Scenario Builder':
        return (
          <ScenarioBuilderPage
            scenario={scenario}
            setScenario={setScenario}
            selectedEvent={selectedEvent}
          />
        );
      case 'Cascade Simulator':
        return <CascadeSimulatorPage scenario={scenario} />;
      case 'Impact Assessment':
        return <ImpactAssessmentPage scenario={scenario} />;
      case 'Recommendations':
        return <RecommendationsPage scenario={scenario} />;
      case 'Compare Scenarios':
        return <CompareScenariosPage scenario={scenario} />;
      case 'Reports':
        return <ReportsPage events={events} scenario={scenario} />;
      case 'Data Sources and System Health':
        return <DataSourcesPage sources={sources} />;
      case 'Settings and About':
        return <SettingsPage theme={theme} setTheme={setTheme} />;
      default:
        return <OverviewPage events={events} onSelectEvent={openEventOnMap} onNavigateToPage={setActivePage} />;
    }
  };

  return (
    <div className={`app-shell ${theme}`}>
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">CZ</div>
          <div>
            <h1>CASCADE ZERO</h1>
            <small>Multi-Hazard Intelligence</small>
          </div>
        </div>

        <nav className="nav-list">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? 'active' : ''}`}
              onClick={() => setActivePage(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">Global Multi-Hazard Intelligence Platform</div>
            <h2>{activePage}</h2>
          </div>

          <div className="topbar-actions">
            <span className={`connection-status ${apiStatus}`} title={notice || 'API connection status'}>
              <span className="status-dot" />
              {apiStatus === 'online'
                ? `Live Stream Active (${lastSyncTime})`
                : apiStatus === 'connecting'
                ? 'Connecting to Feeds…'
                : 'Demo Mode (Offline)'}
            </span>

            <div style={{ position: 'relative' }}>
              <button
                className={`icon-button ${notificationPanelOpen ? 'active' : ''}`}
                aria-label={
                  newUpdateIds.size > 0
                    ? `${newUpdateIds.size} new real-time disaster updates`
                    : 'Disaster notifications'
                }
                aria-expanded={notificationPanelOpen}
                onClick={handleToggleNotificationPanel}
                title={
                  newUpdateIds.size > 0
                    ? `${newUpdateIds.size} new real-time disaster update${newUpdateIds.size === 1 ? '' : 's'} (Click to view)`
                    : unreadNotificationCount > 0
                    ? `${unreadNotificationCount} unread disaster notifications (Click to view)`
                    : 'Disaster Intelligence Alerts'
                }
              >
                <Bell size={18} />
                {dbNotifUnreadCount > 0 && (
                  <span className="badge-counter">
                    {dbNotifUnreadCount > 99 ? '99+' : dbNotifUnreadCount}
                  </span>
                )}
              </button>


              {notificationPanelOpen && (
                <NotificationPanel
                  isOpen={notificationPanelOpen}
                  onClose={() => setNotificationPanelOpen(false)}
                  events={notifications}
                  readIds={readNotificationIds}
                  newUpdateIds={newUpdateIds}
                  onMarkAsRead={markNotificationAsRead}
                  onMarkAllAsRead={() => {
                    markAllNotificationsAsRead();
                    handleMarkAllDbRead();
                  }}
                  onClearAll={() => {
                    clearAllNotifications();
                    handleClearDb();
                  }}
                  onRestoreCleared={restoreClearedNotifications}
                  hasCleared={clearedNotificationIds.size > 0}
                  onSelectNotification={(event) => {
                    markNotificationAsRead(event.id);
                    openEventOnMap(event.id);
                    setNotificationPanelOpen(false);
                  }}
                  selectedEventId={selectedEventId}
                  dbNotifications={dbNotifications}
                  onMarkDbRead={handleMarkDbRead}
                  onMarkAllDbRead={handleMarkAllDbRead}
                  onClearDb={handleClearDb}
                  onSelectEventId={(id) => {
                    openEventOnMap(id);
                    setNotificationPanelOpen(false);
                  }}
                />
              )}
            </div>

            <button
              className="icon-button"
              aria-label="Toggle Theme"
              onClick={() => setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'))}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
            >
              <SunMoon size={18} />
            </button>

            <button className="action-button" onClick={refreshAllFeeds} disabled={refreshing}>
              <Activity size={16} />
              {refreshing ? 'Ingesting Feeds…' : 'Refresh Feeds'}
            </button>
          </div>
        </header>

        {notice && (
          <div
            className={`toast-banner ${apiStatus === 'offline' ? 'info' : 'success'}`}
            role="status"
            aria-live="polite"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="live-beacon-dot"
                style={{ background: apiStatus === 'offline' ? '#f59e0b' : '#10b981' }}
              />
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice('')}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'currentColor',
                cursor: 'pointer',
                opacity: 0.7,
                fontSize: '0.9rem',
                lineHeight: 1,
                padding: '2px 6px',
                marginLeft: '8px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {apiStatus === 'offline' && (
          <div className="demo-banner">
            Offline demo mode: Showing illustrative multi-hazard scenarios. Start backend with `python server.py` for live USGS, GDACS, and NASA feeds.
          </div>
        )}

        {renderActivePage()}
      </main>
    </div>
  );
}
