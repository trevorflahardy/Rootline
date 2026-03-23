import { describe, it, expect } from "vitest";
import {
  documentTypeEnum,
  uploadDocumentSchema,
  updateDocumentSchema,
  MAX_DOCUMENT_SIZE,
  ALLOWED_DOCUMENT_MIMES,
} from "./document";

describe("documentTypeEnum", () => {
  const validTypes = [
    "birth_certificate",
    "marriage_license",
    "death_certificate",
    "immigration",
    "legal",
    "medical",
    "photo_album",
    "other",
  ];

  it.each(validTypes)("accepts valid document type: %s", (type) => {
    expect(documentTypeEnum.parse(type)).toBe(type);
  });

  it("rejects invalid document type", () => {
    expect(() => documentTypeEnum.parse("passport")).toThrow();
    expect(() => documentTypeEnum.parse("")).toThrow();
    expect(() => documentTypeEnum.parse(123)).toThrow();
  });
});

describe("uploadDocumentSchema", () => {
  it("validates with required document_type", () => {
    const result = uploadDocumentSchema.parse({
      document_type: "birth_certificate",
    });
    expect(result.document_type).toBe("birth_certificate");
    expect(result.is_private).toBe(false);
  });

  it("accepts optional description and is_private", () => {
    const result = uploadDocumentSchema.parse({
      document_type: "legal",
      description: "Court order from 2020",
      is_private: true,
    });
    expect(result.description).toBe("Court order from 2020");
    expect(result.is_private).toBe(true);
  });

  it("defaults is_private to false", () => {
    const result = uploadDocumentSchema.parse({
      document_type: "other",
    });
    expect(result.is_private).toBe(false);
  });

  it("rejects missing document_type", () => {
    expect(() => uploadDocumentSchema.parse({})).toThrow();
  });

  it("rejects invalid document_type", () => {
    expect(() =>
      uploadDocumentSchema.parse({ document_type: "invalid" })
    ).toThrow();
  });

  it("rejects description over 500 characters", () => {
    expect(() =>
      uploadDocumentSchema.parse({
        document_type: "other",
        description: "a".repeat(501),
      })
    ).toThrow();
  });
});

describe("updateDocumentSchema", () => {
  it("allows partial updates", () => {
    const result = updateDocumentSchema.parse({
      description: "Updated description",
    });
    expect(result.description).toBe("Updated description");
    expect(result.document_type).toBeUndefined();
    expect(result.is_private).toBeUndefined();
  });

  it("allows empty object (no changes)", () => {
    const result = updateDocumentSchema.parse({});
    expect(result).toEqual({});
  });

  it("validates document_type when provided", () => {
    const result = updateDocumentSchema.parse({
      document_type: "immigration",
    });
    expect(result.document_type).toBe("immigration");
  });

  it("rejects invalid document_type when provided", () => {
    expect(() =>
      updateDocumentSchema.parse({ document_type: "invalid" })
    ).toThrow();
  });
});

describe("constants", () => {
  it("MAX_DOCUMENT_SIZE is 25MB", () => {
    expect(MAX_DOCUMENT_SIZE).toBe(25 * 1024 * 1024);
  });

  it("ALLOWED_DOCUMENT_MIMES has expected types", () => {
    expect(ALLOWED_DOCUMENT_MIMES).toContain("application/pdf");
    expect(ALLOWED_DOCUMENT_MIMES).toContain("image/jpeg");
    expect(ALLOWED_DOCUMENT_MIMES).toContain("image/png");
    expect(ALLOWED_DOCUMENT_MIMES).toContain("image/webp");
    expect(ALLOWED_DOCUMENT_MIMES).toContain("application/msword");
    expect(ALLOWED_DOCUMENT_MIMES).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(ALLOWED_DOCUMENT_MIMES).toHaveLength(6);
  });
});
