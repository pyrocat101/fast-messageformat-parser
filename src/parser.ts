import {ErrorKind, ParserError} from './error';
import {
    DateTimeSkeleton,
    LiteralElement,
    Location,
    MessageFormatElement,
    NumberSkeleton,
    NumberSkeletonToken,
    PluralOrSelectOption,
    SKELETON_TYPE,
    TagElement,
    TYPE,
} from './types';

export interface Position {
    /** Offset in terms of UTF-16 *code unit*. */
    offset: number;
    line: number;
    /** Column offset in terms of unicode *code point*. */
    column: number;
}

export interface ParserOptions {
    /**
     * Whether to treat HTML/XML tags as string literal
     * instead of parsing them as tag token.
     * When this is false we only allow simple tags without
     * any attributes
     */
    ignoreTag?: boolean;
}

export type Result<T, E> = {val: T; err: null} | {val: null; err: E};
type ArgType = 'number' | 'date' | 'time' | 'select' | 'plural' | 'selectordinal' | '';

function createLocation(start: Position, end: Position): Location {
    return {start, end};
}

const WHITESPACE_RE = /^\p{White_Space}$/u;
const PATTERN_SYNTAX_RE = /^\p{Pattern_Syntax}$/u;

export class Parser {
    private message: string;
    private position: Position;
    private ignoreTag: boolean;

    constructor(message: string, options: ParserOptions) {
        this.message = message;
        this.position = {offset: 0, line: 1, column: 1};
        this.ignoreTag = !!options.ignoreTag;
    }

    parse(): Result<MessageFormatElement[], ParserError> {
        if (this.offset !== 0) {
            throw Error('parser can only be used once');
        }
        return this.parseMessage(0, '', false);
    }

    private parseMessage(
        nestingLevel: number,
        parentArgType: ArgType,
        expectingCloseTag: boolean,
    ): Result<MessageFormatElement[], ParserError> {
        let elements: MessageFormatElement[] = [];

        while (!this.isEOF) {
            const char = this.char;
            if (char === '{') {
                const result = this.parseArgument(nestingLevel, expectingCloseTag);
                if (result.err) {
                    return result;
                }
                elements.push(result.val);
            } else if (char === '}' && nestingLevel > 0) {
                break;
            } else if (
                char === '#' &&
                (parentArgType === 'plural' || parentArgType === 'selectordinal')
            ) {
                const position = this.clonePosition();
                this.bump();
                elements.push({
                    type: TYPE.pound,
                    location: createLocation(position, this.clonePosition()),
                });
            } else if (
                char === '<' &&
                !this.ignoreTag &&
                this.peek() === 47 // char code for '/'
            ) {
                if (expectingCloseTag) {
                    break;
                } else {
                    return this.error(
                        ErrorKind.UNMATCHED_CLOSING_TAG,
                        createLocation(this.clonePosition(), this.clonePosition()),
                    );
                }
            } else if (char === '<' && !this.ignoreTag && _isAlpha(this.peek() || 0)) {
                const result = this.parseTag(nestingLevel, parentArgType);
                if (result.err) {
                    return result;
                }
                elements.push(result.val);
            } else {
                const result = this.parseLiteral(nestingLevel, parentArgType);
                if (result.err) {
                    return result;
                }
                elements.push(result.val);
            }
        }

        return {val: elements, err: null};
    }
    /**
     * A tag name must start with an ASCII lower case letter. The grammar is based on the
     * [custom element name][] except that a dash is NOT always mandatory and uppercase letters
     * are accepted:
     *
     * ```
     * tag ::= "<" tagName (whitespace)* "/>" | "<" tagName (whitespace)* ">" message "</" tagName (whitespace)* ">"
     * tagName ::= [a-z] (PENChar)*
     * PENChar ::=
     *     "-" | "." | [0-9] | "_" | [a-z] | [A-Z] | #xB7 | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x37D] |
     *     [#x37F-#x1FFF] | [#x200C-#x200D] | [#x203F-#x2040] | [#x2070-#x218F] | [#x2C00-#x2FEF] |
     *     [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
     * ```
     *
     * [custom element name]: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
     */
    private parseTag(
        nestingLevel: number,
        parentArgType: ArgType,
    ): Result<TagElement, ParserError> {
        const startPosition = this.clonePosition();
        this.bump(); // `<`

        const tagName = this.parseTagName();
        this.bumpSpace();

        if (this.bumpIf('/>')) {
            // Self closing tag
            return {
                val: {
                    type: TYPE.tag,
                    value: tagName,
                    children: [],
                    location: createLocation(startPosition, this.clonePosition()),
                },
                err: null,
            };
        } else if (this.bumpIf('>')) {
            const childrenResult = this.parseMessage(nestingLevel + 1, parentArgType, true);
            if (childrenResult.err) {
                return childrenResult;
            }
            const children = childrenResult.val;

            // Expecting a close tag
            const endTagStartPosition = this.clonePosition();

            if (this.bumpIf('</')) {
                if (this.isEOF || !_isAlpha(this.codePoint)) {
                    return this.error(
                        ErrorKind.INVALID_TAG,
                        createLocation(endTagStartPosition, this.clonePosition()),
                    );
                }

                const closingTagNameStartPosition = this.clonePosition();
                const closingTagName = this.parseTagName();

                if (tagName !== closingTagName) {
                    return this.error(
                        ErrorKind.UNMATCHED_CLOSING_TAG,
                        createLocation(closingTagNameStartPosition, this.clonePosition()),
                    );
                }

                this.bumpSpace();
                if (!this.bumpIf('>')) {
                    return this.error(
                        ErrorKind.INVALID_TAG,
                        createLocation(endTagStartPosition, this.clonePosition()),
                    );
                }

                return {
                    val: {
                        type: TYPE.tag,
                        value: tagName,
                        children,
                        location: createLocation(startPosition, this.clonePosition()),
                    },
                    err: null,
                };
            } else {
                return this.error(
                    ErrorKind.UNCLOSED_TAG,
                    createLocation(startPosition, this.clonePosition()),
                );
            }
        } else {
            return this.error(
                ErrorKind.INVALID_TAG,
                createLocation(startPosition, this.clonePosition()),
            );
        }
    }

