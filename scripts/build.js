// Construit l'installeur d'une édition : node scripts/build.js platine|pellicule|studio
// (ou toutes : node scripts/build.js all). Résultat dans dist/<édition>/.
const path = require('path');
const builder = require('electron-builder');
const { EDITIONS } = require('../src/editions');
const pkg = require('../package.json');

async function buildOne(id) {
  const e = EDITIONS[id];
  if (!e) throw new Error(`Édition inconnue : ${id} (platine, pellicule ou studio)`);
  console.log(`\n=== ${e.name} ${pkg.version} ===`);
  const base = pkg.build;
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget(['nsis'], builder.Arch.x64),
    publish: 'never',
    config: {
      ...base,
      appId: e.appId,
      productName: e.name,
      // écrit dans le package.json de l'appli : son nom et son édition
      extraMetadata: { name: e.id, productName: e.name, description: e.description, edition: e.id },
      directories: { output: path.join('dist', e.id) },
      win: { ...base.win, icon: e.icon },
      nsis: { ...base.nsis, artifactName: `${e.name}-Setup-\${version}.\${ext}` },
      // chaque appli se met à jour depuis les Releases de son propre dépôt
      publish: [{ provider: 'github', owner: 'BlancheLaGoat', repo: e.repo }],
    },
  });
}

(async () => {
  const arg = process.argv[2] || 'studio';
  const ids = arg === 'all' ? Object.keys(EDITIONS) : [arg];
  for (const id of ids) await buildOne(id);
})().catch(err => { console.error(err); process.exit(1); });
