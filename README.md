# MessageFormat Parser

Hand-written ICU MessageFormat parser with compatible output as
[`intl-messageformat-parser`](https://www.npmjs.com/package/intl-messageformat-parser)
but more than 4 times as fast.

```
== Baseline ==
complex_msg x 4,245 ops/sec ±0.52% (91 runs sampled)
normal_msg x 33,466 ops/sec ±0.54% (93 runs sampled)
simple_msg x 175,455 ops/sec ±0.20% (95 runs sampled)
string_msg x 214,517 ops/sec ±0.34% (91 runs sampled)

== This package ==
complex_msg x 17,826 ops/sec ±0.19% (93 runs sampled)
normal_msg x 132,184 ops/sec ±0.38% (94 runs sampled)
simple_msg x 988,586 ops/sec ±0.45% (93 runs sampled)
string_msg x 1,344,538 ops/sec ±0.24% (94 runs sampled)
```