    private parseTagName(): string {
        const startOffset = this.offset;
        this.bump(); // the first tag name character
        while (!this.isEOF && _isPotentialElementNameChar(this.codePoint)) {
            this.bump();
        }
        return this.message.slice(startOffset, this.offset);
    }

    private parseLiteral(
        nestingLevel: number,
        parentArgType: ArgType,
    ): Result<LiteralElement, ParserError> {
        const start = this.clonePosition();

        let value = '';
        while (true) {
            if (this.bumpIf("''")) {
                value += "'";
                continue;
            }

            const parseQuoteResult = this.tryParseQuote(parentArgType);
            if (parseQuoteResult) {
                value += parseQuoteResult;
                continue;
            }

            const parseUnquotedResult = this.tryParseUnquoted(nestingLevel, parentArgType);
            if (parseUnquotedResult) {
                value += parseUnquotedResult;
                continue;
            }

            const parseLeftAngleResult = this.tryParseLeftAngleBracket();
            if (parseLeftAngleResult) {
                value += parseLeftAngleResult;
                continue;
            }

            break;
        }

        const location = createLocation(start, this.clonePosition());
        return {
            val: {type: TYPE.literal, value, location},
            err: null,
        };
    }

    tryParseLeftAngleBracket(): string | null {
        if (
            !this.isEOF &&
            this.char === '<' &&
            (this.ignoreTag ||
                // If at the opening tag or closing tag position, bail.
                !_isAlphaOrSlash(this.peek() || 0))
        ) {
            this.bump(); // `<`
            return '<';
        }
        return null;
    }

    /**
     * Starting with ICU 4.8, an ASCII apostrophe only starts quoted text if it immediately precedes
     * a character that requires quoting (that is, "only where needed"), and works the same in
     * nested messages as on the top level of the pattern. The new behavior is otherwise compatible.
     */
    private tryParseQuote(parentArgType: ArgType): string | null {
        if (this.isEOF || this.char !== "'") {
            return null;
        }

        // Parse escaped char following the apostrophe, or early return if there is no escaped char.
        // Check if is valid escaped character
        switch (this.peek()) {
            // '{', '<', '>', '}'
            case 123:
            case 60:
            case 62:
            case 125:
                break;
            case 35: // '#'
                if (parentArgType === 'plural' || parentArgType === 'selectordinal') {
                    break;
                }
            default:
                return null;
        }

        this.bump(); // apostrophe
        let value = this.char; // escaped char
        this.bump();

        // read chars until the optional closing apostrophe is found
        while (!this.isEOF) {
            const ch = this.char;
            if (ch === "'") {
                if (this.peek() === 39 /* `'` */) {
                    value += "'";
                    // Bump one more time because we need to skip 2 characters.
                    this.bump();
                } else {
                    // Optional closing apostrophe.
                    this.bump();
                    break;
                }
            } else {
                value += ch;
            }
            this.bump();
        }

        return value;
    }

