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

      // Patch the page-side controller: on engines without transferable streams,
      // buffer only the affected response body and transfer its ArrayBuffer.
      const apiPath = fileURLToPath(new URL('./dist/controller/controller.api.js', import.meta.url));
      let api: string;
      try {
        api = await readFile(apiPath, 'utf8');
      } catch {
        throw new Error('Kara could not find dist/controller/controller.api.js for the WebKit stream-transfer patch.');
      }
      if (!api.includes('fetchresponse.body')) {
        throw new Error('Kara could not locate the Scramjet response-transfer code. Build stopped rather than shipping a partial WebKit fix.');
      }
      const returnPattern = /return\\s*\\[\\s*\\{\\s*body:\\s*fetchresponse\\.body/;
      const transferPattern = /fetchresponse\\.body\\s+instanceof\\s+ReadableStream\\s*\\|\\|\\s*fetchresponse\\.body\\s+instanceof\\s+ArrayBuffer\\s*\\?\\s*\\[fetchresponse\\.body\\]\\s*:\\s*\\[\\]/;
      if (!returnPattern.test(api) || !transferPattern.test(api)) {
        throw new Error('Kara found the Scramjet controller but its response-transfer code differs from the expected version. Build stopped for safety.');
      }
      api = api.replace(
        returnPattern,
        'const responseBody = fetchresponse.body instanceof ReadableStream && !karaCanTransferReadableStream ? await fetchresponse.arrayBuffer() : fetchresponse.body; return [{ body: responseBody'
      );
      api = api.replace(
        transferPattern,
        'responseBody instanceof ReadableStream || responseBody instanceof ArrayBuffer ? [responseBody] : []'
      );
      if (!api.includes('karaCanTransferReadableStream')) {
        const marker = 'class Controller';
        const at = api.indexOf(marker);
        if (at < 0) throw new Error('Kara could not locate the controller initialization point for its WebKit feature probe.');
        api = api.slice(0, at) + transferableStreamProbe + api.slice(at);
      }
      await writeFile(apiPath, api, 'utf8');
      console.info('Kara patched Scramjet response handling for WebKit stream-transfer compatibility.');
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
