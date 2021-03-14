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
complex_msg x 4,270 ops/sec ±0.61% (89 runs sampled)
normal_msg x 33,758 ops/sec ±0.78% (92 runs sampled)
simple_msg x 175,172 ops/sec ±0.24% (95 runs sampled)
string_msg x 214,193 ops/sec ±0.24% (93 runs sampled)

== This package ==
complex_msg x 8,916 ops/sec ±0.57% (91 runs sampled)
normal_msg x 69,257 ops/sec ±0.31% (95 runs sampled)
simple_msg x 441,932 ops/sec ±0.15% (95 runs sampled)
string_msg x 646,199 ops/sec ±0.20% (97 runs sampled)
```
