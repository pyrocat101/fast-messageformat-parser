# MessageFormat Parser

Hand-written ICU MessageFormat parser with compatible output as
[`intl-messageformat-parser`](https://www.npmjs.com/package/intl-messageformat-parser)
but more than twice as fast.

```
$ node benchmark
complex_msg AST length 10861
normal_msg AST length 1665
simple_msg AST length 364
string_msg AST length 131

== Baseline ==
complex_msg x 4,192 ops/sec ±0.83% (87 runs sampled)
normal_msg x 33,382 ops/sec ±0.64% (95 runs sampled)
simple_msg x 178,051 ops/sec ±0.29% (96 runs sampled)
string_msg x 217,228 ops/sec ±0.27% (93 runs sampled)

== This package ==
complex_msg x 12,691 ops/sec ±0.23% (95 runs sampled)
normal_msg x 103,990 ops/sec ±0.50% (94 runs sampled)
simple_msg x 670,408 ops/sec ±0.20% (95 runs sampled)
string_msg x 763,008 ops/sec ±0.25% (93 runs sampled)
```
