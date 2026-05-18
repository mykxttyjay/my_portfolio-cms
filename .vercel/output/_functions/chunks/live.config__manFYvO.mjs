import { a as AstroError, bj as LiveContentConfigError } from './params-and-props_DwyEVPUa.mjs';
import 'kysely';
import { e as emdashLoader } from './loader-ou_PXAjg_XDqWmGlU.mjs';

const LIVE_CONTENT_TYPE = "live";

function getImporterFilename() {
  const stackLine = new Error().stack?.split("\n").find(
    (line) => !line.includes("defineCollection") && !line.includes("defineLiveCollection") && !line.includes("getImporterFilename") && !line.startsWith("Error")
  );
  if (!stackLine) {
    return void 0;
  }
  const match = /\/((?:src|chunks)\/.*?):\d+:\d+/.exec(stackLine);
  return match?.[1] ?? void 0;
}
function defineLiveCollection(config) {
  const importerFilename = getImporterFilename();
  if (importerFilename && !importerFilename.includes("live.config")) {
    throw new AstroError({
      ...LiveContentConfigError,
      message: LiveContentConfigError.message(
        "Live collections must be defined in a `src/live.config.ts` file.",
        importerFilename ?? "your content config file"
      )
    });
  }
  config.type ??= LIVE_CONTENT_TYPE;
  if (config.type !== LIVE_CONTENT_TYPE) {
    throw new AstroError({
      ...LiveContentConfigError,
      message: LiveContentConfigError.message(
        "Collections in a live config file must have a type of `live`.",
        importerFilename
      )
    });
  }
  if (!config.loader) {
    throw new AstroError({
      ...LiveContentConfigError,
      message: LiveContentConfigError.message(
        "Live collections must have a `loader` defined.",
        importerFilename
      )
    });
  }
  if (!config.loader.loadCollection || !config.loader.loadEntry) {
    throw new AstroError({
      ...LiveContentConfigError,
      message: LiveContentConfigError.message(
        "Live collection loaders must have `loadCollection()` and `loadEntry()` methods. Please check that you are not using a loader intended for build-time collections",
        importerFilename
      )
    });
  }
  if (typeof config.schema === "function") {
    throw new AstroError({
      ...LiveContentConfigError,
      message: LiveContentConfigError.message(
        "The schema cannot be a function for live collections. Please use a schema object instead.",
        importerFilename
      )
    });
  }
  return config;
}

const collections = {
  _emdash: defineLiveCollection({
    loader: emdashLoader()
  })
};

export { collections };
