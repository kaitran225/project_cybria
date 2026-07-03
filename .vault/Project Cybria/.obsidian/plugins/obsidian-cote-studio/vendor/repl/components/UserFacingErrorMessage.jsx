import { isCoteEmbedded } from '@src/cote-embedded.mjs';
import cx from '@src/cx.mjs';

export default function UserFacingErrorMessage(Props) {
  const { error } = Props;
  if (error == null) {
    return;
  }
  const embedded = isCoteEmbedded();
  return (
    <div
      className={cx(
        embedded ? 'cote-shell-error-bar' : 'text-background px-2 py-1 bg-foreground w-full ml-auto',
      )}
    >
      Error: {error.message || 'Unknown Error :-/'}
    </div>
  );
}
