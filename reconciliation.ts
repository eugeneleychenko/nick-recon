/**
 * Core reconciliation algorithm for Invoice to PO matching
 * Ported from Python reconciliation algorithm (lines 77-226)
 */

import { 
  InvoiceData, 
  PurchaseOrderRecord, 
  ReconciliationResult, 
  ReconciliationSummary, 
  MatchingOptions,
  LineItem 
} from './types';
import { standardizeDate, datesEqual } from './dateUtils';

/**
 * Main reconciliation function that matches invoice line items with purchase order data
 * Ported from Python reconcile_invoice_data function (lines 77-226)
 */
export function reconcileInvoiceData(
  invoiceData: InvoiceData,
  poRecords: PurchaseOrderRecord[],
  options: MatchingOptions = {}
): ReconciliationResult[] {
  const reconciliationResults: ReconciliationResult[] = [];
  
  // Set default options
  const opts: Required<MatchingOptions> = {
    quantityTolerance: 0.01,
    priceTolerance: 0.01,
    minKeywordMatches: 3,
    requireDateMatch: false,
    ...options
  };

  if (!poRecords || poRecords.length === 0) {
    return reconciliationResults;
  }

  const poNumber = invoiceData.poNumber || "";
  const lineItems = invoiceData.lineItems || [];

  // Filter PO data by PO number
  const matchingPOs = poRecords.filter(po => po.PurchaseOrderID === poNumber);

  for (const item of lineItems) {
    const itemName = item.productName || "";
    const invoiceQty = parseFloat(item.quantity?.toString() || "0");
    const itemDeliveryDate = item.deliveryDate || "";

    // Calculate unit price - prefer unitPrice if available, otherwise calculate from totalPrice
    let invoicePrice: number;
    if (item.unitPrice && item.unitPrice !== 0) {
      invoicePrice = parseFloat(item.unitPrice.toString());
    } else if (item.totalPrice && item.totalPrice !== 0 && invoiceQty !== 0) {
      invoicePrice = parseFloat(item.totalPrice.toString()) / invoiceQty;
    } else {
      // Fallback to old "price" field for backwards compatibility
      invoicePrice = parseFloat(item.price?.toString() || "0");
    }

    // Enhanced matching logic - try multiple approaches with quantity/price consideration
    let poCandidates: PurchaseOrderRecord[] = [];

    // First try exact item code matching
    poCandidates = matchingPOs.filter(po => 
      po.PurchaseSupplierItem && 
      po.PurchaseSupplierItem.toLowerCase().includes(itemName.toLowerCase())
    );

    // If no match, try description matching
    if (poCandidates.length === 0) {
      poCandidates = matchingPOs.filter(po => 
        po.PurchaseSupplierDescription && 
        po.PurchaseSupplierDescription.toLowerCase().includes(itemName.toLowerCase())
      );
    }

    // If still no match, try keyword matching (split and match key terms)
    if (poCandidates.length === 0) {
      const itemKeywords = itemName.toUpperCase().split(/\s+/).filter(keyword => keyword.length > 0);
      const candidateRows: PurchaseOrderRecord[] = [];
      
      for (const poRow of matchingPOs) {
        const poDesc = (poRow.PurchaseSupplierDescription || "").toUpperCase();
        const poItem = (poRow.PurchaseSupplierItem || "").toUpperCase();
        
        // Check if key terms match
        const keywordMatches = itemKeywords.reduce((count, keyword) => {
          return count + (poDesc.includes(keyword) || poItem.includes(keyword) ? 1 : 0);
        }, 0);
        
        const minMatches = Math.min(opts.minKeywordMatches, Math.floor(itemKeywords.length / 2));
        if (keywordMatches >= minMatches) {
          candidateRows.push(poRow);
        }
      }
      
      if (candidateRows.length > 0) {
        poCandidates = candidateRows;
      }
    }

    // Now find the best match based on quantity and price
    let poMatch: PurchaseOrderRecord | null = null;
    
    if (poCandidates.length > 0) {
      // Try to find exact quantity and price match first
      const exactMatches = poCandidates.filter(po => 
        Math.abs(parseFloat(po.PurchaseQty.toString()) - invoiceQty) < opts.quantityTolerance &&
        Math.abs(parseFloat(po.PurchasePrice.toString()) - invoicePrice) < opts.priceTolerance
      );

      if (exactMatches.length > 0) {
        poMatch = exactMatches[0]; // Take first exact match
      } else {
        // If no exact match, try quantity match only
        const qtyMatches = poCandidates.filter(po => 
          Math.abs(parseFloat(po.PurchaseQty.toString()) - invoiceQty) < opts.quantityTolerance
        );
        
        if (qtyMatches.length > 0) {
          poMatch = qtyMatches[0]; // Take first quantity match
        } else {
          // If no quantity match, try price match only
          const priceMatches = poCandidates.filter(po => 
            Math.abs(parseFloat(po.PurchasePrice.toString()) - invoicePrice) < opts.priceTolerance
          );
          
          if (priceMatches.length > 0) {
            poMatch = priceMatches[0]; // Take first price match
          } else {
            // Fall back to first candidate found
            poMatch = poCandidates[0];
          }
        }
      }
    }

    if (poMatch) {
      const poQty = parseFloat(poMatch.PurchaseQty.toString());
      const poPrice = parseFloat(poMatch.PurchasePrice.toString());
      const poDateRequired = poMatch.DateRequired;

      const qtyMatch = Math.abs(invoiceQty - poQty) < opts.quantityTolerance;
      const priceMatch = Math.abs(invoicePrice - poPrice) < opts.priceTolerance;

      // Standardize dates for comparison - prioritize item-specific delivery date
      const itemDate = itemDeliveryDate || invoiceData.invoiceDate || "";
      const invoiceDateStd = standardizeDate(itemDate);
      const poDateStd = standardizeDate(poDateRequired);
      const dateMatch = opts.requireDateMatch ? datesEqual(invoiceDateStd, poDateStd) : true;

      // Invoice row
      const invoiceResult: ReconciliationResult = {
        Source: "📄 INVOICE",
        "PO #": poNumber,
        "Item/Description": itemName,
        Qty: invoiceQty,
        "Unit Price": invoicePrice,
        "Total Price": invoiceQty * invoicePrice,
        Date: invoiceDateStd,
        Status: (qtyMatch && priceMatch && dateMatch) ? "MATCH" : "DISCREPANCY",
        _qty_match: qtyMatch,
        _price_match: priceMatch,
        _date_match: dateMatch
      };

      // PO row
      const poResult: ReconciliationResult = {
        Source: "📋 PO",
        "PO #": poMatch.PurchaseOrderID,
        "Item/Description": `${poMatch.PurchaseSupplierItem} - ${poMatch.PurchaseSupplierDescription.replace(/\n/g, ' ')}`,
        Qty: poQty,
        "Unit Price": poPrice,
        "Total Price": poQty * poPrice,
        Date: poDateStd,
        Status: (qtyMatch && priceMatch && dateMatch) ? "MATCH" : "DISCREPANCY",
        _qty_match: qtyMatch,
        _price_match: priceMatch,
        _date_match: dateMatch
      };

      reconciliationResults.push(invoiceResult, poResult);
    } else {
      // Invoice row (no match found)
      const itemDate = itemDeliveryDate || invoiceData.invoiceDate || "";
      const invoiceResult: ReconciliationResult = {
        Source: "📄 INVOICE",
        "PO #": poNumber,
        "Item/Description": itemName,
        Qty: invoiceQty,
        "Unit Price": invoicePrice,
        "Total Price": invoiceQty * invoicePrice,
        Date: standardizeDate(itemDate),
        Status: "NO MATCH"
      };

      // No PO row to add since no match found
      reconciliationResults.push(invoiceResult);
    }
  }

  return reconciliationResults;
}

