# Third-party notice inventory

The application is MIT-licensed. Its dependencies keep their own licenses. Full package license texts and copyright attributions are retained in [THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt), which Vite copies into every production build.

## Scope

This is a **conservative source dependency and notice inventory**, not an exact linked-binary SBOM. It combines the 3D dependency closure of an upstream lockfile with versions independently observed in the distributed WASM. The closure includes optional, build-time, procedural-macro, and other-platform packages; their presence here does not claim that their code is in the application. Development-only npm tooling is installed from `package-lock.json` and keeps the licenses distributed in its own packages; it is not bundled into the browser application.

### JavaScript and fonts

The notices cover Three.js 0.180.0, React 19.2.0, React DOM 19.2.0, scheduler 0.27.0, DM Sans through `@fontsource-variable/dm-sans` 5.3.0, IBM Plex Mono through `@fontsource/ibm-plex-mono` 5.3.0, and `@dimforge/rapier3d-compat` 0.19.3. The Rapier section is the exact upstream Apache-2.0 LICENSE, including **Copyright 2020 Dimforge EURL**; it is not a substituted generic attribution.

## Pinned Rapier evidence

- npm package: `@dimforge/rapier3d-compat@0.19.3`
- npm integrity from the checked-in lock: `sha512-mMVdSj1PRTT108s9Swbu2GQOmHbn8kbJANRV5xfczL3s0T4vkgZAuoMRgvBzQcHanpKusbC0ZJj6z3mC3aj3vg==`
- WASM: `rapier_wasm3d_bg.wasm`, 1,569,588 bytes; SHA-256 `1ce1c8c4036b4dcd3bde86c6efdb0f270cf5e274979b1de6ab8052947ef166c5`
- Decoding the inlined WASM in both the installed `rapier.mjs` and production ragdoll JavaScript produced the same bytes as that WASM file
- Upstream tag `v0.19.3`: commit [`0fd32c1cbbc7018af36f09b190c16ce72fbb9301`](https://github.com/dimforge/rapier.js/tree/0fd32c1cbbc7018af36f09b190c16ce72fbb9301)
- [Retained upstream Cargo.lock](upstream/rapier-js-0.19.3.Cargo.lock), SHA-256 `233d13421c0d0ac34b2165d1791a6ad303dd46bd83ab2ca94328c289d9aebecc`
- [Retained build manifest template](upstream/rapier-js-0.19.3.Cargo.toml.tera), SHA-256 `1580bddeea3bbb0d54de5c53cbb09a442d6789817489ef2ae6df47687a67160c`

### The upstream lock does not exactly describe the published binary

The tag's build template declares wrapper version 0.19.3 and explicitly requires `parry3d ^0.25.3`, while its lock still lists wrapper 0.19.2 and `parry3d 0.25.2`. The lock also lists `hashbrown 0.15.5`, while the distributed WASM contains a source path for 0.15.4. The WASM also exposes `dlmalloc 0.2.10` from the Rust standard library. We preserve the lock unchanged rather than silently pretending it is an exact release SBOM.

The inventory traverses the lock's `dimforge_rapier3d` root recursively: 108 nodes including the root, or 107 registry crates. It then supplements **parry3d 0.25.3, hashbrown 0.15.4, and dlmalloc 0.2.10**, for 110 registry crate/version entries. Observed WASM strings are corroborating evidence for those versions, not proof that every linked dependency can be recovered from strings.

The three supplemental manifests were reviewed. Their relevant default/std dependencies are covered by the retained graph or the Rust standard-library notices. `dlmalloc` uses cfg-if on wasm; its Unix/libc and Windows/windows-sys paths are other-target branches. Its optional `rustc-std-workspace-core` integration is part of the standard-library build. Optional parallelism, wavefront, rkyv, encase, and external profiling backends are not enabled by this standard 3D build. This does not claim a fully feature-resolved or reproducibly rebuilt upstream WASM.

## How notices were collected

1. Traverse the fixed upstream lock's 3D dependency edges, resolving duplicate versions explicitly
2. Download each exact `.crate` archive from the official `static.crates.io` registry and compare its SHA-256 with the lock checksum
3. For the three supplemental versions, independently compare the archive against the official `index.crates.io` checksum; preserve the index record
4. Read each archive's Cargo manifest and recursively collect LICENSE, LICENCE, COPYING, COPYRIGHT, and NOTICE files, retaining upstream text unchanged
5. For `profiling`, `profiling-procmacros`, and `rstar`, whose published archive omits license files, use the repository commit recorded by that archive's `.cargo_vcs_info.json` to retrieve the license files
6. Retain dlmalloc's additional Doug Lea public-domain notice from its included C source
7. Deduplicate identical license texts by SHA-256; every crate's entry maps back to its exact text section in the served notices

The [machine-readable inventory](upstream/rapier-wasm-crates.json) records package versions, archive URLs/hashes, declared SPDX expressions, source commits where needed, and hashes/locations of the license files. SPDX alternatives remain the upstream choices; the application's MIT license does not override them. Apparent template fields in a dependency's original license appendix are retained verbatim rather than edited.

## Rust standard library

The distributed WASM contains source paths for Rust commit [`1159e78c4747b02ef996e55082b704c09b970588`](https://github.com/rust-lang/rust/tree/1159e78c4747b02ef996e55082b704c09b970588), whose source version is 1.90.0. The official wasm32 standard-library archive identifies the same commit. Its upstream COPYRIGHT summary and MIT/Apache license texts are included in the notices. The unmodified official [Rust standard-library copyright inventory](../public/RUST_STD_COPYRIGHT.html) is served alongside the main notices. It covers standard-library dependencies (including dlmalloc and hashbrown) and conservatively includes other-target entries. This is separate from the Rapier workspace graph.

It was extracted from `rustc-1.90.0-x86_64-unknown-linux-gnu/rustc/share/doc/rust/COPYRIGHT-library.html` in the [official 2025-09-18 Rust 1.90.0 archive](https://static.rust-lang.org/dist/2025-09-18/rustc-1.90.0-x86_64-unknown-linux-gnu.tar.xz). The archive SHA-256 `48c2a42de9e92fcae8c24568f5fe40d5734696a6f80e83cc6d46eef1a78f13c9` matches the official `.sha256` sidecar. The retained HTML SHA-256 is `025c0dd1236493fcd5b6386b68453852e6528722bd5f8dce5949e94d225e7a60`. This is an attribution supplement, not a claim that the Linux compiler is shipped in the web app.

The main notices also retain the complete [compiler-builtins/libm source license](https://github.com/rust-lang/rust/blob/1159e78c4747b02ef996e55082b704c09b970588/library/compiler-builtins/LICENSE.txt) from the same Rust commit, including the LLVM exception and its stated license combinations (SHA-256 `ab6eec6caf0fa5775e411c7a8bc6a45c4ef2956b0980b157ab74fc5cd62a928b`). This covers the compiler runtime source separately from the generated standard-library inventory.

## Registry inventory

“Lock” means the conservative 3D source-lock closure. “Observed supplement” identifies a version added from the distributed WASM and checked against registry metadata.

| Crate                      | Version                       | Declared license                                    | Evidence            |
| -------------------------- | ----------------------------- | --------------------------------------------------- | ------------------- |
| allocator-api2             | 0.2.21                        | MIT OR Apache-2.0                                   | Lock                |
| approx                     | 0.5.1                         | Apache-2.0                                          | Lock                |
| arrayvec                   | 0.7.6                         | MIT OR Apache-2.0                                   | Lock                |
| autocfg                    | 1.5.0                         | Apache-2.0 OR MIT                                   | Lock                |
| bincode                    | 1.3.3                         | MIT                                                 | Lock                |
| bit-vec                    | 0.8.0                         | Apache-2.0 OR MIT                                   | Lock                |
| bitflags                   | 2.9.1                         | MIT OR Apache-2.0                                   | Lock                |
| bumpalo                    | 3.19.0                        | MIT OR Apache-2.0                                   | Lock                |
| by_address                 | 1.2.1                         | MIT OR Apache-2.0                                   | Lock                |
| bytemuck                   | 1.24.0                        | Zlib OR Apache-2.0 OR MIT                           | Lock                |
| byteorder                  | 1.5.0                         | Unlicense OR MIT                                    | Lock                |
| cfg-if                     | 1.0.1                         | MIT OR Apache-2.0                                   | Lock                |
| dlmalloc                   | 0.2.10                        | MIT/Apache-2.0                                      | Observed supplement |
| downcast-rs                | 2.0.2                         | MIT OR Apache-2.0                                   | Lock                |
| either                     | 1.15.0                        | MIT OR Apache-2.0                                   | Lock                |
| ena                        | 0.14.3                        | MIT OR Apache-2.0                                   | Lock                |
| equivalent                 | 1.0.2                         | Apache-2.0 OR MIT                                   | Lock                |
| fast-srgb8                 | 1.0.0                         | MIT OR Apache-2.0 OR CC0-1.0                        | Lock                |
| foldhash                   | 0.1.5                         | Zlib                                                | Lock                |
| foldhash                   | 0.2.0                         | Zlib                                                | Lock                |
| getrandom                  | 0.2.16                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.14.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.15.2                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.16.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.17.3                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.18.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.19.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.20.5                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.21.3                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.22.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.23.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.24.2                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.25.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.27.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.28.0                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.29.3                        | MIT OR Apache-2.0                                   | Lock                |
| glam                       | 0.30.8                        | MIT OR Apache-2.0                                   | Lock                |
| hash32                     | 0.3.1                         | MIT OR Apache-2.0                                   | Lock                |
| hashbrown                  | 0.15.4                        | MIT OR Apache-2.0                                   | Observed supplement |
| hashbrown                  | 0.15.5                        | MIT OR Apache-2.0                                   | Lock                |
| hashbrown                  | 0.16.0                        | MIT OR Apache-2.0                                   | Lock                |
| heapless                   | 0.8.0                         | MIT OR Apache-2.0                                   | Lock                |
| indexmap                   | 2.11.1                        | Apache-2.0 OR MIT                                   | Lock                |
| js-sys                     | 0.3.77                        | MIT OR Apache-2.0                                   | Lock                |
| libc                       | 0.2.174                       | MIT OR Apache-2.0                                   | Lock                |
| libm                       | 0.2.15                        | MIT                                                 | Lock                |
| log                        | 0.4.27                        | MIT OR Apache-2.0                                   | Lock                |
| matrixmultiply             | 0.3.10                        | MIT/Apache-2.0                                      | Lock                |
| nalgebra                   | 0.34.1                        | Apache-2.0                                          | Lock                |
| nalgebra-macros            | 0.3.0                         | Apache-2.0                                          | Lock                |
| num-bigint                 | 0.4.6                         | MIT OR Apache-2.0                                   | Lock                |
| num-complex                | 0.4.6                         | MIT OR Apache-2.0                                   | Lock                |
| num-derive                 | 0.4.2                         | MIT OR Apache-2.0                                   | Lock                |
| num-integer                | 0.1.46                        | MIT OR Apache-2.0                                   | Lock                |
| num-rational               | 0.4.2                         | MIT OR Apache-2.0                                   | Lock                |
| num-traits                 | 0.2.19                        | MIT OR Apache-2.0                                   | Lock                |
| once_cell                  | 1.21.3                        | MIT OR Apache-2.0                                   | Lock                |
| ordered-float              | 5.1.0                         | MIT                                                 | Lock                |
| palette                    | 0.7.6                         | MIT OR Apache-2.0                                   | Lock                |
| palette_derive             | 0.7.6                         | MIT OR Apache-2.0                                   | Lock                |
| parry3d                    | 0.25.2                        | Apache-2.0                                          | Lock                |
| parry3d                    | 0.25.3                        | Apache-2.0                                          | Observed supplement |
| paste                      | 1.0.15                        | MIT OR Apache-2.0                                   | Lock                |
| phf                        | 0.11.3                        | MIT                                                 | Lock                |
| phf_generator              | 0.11.3                        | MIT                                                 | Lock                |
| phf_macros                 | 0.11.3                        | MIT                                                 | Lock                |
| phf_shared                 | 0.11.3                        | MIT                                                 | Lock                |
| ppv-lite86                 | 0.2.21                        | MIT OR Apache-2.0                                   | Lock                |
| proc-macro2                | 1.0.95                        | MIT OR Apache-2.0                                   | Lock                |
| profiling                  | 1.0.17                        | MIT OR Apache-2.0                                   | Lock                |
| profiling-procmacros       | 1.0.17                        | MIT OR Apache-2.0                                   | Lock                |
| quote                      | 1.0.40                        | MIT OR Apache-2.0                                   | Lock                |
| rand                       | 0.8.5                         | MIT OR Apache-2.0                                   | Lock                |
| rand_chacha                | 0.3.1                         | MIT OR Apache-2.0                                   | Lock                |
| rand_core                  | 0.6.4                         | MIT OR Apache-2.0                                   | Lock                |
| rapier3d                   | 0.30.1                        | Apache-2.0                                          | Lock                |
| rawpointer                 | 0.2.1                         | MIT/Apache-2.0                                      | Lock                |
| ref-cast                   | 1.0.25                        | MIT OR Apache-2.0                                   | Lock                |
| ref-cast-impl              | 1.0.25                        | MIT OR Apache-2.0                                   | Lock                |
| robust                     | 1.2.0                         | MIT OR Apache-2.0                                   | Lock                |
| rstar                      | 0.12.2                        | MIT OR Apache-2.0                                   | Lock                |
| rustc-hash                 | 2.1.1                         | Apache-2.0 OR MIT                                   | Lock                |
| rustversion                | 1.0.21                        | MIT OR Apache-2.0                                   | Lock                |
| safe_arch                  | 0.7.4                         | Zlib OR Apache-2.0 OR MIT                           | Lock                |
| serde                      | 1.0.219                       | MIT OR Apache-2.0                                   | Lock                |
| serde_arrays               | 0.2.0                         | MIT OR Apache-2.0                                   | Lock                |
| serde_derive               | 1.0.219                       | MIT OR Apache-2.0                                   | Lock                |
| simba                      | 0.9.1                         | Apache-2.0                                          | Lock                |
| siphasher                  | 1.0.1                         | MIT/Apache-2.0                                      | Lock                |
| slab                       | 0.4.11                        | MIT                                                 | Lock                |
| smallvec                   | 1.15.1                        | MIT OR Apache-2.0                                   | Lock                |
| spade                      | 2.15.0                        | MIT OR Apache-2.0                                   | Lock                |
| stable_deref_trait         | 1.2.1                         | MIT OR Apache-2.0                                   | Lock                |
| static_assertions          | 1.1.0                         | MIT OR Apache-2.0                                   | Lock                |
| syn                        | 2.0.104                       | MIT OR Apache-2.0                                   | Lock                |
| thiserror                  | 2.0.12                        | MIT OR Apache-2.0                                   | Lock                |
| thiserror-impl             | 2.0.12                        | MIT OR Apache-2.0                                   | Lock                |
| typenum                    | 1.18.0                        | MIT OR Apache-2.0                                   | Lock                |
| unicode-ident              | 1.0.18                        | (MIT OR Apache-2.0) AND Unicode-3.0                 | Lock                |
| vec_map                    | 0.8.2                         | MIT/Apache-2.0                                      | Lock                |
| wasi                       | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | Lock                |
| wasm-bindgen               | 0.2.100                       | MIT OR Apache-2.0                                   | Lock                |
| wasm-bindgen-backend       | 0.2.100                       | MIT OR Apache-2.0                                   | Lock                |
| wasm-bindgen-macro         | 0.2.100                       | MIT OR Apache-2.0                                   | Lock                |
| wasm-bindgen-macro-support | 0.2.100                       | MIT OR Apache-2.0                                   | Lock                |
| wasm-bindgen-shared        | 0.2.100                       | MIT OR Apache-2.0                                   | Lock                |
| web-time                   | 1.1.0                         | MIT OR Apache-2.0                                   | Lock                |
| wide                       | 0.7.33                        | Zlib OR Apache-2.0 OR MIT                           | Lock                |
| zerocopy                   | 0.8.26                        | BSD-2-Clause OR Apache-2.0 OR MIT                   | Lock                |
| zerocopy-derive            | 0.8.26                        | BSD-2-Clause OR Apache-2.0 OR MIT                   | Lock                |

## Updating dependencies

A version change requires updating the npm lock, retrieving that version's upstream source/build evidence, repeating the notice collection and binary comparison, and reviewing changed licenses. A successful `npm audit` only addresses currently known package vulnerabilities; it does not replace license review or establish the absence of vulnerabilities in the bundled Rust/WASM dependency graph.

## 日本語での要点

これは固定した上流ソースの依存関係と、配布WASMで確認できた版の差分を合わせた、広めのライセンス収録表です。実際にリンクされたコードだけを厳密に列挙するSBOMではありません。上流タグのlockと配布バイナリの差は明記し、crateの原文ライセンス・著作権表記・公式配布元・ハッシュを保持しています。MIT化はアプリ本体に適用され、依存コードやフォントのライセンスを変更しません。
