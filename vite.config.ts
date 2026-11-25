import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { controllerPath } from '@mercuryworkshop/scramjet-controller/path';

function scramjetCompatibilityPatches() {
  const streamTransferFallback = `
;(() => {
  const scope = globalThis;
  if (scope.__karaScramjetStreamTransferPatch) return;
  scope.__karaScramjetStreamTransferPatch = true;

  let canTransferReadableStream = false;
  try {
    const channel = new MessageChannel();
    const stream = new ReadableStream({
      start(controller) { controller.close(); }
    });
    channel.port1.postMessage({ stream }, [stream]);
    channel.port1.close();
    channel.port2.close();
    canTransferReadableStream = true;
  } catch {
    canTransferReadableStream = false;
  }

  if (canTransferReadableStream || !globalThis.MessagePort) return;

  const nativePostMessage = MessagePort.prototype.postMessage;
  const pendingByPort = new WeakMap();

  async function streamToArrayBuffer(stream) {
    const reader = stream.getReader();
    const chunks = [];
    let totalLength = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        chunks.push(chunk);
        totalLength += chunk.byteLength;
      }
    } finally {
      reader.releaseLock();
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }

  function replaceStreams(value, replacements, seen = new WeakMap()) {
    if (value === null || typeof value !== 'object') return value;
    if (replacements.has(value)) return replacements.get(value);
    if (seen.has(value)) return seen.get(value);

    if (Array.isArray(value)) {
      const copy = [];
      seen.set(value, copy);
      for (const item of value) copy.push(replaceStreams(item, replacements, seen));
      return copy;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;

    const copy = Object.create(prototype);
    seen.set(value, copy);
    for (const key of Object.keys(value)) {
      copy[key] = replaceStreams(value[key], replacements, seen);
    }
    return copy;
  }

  MessagePort.prototype.postMessage = function(data, transferOrOptions) {
    const transfer = Array.isArray(transferOrOptions) ? transferOrOptions : [];
    const streams = transfer.filter(item =>
      typeof ReadableStream !== 'undefined' && item instanceof ReadableStream
    );

    const send = async () => {
      if (streams.length === 0) {
        return nativePostMessage.call(this, data, transferOrOptions);
      }

      const replacements = new Map();
      for (const stream of streams) {
        replacements.set(stream, await streamToArrayBuffer(stream));
      }

      const nextData = replaceStreams(data, replacements);
      const nextTransfer = transfer.map(item => replacements.get(item) || item);
      return nativePostMessage.call(this, nextData, nextTransfer);
    };

    const previous = pendingByPort.get(this);
    if (!previous && streams.length === 0) {
      return nativePostMessage.call(this, data, transferOrOptions);
    }

    const task = (previous || Promise.resolve()).then(send);
    pendingByPort.set(this, task.catch(error => {
      console.error('Kara Scramjet stream-transfer fallback failed:', error);
    }));
  };
})();
`;

  return {
    name: 'kara-scramjet-compatibility-patches',
    apply: 'build' as const,
    async closeBundle() {
      const outputDir = fileURLToPath(new URL('./dist/controller', import.meta.url));
      const workerPath = fileURLToPath(new URL('./dist/controller/controller.sw.js', import.meta.url));

      let worker: string;
      try {
        worker = await readFile(workerPath, 'utf8');
      } catch {
        throw new Error('Kara could not find dist/controller/controller.sw.js to apply the Scramjet response fix.');
      }

      const unsafeResponse = /new Response\\(([$\\w]+)\\.body,\\s*\\{\\s*status:\\s*\\1\\.status,\\s*statusText:\\s*\\1\\.statusText,\\s*headers:\\s*\\1\\.headers\\s*\\}\\)/g;
      const patchedWorker = worker.replace(
        unsafeResponse,
        'new Response([204, 205, 304].includes($1.status) ? null : $1.body, { status: $1.status, statusText: $1.statusText, headers: $1.headers })'
      );

      if (patchedWorker === worker) {
        throw new Error('Kara could not find Scramjet’s response reconstruction in controller.sw.js. Build stopped to avoid deploying an unpatched proxy.');
      }

      await writeFile(workerPath, patchedWorker, 'utf8');

      const entries = await readdir(outputDir, { withFileTypes: true });
      const runtimeFiles = entries.filter(entry =>
        entry.isFile() && /\\.(?:m?js)$/.test(entry.name)
      );

      if (!runtimeFiles.some(entry => entry.name === 'controller.sw.js')) {
        throw new Error('Kara could not verify the Scramjet service-worker bundle.');
      }

      for (const entry of runtimeFiles) {
        const path = fileURLToPath(new URL('./dist/controller/' + entry.name, import.meta.url));
        const source = await readFile(path, 'utf8');
        if (!source.includes('scope.__karaScramjetStreamTransferPatch')) {
          await writeFile(path, streamTransferFallback + source, 'utf8');
        }
      }

      console.info('Kara applied the no-body response fix and WebKit stream-transfer fallback.');
    },
  };
}

export default defineConfig({
  plugins: [
    scramjetCompatibilityPatches(),
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
