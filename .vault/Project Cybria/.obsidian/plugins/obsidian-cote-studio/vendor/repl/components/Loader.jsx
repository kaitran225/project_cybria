import cx from '@src/cx.mjs';
import { isCoteEmbedded } from '@src/cote-embedded.mjs';

function Loader({ active }) {
  const embedded = isCoteEmbedded();
  if (embedded) {
    return (
      <div className="cote-shell-loader" aria-hidden={!active}>
        <div className={cx('cote-shell-loader__bar', !active && 'cote-shell-loader__bar--idle')} />
      </div>
    );
  }
  return (
    <div className="overflow-hidden opacity-50 fixed top-0 left-0 w-full z-[1000]">
      <div className={cx('h-[2px] block w-full', active ? 'bg-foreground animate-train' : 'bg-transparent')}>
        <div />
      </div>
    </div>
  );
}
export default Loader;
