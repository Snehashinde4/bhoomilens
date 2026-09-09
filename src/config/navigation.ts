import type { Permission } from '@/types';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  permission: Permission;
  group: 'Command' | 'Records' | 'Intelligence' | 'Delivery' | 'Platform';
  description: string;
}

/** Left navigation. Every entry resolves to a real, functional route. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', path: '/overview', icon: '◍', permission: 'overview.view', group: 'Command', description: 'National land governance command centre' },
  { id: 'acquisition', label: 'Acquisition Monitor', path: '/acquisition', icon: '▤', permission: 'project.view', group: 'Command', description: 'Lifecycle, Kanban, timeline and Gantt views' },
  { id: 'projects', label: 'Projects', path: '/projects', icon: '▦', permission: 'project.view', group: 'Command', description: 'Project register and detail profiles' },
  { id: 'risk', label: 'Risk Intelligence', path: '/risk', icon: '◈', permission: 'risk.view', group: 'Command', description: 'Explainable delay risk and what-if simulation' },
  { id: 'scenario', label: 'Scenario Simulator', path: '/scenario', icon: '⚖', permission: 'risk.simulate', group: 'Command', description: 'National capacity and policy scenario modelling' },

  { id: 'digitization', label: 'Digitization Studio', path: '/digitization', icon: '❐', permission: 'document.view', group: 'Records', description: 'Document upload, OCR overlay and field extraction' },
  { id: 'validation', label: 'Validation Workspace', path: '/validation', icon: '⊞', permission: 'validation.view', group: 'Records', description: 'Conflict comparison and reviewer decisions' },
  { id: 'twins', label: 'Land Digital Twins', path: '/twins', icon: '◆', permission: 'parcel.view', group: 'Records', description: 'Living parcel profiles with trust and health scores' },
  { id: 'graph', label: 'Ownership Graph', path: '/ownership-graph', icon: '⁂', permission: 'graph.view', group: 'Records', description: 'Ownership, mutation and conflict knowledge graph' },
  { id: 'timemachine', label: 'Time Machine', path: '/time-machine', icon: '⟲', permission: 'parcel.view', group: 'Records', description: 'Administrative timeline from 2018 to 2026' },

  { id: 'fraud', label: 'Fraud Intelligence', path: '/fraud', icon: '⚠', permission: 'fraud.view', group: 'Intelligence', description: 'Potential anomaly detection and investigation' },
  { id: 'gis', label: 'GIS Explorer', path: '/gis', icon: '◎', permission: 'gis.view', group: 'Intelligence', description: 'Cadastral, project and environmental map layers' },
  { id: 'watershed', label: 'Watershed Insights', path: '/watershed', icon: '≋', permission: 'watershed.view', group: 'Intelligence', description: 'Vegetation, moisture and conservation evidence' },
  { id: 'research', label: 'Research Hub', path: '/research', icon: '❋', permission: 'research.view', group: 'Intelligence', description: 'Policy evidence library and research assistant' },

  { id: 'compensation', label: 'Compensation & R&R', path: '/compensation', icon: '₹', permission: 'compensation.view', group: 'Delivery', description: 'Assessment, disbursement and resettlement' },
  { id: 'review', label: 'Review Queue', path: '/review', icon: '☑', permission: 'review.view', group: 'Delivery', description: 'Prioritised human verification workload' },
  { id: 'citizen', label: 'Citizen Services', path: '/citizen', icon: '☗', permission: 'citizen.view', group: 'Delivery', description: 'Public land transparency and grievance services' },
  { id: 'reports', label: 'Reports', path: '/reports', icon: '▣', permission: 'reports.view', group: 'Delivery', description: 'Report centre with PDF, Excel and CSV export' },

  { id: 'integrations', label: 'Data Integrations', path: '/integrations', icon: '⇄', permission: 'integrations.view', group: 'Platform', description: 'Adapter health and synchronisation status' },
  { id: 'governance', label: 'Governance', path: '/governance', icon: '⛨', permission: 'governance.view', group: 'Platform', description: 'Security, privacy and model governance posture' },
  { id: 'audit', label: 'Audit Logs', path: '/audit', icon: '☰', permission: 'audit.view', group: 'Platform', description: 'Immutable record of every decision and access' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: '⚙', permission: 'settings.manage', group: 'Platform', description: 'Data scale, mock-data import and demo controls' },
];

export const NAV_GROUPS: Array<NavItem['group']> = [
  'Command',
  'Records',
  'Intelligence',
  'Delivery',
  'Platform',
];
