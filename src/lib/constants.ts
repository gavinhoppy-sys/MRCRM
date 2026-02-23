import type { LeadStatus } from './db';

export const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];

export const SOURCES = ['Website', 'Referral', 'Door Knock', 'Facebook', 'Google', 'Yard Sign', 'Other'];

export const STATUS_COLORS: Record<LeadStatus, string> = {
  New:       'bg-blue-100 text-blue-800',
  Contacted: 'bg-yellow-100 text-yellow-800',
  Quoted:    'bg-purple-100 text-purple-800',
  Won:       'bg-green-100 text-green-800',
  Lost:      'bg-red-100 text-red-800',
};
