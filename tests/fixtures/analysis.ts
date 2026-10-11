// SYNTHETIC TEST DATA. Only isolated test databases/providers import this module.
import { type AnalysisInput, type Research } from '../../packages/shared/src/analysis';
import type { ResearchProvider } from '../../apps/api/src/analysis/provider';
export function fixtureResearch(input: AnalysisInput): Research {
  return {
    uncertainties: ['TESTDATEN – synthetische Recherche, keine realen Angebote.'],
    candidates: [3800, 4000, 4200, 4100].map((rate, i) => ({
      title: `TESTDATEN Vergleich ${i + 1}`,
      url: `https://${i % 2 ? 'example.net' : 'example.org'}/fixture-${i}`,
      evidence: `TESTDATEN Angebot ${rate * input.area} ${input.currency}, Fläche ${input.area} m².`,
      price: rate * input.area,
      area: input.area,
      areaUnit: 'm2' as const,
      currency: input.currency,
      country: input.country,
      type: input.type,
      condition: input.condition,
      localMarket: true,
      active: true,
      publishedAt: new Date().toISOString().slice(0, 10),
      basis: 'asking' as const,
    })),
  };
}
export function fixtureProvider(wait = 0): ResearchProvider {
  return {
    id: 'test-fixture',
    async research(input, _model, signal, phase) {
      await phase('researching');
      if (wait)
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, wait);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(t);
              reject(new Error('Test cancellation'));
            },
            { once: true },
          );
        });
      await phase('extracting');
      const research = fixtureResearch(input);
      return {
        research,
        consultedUrls: research.candidates.map((c) => c.url),
        usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
      };
    },
  };
}