    private tryParseUnquoted(nestingLevel: number, parentArgType: ArgType): string | null {
        if (this.isEOF) {
            return null;
        }
        const ch = this.char;

        if (
            ch === '<' ||
            ch === '{' ||
            (ch === '#' && (parentArgType === 'plural' || parentArgType === 'selectordinal')) ||
            (ch === '}' && nestingLevel > 0)
        ) {
            return null;
        } else {
            this.bump();
            return ch;
        }
    }

    private parseArgument(
        nestingLevel: number,
        expectingCloseTag: boolean,
    ): Result<MessageFormatElement, ParserError> {
        const openingBracePosition = this.clonePosition();
        this.bump(); // `{`

        this.bumpSpace();

        if (this.isEOF) {
            return this.error(
                ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE,
                createLocation(openingBracePosition, this.clonePosition()),
            );
        }

        if (this.char === '}') {
            this.bump();
            return this.error(
                ErrorKind.EMPTY_ARGUMENT,
                createLocation(openingBracePosition, this.clonePosition()),
            );
        }

        // argument name
        let value = this.parseIdentifierIfPossible().value;
        if (!value) {
            return this.error(
                ErrorKind.MALFORMED_ARGUMENT,
                createLocation(openingBracePosition, this.clonePosition()),
            );
        }

        this.bumpSpace();

        if (this.isEOF) {
            return this.error(
                ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE,
                createLocation(openingBracePosition, this.clonePosition()),
            );
        }

        switch (this.char) {
            // Simple argument: `{name}`
            case '}': {
                this.bump(); // `}`
                return {
                    val: {
                        type: TYPE.argument,
                        // value does not include the opening and closing braces.
                        value,
                        location: createLocation(openingBracePosition, this.clonePosition()),
                    },
                    err: null,
                };
            }
            // Argument with options: `{name, format, ...}`
            case ',': {
                this.bump(); // `,`
                this.bumpSpace();

                if (this.isEOF) {
                    return this.error(
                        ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE,
                        createLocation(openingBracePosition, this.clonePosition()),
                    );
                }

                return this.parseArgumentOptions(
                    nestingLevel,
                    expectingCloseTag,
                    value,
                    openingBracePosition,
                );
            }
            default:
                return this.error(
                    ErrorKind.MALFORMED_ARGUMENT,
                    createLocation(openingBracePosition, this.clonePosition()),
                );
        }
    }

    /**
     * Advance the parser until the end of the identifier, if it is currently on
     * an identifier character. Return an empty string otherwise.
     */
    private parseIdentifierIfPossible(): {value: string; location: Location} {
        const startingPosition = this.clonePosition();

        while (true) {
            if (this.isEOF) {
                break;
            }
            const ch = this.char;
            if (WHITESPACE_RE.test(ch) || PATTERN_SYNTAX_RE.test(ch)) {
                break;
            }
            this.bump();
        }

        const endPosition = this.clonePosition();
        const location = createLocation(startingPosition, endPosition);

        return {
            value: this.message.slice(startingPosition.offset, endPosition.offset),
            location,
        };
    }

