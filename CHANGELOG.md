# Changelog

## [0.7.1](https://github.com/djensen47/sabre-rest/compare/v0.7.0...v0.7.1) (2026-04-08)


### Bug Fixes

* make bargain-finder-max actually work end-to-end ([#31](https://github.com/djensen47/sabre-rest/issues/31)) ([8e7ea67](https://github.com/djensen47/sabre-rest/commit/8e7ea67ff61ca827083f18ba93929153bbd71594))

## [0.7.0](https://github.com/djensen47/sabre-rest/compare/v0.6.2...v0.7.0) (2026-04-08)


### Features

* add sabre-rest cli for testing the library against real servers ([#29](https://github.com/djensen47/sabre-rest/issues/29)) ([cbe3360](https://github.com/djensen47/sabre-rest/commit/cbe336024d5f91c868291b4d7a88ab6722b23b81))

## [0.6.2](https://github.com/djensen47/sabre-rest/compare/v0.6.1...v0.6.2) (2026-04-08)


### Bug Fixes

* make bargain-finder-max pointOfSale.companyCode optional ([#27](https://github.com/djensen47/sabre-rest/issues/27)) ([f3aaadb](https://github.com/djensen47/sabre-rest/commit/f3aaadbc1b18570dd1c524906e5d72d3bb0ab69b))

## [0.6.1](https://github.com/djensen47/sabre-rest/compare/v0.6.0...v0.6.1) (2026-04-08)


### Bug Fixes

* correct sabre v2 oauth encoding and surface error body ([#25](https://github.com/djensen47/sabre-rest/issues/25)) ([c30332b](https://github.com/djensen47/sabre-rest/commit/c30332b30a27f3c4212c57981eb47511a805d83f))

## [0.6.0](https://github.com/djensen47/sabre-rest/compare/v0.5.0...v0.6.0) (2026-04-08)


### Features

* add Bargain Finder Max v5 service ([#23](https://github.com/djensen47/sabre-rest/issues/23)) ([4247e85](https://github.com/djensen47/sabre-rest/commit/4247e8503cf58fe180a0179ebf1848b62ba761d5))

## [0.5.0](https://github.com/djensen47/sabre-rest/compare/v0.4.0...v0.5.0) (2026-04-08)


### ⚠ BREAKING CHANGES

* AirlineAlliance.memberAirlineCodes (string[]) is replaced with AirlineAlliance.members (AirlineAllianceMember[], each { code?: string }). A flat string[] cannot honestly represent a member object whose AirlineCode is optional.

### Bug Fixes

* stop dropping records in lookup service mappers ([#20](https://github.com/djensen47/sabre-rest/issues/20)) ([0971e1b](https://github.com/djensen47/sabre-rest/commit/0971e1bbcc27db211492e1e174ce94a0390cc419))

## [0.4.0](https://github.com/djensen47/sabre-rest/compare/v0.3.0...v0.4.0) (2026-04-08)


### Features

* add Airline Alliance Lookup v1 service ([#17](https://github.com/djensen47/sabre-rest/issues/17)) ([c3e923b](https://github.com/djensen47/sabre-rest/commit/c3e923b01eaf826bc1fa42b8dd36fac6e8584b31))

## [0.3.0](https://github.com/djensen47/sabre-rest/compare/v0.2.0...v0.3.0) (2026-04-08)


### Features

* add Airline Lookup v1 service ([#15](https://github.com/djensen47/sabre-rest/issues/15)) ([fde12f7](https://github.com/djensen47/sabre-rest/commit/fde12f71c51aa71f9148257276680d4672ff8441))

## [0.2.0](https://github.com/djensen47/sabre-rest/compare/v0.1.4...v0.2.0) (2026-04-08)


### Features

* implement client foundation (errors, http, auth, middleware, client) ([#13](https://github.com/djensen47/sabre-rest/issues/13)) ([85417cb](https://github.com/djensen47/sabre-rest/commit/85417cb12d40340ce453d5265a9a574ce01ed893))

## [0.1.4](https://github.com/djensen47/sabre-rest/compare/v0.1.3...v0.1.4) (2026-04-08)


### Bug Fixes

* bump node to 22+ for npm trusted publishing ([#11](https://github.com/djensen47/sabre-rest/issues/11)) ([48cb4e0](https://github.com/djensen47/sabre-rest/commit/48cb4e0a41eaf415211c399f594f40ad42950e51))

## [0.1.3](https://github.com/djensen47/sabre-rest/compare/v0.1.2...v0.1.3) (2026-04-08)


### Miscellaneous Chores

* release as 0.1.3 to test end-to-end publish automation ([#9](https://github.com/djensen47/sabre-rest/issues/9)) ([e045bb1](https://github.com/djensen47/sabre-rest/commit/e045bb1028236361cc81ac979dbfc7c160aebd47))

## [0.1.2](https://github.com/djensen47/sabre-rest/compare/v0.1.1...v0.1.2) (2026-04-08)


### Bug Fixes

* publish from the release-please workflow itself ([#8](https://github.com/djensen47/sabre-rest/issues/8)) ([8af7539](https://github.com/djensen47/sabre-rest/commit/8af7539ae37c5b5536ef6851a830c91a01f4ad25))
* stop biome from reformatting package.json ([#5](https://github.com/djensen47/sabre-rest/issues/5)) ([bb7d229](https://github.com/djensen47/sabre-rest/commit/bb7d229840b4b11c3ed52d794bb3d31224838a62))

## [0.1.1](https://github.com/djensen47/sabre-rest/compare/v0.1.0...v0.1.1) (2026-04-08)


### Miscellaneous Chores

* release as 0.1.1 ([#4](https://github.com/djensen47/sabre-rest/issues/4)) ([7edfbeb](https://github.com/djensen47/sabre-rest/commit/7edfbeb03be1ba5c92da626587114f49e5bae52a))

## Changelog
