import { Hint } from "@/shared/ui";

/** Как подключить ссылку в разных ИИ-клиентах; сама ссылка — одна и та же для всех. */
export function ClientGuides() {
  return (
    <>
      <details className="collapsible__sub">
        <summary>Claude</summary>
        <ol>
          <li>claude.ai → Настройки → Коннекторы → «Добавить свой коннектор».</li>
          <li>Вставьте ссылку, имя — «Копеечка». Авторизацию не включайте: ключ уже в ссылке.</li>
          <li>В Claude Desktop и Claude Code работает та же ссылка как удалённый MCP-сервер (HTTP).</li>
        </ol>
      </details>
      <details className="collapsible__sub">
        <summary>ChatGPT</summary>
        <ol>
          <li>Настройки → Приложения → «Дополнительно» → включите режим разработчика.</li>
          <li>«Создать приложение»: вставьте ссылку, аутентификация — «Без аутентификации».</li>
          <li>В чате включите это приложение через «+» → «Ещё».</li>
        </ol>
      </details>
      <details className="collapsible__sub">
        <summary>DeepSeek</summary>
        <ol>
          <li>
            У самого DeepSeek нет MCP: инструменты подключает клиент, например Cherry Studio, LibreChat или Cline.
          </li>
          <li>В клиенте: выберите модель DeepSeek, добавьте MCP-сервер типа «Streamable HTTP» и вставьте ссылку.</li>
        </ol>
      </details>
      <Hint example="«Вот выписка за неделю, внеси расходы и сверь остаток. Остаток на карте TBC — 1 240 ₾»">
        Покажите агенту выписку или скриншот и попросите внести операции. Повторная отправка тех же строк дубли не создаёт.
      </Hint>
    </>
  );
}
