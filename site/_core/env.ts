export const ENV = {
  forgeApiUrl: String(process.env.BUILT_IN_FORGE_API_URL || "").trim(),
  forgeApiKey: String(process.env.BUILT_IN_FORGE_API_KEY || "").trim(),
};
