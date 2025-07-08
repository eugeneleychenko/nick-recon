/**
 * API route for invoice reconciliation
 * Combines PDF extraction, Claude processing, and reconciliation logic
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { reconcileInvoiceData, generateReconciliationSummary, validateInvoiceData, validatePORecords } from '../../../../reconciliation';
import { InvoiceData, PurchaseOrderRecord, ReconciliationResult, ReconciliationSummary } from '../../../../types';
import { Buffer } from 'node:buffer';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Convert a File (from form-data) into a Base64 string that can be passed to
 * Anthropic's Messages API.
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

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
    
    // Step 1: Encode the PDF and ask Claude to extract invoice data directly
    const pdfBase64 = await fileToBase64(file);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64
              }
            },
            {
              type: "text",
              text: `Extract the following information from this invoice PDF **and return *only* JSON**:
{
  "poNumber": "The purchase order number",
  "invoiceDate": "Invoice date (if present)",
  "lineItems": [
    {
      "productName": "Product description",
      "quantity": "Number",
      "unitPrice": "Unit price as number (if available)",
      "totalPrice": "Line total as number (if available)",
      "deliveryDate": "Delivery date for the item or empty string"
    }
  ]
}

Rules:
• Extract *all* line items.
• Quantities & prices must be numbers, not strings.
• If a field is missing leave it blank ("" or 0) but keep the key.
• Return **nothing except the JSON object**.`
            }
          ]
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