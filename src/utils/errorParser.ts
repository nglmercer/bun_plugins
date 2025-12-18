export function errorParser(error: unknown, prefix?: string): Error {
  let parsedError: Error;

  // Parse the error
  if (error instanceof Error) {
    parsedError = error;
  } else if (typeof error === "string") {
    parsedError = new Error(error);
  } else if (error && typeof error === "object" && "message" in error) {
    parsedError = new Error(String(error.message));
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