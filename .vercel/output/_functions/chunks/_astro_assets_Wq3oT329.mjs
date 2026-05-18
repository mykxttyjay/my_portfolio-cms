import { a as AstroError, b1 as NoImageMetadata, b2 as FailedToFetchRemoteImageDimensions, b3 as RemoteImageNotAllowed, aS as joinPaths, b4 as ExpectedImage, a$ as isRemotePath, b5 as LocalImageUsedWrongly, b6 as MissingImageDimension, b7 as UnsupportedImageFormat, b8 as IncompatibleDescriptorOptions, b9 as UnsupportedImageConversion, ba as InvalidImageService, bb as ExpectedImageOptions, bc as ExpectedNotESMImage, bd as ImageMissingAlt, z as maybeRenderHead, a3 as addAttribute, Q as renderTemplate, be as FontFamilyNotFound, bf as unescapeHTML, bg as MissingGetFontFileRequestUrl } from './params-and-props_DwyEVPUa.mjs';
import { t as typeHandlers, a as types, i as isRemoteAllowed, s as spreadAttributes } from './entrypoint_BekPkF6C.mjs';
import * as mime from 'mrmime';
import { c as createComponent } from './astro-component_wp9zoKZU.mjs';
import 'clsx';
import 'piccolore';

function isESMImportedImage(src) {
  return typeof src === "object" || typeof src === "function" && "src" in src;
}
function isRemoteImage(src) {
  return typeof src === "string";
}
async function resolveSrc(src) {
  if (typeof src === "object" && "then" in src) {
    const resource = await src;
    return resource.default ?? resource;
  }
  return src;
}

const firstBytes = /* @__PURE__ */ new Map([
  [0, "heif"],
  [56, "psd"],
  [66, "bmp"],
  [68, "dds"],
  [71, "gif"],
  [73, "tiff"],
  [77, "tiff"],
  [82, "webp"],
  [105, "icns"],
  [137, "png"],
  [255, "jpg"]
]);
function detector(input) {
  const byte = input[0];
  const type = firstBytes.get(byte);
  if (type && typeHandlers.get(type).validate(input)) {
    return type;
  }
  return types.find((imageType) => typeHandlers.get(imageType).validate(input));
}

function lookup(input) {
  const type = detector(input);
  if (typeof type !== "undefined") {
    const size = typeHandlers.get(type).calculate(input);
    if (size !== void 0) {
      size.type = size.type ?? type;
      return size;
    }
  }
  throw new TypeError("unsupported file type: " + type);
}

async function imageMetadata(data, src) {
  let result;
  try {
    result = lookup(data);
  } catch {
    throw new AstroError({
      ...NoImageMetadata,
      message: NoImageMetadata.message(src)
    });
  }
  if (!result.height || !result.width || !result.type) {
    throw new AstroError({
      ...NoImageMetadata,
      message: NoImageMetadata.message(src)
    });
  }
  const { width, height, type, orientation } = result;
  const isPortrait = (orientation || 0) >= 5;
  return {
    width: isPortrait ? height : width,
    height: isPortrait ? width : height,
    format: type,
    orientation
  };
}

async function fetchWithRedirects(options) {
  const {
    url,
    headers,
    imageConfig,
    fetchFn = globalThis.fetch,
    redirectLimit = 10,
    onMaxRedirectsExceeded = (_u) => new Error("Maximum redirect depth exceeded"),
    onMissingLocationHeader = (_s, _u) => new Error(`Redirect response ${_s} missing Location header`),
    onDisallowedRedirect = (_current, _target) => new Error(
      `The image at ${_current} redirected to ${_target}, which is not an allowed remote location.`
    )
  } = options;
  if (redirectLimit <= 0) {
    throw onMaxRedirectsExceeded(typeof url === "string" ? url : url.toString());
  }
  const urlString = typeof url === "string" ? url : url.toString();
  const req = new Request(url, { headers });
  const res = await fetchFn(req, { redirect: "manual" });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get("Location");
    if (!location) {
      throw onMissingLocationHeader(res.status, urlString);
    }
    const redirectUrl = new URL(location, urlString).toString();
    if (!isRemoteAllowed(redirectUrl, {
      domains: imageConfig.domains ?? [],
      remotePatterns: imageConfig.remotePatterns ?? []
    })) {
      throw onDisallowedRedirect(urlString, redirectUrl);
    }
    return fetchWithRedirects({
      url: redirectUrl,
      headers,
      imageConfig,
      fetchFn,
      redirectLimit: redirectLimit - 1,
      onMaxRedirectsExceeded,
      onMissingLocationHeader,
      onDisallowedRedirect
    });
  }
  return res;
}

