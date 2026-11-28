// @ts-check
import { appRoot } from "@prisma/composer";
import karaWispRelayService from "./relay/service.mjs";

export default appRoot("kara-wisp", ({ provision }) => {
  provision(karaWispRelayService, { id: "karawisprelay" });
});
