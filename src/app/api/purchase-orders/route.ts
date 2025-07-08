/**
 * API route for fetching purchase order data
 * Ports Python fetch_purchase_order_data function (lines 31-42)
 */

import { NextResponse } from 'next/server';
import { PurchaseOrderDataResponse, PurchaseOrderRecord } from '../../../../types';
import { validatePORecords } from '../../../../reconciliation';

export async function GET() {
  try {
    // Fetch purchase order data from the external JSON endpoint
    const url = "https://opensheet.elk.sh/1pIQBhOI3ynsRfdcwqsHLlUrlVjSQ2qFtaMgcGHyW9OU/2";
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache control to prevent stale data
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Validate the data structure
    if (!Array.isArray(data)) {
      throw new Error('Expected an array of purchase order records');
    }
    
    // Validate each record
    if (!validatePORecords(data)) {
      throw new Error('Invalid purchase order record structure');
    }
    
    const purchaseOrders: PurchaseOrderRecord[] = data;
    
    return NextResponse.json<PurchaseOrderDataResponse>({
      success: true,
      data: purchaseOrders,
      recordCount: purchaseOrders.length
    });
    
  } catch (error) {
    console.error('Error fetching purchase order data:', error);
    
    return NextResponse.json<PurchaseOrderDataResponse>({
      success: false,
      data: [],
      recordCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ 
    message: 'Purchase order data endpoint. Use GET to fetch data.' 
  }, { status: 405 });
}