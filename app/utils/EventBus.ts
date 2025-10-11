type Handler = (payload?: any) => void;

const listeners: Record<string, Handler[]> = {};

export const on = (event: string, handler: Handler) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(handler);
  return () => {
    listeners[event] = listeners[event].filter(h => h !== handler);
  };
};

export const emit = (event: string, payload?: any) => {
  const handlers = listeners[event] ?? [];
  handlers.forEach(h => {
    try {
      h(payload);
    } catch (e) {
      // swallow
      console.error('EventBus handler error', e);
    }
  });
};

export default { on, emit };