    private parseArgumentOptions(
        nestingLevel: number,
        expectingCloseTag: boolean,
        value: string,
        openingBracePosition: Position,
    ): Result<MessageFormatElement, ParserError> {
        // Parse this range:
        // {name, type, style}
        //        ^---^
        let typeStartPosition = this.clonePosition();
        let argType = this.parseIdentifierIfPossible().value;
        let typeEndPosition = this.clonePosition();

        switch (argType) {
            case '':
                // Expecting a style string number, date, time, plural, selectordinal, or select.
                return this.error(
                    ErrorKind.EXPECT_ARGUMENT_TYPE,
                    createLocation(typeStartPosition, typeEndPosition),
                );
            case 'number':
            case 'date':
            case 'time': {
                // Parse this range:
                // {name, number, style}
                //              ^-------^
                this.bumpSpace();
                let styleAndLocation: {style: string; styleLocation: Location} | null = null;

                if (this.bumpIf(',')) {
                    this.bumpSpace();

                    const styleStartPosition = this.clonePosition();
                    const result = this.parseSimpleArgStyleIfPossible();
                    if (result.err) {
                        return result;
                    }
                    const style = result.val.trimEnd();

                    if (style.length === 0) {
                        return this.error(
                            ErrorKind.EXPECT_ARGUMENT_STYLE,
                            createLocation(this.clonePosition(), this.clonePosition()),
                        );
                    }

                    const styleLocation = createLocation(styleStartPosition, this.clonePosition());
                    styleAndLocation = {style, styleLocation};
                }

                const argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                if (argCloseResult.err) {
                    return argCloseResult;
                }

                const location = createLocation(openingBracePosition, this.clonePosition());

                // Extract style or skeleton
                if (styleAndLocation?.style.startsWith('::')) {
                    // Skeleton starts with `::`.
                    const skeleton = styleAndLocation.style.slice(2).trimStart();

                    if (argType === 'number') {
                        const result = this.parseNumberSkeletonFromString(
                            skeleton,
                            styleAndLocation.styleLocation,
                        );
                        if (result.err) {
                            return result;
                        }
                        return {
                            val: {type: TYPE.number, value, location, style: result.val},
                            err: null,
                        };
                    } else {
                        if (skeleton.length === 0) {
                            return this.error(ErrorKind.EXPECT_DATE_TIME_SKELETON, location);
                        }
                        const style: DateTimeSkeleton = {
                            type: SKELETON_TYPE.dateTime,
                            pattern: skeleton,
                            location: styleAndLocation.styleLocation,
                            // TODO: parse this
                            parsedOptions: {},
                        };

                        const type = argType === 'date' ? TYPE.date : TYPE.time;
                        return {
                            val: {type, value, location, style},
                            err: null,
                        };
                    }
                }

                // Regular style or no style.
                return {
                    val: {
                        type:
                            argType === 'number'
                                ? TYPE.number
                                : argType === 'date'
                                ? TYPE.date
                                : TYPE.time,
                        value,
                        location,
                        style: styleAndLocation?.style ?? null,
                    },
                    err: null,
                };
            }
            case 'plural':
            case 'selectordinal':
            case 'select': {
                // Parse this range:
                // {name, plural, options}
                //              ^---------^
                const typeEndPosition = this.clonePosition();
                this.bumpSpace();

                if (!this.bumpIf(',')) {
                    return this.error(
                        ErrorKind.EXPECT_SELECT_ARGUMENT_OPTIONS,
                        createLocation(typeEndPosition, {...typeEndPosition}),
                    );
                }
                this.bumpSpace();

                // Parse offset:
                // {name, plural, offset:1, options}
                //                ^-----^
                //
                // or the first option:
                //
                // {name, plural, one {...} other {...}}
                //                ^--^
                let identifierAndLocation = this.parseIdentifierIfPossible();

                let pluralOffset = 0;
                if (argType !== 'select' && identifierAndLocation.value === 'offset') {
                    if (!this.bumpIf(':')) {
                        return this.error(
                            ErrorKind.EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE,
                            createLocation(this.clonePosition(), this.clonePosition()),
                        );
                    }
                    this.bumpSpace();
                    const result = this.tryParseDecimalInteger(
                        ErrorKind.EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE,
                        ErrorKind.INVALID_PLURAL_ARGUMENT_OFFSET_VALUE,
                    );
                    if (result.err) {
                        return result;
                    }

                    // Parse another identifier for option parsing
                    this.bumpSpace();
                    identifierAndLocation = this.parseIdentifierIfPossible();

                    pluralOffset = result.val;
                }

                const optionsResult = this.tryParsePluralOrSelectOptions(
                    nestingLevel,
                    argType,
                    expectingCloseTag,
                    identifierAndLocation,
                );
                if (optionsResult.err) {
                    return optionsResult;
                }

                const argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                if (argCloseResult.err) {
                    return argCloseResult;
                }

                const location = createLocation(openingBracePosition, this.clonePosition());

                if (argType === 'select') {
                    return {
                        val: {
                            type: TYPE.select,
                            value,
                            options: Object.fromEntries(optionsResult.val),
                            location,
                        },
                        err: null,
                    };
                } else {
                    return {
                        val: {
                            type: TYPE.plural,
                            value,
                            options: Object.fromEntries(optionsResult.val),
                            offset: pluralOffset,
                            pluralType: argType === 'plural' ? 'cardinal' : 'ordinal',
                            location,
                        },
                        err: null,
                    };
                }
            }
            default:
                return this.error(
                    ErrorKind.INVALID_ARGUMENT_TYPE,
                    createLocation(typeStartPosition, typeEndPosition),
                );
        }
    }

