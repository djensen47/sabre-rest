# Changelog

## [0.20.1](https://github.com/djensen47/sabre-rest/compare/v0.20.0...v0.20.1) (2026-07-11)


### Bug Fixes

* correct malformed MediaRef in get-hotel-details-v5 ([#142](https://github.com/djensen47/sabre-rest/issues/142)) ([#143](https://github.com/djensen47/sabre-rest/issues/143)) ([baf611d](https://github.com/djensen47/sabre-rest/commit/baf611d85d22d381739360443f71400481c67b3a))
* enable hotel-e2e get-booking step, entitlement gap resolved ([#140](https://github.com/djensen47/sabre-rest/issues/140)) ([27ca259](https://github.com/djensen47/sabre-rest/commit/27ca2596657312fc008173e358988cfd3d91a16f))
* map remaining get-hotel-details-v5 response fields ([#137](https://github.com/djensen47/sabre-rest/issues/137)) ([95b0aa9](https://github.com/djensen47/sabre-rest/commit/95b0aa98334b2d0cda161cef5cbde86866af6556))

## [0.20.0](https://github.com/djensen47/sabre-rest/compare/v0.19.0...v0.20.0) (2026-07-06)


### Features

* add get-hotel-content v4 service ([#134](https://github.com/djensen47/sabre-rest/issues/134)) ([1a5c38f](https://github.com/djensen47/sabre-rest/commit/1a5c38f4c99ddbd778bd591427290e0c26d0609f))


### Bug Fixes

* improve flight exchange e2e test reliability and coverage ([#129](https://github.com/djensen47/sabre-rest/issues/129)) ([07e8513](https://github.com/djensen47/sabre-rest/commit/07e851392d34e3ca74e3a6dbd258d3e7c925f9c2))
* statusline shows wrong context % for models without [1m] id suffix ([#133](https://github.com/djensen47/sabre-rest/issues/133)) ([e37f81e](https://github.com/djensen47/sabre-rest/commit/e37f81e053104c74803786c1532e154aaef80098))

## [0.19.0](https://github.com/djensen47/sabre-rest/compare/v0.18.0...v0.19.0) (2026-06-29)


### Features

* add geo-search v4 and geo-autocomplete v2 services ([#126](https://github.com/djensen47/sabre-rest/issues/126)) ([bd0a803](https://github.com/djensen47/sabre-rest/commit/bd0a8035e21dbfc2fc05e999f38a745b4e366b14)), closes [#125](https://github.com/djensen47/sabre-rest/issues/125)

## [0.18.0](https://github.com/djensen47/sabre-rest/compare/v0.17.0...v0.18.0) (2026-06-23)


### Features

* **bfm,revalidate:** expose seatsAvailable per fare-component segment ([#106](https://github.com/djensen47/sabre-rest/issues/106)) ([4a1877e](https://github.com/djensen47/sabre-rest/commit/4a1877e9fb07a9998b010a5fd576a5e1310b8c15))
* **bfm:** expand response data with penalties, ancillary fees, per-leg fares, equipment ([#120](https://github.com/djensen47/sabre-rest/issues/120)) ([4e33912](https://github.com/djensen47/sabre-rest/commit/4e33912c4631d97b1f317c2f9c6242014107562b)), closes [#113](https://github.com/djensen47/sabre-rest/issues/113)
* **flight-reshop-v1:** expand response data (offer attributes, EMDs, branded fares) ([#118](https://github.com/djensen47/sabre-rest/issues/118)) ([3d96665](https://github.com/djensen47/sabre-rest/commit/3d966657c5737d878f0f40c0b097425666c872e5)), closes [#114](https://github.com/djensen47/sabre-rest/issues/114)
* **revalidate:** expand response data (penalties, reissue, amenities, per-leg taxes, fare-component detail) ([#121](https://github.com/djensen47/sabre-rest/issues/121)) ([b22ba7d](https://github.com/djensen47/sabre-rest/commit/b22ba7d467c156492db0f9d1221973535f793f49))


### Bug Fixes

* **exchange-booking-v1:** drop NN from default HaltOnStatus; smoke-test tweaks ([#108](https://github.com/djensen47/sabre-rest/issues/108)) ([2ea22c8](https://github.com/djensen47/sabre-rest/commit/2ea22c8d2c3682caf7832f95765c6ba18201525f))

## [0.17.0](https://github.com/djensen47/sabre-rest/compare/v0.16.0...v0.17.0) (2026-06-13)


### Features

* **flight-reshop-v1:** expose journeys[].retainFlights (selective per-segment exchange) ([#103](https://github.com/djensen47/sabre-rest/issues/103)) ([e3ec1b9](https://github.com/djensen47/sabre-rest/commit/e3ec1b95e4e341409f4e42c9f8b93230911d7885))

## [0.16.0](https://github.com/djensen47/sabre-rest/compare/v0.15.0...v0.16.0) (2026-06-12)


### ⚠ BREAKING CHANGES

* **exchange-booking-v1:** default new-segment sell to documented NN; full reissue verified end-to-end ([#102](https://github.com/djensen47/sabre-rest/issues/102))

### Features

* **exchange-booking-v1:** default new-segment sell to documented NN; full reissue verified end-to-end ([#102](https://github.com/djensen47/sabre-rest/issues/102)) ([51cfe19](https://github.com/djensen47/sabre-rest/commit/51cfe19a2bc19018de3704906eb4b1d5db9d6f62))
* full exchange e2e smoke test (commit + fulfill probe) ([#99](https://github.com/djensen47/sabre-rest/issues/99)) ([ccdf187](https://github.com/djensen47/sabre-rest/commit/ccdf1878b40a917231a03daec72c49391a45b1d2))

## [0.15.0](https://github.com/djensen47/sabre-rest/compare/v0.14.0...v0.15.0) (2026-06-09)


### ⚠ BREAKING CHANGES

* **booking-management-v1:** Typed callers of `BookPricingDetails`, `BookPriceComparison`, and `BookTourCodeOverrides` must update.

### Features

* **exchange-booking-v1:** add Exchange Booking REST service + CLI command + smoke script ([#94](https://github.com/djensen47/sabre-rest/issues/94)) ([484b025](https://github.com/djensen47/sabre-rest/commit/484b025f92bc3644a1225608ac55e6c371e9164b))
* **flight-reshop-v1:** add Flight Reshop REST service + CLI + exchange-flow guide ([#97](https://github.com/djensen47/sabre-rest/issues/97)) ([8f4a66c](https://github.com/djensen47/sabre-rest/commit/8f4a66cb795b2ecdd492ef4ed347e7fb9d433eb4))
* **smoke:** bundled cancelBooking void/refund script + default designatePrinters (AT) for CERT ticketing ([#95](https://github.com/djensen47/sabre-rest/issues/95)) ([90407ac](https://github.com/djensen47/sabre-rest/commit/90407accfe2b4d126763a57eba42bb14b9932ef3))
* **smoke:** post-issue check-tickets for CAT31/CAT33 eligibility + AA carrier flag ([#96](https://github.com/djensen47/sabre-rest/issues/96)) ([16b5e97](https://github.com/djensen47/sabre-rest/commit/16b5e97229a49da2d067ee1e2bda46715c27ffa9))
* **smoke:** random traveler helper + align fulfillTickets with Sabre example ([#88](https://github.com/djensen47/sabre-rest/issues/88)) ([7f9eb2d](https://github.com/djensen47/sabre-rest/commit/7f9eb2d797140b5a35d1920e448335f70535f09f))


### Bug Fixes

* **booking-management-v1:** stabilize air booking flow end-to-end (NN, FOP, SFPD, AVS bypass) + correct flightPricing types ([#91](https://github.com/djensen47/sabre-rest/issues/91)) ([49745e8](https://github.com/djensen47/sabre-rest/commit/49745e8b96b8974866fce41cbdb8cf298293fe86))
* **errors:** preserve body on SabreAuthenticationError + document Swagger 2.0 conversion ([#93](https://github.com/djensen47/sabre-rest/issues/93)) ([9eef23d](https://github.com/djensen47/sabre-rest/commit/9eef23d6e4a3a0bd29594f37e2c652742a19d4ab))
* **exchange-booking-v1:** sell new segments as GK, drop NN from default halt ([#98](https://github.com/djensen47/sabre-rest/issues/98)) ([5e8a337](https://github.com/djensen47/sabre-rest/commit/5e8a337743cf0c8516ba38baad64783999025cb2))
* **hotel-smoke:** use US billing address for CC ([#90](https://github.com/djensen47/sabre-rest/issues/90)) ([9e33062](https://github.com/djensen47/sabre-rest/commit/9e3306205e92c1d8f8132eb61965d9aaa6466c86))

## [0.14.0](https://github.com/djensen47/sabre-rest/compare/v0.13.0...v0.14.0) (2026-05-06)


### Features

* **create-passenger-name-record-v25:** add Sabre hotel booking service, CLI, and e2e smoke step ([#86](https://github.com/djensen47/sabre-rest/issues/86)) ([c253060](https://github.com/djensen47/sabre-rest/commit/c2530605a4189a279b30510cdbf250dd957679a9))
* **get-hotel-avail-v5:** add Sabre Get Hotel Avail v5 service, CLI, and end-to-end smoke ([#80](https://github.com/djensen47/sabre-rest/issues/80)) ([47d7e28](https://github.com/djensen47/sabre-rest/commit/47d7e28ea82706ce2ea23fc5097534d9ac4abf17))
* **get-hotel-details-v5:** add Sabre Get Hotel Details v5 service, CLI, and smoke step ([#84](https://github.com/djensen47/sabre-rest/issues/84)) ([ba33508](https://github.com/djensen47/sabre-rest/commit/ba335087a605338e34bee22d60c98abebf91794b))
* **get-hotel-rate-info-v5:** add Sabre Get Hotel Rate Info v5 service, CLI, and smoke-test wiring ([#82](https://github.com/djensen47/sabre-rest/issues/82)) ([02ddcec](https://github.com/djensen47/sabre-rest/commit/02ddcec31a728dd314ff87d6d8e02689e26fe490))
* **hotel-price-check-v5:** add Sabre Hotel Price Check v5 service, CLI, and smoke-test skeleton ([#79](https://github.com/djensen47/sabre-rest/issues/79)) ([cd979e5](https://github.com/djensen47/sabre-rest/commit/cd979e532e536014d3d247c92bdb7d9d2ea73d84))
* **hotel-search-v2:** add Sabre Hotel Search v2 service and CLI command ([#77](https://github.com/djensen47/sabre-rest/issues/77)) ([203a56d](https://github.com/djensen47/sabre-rest/commit/203a56dc965e62f466d82a842b74a418100dedc8))


### Bug Fixes

* **get-hotel-rate-info-v5:** send schema version and forward SABRE_PCC in smoke test ([#83](https://github.com/djensen47/sabre-rest/issues/83)) ([c5253b9](https://github.com/djensen47/sabre-rest/commit/c5253b93c560d7c4e7f84be33915289fc28ae432))

## [0.13.0](https://github.com/djensen47/sabre-rest/compare/v0.12.0...v0.13.0) (2026-04-26)


### ⚠ BREAKING CHANGES

* **booking-management-v1:** the exported type `CancelDocumentsType` is renamed to `DocumentsType`. Consumers importing it from `sabre-rest` must update the import. The underlying string-literal union is unchanged.

### Features

* add booking-management-v1 checkTickets operation ([#62](https://github.com/djensen47/sabre-rest/issues/62)) ([aed68a8](https://github.com/djensen47/sabre-rest/commit/aed68a8e5920d1da2c7424177d2f8b7f614a7a4f))
* add booking-management-v1 fulfillTickets operation ([#58](https://github.com/djensen47/sabre-rest/issues/58)) ([2530680](https://github.com/djensen47/sabre-rest/commit/253068082580e729121dd712617fa0d41c429983))
* add booking-management-v1 refundTickets operation ([#63](https://github.com/djensen47/sabre-rest/issues/63)) ([363d7c5](https://github.com/djensen47/sabre-rest/commit/363d7c5f3619279aedab9034de43b74dc1feedc4))
* add booking-management-v1 voidTickets operation ([#61](https://github.com/djensen47/sabre-rest/issues/61)) ([fca94d5](https://github.com/djensen47/sabre-rest/commit/fca94d524a986115f0e60e80d7bff3b3a5a5d9c1))
* **cli:** add ticketing commands check/fulfill/void/refund ([#74](https://github.com/djensen47/sabre-rest/issues/74)) ([4ff999e](https://github.com/djensen47/sabre-rest/commit/4ff999eba988a1bf4321a453b1ac802ebbe1d1b6))


### Bug Fixes

* **booking-management-v1:** correct MonetaryValue, HotelPenaltyValue, FareDifferenceBreakdown drift ([#60](https://github.com/djensen47/sabre-rest/issues/60)) ([44bb010](https://github.com/djensen47/sabre-rest/commit/44bb01085b962d1b7cf4b0503ce60125272ded81))


### Code Refactoring

* **booking-management-v1:** rename CancelDocumentsType to DocumentsType ([#64](https://github.com/djensen47/sabre-rest/issues/64)) ([5ecaea6](https://github.com/djensen47/sabre-rest/commit/5ecaea6a626200f01e236ba3f270a09e64aec6ef))

## [0.12.0](https://github.com/djensen47/sabre-rest/compare/v0.11.0...v0.12.0) (2026-04-22)


### Features

* add assertBookingSucceeded opt-in helper ([#54](https://github.com/djensen47/sabre-rest/issues/54)) ([b37c3aa](https://github.com/djensen47/sabre-rest/commit/b37c3aa7b180b95278770f0b9e5da7e434f54adb))
* add booking-management-v1 cancelBooking operation ([#49](https://github.com/djensen47/sabre-rest/issues/49)) ([0a9b98a](https://github.com/djensen47/sabre-rest/commit/0a9b98af014f49c8adf4caa3631e873879ab7dd8))
* add booking-management-v1 getBooking operation ([#46](https://github.com/djensen47/sabre-rest/issues/46)) ([7eb00c4](https://github.com/djensen47/sabre-rest/commit/7eb00c45925228b015ec075004e868d5e74c7631))
* add booking-management-v1 modifyBooking operation ([#48](https://github.com/djensen47/sabre-rest/issues/48)) ([a5281ca](https://github.com/djensen47/sabre-rest/commit/a5281cab5214fe78caf8f1ad0336886ce92c4979))
* **cli:** add get-booking, modify-booking, cancel-booking commands ([#51](https://github.com/djensen47/sabre-rest/issues/51)) ([b110b82](https://github.com/djensen47/sabre-rest/commit/b110b827930de12081563f4be2103d2e91be35b2))

## [0.11.0](https://github.com/djensen47/sabre-rest/compare/v0.10.0...v0.11.0) (2026-04-19)


### Features

* add booking-management-v1 createBooking service ([#44](https://github.com/djensen47/sabre-rest/issues/44)) ([ee8292b](https://github.com/djensen47/sabre-rest/commit/ee8292b69dde1e5319fe1e671937b8307b08fa21))

## [0.10.0](https://github.com/djensen47/sabre-rest/compare/v0.9.0...v0.10.0) (2026-04-16)


### Features

* add get-ancillaries-v2 service ([#42](https://github.com/djensen47/sabre-rest/issues/42)) ([2d0863e](https://github.com/djensen47/sabre-rest/commit/2d0863ec6f5cb7101478bb8313cd4905a264cc6f))
* add get-seats-v2 service ([#43](https://github.com/djensen47/sabre-rest/issues/43)) ([6de623a](https://github.com/djensen47/sabre-rest/commit/6de623a8fcdff1324ca15c0346b8f5fe983e8d47))
* add revalidate-itinerary-v5 service ([#41](https://github.com/djensen47/sabre-rest/issues/41)) ([4f4efbd](https://github.com/djensen47/sabre-rest/commit/4f4efbd8c3ce70bcd0f71cfdf67e5097bd590dde))
* **bfm:** surface baggage charges on priced itineraries ([#38](https://github.com/djensen47/sabre-rest/issues/38)) ([4e1fa6b](https://github.com/djensen47/sabre-rest/commit/4e1fa6bdc65f61594c6a7a02d17e901af2e9d377))
* **bfm:** surface per-passenger tax breakdown on priced itineraries ([#40](https://github.com/djensen47/sabre-rest/issues/40)) ([419f9ed](https://github.com/djensen47/sabre-rest/commit/419f9ed0cc8b9d7871aa5275f33142f6f4f541c8))

## [0.9.0](https://github.com/djensen47/sabre-rest/compare/v0.8.0...v0.9.0) (2026-04-10)


### Features

* **cli:** add --debug-request flag to print outbound HTTP request ([#36](https://github.com/djensen47/sabre-rest/issues/36)) ([85cfb68](https://github.com/djensen47/sabre-rest/commit/85cfb688b41889f27a3920ca0c880f5b66b17d05))

## [0.8.0](https://github.com/djensen47/sabre-rest/compare/v0.7.1...v0.8.0) (2026-04-10)


### Features

* add multi-airport city lookup v1 service ([#34](https://github.com/djensen47/sabre-rest/issues/34)) ([68b1e8a](https://github.com/djensen47/sabre-rest/commit/68b1e8a041daa24c4b350a44c7dc83e1da058103))
* **bfm:** surface fare offers and baggage allowances on priced itineraries ([#33](https://github.com/djensen47/sabre-rest/issues/33)) ([6268dda](https://github.com/djensen47/sabre-rest/commit/6268dda4bee251ceaf001407cd5760df8f6ce682))

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
