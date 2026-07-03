import cx from '@src/cx.mjs';
import { isCoteEmbedded } from '@src/cote-embedded.mjs';

export function ShellButton({ label, onClick, variant = 'secondary', disabled, type = 'button', title, className }) {
  return (
    <button
      type={type}
      title={title ?? label}
      className={cx(
        'studio-btn studio-btn--compact',
        variant === 'danger' ? 'danger' : variant === 'primary' ? '' : 'secondary',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

export function ShellButtonGroup({ value, onChange, items, wrap = false }) {
  return (
    <div className={cx('cote-shell-button-group', wrap && 'cote-shell-button-group--wrap')} role="tablist">
      {Object.entries(items).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cx('cote-shell-button-group__btn', value === key && 'cote-shell-button-group__btn--active')}
        >
          {typeof label === 'string' ? label.toLowerCase() : label}
        </button>
      ))}
    </div>
  );
}

const shellInputClass = 'studio-input cote-shell-input';

export function ShellInput({ className, onChange, ...props }) {
  return (
    <input
      className={cx(shellInputClass, className)}
      onChange={(e) => onChange?.(e.target.value, e)}
      {...props}
    />
  );
}

export function ShellSelect({ className, value, onChange, options, children, ...props }) {
  return (
    <select
      className={cx('studio-select cote-shell-select', className)}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value, e)}
      {...props}
    >
      {children ??
        Object.entries(options ?? {}).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
    </select>
  );
}

export function ShellTextarea({ className, onChange, ...props }) {
  return (
    <textarea
      className={cx('studio-textarea cote-shell-textarea', className)}
      onChange={(e) => onChange?.(e.target.value, e)}
      {...props}
    />
  );
}

export function ShellCheckbox({ label, value, onChange, disabled = false }) {
  return (
    <label className="cote-shell-checkbox">
      <input type="checkbox" checked={value} disabled={disabled} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

export function ShellFormItem({ label, children, sublabel }) {
  return (
    <div className="cote-shell-form-item">
      <label className="cote-shell-form-item__label">{label}</label>
      {sublabel ? <span className="cote-shell-form-item__hint">{sublabel}</span> : null}
      {children}
    </div>
  );
}

export function useShellForms() {
  return isCoteEmbedded();
}
