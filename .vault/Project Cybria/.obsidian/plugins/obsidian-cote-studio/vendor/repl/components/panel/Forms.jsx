import cx from '@src/cx.mjs';
import { useCoteEmbedded } from '@src/cote-embedded.mjs';
import { ShellButtonGroup } from './ShellForms.jsx';

export function ButtonGroup({ value, onChange, items, wrap = false }) {
  const embedded = useCoteEmbedded();
  if (embedded) {
    return <ShellButtonGroup value={value} onChange={onChange} items={items} wrap={wrap} />;
  }
  return (
    <div className={cx('flex max-w-lg space-x-0 text-xs', wrap && 'flex-wrap')}>
      {Object.entries(items).map(([key, label]) => (
        <button
          key={key}
          id={key}
          onClick={() => onChange(key)}
          className={cx(
            'px-2 border-b-2 h-8 whitespace-nowrap border-box max-h-8 hover:opacity-50',
            value === key ? 'border-foreground' : 'border-transparent',
          )}
        >
          {label.toLowerCase()}
        </button>
      ))}
    </div>
  );
}
