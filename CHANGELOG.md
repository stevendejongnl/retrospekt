## [1.14.2](https://github.com/stevendejongnl/retrospekt/compare/v1.14.1...v1.14.2) (2026-02-27)

### Bug Fixes

* **ui:** fix mobile header overflow, dark-mode icon color, and CS brand light-only mode ([837e1b1](https://github.com/stevendejongnl/retrospekt/commit/837e1b14965c509cc27a9790da19534449488d7c))

## [1.14.1](https://github.com/stevendejongnl/retrospekt/compare/v1.14.0...v1.14.1) (2026-02-27)

### Bug Fixes

* **mobile:** make toggle buttons clickable and fix column width on mobile ([6455900](https://github.com/stevendejongnl/retrospekt/commit/645590060057bce35ed2329f02ae0cec9b9418cf))

## [1.14.0](https://github.com/stevendejongnl/retrospekt/compare/v1.13.0...v1.14.0) (2026-02-27)

### Features

* **session-page:** show CloudSuite logo in header when brand=cs ([2ec9364](https://github.com/stevendejongnl/retrospekt/commit/2ec936456970b50c5fa87047d086f13fc37b4da5))

## [1.13.0](https://github.com/stevendejongnl/retrospekt/compare/v1.12.0...v1.13.0) (2026-02-27)

### Features

* **theme:** add URL-based CS brand theme (?theme=cs) ([b200796](https://github.com/stevendejongnl/retrospekt/commit/b2007968e97f05f3243f986db8d623afbe16b74b))

### Documentation

* add preview screenshots and clean up docs ([94ef756](https://github.com/stevendejongnl/retrospekt/commit/94ef7561fce3548f0174460f076389ff41a1a6bc))

## [1.12.0](https://github.com/stevendejongnl/retrospekt/compare/v1.11.0...v1.12.0) (2026-02-25)

### Features

* **ux:** redirect to home with banner on invalid session, improve 404 page ([b1dfc98](https://github.com/stevendejongnl/retrospekt/commit/b1dfc98d8a5fd671e4249b4d86d3c9ebba669b58))

## [1.11.0](https://github.com/stevendejongnl/retrospekt/compare/v1.10.2...v1.11.0) (2026-02-24)

### Features

* **reactions:** make emoji reactions opt-in at session creation ([38fc8fe](https://github.com/stevendejongnl/retrospekt/commit/38fc8fe349ab6d36fa4c0b613fbfa7d9bf8c5009))
* **timer:** add completion ding sound with mute toggle ([3265f4b](https://github.com/stevendejongnl/retrospekt/commit/3265f4bf7a93678b3e16f65f31f3af9b3c1325c8))

### Documentation

* **conventions:** document TDD red/green/refactor workflow ([a74ec32](https://github.com/stevendejongnl/retrospekt/commit/a74ec3225a56db3e6128f7d34196b9cdf149104a))

## [1.10.2](https://github.com/stevendejongnl/retrospekt/compare/v1.10.1...v1.10.2) (2026-02-24)

### Bug Fixes

* **frontend:** run envsubst on nginx template in custom entrypoint ([0b79824](https://github.com/stevendejongnl/retrospekt/commit/0b79824c78d292ff58c9debacdbe36bfa6cd2517))

## [1.10.1](https://github.com/stevendejongnl/retrospekt/compare/v1.10.0...v1.10.1) (2026-02-24)

### Bug Fixes

* **config:** replace deprecated class-based Config with SettingsConfigDict ([6b282de](https://github.com/stevendejongnl/retrospekt/commit/6b282ded02c017462f71d76aced92e3813effed3))

### Documentation

* **readme:** add GitHub release badge ([03ca435](https://github.com/stevendejongnl/retrospekt/commit/03ca435d2cbcb1ea2439c3cf17219f2a13e57de8))
* **readme:** fix CI badge to use release workflow ([13235d9](https://github.com/stevendejongnl/retrospekt/commit/13235d9584f7af862ed52046ce933c97bf053b41))
* **readme:** revalidate and add codecov badge ([44de8e5](https://github.com/stevendejongnl/retrospekt/commit/44de8e51fc0be7308dc71bf71444e339cf57dd7b))

## [1.10.0](https://github.com/stevendejongnl/retrospekt/compare/v1.9.0...v1.10.0) (2026-02-24)

### Features

* **session:** add emoji reactions, action items, timer, emoji picker, and export ([3e1130b](https://github.com/stevendejongnl/retrospekt/commit/3e1130b2ac4ebf3350e95dddefebf24032dd23a4))
* **ui:** replace emoji with FA icons and add favicon ([099bd7a](https://github.com/stevendejongnl/retrospekt/commit/099bd7a816ffb63ab319d4f531a97a663b310797))

## [1.9.0](https://github.com/stevendejongnl/retrospekt/compare/v1.8.1...v1.9.0) (2026-02-24)

### Features

* **sentry:** add error monitoring to frontend and backend ([2844230](https://github.com/stevendejongnl/retrospekt/commit/2844230cadca769665bd327b8297c712daccd5f1))

## [1.8.1](https://github.com/stevendejongnl/retrospekt/compare/v1.8.0...v1.8.1) (2026-02-24)

### Bug Fixes

* **docker:** use uv sync from lockfile instead of hardcoded deps ([dfc6ffc](https://github.com/stevendejongnl/retrospekt/commit/dfc6ffc01afd2fab876a63107c9e3db16619eda5))

## [1.8.0](https://github.com/stevendejongnl/retrospekt/compare/v1.7.1...v1.8.0) (2026-02-24)

### Features

* **sse:** use Redis pub/sub for cross-replica broadcasting ([09cbcc0](https://github.com/stevendejongnl/retrospekt/commit/09cbcc09a712f82719949654eb97a98070661ff6))

### Bug Fixes

* **sse:** use builtin TimeoutError instead of asyncio.TimeoutError ([c31135c](https://github.com/stevendejongnl/retrospekt/commit/c31135c405c5ff34c464b9abed0927dbe4b77207))

## [1.7.1](https://github.com/stevendejongnl/retrospekt/compare/v1.7.0...v1.7.1) (2026-02-24)

### Bug Fixes

* **sse:** send current session state on reconnect ([95aa6e1](https://github.com/stevendejongnl/retrospekt/commit/95aa6e1f69475e35a1c42e3d59d8d9366e7e315b))

## [1.7.0](https://github.com/stevendejongnl/retrospekt/compare/v1.6.0...v1.7.0) (2026-02-24)

### Features

* **board:** add clickable participants popup with color-coded avatars ([d3a0ea7](https://github.com/stevendejongnl/retrospekt/commit/d3a0ea731a0549197ab70115f26d2357c2e71e99))
* **board:** color cards and avatars by participant ([430b85c](https://github.com/stevendejongnl/retrospekt/commit/430b85c44704bcd975120a4533088303b136a765))
* **history:** add session history sidebar ([943a622](https://github.com/stevendejongnl/retrospekt/commit/943a622f56b3a8d29e332506399a7b3b79d59961))
* **ui:** replace emojis with Font Awesome 7 SVG icons and add GitHub links ([9714a7a](https://github.com/stevendejongnl/retrospekt/commit/9714a7ac78f3ecabfc231fdd5251988f5aff6c7f))

### Bug Fixes

* **test:** define __APP_VERSION__ in WTR esbuild config ([7f0b7db](https://github.com/stevendejongnl/retrospekt/commit/7f0b7db431703955fee699074e18b0cbeb45bfbe))

### Documentation

* update README and CLAUDE.md to reflect current feature set ([da65864](https://github.com/stevendejongnl/retrospekt/commit/da65864f1768344ff82e9ff89203a18d57b7e07f))

## [1.6.0](https://github.com/stevendejongnl/retrospekt/compare/v1.5.0...v1.6.0) (2026-02-24)

### Features

* **session-page:** add participant help button in topbar ([f7b23ef](https://github.com/stevendejongnl/retrospekt/commit/f7b23efbadaed824ed40065847803a763947b226))
* **theme:** add dark mode with CSS tokens and toggle ([90b6db5](https://github.com/stevendejongnl/retrospekt/commit/90b6db5b5df6e4aca05dc29147fa73f18a2d07bb))

## [1.5.0](https://github.com/stevendejongnl/retrospekt/compare/v1.4.0...v1.5.0) (2026-02-24)

### Features

* **session-page:** show creation date next to session title ([503fbd1](https://github.com/stevendejongnl/retrospekt/commit/503fbd17efaab93e499808107409b29f164bf198))

## [1.4.0](https://github.com/stevendejongnl/retrospekt/compare/v1.3.0...v1.4.0) (2026-02-24)

### Features

* **backend:** add session auto-expiry with configurable retention period ([1e92ba7](https://github.com/stevendejongnl/retrospekt/commit/1e92ba7135cda6dd3d12187ab3880c32e61df12a))

## [1.3.0](https://github.com/stevendejongnl/retrospekt/compare/v1.2.0...v1.3.0) (2026-02-24)

### Features

* column templates on create form and unique new-column naming ([8d0f5e4](https://github.com/stevendejongnl/retrospekt/commit/8d0f5e45b26958f62e337a8d7232e854bea01da9))

### Bug Fixes

* **board:** scroll columns horizontally within container ([b357cc9](https://github.com/stevendejongnl/retrospekt/commit/b357cc9f49ee0d61801a407d5e9f6641297e10a9))

## [1.2.0](https://github.com/stevendejongnl/retrospekt/compare/v1.1.0...v1.2.0) (2026-02-23)

### Features

* **retro:** add card publish flow and discussion-only voting ([397f55f](https://github.com/stevendejongnl/retrospekt/commit/397f55f84835b34a2bd64f4dc207d19b6400e6be))
* vote sorting, column management, and platform-aware shortcuts ([2eb513f](https://github.com/stevendejongnl/retrospekt/commit/2eb513f7edc1cf4ddb621df3a741bad3ccdd0e58))

### Bug Fixes

* **backend:** fix ruff lint errors from column management ([5e5e6dc](https://github.com/stevendejongnl/retrospekt/commit/5e5e6dc7803ff7c308ca88880372c8483fe5ff66))

### Documentation

* add CLAUDE.md with project guidance ([da99e9b](https://github.com/stevendejongnl/retrospekt/commit/da99e9bae984b220ca098a74ddde4a1853d3d566))

## [1.1.0](https://github.com/stevendejongnl/retrospekt/compare/v1.0.3...v1.1.0) (2026-02-23)

### Features

* **frontend:** add phase help dialog and back navigation for facilitator ([feb933e](https://github.com/stevendejongnl/retrospekt/commit/feb933e2c354ea832a9eb13eb3caf7fed48f2e88))

## [1.0.3](https://github.com/stevendejongnl/retrospekt/compare/v1.0.2...v1.0.3) (2026-02-23)

### Bug Fixes

* **frontend:** suppress vite proxy ECONNREFUSED noise in test output ([67f3c17](https://github.com/stevendejongnl/retrospekt/commit/67f3c17631b1a150b619a8971dc3d7ec06452c50))

## [1.0.2](https://github.com/stevendejongnl/retrospekt/compare/v1.0.1...v1.0.2) (2026-02-23)

### Bug Fixes

* **api:** correct header merge order and wire repo via Depends for testability ([e2ff1a1](https://github.com/stevendejongnl/retrospekt/commit/e2ff1a1a257ea36d78f097c3ded09afd8e8b03e0))
* **frontend:** add @playwright/test to devDependencies ([ec87523](https://github.com/stevendejongnl/retrospekt/commit/ec875235b6d59528a6df701d2aa8f9e3f023d8d5))
* **frontend:** add @types/mocha, fix null casts, exclude spec files from tsc ([76a0ba1](https://github.com/stevendejongnl/retrospekt/commit/76a0ba1443fd63a2ecab01077e97491d3ebcc31f))

## [1.0.1](https://github.com/stevendejongnl/retrospekt/compare/v1.0.0...v1.0.1) (2026-02-23)

### Bug Fixes

* use envsubst for nginx backend host to support kubernetes service names ([490ed5e](https://github.com/stevendejongnl/retrospekt/commit/490ed5e953f69267e436b0b6d0706662691b8710))

## 1.0.0 (2026-02-23)

### Features

* add semantic release and CI/CD pipeline ([6dec005](https://github.com/stevendejongnl/retrospekt/commit/6dec00511b8c7c05f53164ca04d40d1b6bdc6b3c))

### Bug Fixes

* resolve ruff lint errors ([28d1bd5](https://github.com/stevendejongnl/retrospekt/commit/28d1bd5948f315619dba1694ff7841d45ef455dc))