/**
 * Generate summary statistics from reconciliation results
 */
export function generateReconciliationSummary(results: ReconciliationResult[]): ReconciliationSummary {
  // Count invoice rows only to avoid double counting
  const invoiceRows = results.filter(r => r.Source === "📄 INVOICE");
  const totalItems = invoiceRows.length;
  const matches = invoiceRows.filter(r => r.Status === "MATCH").length;
  const discrepancies = invoiceRows.filter(r => r.Status === "DISCREPANCY").length;
  const noMatches = invoiceRows.filter(r => r.Status === "NO MATCH").length;

  return {
    totalItems,
    matches,
    discrepancies,
    noMatches
  };
}

/**
 * Filter reconciliation results to remove helper columns for display
 */
export function filterDisplayResults(results: ReconciliationResult[]): Partial<ReconciliationResult>[] {
  return results.map(result => {
    const { _qty_match, _price_match, _date_match, ...displayResult } = result;
    return displayResult;
  });
}

/**
 * Validate invoice data structure
 */
export function validateInvoiceData(invoiceData: any): invoiceData is InvoiceData {
  if (!invoiceData || typeof invoiceData !== 'object') {
    return false;
  }

  if (!invoiceData.poNumber || typeof invoiceData.poNumber !== 'string') {
    return false;
  }

  if (!Array.isArray(invoiceData.lineItems)) {
    return false;
  }

  for (const item of invoiceData.lineItems) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    
    if (!item.productName || typeof item.productName !== 'string') {
      return false;
    }
    
    if (item.quantity === undefined || item.quantity === null || isNaN(parseFloat(item.quantity))) {
      return false;
    }
  }

  return true;
}

/**
 * Validate purchase order records
 */
export function validatePORecords(poRecords: any[]): poRecords is PurchaseOrderRecord[] {
  if (!Array.isArray(poRecords)) {
    return false;
  }

  for (const record of poRecords) {
    if (!record || typeof record !== 'object') {
      return false;
    }
    
    const requiredFields = ['PurchaseOrderID', 'PurchaseQty', 'PurchasePrice', 'DateRequired', 'PurchaseSupplierItem', 'PurchaseSupplierDescription'];
    
    for (const field of requiredFields) {
      if (record[field] === undefined || record[field] === null) {
        return false;
      }
    }
    
    if (isNaN(parseFloat(record.PurchaseQty)) || isNaN(parseFloat(record.PurchasePrice))) {
      return false;
    }
  }

  return true;
}