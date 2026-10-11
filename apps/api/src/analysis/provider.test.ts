import { describe, it, expect, vi } from 'vitest';
import { analysisInput } from '@estate-atlas/shared/analysis';
import { sampleProperties } from '@estate-atlas/shared';
import { fixtureResearch } from '../../../../tests/fixtures/analysis';
import { OpenAIProvider, analysisRuntime } from './provider';
const input = analysisInput(sampleProperties[0]!);
function responses() {
  const research = fixtureResearch(input);
  return [
    {
      status: 'completed',
      output: [
        {
          type: 'web_search_call',
          action: { sources: research.candidates.map((c) => ({ url: c.url })) },
        },
        {
          type: 'message',
          content: [
            { type: 'output_text', text: research.candidates.map((c) => c.evidence).join('\n') },
          ],
        },
      ],
      usage: { input_tokens: 20, output_tokens: 30 },
    },
    {
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                ...research,
                candidates: research.candidates.map(({ evidence, ...c }) => ({
                  ...c,
                  priceEvidence: evidence,
                  areaEvidence: evidence,
                })),
              }),
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 15 },
    },
  ];
}
describe('OpenAI adapter with local fake HTTP responses', () => {
  it('requires cost activation even with configuration', async () => {
    const r = await analysisRuntime({ ANALYSIS_ENABLED: 'false' });
    expect(r.config.enabled).toBe(false);
    expect(r.provider).toBeNull();
    const approved = await analysisRuntime({ ANALYSIS_ENABLED: 'true' });
    expect(approved.config.enabled).toBe(false);
    expect(approved.config.reason).toContain('OpenAI-Key fehlt');
  });
  it('allows explicitly disabled daily quotas without activating paid research', async () => {
    const runtime = await analysisRuntime({
      ANALYSIS_USER_DAILY_LIMIT: '0',
      ANALYSIS_GLOBAL_DAILY_LIMIT: '0',
    });
    expect(runtime.userDailyLimit).toBe(0);
    expect(runtime.globalDailyLimit).toBe(0);
    expect(runtime.provider).toBeNull();
    expect(runtime.config.enabled).toBe(false);
    for (const value of ['-1', '0.5', '101', 'unlimited'])
      await expect(analysisRuntime({ ANALYSIS_GLOBAL_DAILY_LIMIT: value })).rejects.toThrow(
        'daily limit',
      );
  });
  it('bounds research, disables provider storage and extracts only cited evidence', async () => {
    const data = responses();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(data.shift()));
    const result = await new OpenAIProvider('synthetic-key', fetcher).research(
      input,
      'gpt-6-luna',
      new AbortController().signal,
      async () => {},
    );
    expect(result.research.candidates).toHaveLength(4);
    expect(result.usage).toEqual({ inputTokens: 30, outputTokens: 45, searchCalls: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetcher.mock.calls[0]![1]!.body as string);
    expect(first).toMatchObject({
      store: false,
      model: 'gpt-6-luna',
      max_tool_calls: 4,
      max_output_tokens: 6000,
    });
    expect(first.tools[0].type).toBe('web_search');
    const second = JSON.parse(fetcher.mock.calls[1]![1]!.body as string);
    expect(second.text.format.strict).toBe(true);
    expect(second.text.format.schema.additionalProperties).toBe(false);
    expect(JSON.stringify(second.text.format.schema)).not.toContain('"format":"uri"');
    expect(JSON.stringify(second.text.format.schema)).not.toContain('"maxLength"');
    expect(second).not.toHaveProperty('tools');
  });
  it('drops a fabricated URL or excerpt', async () => {
    const data = responses();
    const raw = JSON.parse((data[1]!.output[0]!.content![0] as { text: string }).text);
    raw.candidates[0].url = 'https://invented.example/listing';
    raw.candidates[1].priceEvidence = 'No such facts in the report';
    raw.candidates[2].price += 123;
    (data[1]!.output[0]!.content![0] as { text: string }).text = JSON.stringify(raw);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(data.shift()));
    const r = await new OpenAIProvider('synthetic-key', fetcher).research(
      input,
      'gpt-6-luna',
      new AbortController().signal,
      async () => {},
    );
    expect(r.research.candidates).toHaveLength(1);
    expect(r.checks).toEqual({ extracted: 4, exclusions: { source: 1, evidence: 2 } });
  });
  it('accepts separate price/area quotes with Austrian separators and an opened page source', async () => {
    const data = responses();
    const raw = JSON.parse((data[1]!.output[0]!.content![0] as { text: string }).text);
    raw.candidates = raw.candidates.slice(0, 1);
    Object.assign(raw.candidates[0], {
      price: 219000,
      area: 47.96,
      priceEvidence: 'Kaufpreis: € 219.000,00',
      areaEvidence: 'Wohnfläche: 47,96 m²',
    });
    data[0]!.output = [
      { type: 'web_search_call', action: { type: 'open_page', url: raw.candidates[0].url } } as any,
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: `${raw.candidates[0].url}\nKaufpreis: € 219.000,00\nWeitere Angaben zur Wohnung und Ausstattung.\nWohnfläche: 47,96 m²`,
          },
        ],
      },
    ];
    (data[1]!.output[0]!.content![0] as { text: string }).text = JSON.stringify(raw);
    const f = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(data.shift()));
    const result = await new OpenAIProvider('synthetic-key', f).research(
      input,
      'gpt-6-luna',
      new AbortController().signal,
      async () => {},
    );
    expect(result.research.candidates).toHaveLength(1);
    expect(result.research.candidates[0]!.evidence).toBe(
      'Kaufpreis: € 219.000,00\nWohnfläche: 47,96 m²',
    );
    expect(result.checks?.exclusions).toEqual({});
  });
  it('does not treat a decimal area as a ten-times larger area', async () => {
    const data = responses();
    const raw = JSON.parse((data[1]!.output[0]!.content![0] as { text: string }).text);
    raw.candidates = raw.candidates.slice(0, 1);
    raw.candidates[0].area = 987;
    raw.candidates[0].areaEvidence = 'Wohnfläche: 98,7 m²';
    (data[0]!.output[1]!.content![0] as { text: string }).text += '\nWohnfläche: 98,7 m²';
    (data[1]!.output[0]!.content![0] as { text: string }).text = JSON.stringify(raw);
    const f = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(data.shift()));
    const result = await new OpenAIProvider('synthetic-key', f).research(
      input,
      'gpt-6-luna',
      new AbortController().signal,
      async () => {},
    );
    expect(result.research.candidates).toHaveLength(0);
    expect(result.checks?.exclusions.evidence).toBe(1);
  });
  it.each([401, 429, 503])('handles HTTP %s safely without paid retries', async (status) => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('sensitive-provider-error', { status }));
    await expect(
      new OpenAIProvider('synthetic-key', f).research(
        input,
        'gpt-6-luna',
        new AbortController().signal,
        async () => {},
      ),
    ).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('rejects incomplete output and missing sources', async () => {
    for (const r of [
      { status: 'incomplete', output: [] },
      { status: 'completed', output: [] },
    ]) {
      const f = vi.fn<typeof fetch>().mockResolvedValue(Response.json(r));
      await expect(
        new OpenAIProvider('synthetic-key', f).research(
          input,
          'gpt-6-luna',
          new AbortController().signal,
          async () => {},
        ),
      ).rejects.toThrow();
    }
  });
});
