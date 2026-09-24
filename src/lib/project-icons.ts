/**
 * Static icon mapping for project types and development types.
 *
 * Each project type and development type maps to a Lucide icon name,
 * a human-readable label, and a background/foreground colour pair
 * for rendering as a coloured badge or avatar.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Hotel, Home, Building2, Palmtree, Hammer, Briefcase,
  Church, Map, Train, Building, HardHat, ArrowLeftRight,
  Expand, CheckCircle2, Paintbrush, Layers, GraduationCap,
  Factory, Landmark, ShoppingBag, Warehouse, School,
  Hospital, Plane, Ship, Tent,
} from 'lucide-react'

/* ── Project Type Icons ──────────────────────────────── */

export interface ProjectTypeIcon {
  icon: LucideIcon
  label: string
  /** Tailwind bg class for the icon circle */
  bg: string
  /** Tailwind text class for the icon itself */
  fg: string
}

const PROJECT_TYPE_ICONS: Record<string, ProjectTypeIcon> = {
  HOTEL:              { icon: Hotel,       label: 'Hotel',             bg: 'bg-blue-100',   fg: 'text-blue-600' },
  RESIDENTIAL:        { icon: Home,        label: 'Residential',       bg: 'bg-green-100',  fg: 'text-green-600' },
  MIXED_USE:          { icon: Building2,   label: 'Mixed Use',         bg: 'bg-purple-100', fg: 'text-purple-600' },
  RESORT:             { icon: Palmtree,    label: 'Resort',            bg: 'bg-teal-100',   fg: 'text-teal-600' },
  REFURBISHMENT:      { icon: Hammer,      label: 'Refurbishment',     bg: 'bg-amber-100',  fg: 'text-amber-600' },
  OFFICE_FIT_OUT:     { icon: Briefcase,   label: 'Office Fit-Out',    bg: 'bg-slate-100',  fg: 'text-slate-600' },
  RELIGIOUS_BUILDING: { icon: Church,      label: 'Religious Building', bg: 'bg-indigo-100', fg: 'text-indigo-600' },
  MASTER_PLAN:        { icon: Map,         label: 'Master Plan',       bg: 'bg-cyan-100',   fg: 'text-cyan-600' },
  TRANSPORT:          { icon: Train,       label: 'Transport',         bg: 'bg-orange-100', fg: 'text-orange-600' },
  OTHER:              { icon: Building,    label: 'Other',             bg: 'bg-gray-100',   fg: 'text-gray-500' },
}

const DEFAULT_PROJECT_ICON: ProjectTypeIcon = {
  icon: Building,
  label: 'Project',
  bg: 'bg-gray-100',
  fg: 'text-gray-500',
}

export function getProjectTypeIcon(projectType: string | null | undefined): ProjectTypeIcon {
  if (!projectType) return DEFAULT_PROJECT_ICON
  return PROJECT_TYPE_ICONS[projectType] ?? DEFAULT_PROJECT_ICON
}

/* ── Development Type Icons ──────────────────────────── */

export interface DevTypeIcon {
  icon: LucideIcon
  label: string
  bg: string
  fg: string
}

const DEV_TYPE_ICONS: Record<string, DevTypeIcon> = {
  NEW_BUILD:     { icon: HardHat,        label: 'New Build',           bg: 'bg-emerald-100', fg: 'text-emerald-600' },
  CONVERSION:    { icon: ArrowLeftRight, label: 'Conversion',          bg: 'bg-violet-100',  fg: 'text-violet-600' },
  REFURBISHMENT: { icon: Hammer,         label: 'Refurbishment',       bg: 'bg-amber-100',   fg: 'text-amber-600' },
  EXTENSION:     { icon: Expand,         label: 'Extension',           bg: 'bg-sky-100',     fg: 'text-sky-600' },
  COMPLETION:    { icon: CheckCircle2,   label: 'Completion',          bg: 'bg-green-100',   fg: 'text-green-600' },
  FIT_OUT:       { icon: Paintbrush,     label: 'Fit-out',             bg: 'bg-rose-100',    fg: 'text-rose-600' },
  MIXED:         { icon: Layers,         label: 'Mixed Development',   bg: 'bg-purple-100',  fg: 'text-purple-600' },
}

const DEFAULT_DEV_ICON: DevTypeIcon = {
  icon: Building,
  label: 'Development',
  bg: 'bg-gray-100',
  fg: 'text-gray-500',
}

export function getDevTypeIcon(devType: string | null | undefined): DevTypeIcon {
  if (!devType) return DEFAULT_DEV_ICON
  return DEV_TYPE_ICONS[devType] ?? DEFAULT_DEV_ICON
}
