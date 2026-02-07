import { HttpClient } from "@effect/platform";
import type {
	RequestError,
	ResponseError,
} from "@effect/platform/HttpClientError";
import * as cheerio from "cheerio";
import { Context, Effect, Layer } from "effect";

export class Web extends Context.Tag("@linden/web")<
	Web,
	{
		readonly fetchPage: (
			url: string,
		) => Effect.Effect<string, RequestError | ResponseError>;

		readonly extractLinks: (body: string) => Effect.Effect<string[]>;
	}
>() {
	static readonly layer = Layer.effect(
		Web,
		Effect.gen(function* () {
			const http = yield* HttpClient.HttpClient;

			const fetchPage = Effect.fn("Web.fetchPage")(function* (url: string) {
				const response = yield* http.get(url);
				const text = yield* response.text;

				return yield* Effect.succeed(text);
			});

			const extractLinks = Effect.fn("Web.extractLinks")(function* (
				body: string,
			) {
				const $ = cheerio.load(body);

				const anchors = $("a");

				const links = anchors
					.toArray()
					.map((anchor) => anchor.attribs.href)
					.filter((href) => href !== undefined);

				return yield* Effect.succeed(links);
			});

			return Web.of({
				fetchPage,
				extractLinks,
			});
		}),
	);
}
