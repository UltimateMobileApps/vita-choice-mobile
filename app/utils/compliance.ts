import { ComplianceStatus, ComplianceSummaryResponse } from '../../services/api';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export const COMPLIANCE_BADGE_VARIANTS: Record<ComplianceStatus, { label: string; variant: BadgeVariant }> = {
  APPROVED: { label: 'Approved', variant: 'success' },
  WARNING: { label: 'Warning', variant: 'warning' },
  STOP: { label: 'Stop', variant: 'error' },
  EMPTY: { label: 'No Ingredients', variant: 'neutral' },
};

export const COMPLIANCE_LOADING_BADGE: { label: string; variant: BadgeVariant } = {
  label: 'Checking',
  variant: 'info',
};

export const COMPLIANCE_UNAVAILABLE_BADGE: { label: string; variant: BadgeVariant } = {
  label: 'Unavailable',
  variant: 'neutral',
};

export type ComplianceSummaryMessageKind = 'ready' | 'hint' | 'error';

export const getComplianceBadgeConfig = (
  summary: ComplianceSummaryResponse | null | undefined,
  options: { isLoading?: boolean } = {}
): { label: string; variant: BadgeVariant } => {
  if (summary) {
    return COMPLIANCE_BADGE_VARIANTS[summary.status];
  }

  if (options.isLoading) {
    return COMPLIANCE_LOADING_BADGE;
  }

  return COMPLIANCE_UNAVAILABLE_BADGE;
};

export const getComplianceSummaryMessage = (
  summary: ComplianceSummaryResponse | null | undefined,
  options: { isLoading?: boolean } = {}
): { message: string; kind: ComplianceSummaryMessageKind } | null => {
  if (summary) {
    if (summary.status === 'EMPTY') {
      return {
        message: summary.message || 'No ingredients in this formula yet',
        kind: 'hint',
      };
    }

    const counts = summary.summary || { safe: 0, caution: 0, risk: 0 };
    return {
      message: `${counts.safe ?? 0} safe • ${counts.caution ?? 0} caution • ${counts.risk ?? 0} risk`,
      kind: 'ready',
    };
  }

  if (options.isLoading) {
    return {
      message: 'Checking compliance…',
      kind: 'hint',
    };
  }

  if (summary === null) {
    return {
      message: 'Compliance status unavailable',
      kind: 'error',
    };
  }

  return null;
};

export interface ComplianceStatusCounters {
  approved: number;
  warning: number;
  stop: number;
  empty: number;
}

export const computeComplianceCounters = (
  summaries: Record<number, ComplianceSummaryResponse | null | undefined>
): ComplianceStatusCounters => {
  const counters: ComplianceStatusCounters = {
    approved: 0,
    warning: 0,
    stop: 0,
    empty: 0,
  };

  Object.values(summaries).forEach(summary => {
    if (!summary) {
      return;
    }

    switch (summary.status) {
      case 'APPROVED':
        counters.approved += 1;
        break;
      case 'WARNING':
        counters.warning += 1;
        break;
      case 'STOP':
        counters.stop += 1;
        break;
      case 'EMPTY':
        counters.empty += 1;
        break;
      default:
        break;
    }
  });

  return counters;
};
