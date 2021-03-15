# MessageFormat Parser

Hand-written ICU MessageFormat parser with compatible output as
[`intl-messageformat-parser`](https://www.npmjs.com/package/intl-messageformat-parser)
but 3x - 4x as fast.

```
$ node benchmark
complex_msg AST length 10861
normal_msg AST length 1665
simple_msg AST length 364
string_msg AST length 131

== Baseline ==
complex_msg x 4,267 ops/sec ±0.85% (90 runs sampled)
normal_msg x 34,091 ops/sec ±0.68% (94 runs sampled)
simple_msg x 179,517 ops/sec ±0.27% (95 runs sampled)
string_msg x 221,118 ops/sec ±0.28% (92 runs sampled)

== This package ==
complex_msg x 14,872 ops/sec ±0.22% (92 runs sampled)
normal_msg x 117,881 ops/sec ±0.53% (94 runs sampled)
simple_msg x 817,603 ops/sec ±0.18% (96 runs sampled)
string_msg x 974,826 ops/sec ±0.30% (96 runs sampled)
```
