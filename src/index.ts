import { Args, Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";

const url = Args.text({
	name: "url",
});

const depth = Options.integer("depth").pipe(
	Options.withAlias("d"),
	Options.withDefault(3),
);

const linden = Command.make("linden", { url, depth }, ({ url, depth }) => {
	return Effect.succeedNone;
});

const cli = Command.run(linden, { name: "linden", version: "0.0.1" });

cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
