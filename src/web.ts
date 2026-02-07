import { HttpClient } from "@effect/platform";
import type {
	RequestError,
	ResponseError,
} from "@effect/platform/HttpClientError";
import { Context, Effect, Layer } from "effect";

export class Web extends Context.Tag("@linden/web")<
	Web,
	{
		readonly fetchPage: (
			url: string,
		) => Effect.Effect<string, RequestError | ResponseError>;
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

			return Web.of({
				fetchPage,
			});
		}),
	);
}
