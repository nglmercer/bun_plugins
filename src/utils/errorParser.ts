export function errorParser(error: unknown, prefix?: string): Error {
  let parsedError: Error;

  // Parse the error - always create a new Error to avoid readonly issues
  if (error instanceof Error) {
    // Create a new Error to avoid modifying potentially frozen Zod errors
    parsedError = new Error(error.message);
    parsedError.name = error.name;
    parsedError.stack = error.stack;
  } else if (typeof error === "string") {
    parsedError = new Error(error);
  } else if (error && typeof error === "object" && "message" in error) {
    parsedError = new Error(String((error as any).message));
  } else {
    parsedError = new Error(String(error));
  }

  // Prepend prefix if provided
  if (prefix) {
    parsedError.message = `${prefix}: ${parsedError.message}`;
  }

  return parsedError;
}
export default errorParser;