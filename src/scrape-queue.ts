import { Data, Effect, MutableHashSet, Queue } from "effect";
import { Web } from "./web";

export class QueueEntry extends Data.TaggedClass("QueueEntry")<{
	url: URL;
	depth: number;
}> {}

export class AlreadyEnqueuedError extends Data.TaggedError(
	"AlreadyEnqueuedError",
)<{ entry: QueueEntry }> {}

export class AlreadyVisitedError extends Data.TaggedError(
	"AlreadyVisitedError",
)<{ url: URL }> {}

export class MaxDepthError extends Data.TaggedError("MaxDepthError")<{
	entry: QueueEntry;
}> {}

export class EmptyQueueError extends Data.TaggedError("EmptyQueueError")<{}> {}

export class ScrapeQueue extends Effect.Service<ScrapeQueue>()(
	"linden/scrape-queue",
	{
		effect: Effect.gen(function* () {
			const web = yield* Web;

			const queue = yield* Queue.unbounded<QueueEntry>();
			const visited = MutableHashSet.make();

			const enqueue = Effect.fn("enqueue")(function* (
				entry: QueueEntry,

				// NOTE: this sucks. i should use Config or a config service.
				// but this is provided dynamically through CLI args, and I
				// don't know how to do that
				maxDepth: number,
			) {
				// ensure this doesn't go over the max depth
				if (entry.depth >= maxDepth) {
					return yield* new MaxDepthError({ entry });
				}

				// normalize URL and create new entry with the updated URL
				const url = yield* web.normalizeURL(entry.url);
				const newEntry = new QueueEntry({ ...entry, url });

				// just for debugging
				if (entry.url.href !== newEntry.url.href) {
					yield* Effect.logDebug(`${entry.url.href} -> ${newEntry.url.href}`);
				}

				// ensure it hasn't been visited before
				if (yield* hasVisited(newEntry.url)) {
					return yield* new AlreadyVisitedError({ url: newEntry.url });
				}

				// BUG: this fails only if the specific entry (which means, with this
				// specific depth) is in the queue. if this url is added to the queue
				// because it's discovered elsewhere, in a different depth, we will
				// visit it twice, since we only check if it's been visited here
				// (and if it's in the queue and hasn't already been visited, it's not
				// marked as visited)

				// try to offer
				// returns false if it's already in the queue
				if (!(yield* queue.offer(newEntry))) {
					return yield* new AlreadyEnqueuedError({ entry: newEntry });
				}
			});

			const enqueueAll = (entries: QueueEntry[], maxDepth: number) =>
				Effect.forEach(entries, (entry) =>
					enqueue(entry, maxDepth).pipe(Effect.ignore),
				);

			const next = Effect.gen(function* () {
				if (yield* isEmpty) {
					return yield* new EmptyQueueError();
				}

				// pop from the queue
				const entry = yield* queue.take;

				// TODO: maybe check if it's already been visited and recurse if so?

				if (yield* hasVisited(entry.url)) {
					yield* Effect.logWarning(`visited before: ${entry.url}`);
				}

				// mark as visited
				yield* markVisited(entry.url);

				return entry;
			});

			const hasVisited = (url: URL) =>
				Effect.succeed(MutableHashSet.has(visited, url));

			const markVisited = Effect.fn("markVisited")(function* (url: URL) {
				return yield* Effect.succeed(MutableHashSet.add(visited, url));
			});

			const isEmpty = queue.isEmpty;

			return {
				enqueue,
				enqueueAll,
				next,
				hasVisited,
				markVisited,
				isEmpty,
			} as const;
		}),
		dependencies: [Web.Default],
	},
) {}
