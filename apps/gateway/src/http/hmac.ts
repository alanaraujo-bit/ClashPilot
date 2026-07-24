/**
 * A assinatura vive em `@clashpilot/contracts` porque web e gateway precisam calcular
 * exatamente a mesma string. Este arquivo só reexporta, para não haver duas implementações.
 */
export {
  DEFAULT_WINDOW_MS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  canonicalBody,
  sign,
  signedHeaders,
  signingPayload,
  verify,
  type VerifyResult,
} from "@clashpilot/contracts";
