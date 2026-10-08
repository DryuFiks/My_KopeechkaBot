import type { ReactNode } from "react";

/** Короткая подсказка с необязательным примером — «зачем это нужно» в одну-две строки. */
export function Hint({ children, example }: { children: ReactNode; example?: ReactNode }) {
  return (
    <div className="hintbox">
      <p>{children}</p>
      {example && <p className="hintbox__example">Например: {example}</p>}
    </div>
  );
}
