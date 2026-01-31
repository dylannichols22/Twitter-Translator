export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
}

export class ToastManager {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  show(options: ToastOptions): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type}`;
    const message = document.createElement('span');
    message.className = 'toast-message';
    message.textContent = options.message;
    toast.appendChild(message);

    const dismiss = document.createElement('button');
    dismiss.className = 'toast-dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '\u00d7';
    toast.appendChild(dismiss);

    toast.style.animation = 'toast-slide-in 0.3s ease-out';
    this.container.appendChild(toast);

    dismiss.addEventListener('click', () => {
      this.dismiss(toast);
    });

    const duration = options.duration ?? 4000;
    setTimeout(() => this.dismiss(toast), duration);
  }

  private dismiss(toast: HTMLElement): void {
    toast.style.animation = 'toast-slide-out 0.2s ease-in forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }
}
