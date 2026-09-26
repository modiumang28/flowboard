/*
  Every store mutation returns a Result instead of throwing. Failure is part of
  the signature, so callers cannot forget to handle it and tests can assert on
  the shape the brief asks for: { error: { code, message } }.
*/

export type ErrorCode =
  | 'FORBIDDEN' // 403 — the current user may not see or change this resource
  | 'NOT_FOUND' // the id does not exist (or is archived)
  | 'VALIDATION' // the input is malformed, e.g. an empty or over-long title
  | 'INVALID_PARENT' // breaks workspace -> space -> folder -> list

export interface AppError {
  code: ErrorCode
  message: string
}

export type Result<T> = { data: T } | { error: AppError }

export function ok<T>(data: T): Result<T> {
  return { data }
}

export function err<T = never>(code: ErrorCode, message: string): Result<T> {
  return { error: { code, message } }
}

export function isError<T>(result: Result<T>): result is { error: AppError } {
  return 'error' in result
}
