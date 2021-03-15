# MessageFormat Parser

Hand-written ICU MessageFormat parser with compatible output as
[`intl-messageformat-parser`](https://www.npmjs.com/package/intl-messageformat-parser)
but 6 - 8 times as fast.

```
$ node benchmark
complex_msg AST length 10861
normal_msg AST length 1665
simple_msg AST length 364
string_msg AST length 131

== Baseline ==
complex_msg x 4,012 ops/sec ±0.61% (88 runs sampled)
normal_msg x 32,257 ops/sec ±0.24% (95 runs sampled)
simple_msg x 166,892 ops/sec ±0.68% (95 runs sampled)
string_msg x 210,422 ops/sec ±0.25% (91 runs sampled)

== This package ==
complex_msg x 24,330 ops/sec ±0.41% (89 runs sampled)
normal_msg x 200,690 ops/sec ±0.35% (91 runs sampled)
simple_msg x 1,544,887 ops/sec ±0.20% (95 runs sampled)
string_msg x 1,997,382 ops/sec ±0.39% (96 runs sampled)
```
