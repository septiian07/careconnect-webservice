export function createApiResponse(data, statusCode, message) {
  return {
    statusCode: statusCode,
    message: message,
    result: data,
    time: new Date().toISOString(),
  };
}