async function inferRemoteSize(url, imageConfig) {
  if (!URL.canParse(url)) {
    throw new AstroError({
      ...FailedToFetchRemoteImageDimensions,
      message: FailedToFetchRemoteImageDimensions.message(url)
    });
  }
  const allowlistConfig = imageConfig ? {
    domains: imageConfig.domains ?? [],
    remotePatterns: imageConfig.remotePatterns ?? []
  } : void 0;
  if (!allowlistConfig) {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new AstroError({
        ...FailedToFetchRemoteImageDimensions,
        message: FailedToFetchRemoteImageDimensions.message(url)
      });
    }
  }
  if (allowlistConfig && !isRemoteAllowed(url, allowlistConfig)) {
    throw new AstroError({
      ...RemoteImageNotAllowed,
      message: RemoteImageNotAllowed.message(url)
    });
  }
  let response;
  try {
    response = await fetchWithRedirects({
      url,
      onMaxRedirectsExceeded: (u) => new AstroError({
        ...FailedToFetchRemoteImageDimensions,
        message: FailedToFetchRemoteImageDimensions.message(u)
      }),
      onMissingLocationHeader: (_status, u) => new AstroError({
        ...FailedToFetchRemoteImageDimensions,
        message: FailedToFetchRemoteImageDimensions.message(u)
      }),
      imageConfig: imageConfig ?? {
        remotePatterns: [],
        domains: []
      }
    });
  } catch (_err) {
    throw new AstroError({
      ...FailedToFetchRemoteImageDimensions,
      message: FailedToFetchRemoteImageDimensions.message(url)
    });
  }
  if (allowlistConfig && !isRemoteAllowed(response.url, allowlistConfig)) {
    throw new AstroError({
      ...RemoteImageNotAllowed,
      message: RemoteImageNotAllowed.message(url)
    });
  }
  if (!response.body || !response.ok) {
    throw new AstroError({
      ...FailedToFetchRemoteImageDimensions,
      message: FailedToFetchRemoteImageDimensions.message(url)
    });
  }
  const reader = response.body.getReader();
  let done, value;
  let accumulatedChunks = new Uint8Array();
  while (!done) {
    const readResult = await reader.read();
    done = readResult.done;
    if (done) break;
    if (readResult.value) {
      value = readResult.value;
      let tmp = new Uint8Array(accumulatedChunks.length + value.length);
      tmp.set(accumulatedChunks, 0);
      tmp.set(value, accumulatedChunks.length);
      accumulatedChunks = tmp;
      try {
        const dimensions = await imageMetadata(accumulatedChunks, url);
        if (dimensions) {
          await reader.cancel();
          return dimensions;
        }
      } catch {
      }
    }
  }
  throw new AstroError({
    ...NoImageMetadata,
    message: NoImageMetadata.message(url)
  });
}

const VALID_SUPPORTED_FORMATS = [
  "jpeg",
  "jpg",
  "png",
  "tiff",
  "webp",
  "gif",
  "svg",
  "avif"
];
const DEFAULT_OUTPUT_FORMAT = "webp";
const DEFAULT_HASH_PROPS = [
  "src",
  "width",
  "height",
  "format",
  "quality",
  "fit",
  "position",
  "background"
];

const DEFAULT_RESOLUTIONS = [
  640,
  // older and lower-end phones
  750,
  // iPhone 6-8
  828,
  // iPhone XR/11
  960,
  // older horizontal phones
  1080,
  // iPhone 6-8 Plus
  1280,
  // 720p
  1668,
  // Various iPads
  1920,
  // 1080p
  2048,
  // QXGA
  2560,
  // WQXGA
  3200,
  // QHD+
  3840,
  // 4K
  4480,
  // 4.5K
  5120,
  // 5K
  6016
  // 6K
];
const LIMITED_RESOLUTIONS = [
  640,
  // older and lower-end phones
  750,
  // iPhone 6-8
  828,
  // iPhone XR/11
  1080,
  // iPhone 6-8 Plus
  1280,
  // 720p
  1668,
  // Various iPads
  2048,
  // QXGA
  2560
  // WQXGA
];
const getWidths = ({
  width,
  layout,
  breakpoints = DEFAULT_RESOLUTIONS,
  originalWidth
}) => {
  const smallerThanOriginal = (w) => !originalWidth || w <= originalWidth;
  if (layout === "full-width") {
    return breakpoints.filter(smallerThanOriginal);
  }
  if (!width) {
    return [];
  }
  const doubleWidth = width * 2;
  const maxSize = originalWidth ? Math.min(doubleWidth, originalWidth) : doubleWidth;
  if (layout === "fixed") {
    return originalWidth && width > originalWidth ? [originalWidth] : [width, maxSize];
  }
  if (layout === "constrained") {
    return [
      // Always include the image at 1x and 2x the specified width
      width,
      doubleWidth,
      ...breakpoints
    ].filter((w) => w <= maxSize).sort((a, b) => a - b);
  }
  return [];
};
const getSizesAttribute = ({
  width,
  layout
}) => {
  if (!width || !layout) {
    return void 0;
  }
  switch (layout) {
    // If screen is wider than the max size then image width is the max size,
    // otherwise it's the width of the screen
    case "constrained":
      return `(min-width: ${width}px) ${width}px, 100vw`;
    // Image is always the same width, whatever the size of the screen
    case "fixed":
      return `${width}px`;
    // Image is always the width of the screen
    case "full-width":
      return `100vw`;
    case "none":
    default:
      return void 0;
  }
};

