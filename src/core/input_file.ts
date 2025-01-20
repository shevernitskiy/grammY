// === Needed imports
import { basename } from "node:path";

import type {
    ApiMethods as ApiMethodsF,
    InputMedia as InputMediaF,
    InputMediaAnimation as InputMediaAnimationF,
    InputMediaAudio as InputMediaAudioF,
    InputMediaDocument as InputMediaDocumentF,
    InputMediaPhoto as InputMediaPhotoF,
    InputMediaVideo as InputMediaVideoF,
    InputPaidMedia as InputPaidMediaF,
    InputPaidMediaPhoto as InputPaidMediaPhotoF,
    InputPaidMediaVideo as InputPaidMediaVideoF,
    InputSticker as InputStickerF,
    Opts as OptsF,
} from "../temporary_types/mod.ts";
/** Are we running on Deno or in a web browser? */
export const isDeno = typeof Deno !== "undefined";

// === Export all API types
export * from "../temporary_types/mod.ts";

type MaybePromise<T> = T | Promise<T>;

function preprocess(data: ConstructorParameters<typeof InputFile>[0]) {
    if ("base64" in data) return new URL(`data:;base64,${data.base64}`);
    if ("readable" in data) return data.readable;
    if (data instanceof Response) return data;
    if ("url" in data) return new URL(data.url);
    return data;
}

/**
 * An `InputFile` wraps a number of different sources for [sending
 * files](https://grammy.dev/guide/files#uploading-your-own-files).
 *
 * It corresponds to the `InputFile` type in the [Telegram Bot API
 * Reference](https://core.telegram.org/bots/api#inputfile).
 */
export class InputFile {
    private consumed = false;
    private readonly fileData: ReturnType<typeof preprocess>;
    /**
     * Optional name of the constructed `InputFile` instance.
     *
     * Check out the
     * [documentation](https://grammy.dev/guide/files#uploading-your-own-files)
     * on sending files with `InputFile`.
     */
    public readonly name?: string;
    /**
     * Constructs an `InputFile` that can be used in the API to send files.
     *
     * @param file A path to a local file or a `Buffer` or a `ReadableStream` that specifies the file data
     * @param filename Optional name of the file
     */
    constructor(
        file:
            | { path: string }
            | { url: string }
            | URL
            | Blob
            | Response
            | Uint8Array
            | AsyncIterable<Uint8Array>
            | (() => MaybePromise<AsyncIterable<Uint8Array>>)
            | { readable: AsyncIterable<Uint8Array> }
            | { base64: string },
        filename?: string,
    ) {
        this.fileData = preprocess(file);
        this.name = filename ?? this.guessFilename();
    }

    private guessFilename(): string | undefined {
        let file = this.fileData;
        if ("path" in file && typeof file.path === "string") {
            return basename(file.path);
        }
        if ("url" in file && file.url) file = new URL(file.url);
        if (file instanceof File) return file.name;
        if (!(file instanceof URL)) return undefined;
        if (file.pathname !== "/") {
            const filename = basename(file.pathname);
            if (filename) return filename;
        }
        return basename(file.hostname);
    }

    /**
     * Converts this instance into a binary representation that can be sent to
     * the Bot API server in the request body.
     */
    async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array, undefined> {
        // prefer extending `preprocess` -- it's not re-ran on retry
        const data = this.fileData;
        if (this.consumed) {
            throw new TypeError("Cannot reuse InputFile data source!");
        } else if (typeof data === "function") {
            yield* await data();
        } else if (data instanceof Uint8Array) {
            yield data;
        } else if ("stream" in data) {
            yield* data.stream();
        } else if (Symbol.asyncIterator in data) {
            this.consumed = true;
            yield* data;
        } else if ("path" in data) {
            yield* await readFile(data.path);
        } else if (data instanceof Response) {
            if (data.body === null) throw new ResponseError(data);
            this.consumed = true;
            yield* data.body;
        } else if (data instanceof URL) {
            yield* await fetchFile(data);
        } else {
            assertNever(data);
        }
    }
}

export class ResponseError extends Error {
    readonly error_code: number;
    constructor(readonly response: Response) {
        let message = response.body ? response.statusText : "No response body";
        if (response.url) message += ` from ${response.url}`;
        super(message);
        this.name = ResponseError.name;
        this.error_code = response.status;
    }
}

export function assertNever(data: never): never {
    const { toString } = Object.prototype;
    throw new TypeError(`Unexpected ${toString.call(data)}!`);
}

async function readFile(path: string): Promise<AsyncIterable<Uint8Array>> {
    if (isDeno) {
        const file = await Deno.open(path);
        return file.readable;
    }
    const fs = globalThis.process.getBuiltinModule("node:fs");
    return fs.createReadStream(path);
}

async function fetchFile(url: URL): Promise<AsyncIterable<Uint8Array>> {
    // https://github.com/nodejs/undici/issues/2751
    if (url.protocol === "file") return await readFile(url.pathname);

    const response = await fetch(url);
    if (!response.ok || response.body === null) {
        throw new ResponseError(response);
    }
    return response.body;
}

// === Export InputFile types
// TODO(@wojpawlik) remove after #720
/** Wrapper type to bundle all methods of the Telegram API */
export type ApiMethods = ApiMethodsF<InputFile>;

/** Utility type providing the argument type for the given method name or `{}` if the method does not take any parameters */
export type Opts<M extends keyof ApiMethods> = OptsF<InputFile>[M];

/** This object describes a sticker to be added to a sticker set. */
export type InputSticker = InputStickerF<InputFile>;

/** This object represents the content of a media message to be sent. It should be one of
- InputMediaAnimation
- InputMediaDocument
- InputMediaAudio
- InputMediaPhoto
- InputMediaVideo */
export type InputMedia = InputMediaF<InputFile>;
/** Represents a photo to be sent. */
export type InputMediaPhoto = InputMediaPhotoF<InputFile>;
/** Represents a video to be sent. */
export type InputMediaVideo = InputMediaVideoF<InputFile>;
/** Represents an animation file (GIF or H.264/MPEG-4 AVC video without sound) to be sent. */
export type InputMediaAnimation = InputMediaAnimationF<InputFile>;
/** Represents an audio file to be treated as music to be sent. */
export type InputMediaAudio = InputMediaAudioF<InputFile>;
/** Represents a general file to be sent. */
export type InputMediaDocument = InputMediaDocumentF<InputFile>;
/** This object describes the paid media to be sent. Currently, it can be one of
- InputPaidMediaPhoto
- InputPaidMediaVideo */
export type InputPaidMedia = InputPaidMediaF<InputFile>;
/** The paid media to send is a photo. */
export type InputPaidMediaPhoto = InputPaidMediaPhotoF<InputFile>;
/** The paid media to send is a video. */
export type InputPaidMediaVideo = InputPaidMediaVideoF<InputFile>;