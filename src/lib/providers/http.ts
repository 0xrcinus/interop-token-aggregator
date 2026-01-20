import { HttpClient } from "@effect/platform"
import { Effect } from "effect"

/**
 * Fetch JSON from a URL using Effect's HttpClient
 * The HttpClient service will be provided by the layer composition
 */
export const fetchJson = (url: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    const response = yield* client.get(url).pipe(
      Effect.flatMap((res) => res.json),
      Effect.mapError((error) => new Error(`Failed to fetch ${url}: ${String(error)}`))
    )

    return response
  })
