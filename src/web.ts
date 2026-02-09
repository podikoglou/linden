import { HttpClient, Url } from "@effect/platform";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import * as cheerio from "cheerio";
import { Context, Data, Effect, Layer } from "effect";
import type { IllegalArgumentException } from "effect/Cause";
import normalizeUrl from "normalize-url";

export interface FetchedPage {
	content: string;
	url: URL;
}

class URLProtocolValidationError extends Data.TaggedError(
	"URLProtocolValidationError",
)<{
	readonly url: URL;
}> {}

export class Web extends Context.Tag("@linden/web")<
	Web,
	{
		readonly fetchPage: (
			url: URL,
		) => Effect.Effect<FetchedPage, HttpClientError>;

		readonly extractURLs: (page: FetchedPage) => Effect.Effect<URL[]>;

		readonly validateURLProtocol: (
			url: URL,
		) => Effect.Effect<void, URLProtocolValidationError>;

		readonly normalizeURL: (
			url: URL,
		) => Effect.Effect<
			URL,
			URLProtocolValidationError | IllegalArgumentException
		>;
	}
>() {
	static readonly layer = Layer.effect(
		Web,
		Effect.gen(function* () {
			const http = yield* HttpClient.HttpClient;

			const fetchPage = Effect.fn("Web.fetchPage")(function* (url: URL) {
				const response = yield* http.get(url);
				const text = yield* response.text;

				yield* Effect.logInfo(`Fetched page from ${url}`);

				return yield* Effect.succeed({ url, content: text });
			});

			const extractURLs = Effect.fn("Web.extractURLs")(function* ({
				url,
				content,
			}: FetchedPage) {
				const $ = cheerio.load(content);

				const anchors = $("a");

				const links = anchors
					.toArray()
					.map((anchor) => anchor.attribs.href)
					.filter((href) => href !== undefined)
					.map((href) => new URL(href, url));

				return yield* Effect.succeed(links);
			});

			const validateURLProtocol = (url: URL) =>
				url.protocol === "http:" || url.protocol === "https:"
					? Effect.succeedNone
					: Effect.fail(new URLProtocolValidationError({ url }));

			const normalizeURL = Effect.fn("Web.normalizeURL")(function* (url: URL) {
				yield* validateURLProtocol(url);

				// normalize using the normalize-url library
				const normalized = normalizeUrl(url.href);

				const normalizedParsed = yield* Url.fromString(normalized);
				const normalizedHashless = Url.setHash(normalizedParsed, "");

				return yield* Effect.succeed(normalizedHashless);
			});

			return Web.of({
				fetchPage,
				extractURLs,
				validateURLProtocol,
				normalizeURL,
			});
		}),
	);
}
