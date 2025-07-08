/**
 * API route for Claude-based invoice data extraction
 * Ports Python Claude integration (lines 248-296)
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { processPDFFile, cleanExtractedText } from '@/lib/pdf-utils';
import { ClaudeExtractionResult, InvoiceData } from '../../../../types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
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
    
    // Process the PDF file
    const pdfResult = await processPDFFile(file);
    const extractedText = cleanExtractedText(pdfResult.text);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No text found in PDF file'
      }, { status: 400 });
    }
    
    // Use Claude to extract invoice data
    // Port the exact prompt from Python version (lines 254-275)
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
    
    // Extract the JSON content from the response
    const responseContent = message.content[0].type === 'text' ? message.content[0].text : '';
    
    let invoiceData: InvoiceData;
    
    try {
      // Find and parse the JSON content
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
        error: `Error parsing invoice data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        debugInfo: {
          responseContent: responseContent.substring(0, 500) + '...'
        }
      }, { status: 500 });
    }
    
    const processingTime = Date.now() - startTime;
    
    // Validate the extracted data
    if (!invoiceData.poNumber || !invoiceData.lineItems || !Array.isArray(invoiceData.lineItems)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid invoice data structure extracted',
        debugInfo: {
          extractedData: invoiceData
        }
      }, { status: 400 });
    }
    
    // Calculate confidence score based on extracted data quality
    let confidence = 0.5; // Base confidence
    
    if (invoiceData.poNumber && invoiceData.poNumber.trim().length > 0) {
      confidence += 0.2;
    }
    
    if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
      confidence += 0.2;
      
      // Check quality of line items
      const validItems = invoiceData.lineItems.filter(item => 
        item.productName && 
        item.productName.trim().length > 0 &&
        item.quantity &&
        !isNaN(parseFloat(item.quantity.toString()))
      );
      
      if (validItems.length === invoiceData.lineItems.length) {
        confidence += 0.1;
      }
    }
    
    const result: ClaudeExtractionResult = {
      invoiceData,
      confidence,
      processingTime
    };
    
    return NextResponse.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error extracting invoice data:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Invoice data extraction endpoint. Use POST to extract data from PDF files.' 
  });
}