function isLocalService(service) {
  if (!service) {
    return false;
  }
  return "transform" in service;
}
function parseQuality(quality) {
  let result = Number.parseInt(quality);
  if (Number.isNaN(result)) {
    return quality;
  }
  return result;
}
const sortNumeric = (a, b) => a - b;
function verifyOptions(options) {
  if (!options.src || !isRemoteImage(options.src) && !isESMImportedImage(options.src)) {
    throw new AstroError({
      ...ExpectedImage,
      message: ExpectedImage.message(
        JSON.stringify(options.src),
        typeof options.src,
        JSON.stringify(options, (_, v) => v === void 0 ? null : v)
      )
    });
  }
  if (!isESMImportedImage(options.src)) {
    if (options.src.startsWith("/@fs/") || !isRemotePath(options.src) && !options.src.startsWith("/")) {
      throw new AstroError({
        ...LocalImageUsedWrongly,
        message: LocalImageUsedWrongly.message(options.src)
      });
    }
    let missingDimension;
    if (!options.width && !options.height) {
      missingDimension = "both";
    } else if (!options.width && options.height) {
      missingDimension = "width";
    } else if (options.width && !options.height) {
      missingDimension = "height";
    }
    if (missingDimension) {
      throw new AstroError({
        ...MissingImageDimension,
        message: MissingImageDimension.message(missingDimension, options.src)
      });
    }
  } else {
    if (!VALID_SUPPORTED_FORMATS.includes(options.src.format)) {
      throw new AstroError({
        ...UnsupportedImageFormat,
        message: UnsupportedImageFormat.message(
          options.src.format,
          options.src.src,
          VALID_SUPPORTED_FORMATS
        )
      });
    }
    if (options.widths && options.densities) {
      throw new AstroError(IncompatibleDescriptorOptions);
    }
    if (options.src.format !== "svg" && options.format === "svg") {
      throw new AstroError(UnsupportedImageConversion);
    }
  }
}
const baseService = {
  validateOptions(options) {
    verifyOptions(options);
    if (!options.format) {
      if (isESMImportedImage(options.src) && options.src.format === "svg") {
        options.format = "svg";
      } else {
        options.format = DEFAULT_OUTPUT_FORMAT;
      }
    }
    if (options.width) options.width = Math.round(options.width);
    if (options.height) options.height = Math.round(options.height);
    if (options.layout) {
      delete options.layout;
    }
    if (options.fit === "none") {
      delete options.fit;
    }
    return options;
  },
  getHTMLAttributes(options) {
    const { targetWidth, targetHeight } = getTargetDimensions(options);
    const {
      src,
      width,
      height,
      format,
      quality,
      densities,
      widths,
      formats,
      layout,
      priority,
      fit,
      position,
      background,
      ...attributes
    } = options;
    return {
      ...attributes,
      width: targetWidth,
      height: targetHeight,
      loading: attributes.loading ?? "lazy",
      decoding: attributes.decoding ?? "async"
    };
  },
  getSrcSet(options) {
    const { targetWidth, targetHeight } = getTargetDimensions(options);
    const aspectRatio = targetWidth / targetHeight;
    const { widths, densities } = options;
    const targetFormat = options.format ?? DEFAULT_OUTPUT_FORMAT;
    let transformedWidths = (widths ?? []).sort(sortNumeric);
    let imageWidth = options.width;
    let maxWidth = Number.POSITIVE_INFINITY;
    if (isESMImportedImage(options.src)) {
      imageWidth = options.src.width;
      maxWidth = imageWidth;
      if (transformedWidths.length > 0 && transformedWidths.at(-1) > maxWidth) {
        transformedWidths = transformedWidths.filter((width) => width <= maxWidth);
        transformedWidths.push(maxWidth);
      }
    }
    transformedWidths = Array.from(new Set(transformedWidths));
    const {
      width: transformWidth,
      height: transformHeight,
      ...transformWithoutDimensions
    } = options;
    let allWidths = [];
    if (densities) {
      const densityValues = densities.map((density) => {
        if (typeof density === "number") {
          return density;
        } else {
          return Number.parseFloat(density);
        }
      });
      const densityWidths = densityValues.sort(sortNumeric).map((density) => Math.round(targetWidth * density));
      allWidths = densityWidths.map((width, index) => ({
        width,
        descriptor: `${densityValues[index]}x`
      }));
    } else if (transformedWidths.length > 0) {
      allWidths = transformedWidths.map((width) => ({
        width,
        descriptor: `${width}w`
      }));
    }
    return allWidths.map(({ width, descriptor }) => {
      const height = Math.round(width / aspectRatio);
      const transform = { ...transformWithoutDimensions, width, height };
      return {
        transform,
        descriptor,
        attributes: {
          type: `image/${targetFormat}`
        }
      };
    });
  },
  getURL(options, imageConfig) {
    const searchParams = new URLSearchParams();
    if (isESMImportedImage(options.src)) {
      searchParams.append("href", options.src.src);
    } else if (isRemoteAllowed(options.src, imageConfig)) {
      searchParams.append("href", options.src);
    } else {
      return options.src;
    }
    const params = {
      w: "width",
      h: "height",
      q: "quality",
      f: "format",
      fit: "fit",
      position: "position",
      background: "background"
    };
    Object.entries(params).forEach(([param, key]) => {
      options[key] && searchParams.append(param, options[key].toString());
    });
    const imageEndpoint = joinPaths("/", imageConfig.endpoint.route);
    let url = `${imageEndpoint}?${searchParams}`;
    if (imageConfig.assetQueryParams) {
      const assetQueryString = imageConfig.assetQueryParams.toString();
      if (assetQueryString) {
        url += "&" + assetQueryString;
      }
    }
    return url;
  },
  parseURL(url) {
    const params = url.searchParams;
    if (!params.has("href")) {
      return void 0;
    }
    const transform = {
      src: params.get("href"),
      width: params.has("w") ? Number.parseInt(params.get("w")) : void 0,
      height: params.has("h") ? Number.parseInt(params.get("h")) : void 0,
      format: params.get("f"),
      quality: params.get("q"),
      fit: params.get("fit"),
      position: params.get("position") ?? void 0,
      background: params.get("background") ?? void 0
    };
    return transform;
  },
  getRemoteSize(url, imageConfig) {
    return inferRemoteSize(url, imageConfig);
  }
};
function getTargetDimensions(options) {
  let targetWidth = options.width;
  let targetHeight = options.height;
  if (isESMImportedImage(options.src)) {
    const aspectRatio = options.src.width / options.src.height;
    if (targetHeight && !targetWidth) {
      targetWidth = Math.round(targetHeight * aspectRatio);
    } else if (targetWidth && !targetHeight) {
      targetHeight = Math.round(targetWidth / aspectRatio);
    } else if (!targetWidth && !targetHeight) {
      targetWidth = options.src.width;
      targetHeight = options.src.height;
    }
  }
  return {
    targetWidth,
    targetHeight
  };
}

