import { DIM, MUTED, TEXT } from '@/lib/designTokens';
import { FREE_DECK_FOCUS, type DeckFocusItem } from '@/lib/freeDeckFocus';

export default function FreeDeckFocus({ items = FREE_DECK_FOCUS }: { items?: DeckFocusItem[] }) {
  const focus = items.length ? items.slice(0, 3) : FREE_DECK_FOCUS;
  return (
    <section className="mb-8">
      <p className="m-0 text-[13px] font-medium" style={{ color: DIM }}>
        Free · investor deck
      </p>
      <h2
        className="font-display font-semibold mt-1 mb-3"
        style={{ color: TEXT, fontSize: '1.25rem', letterSpacing: '-0.03em' }}
      >
        Three things to focus on
      </h2>
      <ol className="space-y-3">
        {focus.map((item, index) => (
          <li key={item.title}>
            <p className="text-sm font-semibold m-0" style={{ color: TEXT }}>
              {index + 1}. {item.title}
            </p>
            <p className="text-sm m-0 mt-0.5" style={{ color: MUTED }}>
              {item.detail}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
