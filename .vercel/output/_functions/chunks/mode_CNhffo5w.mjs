function getAuthMode(config) {
  const auth = config?.auth;
  if (auth && "entrypoint" in auth && auth.entrypoint) {
    return {
      type: "external",
      providerType: auth.type,
      entrypoint: auth.entrypoint,
      config: auth.config
    };
  }
  return { type: "passkey" };
}

export { getAuthMode as g };