function isImageMetadata(src) {
  return src.fsPath && !("fsPath" in src);
}

const PLACEHOLDER_BASE = "astro://placeholder";
function createPlaceholderURL(pathOrUrl) {
  return new URL(pathOrUrl, PLACEHOLDER_BASE);
}
function stringifyPlaceholderURL(url) {
  return url.href.replace(PLACEHOLDER_BASE, "");
}

const cssFitValues = ["fill", "contain", "cover", "scale-down"];
async function getConfiguredImageService() {
  if (!globalThis?.astroAsset?.imageService) {
    const { default: service } = await import(
      // @ts-expect-error
      './sharp_DO5nSa2F.mjs'
    ).catch((e) => {
      const error = new AstroError(InvalidImageService);
      error.cause = e;
      throw error;
    });
    if (!globalThis.astroAsset) globalThis.astroAsset = {};
    globalThis.astroAsset.imageService = service;
    return service;
  }
  return globalThis.astroAsset.imageService;
}
async function getImage$1(options, imageConfig) {
  if (!options || typeof options !== "object") {
    throw new AstroError({
      ...ExpectedImageOptions,
      message: ExpectedImageOptions.message(JSON.stringify(options))
    });
  }
  if (typeof options.src === "undefined") {
    throw new AstroError({
      ...ExpectedImage,
      message: ExpectedImage.message(
        options.src,
        "undefined",
        JSON.stringify(options)
      )
    });
  }
  if (isImageMetadata(options)) {
    throw new AstroError(ExpectedNotESMImage);
  }
  const service = await getConfiguredImageService();
  const resolvedOptions = {
    ...options,
    src: await resolveSrc(options.src)
  };
  let originalWidth;
  let originalHeight;
  if (resolvedOptions.inferSize) {
    delete resolvedOptions.inferSize;
    if (isRemoteImage(resolvedOptions.src) && isRemotePath(resolvedOptions.src)) {
      if (!isRemoteAllowed(resolvedOptions.src, imageConfig)) {
        throw new AstroError({
          ...RemoteImageNotAllowed,
          message: RemoteImageNotAllowed.message(resolvedOptions.src)
        });
      }
      const getRemoteSize = (url) => service.getRemoteSize?.(url, imageConfig) ?? inferRemoteSize(url, imageConfig);
      const result = await getRemoteSize(resolvedOptions.src);
      resolvedOptions.width ??= result.width;
      resolvedOptions.height ??= result.height;
      originalWidth = result.width;
      originalHeight = result.height;
    }
  }
  const originalFilePath = isESMImportedImage(resolvedOptions.src) ? resolvedOptions.src.fsPath : void 0;
  const clonedSrc = isESMImportedImage(resolvedOptions.src) ? (
    // @ts-expect-error - clone is a private, hidden prop
    resolvedOptions.src.clone ?? resolvedOptions.src
  ) : resolvedOptions.src;
  if (isESMImportedImage(clonedSrc)) {
    originalWidth = clonedSrc.width;
    originalHeight = clonedSrc.height;
  }
  if (originalWidth && originalHeight) {
    const aspectRatio = originalWidth / originalHeight;
    if (resolvedOptions.height && !resolvedOptions.width) {
      resolvedOptions.width = Math.round(resolvedOptions.height * aspectRatio);
    } else if (resolvedOptions.width && !resolvedOptions.height) {
      resolvedOptions.height = Math.round(resolvedOptions.width / aspectRatio);
    } else if (!resolvedOptions.width && !resolvedOptions.height) {
      resolvedOptions.width = originalWidth;
      resolvedOptions.height = originalHeight;
    }
  }
  resolvedOptions.src = clonedSrc;
  const layout = options.layout ?? imageConfig.layout ?? "none";
  if (resolvedOptions.priority) {
    resolvedOptions.loading ??= "eager";
    resolvedOptions.decoding ??= "sync";
    resolvedOptions.fetchpriority ??= "high";
    delete resolvedOptions.priority;
  } else {
    resolvedOptions.loading ??= "lazy";
    resolvedOptions.decoding ??= "async";
    resolvedOptions.fetchpriority ??= void 0;
  }
  if (layout !== "none") {
    resolvedOptions.widths ||= getWidths({
      width: resolvedOptions.width,
      layout,
      originalWidth,
      breakpoints: imageConfig.breakpoints?.length ? imageConfig.breakpoints : isLocalService(service) ? LIMITED_RESOLUTIONS : DEFAULT_RESOLUTIONS
    });
    resolvedOptions.sizes ||= getSizesAttribute({ width: resolvedOptions.width, layout });
    delete resolvedOptions.densities;
    resolvedOptions["data-astro-image"] = layout;
    if (resolvedOptions.fit && cssFitValues.includes(resolvedOptions.fit)) {
      resolvedOptions["data-astro-image-fit"] = resolvedOptions.fit;
    }
    const currentPosition = resolvedOptions.position || "center";
    resolvedOptions["data-astro-image-pos"] = currentPosition.replace(/\s+/g, "-");
    if (resolvedOptions.position) {
      if (typeof resolvedOptions.style === "object" && resolvedOptions.style !== null) {
        if (!("objectPosition" in resolvedOptions.style)) {
          resolvedOptions.style = {
            ...resolvedOptions.style,
            objectPosition: resolvedOptions.position
          };
        }
      } else {
        const existingStyle = typeof resolvedOptions.style === "string" ? resolvedOptions.style : "";
        if (!existingStyle.includes("object-position")) {
          const positionStyle = `object-position: ${resolvedOptions.position}`;
          resolvedOptions.style = existingStyle ? existingStyle.replace(/;?\s*$/, "; ") + positionStyle : positionStyle;
        }
      }
    }
  }
  const validatedOptions = service.validateOptions ? await service.validateOptions(resolvedOptions, imageConfig) : resolvedOptions;
  const srcSetTransforms = service.getSrcSet ? await service.getSrcSet(validatedOptions, imageConfig) : [];
  const lazyImageURLFactory = (getValue) => {
    let cached = null;
    return () => cached ??= getValue();
  };
  const initialImageURL = await service.getURL(validatedOptions, imageConfig);
  let lazyImageURL = lazyImageURLFactory(() => initialImageURL);
  const matchesValidatedTransform = (transform) => transform.width === validatedOptions.width && transform.height === validatedOptions.height && transform.format === validatedOptions.format;
  let srcSets = await Promise.all(
    srcSetTransforms.map(async (srcSet) => {
      return {
        transform: srcSet.transform,
        url: matchesValidatedTransform(srcSet.transform) ? initialImageURL : await service.getURL(srcSet.transform, imageConfig),
        descriptor: srcSet.descriptor,
        attributes: srcSet.attributes
      };
    })
  );
  if (isLocalService(service) && globalThis.astroAsset.addStaticImage && !(isRemoteImage(validatedOptions.src) && initialImageURL === validatedOptions.src)) {
    const propsToHash = service.propertiesToHash ?? DEFAULT_HASH_PROPS;
    lazyImageURL = lazyImageURLFactory(
      () => globalThis.astroAsset.addStaticImage(validatedOptions, propsToHash, originalFilePath)
    );
    srcSets = srcSetTransforms.map((srcSet) => {
      return {
        transform: srcSet.transform,
        url: matchesValidatedTransform(srcSet.transform) ? lazyImageURL() : globalThis.astroAsset.addStaticImage(srcSet.transform, propsToHash, originalFilePath),
        descriptor: srcSet.descriptor,
        attributes: srcSet.attributes
      };
    });
  } else if (imageConfig.assetQueryParams) {
    const imageURLObj = createPlaceholderURL(initialImageURL);
    imageConfig.assetQueryParams.forEach((value, key) => {
      imageURLObj.searchParams.set(key, value);
    });
    lazyImageURL = lazyImageURLFactory(() => stringifyPlaceholderURL(imageURLObj));
    srcSets = srcSets.map((srcSet) => {
      const urlObj = createPlaceholderURL(srcSet.url);
      imageConfig.assetQueryParams.forEach((value, key) => {
        urlObj.searchParams.set(key, value);
      });
      return {
        ...srcSet,
        url: stringifyPlaceholderURL(urlObj)
      };
    });
  }
  return {
    rawOptions: resolvedOptions,
    options: validatedOptions,
    get src() {
      return lazyImageURL();
    },
    srcSet: {
      values: srcSets,
      attribute: srcSets.map((srcSet) => `${srcSet.url} ${srcSet.descriptor}`).join(", ")
    },
    attributes: service.getHTMLAttributes !== void 0 ? await service.getHTMLAttributes(validatedOptions, imageConfig) : {}
  };
}

