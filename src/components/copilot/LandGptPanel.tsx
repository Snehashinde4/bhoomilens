import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/appStore';
import { askLandGpt, COPILOT_DISCLAIMER, SUGGESTED_QUERIES, type CopilotAnswer } from '@/copilot/engine';
import { formatDateTime } from '@/lib/format';

export function LandGptPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const role = useAppStore((s) => s.role);
  const history = useAppStore((s) => s.copilotHistory);
  const pushQuery = useAppStore((s) => s.pushCopilotQuery);

  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);

  const ask = (text: string) => {
    if (!text.trim()) return;
    pushQuery(text);
    setQuery(text);
    setAnswer(askLandGpt(text, role));
  };

  return (
    <Drawer open={open} onClose={onClose} title="LandGPT · Governance Copilot" width="w-[500px]">
      <div className="space-y-3">
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask(query);
          }}
        >
          <input
            className="field"
            placeholder="Ask about projects, risk, parcels, documents…"
            value={query}
            aria-label="LandGPT query"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-teal">
            Ask
          </button>
        </form>

        <div className="flex flex-wrap gap-1">
          {SUGGESTED_QUERIES.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              className="chip border-line bg-paper text-muted hover:border-teal hover:text-teal"
              onClick={() => ask(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {answer && (
          <article className="space-y-3 rounded-md border border-line bg-paper/50 p-3">
            <header className="flex items-start justify-between gap-2">
              <h3 className="text-[14px] font-semibold leading-snug">{answer.headline}</h3>
              <Badge tone={answer.confidence >= 80 ? 'green' : answer.confidence >= 60 ? 'amber' : 'red'}>
                {answer.confidence}% confidence
              </Badge>
            </header>

            {answer.denied && (
              <p className="rounded border border-signal-red/40 bg-signal-red/8 p-2 text-2xs text-signal-red">
                Permission-aware response: the copilot never reveals records outside your role scope.
              </p>
            )}

            {answer.facts.length > 0 && (
              <section>
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Facts from records</p>
                <ul className="space-y-1">
                  {answer.facts.map((f, i) => (
                    <li key={i} className="text-[12.5px] leading-snug">
                      • {f}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {answer.predictions.length > 0 && (
              <section className="rounded border border-signal-amber/40 bg-signal-amber/8 p-2">
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-[#8a5f10]">
                  Model estimates (not facts)
                </p>
                <ul className="space-y-1">
                  {answer.predictions.map((p, i) => (
                    <li key={i} className="text-[12.5px] leading-snug">
                      • {p}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {answer.calculation && (
              <section>
                <p className="mb-0.5 text-2xs font-bold uppercase tracking-wide text-muted">How this was calculated</p>
                <p className="text-[12px] text-muted">{answer.calculation}</p>
              </section>
            )}

            {answer.citations.length > 0 && (
              <section>
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Source records</p>
                <div className="flex flex-wrap gap-1">
                  {answer.citations.map((c, i) => (
                    <button
                      key={`${c.route}-${i}`}
                      type="button"
                      className="chip border-teal/40 bg-teal/10 text-teal"
                      onClick={() => {
                        onClose();
                        navigate(c.route);
                      }}
                    >
                      {c.kind}: {c.label} ↗
                    </button>
                  ))}
                </div>
              </section>
            )}

            {answer.followUps.length > 0 && (
              <section>
                <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Follow-up</p>
                <div className="flex flex-wrap gap-1">
                  {answer.followUps.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="chip border-line bg-surface text-muted hover:text-ink"
                      onClick={() => ask(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <p className="text-[11px] italic text-muted">{COPILOT_DISCLAIMER}</p>
          </article>
        )}

        {history.length > 0 && (
          <section>
            <p className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">Query history</p>
            <ul className="space-y-1">
              {history.slice(0, 8).map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full rounded border border-line/60 bg-surface px-2 py-1 text-left text-2xs hover:border-teal"
                    onClick={() => ask(h.query)}
                  >
                    <span className="block truncate">{h.query}</span>
                    <span className="block text-[10px] text-muted">{formatDateTime(h.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
