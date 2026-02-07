import { HttpClient } from "@effect/platform";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import * as cheerio from "cheerio";
import { Context, Effect, Layer } from "effect";

export interface FetchedPage {
	content: string;
	url: URL;
}

export class Web extends Context.Tag("@linden/web")<
	Web,
	{
		readonly fetchPage: (
			url: URL,
		) => Effect.Effect<FetchedPage, HttpClientError>;

		readonly extractURLs: (page: FetchedPage) => Effect.Effect<URL[]>;
	}
>() {
	static readonly layer = Layer.effect(
		Web,
		Effect.gen(function* () {
			const http = yield* HttpClient.HttpClient;

			const fetchPage = Effect.fn("Web.fetchPage")(function* (url: URL) {
				const response = yield* http.get(url);
				const text = yield* response.text;

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

			return Web.of({
				fetchPage,
				extractURLs,
			});
		}),
	);
}
