import { Args, Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import {
	Config,
	Data,
	Effect,
	Layer,
	Logger,
	LogLevel,
	MutableHashSet,
	Queue,
} from "effect";
import normalizeUrl from "normalize-url";
import { Web } from "./web";

const url = Args.text({
	name: "url",
});

const depth = Options.integer("depth").pipe(
	Options.withAlias("d"),
	Options.withDefault(3),
);

class AlreadyVisitedError extends Data.TaggedClass("AlreadyVisitedError")<{
	url: string;
}> {}

const linden = Command.make("linden", { url, depth }, ({ url, depth }) => {
	return Effect.gen(function* () {
		const web = yield* Web;

		const queue = yield* Queue.unbounded<{ url: URL; depth: number }>();

		const visited: MutableHashSet.MutableHashSet<string> =
			MutableHashSet.make();

		// initial seeding of the queue
		yield* web.fetchPage(new URL(url)).pipe(
			Effect.flatMap(web.extractURLs),
			Effect.andThen((urls) => urls.map((url) => ({ url, depth: 0 }))),
			Effect.andThen((items) => queue.offerAll(items)),
		);

		const pipeline = Effect.fn("pipeline")(function* () {
			const item = yield* Queue.take(queue);

			if (item.depth >= depth) {
				return yield* Effect.succeedNone;
			}

			const normalizedUrl = normalizeUrl(item.url.href);

			if (MutableHashSet.has(visited, normalizedUrl)) {
				return yield* Effect.fail(
					new AlreadyVisitedError({ url: normalizedUrl }),
				);
			}

			MutableHashSet.add(visited, normalizedUrl);

			yield* web.validateURL(item.url);

			const fetchedPage = yield* web.fetchPage(item.url);
			const urls = yield* web.extractURLs(fetchedPage);
			const items = urls.map((url) => ({ url, depth: item.depth + 1 }));

			yield* queue.offerAll(items);
		});

		const shouldContinue = queue.isEmpty.pipe(
			Effect.andThen((empty) => !empty),
		);

		const pipelineLoop = Effect.fn("pipelineLoop")(function* () {
			while (yield* shouldContinue) {
				yield* pipeline().pipe(Effect.catchAll((err) => Effect.logError(err)));
			}
		});

		yield* Effect.forEach([1, 2, 3, 4], (_, __) => pipelineLoop(), {
			concurrency: 4,
		});
	});
});

const cli = Command.run(linden, { name: "linden", version: "0.0.1" });

const LogLevelLive = Config.logLevel("LOG_LEVEL").pipe(
	Effect.orElse(() => Effect.succeed(LogLevel.Info)),
	Effect.andThen((level) => Logger.minimumLogLevel(level)),
	Layer.unwrapEffect,
);

const AppLayer = Web.layer.pipe(
	Layer.provideMerge(BunContext.layer),
	Layer.provideMerge(FetchHttpClient.layer),
	Layer.provideMerge(LogLevelLive),
);

cli(process.argv).pipe(
	Effect.provide(AppLayer),
	Effect.catchAll(Effect.logError),

	BunRuntime.runMain,
);
