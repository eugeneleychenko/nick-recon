"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Upload, FileText, Package, CheckCircle, XCircle, Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { ExclamationTriangleIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons"
import { ReconciliationResult, ReconciliationSummary } from "./types"
import clsx from "clsx"


export default function PDFProcessorDashboard() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ReconciliationResult[]>([])
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const { theme, setTheme } = useTheme()

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find((file) => file.type === "application/pdf")

    if (pdfFile) {
      setUploadedFile(pdfFile)
      toast.success("PDF uploaded successfully!")
    } else {
      toast.error("Please upload a PDF file")
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "application/pdf") {
      setUploadedFile(file)
      toast.success("PDF uploaded successfully!")
    } else {
      toast.error("Please select a PDF file")
    }
  }

  const processFile = async () => {
    if (!uploadedFile) return

    setIsProcessing(true)
    setProgress(0)

    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', uploadedFile)

      // Start progress simulation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 15
        })
      }, 500)

      // Call the reconciliation API
      const response = await fetch('/api/reconcile', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(95)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process file')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Processing failed')
      }

      // Update UI with results
      setResults(data.data.reconciliationResults)
      setSummary(data.data.summary)
      setProgress(100)
      setIsProcessing(false)

      // Show success toast with summary
      const summaryText = `Found ${data.data.summary.matches} matches, ${data.data.summary.discrepancies} discrepancies, and ${data.data.summary.noMatches} unmatched documents`
      
      toast.success("Processing completed!", {
        description: summaryText,
      })

    } catch (error) {
      console.error('Error processing file:', error)
      setIsProcessing(false)
      setProgress(0)
      
      toast.error("Processing failed", {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MATCH":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Match
          </Badge>
        )
      case "DISCREPANCY":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Discrepancy
          </Badge>
        )
      case "NO MATCH":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
            <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
            No Match
          </Badge>
        )
      default:
        return null
    }
  }

  const getTypeIcon = (source: string) => {
    return source === "📄 INVOICE" ? (
      <FileText className="w-4 h-4 text-blue-600" />
    ) : (
      <Package className="w-4 h-4 text-purple-600" />
    )
  }

  // Use summary data if available, otherwise calculate from results
  const matchCount = summary?.matches ?? 0
  const discrepancyCount = summary?.discrepancies ?? 0
  const noMatchCount = summary?.noMatches ?? 0

  // Download reconciliation results as CSV
  const downloadResults = () => {
    if (results.length === 0) {
      toast.error("No results to download")
      return
    }

    // Convert results to CSV format
    const headers = ["Source", "PO #", "Item/Description", "Qty", "Unit Price", "Total Price", "Date", "Status"]
    const csvContent = [
      headers.join(","),
      ...results.map(result => [
        `"${result.Source}"`,
        `"${result["PO #"]}"`,
        `"${result["Item/Description"].replace(/"/g, '""')}"`,
        result.Qty,
        result["Unit Price"],
        result["Total Price"],
        `"${result.Date}"`,
        `"${result.Status}"`
      ].join(","))
    ].join("\n")

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `reconciliation_report_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Report downloaded successfully!")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">
                PDF Invoice Processor
              </h1>
              <p className="text-sm text-muted-foreground">Compare invoices and purchase orders with AI precision</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={downloadResults}
                disabled={results.length === 0}
              >
                <Download className="w-4 h-4" />
                Export Results
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Upload PDF Documents
                </CardTitle>
                <CardDescription>Drag and drop your PDF files or click to browse</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "border-border hover:border-blue-400"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Drop your PDF files here</p>
                      <p className="text-sm text-muted-foreground">or click to browse</p>
                    </div>
                    <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" id="file-upload" />
                    <Button asChild variant="outline">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        Choose Files
                      </label>
                    </Button>
                  </div>
                </div>

                {uploadedFile && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800 dark:text-green-200">{uploadedFile.name}</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Processing...</span>
                      <span className="text-sm text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <Button
                  onClick={processFile}
                  disabled={!uploadedFile || isProcessing}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  {isProcessing ? "Processing..." : "Process Documents"}
                </Button>
              </CardContent>
            </Card>

          </div>

          {/* Results Section */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Processing Results
                </CardTitle>
                <CardDescription>Document comparison and matching results</CardDescription>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Upload and process documents to see results</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((result, index) => {
                            const qtyMismatch = result._qty_match === false;
                            const priceMismatch = result._price_match === false;
                            const dateMismatch = result._date_match === false;

                            const rowNoMatch = result.Status === "NO MATCH";

                            return (
                              <TableRow
                                key={index}
                                className={clsx({
                                  "bg-red-50 dark:bg-red-900/10": rowNoMatch,
                                })}
                              >
                                <TableCell>{getTypeIcon(result.Source)}</TableCell>
                                <TableCell
                                  className={clsx({
                                    "bg-red-50 dark:bg-red-900/20 text-red-700": dateMismatch && !rowNoMatch,
                                  })}
                                >
                                  <div>
                                    <p className="font-medium">{result["PO #"]}</p>
                                    <p className="text-sm text-muted-foreground">{result.Date}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-xs truncate" title={result["Item/Description"]}>
                                    {result["Item/Description"]}
                                  </div>
                                </TableCell>
                                <TableCell
                                  className={clsx("font-mono", {
                                    "bg-red-50 dark:bg-red-900/20 text-red-700": (qtyMismatch || priceMismatch) && !rowNoMatch,
                                  })}
                                >
                                  <div>
                                    <p>Qty: {result.Qty}</p>
                                    <p>${result["Unit Price"].toFixed(2)}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(result.Status)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
