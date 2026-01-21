import { HttpClient } from "@effect/platform"
import { Effect, Data } from "effect"

/**
 * HTTP fetch error with tagged error pattern
 */
export class HttpFetchError extends Data.TaggedError("HttpFetchError")<{
  readonly url: string
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Fetch JSON from a URL using Effect's HttpClient
 * The HttpClient service will be provided by the layer composition
 */
export const fetchJson = (url: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    const response = yield* client.get(url).pipe(
      Effect.flatMap((res) => res.json),
      Effect.timeout("30 seconds"),
      Effect.mapError((error) =>
        new HttpFetchError({
          url,
          message: `Failed to fetch ${url}`,
          cause: error
        })
      )
    )

    return response
  })
