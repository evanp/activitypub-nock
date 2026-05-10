# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.4] - 2026-05-09

### Fixed

- Updated `undici` dependency to 6.23.0.

## [0.9.3] - 2026-05-09

### Added

- CHANGELOG.md to track changes.

### Changed

- Set npm as the package ecosystem for Dependabot.
- Expanded README.md to cover actual interface.

### Fixed

- Updated `activitystrea.ms` dependency to 3.3.3.

## [0.9.2] - 2026-04-04

### Fixed

- Include more details in `nockMessageSignature()`.

## [0.9.1] - 2026-04-04

### Fixed

- Correct `request-target` in `nockMessageSignature()`.

## [0.9.0] - 2026-04-04

### Added

- `nockMessageSignature()` packs more derived components.

## [0.8.1] - 2026-04-03

### Added

- `nockMessageSignature()` supports `@query`.

## [0.8.0] - 2026-04-03

### Added

- `nockMessageSignature()` for RFC 9421 HTTP message signatures.

## [0.7.0] - 2026-03-17

### Added

- `rateLimit` option for mocked endpoints.

## [0.6.0] - 2026-03-12

### Added

- `setBio()` and `getBio()` helpers.

## [0.5.0] - 2026-02-10

### Changed

- `nockSignature()` now takes an `algorithm` argument.

## [0.4.4] - 2026-01-26

### Fixed

- Mock collection used an undefined logger.

## [0.4.3] - 2026-01-26

### Added

- Flaky-server simulation.

## [0.4.2] - 2026-01-26

### Fixed

- `resetSharedInbox()` correctness.

## [0.4.1] - 2026-01-26

### Added

- Release workflow that runs on tag pushes.

## [0.4.0] - 2026-01-26

### Added

- `sharedInbox` support.

## [0.3.1] - 2026-01-26

### Fixed

- Request-body tracking on inbox posts.

## [0.3.0] - 2026-01-26

### Added

- Capture request body on inbox POST.

## [0.2.1] - 2026-01-23

### Changed

- Moved package into personal namespace.

## [0.2.0] - 2026-01-23

### Added

- Initial published release of the `activitypub-nock` package, extracted
  from `activitypub-bot`'s test helpers.
- Testable nock-based interface for ActivityPub HTTP fixtures.
- Microsyntax transformation, including a `botcontext` that uses it.
- HTTP signature mocking with key-rotation support and tolerance for
  `keyId` fragments and signature parameters.
- Followers, following, and shared-inbox delivery fixtures.
- Tools for testing paged remote collections; `ActivityPubClient.items()`
  iterator over ordered and paged collections.
- FEP-5711 (inverse properties) support for actor fixtures.
- Conversation tracking in replies.
- Pre-registration of the thread context for performance.

### Notes

- Project history before this tag was developed inside the
  `activitypub-bot` repository (commits from 2024-09 onward) and
  filtered into this repo on 2026-01-23 prior to publication.
