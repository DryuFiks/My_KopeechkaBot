import { useState } from "react";
import { cleanLabel, createMcpToken, fetchMcp, mcpUrl, revokeMcpToken, tokenUsage } from "@/entities/mcp";
import { CollapsibleCard, Hint, Status } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";
import { AiJournal } from "./ui/AiJournal";
import { ClientGuides } from "./ui/ClientGuides";

/** MKB-063: «Подключить ИИ» — секретная ссылка для Claude / ChatGPT / DeepSeek-клиента и журнал их записей. */
export function ConnectAi() {
  const overview = useAsync(fetchMcp);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useAction(overview.reload);
  const revoke = useAction(overview.reload);
  const name = cleanLabel(label);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false); // поле выделяется по клику — можно скопировать вручную
    }
  }

  const note = overview.data ? `ссылок: ${overview.data.tokens.length}` : undefined;
  return (
    <CollapsibleCard title="Подключить ИИ" note={note}>
      <Hint>
        ИИ-агент (Claude, ChatGPT, DeepSeek) внесёт расходы из банковской выписки и сверит остаток. Ссылка — как пароль:
        не показывайте её никому, а потерянную отзовите.
      </Hint>
      <Status state={overview}>
        {(data) => (
          <>
            {fresh && (
              <div className="form" role="status">
                <label>
                  Скопируйте ссылку сейчас — потом её уже не показать
                  <input readOnly value={fresh} onFocus={(e) => e.currentTarget.select()} aria-label="Секретная ссылка" />
                </label>
                <button type="button" onClick={() => void copy(fresh)}>
                  {copied ? "Скопировано" : "Копировать"}
                </button>
                <button type="button" className="link" onClick={() => setFresh(null)}>
                  Готово, я сохранил ссылку
                </button>
              </div>
            )}

            {data.tokens.map((t) => (
              <div className="row" key={t.id}>
                <span>
                  {t.label}
                  <small> · {tokenUsage(t.createdAt, t.lastUsedAt)}</small>
                </span>
                <button
                  className="chip chip--danger"
                  disabled={revoke.busy}
                  aria-label={`Отозвать ссылку ${t.label}`}
                  onClick={() => void revoke.run(() => revokeMcpToken(t.id))}
                >
                  Отозвать
                </button>
              </div>
            ))}
            {revoke.error && (
              <p className="hint" role="alert">
                {revoke.error}
              </p>
            )}

            {data.tokens.length < data.maxTokens && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name) return;
                  void create.run(async () => {
                      const { token } = await createMcpToken(name);
                      setFresh(mcpUrl(window.location.origin, token));
                      setCopied(false);
                      setLabel("");
                  });
                }}
              >
                <input
                  aria-label="Название ссылки"
                  placeholder="Для кого, например «Claude»"
                  maxLength={40}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <button type="submit" disabled={create.busy || !name}>
                  Создать ссылку
                </button>
                {create.error && (
                  <p className="hint" role="alert">
                    {create.error}
                  </p>
                )}
              </form>
            )}

            <ClientGuides />
            <AiJournal data={data} onChanged={overview.reload} />
          </>
        )}
      </Status>
    </CollapsibleCard>
  );
}
