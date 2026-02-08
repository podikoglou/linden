import { HttpClient } from "@effect/platform";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import * as cheerio from "cheerio";
import { Context, Data, Effect, Layer } from "effect";
import normalizeUrl from "normalize-url";

export interface FetchedPage {
	content: string;
	url: URL;
}

class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly url: URL;
}> {}

export class Web extends Context.Tag("@linden/web")<
	Web,
	{
		readonly fetchPage: (
			url: URL,
		) => Effect.Effect<FetchedPage, HttpClientError>;

		readonly extractURLs: (page: FetchedPage) => Effect.Effect<URL[]>;

		readonly normalizeURL: (url: URL) => Effect.Effect<string, ValidationError>;
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

			const normalizeURL = Effect.fn("Web.normalizeURL")(function* (url: URL) {
				// ensure it's http or https
				if (!(url.protocol === "http:" || url.protocol === "https:")) {
					return yield* new ValidationError({ url });
				}

				// clear the hash which is irrelevant to what response we get
				url.hash = "";

				// normalize using the normalize-url library
				const normalized = normalizeUrl(url.href);

				return yield* Effect.succeed(normalized);
			});

			return Web.of({
				fetchPage,
				extractURLs,
				normalizeURL,
			});
		}),
	);
}