    private tryParseArgumentClose(openingBracePosition: Position): Result<true, ParserError> {
        // Parse: {value, number, ::currency/GBP }
        //
        if (this.isEOF || this.char !== '}') {
            return this.error(
                ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE,
                createLocation(openingBracePosition, this.clonePosition()),
            );
        }
        this.bump(); // `}`
        return {val: true, err: null};
    }

    /**
     * See: https://github.com/unicode-org/icu/blob/af7ed1f6d2298013dc303628438ec4abe1f16479/icu4c/source/common/messagepattern.cpp#L659
     */
    private parseSimpleArgStyleIfPossible(): Result<string, ParserError> {
        let nestedBraces = 0;

        const startPosition = this.clonePosition();
        while (!this.isEOF) {
            const ch = this.char;
            switch (ch) {
                case "'": {
                    // Treat apostrophe as quoting but include it in the style part.
                    // Find the end of the quoted literal text.
                    this.bump();
                    let apostrophePosition = this.clonePosition();

                    if (!this.bumpUntil("'")) {
                        return this.error(
                            ErrorKind.UNCLOSED_QUOTE_IN_ARGUMENT_STYLE,
                            createLocation(apostrophePosition, this.clonePosition()),
                        );
                    }
                    this.bump();
                }
                case '{': {
                    nestedBraces += 1;
                    this.bump();
                }
                case '}': {
                    if (nestedBraces > 0) {
                        nestedBraces -= 1;
                    } else {
                        return {
                            val: this.message.slice(startPosition.offset, this.offset),
                            err: null,
                        };
                    }
                }
                default:
                    this.bump();
            }
        }
        return {
            val: this.message.slice(startPosition.offset, this.offset),
            err: null,
        };
    }

    private parseNumberSkeletonFromString(
        skeleton: string,
        location: Location,
    ): Result<NumberSkeleton, ParserError> {
        if (skeleton.length === 0) {
            return this.error(ErrorKind.EXPECT_NUMBER_SKELETON, location);
        }
        // Parse the skeleton
        const stringTokens = skeleton.split(/\p{White_Space}/u).filter((x) => x.length > 0);

        const tokens: NumberSkeletonToken[] = [];
        for (const stringToken of stringTokens) {
            let stemAndOptions = stringToken.split('/');
            if (stemAndOptions.length === 0) {
                return this.error(ErrorKind.INVALID_NUMBER_SKELETON, location);
            }

            const [stem, ...options] = stemAndOptions;
            for (const option of options) {
                if (option.length === 0) {
                    return this.error(ErrorKind.INVALID_NUMBER_SKELETON, location);
                }
            }

            tokens.push({stem, options});
        }

        return {
            val: {
                type: SKELETON_TYPE.number,
                tokens,
                location,
                // TODO
                parsedOptions: {},
            },
            err: null,
        };
    }

