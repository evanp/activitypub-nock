# activitypub-nock

> A [nock](https://github.com/nock/nock)-based mock library for testing
> ActivityPub clients and servers.

`activitypub-nock` installs a persistent set of HTTP interceptors that
emulate a remote ActivityPub server: actors, objects, collections,
WebFinger, inboxes, shared inboxes, HTTP signatures (Cavage and
RFC 9421), keys, and more. It lets unit tests drive code paths that
would otherwise need a real federated peer.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
  - [Setup](#setup)
  - [Mock URL helpers](#mock-url-helpers)
  - [Actors and objects](#actors-and-objects)
  - [Keys and signatures](#keys-and-signatures)
  - [Bios](#bios)
  - [Followers, following, collections](#followers-following-collections)
  - [Captured requests](#captured-requests)
  - [Inbox counters](#inbox-counters)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Install

```sh
npm install --save-dev @evanp/activitypub-nock
```

Requires Node.js with ES modules support (the package is shipped as
`"type": "module"`). `nock` and `activitystrea.ms` are runtime
dependencies and will be installed transitively.

## Usage

```js
import { nockSetup, addFollower, setBio } from '@evanp/activitypub-nock'

// Install interceptors for a fake federated peer.
nockSetup('remote.example')

// Configure fixture data before tests run.
setBio('alice', 'Hello from the test suite', 'remote.example')
addFollower('alice', 'https://other.example/user/bob', 'remote.example')

// Now any code under test that fetches from https://remote.example/...
// receives plausible ActivityPub responses.
const res = await fetch('https://remote.example/user/alice')
const actor = await res.json()
// actor.type === 'Person', actor.summary === 'Hello from the test suite'
```

`nockSetup` registers persistent handlers for these paths under the
given domain:

- `GET /.well-known/webfinger?resource=acct:<user>@<domain>`
- `GET /user/:username` — actor document
- `GET /user/:username/publickey` — actor's public key
- `GET /user/:username/followers` — `OrderedCollection`
- `GET /user/:username/following` — `OrderedCollection`
- `GET /user/:username/collection/:num` — non-paged `Collection`
- `GET /user/:username/orderedcollection/:num` — non-paged `OrderedCollection`
- `GET /user/:username/pagedcollection/:num` (and `/page/:n`) — paged `Collection`
- `GET /user/:username/pagedorderedcollection/:num` (and `/page/:n`) —
  paged `OrderedCollection`
- `GET /user/:username/:type/:num` — generic object (Note, Create, …)
- `GET /user/:username/:type/:num/:obj` — transitive activity referring
  to a remote `object`
- `POST /user/:username/inbox` — counted, body captured
- `POST /shared/inbox` — counted, body captured (when enabled)
- `GET /user/:username/inbox` — returns 403

## API

All exports are named exports from `@evanp/activitypub-nock`.

### Setup

#### `nockSetup(domain, options?)`

Install persistent interceptors for `https://<domain>`. Call once per
test domain, ideally in a `before()` hook.

`options`:

- `sharedInbox` (boolean) — advertise `endpoints.sharedInbox` on actors
  and accept `POST /shared/inbox`. Without this, the shared-inbox
  endpoint returns 404.
- `flaky` (boolean) — the *first* `POST` to a user inbox returns
  `503 Service Unavailable`; subsequent posts succeed. Use to exercise
  retry logic.
- `rateLimit` (boolean) — include `X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on
  responses, with a remaining counter that decrements per request.
- `logger` (object with `.debug(msg)`) — verbose tracing of the
  paged-collection handler. Optional.

### Mock URL helpers

#### `nockFormat({ username, type, num, obj, key, collection, page, domain? })`

Build the canonical URL for a fixture. Examples:

```js
nockFormat({ username: 'alice' })
// → 'https://social.example/user/alice'

nockFormat({ username: 'alice', key: true })
// → 'https://social.example/user/alice/publickey'

nockFormat({ username: 'alice', type: 'Note', num: 1 })
// → 'https://social.example/user/alice/note/1'

nockFormat({ username: 'alice', type: 'Note', num: 1, obj: 'replies' })
// → 'https://social.example/user/alice/note/1/replies'

nockFormat({ username: 'alice', collection: 'followers' })
// → 'https://social.example/user/alice/followers'
```

When `domain` is omitted, the default `social.example` is used.

### Actors and objects

#### `makeActor(username, domain?, options?) → Promise<as2.Object>`

Build a `Person` actor as an `activitystrea.ms` object. `options.sharedInbox`
adds the `endpoints.sharedInbox` URL. The actor includes `inbox`,
`outbox`, `followers`, `following`, `liked`, `publicKey`, and a `url`
link to a fake HTML profile.

#### `makeObject(username, type, num, domain?, extra?) → Promise<as2.Object>`

Build either an activity (`Create`, `Update`, `Delete`, `Add`, `Remove`,
`Follow`, `Accept`, `Reject`, `Like`, `Block`, `Flag`, `Undo`) or a
non-activity object. Non-activity objects get `attributedTo`,
`replies`, `shares`, `likes`, `thread`, `context`, and
`ostatus:conversation` URLs wired up. Activities get `actor`. Merge
additional properties via `extra`.

#### `makeTransitive(username, type, num, obj, domain?) → Promise<as2.Object>`

Build a transitive activity (one with an `object`). `obj` may be an
`https://…` URL (used as-is) or a path that will be appended under the
activity's URL.

### Keys and signatures

#### `getPair(username, domain?) → Promise<{ publicKey, privateKey }>`

#### `getPublicKey(username, domain?) → Promise<string>`

#### `getPrivateKey(username, domain?) → Promise<string>`

Lazily generate (and memoize) a 2048-bit RSA keypair for a user. Keys
are returned as PEM strings.

#### `nockKeyRotate(username, domain?) → Promise<void>`

Replace the user's keypair with a freshly generated one. Useful for
testing how clients handle key rotation: cached keys should fail to
verify against signatures made by the new key until the client
re-fetches.

#### `nockSignature({ method?, url, date, digest?, username, domain?, algorithm? }) → Promise<string>`

Generate a Cavage HTTP-signature (`Signature` header value) over
`(request-target)`, `host`, `date`, and optionally `digest`. The
`keyId` is the user's `/publickey` URL. Defaults: `method='GET'`,
`algorithm='rsa-sha256'`.

#### `nockSignatureFragment({ method?, url, date, digest?, username, domain? }) → Promise<string>`

Same as `nockSignature`, but emits a `keyId` of the form
`<actor-url>#main-key` (the convention used by Mastodon and
compatibles).

#### `nockMessageSignature({ method?, url, contentDigest?, username, domain?, keyId? }) → Promise<{ 'signature-input', signature }>`

Generate an RFC 9421 HTTP Message Signature. The returned object has
the two header values: `signature-input` (the `sig1=…` covered-component
spec) and `signature` (the `sig1=:base64:` signature). Components
covered include `@method`, `@authority`, `@path`, `@target-uri`,
`@scheme`, `@request-target`, `@query` and per-name `@query-param`
when the URL has a query string, and `content-digest` when supplied.

### Bios

#### `setBio(username, bio, domain?)`

#### `getBio(username, domain?) → string | undefined`

Set or read the `summary` returned for a mocked actor.

### Followers, following, collections

#### `addFollower(username, id, domain?)`

#### `addFollowing(username, id, domain?)`

Append an actor URL to the user's followers or following collection.
Items are unshifted (most recent first).

#### `addToCollection(username, collection, item, domain?)`

Append an item to a numbered user collection. `collection` is a number
matching one of:

- `/user/:username/collection/<n>`
- `/user/:username/orderedcollection/<n>`
- `/user/:username/pagedcollection/<n>` (paged with 20 items per page)
- `/user/:username/pagedorderedcollection/<n>` (paged with 20 items
  per page)

The same backing store is shared across all four endpoints for a given
`(username, n)` pair, so you can add items once and fetch them in
either paged or non-paged form.

### Captured requests

#### `getBody(uri) → string | undefined`

#### `resetBodies()`

Retrieve the raw request body of the last `POST` to `uri` (an absolute
URL), or clear all captured bodies. Bodies are captured for inbox and
shared-inbox posts.

#### `getRequestHeaders(uri) → object | undefined`

#### `resetRequestHeaders()`

Retrieve the headers of the last request to `uri`, or clear all
captured headers. Headers are captured for every intercepted route.

### Inbox counters

#### `postInbox` (object)

A plain object whose keys are usernames and values are the number of
successful `POST`s to that user's inbox during the current test.

#### `postSharedInbox` (object)

A plain object whose keys are domains and values are the number of
successful `POST`s to that domain's shared inbox.

#### `resetInbox()`

#### `resetSharedInbox()`

Reset the corresponding counters to zero. Call between test cases that
share a process.

## Maintainers

[@evanp](https://github.com/evanp)

## Contributing

Issues and PRs welcome at
[evanp/activitypub-nock](https://github.com/evanp/activitypub-nock).

Run the test suite with:

```sh
npm test
```

(uses Node's built-in test runner: `node --test`).

## License

GPL-3.0 © Evan Prodromou. See [LICENSE](LICENSE).