Function.prototype.toString.call(Object);

const $$Image = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Image;
  const props = Astro2.props;
  if (props.alt === void 0 || props.alt === null) {
    throw new AstroError(ImageMissingAlt);
  }
  if (typeof props.width === "string") {
    props.width = Number.parseInt(props.width);
  }
  if (typeof props.height === "string") {
    props.height = Number.parseInt(props.height);
  }
  const layout = props.layout ?? imageConfig.layout ?? "none";
  if (layout !== "none") {
    props.layout ??= imageConfig.layout;
    props.fit ??= imageConfig.objectFit ?? "cover";
    props.position ??= imageConfig.objectPosition ?? "center";
  } else if (imageConfig.objectFit || imageConfig.objectPosition) {
    props.fit ??= imageConfig.objectFit;
    props.position ??= imageConfig.objectPosition;
  }
  const image = await getImage(props);
  const additionalAttributes = {};
  if (image.srcSet.values.length > 0) {
    additionalAttributes.srcset = image.srcSet.attribute;
  }
  const { class: className, ...attributes } = { ...additionalAttributes, ...image.attributes };
  return renderTemplate`${maybeRenderHead()}<img${addAttribute(image.src, "src")}${spreadAttributes(attributes)}${addAttribute(className, "class")}>`;
}, "C:/Users/sabido/my_portfolio/node_modules/astro/components/Image.astro", void 0);

