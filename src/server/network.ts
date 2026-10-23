import { networkInterfaces } from 'node:os';
import type { HostInfo } from '../shared/protocol';

export function addresses(port: number, sessionId: string, bind: string): HostInfo['addresses'] {
  const result: HostInfo['addresses'] = [];
  for (const [label, interfaces] of Object.entries(networkInterfaces())) {
    for (const item of interfaces ?? []) {
      if (
        item.family === 'IPv4' &&
        !item.internal &&
        (bind === '0.0.0.0' || item.address === bind)
      ) {
        result.push({
          address: item.address,
          label: `${label} · ${item.address}`,
          joinUrl: `http://${item.address}:${port}/join?session=${sessionId}`,
        });
      }
    }
  }
  return result.sort((a, b) => a.label.localeCompare(b.label));
}