    /**
     * @param nesting_level The current nesting level of messages.
     *     This can be positive when parsing message fragment in select or plural argument options.
     * @param parent_arg_type The parent argument's type.
     * @param parsed_first_identifier If provided, this is the first identifier-like selector of
     *     the argument. It is a by-product of a previous parsing attempt.
     * @param expecting_close_tag If true, this message is directly or indirectly nested inside
     *     between a pair of opening and closing tags. The nested message will not parse beyond
     *     the closing tag boundary.
     */
    private tryParsePluralOrSelectOptions(
        nestingLevel: number,
        parentArgType: ArgType,
        expectCloseTag: boolean,
        parsedFirstIdentifier: {value: string; location: Location},
    ): Result<[string, PluralOrSelectOption][], ParserError> {
        let hasOtherClause = false;
        const options: [string, PluralOrSelectOption][] = [];
        const parsedSelectors = new Set<string>();
        let {value: selector, location: selectorLocation} = parsedFirstIdentifier;

        // Parse:
        // one {one apple}
        // ^--^
        while (true) {
            if (selector.length === 0) {
                const startPosition = this.clonePosition();
                if (parentArgType !== 'select' && this.bumpIf('=')) {
                    // Try parse `={number}` selector
                    const result = this.tryParseDecimalInteger(
                        ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR,
                        ErrorKind.INVALID_PLURAL_ARGUMENT_SELECTOR,
                    );
                    if (result.err) {
                        return result;
                    }
                    selectorLocation = createLocation(startPosition, this.clonePosition());
                    selector = this.message.slice(startPosition.offset, this.offset);
                } else {
                    break;
                }
            }

            // Duplicate selector clauses
            if (parsedSelectors.has(selector)) {
                return this.error(
                    parentArgType === 'select'
                        ? ErrorKind.DUPLICATE_SELECT_ARGUMENT_SELECTOR
                        : ErrorKind.DUPLICATE_PLURAL_ARGUMENT_SELECTOR,
                    selectorLocation,
                );
            }

            if (selector === 'other') {
                hasOtherClause = true;
            }

            // Parse:
            // one {one apple}
            //     ^----------^
            this.bumpSpace();
            const openingBracePosition = this.clonePosition();
            if (!this.bumpIf('{')) {
                return this.error(
                    parentArgType === 'select'
                        ? ErrorKind.EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT
                        : ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT,
                    createLocation(this.clonePosition(), this.clonePosition()),
                );
            }

            const fragmentResult = this.parseMessage(
                nestingLevel + 1,
                parentArgType,
                expectCloseTag,
            );
            if (fragmentResult.err) {
                return fragmentResult;
            }
            const argCloseResult = this.tryParseArgumentClose(openingBracePosition);
            if (argCloseResult.err) {
                return argCloseResult;
            }

            options.push([
                selector,
                {
                    value: fragmentResult.val,
                    location: createLocation(openingBracePosition, this.clonePosition()),
                },
            ]);
            // Keep track of the existing selectors
            parsedSelectors.add(selector);

            // Prep next selector clause.
            this.bumpSpace();

            ({value: selector, location: selectorLocation} = this.parseIdentifierIfPossible());
        }

        if (options.length === 0) {
            return this.error(
                parentArgType === 'select'
                    ? ErrorKind.EXPECT_SELECT_ARGUMENT_SELECTOR
                    : ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR,
                createLocation(this.clonePosition(), this.clonePosition()),
            );
        }

        // TODO: make this configurable
        const requiresOtherClause = false;
        if (requiresOtherClause && !hasOtherClause) {
            return this.error(
                ErrorKind.MISSING_OTHER_CLAUSE,
                createLocation(this.clonePosition(), this.clonePosition()),
            );
        }

        return {val: options, err: null};
    }

    private tryParseDecimalInteger(
        expectNumberError: ErrorKind,
        invalidNumberError: ErrorKind,
    ): Result<number, ParserError> {
        let sign = 1;
        const startingPosition = this.clonePosition();

        if (this.bumpIf('+')) {
        } else if (this.bumpIf('-')) {
            sign = -1;
        }

        let digits = '';
        while (!this.isEOF) {
            const ch = this.char;
            if (ch >= '0' && ch <= '9') {
                digits += ch;
                this.bump();
            } else {
                break;
            }
        }

        const location = createLocation(startingPosition, this.clonePosition());

        if (digits.length === 0) {
            return this.error(expectNumberError, location);
        }

        const decimal = parseInt(digits, 10) * sign;
        if (!Number.isSafeInteger(decimal)) {
            return this.error(invalidNumberError, location);
        }

        return {val: decimal, err: null};
    }

    private get offset(): number {
        return this.position.offset;
    }

    private get isEOF(): boolean {
        return this.offset === this.message.length;
    }

    private clonePosition(): Position {
        return {
            offset: this.position.offset,
            line: this.position.line,
            column: this.position.column,
        };
    }

    private get codePoint(): number {
        const offset = this.position.offset;
        if (offset >= this.message.length) {
            throw Error('out of bound');
        }
        const code = this.message.codePointAt(offset);
        if (code === undefined) {
            throw Error(`Offset ${offset} is at invalid UTF-16 code unit boundary`);
        }
        return code;
    }

    /**
     * Return the character at the current position of the parser.
     * Throws if the index is out of bound.
     */
    private get char(): string {
        return String.fromCodePoint(this.codePoint);
    }

    private error(kind: ErrorKind, location: Location): Result<never, ParserError> {
        return {
            val: null,
            err: {
                kind,
                message: this.message,
                location,
            },
        };
    }

