import { NextResponse } from "next/server"
import type { ZodSchema, ZodError } from "zod"

/**
 * Parse and validate request body or query params against a Zod schema.
 * Returns the parsed data or a formatted 400 error response.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          details: formatZodErrors(result.error),
        },
        { status: 400 },
      ),
    }
  }

  return { success: true, data: result.data }
}

/**
 * Parse URL search params into a plain object, then validate with Zod.
 */
export function validateQuery<T>(
  schema: ZodSchema<T>,
  searchParams: URLSearchParams,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const raw: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    raw[key] = value
  })
  return validateBody(schema, raw)
}

/**
 * Format Zod errors into a user-friendly structure.
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root"
    if (!formatted[path]) formatted[path] = []
    formatted[path].push(issue.message)
  }

  return formatted
}
