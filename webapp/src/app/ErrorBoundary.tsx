import { Component, type ReactNode } from "react";

/** Один сломанный экран не должен оставлять пользователя с пустым белым окном. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page" role="alert">
        <h1>Что-то пошло не так</h1>
        <p className="hint">Закройте и откройте приложение снова.</p>
        <button className="chip" onClick={() => location.reload()}>
          Перезагрузить
        </button>
      </main>
    );
  }
}
