// @ts-check
import node from "@prisma/composer/node";
import { compute } from "@prisma/composer-prisma-cloud";

export default compute({
  name: "kara-wisp-relay",
  deps: {},
  build: node({ module: import.meta.url, entry: "server.js", dependencies: "external" }),
});
