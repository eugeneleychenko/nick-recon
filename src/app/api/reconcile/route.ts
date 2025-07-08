/**
 * API route for invoice reconciliation
 * Combines PDF extraction, Claude processing, and reconciliation logic
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { processPDFFile, cleanExtractedText } from '@/lib/pdf-utils';
import { reconcileInvoiceData, generateReconciliationSummary, validateInvoiceData, validatePORecords } from '../../../../reconciliation';
import { InvoiceData, PurchaseOrderRecord, ReconciliationResult, ReconciliationSummary } from '../../../../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY not configured'
      }, { status: 500 });
    }
    
    const data = await request.formData();
    const file = data.get('file') as File;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }
    
    // Step 1: Extract text from PDF
    const pdfResult = await processPDFFile(file);
    const extractedText = cleanExtractedText(pdfResult.text);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No text found in PDF file'
      }, { status: 400 });
    }
    
    // Step 2: Use Claude to extract invoice data
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `From the extracted invoice text, extract the following information and return as JSON:
{
    "poNumber": "The purchase order number",
    "invoiceDate": "Invoice date if available at document level",
    "lineItems": [
        {
            "productName": "Product name/description",
            "quantity": "Quantity as number",
            "unitPrice": "Unit price per item as number (if available)",
            "totalPrice": "Total line price as number (if available)",
            "deliveryDate": "Delivery date for this specific item if listed under the item, otherwise leave empty"
        }
    ]
}

Extract ALL line items from the invoice. Make sure quantities and prices are numbers, not strings.
For productName, extract the full product description as it appears.
For unitPrice and totalPrice: Look for both unit price per item AND total line price. If only one is available, extract that one. If both are available, extract both.
For deliveryDate, look for any date information that appears under or near each individual line item (like delivery dates, required dates, etc.). If there's no item-specific date, leave this field empty.

Here's the extracted text:
${extractedText}`
        }
      ]
    });
    
    // Parse Claude's response
    const responseContent = message.content[0].type === 'text' ? message.content[0].text : '';
    let invoiceData: InvoiceData;
    
    try {
      const start = responseContent.indexOf('{');
      const end = responseContent.lastIndexOf('}') + 1;
      
      if (start === -1 || end === -1) {
        throw new Error('No JSON object found in the response');
      }
      
      const jsonStr = responseContent.substring(start, end);
      invoiceData = JSON.parse(jsonStr);
      
    } catch (parseError) {
      console.error('Error parsing invoice data:', parseError);
      return NextResponse.json({
        success: false,
        error: `Error parsing invoice data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
      }, { status: 500 });
    }
    
    // Validate extracted invoice data
    if (!validateInvoiceData(invoiceData)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid invoice data structure extracted'
      }, { status: 400 });
    }
    
    // Step 3: Fetch purchase order data
    const poUrl = "https://opensheet.elk.sh/1pIQBhOI3ynsRfdcwqsHLlUrlVjSQ2qFtaMgcGHyW9OU/2";
    const poResponse = await fetch(poUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });
    
    if (!poResponse.ok) {
      throw new Error(`Failed to fetch purchase order data: ${poResponse.status}`);
    }
    
    const poData = await poResponse.json();
    
    if (!Array.isArray(poData) || !validatePORecords(poData)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid purchase order data structure'
      }, { status: 500 });
    }
    
    const purchaseOrders: PurchaseOrderRecord[] = poData;
    
    // Step 4: Perform reconciliation
    const reconciliationResults: ReconciliationResult[] = reconcileInvoiceData(invoiceData, purchaseOrders, { requireDateMatch: true });
    const summary: ReconciliationSummary = generateReconciliationSummary(reconciliationResults);
    
    return NextResponse.json({
      success: true,
      data: {
        extractedText: extractedText.substring(0, 500) + '...', // Truncate for response size
        invoiceData,
        purchaseOrderCount: purchaseOrders.length,
        reconciliationResults,
        summary,
        fileName: file.name
      }
    });
    
  } catch (error) {
    console.error('Error in reconciliation process:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Invoice reconciliation endpoint. Use POST to reconcile PDF invoices with purchase orders.' 
  });
}