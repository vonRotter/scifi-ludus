/**
 * A small "ⓘ" badge that shows explanatory text on hover (native title
 * tooltip). Pure presentation — callers supply the copy; this never decides
 * what anything means.
 */

interface Props {
  text: string;
}

export function Info({ text }: Props) {
  return (
    <span className="info" title={text} role="img" aria-label={text} tabIndex={0}>
      ⓘ
    </span>
  );
}
