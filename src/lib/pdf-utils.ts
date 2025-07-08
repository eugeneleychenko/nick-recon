/**
 * PDF processing utilities for JavaScript/TypeScript
 * Replaces Python pypdf functionality
 */

import { PDFProcessingResult } from '../../types';

/**
 * Extract text from PDF buffer
 * Replaces Python pdf_to_text function (lines 22-28)
 */
export async function extractTextFromPDF(
  buffer: Buffer,
  fileName: string = 'uploaded.pdf'
): Promise<PDFProcessingResult> {
  try {
    // Dynamic import to avoid build issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure worker for PDF.js
    if (typeof window !== 'undefined') {
      // Browser environment - use CDN worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs`;
    } else {
      // Server environment - use local worker path or disable completely
      try {
        // Try to use the bundled worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch {
        // Fallback: disable worker entirely for server-side rendering
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdfjsLib.GlobalWorkerOptions as any).workerSrc = null;
      }
    }
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0, // Reduce logging
    });
    
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items
      const pageText = textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => item.str)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n';
    }
    
    // Clean up
    await pdfDocument.destroy();
    
    return {
      text: fullText.trim(),
      pageCount: numPages,
      fileName: fileName
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): boolean {
  // Check file type
  if (file.type !== 'application/pdf') {
    return false;
  }
  
  // Check file size (limit to 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return false;
  }
  
  // Check file name
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return false;
  }
  
  return true;
}

/**
 * Convert File to Buffer for processing
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract text from PDF file
 */
export async function processPDFFile(file: File): Promise<PDFProcessingResult> {
  if (!validatePDFFile(file)) {
    throw new Error('Invalid PDF file');
  }
  
  const buffer = await fileToBuffer(file);
  return await extractTextFromPDF(buffer, file.name);
}

/**
 * Clean extracted text for better processing
 */
export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n') // Handle remaining carriage returns
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Extract specific patterns from text (helper function)
 */
export function extractPatterns(text: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(...match);
    }
  }
  
  return matches;
}

/**
 * Common PDF processing error types
 */
export enum PDFProcessingError {
  INVALID_FILE = 'INVALID_FILE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  CORRUPTED_PDF = 'CORRUPTED_PDF',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  EMPTY_PDF = 'EMPTY_PDF'
}

/**
 * Custom error class for PDF processing
 */
export class PDFProcessingException extends Error {
  constructor(
    public errorType: PDFProcessingError,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PDFProcessingException';
  }
}