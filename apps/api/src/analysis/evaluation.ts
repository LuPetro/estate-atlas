import {
  selectComparables,
  sourceKey,
  type AnalysisInput,
  type AnalysisDiagnostics,
} from '@estate-atlas/shared/analysis';
import type { ProviderResult } from './provider';
export function researchDiagnostics(
  input: AnalysisInput,
  report: Pick<ProviderResult, 'research' | 'consultedUrls' | 'checks'>,
  now = new Date(),
): AnalysisDiagnostics {
  const selection = selectComparables(input, report.research, report.consultedUrls, now);
  const exclusions = { ...report.checks?.exclusions };
  for (const [key, count] of Object.entries(selection.exclusions)) {
    const reason = key as keyof typeof exclusions;
    exclusions[reason] = (exclusions[reason] ?? 0) + count!;
  }
  return {
    extracted: report.checks?.extracted ?? report.research.candidates.length,
    verified: report.research.candidates.length,
    accepted: selection.comparables.length,
    websites: selection.websites,
    sources: report.consultedUrls.filter((url) => sourceKey(url)).slice(0, 80),
    exclusions,
    notes: report.research.uncertainties,
  };
}
