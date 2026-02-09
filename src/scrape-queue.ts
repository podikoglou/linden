import { Context, Data, Effect, Layer, MutableHashSet, Queue } from "effect";
import type { IllegalArgumentException } from "effect/Cause";
import { type URLProtocolValidationError, Web } from "./web";

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

export class ScrapeQueue extends Context.Tag("@linden/scrape-queue")<
	ScrapeQueue,
	{
		readonly enqueue: (
			entry: QueueEntry,
		) => Effect.Effect<
			void,
			| AlreadyEnqueuedError
			| AlreadyVisitedError
			| MaxDepthError
			| URLProtocolValidationError
			| IllegalArgumentException
		>;

		readonly enqueueAll: (
			entries: QueueEntry[],
		) => Effect.Effect<
			void,
			| AlreadyEnqueuedError
			| AlreadyVisitedError
			| MaxDepthError
			| URLProtocolValidationError
			| IllegalArgumentException
		>;

		readonly next: Effect.Effect<QueueEntry, EmptyQueueError>;

		readonly hasVisited: (url: URL) => Effect.Effect<boolean>;
		readonly markVisited: (url: URL) => Effect.Effect<void>;

		readonly isEmpty: Effect.Effect<boolean>;
	}
>() {
	static readonly layer = Layer.effect(
		ScrapeQueue,
		Effect.gen(function* () {
			const maxDepth = 3; // TODO: actually grab by configuration

			const queue = yield* Queue.unbounded<QueueEntry>();
			const visited = MutableHashSet.make();

			const enqueue = Effect.fn("enqueue")(function* (entry: QueueEntry) {
				// ensure this doesn't go over the max depth
				if (entry.depth >= maxDepth) {
					return yield* new MaxDepthError({ entry });
				}

				// TODO: normalize URL

				// ensure it hasn't been visited before
				// if (yield* hasVisited(entry.url)) {
				// 	return yield* new AlreadyVisitedError({ entry });
				// }

				// BUG: this fails only if the specific entry (which means, with this
				// specific depth) is in the queue. if this url is added to the queue
				// because it's discovered elsewhere, in a different depth, we will
				// visit it twice, since we only check if it's been visited here
				// (and if it's in the queue and hasn't already been visited, it's not
				// marked as visited)

				// try to offer
				// returns false if it's already in the queue
				if (!(yield* queue.offer(entry))) {
					return yield* new AlreadyEnqueuedError({ entry });
				}
			});

			const enqueueAll = (entries: QueueEntry[]) =>
				Effect.forEach(entries, (entry) => enqueue(entry));

			const next = Effect.gen(function* () {
				if (yield* isEmpty) {
					return yield* new EmptyQueueError();
				}

				// pop from the queue
				const entry = yield* queue.take;

				// TODO: maybe check if it's already been visited and recurse if so?

				// mark as visited
				yield* markVisited(entry.url);

				return entry;
			});

			const hasVisited = Effect.fn("hasVisited")(function* (url: URL) {
				return yield* Effect.succeed(MutableHashSet.has(visited, url));
			});

			const markVisited = Effect.fn("markVisited")(function* (url: URL) {
				return yield* Effect.succeed(MutableHashSet.add(visited, url));
			});

			const isEmpty = queue.isEmpty;

			return ScrapeQueue.of({
				enqueue,
				enqueueAll,
				next,
				hasVisited,
				markVisited,
				isEmpty,
			});
		}),
	);
}
