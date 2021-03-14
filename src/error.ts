import {Location} from './types';

export interface ParserError {
    kind: ErrorKind;
    message: string;
    location: Location;
}

export enum ErrorKind {
    /** Argument is unclosed (e.g. `{0`) */
    EXPECT_ARGUMENT_CLOSING_BRACE,
    /** Argument is empty (e.g. `{}`). */
    EMPTY_ARGUMENT,
    /** Argument is malformed (e.g. `{foo!}``) */
    MALFORMED_ARGUMENT,
    /** Expect an argument type (e.g. `{foo,}`) */
    EXPECT_ARGUMENT_TYPE,
    /** Unsupported argument type (e.g. `{foo,foo}`) */
    INVALID_ARGUMENT_TYPE,
    /** Expect an argument style (e.g. `{foo, number, }`) */
    EXPECT_ARGUMENT_STYLE,
    /** The number skeleton is invalid. */
    INVALID_NUMBER_SKELETON,
    /** The date time skeleton is invalid. */
    INVALID_DATE_TIME_SKELETON,
    /** Exepct a number skeleton following the `::` (e.g. `{foo, number, ::}`) */
    EXPECT_NUMBER_SKELETON,
    /** Exepct a date time skeleton following the `::` (e.g. `{foo, date, ::}`) */
    EXPECT_DATE_TIME_SKELETON,
    /** Unmatched apostrophes in the argument style (e.g. `{foo, number, 'test`) */
    UNCLOSED_QUOTE_IN_ARGUMENT_STYLE,
    /** Missing select argument options (e.g. `{foo, select}`) */
    EXPECT_SELECT_ARGUMENT_OPTIONS,

    /** Expecting an offset value in `plural` or `selectordinal` argument (e.g `{foo, plural, offset}`) */
    EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE,
    /** Offset value in `plural` or `selectordinal` is invalid (e.g. `{foo, plural, offset: x}`) */
    INVALID_PLURAL_ARGUMENT_OFFSET_VALUE,

    /** Expecting a selector in `select` argument (e.g `{foo, select}`) */
    EXPECT_SELECT_ARGUMENT_SELECTOR,
    /** Expecting a selector in `plural` or `selectordinal` argument (e.g `{foo, plural}`) */
    EXPECT_PLURAL_ARGUMENT_SELECTOR,

    /** Expecting a message fragment after the `select` selector (e.g. `{foo, select, apple}`) */
    EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT,
    /**
     * Expecting a message fragment after the `plural` or `selectordinal` selector
     * (e.g. `{foo, plural, one}`)
     */
    EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT,

    /** Selector in `plural` or `selectordinal` is malformed (e.g. `{foo, plural, =x {#}}`) */
    INVALID_PLURAL_ARGUMENT_SELECTOR,

    /**
     * Duplicate selectors in `plural` or `selectordinal` argument.
     * (e.g. {foo, plural, one {#} one {#}})
     */
    DUPLICATE_PLURAL_ARGUMENT_SELECTOR,
    /** Duplicate selectors in `select` argument.
     * (e.g. {foo, select, apple {apple} apple {apple}})
     */
    DUPLICATE_SELECT_ARGUMENT_SELECTOR,

    /** Plural or select argument option must have `other` clause. */
    MISSING_OTHER_CLAUSE,

    /** The tag is malformed. (e.g. `<bold!>foo</bold!>) */
    INVALID_TAG,
    /** The closing tag does not match the opening tag. (e.g. `<bold>foo</italic>`) */
    UNMATCHED_CLOSING_TAG,
    /** The opening tag has unmatched closing tag. (e.g. `<bold>foo`) */
    UNCLOSED_TAG,
}