const $$Picture = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Picture;
  const defaultFormats = ["webp"];
  const defaultFallbackFormat = "png";
  const specialFormatsFallback = ["gif", "svg", "jpg", "jpeg"];
  const { formats = defaultFormats, pictureAttributes = {}, fallbackFormat, ...props } = Astro2.props;
  if (props.alt === void 0 || props.alt === null) {
    throw new AstroError(ImageMissingAlt);
  }
  const scopedStyleClass = props.class?.match(/\bastro-\w{8}\b/)?.[0];
  if (scopedStyleClass) {
    if (pictureAttributes.class) {
      pictureAttributes.class = `${pictureAttributes.class} ${scopedStyleClass}`;
    } else {
      pictureAttributes.class = scopedStyleClass;
    }
  }
  const layout = props.layout ?? imageConfig.layout ?? "none";
  const useResponsive = layout !== "none";
  if (useResponsive) {
    props.layout ??= imageConfig.layout;
    props.fit ??= imageConfig.objectFit ?? "cover";
    props.position ??= imageConfig.objectPosition ?? "center";
  } else if (imageConfig.objectFit || imageConfig.objectPosition) {
    props.fit ??= imageConfig.objectFit;
    props.position ??= imageConfig.objectPosition;
  }
  for (const key in props) {
    if (key.startsWith("data-astro-cid")) {
      pictureAttributes[key] = props[key];
    }
  }
  const originalSrc = await resolveSrc(props.src);
  const optimizedImages = await Promise.all(
    formats.map(
      async (format) => await getImage({
        ...props,
        src: originalSrc,
        format,
        widths: props.widths,
        densities: props.densities
      })
    )
  );
  const clonedSrc = isESMImportedImage(originalSrc) ? (
    // @ts-expect-error - clone is a private, hidden prop
    originalSrc.clone ?? originalSrc
  ) : originalSrc;
  let resultFallbackFormat = fallbackFormat ?? defaultFallbackFormat;
  if (!fallbackFormat && isESMImportedImage(clonedSrc) && specialFormatsFallback.includes(clonedSrc.format)) {
    resultFallbackFormat = clonedSrc.format;
  }
  const fallbackImage = await getImage({
    ...props,
    format: resultFallbackFormat,
    widths: props.widths,
    densities: props.densities
  });
  const imgAdditionalAttributes = {};
  const sourceAdditionalAttributes = {};
  if (props.sizes) {
    sourceAdditionalAttributes.sizes = props.sizes;
  }
  if (fallbackImage.srcSet.values.length > 0) {
    imgAdditionalAttributes.srcset = fallbackImage.srcSet.attribute;
  }
  const { class: className, ...attributes } = {
    ...imgAdditionalAttributes,
    ...fallbackImage.attributes
  };
  return renderTemplate`${maybeRenderHead()}<picture${spreadAttributes(pictureAttributes)}> ${Object.entries(optimizedImages).map(([_, image]) => {
    const srcsetAttribute = props.densities || !props.densities && !props.widths && !useResponsive ? `${image.src}${image.srcSet.values.length > 0 ? ", " + image.srcSet.attribute : ""}` : image.srcSet.attribute;
    return renderTemplate`<source${addAttribute(srcsetAttribute, "srcset")}${addAttribute(mime.lookup(image.options.format ?? image.src) ?? `image/${image.options.format}`, "type")}${spreadAttributes(sourceAdditionalAttributes)}>`;
  })}  <img${addAttribute(fallbackImage.src, "src")}${spreadAttributes(attributes)}${addAttribute(className, "class")}> </picture>`;
}, "C:/Users/sabido/my_portfolio/node_modules/astro/components/Picture.astro", void 0);

