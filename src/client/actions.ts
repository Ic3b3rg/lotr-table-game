let online = false;
let busy = false;
function render() {
  document.querySelectorAll<HTMLButtonElement>('button[data-write]').forEach((button) => {
    button.disabled = !online || busy;
  });
}
export function setOnline(value: boolean) {
  online = value;
  render();
}
export async function action(work: () => Promise<void>) {
  if (!online || busy) return;
  busy = true;
  render();
  try {
    await work();
  } finally {
    busy = false;
    render();
  }
}
