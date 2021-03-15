# MessageFormat Parser

Hand-written ICU MessageFormat parser with compatible output as
[`intl-messageformat-parser`](https://www.npmjs.com/package/intl-messageformat-parser)
but more than 5 times as fast.

```
$ node benchmark
complex_msg AST length 10861
normal_msg AST length 1665
simple_msg AST length 364
string_msg AST length 131

== Baseline ==
complex_msg x 4,261 ops/sec ±0.51% (87 runs sampled)
normal_msg x 33,432 ops/sec ±0.83% (94 runs sampled)
simple_msg x 177,333 ops/sec ±0.19% (95 runs sampled)
string_msg x 215,332 ops/sec ±0.29% (95 runs sampled)

== This package ==
complex_msg x 20,626 ops/sec ±0.22% (89 runs sampled)
normal_msg x 179,737 ops/sec ±0.33% (93 runs sampled)
simple_msg x 1,174,604 ops/sec ±0.33% (94 runs sampled)
string_msg x 1,316,824 ops/sec ±0.21% (95 runs sampled)
```
