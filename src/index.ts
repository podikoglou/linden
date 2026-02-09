import { Args, Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { QueueEntry, ScrapeQueue } from "./scrape-queue";
import { Web } from "./web";

const url = Args.text({
	name: "url",
}).pipe(Args.withDescription("URL to start crawling from"));

const depth = Options.integer("depth").pipe(
	Options.withAlias("d"),
	Options.withDefault(3),
	Options.withDescription("The maximum depth to crawl"),
);

const concurrency = Options.integer("concurrency").pipe(
	Options.withAlias("c"),
	Options.withDefault(4),
	Options.withDescription("The maximum number of concurrent requests"),
);

const linden = Command.make(
	"linden",
	{ url, depth, concurrency },
	({ url, depth, concurrency }) => {
		return Effect.gen(function* () {
			const web = yield* Web;
			const scrapeQueue = yield* ScrapeQueue;

			// initial seeding of the queue
			yield* web.fetchPage(new URL(url)).pipe(
				Effect.flatMap(web.extractURLs),
				Effect.andThen((urls) =>
					urls.map((url) => new QueueEntry({ url, depth: 0 })),
				),
				Effect.andThen((items) => scrapeQueue.enqueueAll(items)),
			);

			const pipeline = Effect.fn("pipeline")(function* () {
				const entry = yield* scrapeQueue.next;

				const fetchedPage = yield* web.fetchPage(entry.url);
				const urls = yield* web.extractURLs(fetchedPage);
				const items = urls.map(
					(url) => new QueueEntry({ url, depth: entry.depth + 1 }),
				);

				yield* scrapeQueue.enqueueAll(items);
			});

			const shouldContinue = scrapeQueue.isEmpty.pipe(
				Effect.andThen((empty) => !empty),
			);

			const pipelineLoop = Effect.fn("pipelineLoop")(function* () {
				while (yield* shouldContinue) {
					yield* pipeline().pipe(
						// most these errors are only there for semantic purposes
						// in reality they're just ignored. we don't need to handle them,
						// and logging them only pollutes the output
						Effect.catchTag("ResponseError", (err) => Effect.logError(err)),
						Effect.catchAll((_) => Effect.succeedNone),
					);
				}
			});

			yield* Effect.forEach(
				Array.from({ length: concurrency }),
				(_, __) => pipelineLoop(),
				{
					concurrency,
				},
			);
		});
	},
).pipe(Command.withDescription("Crawls the internet and collects URLs"));

const cli = Command.run(linden, { name: "linden", version: "1.0.0" });

const AppLayer = ScrapeQueue.Default.pipe(
	Layer.provideMerge(Web.Default),
	Layer.provideMerge(BunContext.layer),
	Layer.provideMerge(FetchHttpClient.layer),
);

cli(process.argv).pipe(
	Effect.provide(AppLayer),
	Effect.catchAll(Effect.logError),

	BunRuntime.runMain,
);
