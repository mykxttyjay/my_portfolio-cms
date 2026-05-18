const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
const PLUGIN_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_-]*$/;
const MAX_IDENTIFIER_LENGTH = 128;
class IdentifierError extends Error {
  constructor(message, identifier) {
    super(message);
    this.identifier = identifier;
    this.name = "IdentifierError";
  }
}
function validateIdentifier(value, label = "identifier") {
  if (!value || typeof value !== "string") {
    throw new IdentifierError(`${label} must be a non-empty string`, String(value));
  }
  if (value.length > MAX_IDENTIFIER_LENGTH) {
    throw new IdentifierError(
      `${label} must be ${MAX_IDENTIFIER_LENGTH} characters or less, got ${value.length}`,
      value
    );
  }
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new IdentifierError(`${label} must match /^[a-z][a-z0-9_]*$/ (got "${value}")`, value);
  }
}
function validatePluginIdentifier(value, label = "plugin identifier") {
  if (!value || typeof value !== "string") {
    throw new IdentifierError(`${label} must be a non-empty string`, String(value));
  }
  if (value.length > MAX_IDENTIFIER_LENGTH) {
    throw new IdentifierError(
      `${label} must be ${MAX_IDENTIFIER_LENGTH} characters or less, got ${value.length}`,
      value
    );
  }
  if (!PLUGIN_IDENTIFIER_PATTERN.test(value)) {
    throw new IdentifierError(`${label} must match /^[a-z][a-z0-9_-]*$/ (got "${value}")`, value);
  }
}

export { validatePluginIdentifier as a, validateIdentifier as v };
