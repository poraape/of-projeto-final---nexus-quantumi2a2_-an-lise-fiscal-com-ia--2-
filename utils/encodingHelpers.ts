import { detect, detectAll } from 'jschardet';
import type { EncodingDiagnosis } from '../types';

const FALLBACK_ENCODINGS = [
  'utf-8',
  'utf-16le',
  'utf-16be',
  'iso-8859-1',
  'windows-1252',
  'shift_jis',
  'gb2312',
  'koi8-r',
  'macroman',
];

const ENCODING_NORMALIZATION: Record<string, string> = {
  utf8: 'utf-8',
  'utf-8': 'utf-8',
  'utf_8': 'utf-8',
  unicode: 'utf-8',
  big5: 'big5',
  sjis: 'shift_jis',
  shiftjis: 'shift_jis',
  shift_jis: 'shift_jis',
  'utf-16': 'utf-16le',
  'utf-16le': 'utf-16le',
  'utf-16be': 'utf-16be',
  iso8859_1: 'iso-8859-1',
  iso_8859_1: 'iso-8859-1',
  iso8859_2: 'iso-8859-2',
  'iso-8859-1': 'iso-8859-1',
  'iso-8859-2': 'iso-8859-2',
  windows1252: 'windows-1252',
  'windows-1252': 'windows-1252',
  gb2312: 'gb2312',
  gbk: 'gbk',
  eucjp: 'euc-jp',
  'euc-jp': 'euc-jp',
  koi8r: 'koi8-r',
  'koi8-r': 'koi8-r',
  macroman: 'macroman',
};

const BOM_MAP: Record<string, number[]> = {
  'utf-8': [0xef, 0xbb, 0xbf],
  'utf-16le': [0xff, 0xfe],
  'utf-16be': [0xfe, 0xff],
};

const MAX_SAMPLE_BYTES = 128 * 1024;

export interface DecodedTextResult {
  text: string;
  encoding: EncodingDiagnosis;
  buffer: ArrayBuffer;
}

const normalizeEncoding = (encoding?: string | null): string => {
  if (!encoding) return 'utf-8';
  const key = encoding.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return ENCODING_NORMALIZATION[key] ?? encoding.toLowerCase();
};

const stripBom = (bytes: Uint8Array, encoding: string) => {
  const bom = BOM_MAP[encoding];
  if (!bom) return { bytes, stripped: false };
  const matches = bom.every((value, index) => bytes[index] === value);
  if (matches) {
    return { bytes: bytes.slice(bom.length), stripped: true };
  }
  return { bytes, stripped: false };
};

const getAttemptList = (detected: string, hints?: string[]) => {
  const normalizedDetected = normalizeEncoding(detected);
  const attempts = new Set<string>();
  if (normalizedDetected) attempts.add(normalizedDetected);
  (hints ?? []).map(normalizeEncoding).forEach((hint) => attempts.add(hint));
  FALLBACK_ENCODINGS.forEach((encoding) => attempts.add(encoding));
  return Array.from(attempts);
};

const containsReplacementChar = (text: string) => text.includes('\uFFFD');

export const decodeBufferToText = async (
  buffer: ArrayBuffer,
  fileName: string,
  mimeType?: string,
  hints?: string[]
): Promise<DecodedTextResult> => {
  const bytes = new Uint8Array(buffer);
  const sample = bytes.length > MAX_SAMPLE_BYTES ? bytes.slice(0, MAX_SAMPLE_BYTES) : bytes;
  const detection = detect(sample);
  const alternativeDetections = detectAll(sample, { minimumThreshold: 0.2 }).slice(0, 5);
  const attempts = getAttemptList(detection?.encoding ?? 'utf-8', hints);
  let decodedText = '';
  let usedEncoding = attempts[0] ?? 'utf-8';
  let bomStripped = false;

  for (const encoding of attempts) {
    try {
      const decoder = new TextDecoder(encoding as any, { fatal: false });
      const { bytes: normalizedBytes, stripped } = stripBom(bytes, encoding);
      decodedText = decoder.decode(normalizedBytes);
      bomStripped = stripped;

      if (containsReplacementChar(decodedText)) {
        // Try strict decoding; if it fails, continue with next encoding.
        try {
          const strictDecoder = new TextDecoder(encoding as any, { fatal: true });
          strictDecoder.decode(normalizedBytes);
        } catch {
          continue;
        }
      }

      usedEncoding = encoding;
      break;
    } catch {
      continue;
    }
  }

  if (!decodedText) {
    // Ultimate fallback to UTF-8 ignoring malformed sequences.
    const decoder = new TextDecoder('utf-8');
    const { bytes: normalizedBytes, stripped } = stripBom(bytes, 'utf-8');
    decodedText = decoder.decode(normalizedBytes);
    bomStripped = stripped;
    usedEncoding = 'utf-8';
  }

  const encodingDiagnosis: EncodingDiagnosis = {
    detected: normalizeEncoding(detection?.encoding),
    normalized: usedEncoding,
    confidence: detection?.confidence ?? 0,
    bomStripped,
    attemptedEncodings: Array.from(
      new Set([
        ...attempts,
        ...alternativeDetections.map((option) => normalizeEncoding(option.encoding)),
      ])
    ),
  };

  return {
    text: decodedText,
    encoding: encodingDiagnosis,
    buffer,
  };
};

export const readFileAsArrayBuffer = async (file: Blob): Promise<ArrayBuffer> => {
  if ('arrayBuffer' in file) {
    return file.arrayBuffer();
  }

  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};
