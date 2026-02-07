# linden

A little web crawler written in TypeScript using [Effect](https://effect.website/).

I built this because I wanted to learn how to use Effect. I think it might just
be the perfect project for it. You get to learn how to define and implement
services, do proper error handling, logging, and very importantly: concurrency.

That being said, I am not saying my code is perfect. I don't really like it,
actually.

## Getting

Using [Bun](https://bun.com):

```bash
git clone https://github.com/podikoglou/linden
cd linden
bun install
```

It can now be used using

```bash
bun src/index.ts <url>
```

## Usage

```
linden 1.0.0

USAGE

$ linden [(-d, --depth integer)] [(-c, --concurrency integer)] <url>

DESCRIPTION

Crawls the internet and collects URLs

ARGUMENTS

<url>

  A user-defined piece of text.

  URL to start crawling from

OPTIONS

(-d, --depth integer)

  An integer.

  The maximum depth to crawl

  This setting is optional.

(-c, --concurrency integer)

  An integer.

  The maximum number of concurrent requests

  This setting is optional.
```
