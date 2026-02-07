import { Args, Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
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
		const resp = yield* web.fetchPage(url);

		yield* Effect.log(resp);

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
