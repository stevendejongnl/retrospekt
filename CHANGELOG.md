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
