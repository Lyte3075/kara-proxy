import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';

function scramjetNoBodyStatusPatch() {
  // WebKit exposes ReadableStream but does not support transferring one through
  // MessagePort. Probe the actual transfer operation, not the constructor.
  const transferableStreamProbe = `
const karaCanTransferReadableStream = (() => {
  try {
    const channel = new MessageChannel();
    const stream = new ReadableStream({ start(controller) { controller.close(); } });
    channel.port1.postMessage({ stream }, [stream]);
    channel.port1.close();
    channel.port2.close();
    return true;
  } catch {
    return false;
  }
})();
`;

  return {
    name: 'kara-scramjet-no-body-status-patch',
    apply: 'build' as const,
    async closeBundle() {
      const workerPath = fileURLToPath(new URL('./dist/controller/controller.sw.js', import.meta.url));
      let worker: string;
      try {
        worker = await readFile(workerPath, 'utf8');
      } catch {
        throw new Error('Kara could not find dist/controller/controller.sw.js to apply the Scramjet response fix.');
      }

      const unsafeResponse = /new Response\(([$\w]+)\.body,\s*\{\s*status:\s*\1\.status,\s*statusText:\s*\1\.statusText,\s*headers:\s*\1\.headers\s*\}\)/g;
      const patched = worker.replace(
        unsafeResponse,
        'new Response([204, 205, 304].includes($1.status) ? null : $1.body, { status: $1.status, statusText: $1.statusText, headers: $1.headers })'
      );

      if (patched === worker) {
        throw new Error('Kara could not find Scramjet’s response reconstruction in controller.sw.js. Build stopped to avoid deploying an unpatched proxy.');
      }

      await writeFile(workerPath, patched, 'utf8');

      console.info('Kara applied the existing Scramjet no-body response patch.');
    },
  };
}
import { controllerPath } from '@mercuryworkshop/scramjet-controller/path';

export default defineConfig({
  plugins: [
    scramjetNoBodyStatusPatch(),
    react(),
    viteStaticCopy({
      structured: false,
      targets: [
        { src: scramjetPath + '/*', dest: 'scramjet' },
        { src: controllerPath + '/*', dest: 'controller' },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