    /** Bump the parser to the next UTF-16 code unit. */
    private bump(): void {
        if (this.isEOF) {
            return;
        }
        const code = this.codePoint;
        if (code === 10 /* '\n' */) {
            this.position.line += 1;
            this.position.column = 1;
            this.position.offset += 1;
        } else {
            this.position.column += 1;
            // 0 ~ 0x10000 -> unicode BMP, otherwise skip the surrogate pair.
            this.position.offset += code < 0x10000 ? 1 : 2;
        }
    }

    /**
     * If the substring starting at the current position of the parser has
     * the given prefix, then bump the parser to the character immediately
     * following the prefix and return true. Otherwise, don't bump the parser
     * and return false.
     */
    private bumpIf(prefix: string): boolean {
        if (this.message.startsWith(prefix, this.offset)) {
            for (let i = 0; i < prefix.length; i++) {
                this.bump();
            }
            return true;
        }
        return false;
    }

    /**
     * Bump the parser until the pattern character is found and return `true`.
     * Otherwise bump to the end of the file and return `false`.
     */
    private bumpUntil(pattern: string): boolean {
        const currentOffset = this.offset;
        const index = this.message.indexOf(pattern, currentOffset);
        if (index >= 0) {
            this.bumpTo(index);
            return true;
        } else {
            this.bumpTo(this.message.length);
            return false;
        }
    }

    /**
     * Bump the parser to the target offset.
     * If target offset is beyond the end of the input, bump the parser to the end of the input.
     */
    private bumpTo(targetOffset: number) {
        if (this.offset > targetOffset) {
            throw Error(
                `targetOffset ${targetOffset} must be greater than or equal to the current offset ${this.offset}`,
            );
        }

        targetOffset = Math.min(targetOffset, this.message.length);
        while (true) {
            const offset = this.offset;
            if (offset === targetOffset) {
                break;
            }
            if (offset > targetOffset) {
                throw Error(`targetOffset ${targetOffset} is at invalid UTF-16 code unit boundary`);
            }

            this.bump();
            if (this.isEOF) {
                break;
            }
        }
    }

    /** advance the parser through all whitespace to the next non-whitespace code unit. */
    private bumpSpace() {
        while (!this.isEOF && WHITESPACE_RE.test(this.char)) {
            this.bump();
        }
    }

    /**
     * Peek at the *next* Unicode codepoint in the input without advancing the parser.
     * If the input has been exhausted, then this returns null.
     */
    private peek(): number | null {
        if (this.isEOF) {
            return null;
        }
        const code = this.codePoint;
        const offset = this.offset;
        const nextCode = this.message.charCodeAt(offset + (code >= 0x10000 ? 2 : 1));
        return nextCode ?? null;
    }
}

function _isAlpha(codepoint: number): boolean {
    return codepoint >= 97 && codepoint <= 122;
}

function _isAlphaOrSlash(codepoint: number): boolean {
    return _isAlpha(codepoint) || codepoint === 47 /* '/' */;
}

function _isPotentialElementNameChar(codepoint: number): boolean {
    return (
        codepoint === 45 /* '-' */ ||
        codepoint === 46 /* '.' */ ||
        (codepoint >= 48 && codepoint <= 57) /* 0..9 */ ||
        codepoint === 95 /* '_' */ ||
        (codepoint >= 97 && codepoint <= 122) /** a..z */ ||
        (codepoint >= 65 && codepoint <= 90) /* A..Z */ ||
        codepoint == 0xb7 ||
        (codepoint >= 0xc0 && codepoint <= 0xd6) ||
        (codepoint >= 0xd8 && codepoint <= 0xf6) ||
        (codepoint >= 0xf8 && codepoint <= 0x37d) ||
        (codepoint >= 0x37f && codepoint <= 0x1fff) ||
        (codepoint >= 0x200c && codepoint <= 0x200d) ||
        (codepoint >= 0x203f && codepoint <= 0x2040) ||
        (codepoint >= 0x2070 && codepoint <= 0x218f) ||
        (codepoint >= 0x2c00 && codepoint <= 0x2fef) ||
        (codepoint >= 0x3001 && codepoint <= 0xd7ff) ||
        (codepoint >= 0xf900 && codepoint <= 0xfdcf) ||
        (codepoint >= 0xfdf0 && codepoint <= 0xfffd) ||
        (codepoint >= 0x10000 && codepoint <= 0xeffff)
    );
}
