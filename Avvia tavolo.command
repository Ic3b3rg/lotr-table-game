#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if ! command -v node >/dev/null; then
  print 'Installa Node.js 24 LTS e segui la preparazione nel README.'
  read '?Premi Invio per chiudere.'
  exit 1
fi
if [[ ! -f dist/host.mjs ]]; then
  print 'Prima prepara il tavolo: npm ci --ignore-scripts e npm run build.'
  read '?Premi Invio per chiudere.'
  exit 1
fi
node dist/host.mjs
read '?Premi Invio per chiudere.'