const componentDataByCssVariable = new Map([["--font-emdash",{"preloads":[{"style":"italic","subset":"cyrillic-ext","type":"woff2","url":"/_astro/fonts/08f0ea18cdf1ae81.woff2","weight":"100 900"},{"style":"italic","subset":"cyrillic","type":"woff2","url":"/_astro/fonts/9593fbb8383eb01c.woff2","weight":"100 900"},{"style":"italic","subset":"devanagari","type":"woff2","url":"/_astro/fonts/cced06053f87829e.woff2","weight":"100 900"},{"style":"italic","subset":"greek-ext","type":"woff2","url":"/_astro/fonts/a9bea187e846fcc2.woff2","weight":"100 900"},{"style":"italic","subset":"greek","type":"woff2","url":"/_astro/fonts/84070159564df0be.woff2","weight":"100 900"},{"style":"italic","subset":"vietnamese","type":"woff2","url":"/_astro/fonts/d581d51cd793384e.woff2","weight":"100 900"},{"style":"italic","subset":"latin-ext","type":"woff2","url":"/_astro/fonts/190f8cf059e0f931.woff2","weight":"100 900"},{"style":"italic","subset":"latin","type":"woff2","url":"/_astro/fonts/1d7aab50fda97bb3.woff2","weight":"100 900"},{"style":"normal","subset":"cyrillic-ext","type":"woff2","url":"/_astro/fonts/81fc65a9fa1b7533.woff2","weight":"100 900"},{"style":"normal","subset":"cyrillic","type":"woff2","url":"/_astro/fonts/1633c6c006fb5995.woff2","weight":"100 900"},{"style":"normal","subset":"devanagari","type":"woff2","url":"/_astro/fonts/f52e1d65e1364c61.woff2","weight":"100 900"},{"style":"normal","subset":"greek-ext","type":"woff2","url":"/_astro/fonts/63342f4e10d096aa.woff2","weight":"100 900"},{"style":"normal","subset":"greek","type":"woff2","url":"/_astro/fonts/a582ec5275b6220a.woff2","weight":"100 900"},{"style":"normal","subset":"vietnamese","type":"woff2","url":"/_astro/fonts/6ed39b447c70fac7.woff2","weight":"100 900"},{"style":"normal","subset":"latin-ext","type":"woff2","url":"/_astro/fonts/ad35ff1453ab1728.woff2","weight":"100 900"},{"style":"normal","subset":"latin","type":"woff2","url":"/_astro/fonts/1e5097bbf9c9d577.woff2","weight":"100 900"}],"css":"@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/08f0ea18cdf1ae81.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/9593fbb8383eb01c.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/cced06053f87829e.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/a9bea187e846fcc2.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+1F00-1FFF;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/84070159564df0be.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/d581d51cd793384e.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/190f8cf059e0f931.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/1d7aab50fda97bb3.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;font-weight:100 900;font-style:italic;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/81fc65a9fa1b7533.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/1633c6c006fb5995.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/f52e1d65e1364c61.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/63342f4e10d096aa.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+1F00-1FFF;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/a582ec5275b6220a.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/6ed39b447c70fac7.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/ad35ff1453ab1728.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3\";src:url(\"/_astro/fonts/1e5097bbf9c9d577.woff2\") format(\"woff2\");font-display:swap;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;font-weight:100 900;font-style:normal;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:italic;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}@font-face{font-family:\"Noto Sans-ada45c26760e80a3 fallback: Arial\";src:local(\"Arial\");font-display:swap;font-weight:100 900;font-style:normal;size-adjust:122.9249%;ascent-override:86.9637%;descent-override:23.8357%;line-gap-override:0%;}:root{--font-emdash:\"Noto Sans-ada45c26760e80a3\",\"Noto Sans-ada45c26760e80a3 fallback: Arial\",ui-sans-serif,system-ui,sans-serif;}"}]]);

