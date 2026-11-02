let online = false;
let busy = false;
export function refreshActions() {
  document.querySelectorAll<HTMLButtonElement>('button[data-write]').forEach((button) => {
    button.disabled = !online || busy || button.dataset.blocked === 'true';
  });
}
export function setOnline(value: boolean) {
  online = value;
  refreshActions();
}
export async function action(work: () => Promise<void>) {
  if (!online || busy) return;
  busy = true;
  refreshActions();
  try {
    await work();
  } finally {
    busy = false;
    refreshActions();
  }
}
