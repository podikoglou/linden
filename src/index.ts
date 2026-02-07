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

		return yield* Effect.succeedNone;
	});
});

const cli = Command.run(linden, { name: "linden", version: "0.0.1" });

const AppLayer = Web.layer.pipe(
	Layer.provideMerge(BunContext.layer),
	Layer.provideMerge(FetchHttpClient.layer),
);

cli(process.argv).pipe(
	Effect.provide(AppLayer),
	Effect.catchAll(Effect.log),
	BunRuntime.runMain,
);