function filterPreloads(data, preload) {
  if (!preload) {
    return null;
  }
  if (preload === true) {
    return data;
  }
  return data.filter(
    ({ weight, style, subset }) => preload.some((p) => {
      if (p.weight !== void 0 && weight !== void 0 && !checkWeight(p.weight.toString(), weight)) {
        return false;
      }
      if (p.style !== void 0 && p.style !== style) {
        return false;
      }
      if (p.subset !== void 0 && p.subset !== subset) {
        return false;
      }
      return true;
    })
  );
}
function checkWeight(input, target) {
  const trimmedInput = input.trim();
  if (trimmedInput.includes(" ")) {
    return trimmedInput === target;
  }
  if (target.includes(" ")) {
    const [a, b] = target.split(" ");
    const parsedInput = Number.parseInt(input);
    return parsedInput >= Number.parseInt(a) && parsedInput <= Number.parseInt(b);
  }
  return input === target;
}

const $$Font = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Font;
  const { cssVariable, preload = false } = Astro2.props;
  const data = componentDataByCssVariable.get(cssVariable);
  if (!data) {
    throw new AstroError({
      ...FontFamilyNotFound,
      message: FontFamilyNotFound.message(cssVariable)
    });
  }
  const filteredPreloadData = filterPreloads(data.preloads, preload);
  return renderTemplate`<style>${unescapeHTML(data.css)}</style>${filteredPreloadData?.map(({ url, type }) => renderTemplate`<link rel="preload"${addAttribute(url, "href")} as="font"${addAttribute(`font/${type}`, "type")} crossorigin>`)}`;
}, "C:/Users/sabido/my_portfolio/node_modules/astro/components/Font.astro", void 0);

class SsrRuntimeFontFileUrlResolver {
  #urls;
  constructor({
    urls
  }) {
    this.#urls = urls;
  }
  resolve(url, requestUrl) {
    if (!this.#urls.has(url)) {
      return null;
    }
    if (!url.startsWith("/")) {
      return url;
    }
    if (!requestUrl) {
      throw new AstroError(MissingGetFontFileRequestUrl);
    }
    return `${requestUrl.origin}${url}`;
  }
}

new SsrRuntimeFontFileUrlResolver({
									urls: new Set(["/_astro/fonts/08f0ea18cdf1ae81.woff2","/_astro/fonts/9593fbb8383eb01c.woff2","/_astro/fonts/cced06053f87829e.woff2","/_astro/fonts/a9bea187e846fcc2.woff2","/_astro/fonts/84070159564df0be.woff2","/_astro/fonts/d581d51cd793384e.woff2","/_astro/fonts/190f8cf059e0f931.woff2","/_astro/fonts/1d7aab50fda97bb3.woff2","/_astro/fonts/81fc65a9fa1b7533.woff2","/_astro/fonts/1633c6c006fb5995.woff2","/_astro/fonts/f52e1d65e1364c61.woff2","/_astro/fonts/63342f4e10d096aa.woff2","/_astro/fonts/a582ec5275b6220a.woff2","/_astro/fonts/6ed39b447c70fac7.woff2","/_astro/fonts/ad35ff1453ab1728.woff2","/_astro/fonts/1e5097bbf9c9d577.woff2"]),
								});

const assetQueryParams = undefined;
					const imageConfig = {"endpoint":{"route":"/_image"},"service":{"entrypoint":"astro/assets/services/sharp","config":{}},"dangerouslyProcessSVG":false,"domains":[],"remotePatterns":[],"responsiveStyles":false};
					Object.defineProperty(imageConfig, 'assetQueryParams', {
						value: assetQueryParams,
						enumerable: false,
						configurable: true,
					});
							const getImage = async (options) => await getImage$1(options, imageConfig);

export { $$Font as $, baseService as b, detector as d, fetchWithRedirects as f, getConfiguredImageService as g, imageConfig as i, parseQuality as p };
