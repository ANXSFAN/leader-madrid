export class LogisticsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'LogisticsApiError';
  }
}
