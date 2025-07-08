/**
 * API route for PDF file upload and text extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPDFFile, cleanExtractedText } from '@/lib/pdf-utils';
import { UploadFileResponse } from '../../../../types';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File;
    
    if (!file) {
      return NextResponse.json<UploadFileResponse>({
        success: false,
        fileName: '',
        fileId: '',
        error: 'No file provided'
      }, { status: 400 });
    }
    
    // Process the PDF file
    const result = await processPDFFile(file);
    
    // Clean the extracted text
    const cleanedText = cleanExtractedText(result.text);
    
    if (!cleanedText || cleanedText.trim().length === 0) {
      return NextResponse.json<UploadFileResponse>({
        success: false,
        fileName: file.name,
        fileId: '',
        error: 'No text found in PDF file'
      }, { status: 400 });
    }
    
    // Generate a unique file ID for this session
    const fileId = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store the extracted text temporarily (in a real app, you might use Redis or a database)
    // For now, we'll return the text directly and let the client handle it
    
    return NextResponse.json<UploadFileResponse>({
      success: true,
      fileName: file.name,
      fileId: fileId
    });
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    
    return NextResponse.json<UploadFileResponse>({
      success: false,
      fileName: '',
      fileId: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'PDF upload endpoint. Use POST to upload files.' 
  });
}