/**
 * TypeScript type definitions for the Invoice Reconciliation System
 */

export interface LineItem {
  productName: string;
  quantity: number | string;
  unitPrice?: number | string;
  totalPrice?: number | string;
  price?: number | string; // Backwards compatibility
  deliveryDate?: string;
}

export interface InvoiceData {
  poNumber: string;
  invoiceDate?: string;
  lineItems: LineItem[];
}

export interface PurchaseOrderRecord {
  PurchaseOrderID: string;
  PurchaseQty: number | string;
  PurchasePrice: number | string;
  DateRequired: string;
  PurchaseSupplierItem: string;
  PurchaseSupplierDescription: string;
}

export interface ReconciliationResult {
  Source: "📄 INVOICE" | "📋 PO";
  "PO #": string;
  "Item/Description": string;
  Qty: number;
  "Unit Price": number;
  "Total Price": number;
  Date: string;
  Status: "MATCH" | "DISCREPANCY" | "NO MATCH";
  _qty_match?: boolean;
  _price_match?: boolean;
  _date_match?: boolean;
}

export interface ReconciliationSummary {
  totalItems: number;
  matches: number;
  discrepancies: number;
  noMatches: number;
}

export interface MatchingOptions {
  quantityTolerance?: number;
  priceTolerance?: number;
  minKeywordMatches?: number;
  requireDateMatch?: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PDFProcessingResult {
  text: string;
  pageCount: number;
  fileName: string;
}

export interface ClaudeExtractionResult {
  invoiceData: InvoiceData;
  confidence: number;
  processingTime: number;
}

export interface UploadFileResponse {
  success: boolean;
  fileName: string;
  fileId: string;
  error?: string;
}

export interface PurchaseOrderDataResponse {
  success: boolean;
  data: PurchaseOrderRecord[];
  recordCount: number;
  error?: string;
}