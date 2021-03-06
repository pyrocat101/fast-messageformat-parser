import type {NumberFormatOptions} from '@formatjs/ecma402-abstract';

export interface ExtendedNumberFormatOptions extends NumberFormatOptions {
    scale?: number;
}

export enum TYPE {
    /**
     * Raw text
     */
    literal,
    /**
     * Variable w/o any format, e.g `var` in `this is a {var}`
     */
    argument,
    /**
     * Variable w/ number format
     */
    number,
    /**
     * Variable w/ date format
     */
    date,
    /**
     * Variable w/ time format
     */
    time,
    /**
     * Variable w/ select format
     */
    select,
    /**
     * Variable w/ plural format
     */
    plural,
    /**
     * Only possible within plural argument.
     * This is the `#` symbol that will be substituted with the count.
     */
    pound,
    /**
     * XML-like tag
     */
    tag,
}

export enum SKELETON_TYPE {
    number,
    dateTime,
}

export interface LocationDetails {
    offset: number;
    line: number;
    column: number;
}
export interface Location {
    start: LocationDetails;
    end: LocationDetails;
}

export interface BaseElement<T extends TYPE> {
    type: T;
    value: string;
    location?: Location;
}

export type LiteralElement = BaseElement<TYPE.literal>;
export type ArgumentElement = BaseElement<TYPE.argument>;
export interface TagElement {
    type: TYPE.tag;
    value: string;
    children: MessageFormatElement[];
    location?: Location;
}

export interface SimpleFormatElement<T extends TYPE, S extends Skeleton> extends BaseElement<T> {
    style?: string | S | null;
}

export type NumberElement = SimpleFormatElement<TYPE.number, NumberSkeleton>;
export type DateElement = SimpleFormatElement<TYPE.date, DateTimeSkeleton>;
export type TimeElement = SimpleFormatElement<TYPE.time, DateTimeSkeleton>;

export interface SelectOption {
    id: string;
    value: MessageFormatElement[];
    location?: Location;
}

export type ValidPluralRule = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other' | string;

export interface PluralOrSelectOption {
    value: MessageFormatElement[];
    location?: Location;
}

export interface SelectElement extends BaseElement<TYPE.select> {
    options: Record<string, PluralOrSelectOption>;
}

export interface PluralElement extends BaseElement<TYPE.plural> {
    options: Record<ValidPluralRule, PluralOrSelectOption>;
    offset: number;
    pluralType: Intl.PluralRulesOptions['type'];
}

export interface PoundElement {
    type: TYPE.pound;
    location?: Location;
}

export type MessageFormatElement =
    | LiteralElement
    | ArgumentElement
    | NumberElement
    | DateElement
    | TimeElement
    | SelectElement
    | PluralElement
    | TagElement
    | PoundElement;

export interface NumberSkeletonToken {
    stem: string;
    options: string[];
}

export interface NumberSkeleton {
    type: SKELETON_TYPE.number;
    tokens: NumberSkeletonToken[];
    location?: Location;
    parsedOptions: ExtendedNumberFormatOptions;
}

export interface DateTimeSkeleton {
    type: SKELETON_TYPE.dateTime;
    pattern: string;
    location?: Location;
    parsedOptions: Intl.DateTimeFormatOptions;
}

export type Skeleton = NumberSkeleton | DateTimeSkeleton;

// export interface Options {
//     /**
//      * Whether to convert `#` in plural rule options
//      * to `{var, number}`
//      * Default is true
//      */
//     normalizeHashtagInPlural?: boolean;
//     /**
//      * Whether to parse number/datetime skeleton
//      * into Intl.NumberFormatOptions & Intl.DateTimeFormatOptions
//      */
//     shouldParseSkeletons?: boolean;
//     /**
//      * Capture location info in AST
//      * Default is false
//      */
//     captureLocation?: boolean;
//     /**
//      * Whether to treat HTML/XML tags as string literal
//      * instead of parsing them as tag token.
//      * When this is false we only allow simple tags without
//      * any attributes
//      */
//     ignoreTag?: boolean;
// }
