import { Args, Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Queue } from "effect";
import { Web } from "./web";

const url = Args.text({
	name: "url",
});

const depth = Options.integer("depth").pipe(
	Options.withAlias("d"),
	Options.withDefault(3),
);

const linden = Command.make("linden", { url, depth }, ({ url, depth }) => {
	return Effect.gen(function* () {
		const web = yield* Web;

		const queue = yield* Queue.unbounded<{ url: URL; depth: number }>();

		// initial seeding of the queue
		yield* web.fetchPage(new URL(url)).pipe(
			Effect.flatMap(web.extractURLs),
			Effect.andThen((urls) => urls.map((url) => ({ url, depth: 0 }))),
			Effect.andThen((items) => queue.offerAll(items)),
		);

		const pipeline = Effect.fn("pipeline")(function* () {
			return yield* Queue.take(queue).pipe(
				Effect.flatMap(({ url, depth }) =>
					web
						.fetchPage(url)
						.pipe(Effect.map((fetchedPage) => ({ fetchedPage, depth }))),
				),
				Effect.flatMap(({ fetchedPage, depth }) =>
					web.extractURLs(fetchedPage).pipe(
						Effect.map((urls) => ({
							urls,
							depth,
						})),
					),
				),
				Effect.andThen(({ urls, depth }) =>
					urls.map((url) => ({ url, depth: depth + 1 })),
				),
				Effect.andThen((items) => queue.offerAll(items)),
				Effect.catchTag("RequestError", (_) => Effect.succeedNone),
			);
		});

		const shouldContinue = queue.isEmpty.pipe(
			Effect.andThen((empty) => !empty),
		);

		while (yield* shouldContinue) {
			yield* Effect.log("Running pipeline");
			yield* pipeline();
		}
	});
});

const cli = Command.run(linden, { name: "linden", version: "0.0.1" });

const AppLayer = Web.layer.pipe(
	Layer.provideMerge(BunContext.layer),
	Layer.provideMerge(FetchHttpClient.layer),
);

cli(process.argv).pipe(
	Effect.provide(AppLayer),
	Effect.catchAll(Effect.logError),

	BunRuntime.runMain,
);
